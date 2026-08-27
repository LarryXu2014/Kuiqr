// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// Server configuration, loaded from environment variables.
require("dotenv").config();

module.exports = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  HOST: process.env.HOST || "0.0.0.0",
  // Public base URL used to build the short link returned to clients.
  // Must match the host users will actually scan (e.g. https://qr.yourdomain.com).
  BASE_URL: (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  // Shared secret for the write/stats API. Send as `x-api-key` header.
  API_KEY: process.env.API_KEY || "",
  // SQLite file. Use ":memory:" for ephemeral/test runs.
  DB_PATH: process.env.DB_PATH || "./data/qr.db",
  // If "true", the stats endpoint is open to the world (no API key needed).
  PUBLIC_STATS: process.env.PUBLIC_STATS === "true",
  // Length of generated short codes (base62).
  CODE_LENGTH: parseInt(process.env.CODE_LENGTH || "7", 10),
};
