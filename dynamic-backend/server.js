// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// Kuiqr dynamic QR redirect + analytics service.
//
//   GET  /:code                      -> 302 redirect to the stored destination (+ logs the click)
//   POST /api/codes                  -> create a short code (x-api-key required)
//   GET  /api/codes                  -> list codes (x-api-key required)
//   GET  /api/codes/:id/stats        -> scan analytics (x-api-key required, unless PUBLIC_STATS=true)
//   GET  /health                     -> liveness probe
//
// GDPR: raw IPs are never persisted. We keep only derived geo data and a hashed
// visitor pseudo-ID (ip + user-agent + day) so we can count unique scans.
const Fastify = require("fastify");
const config = require("./src/config");
const db = require("./src/db");
const analytics = require("./src/analytics");

const app = Fastify({ logger: true });

// Shared API-key guard. Returns false (and sends 401) when the request is denied.
function checkKey(req, reply) {
  if (!config.API_KEY) {
    // Dev mode: no key configured on the server — allow, but warn once.
    if (!checkKey._warned) {
      console.warn("[kuiqr-dynamic] WARNING: API_KEY is empty — API is open. Set API_KEY in production.");
      checkKey._warned = true;
    }
    return true;
  }
  const key = req.headers["x-api-key"] || (req.query && req.query.api_key);
  if (key !== config.API_KEY) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

app.get("/health", async () => ({ ok: true, ts: Date.now() }));

app.get("/", async () => ({
  service: "kuiqr-dynamic",
  status: "ok",
  endpoints: {
    redirect: "GET /:code",
    create: "POST /api/codes",
    list: "GET /api/codes",
    stats: "GET /api/codes/:id/stats",
  },
}));

app.post("/api/codes", async (req, reply) => {
  if (!checkKey(req, reply)) return;
  const body = req.body || {};
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!destination) {
    return reply.code(400).send({ error: "destination is required" });
  }
  const expiresAt = Number.isFinite(body.expiresAt) ? Number(body.expiresAt) : null;
  const row = db.createCode(destination, body.note || null, expiresAt);
  return reply.code(201).send({
    code: row.code,
    shortUrl: `${config.BASE_URL}/${row.code}`,
    destination: row.destination,
    createdAt: row.created_at,
  });
});

app.get("/api/codes", async (req, reply) => {
  if (!checkKey(req, reply)) return;
  return { codes: db.listCodes() };
});

app.get("/api/codes/:id/stats", async (req, reply) => {
  if (!config.PUBLIC_STATS && !checkKey(req, reply)) return;
  const stats = db.getStats(req.params.id);
  if (!stats) return reply.code(404).send({ error: "code not found" });
  return stats;
});

// Catch-all redirect. Registered last so it doesn't shadow the /api/* routes.
app.get("/:code", async (req, reply) => {
  const code = req.params.code;
  if (!/^[A-Za-z0-9_-]{3,}$/.test(code)) {
    return reply.code(404).send({ error: "not found" });
  }
  const row = db.getCodeByCode(code);
  if (!row) return reply.code(404).send({ error: "not found" });
  if (!row.active) return reply.code(410).send({ error: "link disabled" });
  if (row.expires_at && Date.now() > row.expires_at) {
    return reply.code(410).send({ error: "link expired" });
  }

  const ip = analytics.getClientIp(req);
  const geo = analytics.resolveGeo(ip);
  const ua = analytics.parseUa(req.headers["user-agent"]);
  const day = analytics.todayStr();
  const visitorHash = analytics.visitorHash(ip, req.headers["user-agent"] || "", day);
  db.logClick(row.id, geo, ua, req.headers["referer"] || req.headers["referrer"] || null, visitorHash);

  // No-store so each scan is always logged (browsers must not cache the redirect).
  return reply
    .code(302)
    .header("Location", row.destination)
    .header("Cache-Control", "no-store, no-cache, must-revalidate")
    .send();
});

app.listen({ port: config.PORT, host: config.HOST }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  if (!config.API_KEY) {
    console.warn("[kuiqr-dynamic] WARNING: API_KEY is empty — the API is open to everyone.");
  }
  console.log(`[kuiqr-dynamic] listening on ${config.HOST}:${config.PORT}  (BASE_URL=${config.BASE_URL})`);
});
