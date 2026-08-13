// 各Property Inspector(control.html / single.html / toggle.html / sensor.html /
// scenebrowser.html / paramdial.html / tapelight.html)で共有する、
// コマンド選択肢・パラメーター定義・デバイス種別ごとの対応コマンド・翻訳機能・ユーティリティ関数。
window.SwitchBotPI = (function () {
	"use strict";

	// ================= 翻訳(i18n) =================
	// Stream DeckのPIはNode.js側(streamDeck.i18n)にアクセスできないため、
	// PI用の文言はこのファイル内に直接ja/enの辞書として保持し、
	// PI.setLanguage() で言語を決定してから PI.t() で参照する。
	var STRINGS = {
		ja: {
			"label.token": "トークン",
			"label.secret": "クライアントシークレット",
			"hint.credentials": "SwitchBotアプリの「プロフィール」→「設定」→バージョン表示を連続タップすると表示される「開発者向けオプション」から取得できます。",

			"label.target": "対象",
			"option.target.device": "デバイス",
			"option.target.scene": "シーン",
			"label.device": "デバイス",
			"label.scene": "シーン",
			"option.unselected": "(未選択)",
			"option.unfetched_suffix": "（未取得）",
			"button.refresh": "更新",
			"button.refreshing": "取得中…",
			"label.command": "コマンド",
			"label.parameter": "パラメーター",
			"label.custom_command_name": "コマンド名",
			"placeholder.custom_command": "例: setMode",
			"label.command_type": "コマンド種別",
			"label.enabled": "有効/無効",
			"group.single": "①シングルプレス",
			"group.double": "②ダブルプレス",
			"group.hold": "③ホールド",

			"sensor.device_hint": "温湿度計(MeterPlus等)や、温度・湿度・バッテリー残量を返す機種を選択してください。",
			"sensor.poll_interval": "自動更新の間隔(秒)",
			"sensor.show_items": "表示する項目",
			"sensor.temperature": "温度",
			"sensor.humidity": "湿度",
			"sensor.battery": "バッテリー残量",
			"sensor.touch_hint": "キーを押すと、その場ですぐに再取得します。",

			"scenebrowser.refresh_interval": "自動更新の間隔(分)",
			"scenebrowser.hint": "ダイヤルを回すと登録済みシーンを1件ずつ切り替えて表示し、押し込むと表示中のシーンを実行します。タッチスクリーンをタップするとシーン一覧をその場で再取得します(SwitchBotアプリでシーンを追加/削除した直後などにご利用ください)。自動更新の間隔は、それ以外のタイミングでバックグラウンドで一覧を最新化する頻度です。",
			"scenebrowser.auto_refresh_enabled": "自動更新を有効にする",
			"scenebrowser.manual_refresh": "シーン一覧を取得",
			"scenebrowser.all_scenes_heading": "登録済みのシーン一覧（{count}件）",
			"scenebrowser.show_all": "全て表示",
			"scenebrowser.visible": "表示",
			"scenebrowser.no_scenes": "シーンがありません。「更新」を押して取得してください。",
			"scenebrowser.move_up": "上へ移動",
			"scenebrowser.move_down": "下へ移動",
			"scenebrowser.font_size": "シーン名の文字サイズ(px)",

			"paramdial.parameter": "パラメーター",
			"paramdial.opt.brightness": "明るさ",
			"paramdial.opt.position": "カーテン位置",
			"paramdial.opt.colortemp": "色温度",
			"paramdial.opt.custom": "カスタム",
			"paramdial.range": "範囲(最小/最大)",
			"paramdial.step": "1回転あたりの刻み幅",
			"paramdial.unit": "単位(表示用・任意)",
			"placeholder.unit": "例: % K",
			"paramdial.hint": "ダイヤルを回すと刻み幅ごとに値を送信します。押し込みで電源のオン/オフを切り替えます。タッチスクリーンをタップすると、「明るさ」「カーテン位置」「色温度」は実機の現在値を取得して同期します。「カスタム」の場合は同期対象が不明なため、現在の設定値を再送します。",
			"paramdial.ac_mode": "モード",
			"paramdial.ac_mode.auto": "自動",
			"paramdial.ac_mode.cool": "冷房",
			"paramdial.ac_mode.dry": "除湿",
			"paramdial.ac_mode.fan": "送風",
			"paramdial.ac_mode.heat": "暖房",
			"paramdial.ac_fan": "風量",
			"paramdial.ac_fan.auto": "自動",
			"paramdial.ac_fan.low": "弱",
			"paramdial.ac_fan.medium": "中",
			"paramdial.ac_fan.high": "強",
			"paramdial.touch_section": "タッチで切り替える操作(最大3つ)",
			"paramdial.touch1": "①",
			"paramdial.touch2": "②",
			"paramdial.touch3": "③",
			"paramdial.touch_hint": "タッチスクリーンを短くタップするたびに、設定した操作1→2→3→1…の順に実行されます(未設定のスロットはスキップ)。エアコン設定(setAll)を実行すると、ダイヤルの温度調整もそのモード/風量/電源を引き継ぎます。長押しすると実機の値を再取得します。",

			"tapelight.parameter_target": "パラメーター",
			"tapelight.device_section": "デバイス設定",
			"tapelight.step_percent": "1回転あたりの変化量(%)",
			"tapelight.poll_interval": "自動同期の間隔(秒)",
			"tapelight.device_hint": "ダイヤルを回すと選択したパラメーターの値、押し込むと電源オン/オフを操作します。自動同期は、スマホアプリなど他経路での操作をキーの表示に反映するための定期取得です。",
			"tapelight.scene_section": "タッチ操作で切り替えるシーン",
			"tapelight.scene1": "シーン1",
			"tapelight.scene2": "シーン2",
			"tapelight.scene3": "シーン3",
			"tapelight.scene_hint": "タッチスクリーンを短くタップすると、シーン1→2→3→1…の順に実行されます(未選択のスロットはスキップ)。長押しすると実機の状態を再取得します。",
			"tapelight.opt.color": "カラー(RGB)",
			"tapelight.color_hint": "ダイヤルを回すとRGB値を15刻みで変化させ、赤→黄→緑→水色→青→マゼンタ→赤と虹色に一周します(全102ステップ)。",

			"cmd.turnOn": "オンにする",
			"cmd.turnOff": "オフにする",
			"cmd.toggle": "トグル（反転）",
			"cmd.press": "押す（Bot用）",
			"cmd.lock": "施錠",
			"cmd.unlock": "解錠",
			"cmd.setPosition": "カーテン位置を指定",
			"cmd.setBrightness": "明るさを指定",
			"cmd.setColor": "カラー(RGB)を指定",
			"cmd.setColorTemperature": "色温度を指定",
			"cmd.setAll": "エアコン詳細設定",
			"cmd.acAdjustTemp": "エアコン温度調整",
			"cmd.adjustBrightness": "明るさを調整",
			"cmd.adjustColorTemp": "色温度を調整",
			"cmd.custom": "カスタムコマンド",

			"param.setPosition.label": "位置 (0=全開 / 100=全閉)",
			"param.setBrightness.label": "明るさ (1〜100)",
			"param.setColor.label": "色 (R:G:B)",
			"param.setColorTemperature.label": "色温度 (2700〜6500)",
			"param.custom.label": "パラメーター",

			"status.credentials_missing_input": "先にトークンとクライアントシークレットを入力してください。",
			"status.devices_updated": "デバイス一覧を更新しました（{count}件）",
			"status.scenes_updated": "シーン一覧を更新しました（{count}件）",
			"error.credentials_missing": "トークン / クライアントシークレットが未設定です。",
			"error.fetch_devices_failed": "デバイス一覧の取得に失敗しました。トークンをご確認ください。",
			"error.fetch_scenes_failed": "シーン一覧の取得に失敗しました。トークンをご確認ください。",
			"error.unexpected": "予期しないエラーが発生しました。",
			"error.generic": "エラーが発生しました。",
			"accontrol.unit_label": "表示単位",
			"accontrol.unit.c": "摂氏(℃)",
			"accontrol.unit.f": "華氏(℉)",
			"accontrol.cool_default": "冷房のデフォルト温度",
			"accontrol.heat_default": "暖房のデフォルト温度",
			"accontrol.modes_heading": "タッチで切り替えるモード",
			"accontrol.mode.cool": "冷房",
			"accontrol.mode.heat": "暖房",
			"accontrol.mode.dry": "除湿",
			"accontrol.mode.fan": "送風",
			"accontrol.hint": "ダイヤルを回すと設定温度を調整します(範囲は摂氏16〜30℃/華氏60〜90℉で固定)。押し込むと電源のオン/オフを切り替えます。タッチスクリーンをタップするたびに、下で有効にしたモードを順番に切り替えます(冷房/暖房に切り替えた際は、それぞれのデフォルト温度が使用されます)。",
			"accontrol.no_mode_hint": "少なくとも1つのモードを有効にしてください。",
			"ac.temp_label": "温度",
			"ac.fan_label": "風量",
			"ac.fan.auto": "自動",
			"ac.fan.low": "弱",
			"ac.fan.medium": "中",
			"ac.fan.high": "強",
			"ac.adjust_label": "調整方向",
			"ac.adjust.up": "上げる",
			"ac.adjust.down": "下げる",
			"ac.detail_hint": "押すと、この設定(モード・温度・風量)で電源をオンにします。",
			"ac.adjust_hint": "押すたびに設定温度が1℃ずつ変わります(同じエアコンを操作する他のキーと共有される、直近の記憶温度が基準になります)。",
			"ac.mode_label": "モード",
			"adjust.value_hint": "押すたびに実機の現在値を取得し、1段階分だけ変更して送信します。",
			"label.show_credentials": "入力内容を表示"
		},
		en: {
			"label.token": "Token",
			"label.secret": "Secret Key",
			"hint.credentials": "Open the SwitchBot app, go to Profile > Settings, tap the app version repeatedly to reveal Developer Options, and copy them from there.",

			"label.target": "Target",
			"option.target.device": "Device",
			"option.target.scene": "Scene",
			"label.device": "Device",
			"label.scene": "Scene",
			"option.unselected": "(none)",
			"option.unfetched_suffix": " (not fetched yet)",
			"button.refresh": "Refresh",
			"button.refreshing": "Refreshing…",
			"label.command": "Command",
			"label.parameter": "Parameter",
			"label.custom_command_name": "Command Name",
			"placeholder.custom_command": "e.g. setMode",
			"label.command_type": "Command Type",
			"label.enabled": "Enabled",
			"group.single": "① Single Press",
			"group.double": "② Double Press",
			"group.hold": "③ Hold",

			"sensor.device_hint": "Select a device that reports temperature, humidity, or battery level (e.g. MeterPlus).",
			"sensor.poll_interval": "Auto-refresh interval (seconds)",
			"sensor.show_items": "Items to display",
			"sensor.temperature": "Temperature",
			"sensor.humidity": "Humidity",
			"sensor.battery": "Battery level",
			"sensor.touch_hint": "Pressing the key refreshes the value immediately.",

			"scenebrowser.refresh_interval": "Auto-refresh interval (minutes)",
			"scenebrowser.hint": "Rotate the dial to step through your saved scenes one at a time; press to run the scene currently shown. Tap the touchscreen to refresh the scene list on the spot (useful right after adding/removing a scene in the SwitchBot app). The refresh interval controls how often the list is refreshed in the background otherwise.",
			"scenebrowser.auto_refresh_enabled": "Enable auto-refresh",
			"scenebrowser.manual_refresh": "Fetch scene list",
			"scenebrowser.all_scenes_heading": "Registered scenes ({count})",
			"scenebrowser.show_all": "Show all",
			"scenebrowser.visible": "Visible",
			"scenebrowser.no_scenes": "No scenes yet. Press \"Refresh\" to fetch them.",
			"scenebrowser.move_up": "Move up",
			"scenebrowser.move_down": "Move down",
			"scenebrowser.font_size": "Scene name font size (px)",

			"paramdial.parameter": "Parameter",
			"paramdial.opt.brightness": "Brightness",
			"paramdial.opt.position": "Curtain position",
			"paramdial.opt.colortemp": "Color temperature",
			"paramdial.opt.custom": "Custom",
			"paramdial.range": "Range (min / max)",
			"paramdial.step": "Step per rotation click",
			"paramdial.unit": "Unit (display only, optional)",
			"placeholder.unit": "e.g. % K",
			"paramdial.hint": "Rotating the dial sends the value in steps. Pressing toggles power on/off. Tapping the touchscreen syncs the current value from the device for Brightness / Curtain position / Color temperature. For Custom, the sync target is unknown, so the current setting is resent instead.",
			"paramdial.ac_mode": "Mode",
			"paramdial.ac_mode.auto": "Auto",
			"paramdial.ac_mode.cool": "Cool",
			"paramdial.ac_mode.dry": "Dry",
			"paramdial.ac_mode.fan": "Fan",
			"paramdial.ac_mode.heat": "Heat",
			"paramdial.ac_fan": "Fan speed",
			"paramdial.ac_fan.auto": "Auto",
			"paramdial.ac_fan.low": "Low",
			"paramdial.ac_fan.medium": "Medium",
			"paramdial.ac_fan.high": "High",
			"paramdial.touch_section": "Touch Actions (up to 3)",
			"paramdial.touch1": "①",
			"paramdial.touch2": "②",
			"paramdial.touch3": "③",
			"paramdial.touch_hint": "Each short tap on the touchscreen runs Action 1 → 2 → 3 → 1... in order (empty slots are skipped). Running an Air Conditioner (setAll) action also updates the dial's temperature control to use that mode/fan/power. A long press resyncs the current value from the device.",

			"tapelight.parameter_target": "Parameter",
			"tapelight.device_section": "Device Settings",
			"tapelight.step_percent": "Change per rotation click (%)",
			"tapelight.poll_interval": "Auto-sync interval (seconds)",
			"tapelight.device_hint": "Rotate the dial to adjust the selected parameter, press to toggle power. Auto-sync periodically refreshes the key so it reflects changes made another way (e.g. the SwitchBot app).",
			"tapelight.scene_section": "Scenes Cycled by Touch",
			"tapelight.scene1": "Scene 1",
			"tapelight.scene2": "Scene 2",
			"tapelight.scene3": "Scene 3",
			"tapelight.scene_hint": "A short tap on the touchscreen runs Scene 1 → 2 → 3 → 1... in order (empty slots are skipped). A long press resyncs the current device state.",
			"tapelight.opt.color": "Color (RGB)",
			"tapelight.color_hint": "Rotate the dial to shift the RGB values in steps of 15, cycling through the rainbow (red → yellow → green → cyan → blue → magenta → red, 102 steps total).",

			"cmd.turnOn": "Turn on",
			"cmd.turnOff": "Turn off",
			"cmd.toggle": "Toggle",
			"cmd.press": "Press (for Bot)",
			"cmd.lock": "Lock",
			"cmd.unlock": "Unlock",
			"cmd.setPosition": "Set curtain position",
			"cmd.setBrightness": "Set brightness",
			"cmd.setColor": "Color (RGB)",
			"cmd.setColorTemperature": "Set color temperature",
			"cmd.setAll": "A/C Detailed Settings",
			"cmd.acAdjustTemp": "A/C Temperature Adjust",
			"cmd.adjustBrightness": "Adjust Brightness",
			"cmd.adjustColorTemp": "Adjust Color Temperature",
			"cmd.custom": "Custom command",

			"param.setPosition.label": "Position (0=open / 100=closed)",
			"param.setBrightness.label": "Brightness (1-100)",
			"param.setColor.label": "Color (R:G:B)",
			"param.setColorTemperature.label": "Color temperature (2700-6500)",
			"param.custom.label": "Parameter",

			"status.credentials_missing_input": "Please enter the token and secret key first.",
			"status.devices_updated": "Device list updated ({count} found)",
			"status.scenes_updated": "Scene list updated ({count} found)",
			"error.credentials_missing": "The token / secret key is not set.",
			"error.fetch_devices_failed": "Failed to fetch the device list. Please check your token.",
			"error.fetch_scenes_failed": "Failed to fetch the scene list. Please check your token.",
			"error.unexpected": "An unexpected error occurred.",
			"error.generic": "An error occurred.",
			"accontrol.unit_label": "Display unit",
			"accontrol.unit.c": "Celsius (°C)",
			"accontrol.unit.f": "Fahrenheit (°F)",
			"accontrol.cool_default": "Default cooling temperature",
			"accontrol.heat_default": "Default heating temperature",
			"accontrol.modes_heading": "Modes cycled by touch",
			"accontrol.mode.cool": "Cool",
			"accontrol.mode.heat": "Heat",
			"accontrol.mode.dry": "Dry",
			"accontrol.mode.fan": "Fan",
			"accontrol.hint": "Rotate the dial to adjust the target temperature (fixed range: 16-30°C / 60-90°F). Press to toggle power. Each tap of the touchscreen cycles to the next enabled mode below (switching to Cool/Heat applies that mode's default temperature).",
			"accontrol.no_mode_hint": "Please enable at least one mode.",
			"ac.temp_label": "Temperature",
			"ac.fan_label": "Fan speed",
			"ac.fan.auto": "Auto",
			"ac.fan.low": "Low",
			"ac.fan.medium": "Medium",
			"ac.fan.high": "High",
			"ac.adjust_label": "Direction",
			"ac.adjust.up": "Increase",
			"ac.adjust.down": "Decrease",
			"ac.detail_hint": "Pressing turns the power on with this mode, temperature, and fan speed.",
			"ac.adjust_hint": "Each press changes the target temperature by 1°C, based on the most recently remembered temperature shared with other keys controlling the same air conditioner.",
			"ac.mode_label": "Mode",
			"adjust.value_hint": "Each press reads the device's current value and sends it changed by one step.",
			"label.show_credentials": "Show entered values"
		},
		de: {
			"label.token": "Token",
			"label.secret": "Client Secret",
			"hint.credentials": "Öffne die SwitchBot-App, gehe zu Profil > Einstellungen, tippe wiederholt auf die App-Version, um die Entwickleroptionen anzuzeigen, und kopiere sie von dort.",
			"label.target": "Ziel",
			"option.target.device": "Gerät",
			"option.target.scene": "Szene",
			"label.device": "Gerät",
			"label.scene": "Szene",
			"option.unselected": "(keine)",
			"option.unfetched_suffix": " (noch nicht abgerufen)",
			"button.refresh": "Aktualisieren",
			"button.refreshing": "Wird aktualisiert…",
			"label.command": "Befehl",
			"label.parameter": "Parameter",
			"label.custom_command_name": "Befehlsname",
			"placeholder.custom_command": "z. B. setMode",
			"label.command_type": "Befehlstyp",
			"label.enabled": "Aktiviert",
			"group.single": "① Einfacher Druck",
			"group.double": "② Doppelter Druck",
			"group.hold": "③ Halten",
			"sensor.device_hint": "Wähle ein Gerät, das Temperatur, Luftfeuchtigkeit oder Akkustand meldet (z. B. MeterPlus).",
			"sensor.poll_interval": "Aktualisierungsintervall (Sekunden)",
			"sensor.show_items": "Anzuzeigende Werte",
			"sensor.temperature": "Temperatur",
			"sensor.humidity": "Luftfeuchtigkeit",
			"sensor.battery": "Akkustand",
			"sensor.touch_hint": "Ein Tastendruck aktualisiert den Wert sofort.",
			"scenebrowser.refresh_interval": "Aktualisierungsintervall (Minuten)",
			"scenebrowser.hint": "Drehe den Regler, um deine gespeicherten Szenen einzeln durchzugehen; drücken führt die aktuell angezeigte Szene aus. Tippe auf das Touchdisplay, um die Szenenliste sofort zu aktualisieren (nützlich direkt nach dem Hinzufügen/Entfernen einer Szene in der SwitchBot-App). Das Aktualisierungsintervall bestimmt, wie oft die Liste ansonsten im Hintergrund aktualisiert wird.",
			"scenebrowser.auto_refresh_enabled": "Automatische Aktualisierung aktivieren",
			"scenebrowser.manual_refresh": "Szenenliste abrufen",
			"scenebrowser.all_scenes_heading": "Registrierte Szenen ({count})",
			"scenebrowser.show_all": "Alle anzeigen",
			"scenebrowser.visible": "Sichtbar",
			"scenebrowser.no_scenes": "Noch keine Szenen. Klicke auf „Aktualisieren“, um sie abzurufen.",
			"scenebrowser.move_up": "Nach oben",
			"scenebrowser.move_down": "Nach unten",
			"scenebrowser.font_size": "Schriftgröße des Szenennamens (px)",
			"paramdial.parameter": "Parameter",
			"paramdial.opt.brightness": "Helligkeit",
			"paramdial.opt.position": "Vorhangposition",
			"paramdial.opt.colortemp": "Farbtemperatur",
			"paramdial.opt.custom": "Benutzerdefiniert",
			"paramdial.range": "Bereich (Min / Max)",
			"paramdial.step": "Schrittweite pro Rastung",
			"paramdial.unit": "Einheit (nur Anzeige, optional)",
			"placeholder.unit": "z. B. % K",
			"paramdial.hint": "Das Drehen des Reglers sendet den Wert schrittweise. Drücken schaltet die Stromversorgung ein/aus. Tippen auf das Touchdisplay synchronisiert den aktuellen Wert vom Gerät bei Helligkeit / Vorhangposition / Farbtemperatur. Bei „Benutzerdefiniert“ ist das Sync-Ziel unbekannt, daher wird stattdessen die aktuelle Einstellung erneut gesendet.",
			"paramdial.ac_mode": "Modus",
			"paramdial.ac_mode.auto": "Automatik",
			"paramdial.ac_mode.cool": "Kühlen",
			"paramdial.ac_mode.dry": "Entfeuchten",
			"paramdial.ac_mode.fan": "Lüften",
			"paramdial.ac_mode.heat": "Heizen",
			"paramdial.ac_fan": "Lüftergeschwindigkeit",
			"paramdial.ac_fan.auto": "Automatik",
			"paramdial.ac_fan.low": "Niedrig",
			"paramdial.ac_fan.medium": "Mittel",
			"paramdial.ac_fan.high": "Hoch",
			"paramdial.touch_section": "Touch-Aktionen (bis zu 3)",
			"paramdial.touch1": "①",
			"paramdial.touch2": "②",
			"paramdial.touch3": "③",
			"paramdial.touch_hint": "Jedes kurze Tippen auf das Touchdisplay führt Aktion 1 → 2 → 3 → 1... der Reihe nach aus (leere Plätze werden übersprungen). Das Ausführen einer Klimaanlagen-Aktion (setAll) aktualisiert auch die Temperaturregelung des Reglers mit diesem Modus/Lüfter/Strom. Ein langer Druck synchronisiert den aktuellen Wert vom Gerät.",
			"tapelight.parameter_target": "Parameter",
			"tapelight.device_section": "Geräteeinstellungen",
			"tapelight.step_percent": "Änderung pro Rastung (%)",
			"tapelight.poll_interval": "Sync-Intervall (Sekunden)",
			"tapelight.device_hint": "Drehe den Regler, um den ausgewählten Parameter anzupassen, drücke, um die Stromversorgung umzuschalten. Die automatische Synchronisierung aktualisiert die Taste regelmäßig, damit sie Änderungen widerspiegelt, die auf andere Weise vorgenommen wurden (z. B. über die SwitchBot-App).",
			"tapelight.scene_section": "Per Touch durchgeschaltete Szenen",
			"tapelight.scene1": "Szene 1",
			"tapelight.scene2": "Szene 2",
			"tapelight.scene3": "Szene 3",
			"tapelight.scene_hint": "Ein kurzes Tippen auf das Touchdisplay führt Szene 1 → 2 → 3 → 1 … der Reihe nach aus (leere Plätze werden übersprungen). Ein langes Drücken synchronisiert den aktuellen Gerätestatus.",
			"tapelight.opt.color": "Farbe (RGB)",
			"tapelight.color_hint": "Drehe den Regler, um die RGB-Werte in 15er-Schritten zu verändern und den Regenbogen zu durchlaufen (rot → gelb → grün → cyan → blau → magenta → rot, insgesamt 102 Schritte).",
			"cmd.turnOn": "Einschalten",
			"cmd.turnOff": "Ausschalten",
			"cmd.toggle": "Umschalten",
			"cmd.press": "Drücken (für Bot)",
			"cmd.lock": "Verriegeln",
			"cmd.unlock": "Entriegeln",
			"cmd.setPosition": "Vorhangposition festlegen",
			"cmd.setBrightness": "Helligkeit festlegen",
			"cmd.setColor": "Farbe (RGB) festlegen",
			"cmd.setColorTemperature": "Farbtemperatur festlegen",
			"cmd.setAll": "Klimaanlage – Detaileinstellungen",
			"cmd.acAdjustTemp": "Klimaanlage – Temperatur anpassen",
			"cmd.adjustBrightness": "Helligkeit anpassen",
			"cmd.adjustColorTemp": "Farbtemperatur anpassen",
			"cmd.custom": "Benutzerdefinierter Befehl",
			"param.setPosition.label": "Position (0=offen / 100=geschlossen)",
			"param.setBrightness.label": "Helligkeit (1-100)",
			"param.setColor.label": "Farbe (R:G:B)",
			"param.setColorTemperature.label": "Farbtemperatur (2700-6500)",
			"param.custom.label": "Parameter",
			"status.credentials_missing_input": "Bitte zuerst Token und Client Secret eingeben.",
			"status.devices_updated": "Geräteliste aktualisiert ({count} gefunden)",
			"status.scenes_updated": "Szenenliste aktualisiert ({count} gefunden)",
			"error.credentials_missing": "Token / Client Secret ist nicht festgelegt.",
			"error.fetch_devices_failed": "Geräteliste konnte nicht abgerufen werden. Bitte Token prüfen.",
			"error.fetch_scenes_failed": "Szenenliste konnte nicht abgerufen werden. Bitte Token prüfen.",
			"error.unexpected": "Ein unerwarteter Fehler ist aufgetreten.",
			"error.generic": "Ein Fehler ist aufgetreten.",
			"accontrol.unit_label": "Anzeigeeinheit",
			"accontrol.unit.c": "Celsius (°C)",
			"accontrol.unit.f": "Fahrenheit (°F)",
			"accontrol.cool_default": "Standardtemperatur Kühlen",
			"accontrol.heat_default": "Standardtemperatur Heizen",
			"accontrol.modes_heading": "Per Touch durchgeschaltete Modi",
			"accontrol.mode.cool": "Kühlen",
			"accontrol.mode.heat": "Heizen",
			"accontrol.mode.dry": "Entfeuchten",
			"accontrol.mode.fan": "Lüfter",
			"accontrol.hint": "Drehe den Regler, um die Zieltemperatur anzupassen (fester Bereich: 16-30°C / 60-90°F). Drücken schaltet die Stromversorgung um. Jedes Tippen auf das Touchdisplay wechselt zum nächsten unten aktivierten Modus (beim Wechsel zu Kühlen/Heizen wird die jeweilige Standardtemperatur verwendet).",
			"accontrol.no_mode_hint": "Bitte aktiviere mindestens einen Modus.",
			"ac.temp_label": "Temperatur",
			"ac.fan_label": "Lüftergeschwindigkeit",
			"ac.fan.auto": "Automatisch",
			"ac.fan.low": "Niedrig",
			"ac.fan.medium": "Mittel",
			"ac.fan.high": "Hoch",
			"ac.adjust_label": "Richtung",
			"ac.adjust.up": "Erhöhen",
			"ac.adjust.down": "Verringern",
			"ac.detail_hint": "Drücken schaltet die Stromversorgung mit diesem Modus, dieser Temperatur und Lüftergeschwindigkeit ein.",
			"ac.adjust_hint": "Jeder Druck ändert die Zieltemperatur um 1°C, basierend auf der zuletzt gespeicherten Temperatur, die mit anderen Tasten für dieselbe Klimaanlage geteilt wird.",
			"ac.mode_label": "Modus",
			"adjust.value_hint": "Jeder Druck liest den aktuellen Wert des Geräts aus und sendet ihn um eine Stufe geändert.",
			"label.show_credentials": "Eingaben anzeigen"
		},
		fr: {
			"label.token": "Jeton",
			"label.secret": "Secret client",
			"hint.credentials": "Ouvrez l'application SwitchBot, allez dans Profil > Paramètres, appuyez plusieurs fois sur la version de l'application pour afficher les options développeur, puis copiez-les depuis là.",
			"label.target": "Cible",
			"option.target.device": "Appareil",
			"option.target.scene": "Scène",
			"label.device": "Appareil",
			"label.scene": "Scène",
			"option.unselected": "(aucun)",
			"option.unfetched_suffix": " (pas encore récupéré)",
			"button.refresh": "Actualiser",
			"button.refreshing": "Actualisation…",
			"label.command": "Commande",
			"label.parameter": "Paramètre",
			"label.custom_command_name": "Nom de la commande",
			"placeholder.custom_command": "ex. setMode",
			"label.command_type": "Type de commande",
			"label.enabled": "Activé",
			"group.single": "① Pression simple",
			"group.double": "② Pression double",
			"group.hold": "③ Appui long",
			"sensor.device_hint": "Sélectionnez un appareil qui indique la température, l'humidité ou le niveau de batterie (ex. MeterPlus).",
			"sensor.poll_interval": "Intervalle d'actualisation (secondes)",
			"sensor.show_items": "Éléments à afficher",
			"sensor.temperature": "Température",
			"sensor.humidity": "Humidité",
			"sensor.battery": "Niveau de batterie",
			"sensor.touch_hint": "Appuyer sur la touche actualise la valeur immédiatement.",
			"scenebrowser.refresh_interval": "Intervalle d'actualisation (minutes)",
			"scenebrowser.hint": "Tournez la molette pour parcourir vos scènes enregistrées une par une ; appuyez pour exécuter la scène actuellement affichée. Touchez l'écran tactile pour actualiser la liste des scènes sur-le-champ (utile juste après l'ajout/la suppression d'une scène dans l'application SwitchBot). L'intervalle d'actualisation détermine la fréquence de mise à jour de la liste en arrière-plan sinon.",
			"scenebrowser.auto_refresh_enabled": "Activer l'actualisation automatique",
			"scenebrowser.manual_refresh": "Récupérer la liste des scènes",
			"scenebrowser.all_scenes_heading": "Scènes enregistrées ({count})",
			"scenebrowser.show_all": "Tout afficher",
			"scenebrowser.visible": "Visible",
			"scenebrowser.no_scenes": "Aucune scène pour le moment. Appuyez sur « Actualiser » pour les récupérer.",
			"scenebrowser.move_up": "Monter",
			"scenebrowser.move_down": "Descendre",
			"scenebrowser.font_size": "Taille de police du nom de scène (px)",
			"paramdial.parameter": "Paramètre",
			"paramdial.opt.brightness": "Luminosité",
			"paramdial.opt.position": "Position du rideau",
			"paramdial.opt.colortemp": "Température de couleur",
			"paramdial.opt.custom": "Personnalisé",
			"paramdial.range": "Plage (min / max)",
			"paramdial.step": "Pas par clic de rotation",
			"paramdial.unit": "Unité (affichage uniquement, optionnel)",
			"placeholder.unit": "ex. % K",
			"paramdial.hint": "Tourner la molette envoie la valeur par paliers. Appuyer bascule l'alimentation. Toucher l'écran tactile synchronise la valeur actuelle depuis l'appareil pour Luminosité / Position du rideau / Température de couleur. Pour Personnalisé, la cible de synchronisation est inconnue, le réglage actuel est donc renvoyé à la place.",
			"paramdial.ac_mode": "Mode",
			"paramdial.ac_mode.auto": "Automatique",
			"paramdial.ac_mode.cool": "Froid",
			"paramdial.ac_mode.dry": "Déshumidification",
			"paramdial.ac_mode.fan": "Ventilation",
			"paramdial.ac_mode.heat": "Chaud",
			"paramdial.ac_fan": "Vitesse du ventilateur",
			"paramdial.ac_fan.auto": "Automatique",
			"paramdial.ac_fan.low": "Faible",
			"paramdial.ac_fan.medium": "Moyenne",
			"paramdial.ac_fan.high": "Élevée",
			"paramdial.touch_section": "Actions tactiles (jusqu'à 3)",
			"paramdial.touch1": "①",
			"paramdial.touch2": "②",
			"paramdial.touch3": "③",
			"paramdial.touch_hint": "Chaque appui bref sur l'écran tactile exécute Action 1 → 2 → 3 → 1... dans l'ordre (les emplacements vides sont ignorés). Exécuter une action Climatiseur (setAll) met aussi à jour le réglage de température de la molette avec ce mode/ventilateur/alimentation. Un appui long resynchronise la valeur actuelle depuis l'appareil.",
			"tapelight.parameter_target": "Paramètre",
			"tapelight.device_section": "Paramètres de l'appareil",
			"tapelight.step_percent": "Variation par clic de rotation (%)",
			"tapelight.poll_interval": "Intervalle de synchronisation (secondes)",
			"tapelight.device_hint": "Tournez la molette pour ajuster le paramètre sélectionné, appuyez pour basculer l'alimentation. La synchronisation automatique actualise périodiquement la touche afin qu'elle reflète les changements effectués autrement (ex. l'application SwitchBot).",
			"tapelight.scene_section": "Scènes parcourues par toucher",
			"tapelight.scene1": "Scène 1",
			"tapelight.scene2": "Scène 2",
			"tapelight.scene3": "Scène 3",
			"tapelight.scene_hint": "Un appui bref sur l'écran tactile exécute Scène 1 → 2 → 3 → 1... dans l'ordre (les emplacements vides sont ignorés). Un appui long resynchronise l'état actuel de l'appareil.",
			"tapelight.opt.color": "Couleur (RVB)",
			"tapelight.color_hint": "Tournez la molette pour faire varier les valeurs RVB par pas de 15 et parcourir l'arc-en-ciel (rouge → jaune → vert → cyan → bleu → magenta → rouge, 102 pas au total).",
			"cmd.turnOn": "Allumer",
			"cmd.turnOff": "Éteindre",
			"cmd.toggle": "Basculer",
			"cmd.press": "Appuyer (pour Bot)",
			"cmd.lock": "Verrouiller",
			"cmd.unlock": "Déverrouiller",
			"cmd.setPosition": "Définir la position du rideau",
			"cmd.setBrightness": "Définir la luminosité",
			"cmd.setColor": "Couleur (RVB)",
			"cmd.setColorTemperature": "Définir la température de couleur",
			"cmd.setAll": "Climatisation – réglages détaillés",
			"cmd.acAdjustTemp": "Climatisation – ajuster la température",
			"cmd.adjustBrightness": "Ajuster la luminosité",
			"cmd.adjustColorTemp": "Ajuster la température de couleur",
			"cmd.custom": "Commande personnalisée",
			"param.setPosition.label": "Position (0=ouvert / 100=fermé)",
			"param.setBrightness.label": "Luminosité (1-100)",
			"param.setColor.label": "Couleur (R:V:B)",
			"param.setColorTemperature.label": "Température de couleur (2700-6500)",
			"param.custom.label": "Paramètre",
			"status.credentials_missing_input": "Veuillez d'abord saisir le jeton et le secret client.",
			"status.devices_updated": "Liste des appareils mise à jour ({count} trouvés)",
			"status.scenes_updated": "Liste des scènes mise à jour ({count} trouvées)",
			"error.credentials_missing": "Le jeton / secret client n'est pas défini.",
			"error.fetch_devices_failed": "Échec de la récupération de la liste des appareils. Veuillez vérifier votre jeton.",
			"error.fetch_scenes_failed": "Échec de la récupération de la liste des scènes. Veuillez vérifier votre jeton.",
			"error.unexpected": "Une erreur inattendue s'est produite.",
			"error.generic": "Une erreur s'est produite.",
			"accontrol.unit_label": "Unité d'affichage",
			"accontrol.unit.c": "Celsius (°C)",
			"accontrol.unit.f": "Fahrenheit (°F)",
			"accontrol.cool_default": "Température par défaut (froid)",
			"accontrol.heat_default": "Température par défaut (chaud)",
			"accontrol.modes_heading": "Modes parcourus par toucher",
			"accontrol.mode.cool": "Froid",
			"accontrol.mode.heat": "Chaud",
			"accontrol.mode.dry": "Déshumidification",
			"accontrol.mode.fan": "Ventilation",
			"accontrol.hint": "Tournez la molette pour ajuster la température cible (plage fixe : 16-30°C / 60-90°F). Appuyez pour basculer l'alimentation. Chaque toucher de l'écran tactile passe au mode activé suivant ci-dessous (passer en mode Froid/Chaud applique la température par défaut de ce mode).",
			"accontrol.no_mode_hint": "Veuillez activer au moins un mode.",
			"ac.temp_label": "Température",
			"ac.fan_label": "Vitesse du ventilateur",
			"ac.fan.auto": "Automatique",
			"ac.fan.low": "Faible",
			"ac.fan.medium": "Moyenne",
			"ac.fan.high": "Élevée",
			"ac.adjust_label": "Direction",
			"ac.adjust.up": "Augmenter",
			"ac.adjust.down": "Diminuer",
			"ac.detail_hint": "Appuyer allume l'appareil avec ce mode, cette température et cette vitesse de ventilateur.",
			"ac.adjust_hint": "Chaque pression modifie la température cible de 1°C, en se basant sur la dernière température mémorisée, partagée avec les autres touches contrôlant le même climatiseur.",
			"ac.mode_label": "Mode",
			"adjust.value_hint": "Chaque pression lit la valeur actuelle de l'appareil et l'envoie modifiée d'un cran.",
			"label.show_credentials": "Afficher les valeurs saisies"
		},
		es: {
			"label.token": "Token",
			"label.secret": "Secreto de cliente",
			"hint.credentials": "Abre la app de SwitchBot, ve a Perfil > Configuración, toca repetidamente la versión de la app para revelar las opciones de desarrollador y cópialos desde ahí.",
			"label.target": "Objetivo",
			"option.target.device": "Dispositivo",
			"option.target.scene": "Escena",
			"label.device": "Dispositivo",
			"label.scene": "Escena",
			"option.unselected": "(ninguno)",
			"option.unfetched_suffix": " (aún no obtenido)",
			"button.refresh": "Actualizar",
			"button.refreshing": "Actualizando…",
			"label.command": "Comando",
			"label.parameter": "Parámetro",
			"label.custom_command_name": "Nombre del comando",
			"placeholder.custom_command": "ej. setMode",
			"label.command_type": "Tipo de comando",
			"label.enabled": "Activado",
			"group.single": "① Pulsación simple",
			"group.double": "② Pulsación doble",
			"group.hold": "③ Mantener pulsado",
			"sensor.device_hint": "Selecciona un dispositivo que informe temperatura, humedad o nivel de batería (p. ej. MeterPlus).",
			"sensor.poll_interval": "Intervalo de actualización (segundos)",
			"sensor.show_items": "Elementos a mostrar",
			"sensor.temperature": "Temperatura",
			"sensor.humidity": "Humedad",
			"sensor.battery": "Nivel de batería",
			"sensor.touch_hint": "Pulsar la tecla actualiza el valor de inmediato.",
			"scenebrowser.refresh_interval": "Intervalo de actualización (minutos)",
			"scenebrowser.hint": "Gira el dial para recorrer tus escenas guardadas una a una; pulsa para ejecutar la escena mostrada actualmente. Toca la pantalla táctil para actualizar la lista de escenas al instante (útil justo después de añadir/eliminar una escena en la app de SwitchBot). El intervalo de actualización controla la frecuencia con la que se actualiza la lista en segundo plano en otros casos.",
			"scenebrowser.auto_refresh_enabled": "Activar actualización automática",
			"scenebrowser.manual_refresh": "Obtener lista de escenas",
			"scenebrowser.all_scenes_heading": "Escenas registradas ({count})",
			"scenebrowser.show_all": "Mostrar todas",
			"scenebrowser.visible": "Visible",
			"scenebrowser.no_scenes": "Aún no hay escenas. Pulsa «Actualizar» para obtenerlas.",
			"scenebrowser.move_up": "Subir",
			"scenebrowser.move_down": "Bajar",
			"scenebrowser.font_size": "Tamaño de fuente del nombre de escena (px)",
			"paramdial.parameter": "Parámetro",
			"paramdial.opt.brightness": "Brillo",
			"paramdial.opt.position": "Posición de la cortina",
			"paramdial.opt.colortemp": "Temperatura de color",
			"paramdial.opt.custom": "Personalizado",
			"paramdial.range": "Rango (mín / máx)",
			"paramdial.step": "Paso por clic de giro",
			"paramdial.unit": "Unidad (solo visual, opcional)",
			"placeholder.unit": "ej. % K",
			"paramdial.hint": "Girar el dial envía el valor en pasos. Pulsar alterna el encendido/apagado. Tocar la pantalla táctil sincroniza el valor actual del dispositivo para Brillo / Posición de la cortina / Temperatura de color. Para Personalizado, se desconoce el destino de sincronización, por lo que se reenvía el ajuste actual.",
			"paramdial.ac_mode": "Modo",
			"paramdial.ac_mode.auto": "Automático",
			"paramdial.ac_mode.cool": "Frío",
			"paramdial.ac_mode.dry": "Deshumidificar",
			"paramdial.ac_mode.fan": "Ventilador",
			"paramdial.ac_mode.heat": "Calor",
			"paramdial.ac_fan": "Velocidad del ventilador",
			"paramdial.ac_fan.auto": "Automática",
			"paramdial.ac_fan.low": "Baja",
			"paramdial.ac_fan.medium": "Media",
			"paramdial.ac_fan.high": "Alta",
			"paramdial.touch_section": "Acciones táctiles (hasta 3)",
			"paramdial.touch1": "①",
			"paramdial.touch2": "②",
			"paramdial.touch3": "③",
			"paramdial.touch_hint": "Cada toque breve en la pantalla táctil ejecuta la Acción 1 → 2 → 3 → 1... en orden (las ranuras vacías se omiten). Ejecutar una acción de Aire acondicionado (setAll) también actualiza el control de temperatura del dial con ese modo/ventilador/encendido. Una pulsación larga resincroniza el valor actual desde el dispositivo.",
			"tapelight.parameter_target": "Parámetro",
			"tapelight.device_section": "Ajustes del dispositivo",
			"tapelight.step_percent": "Cambio por clic de giro (%)",
			"tapelight.poll_interval": "Intervalo de sincronización (segundos)",
			"tapelight.device_hint": "Gira el dial para ajustar el parámetro seleccionado, pulsa para alternar el encendido. La sincronización automática actualiza periódicamente la tecla para reflejar cambios realizados de otra forma (p. ej. la app de SwitchBot).",
			"tapelight.scene_section": "Escenas alternadas por toque",
			"tapelight.scene1": "Escena 1",
			"tapelight.scene2": "Escena 2",
			"tapelight.scene3": "Escena 3",
			"tapelight.scene_hint": "Un toque breve en la pantalla táctil ejecuta Escena 1 → 2 → 3 → 1... en orden (las ranuras vacías se omiten). Una pulsación larga resincroniza el estado actual del dispositivo.",
			"tapelight.opt.color": "Color (RGB)",
			"tapelight.color_hint": "Gira el dial para cambiar los valores RGB en pasos de 15, recorriendo el arcoíris (rojo → amarillo → verde → cian → azul → magenta → rojo, 102 pasos en total).",
			"cmd.turnOn": "Encender",
			"cmd.turnOff": "Apagar",
			"cmd.toggle": "Alternar",
			"cmd.press": "Pulsar (para Bot)",
			"cmd.lock": "Bloquear",
			"cmd.unlock": "Desbloquear",
			"cmd.setPosition": "Definir posición de la cortina",
			"cmd.setBrightness": "Definir brillo",
			"cmd.setColor": "Color (RGB)",
			"cmd.setColorTemperature": "Definir temperatura de color",
			"cmd.setAll": "Aire acondicionado – ajustes detallados",
			"cmd.acAdjustTemp": "Aire acondicionado – ajustar temperatura",
			"cmd.adjustBrightness": "Ajustar brillo",
			"cmd.adjustColorTemp": "Ajustar temperatura de color",
			"cmd.custom": "Comando personalizado",
			"param.setPosition.label": "Posición (0=abierta / 100=cerrada)",
			"param.setBrightness.label": "Brillo (1-100)",
			"param.setColor.label": "Color (R:G:B)",
			"param.setColorTemperature.label": "Temperatura de color (2700-6500)",
			"param.custom.label": "Parámetro",
			"status.credentials_missing_input": "Introduce primero el token y el secreto de cliente.",
			"status.devices_updated": "Lista de dispositivos actualizada ({count} encontrados)",
			"status.scenes_updated": "Lista de escenas actualizada ({count} encontradas)",
			"error.credentials_missing": "El token / secreto de cliente no está configurado.",
			"error.fetch_devices_failed": "No se pudo obtener la lista de dispositivos. Comprueba tu token.",
			"error.fetch_scenes_failed": "No se pudo obtener la lista de escenas. Comprueba tu token.",
			"error.unexpected": "Se produjo un error inesperado.",
			"error.generic": "Se produjo un error.",
			"accontrol.unit_label": "Unidad de visualización",
			"accontrol.unit.c": "Celsius (°C)",
			"accontrol.unit.f": "Fahrenheit (°F)",
			"accontrol.cool_default": "Temperatura predeterminada de frío",
			"accontrol.heat_default": "Temperatura predeterminada de calor",
			"accontrol.modes_heading": "Modos alternados por toque",
			"accontrol.mode.cool": "Frío",
			"accontrol.mode.heat": "Calor",
			"accontrol.mode.dry": "Deshumidificar",
			"accontrol.mode.fan": "Ventilador",
			"accontrol.hint": "Gira el dial para ajustar la temperatura objetivo (rango fijo: 16-30°C / 60-90°F). Pulsa para alternar el encendido. Cada toque en la pantalla táctil pasa al siguiente modo habilitado a continuación (cambiar a Frío/Calor aplica la temperatura predeterminada de ese modo).",
			"accontrol.no_mode_hint": "Activa al menos un modo.",
			"ac.temp_label": "Temperatura",
			"ac.fan_label": "Velocidad del ventilador",
			"ac.fan.auto": "Automático",
			"ac.fan.low": "Baja",
			"ac.fan.medium": "Media",
			"ac.fan.high": "Alta",
			"ac.adjust_label": "Dirección",
			"ac.adjust.up": "Subir",
			"ac.adjust.down": "Bajar",
			"ac.detail_hint": "Al pulsar se enciende con este modo, temperatura y velocidad de ventilador.",
			"ac.adjust_hint": "Cada pulsación cambia la temperatura objetivo en 1°C, según la última temperatura recordada, compartida con otras teclas que controlan el mismo aire acondicionado.",
			"ac.mode_label": "Modo",
			"adjust.value_hint": "Cada pulsación lee el valor actual del dispositivo y lo envía modificado en un paso.",
			"label.show_credentials": "Mostrar valores introducidos"
		},
		ko: {
			"label.token": "토큰",
			"label.secret": "클라이언트 시크릿",
			"hint.credentials": "SwitchBot 앱에서 프로필 > 설정으로 이동해 앱 버전을 반복해서 탭하면 개발자 옵션이 표시되며, 거기서 복사할 수 있습니다.",
			"label.target": "대상",
			"option.target.device": "기기",
			"option.target.scene": "씬",
			"label.device": "기기",
			"label.scene": "씬",
			"option.unselected": "(없음)",
			"option.unfetched_suffix": " (아직 가져오지 않음)",
			"button.refresh": "새로고침",
			"button.refreshing": "가져오는 중…",
			"label.command": "명령",
			"label.parameter": "파라미터",
			"label.custom_command_name": "명령 이름",
			"placeholder.custom_command": "예: setMode",
			"label.command_type": "명령 유형",
			"label.enabled": "사용",
			"group.single": "① 싱글 프레스",
			"group.double": "② 더블 프레스",
			"group.hold": "③ 길게 누르기",
			"sensor.device_hint": "온도, 습도 또는 배터리 잔량을 알려주는 기기를 선택하세요(예: MeterPlus).",
			"sensor.poll_interval": "자동 새로고침 간격(초)",
			"sensor.show_items": "표시할 항목",
			"sensor.temperature": "온도",
			"sensor.humidity": "습도",
			"sensor.battery": "배터리 잔량",
			"sensor.touch_hint": "키를 누르면 즉시 값을 새로고침합니다.",
			"scenebrowser.refresh_interval": "자동 새로고침 간격(분)",
			"scenebrowser.hint": "다이얼을 돌려 저장된 씬을 하나씩 탐색하고, 누르면 현재 표시된 씬을 실행합니다. 터치스크린을 탭하면 씬 목록을 즉시 새로고침합니다(SwitchBot 앱에서 씬을 추가/삭제한 직후 유용합니다). 자동 새로고침 간격은 그 외의 경우 백그라운드에서 목록을 갱신하는 빈도를 결정합니다.",
			"scenebrowser.auto_refresh_enabled": "자동 새로고침 사용",
			"scenebrowser.manual_refresh": "씬 목록 가져오기",
			"scenebrowser.all_scenes_heading": "등록된 씬 목록 ({count}개)",
			"scenebrowser.show_all": "모두 표시",
			"scenebrowser.visible": "표시",
			"scenebrowser.no_scenes": "아직 씬이 없습니다. \"새로고침\"을 눌러 가져오세요.",
			"scenebrowser.move_up": "위로 이동",
			"scenebrowser.move_down": "아래로 이동",
			"scenebrowser.font_size": "씬 이름 글꼴 크기(px)",
			"paramdial.parameter": "파라미터",
			"paramdial.opt.brightness": "밝기",
			"paramdial.opt.position": "커튼 위치",
			"paramdial.opt.colortemp": "색온도",
			"paramdial.opt.custom": "커스텀",
			"paramdial.range": "범위(최소/최대)",
			"paramdial.step": "회전 클릭당 단위",
			"paramdial.unit": "단위(표시용, 선택 사항)",
			"placeholder.unit": "예: % K",
			"paramdial.hint": "다이얼을 돌리면 단위별로 값을 전송합니다. 누르면 전원을 켜고 끕니다. 터치스크린을 탭하면 밝기/커튼 위치/색온도의 경우 기기의 현재 값을 가져와 동기화합니다. 커스텀의 경우 동기화 대상을 알 수 없으므로 현재 설정값을 다시 전송합니다.",
			"paramdial.ac_mode": "모드",
			"paramdial.ac_mode.auto": "자동",
			"paramdial.ac_mode.cool": "냉방",
			"paramdial.ac_mode.dry": "제습",
			"paramdial.ac_mode.fan": "송풍",
			"paramdial.ac_mode.heat": "난방",
			"paramdial.ac_fan": "풍량",
			"paramdial.ac_fan.auto": "자동",
			"paramdial.ac_fan.low": "약",
			"paramdial.ac_fan.medium": "중",
			"paramdial.ac_fan.high": "강",
			"paramdial.touch_section": "터치 동작(최대 3개)",
			"paramdial.touch1": "①",
			"paramdial.touch2": "②",
			"paramdial.touch3": "③",
			"paramdial.touch_hint": "터치스크린을 짧게 탭할 때마다 설정한 동작 1→2→3→1… 순서로 실행됩니다(설정하지 않은 슬롯은 건너뜁니다). 에어컨 설정(setAll) 동작을 실행하면 다이얼의 온도 조절도 해당 모드/풍량/전원을 그대로 사용합니다. 길게 누르면 기기의 현재 값을 다시 동기화합니다.",
			"tapelight.parameter_target": "파라미터",
			"tapelight.device_section": "기기 설정",
			"tapelight.step_percent": "회전 클릭당 변화량(%)",
			"tapelight.poll_interval": "자동 동기화 간격(초)",
			"tapelight.device_hint": "다이얼을 돌려 선택한 파라미터 값을 조절하고, 누르면 전원을 전환합니다. 자동 동기화는 스마트폰 앱 등 다른 방법으로 변경된 상태를 키에 주기적으로 반영합니다.",
			"tapelight.scene_section": "터치로 전환할 씬",
			"tapelight.scene1": "씬 1",
			"tapelight.scene2": "씬 2",
			"tapelight.scene3": "씬 3",
			"tapelight.scene_hint": "터치스크린을 짧게 탭하면 씬 1 → 2 → 3 → 1… 순서로 실행됩니다(비어 있는 슬롯은 건너뜁니다). 길게 누르면 기기의 현재 상태를 다시 동기화합니다.",
			"tapelight.opt.color": "색상(RGB)",
			"tapelight.color_hint": "다이얼을 돌리면 RGB 값을 15 단위로 변경하며 무지개색을 한 바퀴 순환합니다(빨강→노랑→초록→하늘색→파랑→마젠타→빨강, 총 102단계).",
			"cmd.turnOn": "켜기",
			"cmd.turnOff": "끄기",
			"cmd.toggle": "토글",
			"cmd.press": "누르기(Bot용)",
			"cmd.lock": "잠금",
			"cmd.unlock": "잠금 해제",
			"cmd.setPosition": "커튼 위치 지정",
			"cmd.setBrightness": "밝기 지정",
			"cmd.setColor": "컬러(RGB) 지정",
			"cmd.setColorTemperature": "색온도 지정",
			"cmd.setAll": "에어컨 세부 설정",
			"cmd.acAdjustTemp": "에어컨 온도 조절",
			"cmd.adjustBrightness": "밝기 조절",
			"cmd.adjustColorTemp": "색온도 조절",
			"cmd.custom": "커스텀 명령",
			"param.setPosition.label": "위치(0=완전 열림 / 100=완전 닫힘)",
			"param.setBrightness.label": "밝기(1~100)",
			"param.setColor.label": "색상(R:G:B)",
			"param.setColorTemperature.label": "색온도(2700~6500)",
			"param.custom.label": "파라미터",
			"status.credentials_missing_input": "먼저 토큰과 클라이언트 시크릿을 입력하세요.",
			"status.devices_updated": "기기 목록을 업데이트했습니다({count}개)",
			"status.scenes_updated": "씬 목록을 업데이트했습니다({count}개)",
			"error.credentials_missing": "토큰 / 클라이언트 시크릿이 설정되지 않았습니다.",
			"error.fetch_devices_failed": "기기 목록을 가져오지 못했습니다. 토큰을 확인해주세요.",
			"error.fetch_scenes_failed": "씬 목록을 가져오지 못했습니다. 토큰을 확인해주세요.",
			"error.unexpected": "예기치 않은 오류가 발생했습니다.",
			"error.generic": "오류가 발생했습니다.",
			"accontrol.unit_label": "표시 단위",
			"accontrol.unit.c": "섭씨(℃)",
			"accontrol.unit.f": "화씨(℉)",
			"accontrol.cool_default": "냉방 기본 온도",
			"accontrol.heat_default": "난방 기본 온도",
			"accontrol.modes_heading": "터치로 전환할 모드",
			"accontrol.mode.cool": "냉방",
			"accontrol.mode.heat": "난방",
			"accontrol.mode.dry": "제습",
			"accontrol.mode.fan": "송풍",
			"accontrol.hint": "다이얼을 돌리면 설정 온도를 조정합니다(범위 고정: 16-30℃ / 60-90℉). 누르면 전원을 켜고 끕니다. 터치스크린을 탭할 때마다 아래에서 활성화한 다음 모드로 전환됩니다(냉방/난방으로 전환 시 각 모드의 기본 온도가 적용됩니다).",
			"accontrol.no_mode_hint": "하나 이상의 모드를 활성화해주세요.",
			"ac.temp_label": "온도",
			"ac.fan_label": "풍량",
			"ac.fan.auto": "자동",
			"ac.fan.low": "약",
			"ac.fan.medium": "중",
			"ac.fan.high": "강",
			"ac.adjust_label": "조절 방향",
			"ac.adjust.up": "올리기",
			"ac.adjust.down": "내리기",
			"ac.detail_hint": "누르면 이 모드·온도·풍량으로 전원을 켭니다.",
			"ac.adjust_hint": "누를 때마다 설정 온도가 1℃씩 바뀝니다(같은 에어컨을 조작하는 다른 키와 공유되는, 가장 최근 기억된 온도를 기준으로 합니다).",
			"ac.mode_label": "모드",
			"adjust.value_hint": "누를 때마다 기기의 현재 값을 가져와 한 단계 변경하여 전송합니다.",
			"label.show_credentials": "입력값 표시"
		},
		zh_CN: {
			"label.token": "令牌",
			"label.secret": "客户端密钥",
			"hint.credentials": "打开 SwitchBot 应用，进入“个人资料”>“设置”，连续点击应用版本号以显示开发者选项，然后从那里复制。",
			"label.target": "对象",
			"option.target.device": "设备",
			"option.target.scene": "场景",
			"label.device": "设备",
			"label.scene": "场景",
			"option.unselected": "(未选择)",
			"option.unfetched_suffix": "（尚未获取）",
			"button.refresh": "刷新",
			"button.refreshing": "获取中…",
			"label.command": "命令",
			"label.parameter": "参数",
			"label.custom_command_name": "命令名称",
			"placeholder.custom_command": "例如：setMode",
			"label.command_type": "命令类型",
			"label.enabled": "启用",
			"group.single": "①单击",
			"group.double": "②双击",
			"group.hold": "③长按",
			"sensor.device_hint": "请选择可返回温度、湿度或电池电量的设备(例如 MeterPlus)。",
			"sensor.poll_interval": "自动刷新间隔(秒)",
			"sensor.show_items": "显示项目",
			"sensor.temperature": "温度",
			"sensor.humidity": "湿度",
			"sensor.battery": "电池电量",
			"sensor.touch_hint": "按下按键即可立即刷新数值。",
			"scenebrowser.refresh_interval": "自动刷新间隔(分钟)",
			"scenebrowser.hint": "旋转旋钮可逐个浏览已保存的场景，按下可执行当前显示的场景。点击触摸屏可立即刷新场景列表(在 SwitchBot 应用中添加/删除场景后很有用)。自动刷新间隔用于控制后台刷新列表的频率。",
			"scenebrowser.auto_refresh_enabled": "启用自动刷新",
			"scenebrowser.manual_refresh": "获取场景列表",
			"scenebrowser.all_scenes_heading": "已注册场景列表（{count}个）",
			"scenebrowser.show_all": "全部显示",
			"scenebrowser.visible": "显示",
			"scenebrowser.no_scenes": "暂无场景。请点击“刷新”获取。",
			"scenebrowser.move_up": "上移",
			"scenebrowser.move_down": "下移",
			"scenebrowser.font_size": "场景名称字号(px)",
			"paramdial.parameter": "参数",
			"paramdial.opt.brightness": "亮度",
			"paramdial.opt.position": "窗帘位置",
			"paramdial.opt.colortemp": "色温",
			"paramdial.opt.custom": "自定义",
			"paramdial.range": "范围(最小/最大)",
			"paramdial.step": "每次旋转的步长",
			"paramdial.unit": "单位(仅显示，可选)",
			"placeholder.unit": "例如：% K",
			"paramdial.hint": "旋转旋钮会按步长发送数值。按下可切换电源开关。点击触摸屏时，亮度/窗帘位置/色温会从设备获取当前值并同步。自定义命令的同步目标未知，因此会重新发送当前设置值。",
			"paramdial.ac_mode": "模式",
			"paramdial.ac_mode.auto": "自动",
			"paramdial.ac_mode.cool": "制冷",
			"paramdial.ac_mode.dry": "除湿",
			"paramdial.ac_mode.fan": "送风",
			"paramdial.ac_mode.heat": "制热",
			"paramdial.ac_fan": "风速",
			"paramdial.ac_fan.auto": "自动",
			"paramdial.ac_fan.low": "低",
			"paramdial.ac_fan.medium": "中",
			"paramdial.ac_fan.high": "高",
			"paramdial.touch_section": "触摸操作(最多3个)",
			"paramdial.touch1": "①",
			"paramdial.touch2": "②",
			"paramdial.touch3": "③",
			"paramdial.touch_hint": "每次轻触触摸屏，将依次执行操作1→2→3→1……(未设置的项会跳过)。执行空调设置(setAll)操作后，旋钮的温度调节也会沿用该模式/风速/电源设置。长按可从设备重新同步当前数值。",
			"tapelight.parameter_target": "参数",
			"tapelight.device_section": "设备设置",
			"tapelight.step_percent": "每次旋转的变化量(%)",
			"tapelight.poll_interval": "自动同步间隔(秒)",
			"tapelight.device_hint": "旋转旋钮可调整所选参数的数值，按下可切换电源。自动同步会定期刷新按键，以反映通过其他方式(例如 SwitchBot 应用)所做的更改。",
			"tapelight.scene_section": "通过触摸切换的场景",
			"tapelight.scene1": "场景 1",
			"tapelight.scene2": "场景 2",
			"tapelight.scene3": "场景 3",
			"tapelight.scene_hint": "轻触触摸屏会按场景 1 → 2 → 3 → 1……的顺序执行(跳过未设置的项)。长按可重新同步设备当前状态。",
			"tapelight.opt.color": "颜色(RGB)",
			"tapelight.color_hint": "旋转旋钮会以15为单位改变RGB数值，循环一周彩虹色(红→黄→绿→青→蓝→品红→红，共102级)。",
			"cmd.turnOn": "开启",
			"cmd.turnOff": "关闭",
			"cmd.toggle": "切换",
			"cmd.press": "按下(用于 Bot)",
			"cmd.lock": "上锁",
			"cmd.unlock": "解锁",
			"cmd.setPosition": "设置窗帘位置",
			"cmd.setBrightness": "设置亮度",
			"cmd.setColor": "颜色(RGB)设置",
			"cmd.setColorTemperature": "设置色温",
			"cmd.setAll": "空调详细设置",
			"cmd.acAdjustTemp": "空调温度调节",
			"cmd.adjustBrightness": "调节亮度",
			"cmd.adjustColorTemp": "调节色温",
			"cmd.custom": "自定义命令",
			"param.setPosition.label": "位置(0=全开 / 100=全关)",
			"param.setBrightness.label": "亮度(1-100)",
			"param.setColor.label": "颜色(R:G:B)",
			"param.setColorTemperature.label": "色温(2700-6500)",
			"param.custom.label": "参数",
			"status.credentials_missing_input": "请先输入令牌和客户端密钥。",
			"status.devices_updated": "设备列表已更新(找到 {count} 个)",
			"status.scenes_updated": "场景列表已更新(找到 {count} 个)",
			"error.credentials_missing": "尚未设置令牌/客户端密钥。",
			"error.fetch_devices_failed": "获取设备列表失败，请检查您的令牌。",
			"error.fetch_scenes_failed": "获取场景列表失败，请检查您的令牌。",
			"error.unexpected": "发生意外错误。",
			"error.generic": "发生错误。",
			"accontrol.unit_label": "显示单位",
			"accontrol.unit.c": "摄氏度(℃)",
			"accontrol.unit.f": "华氏度(℉)",
			"accontrol.cool_default": "制冷默认温度",
			"accontrol.heat_default": "制热默认温度",
			"accontrol.modes_heading": "触摸切换的模式",
			"accontrol.mode.cool": "制冷",
			"accontrol.mode.heat": "制热",
			"accontrol.mode.dry": "除湿",
			"accontrol.mode.fan": "送风",
			"accontrol.hint": "旋转旋钮可调整目标温度(固定范围: 16-30℃ / 60-90℉)。按下可切换电源开关。每次点触触摸屏会切换到下方已启用的下一个模式(切换到制冷/制热时会使用该模式的默认温度)。",
			"accontrol.no_mode_hint": "请至少启用一个模式。",
			"ac.temp_label": "温度",
			"ac.fan_label": "风速",
			"ac.fan.auto": "自动",
			"ac.fan.low": "弱",
			"ac.fan.medium": "中",
			"ac.fan.high": "强",
			"ac.adjust_label": "调节方向",
			"ac.adjust.up": "升高",
			"ac.adjust.down": "降低",
			"ac.detail_hint": "按下将以此模式、温度、风速开启电源。",
			"ac.adjust_hint": "每次按下会将设定温度改变1℃(以与操作同一空调的其他按键共享的、最近记住的温度为基准)。",
			"ac.mode_label": "模式",
			"adjust.value_hint": "每次按下会读取设备当前值，并按一档变更后发送。",
			"label.show_credentials": "显示输入内容"
		},
		zh_TW: {
			"label.token": "權杖",
			"label.secret": "用戶端密碼",
			"hint.credentials": "開啟 SwitchBot 應用程式，前往「個人資料」>「設定」，連續點按應用程式版本以顯示開發人員選項，然後從那裡複製。",
			"label.target": "對象",
			"option.target.device": "裝置",
			"option.target.scene": "情境",
			"label.device": "裝置",
			"label.scene": "情境",
			"option.unselected": "(未選取)",
			"option.unfetched_suffix": "（尚未取得）",
			"button.refresh": "重新整理",
			"button.refreshing": "取得中…",
			"label.command": "指令",
			"label.parameter": "參數",
			"label.custom_command_name": "指令名稱",
			"placeholder.custom_command": "例如：setMode",
			"label.command_type": "指令類型",
			"label.enabled": "啟用",
			"group.single": "①單擊",
			"group.double": "②雙擊",
			"group.hold": "③長按",
			"sensor.device_hint": "請選擇可回報溫度、濕度或電量的裝置(例如 MeterPlus)。",
			"sensor.poll_interval": "自動重新整理間隔(秒)",
			"sensor.show_items": "顯示項目",
			"sensor.temperature": "溫度",
			"sensor.humidity": "濕度",
			"sensor.battery": "電量",
			"sensor.touch_hint": "按下按鍵即可立即重新整理數值。",
			"scenebrowser.refresh_interval": "自動重新整理間隔(分鐘)",
			"scenebrowser.hint": "旋轉旋鈕可逐一瀏覽已儲存的情境，按下可執行目前顯示的情境。點觸螢幕可立即重新整理情境清單(在 SwitchBot 應用程式中新增/刪除情境後很有用)。自動重新整理間隔用於控制在背景重新整理清單的頻率。",
			"scenebrowser.auto_refresh_enabled": "啟用自動重新整理",
			"scenebrowser.manual_refresh": "取得情境清單",
			"scenebrowser.all_scenes_heading": "已註冊情境清單（{count}個）",
			"scenebrowser.show_all": "全部顯示",
			"scenebrowser.visible": "顯示",
			"scenebrowser.no_scenes": "尚無情境。請按一下「重新整理」以取得。",
			"scenebrowser.move_up": "上移",
			"scenebrowser.move_down": "下移",
			"scenebrowser.font_size": "情境名稱字型大小(px)",
			"paramdial.parameter": "參數",
			"paramdial.opt.brightness": "亮度",
			"paramdial.opt.position": "窗簾位置",
			"paramdial.opt.colortemp": "色溫",
			"paramdial.opt.custom": "自訂",
			"paramdial.range": "範圍(最小/最大)",
			"paramdial.step": "每次旋轉的步進值",
			"paramdial.unit": "單位(僅顯示，選填)",
			"placeholder.unit": "例如：% K",
			"paramdial.hint": "旋轉旋鈕會依步進值傳送數值。按下可切換電源開關。點觸螢幕時，亮度/窗簾位置/色溫會從裝置取得目前值並同步。自訂指令的同步目標未知，因此會重新傳送目前設定值。",
			"paramdial.ac_mode": "模式",
			"paramdial.ac_mode.auto": "自動",
			"paramdial.ac_mode.cool": "冷氣",
			"paramdial.ac_mode.dry": "除濕",
			"paramdial.ac_mode.fan": "送風",
			"paramdial.ac_mode.heat": "暖氣",
			"paramdial.ac_fan": "風速",
			"paramdial.ac_fan.auto": "自動",
			"paramdial.ac_fan.low": "弱",
			"paramdial.ac_fan.medium": "中",
			"paramdial.ac_fan.high": "強",
			"paramdial.touch_section": "觸控操作(最多3個)",
			"paramdial.touch1": "①",
			"paramdial.touch2": "②",
			"paramdial.touch3": "③",
			"paramdial.touch_hint": "每次輕觸螢幕，會依序執行操作1→2→3→1……(未設定的項目會略過)。執行空調設定(setAll)操作後，旋鈕的溫度調整也會沿用該模式/風速/電源設定。長按可從裝置重新同步目前數值。",
			"tapelight.parameter_target": "參數",
			"tapelight.device_section": "裝置設定",
			"tapelight.step_percent": "每次旋轉的變化量(%)",
			"tapelight.poll_interval": "自動同步間隔(秒)",
			"tapelight.device_hint": "旋轉旋鈕可調整所選參數的數值，按下可切換電源。自動同步會定期重新整理按鍵，以反映透過其他方式(例如 SwitchBot 應用程式)所做的變更。",
			"tapelight.scene_section": "以觸控切換的情境",
			"tapelight.scene1": "情境 1",
			"tapelight.scene2": "情境 2",
			"tapelight.scene3": "情境 3",
			"tapelight.scene_hint": "輕觸螢幕會依情境 1 → 2 → 3 → 1……的順序執行(未設定的項目會略過)。長按可重新同步裝置目前狀態。",
			"tapelight.opt.color": "顏色(RGB)",
			"tapelight.color_hint": "旋轉旋鈕會以15為單位改變RGB數值，循環一圈彩虹色(紅→黃→綠→青→藍→洋紅→紅，共102階)。",
			"cmd.turnOn": "開啟",
			"cmd.turnOff": "關閉",
			"cmd.toggle": "切換",
			"cmd.press": "按下(用於 Bot)",
			"cmd.lock": "上鎖",
			"cmd.unlock": "解鎖",
			"cmd.setPosition": "設定窗簾位置",
			"cmd.setBrightness": "設定亮度",
			"cmd.setColor": "顏色(RGB)設定",
			"cmd.setColorTemperature": "設定色溫",
			"cmd.setAll": "空調詳細設定",
			"cmd.acAdjustTemp": "空調溫度調整",
			"cmd.adjustBrightness": "調整亮度",
			"cmd.adjustColorTemp": "調整色溫",
			"cmd.custom": "自訂指令",
			"param.setPosition.label": "位置(0=全開 / 100=全關)",
			"param.setBrightness.label": "亮度(1-100)",
			"param.setColor.label": "顏色(R:G:B)",
			"param.setColorTemperature.label": "色溫(2700-6500)",
			"param.custom.label": "參數",
			"status.credentials_missing_input": "請先輸入權杖與用戶端密碼。",
			"status.devices_updated": "裝置清單已更新(找到 {count} 個)",
			"status.scenes_updated": "情境清單已更新(找到 {count} 個)",
			"error.credentials_missing": "尚未設定權杖/用戶端密碼。",
			"error.fetch_devices_failed": "取得裝置清單失敗，請確認您的權杖。",
			"error.fetch_scenes_failed": "取得情境清單失敗，請確認您的權杖。",
			"error.unexpected": "發生未預期的錯誤。",
			"error.generic": "發生錯誤。",
			"accontrol.unit_label": "顯示單位",
			"accontrol.unit.c": "攝氏(℃)",
			"accontrol.unit.f": "華氏(℉)",
			"accontrol.cool_default": "製冷預設溫度",
			"accontrol.heat_default": "暖氣預設溫度",
			"accontrol.modes_heading": "以觸控切換的模式",
			"accontrol.mode.cool": "製冷",
			"accontrol.mode.heat": "暖氣",
			"accontrol.mode.dry": "除濕",
			"accontrol.mode.fan": "送風",
			"accontrol.hint": "旋轉旋鈕可調整目標溫度(固定範圍: 16-30℃ / 60-90℉)。按下可切換電源開關。每次點觸螢幕會切換到下方已啟用的下一個模式(切換到製冷/暖氣時會套用該模式的預設溫度)。",
			"accontrol.no_mode_hint": "請至少啟用一個模式。",
			"ac.temp_label": "溫度",
			"ac.fan_label": "風速",
			"ac.fan.auto": "自動",
			"ac.fan.low": "弱",
			"ac.fan.medium": "中",
			"ac.fan.high": "強",
			"ac.adjust_label": "調整方向",
			"ac.adjust.up": "調高",
			"ac.adjust.down": "調低",
			"ac.detail_hint": "按下將以此模式、溫度、風速開啟電源。",
			"ac.adjust_hint": "每次按下會將設定溫度改變1℃(以與操作同一台空調的其他按鍵共用的、最近記住的溫度為基準)。",
			"ac.mode_label": "模式",
			"adjust.value_hint": "每次按下會讀取裝置目前的值，並以一階變更後傳送。",
			"label.show_credentials": "顯示輸入內容"
		}
	};

	var SUPPORTED_LANGS = ["ja", "en", "de", "fr", "es", "ko", "zh_CN", "zh_TW"];
	var currentLang = "ja";

	/**
	 * Stream Deckから渡される言語コードを元に表示言語を決定する。
	 * Stream Deckは通常 "ja","en","de","fr","es","ko","zh_CN","zh_TW" のいずれかを渡すが、
	 * 万一 "zh" のような簡略表記が渡された場合は簡体字(zh_CN)を既定にする。
	 * サポート外の言語は英語にフォールバックする。
	 */
	function setLanguage(streamDeckLangCode) {
		var code = streamDeckLangCode || "en";
		if (SUPPORTED_LANGS.indexOf(code) !== -1) {
			currentLang = code;
			return;
		}
		if (code === "zh") {
			currentLang = "zh_CN";
			return;
		}
		currentLang = "en";
	}

	/** 翻訳文字列を取得する。{name}形式のプレースホルダーはvarsで置換できる */
	function t(key, vars) {
		var dict = STRINGS[currentLang] || STRINGS.en;
		var str = key in dict ? dict[key] : STRINGS.en[key] || key;
		if (vars) {
			Object.keys(vars).forEach(function (k) {
				str = str.replace("{" + k + "}", vars[k]);
			});
		}
		return str;
	}

	/** [data-i18n]/[data-i18n-placeholder] 属性を持つ静的要素へ一括で翻訳を適用する */
	function applyStaticI18n(root) {
		var scope = root || document;
		scope.querySelectorAll("[data-i18n]").forEach(function (el) {
			el.textContent = t(el.getAttribute("data-i18n"));
		});
		scope.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
			el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
		});
	}

	// ================= コマンド定義 =================

	function escapeHtml(str) {
		return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	var COMMAND_VALUES = ["", "turnOn", "turnOff", "toggle", "press", "lock", "unlock", "setPosition", "setBrightness", "adjustBrightness", "setColor", "setColorTemperature", "adjustColorTemp", "setAll", "acAdjustTemp", "custom"];

	/** 翻訳を反映したコマンド選択肢一覧を返す */
	function getCommandOptions() {
		return COMMAND_VALUES.map(function (value) {
			return { value: value, label: value === "" ? t("option.unselected") : t("cmd." + value) };
		});
	}

	var PARAM_DEFAULTS = {
		setPosition: { placeholder: "50", default: "50" },
		setBrightness: { placeholder: "100", default: "100" },
		setColor: { placeholder: "255:255:255", default: "255:255:255" },
		setColorTemperature: { placeholder: "4000", default: "4000" },
		custom: { placeholder: "default", default: "default" }
	};

	/** 指定コマンドのパラメーター入力欄メタ情報(翻訳済みラベル込み)を返す。対象外ならundefined */
	function getParamMeta(command) {
		var base = PARAM_DEFAULTS[command];
		if (!base) return undefined;
		return { label: t("param." + command + ".label"), placeholder: base.placeholder, default: base.default };
	}

	// SwitchBot公式APIドキュメントに基づく、デバイス種別ごとに対応するコマンド一覧。
	// ここに無い種別(赤外線リモコン全般やセンサー等)は「未対応/不明」として全コマンドを表示する
	// フォールバックにする(APIからボタン名を取得する手段が無いため絞り込みができない)。
	var DEVICE_COMMAND_MAP = {
		"Bot": ["turnOn", "turnOff", "toggle", "press"],
		"Curtain": ["turnOn", "turnOff", "setPosition"],
		"Curtain3": ["turnOn", "turnOff", "setPosition"],
		"Blind Tilt": ["turnOn", "turnOff", "setPosition"],
		"Roller Shade": ["turnOn", "turnOff", "setPosition"],
		"Plug": ["turnOn", "turnOff", "toggle"],
		"Plug Mini (US)": ["turnOn", "turnOff", "toggle"],
		"Plug Mini (JP)": ["turnOn", "turnOff", "toggle"],
		"Plug Mini (EU)": ["turnOn", "turnOff", "toggle"],
		"Color Bulb": ["turnOn", "turnOff", "toggle", "setBrightness", "adjustBrightness", "setColor", "setColorTemperature", "adjustColorTemp"],
		"Strip Light": ["turnOn", "turnOff", "toggle", "setBrightness", "adjustBrightness", "setColor", "setColorTemperature", "adjustColorTemp"],
		"Strip Light 3": ["turnOn", "turnOff", "toggle", "setBrightness", "adjustBrightness", "setColor", "setColorTemperature", "adjustColorTemp"],
		"Ceiling Light": ["turnOn", "turnOff", "toggle", "setBrightness", "adjustBrightness", "setColorTemperature", "adjustColorTemp"],
		"Ceiling Light Pro": ["turnOn", "turnOff", "toggle", "setBrightness", "adjustBrightness", "setColorTemperature", "adjustColorTemp"],
		"Air Conditioner": ["turnOn", "turnOff", "toggle", "setAll", "acAdjustTemp"],
		"Smart Lock": ["lock", "unlock"],
		"Smart Lock Pro": ["lock", "unlock"],
		"Smart Lock Ultra": ["lock", "unlock"],
		"Lock": ["lock", "unlock"],
		"Lock Pro": ["lock", "unlock"],
		"Humidifier": ["turnOn", "turnOff", "toggle"],
		"Evaporative Humidifier": ["turnOn", "turnOff", "toggle"],
		"Evaporative Humidifier (Auto-refill)": ["turnOn", "turnOff", "toggle"],
		// ---- ファン(オン/オフのみ対応。風量・首振り等の細かい操作は今後の拡充課題) ----
		"Smart Fan": ["turnOn", "turnOff", "toggle"],
		"Battery Circulator Fan": ["turnOn", "turnOff", "toggle"],
		"Circulator Fan": ["turnOn", "turnOff", "toggle"],
		// ---- 空気清浄機 ----
		"Air Purifier VOC": ["turnOn", "turnOff", "toggle"],
		"Air Purifier Table VOC": ["turnOn", "turnOff", "toggle"],
		"Air Purifier PM2.5": ["turnOn", "turnOff", "toggle"],
		"Air Purifier Table PM2.5": ["turnOn", "turnOff", "toggle"],
		// ---- リレースイッチ ----
		"Relay Switch 1PM": ["turnOn", "turnOff", "toggle"],
		// ---- センサー類(読み取り専用。操作コマンドは無いためカスタムコマンドのみ表示) ----
		"Meter": [],
		"Meter Plus (JP)": [],
		"Meter Plus (US)": [],
		"MeterPlus": [], // 環境によっては地域表記なしでこの文字列が返る場合がある
		"Meter Pro": [],
		"MeterPro": [],
		"Meter Pro CO2": [],
		"MeterPro(CO2)": [],
		"Outdoor Meter": [],
		"WoIOSensor": [], // 屋内外温湿度計(Outdoor Meter)の内部型名で返る場合がある
		"Motion Sensor": [],
		"Contact Sensor": [],
		"Water Leak Detector": [],
		"Water Detector": [],
		// ---- Hub類(中継機器のため直接の操作コマンドは無い) ----
		"Hub": [],
		"Hub Plus": [],
		"Hub Mini": [],
		"Hub Mini2": [],
		"Hub 2": [],
		"Hub 3": [],
		// ---- ロボット掃除機(専用コマンド体系のため、現状はカスタムコマンドで対応) ----
		"Robot Vacuum Cleaner S1": [],
		"Robot Vacuum Cleaner S1 Plus": [],
		"Floor Cleaning Robot S10": [],
		"Mini Robot Vacuum K10+": [],
		"Mini Robot Vacuum K10+ Pro": [],
		"K10+ Pro Combo": [],
		// ---- キーパッド(専用コマンド体系のため、現状はカスタムコマンドで対応) ----
		"Keypad": [],
		"Keypad Touch": []
	};

	/** deviceTypeに対応する許可コマンド一覧を返す。未知の種別はnull(=絞り込みなし) */
	function getAllowedCommands(deviceType) {
		return (deviceType && DEVICE_COMMAND_MAP[deviceType]) || null;
	}

	/**
	 * テープライトコントロール・エアコンコントロール・パラメーターコントロールの
	 * デバイス選択プルダウンで、実際に意味のあるデバイス種別のみを表示するための絞り込み設定。
	 * strict:true の場合、対応表に無い(未知の)デバイス種別も表示しない
	 * (エアコンコントロールは専用の操作しか行わないため、それ以外の種別は原理的に動作しないため)。
	 * strict:false の場合、未知の種別は判定できないため表示する(カスタムコマンドで対応できるため)。
	 */
	var DIAL_DEVICE_FILTER = {
		tapelight: {
			allow: ["Color Bulb", "Strip Light", "Strip Light 3", "Ceiling Light", "Ceiling Light Pro"],
			strict: true
		},
		accontrol: {
			allow: ["Air Conditioner"],
			strict: true
		},
		paramdial: {
			allow: [
				"Color Bulb", "Strip Light", "Strip Light 3", "Ceiling Light", "Ceiling Light Pro",
				"Curtain", "Curtain3", "Blind Tilt", "Roller Shade"
			],
			strict: true
		}
	};

	/** dialKey ("tapelight" / "accontrol" / "paramdial") に応じてデバイス一覧を絞り込む */
	function filterDevicesForDial(deviceList, dialKey) {
		var cfg = DIAL_DEVICE_FILTER[dialKey];
		if (!cfg) return deviceList;
		return deviceList.filter(function (d) {
			if (cfg.allow.indexOf(d.deviceType) !== -1) return true;
			if (cfg.strict) return false;
			// 対応表に無い(未知の)デバイス種別は、判定できないため除外しない
			return !DEVICE_COMMAND_MAP.hasOwnProperty(d.deviceType);
		});
	}

	/**
	 * テープライトコントロール・パラメーターコントロールの「パラメーター」選択肢を、
	 * 選択中のデバイスが実際に対応しているものだけに絞り込んだHTMLを生成する。
	 * presets: [{ value, labelKey, requiredCommand }] の配列。
	 * requiredCommandがnull/未指定のものは常に表示(未選択・カスタム等)。
	 * deviceTypeが未選択、または対応表に無い(未知の)種別の場合は絞り込みを行わない。
	 */
	function buildParameterOptionsHtml(deviceType, presets) {
		var allowed = getAllowedCommands(deviceType);
		var list = presets.filter(function (p) {
			if (!p.requiredCommand) return true;
			if (!allowed) return true;
			return allowed.indexOf(p.requiredCommand) !== -1;
		});
		return list
			.map(function (p) {
				return '<option value="' + p.value + '">' + escapeHtml(t(p.labelKey)) + "</option>";
			})
			.join("");
	}

	/**
	 * コマンド<select>のoptions HTMLを組み立てる。
	 * deviceTypeが対応表にある場合はそのデバイスで使えるコマンドのみに絞り込み、
	 * 「カスタムコマンド」は保険として常に選択肢に残す。
	 */
	function buildCommandOptionsHtml(deviceType) {
		var allowed = getAllowedCommands(deviceType);
		var options = getCommandOptions();
		var list = allowed
			? options.filter(function (opt) {
					return opt.value === "" || allowed.indexOf(opt.value) !== -1 || opt.value === "custom";
				})
			: options;
		return list
			.map(function (opt) {
				return '<option value="' + opt.value + '">' + escapeHtml(opt.label) + "</option>";
			})
			.join("");
	}

	function populateSelect(selectEl, list, idKey, nameKey, currentId, currentName, typeKey) {
		if (!selectEl) return;
		var html = '<option value="">' + t("option.unselected") + "</option>";
		var found = false;
		list.forEach(function (item) {
			var selected = item[idKey] === currentId;
			if (selected) found = true;
			var typeAttr = typeKey && item[typeKey] ? ' data-type="' + escapeHtml(item[typeKey]) + '"' : "";
			html +=
				'<option value="' + escapeHtml(item[idKey]) + '"' + (selected ? " selected" : "") + typeAttr + ">" + escapeHtml(item[nameKey]) + "</option>";
		});
		if (!found && currentId) {
			html += '<option value="' + escapeHtml(currentId) + '" selected>' + escapeHtml(currentName || currentId) + t("option.unfetched_suffix") + "</option>";
		}
		selectEl.innerHTML = html;
	}

	// ================= エアコン詳細設定 / エアコン温度設定 用の共有UI =================
	// シングル/トグル/トリプルアクション、パラメーターコントロールのタッチ設定など、
	// 複数のPI画面で同じフィールド(モード/温度/風量、上げる/下げる)を使うため、
	// HTML生成・表示制御・値の反映・イベント登録をここに共通化している。
	// idPrefix はDOM IDの接頭辞(例: "" / "operationA-" / "touch1-")。

	function buildAcDetailFieldsHtml(idPrefix) {
		return (
			'<div class="field ac-extra-field" id="' + idPrefix + 'ac-mode-field" style="display:none">' +
				'<label>' + t("ac.mode_label") + "</label>" +
				'<div class="control">' +
					'<select id="' + idPrefix + 'acMode">' +
						'<option value="2">' + escapeHtml(t("accontrol.mode.cool")) + "</option>" +
						'<option value="5">' + escapeHtml(t("accontrol.mode.heat")) + "</option>" +
						'<option value="3">' + escapeHtml(t("accontrol.mode.dry")) + "</option>" +
						'<option value="4">' + escapeHtml(t("accontrol.mode.fan")) + "</option>" +
					"</select>" +
				"</div>" +
			"</div>" +
			'<div class="field ac-extra-field" id="' + idPrefix + 'ac-unit-field" style="display:none">' +
				'<label>' + t("accontrol.unit_label") + "</label>" +
				'<div class="control">' +
					'<select id="' + idPrefix + 'acUnit">' +
						'<option value="C">' + escapeHtml(t("accontrol.unit.c")) + "</option>" +
						'<option value="F">' + escapeHtml(t("accontrol.unit.f")) + "</option>" +
					"</select>" +
				"</div>" +
			"</div>" +
			'<div class="field ac-extra-field" id="' + idPrefix + 'ac-temp-field" style="display:none">' +
				'<label>' + t("ac.temp_label") + "</label>" +
				'<div class="control"><input type="number" id="' + idPrefix + 'acTemp" min="16" max="30" /></div>' +
			"</div>" +
			'<div class="field ac-extra-field" id="' + idPrefix + 'ac-fan-field" style="display:none">' +
				'<label>' + t("ac.fan_label") + "</label>" +
				'<div class="control">' +
					'<select id="' + idPrefix + 'acFanSpeed">' +
						'<option value="1">' + escapeHtml(t("ac.fan.auto")) + "</option>" +
						'<option value="2">' + escapeHtml(t("ac.fan.low")) + "</option>" +
						'<option value="3">' + escapeHtml(t("ac.fan.medium")) + "</option>" +
						'<option value="4">' + escapeHtml(t("ac.fan.high")) + "</option>" +
					"</select>" +
				"</div>" +
			"</div>" +
			'<div class="hint ac-extra-field" id="' + idPrefix + 'ac-detail-hint" style="display:none">' + escapeHtml(t("ac.detail_hint")) + "</div>"
		);
	}

	function buildAcAdjustFieldHtml(idPrefix) {
		return (
			'<div class="field ac-extra-field" id="' + idPrefix + 'ac-adjust-field" style="display:none">' +
				'<label>' + t("ac.adjust_label") + "</label>" +
				'<div class="control">' +
					'<select id="' + idPrefix + 'acAdjustDirection">' +
						'<option value="up">' + escapeHtml(t("ac.adjust.up")) + "</option>" +
						'<option value="down">' + escapeHtml(t("ac.adjust.down")) + "</option>" +
					"</select>" +
				"</div>" +
			"</div>" +
			'<div class="hint ac-extra-field" id="' + idPrefix + 'ac-adjust-hint" style="display:none">' + escapeHtml(t("ac.adjust_hint")) + "</div>" +
			'<div class="hint ac-extra-field" id="' + idPrefix + 'value-adjust-hint" style="display:none">' + escapeHtml(t("adjust.value_hint")) + "</div>"
		);
	}

	/** command値に応じて、AC詳細設定/各種「調整」コマンドのフィールド群の表示・非表示を切り替える */
	function updateAcFieldVisibility(elFn, idPrefix, command) {
		var isDetail = command === "setAll";
		var isAcAdjust = command === "acAdjustTemp";
		var isValueAdjust = command === "adjustBrightness" || command === "adjustColorTemp";
		["ac-mode-field", "ac-unit-field", "ac-temp-field", "ac-fan-field", "ac-detail-hint"].forEach(function (suffix) {
			var node = elFn(idPrefix + suffix);
			if (node) node.style.display = isDetail ? "" : "none";
		});
		var adjustFieldNode = elFn(idPrefix + "ac-adjust-field");
		if (adjustFieldNode) adjustFieldNode.style.display = isAcAdjust || isValueAdjust ? "" : "none";
		var acHintNode = elFn(idPrefix + "ac-adjust-hint");
		if (acHintNode) acHintNode.style.display = isAcAdjust ? "" : "none";
		var valueHintNode = elFn(idPrefix + "value-adjust-hint");
		if (valueHintNode) valueHintNode.style.display = isValueAdjust ? "" : "none";
	}

	function ensureAcDefaults(op) {
		if (op.acMode === undefined) op.acMode = 2;
		if (op.acUnit === undefined) op.acUnit = "C";
		if (op.acTemp === undefined) op.acTemp = op.acUnit === "F" ? 78 : 26;
		if (op.acFanSpeed === undefined) op.acFanSpeed = 1;
		if (op.acAdjustDirection === undefined) op.acAdjustDirection = "up";
	}

	/** 表示単位に応じて温度入力欄のmin/maxを更新する(摂氏16-30 / 華氏60-90) */
	function updateAcTempRangeForUnit(elFn, idPrefix, unit) {
		var tempEl = elFn(idPrefix + "acTemp");
		if (!tempEl) return;
		if (unit === "F") {
			tempEl.min = 60;
			tempEl.max = 90;
		} else {
			tempEl.min = 16;
			tempEl.max = 30;
		}
	}

	/** 保存済みの値をAC関連フィールドに反映する(呼び出し側でensureAcDefaultsは不要、内部で行う) */
	function applyAcFieldsToForm(elFn, idPrefix, op) {
		ensureAcDefaults(op);
		var modeEl = elFn(idPrefix + "acMode");
		if (modeEl) modeEl.value = op.acMode;
		var unitEl = elFn(idPrefix + "acUnit");
		if (unitEl) unitEl.value = op.acUnit;
		updateAcTempRangeForUnit(elFn, idPrefix, op.acUnit);
		var tempEl = elFn(idPrefix + "acTemp");
		if (tempEl) tempEl.value = op.acTemp;
		var fanEl = elFn(idPrefix + "acFanSpeed");
		if (fanEl) fanEl.value = op.acFanSpeed;
		var dirEl = elFn(idPrefix + "acAdjustDirection");
		if (dirEl) dirEl.value = op.acAdjustDirection;
	}

	/**
	 * AC関連フィールドの変更イベントを登録する。
	 * getOp は「現在の対象operationオブジェクトを返す関数」(例: function(){ return settings.operation; })。
	 * didReceiveSettings 等で settings 変数自体が再代入されるケースがあるため、
	 * バインド時にオブジェクトを直接キャプチャせず、発火のたびに取得し直すようにしている。
	 * onChange は保存処理(saveSettings等)を渡す。
	 */
	function bindAcFieldEvents(elFn, idPrefix, getOp, onChange) {
		var modeEl = elFn(idPrefix + "acMode");
		if (modeEl) {
			modeEl.addEventListener("change", function (e) {
				getOp().acMode = Number(e.target.value);
				onChange();
			});
		}
		var unitEl = elFn(idPrefix + "acUnit");
		if (unitEl) {
			unitEl.addEventListener("change", function (e) {
				var op = getOp();
				op.acUnit = e.target.value;
				// 単位を切り替えたら、その単位で自然なデフォルト温度に更新する
				// (摂氏の数値をそのまま華氏として扱うと現実的でない値になるため)
				op.acTemp = op.acUnit === "F" ? 78 : 26;
				updateAcTempRangeForUnit(elFn, idPrefix, op.acUnit);
				var tempEl = elFn(idPrefix + "acTemp");
				if (tempEl) tempEl.value = op.acTemp;
				onChange();
			});
		}
		var tempEl = elFn(idPrefix + "acTemp");
		if (tempEl) {
			tempEl.addEventListener("input", function (e) {
				var op = getOp();
				op.acTemp = Number(e.target.value) || (op.acUnit === "F" ? 78 : 26);
				onChange();
			});
		}
		var fanEl = elFn(idPrefix + "acFanSpeed");
		if (fanEl) {
			fanEl.addEventListener("change", function (e) {
				getOp().acFanSpeed = Number(e.target.value);
				onChange();
			});
		}
		var dirEl = elFn(idPrefix + "acAdjustDirection");
		if (dirEl) {
			dirEl.addEventListener("change", function (e) {
				getOp().acAdjustDirection = e.target.value;
				onChange();
			});
		}
	}

	return {
		setLanguage: setLanguage,
		t: t,
		applyStaticI18n: applyStaticI18n,
		escapeHtml: escapeHtml,
		getCommandOptions: getCommandOptions,
		getParamMeta: getParamMeta,
		DEVICE_COMMAND_MAP: DEVICE_COMMAND_MAP,
		getAllowedCommands: getAllowedCommands,
		filterDevicesForDial: filterDevicesForDial,
		buildParameterOptionsHtml: buildParameterOptionsHtml,
		buildCommandOptionsHtml: buildCommandOptionsHtml,
		populateSelect: populateSelect,
		buildAcDetailFieldsHtml: buildAcDetailFieldsHtml,
		buildAcAdjustFieldHtml: buildAcAdjustFieldHtml,
		updateAcFieldVisibility: updateAcFieldVisibility,
		applyAcFieldsToForm: applyAcFieldsToForm,
		bindAcFieldEvents: bindAcFieldEvents
	};
})();
