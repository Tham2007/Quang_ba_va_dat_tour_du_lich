const sql = require("mssql");

const config = {
  server: "sql8020.site4now.net",
  port: 1433,
  database: "db_ad0b71_dattour",
  user: "db_ad0b71_dattour_admin",
  password: "Phamtham312007@",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function main() {
  const pool = await sql.connect(config);
  console.log("Connected to SQL Server!");

  // 1. List all tables
  const res = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  console.log("Current tables in DB:", res.recordset.map(r => r.TABLE_NAME));

  // 2. Drop only the extra tables created previously
  const extraTables = [
    "favorites",
    "audit_log",
    "bookings",
    "itinerary_items",
    "schedules",
    "tours",
    "sessions",
    "users"
  ];

  for (const tbl of extraTables) {
    try {
      await pool.request().query(`IF OBJECT_ID('dbo.${tbl}', 'U') IS NOT NULL DROP TABLE dbo.${tbl}`);
      console.log(`Dropped extra table: ${tbl}`);
    } catch (err) {
      console.error(`Error dropping ${tbl}:`, err.message);
    }
  }

  // 3. Re-list tables to verify only original tables remain
  const after = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  console.log("Remaining tables (ONLY original Vietnamese tables):", after.recordset.map(r => r.TABLE_NAME));

  // 4. Inspect columns of each original table
  for (const row of after.recordset) {
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${row.TABLE_NAME}'
      ORDER BY ORDINAL_POSITION
    `);
    console.log(`\n=== Table: ${row.TABLE_NAME} ===`);
    console.log(cols.recordset.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ''}, ${c.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`).join(", "));
    
    // count rows
    try {
      const countRes = await pool.request().query(`SELECT COUNT(*) as cnt FROM dbo.[${row.TABLE_NAME}]`);
      console.log(`Row count: ${countRes.recordset[0].cnt}`);
    } catch (e) {
      console.log(`Row count error: ${e.message}`);
    }
  }

  await pool.close();
}

main().catch(console.error);
