const sql = require('mssql');

const { requireSqlServerConfig } = require("./mssql_config");
const config = requireSqlServerConfig();

async function checkCols() {
  const pool = await sql.connect(config);
  const tables = ['NGUOIDUNG', 'TOUR', 'DATTOUR', 'CHUYENKHOIHANH', 'HINHANH_TOUR', 'LICH_TRINH_DETAIL', 'THANHTOAN'];
  for (const t of tables) {
    const res = await pool.request().query(
      `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${t}'`
    );
    console.log(`=== ${t} ===`);
    console.log(res.recordset.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? '(' + c.CHARACTER_MAXIMUM_LENGTH + ')' : ''})`).join(', '));
    const countRes = await pool.request().query(`SELECT COUNT(*) AS c FROM [${t}]`);
    console.log(`Rows in ${t}: ${countRes.recordset[0].c}`);
  }

  // Also check if any users exist
  const users = await pool.request().query('SELECT TOP 5 MaNguoiDung, HoTen, Email, SoDienThoai, VaiTro FROM NGUOIDUNG');
  console.log('Sample users in NGUOIDUNG:', users.recordset);

  // Check sample tours
  const tours = await pool.request().query('SELECT TOP 5 MaTour, TenTour, GiaKhuyenMai, GiaGoc, SoNgay, DiemKhoiHanh FROM TOUR');
  console.log('Sample tours in TOUR:', tours.recordset);

  await pool.close();
}

checkCols().catch(err => console.error(err));

