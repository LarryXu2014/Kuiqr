// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// ============================================================
// Kuiqr — Internationalization (i18n) module
//   - Translation dictionary for all UI strings
//   - t(key, vars)        -> translated string (falls back to en -> key)
//   - applyI18n(root)     -> fills [data-i18n*] attributes in the DOM
//   - getLang()/setLang() -> persisted language preference
//   - getSteps()         -> localized tutorial + extension-instruction steps
//   - initI18n()         -> detect lang, set <html lang>, build picker, apply
// ============================================================

// ── Supported languages (native label shown in the picker) ──
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
];

// ── Dictionary ──
// Each entry: { en, "zh-CN", "zh-TW", ja, ko, es, fr, de }
// Keys with no translation fall back to `en` automatically.
const I18N = {
  // Tabs & hero
  "tab.scan": { en: "Scan", "zh-CN": "扫描", "zh-TW": "掃描", ja: "スキャン", ko: "스캔", es: "Escanear", fr: "Scanner", de: "Scannen" },
  "tab.history": { en: "History", "zh-CN": "历史", "zh-TW": "歷史", ja: "履歴", ko: "기록", es: "Historial", fr: "Historique", de: "Verlauf" },
  "tab.settings": { en: "Settings", "zh-CN": "设置", "zh-TW": "設定", ja: "設定", ko: "설정", es: "Ajustes", fr: "Paramètres", de: "Einstellungen" },
  "tab.generate": { en: "Generate", "zh-CN": "生成", "zh-TW": "產生", ja: "生成", ko: "생성", es: "Generar", fr: "Générer", de: "Erzeugen" },
  "hero.subtitle": { en: "Scan QR codes from your screen, clipboard, or an image file", "zh-CN": "从屏幕、剪贴板或图片文件扫描二维码", "zh-TW": "從螢幕、剪貼簿或圖片檔掃描 QR Code", ja: "画面・クリップボード・画像ファイルからQRコードを読み取り", ko: "화면·클립보드·이미지 파일에서 QR 코드 스캔", es: "Escanea códigos QR desde tu pantalla, portapapeles o un archivo de imagen", fr: "Scannez des QR codes depuis votre écran, le presse-papiers ou un fichier image", de: "Scanne QR-Codes von Bildschirm, Zwischenablage oder Bilddatei" },

  // Drop zone
  "drop.text": { en: "Drop an image here or click to paste from clipboard", "zh-CN": "将图片拖到此处，或点击从剪贴板粘贴", "zh-TW": "將圖片拖曳到這裡，或點擊從剪貼簿貼上", ja: "ここに画像をドロップするか、クリップボードから貼り付け", ko: "이미지를 여기로 끌어오거나 클릭해 클립보드에서 붙여넣기", es: "Suelta una imagen aquí o haz clic para pegar desde el portapapeles", fr: "Déposez une image ici ou cliquez pour coller depuis le presse-papiers", de: "Bild hierher ziehen oder zum Einfügen aus der Zwischenablage klicken" },
  "drop.hint": { en: "Supports PNG, JPG, GIF, BMP — scans instantly in this window", "zh-CN": "支持 PNG、JPG、GIF、BMP —— 在此窗口即时扫描", "zh-TW": "支援 PNG、JPG、GIF、BMP —— 在視窗中即時掃描", ja: "PNG・JPG・GIF・BMP に対応 — このウィンドウですぐに読み取り", ko: "PNG, JPG, GIF, BMP 지원 — 창에서 즉시 스캔", es: "Compatible con PNG, JPG, GIF, BMP — escanea al instante en esta ventana", fr: "Prend en charge PNG, JPG, GIF, BMP — scan instantané dans cette fenêtre", de: "Unterstützt PNG, JPG, GIF, BMP — sofortiger Scan in diesem Fenster" },

  // Buttons
  "btn.paste": { en: "Paste from Clipboard", "zh-CN": "从剪贴板粘贴", "zh-TW": "從剪貼簿貼上", ja: "クリップボードから貼り付け", ko: "클립보드에서 붙여넣기", es: "Pegar del portapapeles", fr: "Coller depuis le presse-papiers", de: "Aus Zwischenablage einfügen" },
  "btn.scan": { en: "Select Screen Area", "zh-CN": "选择屏幕区域", "zh-TW": "選擇螢幕區域", ja: "画面範囲を選択", ko: "화면 영역 선택", es: "Seleccionar área de pantalla", fr: "Sélectionner une zone de l'écran", de: "Bildschirmbereich auswählen" },

  // How to scan
  "how.title": { en: "How to scan", "zh-CN": "如何扫描", "zh-TW": "如何掃描", ja: "スキャン方法", ko: "스캔 방법", es: "Cómo escanear", fr: "Comment scanner", de: "So scannst du" },
  "how.s1": { en: "<b>In-app:</b> Paste an image (⌘V) or drag & drop one here", "zh-CN": "<b>应用内：</b>粘贴图片（⌘V）或拖放图片到此处", "zh-TW": "<b>應用程內：</b>貼上圖片（⌘V）或將圖片拖放到這裡", ja: "<b>アプリ内：</b>画像を貼り付け（⌘V）、またはここにドラッグ＆ドロップ", ko: "<b>앱 내：</b>이미지 붙여넣기(⌘V) 또는 여기로 끌어다 놓기", es: "<b>En la app:</b> Pega una imagen (⌘V) o arrástrala aquí", fr: "<b>Dans l'app :</b> Collez une image (⌘V) ou glissez-déposez-la ici", de: "<b>In der App:</b> Bild einfügen (⌘V) oder hierher ziehen" },
  "how.s2": { en: "<b>Screen capture:</b> Press the shortcut or click the button below", "zh-CN": "<b>屏幕捕获：</b>按快捷键或点击下方按钮", "zh-TW": "<b>螢幕擷取：</b>按下快捷鍵或點擊下方按鈕", ja: "<b>画面キャプチャ：</b>ショートカットを押すか、下のボタンをクリック", ko: "<b>화면 캡처：</b>단축키를 누르거나 아래 버튼 클릭", es: "<b>Captura de pantalla:</b> Pulsa el atajo o haz clic en el botón de abajo", fr: "<b>Capture d'écran :</b> Appuyez sur le raccourci ou cliquez sur le bouton ci-dessous", de: "<b>Bildschirmaufnahme:</b> Drücke das Tastenkürzel oder klicke den Button unten" },
  "how.s3": { en: "Drag a rectangle around the QR code on screen", "zh-CN": "在屏幕上拖出一个矩形框住二维码", "zh-TW": "在螢幕上拖出矩形框住 QR Code", ja: "画面上でQRコードの周りに四角をドラッグ", ko: "화면에서 QR 코드 주위로 사각형을 드래그", es: "Arrastra un rectángulo alrededor del código QR en pantalla", fr: "Faites glisser un rectangle autour du QR code à l'écran", de: "Ziehe ein Rechteck um den QR-Code auf dem Bildschirm" },
  "how.s4": { en: "URLs open automatically, text is copied to clipboard", "zh-CN": "链接自动打开，文本自动复制到剪贴板", "zh-TW": "連結自動開啟，文字自動複製到剪貼簿", ja: "URLは自動で開き、テキストはクリップボードにコピー", ko: "URL은 자동으로 열리고 텍스트는 클립보드에 복사", es: "Las URLs se abren automáticamente, el texto se copia al portapapeles", fr: "Les URL s'ouvrent automatiquement, le texte est copié dans le presse-papiers", de: "URLs öffnen automatisch, Text wird in die Zwischenablage kopiert" },

  // History
  "history.title": { en: "Recent Scans", "zh-CN": "最近扫描", "zh-TW": "最近掃描", ja: "最近のスキャン", ko: "최근 스캔", es: "Escaneos recientes", fr: "Scans récents", de: "Letzte Scans" },
  "history.clear": { en: "Clear All", "zh-CN": "清空全部", "zh-TW": "清除全部", ja: "すべて消去", ko: "전체 지우기", es: "Borrar todo", fr: "Tout effacer", de: "Alle löschen" },
  "history.empty": { en: "No scans yet. Paste an image or press the shortcut to scan.", "zh-CN": "还没有扫描记录。粘贴图片或按快捷键开始扫描。", "zh-TW": "還沒有掃描紀錄。貼上圖片或按下快捷鍵開始掃描。", ja: "まだスキャンがありません。画像を貼り付けるかショートカットを押してください。", ko: "아직 스캔 내역이 없습니다. 이미지를 붙여넣거나 단축키를 누르세요.", es: "Aún no hay escaneos. Pega una imagen o pulsa el atajo para escanear.", fr: "Aucun scan pour l'instant. Collez une image ou appuyez sur le raccourci.", de: "Noch keine Scans. Bild einfügen oder Tastenkürzel drücken." },
  "history.clearConfirm": { en: "This will permanently delete {count} scanned code(s). This can't be undone.", "zh-CN": "这将永久删除 {count} 条扫描记录，且无法恢复。", "zh-TW": "這將永久刪除 {count} 筆掃描紀錄，且無法復原。", ja: "スキャンした {count} 件のコードが完全に削除され、元に戻せません。", ko: "스캔한 코드 {count}개가 영구적으로 삭제되며 되돌릴 수 없습니다.", es: "Esto eliminará permanentemente {count} código(s) escaneado(s). No se puede deshacer.", fr: "Cela supprimera définitivement {count} code(s) scanné(s). Action irréversible.", de: "Dies löscht {count} gescannten Code(s) dauerhaft. Das kann nicht rückgängig gemacht werden." },

  // Settings — title + items
  "settings.title": { en: "Settings", "zh-CN": "设置", "zh-TW": "設定", ja: "設定", ko: "설정", es: "Ajustes", fr: "Paramètres", de: "Einstellungen" },
  "set.shortcut": { en: "Keyboard Shortcut", "zh-CN": "键盘快捷键", "zh-TW": "鍵盤快捷鍵", ja: "キーボードショートカット", ko: "키보드 단축키", es: "Atajo de teclado", fr: "Raccourci clavier", de: "Tastenkürzel" },
  "set.shortcut.desc": { en: "Global hotkey to trigger screen capture. Click <b>Record</b>, then press a key combo — it's saved automatically (Esc cancels). The old hotkey is disabled while recording.", "zh-CN": "触发屏幕捕获的全局快捷键。点击<b>录制</b>，然后按下组合键即可自动保存（Esc 取消）。录制时旧快捷键会暂时禁用。", "zh-TW": "觸發螢幕擷取的全域快捷鍵。點擊<b>錄製</b>，再按下組合鍵即可自動儲存（Esc 取消）。錄製時舊快捷鍵會暫時停用。", ja: "画面キャプチャを開始するグローバルホットキー。<b>録制</b>をクリックしてキーを押すと自動保存されます（Escでキャンセル）。録制中は古いホットキーは無効になります。", ko: "화면 캡처를 시작하는 전역 단축키입니다. <b>녹화</b>를 클릭한 후 키 조합을 누르면 자동 저장됩니다(Esc 취소). 녹화 중에는 이전 단축키가 비활성화됩니다.", es: "Tecla global para iniciar la captura de pantalla. Haz clic en <b>Grabar</b> y pulsa una combinación — se guarda automáticamente (Esc cancela). El atajo anterior se desactiva mientras grabas.", fr: "Raccourci global pour déclencher la capture. Cliquez sur <b>Enregistrer</b>, puis une combinaison — elle est sauvegardée automatiquement (Échap annule). L'ancien raccourci est désactivé pendant l'enregistrement.", de: "Globale Taste zum Starten der Bildschirmaufnahme. Klicke <b>Aufnehmen</b> und drücke eine Kombination — sie wird automatisch gespeichert (Esc bricht ab). Während der Aufnahme ist das alte Kürzel deaktiviert." },
  "set.autoopen": { en: "Auto-open URLs", "zh-CN": "自动打开链接", "zh-TW": "自動開啟連結", ja: "URLを自動で開く", ko: "URL 자동 열기", es: "Abrir URLs automáticamente", fr: "Ouverture auto des URL", de: "URLs automatisch öffnen" },
  "set.autoopen.desc": { en: "Automatically open decoded URLs in your browser", "zh-CN": "在浏览器中自动打开解码出的链接", "zh-TW": "在瀏覽器中自動開啟解碼出的連結", ja: "デコードしたURLをブラウザで自動的に開く", ko: "디코딩된 URL을 브라우저에서 자동으로 열기", es: "Abre automáticamente las URLs decodificadas en tu navegador", fr: "Ouvre automatiquement les URL décodées dans votre navigateur", de: "Decodierte URLs automatisch im Browser öffnen" },
  "set.copytext": { en: "Copy text to clipboard", "zh-CN": "复制文本到剪贴板", "zh-TW": "複製文字到剪貼簿", ja: "テキストをクリップボードにコピー", ko: "텍스트를 클립보드에 복사", es: "Copiar texto al portapapeles", fr: "Copier le texte dans le presse-papiers", de: "Text in Zwischenablage kopieren" },
  "set.copytext.desc": { en: "Copy non-URL QR data to clipboard automatically", "zh-CN": "自动将非链接的二维码内容复制到剪贴板", "zh-TW": "自動將非連結的 QR 內容複製到剪貼簿", ja: "URL以外のQRデータを自動的にクリップボードにコピー", ko: "URL이 아닌 QR 데이터를 클립보드에 자동 복사", es: "Copia automáticamente al portapapeles los datos QR que no son URL", fr: "Copie automatiquement dans le presse-papiers les données QR non-URL", de: "Nicht-URL-QR-Daten automatisch in die Zwischenablage kopieren" },
  "set.showpopup": { en: "Show scan notifications", "zh-CN": "显示扫描通知", "zh-TW": "顯示掃描通知", ja: "スキャン通知を表示", ko: "스캔 알림 표시", es: "Mostrar notificaciones de escaneo", fr: "Afficher les notifications de scan", de: "Scan-Benachrichtigungen anzeigen" },
  "set.showpopup.desc": { en: "Show an in-app notification overlay after scanning a QR code", "zh-CN": "扫描二维码后显示应用内通知浮层", "zh-TW": "掃描 QR Code 後顯示應用程式內通知浮層", ja: "QRコードを読み取った後にアプリ内通知を表示", ko: "QR 코드 스캔 후 앱 내 알림 오버레이 표시", es: "Muestra una notificación en la app tras escanear un código", fr: "Affiche une notification dans l'app après un scan", de: "Zeigt eine In-App-Benachrichtigung nach dem Scannen" },
  "set.browserprio": { en: "Browser extension priority", "zh-CN": "浏览器扩展优先", "zh-TW": "瀏覽器擴充功能優先", ja: "ブラウザ拡張機能を優先", ko: "브라우저 확장 우선", es: "Prioridad a la extensión del navegador", fr: "Priorité à l'extension navigateur", de: "Browser-Erweiterung vorrangig" },
  "set.browserprio.desc": { en: "When a web browser is the frontmost app, this app releases the global shortcut so the Kuiqr extension handles it instead (no double scan, no app window popping up). Requires macOS Automation permission (System Settings → Privacy & Security → Automation) so the app can detect the frontmost app.", "zh-CN": "当浏览器处于最前台时，本应用会释放全局快捷键，改由 Kuiqr 扩展处理（不会重复扫描，也不会弹出应用窗口）。需要 macOS 自动化权限（系统设置 → 隐私与安全性 → 自动化），以便应用检测最前台的应用。", "zh-TW": "當瀏覽器位於最前方時，本應用程式會釋放全域快捷鍵，改由 Kuiqr 擴充功能處理（不會重複掃描，也不會跳出應用程式視窗）。需要 macOS 自動化權限（系統設定 → 隱私與安全性 → 自動化），以便應用程式偵測最前方的應用。", ja: "ブラウザが最前面のとき、このアプリはグローバルショートカットを解放し、代わりにKuiqr拡張機能が処理します（二重スキャンやウィンドウのポップアップなし）。最前面アプリの検出にはmacOSのオートメーション権限（システム設定 → プライバシーとセキュリティ → オートメーション）が必要です。", ko: "브라우저가 맨 앞에 있을 때 이 앱은 전역 단축키를 해제하고 Kuiqr 확장이 대신 처리합니다(이중 스캔이나 앱 창 팝업 없음). 앱이 맨 앞 앱을 감지하려면 macOS 자동화 권한(시스템 설정 → 개인정보 보호 및 보안 → 자동화)이 필요합니다.", es: "Cuando un navegador está en primer plano, esta app libera el atajo global para que la extensión Kuiqr lo gestione (sin doble escaneo ni ventana emergente). Requiere permiso de Automatización de macOS (Ajustes del sistema → Privacidad y seguridad → Automatización).", fr: "Quand un navigateur est au premier plan, cette app libère le raccourci global pour que l'extension Kuiqr le gère (pas de double scan, pas de fenêtre). Nécessite la permission d'Automatisation macOS (Réglages → Confidentialité et sécurité → Automatisation).", de: "Wenn ein Browser im Vordergrund ist, gibt diese App das globale Tastenkürzel frei, sodass die Kuiqr-Erweiterung es übernimmt (kein Doppelscan, kein Fenster). Erfordert macOS-Automatisierungsberechtigung (Systemeinstellungen → Datenschutz & Sicherheit → Automatisierung)." },
  "set.automation": { en: "macOS Automation permission", "zh-CN": "macOS 自动化权限", "zh-TW": "macOS 自動化權限", ja: "macOS オートメーション権限", ko: "macOS 자동화 권한", es: "Permiso de Automatización de macOS", fr: "Permission d'Automatisation macOS", de: "macOS-Automatisierungsberechtigung" },
  "set.automation.desc": { en: "Needed so the app can detect the frontmost app for browser-extension priority. If the system prompt didn't appear when the app opened, open System Settings and enable <b>Kuiqr</b> under Privacy & Security → Automation.", "zh-CN": "应用需要此权限来检测最前台应用以实现浏览器扩展优先。如果打开应用时系统没有弹出提示，请打开系统设置，在 隐私与安全性 → 自动化 下启用 <b>Kuiqr</b>。", "zh-TW": "應用程式需要此權限來偵測最前方的應用程式以實現瀏覽器擴充功能優先。若開啟應用程式時系統未跳出提示，請開啟系統設定，在 隱私與安全性 → 自動化 下啟用 <b>Kuiqr</b>。", ja: "ブラウザ拡張優先のため、最前面アプリを検出するために必要です。アプリ起動時にシステム通知が出なかった場合は、システム設定の プライバシーとセキュリティ → オートメーション で <b>Kuiqr</b> を有効にしてください。", ko: "브라우저 확장 우선을 위해 맨 앞 앱을 감지하는 데 필요합니다. 앱을 열 때 시스템 팝업이 나타나지 않으면 시스템 설정의 개인정보 보호 및 보안 → 자동화에서 <b>Kuiqr</b>를 활성화하세요.", es: "Necesario para que la app detecte la app frontal y priorice la extensión. Si no apareció el aviso al abrirla, abre Ajustes del sistema y activa <b>Kuiqr</b> en Privacidad y seguridad → Automatización.", fr: "Nécessaire pour détecter l'app de premier plan et prioriser l'extension. Si l'invite n'est pas apparue, ouvrez les Réglages et activez <b>Kuiqr</b> dans Confidentialité et sécurité → Automatisation.", de: "Nötig, damit die App die vorderste App erkennt (Erweiterungs-Priorität). Erschien beim Start kein Hinweis, öffne die Systemeinstellungen und aktiviere <b>Kuiqr</b> unter Datenschutz & Sicherheit → Automatisierung." },
  "btn.openautomation": { en: "Open System Settings → Automation", "zh-CN": "打开系统设置 → 自动化", "zh-TW": "開啟系統設定 → 自動化", ja: "システム設定 → オートメーションを開く", ko: "시스템 설정 → 자동화 열기", es: "Abrir Ajustes → Automatización", fr: "Ouvrir Réglages → Automatisation", de: "Systemeinstellungen → Automatisierung öffnen" },
  "set.maxhistory": { en: "Max history items", "zh-CN": "最大历史条数", "zh-TW": "最大歷史筆數", ja: "履歴の最大件数", ko: "기록 최대 항목 수", es: "Máximo de elementos en el historial", fr: "Nombre max. d'éléments d'historique", de: "Max. Verlaufseinträge" },
  "set.maxhistory.desc": { en: "Number of scans to keep in history", "zh-CN": "历史记录中保留的扫描数量", "zh-TW": "歷史紀錄中保留的掃描數量", ja: "履歴に残すスキャン数", ko: "기록에 보관할 스캔 수", es: "Número de escaneos a guardar en el historial", fr: "Nombre de scans à conserver dans l'historique", de: "Anzahl der gespeicherten Scans im Verlauf" },
  "btn.save": { en: "Save Settings", "zh-CN": "保存设置", "zh-TW": "儲存設定", ja: "設定を保存", ko: "설정 저장", es: "Guardar ajustes", fr: "Enregistrer", de: "Einstellungen speichern" },
  "settings.saved": { en: "Settings saved!", "zh-CN": "设置已保存！", "zh-TW": "設定已儲存！", ja: "設定を保存しました！", ko: "설정이 저장되었습니다!", es: "¡Ajustes guardados!", fr: "Paramètres enregistrés !", de: "Einstellungen gespeichert!" },

  // Tutorial group + About
  "tutorial.grp.title": { en: "Tutorial", "zh-CN": "新手教程", "zh-TW": "新手教學", ja: "チュートリアル", ko: "튜토리얼", es: "Tutorial", fr: "Tutoriel", de: "Tutorial" },
  "tutorial.grp.desc": { en: "New here? Take a quick guided tour of Kuiqr's features any time.", "zh-CN": "新用户？随时可以体验 Kuiqr 的功能引导。", "zh-TW": "新使用者？隨時可以體驗 Kuiqr 的功能導覽。", ja: "初めてですか？いつでもKuiqrの機能を簡単に案内します。", ko: "처음이신가요? 언제든 Kuiqr 기능을 빠르게 둘러보세요.", es: "¿Eres nuevo? Haz un rápido recorrido por las funciones de Kuiqr cuando quieras.", fr: "Nouveau ? Faites une visite guidée rapide des fonctionnalités de Kuiqr quand vous voulez.", de: "Neu hier? Jederzeit eine kurze geführte Tour durch Kuiqrs Funktionen." },
  "btn.tutorial": { en: "Take a guided tour", "zh-CN": "开始新手引导", "zh-TW": "開始新手引導", ja: "ガイドツアーを開始", ko: "가이드 투어 시작", es: "Hacer un recorrido guiado", fr: "Faire la visite guidée", de: "Geführte Tour starten" },
  "about.title": { en: "About", "zh-CN": "关于", "zh-TW": "關於", ja: "について", ko: "정보", es: "Acerca de", fr: "À propos", de: "Über" },
  "about.local": { en: "All processing is local. No data is sent to any server.", "zh-CN": "所有处理均在本地完成，数据不会发送到任何服务器。", "zh-TW": "所有處理均在本地完成，資料不會傳送到任何伺服器。", ja: "すべてローカルで処理され、いかなるサーバーにもデータは送信されません。", ko: "모든 처리는 로컬에서 이루어지며 어떤 서버로도 데이터를 보내지 않습니다.", es: "Todo el procesamiento es local. Ningún dato se envía a ningún servidor.", fr: "Tout est traité localement. Aucune donnée n'est envoyée à un serveur.", de: "Alle Verarbeitung erfolgt lokal. Keine Daten werden an Server gesendet." },

  // Language + Updates
  "language.label": { en: "Language", "zh-CN": "语言", "zh-TW": "語言", ja: "言語", ko: "언어", es: "Idioma", fr: "Langue", de: "Sprache" },
  "language.desc": { en: "Choose the language used throughout Kuiqr", "zh-CN": "选择 Kuiqr 中使用的语言", "zh-TW": "選擇 Kuiqr 中使用的語言", ja: "Kuiqr全体で使用する言語を選択", ko: "Kuiqr 전반에서 사용할 언어 선택", es: "Elige el idioma usado en Kuiqr", fr: "Choisissez la langue utilisée dans Kuiqr", de: "Wähle die in Kuiqr verwendete Sprache" },
  "updates.title": { en: "Updates", "zh-CN": "更新", "zh-TW": "更新", ja: "アップデート", ko: "업데이트", es: "Actualizaciones", fr: "Mises à jour", de: "Updates" },
  "updates.current": { en: "Current version: {ver}", "zh-CN": "当前版本：{ver}", "zh-TW": "目前版本：{ver}", ja: "現在のバージョン：{ver}", ko: "현재 버전: {ver}", es: "Versión actual: {ver}", fr: "Version actuelle : {ver}", de: "Aktuelle Version: {ver}" },
  "updates.check": { en: "Check for Updates", "zh-CN": "检查更新", "zh-TW": "檢查更新", ja: "アップデートを確認", ko: "업데이트 확인", es: "Buscar actualizaciones", fr: "Rechercher des mises à jour", de: "Nach Updates suchen" },
  "updates.download": { en: "Download Update", "zh-CN": "下载更新", "zh-TW": "下載更新", ja: "アップデートをダウンロード", ko: "업데이트 다운로드", es: "Descargar actualización", fr: "Télécharger la mise à jour", de: "Update herunterladen" },
  "updates.status.checking": { en: "Checking for updates…", "zh-CN": "正在检查更新…", "zh-TW": "正在檢查更新…", ja: "アップデートを確認中…", ko: "업데이트 확인 중…", es: "Buscando actualizaciones…", fr: "Recherche de mises à jour…", de: "Nach Updates suchen…" },
  "updates.status.uptodate": { en: "You're up to date (v{cur}).", "zh-CN": "已是最新版本（v{cur}）。", "zh-TW": "已是最新版本（v{cur}）。", ja: "最新バージョンです（v{cur}）。", ko: "최신 버전입니다(v{cur}).", es: "Estás al día (v{cur}).", fr: "Vous êtes à jour (v{cur}).", de: "Du bist auf dem neuesten Stand (v{cur})." },
  "updates.status.available": { en: "Update available: {latest}", "zh-CN": "有可用更新：{latest}", "zh-TW": "有可用更新：{latest}", ja: "利用可能なアップデート：{latest}", ko: "사용 가능한 업데이트: {latest}", es: "Actualización disponible: {latest}", fr: "Mise à jour disponible : {latest}", de: "Update verfügbar: {latest}" },
  "updates.status.error": { en: "Could not check for updates.", "zh-CN": "无法检查更新。", "zh-TW": "無法檢查更新。", ja: "アップデートの確認に失敗しました。", ko: "업데이트를 확인할 수 없습니다.", es: "No se pudieron buscar actualizaciones.", fr: "Impossible de vérifier les mises à jour.", de: "Updates konnten nicht geprüft werden." },
  "updates.status.downloading": { en: "Downloading update…", "zh-CN": "正在下载更新…", "zh-TW": "正在下載更新…", ja: "アップデートをダウンロード中…", ko: "업데이트 다운로드 중…", es: "Descargando actualización…", fr: "Téléchargement de la mise à jour…", de: "Update wird heruntergeladen…" },
  "updates.status.open": { en: "Opening installer…", "zh-CN": "正在打开安装程序…", "zh-TW": "正在開啟安裝程式…", ja: "インストーラを開いています…", ko: "설치 프로그램을 여는 중…", es: "Abriendo el instalador…", fr: "Ouverture de l'installateur…", de: "Installer wird geöffnet…" },
  "updates.status.done": { en: "Update downloaded. Install it from your Downloads folder.", "zh-CN": "更新已下载，请从下载文件夹中安装。", "zh-TW": "更新已下載，請從下載資料夾中安裝。", ja: "アップデートをダウンロードしました。ダウンロードフォルダからインストールしてください。", ko: "업데이트를 다운로드했습니다. 다운로드 폴더에서 설치하세요.", es: "Actualización descargada. Instálala desde tu carpeta de Descargas.", fr: "Mise à jour téléchargée. Installez-la depuis votre dossier Téléchargements.", de: "Update heruntergeladen. Installiere es aus dem Downloads-Ordner." },
  "updates.modal.title": { en: "Update available", "zh-CN": "有可用更新", "zh-TW": "有可用更新", ja: "アップデートがあります", ko: "업데이트 있음", es: "Actualización disponible", fr: "Mise à jour disponible", de: "Update verfügbar" },
  "updates.modal.sub": { en: "Version {latest} is ready. Update now to get the latest fixes and improvements — it installs automatically.", "zh-CN": "版本 {latest} 已就绪。立即更新以获取最新修复与改进——将自动安装。", "zh-TW": "版本 {latest} 已就緒。立即更新以取得最新修正與改進——將自動安裝。", ja: "バージョン {latest} が利用可能です。最新の修正と改善を自動で適用します。", ko: "버전 {latest} 준비됨. 최신 수정 및 개선 사항을 자동으로 설치하려면 지금 업데이트하세요.", es: "La versión {latest} está lista. Actualiza ahora para obtener las últimas correcciones y mejoras; se instala automáticamente.", fr: "La version {latest} est prête. Mettez à jour maintenant pour obtenir les derniers correctifs et améliorations — l'installation est automatique.", de: "Version {latest} ist bereit. Aktualisiere jetzt, um die neuesten Fixes und Verbesserungen zu erhalten — die Installation erfolgt automatisch." },
  "updates.modal.now": { en: "Update Now", "zh-CN": "立即更新", "zh-TW": "立即更新", ja: "今すぐ更新", ko: "지금 업데이트", es: "Actualizar ahora", fr: "Mettre à jour", de: "Jetzt aktualisieren" },
  "updates.modal.later": { en: "Later", "zh-CN": "稍后", "zh-TW": "稍後", ja: "後で", ko: "나중에", es: "Más tarde", fr: "Plus tard", de: "Später" },
  "updates.later": { en: "Update Later", "zh-CN": "稍后更新", "zh-TW": "稍後更新", ja: "後で更新", ko: "나중에 업데이트", es: "Actualizar más tarde", fr: "Mettre à jour plus tard", de: "Später aktualisieren" },
  "updates.status.installing": { en: "Installing update…", "zh-CN": "正在安装更新…", "zh-TW": "正在安裝更新…", ja: "アップデートをインストール中…", ko: "업데이트 설치 중…", es: "Instalando actualización…", fr: "Installation de la mise à jour…", de: "Update wird installiert…" },
  "updates.status.installed": { en: "Update installed. Restarting…", "zh-CN": "更新已安装，正在重启…", "zh-TW": "更新已安裝，正在重新啟動…", ja: "インストール完了。再起動しています…", ko: "업데이트 설치됨. 다시 시작하는 중…", es: "Actualización instalada. Reiniciando…", fr: "Mise à jour installée. Redémarrage…", de: "Update installiert. Neustart…" },
  "updates.progress.text": { en: "Downloading…", "zh-CN": "正在下载…", "zh-TW": "正在下載…", ja: "ダウンロード中…", ko: "다운로드 중…", es: "Descargando…", fr: "Téléchargement…", de: "Wird heruntergeladen…" },
  "updates.progress.size": { en: "{downloaded} / {total}", "zh-CN": "{downloaded} / {total}", "zh-TW": "{downloaded} / {total}", ja: "{downloaded} / {total}", ko: "{downloaded} / {total}", es: "{downloaded} / {total}", fr: "{downloaded} / {total}", de: "{downloaded} / {total}" },
  "updates.progress.hint": { en: "The installer ({filename}) will be saved to your Downloads folder and opened automatically.", "zh-CN": "安装程序（{filename}）将保存到下载文件夹并自动打开。", "zh-TW": "安裝程式（{filename}）將儲存到下載資料夾並自動開啟。", ja: "インストーラー（{filename}）はダウンロードフォルダに保存され、自動的に開きます。", ko: "설치 프로그램({filename})이 다운로드 폴터에 저장되고 자동으로 열립니다.", es: "El instalador ({filename}) se guardará en tu carpeta de Descargas y se abrirá automáticamente.", fr: "L'installateur ({filename}) sera enregistré dans votre dossier Téléchargements et ouvert automatiquement.", de: "Der Installer ({filename}) wird in deinem Downloads-Ordner gespeichert und automatisch geöffnet." },

  // Generate tab
  "gen.title": { en: "Generate QR Code", "zh-CN": "生成二维码", "zh-TW": "產生 QR Code", ja: "QRコードを生成", ko: "QR 코드 생성", es: "Generar código QR", fr: "Générer un QR code", de: "QR-Code erzeugen" },
  "gen.desc": { en: "Enter any text, link, or data and generate a QR code. A QR code can only encode text (so a photo can't be embedded — but you can paste a link to an image).", "zh-CN": "输入任意文本、链接或数据即可生成二维码。二维码只能编码文本（无法嵌入照片，但可以粘贴图片链接）。", "zh-TW": "輸入任意文字、連結或資料即可產生 QR Code。QR Code 只能編碼文字（無法嵌入照片，但可以貼上圖片連結）。", ja: "テキスト・リンク・データを入力するとQRコードを生成します。QRコードはテキストのみ格納可能です（写真は埋め込めませんが、画像へのリンクは貼れます）。", ko: "텍스트·링크·데이터를 입력하면 QR 코드를 생성합니다. QR 코드는 텍스트만 인코딩할 수 있습니다(사진은 넣을 수 없지만 이미지 링크는 붙여넣기 가능).", es: "Introduce cualquier texto, enlace o dato y genera un código QR. Un QR solo puede codificar texto (no se puede incrustar una foto, pero sí pegar un enlace a una imagen).", fr: "Saisissez un texte, un lien ou des données pour générer un QR code. Un QR code n'encode que du texte (une photo ne peut pas être intégrée — mais vous pouvez coller un lien vers une image).", de: "Gib einen Text, Link oder Daten ein, um einen QR-Code zu erzeugen. Ein QR-Code kann nur Text codieren (kein Foto — aber du kannst einen Bild-Link einfügen)." },
  "gen.content": { en: "Content", "zh-CN": "内容", "zh-TW": "內容", ja: "内容", ko: "내용", es: "Contenido", fr: "Contenu", de: "Inhalt" },
  "gen.placeholder": { en: "https://example.com or any text…", "zh-CN": "https://example.com 或任意文本…", "zh-TW": "https://example.com 或任意文字…", ja: "https://example.com または任意のテキスト…", ko: "https://example.com 또는 아무 텍스트…", es: "https://example.com o cualquier texto…", fr: "https://example.com ou n'importe quel texte…", de: "https://example.com oder beliebiger Text…" },
  "gen.previewPlaceholder": { en: "Your QR code will appear here", "zh-CN": "二维码将在此显示", "zh-TW": "QR Code 將在此顯示", ja: "QRコードがここに表示されます", ko: "QR 코드가 여기에 표시됩니다", es: "El código QR aparecerá aquí", fr: "Le QR code apparaîtra ici", de: "Der QR-Code erscheint hier" },
  "gen.ecc": { en: "Error correction", "zh-CN": "纠错级别", "zh-TW": "糾錯級別", ja: "誤り訂正レベル", ko: "오류 수정 수준", es: "Corrección de errores", fr: "Correction d'erreur", de: "Fehlerkorrektur" },
  "gen.ecc.L": { en: "Low", "zh-CN": "低", "zh-TW": "低", ja: "低", ko: "낮음", es: "Baja", fr: "Faible", de: "Niedrig" },
  "gen.ecc.M": { en: "Medium", "zh-CN": "中", "zh-TW": "中", ja: "中", ko: "중간", es: "Media", fr: "Moyenne", de: "Mittel" },
  "gen.ecc.Q": { en: "Quartile", "zh-CN": "较高", "zh-TW": "較高", ja: "やや高", ko: "높음(4분위)", es: "Cuartil", fr: "Quartile", de: "Quartil" },
  "gen.ecc.H": { en: "High", "zh-CN": "高", "zh-TW": "高", ja: "高", ko: "높음", es: "Alta", fr: "Élevée", de: "Hoch" },
  "gen.download": { en: "Download PNG", "zh-CN": "下载 PNG", "zh-TW": "下載 PNG", ja: "PNGをダウンロード", ko: "PNG 다운로드", es: "Descargar PNG", fr: "Télécharger PNG", de: "PNG herunterladen" },
  "gen.copyqr": { en: "Copy QR Code", "zh-CN": "复制二维码", "zh-TW": "複製 QR Code", ja: "QRコードをコピー", ko: "QR 코드 복사", es: "Copiar QR", fr: "Copier le QR", de: "QR kopieren" },
  "gen.copytext": { en: "Copy Text", "zh-CN": "复制文本", "zh-TW": "複製文字", ja: "テキストをコピー", ko: "텍스트 복사", es: "Copiar texto", fr: "Copier le texte", de: "Text kopieren" },
  "gen.error": { en: "Could not generate: {msg}", "zh-CN": "无法生成：{msg}", "zh-TW": "無法產生：{msg}", ja: "生成できませんでした：{msg}", ko: "생성할 수 없음: {msg}", es: "No se pudo generar: {msg}", fr: "Impossible de générer : {msg}", de: "Erzeugung fehlgeschlagen: {msg}" },

  // Dynamic (trackable) QR
  "gen.dynamic": { en: "Dynamic (trackable) QR" },
  "gen.dynamicDesc": { en: "Encode a redirect link so you can see scan analytics. Requires a backend set in Settings." },
  "gen.createTrackable": { en: "Create trackable QR" },
  "gen.creating": { en: "Creating…" },
  "gen.trackableActive": { en: "Trackable QR ready" },
  "gen.trackableExplainer": { en: "This QR encodes the short link below. When someone scans it, the visit is logged and they're redirected to your original link." },
  "gen.trackableLocalNote": { en: "Phones must be on the same Wi-Fi network as this Mac to reach this local backend." },
  "gen.copyShortLink": { en: "Copy short link" },
  "gen.copied": { en: "Copied!" },
  "gen.copyFailed": { en: "Could not copy" },
  "gen.trackableDestination": { en: "Redirects to: {url}" },
  "gen.viewStats": { en: "View stats" },
  "gen.createFirst": { en: "Click \"Create trackable QR\" to generate a redirect link for this destination." },
  "gen.needDestination": { en: "Enter a destination first." },
  "gen.dynamicNeedsUrl": { en: "Trackable QR only works with web links (http/https)." },
  "gen.dynamicError": { en: "Could not create trackable QR: {reason}" },
  "gen.dynamicInfo": { en: "When on, the QR encodes a short redirect link. Each scan is counted in Analytics, then the visitor is sent to your real link." },
  "gen.dynamicHint": { en: "Turn on to encode a redirect link so you can track scans. No backend yet? Set up a free local one in Settings → Dynamic QR." },

  // Stats tab
  "tab.stats": { en: "Stats" },
  "stats.title": { en: "QR Analytics" },
  "stats.desc": { en: "Scan analytics for the trackable QR codes you have created." },
  "stats.empty": { en: "No trackable QR codes yet. Create one on the Generate tab." },
  "stats.back": { en: "← Back to list" },
  "stats.loading": { en: "Loading…" },
  "stats.total": { en: "Total scans" },
  "stats.unique": { en: "Unique" },
  "stats.destination": { en: "Destination" },
  "stats.byDay": { en: "Scans per day" },
  "stats.byCountry": { en: "By country" },
  "stats.byDevice": { en: "By device" },
  "stats.refresh": { en: "Refresh" },
  "stats.refreshing": { en: "Refreshing…" },
  "stats.updated": { en: "Updated {time}" },
  "stats.hint": { en: "Phone scans are counted when the phone is on the same Wi-Fi network as this computer. Tap Refresh to update." },
  "stats.unauthorized": { en: "Stats access denied. The backend API key may have changed — try refreshing." },

  // Settings — Dynamic QR backend
  "set.dynamicGroup": { en: "Dynamic QR (analytics)" },
  "set.dynamicHint": { en: "backend · API key · local server" },
  "set.dynamicBackend": { en: "Backend URL" },
  "set.dynamicBackendDesc": { en: "Base URL of your redirect/analytics server (e.g. https://qr.yourdomain.com)" },
  "set.dynamicApiKey": { en: "API key" },
  "set.dynamicApiKeyDesc": { en: "Secret used to create codes. Stored locally on this device." },

  // Settings — Appearance (accent color)
  "set.appearanceGroup": { en: "Appearance", "zh-CN": "外观", "zh-TW": "外觀", ja: "外観", ko: "화면 스타일", es: "Apariencia", fr: "Apparence", de: "Erscheinungsbild" },
  "set.accent": { en: "Accent color", "zh-CN": "主题色", "zh-TW": "主題色", ja: "アクセントカラー", ko: "강조 색상", es: "Color de acento", fr: "Couleur d'accentuation", de: "Akzentfarbe" },
  "set.accentDesc": { en: "Colors the buttons, tabs and highlights. Applies live; save to keep it.", "zh-CN": "用于按钮、标签页和高亮颜色。实时生效，保存后永久保留。", "zh-TW": "用於按鈕、分頁和高亮顏色。即時生效，儲存後永久保留。", ja: "ボタン・タブ・ハイライトの色になります。即時反映、保存すると保持されます。", ko: "버튼·탭·강조 표시의 색상입니다. 실시간 적용되며 저장하면 유지됩니다.", es: "Colorea los botones, las pestañas y los resaltes. Se aplica al instante; guárdalo para conservarlo.", fr: "Colore les boutons, onglets et éléments mis en valeur. Appliqué en direct ; enregistrez pour le conserver.", de: "Färbt Schaltflächen, Tabs und Hervorhebungen. Wird sofort angewendet; zum Beibehalten speichern." },

  // Modals — extension prompt
  "ext.title": { en: "Get the browser extension", "zh-CN": "获取浏览器扩展", "zh-TW": "取得瀏覽器擴充功能", ja: "ブラウザ拡張機能を入手", ko: "브라우저 확장 설치", es: "Obtén la extensión del navegador", fr: "Obtenez l'extension navigateur", de: "Hol dir die Browser-Erweiterung" },
  "ext.desc": { en: "Kuiqr works best with its browser extension. Would you like to download it now?", "zh-CN": "Kuiqr 配合浏览器扩展使用效果最佳。要现在下载吗？", "zh-TW": "Kuiqr 搭配瀏覽器擴充功能效果最佳。要現在下載嗎？", ja: "Kuiqrはブラウザ拡張機能と一緒に使うと最も便利です。今すぐダウンロードしますか？", ko: "Kuiqr는 브라우저 확장과 함께 사용할 때 가장 좋습니다. 지금 다운로드할까요?", es: "Kuiqr funciona mejor con su extensión de navegador. ¿Quieres descargarla ahora?", fr: "Kuiqr est meilleur avec son extension navigateur. Voulez-vous la télécharger maintenant ?", de: "Kuiqr ist am besten mit seiner Browser-Erweiterung. Möchtest du sie jetzt herunterladen?" },
  "ext.hint": { en: "You can install it later from the README if you change your mind.", "zh-CN": "如果改变主意，之后也可以从 README 安装。", "zh-TW": "如果改變主意，之後也可以從 README 安裝。", ja: "後でREADMEからインストールすることもできます。", ko: "나중에 마음이 바뀌면 README에서 설치할 수도 있습니다.", es: "Puedes instalarla luego desde el README si cambias de opinión.", fr: "Vous pourrez l'installer plus tard depuis le README si vous changez d'avis.", de: "Du kannst sie später aus der README installieren, falls du es dir anders überlegst." },
  "ext.chrome": { en: "Download for Chrome / Edge / Brave", "zh-CN": "下载用于 Chrome / Edge / Brave", "zh-TW": "下載用於 Chrome / Edge / Brave", ja: "Chrome / Edge / Brave 用をダウンロード", ko: "Chrome / Edge / Brave용 다운로드", es: "Descargar para Chrome / Edge / Brave", fr: "Télécharger pour Chrome / Edge / Brave", de: "Für Chrome / Edge / Brave herunterladen" },
  "ext.firefox": { en: "Download for Firefox", "zh-CN": "下载用于 Firefox", "zh-TW": "下載用於 Firefox", ja: "Firefox 用をダウンロード", ko: "Firefox용 다운로드", es: "Descargar para Firefox", fr: "Télécharger pour Firefox", de: "Für Firefox herunterladen" },
  "ext.later": { en: "Not now", "zh-CN": "暂不", "zh-TW": "暫不", ja: "後で", ko: "나중에", es: "Ahora no", fr: "Plus tard", de: "Nicht jetzt" },
  "ext.instr.title": { en: "Load it into your browser", "zh-CN": "在浏览器中加载", "zh-TW": "在瀏覽器中載入", ja: "ブラウザに読み込む", ko: "브라우저에 로드하기", es: "Cárgalo en tu navegador", fr: "Charge-le dans ton navigateur", de: "In deinem Browser laden" },
  "ext.instr.loading": { en: "Downloading…", "zh-CN": "下载中…", "zh-TW": "下載中…", ja: "ダウンロード中…", ko: "다운로드 중…", es: "Descargando…", fr: "Téléchargement…", de: "Wird heruntergeladen…" },
  "ext.instr.tabClosing": { en: "Tab closing in {n}…", "zh-CN": "窗口将在 {n} 秒后关闭…", "zh-TW": "視窗將在 {n} 秒後關閉…", ja: "{n}秒後にタブを閉じます…", ko: "{n}초 후에 탭이 닫힙니다…", es: "La pestaña se cerrará en {n}…", fr: "Fermeture de l'onglet dans {n}…", de: "Tab schließt in {n}…" },
  "ext.instr.tabClosingDone": { en: "Tab closing…", "zh-CN": "窗口即将关闭…", "zh-TW": "視窗即將關閉…", ja: "タブを閉じています…", ko: "탭을 닫는 중…", es: "Cerrando pestaña…", fr: "Fermeture de l'onglet…", de: "Tab wird geschlossen…" },
  "ext.instr.downloaded": { en: "Downloaded: {filename}", "zh-CN": "已下载：{filename}", "zh-TW": "已下載：{filename}", ja: "ダウンロード完了：{filename}", ko: "다운로드됨: {filename}", es: "Descargado: {filename}", fr: "Téléchargé : {filename}", de: "Heruntergeladen: {filename}" },
  "ext.instr.failed": { en: "Download failed: {reason}", "zh-CN": "下载失败：{reason}", "zh-TW": "下載失敗：{reason}", ja: "ダウンロード失敗：{reason}", ko: "다운로드 실패: {reason}", es: "Error de descarga: {reason}", fr: "Échec du téléchargement : {reason}", de: "Download fehlgeschlagen: {reason}" },

  // Modals — tutorial ask
  "tut.title": { en: "Take a quick tour?", "zh-CN": "要体验新手引导吗？", "zh-TW": "要體驗新手引導嗎？", ja: "簡単なツアーを始めますか？", ko: "빠른 둘러보기를 시작할까요?", es: "¿Hacer un recorrido rápido?", fr: "Faire une visite rapide ?", de: "Kurze Tour machen?" },
  "tut.desc": { en: "Would you like a guided tour to show you how Kuiqr works? It only takes a minute.", "zh-CN": "要来一段新手引导，了解 Kuiqr 的用法吗？只需一分钟。", "zh-TW": "要來一段新手引導，了解 Kuiqr 的用法嗎？只需一分鐘。", ja: "Kuiqrの使い方を案内するツアーをしますか？1分で終わります。", ko: "Kuiqr 사용법을 안내하는 둘러보기를 할까요? 1분이면 충분합니다.", es: "¿Quieres un recorrido guiado para ver cómo funciona Kuiqr? Solo toma un minuto.", fr: "Veux-tu une visite guidée pour découvrir Kuiqr ? Ça prend une minute.", de: "Möchtest du eine geführte Tour, die Kuiqr erklärt? Dauert nur eine Minute." },
  "tut.hint": { en: "You can always replay it later from Settings → Tutorial.", "zh-CN": "之后随时可在 设置 → 新手教程 重新体验。", "zh-TW": "之後隨時可在 設定 → 新手教學 重新體驗。", ja: "後で 設定 → チュートリアル からいつでも再再生できます。", ko: "나중에 설정 → 튜토리얼에서 언제든 다시 볼 수 있습니다.", es: "Siempre puedes volver a verlo en Ajustes → Tutorial.", fr: "Tu peux le relancer plus tard depuis Paramètres → Tutoriel.", de: "Du kannst es später jederzeit unter Einstellungen → Tutorial erneut starten." },
  "tut.enter": { en: "Enter Tutorial", "zh-CN": "进入教程", "zh-TW": "進入教學", ja: "ツアーを開始", ko: "투어 시작", es: "Entrar al tutorial", fr: "Entrer dans le tutoriel", de: "Tutorial starten" },
  "tut.later": { en: "Maybe later", "zh-CN": "以后再说", "zh-TW": "以後再說", ja: "後で", ko: "나중에", es: "Quizás luego", fr: "Plus tard", de: "Vielleicht später" },

  // Modals — unsaved
  "unsaved.title": { en: "Unsaved changes", "zh-CN": "未保存的更改", "zh-TW": "未儲存的變更", ja: "未保存の変更", ko: "저장되지 않은 변경사항", es: "Cambios sin guardar", fr: "Modifications non enregistrées", de: "Nicht gespeicherte Änderungen" },
  "unsaved.desc": { en: "You have unsaved settings changes. Save them before leaving?", "zh-CN": "你有未保存的设置更改。离开前要保存吗？", "zh-TW": "你有未儲存的設定變更。離開前要儲存嗎？", ja: "保存されていない設定の変更があります。終了前に保存しますか？", ko: "저장되지 않은 설정 변경이 있습니다. 나가기 전에 저장할까요?", es: "Tienes cambios sin guardar. ¿Guardarlos antes de salir?", fr: "Vous avez des modifications non enregistrées. Les sauvegarder avant de quitter ?", de: "Es gibt nicht gespeicherte Änderungen. Vor dem Verlassen speichern?" },
  "unsaved.save": { en: "Save changes", "zh-CN": "保存更改", "zh-TW": "儲存變更", ja: "変更を保存", ko: "변경 저장", es: "Guardar cambios", fr: "Enregistrer les modifications", de: "Änderungen speichern" },
  "unsaved.discard": { en: "Discard changes", "zh-CN": "放弃更改", "zh-TW": "放棄變更", ja: "変更を破棄", ko: "변경 버리기", es: "Descartar cambios", fr: "Ignorer les modifications", de: "Änderungen verwerfen" },

  // Preview + Context menu
  "preview.title": { en: "Scanned Image", "zh-CN": "已扫描图片", "zh-TW": "已掃描圖片", ja: "スキャンした画像", ko: "스캔한 이미지", es: "Imagen escaneada", fr: "Image scannée", de: "Gescanntes Bild" },
  "preview.clear": { en: "Clear", "zh-CN": "清除", "zh-TW": "清除", ja: "クリア", ko: "지우기", es: "Borrar", fr: "Effacer", de: "Löschen" },
  "ctx.scan": { en: "Scan QR Code", "zh-CN": "扫描二维码", "zh-TW": "掃描 QR Code", ja: "QRコードをスキャン", ko: "QR 코드 스캔", es: "Escanear QR", fr: "Scanner le QR", de: "QR scannen" },
  "ctx.paste": { en: "Paste Image", "zh-CN": "粘贴图片", "zh-TW": "貼上圖片", ja: "画像を貼り付け", ko: "이미지 붙여넣기", es: "Pegar imagen", fr: "Coller l'image", de: "Bild einfügen" },
  "ctx.settings": { en: "Settings", "zh-CN": "设置", "zh-TW": "設定", ja: "設定", ko: "설정", es: "Ajustes", fr: "Paramètres", de: "Einstellungen" },
  "ctx.quit": { en: "Quit", "zh-CN": "退出", "zh-TW": "結束", ja: "終了", ko: "종료", es: "Salir", fr: "Quitter", de: "Beenden" },

  // Dynamic messages (app.js)
  "clip.noImage": { en: "No image found in clipboard.", "zh-CN": "剪贴板中没有找到图片。", "zh-TW": "剪貼簿中沒有找到圖片。", ja: "クリップボードに画像が見つかりません。", ko: "클립보드에서 이미지를 찾을 수 없습니다.", es: "No se encontró ninguna imagen en el portapapeles.", fr: "Aucune image trouvée dans le presse-papiers.", de: "Kein Bild in der Zwischenablage gefunden." },
  "clip.hint": { en: "Copy an image first, then paste (⌘V).", "zh-CN": "先复制一张图片，然后粘贴（⌘V）。", "zh-TW": "先複製一張圖片，然後貼上（⌘V）。", ja: "先に画像をコピーしてから貼り付け（⌘V）してください。", ko: "먼저 이미지를 복사한 뒤 붙여넣기(⌘V)하세요.", es: "Copia una imagen primero y luego pégala (⌘V).", fr: "Copiez d'abord une image, puis collez (⌘V).", de: "Kopiere zuerst ein Bild und füge es dann ein (⌘V)." },
  "clip.err": { en: "Could not read clipboard.", "zh-CN": "无法读取剪贴板。", "zh-TW": "無法讀取剪貼簿。", ja: "クリップボードを読み取れませんでした。", ko: "클립보드를 읽을 수 없습니다.", es: "No se pudo leer el portapapeles.", fr: "Impossible de lire le presse-papiers.", de: "Zwischenablage konnte nicht gelesen werden." },
  "noQr": { en: "No QR code detected", "zh-CN": "未检测到二维码", "zh-TW": "未偵測到 QR Code", ja: "QRコードが見つかりません", ko: "QR 코드를 찾을 수 없음", es: "No se detectó ningún QR", fr: "Aucun QR code détecté", de: "Kein QR-Code erkannt" },
  "noQr.sub": { en: "Try a clearer image or use screen-area selection instead.", "zh-CN": "请尝试更清晰的图片，或使用屏幕区域选择。", "zh-TW": "請嘗試更清晰的圖片，或使用螢幕區域選擇。", ja: "より鮮明な画像を試すか、画面範囲選択を使ってください。", ko: "더 선명한 이미지를 쓰거나 화면 영역 선택을 사용하세요.", es: "Prueba con una imagen más nítida o usa la selección de área de pantalla.", fr: "Essaie une image plus nette ou la sélection de zone à l'écran.", de: "Versuche ein klareres Bild oder die Bildschirmbereichsauswahl." },
  "decode.err": { en: "Failed to decode image", "zh-CN": "解码图片失败", "zh-TW": "解碼圖片失敗", ja: "画像の解析に失敗しました", ko: "이미지 디코딩 실패", es: "No se pudo decodificar la imagen", fr: "Échec du décodage de l'image", de: "Bild konnte nicht decodiert werden" },
  "load.err": { en: "Failed to load image", "zh-CN": "加载图片失败", "zh-TW": "載入圖片失敗", ja: "画像の読み込みに失敗しました", ko: "이미지 로드 실패", es: "No se pudo cargar la imagen", fr: "Échec du chargement de l'image", de: "Bild konnte nicht geladen werden" },
  "load.err.sub": { en: "The file may be corrupted or unsupported.", "zh-CN": "文件可能已损坏或不受支持。", "zh-TW": "檔案可能已損毀或不支援。", ja: "ファイルが破損しているか、対応していない可能性があります。", ko: "파일이 손상되었거나 지원되지 않을 수 있습니다.", es: "El archivo puede estar dañado o no ser compatible.", fr: "Le fichier est peut-être corrompu ou non pris en charge.", de: "Die Datei ist möglicherweise beschädigt oder nicht unterstützt." },
  "scanFailed": { en: "Scan Failed", "zh-CN": "扫描失败", "zh-TW": "掃描失敗", ja: "スキャン失敗", ko: "스캔 실패", es: "Escaneo fallido", fr: "Échec du scan", de: "Scan fehlgeschlagen" },
  "scanFailedMsg": { en: "The captured image could not be processed.", "zh-CN": "无法处理捕获的图像。", "zh-TW": "無法處理擷取的影像。", ja: "キャプチャした画像を処理できませんでした。", ko: "캡처한 이미지를 처리할 수 없습니다.", es: "No se pudo procesar la imagen capturada.", fr: "L'image capturée n'a pas pu être traitée.", de: "Das aufgenommene Bild konnte nicht verarbeitet werden." },
  "starting": { en: "Starting capture…", "zh-CN": "正在启动捕获…", "zh-TW": "正在啟動擷取…", ja: "キャプチャを開始中…", ko: "캡처 시작 중…", es: "Iniciando captura…", fr: "Démarrage de la capture…", de: "Aufnahme wird gestartet…" },
  "result.open": { en: "Open in Browser", "zh-CN": "在浏览器打开", "zh-TW": "在瀏覽器開啟", ja: "ブラウザで開く", ko: "브라우저에서 열기", es: "Abrir en el navegador", fr: "Ouvrir dans le navigateur", de: "Im Browser öffnen" },
  "result.copy": { en: "Copy to Clipboard", "zh-CN": "复制到剪贴板", "zh-TW": "複製到剪貼簿", ja: "クリップボードにコピー", ko: "클립보드에 복사", es: "Copiar al portapapeles", fr: "Copier dans le presse-papiers", de: "In Zwischenablage kopieren" },
  "result.copied": { en: "Copied!", "zh-CN": "已复制！", "zh-TW": "已複製！", ja: "コピーしました！", ko: "복사됨!", es: "¡Copiado!", fr: "Copié !", de: "Kopiert!" },
  "result.trackableSub": { en: "This is your trackable short link. It redirects to: {url}", "zh-CN": "这是你的可追踪短链接，会跳转到：{url}", "zh-TW": "這是你的可追蹤短連結，會跳轉到：{url}", ja: "これはトラッキング用ショートリンクです。次へリダイレクトされます：{url}", ko: "추적 가능한 짧은 링크입니다. 다음 주소로 이동합니다: {url}", es: "Este es tu enlace corto rastreable. Redirige a: {url}", fr: "Ceci est votre lien court traçable. Il redirige vers : {url}", de: "Dies ist dein trackbarer Kurzlink. Er leitet weiter zu: {url}" },
  "result.openDest": { en: "Open destination", "zh-CN": "打开目标链接", "zh-TW": "開啟目標連結", ja: "リンク先を開く", ko: "대상 링크 열기", es: "Abrir destino", fr: "Ouvrir la destination", de: "Ziel öffnen" },
  "result.copyShortLink": { en: "Copy short link", "zh-CN": "复制短链接", "zh-TW": "複製短連結", ja: "ショートリンクをコピー", ko: "짧은 링크 복사", es: "Copiar enlace corto", fr: "Copier le lien court", de: "Kurzlink kopieren" },
  "hist.type.url": { en: "URL", "zh-CN": "链接", "zh-TW": "連結", ja: "URL", ko: "URL", es: "URL", fr: "URL", de: "URL" },
  "hist.type.text": { en: "Text", "zh-CN": "文本", "zh-TW": "文字", ja: "テキスト", ko: "텍스트", es: "Texto", fr: "Texte", de: "Text" },
  "hist.type.trackable": { en: "Trackable QR", "zh-CN": "可追踪二维码", "zh-TW": "可追蹤 QR Code", ja: "トラッキングQR", ko: "추적 가능 QR", es: "QR rastreable", fr: "QR traçable", de: "Trackbares QR" },
  "hist.type.noqr": { en: "No QR", "zh-CN": "无二维码", "zh-TW": "無 QR", ja: "QRなし", ko: "QR 없음", es: "Sin QR", fr: "Pas de QR", de: "Kein QR" },
  "hist.type.wifi": { en: "Wi-Fi", "zh-CN": "Wi-Fi", "zh-TW": "Wi-Fi", ja: "Wi-Fi", ko: "Wi-Fi", es: "Wi-Fi", fr: "Wi-Fi", de: "WLAN" },
  "hist.type.vcard": { en: "Contact", "zh-CN": "联系人", "zh-TW": "聯絡人", ja: "連絡先", ko: "연락처", es: "Contacto", fr: "Contact", de: "Kontakt" },
  "hist.type.event": { en: "Event", "zh-CN": "日程", "zh-TW": "行程", ja: "イベント", ko: "일정", es: "Evento", fr: "Événement", de: "Termin" },
  "hist.type.geo": { en: "Location", "zh-CN": "位置", "zh-TW": "位置", ja: "場所", ko: "위치", es: "Ubicación", fr: "Lieu", de: "Ort" },
  "hist.type.tel": { en: "Phone", "zh-CN": "电话", "zh-TW": "電話", ja: "電話", ko: "전화", es: "Teléfono", fr: "Téléphone", de: "Telefon" },
  "hist.type.sms": { en: "SMS", "zh-CN": "短信", "zh-TW": "簡訊", ja: "SMS", ko: "문자", es: "SMS", fr: "SMS", de: "SMS" },
  "hist.type.mailto": { en: "Email", "zh-CN": "邮件", "zh-TW": "郵件", ja: "メール", ko: "이메일", es: "Correo", fr: "E-mail", de: "E-Mail" },
  "result.joinWifi": { en: "Connect to Wi-Fi", "zh-CN": "连接 Wi-Fi", "zh-TW": "連線 Wi-Fi", ja: "Wi-Fiに接続", ko: "Wi-Fi 연결", es: "Conectar al Wi-Fi", fr: "Se connecter au Wi-Fi", de: "Mit WLAN verbinden" },
  "result.joiningWifi": { en: "Connecting…", "zh-CN": "正在连接…", "zh-TW": "正在連線…", ja: "接続中…", ko: "연결 중…", es: "Conectando…", fr: "Connexion…", de: "Verbinde…" },
  "result.joinedWifi": { en: "Connected ✓", "zh-CN": "已连接 ✓", "zh-TW": "已連線 ✓", ja: "接続しました ✓", ko: "연결됨 ✓", es: "Conectado ✓", fr: "Connecté ✓", de: "Verbunden ✓" },
  "result.joinFailed": { en: "Could not connect — check the password", "zh-CN": "连接失败 — 请检查密码", "zh-TW": "連線失敗 — 請檢查密碼", ja: "接続できませんでした — パスワードを確認してください", ko: "연결할 수 없습니다 — 비밀번호를 확인하세요", es: "No se pudo conectar — comprueba la contraseña", fr: "Connexion impossible — vérifie le mot de passe", de: "Verbindung fehlgeschlagen — Passwort prüfen" },
  "result.wifiHiddenNote": { en: "Hidden network", "zh-CN": "隐藏网络", "zh-TW": "隱藏網路", ja: "非公開ネットワーク", ko: "숨겨진 네트워크", es: "Red oculta", fr: "Réseau masqué", de: "Verborgenes Netzwerk" },
  "result.addContact": { en: "Add to Contacts", "zh-CN": "添加到通讯录", "zh-TW": "加入通訊錄", ja: "連絡先に追加", ko: "연락처에 추가", es: "Añadir a Contactos", fr: "Ajouter aux Contacts", de: "Zu Kontakten hinzufügen" },
  "result.openedContact": { en: "Opened in Contacts ✓", "zh-CN": "已在通讯录中打开 ✓", "zh-TW": "已在通訊錄中開啟 ✓", ja: "連絡先で開きました ✓", ko: "연락처에서 열렸습니다 ✓", es: "Abierto en Contactos ✓", fr: "Ouvert dans Contacts ✓", de: "In Kontakte geöffnet ✓" },
  "result.addEvent": { en: "Add to Calendar", "zh-CN": "添加到日历", "zh-TW": "加入行事曆", ja: "カレンダーに追加", ko: "캘린더에 추가", es: "Añadir al Calendario", fr: "Ajouter au Calendrier", de: "Zum Kalender hinzufügen" },
  "result.openedEvent": { en: "Opened in Calendar ✓", "zh-CN": "已在日历中打开 ✓", "zh-TW": "已在行事曆中開啟 ✓", ja: "カレンダーで開きました ✓", ko: "캘린더에서 열렸습니다 ✓", es: "Abierto en Calendario ✓", fr: "Ouvert dans Calendrier ✓", de: "In Kalender geöffnet ✓" },
  "result.showInMaps": { en: "Show in Maps", "zh-CN": "在地图中显示", "zh-TW": "在地圖中顯示", ja: "マップで表示", ko: "지도에서 보기", es: "Mostrar en Mapas", fr: "Afficher dans Plans", de: "In Karten anzeigen" },
  "result.callNumber": { en: "Call", "zh-CN": "拨打电话", "zh-TW": "撥打電話", ja: "電話をかける", ko: "전화 걸기", es: "Llamar", fr: "Appeler", de: "Anrufen" },
  "result.sendMessage": { en: "Send Message", "zh-CN": "发送短信", "zh-TW": "傳送簡訊", ja: "メッセージを送る", ko: "문자 보내기", es: "Enviar mensaje", fr: "Envoyer un message", de: "Nachricht senden" },
  "result.sendEmail": { en: "Send Email", "zh-CN": "发送邮件", "zh-TW": "傳送郵件", ja: "メールを送る", ko: "이메일 보내기", es: "Enviar correo", fr: "Envoyer un e-mail", de: "E-Mail senden" },
  "result.openingApp": { en: "Opening…", "zh-CN": "正在打开…", "zh-TW": "正在開啟…", ja: "開いています…", ko: "여는 중…", es: "Abriendo…", fr: "Ouverture…", de: "Wird geöffnet…" },
  "result.actionFailed": { en: "Failed", "zh-CN": "失败", "zh-TW": "失敗", ja: "失敗しました", ko: "실패", es: "Error", fr: "Échec", de: "Fehlgeschlagen" },
  "hist.type.unknown": { en: "Unknown", "zh-CN": "未知", "zh-TW": "未知", ja: "不明", ko: "알 수 없음", es: "Desconocido", fr: "Inconnu", de: "Unbekannt" },
  "hist.noqr": { en: "No QR code detected", "zh-CN": "未检测到二维码", "zh-TW": "未偵測到 QR Code", ja: "QRコードが見つかりません", ko: "QR 코드를 찾을 수 없음", es: "No se detectó ningún QR", fr: "Aucun QR code détecté", de: "Kein QR-Code erkannt" },
  "time.justnow": { en: "Just now", "zh-CN": "刚刚", "zh-TW": "剛剛", ja: "たった今", ko: "방금", es: "Ahora mismo", fr: "À l'instant", de: "Gerade eben" },
  "time.mago": { en: "{n}m ago", "zh-CN": "{n} 分钟前", "zh-TW": "{n} 分鐘前", ja: "{n}分前", ko: "{n}분 전", es: "hace {n}m", fr: "il y a {n}m", de: "vor {n} Min." },
  "time.hago": { en: "{n}h ago", "zh-CN": "{n} 小时前", "zh-TW": "{n} 小時前", ja: "{n}時間前", ko: "{n}시간 전", es: "hace {n}h", fr: "il y a {n}h", de: "vor {n} Std." },
  "platform.running": { en: "Running on: {platform}", "zh-CN": "运行平台：{platform}", "zh-TW": "執行平台：{platform}", ja: "実行環境：{platform}", ko: "실행 환경: {platform}", es: "Ejecutándose en: {platform}", fr: "Exécution sur : {platform}", de: "Läuft auf: {platform}" },
  "shortcut.recordLabel": { en: "Current: {shortcut} — click to change", "zh-CN": "当前：{shortcut} —— 点击更改", "zh-TW": "目前：{shortcut} —— 點擊更改", ja: "現在：{shortcut} — クリックで変更", ko: "현재: {shortcut} — 클릭하여 변경", es: "Actual: {shortcut} — haz clic para cambiar", fr: "Actuel : {shortcut} — cliquez pour changer", de: "Aktuell: {shortcut} — zum Ändern klicken" },
  "shortcut.press": { en: "Press a key combination now…  (Esc to cancel)", "zh-CN": "现在请按下组合键…（Esc 取消）", "zh-TW": "現在請按下組合鍵…（Esc 取消）", ja: "キーを組み合わせて押してください…（Escでキャンセル）", ko: "지금 키 조합을 누르세요…(Esc 취소)", es: "Pulsa una combinación de teclas ahora…  (Esc para cancelar)", fr: "Appuie sur une combinaison maintenant…  (Échap pour annuler)", de: "Drücke jetzt eine Tastenkombination…  (Esc zum Abbrechen)" },
  "shortcut.saved": { en: "Saved! Press Record to change it again.", "zh-CN": "已保存！再次点击“录制”可更改。", "zh-TW": "已儲存！再次點擊「錄製」可更改。", ja: "保存しました！もう一度「録制」をクリックで変更できます。", ko: "저장됨! 다시 변경하려면 녹화를 누르세요.", es: "¡Guardado! Pulsa Grabar para cambiarlo de nuevo.", fr: "Enregistré ! Cliquez sur Enregistrer pour changer à nouveau.", de: "Gespeichert! Klicke Aufnehmen, um es erneut zu ändern." },
  "shortcut.cancelled": { en: "Cancelled. Press Record to set a shortcut.", "zh-CN": "已取消。点击“录制”设置快捷键。", "zh-TW": "已取消。點擊「錄製」設定快捷鍵。", ja: "キャンセルしました。「録制」をクリックして設定。", ko: "취소됨. 단축키를 설정하려면 녹화를 누르세요.", es: "Cancelado. Pulsa Grabar para fijar un atajo.", fr: "Annulé. Cliquez sur Enregistrer pour définir un raccourci.", de: "Abgebrochen. Klicke Aufnehmen, um ein Kürzel zu setzen." },
  "shortcut.checking": { en: "Checking…", "zh-CN": "检查中…", "zh-TW": "檢查中…", ja: "確認中…", ko: "확인 중…", es: "Comprobando…", fr: "Vérification…", de: "Überprüfung…" },
  "shortcut.cantUse": { en: "That combination can't be used. Try another.", "zh-CN": "该组合无法使用，请换一个。", "zh-TW": "該組合無法使用，請換一個。", ja: "その組み合わせは使えません。別のものをお試しください。", ko: "그 조합은 사용할 수 없습니다. 다른 것을 시도하세요.", es: "Esa combinación no se puede usar. Prueba otra.", fr: "Cette combinaison ne peut pas être utilisée. Essaie une autre.", de: "Diese Kombination kann nicht verwendet werden. Versuch eine andere." },
  "genDown": { en: "QR Code Downloaded", "zh-CN": "二维码已下载", "zh-TW": "QR Code 已下載", ja: "QRコードをダウンロードしました", ko: "QR 코드 다운로드됨", es: "QR descargado", fr: "QR téléchargé", de: "QR heruntergeladen" },
  "genDownSub": { en: "Saved as qrcode.png.", "zh-CN": "已保存为 qrcode.png。", "zh-TW": "已儲存為 qrcode.png。", ja: "qrcode.png として保存しました。", ko: "qrcode.png로 저장되었습니다.", es: "Guardado como qrcode.png.", fr: "Enregistré en qrcode.png.", de: "Gespeichert als qrcode.png." },
  "qrCopied": { en: "QR Code Copied", "zh-CN": "二维码已复制", "zh-TW": "QR Code 已複製", ja: "QRコードをコピーしました", ko: "QR 코드 복사됨", es: "QR copiado", fr: "QR copié", de: "QR kopiert" },
  "qrCopiedSub": { en: "The QR code image has been copied to your clipboard.", "zh-CN": "二维码图片已复制到剪贴板。", "zh-TW": "QR Code 圖片已複製到剪貼簿。", ja: "QRコード画像をクリップボードにコピーしました。", ko: "QR 코드 이미지를 클립보드에 복사했습니다.", es: "La imagen del QR se copió al portapapeles.", fr: "L'image du QR a été copiée dans le presse-papiers.", de: "Das QR-Bild wurde in die Zwischenablage kopiert." },
  "copyFail": { en: "Copy Failed", "zh-CN": "复制失败", "zh-TW": "複製失敗", ja: "コピー失敗", ko: "복사 실패", es: "Fallo al copiar", fr: "Échec de la copie", de: "Kopieren fehlgeschlagen" },
  "textCopied": { en: "Text Copied", "zh-CN": "文本已复制", "zh-TW": "文字已複製", ja: "テキストをコピーしました", ko: "텍스트 복사됨", es: "Texto copiado", fr: "Texte copié", de: "Text kopiert" },
  "textCopiedSub": { en: "The QR content has been copied to your clipboard.", "zh-CN": "二维码内容已复制到剪贴板。", "zh-TW": "QR 內容已複製到剪貼簿。", ja: "QRの内容をクリップボードにコピーしました。", ko: "QR 내용을 클립보드에 복사했습니다.", es: "El contenido del QR se copió al portapapeles.", fr: "Le contenu du QR a été copié dans le presse-papiers.", de: "Der QR-Inhalt wurde in die Zwischenablage kopiert." },
  "update.toast.title": { en: "Update available", "zh-CN": "有可用更新", "zh-TW": "有可用更新", ja: "アップデートあり", ko: "업데이트 있음", es: "Actualización disponible", fr: "Mise à jour disponible", de: "Update verfügbar" },
  "update.toast.content": { en: "A new version {latest} is available.", "zh-CN": "新版本 {latest} 已发布。", "zh-TW": "新版本 {latest} 已發布。", ja: "新しいバージョン {latest} が利用可能です。", ko: "새 버전 {latest}을(를) 사용할 수 있습니다.", es: "Hay una nueva versión {latest} disponible.", fr: "Une nouvelle version {latest} est disponible.", de: "Eine neue Version {latest} ist verfügbar." },

  // Tutorial steps (array form; see getSteps)
  "tut.stepLabel": { en: "Step {n} of {m}", "zh-CN": "第 {n} / {m} 步", "zh-TW": "第 {n} / {m} 步", ja: "ステップ {n} / {m}", ko: "{m} 중 {n}단계", es: "Paso {n} de {m}", fr: "Étape {n} sur {m}", de: "Schritt {n} von {m}" },
  "tut.next": { en: "Next", "zh-CN": "下一步", "zh-TW": "下一步", ja: "次へ", ko: "다음", es: "Siguiente", fr: "Suivant", de: "Weiter" },
  "tut.done": { en: "Done", "zh-CN": "完成", "zh-TW": "完成", ja: "完了", ko: "완료", es: "Listo", fr: "Terminer", de: "Fertig" },
  "tut.skip": { en: "Skip", "zh-CN": "跳过", "zh-TW": "跳過", ja: "スキップ", ko: "건너뛰기", es: "Omitir", fr: "Ignorer", de: "Überspringen" },

  "tut.back": { en: "Back", "zh-CN": "返回", "zh-TW": "返回", ja: "戻る", ko: "이전", es: "Atrás", fr: "Retour", de: "Zurück" },

  // First-launch setup wizard (language → extension → guide → done)
  "setup.welcome.title": { en: "Welcome to Kuiqr", "zh-CN": "欢迎使用 Kuiqr", "zh-TW": "歡迎使用 Kuiqr", ja: "Kuiqr へようこそ", ko: "Kuiqr에 오신 것을 환영합니다", es: "Bienvenido a Kuiqr", fr: "Bienvenue dans Kuiqr", de: "Willkommen bei Kuiqr" },
  "setup.welcome.desc": { en: "Kuiqr scans QR codes from anywhere on your screen with a single shortcut. Let's get you set up in a few quick steps.", "zh-CN": "Kuiqr 用一次快捷键就能扫描屏幕上任意位置的二维码。让我们用几个简单步骤完成设置。", "zh-TW": "Kuiqr 用一次快捷鍵就能掃描螢幕上任意位置的 QR Code。讓我們用幾個簡單步驟完成設定。", ja: "Kuiqr はショートカット一つで画面のどこにある QR コードでも読み取れます。いくつかの簡単なステップで設定を済ませましょう。", ko: "Kuiqr는 단축키 하나로 화면 어디에 있는 QR 코드든 스캔합니다. 몇 가지 간단한 단계로 설정을 마쳐 보세요.", es: "Kuiqr escanea códigos QR de cualquier parte de tu pantalla con un solo atajo. Configuremos la app en unos pasos rápidos.", fr: "Kuiqr lit les QR codes n'importe où sur ton écran avec un seul raccourci. Réglons tout en quelques étapes rapides.", de: "Kuiqr liest QR-Codes überall auf deinem Bildschirm mit einem einzigen Shortcut. Richten wir es in wenigen Schritten ein." },
  "setup.language.title": { en: "Choose your language", "zh-CN": "选择你的语言", "zh-TW": "選擇你的語言", ja: "言語を選択", ko: "언어 선택", es: "Elige tu idioma", fr: "Choisis ta langue", de: "Wähle deine Sprache" },
  "setup.language.desc": { en: "You can change this anytime in Settings.", "zh-CN": "你可以随时在“设置”中更改。", "zh-TW": "你可以隨時在「設定」中更改。", ja: "いつでも設定から変更できます。", ko: "언제든 설정에서 변경할 수 있습니다.", es: "Puedes cambiarlo cuando quieras en Ajustes.", fr: "Tu peux le changer à tout moment dans les Réglages.", de: "Du kannst es jederzeit in den Einstellungen ändern." },
  "setup.ext.title": { en: "Install the browser extension", "zh-CN": "安装浏览器扩展", "zh-TW": "安裝瀏覽器擴充功能", ja: "ブラウザ拡張機能をインストール", ko: "브라우저 확장 프로그램 설치", es: "Instala la extensión del navegador", fr: "Installe l'extension de navigateur", de: "Installiere die Browser-Erweiterung" },
  "setup.ext.desc": { en: "Lets you scan QR codes directly from web pages with a right-click. Optional, but handy.", "zh-CN": "让你在网页上右键即可扫描二维码。可选，但很实用。", "zh-TW": "讓你在網頁上右鍵即可掃描 QR Code。可選，但很實用。", ja: "ウェブページで右クリックするだけで QR コードを読み取れます。任意ですが便利です。", ko: "웹페이지에서 마우스 오른쪽 버튼으로 QR 코드를 바로 스캔할 수 있습니다. 선택 사항이지만 유용합니다.", es: "Te permite escanear códigos QR directamente desde páginas web con clic derecho. Opcional, pero útil.", fr: "Permet de scanner les QR codes des pages web d'un clic droit. Optionnel, mais pratique.", de: "Ermöglicht das Scannen von QR-Codes direkt aus Webseiten per Rechtsklick. Optional, aber nützlich." },
  "setup.guide.title": { en: "Take a quick tour?", "zh-CN": "来一次快速导览？", "zh-TW": "來一次快速導覽？", ja: "簡単なツアーをしますか？", ko: "간단한 둘러보기를 할까요?", es: "¿Un tour rápido?", fr: "Faire une petite visite ?", de: "Kleine Tour mitmachen?" },
  "setup.guide.desc": { en: "We'll show you how scanning, history, and generating work. It only takes a minute.", "zh-CN": "我们会演示扫描、历史记录和生成功能。只需一分钟。", "zh-TW": "我們會示範掃描、歷史記錄與產生功能。只需一分鐘。", ja: "スキャン・履歴・生成の使い方をお見せします。1 分で終わります。", ko: "스캔, 기록, 생성 기능을 보여드립니다. 1분이면 충분합니다.", es: "Te mostraremos cómo funcionan el escaneo, el historial y la generación. Solo toma un minuto.", fr: "On te montre comment marchent le scan, l'historique et la génération. Ça prend une minute.", de: "Wir zeigen dir, wie Scannen, Verlauf und Erstellen funktionieren. Dauert nur eine Minute." },
  "setup.guide.takeTour": { en: "Take the tour", "zh-CN": "开始导览", "zh-TW": "開始導覽", ja: "ツアーを始める", ko: "둘러보기 시작", es: "Hacer el tour", fr: "Faire la visite", de: "Tour starten" },
  "setup.guide.skipTour": { en: "Skip tour", "zh-CN": "跳过导览", "zh-TW": "跳過導覽", ja: "ツアーをスキップ", ko: "둘러보기 건너뛰기", es: "Omitir el tour", fr: "Ignorer la visite", de: "Tour überspringen" },
  "setup.done.title": { en: "You're all set", "zh-CN": "一切就绪", "zh-TW": "一切就緒", ja: "準備完了", ko: "모두 준비되었습니다", es: "Todo listo", fr: "C'est prêt", de: "Alles bereit" },
  "setup.done.desc": { en: "Press the shortcut or drop in an image to scan your first code. Welcome aboard!", "zh-CN": "按下快捷键或拖入图片即可扫描你的第一个二维码。欢迎使用！", "zh-TW": "按下快捷鍵或拖入圖片即可掃描你的第一個 QR Code。歡迎使用！", ja: "ショートカットを押すか画像をドロップして、最初の QR コードを読み取ってみましょう。ようこそ！", ko: "단축키를 누르거나 이미지를 넣어 첫 QR 코드를 스캔해 보세요. 환영합니다!", es: "Pulsa el atajo o suelta una imagen para escanear tu primer código. ¡Bienvenido!", fr: "Appuie sur le raccourci ou dépose une image pour scanner ton premier code. Bienvenue !", de: "Drücke den Shortcut oder zieh ein Bild ein, um deinen ersten Code zu scannen. Willkommen!" },
  "setup.next": { en: "Next", "zh-CN": "下一步", "zh-TW": "下一步", ja: "次へ", ko: "다음", es: "Siguiente", fr: "Suivant", de: "Weiter" },
  "setup.back": { en: "Back", "zh-CN": "返回", "zh-TW": "返回", ja: "戻る", ko: "이전", es: "Atrás", fr: "Retour", de: "Zurück" },
  "setup.skip": { en: "Skip setup", "zh-CN": "跳过设置", "zh-TW": "跳過設定", ja: "セットアップをスキップ", ko: "설정 건너뛰기", es: "Omitir configuración", fr: "Ignorer la config", de: "Setup überspringen" },
  "setup.getStarted": { en: "Get started", "zh-CN": "开始", "zh-TW": "開始", ja: "始める", ko: "시작하기", es: "Empezar", fr: "Commencer", de: "Loslegen" },
  "setup.finish": { en: "Finish", "zh-CN": "完成", "zh-TW": "完成", ja: "完了", ko: "완료", es: "Finalizar", fr: "Terminer", de: "Fertig" },
  "setup.stepCount": { en: "Step {current} of {total}", "zh-CN": "第 {current} 步，共 {total} 步", "zh-TW": "第 {current} 步，共 {total} 步", ja: "{total} ステップ中 {current} 番目", ko: "{total}단계 중 {current}단계", es: "Paso {current} de {total}", fr: "Étape {current} sur {total}", de: "Schritt {current} von {total}" },

  // ── QR Generator: templates (Step 1) ──
  "tpl.label": { en: "Template" },
  "tpl.text": { en: "Text / URL" },
  "tpl.wifi": { en: "WiFi" },
  "tpl.vcard": { en: "vCard (contact)" },
  "tpl.email": { en: "Email" },
  "tpl.sms": { en: "SMS" },
  "tpl.phone": { en: "Phone" },
  "tpl.event": { en: "Calendar event" },
  "tpl.geo": { en: "Geo location" },
  "tpl.wifi.ssid": { en: "Network name (SSID)" },
  "tpl.wifi.ssidPh": { en: "MyWiFi" },
  "tpl.wifi.enc": { en: "Encryption" },
  "tpl.wifi.wpa": { en: "WPA / WPA2" },
  "tpl.wifi.wep": { en: "WEP" },
  "tpl.wifi.nopass": { en: "No password" },
  "tpl.wifi.pass": { en: "Password" },
  "tpl.wifi.passPh": { en: "network password" },
  "tpl.wifi.hidden": { en: "Hidden network" },
  "tpl.vcard.name": { en: "Full name" },
  "tpl.vcard.namePh": { en: "Jane Doe" },
  "tpl.vcard.org": { en: "Organization" },
  "tpl.vcard.orgPh": { en: "Acme Inc" },
  "tpl.vcard.title": { en: "Job title" },
  "tpl.vcard.titlePh": { en: "Engineer" },
  "tpl.vcard.phone": { en: "Phone" },
  "tpl.vcard.phonePh": { en: "+1 555 0100" },
  "tpl.vcard.email": { en: "Email" },
  "tpl.vcard.emailPh": { en: "jane@acme.com" },
  "tpl.vcard.website": { en: "Website" },
  "tpl.vcard.websitePh": { en: "https://acme.com" },
  "tpl.email.email": { en: "Email address" },
  "tpl.email.emailPh": { en: "jane@acme.com" },
  "tpl.email.subject": { en: "Subject" },
  "tpl.email.subjectPh": { en: "Hello" },
  "tpl.email.body": { en: "Body" },
  "tpl.email.bodyPh": { en: "Your message…" },
  "tpl.sms.number": { en: "Phone number" },
  "tpl.sms.numberPh": { en: "+1 555 0100" },
  "tpl.sms.message": { en: "Message" },
  "tpl.sms.messagePh": { en: "Hi there!" },
  "tpl.phone.number": { en: "Phone number" },
  "tpl.phone.numberPh": { en: "+1 555 0100" },
  "tpl.event.start": { en: "Start" },
  "tpl.event.startPh": { en: "2026-08-27T14:00" },
  "tpl.event.end": { en: "End" },
  "tpl.event.endPh": { en: "2026-08-27T15:00" },
  "tpl.event.summary": { en: "Title" },
  "tpl.event.summaryPh": { en: "Meeting" },
  "tpl.event.location": { en: "Location" },
  "tpl.event.locationPh": { en: "Office" },
  "tpl.geo.lat": { en: "Latitude" },
  "tpl.geo.latPh": { en: "37.4219" },
  "tpl.geo.lng": { en: "Longitude" },
  "tpl.geo.lngPh": { en: "-122.0840" },
  "tpl.wifi.scan": { en: "Scan nearby" },
  "tpl.wifi.scanning": { en: "Scanning for networks…" },
  "tpl.wifi.none": { en: "No visible networks. macOS only shows the network you're connected to unless Location Services is enabled — you can still type the name." },
  "tpl.wifi.fail": { en: "Couldn't scan — you can still type the network name." },

  // ── QR Generator: styling (Step 2) ──
  "gen.style": { en: "Style & Colors" },
  "gen.styleHint": { en: "colors · logo · dots · quiet zone" },
  "gen.styleReset": { en: "Reset to default style" },
  "gen.exportHint": { en: "sizes · DPI · caption" },
  "gen.fg": { en: "Foreground" },
  "gen.bg": { en: "Background" },
  "gen.contrastLow": { en: "Contrast is too low — this QR may fail to scan. Use a darker foreground or lighter background." },
  "gen.contrastWeak": { en: "Low contrast — consider a darker foreground or lighter background for reliable scanning." },
  "gen.eccNote": { en: "A logo covers part of the code, so error correction was raised to High (H) to keep it scannable." },
  "gen.logo": { en: "Logo" },
  "gen.logoPick": { en: "Choose image…" },
  "gen.logoNone": { en: "Remove" },
  "gen.logoOk": { en: "Logo looks good — the code still decodes." },
  "gen.logoFail": { en: "Warning: the code no longer decodes with this logo. Use a smaller logo or higher error correction." },
  "gen.logoMismatch": { en: "Warning: decoded content differs from the input (the logo may be corrupting the code)." },
  "gen.dotStyle": { en: "Dot style" },
  "gen.dot.square": { en: "Square" },
  "gen.dot.rounded": { en: "Rounded" },
  "gen.dot.dots": { en: "Dots" },
  "gen.finderColor": { en: "Finder color" },
  "gen.finderDot": { en: "Center dot" },
  "gen.quiet": { en: "Quiet zone (modules)" },
  "gen.export": { en: "Export" },
  "gen.pngPreset": { en: "PNG size" },
  "gen.svgEdge": { en: "SVG size" },
  "gen.pdfSize": { en: "PDF size" },
  "gen.pdf.30mm": { en: "30 mm sticker" },
  "gen.pdf.50mm": { en: "50 mm sticker" },
  "gen.pdf.80mm": { en: "80 mm sticker" },
  "gen.pdf.card": { en: "Business card (90×50 mm)" },
  "gen.pdfCaption": { en: "Caption" },
  "gen.pdfLibMissing": { en: "PDF library failed to load." },
  "gen.exportSVG": { en: "Export SVG" },
  "gen.exportPDF": { en: "Export PDF" },

  // ── Batch generation (Step 4) ──
  "batch.btn": { en: "Batch from CSV…" },
  "batch.title": { en: "Batch generate from CSV" },
  "batch.csv": { en: "CSV file" },
  "batch.noCsv": { en: "No CSV selected" },
  "batch.template": { en: "Template" },
  "batch.map": { en: "Column mapping" },
  "batch.map.content": { en: "Content column" },
  "batch.map.hidden": { en: "Hidden column" },
  "batch.map.filename": { en: "Filename column (optional)" },
  "batch.outFolder": { en: "Output folder" },
  "batch.chooseFolder": { en: "Choose…" },
  "batch.includePNG": { en: "PNG" },
  "batch.includeSVG": { en: "SVG" },
  "batch.zip": { en: "Zip folder" },
  "batch.zipName": { en: "Zip name" },
  "batch.start": { en: "Generate" },
  "batch.close": { en: "Close" },
  "batch.cancel": { en: "Cancel" },
  "batch.running": { en: "Generated {n} / {total}" },
  "batch.done": { en: "Done. {done} generated, {skipped} skipped (of {total})." },
  "batch.needCsv": { en: "Please choose a CSV file." },
  "batch.needFolder": { en: "Please choose an output folder." },
  "batch.needFormat": { en: "Select at least one output format (PNG or SVG)." },
  "batch.zipped": { en: "Folder zipped." },
  "batch.zipFail": { en: "Could not zip: {reason}" },

  // ── Region watch (Step 5) ──
  "watch.btn": { en: "Region Watch…" },
  "watch.running": { en: "Watching region" },
  "watch.paused": { en: "Paused (Settings focused)" },
  "watch.stop": { en: "Stop Region Watch" },
  "watch.newRegion": { en: "New region…" },
  "watch.checking": { en: "Watching — checking every {ms}ms" },
  "watch.lastScan": { en: "Last scan: {code}" },

  // Dynamic (trackable) QR — help + local backend
  "set.dynamicHelpTitle": { en: "What is this? (Don't have a backend?)" },
  "set.dynamicHelp1": { en: "A trackable QR encodes a short redirect link instead of the final destination. When someone scans it, your server logs the visit and forwards them to the real page — so you can see how many times it was scanned." },
  "set.dynamicHelp2": { en: "Backend URL is the address of that server (e.g. https://qr.yourdomain.com). API key is a secret the app sends to create codes; you set it on the server and paste the same value here." },
  "set.dynamicHelp3": { en: "You don't need to buy anything. Kuiqr ships with a free, self-hosted backend you can run on this Mac with one click (button below). Or point it at your own server / a compatible service." },
  "set.dynamicLocalStart": { en: "Run local backend (free)" },
  "set.dynamicLocalStop": { en: "Stop local backend" },
  "set.dynamicLocalLanNote": { en: "Short links now use this machine's Wi-Fi address ({url}) — QR codes scanned on a phone on the same Wi-Fi will be counted. Keep this Mac awake and on the same network.", "zh-CN": "短链接现在使用本机的 Wi-Fi 地址（{url}）——在同一 Wi-Fi 下用手机扫描的二维码都会被统计。请保持这台 Mac 处于唤醒状态且与手机同一网络。", "zh-TW": "短連結現在使用本機的 Wi-Fi 位址（{url}）——在同一 Wi-Fi 下用手機掃描的 QR Code 都會被統計。請保持這台 Mac 保持喚醒且與手機同一網路。", ja: "ショートリンクはこのマシンのWi-Fiアドレス（{url}）を使用します。同じWi-Fi上のスマートフォンでスキャンされたQRコードがカウントされます。このMacをスリープせず、同じネットワークに接続しておいてください。", ko: "짧은 링크가 이 컴퓨터의 Wi-Fi 주소({url})를 사용합니다. 같은 Wi-Fi의 휴대폰에서 스캔한 QR 코드가 집계됩니다. 이 Mac을 절전 모드로 전환하지 말고 같은 네트워크에 유지하세요.", es: "Los enlaces cortos ahora usan la dirección Wi-Fi de este equipo ({url}); los códigos QR escaneados con un teléfono en la misma red se contarán. Mantén este Mac despierto y en la misma red.", fr: "Les liens courts utilisent désormais l'adresse Wi-Fi de cette machine ({url}) — les QR scannés depuis un téléphone sur le même Wi-Fi seront comptés. Garde ce Mac éveillé et sur le même réseau.", de: "Kurzlinks verwenden jetzt die WLAN-Adresse dieses Macs ({url}) — QR-Codes, die mit einem Telefon im selben WLAN gescannt werden, werden gezählt. Lasse den Mac wach und im selben Netzwerk." },
  "set.dynamicLocalStarting": { en: "Starting local backend…" },
  "set.dynamicLocalRunning": { en: "Local backend running at {url} — URL & key saved." },
  "set.dynamicLocalFailed": { en: "Could not start local backend: {reason}" },
  "set.dynamicLocalStopped": { en: "Local backend stopped." },
};

// ── Localized step lists ──
// Stored separately because they are arrays (tutorial + extension instructions).
const I18N_STEPS = {
  en: {
    tutorialSteps: [
      { sel: null, title: "Welcome to Kuiqr", text: "Kuiqr scans QR codes from anywhere on your screen with a single shortcut — and everything stays on your device. Let's take a quick tour." },
      { sel: "#tab-scan", title: "This is your scanner", text: "Everything lives in this little window. Keep it open while you work, or tuck it into your menu bar." },
      { sel: "#drop-zone", title: "Scan from an image", text: "Paste an image from your clipboard (⌘V) or drag & drop one here. Kuiqr decodes it instantly in this window." },
      { sel: "#scan-btn", title: "Or capture your screen", text: "Click this (or press the shortcut) to draw a box around any QR code on screen. Links open automatically; other text is copied for you." },
      { sel: ".tabs", title: "Four simple tabs", text: "Switch anytime between Scan, History, Settings, and Generate from here." },
      { sel: "#setting-shortcut-row", title: "Make it yours", text: "Record your own shortcut and choose what happens after a scan — notifications, auto-open links, and more." },
      { sel: "#tab-generate", title: "Need a QR instead?", text: "The Generate tab turns any link or text into a QR code you can download or copy." },
      { sel: null, title: "You're all set", text: "Press the shortcut or drop in an image to scan your first code. Welcome aboard!" },
    ],
    extChromeSteps: [
      "Unzip the downloaded file (<b>{file}</b>).",
      "Open <b>chrome://extensions</b> (or edge://extensions, brave://extensions).",
      "Turn on <b>Developer mode</b> (top-right corner).",
      "Click <b>Load unpacked</b> and select the unzipped folder.",
      "Right-click any QR image → <b>Scan QR Code</b>.",
    ],
    extFirefoxSteps: [
      "Unzip the downloaded file (<b>{file}</b>).",
      "Open <b>about:debugging#/runtime/this-firefox</b>.",
      "Click <b>Load Temporary Add-on</b>.",
      "Select <b>manifest.json</b> inside the unzipped folder.",
      "Right-click any QR image → <b>Scan QR Code</b>.",
    ],
  },
  "zh-CN": {
    tutorialSteps: [
      { sel: null, title: "欢迎使用 Kuiqr", text: "Kuiqr 只需一个快捷键，就能从屏幕任意位置扫描二维码，且全部在本地完成。让我们快速了解一下。" },
      { sel: "#tab-scan", title: "这是你的扫描器", text: "所有功能都在这个小窗口里。工作时保持打开，或把它收进菜单栏。" },
      { sel: "#drop-zone", title: "从图片扫描", text: "从剪贴板粘贴图片（⌘V），或将图片拖放此处。Kuiqr 会在此窗口即时解码。" },
      { sel: "#scan-btn", title: "或捕获屏幕", text: "点击它（或按快捷键），在屏幕上框选任意二维码。链接会自动打开，其他文本会为你复制。" },
      { sel: ".tabs", title: "四个简单标签", text: "随时在 扫描、历史、设置、生成 之间切换。" },
      { sel: "#setting-shortcut-row", title: "自定义你的设置", text: "录制你自己的快捷键，并选择扫描后的行为——通知、自动打开链接等。" },
      { sel: "#tab-generate", title: "需要生成二维码？", text: "生成标签可以把任意链接或文本变成可下载或复制的二维码。" },
      { sel: null, title: "一切就绪", text: "按下快捷键或拖入图片，扫描你的第一个二维码吧。欢迎使用！" },
    ],
    extChromeSteps: [
      "解压下载的文件（<b>{file}</b>）。",
      "打开 <b>chrome://extensions</b>（或 edge://extensions、brave://extensions）。",
      "打开右上角的 <b>开发者模式</b>。",
      "点击 <b>加载已解压的扩展程序</b> 并选择解压后的文件夹。",
      "在任意二维码图片上右键 → <b>扫描二维码</b>。",
    ],
    extFirefoxSteps: [
      "解压下载的文件（<b>{file}</b>）。",
      "打开 <b>about:debugging#/runtime/this-firefox</b>。",
      "点击 <b>临时载入附加组件</b>。",
      "选择解压后文件夹中的 <b>manifest.json</b>。",
      "在任意二维码图片上右键 → <b>扫描二维码</b>。",
    ],
  },
  "zh-TW": {
    tutorialSteps: [
      { sel: null, title: "歡迎使用 Kuiqr", text: "Kuiqr 只需一個快捷鍵，就能從螢幕任意位置掃描 QR Code，且全部在本地完成。讓我們快速了解一下。" },
      { sel: "#tab-scan", title: "這是你的掃描器", text: "所有功能都在这個小視窗裡。工作時保持開啟，或把它收進選單列。" },
      { sel: "#drop-zone", title: "從圖片掃描", text: "從剪貼簿貼上圖片（⌘V），或將圖片拖放至此。Kuiqr 會在此視窗即時解碼。" },
      { sel: "#scan-btn", title: "或擷取螢幕", text: "點擊它（或按快捷鍵），在螢幕上框選任意 QR Code。連結會自動開啟，其他文字會為你複製。" },
      { sel: ".tabs", title: "四個簡單標籤", text: "隨時在 掃描、歷史、設定、產生 之間切換。" },
      { sel: "#setting-shortcut-row", title: "自訂你的設定", text: "錄製你自己的快捷鍵，並選擇掃描後的行為——通知、自動開啟連結等。" },
      { sel: "#tab-generate", title: "需要產生 QR Code？", text: "產生標籤可以把任意連結或文字變成可下載或複製的 QR Code。" },
      { sel: null, title: "一切就緒", text: "按下快捷鍵或拖入圖片，掃描你的第一個 QR Code 吧。歡迎使用！" },
    ],
    extChromeSteps: [
      "解壓下載的檔案（<b>{file}</b>）。",
      "開啟 <b>chrome://extensions</b>（或 edge://extensions、brave://extensions）。",
      "開啟右上角的 <b>開發者模式</b>。",
      "點擊 <b>載入未封裝項目</b> 並選擇解壓後的資料夾。",
      "在任意 QR Code 圖片上右鍵 → <b>掃描 QR Code</b>。",
    ],
    extFirefoxSteps: [
      "解壓下載的檔案（<b>{file}</b>）。",
      "開啟 <b>about:debugging#/runtime/this-firefox</b>。",
      "點擊 <b>暫時載入附加元件</b>。",
      "選擇解壓後資料夾中的 <b>manifest.json</b>。",
      "在任意 QR Code 圖片上右鍵 → <b>掃描 QR Code</b>。",
    ],
  },
  ja: {
    tutorialSteps: [
      { sel: null, title: "Kuiqrへようこそ", text: "Kuiqrは画面のどこからでもショートカット一つでQRコードを読み取り、すべて端末内で処理します。さっそく簡単に案内します。" },
      { sel: "#tab-scan", title: "これがスキャナー", text: "すべてこの小さなウィンドウにあります。作業中は開いたまま、またはメニューバーにしまえます。" },
      { sel: "#drop-zone", title: "画像からスキャン", text: "クリップボードから画像を貼り付け（⌘V）、またはここにドラッグ＆ドロップ。このウィンドウですぐに読み取ります。" },
      { sel: "#scan-btn", title: "または画面をキャプチャ", text: "これをクリック（またはショートカット）すると、画面のQRコードを囲む枠を描けます。リンクは自動で開き、他のテキストはコピーされます。" },
      { sel: ".tabs", title: "4つのタブ", text: "スキャン・履歴・設定・生成をいつでも切り替えられます。" },
      { sel: "#setting-shortcut-row", title: "自分好みに", text: "ショートカットを録画し、スキャン後の動作（通知・リンク自動オープンなど）を選べます。" },
      { sel: "#tab-generate", title: "QRを作りたい？", text: "生成タブで任意のリンクやテキストを、ダウンロード／コピー可能なQRコードにできます。" },
      { sel: null, title: "準備完了", text: "ショートカットを押すか画像をドロップして、最初のコードをスキャンしましょう。ようこそ！" },
    ],
    extChromeSteps: [
      "ダウンロードしたファイルを解凍（<b>{file}</b>）。",
      "<b>chrome://extensions</b>（または edge://extensions、brave://extensions）を開く。",
      "右上の <b>デベロッパーモード</b> をオンにする。",
      "<b>パッケージ化されていない拡張機能を読み込む</b> をクリックし、解凍したフォルダを選択。",
      "QR画像を右クリック → <b>Scan QR Code</b>。",
    ],
    extFirefoxSteps: [
      "ダウンロードしたファイルを解凍（<b>{file}</b>）。",
      "<b>about:debugging#/runtime/this-firefox</b> を開く。",
      "<b>一時的なアドオンを読み込む</b> をクリック。",
      "解凍したフォルダ内の <b>manifest.json</b> を選択。",
      "QR画像を右クリック → <b>Scan QR Code</b>。",
    ],
  },
  ko: {
    tutorialSteps: [
      { sel: null, title: "Kuiqr에 오신 것을 환영합니다", text: "Kuiqr는 단축키 하나로 화면 anywhere에서 QR 코드를 스캔하며 모든 처리는 기기 내에서 이루어집니다. 빠르게 둘러보겠습니다." },
      { sel: "#tab-scan", title: "여기가 스캐너", text: "모든 기능이 이 작은 창에 있습니다. 작업 중에는 열어두거나 메뉴 막대에 넣어두세요." },
      { sel: "#drop-zone", title: "이미지로 스캔", text: "클립보드에서 이미지를 붙여넣기(⌘V)하거나 여기로 끌어다 놓으세요. 이 창에서 즉시 판독합니다." },
      { sel: "#scan-btn", title: "또는 화면 캡처", text: "이것을 클릭(또는 단축키)하면 화면의 QR 코드 주위에 상자를 그릴 수 있습니다. 링크는 자동으로 열리고 다른 텍스트는 복사됩니다." },
      { sel: ".tabs", title: "네 개의 탭", text: "스캔·기록·설정·생성을 언제든 전환할 수 있습니다." },
      { sel: "#setting-shortcut-row", title: "내 방식으로", text: "단축키를 녹화하고 스캔 후 동작(알림, 링크 자동 열기 등)을 선택하세요." },
      { sel: "#tab-generate", title: "QR이 필요한가요?", text: "생성 탭에서任意 링크나 텍스트를 다운로드·복사 가능한 QR 코드로 만들 수 있습니다." },
      { sel: null, title: "준비 완료", text: "단축키를 누르거나 이미지를 끌어다 놓아 첫 코드를 스캔하세요. 어서 오세요!" },
    ],
    extChromeSteps: [
      "다운로드한 파일 압축 해제(<b>{file}</b>).",
      "<b>chrome://extensions</b>(또는 edge://extensions, brave://extensions) 열기.",
      "우측 상단의 <b>개발자 모드</b> 켜기.",
      "<b>압축 해제된 확장 프로그램 로드</b>를 클릭하고 압축 해제한 폴더 선택.",
      "QR 이미지 우클릭 → <b>Scan QR Code</b>.",
    ],
    extFirefoxSteps: [
      "다운로드한 파일 압축 해제(<b>{file}</b>).",
      "<b>about:debugging#/runtime/this-firefox</b> 열기.",
      "<b>임시 부가기능 불러오기</b> 클릭.",
      "압축 해제한 폴더 안의 <b>manifest.json</b> 선택.",
      "QR 이미지 우클릭 → <b>Scan QR Code</b>.",
    ],
  },
  es: {
    tutorialSteps: [
      { sel: null, title: "Bienvenido a Kuiqr", text: "Kuiqr escanea códigos QR desde cualquier parte de tu pantalla con un solo atajo — y todo ocurre en tu dispositivo. Hagamos un recorrido rápido." },
      { sel: "#tab-scan", title: "Este es tu escáner", text: "Todo vive en esta pequeña ventana. Mantenla abierta mientras trabajas o guárdala en la barra de menús." },
      { sel: "#drop-zone", title: "Escanear desde una imagen", text: "Pega una imagen del portapapeles (⌘V) o arrástrala aquí. Kuiqr la decodifica al instante en esta ventana." },
      { sel: "#scan-btn", title: "O captura tu pantalla", text: "Haz clic aquí (o pulsa el atajo) para dibujar un cuadro alrededor de cualquier QR en pantalla. Los enlaces se abren solos; el resto del texto se copia." },
      { sel: ".tabs", title: "Cuatro pestañas sencillas", text: "Cambia cuando quieras entre Escanear, Historial, Ajustes y Generar." },
      { sel: "#setting-shortcut-row", title: "Hazlo tuyo", text: "Graba tu propio atajo y elige qué pasa tras un escaneo — notificaciones, apertura automática de enlaces y más." },
      { sel: "#tab-generate", title: "¿Necesitas un QR?", text: "La pestaña Generar convierte cualquier enlace o texto en un código QR que puedes descargar o copiar." },
      { sel: null, title: "Todo listo", text: "Pulsa el atajo o arrastra una imagen para escanear tu primer código. ¡Bienvenido!" },
    ],
    extChromeSteps: [
      "Descomprime el archivo descargado (<b>{file}</b>).",
      "Abre <b>chrome://extensions</b> (o edge://extensions, brave://extensions).",
      "Activa el <b>Modo desarrollador</b> (esquina superior derecha).",
      "Haz clic en <b>Cargar descomprimida</b> y selecciona la carpeta.",
      "Clic derecho en cualquier QR → <b>Scan QR Code</b>.",
    ],
    extFirefoxSteps: [
      "Descomprime el archivo descargado (<b>{file}</b>).",
      "Abre <b>about:debugging#/runtime/this-firefox</b>.",
      "Haz clic en <b>Cargar complemento temporal</b>.",
      "Selecciona <b>manifest.json</b> dentro de la carpeta.",
      "Clic derecho en cualquier QR → <b>Scan QR Code</b>.",
    ],
  },
  fr: {
    tutorialSteps: [
      { sel: null, title: "Bienvenue dans Kuiqr", text: "Kuiqr scane les QR codes de n'importe où à l'écran avec un seul raccourci — et tout reste sur votre appareil. Faisons une visite rapide." },
      { sel: "#tab-scan", title: "Voici votre scanner", text: "Tout se trouve dans cette petite fenêtre. Gardez-la ouverte pendant votre travail, ou rangez-la dans la barre de menus." },
      { sel: "#drop-zone", title: "Scanner depuis une image", text: "Collez une image du presse-papiers (⌘V) ou glissez-déposez-la ici. Kuiqr la décode instantanément dans cette fenêtre." },
      { sel: "#scan-btn", title: "Ou capturez votre écran", text: "Cliquez ici (ou le raccourci) pour dessiner un cadre autour d'un QR à l'écran. Les liens s'ouvrent automatiquement ; le reste du texte est copié." },
      { sel: ".tabs", title: "Quatre onglets simples", text: "Basculez à tout moment entre Scanner, Historique, Paramètres et Générer." },
      { sel: "#setting-shortcut-row", title: "À votre goût", text: "Enregistrez votre raccourci et choisissez ce qui se passe après un scan — notifications, ouverture auto des liens, etc." },
      { sel: "#tab-generate", title: "Besoin d'un QR ?", text: "L'onglet Générer transforme tout lien ou texte en QR code téléchargeable ou copiable." },
      { sel: null, title: "C'est prêt", text: "Appuyez sur le raccourci ou déposez une image pour scanner votre premier code. Bienvenue !" },
    ],
    extChromeSteps: [
      "Décompressez le fichier téléchargé (<b>{file}</b>).",
      "Ouvrez <b>chrome://extensions</b> (ou edge://extensions, brave://extensions).",
      "Activez le <b>Mode développeur</b> (coin supérieur droit).",
      "Cliquez sur <b>Charger l'extension décompressée</b> et choisissez le dossier.",
      "Clic droit sur un QR → <b>Scan QR Code</b>.",
    ],
    extFirefoxSteps: [
      "Décompressez le fichier téléchargé (<b>{file}</b>).",
      "Ouvrez <b>about:debugging#/runtime/this-firefox</b>.",
      "Cliquez sur <b>Charger un module temporaire</b>.",
      "Sélectionnez <b>manifest.json</b> dans le dossier.",
      "Clic droit sur un QR → <b>Scan QR Code</b>.",
    ],
  },
  de: {
    tutorialSteps: [
      { sel: null, title: "Willkommen bei Kuiqr", text: "Kuiqr scannt QR-Codes von überall auf dem Bildschirm mit einer einzigen Tastenkombination — und alles bleibt auf deinem Gerät. Machen wir eine kurze Tour." },
      { sel: "#tab-scan", title: "Das ist dein Scanner", text: "Alles steckt in diesem kleinen Fenster. Lass es beim Arbeiten offen oder schiebe es in die Menüleiste." },
      { sel: "#drop-zone", title: "Aus einem Bild scannen", text: "Bild aus der Zwischenablage einfügen (⌘V) oder hierher ziehen. Kuiqr decodiert es sofort in diesem Fenster." },
      { sel: "#scan-btn", title: "Oder Bildschirm aufnehmen", text: "Klicke hier (oder das Kürzel), um einen Rahmen um einen QR-Code zu ziehen. Links öffnen automatisch; anderen Text kopieren wir für dich." },
      { sel: ".tabs", title: "Vier einfache Tabs", text: "Wechsle jederzeit zwischen Scannen, Verlauf, Einstellungen und Erzeugen." },
      { sel: "#setting-shortcut-row", title: "Mach es dir eigen", text: "Nimm dein eigenes Kürzel auf und wähle, was nach einem Scan passiert — Benachrichtigungen, Auto-Öffnen von Links u. v. m." },
      { sel: "#tab-generate", title: "Lieber einen QR erzeugen?", text: "Der Tab „Erzeugen“ verwandelt jeden Link oder Text in einen QR-Code zum Download oder Kopieren." },
      { sel: null, title: "Fertig aufgestellt", text: "Drücke das Kürzel oder zieh ein Bild hinein, um deinen ersten Code zu scannen. Willkommen!" },
    ],
    extChromeSteps: [
      "Entpacke die heruntergeladene Datei (<b>{file}</b>).",
      "Öffne <b>chrome://extensions</b> (oder edge://extensions, brave://extensions).",
      "Aktiviere den <b>Entwicklermodus</b> (oben rechts).",
      "Klicke auf <b>Entpackte Erweiterung laden</b> und wähle den Ordner.",
      "Rechtsklick auf einen QR → <b>Scan QR Code</b>.",
    ],
    extFirefoxSteps: [
      "Entpacke die heruntergeladene Datei (<b>{file}</b>).",
      "Öffne <b>about:debugging#/runtime/this-firefox</b>.",
      "Klicke auf <b>Temporäre Add-on laden</b>.",
      "Wähle <b>manifest.json</b> im entpackten Ordner.",
      "Rechtsklick auf einen QR → <b>Scan QR Code</b>.",
    ],
  },
};

// ── Runtime ──
function getLang() {
  try {
    const saved = localStorage.getItem("kuiqr-lang");
    if (saved && I18N_STEPS[saved]) return saved;
  } catch {}
  const nav = (navigator.language || "en").toLowerCase();
  if (I18N_STEPS[nav]) return nav;
  const base = nav.split("-")[0];
  if (I18N_STEPS[base]) return base;
  return "en";
}

function setLang(lang) {
  if (!I18N_STEPS[lang]) lang = "en";
  try { localStorage.setItem("kuiqr-lang", lang); } catch {}
  document.documentElement.lang = lang;
  applyI18n();
  // Notify the app to refresh dynamic (JS-built) strings.
  window.dispatchEvent(new CustomEvent("kuiqr:localize", { detail: { lang } }));
}

// Translate a key, with optional {var} substitution. Falls back to en, then key.
function t(key, vars) {
  const entry = I18N[key];
  const lang = getLang();
  let str = entry ? (entry[lang] || entry.en || key) : key;
  if (vars && typeof vars === "object") {
    for (const k in vars) {
      str = str.split("{" + k + "}").join(String(vars[k]));
    }
  }
  return str;
}

// Fill all [data-i18n*] elements in `root` (default: document).
function applyI18n(root) {
  root = root || document;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
}

// Localized step lists for the current language (with en fallback).
function getSteps() {
  const lang = getLang();
  const src = I18N_STEPS[lang] || I18N_STEPS.en;
  const en = I18N_STEPS.en;
  return {
    tutorialSteps: src.tutorialSteps || en.tutorialSteps,
    extChromeSteps: src.extChromeSteps || en.extChromeSteps,
    extFirefoxSteps: src.extFirefoxSteps || en.extFirefoxSteps,
  };
}

// Build the language <select> options and set the current value.
function buildLanguagePicker(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  LANGUAGES.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.textContent = l.label;
    selectEl.appendChild(opt);
  });
  selectEl.value = getLang();
}

// Initialize: set <html lang>, build picker, apply static translations.
function initI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;
  buildLanguagePicker(document.getElementById("setting-language"));
  applyI18n();
}

// Expose globally for app.js / tutorial.js
window.I18N = I18N;
window.LANGUAGES = LANGUAGES;
window.t = t;
window.applyI18n = applyI18n;
window.getLang = getLang;
window.setLang = setLang;
window.getSteps = getSteps;
window.initI18n = initI18n;
window.buildLanguagePicker = buildLanguagePicker;
