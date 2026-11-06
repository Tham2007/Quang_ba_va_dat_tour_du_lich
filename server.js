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

  // Đảm bảo có 6 tour thương mại chuẩn
  const tourCount = db.prepare("SELECT COUNT(*) AS count FROM tours").get().count;
  if (tourCount === 0) {
    const REMOTE = "https://raw.githubusercontent.com/Anniehatani/deltatrdelt2.0/main/assets/images/";
    const TOURS = [
      ["DL-HL01", "ha-long-lan-ha-cruise", "Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ", "north", "3N2Đ", 3890000, 4890000, 100, "halong.png", "Hà Nội (Xe Limousine đón tận nơi)", "Du thuyền 5* + Limousine VIP", 1],
      ["DL-DN02", "da-nang-hoi-an-ba-na", "Thiên Đường Miền Trung: Đà Nẵng - Cầu Vàng - Phố Cổ Hội An", "central", "4N3Đ", 4490000, 5490000, 100, "danang.png", "TP. Hồ Chí Minh / Hà Nội (Vé máy bay)", "Máy bay khứ hồi + Xe du lịch đời mới", 1],
      ["DL-PQ03", "phu-quoc-hon-thom-grand-world", "Đảo Ngọc Phú Quốc - Cáp Treo Hòn Thơm - Grand World Không Ngủ", "south", "3N2Đ", 4690000, 5990000, 100, "phuquoc.png", "TP. Hồ Chí Minh / Hà Nội (Vé máy bay)", "Vé máy bay + Cano vượt biển + Xe VIP", 1],
      ["DL-DL04", "da-lat-tuyen-lam-cau-dat", "Thành Phố Ngàn Hoa: Đà Lạt - Hồ Tuyền Lâm - Săn Mây Cầu Đất", "central", "3N2Đ", 2590000, 3200000, 100, "dalat.png", "TP. Hồ Chí Minh / Hà Nội", "Xe Limousine phòng nằm cao cấp", 0],
      ["DL-SP05", "sapa-fansipan-cat-cat", "Sa Pa Mờ Sương - Chinh Phục Đỉnh Fansipan - Bản Cát Cát", "north", "3N2Đ", 3190000, 3990000, 100, "sapa.png", "Hà Nội (Xe Cabin Tình Yêu)", "Xe Cabin cao cấp + Tàu hỏa Mường Hoa", 0],
      ["DL-MT06", "mien-tay-cai-rang-tra-su", "Sông Nước Miền Tây: Cần Thơ - Chợ Nổi Cái Răng - Rừng Tràm Trà Sư", "south", "2N1Đ", 1690000, 2190000, 100, "mientay.png", "TP. Hồ Chí Minh", "Xe du lịch máy lạnh + Xuồng ba lá", 0]
    ];

    const insertTour = db.prepare(`
      INSERT INTO tours (id, slug, title, region, duration, price, original_price, image, departure, transport, flash_sale, description, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Tour du lịch chất lượng cao, trọn gói dịch vụ tiêu chuẩn Delta Travel.', 1)
    `);

    const insertSchedule = db.prepare(`
      INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
      VALUES (?, ?, ?, ?, 0, 1)
    `);

    TOURS.forEach((t, i) => {
      insertTour.run(t[0], t[1], t[2], t[3], t[4], t[5], t[6], REMOTE + t[8], t[9], t[10], t[11]);
      [14 + i, 30 + i, 45 + i].forEach(days => {
        const d = new Date(Date.now() + days * 24 * 3600 * 1000);
        d.setUTCHours(2, 0, 0, 0);
        insertSchedule.run(crypto.randomUUID(), t[0], d.toISOString(), t[7]);
      });
    });
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

function publicTour(t) {
  const images = tourImages(t.image);
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
    description: t.description || "",
    price: Number(t.price),
    originalPrice: Number(t.original_price),
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
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
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
app.use(express.json());

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
  if (process.env.THAM_SQLSERVER_CATALOG_API_URL) {
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
  const { full_name, phone } = req.body || {};
  if (phone && !/^0[35789]\d{8}$/.test(phone)) {
    return res.status(422).json({ detail: "Số điện thoại không hợp lệ." });
  }
  if (phone) {
    const dup = db.prepare("SELECT id FROM users WHERE phone = ? AND id != ?").get(phone, req.user.id);
    if (dup) return res.status(409).json({ detail: "Số điện thoại đã được dùng." });
  }

  const newName = full_name ? full_name.trim() : req.user.full_name;
  const newPhone = phone ? phone.trim() : req.user.phone;

  db.prepare(`
    UPDATE users SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?
  `).run(newName, newPhone, new Date().toISOString(), req.user.id);

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

app.post("/api/v1/bookings", requireAuth, (req, res) => {
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
  const tours = db.prepare("SELECT * FROM tours ORDER BY id ASC").all();
  res.json(tours.map(t => ({
    ...publicTour(t),
    active: Boolean(t.active)
  })));
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
    images: "image"
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

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
    VALUES (?, ?, ?, ?, 0, 1)
  `).run(id, tour_id, new Date(departure_at).toISOString(), total_seats);

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

// 7. AI Assistant
app.post("/api/v1/assistant/chat", (req, res) => {
  const message = ((req.body && req.body.message) || "").toLowerCase();
  let answer = "";
  if (message.includes("giá") || message.includes("bao nhiêu") || message.includes("price")) {
    const sample = db.prepare("SELECT title, price FROM tours WHERE active = 1 ORDER BY price ASC LIMIT 6").all();
    answer = "Giá niêm yết hiện tại: " + sample.map(t => `${t.title}: ${Number(t.price).toLocaleString("vi-VN")} VND`).join("; ") + ". Quý khách có thể kiểm tra lịch và đặt tour trực tuyến trực tiếp trên hệ thống.";
  } else if (message.includes("hủy") || message.includes("hoàn tiền") || message.includes("cancel")) {
    answer = "Đơn chưa thanh toán có thể hủy trực tuyến trên website khi còn hơn 72 giờ trước giờ khởi hành. Đơn đã thanh toán sẽ được bộ phận chăm sóc khách hàng hỗ trợ đối soát nhanh chóng.";
  } else if (message.includes("tour") || message.includes("đi đâu") || message.includes("địa điểm")) {
    answer = "Delta Travel hiện có các hành trình tiêu biểu: Hạ Long, Đà Nẵng, Phú Quốc, Đà Lạt, Sa Pa và Miền Tây với lịch khởi hành liên tục hàng tuần.";
  } else {
    answer = "Tôi có thể hỗ trợ thông tin tour, lịch trình, giá vé và chính sách hoàn hủy của Delta Travel. Quý khách vui lòng cho biết câu hỏi cụ thể.";
  }

  res.json({
    answer,
    mode: "rule_based",
    source: "Delta Travel local database/policy"
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

if (!fs.existsSync(FRONTEND_DIR)) {
  console.error("Lỗi: Không tìm thấy thư mục Frontend tại", FRONTEND_DIR);
} else {
  app.use("/an-live", express.static(FRONTEND_DIR));
  app.use(express.static(FRONTEND_DIR));
}

// Khởi động Server
const server = app.listen(PORT, HOST, () => {
  const port = server.address().port;
  console.log("==================================================================");
  console.log(`  DELTA TRAVEL 2.0 (NODE.JS SERVER) ĐANG CHẠY`);
  console.log(`  Trang chủ đặt tour:  http://${HOST}:${port}/`);
  console.log(`  Cổng quản trị Admin: http://${HOST}:${port}/admin.html`);
  console.log(`  Kiểm tra hệ thống:  http://${HOST}:${port}/api/v1/health/ready`);
  console.log("==================================================================");
});

module.exports = { app, server, db };
