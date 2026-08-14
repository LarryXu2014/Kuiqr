// ============================================================
// Kuiqr — Content Script (v2.4.1.2)
// Runs in the page context on every allowed site.
//  1. Copies text to the clipboard when asked by the background
//     (the service worker cannot write the clipboard itself).
//  2. Supports a CUSTOM recorded shortcut: when the user has changed
//     the key combo away from the default (in the popup), pressing it
//     on a page triggers a scan. The DEFAULT key (Cmd/Ctrl+Shift+Y) is
//     owned exclusively by chrome.commands (manifest.json) so the two
//     paths never double-fire.
//     While the popup is recording a new shortcut (recordingShortcut
//     flag in storage), detection is fully suppressed so re-pressing
//     the combo does NOT start a scan — it is captured by the recorder.
// ============================================================

(function () {
  const STORAGE_SHORTCUT = "qrShortcut";
  const STORAGE_RECORDING = "recordingShortcut";
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || "");
  const DEFAULT_SHORTCUT = isMac ? "Meta+Shift+Y" : "Control+Shift+Y";

  let storedShortcut = DEFAULT_SHORTCUT;
  let recording = false;

  // Normalize a keydown into a comparable string, e.g. "Meta+Shift+Y".
  // Modifiers are sorted so order never matters.
  function normalize(e) {
    const parts = [];
    if (e.metaKey) parts.push("Meta");
    if (e.ctrlKey) parts.push("Control");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    let key = e.key;
    if (key === " ") key = "Space";
    if (["Meta", "Control", "Alt", "Shift"].includes(key)) return null; // ignore bare modifiers
    parts.push(key.length === 1 ? key.toUpperCase() : key);
    return parts.sort().join("+");
  }

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function load() {
    chrome.storage.local.get([STORAGE_SHORTCUT, STORAGE_RECORDING], (res) => {
      if (res[STORAGE_SHORTCUT]) storedShortcut = res[STORAGE_SHORTCUT];
      recording = !!res[STORAGE_RECORDING];
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_SHORTCUT]) storedShortcut = changes[STORAGE_SHORTCUT].newValue || DEFAULT_SHORTCUT;
    if (changes[STORAGE_RECORDING]) recording = !!changes[STORAGE_RECORDING].newValue;
  });

  // ── Customizable shortcut trigger ──
  // NOTE: the DEFAULT key (Cmd/Ctrl+Shift+Y) is handled by chrome.commands at the
  // browser level (see background.js). We only act here when the user has recorded
  // a CUSTOM shortcut (storedShortcut !== DEFAULT), so the two never double-fire.
  document.addEventListener(
    "keydown",
    (e) => {
      if (recording) return; // popup is recording a new shortcut — never trigger a scan
      if (storedShortcut === DEFAULT_SHORTCUT) return; // default key → chrome.commands owns it
      const combo = normalize(e);
      if (!combo) return;
      if (isEditable(e.target)) return; // don't fire while the user is typing in a field
      if (combo === storedShortcut) {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: "showOverlay" });
      }
    },
    true
  );

  // ── Clipboard copy on behalf of the background ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === "copyText") {
      (async () => {
        try {
          await navigator.clipboard.writeText(msg.text);
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true; // async response
    }
  });

  load();
})();
