# Database handoff

## Canonical database for the runnable API

The FastAPI application in `API/api` uses SQLAlchemy models in
[`API/api/models.py`](../API/api/models.py). PostgreSQL is the canonical shared
database for that application. The versioned Alembic migration here is its
schema history; do not create or maintain a second schema for the same API.
SQLite remains a developer/test option only.

The SQL Server scripts under `01_schema/` through `05_seed_data/` and
`full_database_deploy.sql` are a legacy/reference implementation for the
separate read-only `api.tham_sqlserver_app`. They are not PostgreSQL migrations
and must not be run against the PostgreSQL application database. In particular,
the legacy all-in-one deployment script drops and recreates its SQL Server
database; never run it against data that must be retained.

## Requirements and migration commands

Install the API dependencies from `API/requirements.txt`, including Alembic and
the PostgreSQL psycopg driver. Set `DATABASE_URL` in the shell or secret store;
never commit credentials or paste them into logs.

```powershell
Set-Location API
$env:DATABASE_URL = "postgresql+psycopg://USER:PASSWORD@HOST:5432/DB_NAME"
python -m alembic -c ..\database\alembic.ini upgrade head
python -m alembic -c ..\database\alembic.ini current
```

Migrations reject non-PostgreSQL URLs. The initial revision mirrors the seven
ORM tables and constraints; use Alembic for all future schema changes. Do not
use `Base.metadata.create_all()` in production.

For a disposable empty database only, rollback and reapply with:

```powershell
python -m alembic -c ..\database\alembic.ini downgrade base
python -m alembic -c ..\database\alembic.ini upgrade head
```

`downgrade base` drops application tables and their data. Review every future
downgrade before use; production rollback should normally be a forward,
reviewed migration or a verified restore, not an unreviewed destructive
downgrade.

## Demo data

The only demo seed source is `API/api/seed.py`; it seeds synthetic tour
descriptions, prices and generated future schedules. It does not create user
accounts or passwords and must never contain real customer, identity, or
payment information. Apply the migration first, then from `API/` run:

```powershell
python -c "from api.seed import seed_demo; seed_demo()"
```

The seed is safe to rerun: existing tour IDs are not duplicated. Demo schedules
are synthetic and are not commercial commitments. Production must not run
`DEMO_SEED=1`.

## Schema and booking behavior

See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the T03 entity analysis, T06
ERD, T07 dictionary, T08 transactional booking flow, and T15 integrity test
matrix.

Run PostgreSQL migration-drift and booking concurrency checks against an empty,
disposable `*_test` database from `API/`:

```powershell
$env:POSTGRES_TEST_URL = "postgresql+psycopg://USER:PASSWORD@HOST:5432/delta_travel_test"
python -m pytest -q tests\test_postgres_database.py
```

The test applies migrations, checks ORM/schema parity, verifies the last-seat
race with 20 requests, and retries the same idempotency key concurrently. It
adds synthetic test records and does not clean the database; never point it at
shared, staging, or production data.

## Backup, restore and release evidence

Use PostgreSQL-native `pg_dump`/`pg_restore` against a disposable database
containing only synthetic data. The rehearsal script accepts only database
names prefixed `delta_demo_` or suffixed `_test`, creates uniquely named
temporary restore/rollback databases, and never modifies the source database:

```powershell
$env:REHEARSAL_DATABASE_URL = "postgresql+psycopg://USER:PASSWORD@HOST:5432/delta_demo_local"
$env:REHEARSAL_SYNTHETIC_DATA = "1"
.\database\scripts\backup_restore_rehearsal.ps1
```

The script requires both a demo/test database name and this explicit
synthetic-data confirmation. It writes a timestamped log and backup under the current user's
temporary directory. Preserve that output with the QA/release evidence; do not
commit backups or logs containing real data or credentials.

**Environment limitation:** PostgreSQL client/server tools are not installed in
the current workspace. Migration execution, live PostgreSQL concurrency,
backup/restore and rollback rehearsal remain release gates until run against a
disposable PostgreSQL instance. No successful live-run evidence is claimed.
