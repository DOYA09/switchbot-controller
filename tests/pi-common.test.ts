import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * pi-common.js はProperty Inspector(ブラウザ側)専用のプレーンJSで、
 * window/documentへ直接アタッチする形になっているため、Node の vm モジュールで
 * 最小限のwindow/documentスタブを与えて実行し、window.SwitchBotPI を取り出してテストする。
 */
describe("pi-common.js translations", () => {
	let PI: any;

	beforeAll(() => {
		const filePath = path.resolve(__dirname, "../com.switchbot.controller.sdPlugin/ui/pi-common.js");
		const code = fs.readFileSync(filePath, "utf8");
		const sandboxWindow: Record<string, unknown> = {};
		const sandbox = {
			window: sandboxWindow,
			document: { querySelectorAll: () => [] }
		};
		vm.createContext(sandbox);
		vm.runInContext(code, sandbox);
		PI = sandboxWindow.SwitchBotPI;
	});

	const languages = ["ja", "en", "de", "fr", "es", "ko", "zh_CN", "zh_TW"];
	const sampleKeys = [
		"label.token",
		"label.secret",
		"hint.credentials",
		"cmd.setAll",
		"status.devices_updated",
		"error.generic",
		"tapelight.scene_hint",
		"paramdial.hint",
		"scenebrowser.hint"
	];

	it.each(languages)("resolves all sample keys without falling back to the raw key ('%s')", (lang) => {
		PI.setLanguage(lang);
		sampleKeys.forEach((key) => {
			const value = PI.t(key, { count: 5 });
			expect(value).not.toBe(key);
			expect(value.length).toBeGreaterThan(0);
		});
	});

	it("falls back to English for unsupported language codes", () => {
		PI.setLanguage("xx");
		expect(PI.t("label.token")).toBe("Token");
	});

	it("maps a bare 'zh' code to Simplified Chinese", () => {
		PI.setLanguage("zh");
		expect(PI.t("label.token")).toBe("令牌");
	});

	it("substitutes {count} placeholders", () => {
		PI.setLanguage("en");
		expect(PI.t("status.devices_updated", { count: 7 })).toContain("7");
	});

	it("provides the same command option count for every language", () => {
		PI.setLanguage("ja");
		const expectedCount = PI.getCommandOptions().length;
		expect(expectedCount).toBeGreaterThan(0);

		languages.forEach((lang) => {
			PI.setLanguage(lang);
			expect(PI.getCommandOptions().length).toBe(expectedCount);
		});
	});
});
