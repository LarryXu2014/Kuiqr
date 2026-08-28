#!/usr/bin/env python3
"""Kuiqr release publisher — creates/updates the GitHub release for a tag and
uploads local assets (macOS dmg/zip/pkg, extension zips).

Draft-race safe (2026-08-28 gotcha): CI `gh release create --draft` and this
script used to create two releases for the same tag because
`GET /releases/tags/{tag}` cannot see drafts. This script therefore:
  1. Lists ALL releases (drafts included) and matches on tag_name.
  2. Reuses the CI draft if found — publishing it — instead of creating a new one.
  3. Deletes duplicate releases for the same tag after merging assets.

Usage:
  python3 scripts/publish_release.py <version>      # e.g. 2.4.2.3.11
  python3 scripts/publish_release.py <version> --dry-run

Requires: curl with SOCKS5 proxy at 127.0.0.1:10808 (or edit PROXY/--noproxy),
GitHub token from `security find-internet-password -s github.com -w` (macOS),
built artifacts in desktop-app/dist/ and releases/.
"""
import json, os, subprocess, sys, tempfile, time, urllib.parse

VERSION = sys.argv[1] if len(sys.argv) > 1 else ""
DRY = "--dry-run" in sys.argv
if not VERSION:
    print(__doc__); sys.exit(2)
TAG = f"v{VERSION}"
REPO = "LarryXu2014/Kuiqr"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "desktop-app", "dist")
REL = os.path.join(ROOT, "releases")
API = "https://api.github.com"
UPLOAD = "https://uploads.github.com"
PROXY = "127.0.0.1:10808"

ASSETS = [
    (f"Kuiqr-{VERSION}-mac-arm64.dmg", "application/x-apple-diskimage", DIST),
    (f"Kuiqr-{VERSION}-mac-arm64.zip", "application/zip", DIST),
    (f"Kuiqr-{VERSION}-mac-arm64.pkg", "application/octet-stream", DIST),
    (f"Kuiqr-{VERSION}-mac-x64.dmg", "application/x-apple-diskimage", DIST),
    (f"Kuiqr-{VERSION}-mac-x64.zip", "application/zip", DIST),
    (f"Kuiqr-{VERSION}-mac-x64.pkg", "application/octet-stream", DIST),
    (f"kuiqr-extension-{VERSION}.zip", "application/zip", REL),
    (f"kuiqr-firefox-{VERSION}.zip", "application/zip", REL),
]

BODY = f"""See [USER_GUIDE.md](https://github.com/{REPO}/blob/main/USER_GUIDE.md) for how to use every feature.

## Assets
- **macOS:** `.dmg`, `.zip`, `.pkg` for Apple Silicon (arm64) and Intel (x64)
- **Extensions:** `kuiqr-extension-{VERSION}.zip` (Chrome / Edge / Brave) and `kuiqr-firefox-{VERSION}.zip`
- **Windows & Linux:** built by CI and attached automatically (installer, portable, zip; AppImage + deb)
"""

def token():
    return subprocess.check_output(
        ["security", "find-internet-password", "-s", "github.com", "-w"]
    ).decode().strip()

def gh(method, path, data=None, timeout=120, tok=None):
    cmd = ["curl", "-sS", "--max-time", str(timeout), "--socks5-hostname", PROXY,
           "-X", method, API + path,
           "-H", "Authorization: Bearer " + (tok or token()),
           "-H", "Accept: application/vnd.github+json",
           "-H", "X-GitHub-Api-Version: 2022-11-28",
           "-H", "User-Agent: kuiqr-release"]
    tf = None
    if data is not None:
        payload = json.dumps(data).encode()
        tf = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        tf.write(payload); tf.close()
        cmd += ["--data-binary", "@" + tf.name]
    cmd += ["-w", "\n__HTTP__%{http_code}"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 30)
    finally:
        if tf:
            try: os.unlink(tf.name)
            except OSError: pass
    body, _, code = out.stdout.rpartition("__HTTP__")
    try:
        return code.strip(), (json.loads(body) if body.strip() else {})
    except json.JSONDecodeError:
        return code.strip(), body

def list_releases(tok=None):
    code, data = gh("GET", f"/repos/{REPO}/releases?per_page=100", timeout=60, tok=tok)
    if code != "200":
        raise RuntimeError(f"list releases failed: {code}")
    return [r for r in data if r.get("tag_name") == TAG]

def upload(rid, path, content_type, tok=None):
    name = os.path.basename(path)
    size = os.path.getsize(path)
    url = f"{UPLOAD}/repos/{REPO}/releases/{rid}/assets?name=" + urllib.parse.quote(name)
    timeout = 600 if size > 80_000_000 else 240
    cmd = ["curl", "-sS", "--max-time", str(timeout), "--socks5-hostname", PROXY,
           "-X", "POST", url,
           "-H", "Authorization: Bearer " + (tok or token()),
           "-H", "Accept: application/vnd.github+json",
           "-H", "X-GitHub-Api-Version: 2022-11-28",
           "-H", "User-Agent: kuiqr-release",
           "-H", f"Content-Type: {content_type}",
           "--data-binary", "@" + path,
           "-w", "\n__HTTP__%{http_code}"]
    for attempt in range(1, 4):
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 30)
            body, _, code = out.stdout.rpartition("__HTTP__")
            if code.strip() in ("200", "201"):
                j = json.loads(body)
                print(f"  OK: {j['browser_download_url']}", flush=True)
                return True
            print(f"  attempt {attempt} http={code.strip()} {body[:150]}", flush=True)
        except subprocess.TimeoutExpired:
            print(f"  attempt {attempt} timed out", flush=True)
        time.sleep(5)
    return False

def main():
    tok = token()
    rels = list_releases(tok)
    published = [r for r in rels if not r["draft"]]
    drafts = [r for r in rels if r["draft"]]

    if published:
        rel = published[0]
        print(f"Reusing published release id={rel['id']}", flush=True)
        # Merge assets from any duplicate drafts into the published release.
        for d in drafts:
            print(f"Merging draft {d['id']} assets...", flush=True)
            for a in d.get("assets", []):
                if any(x["name"] == a["name"] for x in rel.get("assets", [])):
                    continue  # published already has it
                if DRY:
                    print(f"  [dry-run] would merge asset {a['name']}", flush=True)
                    continue
                # Download then re-upload via API.
                dl = f"/repos/{REPO}/releases/assets/{a['id']}"
                cmd = ["curl", "-sS", "-L", "--max-time", "600", "--socks5-hostname", PROXY,
                       "-H", "Authorization: Bearer " + tok,
                       "-H", "Accept: application/octet-stream",
                       "-H", "X-GitHub-Api-Version: 2022-11-28",
                       "-H", "User-Agent: kuiqr-release",
                       API + dl, "--output", os.path.join(REL, a["name"])]
                subprocess.run(cmd, timeout=660)
                upload(rel["id"], os.path.join(REL, a["name"]), "application/octet-stream", tok)
            if DRY:
                print(f"  [dry-run] would delete draft {d['id']}", flush=True)
                continue
            gh("DELETE", f"/repos/{REPO}/releases/{d['id']}", tok=tok)
            print(f"  deleted draft {d['id']}", flush=True)
    elif drafts:
        # CI created a draft — publish it and reuse.
        rel = drafts[0]
        print(f"Publishing CI draft release id={rel['id']}", flush=True)
        if not DRY:
            code, data = gh("PATCH", f"/repos/{REPO}/releases/{rel['id']}",
                            {"draft": False, "make_latest": "true",
                             "name": f"Kuiqr {VERSION}", "body": BODY}, tok=tok)
            if code != "200":
                raise RuntimeError(f"publish draft failed: {code} {data}")
        for d in drafts[1:]:
            gh("DELETE", f"/repos/{REPO}/releases/{d['id']}", tok=tok)
    else:
        print("Creating published release...", flush=True)
        if DRY:
            rel = {"id": 0}
        else:
            code, data = gh("POST", f"/repos/{REPO}/releases",
                            {"tag_name": TAG, "name": f"Kuiqr {VERSION}", "body": BODY,
                             "draft": False, "prerelease": False, "make_latest": "true"}, tok=tok)
            if code not in ("200", "201"):
                raise RuntimeError(f"create failed: {code} {data}")
            rel = data

    rid = rel["id"]
    existing = {a["name"] for a in rel.get("assets", [])}
    failed = []
    for name, ctype, d in ASSETS:
        src = os.path.join(d, name)
        if not os.path.exists(src):
            print(f"SKIP (not found): {src}", flush=True)
            failed.append(name)
            continue
        if name in existing:
            print(f"SKIP (already uploaded): {name}", flush=True)
            continue
        print(f"Uploading {name} ({os.path.getsize(src)} bytes)...", flush=True)
        if not DRY and not upload(rid, src, ctype, tok):
            failed.append(name)

    if failed:
        print(f"=== DONE WITH FAILURES: {failed} ===", flush=True)
        sys.exit(1)
    print("=== DONE ===", flush=True)

if __name__ == "__main__":
    main()
