import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";
import { getCachedDeviceStatus } from "../device-status-cache";
import { isRateLimitError } from "../switchbot-api";
import { handleGetListRequest } from "../pi-list-handler";
import type { GlobalSettings } from "../global-settings";

interface SensorActionSettings {
	[key: string]: any;
	deviceId: string;
	deviceName: string;
	pollIntervalSec: number;
	showTemperature: boolean;
	showHumidity: boolean;
	showBattery: boolean;
}

const DEFAULT_SETTINGS: SensorActionSettings = {
	deviceId: "",
	deviceName: "",
	pollIntervalSec: 60,
	showTemperature: true,
	showHumidity: true,
	showBattery: false
};

/** 自動更新の下限間隔(秒)。APIのレート制限を考慮 */
const MIN_POLL_INTERVAL_SEC = 10;

type ActionRef = KeyDownEvent<SensorActionSettings>["action"];

/**
 * 温湿度計(MeterPlus等)の値をキーのタイトルに定期表示する、読み取り専用に近いアクション。
 * キーを押すと即座に再取得する。デフォルトのキー画像は黒塗り(imgs/actions/sensor/key)にして
 * タイトル文字を読みやすくしている。
 */
@action({ UUID: "com.switchbot.controller.sensor" })
export class SensorAction extends SingletonAction<SensorActionSettings> {
	private pollTimers = new Map<string, ReturnType<typeof setInterval>>();

	override async onWillAppear(ev: WillAppearEvent<SensorActionSettings>): Promise<void> {
		if (!ev.action.isKey()) return;

		const settings = (ev.payload.settings ?? {}) as Partial<SensorActionSettings>;
		let changed = false;

		(Object.keys(DEFAULT_SETTINGS) as (keyof SensorActionSettings)[]).forEach((key) => {
			if (settings[key] === undefined) {
				(settings as Record<string, unknown>)[key] = DEFAULT_SETTINGS[key];
				changed = true;
			}
		});

		if (changed) {
			await ev.action.setSettings(settings as SensorActionSettings);
		}

		const finalSettings = settings as SensorActionSettings;
		await this.refresh(ev.action, finalSettings, true);
		this.startPolling(ev.action, finalSettings);
	}

	override onWillDisappear(ev: WillDisappearEvent<SensorActionSettings>): void {
		this.stopPolling(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SensorActionSettings>): Promise<void> {
		if (!ev.action.isKey()) return;
		await this.refresh(ev.action, ev.payload.settings, true);
		this.startPolling(ev.action, ev.payload.settings);
	}

	/** プロパティインスペクターからのデバイス一覧取得リクエストを処理する */
	override async onSendToPlugin(ev: any): Promise<void> {
		await handleGetListRequest(ev, "SensorAction");
	}

	override async onKeyDown(ev: KeyDownEvent<SensorActionSettings>): Promise<void> {
		await this.refresh(ev.action, ev.payload.settings, false);
	}

	private startPolling(action: ActionRef, settings: SensorActionSettings): void {
		this.stopPolling(action.id);
		const sec = settings.pollIntervalSec && settings.pollIntervalSec > 0 ? settings.pollIntervalSec : DEFAULT_SETTINGS.pollIntervalSec;
		const intervalMs = Math.max(MIN_POLL_INTERVAL_SEC, sec) * 1000;
		const timer = setInterval(() => void this.refresh(action, settings, true), intervalMs);
		this.pollTimers.set(action.id, timer);
	}

	private stopPolling(id: string): void {
		const timer = this.pollTimers.get(id);
		if (timer) {
			clearInterval(timer);
			this.pollTimers.delete(id);
		}
	}

	/** silent=true は自動更新時(通信失敗時にアイコンを点滅させない)、false はキー押下による手動更新時 */
	private async refresh(action: ActionRef, settings: SensorActionSettings, silent: boolean): Promise<void> {
		if (!settings?.deviceId) {
			await action.setTitle("未設定");
			if (!silent) await action.showAlert();
			return;
		}

		const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		if (!global?.token || !global?.secret) {
			await action.setTitle("認証未設定");
			if (!silent) await action.showAlert();
			return;
		}

		try {
			const res = await getCachedDeviceStatus({ token: global.token, secret: global.secret }, settings.deviceId);
			if (!(res.statusCode === 200 && res.body?.statusCode === 100 && res.body.body)) {
				if (isRateLimitError(res)) {
					streamDeck.logger.warn(`SwitchBot: センサー状態の取得がAPIのレート制限により失敗しました: ${JSON.stringify(res.body)}`);
					await action.setTitle("レート制限");
				} else {
					streamDeck.logger.error(`SwitchBot: センサー状態の取得に失敗しました: ${JSON.stringify(res.body)}`);
					await action.setTitle("取得失敗");
				}
				if (!silent) await action.showAlert();
				return;
			}

			const body = res.body.body;
			const lines: string[] = [];
			if (settings.showTemperature && typeof body.temperature === "number") {
				lines.push(`${body.temperature.toFixed(1)}°C`);
			}
			if (settings.showHumidity && typeof body.humidity === "number") {
				lines.push(`${body.humidity}%`);
			}
			if (settings.showBattery && typeof body.battery === "number") {
				lines.push(`Batt${body.battery}%`);
			}

			await action.setTitle(lines.length > 0 ? lines.join("\n") : "データなし");
			if (!silent) await action.showOk();
		} catch (err) {
			streamDeck.logger.error(`SwitchBot: センサー取得中にエラーが発生しました: ${String(err)}`);
			await action.setTitle("通信エラー");
			if (!silent) await action.showAlert();
		}
	}
}
