import crypto from "node:crypto";
import https from "node:https";

/**
 * SwitchBot OpenAPI v1.1 クライアント
 * https://github.com/OpenWonderLabs/SwitchBotAPI
 */

export interface SwitchBotCredentials {
	token: string;
	secret: string;
}

export interface SwitchBotResponse<T = unknown> {
	statusCode: number;
	body: {
		statusCode?: number;
		message?: string;
		body?: T;
	};
}

/**
 * レスポンスがSwitchBot APIのレート制限によるものかどうかを判定する。
 * 実際に確認されている2パターンに対応:
 * - HTTPステータス429(短時間の連続リクエストによる制限)
 * - JSON側 statusCode:190 かつ message に "daily limit" を含む(1日の上限到達)
 *   ※ statusCode:190 自体は他のエラー(デバイス内部エラー等)でも使われるため、
 *     メッセージ文言も合わせて確認することで誤判定を防いでいる。
 * (参考: https://github.com/OpenWonderLabs/SwitchBotAPI/issues/365 で実際に
 *  報告されている `{"statusCode":190,"message":"Requests reached the daily limit"}`)
 */
export function isRateLimitError(res: SwitchBotResponse): boolean {
	if (res.statusCode === 429) return true;
	const message = res.body?.message;
	return res.body?.statusCode === 190 && typeof message === "string" && message.toLowerCase().includes("daily limit");
}

/**
 * SwitchBot APIのレート制限によるエラーを表す。各アクションの catch 側でこの型を判定することで、
 * 一般的な通信エラーと区別したフィードバック(例:「レート制限」)を表示できる。
 */
export class RateLimitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RateLimitError";
	}
}

/** レスポンスを確認し、失敗していればエラーを投げる。レート制限の場合はRateLimitErrorを投げる */
export function throwIfFailed(res: SwitchBotResponse, label: string): void {
	if (res.statusCode === 200 && res.body?.statusCode === 100) return;
	const detail = `${label}に失敗しました: statusCode=${res.body?.statusCode} message=${res.body?.message ?? ""}`;
	if (isRateLimitError(res)) {
		throw new RateLimitError(detail);
	}
	throw new Error(detail);
}

/**
 * SwitchBot API v1.1 で要求される認証ヘッダーを生成する。
 * sign = Base64( HMAC-SHA256( token + t + nonce, secret ) )
 * (ユニットテストのためexportしている)
 */
export function buildAuthHeaders({ token, secret }: SwitchBotCredentials): Record<string, string> {
	const t = Date.now().toString();
	const nonce = crypto.randomUUID();
	const data = token + t + nonce;
	const sign = crypto.createHmac("sha256", secret).update(data, "utf8").digest("base64");

	return {
		Authorization: token,
		sign,
		t,
		nonce,
		"Content-Type": "application/json; charset=utf8"
	};
}

function request<T = unknown>(
	path: string,
	method: "GET" | "POST",
	creds: SwitchBotCredentials,
	body?: unknown
): Promise<SwitchBotResponse<T>> {
	return new Promise((resolve, reject) => {
		const payload = body !== undefined ? JSON.stringify(body) : undefined;
		const headers = buildAuthHeaders(creds);

		const req = https.request(
			{
				hostname: "api.switch-bot.com",
				path,
				method,
				headers: {
					...headers,
					...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
				},
				timeout: 10_000
			},
			(res) => {
				let raw = "";
				res.on("data", (chunk) => (raw += chunk));
				res.on("end", () => {
					let parsed: unknown = raw;
					try {
						parsed = raw ? JSON.parse(raw) : {};
					} catch {
						// レスポンスがJSONでない場合は生文字列のまま返す
					}
					resolve({
						statusCode: res.statusCode ?? 0,
						body: parsed as SwitchBotResponse<T>["body"]
					});
				});
			}
		);

		req.on("timeout", () => req.destroy(new Error("SwitchBot API request timed out")));
		req.on("error", reject);

		if (payload) req.write(payload);
		req.end();
	});
}

/** デバイスにコマンドを送信（電源ON/OFF、Bot押下など） */
export function controlDevice(
	creds: SwitchBotCredentials,
	deviceId: string,
	command: string,
	parameter: string = "default",
	commandType: string = "command"
): Promise<SwitchBotResponse> {
	return request(`/v1.1/devices/${encodeURIComponent(deviceId)}/commands`, "POST", creds, {
		command,
		parameter,
		commandType
	});
}

/** シーンIDを指定してシーンを実行 */
export function executeScene(creds: SwitchBotCredentials, sceneId: string): Promise<SwitchBotResponse> {
	return request(`/v1.1/scenes/${encodeURIComponent(sceneId)}/execute`, "POST", creds);
}

/** デバイスの状態を取得（トグル判定・状態インジケーター・センサー表示・汎用ダイヤル同期に使用。対応デバイスのみ） */
export function getDeviceStatus(
	creds: SwitchBotCredentials,
	deviceId: string
): Promise<
	SwitchBotResponse<{
		power?: string;
		brightness?: number;
		temperature?: number;
		humidity?: number;
		battery?: number;
		slidePosition?: number;
		colorTemperature?: number;
		/** "R:G:B" 形式(例: "255:0:0")。カラー対応デバイス(テープライト等)のみ */
		color?: string;
	}>
> {
	return request(`/v1.1/devices/${encodeURIComponent(deviceId)}/status`, "GET", creds);
}

/**
 * 一時的な通信不調を吸収するための簡易リトライラッパー。
 * fn が例外を投げた場合、retries 回まで delayMs 間隔で再試行する。
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 800): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		if (retries <= 0) throw err;
		await new Promise((resolve) => setTimeout(resolve, delayMs));
		return withRetry(fn, retries - 1, delayMs);
	}
}

export interface SwitchBotDeviceSummary {
	[key: string]: any;
	deviceId: string;
	deviceName: string;
	deviceType: string;
}

export interface SwitchBotSceneSummary {
	[key: string]: any;
	sceneId: string;
	sceneName: string;
}

/** ユーザーが所有する物理デバイス・赤外線リモコンデバイスの一覧を取得 */
export async function listDevices(creds: SwitchBotCredentials): Promise<SwitchBotResponse<SwitchBotDeviceSummary[]>> {
	const res = await request<{
		deviceList?: Array<{ deviceId: string; deviceName: string; deviceType: string }>;
		infraredRemoteList?: Array<{ deviceId: string; deviceName: string; remoteType: string }>;
	}>("/v1.1/devices", "GET", creds);

	const list = res.body?.body ?? {};
	const devices: SwitchBotDeviceSummary[] = [
		...(list.deviceList ?? []).map((d: { deviceId: string; deviceName: string; deviceType: string }) => ({
			deviceId: d.deviceId,
			deviceName: d.deviceName,
			deviceType: d.deviceType
		})),
		...(list.infraredRemoteList ?? []).map((d: { deviceId: string; deviceName: string; remoteType: string }) => ({
			deviceId: d.deviceId,
			deviceName: d.deviceName,
			deviceType: d.remoteType
		}))
	];

	return { statusCode: res.statusCode, body: { statusCode: res.body?.statusCode, message: res.body?.message, body: devices } };
}

/** シーン一覧を取得 */
export async function listScenes(creds: SwitchBotCredentials): Promise<SwitchBotResponse<SwitchBotSceneSummary[]>> {
	const res = await request<Array<{ sceneId: string; sceneName: string }>>("/v1.1/scenes", "GET", creds);
	const scenes = (res.body?.body ?? []).map((s: { sceneId: string; sceneName: string }) => ({
		sceneId: s.sceneId,
		sceneName: s.sceneName
	}));
	return { statusCode: res.statusCode, body: { statusCode: res.body?.statusCode, message: res.body?.message, body: scenes } };
}
