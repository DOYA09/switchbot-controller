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
import {
	controlDevice,
	executeScene,
	withRetry,
	RateLimitError,
	throwIfFailed,
	SwitchBotCredentials
} from "../switchbot-api";
import { getCachedDeviceStatus, invalidateDeviceStatusCache } from "../device-status-cache";
import { handleGetListRequest } from "../pi-list-handler";
import type { GlobalSettings } from "../global-settings";

/**
 * このアクションが保持する設定値(グローバル設定のトークン/シークレットは含まない)。
 * parameterTarget: ダイヤルで調整する対象。"brightness"(明るさ) / "colorTemperature"(色温度) /
 * "color"(カラー、8色を順に切替) / "custom"(カスタム)。
 * value: 現在値(表示・送信の両方に使う汎用フィールド)。colorの場合は色のインデックス(0-7)。
 *   明るさのみ特例として、実際にAPIへ送った最小値(1)より下に回した場合、表示だけ0にできる
 *   (0はSwitchBot APIのsetBrightnessが受け付けないため、実機へは送信しない)。
 * lastValue: 消灯直前の値(0特殊表示は含まない、実際に送信した値)。次に電源オンにする際の復元値として使う。
 * power は直近の既知状態のキャッシュ。
 * scene1Id-scene3Id はタッチタップで順番に切り替える、SwitchBotアプリ側で
 * 作成した「シーン」のID(空欄のスロットはスキップされる)。scene*Name は
 * プルダウン表示用のキャッシュ。
 * sceneIndex は直近に適用したシーン(有効なものの中での位置)。
 * pollIntervalSec は自動同期(定期取得)の間隔(秒)。
 */
interface TapeLightSettings {
	[key: string]: any;
	deviceId?: string;
	deviceName?: string;
	deviceType?: string;
	parameterTarget?: string;
	customCommand?: string;
	commandType?: "command" | "customize";
	value?: number;
	lastValue?: number;
	/** 旧バージョン(明るさ専用だった頃)の値。移行のためだけに読み取る */
	brightness?: number;
	power?: "on" | "off";
	scene1Id?: string;
	scene1Name?: string;
	scene2Id?: string;
	scene2Name?: string;
	scene3Id?: string;
	scene3Name?: string;
	sceneIndex?: number;
	pollIntervalSec?: number;
}

interface Range {
	min: number;
	max: number;
	step: number;
	unit: string;
}

const DEBOUNCE_MS = 350; // ダイヤルを素早く回した際にAPI呼び出しをまとめる
const STALE_THRESHOLD_MS = 3000; // 直近の同期からこれ以上経過していたら、ダイヤル操作前に実機の値を取り直す
const QUIET_PERIOD_MS = 4000; // ダイヤル操作直後、この期間は自動反映(実機の再取得)を止める
const DEFAULT_POLL_INTERVAL_SEC = 20; // 外部操作(スマホ等)との同期のための定期取得間隔(既定値)
const MIN_POLL_INTERVAL_SEC = 5; // API負荷を考慮した下限値
const SCENE_SYNC_DELAY_MS = 1500; // シーン実行後、実機の状態が反映されるのを待ってから再取得するまでの時間

/** カラー対象: RGBを15刻みで動かして虹色に一周させる(R→G→B→G→R→Bの6段階)。255は15の倍数なので割り切れる */
const COLOR_STEP = 15;

function buildColorWheel(step: number): Array<[number, number, number]> {
	const points: Array<[number, number, number]> = [];
	let r = 255;
	let g = 0;
	let b = 0;
	points.push([r, g, b]);

	// R:255,G:0,B:0 から G を上げる → R:255,G:255,B:0
	while (g < 255) {
		g = Math.min(255, g + step);
		points.push([r, g, b]);
	}
	// R:255,G:255,B:0 から R を下げる → R:0,G:255,B:0
	while (r > 0) {
		r = Math.max(0, r - step);
		points.push([r, g, b]);
	}
	// R:0,G:255,B:0 から B を上げる → R:0,G:255,B:255
	while (b < 255) {
		b = Math.min(255, b + step);
		points.push([r, g, b]);
	}
	// R:0,G:255,B:255 から G を下げる → R:0,G:0,B:255
	while (g > 0) {
		g = Math.max(0, g - step);
		points.push([r, g, b]);
	}
	// R:0,G:0,B:255 から R を上げる → R:255,G:0,B:255
	while (r < 255) {
		r = Math.min(255, r + step);
		points.push([r, g, b]);
	}
	// R:255,G:0,B:255 から B を下げる → R:255,G:0,B:0(=開始点)
	while (b > 0) {
		b = Math.max(0, b - step);
		points.push([r, g, b]);
	}

	points.pop(); // 最後の点は開始点(R:255,G:0,B:0)と重複するため取り除く
	return points;
}

const COLOR_WHEEL: Array<[number, number, number]> = buildColorWheel(COLOR_STEP);

function rgbToHex([r, g, b]: [number, number, number]): string {
	const toHex = (n: number) => n.toString(16).padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * 色温度(ケルビン)から近似RGBを求める(Tanner Hellandのアルゴリズムを簡略化したもの)。
 * インジケーターの塗り色を、実際の色温度の見た目(暖色〜寒色の白)に近づけるために使う。
 * 学術的な厳密さより「それらしい色」であることを優先している。
 */
function kelvinToRgb(kelvin: number): [number, number, number] {
	const temp = kelvin / 100;
	const clamp = (n: number) => Math.round(Math.min(255, Math.max(0, n)));

	const r = temp <= 66 ? 255 : 329.698727446 * Math.pow(temp - 60, -0.1332047592);
	const g =
		temp <= 66
			? 99.4708025861 * Math.log(temp) - 161.1195681661
			: 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
	const b = temp >= 66 ? 255 : temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;

	return [clamp(r), clamp(g), clamp(b)];
}

/** 色を黒に不透明度60%で重ねた見た目(= 元の色の明度を40%まで落とした色)にする */
function dimForTrack([r, g, b]: [number, number, number]): [number, number, number] {
	const TRACK_OPACITY = 0.4; // 元の色を残す割合(=黒の不透明度60%を重ねた結果)
	return [Math.round(r * TRACK_OPACITY), Math.round(g * TRACK_OPACITY), Math.round(b * TRACK_OPACITY)];
}

/**
 * ダイヤルの対象(parameterTarget)と現在値から、実際の光の色をインジケーターに反映できる場合のみ
 * 色情報を返す。color: 選択中の色そのもの。colorTemperature: 色温度からの近似色。
 * brightness/customは実際の発光色が分からないため既定の配色(白地/グレー)のままにする(null)。
 */
function resolveIndicatorColors(target: string, displayValue: number): { bar_fill_c: string; bar_bg_c: string } | null {
	let rgb: [number, number, number] | null = null;
	if (target === "color") {
		rgb = COLOR_WHEEL[normalizeColorIndex(displayValue)];
	} else if (target === "colorTemperature") {
		rgb = kelvinToRgb(displayValue);
	}
	if (!rgb) return null;

	return { bar_fill_c: rgbToHex(rgb), bar_bg_c: rgbToHex(dimForTrack(rgb)) };
}

/**
 * 各パラメーターごとの範囲・刻み幅。PIでは編集できず、対象ごとに適した値を固定で使う
 * (SwitchBot APIの制約(明るさ1-100、色温度2700-6500等)に合わせているため)。
 */
const TARGET_CONFIG: Record<string, Range> = {
	brightness: { min: 1, max: 100, step: 5, unit: "%" },
	colorTemperature: { min: 2700, max: 6500, step: 100, unit: "K" },
	color: { min: 0, max: COLOR_WHEEL.length - 1, step: 1, unit: "" },
	custom: { min: 0, max: 100, step: 5, unit: "" }
};

/** controlDevice のレスポンスを確認し、失敗時は例外を投げるラッパー。成功時は状態キャッシュを無効化する */
async function sendCommandOrThrow(
	creds: SwitchBotCredentials,
	deviceId: string,
	command: string,
	parameter: string | number = "default",
	commandType = "command"
): Promise<void> {
	const res = await controlDevice(creds, deviceId, command, String(parameter), commandType);
	throwIfFailed(res, "SwitchBotコマンド");
	invalidateDeviceStatusCache(deviceId);
}

/** executeScene のレスポンスを確認し、失敗時は例外を投げるラッパー */
async function executeSceneOrThrow(creds: SwitchBotCredentials, sceneId: string): Promise<void> {
	const res = await executeScene(creds, sceneId);
	throwIfFailed(res, "SwitchBotシーン実行");
}

/** getDeviceStatus のレスポンスを確認し、失敗時は例外を投げるラッパー(共有キャッシュ経由) */
async function getStatusOrThrow(
	creds: SwitchBotCredentials,
	deviceId: string
): Promise<{ power: "on" | "off"; brightness?: number; colorTemperature?: number }> {
	const res = await getCachedDeviceStatus(creds, deviceId);
	throwIfFailed(res, "SwitchBot状態取得");
	return {
		power: res.body.body?.power === "on" ? "on" : "off",
		brightness: res.body.body?.brightness,
		colorTemperature: res.body.body?.colorTemperature
	};
}

function normalizeColorIndex(index: number): number {
	const n = COLOR_WHEEL.length;
	return ((index % n) + n) % n;
}

/** エラーがレート制限によるものかどうかで、タッチディスプレイに表示する文言を切り替える */
function errorFeedbackText(err: unknown): string {
	return err instanceof RateLimitError ? "レート制限" : "通信エラー";
}

@action({ UUID: "com.switchbot.controller.tapelight" })
export class TapeLightControlAction extends SingletonAction<TapeLightSettings> {
	// ダイヤル操作中の未確定の値(実際にAPIへ送るまでのバッファ、表示スケール)
	private pendingValue = new Map<string, number>();
	// 直近に実機の値を確認(取得 or 送信)した時刻。古すぎる場合はダイヤル操作前に取り直す
	private lastSyncedAt = new Map<string, number>();
	// 直近にダイヤルを操作(回転/押し込み)した時刻。この直後は自動反映(onDidReceiveSettings/
	// ポーリング)による実機再取得を止め、ダイヤル操作の値を優先する
	private lastInteractionAt = new Map<string, number>();
	private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private pollTimers = new Map<string, ReturnType<typeof setInterval>>();

	/** 直近のダイヤル操作からまだ日が浅く、自動反映(実機の再取得)を控えるべき期間かどうか */
	private isQuiet(id: string): boolean {
		return Date.now() - (this.lastInteractionAt.get(id) ?? 0) < QUIET_PERIOD_MS;
	}

	/** プラグイン共通のグローバル設定からSwitchBotの認証情報を取得する */
	private async getCreds(): Promise<SwitchBotCredentials | null> {
		const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		if (!global?.token || !global?.secret) return null;
		return { token: global.token, secret: global.secret };
	}

	// ------------------------------------------------------------------
	// 表示時: 不足設定を補完(旧バージョンからの移行含む)し、デバイスの実際の状態を
	// 取得してタッチスクリーンに反映、以後は定期的に自動同期(ポーリング)する
	// ------------------------------------------------------------------
	override async onWillAppear(ev: WillAppearEvent<TapeLightSettings>): Promise<void> {
		if (!ev.action.isDial()) return;

		const settings = (ev.payload.settings ?? {}) as TapeLightSettings;
		const changed = this.ensureDefaults(settings);
		if (changed) {
			await ev.action.setSettings(settings);
		}

		await this.refreshFromDevice(ev.action, settings, { silent: false });
		this.startPolling(ev.action, settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<TapeLightSettings>): void {
		this.stopPolling(ev.action.id);
		this.pendingValue.delete(ev.action.id);
		this.lastSyncedAt.delete(ev.action.id);
		this.lastInteractionAt.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TapeLightSettings>): Promise<void> {
		if (!ev.action.isDial()) return;

		if (this.isQuiet(ev.action.id)) {
			// 直近のダイヤル操作(このアクション自身のsetSettings呼び出しによる発火を含む)による
			// ものとみなし、実機の再取得は行わない(ダイヤルで入力された値を優先する)。
			// ポーリング間隔が変更された可能性はあるためタイマーの張り直しのみ行う。
			this.startPolling(ev.action, ev.payload.settings);
			return;
		}

		// PIでデバイスID等が入力された直後に一度だけ状態を取り直す
		await this.refreshFromDevice(ev.action, ev.payload.settings, { silent: false });
		// ポーリング間隔が変更された可能性があるので張り直す
		this.startPolling(ev.action, ev.payload.settings);
	}

	/** プロパティインスペクターからのデバイス一覧・シーン一覧取得リクエストを処理する */
	override async onSendToPlugin(ev: any): Promise<void> {
		await handleGetListRequest(ev, "Tapelight");
	}

	/** 設定に不足しているフィールドをデフォルト値(または旧バージョンからの移行値)で補完する */
	private ensureDefaults(settings: TapeLightSettings): boolean {
		let changed = false;
		if (settings.parameterTarget === undefined) {
			settings.parameterTarget = "";
			changed = true;
		}
		if (settings.value === undefined) {
			// 旧バージョン(明るさ専用)の設定からの移行
			settings.value = settings.brightness ?? 50;
			changed = true;
		}
		if (settings.customCommand === undefined) {
			settings.customCommand = "";
			changed = true;
		}
		if (settings.commandType === undefined) {
			settings.commandType = "command";
			changed = true;
		}
		return changed;
	}

	private resolveRange(settings: TapeLightSettings): Range {
		const target = settings.parameterTarget || "brightness";
		return TARGET_CONFIG[target] ?? TARGET_CONFIG.brightness;
	}

	private resolveCommand(settings: TapeLightSettings): { command: string; commandType: string } {
		const target = settings.parameterTarget || "brightness";
		if (target === "colorTemperature") return { command: "setColorTemperature", commandType: "command" };
		if (target === "color") return { command: "setColor", commandType: "command" };
		if (target === "custom") return { command: settings.customCommand || "", commandType: settings.commandType || "command" };
		return { command: "setBrightness", commandType: "command" };
	}

	/** 表示値 → SwitchBot APIへ送るパラメーター文字列を組み立てる */
	private buildParameter(settings: TapeLightSettings, displayValue: number): string {
		const target = settings.parameterTarget || "brightness";
		if (target === "color") {
			const idx = normalizeColorIndex(displayValue);
			const [r, g, b] = COLOR_WHEEL[idx];
			return `${r}:${g}:${b}`;
		}
		if (target === "brightness") {
			return String(Math.max(1, displayValue));
		}
		return String(displayValue);
	}

	/** タッチディスプレイに表示するテキスト(カラーの場合は色名、それ以外は数値+単位) */
	private formatDisplayValue(settings: TapeLightSettings, displayValue: number): string {
		const target = settings.parameterTarget || "brightness";
		if (target === "color") {
			return rgbToHex(COLOR_WHEEL[normalizeColorIndex(displayValue)]);
		}
		if (target === "brightness" && displayValue <= 0) {
			return "0%"; // 実機には送信していない、表示専用の0%
		}
		const range = this.resolveRange(settings);
		return `${displayValue}${range.unit}`;
	}

	/** 表示値 → インジケーターバー用の0-100パーセンテージ(レンジに応じて正規化) */
	private toIndicatorPercent(value: number, range: Range): number {
		if (range.max <= range.min) return 0;
		const pct = ((value - range.min) / (range.max - range.min)) * 100;
		return Math.min(100, Math.max(0, Math.round(pct)));
	}

	/**
	 * setFeedback の indicator に渡すペイロードを組み立てる(パーセンテージ + 可能なら実際の色)。
	 * displayPercentOverride を指定すると、パーセンテージ表示だけを上書きする(電源オフ時に0%表示にする等、
	 * 色そのものは元の値から求めたい場合に使う)。
	 */
	private indicatorPayload(settings: TapeLightSettings, displayValue: number, displayPercentOverride?: number): Record<string, unknown> {
		const target = settings.parameterTarget || "brightness";
		const range = this.resolveRange(settings);
		const payload: Record<string, unknown> = {
			value: displayPercentOverride ?? this.toIndicatorPercent(displayValue, range)
		};
		const colors = resolveIndicatorColors(target, displayValue);
		if (colors) Object.assign(payload, colors);
		return payload;
	}

	// ------------------------------------------------------------------
	// ダイヤルを1回すと対象ごとの刻み幅(明るさ/色温度/カスタムは数値、
	// カラーは8色のうち隣の色)だけ値が変化する。
	//    ※ 回転速度によるticksの加速を無視し、方向だけを見て固定量ずつ変更する
	//    ※ 明るさのみ特例: 1%の状態から反時計回りに回すと、表示だけ0%になり
	//      実機へは何も送信しない(SwitchBot APIがsetBrightness=0を受け付けないため)。
	// ------------------------------------------------------------------
	override async onDialRotate(ev: DialRotateEvent<TapeLightSettings>): Promise<void> {
		const settings = ev.payload.settings;

		// 操作した時刻を記録し、この直後は自動反映(onDidReceiveSettings/ポーリング)による
		// 実機再取得を抑制する(ダイヤルで入力された値を優先するため)
		this.lastInteractionAt.set(ev.action.id, Date.now());

		const creds = await this.getCreds();
		if (!creds || !settings.deviceId) {
			await ev.action.showAlert();
			return;
		}

		const direction = Math.sign(ev.payload.ticks);
		if (direction === 0) return;

		if (!settings.parameterTarget) {
			await ev.action.showAlert();
			await ev.action.setFeedback({ value: "パラメーター未設定", indicator: { value: 0 } });
			return;
		}

		const target = settings.parameterTarget || "brightness";
		const range = this.resolveRange(settings);

		// 直近の同期が古い場合、ダイヤル操作前に実機の値を取り直して基準にする。
		// (例: 自動同期の間隔中にスマホアプリ等で値が変更されると、キャッシュされた
		//  表示値との間にズレが生じ、そのまま加算すると実機の値を巻き戻してしまうため)
		const lastSynced = this.lastSyncedAt.get(ev.action.id) ?? 0;
		if (target !== "color" && Date.now() - lastSynced > STALE_THRESHOLD_MS) {
			try {
				const status = await getStatusOrThrow(creds, settings.deviceId);
				const raw = target === "colorTemperature" ? status.colorTemperature : target === "brightness" ? status.brightness : undefined;
				if (typeof raw === "number") {
					const snapped = Math.min(range.max, Math.max(range.min, Math.round(raw / range.step) * range.step));
					settings.value = snapped;
					this.pendingValue.set(ev.action.id, snapped);
				}
				this.lastSyncedAt.set(ev.action.id, Date.now());
			} catch (err) {
				// 取得に失敗した場合は、それまでのキャッシュ値で操作を継続する(ここではエラー扱いにしない)
				streamDeck.logger.error(`パラメーター再取得(ダイヤル操作前)に失敗しました: ${String(err)}`);
			}
		}

		const current = this.pendingValue.get(ev.action.id) ?? settings.value ?? range.min;

		let next: number;
		if (target === "color") {
			next = normalizeColorIndex(current + direction);
		} else {
			next = current + range.step * direction;
			// 明るさのみ、1%未満に回したら表示だけ0%にして実機へは送らない
			if (target === "brightness" && next < range.min) {
				this.pendingValue.set(ev.action.id, 0);
				settings.value = 0;
				await ev.action.setSettings(settings);
				await ev.action.setFeedback({ value: "0%", indicator: { value: 0 } });
				return;
			}
			next = Math.min(range.max, Math.max(range.min, Math.round(next)));
		}
		this.pendingValue.set(ev.action.id, next);

		// 体感速度優先で画面表示とキャッシュは即時更新
		settings.value = next;
		settings.lastValue = next;
		settings.power = "on";
		await ev.action.setSettings(settings);
		await ev.action.setFeedback({
			value: this.formatDisplayValue(settings, next),
			indicator: this.indicatorPayload(settings, next)
		});

		const { command, commandType } = this.resolveCommand(settings);
		if (!command) return;

		// 実際のAPI呼び出しはデバウンスしてまとめて送る
		this.debounce(ev.action.id, async () => {
			try {
				await withRetry(() => sendCommandOrThrow(creds, settings.deviceId!, command, this.buildParameter(settings, next), commandType));
				this.lastSyncedAt.set(ev.action.id, Date.now());
			} catch (err) {
				streamDeck.logger.error(`パラメーター送信に失敗しました: ${String(err)}`);
				await ev.action.showAlert();
				await ev.action.setFeedback({ value: errorFeedbackText(err), indicator: { value: 0 } });
			}
		});
	}

	// ------------------------------------------------------------------
	// ダイヤル押し込みで電源オン/オフを切り替え
	// 1. 消灯直前の値(実際に送信していた値。表示専用の0%は含まない)を記憶し、
	//    次にオンにした時に明示的に復元する
	// ------------------------------------------------------------------
	override async onDialDown(ev: DialDownEvent<TapeLightSettings>): Promise<void> {
		const settings = ev.payload.settings;

		// 押し込みも「操作」として記録し、直後の自動反映を抑制する
		this.lastInteractionAt.set(ev.action.id, Date.now());

		const creds = await this.getCreds();
		if (!creds || !settings.deviceId) {
			await ev.action.showAlert();
			return;
		}
		if (!settings.parameterTarget) {
			await ev.action.showAlert();
			await ev.action.setFeedback({ value: "パラメーター未設定", indicator: { value: 0 } });
			return;
		}

		const range = this.resolveRange(settings);
		const { command, commandType } = this.resolveCommand(settings);
		const nextPower: "on" | "off" = settings.power === "on" ? "off" : "on";

		try {
			if (nextPower === "off") {
				// 消灯直前の値(lastValue)はそのまま保持しておく
				await withRetry(() => sendCommandOrThrow(creds, settings.deviceId!, "turnOff"));
				settings.power = "off";
			} else {
				// 記憶していた最後の値へ明示的に復元する(表示専用の0%は復元対象にしない)
				const restoreValue = settings.lastValue ?? range.min;
				await withRetry(() => sendCommandOrThrow(creds, settings.deviceId!, "turnOn"));
				if (command) {
					await withRetry(() =>
						sendCommandOrThrow(creds, settings.deviceId!, command, this.buildParameter(settings, restoreValue), commandType)
					);
				}
				settings.power = "on";
				settings.value = restoreValue;
				settings.lastValue = restoreValue;
				this.pendingValue.set(ev.action.id, restoreValue);
			}

			await ev.action.setSettings(settings);
			this.lastSyncedAt.set(ev.action.id, Date.now());
			const shown = settings.value ?? range.min;
			await ev.action.setFeedback({
				value: settings.power === "on" ? this.formatDisplayValue(settings, shown) : "OFF",
				indicator: this.indicatorPayload(settings, shown, settings.power === "on" ? undefined : 0)
			});
		} catch (err) {
			streamDeck.logger.error(`電源切替に失敗しました: ${String(err)}`);
			await ev.action.showAlert();
			await ev.action.setFeedback({ value: errorFeedbackText(err), indicator: { value: 0 } });
		}
	}

	// ------------------------------------------------------------------
	// タッチスクリーン操作
	//  - 短いタップ: 登録済みシーン(最大3つ)を順番に切り替え
	//  - 長押し(hold): 実機の状態を即座に再取得して同期
	// ------------------------------------------------------------------
	override async onTouchTap(ev: TouchTapEvent<TapeLightSettings>): Promise<void> {
		if (ev.payload.hold) {
			await this.refreshFromDevice(ev.action, ev.payload.settings, { silent: false });
		} else {
			await this.applyNextScene(ev.action, ev.payload.settings);
		}
	}

	// ------------------------------------------------------------------
	// シーン切替: settings.scene1Id〜scene3Id(空欄はスキップ)を順番に実行する。
	// シーンの中身は設定対象パラメーターに限らずSwitchBotアプリ側の設定次第なので、
	// 実行後に少し待ってから実機の状態を取得し直して表示を正しく同期する。
	// ------------------------------------------------------------------
	private async applyNextScene(dial: DialAction<TapeLightSettings>, settings: TapeLightSettings): Promise<void> {
		const creds = await this.getCreds();
		if (!creds) {
			await dial.showAlert();
			return;
		}

		const ids = [settings.scene1Id, settings.scene2Id, settings.scene3Id].filter((id): id is string =>
			Boolean(id && id.trim())
		);

		if (ids.length === 0) {
			await dial.showAlert();
			await dial.setFeedback({ value: "シーン未設定", indicator: { value: 0 } });
			return;
		}

		const nextIndex = ((settings.sceneIndex ?? -1) + 1) % ids.length;
		const sceneId = ids[nextIndex];

		try {
			await withRetry(() => executeSceneOrThrow(creds, sceneId));

			settings.sceneIndex = nextIndex;
			await dial.setSettings(settings);
			// シーン実行直後は実際の値/電源状態が確定していないため、
			// 反映を少し待ってから実機の状態を取り直して表示する。
			await dial.setFeedback({ value: "シーン実行中", indicator: { value: 50 } });
			setTimeout(async () => {
				try {
					const latest = await dial.getSettings();
					await this.refreshFromDevice(dial, latest, { silent: true });
				} catch (err) {
					streamDeck.logger.error(`post-scene refresh failed: ${String(err)}`);
				}
			}, SCENE_SYNC_DELAY_MS);
		} catch (err) {
			streamDeck.logger.error(`apply scene failed: ${String(err)}`);
			await dial.showAlert();
			await dial.setFeedback({ value: errorFeedbackText(err), indicator: { value: 0 } });
		}
	}

	// ------------------------------------------------------------------
	// 定期ポーリングの開始/停止(外部操作との自動同期)
	// ポーリング間隔はPIの pollIntervalSec 設定で変更可能(下限5秒)
	// ------------------------------------------------------------------
	private startPolling(dial: DialAction<TapeLightSettings>, settings: TapeLightSettings): void {
		this.stopPolling(dial.id);
		const intervalMs = this.resolvePollIntervalMs(settings);
		const timer = setInterval(async () => {
			// 直近にダイヤルを操作していた場合、そのタイミングでの自動反映は見送る
			if (this.isQuiet(dial.id)) return;
			try {
				const latest = await dial.getSettings();
				// 背景ポーリングでの一時的な失敗は画面をチラつかせないよう silent 扱い
				await this.refreshFromDevice(dial, latest, { silent: true });
			} catch (err) {
				streamDeck.logger.error(`poll failed: ${String(err)}`);
			}
		}, intervalMs);
		this.pollTimers.set(dial.id, timer);
	}

	private stopPolling(id: string): void {
		const existing = this.pollTimers.get(id);
		if (existing) {
			clearInterval(existing);
			this.pollTimers.delete(id);
		}
	}

	private resolvePollIntervalMs(settings: TapeLightSettings): number {
		const sec = settings.pollIntervalSec && settings.pollIntervalSec > 0 ? settings.pollIntervalSec : DEFAULT_POLL_INTERVAL_SEC;
		return Math.max(MIN_POLL_INTERVAL_SEC, sec) * 1000;
	}

	// ------------------------------------------------------------------
	// タッチスクリーンへの反映処理(実機の状態取得込み)
	// 通信エラー時はアイコンにも警告(showAlert)を表示する
	//    (背景ポーリング中の失敗は silent=true でアイコン点滅を抑える)
	//    カラー対象は実機から同期する手段が無いため、電源状態のみ取得する。
	// ------------------------------------------------------------------
	private async refreshFromDevice(
		dial: DialAction<TapeLightSettings>,
		settings: TapeLightSettings,
		options: { silent: boolean }
	): Promise<void> {
		// タッチディスプレイ上部のタイトルに、選択中のデバイス名を反映する
		await dial.setTitle(settings.deviceName || "");

		const creds = await this.getCreds();
		if (!creds || !settings.deviceId) {
			await dial.setFeedback({ value: "設定未入力", indicator: { value: 0 } });
			return;
		}
		if (!settings.parameterTarget) {
			await dial.setFeedback({ value: "パラメーター未設定", indicator: { value: 0 } });
			return;
		}

		const target = settings.parameterTarget || "brightness";
		const range = this.resolveRange(settings);

		try {
			const status = await getStatusOrThrow(creds, settings.deviceId);
			settings.power = status.power;

			const raw = target === "colorTemperature" ? status.colorTemperature : target === "brightness" ? status.brightness : undefined;
			if (typeof raw === "number") {
				const snapped = Math.min(range.max, Math.max(range.min, Math.round(raw / range.step) * range.step));
				settings.value = snapped;
				if (status.power === "on") settings.lastValue = snapped;
				this.pendingValue.set(dial.id, snapped);
			}

			await dial.setSettings(settings);
			this.lastSyncedAt.set(dial.id, Date.now());
			const shown = settings.value ?? range.min;
			await dial.setFeedback({
				value: status.power === "on" ? this.formatDisplayValue(settings, shown) : "OFF",
				indicator: this.indicatorPayload(settings, shown, status.power === "on" ? undefined : 0)
			});
		} catch (err) {
			streamDeck.logger.error(`status fetch failed: ${String(err)}`);
			await dial.setFeedback({ value: errorFeedbackText(err), indicator: { value: 0 } });
			if (!options.silent) {
				await dial.showAlert();
			}
		}
	}

	private debounce(key: string, fn: () => void): void {
		const existing = this.debounceTimers.get(key);
		if (existing) clearTimeout(existing);
		this.debounceTimers.set(key, setTimeout(fn, DEBOUNCE_MS));
	}
}
