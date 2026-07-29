# QR Scan & Open

> Scan QR codes instantly — right-click, press a keyboard shortcut, or use your camera. Works everywhere.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

![Version](https://img.shields.io/badge/Version-2.1.0-green.svg)

All QR decoding happens **locally on your device** using the [jsQR](https://github.com/cozmo/jsQR) library with robust multi-strategy preprocessing for artistic and decorative QR codes. No images, URLs, or scan data are ever sent to any server.

---

## One-Line Install (Terminal)

### macOS (Apple Silicon / M1, M2, M3, M4)

```bash
curl -L https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.1.0-mac-arm64.dmg -o ~/Downloads/QR-Scan-Open.dmg && open ~/Downloads/QR-Scan-Open.dmg
```

### macOS (Intel)

```bash
curl -L https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.1.0-mac-x64.dmg -o ~/Downloads/QR-Scan-Open.dmg && open ~/Downloads/QR-Scan-Open.dmg
```

> **Not sure which Mac you have?** Click   → About This Mac. If the chip says "Apple M-series" use the Apple Silicon command above; if it says "Intel" use the Intel command.

### Windows (x64)

```powershell
Invoke-WebRequest -Uri "https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.1.0-windows-x64.exe" -OutFile "$env:USERPROFILE\Downloads\QR-Scan-Open.exe"; Start-Process "$env:USERPROFILE\Downloads\QR-Scan-Open.exe"
```

### Chrome / Edge / Brave Extension

```bash
# Download and extract
curl -L https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/qr-scan-extension.zip -o /tmp/qr-scan-extension.zip && unzip -q /tmp/qr-scan-extension.zip -d ~/qr-scan-extension && echo "Extension extracted to ~/qr-scan-extension — load it from chrome://extensions > Load unpacked"
```

> **After installing:** Go to `chrome://extensions/shortcuts` and make sure the shortcut is set to **"In Chrome"** (not "Global"). Press **Cmd+Shift+Y** (Mac) or **Ctrl+Shift+Y** (Windows) to scan.

---

## Download

| Platform                   | File                                                                                                                                           | Size  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Chrome / Edge / Brave      | [qr-scan-extension.zip](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/qr-scan-extension.zip)                           | 69 KB |
| Firefox (109+)             | [qr-scan-firefox.zip](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/qr-scan-firefox.zip)                               | 68 KB |
| macOS (Apple Silicon)      | [QR-Scan-Open-2.1.0-mac-arm64.dmg](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.1.0-mac-arm64.dmg)     | 91 MB |
| macOS (Apple Silicon, ZIP) | [QR-Scan-Open-2.1.0-mac-arm64.zip](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.1.0-mac-arm64.zip)     | 87 MB |
| macOS (Intel)              | [QR-Scan-Open-2.1.0-mac-x64.dmg](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.1.0-mac-x64.dmg)         | ~91 MB |
| Windows (x64)              | [QR-Scan-Open-2.1.0-windows-x64.exe](https://github.com/LarryXu2014/Local-QR-Scan/releases/latest/download/QR-Scan-Open-2.1.0-windows-x64.exe) | 67 MB |

---

## Features

### Browser Extension (Chrome, Edge, Firefox, Safari, Brave)

- **Right-click scan** — Right-click any QR code image → "Scan QR Code" → URL opens in new tab
- **Keyboard shortcut + drag-to-select** — Press `Cmd/Ctrl+Shift+Y` → screen dims → drag to select QR area → auto-scans
- **Popup button** — Click extension icon → "Select Area to Scan" → same overlay experience
- **Robust decoding** — Multi-strategy preprocessing handles artistic/decorative QR codes, low contrast, color backgrounds, inverted codes, and noisy images
- **Scan history** — Last 50 scans stored locally

### Desktop App (macOS, Windows)

- **Global hotkey** — `Cmd/Ctrl+Shift+Y` works anywhere on screen, even outside browsers
- **Drag-to-select overlay** — Screen dims with crosshair cursor, like Windows Snipping Tool
- **System tray** — Runs in background; click tray icon to show/hide window
- **Settings tab** — Customize shortcut, toggle auto-open URL, notifications, history size
- **Same robust QR decoder** as the extension

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

### Safari (macOS 14+)

Requires building with Xcode. See [SAFARI\_BUILD\_GUIDE.md](safari/SAFARI_BUILD_GUIDE.md).

### Desktop App

**macOS:** Download `.dmg`, open it, drag **QR Scan & Open** to Applications. First launch: right-click → "Open" (Gatekeeper bypass).

**Windows:** Run the `.exe` — no installer needed (portable).

---

## How It Works

1. **Press the shortcut** (`Cmd+Shift+Y` / `Ctrl+Shift+Y`) or use the popup button
2. **Screen dims** with a crosshair cursor — drag to select the QR code area
3. **Auto-decodes** using multi-strategy processing:
   - Tries multiple scale sizes (200px – 1200px)
   - Grayscale conversion + contrast enhancement
   - Binary thresholding at multiple levels (80–160)
   - Both normal and inverted color modes
4. **URLs open automatically** in your browser; text copies to clipboard

All processing happens on your device. Zero server communication.

---

## What's New in v2.1.0

- **Massively improved QR decoding** — now handles artistic/decorative QR codes, low-contrast images, colored backgrounds, and noisy patterns
- **Multi-strategy decoder** — tries 70+ combinations of scale, threshold, and inversion before giving up
- **Cross-browser compatible** — same extension code works on Chrome, Edge, Firefox, Safari, Brave
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
├── safari/                     # Safari build guide
├── desktop-app/                # Electron desktop app
│   ├── package.json            # electron-builder config
│   ├── main.js                 # Global hotkey, tray, capture, IPC
│   ├── overlay.html            # Full-screen dim + drag-to-select
│   ├── renderer/               # Main UI: tabs for Scan / History / Settings
│   └── dist/                   # Build output (gitignored)
├── web-app/                    # PWA web app (camera / upload / paste)
├── landing/                    # Landing page
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
