# GitHub Setup Guide

Your repo is already created at **https://github.com/LarryXu2014/Kuiqr**

## Step 1: Push the Code

Open Terminal and run:

```bash
cd /Users/stit/WorkBuddy/2026-07-14-23-07-50/qr-scanner

# Add your GitHub remote
git remote add origin https://github.com/LarryXu2014/Kuiqr.git

# Push everything
git push -u origin main --force
git push origin v2.4.1.2
```

> **Note:** Use `git remote add` (not `set-url`) if no remote exists yet. If GitHub asks for a password, use a [Personal Access Token](https://github.com/settings/tokens) (Settings → Developer settings → PAT, `repo` scope) — passwords are no longer accepted.

> Use `--force` because your GitHub repo may already have old files. This replaces them with the new v2.1.0 code.

## Step 2: Create a GitHub Release with Binaries

1. Go to https://github.com/LarryXu2014/Kuiqr/releases
2. Click **Create a new release**
3. Choose tag: `v2.4.1.2`
4. Release title: `v2.4.1.2 — Kuiqr`
5. Description (copy-paste this):

```markdown
## v2.4.1.2 — What's New

- **Fixed: menu bar / tray icon no longer quits the app** — left-click shows/hides the window, right-click opens the menu
- **Browser-extension priority defaults to OFF** — fresh installs and migrated old settings start with priority disabled
- **Unsaved settings guard** — prompts before discarding changes when leaving the Settings tab
- **First-launch extension download prompt** — offers to download the Chrome/Edge/Brave or Firefox extension zip
- **Homebrew install support** — `brew install --cask kuiqr` after tapping `LarryXu2014/kuiqr`
- **New QR-KR icon** — used across desktop app, extension, and in-app hero
- **Windows overlay fix** — scan overlay correctly shows/focuses the window from a hidden tray state
- **Less notification noise** — Generate tab only notifies on download/copy, not on every keystroke
- **Cross-browser compatible** — Chrome, Edge, Firefox, Brave
- **Desktop app** — macOS (Apple Silicon + Intel) + Windows (x64)
- **One-line install** via Homebrew, curl, or PowerShell commands in README

## Downloads

| File | Platform |
|------|----------|
| `kuiqr-extension-2.4.1.2.zip` | Chrome / Edge / Brave / Opera |
| `kuiqr-firefox-2.4.1.2.zip` | Firefox 109+ |
| `Kuiqr-2.4.1.2-mac-arm64.dmg` | macOS Apple Silicon (M1/M2/M3/M4) |
| `Kuiqr-2.4.1.2-mac-arm64.zip` | macOS Apple Silicon (zip format) |
| `Kuiqr-2.4.1.2-mac-x64.dmg` | macOS Intel |
| `Kuiqr-2.4.1.2-mac-x64.zip` | macOS Intel (zip format) |
| `Kuiqr-2.4.1.2-windows-x64.exe` | Windows x64 (portable, no install) |

## Quick Install

**macOS Apple Silicon (Terminal):**
```
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.1.2-mac-arm64.dmg -o ~/Downloads/Kuiqr.dmg && open ~/Downloads/Kuiqr.dmg
```
After dragging to Applications, first launch: `xattr -cr /Applications/Kuiqr.app`

**macOS Intel (Terminal):**
```
curl -L https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.1.2-mac-x64.dmg -o ~/Downloads/Kuiqr.dmg && open ~/Downloads/Kuiqr.dmg
```
After dragging to Applications, first launch: `xattr -cr /Applications/Kuiqr.app`

**Windows (PowerShell):**
```
Invoke-WebRequest -Uri "https://github.com/LarryXu2014/Kuiqr/releases/latest/download/Kuiqr-2.4.1.2-windows-x64.exe" -OutFile "$env:USERPROFILE\Downloads\Kuiqr.exe"; Start-Process "$env:USERPROFILE\Downloads\Kuiqr.exe"
```

> **macOS "damaged" error?** This is a Gatekeeper false positive (not actual corruption). Run: `xattr -cr /Applications/Kuiqr.app` — one-time fix, 2 seconds.
```

6. **Upload these files** from your local `releases/` folder:
   - `kuiqr-extension-2.4.1.2.zip` (~84 KB)
   - `kuiqr-firefox-2.4.1.2.zip` (~84 KB)
   - `Kuiqr-2.4.1.2-mac-arm64.dmg` (~95 MB)
   - `Kuiqr-2.4.1.2-mac-arm64.zip` (~92 MB)
   - `Kuiqr-2.4.1.2-mac-x64.dmg` (~100 MB)
   - `Kuiqr-2.4.1.2-mac-x64.zip` (~97 MB)
   - `Kuiqr-2.4.1.2-windows-x64.exe` (~70 MB)

7. Click **Publish release**

## Step 3: Done!

Your repo is live at **https://github.com/LarryXu2014/Kuiqr**

People can now:
- Copy the curl command from the README to install instantly
- Download individual files from the Releases page
- Star and fork the repo
