// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.ts", "tests/**/*.ts"],
		rules: {
			// PIとの通信ペイロードなど、意図的にゆるく型付けしている箇所があるため無効化
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
			"no-console": "off"
		}
	},
	{
		ignores: ["node_modules/**", "dist/**", "com.switchbot.controller.sdPlugin/**", "*.js", "*.mjs"]
	}
);
