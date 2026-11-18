const mssql = require('mssql');
const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};
async function check() {
  const pool = await mssql.connect(config);
  const q = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('TOUR', 'CHUYENKHOIHANH', 'LICH_TRINH_DETAIL', 'HINHANH_TOUR', 'AUDITLOG', 'DANHMUC')
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  console.log(JSON.stringify(q.recordset, null, 2));
  await pool.close();
}
check().catch(console.error);
