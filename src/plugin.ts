import fs from "node:fs";
import path from "node:path";
import streamDeck from "@elgato/streamdeck";
import { SwitchBotControlAction } from "./actions/switchbot-control";
import { TapeLightControlAction } from "./actions/tapelight-control";
import { SingleAction } from "./actions/single-action";
import { ToggleAction } from "./actions/toggle-action";
import { SensorAction } from "./actions/sensor-action";
import { SceneBrowserDialAction } from "./actions/scene-browser-dial";
import { ParamDialAction } from "./actions/param-dial";
import { AcControlAction } from "./actions/ac-control";

/**
 * streamDeck.logger が使える状態になる前のエラー（起動直後のクラッシュなど）を
 * 確実に捕捉するためのフォールバックログ。bin/crash.log に追記される。
 * 無制限に肥大化しないよう、上限サイズを超えたら古い内容を切り詰める。
 */
const CRASH_LOG_MAX_BYTES = 512 * 1024; // 512KB

function logCrash(label: string, err: unknown): void {
	try {
		const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
		const line = `[${new Date().toISOString()}] ${label}: ${detail}\n`;
		const logPath = path.join(__dirname, "crash.log");

		try {
			const stat = fs.statSync(logPath);
			if (stat.size > CRASH_LOG_MAX_BYTES) {
				// 上限を超えたら末尾の半分だけ残して切り詰める(直近の履歴は保持)
				const content = fs.readFileSync(logPath, "utf8");
				fs.writeFileSync(logPath, content.slice(-Math.floor(CRASH_LOG_MAX_BYTES / 2)));
			}
		} catch {
			// ファイルが存在しない場合はここで何もしない(初回書き込みへ続く)
		}

		fs.appendFileSync(logPath, line);
	} catch {
		// ここでの書き込み失敗はどうしようもないため無視
	}
}

process.on("uncaughtException", (err) => {
	logCrash("uncaughtException", err);
});
process.on("unhandledRejection", (err) => {
	logCrash("unhandledRejection", err);
});

try {
	// ログレベル（開発中は"trace"や"debug"にすると詳細な通信ログが見られます）
	streamDeck.logger.setLevel("info");

	// アクションを登録
	streamDeck.actions.registerAction(new SwitchBotControlAction());
	streamDeck.actions.registerAction(new TapeLightControlAction());
	streamDeck.actions.registerAction(new SingleAction());
	streamDeck.actions.registerAction(new ToggleAction());
	streamDeck.actions.registerAction(new SensorAction());
	streamDeck.actions.registerAction(new SceneBrowserDialAction());
	streamDeck.actions.registerAction(new ParamDialAction());
	streamDeck.actions.registerAction(new AcControlAction());

	// Stream Deckソフトウェアへ接続
	streamDeck.connect();
} catch (err) {
	logCrash("startup", err);
	throw err;
}
