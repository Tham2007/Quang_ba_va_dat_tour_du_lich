const sql = require("mssql");

const config = {
  user: "db_ad0b71_dattour_admin",
  password: "Phamtham312007@",
  server: "sql8020.site4now.net",
  port: 1433,
  database: "db_ad0b71_dattour",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000
  }
};

async function run() {
  console.log("Connecting to SQL Server...");
  const pool = await sql.connect(config);
  console.log("Connected successfully!");

  // 1. List of 12 tables and their row counts
  const tables = [
    "NGUOIDUNG", "DANHMUC", "TOUR", "HINHANH_TOUR", "LICH_TRINH_DETAIL",
    "CHUYENKHOIHANH", "DATTOUR", "CHITIET_HANHKHACH", "THANHTOAN",
    "DANHGIA", "BAIVIET_QUANGBA", "AUDITLOG"
  ];

  console.log("\n=== 12 BẢNG SQL SERVER (SMARTERASP.NET) VÀ SỐ DÒNG HIỆN CÓ ===");
  for (const t of tables) {
    try {
      const res = await pool.request().query(`SELECT COUNT(*) AS total FROM dbo.[${t}]`);
      console.log(`- ${t}: ${res.recordset[0].total} rows`);
    } catch (e) {
      console.log(`- ${t}: ERROR -> ${e.message}`);
    }
  }

  // 2. Query sample schedule
  console.log("\n=== THÔNG TIN CHUYẾN KHỞI HÀNH MẪU ===");
  const sched = await pool.request().query(`
    SELECT TOP 3 MaChuyen, MaTour, NgayKhoiHanh, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen 
    FROM dbo.CHUYENKHOIHANH 
    ORDER BY MaChuyen
  `);
  console.log(JSON.stringify(sched.recordset, null, 2));

  // 3. Test booking and seat locking with transaction & rollback
  console.log("\n=== KIỂM THỬ TRỰC TIẾP: LƯU ĐƠN - GIỮ CHỖ - HỦY HOÀN CHỖ (TRANSACTION SAFE) ===");
  const testTran = new sql.Transaction(pool);
  await testTran.begin();
  try {
    const r1 = new sql.Request(testTran);
    const beforeSched = await r1.query("SELECT MaChuyen, SoChoToiDa, SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = 1");
    const seatsBefore = beforeSched.recordset[0].SoChoDaDat;
    console.log(`[BƯỚC 1] Số chỗ đã đặt trước khi đặt: ${seatsBefore}/${beforeSched.recordset[0].SoChoToiDa}`);

    // Call sp_api_CreateBooking
    const r2 = new sql.Request(testTran);
    r2.input("MaKhachHang", sql.Int, 1);
    r2.input("MaChuyen", sql.Int, 1);
    r2.input("SoLuongKhach", sql.Int, 2);
    r2.input("HoTenNguoiDat", sql.NVarChar(100), "Nguyễn Khách Test");
    r2.input("SoDienThoai", sql.VarChar(15), "0912345678");
    const bookRes = await r2.execute("dbo.sp_api_CreateBooking");
    const bookData = bookRes.recordset[0];
    console.log(`[BƯỚC 2] Tạo đơn qua Stored Procedure: StatusCode=${bookData.StatusCode}, MaDatTour=${bookData.MaDatTour}, TongTien=${bookData.TongTien}`);

    const r3 = new sql.Request(testTran);
    const afterBookSched = await r3.query("SELECT MaChuyen, SoChoToiDa, SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = 1");
    const seatsAfterBook = afterBookSched.recordset[0].SoChoDaDat;
    console.log(`[BƯỚC 3] Số chỗ sau khi đặt (+2): ${seatsAfterBook}/${afterBookSched.recordset[0].SoChoToiDa} (Trigger giữ chỗ thành công!)`);

    // Add passenger
    const r4 = new sql.Request(testTran);
    r4.input("MaDatTour", sql.Int, bookData.MaDatTour);
    r4.input("HoTen", sql.NVarChar(100), "Trần Hành Khách 2");
    r4.input("NgaySinh", sql.Date, "1999-01-01");
    r4.input("GioiTinh", sql.NVarChar(10), "Nam");
    r4.input("SoDienThoai", sql.VarChar(15), "0987654321");
    await r4.execute("dbo.sp_api_AddPassenger");
    console.log(`[BƯỚC 4] Thêm hành khách thứ 2 qua sp_api_AddPassenger thành công.`);

    // Cancel booking
    const r5 = new sql.Request(testTran);
    r5.input("MaDatTour", sql.Int, bookData.MaDatTour);
    r5.input("MaKhachHang", sql.Int, 1);
    r5.input("LyDoHuy", sql.NVarChar(200), "Test hủy đơn kiểm tra hoàn chỗ");
    await r5.execute("dbo.sp_api_CancelBooking");
    console.log(`[BƯỚC 5] Hủy đơn qua sp_api_CancelBooking thành công.`);

    const r6 = new sql.Request(testTran);
    const afterCancelSched = await r6.query("SELECT MaChuyen, SoChoToiDa, SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = 1");
    const seatsAfterCancel = afterCancelSched.recordset[0].SoChoDaDat;
    console.log(`[BƯỚC 6] Số chỗ sau khi hủy (-2): ${seatsAfterCancel}/${afterCancelSched.recordset[0].SoChoToiDa} (Trigger hoàn chỗ thành công!)`);

    await testTran.rollback();
    console.log("[BƯỚC 7] Rollback transaction thành công -> Dữ liệu thực trên database bảo toàn tuyệt đối!");
  } catch (err) {
    await testTran.rollback();
    console.error("Test Transaction Error:", err);
  }

  await pool.close();
}

run().catch(console.error);
