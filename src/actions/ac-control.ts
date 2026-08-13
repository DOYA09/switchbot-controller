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
import { invalidateDeviceStatusCache } from "../device-status-cache";
import { handleGetListRequest } from "../pi-list-handler";
import { getAcState, setAcState, clampAcTemp, AcState } from "../ac-state";
import type { GlobalSettings } from "../global-settings";

/**
 * このアクション専用の設定。エアコン(赤外線リモコン)専用のため、
 * パラメーターコントロールとは異なり実機からの状態取得(ポーリング)は行わない。
 * その代わり、シングル/トグル/トリプルアクション等の「エアコン詳細設定」「エアコン温度設定」
 * コマンドと同じ共有状態(src/ac-state.ts、グローバル設定に保存)を読み書きすることで、
 * どちらから操作してもある程度追従できるようにしている(実機からの読み取りができないため、
 * あくまで「プラグインが最後に送信した内容の記憶」を介した疑似的な同期であることに変わりはない)。
 *
 * unit: 表示単位。"C"(摂氏 16-30) または "F"(華氏 60-90)。
 * value: 現在の設定温度(表示単位のまま保持。共有状態は常に摂氏で保持するため、読み書き時に変換する)。
 * mode: 現在のモードのコード(2=冷房 / 5=暖房 / 3=除湿 / 4=送風)。
 * coolDefaultTemp / heatDefaultTemp: タッチで冷房/暖房に切り替えた際に適用するデフォルト温度
 *   (表示単位のまま保持。単位を切り替えても自動換算はされないため、切替後に再設定が必要)。
 * modeCoolEnabled 等: タッチでの切替対象に含めるモード(既定は冷房/暖房のみ有効)。
 */
interface AcControlSettings {
	[key: string]: any;
	deviceId?: string;
	deviceName?: string;
	deviceType?: string;
	unit?: "C" | "F";
	value?: number;
	mode?: number;
	power?: "on" | "off";
	coolDefaultTemp?: number;
	heatDefaultTemp?: number;
	modeCoolEnabled?: boolean;
	modeHeatEnabled?: boolean;
	modeDryEnabled?: boolean;
	modeFanEnabled?: boolean;
}

interface ModeDef {
	code: number;
	labelJa: string;
}

/** SwitchBot APIのsetAllが受け付けるモードコード(2=冷房/5=暖房/3=除湿/4=送風) */
const MODES: Record<"cool" | "heat" | "dry" | "fan", ModeDef> = {
	cool: { code: 2, labelJa: "冷房" },
	heat: { code: 5, labelJa: "暖房" },
	dry: { code: 3, labelJa: "除湿" },
	fan: { code: 4, labelJa: "送風" }
};

const MODE_ORDER: Array<"cool" | "heat" | "dry" | "fan"> = ["cool", "heat", "dry", "fan"];

const DEFAULT_SETTINGS: Required<Pick<
	AcControlSettings,
	"unit" | "value" | "mode" | "coolDefaultTemp" | "heatDefaultTemp" | "modeCoolEnabled" | "modeHeatEnabled" | "modeDryEnabled" | "modeFanEnabled"
>> = {
	unit: "C",
	value: 26,
	mode: MODES.cool.code,
	coolDefaultTemp: 26,
	heatDefaultTemp: 22,
	modeCoolEnabled: true,
	modeHeatEnabled: true,
	modeDryEnabled: false,
	modeFanEnabled: false
};

/** 固定の風量(常に自動)。SwitchBot APIのsetAllは温度,モード,風量,電源の4要素が必須のため */
const FIXED_FAN_SPEED = 1;

const DEBOUNCE_MS = 350;
/** 他のキーが更新した共有状態を拾いに行く間隔 */
const SYNC_INTERVAL_MS = 5000;
/** 自分の操作直後はこの期間、共有状態からの自動反映を止める(操作した値を優先するため) */
const QUIET_PERIOD_MS = 4000;

/**
 * 組み込みレイアウト「$B1」を複製したカスタムレイアウト。
 * 「モード名+温度」(例: 冷房26℃)は$B1既定の24pxだと大きすぎるため、
 * valueのフォントサイズのみ23pxに調整している(アイコン/タイトル/バーの配置は$B1と同一)。
 */
const AC_LAYOUT = {
	id: "com.switchbot.controller.accontrol.layout",
	items: [
		{ key: "title", type: "text", rect: [16, 10, 136, 24], font: { size: 16, weight: 600 }, alignment: "left" },
		{ key: "icon", type: "pixmap", rect: [16, 40, 48, 48] },
		{ key: "value", type: "text", rect: [76, 40, 108, 32], font: { size: 23, weight: 600 }, alignment: "right", "text-overflow": "ellipsis" },
		{ key: "indicator", type: "bar", rect: [76, 74, 108, 12], value: 0, subtype: 4, border_w: 0 }
	]
};

function rangeForUnit(unit: "C" | "F"): { min: number; max: number } {
	return unit === "F" ? { min: 60, max: 90 } : { min: 16, max: 30 };
}

/** 表示単位の値を、SwitchBot APIへ送る摂氏の整数値に変換する */
function toCelsius(value: number, unit: "C" | "F"): number {
	if (unit === "F") return Math.round(((value - 32) * 5) / 9);
	return Math.round(value);
}

/** 共有状態(常に摂氏)を、表示単位の値に変換する */
function fromCelsius(celsius: number, unit: "C" | "F"): number {
	if (unit === "F") return Math.round((celsius * 9) / 5 + 32);
	return Math.round(celsius);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function modeKeyByCode(code: number | undefined): "cool" | "heat" | "dry" | "fan" | undefined {
	return MODE_ORDER.find((k) => MODES[k].code === code);
}

/** エラーがレート制限によるものかどうかで、タッチディスプレイに表示する文言を切り替える */
function errorFeedbackText(err: unknown): string {
	return err instanceof RateLimitError ? "レート制限" : "通信エラー";
}

function isModeEnabled(settings: AcControlSettings, key: "cool" | "heat" | "dry" | "fan"): boolean {
	if (key === "cool") return settings.modeCoolEnabled ?? DEFAULT_SETTINGS.modeCoolEnabled;
	if (key === "heat") return settings.modeHeatEnabled ?? DEFAULT_SETTINGS.modeHeatEnabled;
	if (key === "dry") return settings.modeDryEnabled ?? DEFAULT_SETTINGS.modeDryEnabled;
	return settings.modeFanEnabled ?? DEFAULT_SETTINGS.modeFanEnabled;
}

async function sendAcOrThrow(
	creds: SwitchBotCredentials,
	deviceId: string,
	temperatureCelsius: number,
	modeCode: number,
	power: "on" | "off"
): Promise<void> {
	const parameter = `${temperatureCelsius},${modeCode},${FIXED_FAN_SPEED},${power}`;
	const res = await controlDevice(creds, deviceId, "setAll", parameter, "command");
	throwIfFailed(res, "SwitchBotコマンド");
	invalidateDeviceStatusCache(deviceId);
}

async function sendPowerOrThrow(creds: SwitchBotCredentials, deviceId: string, power: "turnOn" | "turnOff"): Promise<void> {
	const res = await controlDevice(creds, deviceId, power);
	throwIfFailed(res, "SwitchBotコマンド");
	invalidateDeviceStatusCache(deviceId);
}

interface RuntimeState {
	debounceTimer?: ReturnType<typeof setTimeout>;
	syncTimer?: ReturnType<typeof setInterval>;
	lastInteractionAt?: number;
}

type ActionRef = DialAction<AcControlSettings>;

/**
 * エアコン(赤外線リモコン)専用のダイヤル。パラメーターコントロールから分離した専用アクション。
 * - ダイヤル回転: 設定温度を調整(範囲は摂氏16-30 / 華氏60-90で固定)
 * - ダイヤル押し込み: 電源のオン/オフ切替
 * - タッチ: PIで有効にしたモード(冷房/暖房/除湿/送風)を順番に切替
 *   (冷房/暖房への切替時は、それぞれのデフォルト温度を適用)
 * 赤外線リモコンのため実機の状態は取得できないが、シングル/トグル/トリプルアクション等の
 * 「エアコン詳細設定」「エアコン温度設定」と共有する状態(src/ac-state.ts)を定期的に確認し、
 * 他のキーからの操作もある程度反映する。ただし自分の操作直後(QUIET_PERIOD_MS)は、
 * その反映を止めて操作した値を優先する。
 */
@action({ UUID: "com.switchbot.controller.accontrol" })
export class AcControlAction extends SingletonAction<AcControlSettings> {
	private runtime = new Map<string, RuntimeState>();

	private getRuntime(id: string): RuntimeState {
		let r = this.runtime.get(id);
		if (!r) {
			r = {};
			this.runtime.set(id, r);
		}
		return r;
	}

	private markInteraction(id: string): void {
		this.getRuntime(id).lastInteractionAt = Date.now();
	}

	private isQuiet(id: string): boolean {
		return Date.now() - (this.runtime.get(id)?.lastInteractionAt ?? 0) < QUIET_PERIOD_MS;
	}

	private async getCreds(): Promise<SwitchBotCredentials | null> {
		const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		if (!global?.token || !global?.secret) return null;
		return { token: global.token, secret: global.secret };
	}

	override async onWillAppear(ev: WillAppearEvent<AcControlSettings>): Promise<void> {
		if (!ev.action.isDial()) return;

		try {
			await ev.action.setFeedbackLayout(AC_LAYOUT as any);
		} catch (err) {
			streamDeck.logger.error(`AcControl: レイアウト適用に失敗しました: ${String(err)}`);
		}

		const settings = (ev.payload.settings ?? {}) as AcControlSettings;
		let changed = false;
		(Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]).forEach((key) => {
			if (settings[key] === undefined) {
				(settings as Record<string, unknown>)[key] = DEFAULT_SETTINGS[key];
				changed = true;
			}
		});

		// 表示時は必ず共有状態から最新を取り込む(他のキーからの操作を反映するため)
		if (settings.deviceId) {
			await this.applySharedState(settings);
			changed = true;
		}

		if (changed) {
			await ev.action.setSettings(settings);
		}

		this.renderFeedback(ev.action, settings);
		this.startSyncPolling(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<AcControlSettings>): void {
		const r = this.runtime.get(ev.action.id);
		if (r?.debounceTimer) clearTimeout(r.debounceTimer);
		if (r?.syncTimer) clearInterval(r.syncTimer);
		this.runtime.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<AcControlSettings>): void {
		if (!ev.action.isDial()) return;
		// ここでは共有状態への問い合わせは行わない(自分自身のsetSettings呼び出しでも
		// 発火するイベントのため、直近の操作を古い値で上書きしてしまう不具合を避けるため)。
		// 他のキーからの反映は startSyncPolling の定期チェックに任せる。
		this.renderFeedback(ev.action, ev.payload.settings);
	}

	/** プロパティインスペクターからのデバイス一覧取得リクエストを処理する */
	override async onSendToPlugin(ev: any): Promise<void> {
		await handleGetListRequest(ev, "AcControl");
	}

	/** 共有状態(温度/モード/電源)を読み込み、settingsへ反映する(表示単位への変換込み) */
	private async applySharedState(settings: AcControlSettings): Promise<void> {
		if (!settings.deviceId) return;
		const shared = await getAcState(settings.deviceId);
		const unit = settings.unit ?? DEFAULT_SETTINGS.unit;
		settings.value = fromCelsius(shared.temp, unit);
		settings.mode = shared.mode;
		settings.power = shared.power;
	}

	/** 他のキーが更新した共有状態を定期的に取り込み、直近の自分の操作を上書きしないようにする */
	private startSyncPolling(dial: ActionRef): void {
		const r = this.getRuntime(dial.id);
		if (r.syncTimer) clearInterval(r.syncTimer);
		r.syncTimer = setInterval(() => {
			void (async () => {
				if (this.isQuiet(dial.id)) return;
				try {
					const settings = await dial.getSettings();
					if (!settings.deviceId) return;
					const before = JSON.stringify({ value: settings.value, mode: settings.mode, power: settings.power });
					await this.applySharedState(settings);
					const after = JSON.stringify({ value: settings.value, mode: settings.mode, power: settings.power });
					if (before !== after) {
						await dial.setSettings(settings);
						this.renderFeedback(dial, settings);
					}
				} catch (err) {
					streamDeck.logger.error(`AcControl: 共有状態の同期に失敗しました: ${String(err)}`);
				}
			})();
		}, SYNC_INTERVAL_MS);
	}

	override async onDialRotate(ev: DialRotateEvent<AcControlSettings>): Promise<void> {
		const settings = ev.payload.settings;
		if (!settings.deviceId) {
			await ev.action.showAlert();
			return;
		}
		this.markInteraction(ev.action.id);

		const direction = Math.sign(ev.payload.ticks);
		if (direction === 0) return;

		const unit = settings.unit ?? DEFAULT_SETTINGS.unit;
		const range = rangeForUnit(unit);
		const current = settings.value ?? DEFAULT_SETTINGS.value;
		const next = clamp(current + direction, range.min, range.max);

		settings.value = next;
		settings.power = "on";
		await ev.action.setSettings(settings);
		this.renderFeedback(ev.action, settings);

		this.debounce(ev.action.id, async () => {
			const creds = await this.getCreds();
			if (!creds) {
				await ev.action.showAlert();
				return;
			}
			try {
				const mode = settings.mode ?? DEFAULT_SETTINGS.mode;
				const celsius = clampAcTemp(toCelsius(next, unit));
				await withRetry(() => sendAcOrThrow(creds, settings.deviceId!, celsius, mode, "on"));
				await setAcState(settings.deviceId!, { temp: celsius, mode, fan: FIXED_FAN_SPEED, power: "on" });
			} catch (err) {
				streamDeck.logger.error(`AcControl: 温度送信に失敗しました: ${String(err)}`);
				await ev.action.showAlert();
			}
		});
	}

	override async onDialDown(ev: DialDownEvent<AcControlSettings>): Promise<void> {
		const settings = ev.payload.settings;
		if (!settings.deviceId) {
			await ev.action.showAlert();
			return;
		}
		this.markInteraction(ev.action.id);

		const creds = await this.getCreds();
		if (!creds) {
			await ev.action.showAlert();
			return;
		}

		const nextPower: "on" | "off" = settings.power === "on" ? "off" : "on";

		try {
			await withRetry(() => sendPowerOrThrow(creds, settings.deviceId!, nextPower === "on" ? "turnOn" : "turnOff"));
			settings.power = nextPower;
			await ev.action.setSettings(settings);
			this.renderFeedback(ev.action, settings);

			const unit = settings.unit ?? DEFAULT_SETTINGS.unit;
			const shared: Partial<AcState> = { power: nextPower };
			if (nextPower === "on") {
				shared.temp = clampAcTemp(toCelsius(settings.value ?? DEFAULT_SETTINGS.value, unit));
				shared.mode = settings.mode ?? DEFAULT_SETTINGS.mode;
				shared.fan = FIXED_FAN_SPEED;
			}
			const current = await getAcState(settings.deviceId);
			await setAcState(settings.deviceId, { ...current, ...shared });
		} catch (err) {
			streamDeck.logger.error(`AcControl: 電源切替に失敗しました: ${String(err)}`);
			await ev.action.showAlert();
			await ev.action.setFeedback({ value: errorFeedbackText(err), indicator: { value: 0 } });
		}
	}

	/** タッチ操作: 有効になっているモードを順番に切り替える(冷房/暖房はそれぞれのデフォルト温度を適用) */
	override async onTouchTap(ev: TouchTapEvent<AcControlSettings>): Promise<void> {
		const settings = ev.payload.settings;
		if (!settings.deviceId) {
			await ev.action.showAlert();
			return;
		}
		this.markInteraction(ev.action.id);

		const enabledModes = MODE_ORDER.filter((key) => isModeEnabled(settings, key));
		if (enabledModes.length === 0) {
			await ev.action.showAlert();
			await ev.action.setFeedback({ value: "モード未設定", indicator: { value: 0 } });
			return;
		}

		const creds = await this.getCreds();
		if (!creds) {
			await ev.action.showAlert();
			return;
		}

		const currentKey = modeKeyByCode(settings.mode);
		const currentPos = currentKey ? enabledModes.indexOf(currentKey) : -1;
		const nextKey = enabledModes[(currentPos + 1 + enabledModes.length) % enabledModes.length];
		const nextMode = MODES[nextKey];

		const unit = settings.unit ?? DEFAULT_SETTINGS.unit;
		let nextValue = settings.value ?? DEFAULT_SETTINGS.value;
		if (nextKey === "cool") nextValue = settings.coolDefaultTemp ?? DEFAULT_SETTINGS.coolDefaultTemp;
		if (nextKey === "heat") nextValue = settings.heatDefaultTemp ?? DEFAULT_SETTINGS.heatDefaultTemp;
		const range = rangeForUnit(unit);
		nextValue = clamp(nextValue, range.min, range.max);

		try {
			const celsius = clampAcTemp(toCelsius(nextValue, unit));
			await withRetry(() => sendAcOrThrow(creds, settings.deviceId!, celsius, nextMode.code, "on"));
			settings.mode = nextMode.code;
			settings.value = nextValue;
			settings.power = "on";
			await ev.action.setSettings(settings);
			this.renderFeedback(ev.action, settings);
			await setAcState(settings.deviceId, { temp: celsius, mode: nextMode.code, fan: FIXED_FAN_SPEED, power: "on" });
		} catch (err) {
			streamDeck.logger.error(`AcControl: モード切替に失敗しました: ${String(err)}`);
			await ev.action.showAlert();
			await ev.action.setFeedback({ value: errorFeedbackText(err), indicator: { value: 0 } });
		}
	}

	private renderFeedback(dial: ActionRef, settings: AcControlSettings): void {
		// タッチディスプレイ上部のタイトルに、選択中のデバイス名を反映する
		void dial.setTitle(settings.deviceName || "");

		if (!settings.deviceId) {
			void dial.setFeedback({ value: "設定未入力", indicator: { value: 0 } });
			return;
		}

		const unit = settings.unit ?? DEFAULT_SETTINGS.unit;
		const range = rangeForUnit(unit);
		const value = settings.value ?? DEFAULT_SETTINGS.value;
		const modeKey = modeKeyByCode(settings.mode) ?? "cool";
		const modeLabel = MODES[modeKey].labelJa;
		const unitSymbol = unit === "F" ? "℉" : "℃";
		const percent = Math.round(((value - range.min) / (range.max - range.min)) * 100);

		void dial.setFeedback({
			// 温度の前に現在のモードを表示する
			value: settings.power === "on" ? `${modeLabel} ${value}${unitSymbol}` : "OFF",
			indicator: { value: settings.power === "on" ? clamp(percent, 0, 100) : 0 }
		});
	}

	private debounce(key: string, fn: () => void): void {
		const r = this.getRuntime(key);
		if (r.debounceTimer) clearTimeout(r.debounceTimer);
		r.debounceTimer = setTimeout(fn, DEBOUNCE_MS);
	}
}
