const sql = require('mssql');
const config = {
  user: 'db_ad0b71_dattour_admin',
  password: 'Phamtham312007@',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 10000 }
};

const expectedSchema = {
  NGUOIDUNG: ['MaNguoiDung', 'HoTen', 'Email', 'SoDienThoai', 'MatKhau', 'DiaChi', 'TrangThai', 'NgayTao'],
  DANHMUC: ['MaDanhMuc', 'TenDanhMuc', 'MoTa'],
  TOUR: ['MaTour', 'MaDanhMuc', 'TenTour', 'MoTaChiTiet', 'LichTrinhTongQuan', 'GiaKhuyenNghi', 'HinhAnhDaiDien', 'TrangThai'],
  HINHANH_TOUR: ['MaHinhAnh', 'MaTour', 'DuongDanAnh', 'GhiChu'],
  LICH_TRINH_DETAIL: ['MaLichTrinh', 'MaTour', 'NgayThu', 'TieuDeNgay', 'NoiDungChiTiet', 'BuaAn'],
  CHUYENKHOIHANH: ['MaChuyen', 'MaTour', 'NgayKhoiHanh', 'NgayKetThuc', 'GiaThucTe', 'SoChoToiDa', 'SoChoDaDat', 'TrangThaiChuyen'],
  DATTOUR: ['MaDatTour', 'MaKhachHang', 'MaChuyen', 'NgayDat', 'SoLuongKhach', 'TongTien', 'TrangThaiDat', 'TrangThaiThanhToan'],
  CHITIET_HANHKHACH: ['MaHanhKhach', 'MaDatTour', 'HoTen', 'NgaySinh', 'GioiTinh', 'SoDienThoai'],
  THANHTOAN: ['MaThanhToan', 'MaDatTour', 'PhuongThuc', 'SoTien', 'NgayThanhToan', 'MaGiaoDich', 'TrangThai'],
  DANHGIA: ['MaDanhGia', 'MaDatTour', 'SoSao', 'NoiDung', 'HinhAnh', 'NgayDanhGia', 'TrangThaiHienThi', 'PhanHoiAdmin'],
  BAIVIET_QUANGBA: ['MaBaiViet', 'TieuDe', 'Slug', 'TomTat', 'NoiDung', 'HinhAnhDaiDien', 'LuotXem', 'NgayTao', 'TrangThai', 'MaNguoiDang'],
  AUDITLOG: ['MaLog', 'MaNguoiThucHien', 'HanhDong', 'DuLieuCu', 'DuLieuMoi', 'ThoiGian']
};

async function verifyLive() {
  const pool = await sql.connect(config);
  
  // Get all tables
  const tablesRes = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  const tables = tablesRes.recordset.map(r => r.TABLE_NAME);
  
  // Get all columns
  const colsRes = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  
  const actualColsMap = {};
  colsRes.recordset.forEach(r => {
    if (!actualColsMap[r.TABLE_NAME]) actualColsMap[r.TABLE_NAME] = [];
    actualColsMap[r.TABLE_NAME].push(r.COLUMN_NAME);
  });

  let allMatch = true;
  console.log('========================================================================');
  console.log('LIVE AUDIT: SMARTERASP.NET SQL SERVER (db_ad0b71_dattour)');
  console.log('========================================================================');

  for (const [table, expectedCols] of Object.entries(expectedSchema)) {
    const actualCols = actualColsMap[table] || [];
    const missing = expectedCols.filter(c => !actualCols.includes(c));
    const extra = actualCols.filter(c => !expectedCols.includes(c));

    if (missing.length > 0 || extra.length > 0) {
      allMatch = false;
      console.log(`❌ Table [${table}]:`);
      if (missing.length > 0) console.log(`   -> MISSING: ${missing.join(', ')}`);
      if (extra.length > 0) console.log(`   -> EXTRA: ${extra.join(', ')}`);
    } else {
      console.log(`✅ Table [${table}]: 100% EXACT MATCH (${actualCols.length} columns)`);
    }
  }

  // Check extra tables
  const extraTables = tables.filter(t => !expectedSchema[t]);
  if (extraTables.length > 0) {
    allMatch = false;
    console.log(`❌ EXTRA TABLES IN DATABASE: ${extraTables.join(', ')}`);
  } else {
    console.log(`✅ EXACT 12 BASE TABLES: No extra tables in database!`);
  }

  console.log('========================================================================');
  if (allMatch) {
    console.log('🎉 PERFECT RESULT: CSDL KHỚP 100.0% Y HỆT ĐẶC TẢ YÊU CẦU CỦA BẠN!');
  } else {
    console.log('⚠️ Cần điều chỉnh thêm.');
  }
  console.log('========================================================================');

  await pool.close();
}

verifyLive().catch(console.error);
