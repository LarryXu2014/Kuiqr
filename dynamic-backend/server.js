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
    // Dev mode: no key configured on the server — allow any or no key, but warn once.
    if (!checkKey._warned) {
      console.warn("[kuiqr-dynamic] WARNING: API_KEY is empty — API is open. Set API_KEY in production.");
      checkKey._warned = true;
    }
    return true;
  }
  const key = req.headers["x-api-key"] || (req.query && req.query.api_key) || "";
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
  const type = body.type === "text" ? "text" : "url";
  const expiresAt = Number.isFinite(body.expiresAt) ? Number(body.expiresAt) : null;
  const row = db.createCode(destination, type, body.note || null, expiresAt);
  return reply.code(201).send({
    code: row.code,
    type: row.type,
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

// Public lookup used by the Kuiqr app scanner. Returns the stored payload
// (and logs the scan) so the app can copy text or open URLs without forcing a
// 302 redirect.
app.get("/api/codes/:id/lookup", async (req, reply) => {
  const code = req.params.id;
  if (!/^[A-Za-z0-9_-]{3,}$/.test(code)) {
    return reply.code(404).send({ error: "invalid code" });
  }
  const row = db.getCodeByCode(code);
  if (!row) return reply.code(404).send({ error: "code not found" });
  if (!row.active) return reply.code(410).send({ error: "code disabled" });
  if (row.expires_at && Date.now() > row.expires_at) return reply.code(410).send({ error: "code expired" });

  const ip = analytics.getClientIp(req);
  const geo = analytics.resolveGeo(ip);
  const ua = analytics.parseUa(req.headers["user-agent"]);
  const day = analytics.todayStr();
  const visitorHash = analytics.visitorHash(ip, req.headers["user-agent"] || "", day);
  db.logClick(row.id, geo, ua, req.headers["referer"] || req.headers["referrer"] || null, visitorHash);

  return reply
    .code(200)
    .header("Cache-Control", "no-store, no-cache, must-revalidate")
    .send({
      code: row.code,
      type: row.type || "url",
      destination: row.destination,
      createdAt: row.created_at,
    });
});

// Friendly browser page for text payloads. Visitors who scan a text trackable
// QR code see the text here and can copy it.
function textPage(text) {
  const escaped = String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Text — Kuiqr</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px 36px; max-width: 520px; width: 100%; text-align: center; }
  .qr { font-size: 40px; line-height: 1; margin-bottom: 12px; }
  h1 { font-size: 20px; margin: 0 0 16px; }
  .payload { font-size: 16px; line-height: 1.6; background: #f1f5f9; border-radius: 12px; padding: 18px; word-break: break-word; text-align: left; margin: 0 0 18px; }
  button { background: #4f46e5; color: #fff; border: none; border-radius: 10px; padding: 12px 22px; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:hover { background: #4338ca; }
  .brand { margin-top: 18px; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="card">
    <div class="qr">⬜&nbsp;<span style="opacity:.25">⬜</span></div>
    <h1>This QR contains text</h1>
    <pre class="payload" id="payload">${escaped}</pre>
    <button id="copy">Copy text</button>
    <div class="brand">Kuiqr dynamic QR</div>
  </div>
  <script>
    document.getElementById("copy").addEventListener("click", function () {
      const t = document.getElementById("payload").textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { document.getElementById("copy").textContent = "Copied!"; });
    });
  </script>
</body>
</html>`;
}

// Friendly browser page for dead/expired/unknown short links. Visitors who scan
// a QR code whose code no longer exists shouldn't be shown raw JSON.
function friendlyPage(title, heading, message) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px 36px; max-width: 420px; text-align: center; }
  .qr { font-size: 40px; line-height: 1; margin-bottom: 12px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { font-size: 14px; color: #64748b; margin: 0 0 4px; line-height: 1.5; }
  .brand { margin-top: 16px; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="card">
    <div class="qr">⬜&nbsp;<span style="opacity:.25">⬜</span></div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <div class="brand">Kuiqr dynamic QR</div>
  </div>
</body>
</html>`;
}

// Catch-all redirect. Registered last so it doesn't shadow the /api/* routes.
app.get("/:code", async (req, reply) => {
  const code = req.params.code;
  if (!/^[A-Za-z0-9_-]{3,}$/.test(code)) {
    return reply.code(404).type("text/html; charset=utf-8").send(
      friendlyPage("Link not found — Kuiqr", "This link doesn't exist", "The QR code points to a short link that isn't valid. It may have been mistyped, or the QR code was not created by this service.")
    );
  }
  const row = db.getCodeByCode(code);
  if (!row) {
    return reply.code(404).type("text/html; charset=utf-8").send(
      friendlyPage("Link not found — Kuiqr", "This link doesn't exist (anymore)", "The short link was not found on this server. It may have been deleted, or the QR code was created on a different device/backend.")
    );
  }
  if (!row.active) {
    return reply.code(410).type("text/html; charset=utf-8").send(
      friendlyPage("Link disabled — Kuiqr", "This link was turned off", "Whoever created this QR code disabled the short link. Ask them for a new one.")
    );
  }
  if (row.expires_at && Date.now() > row.expires_at) {
    return reply.code(410).type("text/html; charset=utf-8").send(
      friendlyPage("Link expired — Kuiqr", "This link expired", "The short link had an expiry date which has passed. Ask whoever created the QR code for a fresh one.")
    );
  }

  const ip = analytics.getClientIp(req);
  const geo = analytics.resolveGeo(ip);
  const ua = analytics.parseUa(req.headers["user-agent"]);
  const day = analytics.todayStr();
  const visitorHash = analytics.visitorHash(ip, req.headers["user-agent"] || "", day);
  db.logClick(row.id, geo, ua, req.headers["referer"] || req.headers["referrer"] || null, visitorHash);

  // Text payloads are shown in a friendly page instead of redirecting.
  if (row.type === "text") {
    return reply
      .code(200)
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "no-store, no-cache, must-revalidate")
      .send(textPage(row.destination));
  }

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
