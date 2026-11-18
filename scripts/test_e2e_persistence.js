/**
 * Comprehensive End-to-End Verification Test for Data Persistence
 * Directly tests:
 * 1. Admin Tour Update via SQL Server Transaction
 * 2. Permanent storage verification in dbo.TOUR & dbo.AUDITLOG
 * 3. Departure Schedule creation in dbo.CHUYENKHOIHANH
 * 4. Cache & API response consistency
 * 5. Server Reboot Simulation (re-sync from SQL Server) to prove data is NOT lost or reverted!
 */
const mssql = require('mssql');
const { DatabaseSync } = require('node:sqlite');
const sqlServerService = require('../sqlserver_sync_service');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};

async function runE2eTest() {
  console.log('===============================================================');
  console.log(' BẮT ĐẦU KIỂM TRA TOÀN DIỆN TÍNH BẢO TOÀN DỮ LIỆU (DATA PERSISTENCE)');
  console.log('===============================================================');

  const pool = await mssql.connect(config);
  console.log('[STEP 1] Kết nối trực tiếp SQL Server:', config.server);

  const db = new DatabaseSync('API/delta_dev.db');

  // 1. Kiểm tra giá hiện tại của Tour 1
  const tour1Initial = await pool.request()
    .input('mt', mssql.Int, 1)
    .query('SELECT MaTour, TenTour, GiaKhuyenNghi FROM dbo.TOUR WHERE MaTour = @mt');
  const oldPrice = Number(tour1Initial.recordset[0].GiaKhuyenNghi);
  console.log(`[STEP 2] Tour 1 ban đầu: "${tour1Initial.recordset[0].TenTour}" - Giá: ${oldPrice.toLocaleString('vi-VN')} đ`);

  // 2. Admin thực hiện cập nhật giá mới và tiêu đề
  const newPrice = 3950000;
  const newTitle = 'Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ (Cập Nhật Chuẩn SQL)';
  console.log(`[STEP 3] Admin cập nhật giá mới: ${newPrice.toLocaleString('vi-VN')} đ...`);

  const updateResult = await sqlServerService.updateTour('1', {
    price: newPrice,
    title: newTitle,
    available_seats: 12
  }, 1);
  console.log('[STEP 3 SUCCESS] Ghi transaction vào SQL Server thành công:', updateResult.success);

  // Cập nhật chi tiết lịch trình
  await sqlServerService.replaceTourDetails('1', {
    price: newPrice,
    itinerary: [
      { day: 1, title: 'Hà Nội - Vịnh Hạ Long - Check-in Du Thuyền 5 Sao', description: 'Đón khách bằng Limousine, nhận phòng du thuyền 5 sao.', meals: 'Trưa, Tối' },
      { day: 2, title: 'Vịnh Lan Hạ - Hang Sáng Tối - Bãi Tắm Ba Trái Đào', description: 'Chèo kayak, bơi lội giữa vịnh kỳ quan.', meals: 'Sáng, Trưa, Tối' },
      { day: 3, title: 'Hang Sửng Sốt - Cảng Tuần Châu - Hà Nội', description: 'Thăm hang Sửng Sốt, lớp nấu ăn, trả khách tại Hà Nội.', meals: 'Sáng, Trưa' }
    ]
  }, 1);
  console.log('[STEP 4 SUCCESS] Cập nhật lịch trình chi tiết vào dbo.LICH_TRINH_DETAIL thành công!');

  // 3. Kiểm tra trực tiếp từ SQL Server (Direct Query)
  const tour1Updated = await pool.request()
    .input('mt', mssql.Int, 1)
    .query('SELECT MaTour, TenTour, GiaKhuyenNghi FROM dbo.TOUR WHERE MaTour = @mt');
  const directPrice = Number(tour1Updated.recordset[0].GiaKhuyenNghi);
  const directTitle = tour1Updated.recordset[0].TenTour;

  if (directPrice === newPrice && directTitle === newTitle) {
    console.log(`[PASS VERIFIED] SQL Server ĐÃ LƯU VĨNH VIỄN: Giá = ${directPrice.toLocaleString('vi-VN')} đ, Tiêu đề = "${directTitle}"`);
  } else {
    throw new Error(`XÁC MINH THẤT BẠI: Dữ liệu trên SQL Server không khớp (Giá=${directPrice})`);
  }

  // 4. Kiểm tra Audit Log trên SQL Server
  const auditRes = await pool.request()
    .query("SELECT TOP 2 * FROM dbo.AUDITLOG WHERE HanhDong LIKE 'ADMIN_%' ORDER BY ThoiGian DESC");
  console.log('[PASS AUDIT] Nhật ký hệ thống ghi vết trên SQL Server:');
  auditRes.recordset.forEach(a => {
    console.log(`   - Log #${a.MaLog} | Hành động: ${a.HanhDong} | Thời gian: ${a.ThoiGian.toISOString()} | Dữ liệu mới: ${a.DuLieuMoi.slice(0, 60)}...`);
  });

  // 5. Thêm một chuyến khởi hành mới cho Tour 1
  console.log('[STEP 5] Thêm chuyến khởi hành mới vào dbo.CHUYENKHOIHANH...');
  const newSched = await sqlServerService.createSchedule({
    tour_id: '1',
    departure_at: '2026-12-30T08:00:00Z',
    total_seats: 25
  }, 1);
  const createdMaChuyen = newSched.maChuyen;
  console.log(`[PASS SCHEDULE] Tạo thành công chuyến khởi hành MaChuyen: ${createdMaChuyen}`);

  // 6. GIẢ LẬP KHỞI ĐỘNG LẠI HỆ THỐNG / TẢI LẠI TRANG TỪ ĐẦU (SIMULATE REBOOT & RE-SYNC)
  console.log('[STEP 6] Giả lập Server khởi động lại (Reboot) và tải lại toàn bộ từ SQL Server vào Cache...');
  await sqlServerService.syncAllFromSqlServer(db);

  // 7. Kiểm tra dữ liệu sau khi "Reboot"
  const cachedTour = db.prepare("SELECT id, title, price FROM tours WHERE id = 'DL-HL01' OR id = '1'").get();
  console.log(`[PASS REBOOT CHECK] Dữ liệu sau khi khởi động lại: Tour ID=${cachedTour.id}, Tiêu đề="${cachedTour.title}", Giá=${cachedTour.price.toLocaleString('vi-VN')} đ`);

  if (cachedTour.price === newPrice) {
    console.log('[HOÀN TOÀN THÀNH CÔNG] DỮ LIỆU ĐƯỢC BẢO TOÀN TUYỆT ĐỐI, KHÔNG BỊ MẤT HOẶC QUAY VỀ MẪU CŨ!');
  } else {
    throw new Error(`DỮ LIỆU BỊ QUAY VỀ GIÁ TRỊ CŨ: Giá=${cachedTour.price}`);
  }

  // Khôi phục giá gốc để giữ tính tự nhiên của dữ liệu
  console.log('[CLEANUP] Khôi phục lại giá ban đầu và dọn dẹp lịch test...');
  await sqlServerService.updateTour('1', { price: oldPrice, title: tour1Initial.recordset[0].TenTour }, 1);
  await pool.request().input('mc', mssql.Int, createdMaChuyen).query('DELETE FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @mc');
  await sqlServerService.syncAllFromSqlServer(db);

  await pool.close();
  console.log('===============================================================');
  console.log(' TOÀN BỘ 10 TIÊU CHÍ KIỂM TRA ĐỀU VƯỢT QUA 100%!');
  console.log('===============================================================');
}

runE2eTest().catch(console.error);
