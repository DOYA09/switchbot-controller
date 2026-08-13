import streamDeck, {
	action,
	KeyDownEvent,
	KeyUpEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";
import { DEFAULT_OPERATION, OperationConfig } from "../operation-config";
import { runOperation } from "../operation-runner";
import { handleGetListRequest } from "../pi-list-handler";
import type { GlobalSettings } from "../global-settings";

type PressKind = "single" | "double" | "hold";

interface TripleOperationConfig extends OperationConfig {
	enabled: boolean;
}

interface ControlSettings {
	[key: string]: any;
	single: TripleOperationConfig;
	double: TripleOperationConfig;
	hold: TripleOperationConfig;
}

const DEFAULT_TRIPLE_OPERATION: TripleOperationConfig = {
	...DEFAULT_OPERATION,
	enabled: false
};

/** これより長く押し続けたら「ホールド」と判定 */
const HOLD_THRESHOLD_MS = 500;
/** キーを離してからこの時間内に再度押したら「ダブルプレス」と判定 */
const DOUBLE_PRESS_WINDOW_MS = 300;

interface KeyRuntimeState {
	holdTimer?: ReturnType<typeof setTimeout>;
	pendingSingleTimer?: ReturnType<typeof setTimeout>;
	holdTriggered: boolean;
	lastKeyUpAt: number;
}

@action({ UUID: "com.switchbot.controller.control" })
export class SwitchBotControlAction extends SingletonAction<ControlSettings> {
	private runtimeStates = new Map<string, KeyRuntimeState>();

	private getRuntimeState(actionId: string): KeyRuntimeState {
		let state = this.runtimeStates.get(actionId);
		if (!state) {
			state = { holdTriggered: false, lastKeyUpAt: 0 };
			this.runtimeStates.set(actionId, state);
		}
		return state;
	}

	/** 表示時に不足している設定項目をデフォルト値で補完する */
	override async onWillAppear(ev: WillAppearEvent<ControlSettings>): Promise<void> {
		const settings = (ev.payload.settings ?? {}) as Partial<ControlSettings>;
		let changed = false;

		(["single", "double", "hold"] as const).forEach((key) => {
			if (!settings[key]) {
				settings[key] = { ...DEFAULT_TRIPLE_OPERATION };
				changed = true;
			}
		});

		if (changed) {
			await ev.action.setSettings(settings as ControlSettings);
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<ControlSettings>): void {
		const state = this.runtimeStates.get(ev.action.id);
		if (state) {
			clearTimeout(state.holdTimer);
			clearTimeout(state.pendingSingleTimer);
			this.runtimeStates.delete(ev.action.id);
		}
	}

	/** プロパティインスペクターからのデバイス一覧・シーン一覧取得リクエストを処理する */
	override async onSendToPlugin(ev: any): Promise<void> {
		await handleGetListRequest(ev, "SwitchBotControl(トリプル)");
	}

	override onKeyDown(ev: KeyDownEvent<ControlSettings>): void {
		const state = this.getRuntimeState(ev.action.id);
		state.holdTriggered = false;

		// 一定時間押し続けたらホールドとして即座に実行する
		state.holdTimer = setTimeout(() => {
			state.holdTriggered = true;
			void this.runPress(ev.action, ev.payload.settings, "hold");
		}, HOLD_THRESHOLD_MS);
	}

	override onKeyUp(ev: KeyUpEvent<ControlSettings>): void {
		const state = this.getRuntimeState(ev.action.id);

		if (state.holdTimer) {
			clearTimeout(state.holdTimer);
			state.holdTimer = undefined;
		}

		if (state.holdTriggered) {
			state.holdTriggered = false;
			return;
		}

		const now = Date.now();

		if (state.pendingSingleTimer && now - state.lastKeyUpAt <= DOUBLE_PRESS_WINDOW_MS) {
			clearTimeout(state.pendingSingleTimer);
			state.pendingSingleTimer = undefined;
			void this.runPress(ev.action, ev.payload.settings, "double");
			return;
		}

		state.lastKeyUpAt = now;
		state.pendingSingleTimer = setTimeout(() => {
			state.pendingSingleTimer = undefined;
			void this.runPress(ev.action, ev.payload.settings, "single");
		}, DOUBLE_PRESS_WINDOW_MS);
	}

	private async runPress(
		action: KeyDownEvent<ControlSettings>["action"],
		settings: ControlSettings | undefined,
		kind: PressKind
	): Promise<void> {
		try {
			const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
			if (!global?.token || !global?.secret) {
				streamDeck.logger.error("SwitchBot: トークン / クライアントシークレットが設定されていません。");
				await action.showAlert();
				return;
			}

			const config = settings?.[kind];
			if (!config || !config.enabled) {
				return;
			}

			await runOperation(action, { token: global.token, secret: global.secret }, config);
		} catch (err) {
			streamDeck.logger.error(`SwitchBot: ${kind}プレスの処理中にエラーが発生しました: ${String(err)}`);
			await action.showAlert();
		}
	}
}
