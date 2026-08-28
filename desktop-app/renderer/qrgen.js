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
  const SAMPLE_DEFAULT = "https://kuiqr.app"; // smart default seeded into the text field on first open

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
  let wifiScanOutsideHandler = null;

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
        // RFC 5545: a VEVENT must be wrapped in a VCALENDAR envelope for
        // iOS/Android camera data detectors to recognize calendar QR codes.
        // CRLF line endings per spec; UID/DTSTAMP are omitted here to keep
        // the payload compact (added when exporting an .ics file).
        const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kuiqr//EN", "BEGIN:VEVENT"];
        const s = toICal(v.start), e2 = toICal(v.end);
        if (s) lines.push("DTSTART:" + s);
        if (e2) lines.push("DTEND:" + e2);
        const sum = (v.summary || "").trim(); if (sum) lines.push("SUMMARY:" + escV(sum));
        const loc = (v.location || "").trim(); if (loc) lines.push("LOCATION:" + escV(loc));
        lines.push("END:VEVENT", "END:VCALENDAR");
        return lines.join("\r\n");
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
      // Reciprocity: celebrate the first QR the user actually generated themselves.
      // Skip the auto-seeded sample so the win feels earned, not spammed.
      const isSampleDefault = state.template === "text" && content === SAMPLE_DEFAULT;
      if (window.kuiqrGiftHint && !isSampleDefault) window.kuiqrGiftHint($("gen-preview"), "gift.gen", "kuiqr.giftGenSeen");
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
    // Geolocation: an interactive world map replaces the raw lat/lon text inputs.
    if (tpl === "geo") {
      host.innerHTML = '<div class="geo-placeholder" id="tpl-geo-picker"></div>';
      const ph = $("tpl-geo-picker");
      if (ph) ph.appendChild(buildGeoPicker("geo"));
      return;
    }
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
        // Event dates use a custom scrollable picker (year/month/day/hour/minute
        // selects + Today/Tomorrow quick buttons) instead of the native spinner.
        if (tpl === "event") {
          html += `<div class="tpl-field"><div class="tpl-label">${escapeHtml(t(f.key))}</div>` +
            `<div class="dt-placeholder" id="tpl-${tpl}-${f.id}" data-dtfield="${f.id}"></div></div>`;
        } else {
          html += `<div class="tpl-field"><div class="tpl-label">${escapeHtml(t(f.key))}</div>` +
            `<input type="datetime-local" id="tpl-${tpl}-${f.id}" class="tpl-input" value="${escapeHtml(val)}" placeholder="${f.ph ? escapeHtml(t(f.ph)) : ""}"/></div>`;
        }
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
    // Event: replace the datetime placeholders with the scrollable date/time picker.
    if (tpl === "event") {
      for (const f of def.fields) {
        if (f.type !== "datetime") continue;
        const ph = $("tpl-event-" + f.id);
        if (!ph) continue;
        ph.appendChild(buildDateTimePicker("event", f.id, vals[f.id] != null ? vals[f.id] : ""));
      }
    }
    // Wi-Fi: nearby-network picker so users can pick the SSID instead of typing it.
    if (tpl === "wifi") wireWifiScan(host);
  }

  // ── Scrollable date/time picker (calendar events) ───────────────────────────
  // Five scrollable <select> columns (Year / Month / Day / Hour / Minute) plus
  // "Today" / "Tomorrow" quick buttons. Stored value stays in datetime-local
  // format (YYYY-MM-DDTHH:MM) so buildContent() is unchanged.
  function buildDateTimePicker(tpl, fieldId, currentValue) {
    const vals = state.values[tpl] || (state.values[tpl] = {});
    const wrap = document.createElement("div");
    wrap.className = "dt-picker";

    const parse = (s) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || "");
      if (!m) return null;
      return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
    };
    const pad = (n) => String(n).padStart(2, "0");
    const compose = (p) => `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
    const nowParts = () => { const n = new Date(); return { y: n.getFullYear(), mo: n.getMonth() + 1, d: n.getDate(), h: n.getHours(), mi: n.getMinutes() }; };
    let cur = parse(currentValue) || nowParts();

    const quick = document.createElement("div");
    quick.className = "dt-quick";
    const mkQuick = (label, addDays) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "seg-btn"; b.textContent = label;
      b.addEventListener("click", () => {
        const n = new Date(); n.setDate(n.getDate() + addDays);
        setAll({ y: n.getFullYear(), mo: n.getMonth() + 1, d: n.getDate(), h: n.getHours(), mi: n.getMinutes() });
      });
      return b;
    };
    quick.appendChild(mkQuick(t("tpl.event.today"), 0));
    quick.appendChild(mkQuick(t("tpl.event.tomorrow"), 1));
    wrap.appendChild(quick);

    function setAll(p) { cur = p; syncSelects(); commit(); }
    function commit() { vals[fieldId] = compose(cur); render(); }

    const grid = document.createElement("div");
    grid.className = "dt-grid";
    const mkSel = (opts, key, label) => {
      const sel = document.createElement("select");
      sel.className = "tpl-input dt-sel";
      for (const o of opts) { const op = document.createElement("option"); op.value = String(o.v); op.textContent = o.t; sel.appendChild(op); }
      sel.addEventListener("change", () => { cur[key] = parseInt(sel.value, 10); commit(); });
      const cell = document.createElement("div"); cell.className = "dt-cell";
      const lbl = document.createElement("span"); lbl.className = "dt-sel-lbl"; lbl.textContent = label;
      cell.appendChild(lbl); cell.appendChild(sel);
      return sel;
    };
    const yearOpts = []; for (let y = 2020; y <= 2060; y++) yearOpts.push({ v: y, t: String(y) });
    const monOpts = []; for (let m = 1; m <= 12; m++) monOpts.push({ v: m, t: String(m) });
    const dayOpts = []; for (let d = 1; d <= 31; d++) dayOpts.push({ v: d, t: String(d) });
    const hrOpts = []; for (let h = 0; h < 24; h++) hrOpts.push({ v: h, t: pad(h) });
    const miOpts = []; for (let m = 0; m < 60; m++) miOpts.push({ v: m, t: pad(m) });

    const yS = mkSel(yearOpts, "y", t("tpl.event.year"));
    const mS = mkSel(monOpts, "mo", t("tpl.event.month"));
    const dS = mkSel(dayOpts, "d", t("tpl.event.day"));
    const hS = mkSel(hrOpts, "h", t("tpl.event.hour"));
    const miS = mkSel(miOpts, "mi", t("tpl.event.minute"));
    grid.appendChild(yS.parentElement); grid.appendChild(mS.parentElement); grid.appendChild(dS.parentElement);
    grid.appendChild(hS.parentElement); grid.appendChild(miS.parentElement);
    wrap.appendChild(grid);

    function syncSelects() {
      yS.value = String(cur.y); mS.value = String(cur.mo); dS.value = String(cur.d);
      hS.value = String(cur.h); miS.value = String(cur.mi);
    }
    syncSelects();
    return wrap;
  }

  // ── Interactive world-map geolocation picker ─────────────────────────────────
  // Equirectangular projection (1px = 1°): x = lon+180, y = 90−lat, in a 360×180
  // viewBox. Clicking/dragging the map sets lat/lon; a search box (OpenStreetMap
  // Nominatim, graceful fallback) and quick-pick city chips make exact placement
  // easy. Replaces the raw latitude/longitude text fields.
  const GEO_W = 360, GEO_H = 180;
  const CONTINENTS = [
    [[-168,65],[-160,70],[-140,70],[-120,73],[-95,72],[-80,68],[-60,60],[-55,52],[-65,45],[-70,42],[-75,35],[-80,30],[-82,25],[-90,30],[-97,26],[-105,22],[-110,30],[-120,35],[-125,42],[-130,55],[-140,60],[-168,65]],
    [[-80,8],[-75,5],[-60,5],[-50,0],[-40,-5],[-35,-10],[-40,-22],[-50,-30],[-58,-38],[-65,-45],[-72,-52],[-75,-50],[-72,-40],[-70,-30],[-72,-20],[-78,-10],[-80,0],[-80,8]],
    [[-10,36],[-10,44],[-5,48],[0,51],[2,58],[10,58],[20,55],[28,52],[30,45],[28,40],[20,38],[12,38],[0,36],[-10,36]],
    [[-17,20],[-10,30],[0,36],[10,37],[20,33],[32,31],[35,24],[43,12],[51,12],[42,0],[40,-10],[35,-22],[25,-34],[18,-34],[12,-18],[8,4],[-5,5],[-15,12],[-17,20]],
    [[30,45],[40,48],[50,55],[60,62],[80,72],[100,75],[140,72],[160,68],[180,65],[170,60],[150,52],[140,45],[130,35],[122,30],[120,22],[110,20],[105,10],[100,5],[95,15],[90,22],[80,8],[75,8],[70,20],[60,25],[55,38],[45,40],[35,42],[30,45]],
    [[113,-22],[122,-18],[132,-12],[142,-12],[150,-20],[153,-28],[147,-38],[138,-35],[130,-32],[118,-35],[113,-28],[113,-22]],
  ];
  const GEO_CITIES = [
    { n: "San Francisco", lat: 37.7749, lon: -122.4194 },
    { n: "New York", lat: 40.7128, lon: -74.0060 },
    { n: "London", lat: 51.5074, lon: -0.1278 },
    { n: "Paris", lat: 48.8566, lon: 2.3522 },
    { n: "Tokyo", lat: 35.6762, lon: 139.6503 },
    { n: "Beijing", lat: 39.9042, lon: 116.4074 },
    { n: "Sydney", lat: -33.8688, lon: 151.2093 },
    { n: "São Paulo", lat: -23.5505, lon: -46.6333 },
  ];
  function buildGeoPicker(tpl) {
    const vals = state.values[tpl] || (state.values[tpl] = {});
    const wrap = document.createElement("div");
    wrap.className = "geo-picker";
    const toXY = (lat, lon) => ({ x: lon + 180, y: 90 - lat });

    // Map container
    const mapBox = document.createElement("div");
    mapBox.className = "geo-map";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${GEO_W} ${GEO_H}`);
    svg.setAttribute("class", "geo-svg");
    svg.setAttribute("preserveAspectRatio", "none");
    // ocean
    const ocean = document.createElementNS(svgNS, "rect");
    ocean.setAttribute("width", GEO_W); ocean.setAttribute("height", GEO_H);
    ocean.setAttribute("fill", "#dbeafe");
    svg.appendChild(ocean);
    // graticule
    for (let lon = -180; lon <= 180; lon += 30) {
      const l = document.createElementNS(svgNS, "line");
      l.setAttribute("x1", lon + 180); l.setAttribute("x2", lon + 180);
      l.setAttribute("y1", 0); l.setAttribute("y2", GEO_H);
      l.setAttribute("stroke", "#cdd9ec"); l.setAttribute("stroke-width", "0.4");
      svg.appendChild(l);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const l = document.createElementNS(svgNS, "line");
      l.setAttribute("x1", 0); l.setAttribute("x2", GEO_W);
      l.setAttribute("y1", 90 - lat); l.setAttribute("y2", 90 - lat);
      l.setAttribute("stroke", "#cdd9ec"); l.setAttribute("stroke-width", "0.4");
      svg.appendChild(l);
    }
    // continents
    for (const c of CONTINENTS) {
      let d = "";
      for (let i = 0; i < c.length; i++) {
        const p = toXY(c[i][0], c[i][1]);
        d += (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1) + " ";
      }
      d += "Z";
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "#a7c4a0");
      path.setAttribute("stroke", "#7fa874");
      path.setAttribute("stroke-width", "0.5");
      svg.appendChild(path);
    }
    // marker
    const marker = document.createElementNS(svgNS, "g");
    marker.setAttribute("class", "geo-marker");
    const mdot = document.createElementNS(svgNS, "circle");
    mdot.setAttribute("r", "3.2"); mdot.setAttribute("fill", "#e11d48"); mdot.setAttribute("stroke", "#fff"); mdot.setAttribute("stroke-width", "1");
    marker.appendChild(mdot);
    svg.appendChild(marker);
    mapBox.appendChild(svg);
    const hint = document.createElement("div");
    hint.className = "geo-hint"; hint.textContent = t("tpl.geo.map");
    mapBox.appendChild(hint);
    wrap.appendChild(mapBox);

    // readout + manual
    const readout = document.createElement("div");
    readout.className = "geo-readout";
    readout.innerHTML = `<span class="geo-readout-lbl">${t("tpl.geo.current")}:</span> <span id="geo-coords">—</span>`;
    wrap.appendChild(readout);

    const setCoord = (lat, lon, fromMap) => {
      lat = Math.max(-85, Math.min(85, lat));
      lon = Math.max(-180, Math.min(180, lon));
      vals.lat = String(lat); vals.lng = String(lon);
      const p = toXY(lat, lon);
      marker.setAttribute("transform", `translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`);
      const c = $("geo-coords");
      if (c) c.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      if (!fromMap) render();
    };
    // initial marker
    const initLat = parseFloat(vals.lat), initLon = parseFloat(vals.lng);
    if (!isNaN(initLat) && !isNaN(initLon)) setCoord(initLat, initLon, true);

    // click / drag
    const pick = (e) => {
      const r = svg.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX);
      const cy = (e.touches ? e.touches[0].clientY : e.clientY);
      const x = (cx - r.left) / r.width * GEO_W;
      const y = (cy - r.top) / r.height * GEO_H;
      setCoord(90 - y, x - 180, false);
    };
    let dragging = false;
    svg.addEventListener("mousedown", (e) => { dragging = true; pick(e); });
    window.addEventListener("mouseup", () => { dragging = false; });
    window.addEventListener("mousemove", (e) => { if (dragging) pick(e); });
    svg.addEventListener("touchstart", (e) => { pick(e); e.preventDefault(); }, { passive: false });
    svg.addEventListener("touchmove", (e) => { pick(e); e.preventDefault(); }, { passive: false });

    // search
    const searchRow = document.createElement("div");
    searchRow.className = "geo-search";
    const searchInput = document.createElement("input");
    searchInput.type = "text"; searchInput.className = "tpl-input";
    searchInput.placeholder = t("tpl.geo.searchPh");
    const searchBtn = document.createElement("button");
    searchBtn.type = "button"; searchBtn.className = "btn-text"; searchBtn.textContent = t("tpl.geo.search");
    const searchStatus = document.createElement("div");
    searchStatus.className = "geo-search-status hidden";
    searchRow.appendChild(searchInput); searchRow.appendChild(searchBtn);
    wrap.appendChild(searchRow); wrap.appendChild(searchStatus);
    searchBtn.addEventListener("click", async () => {
      const q = searchInput.value.trim();
      if (!q) return;
      searchStatus.textContent = t("tpl.geo.searching");
      searchStatus.className = "geo-search-status";
      try {
        const res = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q), { headers: { "Accept": "application/json" } });
        const j = await res.json();
        if (j && j.length) { setCoord(parseFloat(j[0].lat), parseFloat(j[0].lon), false); searchStatus.className = "geo-search-status hidden"; }
        else { searchStatus.textContent = t("tpl.geo.notFound"); }
      } catch { searchStatus.textContent = t("tpl.geo.notFound"); }
    });
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") searchBtn.click(); });

    // quick picks
    const quickWrap = document.createElement("div");
    quickWrap.className = "geo-quick";
    const qlbl = document.createElement("span"); qlbl.className = "geo-quick-lbl"; qlbl.textContent = t("tpl.geo.quick") + ":";
    quickWrap.appendChild(qlbl);
    for (const c of GEO_CITIES) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "geo-chip"; b.textContent = c.n;
      b.addEventListener("click", () => setCoord(c.lat, c.lon, false));
      quickWrap.appendChild(b);
    }
    wrap.appendChild(quickWrap);
    return wrap;
  }

  // ── Wi-Fi nearby SSID picker ─────────────────────────────────────────────
  function wireWifiScan(host) {
    const input = $("tpl-wifi-ssid");
    if (!input || !window.qrAPI || !window.qrAPI.scanWifi) return;
    // Wrap the input in a row with a scan button and a dropdown list.
    const wrap = document.createElement("div");
    wrap.className = "wifi-scan";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-text wifi-scan-btn";
    btn.textContent = t("tpl.wifi.scan");
    wrap.appendChild(btn);
    // Persistent manual-entry affordance: the SSID field is always editable, but
    // this makes it explicit that typing your own network is a first-class option
    // (macOS privacy redacts nearby SSIDs, so a scan may only return the one you
    // are already on).
    const manual = document.createElement("button");
    manual.type = "button";
    manual.className = "btn-text wifi-scan-manual";
    manual.textContent = t("tpl.wifi.typeMyself");
    manual.addEventListener("click", () => {
      list.classList.add("hidden");
      input.focus();
    });
    wrap.appendChild(manual);
    const list = document.createElement("div");
    list.className = "wifi-scan-list hidden";
    wrap.appendChild(list);

    // Append a "type it myself" row so the manual path is always one tap away,
    // even after a scan returns results.
    const appendManualRow = () => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "wifi-scan-item wifi-scan-item-manual";
      row.textContent = t("tpl.wifi.typeMyself");
      row.addEventListener("click", () => { list.classList.add("hidden"); input.focus(); });
      list.appendChild(row);
    };

    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      list.classList.remove("hidden");
      list.innerHTML = `<div class="wifi-scan-empty">${t("tpl.wifi.scanning")}</div>`;
      let res;
      try { res = await window.qrAPI.scanWifi(); }
      catch (e) { res = { ok: false, reason: String((e && e.message) || e) }; }
      btn.disabled = false;
      if (!res || !res.ok || !res.networks || !res.networks.length) {
        const why = res && res.reason === "no-networks" ? t("tpl.wifi.none") : t("tpl.wifi.fail");
        list.innerHTML = `<div class="wifi-scan-empty">${why}</div>`;
        appendManualRow();
        return;
      }
      list.innerHTML = "";
      for (const n of res.networks.slice(0, 12)) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "wifi-scan-item";
        const sig = (n.signal != null && n.signal >= 0) ? `<span class="wifi-scan-sig">${n.signal}%</span>` : "";
        item.innerHTML = `<span class="wifi-scan-ssid"></span>${sig}`;
        item.querySelector(".wifi-scan-ssid").textContent = n.ssid;
        item.addEventListener("click", () => {
          input.value = n.ssid;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          list.classList.add("hidden");
        });
        list.appendChild(item);
      }
      appendManualRow();
    });
    // Hide the list when clicking outside (one live document listener at a time).
    if (wifiScanOutsideHandler) document.removeEventListener("click", wifiScanOutsideHandler);
    wifiScanOutsideHandler = (e) => { if (!wrap.contains(e.target)) list.classList.add("hidden"); };
    document.addEventListener("click", wifiScanOutsideHandler);
  }

  function switchTemplate(tpl) {
    state.template = tpl;
    state.external = null;
    const dynToggle = $("gen-dynamic");
    if (dynToggle) dynToggle.checked = false;
    const dynPanel = $("gen-dynamic-panel");
    if (dynPanel) dynPanel.classList.add("hidden");
    const dynGroup = document.getElementById("dynamic-group");
    if (dynGroup) dynGroup.classList.remove("expanded");
    const sel = $("gen-template");
    if (sel) sel.value = tpl;
    if (tpl === "text" && $("gen-input")) $("gen-input").value = (state.values.text && state.values.text.text) || "";
    renderTemplateForm();
    render();
  }

  // ── Styling persistence + wiring ────────────────────────────────────────────
  // Styling is persisted in TWO places, in this order of authority:
  //   1. main-process settings.json (via qrAPI.getQrStyle/setQrStyle) — survives
  //      userData changes, dev↔release app swaps, and localStorage wipes.
  //   2. renderer localStorage (kuiqr.qrstyle) — instant synchronous fallback.
  let styleSyncReady = false; // true once the main-process style has been merged in
  function loadStyling() {
    try {
      const saved = JSON.parse(localStorage.getItem(STYLE_KEY) || "{}");
      state.styling = Object.assign(state.styling, saved);
    } catch { /* ignore */ }
    // Merge the durable main-process copy (async; render() is re-run after).
    if (window.qrAPI && window.qrAPI.getQrStyle) {
      window.qrAPI.getQrStyle().then((res) => {
        styleSyncReady = true;
        if (res && res.ok && res.style && typeof res.style === "object") {
          // The main-process copy wins ONLY if it is fresher than the local copy
          // (both layers write savedAt on every change).
          const localAt = (() => { try { const l = JSON.parse(localStorage.getItem(STYLE_KEY) || "null"); return (l && l.savedAt) || 0; } catch { return 0; } })();
          const mainAt = res.style.savedAt || 0;
          if (mainAt > localAt) {
            state.styling = Object.assign(state.styling, res.style);
            applyStylingControls();
            render();
            updateContrastWarning();
          }
        }
      }).catch(() => { styleSyncReady = true; });
    } else {
      styleSyncReady = true;
      // No qrAPI (e.g. selftest page) — keep localStorage-only behaviour.
    }
  }
  function saveStyling() {
    state.styling.savedAt = Date.now();
    try { localStorage.setItem(STYLE_KEY, JSON.stringify(state.styling)); } catch { /* ignore */ }
    if (styleSyncReady && window.qrAPI && window.qrAPI.setQrStyle) {
      window.qrAPI.setQrStyle(state.styling).catch(() => {});
    }
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
    const dynGroup = document.getElementById("dynamic-group");
    const setExpanded = (on) => { if (dynGroup) dynGroup.classList.toggle("expanded", !!on); };
    dynToggle.addEventListener("change", () => {
      const on = dynToggle.checked;
      if (dynPanel) dynPanel.classList.toggle("hidden", !on);
      setExpanded(on);
      if (!on) { state.external = null; setStatus(""); render(); }
    });
    if (dynCreateBtn) {
      dynCreateBtn.addEventListener("click", async () => {
        const destination = (content() || "").trim();
        if (!destination) { setStatus(t("gen.needDestination"), true); return; }
        // A trackable QR must encode a redirect URL. Non-URL payloads (WiFi,
        // vCard, etc.) cannot be handled by an HTTP redirect.
        if (!/^https?:\/\//i.test(destination)) {
          setStatus(t("gen.dynamicNeedsUrl"), true);
          return;
        }
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
          const isLocalBackend = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.0\.0\.1|localhost)/i.test(new URL(cur.shortUrl).hostname || "");
          const networkNote = isLocalBackend ? `<p class="dyn-note">${t("gen.trackableLocalNote")}</p>` : "";
          setStatus(
            `<div class="dyn-card">` +
              `<div class="dyn-card-title">${t("gen.trackableActive")}</div>` +
              `<p class="dyn-card-body">${t("gen.trackableExplainer")}</p>` +
              `<div class="dyn-link-row">` +
                `<code class="dyn-link-code">${escapeHtml(cur.shortUrl)}</code>` +
                `<button class="btn-text dyn-copy-link" id="dyn-copy-link">${t("gen.copyShortLink")}</button>` +
              `</div>` +
              `<p class="dyn-card-dest">${t("gen.trackableDestination", { url: escapeHtml(destination) })}</p>` +
              networkNote +
              `<div class="dyn-card-actions">` +
                `<button class="btn-text dyn-view-stats" id="dyn-view-stats">${t("gen.viewStats")}</button>` +
              `</div>` +
            `</div>`
          );
          const vs = $("dyn-view-stats");
          if (vs) vs.addEventListener("click", () => { if (window.requestSwitchTab) window.requestSwitchTab("stats"); });
          const cp = $("dyn-copy-link");
          if (cp) cp.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(cur.shortUrl);
              cp.textContent = t("gen.copied");
              setTimeout(() => cp.textContent = t("gen.copyShortLink"), 1500);
            } catch { cp.textContent = t("gen.copyFailed"); }
          });
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
        // Migrate short links stored from earlier localhost sessions: their QR
        // pointed at "localhost:3000", which phones can't reach (nothing was
        // counted). Re-point them at this machine's LAN address so the stored
        // list — and any QR regenerated from it — works from a phone.
        try {
          if (res.lanIp) {
            const list = loadDynamicCodes();
            let changed = false;
            for (const c of list) {
              if (c && c.shortUrl && /\/\/(localhost|127\.0\.0\.1)(:3000)?\//i.test(c.shortUrl)) {
                try {
                  const u = new URL(c.shortUrl);
                  u.host = res.lanIp + ":3000";
                  c.shortUrl = u.toString().replace(/\/$/, "");
                  changed = true;
                } catch { /* keep old */ }
              }
            }
            if (changed) { saveDynamicCodes(list); if (window.__kuiqrRefreshStatsList) window.__kuiqrRefreshStatsList(); }
          }
        } catch { /* best effort */ }
        setLocalStatus(
          t("set.dynamicLocalRunning", { url: res.url }) +
          (res.lanIp ? `<div class="dyn-note">${t("set.dynamicLocalLanNote", { url: escapeHtml(res.url) })}</div>` : ""),
          false
        );
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
        // Same VCALENDAR envelope as the single-event builder (RFC 5545).
        const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kuiqr//EN", "BEGIN:VEVENT"];
        const s = toICal(col("start")), e2 = toICal(col("end"));
        if (s) lines.push("DTSTART:" + s);
        if (e2) lines.push("DTEND:" + e2);
        const sum = col("summary").trim(); if (sum) lines.push("SUMMARY:" + escV(sum));
        const loc = col("location").trim(); if (loc) lines.push("LOCATION:" + escV(loc));
        lines.push("END:VEVENT", "END:VCALENDAR");
        return lines.join("\r\n");
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
      { name: "event", content: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Kuiqr//EN\r\nBEGIN:VEVENT\r\nDTSTART:20260827T140000\r\nDTEND:20260827T150000\r\nSUMMARY:Meeting\r\nLOCATION:Office\r\nEND:VEVENT\r\nEND:VCALENDAR" },
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
        expected: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Kuiqr//EN\r\nBEGIN:VEVENT\r\nDTSTART:20260827T140000\r\nDTEND:20260827T150000\r\nSUMMARY:Meeting\r\nLOCATION:Office\r\nEND:VEVENT\r\nEND:VCALENDAR" },
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

  // ── Export format segmented control (PNG / SVG / PDF) ──────────────────────
  // Show only the options for the selected format. PNG/SVG/PDF each reveal their
  // own settings; the PDF caption lives only inside the PDF block so it can never
  // be confused with a global caption.
  function setupExportFormat() {
    const seg = $("export-format");
    if (!seg) return;
    const opts = { png: $("png-options"), svg: $("svg-options"), pdf: $("pdf-options") };
    const btns = Array.from(seg.querySelectorAll(".seg-btn"));
    function setFmt(fmt) {
      btns.forEach((b) => b.classList.toggle("active", b.dataset.format === fmt));
      Object.keys(opts).forEach((k) => { if (opts[k]) opts[k].classList.toggle("hidden", k !== fmt); });
      updateExportMeta();
    }
    btns.forEach((b) => b.addEventListener("click", () => setFmt(b.dataset.format)));
    setFmt("png");
  }

  // ── Collapsible panels (Style / Export) ────────────────────────────────────
  // Both panels start collapsed; the collapsed state itself is remembered so a
  // user who always expands Style doesn't have to re-expand every launch.
  function setupCollapsiblePanels() {
    const panels = [
      { toggle: "style-toggle", body: "style-body", panel: "style-panel", store: "kuiqr.genpanel.style" },
    ];
    for (const p of panels) {
      const toggle = $(p.toggle), body = $(p.body);
      if (!toggle || !body) continue;
      let open = false;
      try { open = localStorage.getItem(p.store) === "open"; } catch { /* ignore */ }
      setPanel(open);
      toggle.addEventListener("click", () => setPanel(!body.classList.contains("open")));
      function setPanel(v) {
        body.classList.toggle("open", v);
        toggle.setAttribute("aria-expanded", v ? "true" : "false");
        toggle.parentElement.classList.toggle("collapsed", !v);
        try { localStorage.setItem(p.store, v ? "open" : "closed"); } catch { /* ignore */ }
      }
    }
  }

  // ── Reset styling to defaults ──────────────────────────────────────────────
  function resetStyle() {
    state.styling = {
      fg: "#000000", bg: "#ffffff",
      ecc: "M",
      dotStyle: "square",
      finderColor: "#000000",
      finderDotColor: "#000000",
      quietModules: 4,
    };
    state.logo = null;
    saveStyling();
    applyStylingControls();
    onLogoChange();   // clears ECC lock + note when logo is removed
    updateContrastWarning();
    render();
  }

  // ── Smart default (psychology: reduce decision fatigue) ────────────────────
  // Seed the empty text field with a sensible sample on first open so the user
  // immediately sees a working QR instead of a blank form. We auto-seed only
  // until the user has explicitly cleared it once (then we respect the blank).
  function maybeSeedDefault() {
    const cleared = (() => { try { return localStorage.getItem("kuiqr.genSampleCleared") === "1"; } catch { return false; } })();
    const cur = state.values.text && state.values.text.text;
    if (cleared || cur) return;
    state.values.text = { text: SAMPLE_DEFAULT };
    const inp = $("gen-input");
    if (inp) inp.value = SAMPLE_DEFAULT;
  }

  // ── Outcome info on primary actions (psychology: show the result before the act) ──
  // "Download PNG · 1024×1024" turns "what do I do?" into "does this look right?".
  function setBtnMeta(id, txt) {
    const el = $(id);
    if (el) el.textContent = txt ? " · " + txt : "";
  }
  function updateExportMeta() {
    const png = parseInt(($("png-preset") || {}).value || "1024", 10);
    const svg = parseInt(($("svg-edge") || {}).value || "1024", 10);
    const pdf = ($("pdf-preset") || {}).value || "30mm";
    const pdfLabels = { "30mm": "30×30mm", "50mm": "50×50mm", "80mm": "80×80mm", "card": "90×50mm" };
    // Contrast effect (UX Peak): never show a size in isolation — anchor it to the
    // maximum so the chosen size reads as the reasonable, modest option (after
    // seeing 2048, 1024 feels like "less than half", not "small").
    const PNG_MAX = 2048, SVG_MAX = 2048, PDF_MAX = "90×50mm";
    setBtnMeta("gen-download-meta", png + "×" + png + " · max " + PNG_MAX);
    setBtnMeta("gen-export-svg-meta", svg + "px · max " + SVG_MAX);
    setBtnMeta("gen-export-pdf-meta", (pdfLabels[pdf] || pdf) + " · max " + PDF_MAX);
  }

  // ── Public init ────────────────────────────────────────────────────────────
  function init() {
    loadStyling();
    // Collapsible Style / Export panels (collapsed by default so the preview
    // is visible immediately after entering content).
    setupCollapsiblePanels();
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
    if ($("gen-input")) $("gen-input").addEventListener("input", () => {
      const v = $("gen-input").value;
      state.values.text = { text: v };
      // Remember an explicit clear so we don't re-seed the sample next launch.
      try { if (!v.trim()) localStorage.setItem("kuiqr.genSampleCleared", "1"); else localStorage.removeItem("kuiqr.genSampleCleared"); } catch {}
      state.external = null; render();
    });

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
    // Reset style button
    if ($("style-reset")) $("style-reset").addEventListener("click", resetStyle);

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

    // Outcome info on primary export actions: show the resolved size before the
    // user acts (psychology: "Download PNG · 1024×1024" removes decision anxiety).
    // Recompute on preset change and on language switch.
    if ($("png-preset")) $("png-preset").addEventListener("change", updateExportMeta);
    if ($("svg-edge")) $("svg-edge").addEventListener("change", updateExportMeta);
    if ($("pdf-preset")) $("pdf-preset").addEventListener("change", updateExportMeta);
    window.addEventListener("kuiqr:localize", updateExportMeta);
    updateExportMeta();

    maybeSeedDefault();
    renderTemplateForm();
    setupExportFormat();
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
