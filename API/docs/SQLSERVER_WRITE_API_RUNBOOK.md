# Delta Travel SQL Server writes: isolated staging handoff

**Status: FEATURE BRANCH, needs DB migration and CI verification.** This is not a claim that live Render has write access. Do not use actual identities, transactions or bank data.

## Prerequisites

- Do **not** reuse the SQL admin password shared in Zalo/screenshots. Thắm must rotate it and create a **dedicated least-privilege application login**.
- Backup DB and have Thắm approve new infrastructure tables.
- Run `database/database/migrations/sqlserver/001_auth_sessions_idempotency.sql` **only on disposable staging TourDuLichDB** with SSMS (open the correct database first). This adds `API_PHIENDANGNHAP` and `API_YEUCAU_DATTOUR`, leaving the 12 original business tables intact.
- Confirm `dbo.sp_TaoDonDatTour`, `dbo.sp_HuyDonDatTour` and both booking/seat triggers are present and enabled.
- On the **separate SQL Server Render service** set `THAM_BOOKING_WRITES_ENABLED=1` and `DELTA_ENV=staging`. Keep `THAM_SQLSERVER_URL` in Render environment only, never in Git/CI logs/chat. For staging, an `mssql+pyodbc://` URL with ODBC Driver 18 and `Encrypt=yes&TrustServerCertificate=no` is required. Do not point legacy `DATABASE_URL` at this SQL schema.

## Route contract

- `POST /api/v1/auth/register` and `POST /api/v1/auth/login` use scrypt password hashes in dbo.NGUOIDUNG, create server-side hashed sessions, HttpOnly cookie, SameSite Strict, and separate CSRF cookie. Login accounts created by older seed SQL may not have compatible hashes.
- `GET /api/v1/auth/session`, `GET /api/v1/auth/me` and `POST /api/v1/auth/logout` handle the SQL Server session, not the SQLite demo.
- `POST /api/v1/bookings` requires `Idempotency-Key: <UUID>`, valid SQLServer session and `X-CSRF-Token`. Authenticated user ID is read **from server session**, never from request JSON. Uses `sp_TaoDonDatTour`; trigger holds seats. Retries with identical key/payload return the same booking. Different payload/key collision returns 409. No fake `PAID`.
- `GET /api/v1/bookings` and `GET /api/v1/bookings/{id}` return **only current user's** orders.
- `POST /api/v1/bookings/{id}/cancel` requires authenticated user/CSRF, unpaid pending booking and more than 72h before departure. Uses `sp_HuyDonDatTour`; trigger restores seats once.
- `POST /api/v1/admin/bookings/{id}/confirm-payment` remains **503** pending verified admin roles and bank reconciliation.

This version supports **adult-only** bookings with no notes. No child/infant discounts, payments, waiting-list, scheduled hold expiry, admin role, CORS third-party cookie flow or commercial checkout are claimed. Booking remains *pending*, and no automated expiry is implemented. The current user-facing FE An is still a demo and must not be misrepresented as already booking in this SQL Server.

## SQL permissions for application principal

Apply only after DBA verifies Azure/SmarterASP capabilities. Avoid `sa` / dbo / db_owner for runtime. Grant only necessary SELECT on existing tour/schedule/user/booking data, INSERT on `dbo.NGUOIDUNG`, SELECT/INSERT/DELETE on `API_PHIENDANGNHAP`, SELECT/INSERT/UPDATE on `API_YEUCAU_DATTOUR`, EXECUTE on `sp_TaoDonDatTour` and `sp_HuyDonDatTour`. If other read routes need table permissions, grant granular SELECT on required tables. Ensure ownership chaining for stored proc/trigger tables; never grant all-table UPDATE/DELETE to public API. Test a dedicated login from Render.

## Verification

SQL Server 2022 ephemeral CI should create a disposable database and apply the migration after original scripts, then run register/auth -> create -> duplicate replay -> cancel -> restore -> IDOR/CSRF and concurrent inventory tests. No such CI proves live SmarterASP.net writes without a separate staging run.

**Security concerns to resolve before public access:** Rate limiting for register/login must be backed by shared storage/reverse proxy; monitor TLS, limit network egress, implement session cleanup, password-reset flows, and audited admin role boundaries. Do not expose write-enabled staging publicly until these controls are reviewed.
