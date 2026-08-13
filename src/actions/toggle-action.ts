import streamDeck, { action, KeyUpEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { DEFAULT_OPERATION, OperationConfig } from "../operation-config";
import { runOperation } from "../operation-runner";
import { handleGetListRequest } from "../pi-list-handler";
import type { GlobalSettings } from "../global-settings";

interface ToggleActionSettings {
	[key: string]: any;
	operationA: OperationConfig;
	operationB: OperationConfig;
}

/**
 * このアクションはマニフェストで2つのState(①/②)を定義しており、Stream Deck本体が
 * キー押下のたびに自動でStateを切り替える(ev.payload.stateに反映される)。
 * ①②それぞれの見た目(アイコン)は、Stream Deck本体でキーの画像をクリックすると
 * 表示される純正の画像選択UIから、State単位で個別に設定できる。
 * そのためプラグイン側では状態や画像の保存・復元を自前で行う必要がない。
 */
@action({ UUID: "com.switchbot.controller.toggle" })
export class ToggleAction extends SingletonAction<ToggleActionSettings> {
	/** 表示時に不足している設定項目をデフォルト値で補完する */
	override async onWillAppear(ev: WillAppearEvent<ToggleActionSettings>): Promise<void> {
		const settings = (ev.payload.settings ?? {}) as Partial<ToggleActionSettings>;
		let changed = false;

		if (!settings.operationA) {
			settings.operationA = { ...DEFAULT_OPERATION };
			changed = true;
		}
		if (!settings.operationB) {
			settings.operationB = { ...DEFAULT_OPERATION };
			changed = true;
		}

		if (changed) {
			await ev.action.setSettings(settings as ToggleActionSettings);
		}
	}

	/** プロパティインスペクターからのデバイス一覧・シーン一覧取得リクエストを処理する */
	override async onSendToPlugin(ev: any): Promise<void> {
		await handleGetListRequest(ev, "ToggleAction");
	}

	override async onKeyUp(ev: KeyUpEvent<ToggleActionSettings>): Promise<void> {
		const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		if (!global?.token || !global?.secret) {
			streamDeck.logger.error("SwitchBot: トークン / クライアントシークレットが設定されていません。");
			await ev.action.showAlert();
			return;
		}

		const settings = ev.payload.settings ?? ({} as Partial<ToggleActionSettings>);
		// Stream Deck本体が押下時に自動でStateを切り替えてくれるため、
		// その結果(0=①, 1=②)をそのまま使って対応する操作を実行する。
		const state = ev.payload.state ?? 0;
		const operation = (state === 0 ? settings.operationA : settings.operationB) ?? DEFAULT_OPERATION;

		try {
			await runOperation(ev.action, { token: global.token, secret: global.secret }, operation);
		} catch (err) {
			streamDeck.logger.error(`SwitchBot: トグルアクションの処理中にエラーが発生しました: ${String(err)}`);
			await ev.action.showAlert();
		}
	}
}
