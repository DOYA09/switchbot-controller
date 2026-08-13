import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { buildAuthHeaders, isRateLimitError } from "../src/switchbot-api";

describe("buildAuthHeaders", () => {
	it("generates headers whose sign matches an independently computed HMAC-SHA256", () => {
		const creds = { token: "test-token", secret: "test-secret" };
		const headers = buildAuthHeaders(creds);

		expect(headers.Authorization).toBe(creds.token);
		expect(headers.t).toBeDefined();
		expect(headers.nonce).toBeDefined();
		expect(headers["Content-Type"]).toContain("application/json");

		// SwitchBot API仕様通りに署名を独自に再計算し、一致することを確認する
		const expectedSign = crypto
			.createHmac("sha256", creds.secret)
			.update(creds.token + headers.t + headers.nonce, "utf8")
			.digest("base64");

		expect(headers.sign).toBe(expectedSign);
	});

	it("produces a different nonce (and therefore a different signature) on every call", () => {
		const creds = { token: "t", secret: "s" };
		const a = buildAuthHeaders(creds);
		const b = buildAuthHeaders(creds);

		expect(a.nonce).not.toBe(b.nonce);
		expect(a.sign).not.toBe(b.sign);
	});

	it("produces a different signature for a different secret, given the same token", () => {
		const a = buildAuthHeaders({ token: "same-token", secret: "secret-a" });
		const b = buildAuthHeaders({ token: "same-token", secret: "secret-b" });

		expect(a.sign).not.toBe(b.sign);
	});
});

describe("isRateLimitError", () => {
	it("detects a plain HTTP 429 response", () => {
		expect(isRateLimitError({ statusCode: 429, body: {} })).toBe(true);
	});

	it("detects the daily-limit JSON error reported by the SwitchBot API", () => {
		// 実際に確認されている形式: https://github.com/OpenWonderLabs/SwitchBotAPI/issues/365
		expect(
			isRateLimitError({ statusCode: 200, body: { statusCode: 190, message: "Requests reached the daily limit" } })
		).toBe(true);
	});

	it("is case-insensitive when matching the daily-limit message", () => {
		expect(isRateLimitError({ statusCode: 200, body: { statusCode: 190, message: "REQUESTS REACHED THE DAILY LIMIT" } })).toBe(true);
	});

	it("does not flag other statusCode:190 errors that are unrelated to rate limiting", () => {
		expect(isRateLimitError({ statusCode: 200, body: { statusCode: 190, message: "Device internal error" } })).toBe(false);
	});

	it("does not flag a normal successful response", () => {
		expect(isRateLimitError({ statusCode: 200, body: { statusCode: 100, message: "success" } })).toBe(false);
	});

	it("does not flag other unrelated failures", () => {
		expect(isRateLimitError({ statusCode: 200, body: { statusCode: 151, message: "Device type error" } })).toBe(false);
	});
});
