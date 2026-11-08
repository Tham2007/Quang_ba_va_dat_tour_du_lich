"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "delta-demo-accounts-"));
const dbFile = path.join(dir, "test.db");
const script = `
const { db, server } = require("./server");
server.on("listening", () => {
 const count = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='ADMIN' AND active=1").get().n;
 if ((process.env.DELTA_ALLOW_DEMO_ACCOUNTS === "1" && count < 1) ||
     (process.env.DELTA_ALLOW_DEMO_ACCOUNTS !== "1" && count !== 0)) {
   process.stderr.write("Unexpected demo admin activation count="+count+"\\n");
   process.exitCode = 1;
 }
 server.close(() => db.close());
});
`;
function run(mode) {
  const env = {...process.env,
    DELTA_DB_PATH: dbFile, PORT:"0", HOST:"127.0.0.1",
    THAM_SQLSERVER_CATALOG_API_URL:"",
    DELTA_MSSQL_PASSWORD:"", DELTA_MSSQL_SERVER:"", DELTA_MSSQL_DATABASE:"",
    DELTA_MSSQL_USER:""
  };
  if (mode === "demo") env.DELTA_ALLOW_DEMO_ACCOUNTS = "1";
  else delete env.DELTA_ALLOW_DEMO_ACCOUNTS;
  const r = spawnSync(process.execPath, ["-e", script], {env, cwd:__dirname, encoding:"utf8", timeout:20000});
  assert.equal(r.status,0,"Mode "+mode+": "+r.stderr+"\n"+r.stdout);
}
try {
  run("demo"); // Old behavior intentionally enabled for isolated CI only.
  run("secure"); // Existing privileged sample accounts must be deactivated.
  console.log("PASS: explicit demo gate and legacy admin deactivation on reused databases");
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
