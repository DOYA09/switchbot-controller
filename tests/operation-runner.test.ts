import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@elgato/streamdeck", () => ({
	default: {
		logger: {
			warn: vi.fn(),
			error: vi.fn()
		}
	}
}));

vi.mock("../src/switchbot-api", () => ({
	controlDevice: vi.fn(),
	executeScene: vi.fn(),
	// 実際の実装と同じ判定ロジックを使う(operation-runner側のログ分岐を検証するため)
	isRateLimitError: (res: { statusCode: number; body?: { statusCode?: number; message?: string } }) => {
		if (res.statusCode === 429) return true;
		const message = res.body?.message;
		return res.body?.statusCode === 190 && typeof message === "string" && message.toLowerCase().includes("daily limit");
	}
}));

vi.mock("../src/device-status-cache", () => ({
	getCachedDeviceStatus: vi.fn(),
	invalidateDeviceStatusCache: vi.fn()
}));

vi.mock("../src/ac-state", () => ({
	getAcState: vi.fn(),
	setAcState: vi.fn(),
	patchAcState: vi.fn(),
	// 実際の実装と同じ丸め・クランプ挙動を使う(テスト対象外のロジックだが、
	// operation-runner側の計算結果を検証するために本物と同じ振る舞いが必要なため)
	clampAcTemp: (v: number) => Math.min(30, Math.max(16, Math.round(v)))
}));

import { controlDevice, executeScene } from "../src/switchbot-api";
import { getCachedDeviceStatus, invalidateDeviceStatusCache } from "../src/device-status-cache";
import { getAcState, setAcState, patchAcState } from "../src/ac-state";
import { runOperation } from "../src/operation-runner";
import { DEFAULT_OPERATION, OperationConfig } from "../src/operation-config";

const creds = { token: "t", secret: "s" };
const ok = { statusCode: 200, body: { statusCode: 100, body: {} } };
const fail = { statusCode: 200, body: { statusCode: 190, message: "error" } };

function makeAction() {
	return { showOk: vi.fn(async () => {}), showAlert: vi.fn(async () => {}) };
}

function makeConfig(overrides: Partial<OperationConfig> = {}): OperationConfig {
	return { ...DEFAULT_OPERATION, deviceId: "device-1", deviceName: "Test Device", ...overrides };
}

describe("runOperation", () => {
	beforeEach(() => {
		vi.mocked(controlDevice).mockReset().mockResolvedValue(ok as never);
		vi.mocked(executeScene).mockReset().mockResolvedValue(ok as never);
		vi.mocked(getCachedDeviceStatus).mockReset().mockResolvedValue({ statusCode: 200, body: { statusCode: 100, body: {} } } as never);
		vi.mocked(getAcState).mockReset().mockResolvedValue({ temp: 24, mode: 2, fan: 1, power: "on" } as never);
		vi.mocked(setAcState).mockReset().mockResolvedValue(undefined as never);
		vi.mocked(patchAcState).mockReset().mockResolvedValue(undefined as never);
	});

	describe("scene targets", () => {
		it("calls executeScene and shows success when a scene is configured", async () => {
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ targetType: "scene", sceneId: "scene-1" }));

			expect(executeScene).toHaveBeenCalledWith(creds, "scene-1");
			expect(action.showOk).toHaveBeenCalled();
			expect(action.showAlert).not.toHaveBeenCalled();
		});

		it("shows an alert and does not call the API when no scene is selected", async () => {
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ targetType: "scene", sceneId: "" }));

			expect(executeScene).not.toHaveBeenCalled();
			expect(action.showAlert).toHaveBeenCalled();
		});

		it("shows an alert when the scene execution fails", async () => {
			vi.mocked(executeScene).mockResolvedValue(fail as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ targetType: "scene", sceneId: "scene-1" }));

			expect(action.showAlert).toHaveBeenCalled();
			expect(action.showOk).not.toHaveBeenCalled();
		});
	});

	describe("device targets: basic commands", () => {
		it("shows an alert and does not call the API when no device is selected", async () => {
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ deviceId: "" }));

			expect(controlDevice).not.toHaveBeenCalled();
			expect(action.showAlert).toHaveBeenCalled();
		});

		it("sends the configured command directly for a simple command like turnOn", async () => {
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "turnOn" }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "turnOn", "default", "command");
			expect(action.showOk).toHaveBeenCalled();
		});

		it("resolves a custom command using customCommand/commandType", async () => {
			const action = makeAction();
			await runOperation(
				action,
				creds,
				makeConfig({ command: "custom", customCommand: "setMode", commandType: "customize", parameter: "eco" })
			);

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setMode", "eco", "customize");
		});

		it("shows an alert when the API call fails", async () => {
			vi.mocked(controlDevice).mockResolvedValue(fail as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "turnOn" }));

			expect(action.showAlert).toHaveBeenCalled();
			expect(action.showOk).not.toHaveBeenCalled();
		});

		it("still shows an alert (same as any other failure) when the API reports a rate limit error", async () => {
			const rateLimited = { statusCode: 200, body: { statusCode: 190, message: "Requests reached the daily limit" } };
			vi.mocked(controlDevice).mockResolvedValue(rateLimited as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "turnOn" }));

			expect(action.showAlert).toHaveBeenCalled();
			expect(action.showOk).not.toHaveBeenCalled();
		});

		it("also treats a plain HTTP 429 response as a failure", async () => {
			const rateLimited = { statusCode: 429, body: {} };
			vi.mocked(controlDevice).mockResolvedValue(rateLimited as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "turnOn" }));

			expect(action.showAlert).toHaveBeenCalled();
		});

		it("does not call showOk when the action has no showOk (dial actions)", async () => {
			const action = { showAlert: vi.fn(async () => {}) };
			await runOperation(action, creds, makeConfig({ command: "turnOn" }));
			// showOkが存在しなくても例外を投げずに完了すること
			expect(controlDevice).toHaveBeenCalled();
		});
	});

	describe("toggle command", () => {
		it("sends turnOff when the device is currently reported as on", async () => {
			vi.mocked(getCachedDeviceStatus).mockResolvedValue({ statusCode: 200, body: { statusCode: 100, body: { power: "on" } } } as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "toggle" }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "turnOff", "default", "command");
		});

		it("sends turnOn when the device is currently reported as off", async () => {
			vi.mocked(getCachedDeviceStatus).mockResolvedValue({ statusCode: 200, body: { statusCode: 100, body: { power: "off" } } } as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "toggle" }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "turnOn", "default", "command");
		});
	});

	describe("Air Conditioner shared-state bookkeeping", () => {
		it("records the shared power state for a plain turnOn sent to an Air Conditioner", async () => {
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "turnOn", deviceType: "Air Conditioner" }));

			expect(patchAcState).toHaveBeenCalledWith("device-1", { power: "on" });
		});

		it("records the shared power state for a plain turnOff sent to an Air Conditioner", async () => {
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "turnOff", deviceType: "Air Conditioner" }));

			expect(patchAcState).toHaveBeenCalledWith("device-1", { power: "off" });
		});

		it("does not touch the shared AC state for non-Air-Conditioner devices", async () => {
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "turnOn", deviceType: "Plug Mini (JP)" }));

			expect(patchAcState).not.toHaveBeenCalled();
		});
	});

	describe("setAll (エアコン詳細設定)", () => {
		it("sends temperature/mode/fan with power always on, in Celsius", async () => {
			const action = makeAction();
			await runOperation(
				action,
				creds,
				makeConfig({ command: "setAll", acUnit: "C", acTemp: 25, acMode: 5, acFanSpeed: 3 })
			);

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setAll", "25,5,3,on", "command");
			expect(setAcState).toHaveBeenCalledWith("device-1", { temp: 25, mode: 5, fan: 3, power: "on" });
		});

		it("converts Fahrenheit input to Celsius before sending", async () => {
			const action = makeAction();
			// 78°F -> (78-32)*5/9 = 25.55... -> 摂氏26に丸められる
			await runOperation(action, creds, makeConfig({ command: "setAll", acUnit: "F", acTemp: 78, acMode: 2, acFanSpeed: 1 }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setAll", "26,2,1,on", "command");
		});

		it("clamps the resulting Celsius temperature to the 16-30 range", async () => {
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "setAll", acUnit: "C", acTemp: 99, acMode: 2, acFanSpeed: 1 }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setAll", "30,2,1,on", "command");
		});
	});

	describe("acAdjustTemp (エアコン温度調整)", () => {
		it("increases the shared temperature by 1 degree when direction is up", async () => {
			vi.mocked(getAcState).mockResolvedValue({ temp: 24, mode: 2, fan: 1, power: "on" } as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "acAdjustTemp", acAdjustDirection: "up" }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setAll", "25,2,1,on", "command");
			expect(setAcState).toHaveBeenCalledWith("device-1", { temp: 25, mode: 2, fan: 1, power: "on" });
		});

		it("decreases the shared temperature by 1 degree when direction is down", async () => {
			vi.mocked(getAcState).mockResolvedValue({ temp: 24, mode: 2, fan: 1, power: "on" } as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "acAdjustTemp", acAdjustDirection: "down" }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setAll", "23,2,1,on", "command");
		});

		it("does not go below the 16 degree floor", async () => {
			vi.mocked(getAcState).mockResolvedValue({ temp: 16, mode: 2, fan: 1, power: "on" } as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "acAdjustTemp", acAdjustDirection: "down" }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setAll", "16,2,1,on", "command");
		});
	});

	describe("adjustBrightness / adjustColorTemp", () => {
		it("reads the real device brightness and increases it by 10", async () => {
			vi.mocked(getCachedDeviceStatus).mockResolvedValue({ statusCode: 200, body: { statusCode: 100, body: { brightness: 40 } } } as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "adjustBrightness", acAdjustDirection: "up" }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setBrightness", "50", "command");
			expect(invalidateDeviceStatusCache).toHaveBeenCalledWith("device-1");
		});

		it("clamps brightness to the 1-100 range", async () => {
			vi.mocked(getCachedDeviceStatus).mockResolvedValue({ statusCode: 200, body: { statusCode: 100, body: { brightness: 95 } } } as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "adjustBrightness", acAdjustDirection: "up" }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setBrightness", "100", "command");
		});

		it("falls back to a sensible default when the device reports no current brightness", async () => {
			vi.mocked(getCachedDeviceStatus).mockResolvedValue({ statusCode: 200, body: { statusCode: 100, body: {} } } as never);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "adjustBrightness", acAdjustDirection: "down" }));

			// フォールバック50から10下げて40になるはず
			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setBrightness", "40", "command");
		});

		it("adjusts color temperature by 100K steps", async () => {
			vi.mocked(getCachedDeviceStatus).mockResolvedValue(
				{ statusCode: 200, body: { statusCode: 100, body: { colorTemperature: 4000 } } } as never
			);
			const action = makeAction();
			await runOperation(action, creds, makeConfig({ command: "adjustColorTemp", acAdjustDirection: "up" }));

			expect(controlDevice).toHaveBeenCalledWith(creds, "device-1", "setColorTemperature", "4100", "command");
		});
	});
});
