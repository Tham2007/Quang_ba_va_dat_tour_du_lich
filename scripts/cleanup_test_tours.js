const db = require('./sqlserver_sync_service');
const { DatabaseSync } = require('node:sqlite');

async function cleanup() {
  const pool = await db.getPool();
  if (!pool) {
    console.error("Cannot connect to SQL Server");
    process.exit(1);
  }

  // 1. Find all test/duplicate tours in SQL Server
  const testToursRes = await pool.request().query(`
    SELECT MaTour, TenTour FROM dbo.TOUR 
    WHERE MaTour >= 20 
       OR MaTour IN (5, 6, 8) 
       OR TenTour LIKE N'Tour Đồng Bộ Đà Lạt%' 
       OR TenTour LIKE N'Tour Node.js Test%' 
       OR TenTour LIKE N'Tour Hết Hạn Hôm Qua%'
  `);

  console.log(`Found ${testToursRes.recordset.length} test/duplicate tours in SQL Server to clean up:`);
  testToursRes.recordset.forEach(t => console.log(`  - [MaTour: ${t.MaTour}] ${t.TenTour}`));

  const testMaTours = testToursRes.recordset.map(t => t.MaTour);

  if (testMaTours.length > 0) {
    const idList = testMaTours.join(',');

    // Delete in cascade order
    // a. DANHGIA, THANHTOAN, CHITIET_HANHKHACH, DATTOUR for these tours
    await pool.request().query(`
      DELETE FROM dbo.DANHGIA WHERE MaDatTour IN (
        SELECT dt.MaDatTour FROM dbo.DATTOUR dt 
        JOIN dbo.CHUYENKHOIHANH ck ON dt.MaChuyen = ck.MaChuyen 
        WHERE ck.MaTour IN (${idList})
      );
      DELETE FROM dbo.THANHTOAN WHERE MaDatTour IN (
        SELECT dt.MaDatTour FROM dbo.DATTOUR dt 
        JOIN dbo.CHUYENKHOIHANH ck ON dt.MaChuyen = ck.MaChuyen 
        WHERE ck.MaTour IN (${idList})
      );
      DELETE FROM dbo.CHITIET_HANHKHACH WHERE MaDatTour IN (
        SELECT dt.MaDatTour FROM dbo.DATTOUR dt 
        JOIN dbo.CHUYENKHOIHANH ck ON dt.MaChuyen = ck.MaChuyen 
        WHERE ck.MaTour IN (${idList})
      );
      DELETE FROM dbo.DATTOUR WHERE MaChuyen IN (
        SELECT MaChuyen FROM dbo.CHUYENKHOIHANH WHERE MaTour IN (${idList})
      );
      DELETE FROM dbo.CHUYENKHOIHANH WHERE MaTour IN (${idList});
      DELETE FROM dbo.LICH_TRINH_DETAIL WHERE MaTour IN (${idList});
      DELETE FROM dbo.HINHANH_TOUR WHERE MaTour IN (${idList});
      DELETE FROM dbo.TOUR WHERE MaTour IN (${idList});
    `);
    console.log("Deleted all test tours and related child records from SQL Server.");
  }

  // 2. Clean SQLite database
  const validIds = [
    'DL-HL01', 'DL-DN02', 'DL-PQ03', 'DL-DL04', 'DL-SP05', 'DL-MT06', 
    'DL-NB07', 'DL-HG08', 'DL-CB09', 'DL-MC10', 'DL-HU11', 'DL-NT12', 
    'DL-QN13', 'DL-PY14', 'DL-TN15', 'DL-CD16', 'DL-7809'
  ];
  const placeholders = validIds.map(() => '?').join(',');

  const sqliteDb = new DatabaseSync('API/delta_dev.db');
  sqliteDb.prepare(`DELETE FROM schedules WHERE tour_id NOT IN (${placeholders})`).run(...validIds);
  sqliteDb.prepare(`DELETE FROM tours WHERE id NOT IN (${placeholders})`).run(...validIds);

  const remainingTours = sqliteDb.prepare("SELECT id, title FROM tours").all();
  console.log(`Remaining in SQLite: ${remainingTours.length} tours:`);
  remainingTours.forEach(t => console.log(`  - ${t.id}: ${t.title}`));

  // Check remaining in SQL Server
  const finalSqlTours = await pool.request().query("SELECT MaTour, TenTour FROM dbo.TOUR ORDER BY MaTour");
  console.log(`Remaining in SQL Server: ${finalSqlTours.recordset.length} tours:`);
  finalSqlTours.recordset.forEach(t => console.log(`  - [MaTour: ${t.MaTour}] ${t.TenTour}`));

  process.exit(0);
}

cleanup().catch(e => {
  console.error(e);
  process.exit(1);
});

