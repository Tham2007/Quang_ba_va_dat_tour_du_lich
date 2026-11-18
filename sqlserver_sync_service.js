/**
 * SQL Server Persistence Service for Delta Travel (12-Table Schema)
 * Provides explicit SQL Transactions, COMMIT/ROLLBACK, and AUDITLOG tracking
 * Directly interacts with Microsoft SQL Server on SmarterASP.NET
 */
const mssql = require('mssql');
const path = require('path');
const fs = require('fs');

// Tự động tải biến môi trường từ .env nếu chưa được thiết lập
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envLines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of envLines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const k = match[1];
        let v = (match[2] || '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch (e) {}
}

const SQL_SERVER_CONFIG = {
  user: process.env.DELTA_MSSQL_USER || process.env.SQL_SERVER_USER,
  password: process.env.DELTA_MSSQL_PASSWORD,
  server: process.env.DELTA_MSSQL_SERVER || process.env.SQL_SERVER_HOST,
  port: Number.parseInt(process.env.DELTA_MSSQL_PORT || process.env.SQL_SERVER_PORT || '1433', 10),
  database: process.env.DELTA_MSSQL_DATABASE || process.env.SQL_SERVER_DB,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 15000
  }
};

let pool = null;
const dynamicTourMap = new Map();

async function getPool() {
  if (!SQL_SERVER_CONFIG.user || !SQL_SERVER_CONFIG.password || !SQL_SERVER_CONFIG.server || !SQL_SERVER_CONFIG.database) {
    return null;
  }
  if (pool && pool.connected) return pool;
  try {
    pool = await mssql.connect(SQL_SERVER_CONFIG);
    console.log('[SQL SERVER SERVICE] Connected to', SQL_SERVER_CONFIG.server, SQL_SERVER_CONFIG.database);
    return pool;
  } catch (err) {
    console.warn('[SQL SERVER SERVICE] Optional connection error:', err.message);
    return null;
  }
}

/**
 * Map between external Tour ID (e.g. "DL-HL01" or "1") and SQL Server MaTour (INT)
 */
async function resolveMaTour(poolRef, tourId) {
  if (!tourId) return null;
  const num = Number(tourId);
  if (Number.isInteger(num) && num > 0) {
    const check = await poolRef.request()
      .input('mt', mssql.Int, num)
      .query('SELECT MaTour FROM dbo.TOUR WHERE MaTour = @mt');
    if (check.recordset.length > 0) return num;
  }

  // Look up by matching title or known prefix
  const mapping = {
    'DL-HL01': 1,
    'DL-DN02': 2,
    'DL-PQ03': 3,
    'DL-SP04': 4,
    'DL-SP05': 4,
    'DL-DL04': 7,
    'DL-MT06': 9,
    'DL-NB07': 10,
    'DL-HG08': 11,
    'DL-CB09': 12,
    'DL-MC10': 13,
    'DL-HU11': 14,
    'DL-NT12': 15,
    'DL-QN13': 16,
    'DL-PY14': 17,
    'DL-TN15': 18,
    'DL-CD16': 19
  };

  const strId = String(tourId).toUpperCase();
  if (dynamicTourMap.has(strId)) return dynamicTourMap.get(strId);
  if (mapping[strId]) {
    const check = await poolRef.request()
      .input('mt', mssql.Int, mapping[strId])
      .query('SELECT MaTour FROM dbo.TOUR WHERE MaTour = @mt');
    if (check.recordset.length > 0) return mapping[strId];
  }

  // Fallback: search by title snippet
  const searchStr = '%' + String(tourId).replace(/^DL-[A-Z0-9]+-?/i, '').slice(0, 15) + '%';
  const q = await poolRef.request()
    .input('s', mssql.NVarChar, searchStr)
    .query('SELECT TOP 1 MaTour FROM dbo.TOUR WHERE TenTour LIKE @s ORDER BY MaTour ASC');
  if (q.recordset.length > 0) return q.recordset[0].MaTour;

  return null;
}

/**
 * Resolve MaChuyen from schedule ID (e.g. "1", "SCHED-1", or UUID)
 */
async function resolveMaChuyen(poolRef, scheduleId) {
  if (!scheduleId) return null;
  const cleanId = String(scheduleId).replace(/^SCHED-/i, '');
  const num = Number(cleanId);
  if (Number.isInteger(num) && num > 0) {
    const check = await poolRef.request()
      .input('mc', mssql.Int, num)
      .query('SELECT MaChuyen FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @mc');
    if (check.recordset.length > 0) return num;
  }
  return null;
}

/**
 * 1. UPDATE TOUR (Transaction with COMMIT & ROLLBACK)
 */
async function updateTour(tourId, patchData, userId = null) {
  const p = await getPool();
  if (!p) return;
  const maTour = await resolveMaTour(p, tourId);
  if (!maTour) {
    console.warn(`[SQL SERVER] Không tìm thấy tour ${tourId} trong SQL Server (dbo.TOUR), bỏ qua.`);
    return;
  }

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    // 1. Lấy dữ liệu cũ để ghi Audit
    const oldRes = await new mssql.Request(tx)
      .input('mt', mssql.Int, maTour)
      .query('SELECT * FROM dbo.TOUR WHERE MaTour = @mt');
    const oldData = oldRes.recordset[0] || {};

    // 2. Chuẩn bị trường cập nhật
    const updates = [];
    const req = new mssql.Request(tx);
    req.input('maTour', mssql.Int, maTour);

    if (patchData.title !== undefined) {
      req.input('ten', mssql.NVarChar(200), String(patchData.title).slice(0, 200));
      updates.push('TenTour = @ten');
    }
    if (patchData.description !== undefined) {
      req.input('moTa', mssql.NVarChar(mssql.MAX), String(patchData.description));
      updates.push('MoTaChiTiet = @moTa');
    }
    if (patchData.price !== undefined) {
      req.input('gia', mssql.Decimal(18, 2), Number(patchData.price));
      updates.push('GiaKhuyenNghi = @gia');
    }
    if (patchData.active !== undefined) {
      req.input('tt', mssql.Bit, patchData.active ? 1 : 0);
      updates.push('TrangThai = @tt');
    }
    if (patchData.image !== undefined || (Array.isArray(patchData.images) && patchData.images.length > 0)) {
      const imgVal = patchData.image || patchData.images[0];
      req.input('anh', mssql.VarChar(255), String(imgVal).slice(0, 255));
      updates.push('HinhAnhDaiDien = @anh');
    }
    if (patchData.duration || patchData.departure || patchData.transport) {
      const summary = `${patchData.duration || oldData.LichTrinhTongQuan?.split('|')[0]?.trim() || '3N2Đ'} | ${patchData.departure || 'Hà Nội'} | ${patchData.transport || 'Xe VIP'}`;
      req.input('lichTrinh', mssql.NVarChar(500), summary.slice(0, 500));
      updates.push('LichTrinhTongQuan = @lichTrinh');
    }

    if (updates.length > 0) {
      await req.query(`UPDATE dbo.TOUR SET ${updates.join(', ')} WHERE MaTour = @maTour`);
    }

    // 3. Cập nhật số chỗ nếu có
    const incomingSeats = patchData.available_seats ?? patchData.availableSeats;
    if (incomingSeats !== undefined && incomingSeats !== null) {
      const seatsNum = Number(incomingSeats);
      if (!isNaN(seatsNum) && seatsNum >= 0) {
        const sReq = new mssql.Request(tx);
        sReq.input('mt', mssql.Int, maTour);
        sReq.input('sc', mssql.Int, seatsNum);
        await sReq.query(`
          UPDATE dbo.CHUYENKHOIHANH
          SET SoChoToiDa = SoChoDaDat + @sc
          WHERE MaTour = @mt AND TrangThaiChuyen = N'Mở bán'
        `);
      }
    }

    // 4. Ghi Audit Log vào dbo.AUDITLOG
    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_UPDATE_TOUR');
    aReq.input('cu', mssql.NVarChar(mssql.MAX), JSON.stringify({ maTour, giaCu: oldData.GiaKhuyenNghi, tenCu: oldData.TenTour }));
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify(patchData));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, @cu, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED UPDATE dbo.TOUR (MaTour: ${maTour})`);

    // Lấy bản ghi hoàn chỉnh sau cập nhật
    const res = await p.request().input('mt', mssql.Int, maTour).query('SELECT * FROM dbo.TOUR WHERE MaTour = @mt');
    return { success: true, maTour, tour: res.recordset[0] };
  } catch (err) {
    await tx.rollback();
    console.error(`[SQL SERVER] ROLLBACK UPDATE dbo.TOUR (MaTour: ${maTour}):`, err.message);
    throw err;
  }
}

/**
 * 2. REPLACE TOUR DETAILS (Giá bán & Lịch trình chi tiết từng ngày)
 */
async function replaceTourDetails(tourId, details, userId = null) {
  const p = await getPool();
  if (!p) return;
  const maTour = await resolveMaTour(p, tourId);
  if (!maTour) {
    console.warn(`[SQL SERVER] Không tìm thấy tour ${tourId} trong SQL Server (dbo.TOUR), bỏ qua chi tiết.`);
    return;
  }

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    // 1. Cập nhật giá bán trong dbo.TOUR
    const price = Number(details.price);
    if (price && price > 0) {
      const pReq = new mssql.Request(tx);
      pReq.input('mt', mssql.Int, maTour);
      pReq.input('gia', mssql.Decimal(18, 2), price);
      await pReq.query('UPDATE dbo.TOUR SET GiaKhuyenNghi = @gia WHERE MaTour = @mt');
    }

    // 2. Cập nhật chi tiết lịch trình trong dbo.LICH_TRINH_DETAIL
    if (Array.isArray(details.itinerary)) {
      const delReq = new mssql.Request(tx);
      delReq.input('mt', mssql.Int, maTour);
      await delReq.query('DELETE FROM dbo.LICH_TRINH_DETAIL WHERE MaTour = @mt');

      for (let i = 0; i < details.itinerary.length; i++) {
        const item = details.itinerary[i];
        const dayNum = Number(item.day_number ?? item.day ?? (i + 1));
        const title = String(item.title || `Ngày ${dayNum}`).slice(0, 200);
        const desc = String(item.description || item.noiDung || item.morning || 'Tham quan theo chương trình');
        const meals = String(item.meals || item.buaAn || 'Sáng, Trưa, Tối').slice(0, 100);

        const insReq = new mssql.Request(tx);
        insReq.input('mt', mssql.Int, maTour);
        insReq.input('ngay', mssql.Int, dayNum);
        insReq.input('tieude', mssql.NVarChar(200), title);
        insReq.input('noidung', mssql.NVarChar(mssql.MAX), desc);
        insReq.input('buaan', mssql.NVarChar(100), meals);
        await insReq.query(`
          INSERT INTO dbo.LICH_TRINH_DETAIL (MaTour, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn)
          VALUES (@mt, @ngay, @tieude, @noidung, @buaan)
        `);
      }
    }

    // 3. Ghi vết AUDITLOG
    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_REPLACE_TOUR_DETAILS');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ maTour, price, daysCount: details.itinerary?.length }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED REPLACE DETAILS (MaTour: ${maTour}, Price: ${price}, Itinerary: ${details.itinerary?.length} days)`);
    return { success: true, maTour };
  } catch (err) {
    await tx.rollback();
    console.error(`[SQL SERVER] ROLLBACK REPLACE DETAILS (MaTour: ${maTour}):`, err.message);
    throw err;
  }
}

/**
 * 3. CREATE TOUR (Chèn mới vào dbo.TOUR + Lịch khởi hành + Lịch trình)
 */
async function createTour(tourData, userId = null) {
  const p = await getPool();
  if (!p) return null;
  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const catId = Number(tourData.categoryId || tourData.MaDanhMuc || 1);
    const tenTour = String(tourData.title || tourData.TenTour || 'Tour Mới').slice(0, 200);
    const moTa = String(tourData.description || tourData.MoTaChiTiet || '');
    const lichTrinh = `${tourData.duration || '3N2Đ'} | ${tourData.departure || 'Hà Nội'} | ${tourData.transport || 'Xe VIP'}`.slice(0, 500);
    const gia = Number(tourData.price) || 2000000;
    const anh = String(tourData.image || (Array.isArray(tourData.images) ? tourData.images[0] : 'assets/images/halong.png')).slice(0, 255);
    const active = tourData.active !== undefined ? (tourData.active ? 1 : 0) : 1;

    const tReq = new mssql.Request(tx);
    tReq.input('catId', mssql.Int, catId);
    tReq.input('ten', mssql.NVarChar(200), tenTour);
    tReq.input('mota', mssql.NVarChar(mssql.MAX), moTa);
    tReq.input('lt', mssql.NVarChar(500), lichTrinh);
    tReq.input('gia', mssql.Decimal(18, 2), gia);
    tReq.input('anh', mssql.VarChar(255), anh);
    tReq.input('tt', mssql.Bit, active);

    const insRes = await tReq.query(`
      INSERT INTO dbo.TOUR (MaDanhMuc, TenTour, MoTaChiTiet, LichTrinhTongQuan, GiaKhuyenNghi, HinhAnhDaiDien, TrangThai)
      OUTPUT INSERTED.MaTour
      VALUES (@catId, @ten, @mota, @lt, @gia, @anh, @tt)
    `);
    const newMaTour = insRes.recordset[0].MaTour;

    // Chèn lịch khởi hành mẫu 7 ngày tới
    const sReq = new mssql.Request(tx);
    const depDate = new Date();
    depDate.setDate(depDate.getDate() + 7);
    const retDate = new Date(depDate);
    retDate.setDate(retDate.getDate() + 3);
    const seats = Number(tourData.available_seats ?? tourData.availableSeats ?? 25);

    sReq.input('mt', mssql.Int, newMaTour);
    sReq.input('dep', mssql.DateTime, depDate);
    sReq.input('ret', mssql.DateTime, retDate);
    sReq.input('gia', mssql.Decimal(18, 2), gia);
    sReq.input('soCho', mssql.Int, seats);
    await sReq.query(`
      INSERT INTO dbo.CHUYENKHOIHANH (MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
      VALUES (@mt, @dep, @ret, @gia, @soCho, 0, N'Mở bán')
    `);

    // Ghi Audit Log
    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_CREATE_TOUR');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ maTour: newMaTour, tenTour, gia }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    if (tourData.id) {
      dynamicTourMap.set(String(tourData.id).toUpperCase(), newMaTour);
    }
    console.log(`[SQL SERVER] COMMITTED CREATE dbo.TOUR (MaTour: ${newMaTour})`);
    return { success: true, maTour: newMaTour };
  } catch (err) {
    await tx.rollback();
    console.error('[SQL SERVER] ROLLBACK CREATE TOUR:', err.message);
    throw err;
  }
}

/**
 * 4. DELETE / DEACTIVATE TOUR
 */
async function deleteTour(tourId, userId = null) {
  const p = await getPool();
  if (!p) return;
  const maTour = await resolveMaTour(p, tourId);
  if (!maTour) {
    console.warn(`[SQL SERVER] Không tìm thấy tour ${tourId} trong SQL Server, bỏ qua xóa.`);
    return;
  }

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const tReq = new mssql.Request(tx);
    tReq.input('mt', mssql.Int, maTour);
    await tReq.query('UPDATE dbo.TOUR SET TrangThai = 0 WHERE MaTour = @mt');

    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_DEACTIVATE_TOUR');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ maTour }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED DEACTIVATE dbo.TOUR (MaTour: ${maTour})`);
    return { success: true, maTour };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/**
 * 5. CREATE SCHEDULE (Chèn vào dbo.CHUYENKHOIHANH)
 */
async function createSchedule(payload, userId = null) {
  const p = await getPool();
  if (!p) return null;
  const maTour = await resolveMaTour(p, payload.tour_id || payload.tourId);
  if (!maTour) {
    console.warn(`[SQL SERVER] Không tìm thấy tour ${payload.tour_id} để tạo lịch trong SQL Server, bỏ qua.`);
    return null;
  }

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const depDate = new Date(payload.departure_at || payload.departureAt);
    const retDate = new Date(depDate);
    retDate.setDate(retDate.getDate() + 3);
    const totalSeats = Number(payload.total_seats || payload.totalSeats) || 20;

    // Lấy giá tour hiện tại
    const tourQ = await new mssql.Request(tx)
      .input('mt', mssql.Int, maTour)
      .query('SELECT GiaKhuyenNghi FROM dbo.TOUR WHERE MaTour = @mt');
    const giaThucTe = tourQ.recordset[0]?.GiaKhuyenNghi || 2000000;

    const sReq = new mssql.Request(tx);
    sReq.input('mt', mssql.Int, maTour);
    sReq.input('dep', mssql.DateTime, depDate);
    sReq.input('ret', mssql.DateTime, retDate);
    sReq.input('gia', mssql.Decimal(18, 2), giaThucTe);
    sReq.input('seats', mssql.Int, totalSeats);
    sReq.input('tt', mssql.NVarChar(50), 'Mở bán');

    const insRes = await sReq.query(`
      INSERT INTO dbo.CHUYENKHOIHANH (MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
      OUTPUT INSERTED.MaChuyen
      VALUES (@mt, @dep, @ret, @gia, @seats, 0, @tt)
    `);
    const newMaChuyen = insRes.recordset[0].MaChuyen;

    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_CREATE_SCHEDULE');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ maChuyen: newMaChuyen, maTour, depDate, totalSeats }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED CREATE dbo.CHUYENKHOIHANH (MaChuyen: ${newMaChuyen})`);
    return { success: true, maChuyen: newMaChuyen };
  } catch (err) {
    await tx.rollback();
    console.error('[SQL SERVER] ROLLBACK CREATE SCHEDULE:', err.message);
    throw err;
  }
}

/**
 * 6. UPDATE SCHEDULE (Cập nhật ngày, số chỗ, trạng thái trong dbo.CHUYENKHOIHANH)
 */
async function updateSchedule(scheduleId, patchData, userId = null) {
  const p = await getPool();
  if (!p) return;
  const maChuyen = await resolveMaChuyen(p, scheduleId);
  if (!maChuyen) {
    console.warn(`[SQL SERVER] Không tìm thấy chuyến khởi hành ${scheduleId} trong SQL Server, bỏ qua cập nhật.`);
    return;
  }

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const updates = [];
    const req = new mssql.Request(tx);
    req.input('mc', mssql.Int, maChuyen);

    const departureAt = patchData.departure_at ?? patchData.departureAt;
    if (departureAt) {
      const depDate = new Date(departureAt);
      const retDate = new Date(depDate);
      retDate.setDate(retDate.getDate() + 3);
      req.input('dep', mssql.DateTime, depDate);
      req.input('ret', mssql.DateTime, retDate);
      updates.push('NgayKhoiHanh = @dep', 'NgayKetThuc = @ret');
    }

    const totalSeats = patchData.total_seats ?? patchData.totalSeats;
    if (totalSeats !== undefined && !isNaN(Number(totalSeats))) {
      req.input('seats', mssql.Int, Number(totalSeats));
      updates.push('SoChoToiDa = @seats');
    }

    if (patchData.active !== undefined) {
      req.input('tt', mssql.NVarChar(50), patchData.active ? 'Mở bán' : 'Đã đóng');
      updates.push('TrangThaiChuyen = @tt');
    } else if (patchData.status !== undefined) {
      const statusMap = { 'OPEN': 'Mở bán', 'CLOSED': 'Đã đóng', 'CANCELLED': 'Đã hủy', 'COMPLETED': 'Hoàn thành' };
      const ttStr = statusMap[String(patchData.status).toUpperCase()] || patchData.status;
      req.input('tt', mssql.NVarChar(50), ttStr);
      updates.push('TrangThaiChuyen = @tt');
    }

    if (updates.length > 0) {
      await req.query(`UPDATE dbo.CHUYENKHOIHANH SET ${updates.join(', ')} WHERE MaChuyen = @mc`);
    }

    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_UPDATE_SCHEDULE');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ maChuyen, ...patchData }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED UPDATE dbo.CHUYENKHOIHANH (MaChuyen: ${maChuyen})`);
    return { success: true, maChuyen };
  } catch (err) {
    await tx.rollback();
    console.error('[SQL SERVER] ROLLBACK UPDATE SCHEDULE:', err.message);
    throw err;
  }
}

/**
 * 7. DELETE SCHEDULE (Hủy chuyến trong dbo.CHUYENKHOIHANH)
 */
async function deleteSchedule(scheduleId, userId = null) {
  const p = await getPool();
  if (!p) return;
  const maChuyen = await resolveMaChuyen(p, scheduleId);
  if (!maChuyen) {
    console.warn(`[SQL SERVER] Không tìm thấy chuyến khởi hành ${scheduleId} trong SQL Server, bỏ qua xóa.`);
    return;
  }

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const sReq = new mssql.Request(tx);
    sReq.input('mc', mssql.Int, maChuyen);
    await sReq.query(`UPDATE dbo.CHUYENKHOIHANH SET TrangThaiChuyen = N'Đã hủy' WHERE MaChuyen = @mc`);

    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_DELETE_SCHEDULE');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ maChuyen }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED DELETE dbo.CHUYENKHOIHANH (MaChuyen: ${maChuyen})`);
    return { success: true, maChuyen };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/**
 * 8. SYNC ALL DATA FROM SQL SERVER INTO SQLITE CACHE
 * Đọc toàn bộ danh sách tours, schedules, itineraries từ SQL Server
 * và nạp vào SQLite để đảm bảo đồng bộ 100% hai chiều.
 */
async function syncAllFromSqlServer(sqliteDb) {
  try {
    const p = await getPool();
    if (!p) return;
    const toursRes = await p.request().query(`
      SELECT t.MaTour, t.MaDanhMuc, t.TenTour, t.MoTaChiTiet, t.LichTrinhTongQuan,
             t.GiaKhuyenNghi, t.HinhAnhDaiDien, t.TrangThai, d.TenDanhMuc
      FROM dbo.TOUR t
      JOIN dbo.DANHMUC d ON t.MaDanhMuc = d.MaDanhMuc
      ORDER BY t.MaTour ASC
    `);

    const schedRes = await p.request().query(`
      SELECT MaChuyen, MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen
      FROM dbo.CHUYENKHOIHANH
      ORDER BY NgayKhoiHanh ASC
    `);

    const itinRes = await p.request().query(`
      SELECT MaLichTrinh, MaTour, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn
      FROM dbo.LICH_TRINH_DETAIL
      ORDER BY MaTour ASC, NgayThu ASC
    `);

    const tours = toursRes.recordset;
    const scheds = schedRes.recordset;
    const itins = itinRes.recordset;

    console.log(`[SQL SERVER SYNC] Loaded ${tours.length} tours, ${scheds.length} schedules, ${itins.length} itineraries from SQL Server`);

    // Map itineraries by MaTour
    const itinMap = new Map();
    for (const it of itins) {
      if (!itinMap.has(it.MaTour)) itinMap.set(it.MaTour, []);
      itinMap.get(it.MaTour).push({
        day: it.NgayThu,
        day_number: it.NgayThu,
        title: it.TieuDeNgay,
        description: it.NoiDungChiTiet,
        meals: it.BuaAn
      });
    }

    const now = new Date().toISOString();
    const regionMap = { 1: 'north', 2: 'central', 3: 'south', 4: 'north' };

    // Reverse mapping to keep standard DL-codes for first 4 tours or by title
    const codeMap = {
      1: 'DL-HL01',
      2: 'DL-DN02',
      3: 'DL-PQ03',
      4: 'DL-SP05',
      5: 'DL-DN02',
      6: 'DL-PQ03',
      7: 'DL-DL04',
      8: 'DL-SP05',
      9: 'DL-MT06',
      10: 'DL-NB07',
      11: 'DL-HG08',
      12: 'DL-CB09',
      13: 'DL-MC10',
      14: 'DL-HU11',
      15: 'DL-NT12',
      16: 'DL-QN13',
      17: 'DL-PY14',
      18: 'DL-TN15',
      19: 'DL-CD16'
    };

    for (const t of tours) {
      const tourId = codeMap[t.MaTour] || String(t.MaTour);
      const region = regionMap[t.MaDanhMuc] || 'north';
      const duration = t.LichTrinhTongQuan ? t.LichTrinhTongQuan.split('|')[0].trim() : '3N2Đ';
      const price = Number(t.GiaKhuyenNghi) || 0;
      const originalPrice = Math.round(price * 1.15);
      const imagesJson = JSON.stringify([t.HinhAnhDaiDien || 'assets/images/halong.png']);
      const itineraryJson = JSON.stringify(itinMap.get(t.MaTour) || []);
      const activeFlag = t.TrangThai ? 1 : 0;

      sqliteDb.prepare(`
        INSERT INTO tours (id, slug, title, region, duration, price, original_price, image, departure, transport, flash_sale, description, itinerary_json, active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Hà Nội / TP.HCM', 'Xe VIP', 0, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          price = excluded.price,
          original_price = excluded.original_price,
          image = excluded.image,
          description = excluded.description,
          itinerary_json = excluded.itinerary_json,
          active = excluded.active,
          updated_at = excluded.updated_at
      `).run(tourId, 'tour-' + tourId.toLowerCase(), t.TenTour, region, duration, price, originalPrice, imagesJson, t.MoTaChiTiet || '', itineraryJson, activeFlag, now);
    }

    // Sync schedules
    for (const s of scheds) {
      const tourCode = codeMap[s.MaTour] || String(s.MaTour);
      const schedId = 'SCHED-' + s.MaChuyen;
      const depAt = s.NgayKhoiHanh ? new Date(s.NgayKhoiHanh).toISOString() : now;
      const total = Number(s.SoChoToiDa) || 25;
      const reserved = Number(s.SoChoDaDat) || 0;
      const active = s.TrangThaiChuyen === 'Mở bán' ? 1 : 0;

      sqliteDb.prepare(`
        INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          tour_id = excluded.tour_id,
          departure_at = excluded.departure_at,
          total_seats = excluded.total_seats,
          reserved_seats = excluded.reserved_seats,
          active = excluded.active
      `).run(schedId, tourCode, depAt, total, reserved, active);
    }

    console.log(`[SQL SERVER SYNC] Complete! Cached ${tours.length} tours and ${scheds.length} schedules in SQLite.`);
    return { success: true, count: tours.length };
  } catch (err) {
    console.error('[SQL SERVER SYNC] Error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getPool,
  resolveMaTour,
  resolveMaChuyen,
  updateTour,
  replaceTourDetails,
  createTour,
  deleteTour,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  syncAllFromSqlServer
};
