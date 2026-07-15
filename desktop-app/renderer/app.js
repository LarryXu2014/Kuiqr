// ============================================================
// QR Scan & Open — Desktop App Renderer Logic
// ============================================================

let currentPlatform = null;

document.addEventListener("DOMContentLoaded", async () => {
  // Detect platform
  currentPlatform = await window.qrAPI.getPlatform();
  updatePlatformUI();

  // Tab navigation
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Listen for external tab switches (from tray)
  window.qrAPI.onSwitchTab((tab) => switchTab(tab));

  // Scan button
  const scanBtn = document.getElementById("scan-btn");
  scanBtn.addEventListener("click", async () => {
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span>Starting scan...</span>';
    await window.qrAPI.triggerScan();
    setTimeout(() => {
      scanBtn.disabled = false;
      scanBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>Select Area to Scan</span>';
    }, 2000);
  });

  // History
  document.getElementById("clear-btn").addEventListener("click", clearHistory);
  await loadHistory();

  // Settings
  await loadSettingsForm();
  document.getElementById("save-settings-btn").addEventListener("click", saveSettings);
});

// ============================================================
// Tab Navigation
// ============================================================

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const content = document.getElementById(`tab-${tabName}`);

  if (tab) tab.classList.add("active");
  if (content) content.classList.add("active");
}

// ============================================================
// Platform UI
// ============================================================

function updatePlatformUI() {
  const shortcutEl = document.getElementById("shortcut-display");
  if (shortcutEl && currentPlatform) {
    shortcutEl.textContent = currentPlatform.isMac ? "Cmd+Shift+Y" : "Ctrl+Shift+Y";
  }

  const platformInfo = document.getElementById("platform-info");
  if (platformInfo && currentPlatform) {
    platformInfo.textContent = `Running on: ${currentPlatform.platform}`;
  }
}

// ============================================================
// History
// ============================================================

async function loadHistory() {
  const history = await window.qrAPI.getHistory();
  renderHistory(history);
}

function renderHistory(history) {
  const list = document.getElementById("history-list");

  if (!history || !history.length) {
    list.innerHTML = '<p class="empty-state">No scans yet. Press the shortcut to scan a QR code.</p>';
    return;
  }

  list.innerHTML = history
    .map((item) => {
      const typeLabel = { url: "URL", text: "Text", "no-qr": "No QR" }[item.type] || "Unknown";
      const display = item.data
        ? item.data.length > 100
          ? item.data.slice(0, 100) + "\u2026"
          : item.data
        : "No QR code detected";
      const time = formatTime(item.timestamp);

      return `
        <div class="history-item" data-type="${item.type}" data-data="${escapeAttr(item.data || "")}">
          <span class="item-type ${item.type}">${typeLabel}</span>
          <div class="item-data">${escapeHtml(display)}</div>
          <div class="item-time">${time}</div>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".history-item").forEach((el) => {
    el.addEventListener("click", () => {
      const type = el.getAttribute("data-type");
      const data = el.getAttribute("data-data");
      if (type === "url" && data) {
        window.qrAPI.openUrl(data.startsWith("http") ? data : `https://${data}`);
      } else if (data) {
        window.qrAPI.copyClipboard(data);
      }
    });
  });
}

async function clearHistory() {
  await window.qrAPI.clearHistory();
  renderHistory([]);
}

// ============================================================
// Settings
// ============================================================

async function loadSettingsForm() {
  const settings = await window.qrAPI.getSettings();

  document.getElementById("setting-shortcut").value = settings.shortcut || "";
  document.getElementById("setting-autoopen").checked = settings.autoOpenUrl !== false;
  document.getElementById("setting-copytext").checked = settings.copyTextToClipboard !== false;
  document.getElementById("setting-notify").checked = settings.showNotification !== false;
  document.getElementById("setting-maxhistory").value = settings.maxHistory || 50;
}

async function saveSettings() {
  const settings = {
    shortcut: document.getElementById("setting-shortcut").value.trim() || "CommandOrControl+Shift+Y",
    autoOpenUrl: document.getElementById("setting-autoopen").checked,
    copyTextToClipboard: document.getElementById("setting-copytext").checked,
    showNotification: document.getElementById("setting-notify").checked,
    maxHistory: parseInt(document.getElementById("setting-maxhistory").value, 10) || 50,
  };

  await window.qrAPI.saveSettings(settings);

  const savedMsg = document.getElementById("settings-saved");
  savedMsg.classList.remove("hidden");
  setTimeout(() => savedMsg.classList.add("hidden"), 2000);
}

// ============================================================
// Helpers
// ============================================================

function formatTime(ts) {
  const date = new Date(ts);
  const diff = Date.now() - ts;
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
  return text ? text.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
}
