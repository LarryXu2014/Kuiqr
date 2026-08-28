// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// ============================================================
// QR payload classification + parsing (renderer side).
//
// A scanned QR string is more than "text" or "URL": WIFI invites you to join a
// network, a vCard holds a contact, geo: opens a location, tel:/sms:/mailto:
// start a conversation, BEGIN:VEVENT is a calendar invite. This module detects
// those payloads so the scan result UI can offer REAL actions (connect to Wi-Fi,
// add to Contacts, show in Maps…) exactly like the iPhone camera does — instead
// of dumping the raw string on the clipboard.
//
// All parsers are defensive: a QR may be truncated, malformed or adversarial.
// Nothing here executes anything; it only describes the payload.
// ============================================================
(function () {
  "use strict";

  // Unescape a WIFI: value: backslash-escaped \ ; , " :
  function unescWifi(s) {
    return String(s == null ? "" : s).replace(/\\(.)/g, "$1");
  }

  // Parse `WIFI:T:WPA;S:My Net;P:pass\,word;H:true;;` (also handles CRLF payloads).
  // Returns { type:"wifi", ssid, password, security, hidden } or null.
  function parseWifi(text) {
    const m = /^WIFI:(.*)$/is.exec(text.trim());
    if (!m) return null;
    const body = m[1];
    const fields = {};
    // Split on unescaped ';' only.
    const parts = body.split(/(?<!\\);/);
    for (const part of parts) {
      const i = part.indexOf(":");
      if (i <= 0) continue;
      const k = part.slice(0, i).trim().toUpperCase();
      const v = unescWifi(part.slice(i + 1));
      if (!fields[k]) fields[k] = v; // first occurrence wins (spec behavior)
    }
    if (!fields.S) return null; // SSID is mandatory
    const security = (fields.T || "nopass").toUpperCase();
    if (!["WPA", "WEP", "NOPASS", "WPA2-EAP", "SAE"].includes(security)) return null;
    return {
      type: "wifi",
      ssid: fields.S,
      password: fields.P || "",
      security: security === "SAE" ? "WPA" : security, // WPA3 → treat as WPA for joining
      hidden: /^true$/i.test(fields.H || ""),
    };
  }

  // Parse a vCard (2.1/3.0/4.0) far enough to show a friendly name + a full
  // vCard body for export. Returns { type:"vcard", name, org, phone, email, raw }
  // or null when the payload isn't a vCard at all.
  function parseVcard(text) {
    const t = text.trim();
    if (!/^BEGIN:VCARD/im.test(t) || !/END:VCARD\s*$/i.test(t)) return null;
    // Unfold continuation lines (RFC 6350: CRLF + space/tab).
    const unfolded = t.replace(/\r?\n[ \t]/g, "").replace(/\r/g, "");
    const lines = unfolded.split("\n");
    const get = (prop) => {
      const re = new RegExp("^" + prop + "(?=[;:])[^:]*:(.*)$", "i");
      for (const line of lines) {
        const m = re.exec(line.trim());
        if (m) return m[1].trim();
      }
      return "";
    };
    let name = get("FN");
    if (!name) {
      // Fallback: assemble from N:Last;First;Middle;Prefix;Suffix
      const n = get("N").split(";").map((s) => s.trim());
      name = [n[3], n[1], n[2]].filter(Boolean).join(" ") || n[0] || "";
    }
    return {
      type: "vcard",
      name: name || "Contact",
      org: get("ORG").split(";")[0] || "",
      phone: get("TEL") || "",
      email: get("EMAIL") || "",
      raw: t,
    };
  }

  // Parse `geo:37.7749,-122.4194` (optionally `;crs=…;u=…` or `,zoom` suffix).
  function parseGeo(text) {
    const m = /^geo:([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)(?:[,;].*)?$/i.exec(text.trim());
    if (!m) return null;
    return { type: "geo", lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  }

  // Parse `BEGIN:VEVENT` blocks → keep the whole body (exported as .ics).
  function parseEvent(text) {
    const t = text.trim();
    if (!/^BEGIN:VEVENT/im.test(t)) return null;
    const unfolded = t.replace(/\r?\n[ \t]/g, "").replace(/\r/g, "");
    const lines = unfolded.split("\n");
    const get = (prop) => {
      const re = new RegExp("^" + prop + "(?=[;:])[^:]*:(.*)$", "i");
      for (const line of lines) {
        const m = re.exec(line.trim());
        if (m) return m[1].trim();
      }
      return "";
    };
    return { type: "event", title: get("SUMMARY") || "Event", raw: t };
  }

  // Classify any decoded QR string. Order matters: WIFI/vCard/geo/event are
  // strict prefixes or blocks, so they win over the generic URL/text classes.
  // Returns one of:
  //   { type: "url"|"text", text }
  //   { type: "wifi", ssid, password, security, hidden }
  //   { type: "vcard", name, org, phone, email, raw }
  //   { type: "event", title, raw }
  //   { type: "geo", lat, lon }
  //   { type: "tel"|"sms"|"mailto", value, body? }
  function classify(text) {
    const t = String(text || "").trim();
    if (!t) return { type: "text", text: "" };

    const wifi = parseWifi(t);
    if (wifi) return wifi;

    if (/^BEGIN:VCARD/im.test(t)) return parseVcard(t) || { type: "text", text: t };
    // Calendar QR codes: RFC 5545 payloads are wrapped in BEGIN:VCALENDAR
    // (what iOS/Android cameras emit and expect); older Kuiqr codes and some
    // third-party generators emit a bare BEGIN:VEVENT block. Accept both —
    // parseEvent() keeps the whole raw body for the .ics export.
    if (/^BEGIN:VEVENT/im.test(t) || /^BEGIN:VCALENDAR/im.test(t)) {
      return parseEvent(t) || { type: "text", text: t };
    }

    if (/^geo:/i.test(t)) return parseGeo(t) || { type: "text", text: t };

    if (/^tel:/i.test(t)) return { type: "tel", value: t.replace(/^tel:/i, "").replace(/\s+/g, "") };
    if (/^smsto:/i.test(t)) {
      const rest = t.replace(/^smsto:/i, "");
      const i = rest.indexOf(":");
      return i >= 0
        ? { type: "sms", value: rest.slice(0, i), body: rest.slice(i + 1) }
        : { type: "sms", value: rest, body: "" };
    }
    if (/^sms:/i.test(t)) {
      const rest = t.replace(/^sms:/i, "");
      const i = rest.indexOf(":");
      return i >= 0
        ? { type: "sms", value: rest.slice(0, i).replace(/\s+/g, ""), body: unescWifi(rest.slice(i + 1)) }
        : { type: "sms", value: rest.replace(/\s+/g, ""), body: "" };
    }
    if (/^mailto:/i.test(t)) {
      const rest = t.replace(/^mailto:/i, "");
      const i = rest.indexOf("?");
      let value = i >= 0 ? rest.slice(0, i) : rest;
      let body = "";
      if (i >= 0) {
        const q = new URLSearchParams(rest.slice(i + 1));
        body = q.get("body") || "";
        const subj = q.get("subject");
        if (subj) body = subj + (body ? "\n\n" + body : "");
      }
      return { type: "mailto", value: decodeURIComponent(value), body };
    }

    if (/^(https?:\/\/|www\.)/i.test(t)) return { type: "url", text: t };
    return { type: "text", text: t };
  }

  // Friendly one-line summary shown under the badge (before the raw payload).
  function summarize(p) {
    switch (p.type) {
      case "wifi": return p.ssid + (p.security === "nopass" ? " — open network" : " — " + p.security);
      case "vcard": return p.name + (p.org ? " · " + p.org : "");
      case "event": return p.title;
      case "geo": return p.lat.toFixed(5) + ", " + p.lon.toFixed(5);
      case "tel": return p.value;
      case "sms": return p.value;
      case "mailto": return p.value;
      default: return "";
    }
  }

  // Expose as window.QRPayload. Kept renderer-global so the UI smoke suite can
  // drive it without a preload bridge.
  window.QRPayload = { classify, summarize, parseWifi, parseVcard, parseGeo, parseEvent };
})();
