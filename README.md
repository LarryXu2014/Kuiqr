# QR Scan & Open

> Scan QR codes instantly — right-click, press a keyboard shortcut, or use your camera. Works everywhere.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-All-green.svg)](#download)

All QR decoding happens **locally on your device** using the [jsQR](https://github.com/cozmo/jsQR) library. No images, URLs, or scan data are ever sent to any server.

---

## Table of Contents

- [Download](#download)
- [Features](#features)
- [Installation](#installation)
- [How It Works](#how-it-works)
- [Platform Support](#platform-support)
- [File Structure](#file-structure)
- [Building from Source](#building-from-source)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Download

### Browser Extensions

| Browser | Download | Install Method |
|---------|----------|----------------|
| Chrome / Edge / Brave / Opera | [qr-scan-extension.zip](https://github.com/qrscanopen/qr-scan-open/releases/latest) | Load unpacked |
| Firefox (109+) | [qr-scan-firefox.zip](https://github.com/qrscanopen/qr-scan-open/releases/latest) | Load temporary add-on |
| Safari (macOS 14+) | [Build guide](safari/SAFARI_BUILD_GUIDE.md) | Xcode conversion |

### Desktop Apps

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [QR Scan & Open-2.0.0-arm64.dmg](https://github.com/qrscanopen/qr-scan-open/releases/latest) |
| macOS (Intel) | Build from source (see below) |
| Windows | Build from source (see below) |

### Web App (PWA)

No install needed — works in any browser on any device:

> [Open Web App](https://qrscanopen.cloudstudio.dev)

---

## Features

### Browser Extension (Chrome, Edge, Firefox, Safari, Brave)

1. **Right-click scan** — Right-click any QR code image, select "Scan QR Code", and the URL opens in a new tab
2. **Keyboard shortcut + drag-to-select** — Press `Cmd/Ctrl+Shift+Y` to dim the screen, then drag to select the QR code area
3. **Popup button** — Click the extension icon and press "Select Area to Scan" for the same drag-to-select overlay
4. **Scan history** — Last 50 scans, stored locally. Click any item to re-open or copy

### Desktop App (macOS, Windows)

1. **Global hotkey** — `Cmd/Ctrl+Shift+Y` works anywhere, even outside the browser
2. **Drag-to-select overlay** — Screen dims with a crosshair cursor, just like Windows Snipping Tool
3. **System tray** — Runs in the background. Click the tray icon to show/hide the window
4. **Settings tab** — Customize the keyboard shortcut, toggle auto-open, notifications, and history size
5. **Scan history** — Browse and re-open past scans from the History tab

### Web App (PWA — iOS, Android, Desktop)

1. **Camera scanning** — Live camera feed with scan frame overlay
2. **Image upload** — Upload an image file containing a QR code
3. **Clipboard paste** — Paste a screenshot to scan
4. **Installable** — Add to Home Screen on iOS/Android, install as a PWA on desktop

---

## Installation

### Chrome / Edge / Brave / Opera

1. Download and unzip `qr-scan-extension.zip`
2. Open `chrome://extensions` (or `edge://extensions` in Edge)
3. Turn on **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the unzipped `extension/` folder
6. Done! Right-click any QR code image or press the shortcut to scan

> After installing, go to `chrome://extensions/shortcuts` and make sure the shortcut is set to **"In Chrome"** (not "Global").

### Firefox

1. Download and unzip `qr-scan-firefox.zip`
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `manifest.json` inside the unzipped `firefox/` folder
5. See the [Firefox Install Guide](firefox/FIREFOX_INSTALL_GUIDE.md) for permanent installation

### Safari

Safari requires building with Xcode on macOS 14+ (Safari 17+). See the [Safari Build Guide](safari/SAFARI_BUILD_GUIDE.md).

### Desktop App (macOS / Windows)

Download the `.dmg` (macOS) or `.exe` (Windows) from [GitHub Releases](https://github.com/qrscanopen/qr-scan-open/releases/latest).

For macOS: Open the `.dmg`, drag **QR Scan & Open** to your Applications folder, and launch it. Press `Cmd+Shift+Y` to scan.

> On macOS, you may need to right-click the app and select "Open" the first time, since the app is not code-signed.

### Web App / PWA

Visit the web app URL in any browser. On iOS, tap Share → Add to Home Screen. On Android, tap the menu → Install app. On desktop Chrome/Edge, click the install icon in the address bar.

---

## How It Works

1. **Press the shortcut** (`Cmd+Shift+Y` on Mac, `Ctrl+Shift+Y` on Windows) or click the extension icon
2. **Screen dims** with a crosshair cursor — drag to select the QR code area
3. **The selected region is decoded** locally using jsQR. URLs open automatically in your browser. Text is copied to your clipboard.

All processing happens on your device. No images are uploaded to any server.

---

## Platform Support

| Feature | Windows | macOS | iOS | Android |
|---------|---------|-------|-----|---------|
| Extension (right-click) | Chrome, Edge, Firefox | Chrome, Edge, Firefox, Safari | — | — |
| Extension (shortcut) | Chrome, Edge, Firefox | Chrome, Edge, Firefox | — | — |
| Desktop App (global hotkey) | Yes | Yes (Apple Silicon + Intel) | — | — |
| Web App (camera) | Chrome, Edge, Firefox | Safari, Chrome, Firefox | Safari, Chrome | Chrome |
| Installable PWA | Chrome, Edge | Safari, Chrome | Safari | Chrome |

---

## File Structure

```
qr-scan-open/
├── extension/                  # Chrome / Edge / Brave extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js           # Service worker (cross-browser compatible)
│   ├── popup.html              # Popup UI
│   ├── popup.css
│   ├── popup.js
│   ├── jsQR.js                 # QR decoding library
│   └── icons/                  # 16, 32, 48, 128px PNG icons
│
├── firefox/                    # Firefox extension (Manifest V3, event page)
│   ├── manifest.json           # Uses background.scripts instead of service_worker
│   ├── background.js
│   ├── popup.html / .css / .js
│   ├── jsQR.js
│   ├── icons/
│   └── FIREFOX_INSTALL_GUIDE.md
│
├── safari/                     # Safari extension build guide
│   └── SAFARI_BUILD_GUIDE.md   # Step-by-step Xcode instructions
│
├── desktop-app/                # Electron desktop app (macOS + Windows)
│   ├── package.json            # electron-builder config
│   ├── main.js                 # Main process: globalShortcut, tray, screen capture, IPC
│   ├── overlay.html            # Full-screen overlay: dim + crosshair + drag-to-select
│   ├── overlay-preload.js      # contextBridge for overlay window
│   ├── jsQR.js
│   ├── icons/                  # 16–1024px PNG icons
│   ├── renderer/
│   │   ├── index.html          # Main window: 3 tabs (Scan, History, Settings)
│   │   ├── styles.css
│   │   ├── app.js              # Tab navigation, history, settings
│   │   └── preload.js          # contextBridge for main window
│   └── dist/                   # Build output (gitignored)
│
├── web-app/                    # PWA web app
│   ├── index.html
│   ├── styles.css
│   ├── app.js                  # Camera, upload, paste, history
│   ├── manifest.json           # PWA manifest
│   ├── service-worker.js       # Offline caching
│   ├── js/jsQR.js
│   └── icons/
│
├── landing/                    # Landing / download page
│   └── index.html              # Single-page site with all download options
│
├── .gitignore
├── README.md                   # This file
└── PROJECT_SUMMARY.md          # Full project state and technical notes
```

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20+ recommended)
- [Python 3](https://www.python.org/) (for icon generation, optional)

### Browser Extension

No build step needed — the extension is pure static files. Just load the `extension/` or `firefox/` folder directly.

### Desktop App

```bash
cd desktop-app
npm install

# Run in development
npm start

# Build for current platform
npm run build

# Build macOS only (DMG + ZIP)
npm run build:mac

# Build Windows only (NSIS installer + portable)
npm run build:win

# Build all platforms
npm run build:all
```

Build output goes to `desktop-app/dist/`.

> **Note:** Cross-compiling (e.g., building Windows on macOS) may require [Wine](https://www.winehq.org/). For best results, build on the target platform.

### Web App

No build step needed — the web app is pure static files. Serve the `web-app/` directory with any static file server, or open `index.html` directly.

### Packaging Extension Zips

```bash
cd extension && zip -r ../qr-scan-extension.zip . -x "*.DS_Store"
cd ../firefox && zip -r ../qr-scan-firefox.zip . -x "*.DS_Store" -x "FIREFOX_INSTALL_GUIDE.md"
```

---

## Tech Stack

- **QR Decoding:** [jsQR](https://github.com/cozmo/jsQR) — pure JavaScript, runs entirely locally
- **Browser Extension:** Manifest V3 (service worker for Chrome/Edge, event page for Firefox)
- **Desktop App:** [Electron 30](https://www.electronjs.org/) + [electron-builder](https://www.electron.build/)
- **Web App:** Vanilla JavaScript PWA with service worker, `getUserMedia` camera API
- **No frameworks, no build step, no server** — everything is static files

---

## Privacy

QR Scan & Open processes everything locally on your device. No images, URLs, or scan data are ever sent to any server. The source code is fully open for audit.

---

## License

MIT — open source, free to use and modify.
