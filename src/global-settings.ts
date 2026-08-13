/**
 * プラグイン全体(全アクション)で共有するSwitchBot API認証情報。
 * Stream DeckのGlobal Settingsに保存され、キーごとに入力し直す必要がない。
 *
 * deviceListCache / sceneListCache / listError は、PIからのデバイス/シーン一覧
 * 取得リクエストの結果を受け渡すためのキャッシュ。
 * (Action.sendToPropertyInspector / streamDeck.ui.current.sendToPropertyInspector が
 * 環境によっては機能しないことが確認されたため、代わりにグローバル設定の変更を
 * didReceiveGlobalSettings で検知させる、より確実な方式に変更している)
 *
 * [key: string]: any によるインデックスシグネチャは、@elgato/streamdeckのSDKが
 * 設定の型にJsonObject互換(文字列キーでアクセス可能)であることを要求するために付与している。
 * SDKバージョンによってJsonObject型が直接importできない場合があるため、
 * importに依存しない形でこの要件を満たしている。
 */
export interface GlobalSettings {
	[key: string]: any;
	token?: string;
	secret?: string;
	deviceListCache?: { updatedAt: number; devices: any[] };
	sceneListCache?: { updatedAt: number; scenes: any[] };
	listError?: { updatedAt: number; message: string };
	/**
	 * デバイスID(エアコン)ごとに最後に送信したエアコンの状態(温度/モード/風量)を記憶する。
	 * SwitchBot APIは赤外線リモコンの実際の状態を取得できないため、「エアコン温度設定」
	 * (押すたびに±1℃)コマンドが基準にする温度は、いずれかのキーから最後に送信した値を
	 * このグローバル設定経由で共有する(複数のキーで同じエアコンを操作しても大きくずれないようにするため)。
	 */
	acStateByDevice?: Record<string, { temp: number; mode: number; fan: number; power: "on" | "off" }>;
}
