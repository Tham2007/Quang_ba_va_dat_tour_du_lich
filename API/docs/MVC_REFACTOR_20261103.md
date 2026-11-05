# FastAPI MVC-style architecture, Nhóm 6

## Responsibilities

- `API/api/routes/`: URL and HTTP method declarations; no database or business
  logic.
- `API/api/controllers/`: HTTP boundary, request dependencies and response
  orchestration.
- `API/api/services/`: business rules, transactions, pricing, inventory,
  permissions and response mapping.
- `API/api/repositories/`: SQLAlchemy queries and persistence operations.
- `API/api/models/`: nine ORM entities sharing one SQLAlchemy `Base`.
- `API/api/schemas/`: Pydantic request contracts and validation.
- `API/api/core/`: app configuration, database session, authentication and
  cross-cutting security.
- `API/api/app.py`: composition root; registers routers and mounts views.
- `Frontend/`: static **View** (HTML, CSS, browser controllers); JavaScript is
  divided into controllers, models and services and is served at `/` and
  `/an-live/`.
- `database/database/`: SQL Server reference scripts and PostgreSQL Alembic
  migrations. Database assets are not MVC application layers.
- `API/tests/`, `API/scripts/`, and `docs/`: verification, operations and
  project documentation, kept outside runtime layers intentionally.

The backend's request flow is:

```text
View (browser) -> Route -> Controller -> Service -> Repository -> Model/DB
                                      -> Schema validation
```

Routes register handlers only. New and refactored controllers should not
assemble SQL queries or own business rules; those belong in repositories and
services respectively. Some existing auth/admin handlers still contain
persistence orchestration and should be migrated incrementally with regression
tests rather than moved mechanically. The `api.core` package contains shared
infrastructure and is not a substitute for either layer.

The public tour catalog uses `TourSearch` validation, repository-level
parameterized filters, and a paginated controller response. Tour galleries
reuse the existing `Tour.image` text column as a JSON list so a new table is
not required. Booking identity validation and persistence stay in the booking
schema/service/model layers; migration `0004_booking_customer_identity`
upgrades existing SQLite/PostgreSQL data without exposing the identity in
booking response serializers. The SQL Server adapter remains read-only and is
not part of these changes.

Legacy imports from `api.models`, `api.schemas`, `api.core`, `api.logic`, and
`api.security` still work. The tour cost breakdown and itinerary are represented
by `TourCostItem` and `ItineraryItem` models and are upgraded with Alembic
revisions `0003_tour_costs_and_itinerary` and
`0004_booking_customer_identity`. The 12-table SQL Server adapter
`api.tham_sqlserver_app` remains separate and **read-only**. Do not point the
PostgreSQL/SQLite ORM at that T-SQL schema.

## Tests and review

Run from `API/`:

```bash
python -m pytest -q tests/test_api.py tests/test_legacy_schema_guard.py tests/test_static_assets.py tests/test_architecture.py tests/test_mvc_structure.py tests/test_tham_sqlserver_app.py tests/test_tham_sqlserver_checker.py
```

Mạnh reviews API behavior and transactions; Thắm reviews SQL/schema constraints; Phúc checks Render/Docker; Đăng runs E2E; An checks browser integration. Merge only after checks pass. No Azure SQL deploy/production booking claims are made by this refactor.
