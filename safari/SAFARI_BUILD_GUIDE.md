# Safari Web Extension — Build Guide

Safari supports Web Extensions (Manifest V3) starting from **macOS 14 (Sonoma) / Safari 17**.
The extension code is identical to the Chrome version, but Safari requires wrapping it in a
macOS app via Xcode. Here's how to do it.

## Prerequisites

- macOS 14+ (Sonoma or later)
- Xcode 15+ (free from the Mac App Store)
- Safari 17+

## Step 1: Convert the Extension

1. Open **Terminal**
2. Run the Safari conversion tool:

```bash
cd /path/to/qr-scanner/safari
xcrun safari-web-extension-converter ../extension \
  --project-location . \
  --app-name "QR Scan and Open" \
  --bundle-identifier com.qrscanopen.safari \
  --no-open \
  --copy-resources \
  --swift
```

This creates an Xcode project (`QR Scan and Open/`) that wraps the extension as a macOS app.

## Step 2: Build and Run

1. Open the generated Xcode project:
```bash
open "QR Scan and Open/QR Scan and Open.xcodeproj"
```

2. In Xcode:
   - Select the **QR Scan and Open (macOS)** scheme
   - Press **Cmd+R** to build and run
   - The app will launch and prompt you to enable the extension in Safari

3. In Safari:
   - Go to **Safari → Settings → Extensions**
   - Enable **QR Scan and Open**
   - Grant the requested permissions

## Step 3: For Distribution (Optional)

To distribute outside of development:

### Option A: Developer ID (Direct Download)
1. Enroll in the Apple Developer Program ($99/year)
2. In Xcode: **Product → Archive**
3. Distribute via **Developer ID** (notarized .app bundle)
4. Users download, drag to /Applications, and enable in Safari

### Option B: Mac App Store
1. Enroll in the Apple Developer Program
2. In Xcode: **Product → Archive → Distribute App → App Store**
3. Submit for review

## Step 3 (Alternative): Sideload for Personal Use

If you just want to use it yourself without a developer account:

1. Build the Xcode project with your Apple ID
2. The app runs from Xcode's Derived Data folder
3. Enable the extension in Safari Settings
4. Note: You'll need to rebuild every 7 days unless you have a paid developer account

## Safari-Specific Notes

- `chrome.commands` (keyboard shortcuts) are **NOT supported** in Safari Web Extensions.
  The popup button ("Select Area to Scan") works as the alternative.
- `chrome.tabs.captureVisibleTab` works in Safari 17+.
- `chrome.scripting.executeScript` with `func` parameter works in Safari 17+.
- `OffscreenCanvas` is supported in Safari 17+.
- `chrome.alarms` is supported.
- Right-click context menu (`chrome.contextMenus`) works in Safari 17+.

## Manifest Compatibility

The Chrome `manifest.json` is directly compatible with Safari. No changes needed.
The `service_worker` background type is supported in Safari 17+.

If targeting Safari 16 or earlier (not recommended), you would need to use
`background.scripts` instead of `background.service_worker` (like the Firefox version).
