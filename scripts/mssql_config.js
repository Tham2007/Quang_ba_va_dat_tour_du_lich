"use strict";
// SQL Server configuration must come from secure runtime environment settings.
// No database usernames, passwords, hosts or certificate bypass are embedded in git.
function getSqlServerConfig() {
  const e = process.env;
  const server = e.DELTA_MSSQL_SERVER;
  const database = e.DELTA_MSSQL_DATABASE;
  const user = e.DELTA_MSSQL_USER;
  const password = e.DELTA_MSSQL_PASSWORD;
  if (![server, database, user, password].every(x => typeof x === "string" && x.trim())) return null;
  const port = Number(e.DELTA_MSSQL_PORT || 1433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid DELTA_MSSQL_PORT");
  return {
    server, database, user, password, port,
    options: {
      encrypt: e.DELTA_MSSQL_ENCRYPT !== "false",
      trustServerCertificate: e.DELTA_MSSQL_TRUST_SERVER_CERTIFICATE === "true"
    },
    connectionTimeout: 15000,
    requestTimeout: 15000
  };
}
function requireSqlServerConfig() {
  const config = getSqlServerConfig();
  if (!config) throw new Error("Missing DELTA_MSSQL_SERVER/DATABASE/USER/PASSWORD environment variables");
  return config;
}
module.exports = { getSqlServerConfig, requireSqlServerConfig };
