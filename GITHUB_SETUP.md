# GitHub Setup Guide

Your repo is already created at **https://github.com/LarryXu2014/Local-QR-Scan**

## Step 1: Push the Code

Open Terminal and run:

```bash
cd /path/to/qr-scanner

# Add your GitHub remote (already exists, or add it)
git remote set-url origin https://github.com/LarryXu2014/Local-QR-Scan.git

# Push everything
git push -u origin main --force
git push origin v2.1.0
```

> Use `--force` because your GitHub repo already has old files. This replaces them with the new v2.1.0 code.

## Step 2: Create a GitHub Release with Binaries

1. Go to https://github.com/LarryXu2014/Local-QR-Scan/releases
2. Click **Create a new release**
3. Choose tag: `v2.1.0`
4. Release title: `v2.1.0 — Robust QR Scanner for All Platforms`
5. Description (copy-paste this):

```markdown
## v2.1.0 — What's New

- **Massively improved QR decoding** — now handles artistic/decorative QR codes, low-contrast images, colored backgrounds, and noisy patterns
- **Multi-strategy decoder** — tries 70+ combinations of scale, threshold, and inversion before giving up
- **Cross-browser compatible** — Chrome, Edge, Firefox, Safari, Brave
- **Desktop app** — macOS (Apple Silicon) + Windows (x64)
- **One-line install** via curl/PowerShell commands in README

## Downloads

| File | Platform |
|------|----------|
| `qr-scan-extension.zip` | Chrome / Edge / Brave / Opera |
| `QR-Scan-Open-2.1.0-mac-arm64.dmg` | macOS (Apple Silicon M1/M2/M3/M4) |
| `QR-Scan-Open-2.1.0-mac-arm64.zip` | macOS (Apple Silicon, zip) |
| `QR-Scan-Open-2.1.0-windows-x64.exe` | Windows x64 (portable, no install) |

## Quick Install

**macOS (Terminal):**
```
curl -L https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.1.0-mac-arm64.dmg -o ~/Downloads/QR-Scan-Open.dmg && open ~/Downloads/QR-Scan-Open.dmg
```

**Windows (PowerShell):**
```
Invoke-WebRequest -Uri "https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.1.0-windows-x64.exe" -OutFile "$env:USERPROFILE\Downloads\QR-Scan-Open.exe"; Start-Process "$env:USERPROFILE\Downloads\QR-Scan-Open.exe"
```
```

6. **Upload these files** from your local `releases/` folder:
   - `qr-scan-extension.zip` (69 KB)
   - `QR-Scan-Open-2.1.0-mac-arm64.dmg` (91 MB)
   - `QR-Scan-Open-2.1.0-mac-arm64.zip` (87 MB)
   - `QR-Scan-Open-2.1.0-windows-x64.exe` (67 MB)

7. Click **Publish release**

## Step 3: Done!

Your repo is live at **https://github.com/LarryXu2014/Local-QR-Scan**

People can now:
- Copy the curl command from the README to install instantly
- Download individual files from the Releases page
- Star and fork the repo
