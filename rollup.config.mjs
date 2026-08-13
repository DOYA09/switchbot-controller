import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const isWatch = !!process.env.ROLLUP_WATCH;

export default {
	input: "src/plugin.ts",
	output: {
		file: "com.switchbot.controller.sdPlugin/bin/plugin.js",
		format: "cjs",
		sourcemap: isWatch,
		exports: "auto"
	},
	plugins: [
		typescript({ tsconfig: "./tsconfig.json" }),
		nodeResolve({ preferBuiltins: true }),
		commonjs()
	]
	// 依存パッケージ(wsなど)もすべて bin/plugin.js に単一バンドルするため external は指定しません。
	// これにより配布先の環境で node_modules が無くてもプラグインが動作します。
};
