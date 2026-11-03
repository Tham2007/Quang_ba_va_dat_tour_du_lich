# FastAPI MVC-style refactor, Nhóm 6 (03/11/2026)

## Responsibilities

- `api/routes/`: URL and HTTP method declarations, no business logic.
- `api/controllers/`: request handlers with existing FastAPI dependency signatures.
- `api/services/`: tour/booking pricing, inventory, payment reference and mapping helpers.
- `api/repositories/`: query helpers using injected SQLAlchemy session.
- `api/models/`: seven unchanged ORM tables with shared Base.
- `api/schemas/`: Pydantic contracts by business domain.
- `api/core/`: auth/CSRF, session, security and config.
- `api/app.py`: retains composition and existing frontend mount.

Legacy imports from `api.models`, `api.schemas`, `api.core`, `api.logic`, `api.security` still work. This is a **structural refactor**, not a database migration. The 12-table SQL Server adapter `api.tham_sqlserver_app` remains separate and **read-only**. Do not point the PostgreSQL/SQLite ORM at that T-SQL schema.

## Tests and review

Run from `API/`:

```bash
python -m pytest -q tests/test_api.py tests/test_legacy_schema_guard.py tests/test_static_assets.py tests/test_architecture.py tests/test_mvc_structure.py tests/test_tham_sqlserver_app.py tests/test_tham_sqlserver_checker.py
```

Mạnh reviews API behavior and transactions; Thắm reviews SQL/schema constraints; Phúc checks Render/Docker; Đăng runs E2E; An checks browser integration. Merge only after checks pass. No Azure SQL deploy/production booking claims are made by this refactor.
