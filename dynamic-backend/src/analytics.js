// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// Analytics helpers: client IP extraction, geo resolution, User-Agent parsing,
// and a GDPR-friendly visitor pseudo-ID (raw IP is never persisted).
const geoip = require("geoip-lite");
const UAParser = require("ua-parser-js");
const crypto = require("crypto");

// Pull the real client IP whether we're behind a proxy or not.
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
}

// Resolve an IP to country/region/city. Returns nulls when unknown/offline.
function resolveGeo(ip) {
  try {
    const g = geoip.lookup(ip);
    if (!g) return { country: null, region: null, city: null };
    return {
      country: g.country || null,
      region: g.region || null,
      city: g.city || null,
    };
  } catch {
    return { country: null, region: null, city: null };
  }
}

// Parse a User-Agent into a normalized device type, OS, and browser name.
function parseUa(uaString) {
  const parser = new UAParser(uaString || "");
  const os = parser.getOS();
  const browser = parser.getBrowser();
  const device = parser.getDevice();
  let deviceType = device.type || "desktop";
  if (deviceType === "mobile") deviceType = "phone";
  return {
    device: deviceType,
    os: os.name || "Unknown",
    browser: browser.name || "Unknown",
  };
}

// Build a stable per-visitor pseudo-ID: hash(ip + ua + day).
// We hash so we can count "unique" scans without ever storing the raw IP.
function visitorHash(ip, ua, day) {
  return crypto
    .createHash("sha256")
    .update(`${ip}|${ua}|${day}`)
    .digest("hex");
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
}

module.exports = { getClientIp, resolveGeo, parseUa, visitorHash, todayStr };
