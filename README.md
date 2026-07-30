# QR Scan & Open

> Scan QR codes instantly — right-click, press a keyboard shortcut, or use your camera. Works everywhere.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Version](https://img.shields.io/badge/Version-2.2.2-green.svg)

All QR decoding happens **locally on your device** using the [jsQR](https://github.com/cozmo/jsQR) library with robust multi-strategy preprocessing for artistic and decorative QR codes. No images, URLs, or scan data are ever sent to any server.

---

## One-Line Install (Terminal)

### macOS (Apple Silicon / M1, M2, M3, M4)

```bash
curl -L https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.2.2-mac-arm64.dmg -o ~/Downloads/QR-Scan-Open.dmg && open ~/Downloads/QR-Scan-Open.dmg
```

After dragging to Applications, **first launch only**: open Terminal and run:
```bash
xattr -cr /Applications/QR\ Scan\ \&\ Open.app && open /Applications/QR\ Scan\ \&\ Open.app
```

### macOS (Intel)

```bash
curl -L https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.2.2-mac-x64.dmg -o ~/Downloads/QR-Scan-Open.dmg && open ~/Downloads/QR-Scan-Open.dmg
```

After dragging to Applications, **first launch only**:
```bash
xattr -cr /Applications/QR\ Scan\ \&\ Open.app && open /Applications/QR\ Scan\ \&\ Open.app
```

> **Not sure which Mac you have?** Click   → About This Mac. If the chip says "Apple M-series" use Apple Silicon; if it says "Intel" use Intel.

### Windows (x64)

```powershell
Invoke-WebRequest -Uri "https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.2.2-windows-x64.exe" -OutFile "$env:USERPROFILE\Downloads\QR-Scan-Open.exe"; Start-Process "$env:USERPROFILE\Downloads\QR-Scan-Open.exe"
```

### Chrome / Edge / Brave Extension

```bash
# Download and extract
curl -L https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/qr-scan-extension.zip -o /tmp/qr-scan-extension.zip && unzip -q /tmp/qr-scan-extension.zip -d ~/qr-scan-extension && echo "Extension extracted to ~/qr-scan-extension — load it from chrome://extensions > Load unpacked"
```

> **After installing:** Go to `chrome://extensions/shortcuts` and make sure the shortcut is set to **"In Chrome"** (not "Global"). Press **Cmd+Shift+Y** (Mac) or **Ctrl+Shift+Y** (Windows) to scan.

---

## Troubleshooting

### macOS shows "damaged" or "can't be opened"

This is a **macOS Gatekeeper false positive**, not actual corruption. The app is not signed with an Apple Developer certificate ($99/year), so macOS quarantines it. The file is perfectly fine — verified by `hdiutil verify` checksum.

**Fix (one-time, takes 2 seconds):**
```bash
xattr -cr /Applications/QR\ Scan\ \&\ Open.app
```
Then double-click the app normally. You only need to do this once.

**Alternative:** Right-click the app → "Open" → confirm in the dialog.

### Download is very slow

GitHub's release server (`objects.githubusercontent.com`) is throttled in some regions. Use a mirror instead:

```bash
# Replace any GitHub releases URL prefix with ghproxy.com
curl -L "https://ghproxy.com/https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.2.2-mac-arm64.dmg" -o ~/Downloads/QR-Scan-Open.dmg && open ~/Downloads/QR-Scan-Open.dmg
```
If `ghproxy.com` is down, try `https://mirror.ghproxy.com/`.

---

## Download

| Platform                   | File                                                                                                                                           | Size  | Status |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| Chrome / Edge / Brave      | [qr-scan-extension.zip](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/qr-scan-extension.zip)                           | 69 KB | Verified |
| Firefox (109+)             | [qr-scan-firefox.zip](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/qr-scan-firefox.zip)                               | 68 KB | Verified |
| macOS (Apple Silicon)      | [QR-Scan-Open-2.2.2-mac-arm64.dmg](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.2.2-mac-arm64.dmg)     | 95 MB | Verified |
| macOS (Apple Silicon, ZIP) | [QR-Scan-Open-2.2.2-mac-arm64.zip](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.2.2-mac-arm64.zip)     | 92 MB | Verified |
| macOS (Intel)              | [QR-Scan-Open-2.2.2-mac-x64.dmg](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.2.2-mac-x64.dmg)         | ~100 MB | Verified |
| Windows (x64)              | [QR-Scan-Open-2.2.2-windows-x64.exe](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.2.2-windows-x64.exe) | ~70 MB | Verified |

All binaries verified: DMG checksum valid, ZIPs no errors, EXE valid PE32.

---

## Features

### Browser Extension (Chrome, Edge, Firefox, Brave)

- **Right-click scan** — Right-click any QR code image → "Scan QR Code" → URL opens in new tab
- **Keyboard shortcut + drag-to-select** — Press `Cmd/Ctrl+Shift+Y` → screen dims → drag to select QR area → auto-scans
- **Popup button** — Click extension icon → "Select Area to Scan" → same overlay experience
- **Robust decoding** — Multi-strategy preprocessing handles artistic/decorative QR codes, low contrast, color backgrounds, inverted codes, and noisy images
- **Scan history** — Last 50 scans stored locally

### Desktop App (macOS, Windows)

- **In-app scan** — Paste an image from clipboard (⌘V) or drag & drop any image file — decodes instantly in the app window
- **Screen capture scan** — Global hotkey `Cmd/Ctrl+Shift+Y` dims the screen with a crosshair for drag-to-select
- **Auto-detect shortcut recorder** — Click "Press keys to record" in Settings to set any hotkey combo (Cmd+Shift+A, etc.)
- **System tray** — Runs in background; click tray icon to show/hide window
- **Settings tab** — Customize shortcut (auto-record), toggle auto-open URL, notifications, history size
- **Same robust QR decoder** as the extension — a fast tier (direct + cheap upscales, usually 1–3 attempts) handles normal QR codes instantly, with an advanced threshold/invert fallback only for hard artistic/decorative codes

### Web App (PWA — iOS, Android, Desktop)

- **Camera scanning** — Live camera feed with scan frame overlay
- **Image upload** — Upload any image containing a QR code
- **Clipboard paste** — Paste a screenshot to scan it
- **Installable** — Add to Home Screen (iOS/Android), install as PWA (desktop)

---

## Installation

### Chrome / Edge / Brave / Opera

1. Download `qr-scan-extension.zip` and unzip it
2. Open `chrome://extensions` (or `edge://extensions`)
3. Turn on **Developer mode** (top-right corner)
4. Click **Load unpacked**
5. Select the unzipped folder
6. Done! Right-click any QR code image or press `Cmd/Ctrl+Shift+Y`

### Firefox

1. Download `qr-scan-firefox.zip` and unzip it
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `manifest.json` inside the unzipped folder
5. See [FIREFOX\_INSTALL\_GUIDE.md](firefox/FIREFOX_INSTALL_GUIDE.md) for permanent installation

### Desktop App

**macOS:**
1. Download `.dmg`, open it
2. Drag **QR Scan & Open** to Applications
3. **First launch only** — open Terminal and run: `xattr -cr /Applications/QR\ Scan\ \&\ Open.app`
4. Double-click to open (or run `open /Applications/QR\ Scan\ \&\ Open.app`)

**Windows:** Run the `.exe` — no installer needed (portable). The app stays in the **system tray** after you close the window, so the global shortcut keeps working. To fully quit, right-click the tray icon → **Quit**.

> **Windows SmartScreen ("Windows protected your PC"):** The app is not code-signed (no paid certificate), so Windows may block the first launch. This is expected for unsigned apps — click **More info → Run anyway**. You only need to do this once.

---

## How It Works

### In-App Scan (no overlay needed)

1. **Paste an image** — Copy a screenshot or QR image, press **⌘V** (or Ctrl+V) in the app
2. **Or drag & drop** — Drag any image file onto the Scan tab's drop zone
3. **Instant decode** — jsQR runs a fast tier first (1–3 attempts for normal codes) with an advanced fallback for hard codes
4. **URLs open automatically**; text copies to clipboard

### Screen Capture Scan

1. **Press the shortcut** (`Cmd+Shift+Y` / `Ctrl+Shift+Y`) or click the button
2. **Screen dims** with a crosshair cursor — drag to select the QR code area
3. **Auto-decodes** using multi-strategy processing
4. **URLs open automatically** in your browser; text copies to clipboard

All processing happens on your device. Zero server communication.

---

## What's New

### v2.2.2
- **Fixed the shortcut recorder** — The root cause of several bugs: the global hotkey stayed active *while you were recording a new one*, so pressing the keys both recorded them **and** triggered a scan (opening the capture overlay / "new page"). Now the global shortcut is fully **suspended the moment you click Record** and re-enabled when you finish.
- **Recording auto-saves** — Press a combo and it's saved + made active immediately. No need to also click "Save Settings".
- **No scans while recording** — Paste, drag-drop, and the Select Screen Area button are all blocked during recording.
- **Real re-entrancy fix** — Pressing the combo again mid-recording, or holding a key (auto-repeat), can no longer start a second recording or freeze the screen. Escape always cancels cleanly.
- **Scan button label is correct** — The button's shortcut hint now reflects your actual saved shortcut (it was hardcoded to `Cmd/Ctrl+Shift+Y` before, so a changed shortcut looked like it reverted).

### v2.2.1
- **Much faster scanning** — The decoder now runs a *fast tier* first (direct decode + a couple of cheap upscales, normally 1–3 attempts) and only falls back to the slow multi-threshold/invert sweep for hard artistic/decorative QR codes. Normal codes decode instantly.
- **Fixed "can't open the app" on Windows** — The app now stays alive in the **system tray** when you close the window (instead of fully quitting), so the global shortcut `Ctrl+Shift+Y` keeps working. Re-launching the `.exe` focuses the existing window instead of opening a second copy.
- **Robust shortcut registration** — If the saved hotkey can't be registered, the app automatically falls back to `Ctrl/Cmd+Shift+Y/S/A` and notifies you; you can always scan via the tray icon or the **Select Screen Area** button.

### v2.2.0
- **In-app scan** — Paste from clipboard (⌘V) or drag & drop images directly in the app — no overlay needed
- **Auto-detect shortcut recorder** — Press any key combo in Settings; the app detects and formats it automatically
- **Drop zone** — Visual drag-and-drop target with hover feedback
- **Result card** — Shows decoded data inline with Open URL / Copy actions
- **Image preview** — See the scanned image before/after decoding

### v2.1.0

- **Massively improved QR decoding** — now handles artistic/decorative QR codes, low-contrast images, colored backgrounds, and noisy patterns
- **Multi-strategy decoder** — tries 70+ combinations of scale, threshold, and inversion before giving up
- **Cross-browser compatible** — same extension code works on Chrome, Edge, Firefox, Brave
- **Desktop app parity** — same robust decoder in the Electron app

---

## File Structure

```
Local-QR-Scan/
├── extension/                  # Chrome / Edge / Brave (Manifest V3)
│   ├── manifest.json           # v2.1.0
│   ├── background.js           # Service worker + robust QR decoder
│   ├── popup.html / .css / .js # Popup UI with scan history
│   ├── jsQR.js                 # QR decoding library
│   └── icons/
├── firefox/                    # Firefox (Manifest V3, event page)
│   ├── manifest.json
│   ├── background.js           # Same cross-browser code
│   └── FIREFOX_INSTALL_GUIDE.md
├── desktop-app/                # Electron desktop app
│   ├── package.json            # electron-builder config
│   ├── main.js                 # Global hotkey, tray, capture, IPC
│   ├── overlay.html            # Full-screen dim + drag-to-select
│   ├── renderer/               # Main UI: tabs for Scan / History / Settings
│   └── dist/                   # Build output (gitignored)
├── web-app/                    # PWA web app (camera / upload / paste)
├── releases/                   # Pre-built binaries for GitHub Releases
├── README.md
└── PROJECT_SUMMARY.md          # Full technical notes
```

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm (comes with Node.js)

### Desktop App

```bash
cd desktop-app
npm install
npm start              # Development mode
npm run build:mac      # Build macOS (DMG + ZIP)
npm run build:win      # Build Windows (NSIS + portable)
```

### Extension

No build step needed — pure static files. Load directly from the folder.

### Package Zips

```bash
cd extension && zip -r ../qr-scan-extension.zip . -x "*.DS_Store"
cd ../firefox && zip -r ../qr-scan-firefox.zip . -x "*.DS_Store"
```

---

## Tech Stack

| Component                                           | Technology                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| QR Decoding                                         | [jsQR](https://github.com/cozmo/jsQR) + custom multi-strategy preprocessor |
| Browser Extension                                   | Manifest V3 (service worker / event page)                                  |
| Desktop App                                         | [Electron 30](https://www.electronjs.org/) + electron-builder              |
| Web App                                             | Vanilla JS PWA + getUserMedia camera API                                   |
| No frameworks, no build step for extensions/web app | Everything is static files                                                 |

---

## Privacy

100% local processing. No images, URLs, or scan data ever leave your device. Source code fully open for audit.

---

## License

MIT — free to use, modify, and distribute.
