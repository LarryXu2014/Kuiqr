// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// ============================================================
// Kuiqr — App Logic
// ============================================================

(function () {
  "use strict";

  // ---- State ----
  let stream = null;
  let scanInterval = null;
  let facingMode = "environment";
  let deferredPrompt = null;

  // ---- DOM References ----
  const $ = (sel) => document.querySelector(sel);

  const els = {
    btnCamera: $("#btn-camera"),
    btnUpload: $("#btn-upload"),
    btnPaste: $("#btn-paste"),
    fileInput: $("#file-input"),
    cameraView: $("#camera-view"),
    cameraVideo: $("#camera-video"),
    cameraCanvas: $("#camera-canvas"),
    closeCamera: $("#close-camera"),
    switchCamera: $("#switch-camera"),
    resultCard: $("#result-card"),
    resultType: $("#result-type"),
    resultData: $("#result-data"),
    openResult: $("#open-result"),
    copyResult: $("#copy-result"),
    errorMsg: $("#error-msg"),
    historyList: $("#history-list"),
    clearHistory: $("#clear-history"),
    installBanner: $("#install-banner"),
    installBtn: $("#install-btn"),
    dismissInstall: $("#dismiss-install"),
  };

  // ---- Init ----
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    // Button events
    els.btnCamera.addEventListener("click", openCamera);
    els.btnUpload.addEventListener("click", () => els.fileInput.click());
    els.btnPaste.addEventListener("click", pasteFromClipboard);
    els.fileInput.addEventListener("change", handleFileUpload);
    els.closeCamera.addEventListener("click", closeCameraView);
    els.switchCamera.addEventListener("click", switchCamera);
    els.copyResult.addEventListener("click", copyResultToClipboard);
    els.openResult.addEventListener("click", openResultUrl);
    els.clearHistory.addEventListener("click", clearHistory);

    // Paste support (Ctrl+V / Cmd+V)
    document.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) decodeImageBlob(blob);
          e.preventDefault();
          return;
        }
      }
    });

    // PWA install prompt
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      els.installBanner.classList.remove("hidden");
    });

    els.installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        els.installBanner.classList.add("hidden");
      }
      deferredPrompt = null;
    });

    els.dismissInstall.addEventListener("click", () => {
      els.installBanner.classList.add("hidden");
    });

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }

    renderHistory();
  }

  // ============================================================
  // Camera Scanning
  // ============================================================

  async function openCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false,
      });
      els.cameraVideo.srcObject = stream;
      els.cameraView.classList.remove("hidden");
      startScanning();
    } catch (err) {
      showError(
        "Could not access camera. Please allow camera permissions and try again."
      );
    }
  }

  function startScanning() {
    const ctx = els.cameraCanvas.getContext("2d", { willReadFrequently: true });
    let lastDecode = 0;

    scanInterval = setInterval(() => {
      if (els.cameraVideo.readyState !== els.cameraVideo.HAVE_ENOUGH_DATA) return;

      const w = els.cameraVideo.videoWidth;
      const h = els.cameraVideo.videoHeight;
      if (!w || !h) return;

      els.cameraCanvas.width = w;
      els.cameraCanvas.height = h;
      ctx.drawImage(els.cameraVideo, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });

      // Throttle "no QR" to avoid console spam
      if (!code) {
        if (Date.now() - lastDecode > 3000) {
          lastDecode = Date.now();
        }
        return;
      }

      // QR code found!
      lastDecode = Date.now();
      closeCameraView();
      handleResult(code.data);
    }, 200); // Scan every 200ms for performance
  }

  function closeCameraView() {
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    els.cameraView.classList.add("hidden");
  }

  async function switchCamera() {
    facingMode = facingMode === "environment" ? "user" : "environment";
    closeCameraView();
    await openCamera();
  }

  // ============================================================
  // File Upload
  // ============================================================

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    decodeImageBlob(file);
    e.target.value = ""; // Reset for re-upload
  }

  // ============================================================
  // Clipboard Paste
  // ============================================================

  async function pasteFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            decodeImageBlob(blob);
            return;
          }
        }
      }
      showError("No image found in clipboard. Copy a QR code image first.");
    } catch {
      showError("Could not read clipboard. Try uploading the image instead.");
    }
  }

  // ============================================================
  // Image Decoding
  // ============================================================

  function decodeImageBlob(blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Scale down large images for performance
      const maxDim = 1000;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });

      URL.revokeObjectURL(url);

      if (code) {
        handleResult(code.data);
      } else {
        showError("No QR code found in this image. Make sure the image is clear and the QR code is visible.");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showError("Could not load the image. Please try a different file.");
    };
    img.src = url;
  }

  // ============================================================
  // Result Handling
  // ============================================================

  function handleResult(data) {
    hideError();
    const trimmed = data.trim();
    const isUrl = /^(https?:\/\/|www\.)/i.test(trimmed);

    els.resultCard.classList.remove("hidden");
    els.resultData.textContent = trimmed;

    if (isUrl) {
      els.resultType.textContent = "URL";
      els.resultType.className = "result-type";
      els.openResult.classList.remove("hidden");
      els.openResult.dataset.url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    } else {
      els.resultType.textContent = "Text";
      els.resultType.className = "result-type text";
      els.openResult.classList.add("hidden");
    }

    // Save to history
    saveToHistory(trimmed, isUrl ? "url" : "text");
  }

  function openResultUrl() {
    const url = els.openResult.dataset.url;
    if (url) window.open(url, "_blank", "noopener");
  }

  async function copyResultToClipboard() {
    try {
      await navigator.clipboard.writeText(els.resultData.textContent);
      // Brief visual feedback
      const original = els.copyResult.innerHTML;
      els.copyResult.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => { els.copyResult.innerHTML = original; }, 1500);
    } catch {
      showError("Could not copy to clipboard.");
    }
  }

  // ============================================================
  // Error Handling
  // ============================================================

  function showError(msg) {
    els.errorMsg.textContent = msg;
    els.errorMsg.classList.remove("hidden");
    els.resultCard.classList.add("hidden");
    setTimeout(() => els.errorMsg.classList.add("hidden"), 5000);
  }

  function hideError() {
    els.errorMsg.classList.add("hidden");
  }

  // ============================================================
  // History
  // ============================================================

  const HISTORY_KEY = "qr_scanner_history";

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveToHistory(data, type) {
    const history = getHistory();
    history.unshift({ data, type, timestamp: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
    renderHistory();
  }

  function renderHistory() {
    const history = getHistory();
    if (!history.length) {
      els.historyList.innerHTML = '<p class="empty-state">No scans yet</p>';
      return;
    }

    els.historyList.innerHTML = history
      .map((item) => {
        const display =
          item.data.length > 80 ? item.data.slice(0, 80) + "\u2026" : item.data;
        const typeLabel = item.type === "url" ? "URL" : "Text";
        const typeClass = item.type === "url" ? "" : "text";
        return `
          <div class="history-item" data-data="${escapeAttr(item.data)}" data-type="${item.type}">
            <span class="item-type ${typeClass}">${typeLabel}</span>
            <div class="item-data">${escapeHtml(display)}</div>
            <div class="item-time">${formatTime(item.timestamp)}</div>
          </div>
        `;
      })
      .join("");

    els.historyList.querySelectorAll(".history-item").forEach((el) => {
      el.addEventListener("click", () => {
        const data = el.getAttribute("data-data");
        const type = el.getAttribute("data-type");
        if (type === "url") {
          const url = data.startsWith("http") ? data : `https://${data}`;
          window.open(url, "_blank", "noopener");
        } else {
          handleResult(data);
        }
      });
    });
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  }

  // ---- Helpers ----

  function formatTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return text.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
})();
