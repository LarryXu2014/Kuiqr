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
  "gen.stepTemplate": { en: "Choose template", "zh-CN": "选择模板", "zh-TW": "選擇模板", ja: "テンプレートを選択", ko: "템플릿 선택", es: "Elegir plantilla", fr: "Choisir un modèle", de: "Vorlage wählen" },
  "gen.stepContent": { en: "Enter content", "zh-CN": "填写内容", "zh-TW": "填寫內容", ja: "内容を入力", ko: "내용 입력", es: "Introducir contenido", fr: "Saisir le contenu", de: "Inhalt eingeben" },
  "gen.copyqr": { en: "Copy QR Code", "zh-CN": "复制二维码", "zh-TW": "複製 QR Code", ja: "QRコードをコピー", ko: "QR 코드 복사", es: "Copiar QR", fr: "Copier le QR", de: "QR kopieren" },
  "gen.copytext": { en: "Copy Text", "zh-CN": "复制文本", "zh-TW": "複製文字", ja: "テキストをコピー", ko: "텍스트 복사", es: "Copiar texto", fr: "Copier le texte", de: "Text kopieren" },
  "gen.error": { en: "Could not generate: {msg}", "zh-CN": "无法生成：{msg}", "zh-TW": "無法產生：{msg}", ja: "生成できませんでした：{msg}", ko: "생성할 수 없음: {msg}", es: "No se pudo generar: {msg}", fr: "Impossible de générer : {msg}", de: "Erzeugung fehlgeschlagen: {msg}" },

  // Dynamic (trackable) QR
  "gen.dynamic": { en: "Dynamic (trackable) QR" , "zh-CN": "动态（可追踪）二维码", "zh-TW": "動態（可追蹤）QR Code", "ja": "動的（追跡可能）QRコード", "ko": "동적(추적 가능) QR 코드", "es": "QR dinámico (rastreable)", "fr": "QR dynamique (traçable)", "de": "Dynamischer (trackbarer) QR-Code" },
  "gen.dynamicDesc": { en: "Encode a redirect link so you can see scan analytics. A local backend will start automatically." , "zh-CN": "编码一个跳转链接以查看扫描统计。本地后端会自动启动。", "zh-TW": "編碼一個轉址連結以查看掃描統計。本機後端會自動啟動。", "ja": "リダイレクトリンクをエンコードしてスキャン解析を確認できます。ローカルバックエンドが自動的に起動します。", "ko": "리디렉션 링크를 인코딩하여 스캔 통계를 확인합니다. 로컬 백엔드가 자동으로 시작됩니다.", "es": "Codifica un enlace de redirección para ver estadísticas de escaneo. Un backend local se iniciará automáticamente.", "fr": "Encode un lien de redirection pour voir les statistiques de scan. Un backend local démarrera automatiquement.", "de": "Codiert einen Weiterleitungs-Link, um Scan-Statistiken zu sehen. Ein lokales Backend wird automatisch gestartet." },
  "gen.createTrackable": { en: "Create trackable QR" , "zh-CN": "创建可追踪二维码", "zh-TW": "建立可追蹤 QR Code", "ja": "追跡可能QRコードを作成", "ko": "추적 가능 QR 코드 만들기", "es": "Crear QR rastreable", "fr": "Créer un QR traçable", "de": "Trackbaren QR-Code erstellen" },
  "gen.creating": { en: "Creating…" , "zh-CN": "创建中…", "zh-TW": "建立中…", "ja": "作成中…", "ko": "만드는 중…", "es": "Creando…", "fr": "Création…", "de": "Wird erstellt…" },
  "gen.startingBackend": { en: "Starting local backend…" , "zh-CN": "正在启动本地后端…", "zh-TW": "正在啟動本機後端…", "ja": "ローカルバックエンドを起動中…", "ko": "로컬 백엔드 시작 중…", "es": "Iniciando backend local…", "fr": "Démarrage du backend local…", "de": "Lokales Backend wird gestartet…" },
  "gen.trackableActive": { en: "Trackable QR ready" , "zh-CN": "可追踪二维码已就绪", "zh-TW": "可追蹤 QR Code 已就緒", "ja": "追跡可能QRコードの準備ができました", "ko": "추적 가능 QR 코드 준비 완료", "es": "QR rastreable listo", "fr": "QR traçable prêt", "de": "Trackbarer QR-Code bereit" },
  "gen.trackableExplainer": { en: "This QR encodes the short link below. When someone scans it, the visit is logged and they're redirected to your original link." , "zh-CN": "此二维码编码了下方的短链接。有人扫描时，访问会被记录并跳转到您的原始链接。", "zh-TW": "此 QR Code 編碼了下方的短連結。有人掃描時，訪問會被記錄並轉址到您的原始連結。", "ja": "このQRコードには下記のショートリンクがエンコードされています。誰かがスキャンすると訪問が記録され、元のリンクへ転送されます。", "ko": "이 QR 코드는 아래의 짧은 링크를 인코딩합니다. 누군가 스캔하면 방문이 기록되고 원래 링크로 이동합니다.", "es": "Este QR codifica el enlace corto de abajo. Cuando alguien lo escanea, la visita se registra y se le redirige a tu enlace original.", "fr": "Ce QR encode le lien court ci-dessous. Quand quelqu'un le scanne, la visite est enregistrée et il est redirigé vers votre lien d'origine.", "de": "Dieser QR-Code codiert den unten stehenden Kurz-Link. Wenn jemand ihn scannt, wird der Besuch protokolliert und zum ursprünglichen Link weitergeleitet." },
  "gen.trackableLocalNote": { en: "Phones must be on the same Wi-Fi network as this Mac to reach this local backend." , "zh-CN": "手机必须与此 Mac 处于同一 Wi-Fi 网络才能访问此本地后端。", "zh-TW": "手機必須與此 Mac 處於同一 Wi-Fi 網路才能存取此本機後端。", "ja": "このローカルバックエンドにアクセスするには、スマートフォンがこのMacと同じWi-Fiネットワーク上にある必要があります。", "ko": "이 로컬 백엔드에 접속하려면 휴대폰이 이 Mac과 같은 Wi-Fi 네트워크에 있어야 합니다.", "es": "Los teléfonos deben estar en la misma red Wi-Fi que este Mac para alcanzar este backend local.", "fr": "Les téléphones doivent être sur le même réseau Wi-Fi que ce Mac pour atteindre ce backend local.", "de": "Telefone müssen sich im selben Wi-Fi-Netz wie dieser Mac befinden, um dieses lokale Backend zu erreichen." },
  "gen.copyShortLink": { en: "Copy short link" , "zh-CN": "复制短链接", "zh-TW": "複製短連結", "ja": "ショートリンクをコピー", "ko": "짧은 링크 복사", "es": "Copiar enlace corto", "fr": "Copier le lien court", "de": "Kurz-Link kopieren" },
  "gen.copied": { en: "Copied!" , "zh-CN": "已复制！", "zh-TW": "已複製！", "ja": "コピーしました！", "ko": "복사됨!", "es": "¡Copiado!", "fr": "Copié !", "de": "Kopiert!" },
  "gen.copyFailed": { en: "Could not copy" , "zh-CN": "复制失败", "zh-TW": "複製失敗", "ja": "コピーできませんでした", "ko": "복사할 수 없음", "es": "No se pudo copiar", "fr": "Impossible de copier", "de": "Kopieren fehlgeschlagen" },
  "gen.trackableDestination": { en: "Redirects to: {url}" , "zh-CN": "跳转至：{url}", "zh-TW": "轉址至：{url}", "ja": "リダイレクト先: {url}", "ko": "리디렉션 대상: {url}", "es": "Redirige a: {url}", "fr": "Redirige vers : {url}", "de": "Leitet weiter zu: {url}" },
  "gen.trackableText": { en: "Stored text: {url}" , "zh-CN": "存储的文本：{url}", "zh-TW": "儲存的文字：{url}", "ja": "保存されたテキスト: {url}", "ko": "저장된 텍스트: {url}", "es": "Texto guardado: {url}", "fr": "Texte stocké : {url}", "de": "Gespeicherter Text: {url}" },
  "gen.viewStats": { en: "View stats" , "zh-CN": "查看统计", "zh-TW": "查看統計", "ja": "統計を表示", "ko": "통계 보기", "es": "Ver estadísticas", "fr": "Voir les statistiques", "de": "Statistiken ansehen" },
  "gen.createFirst": { en: "Click \"Create trackable QR\" to generate a redirect link for this destination." , "zh-CN": "点击“创建可追踪二维码”为此目标生成跳转链接。", "zh-TW": "點擊「建立可追蹤 QR Code」為此目標產生轉址連結。", "ja": "この宛先用にリダイレクトリンクを生成するには「追跡可能QRコードを作成」をクリックしてください。", "ko": "이 대상에 대한 리디렉션 링크를 만들려면 \"추적 가능 QR 코드 만들기\"를 클릭하세요.", "es": "Pulsa \"Crear QR rastreable\" para generar un enlace de redirección a este destino.", "fr": "Cliquez sur « Créer un QR traçable » pour générer un lien de redirection vers cette destination.", "de": "Klicke auf „Trackbaren QR-Code erstellen“, um einen Weiterleitungs-Link für dieses Ziel zu erzeugen." },
  "gen.needDestination": { en: "Enter a destination first." , "zh-CN": "请先输入目标链接。", "zh-TW": "請先輸入目標連結。", "ja": "先に宛先を入力してください。", "ko": "먼저 대상을 입력하세요.", "es": "Introduce un destino primero.", "fr": "Saisissez d'abord une destination.", "de": "Zuerst ein Ziel eingeben." },
  "gen.dynamicNeedsUrl": { en: "Trackable QR works with web links (http/https) or plain text." , "zh-CN": "可追踪二维码支持网页链接（http/https）或纯文本。", "zh-TW": "可追蹤 QR Code 支援網頁連結（http/https）或純文字。", "ja": "追跡可能QRコードはWebリンク（http/https）またはテキストで動作します。", "ko": "추적 가능 QR 코드는 웹 링크(http/https) 또는 일반 텍스트에서 작동합니다.", "es": "El QR rastreable funciona con enlaces web (http/https) o texto sin formato.", "fr": "Le QR traçable fonctionne avec des liens web (http/https) ou du texte brut.", "de": "Trackbare QR-Codes funktionieren mit Weblinks (http/https) oder reinem Text." },
  "gen.dynamicError": { en: "Could not create trackable QR: {reason}" , "zh-CN": "创建可追踪二维码失败：{reason}", "zh-TW": "建立可追蹤 QR Code 失敗：{reason}", "ja": "追跡可能QRコードを作成できませんでした: {reason}", "ko": "추적 가능 QR 코드를 만들 수 없음: {reason}", "es": "No se pudo crear el QR rastreable: {reason}", "fr": "Impossible de créer le QR traçable : {reason}", "de": "Trackbarer QR-Code konnte nicht erstellt werden: {reason}" },
  "gen.dynamicInfo": { en: "When on, the QR encodes a short redirect link. Each scan is counted in Analytics, then the visitor is sent to your real link." , "zh-CN": "开启后，二维码编码一个短跳转链接。每次扫描都会计入统计，然后访客会被送往您的真实链接。", "zh-TW": "開啟後，QR Code 編碼一個短轉址連結。每次掃描都會計入統計，然後訪客會被送往您的真實連結。", "ja": "オンにすると、QRコードはショートリダイレクトリンクをエンコードします。各スキャンはアナリティクスでカウントされ、訪問者は本物のリンクへ送られます。", "ko": "켜면 QR 코드가 짧은 리디렉션 링크를 인코딩합니다. 각 스캔은 통계에 집계되고 방문자는 실제 링크로 이동합니다.", "es": "Al activarlo, el QR codifica un enlace corto de redirección. Cada escaneo se cuenta en Analíticas y luego el visitante es enviado a tu enlace real.", "fr": "Activé, le QR encode un lien court de redirection. Chaque scan est compté dans les statistiques, puis le visiteur est envoyé vers votre vrai lien.", "de": "Wenn aktiv, codiert der QR-Code einen kurzen Weiterleitungs-Link. Jeder Scan wird in der Statistik gezählt, dann wird der Besucher zu Ihrem echten Link geleitet." },
  "gen.dynamicHint": { en: "Turn on to track every scan. A local backend starts automatically; phones must be on the same Wi-Fi to reach it." , "zh-CN": "开启以追踪每次扫描。本地后端会自动启动；手机需在同一 Wi-Fi 下访问。", "zh-TW": "開啟以追蹤每次掃描。本機後端會自動啟動；手機需在同一 Wi-Fi 下存取。", "ja": "オンにすると各スキャンを追跡できます。ローカルバックエンドが自動的に起動します；スマートフォンは同じWi-Fiに接続している必要があります。", "ko": "켜면 각 스캔을 추적합니다. 로컬 백엔드가 자동으로 시작됩니다. 휴전폰이 같은 Wi-Fi에 있어야 접속할 수 있습니다.", "es": "Actívalo para rastrear cada escaneo. Un backend local se inicia automáticamente; los teléfonos deben estar en la misma Wi-Fi para acceder.", "fr": "Activez pour suivre chaque scan. Un backend local démarre automatiquement ; les téléphones doivent être sur le même Wi-Fi pour y accéder.", "de": "Aktivieren, um jeden Scan zu verfolgen. Ein lokales Backend startet automatisch; Telefone müssen sich im selben Wi-Fi befinden, um darauf zuzugreifen." },

  // Stats tab
  "tab.stats": { en: "Stats" , "zh-CN": "统计", "zh-TW": "統計", "ja": "統計", "ko": "통계", "es": "Estadísticas", "fr": "Statistiques", "de": "Statistik" },
  "stats.title": { en: "QR Analytics" , "zh-CN": "二维码统计", "zh-TW": "QR Code 統計", "ja": "QRアナリティクス", "ko": "QR 통계", "es": "Analíticas QR", "fr": "Statistiques QR", "de": "QR-Analytics" },
  "stats.desc": { en: "Scan analytics for the trackable QR codes you have created." , "zh-CN": "您创建的可追踪二维码的扫描统计。", "zh-TW": "您建立的可追蹤 QR Code 的掃描統計。", "ja": "作成した追跡可能QRコードのスキャン解析です。", "ko": "내가 만든 추적 가능 QR 코드의 스캔 통계입니다.", "es": "Estadísticas de escaneo de los códigos QR rastreables que has creado.", "fr": "Statistiques de scan des QR codes traçables que vous avez créés.", "de": "Scan-Statistiken der von Ihnen erstellten trackbaren QR-Codes." },
  "stats.empty": { en: "No trackable QR codes yet. Create one on the Generate tab." , "zh-CN": "还没有可追踪二维码。请在生成标签页创建一个。", "zh-TW": "還沒有可追蹤 QR Code。請在產生分頁建立一個。", "ja": "追跡可能QRコードがまだありません。生成タブで作成してください。", "ko": "아직 추적 가능 QR 코드가 없습니다. 생성 탭에서 만드세요.", "es": "Aún no hay códigos QR rastreables. Crea uno en la pestaña Generar.", "fr": "Aucun QR code traçable pour le moment. Créez-en un dans l'onglet Générer.", "de": "Noch keine trackbaren QR-Codes. Erstellen Sie einen im Tab „Erzeugen“." },
  "stats.back": { en: "← Back to list" , "zh-CN": "← 返回列表", "zh-TW": "← 返回清單", "ja": "← 一覧に戻る", "ko": "← 목록으로", "es": "← Volver a la lista", "fr": "← Retour à la liste", "de": "← Zurück zur Liste" },
  "stats.loading": { en: "Loading…" , "zh-CN": "加载中…", "zh-TW": "載入中…", "ja": "読み込み中…", "ko": "불러오는 중…", "es": "Cargando…", "fr": "Chargement…", "de": "Wird geladen…" },
  "stats.total": { en: "Total scans" , "zh-CN": "总扫描次数", "zh-TW": "總掃描次數", "ja": "合計スキャン数", "ko": "총 스캔 수", "es": "Escaneos totales", "fr": "Scans totaux", "de": "Scans gesamt" },
  "stats.unique": { en: "Unique" , "zh-CN": "独立访客", "zh-TW": "不重複訪客", "ja": "ユニーク", "ko": "고유", "es": "Únicos", "fr": "Uniques", "de": "Einzigartig" },
  "stats.destination": { en: "Destination" , "zh-CN": "目标链接", "zh-TW": "目標連結", "ja": "宛先", "ko": "대상", "es": "Destino", "fr": "Destination", "de": "Ziel" },
  "stats.byDay": { en: "Scans per day" , "zh-CN": "每日扫描", "zh-TW": "每日掃描", "ja": "日別スキャン数", "ko": "일별 스캔", "es": "Escaneos por día", "fr": "Scans par jour", "de": "Scans pro Tag" },
  "stats.byCountry": { en: "By country" , "zh-CN": "按国家/地区", "zh-TW": "按國家/地區", "ja": "国別", "ko": "국가별", "es": "Por país", "fr": "Par pays", "de": "Nach Land" },
  "stats.byDevice": { en: "By device" , "zh-CN": "按设备", "zh-TW": "按裝置", "ja": "デバイス別", "ko": "기기별", "es": "Por dispositivo", "fr": "Par appareil", "de": "Nach Gerät" },
  "stats.refresh": { en: "Refresh" , "zh-CN": "刷新", "zh-TW": "重新整理", "ja": "更新", "ko": "새로 고침", "es": "Actualizar", "fr": "Actualiser", "de": "Aktualisieren" },
  "stats.refreshing": { en: "Refreshing…" , "zh-CN": "刷新中…", "zh-TW": "重新整理中…", "ja": "更新中…", "ko": "새로 고치는 중…", "es": "Actualizando…", "fr": "Actualisation…", "de": "Aktualisiere…" },
  "stats.updated": { en: "Updated {time}" , "zh-CN": "更新于 {time}", "zh-TW": "更新於 {time}", "ja": "{time} に更新", "ko": "{time}에 업데이트됨", "es": "Actualizado {time}", "fr": "Mis à jour {time}", "de": "Aktualisiert {time}" },
  "stats.hint": { en: "Phone scans are counted when the phone is on the same Wi-Fi network as this computer. Tap Refresh to update." , "zh-CN": "手机与此电脑处于同一 Wi-Fi 网络时，其扫描才会被计入。点击刷新以更新。", "zh-TW": "手機與此電腦處於同一 Wi-Fi 網路時，其掃描才會被計入。點擊重新整理以更新。", "ja": "スマートフォンがこのコンピュータと同じWi-Fiネットワーク上にあるときのみスキャンがカウントされます。更新をタップしてください。", "ko": "휴대폰이 이 컴퓨터와 같은 Wi-Fi 네트워크에 있을 때 스캔이 집계됩니다. 새로 고침을 누르세요.", "es": "Los escaneos del teléfono solo se cuentan cuando está en la misma red Wi-Fi que este ordenador. Pulsa Actualizar.", "fr": "Les scans du téléphone ne sont comptés que lorsqu'il est sur le même réseau Wi-Fi que cet ordinateur. Appuyez sur Actualiser.", "de": "Telefon-Scans werden nur gezählt, wenn das Telefon im selben Wi-Fi-Netz wie dieser Computer ist. Zum Aktualisieren tippen." },
  "stats.unauthorized": { en: "Stats access denied. The backend API key may have changed — try refreshing." , "zh-CN": "统计访问被拒绝。后端 API 密钥可能已更改——请尝试刷新。", "zh-TW": "統計存取被拒絕。後端 API 金鑰可能已變更——請嘗試重新整理。", "ja": "統計へのアクセスが拒否されました。バックエンドのAPIキーが変更された可能性があります。更新を試してください。", "ko": "통계 접근이 거부되었습니다. 백엔드 API 키가 변경되었을 수 있습니다. 새로 고침해 보세요.", "es": "Acceso a estadísticas denegado. Es posible que la clave API del backend haya cambiado; prueba a actualizar.", "fr": "Accès aux statistiques refusé. La clé API du backend a peut-être changé — essayez d'actualiser.", "de": "Statistikzugriff verweigert. Der Backend-API-Schlüssel könnte sich geändert haben — versuchen Sie zu aktualisieren." },

  // Settings — Dynamic QR backend
  "set.dynamicGroup": { en: "Dynamic QR (analytics)" , "zh-CN": "动态二维码（统计）", "zh-TW": "動態 QR Code（統計）", "ja": "動的QRコード（アナリティクス）", "ko": "동적 QR 코드(통계)", "es": "QR dinámico (analíticas)", "fr": "QR dynamique (statistiques)", "de": "Dynamischer QR-Code (Analytics)" },
  "set.dynamicHint": { en: "backend · API key · local server" , "zh-CN": "后端 · API 密钥 · 本地服务器", "zh-TW": "後端 · API 金鑰 · 本機伺服器", "ja": "バックエンド · APIキー · ローカルサーバー", "ko": "백엔드 · API 키 · 로컬 서버", "es": "backend · clave API · servidor local", "fr": "backend · clé API · serveur local", "de": "Backend · API-Schlüssel · lokaler Server" },
  "set.dynamicBackend": { en: "Backend URL" , "zh-CN": "后端 URL", "zh-TW": "後端 URL", "ja": "バックエンドURL", "ko": "백엔드 URL", "es": "URL del backend", "fr": "URL du backend", "de": "Backend-URL" },
  "set.dynamicBackendDesc": { en: "Base URL of your redirect/analytics server (e.g. https://qr.yourdomain.com)" , "zh-CN": "您的跳转/统计服务器的基础 URL（例如 https://qr.yourdomain.com）", "zh-TW": "您的轉址/統計伺服器的基礎 URL（例如 https://qr.yourdomain.com）", "ja": "リダイレクト/アナリティクスサーバーのベースURL（例: https://qr.yourdomain.com）", "ko": "리디렉션/통계 서버의 기본 URL (예: https://qr.yourdomain.com)", "es": "URL base de tu servidor de redirección/analíticas (p. ej. https://qr.yourdomain.com)", "fr": "URL de base de votre serveur de redirection/statistiques (ex. https://qr.yourdomain.com)", "de": "Basis-URL Ihres Weiterleitungs-/Statistik-Servers (z. B. https://qr.yourdomain.com)" },
  "set.dynamicApiKey": { en: "API key" , "zh-CN": "API 密钥", "zh-TW": "API 金鑰", "ja": "APIキー", "ko": "API 키", "es": "Clave API", "fr": "Clé API", "de": "API-Schlüssel" },
  "set.dynamicApiKeyDesc": { en: "Secret used to create codes. Stored locally on this device." , "zh-CN": "用于创建代码的密钥。仅存储在此设备本地。", "zh-TW": "用於建立程式碼的金鑰。僅儲存在此裝置本機。", "ja": "コード作成に使用するシークレット。このデバイスにのみローカル保存されます。", "ko": "코드 생성에 사용되는 비밀 키. 이 기기에만 로컬로 저장됩니다.", "es": "Secreto usado para crear códigos. Se guarda localmente en este dispositivo.", "fr": "Secret utilisé pour créer des codes. Stocké localement sur cet appareil.", "de": "Geheimnis zum Erstellen von Codes. Wird nur lokal auf diesem Gerät gespeichert." },

  // Settings — Appearance (accent color)
  "set.appearanceGroup": { en: "Appearance", "zh-CN": "外观", "zh-TW": "外觀", ja: "外観", ko: "화면 스타일", es: "Apariencia", fr: "Apparence", de: "Erscheinungsbild" },
  "set.accent": { en: "Accent color", "zh-CN": "主题色", "zh-TW": "主題色", ja: "アクセントカラー", ko: "강조 색상", es: "Color de acento", fr: "Couleur d'accentuation", de: "Akzentfarbe" },
  "set.accentDesc": { en: "Colors the buttons, tabs and highlights. Applies live; save to keep it.", "zh-CN": "用于按钮、标签页和高亮颜色。实时生效，保存后永久保留。", "zh-TW": "用於按鈕、分頁和高亮顏色。即時生效，儲存後永久保留。", ja: "ボタン・タブ・ハイライトの色になります。即時反映、保存すると保持されます。", ko: "버튼·탭·강조 표시의 색상입니다. 실시간 적용되며 저장하면 유지됩니다.", es: "Colorea los botones, las pestañas y los resaltes. Se aplica al instante; guárdalo para conservarlo.", fr: "Colore les boutons, onglets et éléments mis en valeur. Appliqué en direct ; enregistrez pour le conserver.", de: "Färbt Schaltflächen, Tabs und Hervorhebungen. Wird sofort angewendet; zum Beibehalten speichern." },
  // Accent swatch titles describe the mood each color evokes, not the raw color name.
  "accent.focus": { en: "Focus", "zh-CN": "专注", "zh-TW": "專注", ja: "集中", ko: "집중", es: "Enfoque", fr: "Concentration", de: "Fokus" },
  "accent.calm": { en: "Calm", "zh-CN": "平静", "zh-TW": "平靜", ja: "落ち着き", ko: "평온", es: "Tranquilidad", fr: "Calme", de: "Ruhe" },
  "accent.fresh": { en: "Fresh", "zh-CN": "清新", "zh-TW": "清新", ja: "爽やか", ko: "상쾌", es: "Frescura", fr: "Frais", de: "Frisch" },
  "accent.natural": { en: "Natural", "zh-CN": "自然", "zh-TW": "自然", ja: "自然", ko: "자연", es: "Natural", fr: "Nature", de: "Natur" },
  "accent.warm": { en: "Warm", "zh-CN": "温暖", "zh-TW": "溫暖", ja: "温かみ", ko: "따뜻함", es: "Calidez", fr: "Chaleur", de: "Wärme" },
  "accent.bold": { en: "Bold", "zh-CN": "大胆", "zh-TW": "大膽", ja: "大胆", ko: "대담", es: "Audacia", fr: "Audace", de: "Kühn" },
  "accent.playful": { en: "Playful", "zh-CN": "活泼", "zh-TW": "活潑", ja: "遊び心", ko: "장난기", es: "Juego", fr: "Joyeux", de: "Verspielt" },
  "accent.creative": { en: "Creative", "zh-CN": "创意", "zh-TW": "創意", ja: "創造性", ko: "창의", es: "Creatividad", fr: "Créatif", de: "Kreativ" },
  "accent.custom": { en: "Custom", "zh-CN": "自定义", "zh-TW": "自訂", ja: "カスタム", ko: "사용자 지정", es: "Personalizado", fr: "Personnalisé", de: "Benutzerdefiniert" },

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
  "tpl.label": { en: "Template" , "zh-CN": "模板", "zh-TW": "範本", "ja": "テンプレート", "ko": "템플릿", "es": "Plantilla", "fr": "Modèle", "de": "Vorlage" },
  "tpl.text": { en: "Text / URL" , "zh-CN": "文本 / URL", "zh-TW": "文字 / URL", "ja": "テキスト / URL", "ko": "텍스트 / URL", "es": "Texto / URL", "fr": "Texte / URL", "de": "Text / URL" },
  "tpl.wifi": { en: "WiFi" , "zh-CN": "Wi-Fi", "zh-TW": "Wi-Fi", "ja": "Wi-Fi", "ko": "Wi-Fi", "es": "Wi-Fi", "fr": "Wi-Fi", "de": "WLAN" },
  "tpl.vcard": { en: "vCard (contact)" , "zh-CN": "vCard（联系人）", "zh-TW": "vCard（聯絡人）", "ja": "vCard（連絡先）", "ko": "vCard(연락처)", "es": "vCard (contacto)", "fr": "vCard (contact)", "de": "vCard (Kontakt)" },
  "tpl.email": { en: "Email" , "zh-CN": "电子邮件", "zh-TW": "電子郵件", "ja": "メール", "ko": "이메일", "es": "Correo", "fr": "E-mail", "de": "E-Mail" },
  "tpl.sms": { en: "SMS" , "zh-CN": "短信", "zh-TW": "簡訊", "ja": "SMS", "ko": "SMS", "es": "SMS", "fr": "SMS", "de": "SMS" },
  "tpl.phone": { en: "Phone" , "zh-CN": "电话", "zh-TW": "電話", "ja": "電話", "ko": "전화", "es": "Teléfono", "fr": "Téléphone", "de": "Telefon" },
  "tpl.event": { en: "Calendar event" , "zh-CN": "日历事件", "zh-TW": "行事曆事件", "ja": "カレンダー予定", "ko": "캘린더 일정", "es": "Evento de calendario", "fr": "Événement de calendrier", "de": "Kalenderereignis" },
  "tpl.geo": { en: "Geo location" , "zh-CN": "地理位置", "zh-TW": "地理位置", "ja": "位置情報", "ko": "지리 위치", "es": "Ubicación", "fr": "Position", "de": "Geo-Standort" },
  "tpl.wifi.ssid": { en: "Network name (SSID)" , "zh-CN": "网络名称（SSID）", "zh-TW": "網路名稱（SSID）", "ja": "ネットワーク名（SSID）", "ko": "네트워크 이름(SSID)", "es": "Nombre de red (SSID)", "fr": "Nom du réseau (SSID)", "de": "Netzwerkname (SSID)" },
  "tpl.wifi.ssidPh": { en: "MyWiFi" , "zh-CN": "我的WiFi", "zh-TW": "我的WiFi", "ja": "MyWiFi", "ko": "MyWiFi", "es": "MiWiFi", "fr": "MonWiFi", "de": "MeinWLAN" },
  "tpl.wifi.enc": { en: "Encryption" , "zh-CN": "加密方式", "zh-TW": "加密方式", "ja": "暗号化方式", "ko": "암호화", "es": "Cifrado", "fr": "Chiffrement", "de": "Verschlüsselung" },
  "tpl.wifi.wpa": { en: "WPA / WPA2" , "zh-CN": "WPA / WPA2", "zh-TW": "WPA / WPA2", "ja": "WPA / WPA2", "ko": "WPA / WPA2", "es": "WPA / WPA2", "fr": "WPA / WPA2", "de": "WPA / WPA2" },
  "tpl.wifi.wep": { en: "WEP" , "zh-CN": "WEP", "zh-TW": "WEP", "ja": "WEP", "ko": "WEP", "es": "WEP", "fr": "WEP", "de": "WEP" },
  "tpl.wifi.nopass": { en: "No password" , "zh-CN": "无密码", "zh-TW": "無密碼", "ja": "パスワードなし", "ko": "비밀번호 없음", "es": "Sin contraseña", "fr": "Sans mot de passe", "de": "Kein Passwort" },
  "tpl.wifi.pass": { en: "Password" , "zh-CN": "密码", "zh-TW": "密碼", "ja": "パスワード", "ko": "비밀번호", "es": "Contraseña", "fr": "Mot de passe", "de": "Passwort" },
  "tpl.wifi.passPh": { en: "network password" , "zh-CN": "网络密码", "zh-TW": "網路密碼", "ja": "ネットワークのパスワード", "ko": "네트워크 비밀번호", "es": "contraseña de red", "fr": "mot de passe du réseau", "de": "Netzwerk-Passwort" },
  "tpl.wifi.hidden": { en: "Hidden network" , "zh-CN": "隐藏网络", "zh-TW": "隱藏網路", "ja": "非公開ネットワーク", "ko": "숨겨진 네트워크", "es": "Red oculta", "fr": "Réseau masqué", "de": "Verstecktes Netzwerk" },
  "tpl.vcard.name": { en: "Full name" , "zh-CN": "姓名", "zh-TW": "姓名", "ja": "氏名", "ko": "이름", "es": "Nombre completo", "fr": "Nom complet", "de": "Vollständiger Name" },
  "tpl.vcard.namePh": { en: "Jane Doe" , "zh-CN": "张三", "zh-TW": "王大明", "ja": "山田太郎", "ko": "홍길동", "es": "Ana García", "fr": "Marie Martin", "de": "Max Mustermann" },
  "tpl.vcard.org": { en: "Organization" , "zh-CN": "公司/组织", "zh-TW": "公司/組織", "ja": "所属組織", "ko": "소속/회사", "es": "Organización", "fr": "Organisation", "de": "Organisation" },
  "tpl.vcard.orgPh": { en: "Acme Inc" , "zh-CN": "某某公司", "zh-TW": "某某公司", "ja": "株式会社サンプル", "ko": "Acme 주식회사", "es": "Acme S.L.", "fr": "Acme SARL", "de": "Acme GmbH" },
  "tpl.vcard.title": { en: "Job title" , "zh-CN": "职位", "zh-TW": "職稱", "ja": "役職", "ko": "직함", "es": "Cargo", "fr": "Fonction", "de": "Position" },
  "tpl.vcard.titlePh": { en: "Engineer" , "zh-CN": "工程师", "zh-TW": "工程師", "ja": "エンジニア", "ko": "엔지니어", "es": "Ingeniera", "fr": "Ingénieur", "de": "Ingenieur" },
  "tpl.vcard.phone": { en: "Phone" , "zh-CN": "电话", "zh-TW": "電話", "ja": "電話番号", "ko": "전화", "es": "Teléfono", "fr": "Téléphone", "de": "Telefon" },
  "tpl.vcard.phonePh": { en: "+1 555 0100" , "zh-CN": "+86 138 0000 0000", "zh-TW": "+886 912 345 678", "ja": "+81 90 0000 0000", "ko": "+82 10-0000-0000", "es": "+34 600 000 000", "fr": "+33 6 12 34 56 78", "de": "+49 170 0000000" },
  "tpl.vcard.email": { en: "Email" , "zh-CN": "电子邮件", "zh-TW": "電子郵件", "ja": "メールアドレス", "ko": "이메일", "es": "Correo", "fr": "E-mail", "de": "E-Mail" },
  "tpl.vcard.emailPh": { en: "jane@acme.com" , "zh-CN": "zhang@acme.com", "zh-TW": "wang@acme.com", "ja": "yamada@acme.com", "ko": "hong@acme.com", "es": "ana@acme.com", "fr": "marie@acme.com", "de": "max@acme.com" },
  "tpl.vcard.website": { en: "Website" , "zh-CN": "网站", "zh-TW": "網站", "ja": "ウェブサイト", "ko": "웹사이트", "es": "Sitio web", "fr": "Site web", "de": "Webseite" },
  "tpl.vcard.websitePh": { en: "https://acme.com" , "zh-CN": "https://acme.com", "zh-TW": "https://acme.com", "ja": "https://acme.com", "ko": "https://acme.com", "es": "https://acme.com", "fr": "https://acme.com", "de": "https://acme.com" },
  "tpl.email.email": { en: "Email address" , "zh-CN": "电子邮件地址", "zh-TW": "電子郵件地址", "ja": "メールアドレス", "ko": "이메일 주소", "es": "Dirección de correo", "fr": "Adresse e-mail", "de": "E-Mail-Adresse" },
  "tpl.email.emailPh": { en: "jane@acme.com" , "zh-CN": "zhang@acme.com", "zh-TW": "wang@acme.com", "ja": "yamada@acme.com", "ko": "hong@acme.com", "es": "ana@acme.com", "fr": "marie@acme.com", "de": "max@acme.com" },
  "tpl.email.subject": { en: "Subject" , "zh-CN": "主题", "zh-TW": "主旨", "ja": "件名", "ko": "제목", "es": "Asunto", "fr": "Objet", "de": "Betreff" },
  "tpl.email.subjectPh": { en: "Hello" , "zh-CN": "你好", "zh-TW": "你好", "ja": "こんにちは", "ko": "안녕하세요", "es": "Hola", "fr": "Bonjour", "de": "Hallo" },
  "tpl.email.body": { en: "Body" , "zh-CN": "正文", "zh-TW": "內文", "ja": "本文", "ko": "본문", "es": "Cuerpo", "fr": "Corps", "de": "Text" },
  "tpl.email.bodyPh": { en: "Your message…" , "zh-CN": "您的消息…", "zh-TW": "您的訊息…", "ja": "メッセージ本文…", "ko": "메시지 내용…", "es": "Tu mensaje…", "fr": "Votre message…", "de": "Ihre Nachricht…" },
  "tpl.sms.number": { en: "Phone number" , "zh-CN": "电话号码", "zh-TW": "電話號碼", "ja": "電話番号", "ko": "전화번호", "es": "Número de teléfono", "fr": "Numéro de téléphone", "de": "Telefonnummer" },
  "tpl.sms.numberPh": { en: "+1 555 0100" , "zh-CN": "+86 138 0000 0000", "zh-TW": "+886 912 345 678", "ja": "+81 90 0000 0000", "ko": "+82 10-0000-0000", "es": "+34 600 000 000", "fr": "+33 6 12 34 56 78", "de": "+49 170 0000000" },
  "tpl.sms.message": { en: "Message" , "zh-CN": "短信内容", "zh-TW": "簡訊內容", "ja": "メッセージ", "ko": "메시지", "es": "Mensaje", "fr": "Message", "de": "Nachricht" },
  "tpl.sms.messagePh": { en: "Hi there!" , "zh-CN": "你好！", "zh-TW": "你好！", "ja": "こんにちは！", "ko": "안녕하세요!", "es": "¡Hola!", "fr": "Salut !", "de": "Hallo!" },
  "tpl.phone.number": { en: "Phone number" , "zh-CN": "电话号码", "zh-TW": "電話號碼", "ja": "電話番号", "ko": "전화번호", "es": "Número de teléfono", "fr": "Numéro de téléphone", "de": "Telefonnummer" },
  "tpl.phone.numberPh": { en: "+1 555 0100" , "zh-CN": "+86 138 0000 0000", "zh-TW": "+886 912 345 678", "ja": "+81 90 0000 0000", "ko": "+82 10-0000-0000", "es": "+34 600 000 000", "fr": "+33 6 12 34 56 78", "de": "+49 170 0000000" },
  "tpl.event.start": { en: "Start" , "zh-CN": "开始时间", "zh-TW": "開始時間", "ja": "開始", "ko": "시작", "es": "Inicio", "fr": "Début", "de": "Beginn" },
  "tpl.event.startPh": { en: "2026-08-27T14:00" , "zh-CN": "2026-08-27T14:00", "zh-TW": "2026-08-27T14:00", "ja": "2026-08-27T14:00", "ko": "2026-08-27T14:00", "es": "2026-08-27T14:00", "fr": "2026-08-27T14:00", "de": "2026-08-27T14:00" },
  "tpl.event.end": { en: "End" , "zh-CN": "结束时间", "zh-TW": "結束時間", "ja": "終了", "ko": "종료", "es": "Fin", "fr": "Fin", "de": "Ende" },
  "tpl.event.endPh": { en: "2026-08-27T15:00" , "zh-CN": "2026-08-27T15:00", "zh-TW": "2026-08-27T15:00", "ja": "2026-08-27T15:00", "ko": "2026-08-27T15:00", "es": "2026-08-27T15:00", "fr": "2026-08-27T15:00", "de": "2026-08-27T15:00" },
  "tpl.event.summary": { en: "Title" , "zh-CN": "标题", "zh-TW": "標題", "ja": "タイトル", "ko": "제목", "es": "Título", "fr": "Titre", "de": "Titel" },
  "tpl.event.summaryPh": { en: "Meeting" , "zh-CN": "会议", "zh-TW": "會議", "ja": "打ち合わせ", "ko": "회의", "es": "Reunión", "fr": "Réunion", "de": "Besprechung" },
  "tpl.event.location": { en: "Location" , "zh-CN": "地点", "zh-TW": "地點", "ja": "場所", "ko": "장소", "es": "Lugar", "fr": "Lieu", "de": "Ort" },
  "tpl.event.locationPh": { en: "Office" , "zh-CN": "办公室", "zh-TW": "辦公室", "ja": "オフィス", "ko": "사무실", "es": "Oficina", "fr": "Bureau", "de": "Büro" },
  "tpl.event.today": { en: "Today", "zh-CN": "今天", "zh-TW": "今天", ja: "今日", ko: "오늘", es: "Hoy", fr: "Aujourd'hui", de: "Heute" },
  "tpl.event.tomorrow": { en: "Tomorrow", "zh-CN": "明天", "zh-TW": "明天", ja: "明日", ko: "내일", es: "Mañana", fr: "Demain", de: "Morgen" },
  "tpl.event.year": { en: "Year", "zh-CN": "年", "zh-TW": "年", ja: "年", ko: "년", es: "Año", fr: "Année", de: "Jahr" },
  "tpl.event.month": { en: "Month", "zh-CN": "月", "zh-TW": "月", ja: "月", ko: "월", es: "Mes", fr: "Mois", de: "Monat" },
  "tpl.event.day": { en: "Day", "zh-CN": "日", "zh-TW": "日", ja: "日", ko: "일", es: "Día", fr: "Jour", de: "Tag" },
  "tpl.event.hour": { en: "Hour", "zh-CN": "时", "zh-TW": "時", ja: "時", ko: "시", es: "Hora", fr: "Heure", de: "Stunde" },
  "tpl.event.minute": { en: "Min", "zh-CN": "分", "zh-TW": "分", ja: "分", ko: "분", es: "Min", fr: "Min", de: "Min" },
  "tpl.geo.lat": { en: "Latitude" , "zh-CN": "纬度", "zh-TW": "緯度", "ja": "緯度", "ko": "위도", "es": "Latitud", "fr": "Latitude", "de": "Breitengrad" },
  "tpl.geo.latPh": { en: "37.4219" , "zh-CN": "39.9042", "zh-TW": "25.0330", "ja": "35.6762", "ko": "37.5665", "es": "40.4168", "fr": "48.8566", "de": "52.5200" },
  "tpl.geo.lng": { en: "Longitude" , "zh-CN": "经度", "zh-TW": "經度", "ja": "経度", "ko": "경도", "es": "Longitud", "fr": "Longitude", "de": "Längengrad" },
  "tpl.geo.lngPh": { en: "-122.0840" , "zh-CN": "116.4074", "zh-TW": "121.5654", "ja": "139.6503", "ko": "126.9780", "es": "-3.7038", "fr": "2.3522", "de": "13.4050" },
  "tpl.geo.map": { en: "Tap the map to set a location", "zh-CN": "点击地图选择位置", "zh-TW": "點擊地圖選擇位置", "ja": "地図をタップして場所を設定", "ko": "지도를 탭하여 위치 설정", "es": "Toca el mapa para fijar una ubicación", "fr": "Touche la carte pour placer un lieu", "de": "Karte tippen, um einen Ort zu setzen" },
  "tpl.geo.search": { en: "Search a place", "zh-CN": "搜索地点", "zh-TW": "搜尋地點", "ja": "場所を検索", "ko": "장소 검색", "es": "Buscar un lugar", "fr": "Rechercher un lieu", "de": "Ort suchen" },
  "tpl.geo.searchPh": { en: "e.g. Tokyo, Eiffel Tower", "zh-CN": "例如：东京、埃菲尔铁塔", "zh-TW": "例如：東京、艾菲爾鐵塔", "ja": "例：東京、エッフェル塔", "ko": "예: 도쿄, 에펠탑", "es": "ej. Tokio, Torre Eiffel", "fr": "ex. Tokyo, Tour Eiffel", "de": "z.B. Tokio, Eiffelturm" },
  "tpl.geo.quick": { en: "Quick picks", "zh-CN": "快速选择", "zh-TW": "快速選擇", "ja": "クイック選択", "ko": "빠른 선택", "es": "Accesos rápidos", "fr": "Raccourcis", "de": "Schnellwahl" },
  "tpl.geo.current": { en: "Selected", "zh-CN": "已选位置", "zh-TW": "已選位置", "ja": "選択済み", "ko": "선택됨", "es": "Seleccionado", "fr": "Sélection", "de": "Ausgewählt" },
  "tpl.geo.searching": { en: "Searching…", "zh-CN": "搜索中…", "zh-TW": "搜尋中…", "ja": "検索中…", "ko": "검색 중…", "es": "Buscando…", "fr": "Recherche…", "de": "Suche…" },
  "tpl.geo.notFound": { en: "No match found — tap the map instead.", "zh-CN": "未找到，请点击地图选择。", "zh-TW": "未找到，請點擊地圖選擇。", "ja": "見つかりません。地図をタップしてください。", "ko": "결과 없음 — 지도를 탭하세요.", "es": "Sin resultados — toca el mapa.", "fr": "Aucun résultat — touche la carte.", "de": "Kein Treffer — karte tippen." },
  "tpl.geo.myLocation": { en: "Use my location", "zh-CN": "使用我的位置", "zh-TW": "使用我的位置", "ja": "現在地を使う", "ko": "내 위치 사용", "es": "Usar mi ubicación", "fr": "Utiliser ma position", "de": "Meinen Standort verwenden" },
  "tpl.geo.locateFail": { en: "Couldn't detect your location — search or tap the map instead.", "zh-CN": "无法获取当前位置——请搜索或点击地图。", "zh-TW": "無法取得目前位置——請搜尋或點擊地圖。", "ja": "現在地を取得できませんでした。検索するか地図をタップしてください。", "ko": "현재 위치를 찾을 수 없습니다. 검색하거나 지도를 탭하세요.", "es": "No se pudo detectar tu ubicación: busca o toca el mapa.", "fr": "Position introuvable — recherchez ou touchez la carte.", "de": "Standort konnte nicht ermittelt werden — suchen oder Karte tippen." },
  "tpl.geo.searchPhNear": { en: "Search near {place}…", "zh-CN": "在{place}附近搜索…", "zh-TW": "在{place}附近搜尋…", "ja": "{place}周辺を検索…", "ko": "{place} 근처 검색…", "es": "Buscar cerca de {place}…", "fr": "Rechercher près de {place}…", "de": "In der Nähe von {place} suchen…" },
  "tpl.geo.downloadWorld": { en: "Download world map", "zh-CN": "下载世界地图", "zh-TW": "下載世界地圖", "ja": "世界地図をダウンロード", "ko": "세계 지도 다운로드", "es": "Descargar mapa mundial", "fr": "Télécharger la carte du monde", "de": "Weltkarte herunterladen" },
  "tpl.geo.downloadArea": { en: "Download this area", "zh-CN": "下载此区域", "zh-TW": "下載此區域", "ja": "この地域をダウンロード", "ko": "이 지역 다운로드", "es": "Descargar esta zona", "fr": "Télécharger cette zone", "de": "Diesen Bereich herunterladen" },
  "tpl.geo.downloading": { en: "Downloading {done} / {total} tiles…", "zh-CN": "正在下载 {done} / {total} 张图块…", "zh-TW": "正在下載 {done} / {total} 張圖磚…", "ja": "{done} / {total} タイルをダウンロード中…", "ko": "{done} / {total} 타일 다운로드 중…", "es": "Descargando {done} / {total} teselas…", "fr": "Téléchargement {done} / {total} tuiles…", "de": "{done} / {total} Kacheln werden geladen…" },
  "tpl.geo.downloadDone": { en: "Saved {n} tiles for offline use.", "zh-CN": "已保存 {n} 张图块，可离线使用。", "zh-TW": "已儲存 {n} 張圖磚，可離線使用。", "ja": "{n} タイルを保存しました（オフライン利用可）。", "ko": "{n}개 타일을 저장했습니다(오프라인 사용 가능).", "es": "{n} teselas guardadas para uso sin conexión.", "fr": "{n} tuiles enregistrées pour une utilisation hors ligne.", "de": "{n} Kacheln für die Offline-Nutzung gespeichert." },
  "tpl.geo.downloadCancelled": { en: "Download cancelled.", "zh-CN": "已取消下载。", "zh-TW": "已取消下載。", "ja": "ダウンロードを中止しました。", "ko": "다운로드를 취소했습니다.", "es": "Descarga cancelada.", "fr": "Téléchargement annulé.", "de": "Download abgebrochen." },
  "tpl.geo.areaTooBig": { en: "That is {n} tiles — zoom in first, then download.", "zh-CN": "共 {n} 张图块，请先放大再下载。", "zh-TW": "共 {n} 張圖磚，請先放大再下載。", "ja": "{n} タイルになります。先に拡大してからダウンロードしてください。", "ko": "{n}개 타일입니다. 먼저 확대한 뒤 다운로드하세요.", "es": "Son {n} teselas: amplía primero y descarga después.", "fr": "Cela représente {n} tuiles — zoomez d'abord, puis téléchargez.", "de": "Das sind {n} Kacheln — zuerst hineinzoomen, dann herunterladen." },
  "tpl.geo.cacheSize": { en: "Offline maps: {tiles} tiles · {size}", "zh-CN": "离线地图：{tiles} 张图块 · {size}", "zh-TW": "離線地圖：{tiles} 張圖磚 · {size}", "ja": "オフライン地図：{tiles} タイル · {size}", "ko": "오프라인 지도: {tiles}타일 · {size}", "es": "Mapas sin conexión: {tiles} teselas · {size}", "fr": "Cartes hors ligne : {tiles} tuiles · {size}", "de": "Offline-Karten: {tiles} Kacheln · {size}" },
  "tpl.geo.cacheEmpty": { en: "Offline maps: none yet", "zh-CN": "离线地图：暂无", "zh-TW": "離線地圖：尚無", "ja": "オフライン地図：まだありません", "ko": "오프라인 지도: 없음", "es": "Mapas sin conexión: ninguno todavía", "fr": "Cartes hors ligne : aucune pour l'instant", "de": "Offline-Karten: noch keine" },
  "tpl.geo.cacheCleared": { en: "Offline maps cleared.", "zh-CN": "离线地图已清除。", "zh-TW": "離線地圖已清除。", "ja": "オフライン地図を削除しました。", "ko": "오프라인 지도를 삭제했습니다.", "es": "Mapas sin conexión borrados.", "fr": "Cartes hors ligne effacées.", "de": "Offline-Karten gelöscht." },
  "tpl.geo.clearCache": { en: "Clear", "zh-CN": "清除", "zh-TW": "清除", "ja": "削除", "ko": "삭제", "es": "Borrar", "fr": "Effacer", "de": "Löschen" },
  "tpl.geo.cancel": { en: "Cancel", "zh-CN": "取消", "zh-TW": "取消", "ja": "キャンセル", "ko": "취소", "es": "Cancelar", "fr": "Annuler", "de": "Abbrechen" },
  "tpl.wifi.scan": { en: "Scan nearby" , "zh-CN": "扫描附近网络", "zh-TW": "掃描附近網路", "ja": "近くのネットワークをスキャン", "ko": "주변 네트워크 스캔", "es": "Escanear redes cercanas", "fr": "Scanner les réseaux proches", "de": "Netzwerke in der Nähe scannen" },
  "tpl.wifi.scanning": { en: "Scanning for networks…" , "zh-CN": "正在扫描网络…", "zh-TW": "正在掃描網路…", "ja": "ネットワークを検索中…", "ko": "네트워크 검색 중…", "es": "Buscando redes…", "fr": "Recherche des réseaux…", "de": "Suche nach Netzwerken…" },
  "tpl.wifi.none": { en: "No visible networks. macOS only shows the network you're connected to unless Location Services is enabled — you can still type the name." , "zh-CN": "没有可见网络。除非启用定位服务，macOS 只显示当前连接的网络——您仍可手动输入名称。", "zh-TW": "沒有可見網路。除非啟用定位服務，macOS 只顯示目前連線的網路——您仍可手動輸入名稱。", "ja": "表示できるネットワークがありません。位置情報サービスを有効にしない限り、macOSは接続中のネットワークのみ表示します。名前は手動入力できます。", "ko": "표시할 네트워크가 없습니다. 위치 서비스를 켜지 않으면 macOS는 현재 연결된 네트워크만 표시합니다. 이름은 직접 입력할 수 있습니다.", "es": "No hay redes visibles. macOS solo muestra la red a la que estás conectado salvo que actives los Servicios de Ubicación; puedes escribir el nombre igualmente.", "fr": "Aucun réseau visible. macOS n'affiche que le réseau auquel vous êtes connecté, sauf si les Services de localisation sont activés — vous pouvez toujours saisir le nom.", "de": "Keine sichtbaren Netzwerke. macOS zeigt nur das verbundene Netzwerk an, außer Standortdienste sind aktiviert — Sie können den Namen trotzdem eingeben." },
  "tpl.wifi.fail": { en: "Couldn't scan — you can still type the network name." , "zh-CN": "扫描失败——您仍可手动输入网络名称。", "zh-TW": "掃描失敗——您仍可手動輸入網路名稱。", "ja": "スキャンできませんでした。ネットワーク名は手動入力できます。", "ko": "스캔하지 못했습니다. 네트워크 이름은 직접 입력할 수 있습니다.", "es": "No se pudo escanear; puedes escribir el nombre de la red igualmente.", "fr": "Échec du scan — vous pouvez toujours saisir le nom du réseau.", "de": "Scan fehlgeschlagen — Sie können den Netzwerknamen trotzdem eingeben." },
  "tpl.wifi.needLocation": { en: "macOS is hiding nearby networks because Kuiqr doesn't have Location Services access. Allow it in System Settings → Privacy & Security → Location Services, then scan again — or just type the name below.", "zh-CN": "macOS 已隐藏附近网络，因为 Kuiqr 没有定位服务权限。请在「系统设置 → 隐私与安全性 → 定位服务」中允许，然后重新扫描——也可以直接在下方输入名称。", "zh-TW": "macOS 已隱藏附近網路，因為 Kuiqr 沒有定位服務權限。請在「系統設定 → 隱私權與安全性 → 定位服務」中允許，然後重新掃描——也可以直接在下方輸入名稱。", "ja": "Kuiqrに位置情報サービスへのアクセスがないため、macOSは近くのネットワークを非表示にしています。「システム設定 → プライバシーとセキュリティ → 位置情報サービス」で許可してから再スキャンしてください。下に名前を直接入力することもできます。", "ko": "Kuiqr에 위치 서비스 접근 권한이 없어 macOS가 주변 네트워크를 숨기고 있습니다. 시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스에서 허용한 뒤 다시 스캔하세요. 아래에 이름을 직접 입력할 수도 있습니다.", "es": "macOS oculta las redes cercanas porque Kuiqr no tiene acceso a los Servicios de Ubicación. Permítelo en Ajustes del Sistema → Privacidad y seguridad → Servicios de Ubicación y vuelve a escanear, o escribe el nombre abajo.", "fr": "macOS masque les réseaux proches car Kuiqr n'a pas accès aux Services de localisation. Autorisez-le dans Réglages Système → Confidentialité et sécurité → Services de localisation, puis relancez le scan — ou saisissez le nom ci-dessous.", "de": "macOS versteckt Netzwerke in der Nähe, da Kuiqr keinen Zugriff auf die Ortungsdienste hat. Erlaube es unter Systemeinstellungen → Datenschutz & Sicherheit → Ortungsdienste und scanne erneut — oder gib den Namen unten ein." },
  "tpl.wifi.openLocation": { en: "Open Location Settings", "zh-CN": "打开定位服务设置", "zh-TW": "開啟定位服務設定", ja: "位置情報設定を開く", ko: "위치 서비스 설정 열기", es: "Abrir Servicios de Ubicación", fr: "Ouvrir Services de localisation", de: "Ortungsdienste öffnen" },
  "tpl.wifi.locationHint": { en: "Only showing networks macOS lets Kuiqr see. Allow Location Services to list all nearby networks.", "zh-CN": "仅显示 macOS 允许 Kuiqr 查看的网络。允许定位服务后可列出所有附近网络。", "zh-TW": "僅顯示 macOS 允許 Kuiqr 查看的網路。允許定位服務後可列出所有附近網路。", "ja": "macOSがKuiqrに許可したネットワークのみ表示しています。位置情報サービスを許可すると、近くのすべてのネットワークが表示されます。", "ko": "macOS가 Kuiqr에 허용한 네트워크만 표시됩니다. 위치 서비스를 허용하면 주변 모든 네트워크가 표시됩니다.", "es": "Solo se muestran las redes que macOS permite ver a Kuiqr. Activa los Servicios de Ubicación para listar todas las redes cercanas.", "fr": "Seuls les réseaux que macOS autorise Kuiqr à voir sont affichés. Activez les Services de localisation pour lister tous les réseaux proches.", "de": "Es werden nur Netzwerke angezeigt, die macOS Kuiqr sehen lässt. Aktiviere die Ortungsdienste, um alle Netzwerke in der Nähe zu listen." },
  "tpl.wifi.typeMyself": { en: "Type it myself", "zh-CN": "手动输入", "zh-TW": "手動輸入", ja: "自分で入力", ko: "직접 입력", es: "Escribirlo yo", fr: "Saisir manuellement", de: "Selbst eingeben" },
  "tpl.wifi.manualHint": { en: "Or just type the network name above", "zh-CN": "或者直接在上方输入网络名称", "zh-TW": "或者直接在上方輸入網路名稱", ja: "または上に名前を入力", ko: "또는 위에 이름을 직접 입력", es: "O escribe el nombre arriba", fr: "O saisis le nom ci-dessus", de: "Oder gib den Namen oben ein" },
  "tpl.wifi.groupCurrent": { en: "Connected now", "zh-CN": "当前连接", "zh-TW": "目前連線", ja: "接続中", ko: "연결됨", es: "Conectada ahora", fr: "Connecté actuellement", "de": "Aktuell verbunden" },
  "tpl.wifi.groupNearby": { en: "In range", "zh-CN": "附近可搜到", "zh-TW": "附近可搜到", ja: "受信範囲内", ko: "수신 범위", es: "Al alcance", fr: "À portée", "de": "In Reichweite" },
  "tpl.wifi.groupSaved": { en: "Saved on this Mac", "zh-CN": "此 Mac 已保存", "zh-TW": "此 Mac 已儲存", ja: "この Mac に保存済み", ko: "이 Mac에 저장됨", es: "Guardadas en este Mac", fr: "Enregistrés sur ce Mac", "de": "Auf diesem Mac gespeichert" },

  // ── QR Generator: styling (Step 2) ──
  "gen.style": { en: "Style & Colors" , "zh-CN": "样式与颜色", "zh-TW": "樣式與顏色", "ja": "スタイルと色", "ko": "스타일 및 색상", "es": "Estilo y colores", "fr": "Style et couleurs", "de": "Stil & Farben" },
  "gen.styleHint": { en: "colors · logo · dots · quiet zone" , "zh-CN": "颜色 · 图标 · 圆点 · 边距", "zh-TW": "顏色 · 圖示 · 圓點 · 邊距", "ja": "色 · ロゴ · ドット · クワイエットゾーン", "ko": "색상 · 로고 · 점 · 여백", "es": "colores · logo · puntos · zona de silencio", "fr": "couleurs · logo · points · zone de silence", "de": "Farben · Logo · Punkte · Ruhezone" },
  "gen.styleReset": { en: "Reset to default style" , "zh-CN": "恢复默认样式", "zh-TW": "還原預設樣式", "ja": "スタイルをリセット", "ko": "기본 스타일로 재설정", "es": "Restablecer estilo predeterminado", "fr": "Réinitialiser le style par défaut", "de": "Auf Standardstil zurücksetzen" },
  "gen.exportHint": { en: "sizes · DPI · caption" , "zh-CN": "尺寸 · DPI · 标题", "zh-TW": "尺寸 · DPI · 標題", "ja": "サイズ · DPI · キャプション", "ko": "크기 · DPI · 캡션", "es": "tamaños · DPI · leyenda", "fr": "tailles · DPI · légende", "de": "Größen · DPI · Beschriftung" },
  "gen.fg": { en: "Foreground" , "zh-CN": "前景色", "zh-TW": "前景色", "ja": "前景色", "ko": "전경색", "es": "Primer plano", "fr": "Premier plan", "de": "Vordergrund" },
  "gen.bg": { en: "Background" , "zh-CN": "背景色", "zh-TW": "背景色", "ja": "背景色", "ko": "배경색", "es": "Fondo", "fr": "Arrière-plan", "de": "Hintergrund" },
  "gen.contrastLow": { en: "Contrast is too low — this QR may fail to scan. Use a darker foreground or lighter background." , "zh-CN": "对比度过低——此二维码可能无法扫描。请使用更深的前景色或更浅的背景色。", "zh-TW": "對比度過低——此 QR Code 可能無法掃描。請使用更深的前景色或更淺的背景色。", "ja": "コントラストが低すぎます。スキャンできない場合があります。より暗い前景色か明るい背景色を使用してください。", "ko": "대비가 너무 낮습니다. 스캔에 실패할 수 있습니다. 더 어두운 전경색이나 더 밝은 배경색을 사용하세요.", "es": "Contraste demasiado bajo: este QR podría fallar al escanear. Usa un primer plano más oscuro o un fondo más claro.", "fr": "Contraste trop faible — ce QR pourrait ne pas se scanner. Utilisez un premier plan plus foncé ou un fond plus clair.", "de": "Kontrast zu gering — dieser QR-Code lässt sich womöglich nicht scannen. Dunkleren Vordergrund oder helleren Hintergrund verwenden." },
  "gen.contrastWeak": { en: "Low contrast — consider a darker foreground or lighter background for reliable scanning." , "zh-CN": "对比度较低——建议使用更深的前景色或更浅的背景色以确保可靠扫描。", "zh-TW": "對比度較低——建議使用更深的前景色或更淺的背景色以確保可靠掃描。", "ja": "コントラストが低めです。確実にスキャンするには、より暗い前景色か明るい背景色を推奨します。", "ko": "대비가 낮습니다. 안정적인 스캔을 위해 더 어두운 전경색이나 더 밝은 배경색을 권장합니다.", "es": "Contraste bajo: considera un primer plano más oscuro o un fondo más claro para un escaneo fiable.", "fr": "Contraste faible — envisagez un premier plan plus foncé ou un fond plus clair pour un scan fiable.", "de": "Geringer Kontrast — für zuverlässiges Scannen dunkleren Vordergrund oder helleren Hintergrund verwenden." },
  "gen.eccNote": { en: "A logo covers part of the code, so error correction was raised to High (H) to keep it scannable." , "zh-CN": "图标覆盖了部分码区，纠错级别已提升至高（H）以保持可扫描。", "zh-TW": "圖示覆蓋了部分碼區，糾錯級別已提升至高（H）以保持可掃描。", "ja": "ロゴがコードの一部を覆うため、スキャン可能性を保つために誤り訂正レベルを高（H）に上げました。", "ko": "로고가 코드 일부를 덮으므로 스캔 가능성을 유지하기 위해 오류 수정 수준이 높음(H)으로 올라갔습니다.", "es": "El logo cubre parte del código, así que la corrección de errores se subió a Alta (H) para mantenerlo escaneable.", "fr": "Le logo couvre une partie du code, le niveau de correction d'erreurs a donc été porté à Élevé (H) pour rester scannable.", "de": "Das Logo bedeckt einen Teil des Codes, daher wurde die Fehlerkorrektur auf Hoch (H) erhöht, um die Scanbarkeit zu erhalten." },
  "gen.logo": { en: "Logo" , "zh-CN": "图标", "zh-TW": "圖示", "ja": "ロゴ", "ko": "로고", "es": "Logo", "fr": "Logo", "de": "Logo" },
  "gen.logoPick": { en: "Choose image…" , "zh-CN": "选择图片…", "zh-TW": "選擇圖片…", "ja": "画像を選択…", "ko": "이미지 선택…", "es": "Elegir imagen…", "fr": "Choisir une image…", "de": "Bild auswählen…" },
  "gen.logoNone": { en: "Remove" , "zh-CN": "移除", "zh-TW": "移除", "ja": "削除", "ko": "제거", "es": "Quitar", "fr": "Retirer", "de": "Entfernen" },
  "gen.logoOk": { en: "Logo looks good — the code still decodes." , "zh-CN": "图标效果良好——二维码仍可正常解码。", "zh-TW": "圖示效果良好——QR Code 仍可正常解碼。", "ja": "ロゴは問題ありません。コードは正しくデコードできます。", "ko": "로고가 정상입니다. 코드가 여전히 디코딩됩니다.", "es": "El logo se ve bien: el código sigue decodificándose.", "fr": "Le logo est bon — le code se décode toujours.", "de": "Das Logo passt — der Code wird weiterhin dekodiert." },
  "gen.logoFail": { en: "Warning: the code no longer decodes with this logo. Use a smaller logo or higher error correction." , "zh-CN": "警告：加入此图标后二维码无法解码。请使用更小的图标或更高的纠错级别。", "zh-TW": "警告：加入此圖示後 QR Code 無法解碼。請使用更小的圖示或更高的糾錯級別。", "ja": "警告: このロゴではコードがデコードできなくなりました。より小さいロゴか、より高い誤り訂正レベルを使用してください。", "ko": "경고: 이 로고 때문에 코드가 디코딩되지 않습니다. 더 작은 로고나 더 높은 오류 수정 수준을 사용하세요.", "es": "Aviso: el código ya no decodifica con este logo. Usa un logo más pequeño o mayor corrección de errores.", "fr": "Attention : le code ne se décode plus avec ce logo. Utilisez un logo plus petit ou une correction d'erreurs plus élevée.", "de": "Warnung: Der Code wird mit diesem Logo nicht mehr dekodiert. Kleineres Logo oder höhere Fehlerkorrektur verwenden." },
  "gen.logoMismatch": { en: "Warning: decoded content differs from the input (the logo may be corrupting the code)." , "zh-CN": "警告：解码内容与输入不一致（图标可能破坏了二维码）。", "zh-TW": "警告：解碼內容與輸入不一致（圖示可能破壞了 QR Code）。", "ja": "警告: デコード結果が入力と一致しません（ロゴがコードを壊している可能性があります）。", "ko": "경고: 디코딩된 내용이 입력과 다릅니다(로고가 코드를 손상했을 수 있음).", "es": "Aviso: el contenido decodificado difiere de la entrada (el logo podría estar corrompiendo el código).", "fr": "Attention : le contenu décodé diffère de l'entrée (le logo corrompt peut-être le code).", "de": "Warnung: Der dekodierte Inhalt weicht von der Eingabe ab (das Logo beschädigt möglicherweise den Code)." },
  "gen.dotStyle": { en: "Dot style" , "zh-CN": "圆点样式", "zh-TW": "圓點樣式", "ja": "ドットスタイル", "ko": "점 스타일", "es": "Estilo de puntos", "fr": "Style des points", "de": "Punktstil" },
  "gen.dot.square": { en: "Square" , "zh-CN": "方形", "zh-TW": "方形", "ja": "四角", "ko": "사각형", "es": "Cuadrado", "fr": "Carré", "de": "Quadrat" },
  "gen.dot.rounded": { en: "Rounded" , "zh-CN": "圆角", "zh-TW": "圓角", "ja": "角丸", "ko": "둥근 모서리", "es": "Redondeado", "fr": "Arrondi", "de": "Abgerundet" },
  "gen.dot.dots": { en: "Dots" , "zh-CN": "圆点", "zh-TW": "圓點", "ja": "ドット", "ko": "점", "es": "Puntos", "fr": "Points", "de": "Punkte" },
  "gen.finderColor": { en: "Finder color" , "zh-CN": "定位角颜色", "zh-TW": "定位角顏色", "ja": "ファインダー色", "ko": "파인더 색상", "es": "Color del buscador", "fr": "Couleur des repères", "de": "Finder-Farbe" },
  "gen.finderDot": { en: "Center dot" , "zh-CN": "中心圆点", "zh-TW": "中心圓點", "ja": "中心ドット", "ko": "중앙 점", "es": "Punto central", "fr": "Point central", "de": "Mittelpunkt" },
  "gen.quiet": { en: "Quiet zone (modules)" , "zh-CN": "留白（模块数）", "zh-TW": "留白（模組數）", "ja": "クワイエットゾーン（モジュール数）", "ko": "여백(모듈 수)", "es": "Zona de silencio (módulos)", "fr": "Zone de silence (modules)", "de": "Ruhezone (Module)" },
  "gen.export": { en: "Export" , "zh-CN": "导出", "zh-TW": "匯出", "ja": "エクスポート", "ko": "내보내기", "es": "Exportar", "fr": "Exporter", "de": "Export" },
  "gen.exportDesc": { en: "Pick a format — its options appear below.", "zh-CN": "选择格式——对应选项会显示在下方。", "zh-TW": "選擇格式——對應選項會顯示在下方。", ja: "形式を選ぶと、そのオプションが下に表示されます。", ko: "형식을 선택하면 옵션이 아래에 표시됩니다.", es: "Elige un formato — sus opciones aparecen abajo.", fr: "Choisissez un format — ses options apparaissent ci-dessous.", de: "Wähle ein Format — die Optionen erscheinen darunter." },
  "gen.exportFormat": { en: "Format", "zh-CN": "格式", "zh-TW": "格式", ja: "形式", ko: "형식", es: "Formato", fr: "Format", de: "Format" },
  "gen.pngPreset": { en: "PNG size" , "zh-CN": "PNG 尺寸", "zh-TW": "PNG 尺寸", "ja": "PNGサイズ", "ko": "PNG 크기", "es": "Tamaño PNG", "fr": "Taille PNG", "de": "PNG-Größe" },
  "gen.svgEdge": { en: "SVG size" , "zh-CN": "SVG 尺寸", "zh-TW": "SVG 尺寸", "ja": "SVGサイズ", "ko": "SVG 크기", "es": "Tamaño SVG", "fr": "Taille SVG", "de": "SVG-Größe" },
  "gen.pdfSize": { en: "PDF size" , "zh-CN": "PDF 尺寸", "zh-TW": "PDF 尺寸", "ja": "PDFサイズ", "ko": "PDF 크기", "es": "Tamaño PDF", "fr": "Taille PDF", "de": "PDF-Größe" },
  "gen.pdf.30mm": { en: "30 mm sticker" , "zh-CN": "30 毫米贴纸", "zh-TW": "30 公釐貼紙", "ja": "30mmステッカー", "ko": "30mm 스티커", "es": "Pegatina de 30 mm", "fr": "Autocollant 30 mm", "de": "30-mm-Aufkleber" },
  "gen.pdf.50mm": { en: "50 mm sticker" , "zh-CN": "50 毫米贴纸", "zh-TW": "50 公釐貼紙", "ja": "50mmステッカー", "ko": "50mm 스티커", "es": "Pegatina de 50 mm", "fr": "Autocollant 50 mm", "de": "50-mm-Aufkleber" },
  "gen.pdf.80mm": { en: "80 mm sticker" , "zh-CN": "80 毫米贴纸", "zh-TW": "80 公釐貼紙", "ja": "80mmステッカー", "ko": "80mm 스티커", "es": "Pegatina de 80 mm", "fr": "Autocollant 80 mm", "de": "80-mm-Aufkleber" },
  "gen.pdf.card": { en: "Business card (90×50 mm)" , "zh-CN": "名片（90×50 毫米）", "zh-TW": "名片（90×50 公釐）", "ja": "名刺（90×50mm）", "ko": "명함(90×50mm)", "es": "Tarjeta (90×50 mm)", "fr": "Carte de visite (90×50 mm)", "de": "Visitenkarte (90×50 mm)" },
  "gen.pdfCaption": { en: "PDF caption (printed under the code)", "zh-CN": "PDF 说明文字（打印在二维码下方）", "zh-TW": "PDF 說明文字（印在 QR Code 下方）", ja: "PDF キャプション（コードの下に印刷）", ko: "PDF 캡션 (코드 아래 인쇄)", es: "Pie de PDF (debajo del código)", fr: "Légende PDF (sous le code)", de: "PDF-Unterschrift (unter dem Code)" },
  "gen.pdfLibMissing": { en: "PDF library failed to load." , "zh-CN": "PDF 库加载失败。", "zh-TW": "PDF 程式庫載入失敗。", "ja": "PDFライブラリの読み込みに失敗しました。", "ko": "PDF 라이브러리를 불러오지 못했습니다.", "es": "No se pudo cargar la librería PDF.", "fr": "Échec du chargement de la librairie PDF.", "de": "PDF-Bibliothek konnte nicht geladen werden." },
  "gen.exportSVG": { en: "Export SVG" , "zh-CN": "导出 SVG", "zh-TW": "匯出 SVG", "ja": "SVGをエクスポート", "ko": "SVG 내보내기", "es": "Exportar SVG", "fr": "Exporter en SVG", "de": "SVG exportieren" },
  "gen.exportPDF": { en: "Export PDF" , "zh-CN": "导出 PDF", "zh-TW": "匯出 PDF", "ja": "PDFをエクスポート", "ko": "PDF 내보내기", "es": "Exportar PDF", "fr": "Exporter en PDF", "de": "PDF exportieren" },

  // ── Batch generation (Step 4) ──
  "batch.btn": { en: "Batch from CSV…" , "zh-CN": "从 CSV 批量生成…", "zh-TW": "從 CSV 批量產生…", "ja": "CSVから一括生成…", "ko": "CSV에서 일괄 생성…", "es": "Lote desde CSV…", "fr": "Lot depuis CSV…", "de": "Stapel aus CSV…" },
  "batch.title": { en: "Batch generate from CSV" , "zh-CN": "从 CSV 批量生成", "zh-TW": "從 CSV 批量產生", "ja": "CSVから一括生成", "ko": "CSV에서 일괄 생성", "es": "Generación en lote desde CSV", "fr": "Génération en lot depuis CSV", "de": "Stapelgenerierung aus CSV" },
  "batch.csv": { en: "CSV file" , "zh-CN": "CSV 文件", "zh-TW": "CSV 檔案", "ja": "CSVファイル", "ko": "CSV 파일", "es": "Archivo CSV", "fr": "Fichier CSV", "de": "CSV-Datei" },
  "batch.noCsv": { en: "No CSV selected" , "zh-CN": "未选择 CSV", "zh-TW": "未選擇 CSV", "ja": "CSVが未選択", "ko": "CSV 미선택", "es": "Sin CSV seleccionado", "fr": "Aucun CSV sélectionné", "de": "Kein CSV ausgewählt" },
  "batch.template": { en: "Template" , "zh-CN": "模板", "zh-TW": "範本", "ja": "テンプレート", "ko": "템플릿", "es": "Plantilla", "fr": "Modèle", "de": "Vorlage" },
  "batch.map": { en: "Column mapping" , "zh-CN": "列映射", "zh-TW": "欄位對應", "ja": "列のマッピング", "ko": "열 매핑", "es": "Mapeo de columnas", "fr": "Mappage des colonnes", "de": "Spaltenzuordnung" },
  "batch.map.content": { en: "Content column" , "zh-CN": "内容列", "zh-TW": "內容欄", "ja": "コンテンツ列", "ko": "내용 열", "es": "Columna de contenido", "fr": "Colonne de contenu", "de": "Inhaltsspalte" },
  "batch.map.hidden": { en: "Hidden column" , "zh-CN": "隐藏列", "zh-TW": "隱藏欄", "ja": "非表示列", "ko": "숨김 열", "es": "Columna oculta", "fr": "Colonne masquée", "de": "Verborgene Spalte" },
  "batch.map.filename": { en: "Filename column (optional)" , "zh-CN": "文件名列（可选）", "zh-TW": "檔名欄（可選）", "ja": "ファイル名列（任意）", "ko": "파일 이름 열(선택)", "es": "Columna de nombre de archivo (opcional)", "fr": "Colonne du nom de fichier (facultatif)", "de": "Dateinamensspalte (optional)" },
  "batch.outFolder": { en: "Output folder" , "zh-CN": "输出文件夹", "zh-TW": "輸出資料夾", "ja": "出力フォルダ", "ko": "출력 폴더", "es": "Carpeta de salida", "fr": "Dossier de sortie", "de": "Ausgabeordner" },
  "batch.chooseFolder": { en: "Choose…" , "zh-CN": "选择…", "zh-TW": "選擇…", "ja": "選択…", "ko": "선택…", "es": "Elegir…", "fr": "Choisir…", "de": "Auswählen…" },
  "batch.includePNG": { en: "PNG" , "zh-CN": "PNG", "zh-TW": "PNG", "ja": "PNG", "ko": "PNG", "es": "PNG", "fr": "PNG", "de": "PNG" },
  "batch.includeSVG": { en: "SVG" , "zh-CN": "SVG", "zh-TW": "SVG", "ja": "SVG", "ko": "SVG", "es": "SVG", "fr": "SVG", "de": "SVG" },
  "batch.zip": { en: "Zip folder" , "zh-CN": "压缩文件夹", "zh-TW": "壓縮資料夾", "ja": "フォルダをZIP化", "ko": "폴더 압축", "es": "Comprimir carpeta", "fr": "Compresser le dossier", "de": "Ordner zippen" },
  "batch.zipName": { en: "Zip name" , "zh-CN": "压缩包名称", "zh-TW": "壓縮檔名稱", "ja": "ZIP名", "ko": "ZIP 이름", "es": "Nombre del ZIP", "fr": "Nom du ZIP", "de": "ZIP-Name" },
  "batch.start": { en: "Generate" , "zh-CN": "生成", "zh-TW": "產生", "ja": "生成", "ko": "생성", "es": "Generar", "fr": "Générer", "de": "Generieren" },
  "batch.close": { en: "Close" , "zh-CN": "关闭", "zh-TW": "關閉", "ja": "閉じる", "ko": "닫기", "es": "Cerrar", "fr": "Fermer", "de": "Schließen" },
  "batch.cancel": { en: "Cancel" , "zh-CN": "取消", "zh-TW": "取消", "ja": "キャンセル", "ko": "취소", "es": "Cancelar", "fr": "Annuler", "de": "Abbrechen" },
  "batch.running": { en: "Generated {n} / {total}" , "zh-CN": "已生成 {n} / {total}", "zh-TW": "已產生 {n} / {total}", "ja": "{n} / {total} を生成済み", "ko": "{n} / {total} 생성됨", "es": "Generados {n} / {total}", "fr": "Générés {n} / {total}", "de": "{n} / {total} generiert" },
  "batch.done": { en: "Done. {done} generated, {skipped} skipped (of {total})." , "zh-CN": "完成。已生成 {done} 个，跳过 {skipped} 个（共 {total} 个）。", "zh-TW": "完成。已產生 {done} 個，跳過 {skipped} 個（共 {total} 個）。", "ja": "完了。{done} 件を生成、{skipped} 件をスキップ（全 {total} 件）。", "ko": "완료. {done}개 생성, {skipped}개 건너뜀(전체 {total}개).", "es": "Hecho. {done} generados, {skipped} omitidos (de {total}).", "fr": "Terminé. {done} générés, {skipped} ignorés (sur {total}).", "de": "Fertig. {done} generiert, {skipped} übersprungen (von {total})." },
  "batch.needCsv": { en: "Please choose a CSV file." , "zh-CN": "请选择一个 CSV 文件。", "zh-TW": "請選擇一個 CSV 檔案。", "ja": "CSVファイルを選択してください。", "ko": "CSV 파일을 선택하세요.", "es": "Elige un archivo CSV.", "fr": "Veuillez choisir un fichier CSV.", "de": "Bitte eine CSV-Datei auswählen." },
  "batch.needFolder": { en: "Please choose an output folder." , "zh-CN": "请选择输出文件夹。", "zh-TW": "請選擇輸出資料夾。", "ja": "出力フォルダを選択してください。", "ko": "출력 폴더를 선택하세요.", "es": "Elige una carpeta de salida.", "fr": "Veuillez choisir un dossier de sortie.", "de": "Bitte einen Ausgabeordner auswählen." },
  "batch.needFormat": { en: "Select at least one output format (PNG or SVG)." , "zh-CN": "请至少选择一种输出格式（PNG 或 SVG）。", "zh-TW": "請至少選擇一種輸出格式（PNG 或 SVG）。", "ja": "出力形式（PNGまたはSVG）を少なくとも1つ選択してください。", "ko": "출력 형식(PNG 또는 SVG)을 하나 이상 선택하세요.", "es": "Selecciona al menos un formato de salida (PNG o SVG).", "fr": "Sélectionnez au moins un format de sortie (PNG ou SVG).", "de": "Mindestens ein Ausgabeformat (PNG oder SVG) auswählen." },
  "batch.zipped": { en: "Folder zipped." , "zh-CN": "文件夹已压缩。", "zh-TW": "資料夾已壓縮。", "ja": "フォルダをZIP化しました。", "ko": "폴더가 압축되었습니다.", "es": "Carpeta comprimida.", "fr": "Dossier compressé.", "de": "Ordner gezippt." },
  "batch.zipFail": { en: "Could not zip: {reason}" , "zh-CN": "压缩失败：{reason}", "zh-TW": "壓縮失敗：{reason}", "ja": "ZIP化に失敗しました: {reason}", "ko": "압축 실패: {reason}", "es": "No se pudo comprimir: {reason}", "fr": "Échec de la compression : {reason}", "de": "Zippen fehlgeschlagen: {reason}" },

  // ── Region watch (Step 5) ──
  "watch.btn": { en: "Region Watch…" , "zh-CN": "区域监听…", "zh-TW": "區域監看…", "ja": "領域ウォッチ…", "ko": "영역 감시…", "es": "Vigilancia de región…", "fr": "Surveillance de zone…", "de": "Bereichs-Überwachung…" },
  "watch.running": { en: "Watching region" , "zh-CN": "正在监听区域", "zh-TW": "正在監看區域", "ja": "領域をウォッチ中", "ko": "영역 감시 중", "es": "Vigilando región", "fr": "Surveillance de zone active", "de": "Bereich wird überwacht" },
  "watch.paused": { en: "Paused (Settings focused)" , "zh-CN": "已暂停（设置页聚焦）", "zh-TW": "已暫停（設定頁聚焦）", "ja": "一時停止中（設定タブがアクティブ）", "ko": "일시정지됨(설정 탭 포커스)", "es": "En pausa (Ajustes activo)", "fr": "En pause (Paramètres au premier plan)", "de": "Pausiert (Einstellungen fokussiert)" },
  "watch.stop": { en: "Stop Region Watch" , "zh-CN": "停止区域监听", "zh-TW": "停止區域監看", "ja": "領域ウォッチを停止", "ko": "영역 감시 중지", "es": "Detener vigilancia", "fr": "Arrêter la surveillance", "de": "Überwachung beenden" },
  "watch.newRegion": { en: "New region…" , "zh-CN": "新建区域…", "zh-TW": "新增區域…", "ja": "新しい領域…", "ko": "새 영역…", "es": "Nueva región…", "fr": "Nouvelle zone…", "de": "Neuer Bereich…" },
  "watch.checking": { en: "Watching — checking every {ms}ms" , "zh-CN": "监听中——每 {ms} 毫秒检查一次", "zh-TW": "監看中——每 {ms} 毫秒檢查一次", "ja": "ウォッチ中 — {ms}ミリ秒ごとにチェック", "ko": "감시 중 — {ms}ms마다 확인", "es": "Vigilando: comprobando cada {ms} ms", "fr": "Surveillance — vérification toutes les {ms} ms", "de": "Überwachung — Prüfung alle {ms} ms" },
  "watch.lastScan": { en: "Last scan: {code}" , "zh-CN": "上次扫描：{code}", "zh-TW": "上次掃描：{code}", "ja": "最終スキャン: {code}", "ko": "마지막 스캔: {code}", "es": "Último escaneo: {code}", "fr": "Dernier scan : {code}", "de": "Letzter Scan: {code}" },

  // Dynamic (trackable) QR — help + local backend
  "set.dynamicHelpTitle": { en: "What is this? (Don't have a backend?)" , "zh-CN": "这是什么？（还没有后端？）", "zh-TW": "這是什麼？（還沒有後端？）", "ja": "これは何？（バックエンドがない場合）", "ko": "이건 뭔가요? (백엔드가 없나요?)", "es": "¿Qué es esto? (¿No tienes backend?)", "fr": "Qu'est-ce que c'est ? (Pas de backend ?)", "de": "Was ist das? (Kein Backend?)" },
  "set.dynamicHelp1": { en: "A trackable QR encodes a short redirect link instead of the final destination. When someone scans it, your server logs the visit and forwards them to the real page — so you can see how many times it was scanned." , "zh-CN": "可追踪二维码编码的是一个短跳转链接，而不是最终目标。有人扫描时，您的服务器会记录访问并转发到真实页面——这样您就能知道它被扫描了多少次。", "zh-TW": "可追蹤 QR Code 編碼的是一個短轉址連結，而不是最終目標。有人掃描時，您的伺服器會記錄訪問並轉送到真實頁面——這樣您就能知道它被掃描了幾次。", "ja": "追跡可能QRコードは最終宛先ではなくショートリダイレクトリンクをエンコードします。誰かがスキャンすると、サーバーが訪問を記録して本物のページへ転送します。スキャン回数を確認できる仕組みです。", "ko": "추적 가능 QR 코드는 최종 대상이 아닌 짧은 리디렉션 링크를 인코딩합니다. 누군가 스캔하면 서버가 방문을 기록하고 실제 페이지로 전달합니다. 이로써 스캔 횟수를 알 수 있습니다.", "es": "Un QR rastreable codifica un enlace corto de redirección en lugar del destino final. Cuando alguien lo escanea, tu servidor registra la visita y la reenvía a la página real — así ves cuántas veces se escaneó.", "fr": "Un QR traçable encode un lien court de redirection au lieu de la destination finale. Quand quelqu'un le scanne, votre serveur enregistre la visite et la transmet à la vraie page — vous voyez ainsi combien de fois il a été scanné.", "de": "Ein trackbarer QR-Code codiert einen kurzen Weiterleitungs-Link statt des endgültigen Ziels. Wenn jemand ihn scannt, protokolliert Ihr Server den Besuch und leitet ihn an die echte Seite weiter — so sehen Sie, wie oft gescannt wurde." },
  "set.dynamicHelp2": { en: "Backend URL is the address of that server (e.g. https://qr.yourdomain.com). API key is a secret the app sends to create codes; you set it on the server and paste the same value here." , "zh-CN": "后端 URL 是该服务器的地址（例如 https://qr.yourdomain.com）。API 密钥是应用创建代码时发送的密钥；您在服务器上设置它，并在此处粘贴相同的值。", "zh-TW": "後端 URL 是該伺服器的位址（例如 https://qr.yourdomain.com）。API 金鑰是應用程式建立程式碼時傳送的金鑰；您在伺服器上設定它，並在此處貼上相同的值。", "ja": "バックエンドURLはそのサーバーのアドレスです（例: https://qr.yourdomain.com）。APIキーはコード作成時にアプリが送るシークレットで、サーバーで設定し、同じ値をここに貼り付けます。", "ko": "백엔드 URL은 해당 서버의 주소입니다(예: https://qr.yourdomain.com). API 키는 코드 생성 시 앱이 보내는 비밀 키로, 서버에서 설정하고 같은 값을 여기에 붙여넣습니다.", "es": "La URL del backend es la dirección de ese servidor (p. ej. https://qr.yourdomain.com). La clave API es un secreto que la app envía al crear códigos; la defines en el servidor y pegas el mismo valor aquí.", "fr": "L'URL du backend est l'adresse de ce serveur (ex. https://qr.yourdomain.com). La clé API est un secret envoyé par l'app pour créer des codes ; vous la définissez sur le serveur et collez la même valeur ici.", "de": "Die Backend-URL ist die Adresse dieses Servers (z. B. https://qr.yourdomain.com). Der API-Schlüssel ist ein Geheimnis, das die App beim Erstellen von Codes sendet; Sie setzen ihn auf dem Server und fügen hier denselben Wert ein." },
  "set.dynamicHelp3": { en: "You don't need to buy anything. Kuiqr ships with a free, self-hosted backend you can run on this Mac with one click (button below). Or point it at your own server / a compatible service." , "zh-CN": "您无需购买任何东西。Kuiqr 内置一个免费的自托管后端，只需一键即可在此 Mac 上运行（下方按钮）。您也可以指向自己的服务器或兼容的服务。", "zh-TW": "您無需購買任何東西。Kuiqr 內建一個免費的自架後端，只需一鍵即可在此 Mac 上執行（下方按鈕）。您也可以指向自己的伺服器或相容的服務。", "ja": "何も購入する必要はありません。Kuiqrには無料のセルフホストバックエンドが同梱されており、ワンクリックでこのMac上で実行できます（下のボタン）。独自のサーバーや互換サービスを指定することも可能です。", "ko": "아무것도 구매할 필요가 없습니다. Kuiqr에는 무료 셀프 호스팅 백엔드가 포함되어 있어 클릭 한 번으로 이 Mac에서 실행할 수 있습니다(아래 버튼). 자체 서버나 호환 서비스를 지정할 수도 있습니다.", "es": "No necesitas comprar nada. Kuiqr incluye un backend autoalojado gratuito que puedes ejecutar en este Mac con un clic (botón de abajo). O apúntalo a tu propio servidor o un servicio compatible.", "fr": "Vous n'avez rien à acheter. Kuiqr embarque un backend auto-hébergé gratuit que vous pouvez exécuter sur ce Mac en un clic (bouton ci-dessous). Ou pointez-le vers votre propre serveur ou un service compatible.", "de": "Sie müssen nichts kaufen. Kuiqr bringt ein kostenloses, selbst gehostetes Backend mit, das Sie mit einem Klick auf diesem Mac ausführen können (Schaltfläche unten). Oder richten Sie es auf Ihren eigenen Server / einen kompatiblen Dienst." },
  "set.dynamicLocalStart": { en: "Run local backend (free)" , "zh-CN": "运行本地后端（免费）", "zh-TW": "執行本機後端（免費）", "ja": "ローカルバックエンドを実行（無料）", "ko": "로컬 백엔드 실행(무료)", "es": "Ejecutar backend local (gratis)", "fr": "Lancer le backend local (gratuit)", "de": "Lokales Backend starten (kostenlos)" },
  "set.dynamicLocalStop": { en: "Stop local backend" , "zh-CN": "停止本地后端", "zh-TW": "停止本機後端", "ja": "ローカルバックエンドを停止", "ko": "로컬 백엔드 중지", "es": "Detener backend local", "fr": "Arrêter le backend local", "de": "Lokales Backend stoppen" },
  "set.dynamicLocalLanNote": { en: "Short links now use this machine's Wi-Fi address ({url}) — QR codes scanned on a phone on the same Wi-Fi will be counted. Keep this Mac awake and on the same network.", "zh-CN": "短链接现在使用本机的 Wi-Fi 地址（{url}）——在同一 Wi-Fi 下用手机扫描的二维码都会被统计。请保持这台 Mac 处于唤醒状态且与手机同一网络。", "zh-TW": "短連結現在使用本機的 Wi-Fi 位址（{url}）——在同一 Wi-Fi 下用手機掃描的 QR Code 都會被統計。請保持這台 Mac 保持喚醒且與手機同一網路。", ja: "ショートリンクはこのマシンのWi-Fiアドレス（{url}）を使用します。同じWi-Fi上のスマートフォンでスキャンされたQRコードがカウントされます。このMacをスリープせず、同じネットワークに接続しておいてください。", ko: "짧은 링크가 이 컴퓨터의 Wi-Fi 주소({url})를 사용합니다. 같은 Wi-Fi의 휴대폰에서 스캔한 QR 코드가 집계됩니다. 이 Mac을 절전 모드로 전환하지 말고 같은 네트워크에 유지하세요.", es: "Los enlaces cortos ahora usan la dirección Wi-Fi de este equipo ({url}); los códigos QR escaneados con un teléfono en la misma red se contarán. Mantén este Mac despierto y en la misma red.", fr: "Les liens courts utilisent désormais l'adresse Wi-Fi de cette machine ({url}) — les QR scannés depuis un téléphone sur le même Wi-Fi seront comptés. Garde ce Mac éveillé et sur le même réseau.", de: "Kurzlinks verwenden jetzt die WLAN-Adresse dieses Macs ({url}) — QR-Codes, die mit einem Telefon im selben WLAN gescannt werden, werden gezählt. Lasse den Mac wach und im selben Netzwerk." },
  "set.dynamicLocalStarting": { en: "Starting local backend…" , "zh-CN": "正在启动本地后端…", "zh-TW": "正在啟動本機後端…", "ja": "ローカルバックエンドを起動中…", "ko": "로컬 백엔드 시작 중…", "es": "Iniciando backend local…", "fr": "Démarrage du backend local…", "de": "Lokales Backend wird gestartet…" },
  "set.dynamicLocalRunning": { en: "Local backend running at {url} — URL & key saved." , "zh-CN": "本地后端运行于 {url} —— URL 与密钥已保存。", "zh-TW": "本機後端執行於 {url} —— URL 與金鑰已儲存。", "ja": "ローカルバックエンドが {url} で実行中です。URLとキーを保存しました。", "ko": "로컬 백엔드가 {url} 에서 실행 중입니다. URL과 키가 저장되었습니다.", "es": "Backend local ejecutándose en {url}: URL y clave guardadas.", "fr": "Backend local en cours d'exécution sur {url} — URL et clé enregistrées.", "de": "Lokales Backend läuft auf {url} — URL & Schlüssel gespeichert." },
  "set.dynamicLocalFailed": { en: "Could not start local backend: {reason}" , "zh-CN": "无法启动本地后端：{reason}", "zh-TW": "無法啟動本機後端：{reason}", "ja": "ローカルバックエンドを起動できませんでした: {reason}", "ko": "로컬 백엔드를 시작할 수 없음: {reason}", "es": "No se pudo iniciar el backend local: {reason}", "fr": "Impossible de démarrer le backend local : {reason}", "de": "Lokales Backend konnte nicht gestartet werden: {reason}" },
  "set.dynamicLocalStopped": { en: "Local backend stopped." , "zh-CN": "本地后端已停止。", "zh-TW": "本機後端已停止。", "ja": "ローカルバックエンドを停止しました。", "ko": "로컬 백엔드가 중지되었습니다.", "es": "Backend local detenido.", "fr": "Backend local arrêté.", "de": "Lokales Backend gestoppt." },
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
