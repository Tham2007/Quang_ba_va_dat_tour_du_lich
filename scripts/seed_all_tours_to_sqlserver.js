const mssql = require('mssql');
const { DatabaseSync } = require('node:sqlite');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};

const regionToCategory = {
  'north': 1,
  'central': 2,
  'south': 3
};

async function seedRemainingTours() {
  const pool = await mssql.connect(config);
  console.log('[OK] Connected to SQL Server');

  const existingTours = await pool.request().query('SELECT MaTour, TenTour FROM dbo.TOUR');
  console.log('Existing tours count:', existingTours.recordset.length);
  const existingNames = new Set(existingTours.recordset.map(r => r.TenTour.toLowerCase().trim()));

  const db = new DatabaseSync('API/delta_dev.db');
  const sqliteTours = db.prepare("SELECT * FROM tours WHERE id LIKE 'DL-%'").all();

  console.log(`Found ${sqliteTours.length} tours in SQLite`);

  for (const t of sqliteTours) {
    if (t.id === 'DL-7809') continue; // skip test tour

    const nameKey = t.title.toLowerCase().trim();
    // Check if already in SQL Server (e.g. Tour 1, 2, 3, 4)
    let isAlreadyIn = false;
    for (const en of existingNames) {
      if (en.includes(nameKey.slice(0, 15)) || nameKey.includes(en.slice(0, 15))) {
        isAlreadyIn = true;
        break;
      }
    }

    if (isAlreadyIn) {
      console.log(`[SKIP] Tour ${t.id} (${t.title}) already in SQL Server`);
      continue;
    }

    // Insert tour into SQL Server
    const catId = regionToCategory[t.region] || 1;
    let img = t.image;
    try {
      const parsed = JSON.parse(t.image);
      if (Array.isArray(parsed) && parsed.length > 0) img = parsed[0];
    } catch (_) {}

    const tx = new mssql.Transaction(pool);
    await tx.begin();
    try {
      const req = new mssql.Request(tx);
      req.input('catId', mssql.Int, catId);
      req.input('ten', mssql.NVarChar(200), t.title.slice(0, 200));
      req.input('moTa', mssql.NVarChar(mssql.MAX), t.description || t.title);
      req.input('lichTrinh', mssql.NVarChar(500), `${t.duration || '3N2Đ'} | ${t.departure || 'Hà Nội'} | ${t.transport || 'Xe VIP'}`.slice(0, 500));
      req.input('gia', mssql.Decimal(18, 2), Number(t.price) || 2000000);
      req.input('anh', mssql.VarChar(255), (img || 'assets/images/halong.png').slice(0, 255));
      req.input('trangThai', mssql.Bit, t.active ? 1 : 0);

      const insRes = await req.query(`
        INSERT INTO dbo.TOUR (MaDanhMuc, TenTour, MoTaChiTiet, LichTrinhTongQuan, GiaKhuyenNghi, HinhAnhDaiDien, TrangThai)
        OUTPUT INSERTED.MaTour
        VALUES (@catId, @ten, @moTa, @lichTrinh, @gia, @anh, @trangThai)
      `);
      const newMaTour = insRes.recordset[0].MaTour;
      console.log(`[INSERTED] Tour ${t.id} -> SQL Server MaTour: ${newMaTour}`);

      // Insert default schedule for this tour
      const schedReq = new mssql.Request(tx);
      const depDate = new Date();
      depDate.setDate(depDate.getDate() + 10);
      const retDate = new Date(depDate);
      retDate.setDate(retDate.getDate() + 3);

      schedReq.input('maTour', mssql.Int, newMaTour);
      schedReq.input('depDate', mssql.DateTime, depDate);
      schedReq.input('retDate', mssql.DateTime, retDate);
      schedReq.input('gia', mssql.Decimal(18, 2), Number(t.price) || 2000000);
      schedReq.input('soCho', mssql.Int, 25);
      schedReq.input('tt', mssql.NVarChar(50), 'Mở bán');
      await schedReq.query(`
        INSERT INTO dbo.CHUYENKHOIHANH (MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
        VALUES (@maTour, @depDate, @retDate, @gia, @soCho, 0, @tt)
      `);

      // Insert Itinerary details
      let itin = [];
      try { itin = JSON.parse(t.itinerary_json || '[]'); } catch (_) {}
      if (Array.isArray(itin) && itin.length > 0) {
        for (let i = 0; i < itin.length; i++) {
          const item = itin[i];
          const itinReq = new mssql.Request(tx);
          itinReq.input('maTour', mssql.Int, newMaTour);
          itinReq.input('ngay', mssql.Int, item.day || (i + 1));
          itinReq.input('tieuDe', mssql.NVarChar(200), (item.title || `Ngày ${i + 1}`).slice(0, 200));
          itinReq.input('noiDung', mssql.NVarChar(mssql.MAX), item.description || item.morning || 'Khởi hành tham quan các địa điểm nổi tiếng theo chương trình.');
          itinReq.input('buaAn', mssql.NVarChar(100), (item.meals || 'Sáng, Trưa, Tối').slice(0, 100));
          await itinReq.query(`
            INSERT INTO dbo.LICH_TRINH_DETAIL (MaTour, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn)
            VALUES (@maTour, @ngay, @tieuDe, @noiDung, @buaAn)
          `);
        }
      }

      await tx.commit();
      console.log(`[COMMITTED] Seeded Tour ${t.id} (MaTour: ${newMaTour}) with Schedule & Itinerary`);
    } catch (err) {
      await tx.rollback();
      console.error(`[ERROR] Failed to seed tour ${t.id}:`, err);
    }
  }

  const finalTours = await pool.request().query('SELECT MaTour, TenTour, GiaKhuyenNghi FROM dbo.TOUR');
  console.log(`[DONE] Total tours in SQL Server now: ${finalTours.recordset.length}`);

  await pool.close();
}

seedRemainingTours().catch(console.error);
