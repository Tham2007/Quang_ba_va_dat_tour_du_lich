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
const { app, server, db, setSqlServerTestConnection, setMailTransportForTest } = require("./server");

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
  const previousCatalogUrl = process.env.THAM_SQLSERVER_CATALOG_API_URL;
  let catalogMockServer;

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
    assert(`POST /api/v1/bookings/${bookingId}/pay requires bank review`,
    payRes.status === 202 && payRes.json?.paymentReview === "PENDING_MANUAL_VERIFICATION" &&
    payRes.json?.status !== "PAID");

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
      body: {
        price: 3400000,
        flash_sale: true,
        images: ["https://example.com/tour-cover.jpg", "https://example.com/tour-gallery.jpg"]
      }
    });
    assert(`PATCH /api/v1/admin/tours/${newTourId}`,
      patchTourRes.status === 200 &&
      patchTourRes.json?.price === 3400000 &&
      patchTourRes.json?.image === "https://example.com/tour-cover.jpg" &&
      patchTourRes.json?.images?.length === 2);

    const invalidTourPatchRes = await req(`/api/v1/admin/tours/${newTourId}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: { unknown_column: "invalid" }
    });
    assert(`PATCH /api/v1/admin/tours/${newTourId} rejects unsupported fields`,
      invalidTourPatchRes.status === 422);

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
    const publicToursAfterDeleteRes = await req("/api/v1/tours");
    const adminToursAfterDeleteRes = await req("/api/v1/admin/tours", { headers: adminHeaders });
    const deletedTourAdminRecord = adminToursAfterDeleteRes.json?.find(tour => tour.id === newTourId);
    assert(`DELETE /api/v1/admin/tours/${newTourId}`,
      delTourRes.status === 200 &&
      !publicToursAfterDeleteRes.json?.some(tour => tour.id === newTourId) &&
      deletedTourAdminRecord?.active === false);

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

    // =========================================================================
    // KIỂM THỬ 7 LỖI HỆ THỐNG MỚI ĐƯỢC KHẮC PHỤC
    // =========================================================================

    // Bug 1: Cập nhật và đồng bộ số chỗ mở bán giữa Admin và Khách hàng
    const patchSeats = await req("/api/v1/admin/tours/DL-CB09", {
      method: "PATCH",
      headers: adminHeaders,
      body: { available_seats: 38 }
    });
    const adminToursAfterPatch = await req("/api/v1/admin/tours", { headers: adminHeaders });
    const customerToursAfterPatch = await req("/api/v1/tours");
    const adminTourCB09 = adminToursAfterPatch.json?.find(t => t.id === "DL-CB09");
    const customerTourCB09 = customerToursAfterPatch.json?.find(t => t.id === "DL-CB09");
    assert("Bug 1: Đồng bộ số chỗ mở bán (Admin & Khách hàng)",
      patchSeats.status === 200 &&
      adminTourCB09?.availableSeats === 38 &&
      customerTourCB09?.availableSeats === 38 &&
      adminTourCB09?.availableSeats === customerTourCB09?.availableSeats,
      `Admin: ${adminTourCB09?.availableSeats}, Customer: ${customerTourCB09?.availableSeats}`);

    // Bug 2: Chặn thêm lịch khởi hành có ngày ở quá khứ
    const pastSchedule = await req("/api/v1/admin/schedules", {
      method: "POST",
      headers: adminHeaders,
      body: { tour_id: "DL-CB09", departure_at: "2026-11-05T08:00:00Z", total_seats: 25 }
    });
    assert("Bug 2: Chặn ngày khởi hành ở quá khứ (HTTP 422)",
      pastSchedule.status === 422 && pastSchedule.json?.detail?.includes("quá khứ"),
      `Status: ${pastSchedule.status}`);

    // Bug 3: Thêm lịch khởi hành hợp lệ thành công và hiển thị đồng bộ
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);
    const validSchedule = await req("/api/v1/admin/schedules", {
      method: "POST",
      headers: adminHeaders,
      body: { tour_id: "DL-CB09", departure_at: futureDate.toISOString(), total_seats: 28 }
    });
    const adminScheds = await req("/api/v1/admin/schedules", { headers: adminHeaders });
    const custScheds = await req("/api/v1/tours/DL-CB09/schedules");
    const addedId = validSchedule.json?.id;
    assert("Bug 3: Thêm lịch khởi hành hợp lệ & đồng bộ tức thì",
      validSchedule.status === 201 &&
      adminScheds.json?.some(s => s.id === addedId) &&
      custScheds.json?.some(s => s.id === addedId),
      `Schedule ID: ${addedId}`);

    // Bug 6a: AI Concierge từ chối câu hỏi không liên quan đến du lịch
    const aiOffTopic = await req("/api/v1/assistant/chat", {
      method: "POST",
      body: { message: "cách có người yêu" }
    });
    assert("Bug 6a: AI từ chối câu hỏi ngoài phạm vi (cách có người yêu)",
      aiOffTopic.status === 200 &&
      aiOffTopic.json?.suggestedTours?.length === 0 &&
      aiOffTopic.json?.answer?.includes("Trợ lý AI Concierge") &&
      aiOffTopic.json?.answer?.includes("không thể tư vấn"));

    // Bug 6b: AI Concierge nhận diện chính xác 1 tour duy nhất khi được hỏi cụ thể
    const aiSpecific = await req("/api/v1/assistant/chat", {
      method: "POST",
      body: { message: "tour vịnh hạ long giá bao nhiêu và có du thuyền không?" }
    });
    assert("Bug 6b: AI chỉ tư vấn chính xác 1 tour được hỏi (Vịnh Hạ Long)",
      aiSpecific.status === 200 &&
      aiSpecific.json?.suggestedTours?.length === 1 &&
      aiSpecific.json?.suggestedTours?.[0]?.title?.includes("Hạ Long"));

    // Bug 7: Lọc tour theo điểm đến độc lập (Đà Nẵng / đà nẵng)
    const filterDaNang1 = await req("/api/v1/tours?destination=" + encodeURIComponent("Đà Nẵng"));
    const filterDaNang2 = await req("/api/v1/tours?destination=" + encodeURIComponent("da nang"));
    assert("Bug 7: Bộ lọc điểm đến Đà Nẵng độc lập (có dấu & không dấu)",
      filterDaNang1.status === 200 && filterDaNang1.json?.length > 0 &&
      filterDaNang2.status === 200 && filterDaNang2.json?.length > 0 &&
      filterDaNang1.json?.[0]?.title?.includes("Đà Nẵng"));

    // Sync Test 1: Admin tạo tour đầy đủ -> Public API + Itinerary + Auto Schedule + Toggle Active
    const syncTourId = "DL-SYNC" + Math.floor(10 + Math.random() * 89);
    const syncCreateRes = await req("/api/v1/admin/tours", {
      method: "POST",
      headers: adminHeaders,
      body: {
        id: syncTourId,
        title: "Tour Đồng Bộ Đà Lạt 3N2Đ",
        region: "central",
        duration: "3N2Đ",
        price: 3990000,
        original_price: 4990000,
        departure: "TP. Hồ Chí Minh",
        transport: "Xe Limousine VIP",
        badge: "SIÊU HOT",
        images: ["assets/images/dalat.png", "assets/images/sapa.png"],
        inclusions: ["Xe Limousine VIP", "Khách sạn 4 sao"],
        exclusions: ["Chi phí cá nhân"],
        terms: ["Hủy trước 10 ngày miễn phí"],
        itinerary: [
          { day: 1, title: "Khởi hành Đà Lạt", morning: "Đón khách", afternoon: "Thác Datanla", evening: "Chợ đêm" },
          { day: 2, title: "Săn mây & Trở về", morning: "Săn mây Cầu Đất", afternoon: "Mua đặc sản", evening: "Trả khách" }
        ]
      }
    });
    const publicSyncTour = await req(`/api/v1/tours/${syncTourId}`);
    const publicSyncItinFallback = await req(`/api/v1/tours/${syncTourId}/itinerary`);
    const publicSyncSchedules = await req(`/api/v1/tours/${syncTourId}/schedules`);
    assert("Sync 1a: Admin POST tour đầy đủ đồng bộ sang Public API & tự tạo lịch mở bán",
      syncCreateRes.status === 201 &&
      publicSyncTour.status === 200 &&
      publicSyncTour.json?.badge === "SIÊU HOT" &&
      publicSyncTour.json?.images?.length === 2 &&
      publicSyncTour.json?.inclusions?.[0] === "Xe Limousine VIP" &&
      publicSyncTour.json?.exclusions?.[0] === "Chi phí cá nhân" &&
      publicSyncTour.json?.terms?.[0] === "Hủy trước 10 ngày miễn phí" &&
      publicSyncTour.json?.itinerary?.length === 2 &&
      publicSyncTour.json?.itinerary?.[1]?.title === "Săn mây & Trở về" &&
      publicSyncItinFallback.status === 200 &&
      publicSyncItinFallback.json?.length === 6 &&
      publicSyncSchedules.status === 200 &&
      publicSyncSchedules.json?.length >= 1);

    // Sync Test 1b: PUT /details cập nhật itinerary_items -> Public tour.itinerary & /itinerary cập nhật
    const syncDetailsRes = await req(`/api/v1/admin/tours/${syncTourId}/details`, {
      method: "PUT",
      headers: adminHeaders,
      body: {
        price: 3990000,
        cost_items: [{ category: "accommodation", name: "Khách sạn 4*", amount_per_person: 800000 }],
        itinerary: [
          { day_number: 1, sequence: 1, category: "transport", title: "Ngày 1 - Đón khách", description: "Xe đón đoàn", start_time: "07:00" },
          { day_number: 2, sequence: 1, category: "activity", title: "Ngày 2 - Săn mây", description: "Đồi chè Cầu Đất", start_time: "05:30" },
          { day_number: 3, sequence: 1, category: "meal", title: "Ngày 3 - Tạm biệt", description: "Ăn trưa & về lại TP", start_time: "11:30" }
        ]
      }
    });
    const publicTourAfterDetails = await req(`/api/v1/tours/${syncTourId}`);
    const publicItinStructured = await req(`/api/v1/tours/${syncTourId}/itinerary`);
    assert("Sync 1b: Admin PUT details đồng bộ lịch trình 3 ngày ra Public API",
      syncDetailsRes.status === 200 &&
      publicTourAfterDetails.status === 200 &&
      publicTourAfterDetails.json?.itinerary?.length === 3 &&
      publicItinStructured.status === 200 &&
      publicItinStructured.json?.length === 3 &&
      publicItinStructured.json?.[1]?.category === "activity");

    // Sync Test 1c: Ẩn tour (active = false) -> Public 404; Mở lại (active = true) -> Public 200
    const hideTourRes = await req(`/api/v1/admin/tours/${syncTourId}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: { active: false }
    });
    const hiddenPublicRes = await req(`/api/v1/tours/${syncTourId}`);
    const restoreTourRes = await req(`/api/v1/admin/tours/${syncTourId}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: { active: true }
    });
    const restoredPublicRes = await req(`/api/v1/tours/${syncTourId}`);
    assert("Sync 1c: Admin ẩn/hiện tour đồng bộ ngay lập tức trên Public API",
      hideTourRes.status === 200 &&
      hiddenPublicRes.status === 404 &&
      restoreTourRes.status === 200 &&
      restoredPublicRes.status === 200);

    // Sync Test 2: Admin PATCH schedule đổi ngày khởi hành & số chỗ + đóng/mở lịch
    const targetSchedId = publicSyncSchedules.json?.[0]?.id;
    const nextDepartureIso = new Date(Date.now() + 25 * 86400000).toISOString();
    const patchSchedRes = await req(`/api/v1/admin/schedules/${targetSchedId}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: {
        departure_at: nextDepartureIso,
        total_seats: 30,
        available_seats: 28,
        status: "OPEN"
      }
    });
    const publicSchedsAfterPatch = await req(`/api/v1/tours/${syncTourId}/schedules`);
    assert("Sync 2a: Admin PATCH schedule cập nhật ngày khởi hành & số chỗ ra Public",
      patchSchedRes.status === 200 &&
      publicSchedsAfterPatch.status === 200 &&
      publicSchedsAfterPatch.json?.[0]?.departureAt === nextDepartureIso &&
      publicSchedsAfterPatch.json?.[0]?.totalSeats === 30 &&
      publicSchedsAfterPatch.json?.[0]?.availableSeats === 28);

    // Sync Test 3: Đặt đơn -> Admin CONFIRMED -> Admin CANCELLED hoàn chỗ tự động
    const syncBookRes = await req("/api/v1/bookings", {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": crypto.randomUUID() },
      body: {
        schedule_id: targetSchedId,
        adults: 2,
        children: 0,
        infants: 0,
        customer_name: "Khách Đồng Bộ",
        customer_phone: newPhone,
        customer_email: testEmail
      }
    });
    const syncBookingId = syncBookRes.json?.id;
    const schedAfterBook = await req(`/api/v1/tours/${syncTourId}/schedules`);
    const confirmBookRes = await req(`/api/v1/admin/bookings/${syncBookingId}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: { status: "CONFIRMED" }
    });
    const cancelBookAdminRes = await req(`/api/v1/admin/bookings/${syncBookingId}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: { status: "CANCELLED", reason: "Khách đổi lịch bay" }
    });
    const customerBookAfterCancel = await req(`/api/v1/bookings/${syncBookingId}`, { headers: authHeaders });
    const schedAfterAdminCancel = await req(`/api/v1/tours/${syncTourId}/schedules`);
    assert("Sync 3: Admin duyệt & hủy đơn cập nhật khách hàng và hoàn lại chỗ trên lịch",
      syncBookRes.status === 201 &&
      schedAfterBook.json?.[0]?.availableSeats === 26 &&
      confirmBookRes.status === 200 &&
      confirmBookRes.json?.status === "CONFIRMED" &&
      cancelBookAdminRes.status === 200 &&
      cancelBookAdminRes.json?.status === "CANCELLED" &&
      customerBookAfterCancel.json?.status === "CANCELLED" &&
      schedAfterAdminCancel.json?.[0]?.availableSeats === 28);

    // Sync Test 2b: Đóng lịch khởi hành -> Public schedules ẩn lịch đó
    const closeSchedRes = await req(`/api/v1/admin/schedules/${targetSchedId}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: { status: "CLOSED" }
    });
    const publicSchedsClosed = await req(`/api/v1/tours/${syncTourId}/schedules`);
    assert("Sync 2b: Admin đóng lịch khởi hành -> Public schedules không hiển thị lịch CLOSED",
      closeSchedRes.status === 200 &&
      publicSchedsClosed.status === 200 &&
      publicSchedsClosed.json?.length === 0);

    // =========================================================================
    // VOUCHER / PROMO CODE TESTS (ĐẦY ĐỦ NGHIỆP VỤ & BẢO MẬT BACKEND)
    // =========================================================================
    const hlScheds = await req("/api/v1/tours/DL-HL01/schedules");
    const dnScheds = await req("/api/v1/tours/DL-DN02/schedules");
    const mcScheds = await req("/api/v1/tours/DL-MC10/schedules");
    const hlSchedId = hlScheds.json?.[0]?.id;
    const dnSchedId = dnScheds.json?.[0]?.id;
    const mcSchedId = mcScheds.json?.[0]?.id;

    // 1. Seeded vouchers check: DELTA10 (chỉ Miền Bắc), HE2026 (chỉ tour biển đảo chỉ định)
    const vDeltaNorth = await req("/api/v1/vouchers/validate", {
      method: "POST",
      headers: authHeaders,
      body: { code: "DELTA10", tour_id: "DL-HL01", adults: 1 }
    });
    const vDeltaCentral = await req("/api/v1/vouchers/validate", {
      method: "POST",
      headers: authHeaders,
      body: { code: "DELTA10", tour_id: "DL-DN02", adults: 1 }
    });
    const vHeWrongTour = await req("/api/v1/vouchers/validate", {
      method: "POST",
      headers: authHeaders,
      body: { code: "HE2026", tour_id: "DL-HL01", adults: 1 }
    });
    const vHeRightTour = await req("/api/v1/vouchers/validate", {
      method: "POST",
      headers: authHeaders,
      body: { code: "HE2026", tour_id: "DL-DN02", adults: 1 }
    });
    assert("Voucher 1: Phạm vi khu vực & tour cụ thể (đúng tour/sai tour)",
      vDeltaNorth.status === 200 && vDeltaNorth.json?.valid === true && vDeltaNorth.json?.discountAmount === 389000 &&
      vDeltaCentral.status === 422 && vDeltaCentral.json?.errorCode === "VOUCHER_WRONG_SCOPE" &&
      vHeWrongTour.status === 422 && vHeWrongTour.json?.errorCode === "VOUCHER_WRONG_TOUR" &&
      vHeRightTour.status === 200 && vHeRightTour.json?.valid === true && vHeRightTour.json?.discountAmount === 500000);

    // 2. Tạo mã % có trần max_discount, chưa đến hạn, đã hết hạn, ngừng hoạt động, đơn tối thiểu
    const nowMs = Date.now();
    const createPctCap = await req("/api/v1/admin/vouchers", {
      method: "POST",
      headers: adminHeaders,
      body: {
        code: "CAP500K",
        name: "Giảm 50% tối đa 500K cho DL-HL01",
        discount_type: "percent",
        discount_value: 50,
        max_discount: 500000,
        min_order_value: 3000000,
        scope_type: "tours",
        scope_tour_ids: ["DL-HL01"],
        start_at: new Date(nowMs - 86400000).toISOString(),
        end_at: new Date(nowMs + 7 * 86400000).toISOString(),
        usage_limit: 10,
        per_user_limit: 1,
        target_audience: "all",
        active: true
      }
    });
    const valPctCap = await req("/api/v1/vouchers/validate", {
      method: "POST",
      body: { code: "CAP500K", tour_id: "DL-HL01", adults: 1 }
    });
    const valLowMin = await req("/api/v1/vouchers/validate", {
      method: "POST",
      headers: adminHeaders,
      body: { code: "VIPTOUR", tour_id: "DL-HL01", adults: 1 }
    });

    await req("/api/v1/admin/vouchers", {
      method: "POST",
      headers: adminHeaders,
      body: {
        code: "FUTURE2027",
        name: "Mã tương lai",
        discount_type: "fixed",
        discount_value: 100000,
        scope_type: "all",
        start_at: new Date(nowMs + 5 * 86400000).toISOString(),
        end_at: new Date(nowMs + 20 * 86400000).toISOString(),
        usage_limit: 10,
        active: true
      }
    });
    const valFuture = await req("/api/v1/vouchers/validate", {
      method: "POST",
      body: { code: "FUTURE2027", tour_id: "DL-HL01", adults: 1 }
    });

    await req("/api/v1/admin/vouchers", {
      method: "POST",
      headers: adminHeaders,
      body: {
        code: "EXPIRED2020",
        name: "Mã hết hạn",
        discount_type: "fixed",
        discount_value: 100000,
        scope_type: "all",
        start_at: new Date(nowMs - 10 * 86400000).toISOString(),
        end_at: new Date(nowMs - 1 * 86400000).toISOString(),
        usage_limit: 10,
        active: true
      }
    });
    const valExpired = await req("/api/v1/vouchers/validate", {
      method: "POST",
      body: { code: "EXPIRED2020", tour_id: "DL-HL01", adults: 1 }
    });

    const inactiveCreate = await req("/api/v1/admin/vouchers", {
      method: "POST",
      headers: adminHeaders,
      body: {
        code: "PAUSED10",
        name: "Mã tạm ngừng",
        discount_type: "fixed",
        discount_value: 100000,
        scope_type: "all",
        start_at: new Date(nowMs - 86400000).toISOString(),
        end_at: new Date(nowMs + 10 * 86400000).toISOString(),
        active: false
      }
    });
    const valInactive = await req("/api/v1/vouchers/validate", {
      method: "POST",
      body: { code: "PAUSED10", tour_id: "DL-HL01", adults: 1 }
    });
    const valNotExist = await req("/api/v1/vouchers/validate", {
      method: "POST",
      body: { code: "KHONGTONTAI99", tour_id: "DL-HL01", adults: 1 }
    });
    assert("Voucher 2: Phần trăm có trần max_discount, minOrder, chưa tới hạn, hết hạn, tạm ngừng, không tồn tại",
      createPctCap.status === 201 &&
      valPctCap.status === 200 && valPctCap.json?.discountAmount === 500000 && valPctCap.json?.totalPrice === 3390000 &&
      valLowMin.status === 422 && valLowMin.json?.errorCode === "VOUCHER_MIN_ORDER" &&
      valFuture.status === 422 && valFuture.json?.errorCode === "VOUCHER_NOT_STARTED" &&
      valExpired.status === 422 && valExpired.json?.errorCode === "VOUCHER_EXPIRED" &&
      inactiveCreate.status === 201 && valInactive.status === 422 && valInactive.json?.errorCode === "VOUCHER_INACTIVE" &&
      valNotExist.status === 422 && valNotExist.json?.errorCode === "VOUCHER_NOT_FOUND",
      `cap=${createPctCap.status}/${valPctCap.json?.discountAmount} lowMin=${valLowMin.status}/${valLowMin.json?.errorCode} fut=${valFuture.json?.errorCode} exp=${valExpired.json?.errorCode} inact=${inactiveCreate.status}/${valInactive.json?.errorCode} no=${valNotExist.json?.errorCode}`);

    // 3. Mã cố định lớn hơn giá đơn -> tổng tiền thanh toán = 0 (không âm) & chống client giả mạo số tiền giảm
    await req("/api/v1/admin/vouchers", {
      method: "POST",
      headers: adminHeaders,
      body: {
        code: "FREEALL",
        name: "Giảm cố định cực lớn",
        discount_type: "fixed",
        discount_value: 5000000,
        scope_type: "tours",
        scope_tour_ids: ["DL-MC10"],
        start_at: new Date(nowMs - 86400000).toISOString(),
        end_at: new Date(nowMs + 10 * 86400000).toISOString(),
        usage_limit: 5,
        per_user_limit: 0,
        active: true
      }
    });
    const quoteFree = await req("/api/v1/bookings/quote", {
      method: "POST",
      body: { schedule_id: mcSchedId, adults: 1, voucher_code: "FREEALL" }
    });
    const spoofedBook = await req("/api/v1/bookings", {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": crypto.randomUUID() },
      body: {
        schedule_id: hlSchedId,
        adults: 1,
        customer_name: "Khách Giả Mạo Giá",
        customer_phone: newPhone,
        customer_email: testEmail,
        discount_amount: 3800000,
        total_price: 90000
      }
    });
    assert("Voucher 3: Tổng tiền không âm (<0) và Backend bỏ qua mọi discount_amount/total_price giả mạo từ Frontend",
      quoteFree.status === 200 && quoteFree.json?.discountAmount === 1590000 && quoteFree.json?.totalPrice === 0 &&
      spoofedBook.status === 201 && spoofedBook.json?.discountAmount === 0 && spoofedBook.json?.totalPrice === 4279000,
      `quote=${quoteFree.status}:${quoteFree.json?.discountAmount}/${quoteFree.json?.totalPrice}:${quoteFree.json?.detail} spoof=${spoofedBook.status}:${spoofedBook.json?.discountAmount}/${spoofedBook.json?.totalPrice}:${spoofedBook.json?.detail}`);

    // 4. Đặt đơn với CAP500K -> dùng lại lần 2 bị chặn (per_user_limit: 1) -> hủy đơn hoàn lại lượt & dùng lại thành công!
    const bookCap1 = await req("/api/v1/bookings", {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": crypto.randomUUID() },
      body: {
        schedule_id: hlSchedId,
        adults: 1,
        customer_name: "Khách Dùng Mã",
        customer_phone: newPhone,
        customer_email: testEmail,
        voucher_code: "CAP500K",
        discount_amount: 9999999
      }
    });
    const bookCap2Reuse = await req("/api/v1/bookings", {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": crypto.randomUUID() },
      body: {
        schedule_id: hlSchedId,
        adults: 1,
        customer_name: "Khách Dùng Mã",
        customer_phone: newPhone,
        customer_email: testEmail,
        voucher_code: "CAP500K"
      }
    });
    await req(`/api/v1/bookings/${bookCap1.json?.id}/cancel`, {
      method: "POST",
      headers: authHeaders,
      body: { reason: "Kiểm tra hoàn lượt voucher" }
    });
    const bookCap3AfterCancel = await req("/api/v1/bookings", {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": crypto.randomUUID() },
      body: {
        schedule_id: hlSchedId,
        adults: 1,
        customer_name: "Khách Dùng Mã",
        customer_phone: newPhone,
        customer_email: testEmail,
        voucher_code: "CAP500K"
      }
    });
    assert("Voucher 4: Giới hạn lượt dùng/khách hàng & hoàn lại lượt khi hủy đơn",
      bookCap1.status === 201 && bookCap1.json?.discountAmount === 500000 && bookCap1.json?.totalPrice === 3729000 &&
      bookCap2Reuse.status === 422 && bookCap2Reuse.json?.errorCode === "VOUCHER_USER_LIMIT_REACHED" &&
      bookCap3AfterCancel.status === 201 && bookCap3AfterCancel.json?.discountAmount === 500000);

    // 5. Đối tượng áp dụng (logged_in vs new_customer) & Race condition usage_limit = 1
    const valVipGuest = await req("/api/v1/vouchers/validate", {
      method: "POST",
      body: { code: "VIPTOUR", tour_id: "DL-HL01", adults: 2 }
    });
    const valVipLogged = await req("/api/v1/vouchers/validate", {
      method: "POST",
      headers: authHeaders,
      body: { code: "VIPTOUR", tour_id: "DL-HL01", adults: 2 }
    });
    const valBanMoiExistingUser = await req("/api/v1/vouchers/validate", {
      method: "POST",
      headers: authHeaders,
      body: { code: "BANMOI", tour_id: "DL-HL01", adults: 1 }
    });

    const raceVoucherRes = await req("/api/v1/admin/vouchers", {
      method: "POST",
      headers: adminHeaders,
      body: {
        code: "ONEONLY",
        name: "Chỉ đúng 1 lượt duy nhất",
        discount_type: "fixed",
        discount_value: 250000,
        scope_type: "all",
        start_at: new Date(nowMs - 86400000).toISOString(),
        end_at: new Date(nowMs + 10 * 86400000).toISOString(),
        usage_limit: 1,
        per_user_limit: 0,
        active: true
      }
    });
    const [raceA, raceB] = await Promise.all([
      req("/api/v1/bookings", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: {
          schedule_id: dnSchedId,
          adults: 1,
          customer_name: "Race Guest A",
          customer_phone: "0911000111",
          customer_email: `race_a_${Date.now()}@test.local`,
          voucher_code: "ONEONLY"
        }
      }),
      req("/api/v1/bookings", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: {
          schedule_id: dnSchedId,
          adults: 1,
          customer_name: "Race Guest B",
          customer_phone: "0911000222",
          customer_email: `race_b_${Date.now()}@test.local`,
          voucher_code: "ONEONLY"
        }
      })
    ]);
    const raceSuccessCount = [raceA, raceB].filter(r => r.status === 201).length;
    const raceFailCount = [raceA, raceB].filter(r => r.status === 409 || r.status === 422).length;
    const adminVouchersAfter = await req("/api/v1/admin/vouchers", { headers: adminHeaders });
    const oneOnlyAfter = (adminVouchersAfter.json || []).find(v => v.code === "ONEONLY");
    const delVoucherRes = await req(`/api/v1/admin/vouchers/${raceVoucherRes.json?.id}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    assert("Voucher 5: Đối tượng áp dụng (logged_in/new_customer), chống race-condition vượt lượt & Admin thống kê/xóa mã",
      valVipGuest.status === 422 && valVipGuest.json?.errorCode === "VOUCHER_LOGIN_REQUIRED" &&
      valVipLogged.status === 200 && valVipLogged.json?.discountAmount === Math.round(7780000 * 0.15) &&
      valBanMoiExistingUser.status === 422 && valBanMoiExistingUser.json?.errorCode === "VOUCHER_NEW_CUSTOMER_ONLY" &&
      raceSuccessCount === 1 && raceFailCount === 1 &&
      oneOnlyAfter?.usedCount === 1 && oneOnlyAfter?.stats?.totalDiscountGranted === 250000 &&
      delVoucherRes.status === 200,
      `vipG=${valVipGuest.json?.errorCode} vipL=${valVipLogged.status}:${valVipLogged.json?.discountAmount} banmoi=${valBanMoiExistingUser.json?.errorCode} race=${raceSuccessCount}/${raceFailCount}(${raceA.status}:${raceA.json?.detail}|${raceB.status}:${raceB.json?.detail}) used=${oneOnlyAfter?.usedCount} stats=${JSON.stringify(oneOnlyAfter?.stats)} del=${delVoucherRes.status}`);

    // Test chế độ SQL Server trực tiếp bảo toàn đúng 12 bảng (dbo.AUDITLOG: VOUCHER_DEF & VOUCHER_USE)
    const ssAuditRows = [{
      MaLog: 1,
      MaNguoiThucHien: null,
      HanhDong: "VOUCHER_DEF",
      DuLieuCu: "SSDELTA10",
      DuLieuMoi: JSON.stringify({
        code: "SSDELTA10",
        name: "SQL Server 10% Miền Bắc",
        description: "Voucher bảo toàn 12 bảng trong SQL Server",
        discountType: "percent",
        discountValue: 10,
        maxDiscount: 500000,
        minOrderValue: 1000000,
        scopeType: "region",
        scopeRegions: ["north"],
        scopeTourIds: [],
        startAt: new Date(Date.now() - 86400000).toISOString(),
        endAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        usageLimit: 2,
        usedCount: 0,
        perUserLimit: 1,
        targetAudience: "all",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }),
      ThoiGian: new Date()
    }];
    let ssNextLogId = 2;
    const makeMockReq = () => {
      const inputs = {};
      return {
        input(k, v) { inputs[k] = v; return this; },
        async query(sql) {
          const s = sql.replace(/\s+/g, " ").trim();
          if (s.includes("FROM dbo.AUDITLOG") && s.includes("HanhDong = N'VOUCHER_DEF'")) {
            const defs = ssAuditRows.filter(r => r.HanhDong === "VOUCHER_DEF");
            if (s.includes("SELECT TOP 1")) {
              const match = defs.find(r =>
                r.MaLog === inputs.numericId || r.DuLieuCu.toUpperCase() === String(inputs.normCode || "").toUpperCase()
              );
              return { recordset: match ? [{ ...match }] : [] };
            }
            return { recordset: [...defs].reverse().map(r => ({ ...r })) };
          }
          if (s.includes("FROM dbo.AUDITLOG") && s.includes("HanhDong = N'VOUCHER_USE'")) {
            let uses = ssAuditRows.filter(r => r.HanhDong === "VOUCHER_USE");
            if (inputs.normCode) {
              uses = uses.filter(r => r.DuLieuCu.toUpperCase() === String(inputs.normCode).toUpperCase());
            }
            return { recordset: [...uses].reverse().map(r => ({ ...r })) };
          }
          if (s.startsWith("INSERT INTO dbo.AUDITLOG") && s.includes("N'VOUCHER_DEF'")) {
            const created = {
              MaLog: ssNextLogId++,
              MaNguoiThucHien: null,
              HanhDong: "VOUCHER_DEF",
              DuLieuCu: inputs.code,
              DuLieuMoi: inputs.payload,
              ThoiGian: new Date()
            };
            ssAuditRows.push(created);
            return { recordset: [{ ...created }] };
          }
          if (s.startsWith("INSERT INTO dbo.AUDITLOG") && s.includes("N'VOUCHER_USE'")) {
            ssAuditRows.push({
              MaLog: ssNextLogId++,
              MaNguoiThucHien: null,
              HanhDong: "VOUCHER_USE",
              DuLieuCu: inputs.maCode,
              DuLieuMoi: inputs.payload,
              ThoiGian: new Date()
            });
            return { rowsAffected: [1], recordset: [] };
          }
          if (s.startsWith("UPDATE dbo.AUDITLOG") && s.includes("HanhDong = N'VOUCHER_DEF'")) {
            const row = ssAuditRows.find(r => r.MaLog === inputs.maLog && r.HanhDong === "VOUCHER_DEF");
            if (!row) return { rowsAffected: [0], recordset: [] };
            if (inputs.expectedUsed !== undefined) {
              const cur = JSON.parse(row.DuLieuMoi);
              if (Number(cur.usedCount || 0) !== inputs.expectedUsed) {
                return { rowsAffected: [0], recordset: [] };
              }
              row.DuLieuMoi = inputs.nextPayload;
              return { rowsAffected: [1], recordset: [] };
            }
            row.DuLieuCu = inputs.code ?? row.DuLieuCu;
            row.DuLieuMoi = inputs.payload;
            return { rowsAffected: [1], recordset: [] };
          }
          if (s.startsWith("UPDATE dbo.AUDITLOG") && s.includes("HanhDong = N'VOUCHER_USE'")) {
            const released = [];
            for (const r of ssAuditRows) {
              if (r.HanhDong === "VOUCHER_USE") {
                const p = JSON.parse(r.DuLieuMoi);
                if (p.bookingExternalId === inputs.bookingExtId && p.status === "ACTIVE") {
                  p.status = "RELEASED";
                  r.DuLieuMoi = JSON.stringify(p);
                  released.push({ MaCode: r.DuLieuCu });
                }
              }
            }
            return { rowsAffected: [released.length], recordset: released };
          }
          if (s.startsWith("DELETE FROM dbo.AUDITLOG") && s.includes("N'VOUCHER_DEF'")) {
            const idx = ssAuditRows.findIndex(r => r.MaLog === inputs.maLog && r.HanhDong === "VOUCHER_DEF");
            if (idx >= 0) ssAuditRows.splice(idx, 1);
            return { rowsAffected: [idx >= 0 ? 1 : 0], recordset: [] };
          }
          return { recordset: [], rowsAffected: [0] };
        }
      };
    };
    const mockSqlServerPool = {
      request: makeMockReq,
      transaction: () => ({
        async begin() {},
        async commit() {},
        async rollback() {},
        request: makeMockReq
      })
    };
    setSqlServerTestConnection(mockSqlServerPool, true);
    try {
      const ssHealth = await req("/api/v1/health/ready");
      const ssList = await req("/api/v1/vouchers?tour_id=DL-HL01");
      const ssValOk = await req("/api/v1/vouchers/validate", {
        method: "POST",
        body: { code: "SSDELTA10", tour_id: "DL-HL01", adults: 1 }
      });
      const ssValWrong = await req("/api/v1/vouchers/validate", {
        method: "POST",
        body: { code: "SSDELTA10", tour_id: "DL-DN02", adults: 1 }
      });
      const ssCreateRes = await req("/api/v1/admin/vouchers", {
        method: "POST",
        headers: adminHeaders,
        body: {
          code: "SSADMIN200",
          name: "SQL Server Admin Voucher",
          discountType: "fixed",
          discountValue: 200000,
          minOrderValue: 1000000,
          scopeType: "all",
          startAt: new Date(Date.now() - 86400000).toISOString(),
          endAt: new Date(Date.now() + 86400000 * 30).toISOString(),
          usageLimit: 10,
          perUserLimit: 1,
          targetAudience: "all",
          active: true
        }
      });
      const ssBookRes = await req("/api/v1/bookings", {
        method: "POST",
        headers: { ...authHeaders, "Idempotency-Key": "SS-IDEM-" + Date.now() },
        body: {
          schedule_id: hlSchedId,
          adults: 1,
          customer_name: "SQL Server Buyer",
          customer_phone: "0988776655",
          customer_email: `ssbuyer_${Date.now()}@test.local`,
          voucher_code: "SSDELTA10"
        }
      });
      const ssUsedBeforeCancel = JSON.parse(ssAuditRows[0].DuLieuMoi).usedCount;
      const ssCancelRes = await req(`/api/v1/bookings/${ssBookRes.json?.id}/cancel`, {
        method: "POST",
        headers: authHeaders,
        body: { reason: "Test release SQL Server voucher" }
      });
      const ssUsedAfterCancel = JSON.parse(ssAuditRows[0].DuLieuMoi).usedCount;
      const ssAdminList = await req("/api/v1/admin/vouchers", { headers: adminHeaders });

      assert("Voucher 6 (SQL Server 12 bảng): Lưu & xử lý qua dbo.AUDITLOG (trừ/hoàn lượt an toàn)",
        ssHealth.json?.sqlServerConnected === true &&
        ssHealth.json?.voucherDatabase === "SQL Server" &&
        ssList.status === 200 && ssList.json?.some(v => v.code === "SSDELTA10") &&
        ssValOk.status === 200 && ssValOk.json?.discountAmount === 389000 &&
        ssValWrong.status === 422 && ssValWrong.json?.errorCode === "VOUCHER_WRONG_SCOPE" &&
        ssCreateRes.status === 201 && ssCreateRes.json?.code === "SSADMIN200" &&
        ssBookRes.status === 201 && ssBookRes.json?.voucherCode === "SSDELTA10" &&
        ssUsedBeforeCancel === 1 && ssCancelRes.status === 200 && ssUsedAfterCancel === 0 &&
        ssAdminList.status === 200 && ssAdminList.json?.some(v => v.code === "SSADMIN200"),
        `health=${JSON.stringify(ssHealth.json)} valOk=${ssValOk.status}:${ssValOk.json?.discountAmount} wrong=${ssValWrong.json?.errorCode} create=${ssCreateRes.status} book=${ssBookRes.status} used=${ssUsedBeforeCancel}->${ssUsedAfterCancel}`);
    } finally {
      setSqlServerTestConnection(null, false);
    }

    // Test gửi Email xác nhận khi đặt tour thành công & khi Admin xác nhận thanh toán
    const sentMails = [];
    setMailTransportForTest({
      async sendMail(mail) {
        sentMails.push(mail);
        return { messageId: "test-msg-" + sentMails.length };
      }
    });
    try {
      const mailRecipient = `khachmail_${Date.now()}@example.com`;
      const mailBook = await req("/api/v1/bookings", {
        method: "POST",
        headers: { ...authHeaders, "Idempotency-Key": "MAIL-IDEM-" + Date.now() },
        body: {
          schedule_id: hlSchedId,
          adults: 1,
          customer_name: "Nguyễn Văn <MailTest>",
          customer_phone: "0988112233",
          customer_email: mailRecipient,
          voucher_code: "HALONG100K"
        }
      });
      const mailPay = await req(`/api/v1/admin/bookings/${mailBook.json?.id}/confirm-payment`, {
        method: "POST",
        headers: adminHeaders,
        body: { reference: "MAILPAY-" + Date.now() }
      });

      setMailTransportForTest({
        async sendMail() {
          throw new Error("Simulated SMTP timeout");
        }
      });
      const mailFailBook = await req("/api/v1/bookings", {
        method: "POST",
        headers: { ...authHeaders, "Idempotency-Key": "MAIL-FAIL-" + Date.now() },
        body: {
          schedule_id: hlSchedId,
          adults: 1,
          customer_name: "Khách SMTP Lỗi",
          customer_phone: "0988112244",
          customer_email: "smtpfail@example.com"
        }
      });

      const firstMail = sentMails[0];
      const secondMail = sentMails[1];
      assert("Email xác nhận đặt tour & thanh toán gửi đúng địa chỉ mail khách nhập",
        mailBook.status === 201 &&
        mailBook.json?.emailNotification?.sent === true &&
        mailBook.json?.emailNotification?.recipient === mailRecipient &&
        sentMails.length === 2 &&
        firstMail?.to === mailRecipient &&
        firstMail?.subject?.includes(mailBook.json?.reference) &&
        firstMail?.html?.includes("&lt;MailTest&gt;") &&
        firstMail?.html?.includes("HALONG100K") &&
        (firstMail?.text?.includes("4.169.000") || firstMail?.text?.includes("3.790.000")) &&
        mailPay.status === 200 &&
        mailPay.json?.emailNotification?.sent === true &&
        secondMail?.to === mailRecipient &&
        secondMail?.subject?.includes("Xác nhận thanh toán") &&
        mailFailBook.status === 201 &&
        mailFailBook.json?.emailNotification?.sent === false,
        `count=${sentMails.length} book=${mailBook.status}:${JSON.stringify(mailBook.json?.emailNotification)} pay=${mailPay.status} fail=${mailFailBook.status}:${JSON.stringify(mailFailBook.json?.emailNotification)}`);
    } finally {
      setMailTransportForTest(null);
    }

    // Test SePay Webhook tự động kích hoạt thanh toán khi nhận tiền
    const sepayTestBook = await req("/api/v1/bookings", {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": "SEPAY-TEST-" + Date.now() },
      body: {
        schedule_id: hlSchedId,
        adults: 1,
        customer_name: "Khách SePay Test",
        customer_phone: "0933445566",
        customer_email: "sepaytest@example.com"
      }
    });
    const sepayRef = sepayTestBook.json?.reference;
    const sepayApiKey = process.env.SEPAY_API_KEY ? String(process.env.SEPAY_API_KEY).trim() : "";
    const sepayHeaders = sepayApiKey ? { "Authorization": `Apikey ${sepayApiKey}` } : {};
    const sepayWebhookRes = await req("/api/v1/webhooks/sepay", {
      method: "POST",
      headers: sepayHeaders,
      body: {
        id: 999991,
        gateway: "MBBank",
        transactionDate: "2026-11-14 23:30:00",
        accountNumber: "0325536936",
        content: `KH9999 ${sepayRef}`,
        transferType: "in",
        transferAmount: sepayTestBook.json?.totalPrice,
        referenceCode: "FT-TEST-SEPAY-01"
      }
    });
    const sepayBookAfter = await req(`/api/v1/bookings/${sepayTestBook.json?.id}`, { headers: authHeaders });
    assert("SePay Webhook tự động xác nhận thanh toán & chuyển trạng thái PAID",
      sepayWebhookRes.status === 200 &&
      sepayWebhookRes.json?.success === true &&
      sepayBookAfter.json?.status === "PAID" &&
      sepayBookAfter.json?.paid === true &&
      sepayBookAfter.json?.paymentEvidence?.includes("FT-TEST-SEPAY-01"),
      `status=${sepayWebhookRes.status} resp=${JSON.stringify(sepayWebhookRes.json)} bookStatus=${sepayBookAfter.json?.status} evidence=${sepayBookAfter.json?.paymentEvidence}`);

    const catalogRequests = [];
    catalogMockServer = http.createServer((request, response) => {
      const requestUrl = new URL(request.url, "http://127.0.0.1");
      catalogRequests.push(requestUrl);
      response.setHeader("Content-Type", "application/json");
      if (requestUrl.pathname === "/api/v1/tours") {
        response.end(JSON.stringify([{ id: "7", title: "SQL Server tour", price: 2500000 }]));
      } else if (requestUrl.pathname === "/api/v1/tours/7/schedules") {
        response.end(JSON.stringify([{ id: "42", tourId: "7", availableSeats: 2 }]));
      } else {
        response.statusCode = 404;
        response.end(JSON.stringify({ detail: "Not found" }));
      }
    });
    await new Promise(resolve => catalogMockServer.listen(0, "127.0.0.1", resolve));
    process.env.THAM_SQLSERVER_CATALOG_API_URL =
      `http://127.0.0.1:${catalogMockServer.address().port}`;

    const proxiedTours = await req("/api/v1/tours?q=H%E1%BA%A1%20Long&region=north&max_price=3000000");
    const proxiedSchedules = await req("/api/v1/tours/7/schedules");
    const readOnlyHealth = await req("/api/v1/health/ready");
    const blockedAdmin = await req("/api/v1/admin/tours", { headers: adminHeaders });
    const blockedBooking = await req("/api/v1/bookings/quote", {
      method: "POST",
      body: { schedule_id: "42", adults: 1 }
    });
    assert("SQL Server read-only catalog proxy",
      proxiedTours.status === 200 &&
      proxiedTours.json?.[0]?.id === "7" &&
      catalogRequests[0]?.searchParams.get("q") === "Hạ Long" &&
      catalogRequests[0]?.searchParams.get("region") === "north" &&
      catalogRequests[0]?.searchParams.get("max_price") === "3000000" &&
      proxiedSchedules.status === 200 &&
      proxiedSchedules.json?.[0]?.availableSeats === 2 &&
      readOnlyHealth.json?.catalogMode === "sqlserver_read_only" &&
      readOnlyHealth.json?.db === "SQL Server (read-only)" &&
      readOnlyHealth.json?.tours === undefined &&
      blockedAdmin.status === 503 &&
      blockedBooking.status === 503);

  } catch (err) {
    console.error("Lỗi trong quá trình kiểm thử:", err);
  } finally {
    if (previousCatalogUrl === undefined) delete process.env.THAM_SQLSERVER_CATALOG_API_URL;
    else process.env.THAM_SQLSERVER_CATALOG_API_URL = previousCatalogUrl;
    if (catalogMockServer?.listening) {
      await new Promise(resolve => catalogMockServer.close(resolve));
    }
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
