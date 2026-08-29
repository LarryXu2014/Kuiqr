#!/usr/bin/env python3
"""Publish the Kuiqr desktop app (macOS artifacts) for a given version.

Reuses the published release for the tag when one already exists, and REPLACES
any stale asset with the same filename (delete-then-upload) so a rebuild of the
same version can never leave old binaries behind.

Usage:  python3 scripts/publish_app_only.py 2.4.2.5.1 [--dry-run]
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
API = "https://api.github.com"
UPLOAD = "https://uploads.github.com"
PROXY = "127.0.0.1:10808"

# The eight artifacts this script uploads directly (6 macOS + 2 extension).
# Windows and Linux artifacts are produced by GitHub Actions.
ASSETS = [
    (f"Kuiqr-{VERSION}-mac-arm64.dmg", "application/x-apple-diskimage"),
    (f"Kuiqr-{VERSION}-mac-arm64.zip", "application/zip"),
    (f"Kuiqr-{VERSION}-mac-arm64.pkg", "application/x-newton-compatible-pkg"),
    (f"Kuiqr-{VERSION}-mac-x64.dmg", "application/x-apple-diskimage"),
    (f"Kuiqr-{VERSION}-mac-x64.zip", "application/zip"),
    (f"Kuiqr-{VERSION}-mac-x64.pkg", "application/x-newton-compatible-pkg"),
    (f"kuiqr-extension-{VERSION}.zip", "application/zip"),
    (f"kuiqr-firefox-{VERSION}.zip", "application/zip"),
]

BODY = f"""## Kuiqr {VERSION}

### Highlights
- **Trackable QR for text** — trackable QR codes are no longer limited to URLs. Create a trackable code for any text (e.g. "I am Larry"); when someone scans it with Kuiqr the text is copied to their clipboard and the scan is recorded in Stats. Scanners that aren't Kuiqr see a simple page showing the text instead of being redirected.
- **"Run local backend" now works in packaged builds** — the dynamic backend ships as an app resource, so it no longer fails with "backend-not-found", and it is started directly with Node instead of relying on npm.
- **Backend data moved out of the app bundle** — the trackable-QR database and API key are stored in the app's userData folder, so they survive read-only installs and don't break code signing. Fresh installs no longer inherit a development database.
- **Backend starts without a system Node** — if `node` isn't installed, Kuiqr falls back to the bundled Electron runtime in Node mode.
- **Create Trackable QR auto-starts the backend** — if you click "Create trackable QR" before a backend is configured, the app starts the local backend automatically and creates the code. No need to open Settings first.
- **No more "first QR" celebration banners** — removed the one-time "you successfully generated/scanned your first QR code" hints.
- **Much smaller macOS installers** — unused GeoIP city databases (146 MB) are excluded; country stats still work. Installers drop from ~151 MB to ~107 MB.

### Assets
| File | For |
| --- | --- |
| `Kuiqr-{VERSION}-mac-arm64.dmg` | macOS, Apple Silicon (M1–M4) — disk image |
| `Kuiqr-{VERSION}-mac-arm64.zip` | macOS, Apple Silicon — portable app |
| `Kuiqr-{VERSION}-mac-arm64.pkg` | macOS, Apple Silicon — installer (unsigned) |
| `Kuiqr-{VERSION}-mac-x64.dmg` | macOS, Intel — disk image |
| `Kuiqr-{VERSION}-mac-x64.zip` | macOS, Intel — portable app |
| `Kuiqr-{VERSION}-mac-x64.pkg` | macOS, Intel — installer (unsigned) |
| `kuiqr-extension-{VERSION}.zip` | Chrome / Edge / Brave extension |
| `kuiqr-firefox-{VERSION}.zip` | Firefox extension (109+) |

Windows and Linux builds are produced by GitHub Actions and appear on this same release.

**First launch on macOS:** the app is not notarized, so run
`xattr -cr /Applications/Kuiqr.app` once, or right-click the app and choose Open.
Prefer the `.zip` or `.dmg` — the `.pkg` installers are unsigned and Gatekeeper will block them.

See the [User Guide](https://github.com/{REPO}/blob/main/USER_GUIDE.md) for how to use every feature.
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
        tf = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        tf.write(json.dumps(data).encode()); tf.close()
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


def list_releases(tok):
    code, data = gh("GET", f"/repos/{REPO}/releases?per_page=100", timeout=60, tok=tok)
    if code != "200":
        raise RuntimeError(f"list releases failed: {code} {data}")
    return [r for r in data if r.get("tag_name") == TAG]


def delete_asset(asset_id, name, tok):
    code, _ = gh("DELETE", f"/repos/{REPO}/releases/assets/{asset_id}", timeout=60, tok=tok)
    if code not in ("204", "200"):
        raise RuntimeError(f"delete {name} failed: {code}")
    print(f"  removed stale: {name}", flush=True)


def upload(rid, path, content_type, tok):
    name = os.path.basename(path)
    size = os.path.getsize(path)
    url = f"{UPLOAD}/repos/{REPO}/releases/{rid}/assets?name=" + urllib.parse.quote(name)
    timeout = 900 if size > 80_000_000 else 240
    cmd = ["curl", "-sS", "--max-time", str(timeout), "--socks5-hostname", PROXY,
           "-X", "POST", url,
           "-H", "Authorization: Bearer " + tok,
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
                print(f"  uploaded: {json.loads(body)['browser_download_url']}", flush=True)
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
    elif drafts:
        rel = drafts[0]
        print(f"Publishing draft release id={rel['id']}", flush=True)
        if not DRY:
            code, data = gh("PATCH", f"/repos/{REPO}/releases/{rel['id']}",
                            {"draft": False, "make_latest": "true",
                             "name": f"Kuiqr {VERSION}", "body": BODY}, tok=tok)
            if code != "200":
                raise RuntimeError(f"publish draft failed: {code} {data}")
    else:
        print("Creating release...", flush=True)
        if DRY:
            rel = {"id": 0, "assets": []}
        else:
            code, data = gh("POST", f"/repos/{REPO}/releases",
                            {"tag_name": TAG, "name": f"Kuiqr {VERSION}", "body": BODY,
                             "draft": False, "prerelease": False, "make_latest": "true"}, tok=tok)
            if code not in ("200", "201"):
                raise RuntimeError(f"create failed: {code} {data}")
            rel = data

    rid = rel["id"]
    existing = {a["name"]: a["id"] for a in rel.get("assets", [])}

    failed = []
    for name, ctype in ASSETS:
        src = os.path.join(DIST, name)
        if not os.path.exists(src):
            print(f"MISSING: {src}", flush=True)
            failed.append(name)
            continue
        # Replace semantics: a same-named asset from an earlier build of this
        # version must go first, otherwise the upload is rejected as a duplicate
        # and the release silently keeps the stale binary.
        if name in existing:
            if DRY:
                print(f"  would remove stale: {name}", flush=True)
            else:
                delete_asset(existing[name], name, tok)
        mb = round(os.path.getsize(src) / 1_000_000)
        print(f"Uploading {name} ({mb} MB)...", flush=True)
        if not DRY and not upload(rid, src, ctype, tok):
            failed.append(name)

    # Always (re)apply the title + description — a release reused from CI or from
    # an earlier build of this tag may still carry placeholder notes.
    if not DRY and rid:
        code, data = gh("PATCH", f"/repos/{REPO}/releases/{rid}",
                        {"name": f"Kuiqr {VERSION}", "body": BODY,
                         "make_latest": "true"}, tok=tok)
        if code != "200":
            raise RuntimeError(f"update release notes failed: {code} {data}")
        print("Release title + description updated.", flush=True)

    print(f"Release: https://github.com/{REPO}/releases/tag/{TAG}")
    if failed:
        print(f"=== DONE WITH FAILURES: {failed} ===", flush=True)
        sys.exit(1)
    print("=== DONE ===", flush=True)


if __name__ == "__main__":
    main()
