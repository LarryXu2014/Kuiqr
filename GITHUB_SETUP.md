# GitHub Setup Guide

This guide walks you through uploading the project to GitHub and creating a release with downloadable binaries.

## Step 1: Create the Repository on GitHub

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `qr-scan-open`
3. Description: `Scan QR codes instantly — right-click, press a keyboard shortcut, or use your camera. Works everywhere.`
4. Set to **Public**
5. **Do NOT** initialize with README, .gitignore, or license (we already have these)
6. Click **Create repository**

## Step 2: Push the Code

Open Terminal and run:

```bash
cd /path/to/qr-scanner

# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/qr-scan-open.git

# Push to GitHub
git push -u origin main
git push origin v2.0.0
```

## Step 3: Create a GitHub Release

1. Go to your repository on GitHub
2. Click **Releases** → **Create a new release**
3. Choose the tag: `v2.0.0`
4. Release title: `v2.0.0 — Cross-Platform QR Scanner`
5. Description:

```markdown
## What's New

- Chrome / Edge / Brave / Firefox browser extension with right-click scan and drag-to-select overlay
- Safari build guide (requires Xcode, macOS 14+)
- Desktop app for macOS (Apple Silicon) and Windows
- PWA web app for iOS / Android / desktop with camera scanning
- 100% local processing — no data sent to any server

## Downloads

| File | Platform |
|------|----------|
| `qr-scan-extension.zip` | Chrome / Edge / Brave / Opera |
| `qr-scan-firefox.zip` | Firefox 109+ |
| `QR-Scan-Open-2.0.0-mac-arm64.dmg` | macOS (Apple Silicon M1/M2/M3) |
| `QR-Scan-Open-2.0.0-mac-arm64.zip` | macOS (Apple Silicon, zip) |
| `QR-Scan-Open-2.0.0-windows-x64.exe` | Windows x64 |

## Installation

See the [README](https://github.com/YOUR_USERNAME/qr-scan-open#installation) for detailed installation instructions.
```

6. Drag and drop all files from the `releases/` folder into the release attachments
7. Click **Publish release**

## Step 4: Update Download Links

After creating the release, update the download URLs in:
- `landing/index.html` — replace `https://github.com/qrscanopen/qr-scan-open/releases/latest` with your actual repo URL
- `README.md` — same replacement

Then commit and push:

```bash
git add -A
git commit -m "Update download links"
git push
```

## Files in `releases/` Directory

| File | Size | Description |
|------|------|-------------|
| `qr-scan-extension.zip` | ~68 KB | Chrome/Edge/Brave extension |
| `qr-scan-firefox.zip` | ~68 KB | Firefox extension |
| `QR-Scan-Open-2.0.0-mac-arm64.dmg` | ~91 MB | macOS app (Apple Silicon) |
| `QR-Scan-Open-2.0.0-mac-arm64.zip` | ~87 MB | macOS app (zip format) |
| `QR-Scan-Open-2.0.0-windows-x64.exe` | ~67 MB | Windows portable app |
