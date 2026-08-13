import { describe, it, expect, vi, beforeEach } from "vitest";

const globalSettingsStore: Record<string, any> = {};

vi.mock("@elgato/streamdeck", () => ({
	default: {
		settings: {
			getGlobalSettings: vi.fn(async () => ({ ...globalSettingsStore })),
			setGlobalSettings: vi.fn(async (value: any) => {
				Object.keys(globalSettingsStore).forEach((k) => delete globalSettingsStore[k]);
				Object.assign(globalSettingsStore, value);
			})
		}
	}
}));

import { getAcState, setAcState, patchAcState, clampAcTemp, DEFAULT_AC_STATE, AC_TEMP_MIN, AC_TEMP_MAX } from "../src/ac-state";

describe("ac-state", () => {
	beforeEach(() => {
		Object.keys(globalSettingsStore).forEach((k) => delete globalSettingsStore[k]);
	});

	it("returns the default state for a device with no recorded state", async () => {
		const state = await getAcState("device-1");
		expect(state).toEqual(DEFAULT_AC_STATE);
	});

	it("persists and retrieves a per-device state independently", async () => {
		await setAcState("device-1", { temp: 24, mode: 5, fan: 2, power: "on" });
		await setAcState("device-2", { temp: 28, mode: 3, fan: 1, power: "off" });

		expect(await getAcState("device-1")).toEqual({ temp: 24, mode: 5, fan: 2, power: "on" });
		expect(await getAcState("device-2")).toEqual({ temp: 28, mode: 3, fan: 1, power: "off" });
	});

	it("overwrites only the targeted device's state", async () => {
		await setAcState("device-1", { temp: 24, mode: 5, fan: 2, power: "on" });
		await setAcState("device-1", { temp: 20, mode: 5, fan: 2, power: "on" });

		expect(await getAcState("device-1")).toEqual({ temp: 20, mode: 5, fan: 2, power: "on" });
	});

	it("patchAcState updates only the given fields and keeps the rest", async () => {
		await setAcState("device-1", { temp: 24, mode: 2, fan: 1, power: "on" });
		const result = await patchAcState("device-1", { power: "off" });

		expect(result).toEqual({ temp: 24, mode: 2, fan: 1, power: "off" });
		expect(await getAcState("device-1")).toEqual({ temp: 24, mode: 2, fan: 1, power: "off" });
	});

	it("patchAcState starts from the default state when nothing was recorded yet", async () => {
		const result = await patchAcState("device-new", { power: "off" });
		expect(result).toEqual({ ...DEFAULT_AC_STATE, power: "off" });
	});

	it("clamps temperatures to the valid AC range", () => {
		expect(clampAcTemp(10)).toBe(AC_TEMP_MIN);
		expect(clampAcTemp(40)).toBe(AC_TEMP_MAX);
		expect(clampAcTemp(24.6)).toBe(25);
		expect(clampAcTemp(24)).toBe(24);
	});
});
