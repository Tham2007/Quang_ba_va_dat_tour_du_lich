# DELTA TRAVEL 2.0: end-to-end demo handoff

**Status:** runnable academic demo, **NOT** production-certified online tour sales. Companion code for `https://github.com/Anniehatani/deltatrdelt2.0`, which is currently a static HTML/CSS/JS app. This ZIP is a separate delivery since the connected GitHub user has read-only access to An's repository.

## MVC-style application structure

FastAPI still runs as `api.app:app`. The backend is split into route registration, HTTP controllers, business services, repositories, ORM models, validation schemas and shared core infrastructure. The main browser UI is in the repository-level `Frontend/`; tests, docs and scripts remain separate. PostgreSQL/SQLite API persistence and the separate SQL Server adapter use different schemas. See `docs/MVC_REFACTOR_20261103.md`.

## Setup (Windows PowerShell / Linux / macOS)

Install Python 3.11 or later. Extract ZIP, enter project directory and run:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn api.app:app --host 127.0.0.1 --port 8000 --reload
```

On Windows if `python` is not found use `py -3`. Browser: `http://127.0.0.1:8000/`; OpenAPI interactive docs: `http://127.0.0.1:8000/docs`. Local SQLite file `delta_dev.db` is automatically created; 6 demo tours and **synthetic schedules** seeded once. All services run from one host to avoid CORS misconfiguration.

**Do not open `../Frontend/index.html` directly via file://**; always use the server for cookie/session and API. Do not use real identity documents or banking information in demo.

## Functional flows

1. Tour catalog search with destination, region, departure point/date, price,
   duration, transport, audience, availability, sorting and pagination.
   Catalog responses contain `items`, `total`, `page`, `pageSize` and
   `totalPages`; multiple tour images are returned in `images`.
2. Register/login/logout with scrypt password hash, hashed opaque session cookie (HttpOnly, SameSite=Strict) and CSRF token.
3. Read multiple future schedules/stock, receive quote from server; hold seats
   for 15 minutes with idempotent booking key, timeout and cancellation.
   Booking requires a 12-digit CCCD, stored only by the SQLite/PostgreSQL API
   and excluded from booking responses, browser storage and tickets. The demo
   warns users not to submit real identity documents.
4. View own bookings; can't read other customers' bookings. Changing price leaves old bookings' price snapshots intact.
5. Admin APIs for tour price/status, schedule creation/capacity, private per-person cost breakdown, structured day-by-day itinerary (meals, accommodation, activities and team building), audit trail, metrics and **manual verified-bank-reference** payment recording. Public APIs expose the sale price and itinerary but never the internal cost breakdown.
6. Rule-based FAQ helper, visibly disclosed as such (no browser Gemini key).

**Out of scope:** realtime WebSocket (tour polling 30s), automatic payment gateway/return, password recovery, real e-tickets, vouchers/addons and itinerary exports. Release blockers are itemized in `docs/RELEASE_GATE.md`.

## Tour content and database upgrades

Administrators can configure each tour from **Quản trị**: add per-person cost
lines (for example yacht, hotel and meals), enter the customer sale price, and
author ordered daily activities. The system calculates the private base cost
from the line items. Customers can view the itinerary and choose from the
published departure dates when booking; internal cost figures are not returned
by public endpoints.

New schema is added through incremental Alembic revisions, not by dropping and
recreating the database. Revision `0004_booking_customer_identity` adds the
booking identity column. For PostgreSQL set `DATABASE_URL` and run
`alembic -c database/database/alembic.ini upgrade head`. The current revision
Local SQLite development creates new tables on startup and adds the identity
column to an existing bookings table when needed; PostgreSQL staging migrations
require the existing explicit `STAGING_AUTO_MIGRATE=1` opt-in. The legacy SQL Server
`full_database_deploy.sql` is destructive and is not the migration path for
this API.

## Try admin safely on local dev

1. Register your own new test account via the website.
2. Stop server or open another terminal in the same project and venv:
   `python -m scripts.promote_admin your-test-email@example.com`
3. Type `PROMOTE`, then log out/login again.
4. Use `http://127.0.0.1:8000/docs` for `PATCH /api/v1/admin/tours/{tour_id}` etc. Swagger needs same-origin authenticated cookies, plus `X-CSRF-Token` for writes. Use developer tools Network to see this cookie's value (not session cookie) or a REST client with cookies. **Don't grant admin role through public API.**

Note: manual payment confirmation is authorized only after bank proof verified by staff separately. It cannot be treated as automated gateway verification.

## Tests

```bash
pip install pytest httpx
python -m pytest -q tests/test_api.py
node --check ../Frontend/assets/js/controllers/main.js  # optional Node.js
```

The test suite covers auth, cookie, CSRF, IDOR, amount authority, idempotency,
cancellation, inventory expiry, admin authorization, concurrent booking,
catalog filtering/pagination, gallery persistence, required identity storage,
profile updates and assistant scope. Repeat the suite with PostgreSQL native
after migrations are applied. `docs/LOCAL_TEST_REPORT.md` records the baseline
delivery run.

## Responsibility matrix

| Person | Delivery area |
|---|---|
| Mạnh (leader/backend) | `api/`, auth/booking/price/permissions/payment state, API review |
| Hồng Thắm | `docs/THAM_DATABASE_HANDOFF.md`, database migration/constraints, DB dynamic update, backups |
| An | Port upstream polished HTML/CSS to `frontend/`, replacing localStorage and fake paid flow with server APIs |
| Hải Đăng | `tests/`, cross-browser/mobile/manual acceptance and regression |
| Nguyễn Văn Phúc | CI/CD, staging, monitoring, recovery and release gates |

Upstream original HTML is not included, because it could not be downloaded into this runtime. The supplied `frontend/` is newly authored and operational, inspired by the provided screenshots, not An's original content. Avoid uploading this over An's work without merging/reviewing changes.

## API contract

All API endpoints live under `/api/v1`. JSON request keys are snake_case, tour response keys use `camelCase`. Domestic/international type currently derives from the existing region field and audience from tour text; the database does not yet have dedicated tour-type or audience columns. FastAPI generates OpenAPI at `/openapi.json` and interactive UI at `/docs`. Follow `docs/THAM_DATABASE_HANDOFF.md` before changing data models.

## Production safety

Never expose demo SQLite and secrets as commercial deployment. Require approved PostgreSQL migrations, secure cookies over HTTPS, provider verification, durable booking expiry queue, financial reconciliation, backups and legal review. See release gate. For actual production set `DELTA_ENV=production`, `AUTO_CREATE_SCHEMA=0`, `DEMO_SEED=0`, `DATABASE_URL=postgresql+psycopg://...`; install PostgreSQL driver separately and apply audited migrations before start. The runtime deliberately refuses SQLite/demo seeding in production.

## Docker demo (optional)

If Docker Desktop is installed, from the project root run `docker compose up --build`. Visit `http://127.0.0.1:8000`. The `delta-demo-data` Docker volume persists local SQLite between restarts. Stop with `docker compose down` (without `-v` if you want to keep demo DB). **Do not expose this container/SQLite directly on the internet.** Docker execution was not verified in this environment.

The backend also supports server-stored favorites and updates to account display name and phone via `GET/POST/DELETE /api/v1/favorites` and `PATCH /api/v1/auth/profile`. The frontend exposes both features.
