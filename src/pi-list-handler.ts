import streamDeck from "@elgato/streamdeck";
import { listDevices, listScenes } from "./switchbot-api";
import type { GlobalSettings } from "./global-settings";

/**
 * プラグインからPropertyInspectorへメッセージを送信する試み(フォールバック用途)。
 * 環境によっては Action.sendToPropertyInspector / streamDeck.ui.current が
 * 機能しないことが確認されているため、主経路としては使わず、
 * handleGetListRequest はグローバル設定へのキャッシュ書き込みを主に用いる。
 */
export function sendToPropertyInspector(ev: any, payload: unknown): void {
	try {
		const action = ev?.action;
		if (action && typeof action.sendToPropertyInspector === "function") {
			void action.sendToPropertyInspector(payload);
			return;
		}
	} catch {
		// 次の方法を試す
	}

	try {
		const ui = (streamDeck as any).ui;
		const current = ui?.current;
		if (current && typeof current.sendToPropertyInspector === "function") {
			void current.sendToPropertyInspector(payload);
			return;
		}
	} catch {
		// 諦める
	}
}

/**
 * PIから送られてくる { event: "getDevices" | "getScenes" } リクエストを処理する。
 *
 * 結果は Action.sendToPropertyInspector / streamDeck.ui.current 経由では届かない
 * 環境があることが確認されたため、代わりにグローバル設定(deviceListCache /
 * sceneListCache / listError)へ書き込む方式にしている。PI側は
 * didReceiveGlobalSettings イベントでこれらの変化を検知して一覧を更新する。
 * (トークン/シークレットの共有と同じ仕組みのため、動作実績がある)
 */
export async function handleGetListRequest(ev: any, sourceLabel: string): Promise<void> {
	const payload = ev?.payload as { event?: string } | undefined;
	streamDeck.logger.debug(`${sourceLabel}: onSendToPlugin received: ${JSON.stringify(payload)}`);
	if (!payload || (payload.event !== "getDevices" && payload.event !== "getScenes")) return;

	const global = (await streamDeck.settings.getGlobalSettings<GlobalSettings>()) ?? {};
	streamDeck.logger.debug(`${sourceLabel}: global settings present -> token:${!!global?.token} secret:${!!global?.secret}`);
	if (!global?.token || !global?.secret) {
		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
			...global,
			listError: { updatedAt: Date.now(), message: "credentials-missing" }
		});
		return;
	}
	const creds = { token: global.token, secret: global.secret };

	try {
		if (payload.event === "getDevices") {
			const res = await listDevices(creds);
			streamDeck.logger.debug(`${sourceLabel}: getDevices response: ${JSON.stringify(res)}`);
			if (res.statusCode === 200 && res.body?.statusCode === 100) {
				await streamDeck.settings.setGlobalSettings<GlobalSettings>({
					...global,
					deviceListCache: { updatedAt: Date.now(), devices: res.body.body ?? [] }
				});
			} else {
				streamDeck.logger.error(`${sourceLabel}: デバイス一覧取得に失敗しました: ${JSON.stringify(res.body)}`);
				await streamDeck.settings.setGlobalSettings<GlobalSettings>({
					...global,
					listError: { updatedAt: Date.now(), message: "fetch-devices-failed" }
				});
			}
		} else {
			const res = await listScenes(creds);
			streamDeck.logger.debug(`${sourceLabel}: getScenes response: ${JSON.stringify(res)}`);
			if (res.statusCode === 200 && res.body?.statusCode === 100) {
				await streamDeck.settings.setGlobalSettings<GlobalSettings>({
					...global,
					sceneListCache: { updatedAt: Date.now(), scenes: res.body.body ?? [] }
				});
			} else {
				streamDeck.logger.error(`${sourceLabel}: シーン一覧取得に失敗しました: ${JSON.stringify(res.body)}`);
				await streamDeck.settings.setGlobalSettings<GlobalSettings>({
					...global,
					listError: { updatedAt: Date.now(), message: "fetch-scenes-failed" }
				});
			}
		}
	} catch (err) {
		streamDeck.logger.error(`${sourceLabel}: PIリクエスト処理中にエラー: ${String(err)}`);
		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
			...global,
			listError: { updatedAt: Date.now(), message: "unexpected-error" }
		});
	}
}
