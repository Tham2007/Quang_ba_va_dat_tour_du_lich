/**
 * Bộ kiểm thử tự động tổng hợp:
 *   1. Test Lưu đơn Đặt tour & Concurrency (API + Transaction CSDL)
 *   2. Test Cơ sở dữ liệu SQL Server 12 bảng 3NF (Stored Procedures, Triggers, Constraints)
 * Vị trí: database/test database/test_luu_don_va_database.js
 * Chạy lệnh: node "database/test database/test_luu_don_va_database.js"
 */

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sql = require("mssql");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const TEST_DIR = __dirname;
const LOG_FILE = path.join(TEST_DIR, "KET_QUA_CHAY_TEST.txt");

const testDbPath = path.join(os.tmpdir(), `delta-test-suite-${process.pid}.db`);
process.env.DELTA_DB_PATH = testDbPath;
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";

const { server, db } = require(path.join(ROOT_DIR, "server.js"));

const SQLSERVER_CFG = {
  user: process.env.SQLSERVER_USER || "db_ad0b71_dattour_admin",
  password: process.env.SQLSERVER_PASSWORD || "Phamtham312007@",
  server: process.env.SQLSERVER_HOST || "sql8020.site4now.net",
  port: Number(process.env.SQLSERVER_PORT || 1433),
  database: process.env.SQLSERVER_DB || "db_ad0b71_dattour",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 12000,
  },
};

const logs = [];
function logLine(text = "") {
  console.log(text);
  logs.push(text);
}

let passed = 0;
let total = 0;
function check(code, title, ok, detail = "") {
  total++;
  if (ok) {
    passed++;
    logLine(`[PASS] ${code} | ${title}${detail ? " -> " + detail : ""}`);
  } else {
    logLine(`[FAIL] ${code} | ${title}${detail ? " -> " + detail : ""}`);
  }
}

async function apiReq(baseUrl, endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && typeof body === "object") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${endpoint}`, { ...options, headers, body });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

function getAuthHeaders(res) {
  const raw = res.headers.get("set-cookie") || "";
  const s = raw.match(/delta_session=([^;]+)/)?.[1] || "";
  const c = raw.match(/delta_csrf=([^;]+)/)?.[1] || "";
  return {
    Cookie: `delta_session=${s}; delta_csrf=${c}`,
    "X-CSRF-Token": c,
  };
}

async function runApiBookingTests() {
  await new Promise((resolve) => {
    if (server.listening) resolve();
    else server.once("listening", resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  logLine("=========================================================================");
  logLine("  PHẦN A: TEST LƯU ĐƠN ĐẶT TOUR & GIAO DỊCH ĐỒNG THỜI (API + TRANSACTION)");
  logLine(`  Endpoint Test Server: ${baseUrl}`);
  logLine("=========================================================================");

  const ts = Date.now();
  const u1Res = await apiReq(baseUrl, "/api/v1/auth/register", {
    method: "POST",
    body: {
      full_name: "Nguyễn Văn An QA",
      email: `qa1_${ts}@deltatravel.vn`,
      phone: "091" + String(ts).slice(-7),
      password: "QaPassword123@",
    },
  });
  const u1Headers = getAuthHeaders(u1Res);

  const u2Res = await apiReq(baseUrl, "/api/v1/auth/register", {
    method: "POST",
    body: {
      full_name: "Trần Thị Bình QA",
      email: `qa2_${ts}@deltatravel.vn`,
      phone: "098" + String(ts).slice(-7),
      password: "QaPassword123@",
    },
  });
  const u2Headers = getAuthHeaders(u2Res);

  const admRes = await apiReq(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    body: { email: "admin@deltatravel.vn", password: "delta123" },
  });
  const admHeaders = getAuthHeaders(admRes);

  const futureDate = new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString();
  const schedRes = await apiReq(baseUrl, "/api/v1/admin/schedules", {
    method: "POST",
    headers: admHeaders,
    body: { tour_id: "DL-HL01", departure_at: futureDate, total_seats: 4 },
  });
  const scheduleId = schedRes.json?.id;
  check("SETUP-API", "Tạo lịch khởi hành mẫu total_seats = 4", schedRes.status === 201 && Boolean(scheduleId), `scheduleId=${scheduleId}`);

  // 1. Validation 422
  const noIdem = await apiReq(baseUrl, "/api/v1/bookings", {
    method: "POST",
    headers: u1Headers,
    body: { schedule_id: scheduleId, adults: 1, customer_name: "A", customer_phone: "0912345678", customer_email: "a@b.vn" },
  });
  const missingFields = await apiReq(baseUrl, "/api/v1/bookings", {
    method: "POST",
    headers: { ...u1Headers, "Idempotency-Key": crypto.randomUUID() },
    body: { schedule_id: scheduleId, adults: 1 },
  });
  check("TC-API-VAL", "Validation từ chối thiếu Idempotency-Key / thiếu thông tin khách (422)", noIdem.status === 422 && missingFields.status === 422, `HTTP [${noIdem.status}, ${missingFields.status}]`);

  // 2. Happy Path lưu đơn + giữ 3/4 chỗ
  const idemKey = crypto.randomUUID();
  const payload = {
    schedule_id: scheduleId,
    adults: 2,
    children: 1,
    infants: 0,
    customer_name: "Nguyễn Văn An QA",
    customer_phone: "0912345678",
    customer_email: `qa1_${ts}@deltatravel.vn`,
    note: "Test lưu đơn Happy Path",
  };
  const b1 = await apiReq(baseUrl, "/api/v1/bookings", {
    method: "POST",
    headers: { ...u1Headers, "Idempotency-Key": idemKey },
    body: payload,
  });
  const sched1 = db.prepare("SELECT total_seats, reserved_seats FROM schedules WHERE id = ?").get(scheduleId);
  check(
    "TC-API-BOOK-01",
    "Lưu đơn thành công (3 chỗ trên 4 chỗ) & cập nhật reserved_seats",
    b1.status === 201 && b1.json?.status === "PENDING_PAYMENT" && sched1.reserved_seats === 3,
    `HTTP ${b1.status}, ref=${b1.json?.reference}, totalPrice=${b1.json?.totalPrice}, reserved=${sched1.reserved_seats}/${sched1.total_seats}`
  );

  // 3. Idempotency-Key chống bấm đúp
  const bDup = await apiReq(baseUrl, "/api/v1/bookings", {
    method: "POST",
    headers: { ...u1Headers, "Idempotency-Key": idemKey },
    body: payload,
  });
  const countSchedBookings = db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE schedule_id = ?").get(scheduleId).c;
  const schedDup = db.prepare("SELECT reserved_seats FROM schedules WHERE id = ?").get(scheduleId);
  check(
    "TC-API-BOOK-03",
    "Chống trùng đơn bấm đúp với cùng Idempotency-Key",
    bDup.status === 200 && bDup.json?.id === b1.json?.id && countSchedBookings === 1 && schedDup.reserved_seats === 3,
    `HTTP ${bDup.status}, id=${bDup.json?.id}, dbCount=${countSchedBookings}, reserved=${schedDup.reserved_seats}/4`
  );

  // 4. Concurrency (Promise.all) 2 khách tranh 1 chỗ cuối cùng
  const [rA, rB] = await Promise.all([
    apiReq(baseUrl, "/api/v1/bookings", {
      method: "POST",
      headers: { ...u1Headers, "Idempotency-Key": crypto.randomUUID() },
      body: { ...payload, adults: 1, children: 0 },
    }),
    apiReq(baseUrl, "/api/v1/bookings", {
      method: "POST",
      headers: { ...u2Headers, "Idempotency-Key": crypto.randomUUID() },
      body: {
        schedule_id: scheduleId,
        adults: 1,
        children: 0,
        infants: 0,
        customer_name: "Trần Thị Bình QA",
        customer_phone: "0987654321",
        customer_email: `qa2_${ts}@deltatravel.vn`,
      },
    }),
  ]);
  const raceCodes = [rA.status, rB.status].sort((a, b) => a - b);
  const schedRace = db.prepare("SELECT total_seats, reserved_seats FROM schedules WHERE id = ?").get(scheduleId);
  check(
    "TC-API-BOOK-02",
    "Concurrency (Promise.all) 2 người đặt đồng thời 1 chỗ cuối -> [201, 409]",
    raceCodes[0] === 201 && raceCodes[1] === 409 && schedRace.reserved_seats === schedRace.total_seats,
    `Status=[${raceCodes.join(", ")}], reserved=${schedRace.reserved_seats}/${schedRace.total_seats}`
  );

  // 5. Thanh toán VietQR (chưa tự đánh dấu PAID)
  const badPay = await apiReq(baseUrl, `/api/v1/bookings/${b1.json.id}/pay`, {
    method: "POST",
    headers: u1Headers,
    body: { reference: "123" },
  });
  const okPay = await apiReq(baseUrl, `/api/v1/bookings/${b1.json.id}/pay`, {
    method: "POST",
    headers: u1Headers,
    body: { reference: "VCB_VIETQR_20261111" },
  });
  check(
    "TC-API-PAY",
    "Gửi minh chứng VietQR (mã < 8 ký tự -> 422, hợp lệ -> 202 chờ đối soát)",
    badPay.status === 422 && okPay.status === 202 && okPay.json?.paymentReview === "PENDING_MANUAL_VERIFICATION" && okPay.json?.paid === false,
    `Bad=${badPay.status}, Valid=${okPay.status} (${okPay.json?.paymentReview})`
  );
}

async function runSqlBatches(pool, filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const batches = raw
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter(Boolean);

  const infoLines = [];
  const errLines = [];
  const spRows = [];

  for (let i = 0; i < batches.length; i++) {
    const req = pool.request();
    req.on("info", (info) => {
      if (info.message && !info.message.includes("=====") && !info.message.startsWith("-->")) {
        infoLines.push(info.message);
        logLine(`    [SQL PRINT] ${info.message}`);
      }
    });
    try {
      const res = await req.batch(batches[i]);
      if (res?.recordset?.length) {
        spRows.push(...res.recordset);
        logLine(`    [SQL RESULT] ${JSON.stringify(res.recordset)}`);
      }
    } catch (err) {
      const msgs = [];
      if (err.precedingErrors) {
        err.precedingErrors.forEach((pe) => msgs.push(`Msg ${pe.number}: ${pe.message}`));
      }
      msgs.push(`Msg ${err.number}: ${err.message}`);
      const combined = msgs.join(" | ");
      errLines.push(combined);
      logLine(`    [SQL TRIGGER/ERR] ${combined}`);
    }
  }
  return { infoLines, errLines, spRows };
}

async function runSqlServerTests() {
  logLine("\n=========================================================================");
  logLine("  PHẦN B: TEST LƯU ĐƠN & RÀNG BUỘC CSDL SQL SERVER (12 BẢNG 3NF)");
  logLine(`  Server: ${SQLSERVER_CFG.server}:${SQLSERVER_CFG.port} | DB: ${SQLSERVER_CFG.database}`);
  logLine("=========================================================================");

  const pool = await sql.connect(SQLSERVER_CFG);
  const countSql = `
    SELECT 'NGUOIDUNG' AS tbl, COUNT(*) AS cnt FROM dbo.NGUOIDUNG
    UNION ALL SELECT 'CHUYENKHOIHANH', COUNT(*) FROM dbo.CHUYENKHOIHANH
    UNION ALL SELECT 'DATTOUR', COUNT(*) FROM dbo.DATTOUR
    UNION ALL SELECT 'CHITIET_HANHKHACH', COUNT(*) FROM dbo.CHITIET_HANHKHACH
    UNION ALL SELECT 'THANHTOAN', COUNT(*) FROM dbo.THANHTOAN
    UNION ALL SELECT 'DANHGIA', COUNT(*) FROM dbo.DANHGIA
    UNION ALL SELECT 'AUDITLOG', COUNT(*) FROM dbo.AUDITLOG
  `;
  const before = (await pool.request().query(countSql)).recordset;

  logLine("\n--- 1. Thực thi test_luu_don_database.sql (Lưu đơn, Overbooking, Hủy hoàn chỗ, Thanh toán) ---");
  const rLuuDon = await runSqlBatches(pool, path.join(TEST_DIR, "test_luu_don_database.sql"));

  check(
    "TC-LUUDON-01",
    "SQL Server sp_api_CreateBooking + sp_api_AddPassenger + tăng SoChoDaDat + AUDITLOG",
    rLuuDon.infoLines.some((m) => m.includes("[PASS] TC-LUUDON-01"))
  );
  check(
    "TC-LUUDON-02A",
    "SQL Server sp_api_CreateBooking (UPDLOCK, HOLDLOCK) chặn thiếu chỗ -> StatusCode 400",
    rLuuDon.spRows.some((r) => r.StatusCode === 400 && r.Success === 0)
  );
  check(
    "TC-LUUDON-02B",
    "SQL Server Trigger TRG_DATTOUR_CheckAndLockSeats chặn Overbooking + ROLLBACK",
    rLuuDon.errLines.some((e) => e.includes("Msg 50000") && e.includes("Msg 3609"))
  );
  check(
    "TC-LUUDON-03",
    "SQL Server sp_api_CancelBooking + Trigger TRG_DATTOUR_HandleCancellation hoàn trả chỗ trống",
    rLuuDon.infoLines.some((m) => m.includes("[PASS] TC-LUUDON-03"))
  );
  check(
    "TC-LUUDON-04",
    "SQL Server sp_XacNhanThanhToanDonTour lưu THANHTOAN & cập nhật trạng thái đơn",
    rLuuDon.infoLines.some((m) => m.includes("[PASS] TC-LUUDON-04"))
  );

  logLine("\n--- 2. Thực thi test_database_constraints.sql (UNIQUE, CHECK, FK, Trigger Đánh giá) ---");
  const rDb = await runSqlBatches(pool, path.join(TEST_DIR, "test_database_constraints.sql"));

  check(
    "TC-DB-01",
    "SQL Server chặn trùng Email bởi UQ_NGUOIDUNG_Email (Error 2627)",
    rDb.infoLines.some((m) => m.includes("[PASS] TC-DB-01"))
  );
  check(
    "TC-DB-02",
    "SQL Server chặn SoSao = 6 bởi CK_DANHGIA_SoSao (Error 547)",
    rDb.infoLines.some((m) => m.includes("[PASS] TC-DB-02"))
  );
  check(
    "TC-DB-03",
    "SQL Server Trigger TRG_DANHGIA_CheckCompletedTour chặn đánh giá đơn chưa hoàn thành",
    rDb.errLines.some((e) => e.includes("Msg 50000") && e.includes("Msg 3609"))
  );
  check(
    "TC-DB-04A",
    "SQL Server chặn MaChuyen không tồn tại bởi FK_DATTOUR_CHUYENKHOIHANH (Error 547)",
    rDb.infoLines.some((m) => m.includes("[PASS] TC-DB-04A"))
  );
  check(
    "TC-DB-04B",
    "SQL Server chặn SoChoDaDat > SoChoToiDa bởi CK_CHUYEN_SoChoHopLe (Error 547)",
    rDb.infoLines.some((m) => m.includes("[PASS] TC-DB-04B"))
  );

  const after = (await pool.request().query(countSql)).recordset;
  const unchanged =
    before.length === after.length &&
    before.every((b, idx) => b.tbl === after[idx].tbl && b.cnt === after[idx].cnt);
  check(
    "DB-ROLLBACK-SAFE",
    "Bảo toàn 100% số dòng SQL Server trước & sau khi kiểm thử (ROLLBACK sạch)",
    unchanged,
    after.map((x) => `${x.tbl}=${x.cnt}`).join(", ")
  );

  await pool.close();
}

(async () => {
  try {
    await runApiBookingTests();
    await runSqlServerTests();
  } catch (err) {
    logLine(`[ERROR] Ngoại lệ trong quá trình chạy test: ${err.message}`);
    process.exitCode = 1;
  } finally {
    logLine("\n=========================================================================");
    logLine(`  TỔNG KẾT CHUNG: ${passed}/${total} TEST CASES ĐẠT (${total ? ((passed / total) * 100).toFixed(1) : 0}%)`);
    logLine("=========================================================================");

    fs.writeFileSync(LOG_FILE, logs.join("\n") + "\n", "utf8");
    await new Promise((resolve) => server.close(resolve));
    db.close();
    for (const suffix of ["", "-shm", "-wal"]) {
      const f = testDbPath + suffix;
      if (fs.existsSync(f)) fs.rmSync(f);
    }
    if (passed !== total) process.exitCode = 1;
  }
})();

