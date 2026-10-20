# Delta Travel 2.0: Verification & Release Gates

## Verified locally in this handoff

- `python -m pytest -q tests/test_api.py`: check actual output from the accompanying test report.
- Python compilation and `node --check frontend/assets/app.js` (static syntax checks).
- Local browser smoke run should be repeated after any frontend changes (Chromium/Firefox + mobile widths), not assumed from API tests.
- Demo data: 6 tour codes and initial prices transcribed from `assets/js/data.js` in upstream public repo at the time of preparation. Departure schedules are invented examples and clearly labeled demo only.

## NOT VERIFIED / release blockers

1. No write access to upstream `Anniehatani/deltatrdelt2.0` in connected account: files are local handoff, not merged PR, no GitHub Actions validation in An's repo.
2. The An frontend was only viewed via GitHub API, not cloned into this environment; this bundle supplies a **safe replacement integration frontend**, not a byte-identical copy of An's HTML/CSS. An should port API calls and retain her chosen design after reviewing new flows.
3. No PostgreSQL native service/test performed. SQLite is for local development only, deliberately serialized. Thắm must produce PostgreSQL migration, full database concurrency checks, backup/restore evidence.
4. Real merchant integration (VNPay/MoMo/ZaloPay/VietQR) not configured/implemented. **Do not claim payment success or sell tours online**. Admin manual payment evidence is a demonstration workflow and assumes independent checking outside the app.
5. No trusted production date, tour inventory or company service agreement. No receipts, e-ticket, automatic refunds or secure full password recovery.
6. No distributed rate limit, durable worker for expiry, security scanning of third-party dependencies, observability, WAF, automated emails, legal/privacy compliance review, content moderation or image copyright approval.
7. API password policy is basic (length only). Apply stronger policy, risk controls and email verification before live launch.
8. Image assets load from upstream GitHub raw URL; pin/copy owned media to CDN before real public hosting. Remote Google Fonts not bundled.
9. Performance, accessibility/WCAG, browser E2E, threat model and penetration testing not certified.
10. `AUTO_CREATE_SCHEMA` works only for developer SQLite. In production, schema migration is blocked until database review.

## Critical regression cases to re-run after merge

- Signup, login, CSRF, same user can read own bookings, other user 404
- Quote price never depends on browser price, itinerary fee/discount only after server rules
- Two users compete for last seat, only one confirmed hold; no negative inventory
- Retry + same idempotency key, no duplicate; mismatch returns 409
- Cancel/timeout after retries returns inventory only once
- Stale payment after timeout does not mark paid; must review refund
- Distinct admin and customer roles, no forged role at register
- Price changed after booking does not rewrite price snapshot
- Checkout does not collect card data, no fake QR success or static e-ticket as proof
- Content/XSS and SQL injection review; mobile 360px, desktop 1440px

## Test report format

| Scope | Evidence | Status |
|---|---|---|
| API unit/integration SQLite | `tests/test_api.py` / actual run log | See `docs/LOCAL_TEST_REPORT.md` |
| Chrome UI smoke | Screenshot + browser console + interactions | See `docs/LOCAL_TEST_REPORT.md` |
| PostgreSQL integration | CI Postgres service | Pending |
| Real payment sandbox | Merchant signing/verification + finance reconciliation | Pending |
| Production deploy | HTTPS host, monitoring, migrations, backup/restore | Pending |

Release only when required gates pass for the agreed demonstration scope. No software can be honestly guaranteed 100% bug-free.
