<!-- Copyright 2026 LarryXu. Licensed under GPL-3.0. -->
# Kuiqr

> Scan QR codes instantly — right-click any image, press a keyboard shortcut, or paste a screenshot. Works on your desktop, in your browser, and on the web.

![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)
![Version](https://img.shields.io/badge/Version-2.4.2.3.8-green.svg)

All QR decoding happens **locally on your device**. On macOS the desktop app uses the native **Apple Vision** framework for instant detection, with a fast bounded jsQR fallback for hard or artistic QR codes. No images, URLs, or scan data are ever sent to any server.

---

## One-Line Install (Terminal)

### macOS — Homebrew (recommended)

```bash
brew install --cask kuiqr
```

If the cask isn't available in your local Homebrew yet, install from the official tap:

```bash
brew tap LarryXu2014/kuiqr && brew install --cask kuiqr
```

After installing, **first launch only**: open Terminal and run:
```bash
xattr -cr /Applications/Kuiqr.app && open /Applications/Kuiqr.app
```

### macOS (Apple Silicon / M1, M2, M3, M4)

```bash
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-mac-arm64.zip -o ~/Downloads/Kuiqr.zip && unzip -o ~/Downloads/Kuiqr.zip -d /Applications && xattr -cr /Applications/Kuiqr.app && open /Applications/Kuiqr.app
```

> **No Homebrew?** You can also download the `.zip`, unzip it, and open `Kuiqr.app` directly (optionally drag it to Applications). The `.dmg` is also provided if you prefer a disk image.

### macOS (Intel)

```bash
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-mac-x64.zip -o ~/Downloads/Kuiqr.zip && unzip -o ~/Downloads/Kuiqr.zip -d /Applications && xattr -cr /Applications/Kuiqr.app && open /Applications/Kuiqr.app
```

> **Not sure which Mac you have?** Click   → About This Mac. If the chip says "Apple M-series" use Apple Silicon; if it says "Intel" use Intel.

### Windows (x64)

```powershell
Invoke-WebRequest -Uri "https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-windows-x64-setup.exe" -OutFile "$env:USERPROFILE\Downloads\Kuiqr-setup.exe"; Start-Process "$env:USERPROFILE\Downloads\Kuiqr-setup.exe"
```

> A **portable** `.exe` and a `.zip` are also provided if you'd rather not run an installer.

### Linux (x64 / arm64) — AppImage

```bash
# x64
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-linux-x86_64.AppImage -o ~/Downloads/Kuiqr.AppImage && chmod +x ~/Downloads/Kuiqr.AppImage && ~/Downloads/Kuiqr.AppImage
# arm64
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-linux-arm64.AppImage -o ~/Downloads/Kuiqr.AppImage && chmod +x ~/Downloads/Kuiqr.AppImage && ~/Downloads/Kuiqr.AppImage
```

> **Note:** Kuiqr runs in the background and lives in your system tray. On GNOME you may need the [AppIndicator](https://extensions.gnome.org/extension/615/appindicator-support/) extension for the tray icon to appear. A `.deb` package is also provided for Debian/Ubuntu-based distros (`Kuiqr-2.4.2.3.8-linux-{x64,arm64}.deb`).

### Chrome / Edge / Brave Extension

```bash
# Download and extract
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/kuiqr-extension-2.4.2.3.8.zip -o /tmp/kuiqr-extension-2.4.2.3.8.zip && unzip -q /tmp/kuiqr-extension-2.4.2.3.8.zip -d ~/kuiqr-extension && echo "Extension extracted to ~/kuiqr-extension — load it from chrome://extensions > Load unpacked"
```

> **After installing:** Open the extension popup, click **Record**, and press your shortcut (default **Cmd+Shift+Y** on Mac, **Ctrl+Shift+Y** on Windows). The shortcut is captured right in the popup — no need to touch `chrome://extensions/shortcuts`.

---

## Troubleshooting

### macOS shows "damaged" or "can't be opened"

This is a **macOS Gatekeeper false positive**, not actual corruption. The app is not signed with an Apple Developer certificate ($99/year), so macOS quarantines it. The file is perfectly fine — verified by `hdiutil verify` checksum.

**Fix (one-time, takes 2 seconds):**
```bash
xattr -cr /Applications/Kuiqr.app
```
Then double-click the app normally. You only need to do this once.

**Alternative:** Right-click the app → "Open" → confirm in the dialog.

### Download is very slow

GitHub's release server (`objects.githubusercontent.com`) is throttled in some regions. Use a mirror instead:

```bash
# Replace any GitHub releases URL prefix with ghproxy.com
curl -L "https://ghproxy.com/https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-mac-arm64.zip" -o ~/Downloads/Kuiqr.zip && unzip -o ~/Downloads/Kuiqr.zip -d /Applications && open /Applications/Kuiqr.app
```
If `ghproxy.com` is down, try `https://mirror.ghproxy.com/`.

---

## Download

| Platform                   | File                                                                                                                                           | Size  | Status |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| Chrome / Edge / Brave      | [kuiqr-extension-2.4.2.3.8.zip](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/kuiqr-extension-2.4.2.3.8.zip)                           | 84 KB | Verified |
| Firefox (109+)             | [kuiqr-firefox-2.4.2.3.8.zip](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/kuiqr-firefox-2.4.2.3.8.zip)                               | 84 KB | Verified |
| macOS (Apple Silicon)      | [Kuiqr-2.4.2.3.8-mac-arm64.zip](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-mac-arm64.zip)     | ~92 MB | Verified |
| macOS (Apple Silicon, .dmg)| [Kuiqr-2.4.2.3.8-mac-arm64.dmg](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-mac-arm64.dmg)     | ~95 MB | Verified |
| macOS (Intel)              | [Kuiqr-2.4.2.3.8-mac-x64.zip](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-mac-x64.zip)         | ~97 MB | Verified |
| macOS (Intel, .dmg)        | [Kuiqr-2.4.2.3.8-mac-x64.dmg](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-mac-x64.dmg)         | ~100 MB | Verified |
| macOS (Apple Silicon, .pkg)| [Kuiqr-2.4.2.3.8-mac-arm64.pkg](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-mac-arm64.pkg)     | ~95 MB | Verified |
| macOS (Intel, .pkg)        | [Kuiqr-2.4.2.3.8-mac-x64.pkg](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-mac-x64.pkg)         | ~95 MB | Verified |
| Windows (x64) — Setup      | [Kuiqr-2.4.2.3.8-windows-x64-setup.exe](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-windows-x64-setup.exe) | ~70 MB | Verified |
| Windows (x64) — Portable   | [Kuiqr-2.4.2.3.8-windows-x64-portable.exe](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-windows-x64-portable.exe) | ~70 MB | Verified |
| Windows (x64) — Zip       | [Kuiqr-2.4.2.3.8-windows-x64.zip](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-windows-x64.zip) | ~70 MB | Verified |
| Linux (x64, AppImage)      | [Kuiqr-2.4.2.3.8-linux-x86_64.AppImage](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-linux-x86_64.AppImage) | ~90 MB | Verified |
| Linux (arm64, AppImage)    | [Kuiqr-2.4.2.3.8-linux-arm64.AppImage](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-linux-arm64.AppImage) | ~90 MB | Verified |
| Linux (x64, .deb)          | [Kuiqr-2.4.2.3.8-linux-amd64.deb](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-linux-amd64.deb) | ~90 MB | Verified |
| Linux (arm64, .deb)        | [Kuiqr-2.4.2.3.8-linux-arm64.deb](https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.3.8-linux-arm64.deb) | ~90 MB | Verified |

All binaries verified: ZIPs no errors, EXE valid PE32, AppImage runs headless. (The macOS `.zip` is the recommended download — just unzip and open `Kuiqr.app`.)

---

## Features

### Browser Extension (Chrome, Edge, Firefox, Brave)

- **Right-click scan** — Right-click any QR code image → "Scan QR Code" → URL opens in a **new tab** (never replaces your current page)
- **Customizable keyboard shortcut** — Press the hotkey to dim the screen and drag-select a QR area. Record any combo you like from the popup (default `Cmd/Ctrl+Shift+Y`); the extension captures it directly — no `chrome://extensions/shortcuts` needed
- **Clipboard copy that actually works** — Scanned text is copied to your clipboard via a content-script delegate (the old service-worker copy silently failed). URLs still open in a new tab automatically
- **Scan while browsing, no new window** — Detection runs in the page you're on; scanning never spawns a separate window
- **Popup button** — Click extension icon → "Select Area to Scan" → same overlay experience, plus a scan history list
- **Generate QR codes** — Type or paste any text/URL in the popup and get a scannable QR image you can copy or download
- **Robust decoding** — Multi-strategy preprocessing handles artistic/decorative QR codes, low contrast, color backgrounds, inverted codes, and noisy images
- **Scan history** — Last 50 scans stored locally

### Desktop App (macOS, Windows, Linux)

- **No new window on trigger** — Pressing the global hotkey no longer forces a visible window open; the app behaves like a screenshot tool and only appears when you need it (it stays in the system tray)
- **In-app scan** — Paste an image from clipboard (⌘V) or drag & drop any image file — decodes instantly in the app window
- **Screen capture scan** — Global hotkey `Cmd/Ctrl+Shift+Y` opens the native macOS screen-selection (crosshair → drag a rectangle → release). On Windows it uses an in-app transparent overlay. The app window never appears during a scan.
- **Auto-detect shortcut recorder** — Click "Press keys to record" in Settings to set any hotkey combo (Cmd+Shift+A, etc.)
- **Generate QR codes** — New **Generate** tab: enter text/URL, pick error-correction level, and copy or download the QR image
- **Browser-extension priority** — When enabled (Settings; macOS only), the app **releases its global shortcut whenever a browser is the foreground app**, so the browser extension's own `Cmd/Ctrl+Shift+Y` fires instead — no double-trigger and no app window popping up. Outside browsers the app keeps the shortcut and scans as normal. Requires macOS **Automation** permission (System Settings → Privacy & Security → Automation → Kuiqr) so the app can detect the frontmost app.
- **Fixed Quit** — "Quit" from the tray now fully exits the app (previously it had to be force-quit)
- **System tray** — Runs in background; click tray icon to show/hide window
- **Right-click to scan** — Right-click anywhere in the app window for a quick menu: **Scan QR Code** (triggers a screen-selection scan), Paste Image, Settings, and Quit
- **Settings tab** — Customize shortcut (auto-record), browser-extension priority, auto-open URL, notifications, history size
- **Same robust QR decoder** as the extension — a fast tier (direct + cheap upscales, usually 1–3 attempts) handles normal QR codes instantly, with an advanced threshold/invert fallback only for hard artistic/decorative codes

### Web App (PWA — iOS, Android, Desktop)

- **Camera scanning** — Live camera feed with scan frame overlay
- **Image upload** — Upload any image containing a QR code
- **Clipboard paste** — Paste a screenshot to scan it
- **Installable** — Add to Home Screen (iOS/Android), install as PWA (desktop)

---

## Installation

### Chrome / Edge / Brave / Opera

1. Download `kuiqr-extension-2.4.2.3.8.zip` and unzip it
2. Open `chrome://extensions` (or `edge://extensions`)
3. Turn on **Developer mode** (top-right corner)
4. Click **Load unpacked**
5. Select the unzipped folder
6. Open the extension popup, click **Record**, and press your scan shortcut (default `Cmd/Ctrl+Shift+Y`)
7. Done! Right-click any QR code image or press your shortcut

### Firefox

1. Download `kuiqr-firefox-2.4.2.3.8.zip` and unzip it
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `manifest.json` inside the unzipped folder
5. The Firefox build is the same Manifest V3 add-on (with a Gecko ID baked in), packaged just like the Chrome extension — no separate folder needed.

### Desktop App

**macOS:**
1. Download the **`.zip`** (recommended) and unzip it — you get `Kuiqr.app`
2. Drag **Kuiqr.app** to Applications (or just open it from the unzipped folder)
3. **First launch only** — open Terminal and run: `xattr -cr /Applications/Kuiqr.app`
4. Double-click to open (or run `open /Applications/Kuiqr.app`)

> A `.dmg` disk image is also provided if you prefer the drag-to-Applications installer flow. The dmg uses an internet-enabled (multi-segment) format so it stays robust against partial downloads.

**Windows:** Two options — run the **`-setup.exe`** installer (recommended; adds a Start Menu entry and uninstaller), or the **portable** `.exe` / `.zip` (no install, runs from anywhere). The app stays in the **system tray** after you close the window, so the global shortcut keeps working. To fully quit, right-click the tray icon → **Quit**.

> **Windows SmartScreen ("Windows protected your PC"):** The app is not code-signed (no paid certificate), so Windows may block the first launch. This is expected for unsigned apps — click **More info → Run anyway**. You only need to do this once.

**Linux:** Run the `.AppImage` (make it executable with `chmod +x`). The app stays in the **system tray** after you close the window, so the global shortcut keeps working. To fully quit, right-click the tray icon → **Quit**. On GNOME, install the AppIndicator extension if the tray icon doesn't show. A `.deb` is also available for Debian/Ubuntu.

---

## How It Works

### In-App Scan (no overlay needed)

1. **Paste an image** — Copy a screenshot or QR image, press **⌘V** (or Ctrl+V) in the app
2. **Or drag & drop** — Drag any image file onto the Scan tab's drop zone
3. **Instant decode** — jsQR runs a fast tier first (1–3 attempts for normal codes) with an advanced fallback for hard codes
4. **URLs open automatically**; text copies to clipboard

### Screen Capture Scan

1. **Press the shortcut** (`Cmd+Shift+Y` / `Ctrl+Shift+Y`) or click the button
2. The **native screen-selection UI** appears (macOS) — crosshair cursor, drag to select the QR code area, release. Press **Esc** to cancel.
3. **Auto-decodes** (in memory — no preview window) using multi-strategy processing
4. **URLs open automatically** in your browser; text copies to clipboard. The app stays in the background.

All processing happens on your device. Zero server communication.

### Generate a QR Code

1. **App** — Open the **Generate** tab, type or paste any text/URL, pick an error-correction level (L/M/Q/H)
2. **Extension** — Open the popup, type in the **Generate** box
3. **Copy or download** the rendered QR image — it encodes exactly what you entered (text and links; images can't be embedded, so use a link to the image)

---

## What's New

### v2.4.2.3.8
- **Update status now shows the real current version** — fixed a field-name mismatch that made the "You're up to date" message display `v?` instead of the actual installed version.

### v2.4.2.3.7
- **App no longer launches invisibly after an update** — hardened menu-bar mode so the tray icon is created before the Dock icon is hidden. If the tray can't be created, the main window stays visible as a fallback. Returning users now also see a brief launch flash so it's obvious Kuiqr opened. The tray icon itself was regenerated from the approved source to be a solid, visible silhouette.

### v2.4.2.3.6
- **Update dialog now shows the real version and full release notes** — fixed a mismatch that caused "Version ? is ready" and made the release-notes block scrollable so you can read the whole update summary instead of seeing it cut off with "...".

### v2.4.2.3.5
- **Update download progress + clear instructions** — when updating, the Settings → Updates panel now shows a real progress bar with the downloaded/total size, and tells you exactly what's happening: the installer (`.dmg`) is being saved to your Downloads folder and will open automatically when done.
- **First launch never quits again** — hardened the setup-finish flow so finishing the first-launch wizard reliably keeps Kuiqr open and creates the menu-bar icon immediately. You will always see the onboarding flow after an update.
- **Far more scannable QR codes** — the decoder now runs a deeper, multi-channel pipeline (luma/red/green/blue, contrast stretch, unsharp sharpening, adaptive thresholding, multi-scale + inverted variants) so artistic/embedded QR codes that other simple scanners miss get picked up. The fast path stays instant for normal codes.

### v2.4.2.3.4
- **Menu-bar icon appears right after setup** — finishing the first-launch wizard now creates the tray icon immediately, while keeping the main window visible. The app no longer looks like it lost its menu-bar icon after setup.

### v2.4.2.3.3
- **First launch no longer quits the app** — finishing the setup wizard keeps Kuiqr open as a normal window. It only tucks into the menu bar when *you* close the window, so it never looks like it "quit" after setup.
- **Language change refreshes in place** — switching language in the setup wizard or Settings now re-translates the whole UI live. No app restart, and the setup flow is no longer interrupted.
- **Real in-app update** — when a new version is available, Kuiqr shows an in-app prompt (no GitHub link needed). "Update Now" downloads and installs it automatically: on macOS it mounts the disk image, replaces the app in `/Applications`, and relaunches the new version.
- **Cleaner Updates section** — the Settings → Updates card now has proper padding so the text and buttons no longer touch the card borders.
- **Fixed "vundefined"** — the version string is now bulletproof; the About and Update UI never show `undefined` again.
- **macOS `.pkg` installer** — the release now ships `.pkg` installers (Apple Silicon + Intel) alongside the `.dmg`/`.zip`.

### v2.4.2.3.1
- **Fixed macOS `.dmg` "disk image is corrupted" download error** — re-published the macOS dmg with `internetEnabled: true` (multi-segment UDIF format). Safari/Chrome now treat the dmg like a normal downloadable file, so a partial or interrupted download no longer trips macOS into misinterpreting the file as corrupt. Volume label is now the actual build version (`Kuiqr 2.4.2.3.1`), matching the published release. **If you hit "corrupted" on v2.4.2.3 — just re-download the dmg, or use the `.zip` which is unaffected.**
- All v2.4.2.3 features and fixes are unchanged.

### v2.4.2.3
- **Multilingual UI** — the entire desktop app interface is now translated. A new **Language** picker in Settings supports English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, and Deutsch. Your choice is remembered across restarts.
- **In-app updater** — a new **Updates** section in Settings checks GitHub for the latest release on startup (quietly) and on demand. When a newer version exists, a **Download Update** button fetches the right installer for your platform (macOS / Windows / Linux) and opens it automatically. The check is fast (8-second timeout, cached result) so it never hangs.
- **More download options** — **macOS** now ships as a simple **`.zip`** (just unzip and open `Kuiqr.app`) in addition to the `.dmg`. **Windows** now offers three ways: an **NSIS setup installer** (`-setup.exe`, recommended), a **portable** `.exe`, and a **`.zip`**. The in-app updater picks the setup installer on Windows.
- **First-run setup wizard** — new installs now get a friendly Welcome → **Language** → **Browser extension** → **Guided tour** → Done flow on first launch, replacing the old separate prompts. Skippable at any step; returning users are not re-prompted.

### v2.4.2.2
- **First-launch onboarding no longer quits the app** — after the guided tour the app stays as a normal foreground window. It only tucks into the menu bar (Dock icon removed, tray icon added) the **first time you close the main window**, so it keeps running in the background.
- **Browser-extension download prompt restored** — the first-launch prompt to install the browser extension shows again.
- **Scan notification moved to top-center** — the on-screen scan toast now appears centered at the top of the screen instead of the top-right corner.
- **Browser-extension right-click scan now notifies** — right-clicking an image containing a QR code shows a success notification ("QR Found") before acting, matching selection/overlay scans.
- **Browser-extension scanning hardened for artistic / embedded QR codes** — replaced the weak single-pass decoder with a bounded multi-strategy decoder (grayscale, contrast stretch, multi-threshold, inversion, multi-scale) mirroring the desktop app, so codes like the Chrome dinosaur QR now decode.
- **Browser-extension capture UI no longer stalls on click** — while the screen-selection overlay is "sending", pressing the screen (a stray click) no longer stops the UI; the decode runs to completion and the overlay closes cleanly, so re-pressing the shortcut doesn't appear broken.

### v2.4.2.1
- **Fixed macOS release packaging / download reliability** — republished the macOS DMG and ZIP builds as v2.4.2.1 to ensure they expand and mount correctly. (The previous v2.4.2.0 macOS assets could be truncated by an unreliable proxy during download.)
- All v2.4.2.0 features remain unchanged.

### v2.4.2.0
- **Real on-screen scan notification** — scan results now appear as a true always-on-top overlay window (its own layer above everything), not an in-app popup buried inside the app window. It never blocks your clicks.
- **Notification on scan failure too** — when a capture has no QR code (or fails to decode), you now get a "No QR Code Found" / "Scan Failed" notification instead of silence.
- **Extension install help after download** — after the browser extension downloads, a step-by-step "load into Chrome/Firefox" guide appears, followed by a visible "Tab closing in 3, 2, 1" countdown.
- **Right-click to scan inside the app** — right-click anywhere in the Kuiqr window for a quick menu with **Scan QR Code** (screen selection), Paste Image, Settings, and Quit. (Right-click-on-image scanning remains the browser extension's feature.)
- **Fixed misleading copy** — removed the "use your camera" claim (the desktop app scans screen/clipboard/images; only the web app uses a camera).

### v2.4.1.10
- **Fixed: in-app scan notification now visible** — after a scan, the success/error overlay layer was being drawn in the hidden menu-bar window, so it never appeared on screen. The main process now reveals the window before showing the toast, so the notification layer shows on every scan.
- **Fixed: "Copy QR Code" now copies a real image** — the generated QR was a GIF, which the clipboard couldn't encode, so nothing was copied. It is now re-encoded to PNG before copying; the button confirms with "Copied QR!" and a success toast. The copy handler also rejects empty/unsupported images instead of failing silently.
- **Onboarding confirmed: stays in the Dock until setup completes** — the browser-extension prompt and guided tour run as a normal foreground window; Kuiqr only drops into the menu bar after both finish. (If the app quits on first launch, an older Kuiqr instance is likely still running in the menu bar — quit it first; the single-instance lock intentionally exits the new launch.)

### v2.4.1.9
- **Tutorial spotlights all four tabs** — the guided tour now highlights Scan, History, Settings, and Generate (not just one), so the whole app is explained.
- **Instant tutorial transitions** — removed the slow fade/settle delays; every "Next" step now switches immediately.
- **Tutorial always starts on the home (Scan) tab** — replaying or starting the tour first resets to the Scan tab so the steps make sense.
- **Fixed browser-extension download (Chrome / Edge / Brave / Firefox)** — the in-app download buttons no longer fail with HTTP 404; they fall back to the latest release asset when a versioned URL is missing.
- **In-app scan notification overlay** — after a scan, a fast in-app notification layer slides in (instead of a missing/again-failing native system notification).
- **"Copy QR Code" button in Generate** — copies the generated QR *image* to the clipboard, not just the text.
- **Eliminated app-wide lag** — replaced the heavy full-screen spotlight repaint and a blocking main-thread call that were making the whole app sluggish.

### v2.4.1.5
- **New: in-app scan success popup** — after a QR code is scanned, a custom popup slides down from the top of the app window showing the result (✅ "QR Code Scanned"). It is a pure in-app UI element, **not** a system notification, and auto-hides after 3 seconds. Controlled by a new **"Show scan success popup"** setting (default ON).
- **New: in-app failure handling** — selecting an area/image with no QR code now shows an in-app "❌ No QR Code Found" popup with a hint to try a clearer area; decode/processing errors show an in-app "⚠️ Scan Failed" popup. All feedback goes through the in-app popup — no system notifications are used anymore.
- **Settings: unsaved-changes prompt now offers "Discard changes"** — leaving Settings with unsaved edits shows **Save changes** (primary) + **Discard changes**, so you can choose to keep or revert your edits before leaving.

### v2.4.1.8
- **Reordered first-launch onboarding** — on a fresh install the app now stays a normal foreground window (with its Dock icon visible) through the entire setup instead of dropping straight into the menu bar. The flow is: (1) the browser-extension download prompt, (2) a "Take a quick tour?" dialog with **Enter Tutorial** / **Maybe later**, then (3) the guided spotlight tour if you choose it. Only after the tour finishes does Kuiqr tuck itself into the menu bar. The tour is first-launch only, but you can replay it any time from **Settings → Tutorial → "Take a guided tour"**.

### v2.4.1.6
- **Dramatically faster scanning on macOS** — screen captures now use the native **Apple Vision** QR detector first, so most valid QR codes are decoded in ~100 ms. Empty or uniform areas return "No QR found" instantly instead of stalling for seconds.
- **Bounded jsQR fallback** — if Vision can't read a code, the app falls back to jsQR with strict time budgets (fast / medium / deep tiers) and an instant uniformity check, so bad selections never hang the UI.
- **Removed the "Scanning…" system notification** — the capture itself is now fast enough that the intermediate notification is unnecessary; you only see the final result popup.

### v2.4.1.4
- **Fixed: first-launch extension download no longer HTTP 404** — the in-app "Download for Chrome / Edge / Brave" and "Download for Firefox" buttons now point to the correct `v2.4.1.4` release tag. The app now reads the 4-part build version (via `extraMetadata` in package.json) for download URLs, instead of the 3-part npm version that electron-builder uses for the app's own version.

### v2.4.1.3
- **Fixed: app no longer crashes on launch with "Cannot read properties of undefined (reading 'buildVersion')"** — the packaged app now reads its version through Electron's `app.getVersion()` instead of the `build` block that electron-builder strips from the copied `package.json`.
- **Fixed: extension popup layout restored to the compact rectangular shape** — locked the popup to a clean 340px width with no white area beside the content.

### v2.4.1.2
- **Removed the "Show notifications" setting** — the toggle never worked, so it's gone. Scan-result notifications now always appear when a code is found.
- **Unsaved-changes prompt now says "Save changes"** — leaving Settings with unsaved edits offers **Save changes** (primary) + **Keep editing** instead of the dangerous "Discard changes". Your settings can no longer be lost by accident.
- **Added a Linux build** — first-class builds: AppImage and `.deb` for both x64 and arm64.
- **Bug fix: overlay temp file cleanup** — the temporary screenshot from an overlay scan is now deleted after each scan (it was previously left on disk).

### v2.4.1.1
- **Fixed: rapid tray-icon clicks no longer quit the app (macOS)** — Kuiqr now runs as a pure menu-bar / background app (no Dock icon), so repeated menu-bar clicks can't terminate it.

### v2.4.0
- **Generate tab notifications** — The Generate tab now shows system notifications when a QR code is rendered ("QR Code Generated"), when you download the PNG ("QR Code Downloaded"), and when you copy the text ("Text Copied"). All respect the "Show notifications" setting.

### v2.3.6
- **Browser-extension hotkey now works reliably (Cmd/Ctrl+Shift+Y)** — The extension now registers its shortcut via `chrome.commands` at the **browser level**, so it fires regardless of which tab/page has focus and no longer depends on a page-level keydown listener or on the desktop app releasing its global shortcut at the right moment. In a browser, pressing the shortcut now reliably triggers the extension. (The desktop app still releases its global shortcut while a browser is foreground, as before.) Custom recorded shortcuts are still supported.
- **Updated shortcut help in the extension popup** — The popup now points to `chrome://extensions/shortcuts` for changing/re-confirming the global shortcut.

### v2.3.5
- **Automation settings row auto-hides when permission is granted** — If you've already granted the macOS Automation permission (System Settings → Privacy & Security → Automation), the "macOS Automation permission" row in Settings is now hidden automatically. No more seeing a button you don't need.
- **Extension "Scanning…" notification** — The browser extension now shows a system "Scanning…" notification when you select a QR code area (same sequence as the desktop app: Scanning → Found / No QR found).

### v2.3.4
- **macOS: ask for Automation permission at launch** — On first open the app triggers macOS's native 'Kuiqr wants to control System Events' alert (a real system dialog, not a custom one). This permission lets the app detect the frontmost app so the browser-extension priority feature works. If you previously denied it, use the new Settings button to jump to the right page.
- **Settings button to System Settings Automation page** — A new 'Open System Settings → Automation' button (macOS only, in Settings) opens System Settings → Privacy & Security → Automation directly, so you can grant or review the permission.

### v2.3.3
- **Fixed: Browser-extension priority actually works now** — Previously the desktop app grabbed `Cmd/Ctrl+Shift+Y` as an OS-level global shortcut, which stole the keystroke from the browser extension (its `content.js` keydown listener never received it), so the extension couldn't trigger. Now, with priority enabled, the app **releases the global shortcut whenever a browser is the foreground app** and re-claims it outside browsers. The browser extension cleanly receives the hotkey. Requires macOS Automation permission so the app can detect the frontmost app.
- **Fixed: Notifications now appear** — Notifications were being garbage-collected before they displayed (the `Notification` object wasn't retained). They are now held for 15s so the "Scanning…" / "Opening URL" / "No QR Found" notifications actually show. Added a **"Scanning…" notification** so you get feedback the moment a capture is taken.

### v2.3.2
- **macOS scan now uses the native screen-selection UI** — Pressing the shortcut (or the tray "Scan Screen" / in-app button) now invokes the **built-in macOS screenshot selection** (`screencapture -i`). The system draws the crosshair and dim overlay itself — exactly like the native macOS QR-scan workflow. The Kuiqr app window is **never opened, shown, or brought to the front** during a scan.
- **No window, no preview, no app in the way** — The captured region is loaded directly into memory, decoded, and discarded. There is no screenshot preview and no Electron window covering your screen. The app stays quietly in the background the whole time.
- **Esc cancels cleanly** — Pressing Escape (or clicking away) cancels the scan; no screenshot is taken and no QR is processed. The app simply returns to idle.
- **App launches hidden** — On startup the app lives in the background (menu-bar / tray). Open its window anytime from the tray ("Show Window") or by clicking the dock icon. Scanning never forces the window open, and it is never hidden or minimized after a scan.
- **Windows** continues to use the in-app transparent overlay (reuses the main window — no separate window).

### v2.3.1
- **Fixed: scan overlay no longer opens a separate window** — The screen capture overlay now reuses the existing app window (transforms it in-place to fullscreen transparent mode, then restores it when done). This fixes the black-screen issue where a separate `BrowserWindow` would show black instead of the captured screen, and eliminates the "new window" popup entirely.
- **Better error feedback** — If the screen capture fails (e.g., missing Screen Recording permission on macOS), the overlay now shows a clear error message instead of a silent black screen with just a hint text.
- **Overlay uses acrylic/Material background** — On supported platforms (macOS/Windows 11), the overlay uses the OS blur-transparency material for a more native feel.

### v2.3.0
- **Browser extension now copies to clipboard** — Fixed the long-standing bug where scanning text in the extension didn't copy it. The extension now delegates the copy to a content script (service workers can't touch the clipboard directly), so scanned text lands on your clipboard just like the desktop app.
- **Customizable extension shortcut** — The extension shortcut is now recordable from the popup, exactly like the app. While recording, all QR scanning/detection is fully suspended, and re-pressing the same combo won't start a new scan. Your combo is saved and used immediately.
- **Browser-extension priority** — If both the app and the extension share the same shortcut and a browser is the foreground app, the desktop app steps aside and lets the extension handle it (macOS). This also fixes the "Chrome minimizes when I press Cmd+Shift+Y" double-trigger glitch.
- **No new window on trigger (app)** — Pressing the global hotkey no longer pops a new app window — it works like a screenshot tool and only shows the UI when needed.
- **App fully quits** — "Quit" from the tray now exits the process cleanly (no more force-quit).
- **Scan opens in a new tab (extension)** — Scanned URLs open in a new browser tab instead of replacing the page you're on.
- **Generate QR codes** — New for both the app (Generate tab) and the extension (popup): type or paste any text/URL and get a copyable/downloadable QR code.
- **Extension included in every release** — Chrome and Firefox zips are now published automatically with each release (the Firefox build is packaged from the same source with a Gecko ID). Removed the stale, duplicate `firefox/` folder from the repo.

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
Kuiqr/
├── extension/                  # Chrome / Edge / Brave / Firefox (Manifest V3)
│   ├── manifest.json           # v2.3.0 — same source builds both Chrome & Firefox zips
│   ├── background.js           # Service worker + robust QR decoder + content-script clipboard delegate
│   ├── content.js              # In-page shortcut listener + clipboard copy
│   ├── popup.html / .css / .js # Popup UI: scan history, shortcut recorder, QR generator
│   ├── jsQR.js                 # QR decoding library
│   ├── qrcode.js               # QR *generation* library (qrcode-generator)
│   └── icons/
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
# Chrome / Edge / Brave zip (straight from the source folder)
cd extension && zip -r ../kuiqr-extension-2.4.2.3.8.zip . -x "*.DS_Store"

# Firefox zip — copy source, inject a Gecko ID, then zip
rm -rf /tmp/ff-build && cp -r extension /tmp/ff-build
python3 -c "import json; p='/tmp/ff-build/manifest.json'; m=json.load(open(p)); m['browser_specific_settings']={'gecko':{'id':'kuiqr@local'}}; json.dump(m,open(p,'w'),indent=2)"
cd /tmp/ff-build && zip -r /path/to/kuiqr-firefox-2.4.2.3.8.zip . -x "*.DS_Store"
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

**GPL-3.0** — Copyright © 2026 LarryXu. Free to use, modify, and distribute under the terms of the GNU General Public License v3.0.

The full license text is in [`LICENSE`](./LICENSE).

> Note: the bundled third-party libraries **jsQR** and **qrcode-generator** retain their original **MIT** licenses and are redistributed under the GPL-3.0, which is compatible with MIT.
