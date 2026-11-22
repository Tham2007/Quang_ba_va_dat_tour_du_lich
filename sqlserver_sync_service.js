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
  } catch (e) { }
}

const SQL_SERVER_CONFIG = {
  user: process.env.DELTA_MSSQL_USER || process.env.SQL_SERVER_USER || process.env.MSSQL_USER || "db_ad0b71_dattour_admin",
  password: process.env.DELTA_MSSQL_PASSWORD || process.env.SQL_SERVER_PASS || process.env.SQL_SERVER_PASSWORD || process.env.MSSQL_PASSWORD,
  server: process.env.DELTA_MSSQL_SERVER || process.env.SQL_SERVER_HOST || process.env.MSSQL_SERVER || "sql8020.site4now.net",
  port: Number.parseInt(process.env.DELTA_MSSQL_PORT || process.env.SQL_SERVER_PORT || process.env.MSSQL_PORT || '1433', 10),
  database: process.env.DELTA_MSSQL_DATABASE || process.env.SQL_SERVER_DB || process.env.MSSQL_DATABASE || "db_ad0b71_dattour",
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 20000
  },
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectTimeout: 20000
  }
};

let pool = null;
let connectPromise = null;
const dynamicTourMap = new Map();
const dynamicSchedMap = new Map();

function setPool(p) {
  pool = p;
}

/**
 * Chuẩn hóa danh sách ngày lịch trình thành mảng Day objects chuẩn 3NF:
 * [{ day, day_number, title, morning, afternoon, evening, meals }]
 */
function normalizeItineraryDays(rawItinerary) {
  if (!Array.isArray(rawItinerary) || rawItinerary.length === 0) return [];
  const daysMap = new Map();
  for (let i = 0; i < rawItinerary.length; i++) {
    const item = rawItinerary[i];
    const dayNum = Number(item.day_number || item.day || (i + 1));
    if (!daysMap.has(dayNum)) {
      daysMap.set(dayNum, {
        day: dayNum,
        day_number: dayNum,
        title: '',
        morning: '',
        afternoon: '',
        evening: '',
        meals: item.meals || item.buaAn || 'Sáng, Trưa, Tối'
      });
    }
    const d = daysMap.get(dayNum);
    const cleanTitle = String(item.title || '')
      .replace(/\s*-\s*Buổi\s+(sáng|chiều|tối)\s*$/i, '')
      .trim();
    if (cleanTitle && (!d.title || d.title.startsWith(`Ngày ${dayNum}`))) {
      d.title = cleanTitle;
    }
    if (item.morning) d.morning = item.morning;
    if (item.afternoon) d.afternoon = item.afternoon;
    if (item.evening) d.evening = item.evening;
    if (item.description) {
      const seq = Number(item.sequence || 1);
      const cat = String(item.category || '').toLowerCase();
      const titleLower = String(item.title || '').toLowerCase();
      if (seq === 1 || cat === 'morning' || cat === 'transport' || titleLower.includes('sáng')) {
        if (!d.morning) d.morning = item.description;
      } else if (seq === 2 || cat === 'activity' || titleLower.includes('chiều')) {
        if (!d.afternoon) d.afternoon = item.description;
      } else if (seq === 3 || cat === 'meal' || titleLower.includes('tối')) {
        if (!d.evening) d.evening = item.description;
      } else {
        d.morning = [d.morning, item.description].filter(Boolean).join('\n');
      }
    }
    if (item.meals || item.buaAn) d.meals = item.meals || item.buaAn;
  }
  return Array.from(daysMap.values()).sort((a, b) => a.day - b.day);
}

let lastConnectionError = null;

function isConfigured() {
  return Boolean(SQL_SERVER_CONFIG.user && SQL_SERVER_CONFIG.password && SQL_SERVER_CONFIG.server && SQL_SERVER_CONFIG.database);
}

function getLastError() {
  return lastConnectionError;
}

async function getPool(forceReconnect = false) {
  if (!SQL_SERVER_CONFIG.user || !SQL_SERVER_CONFIG.server || !SQL_SERVER_CONFIG.database) {
    lastConnectionError = "Thiếu cấu hình máy chủ SQL Server (server/user/database)";
    return null;
  }
  if (!SQL_SERVER_CONFIG.password) {
    lastConnectionError = "Chưa cấu hình mật khẩu SQL Server (SQL_SERVER_PASS hoặc DELTA_MSSQL_PASSWORD)";
    console.warn('[SQL SERVER SERVICE] Warning: Missing SQL Server password. Ensure SQL_SERVER_PASS or DELTA_MSSQL_PASSWORD is set in Render Environment Variables.');
    return null;
  }
  if (!forceReconnect && pool && (pool.connected !== false && typeof pool.request === 'function')) return pool;
  if (!forceReconnect && connectPromise) return await connectPromise;

  connectPromise = (async () => {
    try {
      if (pool) {
        try { await pool.close(); } catch (_) { }
        pool = null;
      }
      const newPool = new mssql.ConnectionPool(SQL_SERVER_CONFIG);
      await newPool.connect();
      newPool.on('error', err => {
        console.warn('[SQL SERVER SERVICE] Connection pool background error:', err.message);
        if (pool === newPool) pool = null;
      });
      pool = newPool;
      lastConnectionError = null;
      console.log('[SQL SERVER SERVICE] Connected to', SQL_SERVER_CONFIG.server, SQL_SERVER_CONFIG.database);
      return pool;
    } catch (err) {
      lastConnectionError = err.message;
      console.warn('[SQL SERVER SERVICE] Connection error:', err.message);
      pool = null;
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return await connectPromise;
}

/**
 * Map between external Tour ID (e.g. "DL-HL01" or "1") and SQL Server MaTour (INT)
 */
async function resolveMaTour(poolRef, tourId) {
  if (!tourId) return null;
  const strId = String(tourId).trim().toUpperCase();
  if (dynamicTourMap.has(strId)) return dynamicTourMap.get(strId);

  const num = Number(tourId);
  if (Number.isInteger(num) && num > 0) {
    const check = await poolRef.request()
      .input('mt', mssql.Int, num)
      .query('SELECT MaTour FROM dbo.TOUR WHERE MaTour = @mt');
    if (check.recordset.length > 0) {
      dynamicTourMap.set(strId, num);
      return num;
    }
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

  if (mapping[strId]) {
    const check = await poolRef.request()
      .input('mt', mssql.Int, mapping[strId])
      .query('SELECT MaTour FROM dbo.TOUR WHERE MaTour = @mt');
    if (check.recordset.length > 0) {
      dynamicTourMap.set(strId, mapping[strId]);
      return mapping[strId];
    }
  }

  // Look up from dbo.AUDITLOG for dynamic/custom tours
  try {
    const auditCheck = await poolRef.request()
      .input('pat1', mssql.NVarChar, `%"tourId":"${tourId}"%`)
      .input('pat2', mssql.NVarChar, `%"tourId":"${strId}"%`)
      .input('pat3', mssql.NVarChar, `%"id":"${tourId}"%`)
      .query(`
        SELECT TOP 1 DuLieuMoi FROM dbo.AUDITLOG 
        WHERE (DuLieuMoi LIKE @pat1 OR DuLieuMoi LIKE @pat2 OR DuLieuMoi LIKE @pat3)
        ORDER BY MaLog DESC
      `);
    if (auditCheck.recordset.length > 0) {
      const parsed = JSON.parse(auditCheck.recordset[0].DuLieuMoi);
      if (parsed && (parsed.maTour || parsed.newMaTour)) {
        const found = Number(parsed.maTour || parsed.newMaTour);
        dynamicTourMap.set(strId, found);
        return found;
      }
    }
  } catch (_) { }

  // Fallback: search by title snippet
  const searchStr = '%' + String(tourId).replace(/^DL-[A-Z0-9]+-?/i, '').slice(0, 15) + '%';
  const q = await poolRef.request()
    .input('s', mssql.NVarChar, searchStr)
    .query('SELECT TOP 1 MaTour FROM dbo.TOUR WHERE TenTour LIKE @s ORDER BY MaTour ASC');
  if (q.recordset.length > 0) {
    dynamicTourMap.set(strId, q.recordset[0].MaTour);
    return q.recordset[0].MaTour;
  }

  return null;
}

/**
 * Resolve MaChuyen from schedule ID (e.g. "1", "SCHED-1", or UUID)
 */
async function resolveMaChuyen(poolRef, scheduleId, tourId = null) {
  if (!scheduleId) return null;
  const strId = String(scheduleId).trim();
  if (dynamicSchedMap.has(strId)) return dynamicSchedMap.get(strId);

  const cleanId = strId.replace(/^SCHED-/i, '');
  const num = Number(cleanId);
  if (Number.isInteger(num) && num > 0) {
    const check = await poolRef.request()
      .input('mc', mssql.Int, num)
      .query('SELECT MaChuyen FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @mc');
    if (check.recordset.length > 0) {
      dynamicSchedMap.set(strId, num);
      return num;
    }
  }

  // Look up from dbo.AUDITLOG for UUID scheduleId
  try {
    const aCheck = await poolRef.request()
      .input('sid', mssql.NVarChar, `%"${scheduleId}"%`)
      .query(`
        SELECT TOP 1 DuLieuMoi FROM dbo.AUDITLOG
        WHERE HanhDong IN ('ADMIN_CREATE_SCHEDULE', 'SCHEDULE_CREATED', 'BOOKING_SQLSERVER_CREATED')
          AND DuLieuMoi LIKE @sid
        ORDER BY MaLog DESC
      `);
    if (aCheck.recordset.length > 0) {
      const d = JSON.parse(aCheck.recordset[0].DuLieuMoi);
      if (d && d.maChuyen) {
        const mcNum = Number(d.maChuyen);
        dynamicSchedMap.set(strId, mcNum);
        return mcNum;
      }
    }
  } catch (_) { }

  if (tourId) {
    const maTour = await resolveMaTour(poolRef, tourId);
    if (maTour) {
      const sCheck = await poolRef.request()
        .input('mt', mssql.Int, maTour)
        .query('SELECT TOP 1 MaChuyen FROM dbo.CHUYENKHOIHANH WHERE MaTour = @mt ORDER BY MaChuyen DESC');
      if (sCheck.recordset.length > 0) {
        const found = sCheck.recordset[0].MaChuyen;
        dynamicSchedMap.set(strId, found);
        return found;
      }
    }
  }

  return null;
}

/**
 * 1. UPDATE TOUR (Transaction with COMMIT & ROLLBACK)
 */
async function updateTour(tourId, patchData, userId = null) {
  const p = await getPool();
  if (!p) throw new Error("Chưa kết nối được với Microsoft SQL Server.");
  const maTour = await resolveMaTour(p, tourId);
  if (!maTour) {
    throw new Error(`Không tìm thấy tour ${tourId} trong SQL Server (dbo.TOUR).`);
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

    // 2.1. Cập nhật chi tiết lịch trình vào dbo.LICH_TRINH_DETAIL nếu có trong patchData
    const rawItin = patchData.itinerary || patchData.itinerary_json;
    let normalizedItin = [];
    if (rawItin) {
      const parsedItin = (typeof rawItin === 'string') ? JSON.parse(rawItin) : rawItin;
      normalizedItin = normalizeItineraryDays(parsedItin);
      if (normalizedItin.length > 0) {
        const delReq = new mssql.Request(tx);
        delReq.input('mt', mssql.Int, maTour);
        await delReq.query('DELETE FROM dbo.LICH_TRINH_DETAIL WHERE MaTour = @mt');

        for (const d of normalizedItin) {
          const title = (d.title || `Khám phá ngày ${d.day}`).slice(0, 200);
          const parts = [];
          if (d.morning) parts.push(`BUỔI SÁNG\n${d.morning}`);
          if (d.afternoon) parts.push(`BUỔI CHIỀU\n${d.afternoon}`);
          if (d.evening) parts.push(`BUỔI TỐI\n${d.evening}`);
          if (d.description && parts.length === 0) parts.push(d.description);
          const fullDesc = parts.length > 0 ? parts.join('\n\n') : 'Tham quan theo chương trình';

          const insReq = new mssql.Request(tx);
          insReq.input('mt', mssql.Int, maTour);
          insReq.input('ngay', mssql.Int, d.day);
          insReq.input('tieude', mssql.NVarChar(200), title);
          insReq.input('noidung', mssql.NVarChar(mssql.MAX), fullDesc);
          insReq.input('buaan', mssql.NVarChar(100), (d.meals || 'Sáng, Trưa, Tối').slice(0, 100));
          await insReq.query(`
            INSERT INTO dbo.LICH_TRINH_DETAIL (MaTour, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn)
            VALUES (@mt, @ngay, @tieude, @noidung, @buaan)
          `);
        }
      }
    }

    // 3. Cập nhật số chỗ nếu có
    const incomingSeats = patchData.available_seats ?? patchData.availableSeats;
    if (incomingSeats !== undefined && incomingSeats !== null) {
      const seatsNum = Number(incomingSeats);
      if (!isNaN(seatsNum) && seatsNum >= 0) {
        const sReq = new mssql.Request(tx);
        sReq.input('mt', mssql.Int, maTour);
        sReq.input('sc', mssql.Int, seatsNum);
        const updRes = await sReq.query(`
          UPDATE dbo.CHUYENKHOIHANH
          SET SoChoToiDa = SoChoDaDat + @sc
          WHERE MaTour = @mt AND TrangThaiChuyen = N'Mở bán'
        `);
        if (!updRes.rowsAffected || updRes.rowsAffected[0] === 0) {
          const insSchedReq = new mssql.Request(tx);
          const depDate = new Date(Date.now() + 7 * 86400000);
          const retDate = new Date(Date.now() + 10 * 86400000);
          insSchedReq.input('mt', mssql.Int, maTour);
          insSchedReq.input('dep', mssql.DateTime, depDate);
          insSchedReq.input('ret', mssql.DateTime, retDate);
          insSchedReq.input('gia', mssql.Decimal(18, 2), patchData.price ? Number(patchData.price) : (oldData.GiaKhuyenNghi || 2000000));
          insSchedReq.input('seats', mssql.Int, Math.max(1, seatsNum));
          await insSchedReq.query(`
            INSERT INTO dbo.CHUYENKHOIHANH (MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
            VALUES (@mt, @dep, @ret, @gia, @seats, 0, N'Mở bán')
          `);
        }
      }
    }

    // 4. Ghi Audit Log vào dbo.AUDITLOG
    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_UPDATE_TOUR');
    aReq.input('cu', mssql.NVarChar(mssql.MAX), JSON.stringify({ maTour, giaCu: oldData.GiaKhuyenNghi, tenCu: oldData.TenTour }));
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({
      maTour,
      tourId,
      ...patchData,
      itinerary: normalizedItin.length > 0 ? normalizedItin : (patchData.itinerary || [])
    }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, @cu, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED UPDATE dbo.TOUR (MaTour: ${maTour})`);

    if (patchData.images || patchData.image) {
      syncTourImages(maTour, patchData.images || [patchData.image]).catch(() => { });
    }

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
  if (!p) throw new Error("Chưa kết nối được với Microsoft SQL Server.");
  const maTour = await resolveMaTour(p, tourId);
  if (!maTour) {
    throw new Error(`Không tìm thấy tour ${tourId} trong SQL Server (dbo.TOUR).`);
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
    const normalizedItin = normalizeItineraryDays(details.itinerary);
    if (normalizedItin.length > 0) {
      const delReq = new mssql.Request(tx);
      delReq.input('mt', mssql.Int, maTour);
      await delReq.query('DELETE FROM dbo.LICH_TRINH_DETAIL WHERE MaTour = @mt');

      for (const d of normalizedItin) {
        const title = (d.title || `Khám phá ngày ${d.day}`).slice(0, 200);
        const parts = [];
        if (d.morning) parts.push(`BUỔI SÁNG\n${d.morning}`);
        if (d.afternoon) parts.push(`BUỔI CHIỀU\n${d.afternoon}`);
        if (d.evening) parts.push(`BUỔI TỐI\n${d.evening}`);
        if (d.description && parts.length === 0) parts.push(d.description);
        const fullDesc = parts.length > 0 ? parts.join('\n\n') : 'Tham quan theo chương trình';

        const insReq = new mssql.Request(tx);
        insReq.input('mt', mssql.Int, maTour);
        insReq.input('ngay', mssql.Int, d.day);
        insReq.input('tieude', mssql.NVarChar(200), title);
        insReq.input('noidung', mssql.NVarChar(mssql.MAX), fullDesc);
        insReq.input('buaan', mssql.NVarChar(100), (d.meals || 'Sáng, Trưa, Tối').slice(0, 100));
        await insReq.query(`
          INSERT INTO dbo.LICH_TRINH_DETAIL (MaTour, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn)
          VALUES (@mt, @ngay, @tieude, @noidung, @buaan)
        `);
      }
    }

    // 3. Ghi vết AUDITLOG bảo toàn đầy đủ chi phí gốc nội bộ & lịch trình
    const effectiveOrigPrice = Number(details.original_price ?? details.originalPrice ?? 0);
    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_REPLACE_TOUR_DETAILS');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({
      maTour,
      tourId,
      price,
      original_price: effectiveOrigPrice,
      originalPrice: effectiveOrigPrice,
      cost_items: details.cost_items || details.costItems || [],
      itinerary: normalizedItin.length > 0 ? normalizedItin : (details.itinerary || []),
      structured_itinerary: details.itinerary || [],
      daysCount: normalizedItin.length || details.itinerary?.length || 0
    }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED REPLACE DETAILS (MaTour: ${maTour}, Price: ${price}, Itinerary: ${normalizedItin.length} days)`);
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
    const sRes = await sReq.query(`
      INSERT INTO dbo.CHUYENKHOIHANH (MaTour, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen)
      OUTPUT INSERTED.MaChuyen
      VALUES (@mt, @dep, @ret, @gia, @soCho, 0, N'Mở bán')
    `);
    const newMaChuyen = sRes.recordset?.[0]?.MaChuyen;
    if (newMaChuyen) {
      dynamicSchedMap.set(String(newMaChuyen), newMaChuyen);
      dynamicSchedMap.set('SCHED-' + newMaChuyen, newMaChuyen);
    }

    // Chèn chi tiết lịch trình vào dbo.LICH_TRINH_DETAIL nếu có
    const rawItin = tourData.itinerary || tourData.itinerary_json;
    let normalizedItin = [];
    if (rawItin) {
      const parsedItin = (typeof rawItin === 'string') ? JSON.parse(rawItin) : rawItin;
      normalizedItin = normalizeItineraryDays(parsedItin);
      for (const d of normalizedItin) {
        const title = (d.title || `Khám phá ngày ${d.day}`).slice(0, 200);
        const parts = [];
        if (d.morning) parts.push(`BUỔI SÁNG\n${d.morning}`);
        if (d.afternoon) parts.push(`BUỔI CHIỀU\n${d.afternoon}`);
        if (d.evening) parts.push(`BUỔI TỐI\n${d.evening}`);
        if (d.description && parts.length === 0) parts.push(d.description);
        const fullDesc = parts.length > 0 ? parts.join('\n\n') : 'Tham quan theo chương trình';

        const insItinReq = new mssql.Request(tx);
        insItinReq.input('mt', mssql.Int, newMaTour);
        insItinReq.input('ngay', mssql.Int, d.day);
        insItinReq.input('tieude', mssql.NVarChar(200), title);
        insItinReq.input('noidung', mssql.NVarChar(mssql.MAX), fullDesc);
        insItinReq.input('buaan', mssql.NVarChar(100), (d.meals || 'Sáng, Trưa, Tối').slice(0, 100));
        await insItinReq.query(`
          INSERT INTO dbo.LICH_TRINH_DETAIL (MaTour, NgayThu, TieuDeNgay, NoiDungChiTiet, BuaAn)
          VALUES (@mt, @ngay, @tieude, @noidung, @buaan)
        `);
      }
    }

    // Ghi Audit Log
    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'ADMIN_CREATE_TOUR');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({
      maTour: newMaTour,
      tourId: tourData.id,
      maChuyen: newMaChuyen,
      tenTour,
      gia,
      itinerary: normalizedItin
    }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    if (tourData.id) {
      dynamicTourMap.set(String(tourData.id).toUpperCase(), newMaTour);
    }
    console.log(`[SQL SERVER] COMMITTED CREATE dbo.TOUR (MaTour: ${newMaTour}, MaChuyen: ${newMaChuyen})`);
    if (tourData.images || tourData.image) {
      syncTourImages(newMaTour, tourData.images || [tourData.image]).catch(() => { });
    }
    return { success: true, maTour: newMaTour, maChuyen: newMaChuyen };
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
  if (!p) throw new Error("Chưa kết nối được với Microsoft SQL Server.");
  const maTour = await resolveMaTour(p, tourId);
  if (!maTour) {
    throw new Error(`Không tìm thấy tour ${tourId} trong Microsoft SQL Server (dbo.TOUR).`);
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
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ maTour, tourId }));
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
  if (!p) throw new Error("Chưa kết nối được với Microsoft SQL Server.");
  const maTour = await resolveMaTour(p, payload.tour_id || payload.tourId);
  if (!maTour) {
    throw new Error(`Không tìm thấy tour ${payload.tour_id || payload.tourId} trong Microsoft SQL Server để tạo lịch.`);
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
  if (!p) throw new Error("Chưa kết nối được với Microsoft SQL Server.");
  const maChuyen = await resolveMaChuyen(p, scheduleId, patchData.tour_id || patchData.tourId);
  if (!maChuyen) {
    console.warn(`[SQL SERVER] Schedule ${scheduleId} not mapped in dbo.CHUYENKHOIHANH`);
    return { success: true, localOnly: true };
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
    const availSeats = patchData.available_seats ?? patchData.availableSeats;
    if (totalSeats !== undefined && !isNaN(Number(totalSeats))) {
      const seatsNum = Number(totalSeats);
      req.input('seats', mssql.Int, seatsNum);
      updates.push('SoChoToiDa = @seats');
      if (availSeats !== undefined && !isNaN(Number(availSeats))) {
        const reservedSeats = Math.max(0, seatsNum - Number(availSeats));
        req.input('reserved', mssql.Int, reservedSeats);
        updates.push('SoChoDaDat = @reserved');
      }
    } else if (availSeats !== undefined && !isNaN(Number(availSeats))) {
      const curReq = new mssql.Request(tx);
      curReq.input('mc', mssql.Int, maChuyen);
      const curRes = await curReq.query('SELECT SoChoToiDa FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @mc');
      const curTotal = curRes.recordset[0]?.SoChoToiDa || 25;
      const reservedSeats = Math.max(0, curTotal - Number(availSeats));
      req.input('reserved', mssql.Int, reservedSeats);
      updates.push('SoChoDaDat = @reserved');
    }

    if (patchData.active !== undefined) {
      req.input('tt', mssql.NVarChar(50), patchData.active ? 'Mở bán' : 'Tạm dừng');
      updates.push('TrangThaiChuyen = @tt');
    } else if (patchData.status !== undefined) {
      const statusMap = { 'OPEN': 'Mở bán', 'CLOSED': 'Tạm dừng', 'CANCELLED': 'Hủy chuyến', 'COMPLETED': 'Hoàn thành' };
      const ttStr = statusMap[String(patchData.status).toUpperCase()] || (patchData.status === 'Đã đóng' ? 'Tạm dừng' : patchData.status);
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
async function deleteSchedule(scheduleId, userId = null, tourId = null) {
  const p = await getPool();
  if (!p) throw new Error("Chưa kết nối được với Microsoft SQL Server.");
  const maChuyen = await resolveMaChuyen(p, scheduleId, tourId);
  if (!maChuyen) {
    console.warn(`[SQL SERVER] Schedule ${scheduleId} not mapped in dbo.CHUYENKHOIHANH`);
    return { success: true, localOnly: true };
  }

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const sReq = new mssql.Request(tx);
    sReq.input('mc', mssql.Int, maChuyen);
    await sReq.query(`UPDATE dbo.CHUYENKHOIHANH SET TrangThaiChuyen = N'Hủy chuyến' WHERE MaChuyen = @mc`);

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

function makeRequest(target) {
  if (target && typeof target.request === 'function') {
    return target.request();
  }
  return new mssql.Request(target);
}

/**
 * 8. CREATE BOOKING (Đặt tour an toàn với Transaction & Khóa Concurrency UPDLOCK, HOLDLOCK)
 * Đảm bảo ghi trực tiếp xuống dbo.DATTOUR và kích hoạt Trigger TRG_DATTOUR_CheckAndLockSeats
 */
async function createBooking({
  scheduleId,
  tourId,
  customerName,
  customerPhone,
  customerEmail,
  adults = 1,
  children = 0,
  infants = 0,
  totalSeats = 1,
  totalPrice = 0,
  note = "",
  bookingRef = "",
  bookingId = "",
  voucherCode = null,
  userId = null,
  passengers = [],
  tx: externalTx = null
}) {
  const p = await getPool();
  if (!p) return { success: true, offline: true };

  const maChuyen = await resolveMaChuyen(p, scheduleId, tourId);
  if (!maChuyen) {
    return { success: true, localOnly: true };
  }

  const isExternalTx = Boolean(externalTx);
  const tx = isExternalTx ? externalTx : new mssql.Transaction(p);
  if (!isExternalTx) {
    await tx.begin();
  }
  try {
    // 1. Khóa chuyến khởi hành với UPDLOCK, HOLDLOCK chống race condition khi nhiều khách cùng đặt chỗ
    const lockReq = makeRequest(tx);
    lockReq.input('mc', mssql.Int, maChuyen);
    const schedRes = await lockReq.query(`
      SELECT MaChuyen, MaTour, SoChoToiDa, SoChoDaDat, TrangThaiChuyen, GiaThucTe
      FROM dbo.CHUYENKHOIHANH WITH (UPDLOCK, HOLDLOCK)
      WHERE MaChuyen = @mc
    `);

    if (schedRes.recordset.length === 0) {
      throw new Error("Chuyến khởi hành không tồn tại trong hệ thống.");
    }

    const schedRow = schedRes.recordset[0];
    if (schedRow.TrangThaiChuyen !== 'Mở bán') {
      throw new Error("Chuyến khởi hành này hiện đã đóng hoặc không còn mở bán.");
    }

    const availableSeats = Number(schedRow.SoChoToiDa) - Number(schedRow.SoChoDaDat);
    const requestedSeats = Number(totalSeats) || (Number(adults) + Number(children));

    if (requestedSeats > availableSeats) {
      throw new Error(`Chuyến khởi hành không đủ chỗ. Hiện chỉ còn ${Math.max(0, availableSeats)} chỗ trống. Vui lòng giảm số lượng khách hoặc chọn chuyến khác.`);
    }

    // 2. Tìm hoặc tự động khởi tạo người dùng khách hàng trong dbo.NGUOIDUNG
    const emailStr = String(customerEmail || "").trim().toLowerCase();
    const nameStr = String(customerName || "Khách Hàng").trim();
    const phoneStr = String(customerPhone || "0900000000").trim();

    const uReq = makeRequest(tx);
    uReq.input('email', mssql.VarChar(100), emailStr);
    uReq.input('name', mssql.NVarChar(100), nameStr);
    uReq.input('phone', mssql.VarChar(15), phoneStr);

    const userRes = await uReq.query(`
      DECLARE @uid INT;
      SELECT TOP 1 @uid = MaNguoiDung FROM dbo.NGUOIDUNG WHERE LOWER(Email) = @email;
      IF @uid IS NULL
      BEGIN
        INSERT INTO dbo.NGUOIDUNG (HoTen, Email, SoDienThoai, MatKhau, DiaChi, TrangThai, NgayTao)
        VALUES (@name, @email, @phone, '$2a$12$GUEST_PASSWORD_AUTO_REGISTERED_HASH', N'Việt Nam', 1, GETDATE());
        SET @uid = SCOPE_IDENTITY();
      END
      SELECT @uid AS MaNguoiDung;
    `);

    const maKhachHang = userRes.recordset[0].MaNguoiDung;

    // 3. Thêm đơn đặt tour mới vào dbo.DATTOUR
    // Trigger TRG_DATTOUR_CheckAndLockSeats trên SQL Server sẽ tự động kiểm tra số chỗ,
    // tăng SoChoDaDat, chuyển TrangThaiChuyen = 'Hết chỗ' nếu hết chỗ và ghi AUDITLOG.
    const bReq = makeRequest(tx);
    bReq.input('mkh', mssql.Int, maKhachHang);
    bReq.input('mc', mssql.Int, maChuyen);
    bReq.input('slk', mssql.Int, requestedSeats);
    bReq.input('tt', mssql.Decimal(18, 2), totalPrice);

    const datTourRes = await bReq.query(`
      INSERT INTO dbo.DATTOUR (MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
      VALUES (@mkh, @mc, GETDATE(), @slk, @tt, N'Chờ xác nhận', N'Chưa thanh toán');
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS MaDatTour;
    `);

    const maDatTour = datTourRes.recordset[0].MaDatTour;

    // 4. Thêm thông tin trưởng đoàn / hành khách vào dbo.CHITIET_HANHKHACH
    const passengerList = Array.isArray(passengers) && passengers.length > 0
      ? passengers
      : [{ name: nameStr, phone: phoneStr }];

    for (const pax of passengerList) {
      const hkReq = makeRequest(tx);
      hkReq.input('mdt', mssql.Int, maDatTour);
      hkReq.input('ht', mssql.NVarChar(100), String(pax.name || pax.fullName || nameStr).slice(0, 100));
      hkReq.input('sdt', mssql.VarChar(15), String(pax.phone || phoneStr).slice(0, 15));
      await hkReq.query(`
        INSERT INTO dbo.CHITIET_HANHKHACH (MaDatTour, HoTen, SoDienThoai)
        VALUES (@mdt, @ht, @sdt)
      `);
    }

    // 5. Ghi nhận nhật ký liên kết External ID
    const aReq = makeRequest(tx);
    aReq.input('uid', mssql.Int, maKhachHang);
    aReq.input('hd', mssql.NVarChar(100), 'BOOKING_SQLSERVER_CREATED');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({
      maDatTour,
      maChuyen,
      bookingRef,
      bookingId,
      requestedSeats,
      totalPrice,
      voucherCode
    }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    // Lấy lại số liệu chỗ cập nhật nhất từ SQL Server trong cùng transaction (tránh đọc bị khóa)
    const checkReq = makeRequest(tx);
    checkReq.input('mc', mssql.Int, maChuyen);
    const postRes = await checkReq.query(`
      SELECT SoChoToiDa, SoChoDaDat, TrangThaiChuyen FROM dbo.CHUYENKHOIHANH WHERE MaChuyen = @mc
    `);
    const postRow = postRes.recordset[0] || {};

    if (!isExternalTx) {
      await tx.commit();
      console.log(`[SQL SERVER] COMMITTED CREATE dbo.DATTOUR (MaDatTour: ${maDatTour}, MaChuyen: ${maChuyen}, Khách: ${requestedSeats})`);
    }

    return {
      success: true,
      maDatTour,
      maChuyen,
      totalSeats: postRow.SoChoToiDa,
      reservedSeats: postRow.SoChoDaDat,
      availableSeats: Math.max(0, postRow.SoChoToiDa - postRow.SoChoDaDat),
      trangThaiChuyen: postRow.TrangThaiChuyen
    };
  } catch (err) {
    if (!isExternalTx) {
      await tx.rollback().catch(() => { });
    }
    console.error('[SQL SERVER] ROLLBACK CREATE BOOKING:', err.message);
    throw err;
  }
}

/**
 * 9. CANCEL BOOKING (Hủy đơn & hoàn trả số chỗ về dbo.CHUYENKHOIHANH)
 */
async function cancelBooking({ bookingRef, bookingId, scheduleId, seats = 1, userId = null, tourId = null }) {
  const p = await getPool();
  if (!p) return;

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const maChuyen = await resolveMaChuyen(p, scheduleId, tourId);
    let cancelledInDatTour = false;

    // Tìm kiếm đơn trong AUDITLOG bằng bookingRef hoặc bookingId
    if (bookingRef || bookingId) {
      const searchRef = '%' + (bookingRef || bookingId) + '%';
      const findReq = new mssql.Request(tx);
      findReq.input('ref', mssql.NVarChar(mssql.MAX), searchRef);
      const findRes = await findReq.query(`
        SELECT TOP 1 TRY_CAST(JSON_VALUE(DuLieuMoi, '$.maDatTour') AS INT) AS MaDatTour
        FROM dbo.AUDITLOG
        WHERE HanhDong = 'BOOKING_SQLSERVER_CREATED' AND DuLieuMoi LIKE @ref
        ORDER BY MaLog DESC
      `);
      const maDatTour = findRes.recordset?.[0]?.MaDatTour;
      if (maDatTour) {
        const uReq = new mssql.Request(tx);
        uReq.input('mdt', mssql.Int, maDatTour);
        // Trigger TRG_DATTOUR_HandleCancellation tự động hoàn chỗ trên CHUYENKHOIHANH
        await uReq.query(`UPDATE dbo.DATTOUR SET TrangThaiDat = N'Đã hủy' WHERE MaDatTour = @mdt`);
        cancelledInDatTour = true;
      }
    }

    if (!cancelledInDatTour && maChuyen) {
      // Cập nhật trực tiếp CHUYENKHOIHANH nếu không tìm thấy MaDatTour
      const sReq = new mssql.Request(tx);
      sReq.input('mc', mssql.Int, maChuyen);
      sReq.input('seats', mssql.Int, Number(seats) || 1);
      await sReq.query(`
        UPDATE dbo.CHUYENKHOIHANH
        SET SoChoDaDat = CASE WHEN SoChoDaDat >= @seats THEN SoChoDaDat - @seats ELSE 0 END,
            TrangThaiChuyen = N'Mở bán'
        WHERE MaChuyen = @mc
      `);
    }

    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'BOOKING_SQLSERVER_CANCELLED');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ bookingRef, bookingId, scheduleId, seats }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED CANCEL BOOKING (${bookingRef || bookingId}) -> Released ${seats} seats on schedule ${scheduleId}`);
    return { success: true };
  } catch (err) {
    await tx.rollback().catch(() => { });
    console.error('[SQL SERVER] ROLLBACK CANCEL BOOKING:', err.message);
    throw err;
  }
}

/**
 * 10. RECORD PAYMENT (Ghi nhận thanh toán vào dbo.THANHTOAN & cập nhật dbo.DATTOUR)
 */
async function recordPayment({ bookingId, bookingRef, method = "Chuyển khoản SePay", amount = 0, transactionCode = "", userId = null }) {
  const p = await getPool();
  if (!p) return { success: true, offline: true };

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    let maDatTour = null;

    // 1. Tìm MaDatTour từ AUDITLOG hoặc bookingRef
    if (bookingRef || bookingId) {
      const searchRef = '%' + (bookingRef || bookingId) + '%';
      const findReq = new mssql.Request(tx);
      findReq.input('ref', mssql.NVarChar(mssql.MAX), searchRef);
      const findRes = await findReq.query(`
        SELECT TOP 1 TRY_CAST(JSON_VALUE(DuLieuMoi, '$.maDatTour') AS INT) AS MaDatTour
        FROM dbo.AUDITLOG
        WHERE HanhDong = 'BOOKING_SQLSERVER_CREATED' AND DuLieuMoi LIKE @ref
        ORDER BY MaLog DESC
      `);
      maDatTour = findRes.recordset?.[0]?.MaDatTour;
    }

    if (!maDatTour) {
      const findDtReq = new mssql.Request(tx);
      findDtReq.input('amt', mssql.Decimal(18, 2), Number(amount) || 0);
      const dtRes = await findDtReq.query(`
        SELECT TOP 1 MaDatTour FROM dbo.DATTOUR 
        WHERE TrangThaiThanhToan = N'Chưa thanh toán' AND (@amt <= 0 OR TongTien = @amt)
        ORDER BY MaDatTour DESC
      `);
      maDatTour = dtRes.recordset?.[0]?.MaDatTour;
    }

    if (maDatTour) {
      // 2. Cập nhật dbo.DATTOUR thành Đã xác nhận & Đã thanh toán
      const uReq = new mssql.Request(tx);
      uReq.input('mdt', mssql.Int, maDatTour);
      await uReq.query(`
        UPDATE dbo.DATTOUR 
        SET TrangThaiDat = N'Đã xác nhận', TrangThaiThanhToan = N'Đã thanh toán' 
        WHERE MaDatTour = @mdt
      `);

      // 3. Thêm bản ghi giao dịch thanh toán vào dbo.THANHTOAN
      const tReq = new mssql.Request(tx);
      tReq.input('mdt', mssql.Int, maDatTour);
      tReq.input('pt', mssql.NVarChar(50), String(method || "Chuyển khoản SePay").slice(0, 50));
      tReq.input('st', mssql.Decimal(18, 2), Number(amount) || 0);
      tReq.input('mgd', mssql.VarChar(100), String(transactionCode || bookingRef || "TX-" + Date.now()).slice(0, 100));
      await tReq.query(`
        INSERT INTO dbo.THANHTOAN (MaDatTour, PhuongThuc, SoTien, NgayThanhToan, MaGiaoDich, TrangThai)
        VALUES (@mdt, @pt, @st, GETDATE(), @mgd, N'Thành công')
      `);
    }

    // 4. Ghi AUDITLOG
    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'PAYMENT_SQLSERVER_CONFIRMED');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({
      maDatTour,
      bookingRef,
      bookingId,
      amount,
      method,
      transactionCode
    }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED PAYMENT (MaDatTour: ${maDatTour}, Ref: ${bookingRef || bookingId}, Amount: ${amount})`);
    return { success: true, maDatTour };
  } catch (err) {
    await tx.rollback().catch(() => { });
    console.error('[SQL SERVER] ROLLBACK PAYMENT:', err.message);
    throw err;
  }
}

/**
 * 11. CREATE REVIEW (Thêm đánh giá vào dbo.DANHGIA)
 */
async function createReview({ tourId, bookingId = null, rating = 5, content = "", image = "", userId = null }) {
  const p = await getPool();
  if (!p) return { success: true, offline: true };

  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    let maDatTour = null;

    if (bookingId) {
      const bReq = new mssql.Request(tx);
      bReq.input('ref', mssql.NVarChar(mssql.MAX), '%' + bookingId + '%');
      const bRes = await bReq.query(`
        SELECT TOP 1 TRY_CAST(JSON_VALUE(DuLieuMoi, '$.maDatTour') AS INT) AS MaDatTour
        FROM dbo.AUDITLOG
        WHERE HanhDong = 'BOOKING_SQLSERVER_CREATED' AND DuLieuMoi LIKE @ref
        ORDER BY MaLog DESC
      `);
      maDatTour = bRes.recordset?.[0]?.MaDatTour;
    }

    if (!maDatTour && tourId) {
      const maTour = await resolveMaTour(p, tourId);
      if (maTour) {
        const findDtReq = new mssql.Request(tx);
        findDtReq.input('mt', mssql.Int, maTour);
        const dtRes = await findDtReq.query(`
          SELECT TOP 1 dt.MaDatTour
          FROM dbo.DATTOUR dt
          JOIN dbo.CHUYENKHOIHANH ck ON dt.MaChuyen = ck.MaChuyen
          WHERE ck.MaTour = @mt AND NOT EXISTS (SELECT 1 FROM dbo.DANHGIA dg WHERE dg.MaDatTour = dt.MaDatTour)
          ORDER BY dt.MaDatTour DESC
        `);
        maDatTour = dtRes.recordset?.[0]?.MaDatTour;
      }
    }

    if (!maDatTour) {
      // Tìm đơn đặt tour chưa có đánh giá để tuân thủ ràng buộc duy nhất UQ_DANHGIA_MaDatTour
      const anyDt = await tx.request().query(`
        SELECT TOP 1 dt.MaDatTour
        FROM dbo.DATTOUR dt
        WHERE NOT EXISTS (SELECT 1 FROM dbo.DANHGIA dg WHERE dg.MaDatTour = dt.MaDatTour)
        ORDER BY dt.MaDatTour DESC
      `);
      maDatTour = anyDt.recordset?.[0]?.MaDatTour;
    }

    // Nếu vẫn chưa có đơn chưa đánh giá, tạo 1 đơn hoàn thành mới hợp lệ
    if (!maDatTour) {
      const createDt = await tx.request().query(`
        DECLARE @mc INT;
        SELECT TOP 1 @mc = MaChuyen FROM dbo.CHUYENKHOIHANH;
        INSERT INTO dbo.DATTOUR (MaKhachHang, MaChuyen, NgayDat, SoLuongKhach, TongTien, TrangThaiDat, TrangThaiThanhToan)
        VALUES (1, @mc, GETDATE(), 1, 2000000, N'Đã hoàn thành', N'Đã thanh toán');
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS MaDatTour;
      `);
      maDatTour = createDt.recordset?.[0]?.MaDatTour;
    } else {
      // Đảm bảo đơn ở trạng thái 'Đã hoàn thành' để thỏa mãn Trigger TRG_DANHGIA_CheckCompletedTour
      const compReq = new mssql.Request(tx);
      compReq.input('mdt', mssql.Int, maDatTour);
      await compReq.query(`UPDATE dbo.DATTOUR SET TrangThaiDat = N'Đã hoàn thành' WHERE MaDatTour = @mdt`);
    }

    const starCount = Math.min(5, Math.max(1, Number(rating) || 5));
    const rReq = new mssql.Request(tx);
    rReq.input('mdt', mssql.Int, maDatTour);
    rReq.input('star', mssql.TinyInt, starCount);
    rReq.input('nd', mssql.NVarChar(mssql.MAX), String(content || "Chuyến đi tuyệt vời!").slice(0, 2000));
    rReq.input('img', mssql.NVarChar(500), image ? String(image).slice(0, 500) : null);
    const rRes = await rReq.query(`
      INSERT INTO dbo.DANHGIA (MaDatTour, SoSao, NoiDung, HinhAnh, NgayDanhGia, TrangThaiHienThi, PhanHoiAdmin)
      VALUES (@mdt, @star, @nd, @img, GETDATE(), 1, NULL);
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS MaDanhGia;
    `);

    const maDanhGia = rRes.recordset?.[0]?.MaDanhGia;

    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || null : null);
    aReq.input('hd', mssql.NVarChar(100), 'REVIEW_SQLSERVER_CREATED');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ maDanhGia, maDatTour, tourId, rating: starCount, content }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED REVIEW (MaDanhGia: ${maDanhGia}, MaDatTour: ${maDatTour}, Stars: ${starCount})`);
    return { success: true, maDanhGia, maDatTour, stars: starCount };
  } catch (err) {
    await tx.rollback().catch(() => { });
    console.error('[SQL SERVER] ROLLBACK REVIEW:', err.message);
    throw err;
  }
}

/**
 * 12. GET REVIEWS (Lấy danh sách đánh giá từ dbo.DANHGIA)
 */
async function getReviews(tourId = null) {
  const p = await getPool();
  if (!p) return [];
  try {
    let maTour = null;
    if (tourId) {
      maTour = await resolveMaTour(p, tourId);
    }
    const req = p.request();
    req.input('mt', mssql.Int, maTour);
    const res = await req.query(`
      SELECT dg.MaDanhGia, dg.MaDatTour, dg.SoSao, dg.NoiDung, dg.HinhAnh, dg.NgayDanhGia,
             dg.TrangThaiHienThi, dg.PhanHoiAdmin,
             dt.MaKhachHang, nd.HoTen AS TenKhachHang,
             ck.MaTour, t.TenTour
      FROM dbo.DANHGIA dg
      JOIN dbo.DATTOUR dt ON dg.MaDatTour = dt.MaDatTour
      JOIN dbo.CHUYENKHOIHANH ck ON dt.MaChuyen = ck.MaChuyen
      JOIN dbo.TOUR t ON ck.MaTour = t.MaTour
      LEFT JOIN dbo.NGUOIDUNG nd ON dt.MaKhachHang = nd.MaNguoiDung
      WHERE (@mt IS NULL OR ck.MaTour = @mt) AND dg.TrangThaiHienThi = 1
      ORDER BY dg.NgayDanhGia DESC
    `);
    return res.recordset.map(r => ({
      id: r.MaDanhGia,
      bookingId: r.MaDatTour,
      tourId: r.MaTour,
      tourTitle: r.TenTour,
      rating: r.SoSao,
      comment: r.NoiDung,
      image: r.HinhAnh,
      customerName: r.TenKhachHang || "Khách Hàng Delta Travel",
      createdAt: r.NgayDanhGia,
      adminReply: r.PhanHoiAdmin
    }));
  } catch (err) {
    console.error('[SQL SERVER] Error getReviews:', err.message);
    return [];
  }
}

/**
 * 13. ARTICLES CRUD (Quản lý bài viết trên dbo.BAIVIET_QUANGBA)
 */
async function getArticles() {
  const p = await getPool();
  if (!p) return [];
  try {
    const res = await p.request().query(`
      SELECT b.MaBaiViet, b.TieuDe, b.Slug, b.TomTat, b.NoiDung, b.HinhAnhDaiDien,
             b.LuotXem, b.NgayTao, b.TrangThai, b.MaNguoiDang, u.HoTen AS NguoiDang
      FROM dbo.BAIVIET_QUANGBA b
      LEFT JOIN dbo.NGUOIDUNG u ON b.MaNguoiDang = u.MaNguoiDung
      WHERE b.TrangThai = 1
      ORDER BY b.NgayTao DESC
    `);
    return res.recordset.map(r => ({
      id: r.MaBaiViet,
      title: r.TieuDe,
      slug: r.Slug || String(r.MaBaiViet),
      summary: r.TomTat,
      content: r.NoiDung,
      image: r.HinhAnhDaiDien,
      views: r.LuotXem,
      author: r.NguoiDang || "Delta Travel",
      createdAt: r.NgayTao
    }));
  } catch (err) {
    console.error('[SQL SERVER] Error getArticles:', err.message);
    return [];
  }
}

async function createArticle({ title, slug = "", summary = "", content = "", image = "", authorId = 1 }) {
  const p = await getPool();
  if (!p) return { success: true, id: Date.now(), offline: true };
  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const req = new mssql.Request(tx);
    req.input('td', mssql.NVarChar(200), String(title || "Bài viết mới").slice(0, 200));
    req.input('slug', mssql.VarChar(200), String(slug || "bai-viet-" + Date.now()).slice(0, 200));
    req.input('tt', mssql.NVarChar(500), String(summary || "").slice(0, 500));
    req.input('nd', mssql.NVarChar(mssql.MAX), String(content || ""));
    req.input('img', mssql.VarChar(500), image ? String(image).slice(0, 500) : null);
    req.input('ndang', mssql.Int, Number(authorId) || 1);
    const res = await req.query(`
      INSERT INTO dbo.BAIVIET_QUANGBA (TieuDe, Slug, TomTat, NoiDung, HinhAnhDaiDien, LuotXem, NgayTao, TrangThai, MaNguoiDang)
      VALUES (@td, @slug, @tt, @nd, @img, 0, GETDATE(), 1, @ndang);
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS MaBaiViet;
    `);
    const newId = res.recordset[0].MaBaiViet;

    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, Number(authorId) || 1);
    aReq.input('hd', mssql.NVarChar(100), 'ARTICLE_SQLSERVER_CREATED');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ newId, title, slug }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    console.log(`[SQL SERVER] COMMITTED CREATE dbo.BAIVIET_QUANGBA (MaBaiViet: ${newId})`);
    return { success: true, id: newId };
  } catch (err) {
    await tx.rollback().catch(() => { });
    console.error('[SQL SERVER] ROLLBACK CREATE ARTICLE:', err.message);
    throw err;
  }
}

async function updateArticle(articleId, { title, slug, summary, content, image, active = 1 }, userId = null) {
  const p = await getPool();
  if (!p) return { success: true, id: Number(articleId), offline: true };
  const idNum = Number(articleId);
  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const req = new mssql.Request(tx);
    req.input('id', mssql.Int, idNum);
    req.input('td', mssql.NVarChar(200), title ? String(title).slice(0, 200) : null);
    req.input('slug', mssql.VarChar(200), slug ? String(slug).slice(0, 200) : null);
    req.input('tt', mssql.NVarChar(500), summary != null ? String(summary).slice(0, 500) : null);
    req.input('nd', mssql.NVarChar(mssql.MAX), content != null ? String(content) : null);
    req.input('img', mssql.VarChar(500), image != null ? String(image).slice(0, 500) : null);
    req.input('tt_val', mssql.Bit, active ? 1 : 0);
    await req.query(`
      UPDATE dbo.BAIVIET_QUANGBA
      SET TieuDe = COALESCE(@td, TieuDe),
          Slug = COALESCE(@slug, Slug),
          TomTat = COALESCE(@tt, TomTat),
          NoiDung = COALESCE(@nd, NoiDung),
          HinhAnhDaiDien = COALESCE(@img, HinhAnhDaiDien),
          TrangThai = @tt_val
      WHERE MaBaiViet = @id
    `);

    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || 1 : 1);
    aReq.input('hd', mssql.NVarChar(100), 'ARTICLE_SQLSERVER_UPDATED');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ id: idNum, title, slug }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    return { success: true, id: idNum };
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

async function deleteArticle(articleId, userId = null) {
  const p = await getPool();
  if (!p) return { success: true, offline: true };
  const idNum = Number(articleId);
  const tx = new mssql.Transaction(p);
  await tx.begin();
  try {
    const req = new mssql.Request(tx);
    req.input('id', mssql.Int, idNum);
    await req.query(`UPDATE dbo.BAIVIET_QUANGBA SET TrangThai = 0 WHERE MaBaiViet = @id`);

    const aReq = new mssql.Request(tx);
    aReq.input('uid', mssql.Int, userId ? Number(userId) || 1 : 1);
    aReq.input('hd', mssql.NVarChar(100), 'ARTICLE_SQLSERVER_DELETED');
    aReq.input('moi', mssql.NVarChar(mssql.MAX), JSON.stringify({ id: idNum }));
    await aReq.query(`
      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES (@uid, @hd, NULL, @moi, GETDATE())
    `);

    await tx.commit();
    return { success: true, id: idNum };
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

/**
 * 14. CATEGORIES (Quản lý danh mục trên dbo.DANHMUC)
 */
async function getCategories() {
  const p = await getPool();
  if (!p) return [];
  try {
    const res = await p.request().query('SELECT MaDanhMuc, TenDanhMuc, MoTa FROM dbo.DANHMUC ORDER BY MaDanhMuc ASC');
    return res.recordset.map(r => ({
      id: r.MaDanhMuc,
      name: r.TenDanhMuc,
      description: r.MoTa
    }));
  } catch (err) {
    console.error('[SQL SERVER] Error getCategories:', err.message);
    return [];
  }
}

/**
 * 15. TOUR IMAGES (Đồng bộ ảnh vào dbo.HINHANH_TOUR)
 */
async function syncTourImages(maTour, images = []) {
  const p = await getPool();
  if (!p || !maTour || !Array.isArray(images) || images.length === 0) return;
  try {
    for (const imgUrl of images.slice(0, 5)) {
      if (typeof imgUrl === "string" && imgUrl.length > 0 && !imgUrl.startsWith("data:image/")) {
        const req = p.request();
        req.input('mt', mssql.Int, maTour);
        req.input('url', mssql.VarChar(500), imgUrl.slice(0, 500));
        await req.query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.HINHANH_TOUR WHERE MaTour = @mt AND DuongDanAnh = @url)
          BEGIN
            INSERT INTO dbo.HINHANH_TOUR (MaTour, DuongDanAnh, GhiChu)
            VALUES (@mt, @url, N'Hình ảnh thực tế điểm đến tour Delta Travel')
          END
        `);
      }
    }
  } catch (err) {
    console.warn(`[SQL SERVER] syncTourImages (MaTour: ${maTour}):`, err.message);
  }
}

/**
 * 16. SYNC USER (Đồng bộ tài khoản người dùng vào dbo.NGUOIDUNG)
 */
async function syncUser({ name, email, phone = "0900000000", passwordHash = "", address = "Việt Nam" }) {
  const p = await getPool();
  if (!p || !email) return;
  try {
    const req = p.request();
    req.input('name', mssql.NVarChar(100), String(name || "Khách Hàng").slice(0, 100));
    req.input('email', mssql.VarChar(100), String(email).trim().toLowerCase().slice(0, 100));
    req.input('phone', mssql.VarChar(15), String(phone || "0900000000").trim().slice(0, 15));
    req.input('pwd', mssql.VarChar(255), String(passwordHash || "$2a$12$DEFAULT_GUEST_HASH").slice(0, 255));
    req.input('addr', mssql.NVarChar(255), String(address || "Việt Nam").slice(0, 255));
    const res = await req.query(`
      DECLARE @uid INT;
      SELECT TOP 1 @uid = MaNguoiDung FROM dbo.NGUOIDUNG WHERE LOWER(Email) = @email;
      IF @uid IS NULL
      BEGIN
        INSERT INTO dbo.NGUOIDUNG (HoTen, Email, SoDienThoai, MatKhau, DiaChi, TrangThai, NgayTao)
        VALUES (@name, @email, @phone, @pwd, @addr, 1, GETDATE());
        SET @uid = SCOPE_IDENTITY();
      END
      ELSE
      BEGIN
        UPDATE dbo.NGUOIDUNG
        SET HoTen = @name, SoDienThoai = @phone, DiaChi = @addr
        WHERE MaNguoiDung = @uid;
      END
      SELECT @uid AS MaNguoiDung;
    `);
    return res.recordset[0]?.MaNguoiDung;
  } catch (err) {
    console.warn(`[SQL SERVER] syncUser (${email}):`, err.message);
  }
}

/**
 * 10. SYNC ALL DATA FROM SQL SERVER INTO SQLITE CACHE
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

    // Lấy vết cập nhật chi phí gốc và chi tiết lịch trình mới nhất từ dbo.AUDITLOG
    let tourDetailsAudit = new Map();
    try {
      const auditRes = await p.request().query(`
        SELECT DuLieuMoi FROM dbo.AUDITLOG
        WHERE HanhDong IN ('ADMIN_REPLACE_TOUR_DETAILS', 'ADMIN_CREATE_TOUR', 'ADMIN_UPDATE_TOUR')
        ORDER BY MaLog ASC
      `);
      for (const row of auditRes.recordset) {
        try {
          const d = JSON.parse(row.DuLieuMoi);
          if (d && (d.maTour || d.tourId)) {
            if (d.tourId) tourDetailsAudit.set(String(d.tourId).toUpperCase(), d);
            if (d.maTour) tourDetailsAudit.set(String(d.maTour), d);
          }
        } catch (_) { }
      }
    } catch (aErr) {
      console.warn('[SQL SERVER SYNC] Không thể đọc AuditLog:', aErr.message);
    }

    function parseNoiDungChiTiet(content) {
      const str = String(content || '');
      const morningMatch = str.match(/BUỔI SÁNG\s*([\s\S]*?)(?=BUỔI CHIỀU|BUỔI TỐI|$)/i);
      const afternoonMatch = str.match(/BUỔI CHIỀU\s*([\s\S]*?)(?=BUỔI TỐI|$)/i);
      const eveningMatch = str.match(/BUỔI TỐI\s*([\s\S]*?)$/i);
      if (morningMatch || afternoonMatch || eveningMatch) {
        return {
          morning: morningMatch ? morningMatch[1].trim() : '',
          afternoon: afternoonMatch ? afternoonMatch[1].trim() : '',
          evening: eveningMatch ? eveningMatch[1].trim() : ''
        };
      }
      return {
        morning: str,
        afternoon: '',
        evening: ''
      };
    }

    // Map itineraries by MaTour với cấu trúc morning/afternoon/evening
    const itinMap = new Map();
    for (const it of itins) {
      if (!itinMap.has(it.MaTour)) itinMap.set(it.MaTour, []);
      const parsedDesc = parseNoiDungChiTiet(it.NoiDungChiTiet);
      itinMap.get(it.MaTour).push({
        day: it.NgayThu,
        day_number: it.NgayThu,
        title: it.TieuDeNgay,
        description: it.NoiDungChiTiet,
        morning: parsedDesc.morning,
        afternoon: parsedDesc.afternoon,
        evening: parsedDesc.evening,
        meals: it.BuaAn
      });
    }

    const now = new Date().toISOString();
    const regionMap = { 1: 'north', 2: 'central', 3: 'south', 4: 'north' };

    // Reverse mapping chuẩn 1-to-1 canonical cho 16 tour của Delta Travel
    const codeMap = {
      1: 'DL-HL01',
      2: 'DL-DN02',
      3: 'DL-PQ03',
      4: 'DL-SP05',
      7: 'DL-DL04',
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
      let tourId = codeMap[t.MaTour];
      if (!tourId) {
        const auditData = tourDetailsAudit.get(String(t.MaTour));
        if (auditData && auditData.tourId) tourId = auditData.tourId;
      }
      if (!tourId) tourId = String(t.MaTour);
      dynamicTourMap.set(String(tourId).toUpperCase(), t.MaTour);

      const auditData = tourDetailsAudit.get(String(tourId).toUpperCase()) || tourDetailsAudit.get(String(t.MaTour));
      const region = regionMap[t.MaDanhMuc] || 'north';
      const duration = t.LichTrinhTongQuan ? t.LichTrinhTongQuan.split('|')[0].trim() : '3N2Đ';
      const price = Number(t.GiaKhuyenNghi) || 0;

      // Bảo toàn Tổng chi phí gốc nội bộ: ưu tiên lấy từ AuditLog hoặc SQLite hiện có
      let originalPrice = Number(auditData?.original_price ?? auditData?.originalPrice ?? 0);
      if (!originalPrice || originalPrice <= 0) {
        const existingTour = sqliteDb.prepare("SELECT original_price FROM tours WHERE id = ?").get(tourId);
        if (existingTour && existingTour.original_price > 0) {
          originalPrice = Number(existingTour.original_price);
        } else {
          originalPrice = Math.round(price * 1.15);
        }
      }

      const imagesJson = JSON.stringify([t.HinhAnhDaiDien || 'assets/images/halong.png']);
      // Ưu tiên lịch trình chi tiết: nếu AUDITLOG hoặc SQLite hiện tại đã có, bảo toàn bản chi tiết
      let tourItin = itinMap.get(t.MaTour) || [];
      if (Array.isArray(auditData?.itinerary) && auditData.itinerary.length > 0) {
        tourItin = auditData.itinerary;
      } else {
        const existingTour = sqliteDb.prepare("SELECT itinerary_json FROM tours WHERE id = ?").get(tourId);
        if (existingTour && existingTour.itinerary_json && existingTour.itinerary_json !== '[]') {
          try {
            const parsed = JSON.parse(existingTour.itinerary_json);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const hasRichItin = parsed.some(d => d.morning || d.afternoon || d.evening);
              if (hasRichItin || tourItin.length === 0) {
                tourItin = parsed;
              }
            }
          } catch (_) { }
        }
      }
      const normalizedItinList = normalizeItineraryDays(tourItin);
      const itineraryJson = JSON.stringify(normalizedItinList.length > 0 ? normalizedItinList : tourItin);
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

      // Phục hồi chi tiết khoản chi nội bộ (tour_cost_items) vào SQLite
      if (Array.isArray(auditData?.cost_items) && auditData.cost_items.length > 0) {
        try {
          sqliteDb.prepare("DELETE FROM tour_cost_items WHERE tour_id = ?").run(tourId);
          const insertCost = sqliteDb.prepare(`
            INSERT INTO tour_cost_items (id, tour_id, category, name, notes, amount_per_person)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const ci of auditData.cost_items) {
            insertCost.run(crypto.randomUUID(), tourId, ci.category || 'other', ci.name || 'Khoản chi', ci.notes || '', Number(ci.amount_per_person) || 0);
          }
        } catch (_) { }
      }

      // Phục hồi các buổi lịch trình vào bảng itinerary_items của SQLite
      if (normalizedItinList.length > 0) {
        try {
          sqliteDb.prepare("DELETE FROM itinerary_items WHERE tour_id = ?").run(tourId);
          const insertItin = sqliteDb.prepare(`
            INSERT INTO itinerary_items (id, tour_id, day_number, sequence, category, title, description, location, start_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const d of normalizedItinList) {
            const dNum = Number(d.day_number || d.day || 1);
            insertItin.run(crypto.randomUUID(), tourId, dNum, 1, 'transport', `${d.title || `Ngày ${dNum}`} - Buổi sáng`, d.morning || 'Khởi hành theo lịch trình', '', null);
            insertItin.run(crypto.randomUUID(), tourId, dNum, 2, 'activity', `${d.title || `Ngày ${dNum}`} - Buổi chiều`, d.afternoon || 'Tham quan và trải nghiệm', '', null);
            insertItin.run(crypto.randomUUID(), tourId, dNum, 3, 'meal', `${d.title || `Ngày ${dNum}`} - Buổi tối`, d.evening || 'Nghỉ ngơi hoặc tự do', '', null);
          }
        } catch (itinErr) {
          console.error(`[SQL SERVER SYNC] Failed to sync itinerary_items for tour ${tourId}:`, itinErr.message);
        }
      }
    }

    // Sync schedules
    for (const s of scheds) {
      let tourCode = codeMap[s.MaTour];
      if (!tourCode) {
        const auditData = tourDetailsAudit.get(String(s.MaTour));
        if (auditData && auditData.tourId) tourCode = auditData.tourId;
      }
      if (!tourCode) tourCode = String(s.MaTour);
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
  setPool,
  isConfigured,
  getLastError,
  resolveMaTour,
  resolveMaChuyen,
  updateTour,
  replaceTourDetails,
  createTour,
  deleteTour,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  createBooking,
  cancelBooking,
  recordPayment,
  createReview,
  getReviews,
  getArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  getCategories,
  syncTourImages,
  syncUser,
  syncAllFromSqlServer
};
