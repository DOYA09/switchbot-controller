import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/switchbot-api", () => ({
	getDeviceStatus: vi.fn()
}));

import { getDeviceStatus } from "../src/switchbot-api";
import { getCachedDeviceStatus, invalidateDeviceStatusCache } from "../src/device-status-cache";

const creds = { token: "t", secret: "s" };
const okResponse = { statusCode: 200, body: { statusCode: 100, body: { power: "on" } } };

describe("getCachedDeviceStatus", () => {
	beforeEach(() => {
		vi.mocked(getDeviceStatus).mockReset();
		vi.mocked(getDeviceStatus).mockResolvedValue(okResponse as never);
		invalidateDeviceStatusCache("device-1");
		invalidateDeviceStatusCache("device-2");
	});

	it("reuses the recent result for the same device within the TTL window", async () => {
		await getCachedDeviceStatus(creds, "device-1", 5000);
		await getCachedDeviceStatus(creds, "device-1", 5000);
		await getCachedDeviceStatus(creds, "device-1", 5000);

		expect(getDeviceStatus).toHaveBeenCalledTimes(1);
	});

	it("issues separate requests for different devices", async () => {
		await getCachedDeviceStatus(creds, "device-1", 5000);
		await getCachedDeviceStatus(creds, "device-2", 5000);

		expect(getDeviceStatus).toHaveBeenCalledTimes(2);
	});

	it("issues a new request after the cache has been explicitly invalidated", async () => {
		await getCachedDeviceStatus(creds, "device-1", 5000);
		invalidateDeviceStatusCache("device-1");
		await getCachedDeviceStatus(creds, "device-1", 5000);

		expect(getDeviceStatus).toHaveBeenCalledTimes(2);
	});

	it("issues a new request once the TTL has elapsed", async () => {
		await getCachedDeviceStatus(creds, "device-1", 10);
		await new Promise((resolve) => setTimeout(resolve, 20));
		await getCachedDeviceStatus(creds, "device-1", 10);

		expect(getDeviceStatus).toHaveBeenCalledTimes(2);
	});
});
