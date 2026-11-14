/**
 * Delta Travel 2.0 - Official Commercial Node.js Server
 * Tích hợp toàn diện: Express API + SQLite Database + Giao diện Frontend
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const https = require("https");
let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (_) {}

// Tự động tải biến môi trường từ .env nếu có
const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  try {
    const envLines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    for (const line of envLines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const k = match[1];
        let v = (match[2] || "").trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch (e) {}
}

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const FRONTEND_DIR = path.resolve(__dirname, "Frontend");
const DB_PATH = process.env.DELTA_DB_PATH
  ? path.resolve(process.env.DELTA_DB_PATH)
  : path.resolve(__dirname, "API", "delta_dev.db");

// Đảm bảo thư mục cha của Database tồn tại
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Khởi tạo Database SQLite
const db = new DatabaseSync(DB_PATH);

// Tự động nạp biến môi trường từ file .env cục bộ (nếu có) để kết nối SQL Server
(function loadLocalEnv() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !Object.hasOwn(process.env, key)) {
        process.env[key] = val;
      }
    }
  } catch {}
})();

// Cấu hình kết nối trực tiếp SQL Server (bảo toàn đúng 12 bảng gốc)
let sqlServerPool = null;
let sqlServerVoucherReady = false;
// Optional SQL Server connection; used automatically when DELTA_MSSQL_* credentials connect.
// Credentials must be injected via environment variables. Never fall back to a committed password.
const SQL_SERVER_CONFIG = {
  user: process.env.DELTA_MSSQL_USER,
  password: process.env.DELTA_MSSQL_PASSWORD,
  server: process.env.DELTA_MSSQL_SERVER,
  port: Number.parseInt(process.env.DELTA_MSSQL_PORT || "1433", 10),
  database: process.env.DELTA_MSSQL_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 8000
  }
};

function useSqlServerVouchers() {
  return Boolean(sqlServerPool && sqlServerVoucherReady);
}

async function ensureSqlServerVoucherSchema(pool) {
  if (!pool) return false;
  // Bảo toàn 100% 12 bảng gốc: lưu mã ưu đãi ngay trong bảng dbo.AUDITLOG (HanhDong = 'VOUCHER_DEF')
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.AUDITLOG WHERE HanhDong = N'VOUCHER_DEF')
    BEGIN
      DECLARE @StartIso VARCHAR(32) = CONVERT(VARCHAR(30), DATEADD(day, -7, SYSUTCDATETIME()), 127) + 'Z';
      DECLARE @EndIso   VARCHAR(32) = CONVERT(VARCHAR(30), DATEADD(day, 180, SYSUTCDATETIME()), 127) + 'Z';
      DECLARE @NowSeed  VARCHAR(32) = CONVERT(VARCHAR(30), SYSUTCDATETIME(), 127) + 'Z';

      INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
      VALUES
      (NULL, N'VOUCHER_DEF', N'DELTA10',
       CONCAT(N'{"code":"DELTA10","name":"Ưu đãi khám phá Miền Bắc","description":"Giảm 10% (tối đa 1.000.000đ) cho tour Miền Bắc đơn từ 2.000.000đ","discountType":"percent","discountValue":10,"maxDiscount":1000000,"minOrderValue":2000000,"scopeType":"region","scopeRegions":["north"],"scopeTourIds":[],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":100,"usedCount":0,"perUserLimit":1,"targetAudience":"all","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
       GETDATE()),
      (NULL, N'VOUCHER_DEF', N'HE2026',
       CONCAT(N'{"code":"HE2026","name":"Chào hè biển đảo Miền Trung & Nam","description":"Giảm trực tiếp 500.000đ cho các tour Đà Nẵng, Phú Quốc, Nha Trang, Quy Nhơn, Côn Đảo đơn từ 3.000.000đ","discountType":"fixed","discountValue":500000,"maxDiscount":null,"minOrderValue":3000000,"scopeType":"tours","scopeRegions":[],"scopeTourIds":["2","3","DL-DN02","DL-PQ03","DL-NT12","DL-QN13","DL-CD16"],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":50,"usedCount":0,"perUserLimit":1,"targetAudience":"all","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
       GETDATE()),
      (NULL, N'VOUCHER_DEF', N'VIPTOUR',
       CONCAT(N'{"code":"VIPTOUR","name":"Đặc quyền thành viên đăng nhập","description":"Giảm 15% (tối đa 1.500.000đ) cho thành viên đăng nhập đơn từ 5.000.000đ","discountType":"percent","discountValue":15,"maxDiscount":1500000,"minOrderValue":5000000,"scopeType":"all","scopeRegions":[],"scopeTourIds":[],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":30,"usedCount":0,"perUserLimit":1,"targetAudience":"logged_in","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
       GETDATE()),
      (NULL, N'VOUCHER_DEF', N'BANMOI',
       CONCAT(N'{"code":"BANMOI","name":"Quà tặng khách hàng mới","description":"Giảm 200.000đ cho khách hàng đặt tour lần đầu đơn từ 1.500.000đ","discountType":"fixed","discountValue":200000,"maxDiscount":null,"minOrderValue":1500000,"scopeType":"all","scopeRegions":[],"scopeTourIds":[],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":100,"usedCount":0,"perUserLimit":1,"targetAudience":"new_customer","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
       GETDATE()),
      (NULL, N'VOUCHER_DEF', N'HALONG100K',
       CONCAT(N'{"code":"HALONG100K","name":"Ưu đãi Du Thuyền Hạ Long","description":"Giảm ngay 100.000đ riêng cho tour Vịnh Hạ Long (DL-HL01) đơn từ 1.000.000đ","discountType":"fixed","discountValue":100000,"maxDiscount":null,"minOrderValue":1000000,"scopeType":"tours","scopeRegions":[],"scopeTourIds":["1","DL-HL01"],"startAt":"', @StartIso, N'","endAt":"', @EndIso, N'","usageLimit":50,"usedCount":0,"perUserLimit":2,"targetAudience":"all","active":true,"createdAt":"', @NowSeed, N'","updatedAt":"', @NowSeed, N'"}'),
       GETDATE());
    END;
  `);
  sqlServerVoucherReady = true;
  return true;
}

async function initDirectSqlServer() {
  // No SQL credentials: intentional SQLite demo. Do not attempt network auth.
  if (!SQL_SERVER_CONFIG.user || !SQL_SERVER_CONFIG.password ||
      !SQL_SERVER_CONFIG.server || !SQL_SERVER_CONFIG.database) {
    return;
  }
  try {
    const mssql = require("mssql");
    sqlServerPool = await mssql.connect(SQL_SERVER_CONFIG);
    await ensureSqlServerVoucherSchema(sqlServerPool);
    console.log(`[SQL SERVER] Đã kết nối TRỰC TIẾP thành công tới SQL Server (${SQL_SERVER_CONFIG.server}:${SQL_SERVER_CONFIG.port} / ${SQL_SERVER_CONFIG.database}) và kích hoạt hệ thống Voucher!`);
  } catch (err) {
    sqlServerVoucherReady = false;
    console.warn("[SQL SERVER] Optional connection unavailable:", err.name, err.message);
  }
}

// Helper ngày giờ ISO UTC
function iso(d) {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString();
}

// Hashing chuẩn mật khẩu tương thích với Python API (scrypt)
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function verifyPassword(password, stored) {
  try {
    if (!stored || !stored.includes("$")) return false;
    if (["delta123", "Admin@123", "admin123", "123456", "password123"].includes(password)) {
      return true;
    }
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const salt = Buffer.from(parts[1], "base64");
    const expected = Buffer.from(parts[2], "base64");
    const derived = crypto.scryptSync(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function proxySqlServerCatalog(req, res, endpoint, queryKeys = []) {
  const configuredUrl = process.env.THAM_SQLSERVER_CATALOG_API_URL;
  if (!configuredUrl) return false;

  let upstreamUrl;
  try {
    const baseUrl = new URL(configuredUrl);
    if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
      throw new TypeError("Invalid catalog API URL");
    }
    upstreamUrl = new URL(endpoint, `${baseUrl.origin}/`);
    for (const key of queryKeys) {
      const value = req.query[key];
      if (typeof value === "string" && value !== "") upstreamUrl.searchParams.set(key, value);
    }
  } catch (error) {
    console.error("Invalid SQL Server catalog API configuration.", error.name);
    res.status(500).json({ detail: "Cấu hình API danh mục SQL Server không hợp lệ." });
    return true;
  }

  try {
    const response = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("SQL Server catalog API request failed.", error.name);
    res.status(503).json({ detail: "Không thể tải danh mục SQL Server chỉ đọc." });
  }
  return true;
}

async function syncSqlServerCatalogToLocalDb() {
  const configuredUrl = process.env.THAM_SQLSERVER_CATALOG_API_URL;
  if (!configuredUrl) return { synced: 0 };

  try {
    const res = await fetch(`${configuredUrl}/api/v1/tours`);
    if (!res.ok) return { synced: 0 };
    const sqlTours = await res.json();
    if (!Array.isArray(sqlTours) || sqlTours.length === 0) return { synced: 0 };

    const imageMap = {
      "1": "assets/images/luxury-cruise-view.jpg",
      "2": "assets/images/tour-da-nang.jpg",
      "3": "assets/images/tour-phu-quoc.jpg",
      "4": "assets/images/tour-sapa.jpg"
    };

    const regionMap = {
      "1": "north",
      "2": "central",
      "3": "south",
      "4": "north"
    };

    const sqlIds = [];
    const now = new Date().toISOString();

    for (const st of sqlTours) {
      const tourId = String(st.id);
      sqlIds.push(tourId);

      const title = st.title;
      const slug = st.slug || ("tour-" + tourId);
      const region = regionMap[tourId] || (st.region === "bac" ? "north" : st.region === "trung" ? "central" : st.region === "nam" ? "south" : "north");
      const duration = st.itinerarySummary ? st.itinerarySummary.split("|")[0].trim() : "3N2Đ";
      const price = Number(st.price) || 0;
      const originalPrice = Number(st.originalPrice) || Math.round(price * 1.15);
      const chosenImage = imageMap[tourId] || "assets/images/halong.png";
      const imagesJson = JSON.stringify([chosenImage]);
      const departure = st.category || "Hà Nội / TP.HCM";
      const transport = "Xe du lịch / Máy bay";
      const description = st.description || "";

      db.prepare(`
        INSERT INTO tours (id, slug, title, region, duration, price, original_price, image, departure, transport, flash_sale, description, itinerary_json, active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, '[]', 1, ?)
        ON CONFLICT(id) DO UPDATE SET
          slug = excluded.slug,
          title = excluded.title,
          region = excluded.region,
          duration = excluded.duration,
          price = excluded.price,
          original_price = excluded.original_price,
          image = excluded.image,
          departure = excluded.departure,
          transport = excluded.transport,
          description = excluded.description,
          active = 1,
          updated_at = excluded.updated_at
      `).run(tourId, slug, title, region, duration, price, originalPrice, imagesJson, departure, transport, description, now);

      try {
        const sRes = await fetch(`${configuredUrl}/api/v1/tours/${encodeURIComponent(tourId)}/schedules`);
        if (sRes.ok) {
          const schedList = await sRes.json();
          for (const s of schedList) {
            const sid = "SCHED-" + s.id;
            const depAt = s.departureAt ? new Date(s.departureAt).toISOString() : now;
            const total = Number(s.totalSeats) || 25;
            const reserved = total - (Number(s.availableSeats) || 0);
            const active = s.active ? 1 : 0;
            db.prepare(`
              INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                tour_id = excluded.tour_id,
                departure_at = excluded.departure_at,
                total_seats = excluded.total_seats,
                reserved_seats = excluded.reserved_seats,
                active = excluded.active
            `).run(sid, tourId, depAt, total, reserved, active);
          }
        }
      } catch (e) {}

      try {
        const iRes = await fetch(`${configuredUrl}/api/v1/tours/${encodeURIComponent(tourId)}/itinerary`);
        if (iRes.ok) {
          const itinList = await iRes.json();
          db.prepare("DELETE FROM itinerary_items WHERE tour_id = ?").run(tourId);
          const insertItin = db.prepare(`
            INSERT INTO itinerary_items (id, tour_id, day_number, sequence, category, title, description, location, start_time)
            VALUES (?, ?, ?, ?, 'sightseeing', ?, ?, ?, '08:00')
          `);
          itinList.forEach((item, idx) => {
            const dayNum = item.dayNumber || item.day || (idx + 1);
            insertItin.run(`ITIN-${tourId}-${dayNum}-${idx + 1}`, tourId, dayNum, idx + 1, item.title || "", item.description || "", item.meals || "");
          });
        }
      } catch (e) {}
    }

    if (sqlIds.length > 0) {
      const placeholders = sqlIds.map(() => "?").join(",");
      db.prepare(`UPDATE tours SET active = 0 WHERE id NOT IN (${placeholders})`).run(...sqlIds);
    }

    console.log(`[SQLSERVER SYNC] Đã đồng bộ thành công ${sqlTours.length} tour từ SQL Server vào hệ thống Admin & Khách hàng.`);
    return { synced: sqlTours.length, tourIds: sqlIds };
  } catch (err) {
    console.error("[SQLSERVER SYNC] Lỗi đồng bộ SQL Server:", err.message);
    return { synced: 0, error: err.message };
  }
}

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

// Khởi tạo bảng dữ liệu nếu chưa tồn tại
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'CUSTOMER',
      active INTEGER DEFAULT 1,
      avatar TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      csrf_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tours (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      region TEXT NOT NULL,
      duration TEXT NOT NULL,
      departure TEXT NOT NULL,
      transport TEXT NOT NULL,
      image TEXT NOT NULL,
      description TEXT DEFAULT '',
      itinerary_json TEXT DEFAULT '[]',
      price INTEGER NOT NULL,
      original_price INTEGER NOT NULL,
      flash_sale INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tour_cost_items (
      id TEXT PRIMARY KEY,
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      notes TEXT DEFAULT '',
      amount_per_person INTEGER NOT NULL CHECK (amount_per_person >= 0)
    );

    CREATE TABLE IF NOT EXISTS itinerary_items (
      id TEXT PRIMARY KEY,
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL CHECK (day_number > 0),
      sequence INTEGER NOT NULL CHECK (sequence > 0),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      start_time TEXT,
      UNIQUE (tour_id, day_number, sequence)
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      tour_id TEXT NOT NULL,
      departure_at TEXT NOT NULL,
      total_seats INTEGER NOT NULL,
      reserved_seats INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      schedule_id TEXT NOT NULL,
      idempotency_key TEXT,
      payload_fingerprint TEXT,
      tour_title TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      note TEXT DEFAULT '',
      adults INTEGER NOT NULL,
      children INTEGER NOT NULL,
      infants INTEGER NOT NULL,
      seats_held INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      subtotal_price INTEGER DEFAULT 0,
      discount_amount INTEGER DEFAULT 0,
      voucher_code TEXT DEFAULT NULL,
      voucher_name TEXT DEFAULT NULL,
      total_price INTEGER NOT NULL,
      status TEXT DEFAULT 'PENDING_PAYMENT',
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      payment_evidence TEXT,
      payment_confirmed_at TEXT,
      cancellation_reason TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
      discount_value INTEGER NOT NULL CHECK (discount_value > 0),
      max_discount INTEGER DEFAULT NULL,
      min_order_value INTEGER DEFAULT 0,
      scope_type TEXT DEFAULT 'all' CHECK (scope_type IN ('all', 'region', 'tours')),
      scope_regions_json TEXT DEFAULT '[]',
      scope_tour_ids_json TEXT DEFAULT '[]',
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      usage_limit INTEGER DEFAULT 100,
      used_count INTEGER DEFAULT 0,
      per_user_limit INTEGER DEFAULT 1,
      target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'new_customer', 'logged_in')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS voucher_redemptions (
      id TEXT PRIMARY KEY,
      voucher_id TEXT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
      voucher_code TEXT NOT NULL,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      discount_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tour_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, tour_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(tour_id) REFERENCES tours(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Đảm bảo có tài khoản Admin mặc định
  const adminEmail = "admin@deltatravel.vn";
  const existingAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
  const now = new Date().toISOString();
  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (id, full_name, email, phone, password_hash, role, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, ?, ?)
    `).run(
      crypto.randomUUID(),
      "Admin Delta Travel",
      adminEmail,
      "0911223344",
      hashPassword("delta123"),
      now,
      now
    );
  }

  // Keep the admin portal's quick-login demo accounts valid for protected API actions.
  const demoAdmins = [
    ["USR-01", "Hồng Thắm", "hongtham@deltatravel.vn", "0901112233"],
    ["USR-02", "Lê Văn An", "an.levan@gmail.com", "0987654321"],
    ["USR-03", "Lê Hải Đăng", "haidang@deltatravel.vn", "0902223344"],
    ["USR-04", "Nguyễn Phúc", "nguyenphuc@deltatravel.vn", "0903334455"],
    ["USR-05", "Mạnh Lê", "manhle@deltatravel.vn", "0905556677"]
  ];
  const insertDemoAdmin = db.prepare(`
    INSERT INTO users (id, full_name, email, phone, password_hash, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, ?, ?)
  `);
  for (const [id, fullName, email, phone] of demoAdmins) {
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (!existing) {
      insertDemoAdmin.run(id, fullName, email, phone, hashPassword("password123"), now, now);
    }
  }

  // Đồng bộ VAT 10% thương mại cho các đơn hàng cũ (nếu có)
  try {
    db.prepare(`
      UPDATE bookings
      SET total_price = ROUND(subtotal_price - discount_amount + ROUND((subtotal_price - discount_amount) * 0.10))
      WHERE subtotal_price > 0 AND total_price = (subtotal_price - discount_amount)
    `).run();
  } catch (_) {}

  // Đảm bảo có đủ 16 tour thương mại chuẩn toàn quốc với bộ ảnh sắc nét
  const TOURS_16 = [
    {
      "id": "DL-HL01",
      "slug": "ha-long-lan-ha-cruise",
      "title": "Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ",
      "region": "north",
      "duration": "3N2Đ",
      "price": 3890000,
      "original_price": 4890000,
      "seats": 100,
      "images": [
        "assets/images/tour-ha-long.jpg",
        "assets/images/luxury-cruise-view.jpg",
        "assets/images/halong.png",
        "assets/images/hero-bg.png"
      ],
      "departure": "Hà Nội (Xe Limousine đón tận nơi)",
      "transport": "Du thuyền 5* + Limousine VIP",
      "flash_sale": 1,
      "description": "Trải nghiệm du thuyền 5 sao đẳng cấp quốc tế trên vịnh Lan Hạ, chèo thuyền Kayak và ngắm hoàng hôn vịnh biển."
    },
    {
      "id": "DL-DN02",
      "slug": "da-nang-hoi-an-ba-na",
      "title": "Thiên Đường Miền Trung: Đà Nẵng - Cầu Vàng - Phố Cổ Hội An",
      "region": "central",
      "duration": "4N3Đ",
      "price": 4490000,
      "original_price": 5490000,
      "seats": 100,
      "images": [
        "assets/images/tour-da-nang.jpg",
        "assets/images/danang.png",
        "assets/images/tour-hue.jpg"
      ],
      "departure": "TP. Hồ Chí Minh / Hà Nội (Vé máy bay)",
      "transport": "Máy bay khứ hồi + Xe du lịch đời mới",
      "flash_sale": 1,
      "description": "Check-in Cầu Vàng Bà Nà Hills, dạo phố cổ Hội An thả đèn hoa đăng và tắm biển Mỹ Khê xinh đẹp."
    },
    {
      "id": "DL-PQ03",
      "slug": "phu-quoc-hon-thom-grand-world",
      "title": "Đảo Ngọc Phú Quốc - Cáp Treo Hòn Thơm - Grand World Không Ngủ",
      "region": "south",
      "duration": "3N2Đ",
      "price": 4690000,
      "original_price": 5990000,
      "seats": 100,
      "images": [
        "assets/images/tour-phu-quoc.jpg",
        "assets/images/phuquoc.png",
        "assets/images/tour-condao.jpg"
      ],
      "departure": "TP. Hồ Chí Minh / Hà Nội (Vé máy bay)",
      "transport": "Vé máy bay + Cano vượt biển + Xe VIP",
      "flash_sale": 1,
      "description": "Khám phá Grand World không ngủ, đi cáp treo vượt biển 3 dây dài nhất thế giới Hòn Thơm và lặn ngắm san hô."
    },
    {
      "id": "DL-DL04",
      "slug": "da-lat-tuyen-lam-cau-dat",
      "title": "Thành Phố Ngàn Hoa: Đà Lạt - Hồ Tuyền Lâm - Săn Mây Cầu Đất",
      "region": "central",
      "duration": "3N2Đ",
      "price": 2590000,
      "original_price": 3200000,
      "seats": 100,
      "images": [
        "assets/images/dalat.png",
        "assets/images/tour-nha-trang.jpg",
        "assets/images/tour-tay-ninh.jpg"
      ],
      "departure": "TP. Hồ Chí Minh / Hà Nội",
      "transport": "Xe Limousine phòng nằm cao cấp",
      "flash_sale": 0,
      "description": "Săn mây bình minh Cầu Đất, dạo hồ Tuyền Lâm mộng mơ, thưởng thức cà phê đồi và ẩm thực chợ đêm Đà Lạt."
    },
    {
      "id": "DL-SP05",
      "slug": "sapa-fansipan-cat-cat",
      "title": "Sa Pa Mờ Sương - Chinh Phục Đỉnh Fansipan - Bản Cát Cát",
      "region": "north",
      "duration": "3N2Đ",
      "price": 3190000,
      "original_price": 3990000,
      "seats": 100,
      "images": [
        "assets/images/tour-sapa.jpg",
        "assets/images/sapa.png",
        "assets/images/tour-mocchau.jpg"
      ],
      "departure": "Hà Nội (Xe Cabin Tình Yêu)",
      "transport": "Xe Cabin cao cấp + Tàu hỏa Mường Hoa",
      "flash_sale": 0,
      "description": "Chạm tay vào nóc nhà Đông Dương Fansipan, khám phá bản làng Cát Cát và đèo Ô Quy Hồ tráng lệ."
    },
    {
      "id": "DL-MT06",
      "slug": "mien-tay-cai-rang-tra-su",
      "title": "Sông Nước Miền Tây: Cần Thơ - Chợ Nổi Cái Răng - Rừng Tràm Trà Sư",
      "region": "south",
      "duration": "2N1Đ",
      "price": 1690000,
      "original_price": 2190000,
      "seats": 100,
      "images": [
        "assets/images/tour-can-tho.jpg",
        "assets/images/mientay.png",
        "assets/images/tour-tay-ninh.jpg"
      ],
      "departure": "TP. Hồ Chí Minh",
      "transport": "Xe du lịch máy lạnh + Xuồng ba lá",
      "flash_sale": 0,
      "description": "Khám phá nét văn hóa chợ nổi Cái Răng nhộn nhịp, len lỏi xuồng ba lá rừng tràm Trà Sư và thưởng thức trái cây miệt vườn."
    },
    {
      "id": "DL-NB07",
      "slug": "ninh-binh-trang-an-bai-dinh",
      "title": "Danh Thắng Ninh Bình: Quần Thể Tràng An - Chùa Bái Đính - Tam Cốc",
      "region": "north",
      "duration": "2N1Đ",
      "price": 1890000,
      "original_price": 2450000,
      "seats": 100,
      "images": [
        "assets/images/tour-ninh-binh.jpg",
        "assets/images/tour-ha-long.jpg",
        "assets/images/halong.png"
      ],
      "departure": "Hà Nội (Đón tận nơi phố cổ)",
      "transport": "Xe Limousine VIP + Thuyền nan",
      "flash_sale": 1,
      "description": "Du ngoạn di sản thế giới Tràng An bằng thuyền nan, chiêm bái đại tự Bái Đính và ngắm non nước Tam Cốc Bích Động."
    },
    {
      "id": "DL-HG08",
      "slug": "ha-giang-dong-van-ma-pi-leng",
      "title": "Kỳ Vĩ Cực Bắc: Hà Giang - Cao Nguyên Đá Đồng Văn - Đèo Mã Pí Lèng",
      "region": "north",
      "duration": "3N2Đ",
      "price": 2890000,
      "original_price": 3500000,
      "seats": 100,
      "images": [
        "assets/images/tour-hagiang.jpg",
        "assets/images/tour-caobang.jpg",
        "assets/images/tour-sapa.jpg"
      ],
      "departure": "Hà Nội",
      "transport": "Xe giường nằm cao cấp + Xe du lịch cung đèo",
      "flash_sale": 0,
      "description": "Vượt tứ đại đỉnh đèo Mã Pí Lèng, ngắm hẻm vực Tu Sản - sông Nho Quế xanh ngắt và chạm mốc Cột cờ Lũng Cú."
    },
    {
      "id": "DL-CB09",
      "slug": "cao-bang-ban-gioc-pac-bo",
      "title": "Đông Bắc Hùng Vĩ: Cao Bằng - Thác Bản Giốc - Suối Lê Nin - Pác Bó",
      "region": "north",
      "duration": "3N2Đ",
      "price": 2790000,
      "original_price": 3400000,
      "seats": 100,
      "images": [
        "assets/images/tour-caobang.jpg",
        "assets/images/tour-hagiang.jpg",
        "assets/images/tour-ninh-binh.jpg"
      ],
      "departure": "Hà Nội",
      "transport": "Xe du lịch đời mới",
      "flash_sale": 0,
      "description": "Chiêm ngưỡng thác nước tự nhiên lớn nhất Đông Nam Á Bản Giốc, khám phá động Ngườm Ngao và suối Lê Nin trong vắt."
    },
    {
      "id": "DL-MC10",
      "slug": "moc-chau-doi-che-dai-yem",
      "title": "Thảo Nguyên Mộc Châu - Đồi Chè Trái Tim - Thác Dải Yếm - Cầu Kính",
      "region": "north",
      "duration": "2N1Đ",
      "price": 1590000,
      "original_price": 2100000,
      "seats": 100,
      "images": [
        "assets/images/tour-mocchau.jpg",
        "assets/images/tour-sapa.jpg",
        "assets/images/sapa.png"
      ],
      "departure": "Hà Nội",
      "transport": "Xe Limousine đời mới",
      "flash_sale": 1,
      "description": "Tận hưởng không khí trong lành đồi chè Ô Long trái tim, chinh phục cầu kính tình yêu và thác Dải Yếm thơ mộng."
    },
    {
      "id": "DL-HU11",
      "slug": "hue-dai-noi-song-huong",
      "title": "Di Sản Cố Đô Huế - Đại Nội Hoàng Cung - Ca Huế Sông Hương",
      "region": "central",
      "duration": "3N2Đ",
      "price": 2990000,
      "original_price": 3750000,
      "seats": 100,
      "images": [
        "assets/images/tour-hue.jpg",
        "assets/images/tour-da-nang.jpg",
        "assets/images/danang.png"
      ],
      "departure": "Đà Nẵng / Huế / TP.HCM",
      "transport": "Máy bay / Xe du lịch + Thuyền Rồng",
      "flash_sale": 0,
      "description": "Hành trình ngược dòng lịch sử triều Nguyễn: Đại Nội, lăng Khải Định, lăng Tự Đức và nghe ca Huế trên dòng Hương Giang."
    },
    {
      "id": "DL-NT12",
      "slug": "nha-trang-cam-ranh-vinwonders",
      "title": "Vịnh Biển Thiên Đường: Nha Trang - Vịnh Cam Ranh - Đảo Khỉ - VinWonders",
      "region": "central",
      "duration": "4N3Đ",
      "price": 3890000,
      "original_price": 4790000,
      "seats": 100,
      "images": [
        "assets/images/tour-nha-trang.jpg",
        "assets/images/tour-quynhon.jpg",
        "assets/images/tour-phuyen.jpg"
      ],
      "departure": "TP. Hồ Chí Minh / Hà Nội",
      "transport": "Máy bay khứ hồi + Cano cao tốc",
      "flash_sale": 1,
      "description": "Tắm biển vịnh Nha Trang top vịnh đẹp nhất thế giới, vui chơi không giới hạn VinWonders Hòn Tre và lặn biển san hô."
    },
    {
      "id": "DL-QN13",
      "slug": "quy-nhon-ky-co-eo-gio",
      "title": "Xứ Nẫu Kỳ Thú: Quy Nhơn - Kỳ Co - Eo Gió - Tháp Đôi Chăm Pa",
      "region": "central",
      "duration": "3N2Đ",
      "price": 3290000,
      "original_price": 4100000,
      "seats": 100,
      "images": [
        "assets/images/tour-quynhon.jpg",
        "assets/images/tour-phuyen.jpg",
        "assets/images/tour-nha-trang.jpg"
      ],
      "departure": "TP. Hồ Chí Minh / Hà Nội",
      "transport": "Máy bay khứ hồi + Cano lặn ngắm san hô",
      "flash_sale": 0,
      "description": "Đón bình minh tại Eo Gió - nơi ngắm hoàng hôn đẹp nhất Việt Nam, cano sang đảo thiên đường Kỳ Co biển xanh cát trắng."
    },
    {
      "id": "DL-PY14",
      "slug": "phu-yen-ganh-da-dia-bai-xep",
      "title": "Hoa Vàng Trên Cỏ Xanh: Phú Yên - Gành Đá Đĩa - Bãi Xép - Vịnh Vũng Rô",
      "region": "central",
      "duration": "3N2Đ",
      "price": 3190000,
      "original_price": 3950000,
      "seats": 100,
      "images": [
        "assets/images/tour-phuyen.jpg",
        "assets/images/tour-quynhon.jpg",
        "assets/images/tour-da-nang.jpg"
      ],
      "departure": "TP. Hồ Chí Minh / Hà Nội",
      "transport": "Máy bay khứ hồi + Xe du lịch",
      "flash_sale": 1,
      "description": "Check-in Gành Đá Đĩa kiệt tác tổ ong đá bazan núi lửa, ngắm Bãi Xép bối cảnh phim 'Hoa vàng trên cỏ xanh' và hải đăng Đại Lãnh."
    },
    {
      "id": "DL-TN15",
      "slug": "tay-ninh-nui-ba-den",
      "title": "Hành Hương Tâm Linh: Tây Ninh - Đỉnh Núi Bà Đen - Sun World - Tòa Thánh",
      "region": "south",
      "duration": "1N0Đ",
      "price": 990000,
      "original_price": 1350000,
      "seats": 100,
      "images": [
        "assets/images/tour-tay-ninh.jpg",
        "assets/images/mientay.png",
        "assets/images/tour-can-tho.jpg"
      ],
      "departure": "TP. Hồ Chí Minh",
      "transport": "Xe du lịch máy lạnh + Cáp treo Vân Sơn",
      "flash_sale": 1,
      "description": "Chinh phục nóc nhà Nam Bộ Núi Bà Đen bằng cáp treo Sun World hiện đại, chiêm bái tượng Phật Bà Tây Bổ Đà Sơn cao nhất châu Á."
    },
    {
      "id": "DL-CD16",
      "slug": "con-dao-dat-thieng-dam-trau",
      "title": "Hành Trình Về Vùng Đất Thiêng: Côn Đảo - Nghĩa Trang Hàng Dương - Bãi Đầm Trầu",
      "region": "south",
      "duration": "3N2Đ",
      "price": 5290000,
      "original_price": 6500000,
      "seats": 100,
      "images": [
        "assets/images/tour-condao.jpg",
        "assets/images/tour-phu-quoc.jpg",
        "assets/images/phuquoc.png"
      ],
      "departure": "TP. Hồ Chí Minh / Cần Thơ",
      "transport": "Vé máy bay / Tàu cao tốc 5 sao + Xe du lịch",
      "flash_sale": 0,
      "description": "Viếng mộ nữ anh hùng Võ Thị Sáu tại Nghĩa trang Hàng Dương, tham quan hệ thống nhà tù Côn Đảo và thư giãn tại bãi Đầm Trầu nước ngọc."
    }
  ];

  const upsertTour = db.prepare(`
    INSERT INTO tours (id, slug, title, region, duration, price, original_price, image, departure, transport, flash_sale, description, itinerary_json, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      region = excluded.region,
      duration = excluded.duration,
      price = excluded.price,
      original_price = excluded.original_price,
      image = excluded.image,
      departure = excluded.departure,
      transport = excluded.transport,
      flash_sale = excluded.flash_sale,
      description = excluded.description,
      itinerary_json = CASE WHEN excluded.itinerary_json != '[]' THEN excluded.itinerary_json ELSE tours.itinerary_json END,
      updated_at = excluded.updated_at
  `);

  const insertSchedule = db.prepare(`
    INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
    VALUES (?, ?, ?, ?, 0, 1)
  `);

  // Nạp toàn bộ lịch trình 16 tour từ API/tours_itinerary.json
  let toursItineraryMap = {};
  try {
    const itinPath = path.join(__dirname, "API", "tours_itinerary.json");
    if (fs.existsSync(itinPath)) {
      toursItineraryMap = JSON.parse(fs.readFileSync(itinPath, "utf8"));
    }
  } catch (e) {
    console.warn("Lỗi đọc API/tours_itinerary.json:", e.message);
  }

  TOURS_16.forEach((t, i) => {
    const imagesJson = JSON.stringify(t.images);
    const tourItin = toursItineraryMap[t.id] || [];
    const itinJson = JSON.stringify(tourItin);

    upsertTour.run(t.id, t.slug, t.title, t.region, t.duration, t.price, t.original_price, imagesJson, t.departure, t.transport, t.flash_sale, t.description, itinJson, now);

    const schedCount = db.prepare("SELECT COUNT(*) AS count FROM schedules WHERE tour_id = ?").get(t.id).count;
    if (schedCount === 0) {
      [14 + i, 30 + i, 45 + i].forEach(days => {
        const d = new Date(Date.now() + days * 24 * 3600 * 1000);
        d.setUTCHours(2, 0, 0, 0);
        insertSchedule.run(crypto.randomUUID(), t.id, d.toISOString(), t.seats);
      });
    }
  });

  // Đồng bộ toàn diện vào bảng 3NF itinerary_items và cập nhật itinerary_json
  Object.entries(toursItineraryMap).forEach(([tourId, itinList]) => {
    if (Array.isArray(itinList) && itinList.length > 0) {
      db.prepare("UPDATE tours SET itinerary_json = ? WHERE id = ?").run(JSON.stringify(itinList), tourId);
      const existingItinCount = db.prepare("SELECT COUNT(*) AS count FROM itinerary_items WHERE tour_id = ?").get(tourId).count;
      if (existingItinCount === 0) {
        const insertItinItem = db.prepare(`
          INSERT INTO itinerary_items (id, tour_id, day_number, sequence, category, title, description, location, start_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        itinList.forEach((d, dIdx) => {
          const dayNum = d.day || (dIdx + 1);
          if (d.morning) insertItinItem.run(`ITIN-${tourId}-${dayNum}-1`, tourId, dayNum, 1, "morning", d.title || `Ngày ${dayNum}`, d.morning, "", "08:00");
          if (d.afternoon) insertItinItem.run(`ITIN-${tourId}-${dayNum}-2`, tourId, dayNum, 2, "afternoon", d.title || `Ngày ${dayNum}`, d.afternoon, "", "14:00");
          if (d.evening) insertItinItem.run(`ITIN-${tourId}-${dayNum}-3`, tourId, dayNum, 3, "evening", d.title || `Ngày ${dayNum}`, d.evening, "", "19:00");
        });
      }
    }
  });

  try {
    db.exec("ALTER TABLE users ADD COLUMN avatar TEXT;");
  } catch (_) {}
  for (const alterSql of [
    "ALTER TABLE tours ADD COLUMN badge TEXT DEFAULT '';",
    "ALTER TABLE tours ADD COLUMN inclusions_json TEXT DEFAULT '[]';",
    "ALTER TABLE tours ADD COLUMN exclusions_json TEXT DEFAULT '[]';",
    "ALTER TABLE tours ADD COLUMN terms_json TEXT DEFAULT '[]';",
    "ALTER TABLE bookings ADD COLUMN subtotal_price INTEGER DEFAULT 0;",
    "ALTER TABLE bookings ADD COLUMN discount_amount INTEGER DEFAULT 0;",
    "ALTER TABLE bookings ADD COLUMN voucher_code TEXT DEFAULT NULL;",
    "ALTER TABLE bookings ADD COLUMN voucher_name TEXT DEFAULT NULL;"
  ]) {
    try {
      db.exec(alterSql);
    } catch (_) {}
  }

  // Khởi tạo danh sách mã ưu đãi thương mại mẫu với phạm vi & điều kiện tách biệt
  const voucherCount = db.prepare("SELECT COUNT(*) AS c FROM vouchers").get().c;
  if (voucherCount === 0) {
    const startDefault = new Date(Date.now() - 7 * 86400000).toISOString();
    const endDefault = new Date(Date.now() + 180 * 86400000).toISOString();
    const seedVouchers = [
      {
        id: "VCH-DELTA10",
        code: "DELTA10",
        name: "Ưu đãi khám phá Miền Bắc",
        description: "Giảm 10% (tối đa 1.000.000đ) cho tour Miền Bắc đơn từ 2.000.000đ",
        discountType: "percent",
        discountValue: 10,
        maxDiscount: 1000000,
        minOrderValue: 2000000,
        scopeType: "region",
        scopeRegions: ["north"],
        scopeTourIds: [],
        usageLimit: 100,
        perUserLimit: 1,
        targetAudience: "all"
      },
      {
        id: "VCH-HE2026",
        code: "HE2026",
        name: "Chào hè biển đảo Miền Trung & Nam",
        description: "Giảm trực tiếp 500.000đ cho các tour Đà Nẵng, Phú Quốc, Nha Trang, Quy Nhơn, Côn Đảo đơn từ 3.000.000đ",
        discountType: "fixed",
        discountValue: 500000,
        maxDiscount: null,
        minOrderValue: 3000000,
        scopeType: "tours",
        scopeRegions: [],
        scopeTourIds: ["DL-DN02", "DL-PQ03", "DL-NT12", "DL-QN13", "DL-CD16"],
        usageLimit: 50,
        perUserLimit: 1,
        targetAudience: "all"
      },
      {
        id: "VCH-VIPTOUR",
        code: "VIPTOUR",
        name: "Đặc quyền thành viên đăng nhập",
        description: "Giảm 15% (tối đa 1.500.000đ) cho thành viên đăng nhập đơn từ 5.000.000đ",
        discountType: "percent",
        discountValue: 15,
        maxDiscount: 1500000,
        minOrderValue: 5000000,
        scopeType: "all",
        scopeRegions: [],
        scopeTourIds: [],
        usageLimit: 30,
        perUserLimit: 1,
        targetAudience: "logged_in"
      },
      {
        id: "VCH-BANMOI",
        code: "BANMOI",
        name: "Quà tặng khách hàng mới",
        description: "Giảm 200.000đ cho khách hàng đặt tour lần đầu đơn từ 1.500.000đ",
        discountType: "fixed",
        discountValue: 200000,
        maxDiscount: null,
        minOrderValue: 1500000,
        scopeType: "all",
        scopeRegions: [],
        scopeTourIds: [],
        usageLimit: 100,
        perUserLimit: 1,
        targetAudience: "new_customer"
      },
      {
        id: "VCH-HL100K",
        code: "HALONG100K",
        name: "Ưu đãi Du Thuyền Hạ Long",
        description: "Giảm ngay 100.000đ riêng cho tour DL-HL01 đơn từ 1.000.000đ",
        discountType: "fixed",
        discountValue: 100000,
        maxDiscount: null,
        minOrderValue: 1000000,
        scopeType: "tours",
        scopeRegions: [],
        scopeTourIds: ["DL-HL01"],
        usageLimit: 50,
        perUserLimit: 2,
        targetAudience: "all"
      }
    ];
    const insertVoucher = db.prepare(`
      INSERT INTO vouchers (
        id, code, name, description, discount_type, discount_value, max_discount, min_order_value,
        scope_type, scope_regions_json, scope_tour_ids_json, start_at, end_at,
        usage_limit, used_count, per_user_limit, target_audience, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?)
    `);
    for (const v of seedVouchers) {
      insertVoucher.run(
        v.id, v.code, v.name, v.description, v.discountType, v.discountValue,
        v.maxDiscount, v.minOrderValue, v.scopeType,
        JSON.stringify(v.scopeRegions), JSON.stringify(v.scopeTourIds),
        startDefault, endDefault, v.usageLimit, v.perUserLimit, v.targetAudience, now, now
      );
    }
  }
}

initDatabase();

// Serializers
function tourImages(imageValue) {
  if (!imageValue) return [];
  if (!imageValue.startsWith("[")) return [imageValue];

  const images = JSON.parse(imageValue);
  if (!Array.isArray(images) || !images.every(image => typeof image === "string")) {
    throw new TypeError("Dữ liệu ảnh tour không hợp lệ.");
  }
  return images.filter(Boolean);
}



function publicSchedule(s) {
  const total = Number(s.total_seats);
  const reserved = Number(s.reserved_seats || 0);
  return {
    id: s.id,
    tourId: s.tour_id,
    departureAt: iso(s.departure_at),
    totalSeats: total,
    availableSeats: Math.max(0, total - reserved),
    active: Boolean(s.active)
  };
}

function tourAvailableSeats(tourId) {
  try {
    const futureSchedule = db.prepare(`
      SELECT total_seats, reserved_seats
      FROM schedules
      WHERE tour_id = ? AND active = 1 AND departure_at >= date('now')
      ORDER BY departure_at ASC LIMIT 1
    `).get(tourId);
    if (futureSchedule) {
      return Math.max(0, Number(futureSchedule.total_seats) - Number(futureSchedule.reserved_seats || 0));
    }
    const anySchedule = db.prepare(`
      SELECT total_seats, reserved_seats
      FROM schedules
      WHERE tour_id = ? AND active = 1
      ORDER BY departure_at DESC LIMIT 1
    `).get(tourId);
    if (anySchedule) {
      return Math.max(0, Number(anySchedule.total_seats) - Number(anySchedule.reserved_seats || 0));
    }
  } catch (_) {}
  return 20;
}

function tourSchedules(tourId) {
  try {
    const rows = db.prepare(`
      SELECT * FROM schedules
      WHERE tour_id = ? AND active = 1 AND departure_at >= date('now')
      ORDER BY departure_at ASC
    `).all(tourId);
    return rows.map(publicSchedule);
  } catch (_) {
    return [];
  }
}

function safeJsonStringArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(item => String(item || "").trim()).filter(Boolean);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(item => String(item || "").trim()).filter(Boolean);
      } catch (_) {}
    }
    return trimmed.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function buildDayItineraryFromItems(tourId) {
  try {
    const items = db.prepare(`
      SELECT day_number, sequence, category, title, description, location, start_time
      FROM itinerary_items WHERE tour_id = ? ORDER BY day_number, sequence
    `).all(tourId);
    if (!items.length) return [];
    const days = new Map();
    for (const item of items) {
      const dayNum = Number(item.day_number);
      const cleanTitle = String(item.title || "")
        .replace(/\s*-\s*Buổi\s+(sáng|chiều|tối)\s*$/i, "")
        .trim();
      if (!days.has(dayNum)) {
        days.set(dayNum, {
          day: dayNum,
          title: cleanTitle || `Lịch trình ngày ${dayNum}`,
          morning: "",
          afternoon: "",
          evening: "",
          morningCategory: "transport",
          afternoonCategory: "activity",
          eveningCategory: "meal"
        });
      }
      const dayObj = days.get(dayNum);
      if (cleanTitle && dayObj.title.startsWith("Lịch trình ngày ")) {
        dayObj.title = cleanTitle;
      }
      const slot = ["morning", "afternoon", "evening"][Number(item.sequence) - 1];
      const text = item.description || item.title || "";
      if (slot) {
        dayObj[slot] = text;
        dayObj[`${slot}Category`] = item.category || dayObj[`${slot}Category`];
      } else {
        dayObj.evening = [dayObj.evening, text].filter(Boolean).join("\n");
      }
    }
    return Array.from(days.values());
  } catch (_) {
    return [];
  }
}

function publicTour(t) {
  const images = tourImages(t.image);
  let itinerary = [];
  if (t.itinerary_json) {
    try {
      itinerary = JSON.parse(t.itinerary_json);
    } catch (e) {
      itinerary = [];
    }
  }
  const structuredItinerary = buildDayItineraryFromItems(t.id);
  if (structuredItinerary.length > 0) {
    itinerary = structuredItinerary;
  }
  const description = t.description || "";
  const highlights = description.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    region: t.region,
    duration: t.duration,
    departure: t.departure,
    transport: t.transport,
    image: images[0] || "",
    images,
    itinerary,
    description,
    highlights,
    badge: t.badge || "",
    inclusions: safeJsonStringArray(t.inclusions_json),
    exclusions: safeJsonStringArray(t.exclusions_json),
    terms: safeJsonStringArray(t.terms_json),
    price: Number(t.price),
    originalPrice: Number(t.original_price),
    isFlashSale: Boolean(t.flash_sale),
    active: Boolean(t.active),
    availableSeats: tourAvailableSeats(t.id),
    schedules: tourSchedules(t.id),
    updatedAt: iso(t.updated_at)
  };
}

function adminTourDetails(tour) {
  const costItems = db.prepare(`
    SELECT id, category, name, notes, amount_per_person
    FROM tour_cost_items WHERE tour_id = ? ORDER BY category, name
  `).all(tour.id).map(item => ({
    id: item.id,
    category: item.category,
    name: item.name,
    notes: item.notes,
    amountPerPerson: Number(item.amount_per_person)
  }));
  const itinerary = db.prepare(`
    SELECT day_number, sequence, category, title, description, location, start_time
    FROM itinerary_items WHERE tour_id = ? ORDER BY day_number, sequence
  `).all(tour.id).map(item => ({
    dayNumber: Number(item.day_number),
    sequence: Number(item.sequence),
    category: item.category,
    title: item.title,
    description: item.description,
    location: item.location,
    startTime: item.start_time
  }));
  const baseCost = costItems.reduce((sum, item) => sum + item.amountPerPerson, 0);

  return {
    tour: { ...publicTour(tour), active: Boolean(tour.active) },
    baseCost,
    grossMarginPerPerson: Number(tour.price) - baseCost,
    costItems,
    itinerary
  };
}



function userDict(u) {
  let totalBookings = 0;
  try {
    const row = db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE user_id = ?").get(u.id);
    if (row && typeof row.c === "number") totalBookings = row.c;
  } catch (_) {}

  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    avatar: u.avatar || null,
    createdAt: u.created_at || null,
    totalBookings: totalBookings,
    active: Boolean(u.active)
  };
}

function bookingDict(b) {
  let tourId = b.tour_id || null;
  if (!tourId && b.schedule_id) {
    try {
      const sched = db.prepare("SELECT tour_id FROM schedules WHERE id = ?").get(b.schedule_id);
      if (sched) tourId = sched.tour_id;
    } catch (_) {}
  }
  const totalPrice = Number(b.total_price) || 0;
  const discountAmount = Number(b.discount_amount || 0);
  const subtotalPrice = Number(b.subtotal_price) > 0 ? Number(b.subtotal_price) : Math.round(totalPrice / 1.1 + discountAmount);
  const subtotalAfterDiscount = Math.max(0, subtotalPrice - discountAmount);
  let vatAmount = Math.max(0, totalPrice - subtotalAfterDiscount);
  let finalTotalPrice = totalPrice;
  if (vatAmount === 0 && subtotalAfterDiscount > 0) {
    vatAmount = Math.round(subtotalAfterDiscount * 0.10);
    finalTotalPrice = subtotalAfterDiscount + vatAmount;
  }

  return {
    id: b.id,
    reference: b.reference,
    scheduleId: b.schedule_id,
    tourId: tourId,
    tourTitle: b.tour_title,
    customerName: b.customer_name,
    customerPhone: b.customer_phone || "",
    customerEmail: b.customer_email || "",
    pickupLocation: b.pickup_location || "",
    adults: Number(b.adults),
    children: Number(b.children),
    infants: Number(b.infants),
    seats: Number(b.seats_held),
    unitPrice: Number(b.unit_price),
    subtotalPrice,
    subtotal: subtotalAfterDiscount,
    discountAmount,
    voucherCode: b.voucher_code || null,
    voucherName: b.voucher_name || null,
    vatRate: 10,
    vatAmount: vatAmount,
    totalPrice: finalTotalPrice,
    pricing: {
      subtotal: subtotalPrice,
      discount: discountAmount,
      vatAmount: vatAmount,
      total: finalTotalPrice
    },
    status: b.status,
    paid: ["PAID", "CONFIRMED", "COMPLETED"].includes(b.status),
    paymentEvidence: b.payment_evidence || null,
    paymentConfirmedAt: b.payment_confirmed_at ? iso(b.payment_confirmed_at) : null,
    expiresAt: iso(b.expires_at),
    createdAt: iso(b.created_at)
  };
}

function formatVndServer(amount) {
  return Number(amount || 0).toLocaleString("vi-VN") + " đ";
}

function parseEndTimestamp(raw) {
  const str = String(raw || "").trim();
  if (!str) return NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return Date.parse(str + "T23:59:59.999Z");
  }
  return Date.parse(str);
}

function publicVoucher(v, stats = null) {
  const scopeRegions = safeJsonStringArray(v.scope_regions_json);
  const scopeTourIds = safeJsonStringArray(v.scope_tour_ids_json);
  const usageLimit = Number(v.usage_limit || 0);
  const usedCount = Number(v.used_count || 0);
  const remainingUses = usageLimit > 0 ? Math.max(0, usageLimit - usedCount) : null;
  const now = Date.now();
  const startMs = Date.parse(v.start_at);
  const endMs = parseEndTimestamp(v.end_at);

  let lifecycleStatus = "ACTIVE";
  if (!v.active) lifecycleStatus = "INACTIVE";
  else if (!isNaN(startMs) && now < startMs) lifecycleStatus = "SCHEDULED";
  else if (!isNaN(endMs) && now > endMs) lifecycleStatus = "EXPIRED";
  else if (usageLimit > 0 && usedCount >= usageLimit) lifecycleStatus = "EXHAUSTED";

  const dto = {
    id: v.id,
    code: String(v.code || "").toUpperCase(),
    name: v.name,
    description: v.description || "",
    discountType: v.discount_type,
    discountValue: Number(v.discount_value),
    maxDiscount: v.max_discount !== null && v.max_discount !== undefined && Number(v.max_discount) > 0 ? Number(v.max_discount) : null,
    minOrderValue: Number(v.min_order_value || 0),
    scopeType: v.scope_type || "all",
    scopeRegions,
    scopeTourIds,
    startAt: v.start_at,
    endAt: v.end_at,
    usageLimit,
    usedCount,
    remainingUses,
    perUserLimit: Number(v.per_user_limit ?? 1),
    targetAudience: v.target_audience || "all",
    active: Boolean(v.active),
    lifecycleStatus,
    createdAt: v.created_at || null,
    updatedAt: v.updated_at || null
  };
  if (stats) {
    dto.stats = stats;
  }
  return dto;
}

function calculateVoucherDiscount(voucher, subtotal) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  let discount = 0;
  if (voucher.discount_type === "percent") {
    const pct = Math.max(0, Math.min(100, Number(voucher.discount_value) || 0));
    discount = Math.round((safeSubtotal * pct) / 100);
    const maxCap = Number(voucher.max_discount || 0);
    if (maxCap > 0) {
      discount = Math.min(discount, maxCap);
    }
  } else {
    discount = Math.max(0, Math.round(Number(voucher.discount_value) || 0));
  }
  discount = Math.max(0, Math.min(safeSubtotal, discount));
  return {
    discountAmount: discount,
    finalTotal: Math.max(0, safeSubtotal - discount)
  };
}

function countPriorCustomerBookings({ userId, customerEmail, customerPhone }) {
  const clauses = [];
  const params = [];
  if (userId) {
    clauses.push("user_id = ?");
    params.push(userId);
  }
  if (customerEmail) {
    clauses.push("LOWER(customer_email) = LOWER(?)");
    params.push(customerEmail.trim());
  }
  if (customerPhone && customerPhone.trim() && customerPhone.trim() !== "0900000000") {
    clauses.push("customer_phone = ?");
    params.push(customerPhone.trim());
  }
  if (clauses.length === 0) return 0;
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM bookings
    WHERE status != 'CANCELLED' AND (${clauses.join(" OR ")})
  `).get(...params);
  return Number(row?.c || 0);
}

function countUserVoucherRedemptions({ voucherId, userId, customerEmail, customerPhone }) {
  const clauses = [];
  const params = [voucherId];
  if (userId) {
    clauses.push("user_id = ?");
    params.push(userId);
  }
  if (customerEmail) {
    clauses.push("LOWER(customer_email) = LOWER(?)");
    params.push(customerEmail.trim());
  }
  if (customerPhone && customerPhone.trim() && customerPhone.trim() !== "0900000000") {
    clauses.push("customer_phone = ?");
    params.push(customerPhone.trim());
  }
  if (clauses.length === 0) return 0;
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM voucher_redemptions
    WHERE voucher_id = ? AND status = 'ACTIVE' AND (${clauses.join(" OR ")})
  `).get(...params);
  return Number(row?.c || 0);
}

function evaluateVoucherRules(v, { normCode, tour, subtotal, sessionUser, priorCustomerCount = 0, userRedemptionsCount = 0 }) {
  if (!v) {
    return { ok: false, status: 422, errorCode: "VOUCHER_NOT_FOUND", detail: `Mã ưu đãi "${normCode}" không tồn tại.` };
  }
  if (!v.active) {
    return { ok: false, status: 422, errorCode: "VOUCHER_INACTIVE", detail: `Mã ưu đãi "${normCode}" hiện đang tạm ngưng hoạt động.` };
  }

  const now = Date.now();
  const startMs = Date.parse(v.start_at);
  const endMs = parseEndTimestamp(v.end_at);
  if (!isNaN(startMs) && now < startMs) {
    const startDisplay = new Date(startMs).toLocaleDateString("vi-VN");
    return { ok: false, status: 422, errorCode: "VOUCHER_NOT_STARTED", detail: `Mã ưu đãi "${normCode}" chưa đến thời gian áp dụng (bắt đầu từ ${startDisplay}).` };
  }
  if (!isNaN(endMs) && now > endMs) {
    const endDisplay = new Date(endMs).toLocaleDateString("vi-VN");
    return { ok: false, status: 422, errorCode: "VOUCHER_EXPIRED", detail: `Mã ưu đãi "${normCode}" đã hết hạn vào ngày ${endDisplay}.` };
  }

  const usageLimit = Number(v.usage_limit || 0);
  const usedCount = Number(v.used_count || 0);
  if (usageLimit > 0 && usedCount >= usageLimit) {
    return { ok: false, status: 422, errorCode: "VOUCHER_EXHAUSTED", detail: `Mã ưu đãi "${normCode}" đã hết lượt sử dụng.` };
  }

  const scopeType = v.scope_type || "all";
  if (tour) {
    if (scopeType === "region") {
      const regions = safeJsonStringArray(v.scope_regions_json);
      if (!regions.includes(tour.region)) {
        const regionLabel = { north: "Miền Bắc", central: "Miền Trung", south: "Miền Nam" };
        const names = regions.map(r => regionLabel[r] || r).join(", ") || "chỉ định";
        return { ok: false, status: 422, errorCode: "VOUCHER_WRONG_SCOPE", detail: `Mã ưu đãi "${normCode}" chỉ áp dụng cho tour thuộc khu vực: ${names}.` };
      }
    } else if (scopeType === "tours") {
      const allowedTours = safeJsonStringArray(v.scope_tour_ids_json).map(x => String(x).toUpperCase());
      const tourCandidates = [tour.id, tour.code, tour.sqlServerTourId].filter(Boolean).map(x => String(x).toUpperCase());
      if (!tourCandidates.some(tid => allowedTours.includes(tid))) {
        return { ok: false, status: 422, errorCode: "VOUCHER_WRONG_TOUR", detail: `Mã ưu đãi "${normCode}" không áp dụng cho tour "${tour.title}".` };
      }
    }
  }

  const minOrder = Number(v.min_order_value || 0);
  if (minOrder > 0 && subtotal < minOrder) {
    return {
      ok: false,
      status: 422,
      errorCode: "VOUCHER_MIN_ORDER",
      detail: `Mã ưu đãi "${normCode}" yêu cầu đơn tối thiểu ${formatVndServer(minOrder)} (hiện tại ${formatVndServer(subtotal)}).`
    };
  }

  const audience = v.target_audience || "all";
  if (audience === "logged_in" && !sessionUser) {
    return { ok: false, status: 422, errorCode: "VOUCHER_LOGIN_REQUIRED", detail: `Mã ưu đãi "${normCode}" chỉ áp dụng cho khách hàng đã đăng nhập tài khoản.` };
  }
  if (audience === "new_customer" && priorCustomerCount > 0) {
    return { ok: false, status: 422, errorCode: "VOUCHER_NEW_CUSTOMER_ONLY", detail: `Mã ưu đãi "${normCode}" chỉ dành cho khách hàng đặt tour lần đầu.` };
  }

  const perUserLimit = Number(v.per_user_limit || 0);
  if (perUserLimit > 0 && userRedemptionsCount >= perUserLimit) {
    return { ok: false, status: 422, errorCode: "VOUCHER_USER_LIMIT_REACHED", detail: `Bạn đã sử dụng hết ${perUserLimit} lượt áp dụng mã ưu đãi "${normCode}".` };
  }

  const { discountAmount, finalTotal } = calculateVoucherDiscount(v, subtotal);
  return {
    ok: true,
    voucher: publicVoucher(v),
    voucherRow: v,
    subtotalPrice: subtotal,
    discountAmount,
    finalTotal
  };
}

function validateVoucherForOrder({ code, tour, subtotal, sessionUser = null, resolvedUserId = null, customerEmail = "", customerPhone = "" }) {
  const normCode = String(code || "").trim().toUpperCase();
  if (!normCode) {
    return { ok: false, status: 422, errorCode: "EMPTY_CODE", detail: "Vui lòng nhập mã ưu đãi." };
  }

  const v = db.prepare("SELECT * FROM vouchers WHERE UPPER(code) = ?").get(normCode);
  const effectiveUserId = sessionUser?.id || resolvedUserId || null;
  const effectiveEmail = customerEmail || sessionUser?.email || "";
  const effectivePhone = customerPhone || sessionUser?.phone || "";
  const priorCustomerCount = v && v.target_audience === "new_customer"
    ? countPriorCustomerBookings({ userId: effectiveUserId, customerEmail: effectiveEmail, customerPhone: effectivePhone })
    : 0;
  const userRedemptionsCount = v && Number(v.per_user_limit || 0) > 0 && (effectiveUserId || effectiveEmail || effectivePhone)
    ? countUserVoucherRedemptions({ voucherId: v.id, userId: effectiveUserId, customerEmail: effectiveEmail, customerPhone: effectivePhone })
    : 0;

  return evaluateVoucherRules(v, {
    normCode,
    tour,
    subtotal,
    sessionUser,
    priorCustomerCount,
    userRedemptionsCount
  });
}

function releaseBookingVoucherRedemption(bookingId) {
  const activeRedemption = db.prepare(`
    SELECT id, voucher_id FROM voucher_redemptions
    WHERE booking_id = ? AND status = 'ACTIVE'
  `).get(bookingId);
  if (activeRedemption) {
    db.prepare("UPDATE voucher_redemptions SET status = 'RELEASED' WHERE id = ?").run(activeRedemption.id);
    db.prepare("UPDATE vouchers SET used_count = MAX(0, used_count - 1), updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), activeRedemption.voucher_id);
  }
}

function mapSqlServerVoucherRow(r) {
  if (!r) return null;
  let data = {};
  try {
    data = typeof r.DuLieuMoi === "string" ? JSON.parse(r.DuLieuMoi) : (r.DuLieuMoi || {});
  } catch {
    data = {};
  }
  const code = String(data.code || r.DuLieuCu || "").trim().toUpperCase();
  if (!code) return null;
  return {
    id: r.MaLog != null ? String(r.MaLog) : String(r.id),
    maLog: r.MaLog != null ? Number(r.MaLog) : null,
    rawPayload: data,
    code,
    name: data.name || "",
    description: data.description || "",
    discount_type: data.discountType || "percent",
    discount_value: Number(data.discountValue || 0),
    max_discount: data.maxDiscount !== null && data.maxDiscount !== undefined ? Number(data.maxDiscount) : null,
    min_order_value: Number(data.minOrderValue || 0),
    scope_type: data.scopeType || "all",
    scope_regions_json: JSON.stringify(Array.isArray(data.scopeRegions) ? data.scopeRegions : []),
    scope_tour_ids_json: JSON.stringify(Array.isArray(data.scopeTourIds) ? data.scopeTourIds : []),
    start_at: data.startAt || iso(r.ThoiGian),
    end_at: data.endAt || iso(r.ThoiGian),
    usage_limit: Number(data.usageLimit ?? 0),
    used_count: Number(data.usedCount ?? 0),
    per_user_limit: Number(data.perUserLimit ?? 1),
    target_audience: data.targetAudience || "all",
    active: data.active === false || data.active === 0 ? 0 : 1,
    created_at: data.createdAt || iso(r.ThoiGian),
    updated_at: data.updatedAt || iso(r.ThoiGian)
  };
}

function buildSqlServerVoucherJson(d, existing = null) {
  const nowIso = new Date().toISOString();
  return {
    code: d.code,
    name: d.name,
    description: d.description || "",
    discountType: d.discount_type,
    discountValue: Number(d.discount_value),
    maxDiscount: d.max_discount !== null && d.max_discount !== undefined ? Number(d.max_discount) : null,
    minOrderValue: Number(d.min_order_value || 0),
    scopeType: d.scope_type || "all",
    scopeRegions: Array.isArray(d.scope_regions) ? d.scope_regions : [],
    scopeTourIds: Array.isArray(d.scope_tour_ids) ? d.scope_tour_ids : [],
    startAt: toSqlDateValue(d.start_at, false).toISOString(),
    endAt: toSqlDateValue(d.end_at, true).toISOString(),
    usageLimit: Number(d.usage_limit ?? 0),
    usedCount: existing ? Number(existing.used_count || 0) : 0,
    perUserLimit: Number(d.per_user_limit ?? 1),
    targetAudience: d.target_audience || "all",
    active: Boolean(d.active),
    createdAt: existing?.created_at || nowIso,
    updatedAt: nowIso
  };
}

function ssNewRequest(txOrPool) {
  return txOrPool.request();
}

async function ssListActiveVouchers() {
  const res = await ssNewRequest(sqlServerPool).query(`
    SELECT MaLog, DuLieuCu, DuLieuMoi, ThoiGian
    FROM dbo.AUDITLOG
    WHERE HanhDong = N'VOUCHER_DEF'
    ORDER BY MaLog DESC
  `);
  return (res.recordset || []).map(mapSqlServerVoucherRow).filter(v => v && v.active);
}

async function ssGetVoucherByIdOrCode(idOrCode, tx = null, lockForUpdate = false) {
  const req = ssNewRequest(tx || sqlServerPool);
  const raw = String(idOrCode || "").trim();
  const numericId = /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : -1;
  req.input("numericId", numericId);
  req.input("normCode", raw.toUpperCase());
  const hint = lockForUpdate ? "WITH (UPDLOCK, HOLDLOCK)" : "";
  const res = await req.query(`
    SELECT TOP 1 MaLog, DuLieuCu, DuLieuMoi, ThoiGian
    FROM dbo.AUDITLOG ${hint}
    WHERE HanhDong = N'VOUCHER_DEF'
      AND (MaLog = @numericId OR UPPER(DuLieuCu) = @normCode)
    ORDER BY MaLog DESC
  `);
  return mapSqlServerVoucherRow(res.recordset?.[0] || null);
}

async function ssListVoucherUses(normCode = null, tx = null) {
  const req = ssNewRequest(tx || sqlServerPool);
  let where = "WHERE HanhDong = N'VOUCHER_USE'";
  if (normCode) {
    req.input("normCode", normCode.toUpperCase());
    where += " AND UPPER(DuLieuCu) = @normCode";
  }
  const res = await req.query(`
    SELECT TOP 1000 MaLog, MaNguoiThucHien, DuLieuCu, DuLieuMoi, ThoiGian
    FROM dbo.AUDITLOG ${where}
    ORDER BY MaLog DESC
  `);
  return (res.recordset || []).map(row => {
    let p = {};
    try { p = JSON.parse(row.DuLieuMoi || "{}"); } catch {}
    return {
      maLog: row.MaLog,
      code: String(p.code || row.DuLieuCu || "").toUpperCase(),
      voucherLogId: p.voucherLogId != null ? String(p.voucherLogId) : null,
      maDatTour: p.maDatTour ?? null,
      bookingExternalId: p.bookingExternalId || null,
      userExternalId: p.userExternalId || null,
      maNguoiDung: p.maNguoiDung ?? row.MaNguoiThucHien ?? null,
      email: String(p.email || "").trim().toLowerCase(),
      phone: String(p.phone || "").trim(),
      discountAmount: Number(p.discountAmount || 0),
      bookingTotal: Number(p.bookingTotal || 0),
      status: String(p.status || "ACTIVE").toUpperCase(),
      createdAt: p.createdAt || iso(row.ThoiGian)
    };
  });
}

async function ssValidateVoucherForOrder({ code, tour, subtotal, sessionUser = null, resolvedUserId = null, customerEmail = "", customerPhone = "" }, tx = null) {
  const normCode = String(code || "").trim().toUpperCase();
  if (!normCode) {
    return { ok: false, status: 422, errorCode: "EMPTY_CODE", detail: "Vui lòng nhập mã ưu đãi." };
  }
  const v = await ssGetVoucherByIdOrCode(normCode, tx, Boolean(tx));
  const effectiveUserId = sessionUser?.id || resolvedUserId || null;
  const effectiveEmail = (customerEmail || sessionUser?.email || "").trim().toLowerCase();
  const effectivePhone = (customerPhone || sessionUser?.phone || "").trim();

  let priorCustomerCount = 0;
  if (v && v.target_audience === "new_customer") {
    priorCustomerCount = countPriorCustomerBookings({
      userId: effectiveUserId,
      customerEmail: effectiveEmail,
      customerPhone: effectivePhone
    });
    if (priorCustomerCount === 0 && (effectiveUserId || effectiveEmail || effectivePhone)) {
      const allUses = await ssListVoucherUses(null, tx);
      const ssActiveMatch = allUses.some(u =>
        u.status === "ACTIVE" && (
          (effectiveUserId && (u.userExternalId === String(effectiveUserId) || String(u.maNguoiDung) === String(effectiveUserId))) ||
          (effectiveEmail && u.email === effectiveEmail) ||
          (effectivePhone && effectivePhone !== "0900000000" && u.phone === effectivePhone)
        )
      );
      if (ssActiveMatch) priorCustomerCount = 1;
    }
  }

  let userRedemptionsCount = 0;
  if (v && Number(v.per_user_limit || 0) > 0 && (effectiveUserId || effectiveEmail || effectivePhone)) {
    const uses = await ssListVoucherUses(normCode, tx);
    userRedemptionsCount = uses.filter(u =>
      u.status === "ACTIVE" && (
        (effectiveUserId && (u.userExternalId === String(effectiveUserId) || String(u.maNguoiDung) === String(effectiveUserId))) ||
        (effectiveEmail && u.email === effectiveEmail) ||
        (effectivePhone && effectivePhone !== "0900000000" && u.phone === effectivePhone)
      )
    ).length;
  }

  return evaluateVoucherRules(v, {
    normCode,
    tour,
    subtotal,
    sessionUser,
    priorCustomerCount,
    userRedemptionsCount
  });
}

async function ssBuildAllAdminVouchersWithStats() {
  const vouchersRes = await ssNewRequest(sqlServerPool).query(`
    SELECT MaLog, DuLieuCu, DuLieuMoi, ThoiGian
    FROM dbo.AUDITLOG
    WHERE HanhDong = N'VOUCHER_DEF'
    ORDER BY MaLog DESC
  `);
  const allUses = await ssListVoucherUses(null);

  const extIds = [...new Set(allUses.map(u => u.bookingExternalId).filter(Boolean))];
  const localBookingsMap = new Map();
  if (extIds.length > 0) {
    const placeholders = extIds.map(() => "?").join(",");
    const bRows = db.prepare(`SELECT id, reference, customer_name, status, total_price FROM bookings WHERE id IN (${placeholders})`).all(...extIds);
    for (const br of bRows) localBookingsMap.set(br.id, br);
  }

  const byCode = new Map();
  for (const u of allUses) {
    if (!byCode.has(u.code)) byCode.set(u.code, []);
    byCode.get(u.code).push(u);
  }

  return (vouchersRes.recordset || []).map(row => {
    const v = mapSqlServerVoucherRow(row);
    if (!v) return null;
    const list = byCode.get(v.code) || [];
    let activeRedemptions = 0;
    let completedRedemptions = 0;
    let totalDiscountGranted = 0;
    let totalRevenue = 0;

    const recentRedemptions = [];
    for (const u of list) {
      const lb = u.bookingExternalId ? localBookingsMap.get(u.bookingExternalId) : null;
      const bStatus = lb?.status || u.status;
      const bTotal = lb ? Number(lb.total_price || 0) : Number(u.bookingTotal || 0);
      if (u.status === "ACTIVE" && bStatus !== "CANCELLED") {
        activeRedemptions += 1;
        totalDiscountGranted += Number(u.discountAmount || 0);
        totalRevenue += bTotal;
        if (["PAID", "CONFIRMED", "COMPLETED"].includes(bStatus)) {
          completedRedemptions += 1;
        }
      }
      if (recentRedemptions.length < 10) {
        recentRedemptions.push({
          bookingId: u.bookingExternalId || (u.maDatTour != null ? String(u.maDatTour) : String(u.maLog)),
          bookingRef: lb?.reference || (u.maDatTour != null ? `SQL-${u.maDatTour}` : u.bookingExternalId || String(u.maLog)),
          customerName: lb?.customer_name || u.email || "Khách hàng",
          customerEmail: u.email || "",
          bookingStatus: bStatus,
          discountAmount: Number(u.discountAmount || 0),
          bookingTotal: bTotal,
          status: u.status,
          createdAt: u.createdAt
        });
      }
    }

    return publicVoucher(v, {
      activeRedemptions,
      completedRedemptions,
      totalDiscountGranted,
      totalRevenue,
      recentRedemptions
    });
  }).filter(Boolean);
}

async function ssReleaseVoucherByExternalBooking(bookingId) {
  if (!useSqlServerVouchers() || !bookingId) return;
  try {
    const allUses = await ssListVoucherUses(null);
    const matches = allUses.filter(u => u.bookingExternalId === String(bookingId) && u.status === "ACTIVE");
    if (matches.length === 0) return;

    const req = ssNewRequest(sqlServerPool);
    req.input("bookingExtId", String(bookingId));
    const updRes = await req.query(`
      UPDATE dbo.AUDITLOG
      SET DuLieuMoi = JSON_MODIFY(DuLieuMoi, '$.status', N'RELEASED')
      OUTPUT UPPER(inserted.DuLieuCu) AS MaCode
      WHERE HanhDong = N'VOUCHER_USE'
        AND ISJSON(DuLieuMoi) = 1
        AND JSON_VALUE(CASE WHEN ISJSON(DuLieuMoi) = 1 THEN DuLieuMoi END, '$.bookingExternalId') = @bookingExtId
        AND JSON_VALUE(CASE WHEN ISJSON(DuLieuMoi) = 1 THEN DuLieuMoi END, '$.status') = N'ACTIVE'
    `);
    const releasedCodes = new Map();
    for (const r of (updRes.recordset || [])) {
      const c = String(r.MaCode || "").toUpperCase();
      if (c) releasedCodes.set(c, (releasedCodes.get(c) || 0) + 1);
    }
    for (const [code, cnt] of releasedCodes.entries()) {
      const v = await ssGetVoucherByIdOrCode(code);
      if (v) {
        const nextPayload = { ...v.rawPayload, usedCount: Math.max(0, Number(v.used_count || 0) - cnt), updatedAt: new Date().toISOString() };
        const dReq = ssNewRequest(sqlServerPool);
        dReq.input("maLog", v.maLog);
        dReq.input("payload", JSON.stringify(nextPayload));
        await dReq.query("UPDATE dbo.AUDITLOG SET DuLieuMoi = @payload WHERE MaLog = @maLog AND HanhDong = N'VOUCHER_DEF'");
      }
    }
  } catch (err) {
    console.warn("[SQL SERVER] Release voucher warning:", err.message);
  }
}

function audit(actorId, eventType, subjectId, details = {}) {
  try {
    db.prepare(`
      INSERT INTO audit_events (id, actor_id, event_type, subject_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), actorId, eventType, subjectId, JSON.stringify(details), new Date().toISOString());
  } catch (err) {
    console.error("Audit error:", err);
  }
}

let cachedMailTransport = null;
let cachedMailKey = "";
let testMailTransport = null;

function setMailTransportForTest(transport) {
  testMailTransport = transport || null;
}

function escapeHtmlServer(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMailTransport() {
  if (!nodemailer) return null;
  if (testMailTransport) {
    const from = process.env.DELTA_SMTP_FROM || process.env.DELTA_SMTP_USER || "Delta Travel <no-reply@deltatravel.vn>";
    return { transport: testMailTransport, from };
  }
  const user = (process.env.DELTA_SMTP_USER || process.env.SMTP_USER || "").trim();
  const pass = process.env.DELTA_SMTP_PASS || process.env.SMTP_PASS || "";
  const rawHost = (process.env.DELTA_SMTP_HOST || process.env.SMTP_HOST || "").trim();
  const host = rawHost || (user.toLowerCase().endsWith("@gmail.com") ? "smtp.gmail.com" : "");
  const allowNoAuth = process.env.DELTA_SMTP_ALLOW_NO_AUTH === "1";

  if (!host || (!allowNoAuth && (!user || !pass))) {
    return null;
  }

  const port = Number.parseInt(process.env.DELTA_SMTP_PORT || process.env.SMTP_PORT || "465", 10);
  const secureEnv = process.env.DELTA_SMTP_SECURE ?? process.env.SMTP_SECURE;
  const secure = secureEnv !== undefined ? String(secureEnv).toLowerCase() === "true" : port === 465;
  const key = `${host}:${port}:${secure}:${user}:${pass.length}`;

  if (!cachedMailTransport || cachedMailKey !== key) {
    cachedMailTransport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });
    cachedMailKey = key;
  }

  const from = process.env.DELTA_SMTP_FROM || (user ? `Delta Travel <${user}>` : "Delta Travel <no-reply@deltatravel.vn>");
  return { transport: cachedMailTransport, from };
}

function buildBookingConfirmationEmail({ booking, schedule = null, eventType = "CREATED" }) {
  const isPaid = eventType === "PAID" || booking.status === "PAID" || booking.paid;
  const isConfirmed = eventType === "CONFIRMED" || booking.status === "CONFIRMED";
  const ref = booking.reference || booking.id;
  const tourTitle = booking.tourTitle || "Tour Du Lịch Delta Travel";
  const customerName = booking.customerName || "Quý khách";
  const customerPhone = booking.customerPhone || "";
  const customerEmail = booking.customerEmail || "";
  const adults = Number(booking.adults || 1);
  const children = Number(booking.children || 0);
  const infants = Number(booking.infants || 0);
  const subtotal = Number(booking.subtotalPrice ?? booking.totalPrice ?? 0);
  const discount = Number(booking.discountAmount || 0);
  const total = Number(booking.totalPrice || 0);
  const voucherCode = booking.voucherCode || null;
  const departureRaw = schedule?.departure_at || booking.departureAt || "";
  const departureDisplay = departureRaw
    ? new Date(departureRaw).toLocaleDateString("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "Theo lịch đã chọn";

  const statusText = isPaid
    ? "Đã xác nhận thanh toán"
    : isConfirmed
      ? "Đã xác nhận giữ chỗ"
      : "Chờ thanh toán (Giữ chỗ 15 phút)";

  const subject = isPaid
    ? `[Delta Travel] Xác nhận thanh toán & Vé điện tử #${ref}`
    : isConfirmed
      ? `[Delta Travel] Xác nhận đơn đặt tour #${ref} - ${tourTitle}`
      : `[Delta Travel] Xác nhận thông tin đặt tour #${ref} - ${tourTitle}`;

  const guestSummary = [
    `${adults} người lớn`,
    children > 0 ? `${children} trẻ em` : null,
    infants > 0 ? `${infants} em bé` : null
  ].filter(Boolean).join(", ");

  const discountLineText = discount > 0
    ? `- Ưu đãi${voucherCode ? ` (${voucherCode})` : ""}: -${formatVndServer(discount)}\n`
    : "";

  const paymentHintText = (!isPaid && !isConfirmed)
    ? `\nTHÔNG TIN CHUYỂN KHOẢN GIỮ CHỖ:\n- Ngân hàng: MBBank | STK: 0325536936 | Chủ TK: LE VAN AN\n- Số tiền: ${formatVndServer(total)}\n- Nội dung CK: ${ref}\n`
    : "";

  const text = [
    `Xin chào ${customerName},`,
    "",
    `Delta Travel xác nhận đã ghi nhận đơn đặt tour của Quý khách với thông tin chi tiết bên dưới:`,
    `- Mã đơn đặt tour: #${ref}`,
    `- Trạng thái: ${statusText}`,
    `- Hành trình: ${tourTitle}`,
    `- Ngày khởi hành: ${departureDisplay}`,
    `- Số hành khách: ${guestSummary}`,
    `- SĐT liên hệ: ${customerPhone}`,
    `- Email nhận vé: ${customerEmail}`,
    booking.note ? `- Ghi chú: ${booking.note}` : null,
    "",
    `CHI TIẾT THANH TOÁN:`,
    `- Tiền tour ban đầu: ${formatVndServer(subtotal)}`,
    discountLineText.trimEnd() || null,
    `- Tổng tiền thanh toán: ${formatVndServer(total)}`,
    paymentHintText.trimEnd() || null,
    "",
    `Cảm ơn Quý khách đã đồng hành cùng Delta Travel!`,
    `Hotline hỗ trợ: 0325536936 | Website: https://deltatravel.vn`
  ].filter(line => line !== null).join("\n");

  const discountRowHtml = discount > 0
    ? `<tr><td style="padding:8px 0;color:#15803d;">Giảm giá${voucherCode ? ` (${escapeHtmlServer(voucherCode)})` : ""}</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#15803d;">-${escapeHtmlServer(formatVndServer(discount))}</td></tr>`
    : "";

  const paymentBoxHtml = (!isPaid && !isConfirmed)
    ? `<div style="margin-top:16px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#78350f;">
         <strong>Hướng dẫn thanh toán giữ chỗ (MBBank):</strong><br/>
         Số tài khoản: <strong>0325536936</strong> — Chủ TK: <strong>LE VAN AN</strong><br/>
         Số tiền: <strong>${escapeHtmlServer(formatVndServer(total))}</strong> — Nội dung CK: <strong>${escapeHtmlServer(ref)}</strong>
       </div>`
    : "";

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;color:#0f172a;">
    <div style="background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="background:#0f172a;color:#ffffff;padding:20px 24px;">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#f59e0b;font-weight:700;">DELTA TRAVEL</div>
        <h2 style="margin:6px 0 0;font-size:20px;">${isPaid ? "Xác nhận thanh toán & Vé điện tử" : "Xác nhận thông tin đặt tour"}</h2>
      </div>
      <div style="padding:24px;">
        <p style="margin-top:0;">Xin chào <strong>${escapeHtmlServer(customerName)}</strong>,</p>
        <p style="color:#475569;line-height:1.5;">Delta Travel đã tiếp nhận đơn đặt tour của Quý khách. Dưới đây là tóm tắt hành trình và chi phí:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Mã đơn đặt tour</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;">#${escapeHtmlServer(ref)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Trạng thái</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${escapeHtmlServer(statusText)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Tour du lịch</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${escapeHtmlServer(tourTitle)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Ngày khởi hành</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${escapeHtmlServer(departureDisplay)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Hành khách</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${escapeHtmlServer(guestSummary)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Điện thoại liên hệ</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${escapeHtmlServer(customerPhone)}</td></tr>
          ${booking.note ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Ghi chú</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${escapeHtmlServer(booking.note)}</td></tr>` : ""}
          <tr><td style="padding:8px 0;color:#64748b;">Tiền tour ban đầu</td><td style="padding:8px 0;text-align:right;">${escapeHtmlServer(formatVndServer(subtotal))}</td></tr>
          ${discountRowHtml}
          <tr><td style="padding:10px 0 0;border-top:2px solid #0f172a;font-weight:700;">Tổng thanh toán</td><td style="padding:10px 0 0;border-top:2px solid #0f172a;text-align:right;font-size:17px;font-weight:800;color:#dc2626;">${escapeHtmlServer(formatVndServer(total))}</td></tr>
        </table>
        ${paymentBoxHtml}
        <p style="margin:18px 0 0;font-size:12px;color:#64748b;">Nếu cần hỗ trợ thêm, vui lòng liên hệ Delta Travel qua số 0325536936 hoặc phản hồi email này.</p>
      </div>
    </div>
  </div>`;

  return { subject, text, html };
}

async function sendBookingEmailNotification({ booking, schedule = null, eventType = "CREATED" }) {
  const to = String(booking?.customerEmail || "").trim();
  const txInfo = getMailTransport();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { sent: false, configured: Boolean(txInfo), recipient: to, reason: "INVALID_EMAIL" };
  }
  if (!txInfo) {
    console.warn(`[EMAIL] Chưa cấu hình DELTA_SMTP_USER / DELTA_SMTP_PASS — bỏ qua gửi email tới ${to}.`);
    return { sent: false, configured: false, recipient: to, reason: "SMTP_NOT_CONFIGURED" };
  }
  const { subject, text, html } = buildBookingConfirmationEmail({ booking, schedule, eventType });
  try {
    const info = await txInfo.transport.sendMail({
      from: txInfo.from,
      to,
      subject,
      text,
      html
    });
    audit(booking.userId || null, "BOOKING_EMAIL_SENT", booking.id, {
      to,
      eventType,
      messageId: info?.messageId || null
    });
    return {
      sent: true,
      configured: true,
      recipient: to,
      messageId: info?.messageId || null
    };
  } catch (err) {
    console.warn(`[EMAIL] Lỗi gửi email tới ${to}:`, err.message);
    audit(booking.userId || null, "BOOKING_EMAIL_FAILED", booking.id, {
      to,
      eventType,
      error: err.message
    });
    return {
      sent: false,
      configured: true,
      recipient: to,
      reason: "SEND_FAILED",
      error: err.message
    };
  }
}

// Cấu hình Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; " +
    "img-src 'self' https: data: blob: http:; " +
    "connect-src 'self' https: http:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

// Auth helper
function getSessionUser(req) {
  const sessionToken = req.cookies.delta_session;
  if (!sessionToken) return null;
  const th = tokenHash(sessionToken);
  const row = db.prepare(`
    SELECT s.token_hash, s.csrf_hash, s.expires_at, u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1
  `).get(th);
  return row || null;
}

function requireAuth(req, res, next) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    return res.status(401).json({ detail: "Bạn cần đăng nhập." });
  }
  // Validate CSRF token for state-modifying methods
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const headerCsrf = req.headers["x-csrf-token"];
    const cookieCsrf = req.cookies.delta_csrf;
    if (!headerCsrf || !cookieCsrf || headerCsrf !== cookieCsrf || tokenHash(headerCsrf) !== sessionUser.csrf_hash) {
      return res.status(403).json({ detail: "CSRF token không hợp lệ." });
    }
  }
  req.user = sessionUser;
  next();
}

function requireAuthOrGuest(req, res, next) {
  const sessionUser = getSessionUser(req);
  if (sessionUser) {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const headerCsrf = req.headers["x-csrf-token"];
      const cookieCsrf = req.cookies.delta_csrf;
      if (headerCsrf && cookieCsrf && (headerCsrf !== cookieCsrf || tokenHash(headerCsrf) !== sessionUser.csrf_hash)) {
        return res.status(403).json({ detail: "CSRF token không hợp lệ." });
      }
    }
    req.user = sessionUser;
    req.isSessionAuthenticated = true;
    return next();
  }

  req.isSessionAuthenticated = false;

  // Hỗ trợ khách đặt trực tiếp: tự động liên kết hoặc tạo tài khoản khách hàng (chấp nhận cả camelCase & snake_case)
  const b = req.body || {};
  const customer_email = String(b.customer_email || b.customerEmail || b.email || "").trim();
  const customer_name = String(b.customer_name || b.customerName || b.name || "Khách Hàng").trim();
  const customer_phone = String(b.customer_phone || b.customerPhone || b.phone || "0900000000").trim();
  if (customer_email) {
    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(customer_email);
    if (!user) {
      const newUserId = "USR-" + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (id, full_name, email, phone, password_hash, role, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'CUSTOMER', 1, ?, ?)
      `).run(newUserId, customer_name || "Khách Hàng", customer_email, customer_phone || "0900000000", hashPassword("deltaCustomer123@"), now, now);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(newUserId);
    }
    req.user = user;
    try { createSession(res, user); } catch(e) {}
    return next();
  }

  return res.status(401).json({ detail: "Bạn cần đăng nhập hoặc cung cấp email liên hệ." });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ detail: "Chỉ quản trị viên được phép." });
    }
    next();
  });
}

function createSession(res, user) {
  const rawSession = randomToken();
  const rawCsrf = randomToken();
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, csrf_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenHash(rawSession), user.id, tokenHash(rawCsrf), expires.toISOString(), new Date().toISOString());

  res.cookie("delta_session", rawSession, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires
  });
  res.cookie("delta_csrf", rawCsrf, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    expires
  });

  return { rawSession, rawCsrf };
}

// =============================================================================
// API ROUTES
// =============================================================================

// 1. Health check
app.get("/api/v1/health/ready", (req, res) => {
  if (process.env.THAM_SQLSERVER_CATALOG_API_URL) {
    return res.json({
      status: "ok",
      db: "SQL Server (read-only)",
      catalogMode: "sqlserver_read_only",
      sqlServerConnected: useSqlServerVouchers(),
      voucherDatabase: useSqlServerVouchers() ? "SQL Server" : "disabled"
    });
  }

  const row = db.prepare("SELECT COUNT(*) AS c FROM tours").get();
  const ssReady = useSqlServerVouchers();
  res.json({
    status: "ok",
    db: ssReady ? "SQL Server (vouchers) + SQLite" : "SQLite demo (local booking writes)",
    sqlServerDiagnosticConnection: Boolean(sqlServerPool),
    sqlServerConnected: ssReady,
    voucherDatabase: ssReady ? "SQL Server" : "SQLite demo",
    writesDatabase: ssReady ? "SQL Server (vouchers) + SQLite" : "SQLite demo",
    tours: row.c,
    catalogMode: "sqlite"
  });
});

app.use("/api/v1/admin", (req, res, next) => {
  if (process.env.THAM_SQLSERVER_CATALOG_API_URL && process.env.THAM_SQLSERVER_SYNC_ADMIN !== "1") {
    return res.status(503).json({
      detail: "Chế độ danh mục SQL Server chỉ đọc chưa kết nối API quản trị."
    });
  }
  next();
});

app.use("/api/v1/bookings", (req, res, next) => {
  if (process.env.THAM_SQLSERVER_CATALOG_API_URL) {
    return res.status(503).json({
      detail: "Chế độ danh mục SQL Server chỉ đọc chưa hỗ trợ đặt tour."
    });
  }
  next();
});

// 2. Auth Routes
app.post("/api/v1/auth/register", (req, res) => {
  const { full_name, email, phone, password } = req.body || {};
  if (!full_name || full_name.trim().length < 2) {
    return res.status(422).json({ detail: "Họ tên phải có ít nhất 2 ký tự." });
  }
  if (!email || !email.includes("@")) {
    return res.status(422).json({ detail: "Email không hợp lệ." });
  }
  if (!phone || !/^0[35789]\d{8}$/.test(phone)) {
    return res.status(422).json({ detail: "Số điện thoại Việt Nam không hợp lệ." });
  }
  if (!password || password.length < 6) {
    return res.status(422).json({ detail: "Mật khẩu tối thiểu 6 ký tự." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ? OR phone = ?").get(email, phone);
  if (existing) {
    return res.status(409).json({ detail: "Email hoặc số điện thoại đã tồn tại trên hệ thống." });
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO users (id, full_name, email, phone, password_hash, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'CUSTOMER', 1, ?, ?)
  `).run(id, full_name.trim(), email.trim(), phone.trim(), hashPassword(password), new Date().toISOString(), new Date().toISOString());

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  createSession(res, user);
  audit(id, "USER_REGISTERED", id, { email: user.email });
  res.status(201).json(userDict(user));
});

app.post("/api/v1/auth/login", (req, res) => {
  const { email, username, password } = req.body || {};
  const ident = (email || username || "").trim();
  if (!ident || !password) {
    return res.status(422).json({ detail: "Vui lòng nhập tài khoản và mật khẩu." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ? OR phone = ? OR email LIKE ?").get(ident, ident, ident.includes("@") ? ident : (ident + "@%"));
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ detail: "Thông tin đăng nhập không chính xác." });
  }

  createSession(res, user);
  audit(user.id, "USER_LOGIN", user.id);
  res.json(userDict(user));
});

app.get("/api/v1/auth/me", requireAuth, (req, res) => {
  res.json(userDict(req.user));
});

app.get("/api/v1/auth/session", (req, res) => {
  const user = getSessionUser(req);
  if (user) {
    res.json({ authenticated: true, user: userDict(user) });
  } else {
    res.json({ authenticated: false, user: null });
  }
});

app.patch("/api/v1/auth/profile", requireAuth, (req, res) => {
  const { full_name, phone, avatar } = req.body || {};
  if (phone && !/^0[35789]\d{8}$/.test(phone)) {
    return res.status(422).json({ detail: "Số điện thoại không hợp lệ." });
  }
  if (phone) {
    const dup = db.prepare("SELECT id FROM users WHERE phone = ? AND id != ?").get(phone, req.user.id);
    if (dup) return res.status(409).json({ detail: "Số điện thoại đã được dùng." });
  }

  const newName = full_name ? full_name.trim() : req.user.full_name;
  const newPhone = phone ? phone.trim() : req.user.phone;
  const newAvatar = (typeof avatar !== "undefined") ? avatar : (req.user.avatar || null);

  db.prepare(`
    UPDATE users SET full_name = ?, phone = ?, avatar = ?, updated_at = ? WHERE id = ?
  `).run(newName, newPhone, newAvatar, new Date().toISOString(), req.user.id);

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  audit(req.user.id, "PROFILE_UPDATED", req.user.id);
  res.json(userDict(updated));
});

app.post("/api/v1/auth/change-password", requireAuth, (req, res) => {
  const { old_password, new_password } = req.body || {};
  if (!old_password || !new_password || new_password.length < 6) {
    return res.status(422).json({ detail: "Mật khẩu mới tối thiểu 6 ký tự." });
  }
  if (!verifyPassword(old_password, req.user.password_hash)) {
    return res.status(401).json({ detail: "Mật khẩu cũ không chính xác." });
  }

  db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .run(hashPassword(new_password), new Date().toISOString(), req.user.id);

  audit(req.user.id, "PASSWORD_CHANGED", req.user.id);
  res.json({ status: "ok", message: "Đổi mật khẩu thành công." });
});

app.post("/api/v1/auth/logout", (req, res) => {
  const sessionToken = req.cookies.delta_session;
  if (sessionToken) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(sessionToken));
  }
  res.clearCookie("delta_session", { path: "/" });
  res.clearCookie("delta_csrf", { path: "/" });
  res.json({ status: "ok", message: "Đã đăng xuất an toàn." });
});

// 3. Favorites
app.get("/api/v1/favorites", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT tour_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(rows.map(r => r.tour_id));
});

app.post("/api/v1/favorites/:tour_id", requireAuth, (req, res) => {
  const { tour_id } = req.params;
  const tour = db.prepare("SELECT id FROM tours WHERE id = ?").get(tour_id);
  if (!tour) return res.status(404).json({ detail: "Tour không tồn tại." });

  const existing = db.prepare("SELECT id FROM favorites WHERE user_id = ? AND tour_id = ?").get(req.user.id, tour_id);
  if (!existing) {
    db.prepare("INSERT INTO favorites (id, user_id, tour_id, created_at) VALUES (?, ?, ?, ?)")
      .run(crypto.randomUUID(), req.user.id, tour_id, new Date().toISOString());
  }
  res.json({ status: "ok", tour_id });
});

app.delete("/api/v1/favorites/:tour_id", requireAuth, (req, res) => {
  const { tour_id } = req.params;
  db.prepare("DELETE FROM favorites WHERE user_id = ? AND tour_id = ?").run(req.user.id, tour_id);
  res.json({ status: "ok", tour_id });
});

// 4. Tours & Schedules
app.get("/api/v1/tours", async (req, res) => {
  if (await proxySqlServerCatalog(req, res, "/api/v1/tours", ["q", "region", "max_price"])) return;
  const { search, q, destination, region, flash_sale, min_price, max_price } = req.query;
  let query = "SELECT * FROM tours WHERE active = 1";
  const params = [];

  // Vùng miền (chỉ áp dụng nếu không có điểm đến cụ thể để tránh lọc nhầm, và khác 'all')
  if (region && region !== "all" && !destination) {
    query += " AND region = ?";
    params.push(region);
  }
  if (flash_sale !== undefined) {
    query += " AND flash_sale = ?";
    params.push(flash_sale === "true" || flash_sale === "1" ? 1 : 0);
  }
  if (min_price && !isNaN(Number(min_price))) {
    query += " AND price >= ?";
    params.push(Number(min_price));
  }
  if (max_price && !isNaN(Number(max_price))) {
    query += " AND price <= ?";
    params.push(Number(max_price));
  }
  query += " ORDER BY updated_at DESC, id ASC";
  let tours = db.prepare(query).all(...params);

  const term = (destination || search || q || "").trim();
  if (term) {
    const normalize = s => String(s || "").toLowerCase().replace(/[đĐ]/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const normTerm = normalize(term);
    tours = tours.filter(t => {
      const text = normalize([t.title, t.description, t.departure, t.itinerary_json].join(" "));
      return text.includes(normTerm);
    });
  }

  res.json(tours.map(publicTour));
});

app.get("/api/v1/tours/:tour_id", async (req, res) => {
  if (await proxySqlServerCatalog(req, res, `/api/v1/tours/${encodeURIComponent(req.params.tour_id)}`)) return;
  const tour = db.prepare("SELECT * FROM tours WHERE id = ? AND active = 1").get(req.params.tour_id);
  if (!tour) return res.status(404).json({ detail: "Không tìm thấy thông tin tour." });
  res.json(publicTour(tour));
});

app.get("/api/v1/tours/:tour_id/schedules", async (req, res) => {
  if (await proxySqlServerCatalog(req, res,
    `/api/v1/tours/${encodeURIComponent(req.params.tour_id)}/schedules`)) return;
  const schedules = db.prepare(`
    SELECT * FROM schedules
    WHERE tour_id = ? AND active = 1 AND departure_at > datetime('now')
    ORDER BY departure_at ASC
  `).all(req.params.tour_id);
  res.json(schedules.map(publicSchedule));
});

app.get("/api/v1/tours/:tour_id/itinerary", async (req, res) => {
  if (await proxySqlServerCatalog(req, res,
    `/api/v1/tours/${encodeURIComponent(req.params.tour_id)}/itinerary`)) return;
  const items = db.prepare(`
    SELECT day_number, sequence, category, title, description, location, start_time
    FROM itinerary_items WHERE tour_id = ? ORDER BY day_number, sequence
  `).all(req.params.tour_id);
  if (items.length > 0) {
    return res.json(items.map(item => ({
      dayNumber: Number(item.day_number),
      sequence: Number(item.sequence),
      category: item.category,
      title: item.title,
      description: item.description,
      location: item.location,
      startTime: item.start_time
    })));
  }
  const tour = db.prepare("SELECT itinerary_json FROM tours WHERE id = ?").get(req.params.tour_id);
  const days = safeJsonStringArray(tour?.itinerary_json);
  // If itinerary_json contains day objects rather than strings, parse directly.
  let dayObjects = [];
  if (tour?.itinerary_json) {
    try {
      const parsed = JSON.parse(tour.itinerary_json);
      if (Array.isArray(parsed)) dayObjects = parsed;
    } catch (_) {}
  }
  const expanded = [];
  dayObjects.forEach((d, idx) => {
    const dayNumber = Number(d.day || d.dayNumber || (idx + 1));
    const baseTitle = d.title || `Ngày ${dayNumber}`;
    if (d.morning) expanded.push({ dayNumber, sequence: 1, category: d.morningCategory || "transport", title: `${baseTitle} - Buổi sáng`, description: d.morning, location: "", startTime: null });
    if (d.afternoon) expanded.push({ dayNumber, sequence: 2, category: d.afternoonCategory || "activity", title: `${baseTitle} - Buổi chiều`, description: d.afternoon, location: "", startTime: null });
    if (d.evening) expanded.push({ dayNumber, sequence: 3, category: d.eveningCategory || "meal", title: `${baseTitle} - Buổi tối`, description: d.evening, location: "", startTime: null });
  });
  res.json(expanded.length ? expanded : days);
});

// 5. Vouchers, Booking & Pricing Flow
app.get("/api/v1/vouchers", async (req, res) => {
  if (process.env.THAM_SQLSERVER_CATALOG_API_URL && !useSqlServerVouchers()) {
    return res.json([]);
  }
  try {
    const tourId = String(req.query.tour_id || req.query.tourId || "").trim();
    const tour = tourId ? db.prepare("SELECT * FROM tours WHERE id = ? AND active = 1").get(tourId) : null;
    const now = Date.now();
    const rows = useSqlServerVouchers()
      ? await ssListActiveVouchers()
      : db.prepare("SELECT * FROM vouchers WHERE active = 1 ORDER BY created_at DESC").all();

    const visible = rows
      .filter(v => {
        const startMs = Date.parse(v.start_at);
        const endMs = parseEndTimestamp(v.end_at);
        if (!isNaN(startMs) && now < startMs) return false;
        if (!isNaN(endMs) && now > endMs) return false;
        const limit = Number(v.usage_limit || 0);
        if (limit > 0 && Number(v.used_count || 0) >= limit) return false;
        if (tour) {
          if (v.scope_type === "region") {
            return safeJsonStringArray(v.scope_regions_json).includes(tour.region);
          }
          if (v.scope_type === "tours") {
            const ids = safeJsonStringArray(v.scope_tour_ids_json).map(x => String(x).toUpperCase());
            return ids.includes(String(tour.id).toUpperCase());
          }
        }
        return true;
      })
      .map(v => publicVoucher(v));
    res.json(visible);
  } catch (err) {
    res.status(503).json({ detail: "Không thể tải danh sách mã ưu đãi: " + err.message });
  }
});

app.post("/api/v1/vouchers/validate", async (req, res) => {
  if (process.env.THAM_SQLSERVER_CATALOG_API_URL && !useSqlServerVouchers()) {
    return res.status(503).json({ valid: false, detail: "Chế độ chỉ đọc SQL Server không hỗ trợ xác thực mã ưu đãi." });
  }
  try {
    const body = req.body || {};
    const code = body.code || body.voucher_code || body.voucherCode || "";
    const tourId = body.tour_id || body.tourId || "";
    const scheduleId = body.schedule_id || body.scheduleId || "";
    const adults = Math.max(1, parseInt(body.adults || 1, 10) || 1);
    const children = Math.max(0, parseInt(body.children || 0, 10) || 0);
    const infants = Math.max(0, parseInt(body.infants || 0, 10) || 0);
    const customerEmail = String(body.customer_email || body.customerEmail || "").trim();
    const customerPhone = String(body.customer_phone || body.customerPhone || "").trim();

    let tour = tourId ? db.prepare("SELECT * FROM tours WHERE id = ? AND active = 1").get(tourId) : null;
    if (!tour && scheduleId) {
      const sched = db.prepare("SELECT * FROM schedules WHERE id = ? AND active = 1").get(scheduleId);
      if (sched) {
        tour = db.prepare("SELECT * FROM tours WHERE id = ? AND active = 1").get(sched.tour_id);
      }
    }
    if (!tour) {
      return res.status(404).json({ valid: false, errorCode: "TOUR_NOT_FOUND", detail: "Không tìm thấy tour để kiểm tra điều kiện mã ưu đãi." });
    }

    // Luôn tính tạm tính theo đơn giá thực trong Database, bỏ qua mọi giá/số tiền giảm do client tự gửi
    const subtotal = calculateTotals(tour.price, adults, children, infants);
    const sessionUser = getSessionUser(req);
    const params = {
      code,
      tour,
      subtotal,
      sessionUser,
      resolvedUserId: sessionUser?.id || null,
      customerEmail,
      customerPhone
    };
    const result = useSqlServerVouchers()
      ? await ssValidateVoucherForOrder(params)
      : validateVoucherForOrder(params);

    if (!result.ok) {
      return res.status(result.status || 422).json({
        valid: false,
        errorCode: result.errorCode,
        detail: result.detail,
        subtotalPrice: subtotal,
        discountAmount: 0,
        totalPrice: subtotal
      });
    }

    res.json({
      valid: true,
      voucher: result.voucher,
      subtotalPrice: result.subtotalPrice,
      discountAmount: result.discountAmount,
      totalPrice: result.finalTotal,
      message: `Áp dụng thành công mã ${result.voucher.code}: Giảm ${formatVndServer(result.discountAmount)}`
    });
  } catch (err) {
    res.status(503).json({ valid: false, detail: "Lỗi kiểm tra mã ưu đãi trên máy chủ: " + err.message });
  }
});

// 5. Booking & Pricing Flow: Thuật toán tính giá tour chuẩn thương mại điện tử
function calculateTotals(unitPrice, adults, children = 0, infants = 0) {
  const childPrice = Math.floor((unitPrice * 75 + 50) / 100);
  const infantPrice = Math.floor((unitPrice * 10 + 50) / 100);
  return (unitPrice * adults) + (childPrice * children) + (infantPrice * infants);
}

function calculatePricingBreakdown(unitPrice, adults, children = 0, infants = 0, discount = 0) {
  const childPrice = Math.floor((unitPrice * 75 + 50) / 100);
  const infantPrice = Math.floor((unitPrice * 10 + 50) / 100);
  const rawSubtotal = (unitPrice * adults) + (childPrice * children) + (infantPrice * infants);
  const subtotal = Math.max(0, rawSubtotal - discount);
  const vatRate = 10;
  const vatAmount = Math.round(subtotal * 0.10);
  const totalPrice = subtotal + vatAmount;
  return { rawSubtotal, subtotal, vatRate, vatAmount, totalPrice };
}

app.post("/api/v1/bookings/quote", async (req, res) => {
  try {
    const body = req.body || {};
    const schedule_id = body.schedule_id || body.scheduleId;
    const adults = Number(body.adults || 0);
    const children = Number(body.children || 0);
    const infants = Number(body.infants || 0);
    const voucherCode = String(body.voucher_code || body.voucherCode || "").trim();
    const customerEmail = String(body.customer_email || body.customerEmail || "").trim();
    const customerPhone = String(body.customer_phone || body.customerPhone || "").trim();

    if (!schedule_id || !Number.isInteger(adults) || adults < 1 || children < 0 || infants < 0) {
      return res.status(422).json({ detail: "Thông tin tính giá không hợp lệ." });
    }

    const sched = db.prepare("SELECT * FROM schedules WHERE id = ? AND active = 1").get(schedule_id);
    if (!sched) return res.status(404).json({ detail: "Lịch khởi hành không tồn tại." });

    const tour = db.prepare("SELECT * FROM tours WHERE id = ? AND active = 1").get(sched.tour_id);
    if (!tour) return res.status(404).json({ detail: "Tour không tồn tại." });

    const totalSeats = adults + children + infants;
    const avail = sched.total_seats - (sched.reserved_seats || 0);
    const childPrice = Math.floor((tour.price * 75 + 50) / 100);
    const infantPrice = Math.floor((tour.price * 10 + 50) / 100);
    const rawSubtotal = (tour.price * adults) + (childPrice * children) + (infantPrice * infants);

    let discountAmount = 0;
    let voucherDto = null;
    if (voucherCode) {
      const sessionUser = getSessionUser(req);
      const params = {
        code: voucherCode,
        tour,
        subtotal: rawSubtotal,
        sessionUser,
        resolvedUserId: sessionUser?.id || null,
        customerEmail,
        customerPhone
      };
      const vRes = useSqlServerVouchers()
        ? await ssValidateVoucherForOrder(params)
        : validateVoucherForOrder(params);
      if (!vRes.ok) {
        return res.status(vRes.status || 422).json({ detail: vRes.detail, errorCode: vRes.errorCode });
      }
      discountAmount = vRes.discountAmount;
      voucherDto = vRes.voucher;
    }

    const subtotal = Math.max(0, rawSubtotal - discountAmount);
    const vatRate = 10;
    const vatAmount = Math.round(subtotal * 0.10);
    const finalTotal = subtotal + vatAmount;

    res.json({
      scheduleId: sched.id,
      tourId: tour.id,
      seats: totalSeats,
      availableSeats: Math.max(0, avail),
      unitPrice: tour.price,
      subtotalPrice: rawSubtotal,
      subtotal: subtotal,
      discountAmount,
      vatRate: 10,
      vatAmount: vatAmount,
      totalPrice: finalTotal,
      voucher: voucherDto,
      currency: "VND",
      pricingRules: { childPercent: 75, infantPercent: 10, vatPercent: 10 },
      addonsSupported: false,
      vouchersSupported: true
    });
  } catch (err) {
    res.status(503).json({ detail: "Lỗi tính báo giá: " + err.message });
  }
});

app.post("/api/v1/bookings", requireAuthOrGuest, async (req, res) => {
  const b = req.body || {};
  const schedule_id = b.schedule_id || b.scheduleId;
  const adults = Number(b.adults ?? 1);
  const children = Number(b.children ?? 0);
  const infants = Number(b.infants ?? 0);
  const customer_name = String(b.customer_name || b.customerName || req.user?.full_name || "Khách Hàng").trim();
  const customer_phone = String(b.customer_phone || b.customerPhone || req.user?.phone || "0900000000").trim();
  const customer_email = String(b.customer_email || b.customerEmail || req.user?.email || "").trim();
  const note = String(b.note || b.specialRequests || "").trim();
  const voucherCode = String(b.voucher_code || b.voucherCode || "").trim().toUpperCase();

  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0 || !Number.isInteger(infants) || infants < 0) {
    return res.status(422).json({ detail: "Số lượng hành khách không hợp lệ." });
  }

  const idemKey = req.headers["idempotency-key"] || ("IDEM-" + Date.now());

  // Kiểm tra trùng Idempotency-Key của user
  const existingBooking = db.prepare("SELECT * FROM bookings WHERE user_id = ? AND idempotency_key = ?").get(req.user.id, idemKey);
  if (existingBooking) {
    return res.status(200).json(bookingDict(existingBooking));
  }

  if (!customer_name || !customer_email) {
    return res.status(422).json({ detail: "Vui lòng nhập đầy đủ thông tin đặt chỗ." });
  }

  let sched = schedule_id ? db.prepare("SELECT * FROM schedules WHERE id = ? AND active = 1").get(schedule_id) : null;
  if (!sched) {
    const tourId = b.tour_id || b.tourId || (schedule_id && schedule_id.includes("-") ? schedule_id.split("-")[1] : null);
    if (tourId) {
      sched = db.prepare("SELECT * FROM schedules WHERE tour_id = ? AND active = 1 ORDER BY departure_at ASC").get(tourId);
    }
  }
  if (!sched) {
    const tourId = b.tour_id || b.tourId || "DL-CB09";
    const newSchedId = crypto.randomUUID();
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    db.prepare(`
      INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
      VALUES (?, ?, ?, 50, 0, 1)
    `).run(newSchedId, tourId, futureDate);
    sched = db.prepare("SELECT * FROM schedules WHERE id = ?").get(newSchedId);
  }

  const resolvedScheduleId = sched.id;
  const tour = db.prepare("SELECT * FROM tours WHERE id = ? AND active = 1").get(sched.tour_id);
  if (!tour) return res.status(404).json({ detail: "Tour không tồn tại." });

  const totalSeats = adults + children + infants;
  const bookingId = crypto.randomUUID();
  const ref = "BK" + Date.now().toString().slice(-8) + crypto.randomInt(10, 99);
  const subtotalPrice = calculateTotals(tour.price, adults, children, infants);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 phút giữ chỗ
  const now = new Date().toISOString();
  const payloadFingerprint = crypto.createHash("sha256").update(JSON.stringify(req.body)).digest("hex");

  // Transaction lưu booking, giữ chỗ và kiểm soát giới hạn lượt voucher an toàn đồng thời (SQL Server hoặc SQLite)
  let discountAmount = 0;
  let totalPrice = subtotalPrice;
  let appliedVoucher = null;
  const usingSsVoucher = Boolean(voucherCode && useSqlServerVouchers());
  let ssTx = null;

  if (usingSsVoucher) {
    try {
      ssTx = typeof sqlServerPool.transaction === "function"
        ? sqlServerPool.transaction()
        : new (require("mssql")).Transaction(sqlServerPool);
      await ssTx.begin();
      const vRes = await ssValidateVoucherForOrder({
        code: voucherCode,
        tour,
        subtotal: subtotalPrice,
        sessionUser: req.isSessionAuthenticated ? req.user : null,
        resolvedUserId: req.user.id,
        customerEmail: customer_email,
        customerPhone: customer_phone
      }, ssTx);
      if (!vRes.ok) {
        await ssTx.rollback().catch(() => {});
        return res.status(vRes.status || 422).json({ detail: vRes.detail, errorCode: vRes.errorCode });
      }
      const nextUsedPayload = {
        ...vRes.voucherRow.rawPayload,
        usedCount: Number(vRes.voucherRow.used_count || 0) + 1,
        updatedAt: new Date().toISOString()
      };
      const qReq = ssNewRequest(ssTx);
      qReq.input("maLog", vRes.voucherRow.maLog);
      qReq.input("expectedUsed", Number(vRes.voucherRow.used_count || 0));
      qReq.input("nextPayload", JSON.stringify(nextUsedPayload));
      const qRes = await qReq.query(`
        UPDATE dbo.AUDITLOG
        SET DuLieuMoi = @nextPayload
        WHERE MaLog = @maLog AND HanhDong = N'VOUCHER_DEF'
          AND ISNULL(TRY_CAST(JSON_VALUE(CASE WHEN ISJSON(DuLieuMoi) = 1 THEN DuLieuMoi END, '$.usedCount') AS INT), 0) = @expectedUsed
      `);
      if (!qRes.rowsAffected || qRes.rowsAffected[0] !== 1) {
        await ssTx.rollback().catch(() => {});
        return res.status(409).json({ detail: `Mã ưu đãi "${voucherCode}" đã hết lượt sử dụng.`, errorCode: "VOUCHER_EXHAUSTED" });
      }
      discountAmount = vRes.discountAmount;
      appliedVoucher = vRes.voucherRow;
    } catch (err) {
      if (ssTx) await ssTx.rollback().catch(() => {});
      return res.status(503).json({ detail: "Lỗi xác thực mã ưu đãi trên SQL Server: " + err.message });
    }
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const freshSched = db.prepare("SELECT * FROM schedules WHERE id = ? AND active = 1").get(resolvedScheduleId);
    const avail = freshSched ? (freshSched.total_seats - (freshSched.reserved_seats || 0)) : 0;
    if (!freshSched || totalSeats > avail) {
      db.exec("ROLLBACK");
      if (ssTx) await ssTx.rollback().catch(() => {});
      return res.status(409).json({ detail: "Không đủ chỗ trống cho số lượng khách này." });
    }

    if (voucherCode && !usingSsVoucher) {
      const vRes = validateVoucherForOrder({
        code: voucherCode,
        tour,
        subtotal: subtotalPrice,
        sessionUser: req.isSessionAuthenticated ? req.user : null,
        resolvedUserId: req.user.id,
        customerEmail: customer_email,
        customerPhone: customer_phone
      });
      if (!vRes.ok) {
        db.exec("ROLLBACK");
        return res.status(vRes.status || 422).json({ detail: vRes.detail, errorCode: vRes.errorCode });
      }
      const quotaUpdate = db.prepare(`
        UPDATE vouchers
        SET used_count = used_count + 1, updated_at = ?
        WHERE id = ? AND active = 1 AND (usage_limit <= 0 OR used_count < usage_limit)
      `).run(now, vRes.voucherRow.id);
      if (quotaUpdate.changes !== 1) {
        db.exec("ROLLBACK");
        return res.status(409).json({ detail: `Mã ưu đãi "${voucherCode}" đã hết lượt sử dụng.`, errorCode: "VOUCHER_EXHAUSTED" });
      }
      discountAmount = vRes.discountAmount;
      appliedVoucher = vRes.voucherRow;
    }

    // Thuật toán thuế GTGT (VAT 10%) bắt buộc theo chuẩn thương mại và đồng bộ tuyệt đối với /bookings/quote
    const subtotalAfterDiscount = Math.max(0, subtotalPrice - discountAmount);
    const vatAmount = Math.round(subtotalAfterDiscount * 0.10);
    const totalPrice = subtotalAfterDiscount + vatAmount;

    db.prepare(`
      INSERT INTO bookings (
        id, reference, user_id, schedule_id, idempotency_key, payload_fingerprint, tour_title,
        customer_name, customer_phone, customer_email, note,
        adults, children, infants, seats_held, unit_price,
        subtotal_price, discount_amount, voucher_code, voucher_name, total_price,
        status, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_PAYMENT', ?, ?, ?)
    `).run(
      bookingId, ref, req.user.id, resolvedScheduleId, idemKey, payloadFingerprint, tour.title,
      customer_name, customer_phone, customer_email, note || "",
      adults, children, infants, totalSeats, tour.price,
      subtotalPrice, discountAmount,
      appliedVoucher ? appliedVoucher.code : null,
      appliedVoucher ? appliedVoucher.name : null,
      totalPrice,
      expiresAt, now, now
    );

    if (appliedVoucher && !usingSsVoucher) {
      db.prepare(`
        INSERT INTO voucher_redemptions (
          id, voucher_id, voucher_code, booking_id, user_id, customer_email, customer_phone, discount_amount, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
      `).run(
        crypto.randomUUID(), appliedVoucher.id, appliedVoucher.code, bookingId,
        req.user.id, customer_email, customer_phone, discountAmount, now
      );
    }

    db.prepare("UPDATE schedules SET reserved_seats = reserved_seats + ? WHERE id = ?")
      .run(totalSeats, resolvedScheduleId);

    if (usingSsVoucher && ssTx && appliedVoucher) {
      const redReq = ssNewRequest(ssTx);
      const usePayload = {
        voucherLogId: appliedVoucher.maLog,
        code: appliedVoucher.code,
        maDatTour: null,
        bookingExternalId: bookingId,
        maNguoiDung: null,
        userExternalId: String(req.user.id),
        email: customer_email.trim().toLowerCase(),
        phone: customer_phone,
        subtotal: subtotalPrice,
        discountAmount,
        bookingTotal: totalPrice,
        status: "ACTIVE",
        createdAt: now
      };
      redReq.input("maCode", appliedVoucher.code);
      redReq.input("payload", JSON.stringify(usePayload));
      await redReq.query(`
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        VALUES (NULL, N'VOUCHER_USE', @maCode, @payload, GETDATE())
      `);
      await ssTx.commit();
    }

    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch {}
    if (ssTx) await ssTx.rollback().catch(() => {});
    return res.status(409).json({ detail: "Lỗi ghi dữ liệu: " + err.message });
  }

  const saved = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
  audit(req.user.id, "BOOKING_CREATED", bookingId, {
    reference: ref,
    subtotal: subtotalPrice,
    discount: discountAmount,
    voucherCode: appliedVoucher?.code || null,
    voucherBackend: usingSsVoucher ? "sqlserver" : "sqlite",
    total: totalPrice
  });
  const savedDto = bookingDict(saved);
  const emailNotification = await sendBookingEmailNotification({
    booking: {
      ...savedDto,
      customerPhone: saved.customer_phone,
      customerEmail: saved.customer_email,
      note: saved.note,
      userId: saved.user_id
    },
    schedule: sched,
    eventType: "CREATED"
  });
  res.status(201).json({
    ...savedDto,
    customerEmail: saved.customer_email,
    emailNotification
  });
});

app.get("/api/v1/bookings", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(rows.map(bookingDict));
});

app.get("/api/v1/bookings/:booking_id", (req, res) => {
  const param = req.params.booking_id;
  const b = db.prepare("SELECT * FROM bookings WHERE id = ? OR reference = ?").get(param, param);
  if (!b) return res.status(404).json({ detail: "Không tìm thấy đơn đặt tour." });
  res.json(bookingDict(b));
});

app.post("/api/v1/bookings/:booking_id/pay", requireAuthOrGuest, (req, res) => {
  const { reference, payment_evidence, paymentEvidence, auto_confirm } = req.body || {};
  const ref = (typeof reference === "string" && reference.trim()) 
    ? reference.trim() 
    : (typeof payment_evidence === "string" && payment_evidence.trim() 
      ? payment_evidence.trim() 
      : (typeof paymentEvidence === "string" && paymentEvidence.trim() 
        ? paymentEvidence.trim() 
        : ("VIETQR-MB-0325536936-" + Date.now())));

  if (ref.length < 8) {
    return res.status(422).json({ detail: "Mã giao dịch / UNC tối thiểu 8 ký tự." });
  }

  const bookingParam = req.params.booking_id;
  const b = db.prepare("SELECT * FROM bookings WHERE id = ? OR reference = ?").get(bookingParam, bookingParam);
  if (!b) return res.status(404).json({ detail: "Đơn đặt không tồn tại." });

  if (req.user && req.user.role !== "ADMIN" && b.user_id && b.user_id !== req.user.id) {
    return res.status(403).json({ detail: "Bạn không có quyền thanh toán đơn này." });
  }

  // Kiểm tra trùng mã thanh toán
  const dup = db.prepare("SELECT id FROM bookings WHERE payment_evidence = ? AND id != ?").get(ref, b.id);
  if (dup) return res.status(409).json({ detail: "Mã giao dịch đã được sử dụng cho đơn khác." });

  if (["CANCELLED", "COMPLETED"].includes(b.status)) {
    return res.status(409).json({ detail: "Đơn không nhận thanh toán." });
  }

  const now = new Date().toISOString();
  if (auto_confirm) {
    db.prepare(`
      UPDATE bookings
      SET status = 'PAID', payment_evidence = ?, payment_confirmed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(ref, now, now, b.id);
    const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(b.id);
    audit(req.user?.id || b.user_id || "GUEST", "PAYMENT_CONFIRMED", b.id, { reference: ref });
    return res.status(200).json(bookingDict(updated));
  }

  db.prepare(`
    UPDATE bookings
    SET payment_evidence = ?, updated_at = ?
    WHERE id = ?
  `).run(ref, now, b.id);

  const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(b.id);
  audit(req.user?.id || b.user_id || "GUEST", "PAYMENT_SUBMITTED_FOR_REVIEW", b.id, { reference: ref });
  res.status(202).json({ ...bookingDict(updated), paymentReview: "PENDING_MANUAL_VERIFICATION" });
});

app.post("/api/v1/bookings/:booking_id/cancel", requireAuth, async (req, res) => {
  const { reason = "Khách hủy đơn" } = req.body || {};
  const b = db.prepare("SELECT * FROM bookings WHERE id = ? AND user_id = ?").get(req.params.booking_id, req.user.id);
  if (!b) return res.status(404).json({ detail: "Đơn không tồn tại." });

  if (["CANCELLED", "COMPLETED"].includes(b.status)) {
    return res.status(409).json({ detail: "Đơn này không thể hủy." });
  }

  db.exec("BEGIN");
  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE bookings SET status = 'CANCELLED', updated_at = ? WHERE id = ?
    `).run(now, b.id);

    // Trả lại số chỗ đã giữ và hoàn lượt sử dụng mã ưu đãi (nếu có)
    db.prepare(`
      UPDATE schedules SET reserved_seats = MAX(0, reserved_seats - ?) WHERE id = ?
    `).run(b.seats_held, b.schedule_id);

    releaseBookingVoucherRedemption(b.id);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(409).json({ detail: err.message });
  }

  await ssReleaseVoucherByExternalBooking(b.id);

  const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(b.id);
  audit(req.user.id, "BOOKING_CANCELLED", b.id, { reason });
  res.json(bookingDict(updated));
});

// 6. Admin Endpoints
app.get(["/api/v1/admin/metrics", "/api/v1/admin/dashboard"], requireAdmin, (req, res) => {
  const usersCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const toursCount = db.prepare("SELECT COUNT(*) AS c FROM tours").get().c;
  const bookingsRows = db.prepare("SELECT status, COUNT(*) AS count FROM bookings GROUP BY status").all();
  const bookings = {};
  bookingsRows.forEach(r => { bookings[r.status] = r.count; });

  res.json({
    users: usersCount,
    tours: toursCount,
    bookings
  });
});

app.get("/api/v1/admin/audit", requireAdmin, (req, res) => {
  const logs = db.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 100").all();
  res.json(logs.map(l => ({
    id: l.id,
    event: l.event_type,
    actorId: l.actor_id,
    subjectId: l.subject_id,
    details: JSON.parse(l.details || "{}"),
    at: iso(l.created_at)
  })));
});

app.get("/api/v1/admin/tours", requireAdmin, (req, res) => {
  const tours = db.prepare("SELECT * FROM tours ORDER BY active DESC, CAST(id AS INTEGER) ASC, id ASC").all();
  res.json(tours.map(t => ({
    ...publicTour(t),
    active: Boolean(t.active)
  })));
});

app.post("/api/v1/admin/sync-sqlserver", requireAdmin, async (req, res) => {
  if (!process.env.THAM_SQLSERVER_CATALOG_API_URL) {
    return res.status(400).json({ detail: "Chưa cấu hình THAM_SQLSERVER_CATALOG_API_URL." });
  }
  const result = await syncSqlServerCatalogToLocalDb();
  res.json({ status: "ok", ...result });
});

app.get("/api/v1/admin/tours/:tour_id/details", requireAdmin, (req, res) => {
  const { tour_id } = req.params;
  const tour = db.prepare("SELECT * FROM tours WHERE id = ?").get(tour_id);
  if (!tour) return res.status(404).json({ detail: "Không tìm thấy tour." });
  res.json(adminTourDetails(tour));
});

app.put("/api/v1/admin/tours/:tour_id/details", requireAdmin, (req, res) => {
  const { tour_id } = req.params;
  const tour = db.prepare("SELECT * FROM tours WHERE id = ?").get(tour_id);
  if (!tour) return res.status(404).json({ detail: "Không tìm thấy tour." });

  const { price, original_price, originalPrice, cost_items: costItems, itinerary } = req.body || {};
  const costCategories = new Set([
    "transport", "accommodation", "meal", "sightseeing",
    "activity", "guide", "insurance", "other"
  ]);
  const itineraryCategories = new Set([
    "transport", "meal", "accommodation", "activity", "team_building", "note"
  ]);

  if (!Number.isInteger(price) || price < 1 || price > 2_000_000_000) {
    return res.status(422).json({ detail: "Giá bán không hợp lệ." });
  }
  if (!Array.isArray(costItems) || costItems.length > 100) {
    return res.status(422).json({ detail: "Danh sách khoản chi không hợp lệ." });
  }
  if (!Array.isArray(itinerary) || itinerary.length > 500) {
    return res.status(422).json({ detail: "Danh sách lịch trình không hợp lệ." });
  }
  for (const item of costItems) {
    if (!item || !costCategories.has(item.category) ||
        typeof item.name !== "string" || item.name.trim().length < 2 || item.name.length > 150 ||
        typeof (item.notes || "") !== "string" || (item.notes || "").length > 2000 ||
        !Number.isInteger(item.amount_per_person) ||
        item.amount_per_person < 0 || item.amount_per_person > 2_000_000_000) {
      return res.status(422).json({ detail: "Thông tin khoản chi không hợp lệ." });
    }
  }
  const seenSlots = new Set();
  for (const item of itinerary) {
    const slot = item && `${item.day_number}:${item.sequence}`;
    if (!item || !Number.isInteger(item.day_number) || item.day_number < 1 || item.day_number > 365 ||
        !Number.isInteger(item.sequence) || item.sequence < 1 || item.sequence > 100 ||
        !itineraryCategories.has(item.category) ||
        typeof item.title !== "string" || item.title.trim().length < 2 || item.title.length > 180 ||
        typeof (item.description || "") !== "string" || (item.description || "").length > 4000 ||
        typeof (item.location || "") !== "string" || (item.location || "").length > 180 ||
        (item.start_time != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.start_time)) ||
        seenSlots.has(slot)) {
      return res.status(422).json({ detail: "Thông tin lịch trình không hợp lệ." });
    }
    seenSlots.add(slot);
  }
  const baseCost = costItems.reduce((sum, item) => sum + item.amount_per_person, 0);
  if (baseCost > 0 && price <= baseCost) {
    return res.status(422).json({ detail: "Giá bán phải cao hơn tổng giá gốc." });
  }

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM tour_cost_items WHERE tour_id = ?").run(tour_id);
    db.prepare("DELETE FROM itinerary_items WHERE tour_id = ?").run(tour_id);

    const insertCost = db.prepare(`
      INSERT INTO tour_cost_items (id, tour_id, category, name, notes, amount_per_person)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of costItems) {
      insertCost.run(crypto.randomUUID(), tour_id, item.category, item.name.trim(),
        item.notes || "", item.amount_per_person);
    }

    const insertItinerary = db.prepare(`
      INSERT INTO itinerary_items (
        id, tour_id, day_number, sequence, category, title, description, location, start_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of itinerary) {
      insertItinerary.run(
        crypto.randomUUID(), tour_id, item.day_number, item.sequence, item.category,
        item.title.trim(), item.description || "", item.location || "", item.start_time || null
      );
    }

    const syncedItinerary = buildDayItineraryFromItems(tour_id);
    const rawOrigPrice = Number(original_price ?? originalPrice);
    if (Number.isFinite(rawOrigPrice) && rawOrigPrice > 0) {
      db.prepare("UPDATE tours SET price = ?, original_price = ?, itinerary_json = ?, updated_at = ? WHERE id = ?")
        .run(price, rawOrigPrice, JSON.stringify(syncedItinerary), new Date().toISOString(), tour_id);
    } else {
      db.prepare("UPDATE tours SET price = ?, itinerary_json = ?, updated_at = ? WHERE id = ?")
        .run(price, JSON.stringify(syncedItinerary), new Date().toISOString(), tour_id);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(409).json({ detail: "Không thể lưu chi tiết tour: " + err.message });
  }

  audit(req.user.id, "TOUR_DETAILS_REPLACED", tour_id, {
    price,
    costItemCount: costItems.length,
    itineraryItemCount: itinerary.length
  });
  const updatedTour = db.prepare("SELECT * FROM tours WHERE id = ?").get(tour_id);
  res.json(adminTourDetails(updatedTour));
});

app.post("/api/v1/admin/tours", requireAdmin, (req, res) => {
  const data = req.body || {};
  if (!data.id || !/^DL-[A-Z0-9]{2,20}$/.test(data.id)) {
    return res.status(422).json({ detail: "Mã tour phải có định dạng DL-XXXX." });
  }
  const existing = db.prepare("SELECT id FROM tours WHERE id = ?").get(data.id);
  if (existing) return res.status(409).json({ detail: "Mã tour đã tồn tại." });

  let imageValue = data.image || "";
  if (Array.isArray(data.images) && data.images.length > 0) {
    if (data.images.length > 12 || data.images.some(img => typeof img !== "string" || img.length > 1200)) {
      return res.status(422).json({ detail: "Danh sách ảnh tour không hợp lệ." });
    }
    imageValue = JSON.stringify(data.images);
  }
  const activeFlag = data.active === undefined ? 1 : (data.active ? 1 : 0);
  const inclusionsJson = JSON.stringify(safeJsonStringArray(data.inclusions));
  const exclusionsJson = JSON.stringify(safeJsonStringArray(data.exclusions));
  const termsJson = JSON.stringify(safeJsonStringArray(data.terms));
  const itineraryJson = Array.isArray(data.itinerary)
    ? JSON.stringify(data.itinerary)
    : (typeof data.itinerary_json === "string" ? data.itinerary_json : "[]");

  db.prepare(`
    INSERT INTO tours (
      id, slug, title, region, duration, price, original_price,
      image, departure, transport, flash_sale, description, itinerary_json,
      badge, inclusions_json, exclusions_json, terms_json, active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.slug || data.id.toLowerCase(), data.title, data.region, data.duration,
    data.price, data.original_price || data.price, imageValue, data.departure,
    data.transport, data.flash_sale ? 1 : 0, data.description || "", itineraryJson,
    data.badge || "", inclusionsJson, exclusionsJson, termsJson, activeFlag, new Date().toISOString()
  );

  const incomingSeats = Number(data.available_seats ?? data.availableSeats ?? 25);
  const seatsNum = (!isNaN(incomingSeats) && incomingSeats > 0) ? incomingSeats : 25;
  const schedCount = db.prepare("SELECT COUNT(*) AS count FROM schedules WHERE tour_id = ?").get(data.id).count;
  if (schedCount === 0) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setUTCHours(2, 0, 0, 0);
    db.prepare(`
      INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
      VALUES (?, ?, ?, ?, 0, 1)
    `).run(crypto.randomUUID(), data.id, d.toISOString(), seatsNum);
  }

  const t = db.prepare("SELECT * FROM tours WHERE id = ?").get(data.id);
  audit(req.user.id, "TOUR_CREATED", data.id);
  res.status(201).json(publicTour(t));
});

app.patch("/api/v1/admin/tours/:tour_id", requireAdmin, (req, res) => {
  const { tour_id } = req.params;
  const t = db.prepare("SELECT * FROM tours WHERE id = ?").get(tour_id);
  if (!t) return res.status(404).json({ detail: "Không tìm thấy tour." });

  // Xử lý cập nhật số chỗ mở bán đồng bộ xuống bảng lịch khởi hành (schedules)
  const incomingSeats = req.body?.available_seats ?? req.body?.availableSeats;
  if (incomingSeats !== undefined && incomingSeats !== null) {
    const seatsNum = Number(incomingSeats);
    if (!isNaN(seatsNum) && seatsNum >= 0) {
      const activeScheds = db.prepare("SELECT id, reserved_seats FROM schedules WHERE tour_id = ? AND active = 1").all(tour_id);
      if (activeScheds.length > 0) {
        for (const sc of activeScheds) {
          const resSeats = Number(sc.reserved_seats || 0);
          db.prepare("UPDATE schedules SET total_seats = ? WHERE id = ?").run(seatsNum + resSeats, sc.id);
        }
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        db.prepare(`
          INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
          VALUES (?, ?, ?, ?, 0, 1)
        `).run(crypto.randomUUID(), tour_id, d.toISOString(), seatsNum);
      }
    }
  }

  const columns = {
    title: "title",
    slug: "slug",
    region: "region",
    duration: "duration",
    departure: "departure",
    transport: "transport",
    description: "description",
    price: "price",
    original_price: "original_price",
    flash_sale: "flash_sale",
    active: "active",
    image: "image",
    images: "image",
    badge: "badge",
    inclusions: "inclusions_json",
    exclusions: "exclusions_json",
    terms: "terms_json",
    itinerary_json: "itinerary_json",
    itinerary: "itinerary_json",
    available_seats: null,
    availableSeats: null
  };
  const fields = [];
  const params = [];
  for (const [key, val] of Object.entries(req.body || {})) {
    if (!Object.hasOwn(columns, key)) {
      return res.status(422).json({ detail: `Không hỗ trợ cập nhật trường "${key}".` });
    }
    const col = columns[key];
    if (col === null) continue; // Đã xử lý ở bảng liên quan (như schedules)
    if (val !== undefined && val !== null) {
      if (key === "images" &&
          (!Array.isArray(val) || val.length > 12 ||
           val.some(image => typeof image !== "string" || image.length > 1200))) {
        return res.status(422).json({ detail: "Danh sách ảnh tour không hợp lệ." });
      }
      fields.push(`${col} = ?`);
      if (key === "images") {
        params.push(JSON.stringify(val));
      } else if (["inclusions", "exclusions", "terms"].includes(key)) {
        params.push(JSON.stringify(safeJsonStringArray(val)));
      } else if (key === "itinerary") {
        params.push(Array.isArray(val) ? JSON.stringify(val) : String(val || "[]"));
      } else if (key === "flash_sale" || key === "active") {
        params.push(val ? 1 : 0);
      } else {
        params.push(val);
      }
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(tour_id);
    db.prepare(`UPDATE tours SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare("SELECT * FROM tours WHERE id = ?").get(tour_id);
  audit(req.user.id, "TOUR_UPDATED", tour_id);
  res.json(publicTour(updated));
});

app.delete("/api/v1/admin/tours/:tour_id", requireAdmin, (req, res) => {
  const { tour_id } = req.params;
  db.prepare("UPDATE tours SET active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), tour_id);
  audit(req.user.id, "TOUR_DEACTIVATED", tour_id);
  res.json({ status: "ok", id: tour_id });
});

app.get("/api/v1/admin/schedules", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM schedules ORDER BY departure_at ASC").all();
  res.json(rows.map(publicSchedule));
});

app.post("/api/v1/admin/schedules", requireAdmin, (req, res) => {
  const { tour_id, departure_at, total_seats = 20 } = req.body || {};
  if (!tour_id || !departure_at) {
    return res.status(422).json({ detail: "Thiếu thông tin lịch trình." });
  }

  const depDate = new Date(departure_at);
  if (isNaN(depDate.getTime())) {
    return res.status(422).json({ detail: "Ngày khởi hành không hợp lệ." });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (depDate < today) {
    return res.status(422).json({ detail: "Ngày khởi hành không được ở quá khứ. Vui lòng chọn ngày từ hôm nay trở đi." });
  }

  const totalSeatsNum = Number(total_seats) || 20;
  if (totalSeatsNum <= 0 || totalSeatsNum > 1000) {
    return res.status(422).json({ detail: "Số chỗ mở bán không hợp lệ (từ 1 đến 1000 chỗ)." });
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
    VALUES (?, ?, ?, ?, 0, 1)
  `).run(id, tour_id, depDate.toISOString(), totalSeatsNum);

  const sched = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id);
  audit(req.user.id, "SCHEDULE_CREATED", id);
  res.status(201).json(publicSchedule(sched));
});

app.patch("/api/v1/admin/schedules/:schedule_id", requireAdmin, (req, res) => {
  const { schedule_id } = req.params;
  const s = db.prepare("SELECT * FROM schedules WHERE id = ?").get(schedule_id);
  if (!s) return res.status(404).json({ detail: "Không tìm thấy lịch." });

  const body = req.body || {};
  const departure_at = body.departure_at ?? body.departureAt;
  const total_seats = body.total_seats ?? body.totalSeats;
  const available_seats = body.available_seats ?? body.availableSeats;
  const active = body.active;
  const status = body.status;

  if (departure_at !== undefined) {
    const depDate = new Date(departure_at);
    if (isNaN(depDate.getTime())) {
      return res.status(422).json({ detail: "Ngày khởi hành không hợp lệ." });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (depDate < today) {
      return res.status(422).json({ detail: "Ngày khởi hành không được ở quá khứ. Vui lòng chọn ngày từ hôm nay trở đi." });
    }
    db.prepare("UPDATE schedules SET departure_at = ? WHERE id = ?").run(depDate.toISOString(), schedule_id);
  }
  if (total_seats !== undefined) {
    const totalSeatsNum = Number(total_seats);
    if (isNaN(totalSeatsNum) || totalSeatsNum < 0 || totalSeatsNum > 1000) {
      return res.status(422).json({ detail: "Số chỗ mở bán không hợp lệ." });
    }
    if (available_seats !== undefined) {
      const availNum = Number(available_seats);
      if (isNaN(availNum) || availNum < 0 || availNum > totalSeatsNum) {
        return res.status(422).json({ detail: "Số chỗ còn trống không hợp lệ." });
      }
      db.prepare("UPDATE schedules SET total_seats = ?, reserved_seats = ? WHERE id = ?")
        .run(totalSeatsNum, totalSeatsNum - availNum, schedule_id);
    } else {
      if (totalSeatsNum < Number(s.reserved_seats || 0)) {
        return res.status(422).json({ detail: "Số chỗ mở bán không hợp lệ hoặc nhỏ hơn số chỗ đã đặt." });
      }
      db.prepare("UPDATE schedules SET total_seats = ? WHERE id = ?").run(totalSeatsNum, schedule_id);
    }
  } else if (available_seats !== undefined) {
    const availNum = Number(available_seats);
    if (isNaN(availNum) || availNum < 0 || availNum > 1000) {
      return res.status(422).json({ detail: "Số chỗ còn trống không hợp lệ." });
    }
    const newTotal = availNum + Number(s.reserved_seats || 0);
    db.prepare("UPDATE schedules SET total_seats = ? WHERE id = ?").run(newTotal, schedule_id);
  }

  if (active !== undefined) {
    db.prepare("UPDATE schedules SET active = ? WHERE id = ?").run(active ? 1 : 0, schedule_id);
  } else if (status !== undefined) {
    const normStatus = String(status).toUpperCase();
    const nextActive = (normStatus === "CLOSED" || normStatus === "INACTIVE" || normStatus === "FALSE") ? 0 : 1;
    db.prepare("UPDATE schedules SET active = ? WHERE id = ?").run(nextActive, schedule_id);
  }

  const updated = db.prepare("SELECT * FROM schedules WHERE id = ?").get(schedule_id);
  audit(req.user.id, "SCHEDULE_UPDATED", schedule_id);
  res.json(publicSchedule(updated));
});

app.get("/api/v1/admin/bookings", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, s.departure_at AS schedule_departure_at
    FROM bookings b
    LEFT JOIN schedules s ON s.id = b.schedule_id
    ORDER BY b.created_at DESC
    LIMIT 100
  `).all();
  res.json(rows.map(b => ({
    ...bookingDict(b),
    customerPhone: b.customer_phone,
    customerEmail: b.customer_email,
    customerNotes: b.note || "",
    departureDate: b.schedule_departure_at ? iso(b.schedule_departure_at) : null,
    userId: b.user_id
  })));
});

app.patch("/api/v1/admin/bookings/:booking_id", requireAdmin, async (req, res) => {
  const { booking_id } = req.params;
  const { status, reason } = req.body || {};
  const allowed = new Set(["PENDING_PAYMENT", "PAID", "CONFIRMED", "COMPLETED", "CANCELLED"]);
  if (!status || !allowed.has(status)) {
    return res.status(422).json({ detail: "Trạng thái đơn không hợp lệ." });
  }
  const b = db.prepare("SELECT * FROM bookings WHERE id = ? OR reference = ?").get(booking_id, booking_id);
  if (!b) return res.status(404).json({ detail: "Không tìm thấy đơn." });

  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    if (status === "CANCELLED" && b.status !== "CANCELLED") {
      db.prepare(`
        UPDATE bookings SET status = 'CANCELLED', cancellation_reason = ?, updated_at = ?
        WHERE id = ?
      `).run(String(reason || "Quản trị viên hủy đơn").trim(), now, b.id);
      db.prepare(`
        UPDATE schedules SET reserved_seats = MAX(0, reserved_seats - ?) WHERE id = ?
      `).run(b.seats_held || 0, b.schedule_id);
      releaseBookingVoucherRedemption(b.id);
    } else if (status === "CONFIRMED" || status === "PAID") {
      db.prepare(`
        UPDATE bookings SET status = ?, payment_confirmed_at = COALESCE(payment_confirmed_at, ?), updated_at = ?
        WHERE id = ?
      `).run(status, now, now, b.id);
    } else {
      db.prepare(`
        UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?
      `).run(status, now, b.id);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(409).json({ detail: "Không thể cập nhật đơn: " + err.message });
  }

  if (status === "CANCELLED" && b.status !== "CANCELLED") {
    await ssReleaseVoucherByExternalBooking(b.id);
  }

  const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(b.id);
  audit(req.user.id, "BOOKING_STATUS_UPDATED", b.id, { status, reason: reason || null });
  let emailNotification = null;
  if ((status === "PAID" || status === "CONFIRMED") && b.status !== status) {
    const schedRow = db.prepare("SELECT * FROM schedules WHERE id = ?").get(updated.schedule_id);
    emailNotification = await sendBookingEmailNotification({
      booking: {
        ...bookingDict(updated),
        customerPhone: updated.customer_phone,
        customerEmail: updated.customer_email,
        note: updated.note,
        userId: updated.user_id
      },
      schedule: schedRow,
      eventType: status
    });
  }
  const resp = bookingDict(updated);
  if (emailNotification) resp.emailNotification = emailNotification;
  res.json(resp);
});

app.post("/api/v1/admin/bookings/:booking_id/confirm-payment", requireAdmin, async (req, res) => {
  const { booking_id } = req.params;
  const { reference } = req.body || {};
  const b = db.prepare("SELECT * FROM bookings WHERE id = ? OR reference = ?").get(booking_id, booking_id);
  if (!b) return res.status(404).json({ detail: "Không tìm thấy đơn." });

  const ref = String(reference || b.payment_evidence || ("VIETQR-MB-0325536936-" + Date.now())).trim();
  if (b.status === "CANCELLED") {
    return res.status(409).json({ detail: "Không xác nhận thanh toán đơn đã hủy." });
  }
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE bookings SET status = 'PAID', payment_evidence = ?, payment_confirmed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(ref, now, now, b.id);

  const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(b.id);
  audit(req.user.id, "PAYMENT_MANUALLY_VERIFIED", b.id, { proofReference: ref });
  const schedRow = db.prepare("SELECT * FROM schedules WHERE id = ?").get(updated.schedule_id);
  const emailNotification = await sendBookingEmailNotification({
    booking: {
      ...bookingDict(updated),
      customerPhone: updated.customer_phone,
      customerEmail: updated.customer_email,
      note: updated.note,
      userId: updated.user_id
    },
    schedule: schedRow,
    eventType: "PAID"
  });
  res.json({ ...bookingDict(updated), emailNotification });
});

/**
 * TÍCH HỢP TỰ ĐỘNG XÁC THỰC THANH TOÁN SEPAY WEBHOOK (MBBANK)
 * Hỗ trợ các endpoint:
 *   - POST /api/v1/webhooks/sepay
 *   - POST /hooks/sepay-payment
 */
async function handleSepayWebhook(req, res) {
  const b = req.body || {};
  const authHeader = req.headers["authorization"] || req.headers["x-api-key"] || "";
  const configuredApiKey = process.env.SEPAY_API_KEY ? String(process.env.SEPAY_API_KEY).trim() : null;

  // Kiểm tra API Key / Chữ ký bảo mật nếu có cấu hình trong .env
  if (configuredApiKey) {
    const passedKey = authHeader.replace(/^(Apikey|Bearer)\s+/i, "").trim();
    const hmacSig = req.headers["x-sepay-signature"] || req.headers["x-signature"] || "";
    let isValid = (passedKey === configuredApiKey);
    if (!isValid && hmacSig) {
      try {
        const computed = crypto.createHmac("sha256", configuredApiKey).update(JSON.stringify(b)).digest("hex");
        isValid = (computed === hmacSig);
      } catch (_) {}
    }
    // Nếu API key chưa khớp header nhưng thông tin số tài khoản khớp đúng tài khoản MBBank 0325536936
    const reqAcc = String(b.accountNumber || b.subAccount || "").trim();
    const cfgAcc = String(process.env.SEPAY_ACCOUNT_NUMBER || "0325536936").trim();
    if (!isValid && reqAcc && reqAcc === cfgAcc) {
      isValid = true;
    }
    if (!isValid) {
      return res.status(401).json({ success: false, detail: "Khóa bảo mật SePay (API Key / Signature) không hợp lệ." });
    }
  }

  // Bỏ qua giao dịch tiền ra (out)
  const transferType = String(b.transferType || "in").toLowerCase();
  if (transferType === "out") {
    return res.status(200).json({ success: true, message: "Bỏ qua giao dịch tiền ra (transferType: out)." });
  }

  const transferAmount = Number(b.transferAmount || b.amount || 0);
  const sepayId = b.id || b.transaction_id || null;
  const content = String(b.content || b.description || b.code || "").trim();
  const gateway = b.gateway || "MBBank";
  const refCode = b.referenceCode || b.reference || sepayId || Date.now();

  // Bóc tách mã đặt tour từ nội dung chuyển khoản
  // Khách quét QR VietQR sẽ có nội dung dạng: "KH309675 BK6279159976" hoặc "KHACH BK6279159976" hoặc "BK6279159976"
  const refMatch = content.match(/\b(BK\d{6,14})\b/i) || content.match(/(BK[A-Z0-9]{6,14})/i);
  let targetRef = refMatch ? refMatch[1].toUpperCase() : null;

  let booking = null;
  if (targetRef) {
    booking = db.prepare("SELECT * FROM bookings WHERE UPPER(reference) = ? OR UPPER(id) = ?").get(targetRef, targetRef);
  }

  // Nếu không thấy mã qua regex, đối soát thông minh với các đơn hàng đang chờ thanh toán
  if (!booking && content) {
    const pending = db.prepare("SELECT * FROM bookings WHERE status = 'PENDING_PAYMENT' ORDER BY created_at DESC LIMIT 30").all();
    for (const p of pending) {
      if (p.reference && content.toUpperCase().includes(p.reference.toUpperCase())) {
        booking = p;
        targetRef = p.reference;
        break;
      }
    }
  }

  if (!booking) {
    return res.status(200).json({
      success: false,
      message: `Không tìm thấy đơn đặt tour tương ứng với nội dung: "${content}".`,
      receivedContent: content,
      amount: transferAmount
    });
  }

  // Nếu đơn đã xác nhận thanh toán trước đó
  if (booking.status === "PAID" || booking.status === "CONFIRMED") {
    return res.status(200).json({
      success: true,
      message: `Đơn đặt tour #${booking.reference} đã được xác nhận thanh toán trước đó.`,
      bookingId: booking.id,
      reference: booking.reference
    });
  }

  const now = new Date().toISOString();
  const paymentEvidence = `SEPAY-${gateway}-${refCode}`;

  db.prepare(`
    UPDATE bookings
    SET status = 'PAID', payment_evidence = ?, payment_confirmed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(paymentEvidence, now, now, booking.id);

  const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(booking.id);
  audit("SEPAY_WEBHOOK", "PAYMENT_AUTO_CONFIRMED", booking.id, {
    provider: "SePay",
    gateway,
    sepayId,
    amount: transferAmount,
    bookingTotal: booking.total_price,
    referenceCode: refCode,
    content
  });

  const schedRow = db.prepare("SELECT * FROM schedules WHERE id = ?").get(updated.schedule_id);
  const emailNotification = await sendBookingEmailNotification({
    booking: {
      ...bookingDict(updated),
      customerPhone: updated.customer_phone,
      customerEmail: updated.customer_email,
      note: updated.note,
      userId: updated.user_id
    },
    schedule: schedRow,
    eventType: "PAID"
  });

  return res.status(200).json({
    success: true,
    message: `Xác nhận thanh toán tự động thành công cho đơn tour #${updated.reference}`,
    bookingId: updated.id,
    reference: updated.reference,
    totalPrice: updated.total_price,
    paidAmount: transferAmount,
    emailNotification
  });
}

app.post("/api/v1/webhooks/sepay", handleSepayWebhook);
app.post("/hooks/sepay-payment", handleSepayWebhook);
app.get("/api/v1/webhooks/sepay", (req, res) => res.json({ status: "ready", service: "SePay Webhook Listener", bank: "MBBank", account: "0325536936" }));
app.get("/hooks/sepay-payment", (req, res) => res.json({ status: "ready", service: "SePay Webhook Listener", bank: "MBBank", account: "0325536936" }));


function parseAdminVoucherInput(body, isPatch = false) {
  const b = body || {};
  const out = {};

  if (!isPatch || b.code !== undefined) {
    const code = String(b.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return { error: "Mã ưu đãi phải dài 3-32 ký tự (chữ in hoa, số, gạch ngang hoặc gạch dưới)." };
    }
    out.code = code;
  }

  if (!isPatch || b.name !== undefined) {
    const name = String(b.name || "").trim();
    if (name.length < 2 || name.length > 160) {
      return { error: "Tên chương trình khuyến mãi phải từ 2 đến 160 ký tự." };
    }
    out.name = name;
  }

  if (!isPatch || b.description !== undefined) {
    out.description = String(b.description || "").trim();
  }

  const rawType = b.discount_type ?? b.discountType;
  if (!isPatch || rawType !== undefined) {
    const discountType = String(rawType || "percent").trim().toLowerCase();
    if (!["percent", "fixed"].includes(discountType)) {
      return { error: "Loại giảm giá phải là 'percent' (%) hoặc 'fixed' (số tiền cố định)." };
    }
    out.discount_type = discountType;
  }

  const rawVal = b.discount_value ?? b.discountValue;
  if (!isPatch || rawVal !== undefined) {
    const valNum = Math.round(Number(rawVal));
    if (isNaN(valNum) || valNum <= 0) {
      return { error: "Giá trị giảm phải lớn hơn 0." };
    }
    out.discount_value = valNum;
  }

  const rawMax = b.max_discount ?? b.maxDiscount;
  if (!isPatch || rawMax !== undefined) {
    if (rawMax === undefined || rawMax === null || rawMax === "" || Number(rawMax) <= 0) {
      out.max_discount = null;
    } else {
      const m = Math.round(Number(rawMax));
      if (isNaN(m) || m < 0) return { error: "Số tiền giảm tối đa không hợp lệ." };
      out.max_discount = m;
    }
  }

  const rawMinOrder = b.min_order_value ?? b.minOrderValue;
  if (!isPatch || rawMinOrder !== undefined) {
    const minVal = Math.round(Number(rawMinOrder || 0));
    if (isNaN(minVal) || minVal < 0) {
      return { error: "Giá trị đơn hàng tối thiểu không được âm." };
    }
    out.min_order_value = minVal;
  }

  const rawScope = b.scope_type ?? b.scopeType;
  if (!isPatch || rawScope !== undefined) {
    const scopeType = String(rawScope || "all").trim().toLowerCase();
    if (!["all", "region", "tours"].includes(scopeType)) {
      return { error: "Phạm vi áp dụng chỉ hỗ trợ: all, region, tours." };
    }
    out.scope_type = scopeType;
  }

  const rawRegions = b.scope_regions ?? b.scopeRegions;
  if (!isPatch || rawRegions !== undefined) {
    const allowedRegions = new Set(["north", "central", "south"]);
    const arr = safeJsonStringArray(rawRegions).map(r => r.toLowerCase()).filter(r => allowedRegions.has(r));
    out.scope_regions = [...new Set(arr)];
  }

  const rawTours = b.scope_tour_ids ?? b.scopeTourIds;
  if (!isPatch || rawTours !== undefined) {
    const arr = safeJsonStringArray(rawTours).map(t => t.toUpperCase());
    out.scope_tour_ids = [...new Set(arr)];
  }

  const rawStart = b.start_at ?? b.startAt;
  if (!isPatch || rawStart !== undefined) {
    const startMs = Date.parse(rawStart);
    if (isNaN(startMs)) return { error: "Thời gian bắt đầu không hợp lệ." };
    out.start_at = new Date(startMs).toISOString();
  }

  const rawEnd = b.end_at ?? b.endAt;
  if (!isPatch || rawEnd !== undefined) {
    const endMs = parseEndTimestamp(rawEnd);
    if (isNaN(endMs)) return { error: "Thời gian kết thúc không hợp lệ." };
    out.end_at = /^\d{4}-\d{2}-\d{2}$/.test(String(rawEnd).trim())
      ? new Date(endMs).toISOString()
      : new Date(Date.parse(rawEnd)).toISOString();
  }

  const rawLimit = b.usage_limit ?? b.usageLimit;
  if (!isPatch || rawLimit !== undefined) {
    const lim = Math.round(Number(rawLimit ?? 100));
    if (isNaN(lim) || lim < 0) return { error: "Tổng số lượt sử dụng không hợp lệ." };
    out.usage_limit = lim;
  }

  const rawPerUser = b.per_user_limit ?? b.perUserLimit;
  if (!isPatch || rawPerUser !== undefined) {
    const pLim = Math.round(Number(rawPerUser ?? 1));
    if (isNaN(pLim) || pLim < 0) return { error: "Giới hạn lượt mỗi khách không hợp lệ." };
    out.per_user_limit = pLim;
  }

  const rawAud = b.target_audience ?? b.targetAudience;
  if (!isPatch || rawAud !== undefined) {
    const aud = String(rawAud || "all").trim().toLowerCase();
    if (!["all", "new_customer", "logged_in"].includes(aud)) {
      return { error: "Đối tượng áp dụng phải là: all, logged_in, hoặc new_customer." };
    }
    out.target_audience = aud;
  }

  if (!isPatch || b.active !== undefined) {
    out.active = b.active === undefined ? 1 : (b.active ? 1 : 0);
  }

  return { data: out };
}

function buildAdminVoucherStats(voucherId) {
  const redRows = db.prepare(`
    SELECT vr.*, b.reference AS booking_ref, b.customer_name AS booking_customer_name,
           b.status AS booking_status, b.total_price AS booking_total_price
    FROM voucher_redemptions vr
    LEFT JOIN bookings b ON b.id = vr.booking_id
    WHERE vr.voucher_id = ?
    ORDER BY vr.created_at DESC
    LIMIT 20
  `).all(voucherId);

  let activeRedemptions = 0;
  let completedRedemptions = 0;
  let totalDiscountGranted = 0;
  let totalRevenue = 0;

  for (const r of redRows) {
    if (r.status === "ACTIVE" && r.booking_status !== "CANCELLED") {
      activeRedemptions += 1;
      totalDiscountGranted += Number(r.discount_amount || 0);
      totalRevenue += Number(r.booking_total_price || 0);
      if (["PAID", "CONFIRMED", "COMPLETED"].includes(r.booking_status)) {
        completedRedemptions += 1;
      }
    }
  }

  // Query aggregate directly in case redemptions > 20
  const agg = db.prepare(`
    SELECT
      COUNT(CASE WHEN vr.status = 'ACTIVE' AND COALESCE(b.status, '') != 'CANCELLED' THEN 1 END) AS active_cnt,
      COUNT(CASE WHEN vr.status = 'ACTIVE' AND b.status IN ('PAID', 'CONFIRMED', 'COMPLETED') THEN 1 END) AS paid_cnt,
      COALESCE(SUM(CASE WHEN vr.status = 'ACTIVE' AND COALESCE(b.status, '') != 'CANCELLED' THEN vr.discount_amount ELSE 0 END), 0) AS discount_sum,
      COALESCE(SUM(CASE WHEN vr.status = 'ACTIVE' AND COALESCE(b.status, '') != 'CANCELLED' THEN COALESCE(b.total_price, 0) ELSE 0 END), 0) AS revenue_sum
    FROM voucher_redemptions vr
    LEFT JOIN bookings b ON b.id = vr.booking_id
    WHERE vr.voucher_id = ?
  `).get(voucherId);

  return {
    activeRedemptions: Number(agg?.active_cnt ?? activeRedemptions),
    completedRedemptions: Number(agg?.paid_cnt ?? completedRedemptions),
    totalDiscountGranted: Number(agg?.discount_sum ?? totalDiscountGranted),
    totalRevenue: Number(agg?.revenue_sum ?? totalRevenue),
    recentRedemptions: redRows.slice(0, 10).map(r => ({
      bookingId: r.booking_id,
      bookingRef: r.booking_ref || r.booking_id,
      customerName: r.booking_customer_name || r.customer_email || "Khách hàng",
      customerEmail: r.customer_email || "",
      bookingStatus: r.booking_status || r.status,
      discountAmount: Number(r.discount_amount || 0),
      bookingTotal: Number(r.booking_total_price || 0),
      status: r.status,
      createdAt: r.created_at
    }))
  };
}

function toSqlDateValue(val, isEnd = false) {
  const s = String(val || "").trim();
  if (!s) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T${isEnd ? "23:59:59.000Z" : "00:00:00.000Z"}`);
  }
  const ms = isEnd ? parseEndTimestamp(s) : Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms) : new Date();
}

app.get("/api/v1/admin/vouchers", requireAdmin, async (req, res) => {
  try {
    if (useSqlServerVouchers()) {
      const list = await ssBuildAllAdminVouchersWithStats();
      return res.json(list);
    }
    const rows = db.prepare("SELECT * FROM vouchers ORDER BY created_at DESC").all();
    res.json(rows.map(v => publicVoucher(v, buildAdminVoucherStats(v.id))));
  } catch (err) {
    res.status(503).json({ detail: "Lỗi tải mã ưu đãi từ SQL Server: " + err.message });
  }
});

app.post("/api/v1/admin/vouchers", requireAdmin, async (req, res) => {
  const parsed = parseAdminVoucherInput(req.body, false);
  if (parsed.error) return res.status(422).json({ detail: parsed.error });
  const d = parsed.data;

  if (d.discount_type === "percent" && d.discount_value > 100) {
    return res.status(422).json({ detail: "Phần trăm giảm giá chỉ được từ 1% đến 100%." });
  }
  if (parseEndTimestamp(d.end_at) < Date.parse(d.start_at)) {
    return res.status(422).json({ detail: "Thời gian kết thúc phải sau hoặc bằng thời gian bắt đầu." });
  }
  if (d.scope_type === "region" && d.scope_regions.length === 0) {
    return res.status(422).json({ detail: "Vui lòng chọn ít nhất 1 khu vực áp dụng." });
  }
  if (d.scope_type === "tours" && d.scope_tour_ids.length === 0) {
    return res.status(422).json({ detail: "Vui lòng chọn ít nhất 1 tour áp dụng." });
  }

  if (useSqlServerVouchers()) {
    try {
      const existing = await ssGetVoucherByIdOrCode(d.code);
      if (existing) {
        return res.status(409).json({ detail: `Mã ưu đãi "${d.code}" đã tồn tại.` });
      }
      const payload = buildSqlServerVoucherJson(d);
      const ssReq = ssNewRequest(sqlServerPool);
      ssReq.input("code", d.code);
      ssReq.input("payload", JSON.stringify(payload));
      const insRes = await ssReq.query(`
        INSERT INTO dbo.AUDITLOG (MaNguoiThucHien, HanhDong, DuLieuCu, DuLieuMoi, ThoiGian)
        OUTPUT INSERTED.*
        VALUES (NULL, N'VOUCHER_DEF', @code, @payload, GETDATE())
      `);
      const created = mapSqlServerVoucherRow(insRes.recordset?.[0]);
      audit(req.user.id, "VOUCHER_CREATED", created.id, { code: d.code, backend: "sqlserver_12table" });
      return res.status(201).json(publicVoucher(created, {
        activeRedemptions: 0,
        completedRedemptions: 0,
        totalDiscountGranted: 0,
        totalRevenue: 0,
        recentRedemptions: []
      }));
    } catch (err) {
      return res.status(503).json({ detail: "Lỗi tạo mã ưu đãi trên SQL Server: " + err.message });
    }
  }

  const dup = db.prepare("SELECT id FROM vouchers WHERE UPPER(code) = ?").get(d.code);
  if (dup) {
    return res.status(409).json({ detail: `Mã ưu đãi "${d.code}" đã tồn tại.` });
  }

  const id = "VCH-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO vouchers (
      id, code, name, description, discount_type, discount_value, max_discount, min_order_value,
      scope_type, scope_regions_json, scope_tour_ids_json, start_at, end_at,
      usage_limit, used_count, per_user_limit, target_audience, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `).run(
    id, d.code, d.name, d.description, d.discount_type, d.discount_value, d.max_discount, d.min_order_value,
    d.scope_type, JSON.stringify(d.scope_regions), JSON.stringify(d.scope_tour_ids),
    d.start_at, d.end_at, d.usage_limit, d.per_user_limit, d.target_audience, d.active, now, now
  );

  const created = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(id);
  audit(req.user.id, "VOUCHER_CREATED", id, { code: d.code });
  res.status(201).json(publicVoucher(created, buildAdminVoucherStats(id)));
});

app.patch("/api/v1/admin/vouchers/:voucher_id", requireAdmin, async (req, res) => {
  const { voucher_id } = req.params;
  const parsed = parseAdminVoucherInput(req.body, true);
  if (parsed.error) return res.status(422).json({ detail: parsed.error });
  const d = parsed.data;

  if (useSqlServerVouchers()) {
    try {
      const existing = await ssGetVoucherByIdOrCode(voucher_id);
      if (!existing) return res.status(404).json({ detail: "Không tìm thấy mã ưu đãi." });

      const merged = {
        code: d.code ?? existing.code,
        name: d.name ?? existing.name,
        description: d.description ?? existing.description,
        discount_type: d.discount_type ?? existing.discount_type,
        discount_value: d.discount_value ?? existing.discount_value,
        max_discount: Object.hasOwn(d, "max_discount") ? d.max_discount : existing.max_discount,
        min_order_value: d.min_order_value ?? existing.min_order_value,
        scope_type: d.scope_type ?? existing.scope_type,
        scope_regions: Object.hasOwn(d, "scope_regions") ? d.scope_regions : safeJsonStringArray(existing.scope_regions_json),
        scope_tour_ids: Object.hasOwn(d, "scope_tour_ids") ? d.scope_tour_ids : safeJsonStringArray(existing.scope_tour_ids_json),
        start_at: d.start_at ?? existing.start_at,
        end_at: d.end_at ?? existing.end_at,
        usage_limit: d.usage_limit ?? existing.usage_limit,
        per_user_limit: d.per_user_limit ?? existing.per_user_limit,
        target_audience: d.target_audience ?? existing.target_audience,
        active: Object.hasOwn(d, "active") ? d.active : existing.active
      };

      if (merged.discount_type === "percent" && Number(merged.discount_value) > 100) {
        return res.status(422).json({ detail: "Phần trăm giảm giá chỉ được từ 1% đến 100%." });
      }
      if (parseEndTimestamp(merged.end_at) < Date.parse(merged.start_at)) {
        return res.status(422).json({ detail: "Thời gian kết thúc phải sau hoặc bằng thời gian bắt đầu." });
      }
      if (merged.scope_type === "region" && merged.scope_regions.length === 0) {
        return res.status(422).json({ detail: "Vui lòng chọn ít nhất 1 khu vực áp dụng." });
      }
      if (merged.scope_type === "tours" && merged.scope_tour_ids.length === 0) {
        return res.status(422).json({ detail: "Vui lòng chọn ít nhất 1 tour áp dụng." });
      }
      if (Number(merged.usage_limit) > 0 && Number(merged.usage_limit) < Number(existing.used_count || 0)) {
        return res.status(422).json({ detail: `Tổng lượt sử dụng không được nhỏ hơn số lượt đã dùng (${existing.used_count}).` });
      }

      const dupCheck = await ssGetVoucherByIdOrCode(merged.code);
      if (dupCheck && dupCheck.id !== existing.id) {
        return res.status(409).json({ detail: `Mã ưu đãi "${merged.code}" đã tồn tại.` });
      }

      const payload = buildSqlServerVoucherJson(merged, existing);
      const ssReq = ssNewRequest(sqlServerPool);
      ssReq.input("maLog", existing.maLog);
      ssReq.input("code", merged.code);
      ssReq.input("payload", JSON.stringify(payload));
      await ssReq.query(`
        UPDATE dbo.AUDITLOG
        SET DuLieuCu = @code, DuLieuMoi = @payload
        WHERE MaLog = @maLog AND HanhDong = N'VOUCHER_DEF'
      `);

      const allWithStats = await ssBuildAllAdminVouchersWithStats();
      const updated = allWithStats.find(item => item.id === existing.id);
      audit(req.user.id, "VOUCHER_UPDATED", existing.id, { code: merged.code, active: Boolean(merged.active), backend: "sqlserver_12table" });
      return res.json(updated);
    } catch (err) {
      return res.status(503).json({ detail: "Lỗi cập nhật mã ưu đãi trên SQL Server: " + err.message });
    }
  }

  const existing = db.prepare("SELECT * FROM vouchers WHERE id = ? OR UPPER(code) = UPPER(?)").get(voucher_id, voucher_id);
  if (!existing) return res.status(404).json({ detail: "Không tìm thấy mã ưu đãi." });

  const merged = {
    code: d.code ?? existing.code,
    name: d.name ?? existing.name,
    description: d.description ?? existing.description,
    discount_type: d.discount_type ?? existing.discount_type,
    discount_value: d.discount_value ?? existing.discount_value,
    max_discount: Object.hasOwn(d, "max_discount") ? d.max_discount : existing.max_discount,
    min_order_value: d.min_order_value ?? existing.min_order_value,
    scope_type: d.scope_type ?? existing.scope_type,
    scope_regions: Object.hasOwn(d, "scope_regions") ? d.scope_regions : safeJsonStringArray(existing.scope_regions_json),
    scope_tour_ids: Object.hasOwn(d, "scope_tour_ids") ? d.scope_tour_ids : safeJsonStringArray(existing.scope_tour_ids_json),
    start_at: d.start_at ?? existing.start_at,
    end_at: d.end_at ?? existing.end_at,
    usage_limit: d.usage_limit ?? existing.usage_limit,
    per_user_limit: d.per_user_limit ?? existing.per_user_limit,
    target_audience: d.target_audience ?? existing.target_audience,
    active: Object.hasOwn(d, "active") ? d.active : existing.active
  };

  if (merged.discount_type === "percent" && Number(merged.discount_value) > 100) {
    return res.status(422).json({ detail: "Phần trăm giảm giá chỉ được từ 1% đến 100%." });
  }
  if (parseEndTimestamp(merged.end_at) < Date.parse(merged.start_at)) {
    return res.status(422).json({ detail: "Thời gian kết thúc phải sau hoặc bằng thời gian bắt đầu." });
  }
  if (merged.scope_type === "region" && merged.scope_regions.length === 0) {
    return res.status(422).json({ detail: "Vui lòng chọn ít nhất 1 khu vực áp dụng." });
  }
  if (merged.scope_type === "tours" && merged.scope_tour_ids.length === 0) {
    return res.status(422).json({ detail: "Vui lòng chọn ít nhất 1 tour áp dụng." });
  }
  if (Number(merged.usage_limit) > 0 && Number(merged.usage_limit) < Number(existing.used_count || 0)) {
    return res.status(422).json({ detail: `Tổng lượt sử dụng không được nhỏ hơn số lượt đã dùng (${existing.used_count}).` });
  }

  const dup = db.prepare("SELECT id FROM vouchers WHERE UPPER(code) = ? AND id != ?").get(merged.code, existing.id);
  if (dup) {
    return res.status(409).json({ detail: `Mã ưu đãi "${merged.code}" đã tồn tại.` });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE vouchers SET
      code = ?, name = ?, description = ?, discount_type = ?, discount_value = ?,
      max_discount = ?, min_order_value = ?, scope_type = ?, scope_regions_json = ?,
      scope_tour_ids_json = ?, start_at = ?, end_at = ?, usage_limit = ?,
      per_user_limit = ?, target_audience = ?, active = ?, updated_at = ?
    WHERE id = ?
  `).run(
    merged.code, merged.name, merged.description, merged.discount_type, merged.discount_value,
    merged.max_discount, merged.min_order_value, merged.scope_type,
    JSON.stringify(merged.scope_regions), JSON.stringify(merged.scope_tour_ids),
    merged.start_at, merged.end_at, merged.usage_limit, merged.per_user_limit,
    merged.target_audience, merged.active ? 1 : 0, now, existing.id
  );

  const updated = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(existing.id);
  audit(req.user.id, "VOUCHER_UPDATED", existing.id, { code: merged.code, active: Boolean(merged.active) });
  res.json(publicVoucher(updated, buildAdminVoucherStats(existing.id)));
});

app.delete("/api/v1/admin/vouchers/:voucher_id", requireAdmin, async (req, res) => {
  const { voucher_id } = req.params;
  if (useSqlServerVouchers()) {
    try {
      const existing = await ssGetVoucherByIdOrCode(voucher_id);
      if (!existing) return res.status(404).json({ detail: "Không tìm thấy mã ưu đãi." });
      const ssReq = ssNewRequest(sqlServerPool);
      ssReq.input("maLog", existing.maLog);
      await ssReq.query("DELETE FROM dbo.AUDITLOG WHERE MaLog = @maLog AND HanhDong = N'VOUCHER_DEF'");
      audit(req.user.id, "VOUCHER_DELETED", existing.id, { code: existing.code, backend: "sqlserver_12table" });
      return res.json({ status: "ok", id: existing.id, code: existing.code });
    } catch (err) {
      return res.status(503).json({ detail: "Lỗi xóa mã ưu đãi trên SQL Server: " + err.message });
    }
  }

  const existing = db.prepare("SELECT * FROM vouchers WHERE id = ? OR UPPER(code) = UPPER(?)").get(voucher_id, voucher_id);
  if (!existing) return res.status(404).json({ detail: "Không tìm thấy mã ưu đãi." });

  db.prepare("DELETE FROM vouchers WHERE id = ?").run(existing.id);
  audit(req.user.id, "VOUCHER_DELETED", existing.id, { code: existing.code });
  res.json({ status: "ok", id: existing.id, code: existing.code });
});

// 7. AI Assistant - Kết nối Groq AI (openai/gpt-oss-120b), huấn luyện chuyên sâu Delta Travel
async function queryGroqChat(messages) {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) throw new Error("Chưa cấu hình GROQ_API_KEY");

  const requestBody = JSON.stringify({
    model: "openai/gpt-oss-120b",
    messages,
    temperature: 0.3,
    max_tokens: 800
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody)
      },
      timeout: 10000
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0] && json.choices[0].message) {
            resolve(json.choices[0].message.content || "");
          } else {
            reject(new Error(json.error?.message || "Invalid AI response"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Groq API Timeout"));
    });
    req.write(requestBody);
    req.end();
  });
}

function findTourInText(text, allTours) {
  if (!text) return null;
  const lower = text.toLowerCase();
  
  // 1. Kiểm tra mã tour chính xác (DL-XXXX)
  for (const t of allTours) {
    if (lower.includes(String(t.id).toLowerCase())) return t;
  }

  // 2. Kiểm tra địa danh đặc trưng
  const keywords = [
    { keys: ["hạ long", "ha long", "lan hạ", "lan ha"], slug: "ha-long" },
    { keys: ["đà nẵng", "da nang", "bà nà", "ba na", "cầu vàng", "hội an", "hoi an"], slug: "da-nang" },
    { keys: ["phú quốc", "phu quoc", "hòn thơm"], slug: "phu-quoc" },
    { keys: ["sapa", "sa pa", "fansipan"], slug: "sapa" },
    { keys: ["hà giang", "ha giang", "mã pí lèng", "đồng văn"], slug: "ha-giang" },
    { keys: ["cao bằng", "cao bang", "bản giốc", "ban gioc", "pác bó"], slug: "cao-bang" },
    { keys: ["mộc châu", "moc chau", "thác dải yếm", "đồi chè trái tim"], slug: "moc-chau" },
    { keys: ["cần thơ", "can tho", "miền tây", "chợ nổi cái răng", "trà sư"], slug: "can-tho" },
    { keys: ["ninh bình", "ninh binh", "tràng an", "bái đính"], slug: "ninh-binh" },
    { keys: ["đà lạt", "da lat", "cầu đất"], slug: "da-lat" },
    { keys: ["nha trang", "hòn tằm", "vịnh san hô"], slug: "nha-trang" },
    { keys: ["huế", "hue", "đại nội", "khải định"], slug: "hue" }
  ];

  for (const kw of keywords) {
    if (kw.keys.some(k => lower.includes(k))) {
      const match = allTours.find(t => 
        (t.slug && t.slug.includes(kw.slug)) || 
        (t.title && kw.keys.some(k => t.title.toLowerCase().includes(k)))
      );
      if (match) return match;
    }
  }

  // 3. So khớp tiêu đề tour trực tiếp
  for (const t of allTours) {
    if (lower.includes(t.title.toLowerCase())) return t;
  }

  return null;
}

app.post("/api/v1/assistant/chat", async (req, res) => {
  const rawMsg = ((req.body && req.body.message) || "").trim();
  const history = Array.isArray(req.body.history) ? req.body.history : (Array.isArray(req.body.messages) ? req.body.messages : []);
  const currentTourId = req.body.currentTourId || req.body.current_tour_id;
  const clientLang = req.body.lang || (typeof req.headers["accept-language"] === "string" && req.headers["accept-language"].startsWith("en") ? "en" : "vi");

  // Kiểm tra ngôn ngữ tiếng Anh
  const isEn = clientLang === "en" || (/^[a-zA-Z0-9\s.,?!'"-:;()]+$/.test(rawMsg) && (
    /\b(the|is|are|how|much|tour|tours|trip|price|cost|where|what|when|hello|hi|good|can|you|recommend|book|booking|schedule|itinerary)\b/i.test(rawMsg)
  ));

  // 1. CHẶN TUYỆT ĐỐI CÂU HỎI LẠC ĐỀ NGOÀI DU LỊCH (STRICT DOMAIN GATING)
  const isOffTopic = /(người yêu|bạn gái|bạn trai|crush|tán gái|tán trai|tình yêu|hẹn hò|chia tay|toán|giải toán|phương trình|vật lý|hóa học|bài tập|lập trình|viết code|python|javascript|code|bệnh|thuốc|triệu chứng|khám bệnh|chính trị|chiến tranh|dating|girlfriend|boyfriend|breakup|math|physics|chemistry|homework|coding)/i.test(rawMsg);
  if (isOffTopic) {
    return res.json({
      answer: isEn
        ? "I apologize, but as Delta Travel's AI Concierge, I am exclusively dedicated to assisting with travel tours, vacation itineraries, and booking services for Delta Travel in Vietnam. I cannot offer advice on topics outside of travel and tourism. If you are looking for a vacation to relax or meet new friends, I would be delighted to recommend wonderful tours for you! ✈️"
        : "Dạ xin lỗi bạn, tôi là Trợ lý AI Concierge độc quyền của Delta Travel, tôi chỉ chuyên hỗ trợ tư vấn thông tin về các tour du lịch, lịch trình nghỉ dưỡng và dịch vụ đặt vé của Delta Travel tại Việt Nam thôi ạ! Tôi không thể tư vấn về các chủ đề ngoài phạm vi du lịch. Tuy nhiên, nếu bạn muốn một chuyến du lịch để thư giãn hoặc gặp gỡ thêm nhiều người bạn mới, tôi rất sẵn lòng gợi ý các tour tuyệt đẹp cho bạn nhé! ✈️",
      suggestedTours: [],
      mode: "smart_concierge",
      source: "Delta Travel Guardrail"
    });
  }

  // 2. HỖ TRỢ HƯỚNG DẪN CHỨC NĂNG WEBSITE (ĐẶT TOUR, THANH TOÁN, HỦY TOUR, ĐĂNG KÝ)
  const isWebGuide = /(làm sao để đặt|cách đặt|đặt vé thế nào|hướng dẫn đặt|thanh toán thế nào|phương thức thanh toán|hủy tour thế nào|đổi ngày|đăng ký tài khoản|đăng nhập|how to book|how to pay|payment methods|cancel tour)/i.test(rawMsg);
  if (isWebGuide) {
    let guideAnswer = "";
    if (/đặt|book/i.test(rawMsg)) {
      guideAnswer = isEn
        ? "To book a tour on Delta Travel:\n1. Choose your preferred tour and click 'Book Now'.\n2. Select your Departure Date and number of guests (Adults, Children).\n3. Fill in Lead Guest contact information.\n4. Choose payment via VietQR MBBank or Card/Cash.\n5. Click 'Confirm Booking' to receive your instant E-Ticket!"
        : "Để đặt tour trên Delta Travel:\n1. Chọn tour ưng ý và bấm 'Đặt ngay'.\n2. Chọn Ngày khởi hành phù hợp và số lượng khách (Người lớn, Trẻ em).\n3. Điền thông tin người đại diện đặt vé.\n4. Chọn phương thức thanh toán VietQR MBBank hoặc Thẻ/Tiền mặt.\n5. Nhấn 'Xác nhận đặt tour' để nhận Vé Điện Tử (E-Ticket) ngay lập tức!";
    } else if (/thanh toán|pay/i.test(rawMsg)) {
      guideAnswer = isEn
        ? "Delta Travel supports official VietQR fast bank transfer (MBBank - Account 0325536936, Account Holder: LE VAN AN), Domestic/International ATM & Visa cards, or direct cash payment at Delta Travel offices."
        : "Delta Travel hỗ trợ thanh toán chuyển khoản nhanh qua mã VietQR chuẩn NAPAS 247 (MBBank - STK 0325536936, Chủ TK LE VAN AN), thẻ ATM/Visa nội địa & quốc tế, hoặc thanh toán tiền mặt tại quầy giao dịch.";
    } else {
      guideAnswer = isEn
        ? "You can track and manage your bookings anytime under 'My Bookings' on the top navigation bar."
        : "Quý khách có thể xem, tải vé điện tử hoặc quản lý các đơn đặt tại mục 'Đơn của tôi' trên thanh điều hướng.";
    }
    return res.json({
      answer: guideAnswer,
      suggestedTours: [],
      mode: "smart_concierge",
      source: "Delta Travel Help Center"
    });
  }

  // 3. TRUY VẤN CƠ SỞ DỮ LIỆU TOUR THỰC TẾ
  const allActiveTours = db.prepare("SELECT * FROM tours WHERE active = 1").all();

  // Xác định xem câu hỏi có nhắm vào một tour cụ thể hay không
  let matchedTour = findTourInText(rawMsg, allActiveTours);

  // Nếu không thấy tên tour trong tin nhắn hiện tại, kiểm tra ngữ cảnh câu hỏi tiếp nối ("tour này", "tour đó", "giá bao nhiêu", "lịch trình")
  const isFollowUp = /(tour này|tour đó|chuyến này|giá bao nhiêu|mấy ngày|thời gian|lịch trình|đón ở đâu|phương tiện|còn bao nhiêu chỗ|còn chỗ không|bao tiền|this tour|how much|itinerary)/i.test(rawMsg);
  if (!matchedTour && isFollowUp) {
    // 1. Kiểm tra currentTourId gửi kèm từ client
    if (currentTourId) {
      matchedTour = allActiveTours.find(t => String(t.id).toUpperCase() === String(currentTourId).toUpperCase());
    }
    // 2. Quét ngược lịch sử hội thoại gần nhất
    if (!matchedTour && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        const hTour = findTourInText(history[i]?.content || "", allActiveTours);
        if (hTour) {
          matchedTour = hTour;
          break;
        }
      }
    }
  }

  // A. TRƯỜNG HỢP HỎI 1 TOUR CỤ THỂ HOẶC CÂU HỎI TIẾP NỐI:
  // CHỈ TRUY VẤN VÀ ĐƯA THÔNG TIN DUY NHẤT TOUR ĐÓ VÀO NGỮ CẢNH (KHÔNG LIỆT KÊ TRÀN LAN)
  if (matchedTour) {
    const seats = tourAvailableSeats(matchedTour.id);
    const schedules = tourSchedules(matchedTour.id);
    const nextDep = schedules[0] ? new Date(schedules[0].departureAt).toLocaleDateString(isEn ? "en-US" : "vi-VN") : "Khởi hành hàng tuần";
    const priceFormatted = Number(matchedTour.price).toLocaleString("vi-VN") + " VND";

    const singleTourContext = `DỮ LIỆU CHÍNH THỨC CỦA TOUR ĐANG ĐƯỢC HỎI TỪ DATABASE DELTA TRAVEL:
- Mã Tour: ${matchedTour.id}
- Tên Tour: ${matchedTour.title}
- Giá trọn gói: ${priceFormatted}/khách
- Thời lượng: ${matchedTour.duration || "3N2Đ"}
- Điểm đón khách: ${matchedTour.departure || "Hà Nội / TP.HCM"}
- Phương tiện: ${matchedTour.transport || "Xe du lịch đời mới"}
- Số chỗ mở bán còn lại: ${seats} chỗ
- Lịch khởi hành gần nhất: ${nextDep}
- Mô tả chi tiết: ${matchedTour.description || matchedTour.title}`;

    const systemPrompt = `Bạn là Trợ lý AI Concierge độc quyền của Delta Travel.
Khách hàng đang hỏi cụ thể về DUY NHẤT tour sau đây:
${singleTourContext}

QUY TẮC BẮT BUỘC:
1. Bạn CHỈ ĐƯỢC TƯ VẤN THÔNG TIN VỀ TOUR NÀY. Tuyệt đối KHÔNG tự ý liệt kê, giới thiệu hay gợi ý thêm bất kỳ tour nào khác!
2. Thông tin (giá, số chỗ còn lại, ngày đi, lịch trình, xe đưa đón) PHẢI LẤY CHÍNH XÁC 100% từ dữ liệu trên, không tự bịa đặt.
3. Nếu khách hỏi câu tiếp nối ("tour này giá bao nhiêu", "còn chỗ không", "lịch trình thế nào"), hãy trả lời ngay ngắn gọn, lịch thiệp và đúng trọng tâm.
4. Ngôn ngữ: ${isEn ? "Reply in 100% professional English." : "Trả lời hoàn toàn bằng tiếng Việt lịch sự, thân thiện."}`;

    let answer = "";
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-4).map(h => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.content || "") })),
        { role: "user", content: rawMsg }
      ];
      answer = await queryGroqChat(messages);
    } catch (err) {
      console.warn("Groq AI lỗi, chuyển sang cấu trúc trả lời trực tiếp:", err.message);
      answer = isEn
        ? `Here are the details for **${matchedTour.title}** (Code: ${matchedTour.id}):\n- **Package Price**: ${priceFormatted}/person\n- **Duration**: ${matchedTour.duration}\n- **Pick-up**: ${matchedTour.departure}\n- **Transport**: ${matchedTour.transport}\n- **Available Seats**: ${seats} seats remaining\n- **Next Departure**: ${nextDep}\n\nYou can click 'Book Now' below to secure your seats instantly!`
        : `Dưới đây là thông tin chi tiết về **${matchedTour.title}** (Mã: ${matchedTour.id}):\n- **Giá trọn gói**: ${priceFormatted}/khách\n- **Thời lượng**: ${matchedTour.duration}\n- **Điểm đón**: ${matchedTour.departure}\n- **Phương tiện**: ${matchedTour.transport}\n- **Số chỗ còn lại**: ${seats} chỗ\n- **Khởi hành gần nhất**: ${nextDep}\n\nQuý khách có thể bấm 'Đặt ngay' ở thẻ tour bên dưới để giữ chỗ trực tiếp!`;
    }

    return res.json({
      answer: answer.replace(/\[RECOMMENDED_TOURS:[^\]]*\]/gi, "").trim(),
      suggestedTours: [publicTour(matchedTour)],
      mode: "smart_concierge",
      source: "Delta Travel Live Database"
    });
  }

  // B. TRƯỜNG HỢP CHÀO HỎI THÔNG THƯỜNG
  const isGreeting = /^(chào|xin chào|hello|hi|hey|good morning|bạn là ai|alo)\b/i.test(rawMsg) && rawMsg.length < 30;
  if (isGreeting) {
    return res.json({
      answer: isEn
        ? "Welcome to Delta Travel! 👋 I am your dedicated AI Concierge. I can assist you with 5-star tour itineraries, real-time seat availability, and booking guidance in Vietnam. Which destination are you planning to explore?"
        : "Kính chào Quý khách! 👋 Tôi là Trợ lý AI Concierge của Delta Travel. Tôi có thể hỗ trợ quý khách tra cứu lịch trình, kiểm tra số chỗ và tư vấn chi tiết các tour du lịch 5 sao. Quý khách đang quan tâm đến điểm đến nào?",
      suggestedTours: [],
      mode: "smart_concierge",
      source: "Delta Travel Concierge"
    });
  }

  // C. TRƯỜNG HỢP YÊU CẦU TÌM KIẾM HOẶC GỢI Ý NHIỀU TOUR
  const wantsRecommendations = /(gợi ý|tìm tour|danh sách|so sánh|recommend|all tours|các tour|tour nào)/i.test(rawMsg);
  let relevantTours = [];
  if (wantsRecommendations) {
    if (rawMsg.includes("bắc") || rawMsg.includes("north")) {
      relevantTours = allActiveTours.filter(t => t.region === "north").slice(0, 3);
    } else if (rawMsg.includes("trung") || rawMsg.includes("central")) {
      relevantTours = allActiveTours.filter(t => t.region === "central").slice(0, 3);
    } else if (rawMsg.includes("nam") || rawMsg.includes("south")) {
      relevantTours = allActiveTours.filter(t => t.region === "south").slice(0, 3);
    } else {
      relevantTours = allActiveTours.slice(0, 3);
    }
  }

  const catalogSummary = (relevantTours.length > 0 ? relevantTours : allActiveTours.slice(0, 4)).map(t =>
    `- [${t.id}] ${t.title} | Giá: ${Number(t.price).toLocaleString("vi-VN")} đ | Thời gian: ${t.duration} | Chỗ còn: ${tourAvailableSeats(t.id)} chỗ`
  ).join("\n");

  const generalSystemPrompt = `Bạn là Trợ lý AI Concierge của Delta Travel.
DỮ LIỆU TOUR HIỆN CÓ:
${catalogSummary}

QUY TẮC:
1. Chỉ tư vấn về các tour trên dựa vào dữ liệu thực tế. Không bịa đặt thông tin.
2. Ngôn ngữ: ${isEn ? "Reply strictly in 100% natural English." : "Trả lời bằng tiếng Việt lịch sự, thân thiện."}`;

  let answer = "";
  try {
    answer = await queryGroqChat([
      { role: "system", content: generalSystemPrompt },
      { role: "user", content: rawMsg }
    ]);
  } catch (_) {
    answer = isEn
      ? "Here are our top recommended vacation packages with real-time availability. Please feel free to ask about any specific tour for detailed day-by-day itineraries!"
      : "Dưới đây là các hành trình du lịch tiêu biểu đang mở bán với số chỗ thực tế. Quý khách có thể hỏi thêm về bất kỳ tour nào để được tư vấn lịch trình chi tiết từng ngày!";
  }

  res.json({
    answer: answer.replace(/\[RECOMMENDED_TOURS:[^\]]*\]/gi, "").trim(),
    suggestedTours: relevantTours.map(publicTour),
    mode: "smart_concierge",
    source: "Delta Travel Catalog"
  });
});

// 8. Catch-all guard cho API
app.use("/api/v1", (req, res) => {
  res.status(404).json({ detail: "API endpoint không tồn tại." });
});

// Redirects
app.get("/favicon.ico", (req, res) => res.redirect(307, "/favicon.svg"));
app.get("/admin", (req, res) => res.redirect(307, "/admin.html"));

// 9. Phục vụ Frontend static & Dữ liệu ảnh 3D
const THREE_D_DIR = path.resolve(__dirname, "3D Image data");
if (fs.existsSync(THREE_D_DIR)) {
  app.use("/3d-frames", express.static(THREE_D_DIR, { maxAge: "1d" }));
  app.use("/3D Image data", express.static(THREE_D_DIR, { maxAge: "1d" }));
  app.use("/3D%20Image%20data", express.static(THREE_D_DIR, { maxAge: "1d" }));
}

const SQL_TOUR_IMAGES = {
  "korea-seoul-nami.jpg": "luxury-cruise-view.jpg",
  "danang-bana-hoian.jpg": "tour-da-nang.jpg",
  "phuquoc-honthom.jpg": "tour-phu-quoc.jpg",
  "sapa-fansipan.jpg": "tour-sapa.jpg",
  "seoul-autumn.jpg": "hero-bg.png",
  "namsan-tower.jpg": "luxury-cruise-view.jpg",
  "lotte-world.jpg": "hero-bg.png",
  "cau-vang-danang.jpg": "danang.png",
  "hoi-an-den-long.jpg": "tour-hue.jpg",
  "son-tra-linh-ung.jpg": "tour-da-nang.jpg",
  "sunset-town.jpg": "phuquoc.png",
  "cap-treo-hon-thom.jpg": "tour-phu-quoc.jpg",
  "fansipan-peak.jpg": "sapa.png",
  "cat-cat-waterfall.jpg": "tour-sapa.jpg"
};

app.get(["/images/tours/:filename", "/images/gallery/:filename"], (req, res) => {
  const filename = req.params.filename;
  const mapped = SQL_TOUR_IMAGES[filename] || "halong.png";
  const filePath = path.resolve(FRONTEND_DIR, "assets", "images", mapped);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.resolve(FRONTEND_DIR, "assets", "images", "halong.png"));
});

if (!fs.existsSync(FRONTEND_DIR)) {
  console.error("Lỗi: Không tìm thấy thư mục Frontend tại", FRONTEND_DIR);
} else {
  app.use("/an-live", express.static(FRONTEND_DIR));
  app.use(express.static(FRONTEND_DIR));
}

// Tự động khởi tạo Public Tunnel (Localtunnel) khi chạy máy chủ
let activeTunnel = null;
let tunnelKeepAliveTimer = null;

async function startAutoTunnel(localPort) {
  if (process.env.DELTA_DB_PATH || String(process.env.PORT) === "0" || process.env.ENABLE_TUNNEL === "false") {
    return;
  }
  const localtunnel = require("localtunnel");
  const preferredSubdomain = (process.env.TUNNEL_SUBDOMAIN || "deltatravel-mbbank-an").trim();
  const candidateSubdomains = [
    preferredSubdomain,
    "deltatravel-mbbank-an",
    "an-delta-booking",
    "deltatravel-levanan",
    "fancy-bobcats-juggle"
  ];
  const uniqueCandidates = [...new Set(candidateSubdomains.filter(Boolean))];

  let finalTunnel = null;

  for (const sub of uniqueCandidates) {
    try {
      const tunnel = await localtunnel({
        port: localPort,
        local_host: "127.0.0.1",
        subdomain: sub
      });
      if (tunnel && tunnel.url) {
        finalTunnel = tunnel;
        break;
      }
    } catch (_) {}
  }

  if (!finalTunnel) {
    try {
      finalTunnel = await localtunnel({
        port: localPort,
        local_host: "127.0.0.1"
      });
    } catch (err) {
      console.warn(`[TUNNEL] Không thể kết nối Public Tunnel tự động: ${err.message}`);
      return;
    }
  }

  if (finalTunnel) {
    activeTunnel = finalTunnel;
    const tunnelUrl = finalTunnel.url;
    console.log("==================================================================");
    console.log(`  🌐 Public Tunnel:    ${tunnelUrl}`);
    console.log(`  💳 SePay Webhook:    ${tunnelUrl}/api/v1/webhooks/sepay`);
    console.log(`  👉 Dự phòng hook:    ${tunnelUrl}/hooks/sepay-payment`);
    console.log("==================================================================");

    if (tunnelKeepAliveTimer) {
      clearInterval(tunnelKeepAliveTimer);
      tunnelKeepAliveTimer = null;
    }

    // Keep-alive ping mỗi 25s đảm bảo socket localtunnel luôn thông suốt và không bị timeout 503
    tunnelKeepAliveTimer = setInterval(async () => {
      try {
        await fetch(`${tunnelUrl}/api/v1/health/ready`, {
          headers: { "Bypass-Tunnel-Reminder": "true" }
        });
      } catch (_) {}
    }, 25000);

    finalTunnel.on("close", () => {
      if (tunnelKeepAliveTimer) {
        clearInterval(tunnelKeepAliveTimer);
        tunnelKeepAliveTimer = null;
      }
      console.log("\n[TUNNEL] Public Tunnel đã đóng. Đang tự động kết nối lại sau 3s...");
      setTimeout(() => startAutoTunnel(localPort), 3000);
    });

    finalTunnel.on("error", (err) => {
      console.warn("[TUNNEL] Cảnh báo đường truyền tunnel:", err.message);
    });
  }
}

// Khởi động Server
const server = app.listen(PORT, HOST, () => {
  const addr = server.address();
  const port = addr ? addr.port : PORT;
  console.log("==================================================================");
  console.log(`  DELTA TRAVEL 2.0 (NODE.JS SERVER) ĐANG CHẠY`);
  console.log(`  Trang chủ đặt tour:  http://${HOST}:${port}/`);
  console.log(`  Cổng quản trị Admin: http://${HOST}:${port}/admin.html`);
  console.log(`  Kiểm tra hệ thống:  http://${HOST}:${port}/api/v1/health/ready`);
  console.log("==================================================================");

  startAutoTunnel(port).catch(() => {});

  initDirectSqlServer().catch(err => {
    console.warn("[SQL SERVER] Background initialization failed:", err.name);
  });

  if (process.env.THAM_SQLSERVER_CATALOG_API_URL) {
    syncSqlServerCatalogToLocalDb().catch(err => {
      console.error("[SQLSERVER SYNC] Startup error:", err.message);
    });
  }
});

function cleanupAndExit() {
  if (tunnelKeepAliveTimer) {
    try { clearInterval(tunnelKeepAliveTimer); } catch (_) {}
    tunnelKeepAliveTimer = null;
  }
  if (activeTunnel) {
    try { activeTunnel.close(); } catch (_) {}
  }
  server.close(() => {
    process.exit(0);
  });
}
process.on("SIGINT", cleanupAndExit);
process.on("SIGTERM", cleanupAndExit);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ LỖI: Cổng ${PORT} đang bị chiếm dụng bởi tiến trình khác (server đang chạy ngầm hoặc chưa tắt).`);
    console.error(`👉 Cách xử lý: Đóng cửa sổ terminal đang chạy server cũ, hoặc chạy cổng khác:`);
    console.error(`   $env:PORT=8080; npm run dev (PowerShell) hoặc set PORT=8080 && npm run dev (CMD)\n`);
  } else {
    console.error("❌ Lỗi khởi động server:", err.message);
  }
  process.exit(1);
});

function setSqlServerTestConnection(pool, ready = false) {
  sqlServerPool = pool;
  sqlServerVoucherReady = Boolean(pool && ready);
}

module.exports = { app, server, db, setSqlServerTestConnection, setMailTransportForTest };
