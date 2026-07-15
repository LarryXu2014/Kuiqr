# QR Scan & Open — Project Summary

> **Purpose:** This file captures the full state of the project so it can be continued in a new chat.
> Read this file first to understand everything that has been done and what remains.

---

## 1. Project Overview

**QR Scan & Open** is a cross-platform QR code scanning suite with multiple deliverables:

1. **Browser Extension** (Chrome/Edge/Brave) — right-click scan + keyboard shortcut drag-to-select
2. **Firefox Extension** — same features, MV3-compatible with `background.scripts`
3. **Safari Extension** — conversion guide for Xcode wrapping (Safari 17+)
4. **Desktop App** (Electron) — standalone macOS + Windows app with global hotkey
5. **Web App** (PWA) — camera scanning, image upload, clipboard paste (iOS/Android/desktop)
6. **Landing Page** — beautiful download site with all platform options

All QR decoding happens locally using the [jsQR](https://github.com/cozmo/jsQR) library. No data is sent to any server.

---

## 2. Current File Structure

```
qr-scanner/
├── extension/                       # Chrome/Edge/Brave extension (v1.6.0, WORKING)
│   ├── manifest.json                # MV3, service_worker, commands, contextMenus
│   ├── background.js                # Service worker — cross-browser compatible
│   ├── popup.html                   # Popup UI — "Select Area to Scan" button + history
│   ├── popup.css                    # Popup styles
│   ├── popup.js                     # Popup logic — sends showOverlay message
│   ├── jsQR.js                      # QR decoding library (bundled, ~250KB)
│   └── icons/                       # 16, 32, 48, 128px PNG icons
│
├── firefox/                         # Firefox extension (v1.6.0, UNTESTED)
│   ├── manifest.json                # MV3, background.scripts (not service_worker)
│   ├── background.js                # Same as extension/ (cross-browser)
│   ├── popup.html                   # Same as extension/
│   ├── popup.css                    # Same as extension/
│   ├── popup.js                     # Same as extension/
│   ├── jsQR.js                      # Same library
│   ├── icons/                       # Same icons
│   └── FIREFOX_INSTALL_GUIDE.md     # Installation instructions
│
├── safari/                          # Safari extension (GUIDE ONLY)
│   └── SAFARI_BUILD_GUIDE.md        # Xcode conversion instructions
│
├── desktop-app/                     # Electron desktop app (v2.0.0, CODE COMPLETE, NOT BUILT)
│   ├── package.json                 # Electron + electron-builder config
│   ├── main.js                      # Main process — globalShortcut, tray, screen capture, IPC
│   ├── overlay.html                 # Overlay window — dim screen + drag-to-select UI
│   ├── overlay-preload.js           # Preload for overlay window (contextBridge)
│   ├── jsQR.js                      # QR decoding library (copy of extension's)
│   ├── icons/                       # Same icons as extension
│   ├── renderer/
│   │   ├── index.html               # Main window UI — 3 tabs: Scan, History, Settings
│   │   ├── styles.css               # Main window styles
│   │   ├── app.js                   # Main window logic — tabs, history, settings
│   │   └── preload.js               # Preload for main window (contextBridge)
│   ├── node_modules/                # Installed (electron, electron-builder)
│   ├── package-lock.json
│   └── (dist/ — DOES NOT EXIST YET — build was interrupted)
│
├── web-app/                         # PWA web app (v1.0, DEPLOYED)
│   ├── index.html                   # Main page — camera, upload, paste
│   ├── styles.css                   # App styles
│   ├── app.js                       # Camera, upload, paste, history logic
│   ├── manifest.json                # PWA manifest
│   ├── service-worker.js            # Offline caching
│   ├── js/jsQR.js                   # QR decoding library
│   └── icons/                       # PWA icons
│
├── landing/                         # Landing/download page
│   └── index.html                   # Single-page site with all download options
│
├── qr-scan-extension.zip            # Packaged Chrome extension (70KB)
├── qr-scan-firefox.zip              # Packaged Firefox extension (71KB)
├── README.md                        # Main readme (needs updating for new structure)
├── PROJECT_SUMMARY.md               # THIS FILE
└── .gitignore                       # (NEEDS CREATING)
```

---

## 3. Component Status

### 3.1 Chrome Extension — WORKING (v1.6.0)
- **Status:** User confirmed it works. Drag-to-select overlay functions correctly.
- **What was removed:** "Scan whole page" button text was changed to "Select Area to Scan" (no whole-page scan).
- **Features:**
  - Right-click image → "Scan QR Code" → decodes and opens URL / copies text
  - Keyboard shortcut Cmd/Ctrl+Shift+Y → captures screen → injects overlay
  - Popup button "Select Area to Scan" → same as shortcut
  - Overlay: dim screen, crosshair cursor, drag-to-select, scan selected region
  - Scan history (50 items, stored in chrome.storage.local)
  - chrome.alarms keepalive (MV3 service worker idle bug)
- **Key technical approach (v1.6.0):** Uses `chrome.scripting.executeScript({ func })` to inject the entire overlay as a self-contained function directly into the page. No content_scripts in manifest. No separate overlay JS/CSS files.
- **Cross-browser changes made this session:**
  - `importScripts("jsQR.js")` wrapped in `typeof importScripts === "function"` check
  - `OffscreenCanvas` fallback: `createCanvas()` helper that uses `document.createElement("canvas")` in Firefox background page

### 3.2 Firefox Extension — CODE COMPLETE, UNTESTED
- **Status:** Code is ready. Needs testing in Firefox.
- **Key differences from Chrome version:**
  - `manifest.json`: uses `background.scripts: ["jsQR.js", "background.js"]` instead of `background.service_worker`
  - `browser_specific_settings.gecko.id`: "qr-scan-open@qrscanopen.app"
  - `strict_min_version`: "109.0" (MV3 support)
  - No `alarms` permission needed (Firefox doesn't kill background pages like Chrome MV3)
- **Testing instructions:** See `firefox/FIREFOX_INSTALL_GUIDE.md`
- **Potential issues to verify:**
  - Does `chrome.scripting.executeScript({ func })` work in Firefox? (Should work in Firefox 102+)
  - Does `chrome.tabs.captureVisibleTab(null, ...)` work in Firefox? (Should work)
  - Does the overlay injection work correctly in Firefox?

### 3.3 Safari Extension — GUIDE ONLY
- **Status:** Build guide written. No actual Safari build created.
- **Requirements:** macOS 14+, Xcode 15+, Safari 17+
- **Limitation:** `chrome.commands` (keyboard shortcuts) NOT supported in Safari. Users must use the popup button.
- **Build process:** Use `xcrun safari-web-extension-converter` to convert the Chrome extension, then build in Xcode.
- **See:** `safari/SAFARI_BUILD_GUIDE.md`

### 3.4 Desktop App (Electron) — CODE COMPLETE, NOT BUILT
- **Status:** All source code written. Dependencies installed. Build was INTERRUPTED before producing any binaries.
- **What exists:**
  - `main.js` — Full Electron main process with globalShortcut, system tray, screen capture, IPC handlers, hidden window for QR decoding
  - `renderer/index.html` — 3-tab UI (Scan, History, Settings)
  - `renderer/styles.css` — Complete styling
  - `renderer/app.js` — Tab navigation, history rendering, settings form
  - `renderer/preload.js` — contextBridge API
  - `overlay.html` — Full-screen overlay with dim + drag-to-select + crosshair
  - `overlay-preload.js` — contextBridge for overlay
  - `package.json` — electron-builder config for macOS (dmg+zip, x64+arm64) and Windows (nsis+portable, x64)
- **What's missing:**
  - `dist/` directory — no built binaries exist
  - Build command was: `npx electron-builder --mac dir --arm64` (was running from wrong directory, interrupted)
  - Need to run: `cd /Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/desktop-app && npx electron-builder --mac dir --arm64`
  - Windows build needs to be done on Windows or cross-compiled (may need Wine)
- **Known issue in main.js:** The `ensureDecodeWindow()` function loads jsQR via `require()` in a data: URL, which may not work. The `decodeInHiddenWindow()` function uses `executeJavaScript` as a workaround. The `ensureDecodeWindow` function is defined but `decodeInHiddenWindow` doesn't actually use it — it directly calls `executeJavaScript`. This should work but needs testing.
- **Package.json build config issue:** The `files` array includes `"overlay.js"` which doesn't exist (overlay is inline in overlay.html). This is harmless but should be removed.

### 3.5 Web App (PWA) — DEPLOYED, WORKING
- **Status:** Deployed to CloudStudio. Working.
- **Features:** Camera scanning, image upload, clipboard paste, scan history
- **Deployed URL:** Was deployed via CloudStudio (may need redeployment)

### 3.6 Landing Page — COMPLETE
- **Status:** Single-page HTML site with all download options.
- **Cards:** Chrome/Edge, Firefox, Safari, macOS App, Windows App, Web App (PWA)
- **Features:** Platform detection, responsive design, feature grid, how-it-works section, privacy banner
- **GitHub links:** Point to `https://github.com/qrscanopen/qr-scan-open` (repo not created yet)

---

## 4. What's DONE

1. Chrome extension (v1.6.0) — working, tested by user
2. Cross-browser background.js — importScripts guard + OffscreenCanvas fallback
3. Firefox extension — code complete, manifest + all files, install guide
4. Safari conversion guide — step-by-step Xcode instructions
5. Electron desktop app — all source code written, dependencies installed
6. Landing page — complete with all 6 platform cards
7. Web app (PWA) — deployed and working
8. Extension zips packaged — qr-scan-extension.zip, qr-scan-firefox.zip
9. "Scan whole page" removed from popup (user requested)

## 5. What's PENDING

1. **Build Electron desktop binaries** — `cd desktop-app && npx electron-builder --mac dir` and `--win` (was interrupted)
2. **Test Firefox extension** — load in Firefox, verify overlay injection works
3. **Create Safari build** — run Xcode conversion on a Mac with Xcode installed
4. **Set up GitHub repository** — create repo, push all files, create releases with binaries
5. **Update README.md** — needs to reflect new structure (firefox/, safari/, desktop-app/, landing/)
6. **Create .gitignore** — exclude node_modules/, dist/, *.zip, .DS_Store
7. **Redeploy web app** if CloudStudio sandbox expired
8. **Test desktop app** — run `npm start` in desktop-app to verify it works before building

---

## 6. Key Technical Decisions

### Extension Overlay Injection (v1.6.0 approach)
The overlay is injected via `chrome.scripting.executeScript({ func: showOverlayFunction, args: [dataUrl] })`.
The entire overlay UI (dim screen, crosshair, drag-select, crop, send to background for decode) is a single
self-contained function. No content_scripts in manifest. No external CSS/JS files for the overlay.
This was the approach that finally worked after many failed attempts with content_scripts and chrome.commands.

### Firefox Background Scripts
Firefox MV3 uses `background.scripts` (event page) instead of `background.service_worker`.
jsQR is loaded via the scripts array: `["jsQR.js", "background.js"]`.
The `importScripts()` call is guarded with `typeof importScripts === "function"` so it's skipped in Firefox.
`OffscreenCanvas` may not be available in Firefox background pages, so `createCanvas()` falls back to `document.createElement("canvas")`.

### Safari Limitations
- `chrome.commands` (keyboard shortcuts) NOT supported in Safari Web Extensions
- Popup button is the alternative trigger
- Same MV3 manifest works, but needs Xcode wrapping for distribution
- Requires macOS 14+ / Safari 17+

### Electron QR Decoding
jsQR needs a canvas/DOM environment, but Electron's main process doesn't have one.
Solution: `decodeInHiddenWindow()` uses `webContents.executeJavaScript()` to run QR decoding
in a hidden BrowserWindow that has a canvas element. The hidden window loads jsQR via `require()`.

### Electron Global Shortcut
Uses `globalShortcut.register()` — works system-wide, even when the app is not focused.
This is the KEY advantage over the browser extension (where chrome.commands only works in Chrome).

---

## 7. Version History

| Version | Change |
|---------|--------|
| v1.0 | Initial Chrome extension: right-click scan only |
| v1.1 | Added screenshot overlay with selection UI, shortcut Cmd+Shift+Q |
| v1.2 | Changed shortcut to Cmd+Shift+Y (Q conflicted with macOS), removed right-click screenshot option |
| v1.2.1 | Restored scripting permission, added popup scan button, debug logging |
| v1.2.2 | Added chrome.alarms keepalive |
| v1.3.0 | Tried content script keydown listener for shortcut |
| v1.4.0 | Rebuilt selection overlay using content script approach |
| v1.5.0 | Changed run_at to document_start, added on-demand injection |
| v1.6.0 | **WORKING** — Direct function injection via chrome.scripting.executeScript({ func }) |
| v1.6.0+ | Cross-browser: importScripts guard, OffscreenCanvas fallback, Firefox manifest, Safari guide |
| v2.0.0 | Electron desktop app (code complete, not built) |

---

## 8. Key Recurring Issue (RESOLVED)

The keyboard shortcut `Cmd+Shift+Y` never worked via `chrome.commands` API across multiple versions.
Root cause: MV3 service worker idle timeout kills the `onCommand` listener.
Solutions tried (in order): chrome.alarms keepalive, content script keydown, on-demand injection, direct function injection.
**What finally worked (v1.6.0):** The popup button "Select Area to Scan" works reliably.
The shortcut may or may not work depending on Chrome version and service worker state.
The user confirmed v1.6.0 works (via popup button).

For the desktop app, this is not an issue because `globalShortcut.register()` works reliably in Electron.

---

## 9. How to Continue in a New Chat

When starting a new chat, paste this:

> "I'm continuing work on a QR code scanner project. The full project state is documented in
> `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/PROJECT_SUMMARY.md`.
> Please read that file first, then help me with the following pending tasks:
> 1. Build Electron desktop binaries (macOS + Windows)
> 2. Test the Firefox extension
> 3. Set up GitHub repository with all files
> 4. Update README.md and create .gitignore
> 5. Redeploy the web app if needed"

### Quick Reference — Key File Paths

- Extension: `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/extension/`
- Firefox: `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/firefox/`
- Safari guide: `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/safari/SAFARI_BUILD_GUIDE.md`
- Desktop app: `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/desktop-app/`
- Web app: `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/web-app/`
- Landing page: `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/landing/index.html`
- Chrome zip: `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/qr-scan-extension.zip`
- Firefox zip: `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/qr-scan-firefox.zip`
- This summary: `/Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/PROJECT_SUMMARY.md`

### Build Commands

```bash
# Test Electron app locally
cd /Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/desktop-app
/Users/stit/.workbuddy/binaries/node/versions/22.22.2/bin/npx electron .

# Build macOS app (arm64 only — for M1/M2 Macs)
cd /Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/desktop-app
/Users/stit/.workbuddy/binaries/node/versions/22.22.2/bin/npx electron-builder --mac dir --arm64

# Build macOS DMG (both architectures)
/Users/stit/.workbuddy/binaries/node/versions/22.22.2/bin/npx electron-builder --mac

# Build Windows app (may need Wine on macOS)
/Users/stit/.workbuddy/binaries/node/versions/22.22.2/bin/npx electron-builder --win

# Package Chrome extension zip
cd /Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/extension
zip -r ../qr-scan-extension.zip . -x "*.DS_Store"

# Package Firefox extension zip
cd /Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner/firefox
zip -r ../qr-scan-firefox.zip . -x "*.DS_Store"
```

---

## 10. User Preferences (from conversation)

- Shortcut: Cmd+Shift+Y (Mac) / Ctrl+Shift+Y (Windows) — user explicitly chose "Y" after "Q" conflicted
- User wants: dim screen like Windows screenshot, crosshair cursor (cross, not arrow), selected area stands out
- User requested: no "scan whole page" — only drag-to-select
- User wants the app to be "universal" — works outside Chrome too
- User wants: downloadable for both Windows and Mac
- User wants: popup UI integrated into the app (done in Electron app)
- User wants: settings tab where everything can be customized (done in Electron app)
- User wants: README and other files on GitHub
- User wants: Firefox, Safari, and other browser support
