"use strict";
const assert = require("node:assert/strict");
const { getSqlServerConfig, requireSqlServerConfig } = require("./scripts/mssql_config");
const keys = [
  "DELTA_MSSQL_SERVER", "DELTA_MSSQL_DATABASE", "DELTA_MSSQL_USER",
  "DELTA_MSSQL_PASSWORD", "DELTA_MSSQL_PORT", "DELTA_MSSQL_ENCRYPT",
  "DELTA_MSSQL_TRUST_SERVER_CERTIFICATE"
];
const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
try {
  for (const k of keys) delete process.env[k];
  assert.equal(getSqlServerConfig(), null, "SQL connection must be disabled with missing credentials");
  assert.throws(() => requireSqlServerConfig(), /Missing DELTA_MSSQL_/);
  process.env.DELTA_MSSQL_SERVER = "sql.example.test";
  process.env.DELTA_MSSQL_DATABASE = "tour_db";
  process.env.DELTA_MSSQL_USER = "limited_user";
  process.env.DELTA_MSSQL_PASSWORD = "only-for-unit-test-not-real";
  const config = requireSqlServerConfig();
  assert.equal(config.database, "tour_db");
  assert.equal(config.port, 1433);
  assert.equal(config.options.encrypt, true);
  assert.equal(config.options.trustServerCertificate, false);
  process.env.DELTA_MSSQL_PORT = "99999";
  assert.throws(() => getSqlServerConfig(), /Invalid DELTA_MSSQL_PORT/);
  process.env.DELTA_MSSQL_PORT = "1433";
  delete process.env.DELTA_MSSQL_PASSWORD;
  assert.equal(getSqlServerConfig(), null);
  console.log("PASS: SQL Server connection requires env credentials and defaults to TLS.");
} finally {
  for (const k of keys) {
    if (previous[k] === undefined) delete process.env[k];
    else process.env[k] = previous[k];
  }
}
