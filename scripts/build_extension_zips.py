#!/usr/bin/env python3
"""Build the Chrome/Edge/Brave and Firefox extension zip artifacts.

Produces, into ../releases (relative to this script):
  - kuiqr-extension-<VERSION>.zip   (Chrome / Edge / Brave; MV3 service_worker)
  - kuiqr-firefox-<VERSION>.zip     (Firefox; same files + browser_specific_settings.gecko)

The Firefox build is byte-for-byte identical to Chrome except for the added
`browser_specific_settings.gecko` block (id + strict_min_version 109.0).
Both zips store files at the archive ROOT (no enclosing folder), which is what
the browser loaders expect.

Usage:
  python3 scripts/build_extension_zips.py            # uses version from manifest.json
  python3 scripts/build_extension_zips.py 2.4.2.5.1  # explicit version
"""
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(ROOT, "extension")
REL = os.path.join(ROOT, "releases")
GECKO_ID = "kuiqr@larryxu.app"
GECKO_MIN = "109.0"


def version():
    if len(sys.argv) > 1:
        return sys.argv[1]
    with open(os.path.join(EXT, "manifest.json"), encoding="utf-8") as f:
        return json.load(f)["version"]


def iter_files():
    """Yield (archive_name, abs_path) for every non-hidden file under EXT."""
    for dirpath, dirnames, filenames in os.walk(EXT):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for fn in filenames:
            if fn.startswith("."):
                continue
            abs_path = os.path.join(dirpath, fn)
            rel_path = os.path.relpath(abs_path, EXT)
            yield rel_path, abs_path


def build(zip_name, transform_manifest=None):
    out_path = os.path.join(REL, zip_name)
    os.makedirs(REL, exist_ok=True)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        for arc_name, abs_path in iter_files():
            if arc_name == "manifest.json" and transform_manifest:
                data = transform_manifest(abs_path)
                z.writestr(arc_name, data)
            else:
                with open(abs_path, "rb") as fh:
                    z.writestr(arc_name, fh.read())
    size = os.path.getsize(out_path)
    print(f"  wrote {zip_name} ({size} bytes)", flush=True)
    return out_path


def main():
    ver = version()
    print(f"Building extension zips for version {ver}", flush=True)
    # Chrome / Edge / Brave: repo files verbatim.
    build(f"kuiqr-extension-{ver}.zip")
    # Firefox: same files + gecko block (manifest re-dumped with indent=2).
    def ff_manifest(abs_path):
        with open(abs_path, encoding="utf-8") as f:
            m = json.load(f)
        m["browser_specific_settings"] = {
            "gecko": {"id": GECKO_ID, "strict_min_version": GECKO_MIN}
        }
        return json.dumps(m, indent=2, ensure_ascii=False) + "\n"
    build(f"kuiqr-firefox-{ver}.zip", transform_manifest=ff_manifest)
    print("=== DONE ===", flush=True)


if __name__ == "__main__":
    main()
