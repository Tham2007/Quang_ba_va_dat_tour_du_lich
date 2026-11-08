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
  const addedTourCapacity = !db.prepare("PRAGMA table_info(tours)").all().some(c => c.name === "default_seats");
  if (addedTourCapacity) db.exec("ALTER TABLE tours ADD COLUMN default_seats INTEGER NOT NULL DEFAULT 20");

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

  if (addedTourCapacity) db.exec(`UPDATE tours SET default_seats = COALESCE(
    (SELECT total_seats FROM schedules WHERE tour_id = tours.id ORDER BY departure_at LIMIT 1),20)`);
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
    totalSeats: Number(t.default_seats || 20),
    availableSeats: Math.max(0, Number(db.prepare(`SELECT total_seats - reserved_seats AS remain
      FROM schedules WHERE tour_id=? AND active=1 AND departure_at>? ORDER BY departure_at LIMIT 1`)
      .get(t.id, new Date().toISOString())?.remain ?? 0)),
    isFlashSale: Boolean(t.flash_sale),
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
  res.json({ status: "ok", db: "connected", tours: row.c, catalogMode: "sqlite" });
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
  const { search, region, flash_sale } = req.query;
  let query = "SELECT * FROM tours WHERE active = 1";
  const params = [];

  if (region) {
    query += " AND region = ?";
    params.push(region);
  }
  if (flash_sale !== undefined) {
    query += " AND flash_sale = ?";
    params.push(flash_sale === "true" || flash_sale === "1" ? 1 : 0);
  }
  if (search) {
    query += " AND (title LIKE ? OR description LIKE ? OR departure LIKE ?)";
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  query += " ORDER BY id ASC";
  const tours = db.prepare(query).all(...params);
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
  const capacity = data.available_seats === undefined ? 20 : data.available_seats;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)
    return res.status(422).json({detail:"Số chỗ mở bán không hợp lệ."});
  const existing = db.prepare("SELECT id FROM tours WHERE id = ?").get(data.id);
  if (existing) return res.status(409).json({ detail: "Mã tour đã tồn tại." });

  db.prepare(`
    INSERT INTO tours (
      id, slug, title, region, duration, price, original_price,
      image, departure, transport, flash_sale, description, itinerary_json, default_seats, active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    data.id, data.slug || data.id.toLowerCase(), data.title, data.region, data.duration,
    data.price, data.original_price || data.price, data.image || "", data.departure,
    data.transport, data.flash_sale ? 1 : 0, data.description || "", data.itinerary_json || "[]", capacity, new Date().toISOString()
  );

  const t = db.prepare("SELECT * FROM tours WHERE id = ?").get(data.id);
  audit(req.user.id, "TOUR_CREATED", data.id);
  res.status(201).json(publicTour(t));
});

app.patch("/api/v1/admin/tours/:tour_id", requireAdmin, (req, res) => {
  const { tour_id } = req.params;
  const t = db.prepare("SELECT * FROM tours WHERE id = ?").get(tour_id);
  if (!t) return res.status(404).json({ detail: "Không tìm thấy tour." });

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
    available_seats: "default_seats"
  };
  const fields = [];
  const params = [];
  for (const [key, val] of Object.entries(req.body || {})) {
    if (!Object.hasOwn(columns, key)) {
      return res.status(422).json({ detail: `Không hỗ trợ cập nhật trường "${key}".` });
    }
    if (val !== undefined && val !== null) {
      if (key === "images" &&
          (!Array.isArray(val) || val.length > 12 ||
           val.some(image => typeof image !== "string" || image.length > 1200))) {
        return res.status(422).json({ detail: "Danh sách ảnh tour không hợp lệ." });
      }
      const col = columns[key];
      fields.push(`${col} = ?`);
      params.push(key === "images" ? JSON.stringify(val) :
        key === "flash_sale" || key === "active" ? (val ? 1 : 0) : val);
    }
  }

  const capacity = req.body?.available_seats;
  if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000))
    return res.status(422).json({ detail: "Số chỗ phải là số nguyên từ 1 đến 10000." });
  if (fields.length > 0) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (capacity !== undefined) {
        const blocked = db.prepare(`SELECT id FROM schedules WHERE tour_id=? AND departure_at>?
          AND reserved_seats>? LIMIT 1`).get(tour_id,new Date().toISOString(),capacity);
        if (blocked) {
          db.exec("ROLLBACK");
          return res.status(409).json({ detail: "Không thể giảm thấp hơn số chỗ đã giữ." });
        }
        db.prepare(`UPDATE schedules SET total_seats=? WHERE tour_id=? AND departure_at>?`)
          .run(capacity,tour_id,new Date().toISOString());
      }
      fields.push("updated_at = ?");
      params.push(new Date().toISOString(),tour_id);
      db.prepare(`UPDATE tours SET ${fields.join(", ")} WHERE id=?`).run(...params);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      console.error("Tour transaction failed:",err.message);
      return res.status(409).json({ detail: "Không lưu được thay đổi tour." });
    }
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
  const date = new Date(departure_at);
  if (!tour_id || !departure_at || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    return res.status(422).json({detail:"Ngày khởi hành phải ở tương lai."});
  if (!Number.isInteger(total_seats) || total_seats < 1 || total_seats > 10000)
    return res.status(422).json({detail:"Số chỗ không hợp lệ."});
  if (!db.prepare("SELECT id FROM tours WHERE id=? AND active=1").get(tour_id))
    return res.status(404).json({detail:"Tour không tồn tại hoặc đã ngừng bán."});
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
    VALUES (?, ?, ?, ?, 0, 1)
  `).run(id, tour_id, date.toISOString(), total_seats);

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
    if (!Number.isInteger(total_seats) || total_seats < 1 || total_seats > 10000 || total_seats < s.reserved_seats)
      return res.status(422).json({detail:"Số chỗ không hợp lệ hoặc ít hơn số đã giữ."});
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

// 7. AI Assistant - Huấn luyện đúng trọng tâm, chuyên sâu Delta Travel & gợi ý tour tương tác
app.post("/api/v1/assistant/chat", (req, res) => {
  const rawMsg = ((req.body && req.body.message) || "").trim();
  const message = rawMsg.toLowerCase();
  let answer = "";
  let suggestedTours = [];

  if (message.includes("giá") || message.includes("bao nhiêu") || message.includes("price") || message.includes("chi phí")) {
    const sample = db.prepare("SELECT * FROM tours WHERE active = 1 ORDER BY price ASC LIMIT 4").all();
    suggestedTours = sample.map(publicTour);
    answer = "Giá niêm yết hiện tại: " + sample.map(t => `${t.title}: ${Number(t.price).toLocaleString("vi-VN")} VND`).join("; ") + ". Toàn bộ giá tour đã bao gồm bảo hiểm 100%, khách sạn và xe đưa đón đời mới. Quý khách có thể bấm 'Đặt ngay' ở các tour dưới đây:";
  } else if (message.includes("hạ long") || message.includes("ha long") || message.includes("lan hạ") || message.includes("du thuyền")) {
    const matched = db.prepare("SELECT * FROM tours WHERE active = 1 AND (title LIKE '%Hạ Long%' OR title LIKE '%Lan Hạ%' OR transport LIKE '%Du thuyền%') LIMIT 3").all();
    suggestedTours = matched.map(publicTour);
    answer = "Vịnh Hạ Long - kỳ quan thiên nhiên thế giới với hàng ngàn hòn đảo kỳ vĩ. Delta Travel mang đến hành trình du thuyền 5 sao chuẩn quốc tế (3N2Đ): chèo thuyền kayak vịnh Lan Hạ, khám phá hang Sửng Sốt, tắm biển Ti Tốp và thưởng thức tiệc hải sản tươi ngon. Bạn có thể xem lịch trình hoặc đặt ngay bên dưới:";
  } else if (message.includes("đà nẵng") || message.includes("da nang") || message.includes("hội an") || message.includes("hoi an") || message.includes("bà nà") || message.includes("cầu vàng")) {
    const matched = db.prepare("SELECT * FROM tours WHERE active = 1 AND (title LIKE '%Đà Nẵng%' OR title LIKE '%Hội An%' OR region = 'central') LIMIT 3").all();
    suggestedTours = matched.map(publicTour);
    answer = "Hành trình Miền Trung di sản: Đà Nẵng - Cầu Vàng Bà Nà Hills - Phố cổ Hội An (4N3Đ) trọn gói vé máy bay khứ hồi và khách sạn 4 sao biển Mỹ Khê. Bạn sẽ được check-in Cầu Vàng trên mây và thả đèn hoa đăng lung linh bên sông Hoài. Dưới đây là các tour tốt nhất:";
  } else if (message.includes("phú quốc") || message.includes("phu quoc") || message.includes("biển") || message.includes("đảo")) {
    const matched = db.prepare("SELECT * FROM tours WHERE active = 1 AND (title LIKE '%Phú Quốc%' OR title LIKE '%Côn Đảo%') LIMIT 3").all();
    suggestedTours = matched.map(publicTour);
    answer = "Thiên đường biển đảo Phú Quốc đang bước vào mùa nắng đẹp nhất năm. Delta Travel thiết kế hải trình 4N3Đ trọn gói: cáp treo Hòn Thơm vượt biển, lặn ngắm san hô cano cao tốc 4 đảo, thành phố không ngủ Grand World và nghỉ dưỡng resort sát biển. Gợi ý hành trình phù hợp cho bạn:";
  } else if (message.includes("đà lạt") || message.includes("da lat") || message.includes("săn mây") || message.includes("hoa")) {
    const matched = db.prepare("SELECT * FROM tours WHERE active = 1 AND title LIKE '%Đà Lạt%' LIMIT 2").all();
    suggestedTours = matched.map(publicTour);
    answer = "Thành phố mộng mơ Đà Lạt khí hậu mát mẻ 18-20°C quanh năm. Tour 3N2Đ của Delta Travel đưa đón bằng xe Limousine phòng nằm cao cấp: săn mây Cầu Đất lúc bình minh, hồ Tuyền Lâm, ga xe lửa cổ và đồi hoa cẩm tú cầu. Bạn hãy tham khảo và giữ chỗ sớm nhé:";
  } else if (message.includes("sa pa") || message.includes("sapa") || message.includes("fansipan") || message.includes("núi")) {
    const matched = db.prepare("SELECT * FROM tours WHERE active = 1 AND (title LIKE '%Sa Pa%' OR title LIKE '%Hà Giang%') LIMIT 2").all();
    suggestedTours = matched.map(publicTour);
    answer = "Vùng cao Tây Bắc Sa Pa & Đỉnh Fansipan 3.143m - nóc nhà Đông Dương hùng vĩ. Xe Limousine đón trả tận nơi tại Hà Nội, khách sạn view thung lũng Mường Hoa thơ mộng và trải nghiệm văn hóa bản Cát Cát độc đáo:";
  } else if (message.includes("côn đảo") || message.includes("con dao") || message.includes("cô sáu")) {
    const matched = db.prepare("SELECT * FROM tours WHERE active = 1 AND title LIKE '%Côn Đảo%' LIMIT 2").all();
    suggestedTours = matched.map(publicTour);
    answer = "Về miền đất thiêng Côn Đảo: Viếng Nghĩa trang Hàng Dương và mộ Cô Sáu lúc nửa đêm, tham quan hệ thống di tích lịch sử và tắm biển Bãi Đầm Trầu hoang sơ tuyệt mỹ. Vé máy bay khứ hồi và tàu cao tốc chuẩn 5 sao:";
  } else if (message.includes("hủy") || message.includes("hoàn tiền") || message.includes("cancel") || message.includes("đổi ngày")) {
    answer = "Chính sách của Delta Travel cam kết minh bạch và linh hoạt: Đơn chưa thanh toán có thể hủy trực tuyến trên website khi còn hơn 72 giờ trước giờ khởi hành. Đơn đã thanh toán được hỗ trợ bảo lưu hoặc đổi ngày khởi hành miễn phí 01 lần. Đội ngũ chăm sóc khách hàng trực 24/7 qua Hotline 1900 8899.";
  } else if (message.includes("tour") || message.includes("đi đâu") || message.includes("địa điểm") || message.includes("gợi ý") || message.includes("tư vấn")) {
    const sample = db.prepare("SELECT * FROM tours WHERE active = 1 ORDER BY RANDOM() LIMIT 3").all();
    suggestedTours = sample.map(publicTour);
    answer = "Delta Travel hiện có 16 hành trình du lịch 5 sao tiêu biểu khắp 3 miền: Vịnh Hạ Long, Đà Nẵng, Phú Quốc, Sa Pa, Đà Lạt và Côn Đảo với lịch khởi hành liên tục hàng tuần. Dưới đây là những hành trình được du khách đánh giá cao nhất hôm nay:";
  } else {
    const sample = db.prepare("SELECT * FROM tours WHERE active = 1 AND flash_sale = 1 LIMIT 2").all();
    suggestedTours = sample.map(publicTour);
    answer = "Chào Quý khách! Tôi là Trợ lý AI Concierge độc quyền của Delta Travel. Tôi có thể giải đáp chi tiết về giá vé, lộ trình, kinh nghiệm điểm đến và gợi ý tour trực tiếp cho bạn đặt ngay trên cuộc trò chuyện. Quý khách muốn khám phá vùng miền hay điểm đến nào?";
  }

  res.json({
    answer,
    suggestedTours,
    mode: "smart_concierge",
    source: "Delta Travel AI Database"
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
