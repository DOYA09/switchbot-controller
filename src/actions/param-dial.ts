import streamDeck, {
	action,
	DialAction,
	DialDownEvent,
	DialRotateEvent,
	DidReceiveSettingsEvent,
	SingletonAction,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";
import { controlDevice, withRetry, RateLimitError, throwIfFailed, SwitchBotCredentials } from "../switchbot-api";
import { getCachedDeviceStatus, invalidateDeviceStatusCache } from "../device-status-cache";
import { handleGetListRequest } from "../pi-list-handler";
import { DEFAULT_OPERATION, OperationConfig } from "../operation-config";
import { runOperation } from "../operation-runner";
import type { GlobalSettings } from "../global-settings";

interface ParamDialSettings {
	[key: string]: any;
	deviceId: string;
	deviceName: string;
	deviceType: string;
	/** プリセット: setBrightness / setPosition / setColorTemperature / custom */
	command: string;
	customCommand: string;
	commandType: "command" | "customize";
	min: number;
	max: number;
	step: number;
	/** 現在値(表示・送信の両方に使う)。キーごとに保存され、再起動後も引き継がれる */
	value: number;
	unit: string;
	/** タッチで順番に実行する操作(最大3つ、空欄のスロットはスキップ) */
	touch1: OperationConfig;
	touch2: OperationConfig;
	touch3: OperationConfig;
	touchIndex: number;
	/** PIが保存する、選択中パラメーターの翻訳済み表示名(タッチディスプレイのタイトルに使う)。PI未起動の古い設定では空 */
	parameterLabel?: string;
}

const DEFAULT_SETTINGS: ParamDialSettings = {
	deviceId: "",
	deviceName: "",
	deviceType: "",
	command: "",
	customCommand: "",
	commandType: "command",
	min: 1,
	max: 100,
	step: 5,
	value: 50,
	unit: "%",
	touch1: DEFAULT_OPERATION,
	touch2: DEFAULT_OPERATION,
	touch3: DEFAULT_OPERATION,
	touchIndex: 0
};

const DEBOUNCE_MS = 350;
const STALE_THRESHOLD_MS = 3000; // 直近の同期からこれ以上経過していたら、ダイヤル操作前に実機の値を取り直す

/** プリセットコマンドと、実機の状態から同期する際に参照するステータスのフィールド名の対応 */
const STATUS_FIELD_BY_COMMAND: Record<string, "brightness" | "slidePosition" | "colorTemperature"> = {
	setBrightness: "brightness",
	setPosition: "slidePosition",
	setColorTemperature: "colorTemperature"
};

type ActionRef = DialAction<ParamDialSettings>;

interface RuntimeState {
	debounceTimer?: ReturnType<typeof setTimeout>;
	/** 直近に実機の値を確認(取得 or 送信)した時刻。古すぎる場合はダイヤル操作前に取り直す */
	lastSyncedAt?: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * タッチディスプレイ上部のタイトルを組み立てる。「デバイス名-パラメーター名」
 * (例: "ライト-明るさ")の形式にする。parameterLabelはPIが選択中のパラメーターの
 * 翻訳済み表示名を保存したもの(バックエンド側では多言語文言を持たないため)。
 * PIをまだ開いていない古い設定ではparameterLabelが無いため、その場合は
 * デバイス名のみ(従来通り)にフォールバックする。
 */
function buildTitle(settings: ParamDialSettings): string {
	const device = settings.deviceName || "";
	const label = settings.parameterLabel || "";
	if (device && label) return `${device}-${label}`;
	return device || label;
}

function resolveCommand(settings: ParamDialSettings): { command: string; commandType: string } {
	if (settings.command === "custom") {
		return { command: settings.customCommand || "", commandType: settings.commandType || "command" };
	}
	return { command: settings.command, commandType: "command" };
}

async function sendParameterOrThrow(
	creds: SwitchBotCredentials,
	deviceId: string,
	command: string,
	commandType: string,
	parameter: string
): Promise<void> {
	const res = await controlDevice(creds, deviceId, command, parameter, commandType);
	throwIfFailed(res, "SwitchBotコマンド");
	invalidateDeviceStatusCache(deviceId);
}

async function sendPowerOrThrow(creds: SwitchBotCredentials, deviceId: string, power: "turnOn" | "turnOff"): Promise<void> {
	const res = await controlDevice(creds, deviceId, power);
	throwIfFailed(res, "SwitchBotコマンド");
	invalidateDeviceStatusCache(deviceId);
}

/** 操作設定に、実際に選べる対象(デバイスID or シーンID)が入っているかどうか */
function isConfigured(config: OperationConfig | undefined): config is OperationConfig {
	if (!config) return false;
	return config.targetType === "scene" ? Boolean(config.sceneId) : Boolean(config.deviceId);
}

/**
 * 明るさ・カーテン位置・色温度など、1つの数値パラメーターで制御するコマンドを
 * デバイス・最小値/最大値/刻み幅ごとPIで自由に設定できる汎用ダイヤル。
 * タッチスクリーンには最大3つの操作(コマンド or シーン)を割り当てて順番に実行できる。
 * 将来SwitchBotに新しいsetXxx系コマンドが増えても、カスタムコマンド名を
 * 指定するだけでこのアクション1つで対応できる。
 * (エアコン専用の操作は「エアコンコントロール」アクションに分離されている)
 */
@action({ UUID: "com.switchbot.controller.paramdial" })
export class ParamDialAction extends SingletonAction<ParamDialSettings> {
	private runtime = new Map<string, RuntimeState>();

	private getRuntime(id: string): RuntimeState {
		let r = this.runtime.get(id);
		if (!r) {
			r = {};
			this.runtime.set(id, r);
		}
		return r;
	}

	private async getCreds(): Promise<SwitchBotCredentials | null> {
		const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		if (!global?.token || !global?.secret) return null;
		return { token: global.token, secret: global.secret };
	}

	override async onWillAppear(ev: WillAppearEvent<ParamDialSettings>): Promise<void> {
		if (!ev.action.isDial()) return;

		const settings = (ev.payload.settings ?? {}) as Partial<ParamDialSettings>;
		let changed = false;
		(Object.keys(DEFAULT_SETTINGS) as (keyof ParamDialSettings)[]).forEach((key) => {
			if (settings[key] === undefined) {
				(settings as Record<string, unknown>)[key] = String(key).startsWith("touch") && key !== "touchIndex" ? { ...DEFAULT_OPERATION } : DEFAULT_SETTINGS[key];
				changed = true;
			}
		});
		const finalSettings = settings as ParamDialSettings;
		if (changed) {
			await ev.action.setSettings(finalSettings);
		}

		this.renderFeedback(ev.action, finalSettings);
		await this.syncFromDevice(ev.action, finalSettings, true);
	}

	override onWillDisappear(ev: WillDisappearEvent<ParamDialSettings>): void {
		const r = this.runtime.get(ev.action.id);
		if (r?.debounceTimer) clearTimeout(r.debounceTimer);
		this.runtime.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ParamDialSettings>): Promise<void> {
		if (!ev.action.isDial()) return;
		this.renderFeedback(ev.action, ev.payload.settings);
	}

	/** プロパティインスペクターからのデバイス一覧・シーン一覧取得リクエストを処理する */
	override async onSendToPlugin(ev: any): Promise<void> {
		await handleGetListRequest(ev, "ParamDial");
	}

	override async onDialRotate(ev: DialRotateEvent<ParamDialSettings>): Promise<void> {
		const settings = ev.payload.settings;
		if (!settings.deviceId) {
			await ev.action.showAlert();
			return;
		}
		if (!settings.command) {
			await ev.action.showAlert();
			await ev.action.setFeedback({ value: "パラメーター未設定", indicator: { value: 0 } });
			return;
		}

		const direction = Math.sign(ev.payload.ticks);
		if (direction === 0) return;

		const step = settings.step && settings.step > 0 ? settings.step : DEFAULT_SETTINGS.step;
		const min = settings.min ?? DEFAULT_SETTINGS.min;
		const max = settings.max ?? DEFAULT_SETTINGS.max;

		// 直近の同期が古い場合、ダイヤル操作前に実機の値を取り直して基準にする。
		// (例: スマホアプリ等で値が変更された後にそのまま加算すると、実機の値を巻き戻してしまうため)
		const statusField = STATUS_FIELD_BY_COMMAND[settings.command];
		const r = this.getRuntime(ev.action.id);
		if (statusField && Date.now() - (r.lastSyncedAt ?? 0) > STALE_THRESHOLD_MS) {
			try {
				const creds = await this.getCreds();
				if (creds) {
					const res = await getCachedDeviceStatus(creds, settings.deviceId);
					const raw = res.body?.body?.[statusField];
					if (res.statusCode === 200 && res.body?.statusCode === 100 && typeof raw === "number") {
						settings.value = clamp(raw, min, max);
					}
					r.lastSyncedAt = Date.now();
				}
			} catch (err) {
				// 取得に失敗した場合は、それまでのキャッシュ値で操作を継続する(ここではエラー扱いにしない)
				streamDeck.logger.error(`ParamDial: 再取得(ダイヤル操作前)に失敗しました: ${String(err)}`);
			}
		}

		const rawNext = (settings.value ?? min) + step * direction;

		// 明るさのみ、下限(通常1%)未満に回したら表示だけ0%にして実機へは送らない
		// (SwitchBot APIのsetBrightnessは0を受け付けないため、テープライトコントロールと同様の特例)
		if (settings.command === "setBrightness" && rawNext < min) {
			settings.value = 0;
			await ev.action.setSettings(settings);
			await ev.action.setFeedback({ value: `0${settings.unit ?? ""}`, indicator: { value: 0 } });
			return;
		}

		const next = clamp(rawNext, min, max);

		settings.value = next;
		await ev.action.setSettings(settings);
		this.renderFeedback(ev.action, settings);

		this.debounce(ev.action.id, async () => {
			const creds = await this.getCreds();
			if (!creds) {
				await ev.action.showAlert();
				return;
			}
			const { command, commandType } = resolveCommand(settings);
			if (!command) {
				await ev.action.showAlert();
				return;
			}
			try {
				await withRetry(() => sendParameterOrThrow(creds, settings.deviceId, command, commandType, String(next)));
				this.getRuntime(ev.action.id).lastSyncedAt = Date.now();
			} catch (err) {
				if (err instanceof RateLimitError) {
					streamDeck.logger.warn(`ParamDial: 値送信がAPIのレート制限により失敗しました: ${String(err)}`);
				} else {
					streamDeck.logger.error(`ParamDial: 値送信に失敗しました: ${String(err)}`);
				}
				await ev.action.showAlert();
			}
		});
	}

	override async onDialDown(ev: DialDownEvent<ParamDialSettings>): Promise<void> {
		const settings = ev.payload.settings;
		if (!settings.deviceId) {
			await ev.action.showAlert();
			return;
		}

		const creds = await this.getCreds();
		if (!creds) {
			await ev.action.showAlert();
			return;
		}

		try {
			const status = await getCachedDeviceStatus(creds, settings.deviceId);
			const power = status.body?.body?.power;
			const next = power === "on" ? "turnOff" : "turnOn";
			await withRetry(() => sendPowerOrThrow(creds, settings.deviceId, next));
			// DialActionにはshowOkが無いため、フィードバック表示で切替完了を伝える
			await ev.action.setFeedback({ value: next === "turnOn" ? "ON" : "OFF" });
		} catch (err) {
			streamDeck.logger.error(`ParamDial: 電源切替に失敗しました: ${String(err)}`);
			await ev.action.showAlert();
		}
	}

	/**
	 * タッチ操作:
	 *  - 短いタップ: touch1〜touch3(空欄はスキップ)を順番に実行
	 *  - 長押し(hold): 対応コマンドなら実機の値を取得して同期、未対応の場合は現在値を再送する
	 */
	override async onTouchTap(ev: TouchTapEvent<ParamDialSettings>): Promise<void> {
		if (ev.payload.hold) {
			await this.syncFromDevice(ev.action, ev.payload.settings, false);
		} else {
			await this.applyNextTouchOperation(ev.action, ev.payload.settings);
		}
	}

	private async applyNextTouchOperation(dial: ActionRef, settings: ParamDialSettings): Promise<void> {
		const creds = await this.getCreds();
		if (!creds) {
			await dial.showAlert();
			return;
		}

		const slots = [settings.touch1, settings.touch2, settings.touch3].filter(isConfigured);
		if (slots.length === 0) {
			await dial.showAlert();
			await dial.setFeedback({ value: "未設定" });
			return;
		}

		const nextIndex = ((settings.touchIndex ?? -1) + 1) % slots.length;
		const config = slots[nextIndex];

		try {
			await runOperation(dial, creds, config);
			settings.touchIndex = nextIndex;
			await dial.setSettings(settings);
			this.renderFeedback(dial, settings);
		} catch (err) {
			streamDeck.logger.error(`ParamDial: タッチ操作の実行に失敗しました: ${String(err)}`);
			await dial.showAlert();
		}
	}

	private async syncFromDevice(dial: ActionRef, settings: ParamDialSettings, silent: boolean): Promise<void> {
		if (!settings.deviceId) {
			if (!silent) await dial.showAlert();
			return;
		}

		const creds = await this.getCreds();
		if (!creds) {
			if (!silent) await dial.showAlert();
			return;
		}

		const statusField = STATUS_FIELD_BY_COMMAND[settings.command];

		try {
			if (statusField) {
				const res = await getCachedDeviceStatus(creds, settings.deviceId);
				const raw = res.body?.body?.[statusField];
				if (res.statusCode === 200 && res.body?.statusCode === 100 && typeof raw === "number") {
					const min = settings.min ?? DEFAULT_SETTINGS.min;
					const max = settings.max ?? DEFAULT_SETTINGS.max;
					settings.value = clamp(raw, min, max);
					await dial.setSettings(settings);
					this.renderFeedback(dial, settings);
					this.getRuntime(dial.id).lastSyncedAt = Date.now();
					return;
				}
			}

			// 同期対象のフィールドが不明(カスタムコマンド等)な場合は、現在値を再送するだけに留める
			const { command, commandType } = resolveCommand(settings);
			if (command) {
				await withRetry(() => sendParameterOrThrow(creds, settings.deviceId, command, commandType, String(settings.value ?? DEFAULT_SETTINGS.value)));
			}
		} catch (err) {
			streamDeck.logger.error(`ParamDial: 同期に失敗しました: ${String(err)}`);
			if (!silent) await dial.showAlert();
		}
	}

	private renderFeedback(dial: ActionRef, settings: ParamDialSettings): void {
		// タッチディスプレイ上部のタイトルに、選択中のデバイス名とパラメーターを反映する
		void dial.setTitle(buildTitle(settings));

		if (!settings.command) {
			void dial.setFeedback({ value: "パラメーター未設定", indicator: { value: 0 } });
			return;
		}

		const min = settings.min ?? DEFAULT_SETTINGS.min;
		const max = settings.max ?? DEFAULT_SETTINGS.max;
		const value = settings.value ?? DEFAULT_SETTINGS.value;
		const percent = max > min ? Math.round(((value - min) / (max - min)) * 100) : 0;
		void dial.setFeedback({
			value: `${value}${settings.unit ?? ""}`,
			indicator: { value: clamp(percent, 0, 100) }
		});
	}

	private debounce(key: string, fn: () => void): void {
		const r = this.getRuntime(key);
		if (r.debounceTimer) clearTimeout(r.debounceTimer);
		r.debounceTimer = setTimeout(fn, DEBOUNCE_MS);
	}
}
