import streamDeck, {
	action,
	DialAction,
	DialDownEvent,
	DialRotateEvent,
	DidReceiveSettingsEvent,
	SingletonAction,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";
import { executeScene, isRateLimitError, listScenes, SwitchBotCredentials, SwitchBotSceneSummary } from "../switchbot-api";
import type { GlobalSettings } from "../global-settings";

/** 1件のシーンの並び順・表示可否を保持するエントリ */
interface SceneEntry {
	sceneId: string;
	sceneName: string;
	/** ダイヤルでの切替対象に含めるかどうか(PIの「表示」チェックボックスに対応) */
	visible: boolean;
}

interface SceneBrowserSettings {
	[key: string]: any;
	/** 現在ダイヤルに表示中のシーンの、表示対象一覧内でのインデックス。キーごとに保存され、再起動後も引き継がれる */
	currentIndex: number;
	/** バックグラウンドでシーン一覧を再取得する間隔(分) */
	refreshIntervalMin: number;
	/** バックグラウンド自動更新を行うかどうか(既定はOFF。API呼び出し回数を抑えるため手動更新が既定) */
	autoRefreshEnabled: boolean;
	/** 全シーンの並び順・表示可否(PIの一覧・並べ替え・チェックボックスの実体) */
	sceneOrder: SceneEntry[];
	/** タッチディスプレイに表示するシーン名の文字サイズ(px) */
	fontSize: number;
}

const DEFAULT_SETTINGS: SceneBrowserSettings = {
	currentIndex: 0,
	refreshIntervalMin: 30,
	autoRefreshEnabled: false,
	sceneOrder: [],
	fontSize: 24
};

const MIN_REFRESH_INTERVAL_MIN = 5;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;

interface RuntimeState {
	/** 「表示」がONのシーンのみ、PIでの並び順通りに保持する(ダイヤルの実際の切替対象) */
	scenes: SwitchBotSceneSummary[];
	refreshTimer?: ReturnType<typeof setInterval>;
	/** 直近に適用したフォントサイズ(不要なsetFeedbackLayout呼び出しを避けるため) */
	appliedFontSize?: number;
}

function normalizeIndex(index: number, length: number): number {
	if (length <= 0) return 0;
	return ((index % length) + length) % length;
}

function clampFontSize(size: number): number {
	return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size) || DEFAULT_SETTINGS.fontSize));
}

/**
 * 組み込みレイアウト「$B1」(タイトル上部・左にアイコン・右にシーン名+下に進捗バー)を
 * そのまま複製したカスタムレイアウト。$B1との違いは「value」(シーン名)の
 * font.sizeをPIの設定値に差し替えている点のみで、アイコン・アクション名・
 * インジケーターバーの見た目や配置は元の$B1と同一になるようにしている。
 */
function buildLayout(fontSize: number) {
	return {
		id: `com.switchbot.controller.scenebrowser.layout.${fontSize}`,
		items: [
			{ key: "title", type: "text", rect: [16, 10, 136, 24], font: { size: 16, weight: 600 }, alignment: "left" },
			{ key: "icon", type: "pixmap", rect: [16, 40, 48, 48] },
			{
				key: "value",
				type: "text",
				rect: [76, 40, 108, 32],
				font: { size: fontSize, weight: 600 },
				alignment: "right",
				"text-overflow": "ellipsis"
			},
			{ key: "indicator", type: "bar", rect: [76, 74, 108, 12], value: 0, subtype: 4, border_w: 0 }
		]
	};
}

/**
 * APIから取得した最新のシーン一覧と、既存の並び順/表示設定(sceneOrder)をマージする。
 * - 既存に残っているシーンは、順序と表示設定(visible)を維持する
 * - 新しく増えたシーンは一番下に追加する(既定は表示ON)
 * - アプリ側で削除されたシーンは一覧から取り除く
 */
function mergeSceneOrder(existing: SceneEntry[], fresh: SwitchBotSceneSummary[]): SceneEntry[] {
	const freshById = new Map(fresh.map((s) => [s.sceneId, s.sceneName]));
	const merged: SceneEntry[] = [];
	const seen = new Set<string>();

	for (const entry of existing) {
		const freshName = freshById.get(entry.sceneId);
		if (freshName !== undefined) {
			merged.push({ sceneId: entry.sceneId, sceneName: freshName, visible: entry.visible });
			seen.add(entry.sceneId);
		}
	}
	for (const s of fresh) {
		if (!seen.has(s.sceneId)) {
			merged.push({ sceneId: s.sceneId, sceneName: s.sceneName, visible: true });
		}
	}
	return merged;
}

/**
 * SwitchBotアプリで作成したシーンの一覧をダイヤルでブラウズし、
 * 押し込みで実行できるアクション。特定のデバイスに紐づかない汎用のシーン実行機。
 * PIで並べ替え・表示/非表示・文字サイズを設定でき、ダイヤルはその設定に従って切り替える。
 */
@action({ UUID: "com.switchbot.controller.scenebrowser" })
export class SceneBrowserDialAction extends SingletonAction<SceneBrowserSettings> {
	private runtime = new Map<string, RuntimeState>();

	private getRuntime(id: string): RuntimeState {
		let r = this.runtime.get(id);
		if (!r) {
			r = { scenes: [] };
			this.runtime.set(id, r);
		}
		return r;
	}

	private async getCreds(): Promise<SwitchBotCredentials | null> {
		const global = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		if (!global?.token || !global?.secret) return null;
		return { token: global.token, secret: global.secret };
	}

	override async onWillAppear(ev: WillAppearEvent<SceneBrowserSettings>): Promise<void> {
		if (!ev.action.isDial()) return;

		const settings = (ev.payload.settings ?? {}) as Partial<SceneBrowserSettings>;
		let changed = false;
		if (settings.currentIndex === undefined) {
			settings.currentIndex = DEFAULT_SETTINGS.currentIndex;
			changed = true;
		}
		if (settings.refreshIntervalMin === undefined) {
			settings.refreshIntervalMin = DEFAULT_SETTINGS.refreshIntervalMin;
			changed = true;
		}
		if (settings.autoRefreshEnabled === undefined) {
			settings.autoRefreshEnabled = DEFAULT_SETTINGS.autoRefreshEnabled;
			changed = true;
		}
		if (settings.sceneOrder === undefined) {
			settings.sceneOrder = [];
			changed = true;
		}
		if (settings.fontSize === undefined) {
			settings.fontSize = DEFAULT_SETTINGS.fontSize;
			changed = true;
		}
		const finalSettings = settings as SceneBrowserSettings;
		if (changed) {
			await ev.action.setSettings(finalSettings);
		}

		await this.applyLayoutIfNeeded(ev.action, finalSettings);
		this.syncRuntimeFromSettings(ev.action, finalSettings);
		await this.refreshScenes(ev.action, finalSettings, true);
		this.startAutoRefresh(ev.action, finalSettings);
	}

	override onWillDisappear(ev: WillDisappearEvent<SceneBrowserSettings>): void {
		const r = this.runtime.get(ev.action.id);
		if (r?.refreshTimer) clearInterval(r.refreshTimer);
		this.runtime.delete(ev.action.id);
	}

	/**
	 * PIで並べ替え/表示切替/自動更新設定/文字サイズなどが変更された際に発火する。
	 * ここではAPI通信は行わず、保存済みのsceneOrderをそのままダイヤルの表示に反映するだけなので、
	 * PIでの操作がほぼ即座にダイヤルへ反映される。
	 */
	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SceneBrowserSettings>): Promise<void> {
		if (!ev.action.isDial()) return;
		await this.applyLayoutIfNeeded(ev.action, ev.payload.settings);
		this.syncRuntimeFromSettings(ev.action, ev.payload.settings);
		this.startAutoRefresh(ev.action, ev.payload.settings);
	}

	/** PIからの「更新」ボタン押下によるシーン一覧の再取得リクエストを処理する */
	override async onSendToPlugin(ev: any): Promise<void> {
		if (!ev?.action || typeof ev.action.isDial !== "function" || !ev.action.isDial()) return;
		const payload = ev?.payload as { event?: string } | undefined;
		if (!payload || payload.event !== "refresh") return;

		try {
			// sendToPlugin イベントの payload はPIから送られた任意データ({event:"refresh"})であり、
			// アクションの設定(settings)は含まれていないため、別途取得する必要がある。
			const settings = await ev.action.getSettings();
			await this.refreshScenes(ev.action, settings, false);
		} catch (err) {
			streamDeck.logger.error(`SceneBrowserDial: 手動更新の処理中にエラー: ${String(err)}`);
			await ev.action.showAlert();
		}
	}

	/** 現在のフォントサイズと異なる場合のみ、タッチディスプレイのレイアウトを更新する */
	private async applyLayoutIfNeeded(dial: DialAction<SceneBrowserSettings>, settings: SceneBrowserSettings): Promise<void> {
		const r = this.getRuntime(dial.id);
		const fontSize = clampFontSize(settings.fontSize ?? DEFAULT_SETTINGS.fontSize);
		if (r.appliedFontSize === fontSize) return;
		try {
			await dial.setFeedbackLayout(buildLayout(fontSize) as any);
			r.appliedFontSize = fontSize;
		} catch (err) {
			streamDeck.logger.error(`SceneBrowserDial: レイアウト適用に失敗しました: ${String(err)}`);
		}
	}

	private startAutoRefresh(dial: DialAction<SceneBrowserSettings>, settings: SceneBrowserSettings): void {
		const r = this.getRuntime(dial.id);
		if (r.refreshTimer) {
			clearInterval(r.refreshTimer);
			r.refreshTimer = undefined;
		}
		if (!settings.autoRefreshEnabled) return;

		const minutes = Math.max(MIN_REFRESH_INTERVAL_MIN, settings.refreshIntervalMin || DEFAULT_SETTINGS.refreshIntervalMin);
		r.refreshTimer = setInterval(() => {
			void (async () => {
				try {
					const latest = await dial.getSettings();
					await this.refreshScenes(dial, latest, true);
				} catch (err) {
					streamDeck.logger.error(`SceneBrowserDial: 自動更新に失敗しました: ${String(err)}`);
				}
			})();
		}, minutes * 60_000);
	}

	/**
	 * 保存済みのsceneOrder(並び順・表示設定)を、そのままダイヤルの表示状態に反映する。
	 * API通信は行わない(refreshScenesとは異なり、設定変更の即時反映専用)。
	 */
	private syncRuntimeFromSettings(dial: DialAction<SceneBrowserSettings>, settings: SceneBrowserSettings): void {
		const r = this.getRuntime(dial.id);
		const order = settings.sceneOrder ?? [];
		r.scenes = order.filter((e) => e.visible).map((e) => ({ sceneId: e.sceneId, sceneName: e.sceneName }));
		const index = normalizeIndex(settings.currentIndex ?? 0, r.scenes.length);
		this.renderFeedback(dial, r, index);
	}

	/** silent=true は自動更新/初回表示時(通信失敗時にアイコンを点滅させない)、false は手動更新時 */
	private async refreshScenes(dial: DialAction<SceneBrowserSettings>, settings: SceneBrowserSettings, silent: boolean): Promise<void> {
		const creds = await this.getCreds();
		if (!creds) {
			await dial.setFeedback({ value: "認証未設定", indicator: { value: 0 } });
			if (!silent) await dial.showAlert();
			return;
		}

		try {
			const res = await listScenes(creds);
			if (!(res.statusCode === 200 && res.body?.statusCode === 100)) {
				if (isRateLimitError(res)) {
					streamDeck.logger.warn(`SceneBrowserDial: シーン一覧取得がAPIのレート制限により失敗しました: ${JSON.stringify(res.body)}`);
					await dial.setFeedback({ value: "レート制限", indicator: { value: 0 } });
				} else {
					streamDeck.logger.error(`SceneBrowserDial: シーン一覧取得に失敗しました: ${JSON.stringify(res.body)}`);
					await dial.setFeedback({ value: "取得失敗", indicator: { value: 0 } });
				}
				if (!silent) await dial.showAlert();
				return;
			}

			const fresh = res.body.body ?? [];
			settings.sceneOrder = mergeSceneOrder(settings.sceneOrder ?? [], fresh);

			const r = this.getRuntime(dial.id);
			r.scenes = settings.sceneOrder.filter((e) => e.visible).map((e) => ({ sceneId: e.sceneId, sceneName: e.sceneName }));

			const index = normalizeIndex(settings.currentIndex ?? 0, r.scenes.length);
			settings.currentIndex = index;
			await dial.setSettings(settings);

			this.renderFeedback(dial, r, index);
		} catch (err) {
			streamDeck.logger.error(`SceneBrowserDial: シーン一覧取得中にエラー: ${String(err)}`);
			await dial.setFeedback({ value: "通信エラー", indicator: { value: 0 } });
			if (!silent) await dial.showAlert();
		}
	}

	private renderFeedback(dial: DialAction<SceneBrowserSettings>, r: RuntimeState, index: number): void {
		if (r.scenes.length === 0) {
			void dial.setFeedback({ value: "シーンなし", indicator: { value: 0 } });
			return;
		}
		const scene = r.scenes[index];
		const percent = Math.round(((index + 1) / r.scenes.length) * 100);
		// 文字サイズを可変にするカスタムレイアウトが text-overflow:"ellipsis" で
		// 自動的に省略してくれるため、ここでは手動での文字数切り詰めは行わない。
		void dial.setFeedback({ value: scene.sceneName, indicator: { value: percent } });
	}

	override async onDialRotate(ev: DialRotateEvent<SceneBrowserSettings>): Promise<void> {
		const r = this.getRuntime(ev.action.id);
		if (r.scenes.length === 0) {
			await this.refreshScenes(ev.action, ev.payload.settings, true);
			return;
		}

		const direction = Math.sign(ev.payload.ticks);
		if (direction === 0) return;

		const settings = ev.payload.settings;
		const index = normalizeIndex((settings.currentIndex ?? 0) + direction, r.scenes.length);
		settings.currentIndex = index;
		await ev.action.setSettings(settings);
		this.renderFeedback(ev.action, r, index);
	}

	override async onDialDown(ev: DialDownEvent<SceneBrowserSettings>): Promise<void> {
		const r = this.getRuntime(ev.action.id);
		if (r.scenes.length === 0) {
			await ev.action.showAlert();
			return;
		}

		const creds = await this.getCreds();
		if (!creds) {
			await ev.action.showAlert();
			return;
		}

		const index = normalizeIndex(ev.payload.settings.currentIndex ?? 0, r.scenes.length);
		const scene = r.scenes[index];

		try {
			const res = await executeScene(creds, scene.sceneId);
			if (res.statusCode === 200 && res.body?.statusCode === 100) {
				// DialActionにはshowOkが無いため、フィードバック表示で実行完了を伝える
				await ev.action.setFeedback({ value: "OK", indicator: { value: 100 } });
				setTimeout(() => {
					const r2 = this.getRuntime(ev.action.id);
					this.renderFeedback(ev.action, r2, index);
				}, 800);
			} else if (isRateLimitError(res)) {
				streamDeck.logger.warn(`SceneBrowserDial: シーン実行がAPIのレート制限により失敗しました: ${JSON.stringify(res.body)}`);
				await ev.action.showAlert();
			} else {
				streamDeck.logger.error(`SceneBrowserDial: シーン実行に失敗しました: ${JSON.stringify(res.body)}`);
				await ev.action.showAlert();
			}
		} catch (err) {
			streamDeck.logger.error(`SceneBrowserDial: シーン実行中にエラー: ${String(err)}`);
			await ev.action.showAlert();
		}
	}

	/** タッチ操作(短押し・長押し問わず)でシーン一覧を再取得する */
	override async onTouchTap(ev: TouchTapEvent<SceneBrowserSettings>): Promise<void> {
		await this.refreshScenes(ev.action, ev.payload.settings, false);
	}
}
