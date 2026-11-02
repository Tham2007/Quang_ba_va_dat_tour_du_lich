# Delta Travel Group 6 · Real HTTP API staging (02/11/2026)

## Two verified systems and why we must not call them one

- **An visual frontend**: https://delta-travel-group6-kthp-demo.onrender.com/ is a static site built from `Frontend/` and persists tour/booking/role in browser localStorage only. It is a DESIGN PREVIEW; it does **not** communicate with the backend or SQL Server.
- **FastAPI functional frontend**: `API/frontend/` calls same-origin `/api/v1/*` endpoints with HTTP cookie session and CSRF, and server-side price, booking, cancellation, audit/ADMIN. To be served from a separate Render service; database initially SQLite in a transient container. This demonstrates end-to-end Browser → FastAPI → SQL database **inside one running server**, not durable DB/storage.
- **Thắm SQL Server 12-table project**: [PR #16](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/pull/16) and [#17](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/pull/17) validated actual Microsoft SQL Server 2022 in **ephemeral GitHub CI**. Separate read-only FastAPI adapter; public booking/payment SQL Server writes intentionally blocked pending auth/RBAC/idempotency design. The SQL Server server is **not hosted on Render**, and must not be described as deployed.

## Deploy the functional FastAPI demo

Render web service from `https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich`, Python, Singapore, free plan, branch `main` after reviewed PR:
- Build: `python -m pip install -r API/requirements.txt`
- Start: `cd API && python -m uvicorn api.app:app --host 0.0.0.0 --port ${PORT:-10000}`
- `DELTA_ENV=staging`, `AUTO_CREATE_SCHEMA=1`, `DEMO_SEED=1`, `DATABASE_URL=sqlite:////tmp/delta_kthp_staging.db`.
- Secure + SameSite Strict cookies are enforced for staging. No account with fixed administrative password is seeded.
- **Do not enter real personal data or payment info**; this server holds only test records and its filesystem can reset on redeploy/restart.
- Verify `GET /api/v1/health/ready` 200; `GET /api/v1/tours` returns 6 demo tours; `GET /` loads the functional API-connected UI. Test registering synthetic account, booking, status and cancellation in a browser.
- The payment confirmation endpoint requires ADMIN and prior external bank reconciliation; no real payment rail is connected. Do not record transactions in public demo.
- Admin promotion for real deployment must be separately controlled, no admin demo credential published.

## Path to a persistent production-like DB

The repo `API/api/models.py` and versioned migrations in `database/database/migrations` form a **separate PostgreSQL seven-table schema**, not Thắm's 12-table SQL Server design. An explicit architecture decision is required before choosing it as the official project database.

A separate free Render PostgreSQL trial was provisioned for testing at https://dashboard.render.com/d/dpg-dbk4dpgu01pc739150dg-a. It is scheduled to expire on 02/12/2026 and is NOT yet connected to the API. Render integration does not reveal credentials, so a human with dashboard access must set the `DATABASE_URL` secret through Render's UI; never paste secret into issue, Markdown, Zalo or CI logs. Switch `DELTA_ENV=production`, `AUTO_CREATE_SCHEMA=0`, `DEMO_SEED=0` and apply audited Alembic migration (not `create_all`), **only after** approval and staging migration tests. Alternative: obtain persistent SQL Server 12-table test instance and build the missing write adapter.

## Release gates

- [ ] Distinguish An visual localStorage demo from connected FastAPI UI in final presentation.
- [ ] Static staging and FastAPI functional staging accessible externally with 200 health and proper assets.
- [ ] Synthetic register/login/logout, quote/book/cancel verified over HTTP and database, no 500 errors.
- [ ] A persistent SQL server/PG database chosen + migration/backup/rollback + secret configured.
- [ ] An's exact UI connected to server-backed authentication, inventory, booking and admin (not localStorage).
- [ ] Full QA on real host including concurrent booking, CSRF, IDOR and external bank evidence.
- [ ] No real customer payments, credentials or identity documents in demo.
