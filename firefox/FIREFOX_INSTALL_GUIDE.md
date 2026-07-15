# Firefox Extension — Installation Guide

## Option A: Temporary Install (For Testing)

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on..."**
3. Select the `manifest.json` file from this `firefox/` directory
4. The extension is now active (until Firefox restarts)

## Option B: Permanent Install (Signed via AMO)

### For Users (from addons.mozilla.org)
Once published, users can install directly from:
`https://addons.mozilla.org/en-US/firefox/addon/qr-scan-open/`
(Not yet published — see below)

### For Developers (Self-Signing)
1. Install web-ext CLI:
```bash
npm install -g web-ext
```

2. Sign the extension:
```bash
cd /path/to/qr-scanner/firefox
web-ext sign --api-key=YOUR_JWT_ISSUER --api-secret=YOUR_JWT_SECRET
```
   - Get API credentials from: https://addons.mozilla.org/en-US/developers/api/key/
   - This creates a signed `.xpi` file in `web-ext-artifacts/`

3. Install the signed `.xpi`:
   - Drag and drop onto Firefox, OR
   - Go to `about:addons` → gear icon → "Install Add-on From File..."

## Option C: Unlisted/Self-Distribution
For distribution without AMO listing:
```bash
web-ext sign --api-key=YOUR_KEY --api-secret=YOUR_SECRET --channel=unlisted
```
This produces a signed `.xpi` that can be shared and installed permanently.

## Firefox Compatibility Notes

- **Manifest V3** is supported in Firefox 109+
- Uses `background.scripts` (event page) instead of `service_worker`
- `jsQR.js` is loaded via the `background.scripts` array (not `importScripts`)
- `chrome.*` API namespace works in Firefox (aliased to `browser.*`)
- `chrome.commands` (keyboard shortcuts) works in Firefox
- `chrome.tabs.captureVisibleTab` works in Firefox
- `chrome.scripting.executeScript` with `func` parameter works in Firefox 102+
- `OffscreenCanvas` is supported in Firefox 105+ (fallback to `<canvas>` included)
- `chrome.alarms` works for service worker keepalive

## Differences from Chrome Version

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Background | `service_worker` | `scripts` (event page) |
| jsQR loading | `importScripts()` | `background.scripts` array |
| Canvas in BG | `OffscreenCanvas` | `<canvas>` fallback |
| Extension ID | Auto-generated | `browser_specific_settings.gecko.id` |
| Permissions | `alarms` included | `alarms` not needed (no SW timeout) |
