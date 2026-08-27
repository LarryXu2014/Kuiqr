# Kuiqr Dynamic QR — Redirect + Analytics Service

A small, self-hosted backend that turns a static QR code into a **trackable** one.

- The QR encodes a short redirect URL (`https://qr.yourdomain.com/abc123`) instead of the
  final destination.
- When someone scans it, their phone hits this server, the hit is logged, and they are
  `302`-redirected to the real destination.
- Analytics = reading those logs: total vs unique scans, scans per day, by country, by device.

```
phone scans QR ──▶ GET /abc123 ──▶ log click ──▶ 302 ──▶ real destination
                                  ▲
                          Kuiqr app creates codes via  POST /api/codes
                          Kuiqr app reads stats  via  GET  /api/codes/:id/stats
```

## Features

- **Fastify** HTTP server, **SQLite** (better-sqlite3) storage — single file, zero external services.
- **Geo** resolution via `geoip-lite` (bundled offline GeoLite2 DB; no per-request cost).
- **User-Agent** parsing (phone / desktop / tablet, OS, browser) via `ua-parser-js`.
- **Unique vs total** scans via a hashed visitor pseudo-ID (`sha256(ip + ua + day)`).
- **GDPR-conscious**: the raw IP is **never persisted** — only derived geo + the hash are stored.
- **API-key** auth on the write/stats API (`x-api-key` header).

## Quick start

```bash
cd dynamic-backend
npm install
cp .env.example .env        # then edit BASE_URL + API_KEY
npm start                   # listens on PORT (default 3000)
```

Smoke test:

```bash
npm test                    # boots on :3100 with an in-memory DB and curls the endpoints
```

## API

### `POST /api/codes`  (requires `x-api-key`)
```jsonc
{ "destination": "https://example.com", "note": "optional", "expiresAt": 1735689600000 }
```
```jsonc
// 201
{ "code": "aZ3k9xQ", "shortUrl": "https://qr.yourdomain.com/aZ3k9xQ",
  "destination": "https://example.com", "createdAt": 1724764800000 }
```

### `GET /api/codes/:id/stats`  (requires `x-api-key`, or `PUBLIC_STATS=true`)
```jsonc
{ "code": "aZ3k9xQ", "destination": "https://example.com",
  "total": 12, "unique": 9,
  "byDay":     [{ "day": "2026-08-27", "total": 5, "unique_scans": 4 }],
  "byCountry": [{ "country": "US", "total": 7 }, { "country": "CN", "total": 5 }],
  "byDevice":  [{ "device": "phone", "total": 10 }, { "device": "desktop", "total": 2 }] }
```

### `GET /:code`  → `302` to the stored destination (logs the click)
### `GET /health` → `{ "ok": true }`

## Deployment

### Option A — Node host (recommended for full control)
1. `npm install --omit=dev` on the server.
2. Run behind a reverse proxy (nginx/Caddy) with TLS, forwarding to `localhost:3000`.
   The proxy must forward the real client IP (`X-Forwarded-For`) so geo works.
3. Keep `BASE_URL` pointing at your public host and persist `./data/qr.db`
   (mount a volume / use a systemd unit + a weekly backup).
4. Use a process manager (`pm2` / systemd) so it restarts on crash.

nginx snippet (IP forwarding for geo):
```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Real-IP $remote_addr;
}
```

### Option B — Docker
```bash
docker build -t kuiqr-dynamic .
docker run -d -p 3000:3000 \
  -e BASE_URL=https://qr.yourdomain.com \
  -e API_KEY="$(openssl rand -hex 32)" \
  -v kuiqr-data:/app/data \
  kuiqr-dynamic
```

### Option C — Cloudflare Workers (serverless, free tier)
Workers give you `request.cf.country` / `request.cf.city` for **free** (no GeoIP DB needed)
and generous free traffic. The catch: no built-in SQLite. Pair the Worker with:
- **Workers KV** or **D1** (SQLite-at-edge) for code storage + click counts, **or**
- Keep this Node service behind the Worker as the origin (Worker does geo + cache, origin logs).

A Worker that just redirects + writes to KV/D1 is ~40 lines; the `geoip-lite` + SQLite
approach here is the fastest path to "working locally today."

## Keeping the GeoIP database fresh
`geoip-lite` ships with a snapshot DB that works out of the box. To refresh it (better
accuracy), run `npm exec geoip-lite-update` (needs a free MaxMind account/license key).

## Privacy / GDPR notes
- This is a **public tracking service** once deployed, so treat IPs as PII.
- The raw IP is used only to compute geo + the visitor hash **in memory** and is discarded.
- Only `country/region/city`, device/OS/browser, referrer, and the hash are written to disk.
- If you need stricter retention, add a periodic `DELETE FROM clicks WHERE ts < ?` job.

## Kuiqr app integration
In the Kuiqr desktop app → **Settings → Dynamic QR**, enter your `BASE_URL` and `API_KEY`.
Then on the **Generate** tab, flip **Dynamic (trackable) QR** on: the app calls
`POST /api/codes`, encodes the returned `shortUrl` into the QR, and the **Stats** tab
fetches `GET /api/codes/:id/stats` for that code.
