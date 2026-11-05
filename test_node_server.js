/**
 * Test Node.js Server Endpoints
 */

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const testDbPath = path.join(os.tmpdir(), `delta-node-tests-${process.pid}.db`);
process.env.DELTA_DB_PATH = testDbPath;
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";
const { app, server, db } = require("./server");

let BASE_URL;

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = options.headers || {};
  if (options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

async function runTests() {
  await new Promise(resolve => {
    if (server.listening) resolve();
    else server.once("listening", resolve);
  });
  BASE_URL = `http://127.0.0.1:${server.address().port}`;
  console.log("\n=======================================================");
  console.log("  KIỂM THỬ MÁY CHỦ NODE.JS (EXPRESS + SQLITE)");
  console.log("=======================================================\n");

  let passed = 0;
  let total = 0;

  function assert(title, condition, extra = "") {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${title} ${extra}`);
    } else {
      console.error(`  [FAIL] ${title} ${extra}`);
    }
  }

  try {
    // 1. Health
    const h = await req("/api/v1/health/ready");
    assert("GET /api/v1/health/ready", h.status === 200 && h.json?.status === "ok");

    // 2. Static Frontend
    const idx = await req("/");
    assert("GET / (Frontend index.html)", idx.status === 200 && idx.text.includes("Delta Travel"));

    const adm = await req("/admin.html");
    assert("GET /admin.html", adm.status === 200 && adm.text.includes("modal-dialog-scrollable"));

    const admRd = await req("/admin", { redirect: "manual" });
    assert("GET /admin (307 redirect)", [301, 302, 307].includes(admRd.status));

    const favRd = await req("/favicon.ico", { redirect: "manual" });
    assert("GET /favicon.ico (307 redirect)", [301, 302, 307].includes(favRd.status));

    const favSvg = await req("/favicon.svg");
    assert("GET /favicon.svg", favSvg.status === 200);

    // 3. Tours
    const toursRes = await req("/api/v1/tours");
    assert("GET /api/v1/tours", toursRes.status === 200 && Array.isArray(toursRes.json) && toursRes.json.length > 0, `(${toursRes.json?.length} tours)`);

    const firstTour = toursRes.json[0];
    const tourOne = await req(`/api/v1/tours/${firstTour.id}`);
    assert(`GET /api/v1/tours/${firstTour.id}`, tourOne.status === 200 && tourOne.json?.id === firstTour.id);

    const scheds = await req(`/api/v1/tours/${firstTour.id}/schedules`);
    assert(`GET /api/v1/tours/${firstTour.id}/schedules`, scheds.status === 200 && scheds.json?.length > 0);
    const scheduleId = scheds.json[0].id;

    // 4. Quote
    const quoteRes = await req("/api/v1/bookings/quote", {
      method: "POST",
      body: { schedule_id: scheduleId, adults: 2, children: 1, infants: 0 }
    });
    assert("POST /api/v1/bookings/quote", quoteRes.status === 200 && quoteRes.json?.totalPrice > 0, `(${quoteRes.json?.totalPrice?.toLocaleString()} VND)`);

    // 5. Auth (Register & Login)
    const testEmail = `node_test_${Date.now()}@deltatravel.vn`;
    const testPhone = "09" + Math.floor(10000000 + Math.random() * 90000000);
    const regRes = await req("/api/v1/auth/register", {
      method: "POST",
      body: {
        full_name: "Khách Hàng Nodejs",
        email: testEmail,
        phone: testPhone,
        password: "deltaPassword123@"
      }
    });
    assert("POST /api/v1/auth/register", regRes.status === 201 && regRes.json?.email === testEmail);

    const rawCookies = regRes.headers.get("set-cookie") || "";
    const sessionMatch = rawCookies.match(/delta_session=([^;]+)/);
    const csrfMatch = rawCookies.match(/delta_csrf=([^;]+)/);
    const sessionCookie = sessionMatch ? sessionMatch[1] : "";
    const csrfToken = csrfMatch ? csrfMatch[1] : "";

    const authHeaders = {
      "Cookie": `delta_session=${sessionCookie}; delta_csrf=${csrfToken}`,
      "X-CSRF-Token": csrfToken
    };

    // 6. Me
    const meRes = await req("/api/v1/auth/me", { headers: authHeaders });
    assert("GET /api/v1/auth/me", meRes.status === 200 && meRes.json?.email === testEmail);

    // 7. Profile update
    const newPhone = "09" + Math.floor(10000000 + Math.random() * 90000000);
    const profRes = await req("/api/v1/auth/profile", {
      method: "PATCH",
      headers: authHeaders,
      body: { full_name: "Khách Hàng Vip Pro", phone: newPhone }
    });
    assert("PATCH /api/v1/auth/profile", profRes.status === 200 && profRes.json?.fullName === "Khách Hàng Vip Pro");

    // 8. Favorites
    const favAdd = await req(`/api/v1/favorites/${firstTour.id}`, { method: "POST", headers: authHeaders });
    assert(`POST /api/v1/favorites/${firstTour.id}`, favAdd.status === 200);

    const favList = await req("/api/v1/favorites", { headers: authHeaders });
    assert("GET /api/v1/favorites", favList.status === 200 && favList.json?.includes(firstTour.id));

    const favDel = await req(`/api/v1/favorites/${firstTour.id}`, { method: "DELETE", headers: authHeaders });
    assert(`DELETE /api/v1/favorites/${firstTour.id}`, favDel.status === 200);

    // 9. Booking creation
    const idemKey = crypto.randomUUID();
    const bookRes = await req("/api/v1/bookings", {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": idemKey },
      body: {
        schedule_id: scheduleId,
        adults: 2,
        children: 1,
        infants: 0,
        customer_name: "Khách Hàng Vip Pro",
        customer_phone: newPhone,
        customer_email: testEmail,
        note: "Đặt tour từ Nodejs Test"
      }
    });
    assert(
      "POST /api/v1/bookings",
      bookRes.status === 201 && bookRes.json?.id !== undefined,
      `(HTTP ${bookRes.status}; ${bookRes.json?.detail || bookRes.text})`
    );
    const bookingId = bookRes.json?.id;

    // 10. List user bookings & details
    const myBookings = await req("/api/v1/bookings", { headers: authHeaders });
    assert("GET /api/v1/bookings", myBookings.status === 200 && myBookings.json?.some(b => b.id === bookingId));

    const oneBooking = await req(`/api/v1/bookings/${bookingId}`, { headers: authHeaders });
    assert(`GET /api/v1/bookings/${bookingId}`, oneBooking.status === 200 && oneBooking.json?.id === bookingId);

    // 11. Customer pay booking
    const payRef = "VQR_NODE_" + Math.floor(10000000 + Math.random() * 90000000);
    const payRes = await req(`/api/v1/bookings/${bookingId}/pay`, {
      method: "POST",
      headers: authHeaders,
      body: { reference: payRef }
    });
    assert(`POST /api/v1/bookings/${bookingId}/pay`, payRes.status === 200 && payRes.json?.status === "PAID");

    // 12. Create & cancel 2nd booking
    const idemKey2 = crypto.randomUUID();
    const book2Res = await req("/api/v1/bookings", {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": idemKey2 },
      body: {
        schedule_id: scheduleId,
        adults: 1,
        children: 0,
        infants: 0,
        customer_name: "Khách Hàng Vip Pro",
        customer_phone: newPhone,
        customer_email: testEmail
      }
    });
    const cancelRes = await req(`/api/v1/bookings/${book2Res.json?.id}/cancel`, {
      method: "POST",
      headers: authHeaders,
      body: { reason: "Khách có lịch bận đột xuất" }
    });
    assert("POST /api/v1/bookings/:id/cancel", cancelRes.status === 200 && cancelRes.json?.status === "CANCELLED");

    // 13. Admin Flow
    const adminLoginRes = await req("/api/v1/auth/login", {
      method: "POST",
      body: { email: "admin@deltatravel.vn", password: "delta123" }
    });
    assert("POST /api/v1/auth/login (Admin)", adminLoginRes.status === 200 && adminLoginRes.json?.role === "ADMIN");

    const teamAdminLoginRes = await req("/api/v1/auth/login", {
      method: "POST",
      body: { email: "hongtham@deltatravel.vn", password: "password123" }
    });
    assert("POST /api/v1/auth/login (Admin quick-login account)",
      teamAdminLoginRes.status === 200 && teamAdminLoginRes.json?.role === "ADMIN");
    const teamAdminCookies = teamAdminLoginRes.headers.get("set-cookie") || "";
    const teamAdminSession = teamAdminCookies.match(/delta_session=([^;]+)/)?.[1] || "";
    const teamAdminCsrf = teamAdminCookies.match(/delta_csrf=([^;]+)/)?.[1] || "";
    const teamAdminTours = await req("/api/v1/admin/tours", {
      headers: {
        "Cookie": `delta_session=${teamAdminSession}; delta_csrf=${teamAdminCsrf}`,
        "X-CSRF-Token": teamAdminCsrf
      }
    });
    assert("GET /api/v1/admin/tours (Admin quick-login session)",
      teamAdminTours.status === 200 && Array.isArray(teamAdminTours.json));

    const admCookies = adminLoginRes.headers.get("set-cookie") || "";
    const admSession = admCookies.match(/delta_session=([^;]+)/)?.[1] || "";
    const admCsrf = admCookies.match(/delta_csrf=([^;]+)/)?.[1] || "";
    const adminHeaders = {
      "Cookie": `delta_session=${admSession}; delta_csrf=${admCsrf}`,
      "X-CSRF-Token": admCsrf
    };

    const metricsRes = await req("/api/v1/admin/metrics", { headers: adminHeaders });
    assert("GET /api/v1/admin/metrics", metricsRes.status === 200 && metricsRes.json?.tours > 0);

    const auditRes = await req("/api/v1/admin/audit", { headers: adminHeaders });
    assert("GET /api/v1/admin/audit", auditRes.status === 200 && Array.isArray(auditRes.json));

    const admTours = await req("/api/v1/admin/tours", { headers: adminHeaders });
    assert("GET /api/v1/admin/tours", admTours.status === 200 && admTours.json?.length > 0);

    // Admin create tour
    const newTourId = "DL-NODE" + Math.floor(10 + Math.random() * 89);
    const createTourRes = await req("/api/v1/admin/tours", {
      method: "POST",
      headers: adminHeaders,
      body: {
        id: newTourId,
        title: "Tour Node.js Test Mới",
        slug: newTourId.toLowerCase(),
        region: "central",
        duration: "3N2Đ",
        price: 3500000,
        original_price: 4500000,
        departure: "Đà Nẵng",
        transport: "Xe du lịch đời mới",
        description: "Tour khởi tạo qua Node.js Express Server"
      }
    });
    assert("POST /api/v1/admin/tours", createTourRes.status === 201 && createTourRes.json?.id === newTourId);

    // Admin patch tour
    const patchTourRes = await req(`/api/v1/admin/tours/${newTourId}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: { price: 3400000, flash_sale: true }
    });
    assert(`PATCH /api/v1/admin/tours/${newTourId}`, patchTourRes.status === 200 && patchTourRes.json?.price === 3400000);

    const replaceTourDetailsRes = await req(`/api/v1/admin/tours/${newTourId}/details`, {
      method: "PUT",
      headers: adminHeaders,
      body: {
        price: 3400000,
        cost_items: [{
          category: "transport",
          name: "Xe du lịch",
          notes: "Xe đời mới",
          amount_per_person: 450000
        }],
        itinerary: [{
          day_number: 1,
          sequence: 1,
          category: "transport",
          title: "Khởi hành",
          description: "Đón khách tại điểm hẹn",
          location: "Đà Nẵng",
          start_time: "08:00"
        }]
      }
    });
    assert(`PUT /api/v1/admin/tours/${newTourId}/details`,
      replaceTourDetailsRes.status === 200 &&
      replaceTourDetailsRes.json?.baseCost === 450000 &&
      replaceTourDetailsRes.json?.tour?.originalPrice === 4500000 &&
      replaceTourDetailsRes.json?.itinerary?.length === 1);

    const tourDetailsRes = await req(`/api/v1/admin/tours/${newTourId}/details`, {
      headers: adminHeaders
    });
    assert(`GET /api/v1/admin/tours/${newTourId}/details`,
      tourDetailsRes.status === 200 &&
      tourDetailsRes.json?.costItems?.[0]?.amountPerPerson === 450000 &&
      tourDetailsRes.json?.itinerary?.[0]?.startTime === "08:00");

    const invalidTourDetailsRes = await req(`/api/v1/admin/tours/${newTourId}/details`, {
      method: "PUT",
      headers: adminHeaders,
      body: { price: 400000, cost_items: [{ category: "transport", name: "Xe", amount_per_person: 450000 }], itinerary: [] }
    });
    assert(`PUT /api/v1/admin/tours/${newTourId}/details rejects invalid pricing`,
      invalidTourDetailsRes.status === 422);

    // Admin delete tour
    const delTourRes = await req(`/api/v1/admin/tours/${newTourId}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    assert(`DELETE /api/v1/admin/tours/${newTourId}`, delTourRes.status === 200);

    // Admin confirm payment on booking
    const admConfirmPay = await req(`/api/v1/admin/bookings/${bookingId}/confirm-payment`, {
      method: "POST",
      headers: adminHeaders,
      body: { reference: "ADM_VERIFY_" + Date.now() }
    });
    assert(`POST /api/v1/admin/bookings/${bookingId}/confirm-payment`, admConfirmPay.status === 200 && admConfirmPay.json?.status === "PAID");

    // 14. Assistant Chat
    const chatRes = await req("/api/v1/assistant/chat", {
      method: "POST",
      body: { message: "Giá tour Hạ Long bao nhiêu?" }
    });
    assert("POST /api/v1/assistant/chat", chatRes.status === 200 && chatRes.json?.answer !== undefined, `(${chatRes.json?.answer?.slice(0, 35)}...)`);

    // 15. Security 404 Guard
    const unknownRes = await req("/api/v1/non-existent-route");
    assert("GET /api/v1/unknown (404 guard)", unknownRes.status === 404 && unknownRes.json?.detail !== undefined);

  } catch (err) {
    console.error("Lỗi trong quá trình kiểm thử:", err);
  } finally {
    console.log("\n=======================================================");
    console.log(`  KẾT QUẢ: ${passed}/${total} ĐẠT (${((passed / total) * 100).toFixed(1)}%)`);
    console.log("=======================================================\n");
    await new Promise(resolve => server.close(resolve));
    db.close();
    for (const suffix of ["", "-shm", "-wal"]) {
      const file = testDbPath + suffix;
      if (fs.existsSync(file)) fs.rmSync(file);
    }
    process.exitCode = passed === total ? 0 : 1;
  }
}

// Chạy test
runTests();
