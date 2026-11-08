const sql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: 'Phamtham312007@',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true }
};

async function testTours() {
  const pool = await sql.connect(config);
  const tours = await pool.request().query('SELECT * FROM TOUR');
  console.log('Tours in TOUR table:', JSON.stringify(tours.recordset, null, 2));
  await pool.close();
}

testTours().catch(console.error);

