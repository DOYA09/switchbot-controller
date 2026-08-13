import streamDeck from "@elgato/streamdeck";
import type { GlobalSettings } from "./global-settings";

export interface AcState {
	temp: number;
	mode: number;
	fan: number;
	power: "on" | "off";
}

/** 共有状態が一度も記録されていないデバイスに対する既定値(冷房・26℃・風量自動・電源不明時はon扱い) */
export const DEFAULT_AC_STATE: AcState = { temp: 26, mode: 2, fan: 1, power: "on" };

export const AC_TEMP_MIN = 16;
export const AC_TEMP_MAX = 30;

/**
 * 指定デバイス(エアコン)の直近の共有状態を取得する。
 * 「エアコン詳細設定」「エアコン温度設定」やエアコンコントロールのダイヤル操作など、
 * どのアクションからエアコンを操作した場合も、実行後にこの状態を更新するため、
 * 異なるキー/アクション間である程度追従できる(実機からの読み取りはできないため、
 * あくまで「プラグインが最後に送信した内容の記憶」であることに変わりはない)。
 */
export async function getAcState(deviceId: string): Promise<AcState> {
	const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	const state = global?.acStateByDevice?.[deviceId];
	return state ? { ...DEFAULT_AC_STATE, ...state } : { ...DEFAULT_AC_STATE };
}

/** 指定デバイス(エアコン)の共有状態を(完全に)更新する */
export async function setAcState(deviceId: string, state: AcState): Promise<void> {
	const global = (await streamDeck.settings.getGlobalSettings<GlobalSettings>()) ?? {};
	const acStateByDevice = { ...(global.acStateByDevice ?? {}), [deviceId]: state };
	await streamDeck.settings.setGlobalSettings<GlobalSettings>({ ...global, acStateByDevice });
}

/** 指定デバイス(エアコン)の共有状態のうち、渡したフィールドだけを更新する(他は既存値を維持) */
export async function patchAcState(deviceId: string, patch: Partial<AcState>): Promise<AcState> {
	const global = (await streamDeck.settings.getGlobalSettings<GlobalSettings>()) ?? {};
	const current = global.acStateByDevice?.[deviceId] ?? DEFAULT_AC_STATE;
	const next: AcState = { ...current, ...patch };
	const acStateByDevice = { ...(global.acStateByDevice ?? {}), [deviceId]: next };
	await streamDeck.settings.setGlobalSettings<GlobalSettings>({ ...global, acStateByDevice });
	return next;
}

export function clampAcTemp(temp: number): number {
	return Math.min(AC_TEMP_MAX, Math.max(AC_TEMP_MIN, Math.round(temp)));
}
