# SQL Server credential rotation and deployment gate

## P0. Rotate before production

Previous SQL Server credentials were present in GitHub source and its history.
Removing literals in a new commit does **not** invalidate them. The database
owner (Thắm) must change the SQL login password immediately in SmarterASP,
revoke/replace any equivalent credentials, check access logs where supported,
and rotate any other accounts that reused the same password.

Keep the replacement password secret. Do not paste it in Zalo, GitHub issues,
pull requests, screenshots, logs, or any client-side JavaScript. Send deployment
settings through Render's encrypted Environment settings to the authorized
teammate instead.

## P1. Configure runtime

Set `DELTA_MSSQL_SERVER`, `DELTA_MSSQL_DATABASE`,
`DELTA_MSSQL_USER`, `DELTA_MSSQL_PASSWORD`, and optionally
`DELTA_MSSQL_PORT` through Render service environment variables.
Use TLS certificate verification: `DELTA_MSSQL_ENCRYPT=true`,
`DELTA_MSSQL_TRUST_SERVER_CERTIFICATE=false`. Confirm that the SQL provider
accepts encrypted connections. Never fall back to plaintext silently.

Apply least-privilege DB permissions to the runtime account, not the DB owner.
Do not expose DB connection strings to the browser. Run schema migration using
a separate restricted-time privileged account after reviewing SQL diffs and backups.

## P2. Verify the actual deployed target

1. Deploy only after PR CI is green and source SHA is confirmed.
2. Verify `GET /api/v1/health/ready` and check `sqlServerConnected` if this
   is the Node service; this only establishes connectivity, **not** write routing.
3. Check whether tour list and booking endpoints use the intended persistence
   backend: Node's existing demo booking path still uses SQLite.
   The SQL Server adapter and related API must be validated separately.
4. Test an actual authorized create, read, cancel and inventory consistency on
   a disposable test account and test tour. Confirm the record using read-only
   database queries and server logs, not a frontend success banner.
5. Test restart/redeploy persistence, two-client concurrent last-seat booking,
   permission checks, timeouts, no sensitive logging, and rollback.

## Release decision

- Node SQLite CI green: verifies *only* staging/demo behavior.
- SQL Server connection: verifies connectivity/readability, not bookings.
- Bank payment: unavailable until independently reconciled; never mark
  `PAID` based on self-reported references.
- Real production: blocked until persistent SQL Server write E2E and fresh
  credential rotation have evidence.
