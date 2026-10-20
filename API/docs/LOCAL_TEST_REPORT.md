# Báo cáo kiểm thử tại thời điểm bàn giao, 18/10/2026

## Command output verified

```text
$ python -m pytest -q tests/test_api.py
............                                                             [100%]
12 passed in 2.69s

$ node --check frontend/assets/app.js
[exit code 0]

$ python -m compileall -q api scripts
[exit code 0]
```

12 test functions cover HTTP API, 6 tours, filter, register/login/logout, cookie and CSRF, quote, fake amount rejection, idempotency, cancellation exactly once, IDOR, authz, expiration returning seats, manual payment proof, admin audit, preserving booked price after admin edits, under-capacity constraints, invalid inputs, 2 simultaneous bookings for 1 remaining seat, absence of anonymous password reset or fake provider payment endpoint, server-side profile and favorite isolation, password rotation invalidating sessions.

**NOTE:** This suite ran on SQLite in development mode. It does not certify PostgreSQL transaction isolation, operational scalability or financial provider integration.

## Browser layout smoke

Chromium headless (via Playwright) rendered `frontend/index.html` with inlined local CSS and a *mocked* response for API requests, since access to the local HTTP server in Chrome is blocked by runtime policy (`ERR_BLOCKED_BY_ADMINISTRATOR`). Results:

- Desktop 1440px: 6 tour cards rendered, no JS page exception.
- Filter “Miền Bắc”: correct reduction from 6 to 2 cards.
- Mobile 375px: screenshot was generated; manual usability inspection not certified.
- Screenshot files: `docs/ui-desktop-mock.png`, `docs/ui-mobile-mock.png`. Tour images are placeholders in this mock; live UI references upstream Github raw images.

These are **not** live end-to-end browser API tests. Repeat on a normal workstation after integrating An's latest UI.

## HTTP server smoke

Uvicorn served `/api/v1/health/ready` with HTTP 200 and `{"status":"ok","db":"connected"}` via local HTTP client. The browser refused localhost navigation due to environment policy, not an observed API error.

## Current findings

- Potential image failure offline, because assets refer to GitHub raw URLs; copy owned image assets into same-origin static storage before release.
- No full SRS / grading rubric was supplied. The earlier SRS notes in the previous monorepo README are a separate historical artifact and cannot confirm complete requirements.
- Schema migrations native PostgreSQL remain to be done by Thắm. CI runs only local SQLite test.
- User-facing payments require proper provider integration. Current `confirm-payment` route is a restricted *manual verification record*, never automatic bank verification.

Keep this report truthful and update it with actual output after further changes.
