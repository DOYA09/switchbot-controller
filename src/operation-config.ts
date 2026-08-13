export type TargetType = "device" | "scene";

/**
 * デバイス操作/シーン実行1件分の設定。トリプルアクション・シングルアクション・
 * トグルアクション・パラメーターダイヤルなど全アクションで共通利用する
 * (トリプルアクションのみ、これに加えて「有効/無効」フラグを別途持つ)。
 *
 * [key: string]: any は、@elgato/streamdeckのSDKが要求するJsonObject互換の
 * インデックスシグネチャを、SDKからのJsonObject importに依存せず満たすためのもの。
 */
export interface OperationConfig {
	[key: string]: any;
	targetType: TargetType;
	deviceId: string;
	deviceName: string;
	/** 選択したデバイスの種別(SwitchBot APIのdeviceType/remoteType)。コマンド選択肢の絞り込みに使用 */
	deviceType: string;
	sceneId: string;
	sceneName: string;
	command: string;
	customCommand: string;
	commandType: "command" | "customize";
	parameter: string;
	/** エアコン詳細設定(command==="setAll")用: モード(2=冷房/5=暖房/3=除湿/4=送風) */
	acMode: number;
	/** エアコン詳細設定用: 設定温度の表示単位("C"=摂氏/"F"=華氏)。摂氏に変換してAPIへ送信する */
	acUnit: "C" | "F";
	/** エアコン詳細設定用: 設定温度(表示単位のまま保持。既定26℃、華氏選択時の既定は78℉) */
	acTemp: number;
	/** エアコン詳細設定用: 風量(1=自動/2=弱/3=中/4=強) */
	acFanSpeed: number;
	/** エアコン温度設定(command==="acAdjustTemp")用: 押すたびに上げる/下げる */
	acAdjustDirection: "up" | "down";
}

export const DEFAULT_OPERATION: OperationConfig = {
	targetType: "device",
	deviceId: "",
	deviceName: "",
	deviceType: "",
	sceneId: "",
	sceneName: "",
	command: "",
	customCommand: "",
	commandType: "command",
	parameter: "default",
	acMode: 2,
	acUnit: "C",
	acTemp: 26,
	acFanSpeed: 1,
	acAdjustDirection: "up"
};
