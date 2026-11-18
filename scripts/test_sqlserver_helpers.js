const sql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};

async function testFullSqlHelpers() {
  const pool = await sql.connect(config);
  console.log('[OK] Connected to SQL Server');

  // Test 1: Update Tour 1 in transaction
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);
    req.input('maTour', sql.Int, 1);
    req.input('tenTour', sql.NVarChar(200), 'Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ - Hang Sửng Sốt');
    req.input('giaKhuyenNghi', sql.Decimal(18, 2), 3890000);
    req.input('trangThai', sql.Bit, 1);
    await req.query(`
      UPDATE dbo.TOUR
      SET TenTour = @tenTour, GiaKhuyenNghi = @giaKhuyenNghi, TrangThai = @trangThai
      WHERE MaTour = @maTour
    `);

    // Audit log
    const auditReq = new sql.Request(tx);
    auditReq.input('action', sql.NVarChar(50), 'UPDATE_TOUR_TEST');
    auditReq.input('old', sql.NVarChar(sql.MAX), '1');
    auditReq.input('new', sql.NVarChar(sql.MAX), JSON.stringify({ price: 3890000 }));
    await auditReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (NULL, @action, @old, @new, GETDATE())
    `);

    await tx.commit();
    console.log('[PASS] Test 1: Update Tour with transaction & audit log committed.');
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  // Test 2: Check schedule update in transaction
  const tx2 = new sql.Transaction(pool);
  await tx2.begin();
  try {
    const sReq = new sql.Request(tx2);
    sReq.input('maChuyen', sql.Int, 1);
    sReq.input('soCho', sql.Int, 25);
    await sReq.query(`
      UPDATE dbo.CHUYENKHOIHANH
      SET SoChoToiDa = @soCho
      WHERE MaChuyen = @maChuyen
    `);
    await tx2.commit();
    console.log('[PASS] Test 2: Update Schedule committed.');
  } catch (e) {
    await tx2.rollback();
    throw e;
  }

  await pool.close();
  console.log('[ALL TESTS COMPLETED SUCCESSFULLY]');
}

testFullSqlHelpers().catch(err => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
