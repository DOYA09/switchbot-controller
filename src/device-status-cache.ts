import { getDeviceStatus, SwitchBotCredentials } from "./switchbot-api";

type StatusResult = ReturnType<typeof getDeviceStatus>;

interface CacheEntry {
	timestamp: number;
	promise: StatusResult;
}

const cache = new Map<string, CacheEntry>();

/**
 * 同時多発的な問い合わせをまとめるための既定キャッシュ有効期間。
 * センサー表示・Tapelight Control・パラメーターダイヤルなど、複数のアクションが
 * ほぼ同時に同じデバイスの状態を取得しようとした場合、この時間内であれば
 * 実際のAPI呼び出しを1回にまとめて使い回す。
 */
const DEFAULT_TTL_MS = 3000;

/**
 * getDeviceStatus のキャッシュ付きラッパー。
 * 同一deviceIdへのリクエストがTTL内であれば、進行中/直近のPromiseをそのまま返す
 * (新たなHTTPリクエストは発生しない)。SwitchBot APIのレート制限(1トークンあたり
 * 1日10,000回)を、キー数が多い環境でも節約しやすくするための仕組み。
 */
export function getCachedDeviceStatus(creds: SwitchBotCredentials, deviceId: string, ttlMs: number = DEFAULT_TTL_MS): StatusResult {
	const now = Date.now();
	const existing = cache.get(deviceId);
	if (existing && now - existing.timestamp < ttlMs) {
		return existing.promise;
	}

	const promise = getDeviceStatus(creds, deviceId);
	cache.set(deviceId, { timestamp: now, promise });

	// 失敗した場合は次回すぐ再試行できるよう、キャッシュに残さない
	promise.catch(() => {
		if (cache.get(deviceId)?.promise === promise) {
			cache.delete(deviceId);
		}
	});

	return promise;
}

/** コマンド送信直後など、キャッシュされた状態が古くなったことが分かっている場合に明示的に無効化する */
export function invalidateDeviceStatusCache(deviceId: string): void {
	cache.delete(deviceId);
}
