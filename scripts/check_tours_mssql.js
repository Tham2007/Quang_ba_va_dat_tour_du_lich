const sql = require('mssql');

const { requireSqlServerConfig } = require("./mssql_config");
const config = requireSqlServerConfig();

async function testTours() {
  const pool = await sql.connect(config);
  const tours = await pool.request().query('SELECT * FROM TOUR');
  console.log('Tours in TOUR table:', JSON.stringify(tours.recordset, null, 2));
  await pool.close();
}

testTours().catch(console.error);

