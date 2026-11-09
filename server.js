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
const HOST = process.env.HOST || "127.0.0.1";
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

// Cấu hình kết nối trực tiếp SmarterASP.NET SQL Server
let sqlServerPool = null;
const SQL_SERVER_CONFIG = {
  user: process.env.DELTA_MSSQL_USER || "db_ad0b71_dattour_admin",
  password: process.env.DELTA_MSSQL_PASSWORD || "Phamtham312007@",
  server: process.env.DELTA_MSSQL_SERVER || "sql8020.site4now.net",
  port: parseInt(process.env.DELTA_MSSQL_PORT || "1433", 10),
  database: process.env.DELTA_MSSQL_DATABASE || "db_ad0b71_dattour",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 8000
  }
};

async function initDirectSqlServer() {
  try {
    const mssql = require("mssql");
    sqlServerPool = await mssql.connect(SQL_SERVER_CONFIG);
    console.log("[SQL SERVER] Đã kết nối TRỰC TIẾP thành công tới SmarterASP.NET SQL Server (sql8020.site4now.net:1433 / db_ad0b71_dattour)!");
  } catch (err) {
    console.warn("[SQL SERVER] Chưa thể kết nối SQL Server trực tiếp:", err.message);
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 1, ?)
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
      updated_at = excluded.updated_at
  `);

  const insertSchedule = db.prepare(`
    INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
    VALUES (?, ?, ?, ?, 0, 1)
  `);

  TOURS_16.forEach((t, i) => {
    const imagesJson = JSON.stringify(t.images);
    upsertTour.run(t.id, t.slug, t.title, t.region, t.duration, t.price, t.original_price, imagesJson, t.departure, t.transport, t.flash_sale, t.description, now);

    const schedCount = db.prepare("SELECT COUNT(*) AS count FROM schedules WHERE tour_id = ?").get(t.id).count;
    if (schedCount === 0) {
      [14 + i, 30 + i, 45 + i].forEach(days => {
        const d = new Date(Date.now() + days * 24 * 3600 * 1000);
        d.setUTCHours(2, 0, 0, 0);
        insertSchedule.run(crypto.randomUUID(), t.id, d.toISOString(), t.seats);
      });
    }
  });

  try {
    db.exec("ALTER TABLE users ADD COLUMN avatar TEXT;");
  } catch (_) {}
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
    description: t.description || "",
    price: Number(t.price),
    originalPrice: Number(t.original_price),
    isFlashSale: Boolean(t.flash_sale),
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
  return {
    id: b.id,
    reference: b.reference,
    scheduleId: b.schedule_id,
    tourTitle: b.tour_title,
    customerName: b.customer_name,
    adults: Number(b.adults),
    children: Number(b.children),
    infants: Number(b.infants),
    seats: Number(b.seats_held),
    unitPrice: Number(b.unit_price),
    totalPrice: Number(b.total_price),
    status: b.status,
    paid: ["PAID", "CONFIRMED", "COMPLETED"].includes(b.status),
    paymentEvidence: b.payment_evidence || null,
    paymentConfirmedAt: b.payment_confirmed_at ? iso(b.payment_confirmed_at) : null,
    expiresAt: iso(b.expires_at),
    createdAt: iso(b.created_at)
  };
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
    return next();
  }

  // Hỗ trợ khách đặt trực tiếp: tự động liên kết hoặc tạo tài khoản khách hàng
  const { customer_email, customer_name, customer_phone } = req.body || {};
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

  return res.status(401).json({ detail: "Bạn cần đăng nhập." });
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
      catalogMode: "sqlserver_read_only"
    });
  }

  const row = db.prepare("SELECT COUNT(*) AS c FROM tours").get();
  res.json({
    status: "ok",
    db: sqlServerPool ? "SQL Server (sql8020.site4now.net - ONLINE)" : "connected",
    sqlServerConnected: Boolean(sqlServerPool),
    sqlServerHost: "sql8020.site4now.net:1433",
    sqlServerDb: "db_ad0b71_dattour",
    tours: row.c,
    catalogMode: sqlServerPool ? "sqlserver_direct" : "sqlite"
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

  const user = db.prepare("SELECT * FROM users WHERE email = ? OR phone = ?").get(ident, ident);
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
  query += " ORDER BY id ASC";
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
  res.json(items.map(item => ({
    dayNumber: Number(item.day_number),
    title: item.title,
    description: item.description,
    location: item.location,
    startTime: item.start_time
  })));
});

// 5. Booking & Pricing Flow
function calculateTotals(unitPrice, adults, children = 0, infants = 0) {
  const childPrice = Math.floor((unitPrice * 75 + 50) / 100);
  const infantPrice = Math.floor((unitPrice * 10 + 50) / 100);
  return unitPrice * adults + childPrice * children + infantPrice * infants;
}

app.post("/api/v1/bookings/quote", (req, res) => {
  const { schedule_id, adults, children = 0, infants = 0 } = req.body || {};
  if (!schedule_id || !adults || adults < 1) {
    return res.status(422).json({ detail: "Thông tin tính giá không hợp lệ." });
  }

  const sched = db.prepare("SELECT * FROM schedules WHERE id = ? AND active = 1").get(schedule_id);
  if (!sched) return res.status(404).json({ detail: "Lịch khởi hành không tồn tại." });

  const tour = db.prepare("SELECT * FROM tours WHERE id = ? AND active = 1").get(sched.tour_id);
  if (!tour) return res.status(404).json({ detail: "Tour không tồn tại." });

  const totalSeats = adults + children + infants;
  const avail = sched.total_seats - (sched.reserved_seats || 0);

  res.json({
    scheduleId: sched.id,
    tourId: tour.id,
    seats: totalSeats,
    availableSeats: Math.max(0, avail),
    unitPrice: tour.price,
    totalPrice: calculateTotals(tour.price, adults, children, infants),
    currency: "VND",
    pricingRules: { childPercent: 75, infantPercent: 10 },
    addonsSupported: false,
    vouchersSupported: false
  });
});

app.post("/api/v1/bookings", requireAuthOrGuest, (req, res) => {
  const {
    schedule_id,
    adults = 1,
    children = 0,
    infants = 0,
    customer_name,
    customer_phone,
    customer_email,
    note = ""
  } = req.body || {};

  const idemKey = req.headers["idempotency-key"];
  if (!idemKey) {
    return res.status(422).json({ detail: "Yêu cầu cung cấp khóa Idempotency-Key." });
  }

  // Kiểm tra trùng Idempotency-Key của user
  const existingBooking = db.prepare("SELECT * FROM bookings WHERE user_id = ? AND idempotency_key = ?").get(req.user.id, idemKey);
  if (existingBooking) {
    return res.status(200).json(bookingDict(existingBooking));
  }

  if (!schedule_id || !customer_name || !customer_phone || !customer_email) {
    return res.status(422).json({ detail: "Vui lòng nhập đầy đủ thông tin đặt chỗ." });
  }

  const sched = db.prepare("SELECT * FROM schedules WHERE id = ? AND active = 1").get(schedule_id);
  if (!sched) return res.status(404).json({ detail: "Lịch khởi hành không hợp lệ." });

  const tour = db.prepare("SELECT * FROM tours WHERE id = ? AND active = 1").get(sched.tour_id);
  if (!tour) return res.status(404).json({ detail: "Tour không tồn tại." });

  const totalSeats = adults + children + infants;
  const avail = sched.total_seats - (sched.reserved_seats || 0);
  if (totalSeats > avail) {
    return res.status(409).json({ detail: "Không đủ chỗ trống cho số lượng khách này." });
  }

  const bookingId = crypto.randomUUID();
  const ref = "BK" + Date.now().toString().slice(-8) + crypto.randomInt(10, 99);
  const totalPrice = calculateTotals(tour.price, adults, children, infants);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 phút giữ chỗ
  const now = new Date().toISOString();
  const payloadFingerprint = crypto.createHash("sha256").update(JSON.stringify(req.body)).digest("hex");

  // Transaction lưu booking & giữ chỗ
  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO bookings (
        id, reference, user_id, schedule_id, idempotency_key, payload_fingerprint, tour_title,
        customer_name, customer_phone, customer_email, note,
        adults, children, infants, seats_held, unit_price, total_price,
        status, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_PAYMENT', ?, ?, ?)
    `).run(
      bookingId, ref, req.user.id, schedule_id, idemKey, payloadFingerprint, tour.title,
      customer_name, customer_phone, customer_email, note || "",
      adults, children, infants, totalSeats, tour.price, totalPrice,
      expiresAt, now, now
    );

    db.prepare("UPDATE schedules SET reserved_seats = reserved_seats + ? WHERE id = ?")
      .run(totalSeats, schedule_id);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(409).json({ detail: "Lỗi ghi dữ liệu: " + err.message });
  }

  const saved = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
  audit(req.user.id, "BOOKING_CREATED", bookingId, { reference: ref, total: totalPrice });
  res.status(201).json(bookingDict(saved));
});

app.get("/api/v1/bookings", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(rows.map(bookingDict));
});

app.get("/api/v1/bookings/:booking_id", requireAuth, (req, res) => {
  const b = db.prepare("SELECT * FROM bookings WHERE id = ? AND (user_id = ? OR ? = 'ADMIN')").get(
    req.params.booking_id, req.user.id, req.user.role
  );
  if (!b) return res.status(404).json({ detail: "Không tìm thấy đơn đặt tour." });
  res.json(bookingDict(b));
});

app.post("/api/v1/bookings/:booking_id/pay", requireAuth, (req, res) => {
  const { reference } = req.body || {};
  if (!reference || reference.trim().length < 8) {
    return res.status(422).json({ detail: "Mã giao dịch / UNC tối thiểu 8 ký tự." });
  }

  const b = db.prepare("SELECT * FROM bookings WHERE id = ? AND user_id = ?").get(req.params.booking_id, req.user.id);
  if (!b) return res.status(404).json({ detail: "Đơn đặt không tồn tại." });

  // Kiểm tra trùng mã thanh toán
  const dup = db.prepare("SELECT id FROM bookings WHERE payment_evidence = ? AND id != ?").get(reference.trim(), b.id);
  if (dup) return res.status(409).json({ detail: "Mã giao dịch đã được sử dụng cho đơn khác." });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE bookings
    SET status = 'PAID', payment_evidence = ?, payment_confirmed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(reference.trim(), now, now, b.id);

  const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(b.id);
  audit(req.user.id, "PAYMENT_SUBMITTED", b.id, { reference: reference.trim() });
  res.json(bookingDict(updated));
});

app.post("/api/v1/bookings/:booking_id/cancel", requireAuth, (req, res) => {
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

    // Trả lại số chỗ đã giữ
    db.prepare(`
      UPDATE schedules SET reserved_seats = MAX(0, reserved_seats - ?) WHERE id = ?
    `).run(b.seats_held, b.schedule_id);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(409).json({ detail: err.message });
  }

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

  const { price, cost_items: costItems, itinerary } = req.body || {};
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
  if (price <= baseCost) {
    return res.status(422).json({ detail: "Giá bán phải cao hơn tổng giá gốc." });
  }

  db.exec("BEGIN");
  try {
    db.prepare("UPDATE tours SET price = ?, updated_at = ? WHERE id = ?")
      .run(price, new Date().toISOString(), tour_id);
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

  db.prepare(`
    INSERT INTO tours (
      id, slug, title, region, duration, price, original_price,
      image, departure, transport, flash_sale, description, itinerary_json, active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    data.id, data.slug || data.id.toLowerCase(), data.title, data.region, data.duration,
    data.price, data.original_price || data.price, data.image || "", data.departure,
    data.transport, data.flash_sale ? 1 : 0, data.description || "", data.itinerary_json || "[]", new Date().toISOString()
  );

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
      params.push(key === "images" ? JSON.stringify(val) :
        key === "flash_sale" || key === "active" ? (val ? 1 : 0) : val);
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
  db.prepare("UPDATE tours SET active = 0 WHERE id = ?").run(tour_id);
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

  const { total_seats, active } = req.body || {};
  if (total_seats !== undefined) {
    db.prepare("UPDATE schedules SET total_seats = ? WHERE id = ?").run(total_seats, schedule_id);
  }
  if (active !== undefined) {
    db.prepare("UPDATE schedules SET active = ? WHERE id = ?").run(active ? 1 : 0, schedule_id);
  }

  const updated = db.prepare("SELECT * FROM schedules WHERE id = ?").get(schedule_id);
  audit(req.user.id, "SCHEDULE_UPDATED", schedule_id);
  res.json(publicSchedule(updated));
});

app.get("/api/v1/admin/bookings", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100").all();
  res.json(rows.map(b => ({
    ...bookingDict(b),
    customerPhone: b.customer_phone,
    customerEmail: b.customer_email,
    userId: b.user_id
  })));
});

app.post("/api/v1/admin/bookings/:booking_id/confirm-payment", requireAdmin, (req, res) => {
  const { booking_id } = req.params;
  const { reference } = req.body || {};
  const b = db.prepare("SELECT * FROM bookings WHERE id = ?").get(booking_id);
  if (!b) return res.status(404).json({ detail: "Không tìm thấy đơn." });

  const ref = (reference || b.payment_evidence || ("ADM-CONFIRM-" + Date.now())).trim();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE bookings SET status = 'PAID', payment_evidence = ?, payment_confirmed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(ref, now, now, booking_id);

  const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(booking_id);
  audit(req.user.id, "PAYMENT_MANUALLY_VERIFIED", booking_id, { proofReference: ref });
  res.json(bookingDict(updated));
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
        ? "Delta Travel supports official VietQR fast bank transfer (MBBank - Account 0975703852, Account Holder: LE VAN AN), Domestic/International ATM & Visa cards, or direct cash payment at Delta Travel offices."
        : "Delta Travel hỗ trợ thanh toán chuyển khoản nhanh qua mã VietQR chuẩn NAPAS 247 (MBBank - STK 0975703852, Chủ TK LE VAN AN), thẻ ATM/Visa nội địa & quốc tế, hoặc thanh toán tiền mặt tại quầy giao dịch.";
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

  initDirectSqlServer().catch(err => {
    console.warn("[SQL SERVER] Background init error:", err.message);
  });

  if (process.env.THAM_SQLSERVER_CATALOG_API_URL) {
    syncSqlServerCatalogToLocalDb().catch(err => {
      console.error("[SQLSERVER SYNC] Startup error:", err.message);
    });
  }
});

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

module.exports = { app, server, db };
