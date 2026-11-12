"""Contract checks for An's STATIC DEMO. Not a real payment/security audit.

Must run before any deployment of Frontend/; fails if a UI change quietly
restores client-side PAID or card/CVV input.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    booking = (ROOT / "booking.html").read_text(encoding="utf-8")
    admin = (ROOT / "admin.html").read_text(encoding="utf-8")
    js = (ROOT / "assets/js/controllers/main.js").read_text(encoding="utf-8")
    admin_js = (ROOT / "assets/js/controllers/admin.js").read_text(encoding="utf-8")
    auth = (ROOT / "assets/js/controllers/auth.js").read_text(encoding="utf-8")
    errors = []

    for name, source in (("index", index), ("booking", booking)):
        for forbidden in ("id=\"cardCvv\"", "id=\"cardNum\"", "id=\"cardExpiry\""):
            if forbidden in source:
                errors.append(f"{name}: sensitive card input {forbidden}")

    if "const isPaid = false;" not in js:
        errors.append("main.js: client-side booking must never self-confirm PAID")
    if 'const statusCode = "PENDING_DEMO";' not in js:
        errors.append("main.js: booking must be marked demo-only")
    if ('cccd: "Không thu thập (bản demo)"' not in js and 'cccd: "Theo CCCD khách hàng"' not in js) or "cccd: cccd" in js:
        errors.append("main.js: must not persist raw ID card numbers to localStorage")
    if 'id="customerCCCD"' in booking:
        errors.append("booking.html: must not collect raw CCCD input")

    if "localStorage.setItem(AUTH_STORAGE_KEYS.USERS" not in auth:
        errors.append("auth.js: offline demo flag may be out of sync")
    if 'id="adminLockScreen"' not in admin or "DeltaAPI.getMe" not in admin_js:
        errors.append("admin: admin access must stay gated by server session verification")

    for e in errors:
        print("FAIL " + e)
    if errors:
        return 1
    print("PASS: no card/CVV capture; no raw CCCD persistence; client-side booking cannot mark PAID; admin gated by server auth.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
