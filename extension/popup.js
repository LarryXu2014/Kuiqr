// ============================================================
// Kuiqr - Popup Script (v2.4.1.1)
//   - Shows/sets the customizable shortcut (Record)
//   - Generate QR codes from any text/URL
//   - Scan history
// ============================================================

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || "");
const STORAGE_SHORTCUT = "qrShortcut";
const STORAGE_RECORDING = "recordingShortcut";
const DEFAULT_SHORTCUT = isMac ? "Meta+Shift+Y" : "Control+Shift+Y";

document.addEventListener("DOMContentLoaded", () => {
  loadShortcutDisplay();
  setupRecorder();
  setupGenerate();

  loadHistory();
  document.getElementById("clear-btn").addEventListener("click", clearHistory);

  const scanBtn = document.getElementById("scan-btn");
  if (scanBtn) {
    scanBtn.addEventListener("click", () => {
      scanBtn.disabled = true;
      scanBtn.textContent = "Scanning...";
      chrome.runtime.sendMessage({ action: "showOverlay" }, () => {
        setTimeout(() => {
          scanBtn.disabled = false;
          scanBtn.textContent = "Select Area to Scan";
        }, 3000);
      });
      setTimeout(() => window.close(), 200);
    });
  }

  // Open the browser's shortcut-management page (extension popups can't navigate
  // to chrome:// URLs via a plain anchor, so we open it in a new tab instead).
  const shortcutsLink = document.getElementById("shortcuts-link");
  if (shortcutsLink) {
    shortcutsLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
      window.close();
    });
  }
});

// ── Shortcut display ──
function loadShortcutDisplay() {
  chrome.storage.local.get([STORAGE_SHORTCUT], (res) => {
    const combo = res[STORAGE_SHORTCUT] || DEFAULT_SHORTCUT;
    const el = document.getElementById("shortcut-key");
    if (el) el.textContent = formatDisplay(combo);
  });
}

function formatDisplay(combo) {
  return combo
    .split("+")
    .map((p) => {
      if (p === "Meta") return isMac ? "⌘" : "Ctrl";
      if (p === "Control") return "Ctrl";
      if (p === "Shift") return "Shift";
      if (p === "Alt") return "Alt";
      return p;
    })
    .join("+");
}

// ── Recorder ──
function normalize(e) {
  const parts = [];
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Control");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  let key = e.key;
  if (key === " ") key = "Space";
  if (["Meta", "Control", "Alt", "Shift"].includes(key)) return null;
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.sort().join("+");
}

function setupRecorder() {
  const btn = document.getElementById("record-btn");
  const status = document.getElementById("record-status");
  let recording = false;
  let keyHandler = null;

  btn.addEventListener("click", () => {
    if (recording) return;
    recording = true;
    // Tell the content script to suppress detection while we record
    chrome.storage.local.set({ [STORAGE_RECORDING]: true });
    btn.classList.add("recording");
    btn.textContent = "Recording…";
    status.textContent = "Press a key combination (Esc to cancel)";

    keyHandler = (e) => {
      if (e.key === "Escape") {
        stopRecording(null);
        return;
      }
      if (e.repeat) return; // ignore auto-repeat

      const combo = normalize(e);
      if (!combo) return; // still only modifiers held

      e.preventDefault();
      e.stopPropagation();
      stopRecording(combo);
    };
    document.addEventListener("keydown", keyHandler, true);
  });

  function stopRecording(combo) {
    recording = false;
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
    }
    // Clear the suppress flag so detection resumes
    chrome.storage.local.set({ [STORAGE_RECORDING]: false });

    btn.classList.remove("recording");
    btn.textContent = "Record shortcut";

    if (combo) {
      chrome.storage.local.set({ [STORAGE_SHORTCUT]: combo });
      const el = document.getElementById("shortcut-key");
      if (el) el.textContent = formatDisplay(combo);
      status.textContent = "Saved! Shortcut updated.";
    } else {
      status.textContent = "Cancelled.";
    }
  }
}

// ── Generate QR ──
function setupGenerate() {
  const input = document.getElementById("gen-input");
  const img = document.getElementById("gen-img");
  const errorEl = document.getElementById("gen-error");
  const downloadBtn = document.getElementById("gen-download");
  const copyBtn = document.getElementById("gen-copy");

  let lastDataUrl = "";

  function render() {
    const text = input.value;
    errorEl.textContent = "";
    if (!text) {
      img.style.display = "none";
      lastDataUrl = "";
      return;
    }
    try {
      const qr = qrcode(0, "M"); // auto version, medium error correction
      qr.addData(text);
      qr.make();
      const dataUrl = qr.createDataURL(6, 4);
      img.src = dataUrl;
      img.style.display = "block";
      lastDataUrl = dataUrl;
    } catch (e) {
      img.style.display = "none";
      lastDataUrl = "";
      errorEl.textContent = "Could not generate: text may be too long for a QR code.";
    }
  }

  if (input) input.addEventListener("input", render);

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      if (!lastDataUrl) return;
      const a = document.createElement("a");
      a.href = lastDataUrl;
      a.download = "qrcode.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (!input.value) return;
      navigator.clipboard.writeText(input.value).then(
        () => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => (copyBtn.textContent = "Copy Text"), 1500);
        },
        () => {}
      );
    });
  }
}

// ── History (unchanged) ──
async function loadHistory() {
  chrome.runtime.sendMessage({ action: "getHistory" }, (history) => {
    renderHistory(history || []);
  });
}

function renderHistory(history) {
  const list = document.getElementById("history-list");

  if (!history.length) {
    list.innerHTML =
      '<p class="empty-state">No scans yet. Right-click a QR code image on any webpage to get started.</p>';
    return;
  }

  list.innerHTML = history
    .map((item) => {
      const typeLabel = {
        url: "URL",
        text: "Text",
        error: "Error",
        "no-qr": "No QR",
      }[item.type] || "Unknown";

      const displayData = item.error
        ? item.error
        : item.data
        ? item.data.length > 120
          ? item.data.slice(0, 120) + "\u2026"
          : item.data
        : "No data";

      const time = formatTime(item.timestamp);

      return `
        <div class="history-item" data-url="${item.type === "url" ? escapeAttr(item.data) : ""}">
          <span class="item-type ${item.type}">${typeLabel}</span>
          <div class="item-data">${escapeHtml(displayData)}</div>
          <div class="item-time">${time}</div>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".history-item").forEach((el) => {
    const url = el.getAttribute("data-url");
    if (url) {
      el.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "openUrl", url });
      });
    }
  });
}

function clearHistory() {
  chrome.runtime.sendMessage({ action: "clearHistory" }, () => {
    renderHistory([]);
  });
}

// ---- Helpers ----
function formatTime(ts) {
  const date = new Date(ts);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text ? text.replace(/"/g, "&quot;") : "";
}
