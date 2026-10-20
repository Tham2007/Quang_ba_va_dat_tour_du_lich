# Backend FastAPI do Manh ban giao

This directory contains the independent, runnable Delta Travel 2.0 FastAPI academic demo.
Its own UI lives in `API/frontend/`; do not confuse it with the separate team `Frontend/` directory.
It has NOT been connected to the team's `database/` or original frontend yet.

## Local run (from `API/`)

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/docs for API documentation.

## Tests (from `API/`)

```powershell
.\.venv\Scripts\python -m pip install pytest httpx
.\.venv\Scripts\python -m pytest -q tests/test_api.py
```

## Collaboration and release

- Tham: review Postgres migrations, constraints and the `docs/THAM_DATABASE_HANDOFF.md` task.
- An: integrate the separate group's `Frontend/` using the API contracts.
- Dang: test browser and backend regression, including PostgreSQL concurrency.
- Phuc: CI/CD, container staging, logs and release gates.
- Manh: approve API interfaces and review integration.

`docs/ci-workflow-template.yml` is a template and does NOT run as GitHub Actions
unless moved and adapted to repository root `.github/workflows/`.

This is an educational demonstration. No live payment gateway is configured.
Do not deploy for paying customers until the documented security/release gates pass.
Never commit `.env`, databases, passwords, API keys, or real customer data.
