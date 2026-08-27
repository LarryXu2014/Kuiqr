// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// SQLite data layer. Stores codes + click events. Raw IPs are NEVER written
// to the database (only derived geo + a hashed visitor pseudo-ID).
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("./config");

function openDb() {
  const dbPath = config.DB_PATH;
  if (dbPath !== ":memory:") {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS codes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      code       TEXT UNIQUE NOT NULL,
      destination TEXT NOT NULL,
      note       TEXT,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      expires_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS clicks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      code_id      INTEGER NOT NULL,
      ts           INTEGER NOT NULL,
      country      TEXT,
      region       TEXT,
      city         TEXT,
      device       TEXT,
      os           TEXT,
      browser      TEXT,
      referrer     TEXT,
      visitor_hash TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_clicks_code_ts ON clicks(code_id, ts);
    CREATE INDEX IF NOT EXISTS idx_clicks_hash    ON clicks(visitor_hash);
    CREATE INDEX IF NOT EXISTS idx_codes_code      ON codes(code);
  `);
  return db;
}

const database = openDb();

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomCode(len) {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

function getCodeByCode(code) {
  return database.prepare("SELECT * FROM codes WHERE code = ?").get(code) || null;
}

function createCode(destination, note, expiresAt) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomCode(config.CODE_LENGTH);
    try {
      database
        .prepare(
          "INSERT INTO codes (code, destination, note, active, created_at, expires_at) VALUES (?, ?, ?, 1, ?, ?)"
        )
        .run(code, destination, note || null, Date.now(), expiresAt || null);
      return getCodeByCode(code);
    } catch (e) {
      if (String(e.message || "").includes("UNIQUE")) continue;
      throw e;
    }
  }
  throw new Error("failed to generate a unique short code");
}

function logClick(codeId, geo, ua, referrer, visitorHash) {
  database
    .prepare(
      `INSERT INTO clicks (code_id, ts, country, region, city, device, os, browser, referrer, visitor_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      codeId,
      Date.now(),
      geo.country || null,
      geo.region || null,
      geo.city || null,
      ua.device || null,
      ua.os || null,
      ua.browser || null,
      referrer || null,
      visitorHash || null
    );
}

function getStats(code) {
  const row = getCodeByCode(code);
  if (!row) return null;
  const total = database.prepare("SELECT COUNT(*) c FROM clicks WHERE code_id = ?").get(row.id).c;
  const unique = database
    .prepare("SELECT COUNT(DISTINCT visitor_hash) c FROM clicks WHERE code_id = ?")
    .get(row.id).c;
  const byDay = database
    .prepare(
      `SELECT date(ts/1000, 'unixepoch') AS day,
              COUNT(*) AS total,
              COUNT(DISTINCT visitor_hash) AS unique_scans
       FROM clicks WHERE code_id = ?
       GROUP BY day ORDER BY day DESC LIMIT 30`
    )
    .all(row.id);
  const byCountry = database
    .prepare(
      `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS total
       FROM clicks WHERE code_id = ? GROUP BY country ORDER BY total DESC LIMIT 20`
    )
    .all(row.id);
  const byDevice = database
    .prepare(
      `SELECT COALESCE(device, 'Unknown') AS device, COUNT(*) AS total
       FROM clicks WHERE code_id = ? GROUP BY device ORDER BY total DESC`
    )
    .all(row.id);
  return {
    code,
    shortUrl: `${config.BASE_URL}/${code}`,
    destination: row.destination,
    createdAt: row.created_at,
    total,
    unique,
    byDay,
    byCountry,
    byDevice,
  };
}

function listCodes() {
  return database
    .prepare("SELECT code, destination, note, active, created_at, expires_at FROM codes ORDER BY created_at DESC LIMIT 100")
    .all();
}

module.exports = {
  database,
  getCodeByCode,
  createCode,
  logClick,
  getStats,
  listCodes,
};
