const mssql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};

async function testPersistence() {
  const pool = await mssql.connect(config);
  console.log('[OK] Connected to SQL Server');

  // 1. UPDATE TOUR 1
  const tx1 = new mssql.Transaction(pool);
  await tx1.begin();
  try {
    const req1 = new mssql.Request(tx1);
    req1.input('maTour', mssql.Int, 1);
    req1.input('gia', mssql.Decimal(18, 2), 3890000);
    req1.input('ten', mssql.NVarChar(200), 'Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ');
    req1.input('moTa', mssql.NVarChar(mssql.MAX), 'Hành trình 3 ngày 2 đêm trên du thuyền 5 sao đẳng cấp quốc tế khám phá Vịnh Hạ Long - Kỳ quan thiên nhiên thế giới và Vịnh Lan Hạ thơ mộng.');
    req1.input('lichTrinh', mssql.NVarChar(500), '3N2Đ | Du thuyền 5 sao quốc tế | Xe Limousine đón Hà Nội');
    req1.input('trangThai', mssql.Bit, 1);
    await req1.query(`
      UPDATE dbo.TOUR
      SET GiaKhuyenNghi = @gia, TenTour = @ten, MoTaChiTiet = @moTa, LichTrinhTongQuan = @lichTrinh, TrangThai = @trangThai
      WHERE MaTour = @maTour
    `);

    // Audit log
    const reqAudit = new mssql.Request(tx1);
    reqAudit.input('hd', mssql.NVarChar(100), 'ADMIN_UPDATE_TOUR');
    reqAudit.input('cu', mssql.NVarChar(mssql.MAX), JSON.stringify({ tourId: 1 }));
    reqAudit.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ price: 3890000, title: 'Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ' }));
    await reqAudit.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (NULL, @hd, @cu, @moi, GETDATE())
    `);

    await tx1.commit();
    console.log('[PASS 1] Successfully updated Tour 1 with transaction commit');
  } catch (err) {
    await tx1.rollback();
    console.error('[FAIL 1] Rollback update tour:', err);
    throw err;
  }

  // 2. CREATE A SCHEDULE
  let createdMaChuyen = null;
  const tx2 = new mssql.Transaction(pool);
  await tx2.begin();
  try {
    const req2 = new mssql.Request(tx2);
    req2.input('maTour', mssql.Int, 1);
    req2.input('ngayDi', mssql.DateTime, new Date('2026-12-25T08:00:00Z'));
    req2.input('ngayVe', mssql.DateTime, new Date('2026-12-27T17:00:00Z'));
    req2.input('gia', mssql.Decimal(18, 2), 3890000);
    req2.input('soCho', mssql.Int, 20);
    req2.input('trangThai', mssql.NVarChar(50), 'Mở bán');
    const res2 = await req2.query(`
      INSERT INTO dbo.CHUYENKHOIHANH (MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
      OUTPUT INSERTED.MaChuyen
      VALUES (@maTour, @ngayDi, @ngayVe, @gia, @soCho, 0, @trangThai)
    `);
    createdMaChuyen = res2.recordset[0].MaChuyen;

    const reqAudit2 = new mssql.Request(tx2);
    reqAudit2.input('hd', mssql.NVarChar(100), 'ADMIN_CREATE_SCHEDULE');
    reqAudit2.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ maChuyen: createdMaChuyen, maTour: 1 }));
    await reqAudit2.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (NULL, @hd, NULL, @moi, GETDATE())
    `);

    await tx2.commit();
    console.log('[PASS 2] Created Schedule on SQL Server with MaChuyen:', createdMaChuyen);
  } catch (err) {
    await tx2.rollback();
    console.error('[FAIL 2] Rollback create schedule:', err);
    throw err;
  }

  // 3. UPDATE SCHEDULE
  const tx3 = new mssql.Transaction(pool);
  await tx3.begin();
  try {
    const req3 = new mssql.Request(tx3);
    req3.input('maChuyen', mssql.Int, createdMaChuyen);
    req3.input('soCho', mssql.Int, 30);
    req3.input('trangThai', mssql.NVarChar(50), 'Mở bán');
    await req3.query(`
      UPDATE dbo.CHUYENKHOIHANH
      SET SoChoToiDa = @soCho, TrangThaiChuyen = @trangThai
      WHERE MaChuyen = @maChuyen
    `);
    await tx3.commit();
    console.log('[PASS 3] Updated Schedule seats to 30');
  } catch (err) {
    await tx3.rollback();
    throw err;
  }

  // 4. VERIFY DATA DIRECTLY
  const verify = await pool.request()
    .input('mc', mssql.Int, createdMaChuyen)
    .query('SELECT * FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @mc');
  console.log('[PASS 4] Verified Schedule in SQL Server:', verify.recordset[0]);

  // Clean up test schedule
  await pool.request()
    .input('mc', mssql.Int, createdMaChuyen)
    .query('DELETE FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @mc');
  console.log('[PASS 5] Cleaned up test schedule');

  await pool.close();
  console.log('[ALL PASS] Full SQL Server persistence test succeeded!');
}

testPersistence().catch(console.error);
