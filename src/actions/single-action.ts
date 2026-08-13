import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { DEFAULT_OPERATION, OperationConfig } from "../operation-config";
import { runOperation } from "../operation-runner";
import { handleGetListRequest } from "../pi-list-handler";
import type { GlobalSettings } from "../global-settings";

interface SingleActionSettings {
	[key: string]: any;
	operation: OperationConfig;
}

@action({ UUID: "com.switchbot.controller.single" })
export class SingleAction extends SingletonAction<SingleActionSettings> {
	/** 表示時に不足している設定項目をデフォルト値で補完する */
	override async onWillAppear(ev: WillAppearEvent<SingleActionSettings>): Promise<void> {
		const settings = (ev.payload.settings ?? {}) as Partial<SingleActionSettings>;
		if (!settings.operation) {
			settings.operation = { ...DEFAULT_OPERATION };
			await ev.action.setSettings(settings as SingleActionSettings);
		}
	}

	/** プロパティインスペクターからのデバイス一覧・シーン一覧取得リクエストを処理する */
	override async onSendToPlugin(ev: any): Promise<void> {
		await handleGetListRequest(ev, "SingleAction");
	}

	override async onKeyDown(ev: KeyDownEvent<SingleActionSettings>): Promise<void> {
		const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		if (!global?.token || !global?.secret) {
			streamDeck.logger.error("SwitchBot: トークン / クライアントシークレットが設定されていません。");
			await ev.action.showAlert();
			return;
		}

		const operation = ev.payload.settings?.operation ?? DEFAULT_OPERATION;
		try {
			await runOperation(ev.action, { token: global.token, secret: global.secret }, operation);
		} catch (err) {
			streamDeck.logger.error(`SwitchBot: シングルアクションの処理中にエラーが発生しました: ${String(err)}`);
			await ev.action.showAlert();
		}
	}
}
