#!/bin/bash
# Build all six macOS artifacts for the current buildVersion.
# DMG must be built alone: two "Kuiqr <ver>" volumes mounted at once collide on
# background.tiff. zip + pkg are safe to combine.
set -euo pipefail
cd "$(dirname "$0")/../desktop-app"
EB=./node_modules/.bin/electron-builder
VER=$(node -p "require('./package.json').build.buildVersion")
echo "== building Kuiqr $VER =="

unmount_stale() {
  # Must always return 0: with `set -e` an unmatched glob (no mounted volumes)
  # would otherwise abort the whole build.
  for v in /Volumes/Kuiqr*; do
    [ -d "$v" ] || continue
    echo "unmounting $v"
    hdiutil detach "$v" -quiet || true
  done
  return 0
}

# Remove any previous artifacts for this exact version so we can never ship a
# stale binary by accident.
rm -f dist/Kuiqr-"$VER"-mac-*

for arch in arm64 x64; do
  unmount_stale
  echo "---- $arch: dmg ----"
  "$EB" --mac dmg --"$arch"
  unmount_stale
  echo "---- $arch: zip + pkg ----"
  "$EB" --mac zip pkg --"$arch"
done
unmount_stale

echo "== artifacts =="
ls -la dist/Kuiqr-"$VER"-mac-*.dmg dist/Kuiqr-"$VER"-mac-*.zip dist/Kuiqr-"$VER"-mac-*.pkg
