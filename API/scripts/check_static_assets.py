"""Audit HTML/CSS local static references (especially missing .woff2/.ico).
Run from API/: python -m scripts.check_static_assets [path/to/frontend]
Does not download fonts or modify any files.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

# Only assets that a browser fetches locally. No false alarms for API routes.
ASSET_SUFFIXES = {".woff2", ".woff", ".ttf", ".otf", ".eot",
                  ".svg", ".ico", ".png", ".jpg", ".jpeg", ".webp", ".css", ".js"}
CSS_URL = re.compile(r"url\(\s*['\"]?([^)'\"]+)['\"]?\s*\)", re.IGNORECASE)
HTML_URL = re.compile(r"\b(?:src|href)\s*=\s*['\"]([^'\"]+)['\"]", re.IGNORECASE)


def refs(path: Path) -> list[str]:
    content = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".css":
        return CSS_URL.findall(content)
    return HTML_URL.findall(content)


def missing_static_files(root: Path) -> list[dict[str, str]]:
    root = root.resolve()
    if not root.is_dir():
        raise ValueError("Frontend directory does not exist")
    missing = []
    for file in sorted((*root.rglob("*.html"), *root.rglob("*.css"))):
        for raw in refs(file):
            raw = raw.strip()
            if not raw or raw.startswith(("//", "#", "data:", "mailto:")):
                continue
            url = urlsplit(raw)
            if url.scheme or url.netloc:
                continue
            path = url.path
            if not path or Path(path).suffix.lower() not in ASSET_SUFFIXES:
                continue
            resolved = root.joinpath(path.lstrip("/")) if path.startswith("/") else file.parent.joinpath(path)
            # Never touch or traverse outside the frontend during the audit.
            resolved = resolved.resolve()
            if not resolved.is_relative_to(root) or not resolved.is_file():
                missing.append({"source": str(file.relative_to(root)), "reference": raw})
    return missing


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "frontend"
    try:
        missing = missing_static_files(root)
    except (ValueError, OSError, UnicodeError) as exc:
        print(f"STATIC_AUDIT_ERROR: {type(exc).__name__}")
        return 2
    if missing:
        print(f"FAIL: {len(missing)} missing local assets:")
        for item in missing:
            print(f"  {item['source']}: {item['reference']}")
        return 1
    print("PASS: HTML/CSS local static assets resolved; fonts without a local file are not referenced.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
