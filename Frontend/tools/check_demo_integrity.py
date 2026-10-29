"""Contract checks for An's STATIC DEMO. Not a real payment/security audit.

Must run before any deployment of Frontend/; fails if a UI change quietly
restores client-side PAID or card/CVV input.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    admin = (ROOT / "admin.html").read_text(encoding="utf-8")
    js = (ROOT / "assets/js/main.js").read_text(encoding="utf-8")
    auth = (ROOT / "assets/js/auth.js").read_text(encoding="utf-8")
    errors = []

    for name, source in (("index", index), ("admin", admin)):
        if "delta-demo-notice" not in source:
            errors.append(name + ": missing permanent demo warning")

    for forbidden in ("id=\"cardCvv\"", "id=\"cardNum\"", "id=\"cardExpiry\""):
        if forbidden in index:
            errors.append("index: sensitive card input " + forbidden)

    if "const isPaid = false;" not in js:
        errors.append("main.js: client-side booking must never self-confirm PAID")
    if 'const statusCode = "PENDING_DEMO";' not in js:
        errors.append("main.js: booking must be marked demo-only")
    if "cccd: \"Không thu thập (bản demo)\"" not in js:
        errors.append("main.js: must not persist ID card numbers to localStorage")

    if "localStorage.setItem(AUTH_STORAGE_KEYS.USERS" not in auth:
        errors.append("auth.js: offline demo flag may be out of sync")
    if "DEMO" not in admin.upper():
        errors.append("admin.html: admin operations must be clearly mock")

    for e in errors:
        print("FAIL " + e)
    if errors:
        return 1
    print("PASS: demo UI is labeled; no card/CVV input; client-side booking cannot mark PAID.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
