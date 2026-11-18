const mssql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};

async function testSync() {
  const pool = await mssql.connect(config);
  console.log('[OK] Connected');

  // Load tours
  const toursRes = await pool.request().query('SELECT * FROM dbo.TOUR ORDER BY MaTour ASC');
  const sqlTours = toursRes.recordset;
  console.log(`Loaded ${sqlTours.length} tours from SQL Server.`);

  // Load all schedules
  const schRes = await pool.request().query('SELECT * FROM dbo.CHUYENKHOIHANH ORDER BY NgayKhoiHanh ASC');
  const sqlSchedules = schRes.recordset;
  console.log(`Loaded ${sqlSchedules.length} schedules from SQL Server.`);

  // Load all images
  const imgRes = await pool.request().query('SELECT * FROM dbo.HINHANH_TOUR ORDER BY MaTour, MaHinhAnh');
  console.log(`Loaded ${imgRes.recordset.length} gallery images from SQL Server.`);

  // Load all details
  const detRes = await pool.request().query('SELECT * FROM dbo.LICH_TRINH_DETAIL ORDER BY MaTour, NgayThu');
  console.log(`Loaded ${detRes.recordset.length} itinerary details from SQL Server.`);

  for (const t of sqlTours) {
    console.log(`Tour ${t.MaTour}: ${t.TenTour} | Giá: ${t.GiaKhuyenNghi.toLocaleString('vi-VN')} đ | Trạng thái: ${t.TrangThai ? 'Mở bán' : 'Ẩn'}`);
  }

  await pool.close();
}

testSync().catch(console.error);
