#!/usr/bin/env bash
# Local smoke test: boots the server on :3100 with an in-memory DB, then
# exercises the redirect + analytics endpoints with curl.
set -e
cd "$(dirname "$0")"

export PORT=3100
export API_KEY=testkey
export DB_PATH=:memory:
export BASE_URL=http://localhost:3100
export PUBLIC_STATS=false

node server.js &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

echo "Waiting for server..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3100/health >/dev/null 2>&1; then break; fi
  sleep 0.5
done

echo "== health =="
curl -s http://localhost:3100/health; echo

echo "== create code =="
CREATE=$(curl -s -X POST http://localhost:3100/api/codes \
  -H "x-api-key: testkey" \
  -H "Content-Type: application/json" \
  -d '{"destination":"https://example.com/hello","note":"smoke-test"}')
echo "$CREATE"
CODE=$(echo "$CREATE" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).code))")
echo "code=$CODE"

echo "== redirect (expect HTTP/1.1 302 + Location) =="
curl -s -D - -o /dev/null "http://localhost:3100/$CODE" | grep -iE "HTTP/|location"

echo "== second scan from a different IP/UA (still counts as 1 unique vs 2 total) =="
curl -s -o /dev/null -H "X-Forwarded-For: 8.8.8.8" -A "Mozilla/5.0 (iPhone)" "http://localhost:3100/$CODE"
curl -s "http://localhost:3100/api/codes/$CODE/stats" -H "x-api-key: testkey"; echo

echo "== unauthorized create (expect 401) =="
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3100/api/codes \
  -H "x-api-key: wrong" -H "Content-Type: application/json" -d '{}'

echo "== unknown code stats (expect 404) =="
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100/api/codes/nope/stats" -H "x-api-key: testkey"

echo "ALL GOOD"
