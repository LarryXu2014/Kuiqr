// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// ============================================================
// Kuiqr — QR Generator engine
//   Step 1: content templates (WiFi / vCard / Email / SMS / Phone / Event / Geo)
//   Step 2: styling (colors, ECC, logo w/ self-check, dot/finder styles, margin)
//   Step 3: exports (SVG / PDF @300dpi / PNG) via OS save dialog
//   Step 4: batch generation from CSV
//   Regression: runSelfTest() used by the headless test suite
//
// Single rendering path: everything renders through QRCodeStyling so the live
// preview, the SVG/PNG/PDF exports, the batch output and the self-scan test all
// use the exact same data + styling options (no drift between preview and file).
// ============================================================
(function () {
  "use strict";

  const PREVIEW_EDGE = 360;          // px edge of the on-screen preview
  const STYLE_KEY = "kuiqr.qrstyle"; // persisted styling defaults
  const DYNAMIC_STORE_KEY = "kuiqr.dynamicCodes";

  // ── i18n helper (falls back to English, then the raw key) ──
  function t(key, vars) {
    try { return window.t ? window.t(key, vars) : key; }
    catch { return key; }
  }
  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── Template definitions ────────────────────────────────────────────────
  // Each template: label key + ordered fields. `type` is text|textarea|select|
  // checkbox|datetime. `showIf(values)` optionally hides a field.
  const TEMPLATES = {
    text:  { labelKey: "tpl.text",  fields: [] },
    wifi:  { labelKey: "tpl.wifi", fields: [
      { id: "ssid",    key: "tpl.wifi.ssid", type: "text", required: true, ph: "tpl.wifi.ssidPh" },
      { id: "encryption", key: "tpl.wifi.enc", type: "select", default: "WPA",
        options: [ { v: "WPA", k: "tpl.wifi.wpa" }, { v: "WEP", k: "tpl.wifi.wep" }, { v: "nopass", k: "tpl.wifi.nopass" } ] },
      { id: "password", key: "tpl.wifi.pass", type: "text", ph: "tpl.wifi.passPh",
        showIf: (v) => v.encryption !== "nopass" },
      { id: "hidden",  key: "tpl.wifi.hidden", type: "checkbox", default: false },
    ] },
    vcard: { labelKey: "tpl.vcard", fields: [
      { id: "name",    key: "tpl.vcard.name",    type: "text", ph: "tpl.vcard.namePh" },
      { id: "org",     key: "tpl.vcard.org",     type: "text", ph: "tpl.vcard.orgPh" },
      { id: "title",   key: "tpl.vcard.title",   type: "text", ph: "tpl.vcard.titlePh" },
      { id: "phone",   key: "tpl.vcard.phone",   type: "text", ph: "tpl.vcard.phonePh" },
      { id: "email",   key: "tpl.vcard.email",   type: "text", ph: "tpl.vcard.emailPh" },
      { id: "website", key: "tpl.vcard.website", type: "text", ph: "tpl.vcard.websitePh" },
    ] },
    email: { labelKey: "tpl.email", fields: [
      { id: "email",   key: "tpl.email.email",   type: "text", required: true, ph: "tpl.email.emailPh" },
      { id: "subject", key: "tpl.email.subject", type: "text", ph: "tpl.email.subjectPh" },
      { id: "body",    key: "tpl.email.body",    type: "textarea", ph: "tpl.email.bodyPh" },
    ] },
    sms:   { labelKey: "tpl.sms", fields: [
      { id: "number",  key: "tpl.sms.number",  type: "text", required: true, ph: "tpl.sms.numberPh" },
      { id: "message", key: "tpl.sms.message", type: "textarea", ph: "tpl.sms.messagePh" },
    ] },
    phone: { labelKey: "tpl.phone", fields: [
      { id: "number",  key: "tpl.phone.number", type: "text", required: true, ph: "tpl.phone.numberPh" },
    ] },
    event: { labelKey: "tpl.event", fields: [
      { id: "start",    key: "tpl.event.start",    type: "datetime", required: true, ph: "tpl.event.startPh" },
      { id: "end",      key: "tpl.event.end",      type: "datetime", ph: "tpl.event.endPh" },
      { id: "summary",  key: "tpl.event.summary",  type: "text", ph: "tpl.event.summaryPh" },
      { id: "location", key: "tpl.event.location", type: "text", ph: "tpl.event.locationPh" },
    ] },
    geo:   { labelKey: "tpl.geo", fields: [
      { id: "lat", key: "tpl.geo.lat", type: "text", required: true, ph: "tpl.geo.latPh" },
      { id: "lng", key: "tpl.geo.lng", type: "text", required: true, ph: "tpl.geo.lngPh" },
    ] },
  };

  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    template: "text",
    values: { text: { text: "" } },   // per-template field values
    styling: {
      fg: "#000000", bg: "#ffffff",
      ecc: "M",
      dotStyle: "square",             // square | rounded | dots
      finderColor: "#000000",
      finderDotColor: "#000000",
      quietModules: 4,
    },
    logo: null,                      // data URL or null
    external: null,                  // dynamic/override content (short URL)
  };
  let qr = null;                     // QRCodeStyling instance
  let lastDataUrl = "";
  let lastContent = "";
  let selfCheckTimer = null;
  let eccBeforeLogo = "M";
  let batchCancelled = false;

  // ── Escaping helpers ────────────────────────────────────────────────────
  function escWifi(s) { return String(s == null ? "" : s).replace(/([\\;,":])/g, "\\$1"); }
  function escV(v) {
    return String(v == null ? "" : v)
      .replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }
  function toICal(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    const p = (n) => (n < 10 ? "0" : "") + n;
    return "" + dt.getFullYear() + p(dt.getMonth() + 1) + p(dt.getDate()) +
      "T" + p(dt.getHours()) + p(dt.getMinutes()) + p(dt.getSeconds());
  }

  // ── Content builders ──────────────────────────────────────────────────────
  function buildContent() {
    if (state.external != null) return String(state.external);
    const tpl = state.template;
    const v = state.values[tpl] || {};
    switch (tpl) {
      case "text":
        return (v.text || "").trim();
      case "wifi": {
        const enc = v.encryption || "WPA";
        const ssid = escWifi(v.ssid || "");
        const hidden = v.hidden ? "true" : "false";
        if (enc === "nopass") return `WIFI:T:nopass;S:${ssid};H:${hidden};;`;
        const pw = escWifi(v.password || "");
        return `WIFI:T:${enc};S:${ssid};P:${pw};H:${hidden};;`;
      }
      case "vcard": {
        const lines = ["BEGIN:VCARD", "VERSION:3.0"];
        const name = (v.name || "").trim();
        if (name) lines.push("FN:" + escV(name));
        const org = (v.org || "").trim();  if (org) lines.push("ORG:" + escV(org));
        const title = (v.title || "").trim(); if (title) lines.push("TITLE:" + escV(title));
        const phone = (v.phone || "").trim(); if (phone) lines.push("TEL;TYPE=CELL:" + escV(phone));
        const email = (v.email || "").trim(); if (email) lines.push("EMAIL:" + email);
        const web = (v.website || "").trim(); if (web) lines.push("URL:" + web);
        lines.push("END:VCARD");
        return lines.join("\n");
      }
      case "email": {
        const e = (v.email || "").trim();
        if (!e) return "";
        const q = [];
        if (v.subject) q.push("subject=" + encodeURIComponent(v.subject));
        if (v.body) q.push("body=" + encodeURIComponent(v.body));
        return "mailto:" + e + (q.length ? "?" + q.join("&") : "");
      }
      case "sms": {
        const n = (v.number || "").trim();
        const m = (v.message || "").replace(/\n/g, " ").trim();
        return "SMSTO:" + n + ":" + m;
      }
      case "phone":
        return "tel:" + (v.number || "").trim();
      case "event": {
        const lines = ["BEGIN:VEVENT"];
        const s = toICal(v.start), e2 = toICal(v.end);
        if (s) lines.push("DTSTART:" + s);
        if (e2) lines.push("DTEND:" + e2);
        const sum = (v.summary || "").trim(); if (sum) lines.push("SUMMARY:" + escV(sum));
        const loc = (v.location || "").trim(); if (loc) lines.push("LOCATION:" + escV(loc));
        lines.push("END:VEVENT");
        return lines.join("\n");
      }
      case "geo": {
        const lat = (v.lat || "").trim(), lng = (v.lng || "").trim();
        if (!lat || !lng) return "";
        return "geo:" + lat + "," + lng;
      }
      default:
        return "";
    }
  }

  // ── Sizing: honour quiet-zone as modules ──────────────────────────────────
  function getModuleCount(content, ecc) {
    try {
      const q = qrcode(0, ecc);
      q.addData(content);
      q.make();
      return q.getModuleCount();
    } catch (e) {
      return 177; // largest version (V-40) — safe fallback for over-long input
    }
  }
  function computeCanvas(content, ecc, quietModules, edge) {
    const count = getModuleCount(content, ecc);
    const total = count + 2 * quietModules;
    const moduleSize = Math.max(1, Math.floor(edge / total));
    const width = total * moduleSize;
    const margin = quietModules * moduleSize;
    return { width, margin, count, moduleSize };
  }
  function buildOptions(content, width, margin) {
    const s = state.styling;
    const o = {
      width, height: width, margin,
      data: content,
      qrOptions: { errorCorrectionLevel: s.ecc },
      // true circular "dots" from qr-code-styling breaks timing/alignment patterns
      // and fails strict decoders; extra-rounded gives a scannable dot-like look.
      dotsOptions: { type: s.dotStyle === "square" ? "classic" : (s.dotStyle === "dots" ? "extra-rounded" : s.dotStyle), color: s.fg },
      cornersSquareOptions: { type: "square", color: s.finderColor },
      cornersDotOptions: { type: "square", color: s.finderDotColor },
      backgroundOptions: { color: s.bg },
    };
    if (state.logo) {
      o.image = state.logo;
      o.imageOptions = { hideBackgroundDots: true, imageSize: 0.22, margin: 4 };
    }
    return o;
  }

  // ── Blob / dataURL helpers ────────────────────────────────────────────────
  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  function blobToText(blob) { return blob.text(); }

  // ── Contrast (relative luminance) ─────────────────────────────────────────
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    if (!m) return [0, 0, 0];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function relLum(hex) {
    const [r, g, b] = hexToRgb(hex).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(a, b) {
    const L1 = relLum(a), L2 = relLum(b);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  async function render() {
    const content = buildContent();
    lastContent = content;
    const img = $("gen-img");
    const errEl = $("gen-error");
    const textWrap = $("gen-text-wrap");

    if (state.template === "text") {
      state.values.text = { text: $("gen-input") ? $("gen-input").value : "" };
    }
    if (textWrap) textWrap.style.display = state.template === "text" ? "" : "none";

    if (!content) {
      if (img) { img.style.display = "none"; }
      lastDataUrl = "";
      if (errEl) errEl.classList.add("hidden");
      setSelfCheck(null);
      updateContrastWarning();
      return;
    }
    try {
      const { width, margin } = computeCanvas(content, state.styling.ecc, state.styling.quietModules, PREVIEW_EDGE);
      const opts = buildOptions(content, width, margin);
      if (!qr) qr = new QRCodeStyling(opts);
      else await qr.update(opts);
      const blob = await qr.getRawData("png");
      lastDataUrl = await blobToDataURL(blob);
      if (img) { img.src = lastDataUrl; img.style.display = "block"; }
      if (errEl) errEl.classList.add("hidden");
      scheduleSelfCheck();
    } catch (e) {
      if (errEl) {
        errEl.textContent = t("gen.error", { msg: (e && e.message) || "text may be too long for a QR code" });
        errEl.classList.remove("hidden");
      }
    }
    updateContrastWarning();
  }

  function scheduleSelfCheck() {
    if (selfCheckTimer) clearTimeout(selfCheckTimer);
    if (!state.logo) { setSelfCheck(null); return; }
    selfCheckTimer = setTimeout(runSelfCheck, 450);
  }
  async function runSelfCheck() {
    if (!lastDataUrl) { setSelfCheck(null); return; }
    try {
      const img = new Image();
      img.src = lastDataUrl;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
      const res = jsQR(data, width, height);
      if (!res) setSelfCheck({ ok: false, msg: t("gen.logoFail") });
      else if (res.data !== lastContent) setSelfCheck({ ok: false, msg: t("gen.logoMismatch") });
      else setSelfCheck({ ok: true, msg: t("gen.logoOk") });
    } catch (e) {
      setSelfCheck({ ok: false, msg: String((e && e.message) || e) });
    }
  }
  function setSelfCheck(res) {
    const el = $("style-logo-status");
    if (!el) return;
    if (!res) { el.className = "style-status hidden"; el.textContent = ""; return; }
    el.className = "style-status " + (res.ok ? "ok" : "warn");
    el.textContent = (res.ok ? "✓ " : "⚠ ") + res.msg;
    el.classList.remove("hidden");
  }
  function updateContrastWarning() {
    const el = $("style-contrast");
    if (!el) return;
    const r = contrastRatio(state.styling.fg, state.styling.bg);
    if (r < 1.5) {
      el.className = "style-warn show";
      el.textContent = "⚠ " + t("gen.contrastLow");
    } else if (r < 3) {
      el.className = "style-warn show";
      el.textContent = "⚠ " + t("gen.contrastWeak");
    } else {
      el.className = "style-warn hidden";
      el.textContent = "";
    }
  }

  // ── Template form rendering ────────────────────────────────────────────────
  function renderTemplateForm() {
    const host = $("tpl-form");
    if (!host) return;
    const tpl = state.template;
    if (tpl === "text") { host.innerHTML = ""; return; }
    const def = TEMPLATES[tpl];
    const vals = state.values[tpl] || (state.values[tpl] = {});
    let html = "";
    for (const f of def.fields) {
      if (f.showIf && !f.showIf(vals)) continue;
      const val = vals[f.id] != null ? vals[f.id] : (f.default != null ? f.default : "");
      const label = `<label class="tpl-label" for="tpl-${tpl}-${f.id}">${escapeHtml(t(f.key))}</label>`;
      if (f.type === "textarea") {
        html += `<div class="tpl-field"><div class="tpl-label">${escapeHtml(t(f.key))}</div>` +
          `<textarea id="tpl-${tpl}-${f.id}" class="tpl-input" rows="2" placeholder="${f.ph ? escapeHtml(t(f.ph)) : ""}">${escapeHtml(val)}</textarea></div>`;
      } else if (f.type === "select") {
        let opts = "";
        for (const o of f.options) {
          opts += `<option value="${o.v}" ${o.v === val ? "selected" : ""}>${escapeHtml(t(o.k))}</option>`;
        }
        html += `<div class="tpl-field"><div class="tpl-label">${escapeHtml(t(f.key))}</div>` +
          `<select id="tpl-${tpl}-${f.id}" class="tpl-input">${opts}</select></div>`;
      } else if (f.type === "checkbox") {
        html += `<div class="tpl-field tpl-check"><label class="tpl-check-label">` +
          `<input type="checkbox" id="tpl-${tpl}-${f.id}" ${val ? "checked" : ""}/> ${escapeHtml(t(f.key))}</label></div>`;
      } else if (f.type === "datetime") {
        html += `<div class="tpl-field"><div class="tpl-label">${escapeHtml(t(f.key))}</div>` +
          `<input type="datetime-local" id="tpl-${tpl}-${f.id}" class="tpl-input" value="${escapeHtml(val)}" placeholder="${f.ph ? escapeHtml(t(f.ph)) : ""}"/></div>`;
      } else {
        html += `<div class="tpl-field"><div class="tpl-label">${escapeHtml(t(f.key))}</div>` +
          `<input type="text" id="tpl-${tpl}-${f.id}" class="tpl-input" value="${escapeHtml(val)}" placeholder="${f.ph ? escapeHtml(t(f.ph)) : ""}"/></div>`;
      }
    }
    host.innerHTML = html;
    for (const f of def.fields) {
      if (f.showIf && !f.showIf(vals)) continue;
      const el = $("tpl-" + tpl + "-" + f.id);
      if (!el) continue;
      const evt = (f.type === "checkbox") ? "change" : "input";
      el.addEventListener(evt, () => {
        vals[f.id] = f.type === "checkbox" ? el.checked : el.value;
        // re-render the form when a conditional field changes (e.g. encryption)
        if (f.id === "encryption") renderTemplateForm();
        render();
      });
    }
  }

  function switchTemplate(tpl) {
    state.template = tpl;
    state.external = null;
    const dynToggle = $("gen-dynamic");
    if (dynToggle) dynToggle.checked = false;
    const dynPanel = $("gen-dynamic-panel");
    if (dynPanel) dynPanel.classList.add("hidden");
    const sel = $("gen-template");
    if (sel) sel.value = tpl;
    if (tpl === "text" && $("gen-input")) $("gen-input").value = (state.values.text && state.values.text.text) || "";
    renderTemplateForm();
    render();
  }

  // ── Styling persistence + wiring ────────────────────────────────────────────
  function loadStyling() {
    try {
      const saved = JSON.parse(localStorage.getItem(STYLE_KEY) || "{}");
      state.styling = Object.assign(state.styling, saved);
    } catch { /* ignore */ }
  }
  function saveStyling() {
    try { localStorage.setItem(STYLE_KEY, JSON.stringify(state.styling)); } catch { /* ignore */ }
  }
  function applyStylingControls() {
    const s = state.styling;
    if ($("style-fg")) $("style-fg").value = s.fg;
    if ($("style-bg")) $("style-bg").value = s.bg;
    if ($("style-ecc")) $("style-ecc").value = s.ecc;
    if ($("style-dot")) $("style-dot").value = state.styling.dotStyle === "classic" ? "square" : s.dotStyle;
    if ($("style-finder")) $("style-finder").value = s.finderColor;
    if ($("style-finderdot")) $("style-finderdot").value = s.finderDotColor;
    if ($("style-quiet")) { $("style-quiet").value = s.quietModules; $("style-quiet-val").textContent = s.quietModules; }
  }
  function setEcc(v, lock) {
    state.styling.ecc = v;
    if ($("style-ecc")) $("style-ecc").value = v;
    if (lock) $("style-ecc").disabled = true;
    else $("style-ecc").disabled = false;
    saveStyling();
  }
  function onLogoChange() {
    if (state.logo) {
      eccBeforeLogo = state.styling.ecc;
      setEcc("H", true);
      const note = $("style-ecc-note");
      if (note) { note.textContent = t("gen.eccNote"); note.classList.remove("hidden"); }
    } else {
      setEcc(eccBeforeLogo || "M", false);
      const note = $("style-ecc-note");
      if (note) note.classList.add("hidden");
    }
    render();
  }

  // ── Exports (Step 3) ────────────────────────────────────────────────────
  async function pickAndWrite(blobPromise, defaultName, ext, isText) {
    const path = await window.qrAPI.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!path) return false;
    const blob = await blobPromise;
    const payload = isText ? { text: await blobToText(blob) } : { dataUrl: await blobToDataURL(blob) };
    await window.qrAPI.writeFile(Object.assign({ path }, payload));
    return true;
  }
  async function exportPNG() {
    if (!lastContent) return;
    const preset = parseInt(($("png-preset") || {}).value || "1024", 10);
    const { width, margin } = computeCanvas(lastContent, state.styling.ecc, state.styling.quietModules, preset);
    const q = new QRCodeStyling(buildOptions(lastContent, width, margin));
    await pickAndWrite(q.getRawData("png"), "qrcode.png", "png", false);
  }
  async function exportSVG() {
    if (!lastContent) return;
    const edge = parseInt(($("svg-edge") || {}).value || "1024", 10);
    const { width, margin } = computeCanvas(lastContent, state.styling.ecc, state.styling.quietModules, edge);
    const q = new QRCodeStyling(buildOptions(lastContent, width, margin));
    await pickAndWrite(q.getRawData("svg"), "qrcode.svg", "svg", true);
  }
  async function exportPDF() {
    if (!lastContent) return;
    if (!window.jspdf || !window.jspdf.jsPDF) { alert(t("gen.pdfLibMissing")); return; }
    const preset = ($("pdf-preset") || {}).value || "30mm";
    const SIZES = { "30mm": [30, 30], "50mm": [50, 50], "80mm": [80, 80], "card": [90, 50] };
    const [w, h] = SIZES[preset] || [30, 30];
    const dpi = 300;
    const px = Math.round(Math.max(w, h) * dpi / 25.4);
    const pageMargin = 4; // mm
    const { width, margin } = computeCanvas(lastContent, state.styling.ecc, state.styling.quietModules, px);
    const q = new QRCodeStyling(buildOptions(lastContent, width, margin));
    const blob = await q.getRawData("png");
    const dataUrl = await blobToDataURL(blob);
    const caption = ($("pdf-caption") || {}).value || "";

    const doc = new window.jspdf.jsPDF({ unit: "mm", format: [w, h], orientation: "portrait" });
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, "F");
    const imgSize = Math.min(w, h) - 2 * pageMargin;
    doc.addImage(dataUrl, "PNG", (w - imgSize) / 2, (h - imgSize) / 2 - (caption ? 3 : 0), imgSize, imgSize);
    if (caption) {
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);
      doc.text(caption, w / 2, h - pageMargin + 1, { align: "center" });
    }
    const out = doc.output("dataurlstring");
    const path = await window.qrAPI.showSaveDialog({
      defaultPath: "qrcode.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (path) await window.qrAPI.writeFile({ path, dataUrl: out });
  }

  // ── Dynamic (trackable) QR — reuses the existing store + Stats list ───────
  function loadDynamicCodes() {
    try { return JSON.parse(localStorage.getItem(DYNAMIC_STORE_KEY) || "[]"); } catch { return []; }
  }
  function saveDynamicCodes(list) {
    try { localStorage.setItem(DYNAMIC_STORE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }
  function setupDynamic() {
    const dynToggle = $("gen-dynamic");
    const dynPanel = $("gen-dynamic-panel");
    const dynCreateBtn = $("gen-create-trackable");
    const dynStatus = $("gen-dynamic-status");
    if (!dynToggle) return;
    const setStatus = (html, isError) => {
      if (!dynStatus) return;
      dynStatus.innerHTML = html || "";
      dynStatus.classList.toggle("hidden", !html);
      dynStatus.classList.toggle("status-error", !!isError);
    };
    const content = () => buildContent();
    dynToggle.addEventListener("change", () => {
      const on = dynToggle.checked;
      if (dynPanel) dynPanel.classList.toggle("hidden", !on);
      if (!on) { state.external = null; setStatus(""); render(); }
    });
    if (dynCreateBtn) {
      dynCreateBtn.addEventListener("click", async () => {
        const destination = (content() || "").trim();
        if (!destination) { setStatus(t("gen.needDestination"), true); return; }
        dynCreateBtn.disabled = true;
        dynCreateBtn.textContent = t("gen.creating");
        try {
          const res = await window.qrAPI.createDynamicCode({ destination });
          if (!res || !res.ok) { setStatus(t("gen.dynamicError", { reason: (res && res.reason) || "unknown" }), true); return; }
          const cur = { code: res.data.code, shortUrl: res.data.shortUrl, destination, createdAt: res.data.createdAt };
          const list = loadDynamicCodes().filter((c) => c.code !== cur.code);
          list.unshift(cur); saveDynamicCodes(list);
          if (window.__kuiqrRefreshStatsList) window.__kuiqrRefreshStatsList();
          state.external = cur.shortUrl;
          setStatus(`<div class="dyn-ok">${t("gen.trackableActive")} <code>${escapeHtml(cur.shortUrl)}</code></div>` +
            `<button class="btn-text" id="dyn-view-stats">${t("gen.viewStats")}</button>`);
          const vs = $("dyn-view-stats");
          if (vs) vs.addEventListener("click", () => { if (window.requestSwitchTab) window.requestSwitchTab("stats"); });
          render();
        } catch (e) {
          setStatus(t("gen.dynamicError", { reason: String((e && e.message) || e) }), true);
        } finally {
          dynCreateBtn.disabled = false;
          dynCreateBtn.textContent = t("gen.createTrackable");
        }
      });
    }

    // ── One-click local (self-hosted) analytics backend ──
    const localStart = $("dyn-local-start");
    const localStop = $("dyn-local-stop");
    const localStatus = $("dyn-local-status");
    const setLocalStatus = (html, isError) => {
      if (!localStatus) return;
      localStatus.innerHTML = html || "";
      localStatus.classList.toggle("hidden", !html);
      localStatus.classList.toggle("status-error", !!isError);
    };
    const fillAndSave = () => {
      const saveBtn = document.getElementById("save-settings-btn");
      if (saveBtn) saveBtn.click();
    };
    if (localStart) localStart.addEventListener("click", async () => {
      localStart.disabled = true;
      localStart.textContent = t("set.dynamicLocalStarting");
      try {
        const res = await window.qrAPI.startLocalBackend();
        if (!res || !res.ok) { setLocalStatus(t("set.dynamicLocalFailed", { reason: (res && res.reason) || "unknown" }), true); return; }
        const be = document.getElementById("setting-dynamic-backend");
        const ak = document.getElementById("setting-dynamic-apikey");
        if (be) be.value = res.url;
        if (ak) ak.value = res.apiKey;
        fillAndSave();
        setLocalStatus(t("set.dynamicLocalRunning", { url: res.url }), false);
        if (localStop) localStop.classList.remove("hidden");
      } catch (e) {
        setLocalStatus(t("set.dynamicLocalFailed", { reason: String((e && e.message) || e) }), true);
      } finally {
        localStart.disabled = false;
        localStart.textContent = t("set.dynamicLocalStart");
      }
    });
    if (localStop) localStop.addEventListener("click", async () => {
      try { await window.qrAPI.stopLocalBackend(); } catch { /* ignore */ }
      setLocalStatus(t("set.dynamicLocalStopped"), false);
      localStop.classList.add("hidden");
    });
  }

  // ── Region watch (Step 5) ────────────────────────────────────────────────
  function setupRegionWatch() {
    const btn = $("region-watch-btn");
    const stopBtn = $("region-watch-stop");
    const statusEl = $("region-watch-status");
    const labelEl = btn ? btn.querySelector(".btn-label") : null;
    if (btn) btn.addEventListener("click", () => {
      if (window.qrAPI && window.qrAPI.openRegionWatch) window.qrAPI.openRegionWatch();
    });
    if (stopBtn) stopBtn.addEventListener("click", () => {
      if (window.qrAPI && window.qrAPI.stopRegionWatch) window.qrAPI.stopRegionWatch();
    });
    if (window.qrAPI && window.qrAPI.onRegionWatchStatus) {
      window.qrAPI.onRegionWatchStatus((s) => {
        if (!statusEl) return;
        if (!s || !s.running) {
          statusEl.textContent = ""; statusEl.className = "region-watch-status hidden";
          if (labelEl) labelEl.textContent = t("watch.btn");
          if (stopBtn) stopBtn.classList.add("hidden");
          return;
        }
        if (stopBtn) stopBtn.classList.remove("hidden");
        if (labelEl) labelEl.textContent = t("watch.newRegion");
        let txt;
        if (s.paused) {
          txt = "⏸ " + t("watch.paused");
        } else if (s.lastCode) {
          txt = "✅ " + t("watch.lastScan", { code: s.lastCode.slice(0, 40) });
        } else {
          txt = "🔍 " + t("watch.checking", { ms: 500 });
        }
        const last = s.lastActivity ? new Date(s.lastActivity).toLocaleTimeString() : "";
        statusEl.textContent = txt + (last ? "  ·  " + last : "");
        statusEl.className = "region-watch-status " + (s.paused ? "paused" : "running");
      });
    }
  }

  // ── Batch generation (Step 4) ─────────────────────────────────────────────
  function setupBatch() {
    const openBtn = $("gen-batch");
    if (openBtn) openBtn.addEventListener("click", () => {
      const m = $("batch-modal");
      if (m) m.classList.remove("hidden");
      refreshCsvHeaders();
    });
    const closeBtn = $("batch-close");
    if (closeBtn) closeBtn.addEventListener("click", () => { const m = $("batch-modal"); if (m) m.classList.add("hidden"); });
    const csvInput = $("batch-csv");
    if (csvInput) csvInput.addEventListener("change", () => { refreshCsvHeaders(); });
    const tplSel = $("batch-template");
    if (tplSel) tplSel.addEventListener("change", () => buildBatchMapping());
    const folderBtn = $("batch-folder-btn");
    if (folderBtn) folderBtn.addEventListener("click", async () => {
      const res = await window.qrAPI.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
      if (res && res.filePaths && res.filePaths[0]) { $("batch-folder").value = res.filePaths[0]; }
    });
    const startBtn = $("batch-start");
    if (startBtn) startBtn.addEventListener("click", runBatch);
    const cancelBtn = $("batch-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", () => { batchCancelled = true; });
    const zipChk = $("batch-zip");
    if (zipChk) zipChk.addEventListener("change", () => {
      const sel = $("batch-zip-name"); if (sel) sel.classList.toggle("hidden", !zipChk.checked);
    });
  }

  let batchHeaders = [];
  let batchText = "";
  async function refreshCsvHeaders() {
    const input = $("batch-csv");
    const hdrEl = $("batch-csv-name");
    if (!input || !input.files || !input.files[0]) {
      batchHeaders = []; batchText = "";
      if (hdrEl) hdrEl.textContent = t("batch.noCsv");
      buildBatchMapping();
      return;
    }
    batchText = await input.files[0].text();
    try {
      const parsed = Papa.parse(batchText, { header: true, skipEmptyLines: true, preview: 1 });
      batchHeaders = (parsed.meta && parsed.meta.fields) || [];
    } catch { batchHeaders = []; }
    if (hdrEl) hdrEl.textContent = input.files[0].name + " (" + batchHeaders.length + " cols)";
    buildBatchMapping();
  }
  function buildBatchMapping() {
    const host = $("batch-mapping");
    if (!host) return;
    const tpl = ($("batch-template") || {}).value || "text";
    const opts = (sel) => {
      let o = `<option value="">—</option>`;
      for (const h of batchHeaders) o += `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`;
      return o;
    };
    const row = (labelKey, id, req) =>
      `<div class="batch-map-row"><span>${escapeHtml(t(labelKey))}${req ? " *" : ""}</span>` +
      `<select id="${id}" class="batch-select">${opts()}</select></div>`;
    let html = "";
    if (tpl === "text") {
      html += row("batch.map.content", "bm-content", true);
    } else if (tpl === "wifi") {
      html += row("tpl.wifi.ssid", "bm-ssid", true);
      html += row("tpl.wifi.enc", "bm-enc", false);
      html += row("tpl.wifi.pass", "bm-pass", false);
      html += row("batch.map.hidden", "bm-hidden", false);
    } else if (tpl === "vcard") {
      html += row("tpl.vcard.name", "bm-name", false);
      html += row("tpl.vcard.org", "bm-org", false);
      html += row("tpl.vcard.title", "bm-title", false);
      html += row("tpl.vcard.phone", "bm-phone", false);
      html += row("tpl.vcard.email", "bm-email", false);
      html += row("tpl.vcard.website", "bm-web", false);
    } else if (tpl === "email") {
      html += row("tpl.email.email", "bm-email", true);
      html += row("tpl.email.subject", "bm-subject", false);
      html += row("tpl.email.body", "bm-body", false);
    } else if (tpl === "sms") {
      html += row("tpl.sms.number", "bm-number", true);
      html += row("tpl.sms.message", "bm-message", false);
    } else if (tpl === "phone") {
      html += row("tpl.phone.number", "bm-number", true);
    } else if (tpl === "event") {
      html += row("tpl.event.start", "bm-start", true);
      html += row("tpl.event.end", "bm-end", false);
      html += row("tpl.event.summary", "bm-summary", false);
      html += row("tpl.event.location", "bm-location", false);
    } else if (tpl === "geo") {
      html += row("tpl.geo.lat", "bm-lat", true);
      html += row("tpl.geo.lng", "bm-lng", true);
    }
    html += row("batch.map.filename", "bm-filename", false);
    host.innerHTML = html;
  }
  function batchRowContent(tpl, row) {
    const g = (id) => { const el = $("bm-" + id); return el ? el.value : ""; };
    const col = (id) => { const el = $("bm-" + id); return el && el.value ? row[el.value] : ""; };
    switch (tpl) {
      case "text": return (col("content") || "").trim();
      case "wifi": {
        const ssid = (col("ssid") || "").trim();
        if (!ssid) return "";
        const enc = col("enc") || "WPA";
        const hidden = col("hidden") ? "true" : "false";
        if (enc === "nopass") return `WIFI:T:nopass;S:${escWifi(ssid)};H:${hidden};;`;
        return `WIFI:T:${enc};S:${escWifi(ssid)};P:${escWifi(col("pass") || "")};H:${hidden};;`;
      }
      case "vcard": {
        const lines = ["BEGIN:VCARD", "VERSION:3.0"];
        const name = col("name").trim(); if (name) lines.push("FN:" + escV(name));
        const org = col("org").trim(); if (org) lines.push("ORG:" + escV(org));
        const title = col("title").trim(); if (title) lines.push("TITLE:" + escV(title));
        const phone = col("phone").trim(); if (phone) lines.push("TEL;TYPE=CELL:" + escV(phone));
        const email = col("email").trim(); if (email) lines.push("EMAIL:" + email);
        const web = col("web").trim(); if (web) lines.push("URL:" + web);
        lines.push("END:VCARD");
        return lines.join("\n");
      }
      case "email": {
        const e = col("email").trim(); if (!e) return "";
        const q = [];
        if (col("subject")) q.push("subject=" + encodeURIComponent(col("subject")));
        if (col("body")) q.push("body=" + encodeURIComponent(col("body")));
        return "mailto:" + e + (q.length ? "?" + q.join("&") : "");
      }
      case "sms": return "SMSTO:" + col("number").trim() + ":" + (col("message") || "").replace(/\n/g, " ").trim();
      case "phone": return "tel:" + col("number").trim();
      case "event": {
        const lines = ["BEGIN:VEVENT"];
        const s = toICal(col("start")), e2 = toICal(col("end"));
        if (s) lines.push("DTSTART:" + s);
        if (e2) lines.push("DTEND:" + e2);
        const sum = col("summary").trim(); if (sum) lines.push("SUMMARY:" + escV(sum));
        const loc = col("location").trim(); if (loc) lines.push("LOCATION:" + escV(loc));
        lines.push("END:VEVENT");
        return lines.join("\n");
      }
      case "geo": { const lat = col("lat").trim(), lng = col("lng").trim(); if (!lat || !lng) return ""; return "geo:" + lat + "," + lng; }
      default: return "";
    }
  }
  async function runBatch() {
    const folder = ($("batch-folder") || {}).value || "";
    if (!batchText) { setBatchStatus(t("batch.needCsv"), true); return; }
    if (!folder) { setBatchStatus(t("batch.needFolder"), true); return; }
    const tpl = ($("batch-template") || {}).value || "text";
    const includePNG = $("batch-png") && $("batch-png").checked;
    const includeSVG = $("batch-svg") && $("batch-svg").checked;
    if (!includePNG && !includeSVG) { setBatchStatus(t("batch.needFormat"), true); return; }

    const rows = Papa.parse(batchText, { header: true, skipEmptyLines: true }).data;
    const total = rows.length;
    batchCancelled = false;
    setBatchStatus(t("batch.running", { n: 0, total }), false);
    let done = 0, skipped = 0;
    const errors = [];
    for (let i = 0; i < total; i++) {
      if (batchCancelled) break;
      const row = rows[i];
      let content = "";
      try { content = batchRowContent(tpl, row); } catch (e) { content = ""; }
      if (!content) { skipped++; errors.push(`#${i + 1}: empty`); updateBatchProgress(done + skipped, total); continue; }
      const fnameBase = (() => {
        const el = $("bm-filename");
        const colName = el && el.value ? row[el.value] : "";
        const safe = String(colName || "").trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
        return safe || `qr_${String(i + 1).padStart(4, "0")}`;
      })();
      try {
        const { width, margin } = computeCanvas(content, state.styling.ecc, state.styling.quietModules, 1024);
        const q = new QRCodeStyling(buildOptions(content, width, margin));
        if (includePNG) {
          const b = await q.getRawData("png");
          const du = await blobToDataURL(b);
          await window.qrAPI.writeFile({ path: folder + "/" + fnameBase + ".png", dataUrl: du });
        }
        if (includeSVG) {
          const b = await q.getRawData("svg");
          const txt = await blobToText(b);
          await window.qrAPI.writeFile({ path: folder + "/" + fnameBase + ".svg", text: txt });
        }
      } catch (e) {
        skipped++; errors.push(`#${i + 1}: ${String((e && e.message) || e)}`);
      }
      done++;
      updateBatchProgress(done + skipped, total);
    }
    let msg = t("batch.done", { done, skipped, total });
    if (errors.length) msg += "\n" + errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n…(+${errors.length - 5})` : "");
    setBatchStatus(msg, skipped > 0);

    // Optional zip
    const zipChk = $("batch-zip");
    if (zipChk && zipChk.checked && !batchCancelled) {
      const nameEl = $("batch-zip-name-input");
      const zipName = (nameEl && nameEl.value) ? nameEl.value : "kuiqr-batch";
      try {
        await window.qrAPI.zipFolder({ folder, outName: zipName + ".zip" });
        setBatchStatus(msg + "\n" + t("batch.zipped"), false);
      } catch (e) { setBatchStatus(msg + "\n" + t("batch.zipFail", { reason: String((e && e.message) || e) }), true); }
    }
  }
  function setBatchStatus(msg, isError) {
    const el = $("batch-status");
    if (!el) return;
    el.textContent = msg;
    el.className = "batch-status " + (isError ? "warn" : "ok");
    el.classList.remove("hidden");
  }
  function updateBatchProgress(n, total) {
    const bar = $("batch-progress-bar");
    const txt = $("batch-progress-text");
    if (bar) bar.style.width = (total ? Math.round((n / total) * 100) : 0) + "%";
    if (txt) txt.textContent = t("batch.running", { n, total });
  }

  // ── Regression self-test (used by tests/run-selftest.mjs via selftest.html) ─
  function makeTestLogo() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "#1565c0"; x.fillRect(0, 0, 64, 64);
    x.fillStyle = "#ffffff"; x.font = "bold 42px sans-serif";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("Q", 32, 35);
    return c.toDataURL("image/png");
  }
  async function runSelfTest() {
    const cases = [];
    const samples = [
      { name: "text-url", content: "https://example.com/hello?x=1" },
      { name: "wifi", content: 'WIFI:T:WPA;S:My\\;Net;P:p@ss,word:H:false;;' },
      { name: "vcard", content: "BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nORG:Acme\nTEL;TYPE=CELL:+1 555 0100\nEMAIL:jane@acme.com\nEND:VCARD" },
      { name: "email", content: "mailto:jane@acme.com?subject=Hi&body=Hello" },
      { name: "sms", content: "SMSTO:15550100:Hello there" },
      { name: "phone", content: "tel:+15550100" },
      { name: "event", content: "BEGIN:VEVENT\nDTSTART:20260827T140000\nDTEND:20260827T150000\nSUMMARY:Meeting\nLOCATION:Office\nEND:VEVENT" },
      { name: "geo", content: "geo:37.421999,-122.084" },
    ];
    const styleSets = [
      { fg: "#000000", bg: "#ffffff", ecc: "M", dotStyle: "square", finderColor: "#000000", finderDotColor: "#000000", quietModules: 4, logo: null },
      { fg: "#1a237e", bg: "#ffffff", ecc: "H", dotStyle: "rounded", finderColor: "#d32f2f", finderDotColor: "#d32f2f", quietModules: 4, logo: null },
      { fg: "#0d47a1", bg: "#fff9c4", ecc: "H", dotStyle: "dots", finderColor: "#000000", finderDotColor: "#000000", quietModules: 6, logo: null },
      // Logo case: embedded logo at 22% with ECC H must STILL scan — the highest-risk path.
      { fg: "#000000", bg: "#ffffff", ecc: "H", dotStyle: "square", finderColor: "#000000", finderDotColor: "#000000", quietModules: 4, logo: makeTestLogo() },
    ];
    let pass = 0, fail = 0;
    const details = [];
    for (const c of samples) {
      for (let si = 0; si < styleSets.length; si++) {
        const s = styleSets[si];
        const { width, margin } = computeCanvas(c.content, s.ecc, s.quietModules, 512);
        const q = new QRCodeStyling(buildOptionsWith(c.content, width, margin, s));
        try {
          const blob = await q.getRawData("png");
          const dataUrl = await blobToDataURL(blob);
          const img = new Image(); img.src = dataUrl; await img.decode();
          const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
          const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
          const { data, width: w, height: h } = ctx.getImageData(0, 0, img.width, img.height);
          const res = jsQR(data, w, h);
          const ok = !!res && res.data === c.content;
          if (ok) pass++; else fail++;
          details.push({ name: c.name + "#" + si, ok, decoded: res ? res.data.slice(0, 30) : null, expected: c.content.slice(0, 30) });
        } catch (e) {
          fail++; details.push({ name: c.name + "#" + si, ok: false, error: String((e && e.message) || e) });
        }
      }
    }
    // ── Format-spec checks: exact payload strings per ISO/IEC templates ──
    const formatCases = [
      { name: "wifi-wpa", tpl: "wifi", v: { ssid: "My;Net", encryption: "WPA", password: "p@ss,word", hidden: false },
        expected: "WIFI:T:WPA;S:My\\;Net;P:p@ss\\,word;H:false;;" },
      { name: "wifi-nopass", tpl: "wifi", v: { ssid: "Open", encryption: "nopass", hidden: true },
        expected: "WIFI:T:nopass;S:Open;H:true;;" },
      { name: "vcard", tpl: "vcard", v: { name: "Jane Doe", org: "Acme", phone: "+1 555 0100", email: "jane@acme.com" },
        expected: "BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nORG:Acme\nTEL;TYPE=CELL:+1 555 0100\nEMAIL:jane@acme.com\nEND:VCARD" },
      { name: "email", tpl: "email", v: { email: "jane@acme.com", subject: "Hi", body: "Hello world" },
        expected: "mailto:jane@acme.com?subject=Hi&body=Hello%20world" },
      { name: "sms", tpl: "sms", v: { number: "+1 555 0100", message: "Hello there" },
        expected: "SMSTO:+1 555 0100:Hello there" },
      { name: "phone", tpl: "phone", v: { number: "+1 555 0100" },
        expected: "tel:+1 555 0100" },
      { name: "event", tpl: "event", v: { start: "2026-08-27T14:00", end: "2026-08-27T15:00", summary: "Meeting", location: "Office" },
        expected: "BEGIN:VEVENT\nDTSTART:20260827T140000\nDTEND:20260827T150000\nSUMMARY:Meeting\nLOCATION:Office\nEND:VEVENT" },
      { name: "geo", tpl: "geo", v: { lat: "37.4219", lng: "-122.0840" },
        expected: "geo:37.4219,-122.0840" },
    ];
    const formatChecks = [];
    for (const c of formatCases) {
      state.template = c.tpl;
      state.values[c.tpl] = c.v;
      const got = buildContent();
      formatChecks.push({ name: c.name, ok: got === c.expected, got, expected: c.expected });
    }
    state.template = "text";

    return { pass, fail, total: pass + fail, details, formatChecks };
  }
  function buildOptionsWith(content, width, margin, s) {
    const o = {
      width, height: width, margin, data: content,
      qrOptions: { errorCorrectionLevel: s.ecc },
      // true circular "dots" from qr-code-styling breaks timing/alignment patterns
      // and fails strict decoders; extra-rounded gives a scannable dot-like look.
      dotsOptions: { type: s.dotStyle === "square" ? "classic" : (s.dotStyle === "dots" ? "extra-rounded" : s.dotStyle), color: s.fg },
      cornersSquareOptions: { type: "square", color: s.finderColor },
      cornersDotOptions: { type: "square", color: s.finderDotColor },
      backgroundOptions: { color: s.bg },
    };
    if (s.logo) { o.image = s.logo; o.imageOptions = { hideBackgroundDots: true, imageSize: 0.22, margin: 4 }; }
    return o;
  }

  // ── Public init ────────────────────────────────────────────────────────────
  function init() {
    loadStyling();
    // Template selector
    const sel = $("gen-template");
    if (sel) {
      sel.innerHTML = "";
      for (const key of Object.keys(TEMPLATES)) {
        const o = document.createElement("option");
        o.value = key; o.textContent = t(TEMPLATES[key].labelKey);
        sel.appendChild(o);
      }
      sel.value = state.template;
      sel.addEventListener("change", () => switchTemplate(sel.value));
    }
    // Plain-text input
    if ($("gen-input")) $("gen-input").addEventListener("input", () => { state.values.text = { text: $("gen-input").value }; state.external = null; render(); });

    applyStylingControls();
    // Styling controls
    if ($("style-fg")) $("style-fg").addEventListener("input", (e) => { state.styling.fg = e.target.value; saveStyling(); updateContrastWarning(); render(); });
    if ($("style-bg")) $("style-bg").addEventListener("input", (e) => { state.styling.bg = e.target.value; saveStyling(); updateContrastWarning(); render(); });
    if ($("style-ecc")) $("style-ecc").addEventListener("change", (e) => { if (!e.target.disabled) { state.styling.ecc = e.target.value; saveStyling(); render(); } });
    if ($("style-dot")) $("style-dot").addEventListener("change", (e) => { state.styling.dotStyle = e.target.value; saveStyling(); render(); });
    if ($("style-finder")) $("style-finder").addEventListener("input", (e) => { state.styling.finderColor = e.target.value; saveStyling(); render(); });
    if ($("style-finderdot")) $("style-finderdot").addEventListener("input", (e) => { state.styling.finderDotColor = e.target.value; saveStyling(); render(); });
    if ($("style-quiet")) $("style-quiet").addEventListener("input", (e) => {
      state.styling.quietModules = parseInt(e.target.value, 10) || 0;
      if ($("style-quiet-val")) $("style-quiet-val").textContent = state.styling.quietModules;
      saveStyling(); render();
    });
    // Logo
    const logoPick = $("style-logo-pick");
    if (logoPick) logoPick.addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/*";
      inp.addEventListener("change", () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => { state.logo = r.result; onLogoChange(); };
        r.readAsDataURL(f);
      });
      inp.click();
    });
    const logoClear = $("style-logo-clear");
    if (logoClear) logoClear.addEventListener("click", () => { state.logo = null; onLogoChange(); });

    // Export buttons
    if ($("gen-download")) $("gen-download").addEventListener("click", exportPNG);
    if ($("gen-export-svg")) $("gen-export-svg").addEventListener("click", exportSVG);
    if ($("gen-export-pdf")) $("gen-export-pdf").addEventListener("click", exportPDF);
    if ($("gen-copy-qr")) $("gen-copy-qr").addEventListener("click", async () => {
      if (!lastDataUrl) return;
      try { const res = await window.qrAPI.copyQrImage(lastDataUrl); if (res && res.ok === false) throw new Error(res.reason || "Copy failed"); flashBtn($("gen-copy-qr"), t("result.copied")); }
      catch (err) { if (window.showScanPopup) window.showScanPopup("error", t("copyFail"), err.message || ""); }
    });
    if ($("gen-copy")) $("gen-copy").addEventListener("click", () => {
      const textToCopy = lastContent || "";
      if (!textToCopy) return;
      window.qrAPI.copyClipboard(textToCopy);
      flashBtn($("gen-copy"), t("result.copied"));
    });

    renderTemplateForm();
    setupDynamic();
    setupBatch();
    setupRegionWatch();
    render();
  }
  function flashBtn(btn, msg) {
    if (!btn) return;
    const prev = btn.textContent; btn.textContent = msg;
    setTimeout(() => { btn.textContent = prev; }, 1500);
  }

  window.QRGen = { init, render, runSelfTest, getState: () => state, setExternalContent: (t) => { state.external = t; render(); } };
})();
