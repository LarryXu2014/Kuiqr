<!-- Copyright 2026 LarryXu. Licensed under GPL-3.0. -->
# Kuiqr — User Guide

Everything Kuiqr can do, and how to do it. Pick what you need:

| I want to… | Jump to |
|---|---|
| Install the app | [Installation](#1-installation) |
| Scan a QR code that's on my screen | [Scanning — Screen](#21--scan-a-qr-code-on-your-screen) |
| Scan an image file or screenshot | [Scanning — In-App](#22--scan-an-image-in-the-app) |
| Scan with my phone | [Scanning — Web App](#23--scan-with-your-phone-web-app) |
| Scan inside my browser | [Scanning — Browser Extension](#24--scan-inside-your-browser-extension) |
| Make a QR code | [Generating QR Codes](#3--generating-qr-codes) |
| Make a QR code that counts scans | [Trackable QR Codes](#4--trackable-qr-codes) |
| Watch a spot on screen for codes | [Region Watch](#5--region-watch) |
| Change shortcut / language / colors | [Settings](#6--settings) |
| Understand scan history | [History](#7--history) |
| Something's not working | [Troubleshooting](#8--troubleshooting) |

---

## 1. Installation

### Desktop App (macOS / Windows / Linux)

The app installs in ~30 seconds and lives in your **system tray** (macOS: menu bar) after you close the window — that's normal, not a bug. It stays there so your global scan shortcut keeps working in the background. To fully quit: right-click the tray icon → **Quit**.

<details>
<summary><b>macOS — Homebrew (easiest)</b></summary>

```bash
brew install --cask kuiqr
```

If the cask isn't in your local Homebrew yet:

```bash
brew tap LarryXu2014/kuiqr && brew install --cask kuiqr
```

First launch only (clears Gatekeeper quarantine, one time):

```bash
xattr -cr /Applications/Kuiqr.app && open /Applications/Kuiqr.app
```
</details>

<details>
<summary><b>macOS — Direct download</b></summary>

```bash
# Apple Silicon (M1/M2/M3/M4)
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.5.2-mac-arm64.zip -o ~/Downloads/Kuiqr.zip && unzip -o ~/Downloads/Kuiqr.zip -d /Applications && xattr -cr /Applications/Kuiqr.app && open /Applications/Kuiqr.app

# Intel
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.5.2-mac-x64.zip -o ~/Downloads/Kuiqr.zip && unzip -o ~/Downloads/Kuiqr.zip -d /Applications && xattr -cr /Applications/Kuiqr.app && open /Applications/Kuiqr.app
```

Not sure which Mac you have?  → About This Mac — "Apple M-series" = Apple Silicon, "Intel" = Intel.
</details>

<details>
<summary><b>Windows</b></summary>

```powershell
# Setup installer (recommended)
Invoke-WebRequest -Uri "https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.5.2-windows-x64-setup.exe" -OutFile "$env:USERPROFILE\Downloads\Kuiqr-setup.exe"; Start-Process "$env:USERPROFILE\Downloads\Kuiqr-setup.exe"
```

A **portable** `.exe` and a `.zip` are also on the release page if you'd rather not run an installer. Windows SmartScreen may warn on first launch (the app is unsigned) — click **More info → Run anyway**. You only see this once.
</details>

<details>
<summary><b>Linux (AppImage / .deb)</b></summary>

```bash
# x64 AppImage
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.2.5.2-linux-x86_64.AppImage -o ~/Downloads/Kuiqr.AppImage && chmod +x ~/Downloads/Kuiqr.AppImage && ~/Downloads/Kuiqr.AppImage
```

`.deb` packages (`Kuiqr-2.4.2.5.2-linux-{amd64,arm64}.deb`) are on the release page for Debian/Ubuntu. On GNOME, install the [AppIndicator](https://extensions.gnome.org/extension/615/appindicator-support/) extension if the tray icon doesn't appear.
</details>

### Browser Extension (Chrome / Edge / Brave / Firefox)

1. Download `kuiqr-extension-2.4.2.5.2.zip` (or `kuiqr-firefox-2.4.2.5.2.zip`) from the [latest release](https://github.com/LarryXu2014/Kuiqr/releases/latest) and unzip it
2. **Chrome / Edge / Brave:** open `chrome://extensions` → enable **Developer mode** (top-right) → **Load unpacked** → select the unzipped folder
3. **Firefox:** open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json` inside the unzipped folder
4. Open the extension popup, click **Record**, and press your shortcut (default **Cmd+Shift+Y** / **Ctrl+Shift+Y**)

The desktop app's first-run wizard can also download and install the extension for you automatically.

### Web App (any phone, no install)

Open the web app link (in the README) on your phone's browser → point the camera at any QR code. Add it to your Home Screen to keep it as an app.

---

## 2. Scanning

Kuiqr gives you **four** ways to scan. All decoding happens **locally on your device** — nothing is uploaded anywhere.

| Method | Best for |
|---|---|
| Screen scan (global shortcut) | QR codes anywhere on screen — other apps, videos, PDFs |
| In-app scan (paste / drag-drop) | Screenshots and image files you already have |
| Browser extension | QR codes inside web pages |
| Web app (phone camera) | Printed QR codes, posters, packages |

### 2.1 · Scan a QR code on your screen

1. Press your global shortcut — **Cmd+Shift+Y** on macOS, **Ctrl+Shift+Y** on Windows/Linux (change it in Settings)
2. **macOS:** the native screenshot crosshair appears → drag a rectangle around the QR code → release
   **Windows/Linux:** the screen dims → drag to select the area → release
3. That's it. The code is decoded **in memory** — no preview window, no screenshot saved to disk. Press **Esc** to cancel.

**What happens with the result** (Kuiqr acts like your phone's camera would):

| QR content | What Kuiqr does |
|---|---|
| URL | Opens it in your browser (toggle in Settings → Scan behavior) |
| Wi-Fi network | Offers to **join the network** — runs the OS Wi-Fi join for you |
| Contact (vCard) | Opens the **Contacts app** with the card ready to save |
| Calendar event | Opens **Calendar** with the event ready to add |
| Location (GPS) | Opens **Maps** at those coordinates |
| Phone number | Opens the phone/dialer app |
| Email address | Opens a **new email draft** |
| SMS number | Opens a new SMS with the number filled in |
| Plain text | Copies to clipboard |

Every result is also copied to your clipboard and saved to History.

### 2.2 · Scan an image in the app

1. Open the Kuiqr window (click the tray icon, or launch the app)
2. On the **Scan** tab, either:
   - **Paste** an image with **⌘V / Ctrl+V** (a screenshot or image copied anywhere)
   - **Drag & drop** an image file onto the drop zone
3. The result card shows the decoded content with a type badge (Wi-Fi, Contact, Event…) and action buttons (Open, Join, Copy…).

### 2.3 · Scan with your phone (Web App)

1. Open the web app URL on your phone
2. Tap **Start Camera** → point at the QR code
3. You can also **upload** an image or **paste** a screenshot there.

### 2.4 · Scan inside your browser (Extension)

- **Right-click any image** containing a QR code → **Scan QR Code** → the URL opens in a new tab and the text is copied
- **Press the shortcut** → the screen dims → drag-select the QR area → release. Works even on non-image content (canvas, video frames, embedded widgets)
- The popup keeps your **last 50 scans** and can also generate QR codes

> **Tip:** If both the desktop app and the extension use the same shortcut, enable **Browser-extension priority** in the app's Settings (macOS). The app steps aside whenever a browser is the frontmost app, so the extension fires instead — no double-trigger.

---

## 3 · Generating QR Codes

Open the **Generate** tab in the desktop app.

### Templates

Pick a content type from the template picker — Kuiqr builds the properly-formatted payload for you (so phones recognize it):

| Template | Fills in | Phone behavior when scanned |
|---|---|---|
| **Text / URL** | Any text or link | Opens/copies |
| **Wi-Fi** | Network name (SSID) + password + security | Prompts to join |
| **Contact (vCard)** | Name, phone, email, org, notes | Opens contact card to save |
| **Event** | Title, location, start/end times | Opens "add to calendar" |
| **Email** | Address + subject + body | Opens email draft |
| **SMS** | Number + message | Opens SMS app |
| **Phone** | Number | Opens dialer |
| **Location** | Latitude + longitude | Opens Maps |

**Wi-Fi tip:** click **Scan nearby** to pick your SSID from the networks your computer sees — no typing, no typos.

### Styling

Expand the **Style** panel to customize:

- **Dot style** — Square (classic), Rounded, or Dots
- **Colors** — module color + background
- **Error correction** — L / M / Q / H (higher = more damage-tolerant, denser code)
- **Logo** — embed an image in the center. The app automatically uses the strongest error correction (H) and runs a **self-check**: it scans the rendered QR with its own decoder and warns you if it became unreadable
- **Margin** — quiet zone size

Your style is remembered between sessions. **Reset to default style** puts everything back.

### Export

Expand the **Export** panel:

- **PNG** (multiple size presets)
- **SVG** (vector, infinitely scalable — best for print)
- **PDF** (300 DPI, print-ready)

The **Copy QR code** button puts the QR image itself on your clipboard.

### Batch generation

Have a CSV of many items (e.g., an asset list)? **Batch** lets you map a column to a template field, generates every code, and zips them. Great for inventory tags, event badges, classroom sets.

### Trackable QR (see below)

Flip on **Trackable** to make the code count scans. Only **URL** destinations can be trackable (Wi-Fi/contact payloads can't be a redirect — that's a technical limit of how tracking works, not a Kuiqr restriction).

---

## 4 · Trackable QR Codes

A trackable QR doesn't contain your link directly — it contains a **short link** (e.g. `http://192.168.1.20:3000/dWmUIQr`). When scanned, that short link:

1. **Logs the scan** (time, device type, OS, country)
2. **Redirects** instantly to your real destination

The app then shows stats: total scans, unique scans, scans per day, by country, by device.

### How to create one

1. Generate tab → pick a **URL** template → enter your destination link
2. Expand **Style/Track** panel → toggle **Trackable** on
3. If the local tracking service isn't running yet, the app **starts it automatically** — no setup needed
4. Scan the code with a phone → open **Settings → Dynamic QR → Stats** (auto-refreshes every 10 seconds)

### Where the data lives (and why phones need the same Wi-Fi)

The tracking service runs **on your computer**. Short links point at your machine's LAN address (like `192.168.1.20`), so:

- ✅ **No server bills, no accounts, fully private** — scan data never leaves your network
- ⚠️ **Phones must be on the same Wi-Fi/network** as this computer
- ⚠️ The computer must be **awake** with Kuiqr running
- ⚠️ If your computer's IP changes (DHCP), the app auto-detects and re-syncs — but **already-printed QR codes keep the old IP** and need regenerating

Your own scans (from the Kuiqr app itself) don't inflate the numbers — owner scans are recognized and not counted.

> **Want trackable QRs that work from anywhere in the world?** The tracking service is a standard web service — you can deploy it to any small host (Fly.io, Render, Railway, a VPS) and point the app at it in **Settings → Dynamic QR → Backend URL**. Then codes work 24/7 on any network.

---

## 5 · Region Watch

Region Watch turns a part of your screen into a **live QR scanner** — Kuiqr keeps watching that rectangle and reacts the moment a new code appears. Great for:

- A conference kiosk cycling through attendee codes
- A payment terminal screen
- Any app that displays QR codes you need to catch

### How to use

1. Open the app → **Scan tab → Region Watch** (or tray menu)
2. Your screen dims → **drag a rectangle** around the area to watch → release
3. A small floating indicator shows watching is active. Kuiqr now checks that region several times a second, **even while the window is hidden**
4. When a **new** code appears, it's decoded and handled like a normal scan (open URL, join Wi-Fi, etc.)
5. **Pause/resume** anytime from the tray menu; watching also auto-pauses while you're in the Settings tab

> **macOS note:** the first time you use it, macOS asks for **Screen Recording** permission (System Settings → Privacy & Security → Screen Recording → Kuiqr). Grant it and reopen the app — without it the capture returns nothing.

---

## 6 · Settings

Open the app → **Settings** tab.

| Section | What it controls |
|---|---|
| **Scan behavior** | Auto-open URLs, history size, scan actions |
| **Shortcut** | Record any global hotkey (click "Press keys to record") |
| **Browser-extension priority** | Let the extension own the shortcut while a browser is focused (macOS; needs Automation permission) |
| **Language** | English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Deutsch |
| **Appearance** | Accent color themes for the whole UI |
| **Dynamic QR** | Trackable QR backend, codes list, scan stats (collapsible) |
| **Updates** | Check for new versions, download & install in-app |
| **Tutorial** | Replay the guided tour |

Changes save when you leave the Settings tab (you'll be asked if you have unsaved edits).

---

## 7 · History

The **History** tab keeps your recent scans (up to your history-size setting, default 50). Each entry shows:

- Type badge (URL / Wi-Fi / Contact / Event / Text…)
- The content, truncated if long
- When it was scanned

Click an entry to re-open its action buttons — rescan-day convenience without re-scanning.

---

## 8 · Troubleshooting

<details>
<summary><b>macOS says the app is "damaged" or "can't be opened"</b></summary>

Gatekeeper false positive (the app is unsigned). One-time fix:

```bash
xattr -cr /Applications/Kuiqr.app
```
</details>

<details>
<summary><b>The .pkg installer is blocked</b></summary>

Use the `.zip` or `.dmg` instead. If you must use the `.pkg`: let it be blocked → System Settings → Privacy & Security → scroll down → **Open Anyway** → re-run the installer.
</details>

<details>
<summary><b>Windows SmartScreen warning</b></summary>

Normal for unsigned apps. Click **More info → Run anyway** (once).
</details>

<details>
<summary><b>Screen scan / Region Watch captures nothing (macOS)</b></summary>

Grant **Screen Recording** permission: System Settings → Privacy & Security → Screen Recording → enable Kuiqr → fully quit and reopen the app.
</details>

<details>
<summary><b>Screen scan picks the wrong monitor (Windows)</b></summary>

Move your cursor onto the monitor with the QR code before pressing the shortcut — capture follows the cursor's display.
</details>

<details>
<summary><b>Trackable QR says "can't reach page" on a phone</b></summary>

The phone isn't on the same network as the computer running Kuiqr (short links use the computer's LAN address). Join the same Wi-Fi and try again — or deploy the tracking backend publicly (see Trackable QR Codes above).
</details>

<details>
<summary><b>Stats show fewer scans than expected</b></summary>

- Stats auto-refresh every 10 s while the panel is open — or hit the **Refresh** button
- Scans **you** make with the Kuiqr app aren't counted (owner scans don't inflate stats)
- Phones on cellular/other networks can't reach a LAN backend
</details>

<details>
<summary><b>App "quits" on first launch</b></summary>

An older Kuiqr instance is probably still running in the menu bar (single-instance lock). Quit it from its tray icon first, then relaunch.
</details>

<details>
<summary><b>Downloads are slow</b></summary>

GitHub's release server is throttled in some regions. Prefix any download URL with `https://ghproxy.com/` (e.g. `https://ghproxy.com/https://github.com/LarryXu2014/Kuiqr/releases/latest/download/…`).
</details>

---

## Privacy

All QR **scanning and generation happens locally** on your device. No images, URLs, or scan data are ever sent to any server. The only network features are:

- **Update checks** — the app asks GitHub for the latest release version
- **Trackable QR codes** — an optional local service *you* run; scan logs stay on your machine unless you deliberately deploy the backend elsewhere

Source code is fully open for audit under GPL-3.0.
