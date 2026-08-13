import streamDeck from "@elgato/streamdeck";
import { controlDevice, executeScene, isRateLimitError, SwitchBotCredentials, SwitchBotResponse } from "./switchbot-api";
import { getCachedDeviceStatus, invalidateDeviceStatusCache } from "./device-status-cache";
import { getAcState, setAcState, patchAcState, clampAcTemp } from "./ac-state";
import type { OperationConfig } from "./operation-config";

/**
 * showOk / showAlert を持つアクション(KeyAction等)を最小限の型で受け取る。
 * DialAction(ダイヤル系)には showOk が存在しないため、こちらはオプショナルにしている。
 */
interface ActionFeedback {
	showOk?: () => Promise<void>;
	showAlert: () => Promise<void>;
}

/** action.showOk が存在する場合のみ呼び出す(DialActionには無いため) */
async function showSuccess(action: ActionFeedback): Promise<void> {
	if (typeof action.showOk === "function") {
		await action.showOk();
	}
}

/**
 * API呼び出し失敗時のログを出力する。レート制限による失敗は原因が分かりやすいよう
 * 個別のメッセージ・ログレベル(warn)で記録する(通常のエラーはerrorレベル)。
 */
function logFailure(label: string, res: SwitchBotResponse): void {
	if (isRateLimitError(res)) {
		streamDeck.logger.warn(
			`SwitchBot: ${label}はAPIのレート制限により失敗しました。しばらく時間をおいてから再度お試しください。(${JSON.stringify(res.body)})`
		);
	} else {
		streamDeck.logger.error(`SwitchBot: ${label}に失敗しました: ${JSON.stringify(res.body)}`);
	}
}

/**
 * 1つのオペレーション(デバイス操作 or シーン実行)を実行する。
 * トリプルアクション・シングルアクション・トグルアクションから共通で呼び出される。
 */
export async function runOperation(
	action: ActionFeedback,
	creds: SwitchBotCredentials,
	config: OperationConfig
): Promise<void> {
	if (config.targetType === "scene") {
		await runScene(action, creds, config);
	} else {
		await runDevice(action, creds, config);
	}
}

async function runScene(action: ActionFeedback, creds: SwitchBotCredentials, config: OperationConfig): Promise<void> {
	if (!config.sceneId) {
		streamDeck.logger.warn("SwitchBot: シーンが未選択です。");
		await action.showAlert();
		return;
	}

	const res = await executeScene(creds, config.sceneId);
	if (res.statusCode === 200 && res.body?.statusCode === 100) {
		await showSuccess(action);
	} else {
		logFailure("シーン実行", res);
		await action.showAlert();
	}
}

async function runDevice(action: ActionFeedback, creds: SwitchBotCredentials, config: OperationConfig): Promise<void> {
	if (!config.deviceId) {
		streamDeck.logger.warn("SwitchBot: デバイスが未選択です。");
		await action.showAlert();
		return;
	}

	// エアコン詳細設定: モード/温度/風量それぞれの入力値から setAll のパラメーターを組み立てる
	// (電源は常にオンで送信するため、ユーザーが選ぶ項目には含めない)
	if (config.command === "setAll") {
		const mode = config.acMode ?? 2;
		const unit = config.acUnit === "F" ? "F" : "C";
		const rawTemp = config.acTemp ?? (unit === "F" ? 78 : 26);
		// 表示単位が華氏の場合は、SwitchBot APIへ送る前に摂氏へ変換する
		const celsius = unit === "F" ? Math.round(((rawTemp - 32) * 5) / 9) : Math.round(rawTemp);
		const temp = clampAcTemp(celsius);
		const fan = config.acFanSpeed ?? 1;
		const parameter = `${temp},${mode},${fan},on`;

		const res = await controlDevice(creds, config.deviceId, "setAll", parameter, "command");
		if (res.statusCode === 200 && res.body?.statusCode === 100) {
			await setAcState(config.deviceId, { temp, mode, fan, power: "on" });
			await showSuccess(action);
		} else {
			logFailure("エアコン詳細設定の送信", res);
			await action.showAlert();
		}
		return;
	}

	// エアコン温度設定: 直近の共有状態(温度/モード/風量)を基準に、押すたびに±1℃する
	// (SwitchBot APIは赤外線リモコンの実際の状態を取得できないため、いずれかのキーが
	//  最後に送信した内容をグローバル設定で共有し、それを基準にしている)
	if (config.command === "acAdjustTemp") {
		const current = await getAcState(config.deviceId);
		const direction = config.acAdjustDirection === "down" ? -1 : 1;
		const nextTemp = clampAcTemp(current.temp + direction);
		const parameter = `${nextTemp},${current.mode},${current.fan},on`;

		const res = await controlDevice(creds, config.deviceId, "setAll", parameter, "command");
		if (res.statusCode === 200 && res.body?.statusCode === 100) {
			await setAcState(config.deviceId, { ...current, temp: nextTemp, power: "on" });
			await showSuccess(action);
		} else {
			logFailure("エアコン温度設定の送信", res);
			await action.showAlert();
		}
		return;
	}

	// 明るさを調整 / 色温度を調整: 実機の現在値を取得し、1段階分だけ変更して送信する
	// (これらは実機の状態を取得できる通常デバイス向けのため、エアコンのような
	//  共有状態への記憶は不要で、その都度APIから正確な現在値を取得できる)
	if (config.command === "adjustBrightness" || config.command === "adjustColorTemp") {
		const isBrightness = config.command === "adjustBrightness";
		const step = isBrightness ? 10 : 100;
		const min = isBrightness ? 1 : 2700;
		const max = isBrightness ? 100 : 6500;
		const apiCommand = isBrightness ? "setBrightness" : "setColorTemperature";
		const fallback = isBrightness ? 50 : 4000;

		const status = await getCachedDeviceStatus(creds, config.deviceId);
		const raw = isBrightness ? status.body?.body?.brightness : status.body?.body?.colorTemperature;
		const current = typeof raw === "number" ? raw : fallback;
		const direction = config.acAdjustDirection === "down" ? -1 : 1;
		const next = Math.min(max, Math.max(min, Math.round(current + step * direction)));

		const res = await controlDevice(creds, config.deviceId, apiCommand, String(next), "command");
		if (res.statusCode === 200 && res.body?.statusCode === 100) {
			invalidateDeviceStatusCache(config.deviceId);
			await showSuccess(action);
		} else {
			logFailure(`${config.command}の送信`, res);
			await action.showAlert();
		}
		return;
	}

	let command = config.command === "custom" ? config.customCommand : config.command;
	let parameter = config.parameter || "default";
	const commandType = config.command === "custom" ? config.commandType : "command";

	if (config.command === "toggle") {
		// 現在の電源状態を取得して反転させる（power フィールドに対応した機種のみ）
		const status = await getCachedDeviceStatus(creds, config.deviceId);
		const power = status.body?.body?.power;
		command = power === "on" ? "turnOff" : "turnOn";
		parameter = "default";
	}

	if (!command) {
		streamDeck.logger.warn("SwitchBot: コマンドが未設定です。");
		await action.showAlert();
		return;
	}

	const res = await controlDevice(creds, config.deviceId, command, parameter, commandType);
	if (res.statusCode === 200 && res.body?.statusCode === 100) {
		// エアコン(赤外線)向けのオン/オフ操作は、専用コマンドではなくても共有状態の電源だけ更新しておく
		// (エアコンコントロールの表示や、他のキーの「エアコン温度設定」との連動のため)
		if (config.deviceType === "Air Conditioner" && (command === "turnOn" || command === "turnOff")) {
			await patchAcState(config.deviceId, { power: command === "turnOn" ? "on" : "off" });
		}
		await showSuccess(action);
	} else {
		logFailure("デバイス制御", res);
		await action.showAlert();
	}
}
