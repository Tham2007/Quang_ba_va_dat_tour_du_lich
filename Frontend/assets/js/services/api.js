/**
 * DELTA TRAVEL - BACKEND API CLIENT & DATABASE CONNECTOR (api.js)
 * -------------------------------------------------------------
 * Kết nối Frontend với FastAPI Backend & Database (PostgreSQL / SQLite).
 * Hỗ trợ đồng bộ hai chiều (Hybrid Fallback):
 * - Nếu Backend FastAPI đang chạy (http://localhost:8000/api/v1 hoặc cùng origin):
 *   Gửi nhận dữ liệu thực tế tới Database server-side.
 * - Nếu Backend chưa khởi động: Tự động chuyển tiếp sang tầng lưu trữ
 *   Persistent LocalStorage mà không làm gián đoạn trải nghiệm người dùng.
 */

const DeltaAPI = (() => {
  "use strict";

  // Cấu hình URL gốc của Backend API
  const isSameOriginApi = window.location.origin.includes(":8000") ||
                          window.location.origin.includes(":8001") ||
                          window.location.origin.includes(":8999") ||
                          window.location.pathname.startsWith("/an-live") ||
                          (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && window.location.protocol.startsWith("http"));
  const API_BASE_URL = isSameOriginApi ? "/api/v1" : "http://127.0.0.1:8000/api/v1";

  // Trạng thái kết nối API Backend
  let isBackendOnline = false;
  let backendHealthData = null;

  /**
   * Lấy CSRF token từ cookie nếu có
   */
  function getCsrfToken() {
    const c = document.cookie.split("; ").find(s => s.startsWith("delta_csrf="));
    return c ? decodeURIComponent(c.slice("delta_csrf=".length)) : "";
  }

  /**
   * Hàm gọi fetch có timeout và xử lý lỗi đồng bộ
   */
  async function request(path, options = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    const headers = {
      "Accept": "application/json",
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }

    const csrf = getCsrfToken();
    if (csrf && !["GET", "HEAD"].includes(options.method || "GET")) {
      headers["X-CSRF-Token"] = csrf;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 6000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = (data && data.detail)
          ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))
          : `Lỗi kết nối máy chủ (HTTP ${response.status})`;
        return { success: false, error: errorMsg, isOffline: false };
      }

      isBackendOnline = true;
      return { success: true, data };
    } catch (err) {
      clearTimeout(timeoutId);
      // Khi mất kết nối hoặc server chưa bật
      return { success: false, error: err.message, isOffline: true };
    }
  }

  /**
   * Kiểm tra tình trạng hoạt động của máy chủ Backend & Database
   */
  async function checkHealth() {
    const res = await request("/health/ready", { timeout: 3000 });
    if (res.success && res.data && res.data.status === "ok") {
      isBackendOnline = true;
      backendHealthData = res.data;
      updateBackendStatusBadge(true, res.data);
      return { online: true, details: res.data };
    } else {
      isBackendOnline = false;
      backendHealthData = null;
      updateBackendStatusBadge(false);
      return { online: false, error: res.error };
    }
  }

  /**
   * Cập nhật chỉ báo trạng thái máy chủ trên giao diện Admin & Topbar
   */
  function updateBackendStatusBadge(online, details) {
    const modeNotice = document.getElementById("deltaDataModeNotice");
    if (modeNotice && details?.catalogMode === "sqlserver_read_only") {
      modeNotice.className = "alert alert-info text-center rounded-0 mb-0";
      modeNotice.textContent =
        "Danh mục đang đọc từ SQL Server thật (chỉ đọc). Đăng nhập, quản trị, đặt tour và thanh toán chưa kết nối.";
    }

    const badges = document.querySelectorAll(".backend-status-indicator");
    badges.forEach(badge => {
      if (online) {
        badge.className = "backend-status-indicator badge bg-success-subtle text-success border border-success-subtle";
        badge.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> API FastAPI: Kết nối thành công (${details?.db || "Database Live"})`;
      } else {
        badge.className = "backend-status-indicator badge bg-warning-subtle text-dark border border-warning-subtle";
        badge.innerHTML = `<i class="bi bi-hdd-network-fill text-warning me-1"></i> LocalStorage Persistent: Sẵn sàng`;
      }
    });
  }

  // ===========================================================================
  // CÁC HÀM GIAO TIẾP VỚI PUBLIC API
  // ===========================================================================

  /**
   * Lấy danh sách tour từ Backend API
   */
  async function fetchTours(query = {}) {
    const params = new URLSearchParams();
    const allowed = [
      "q", "region", "destination", "departure_location", "departure_date",
      "min_price", "max_price", "duration", "transport", "tour_type",
      "audience", "availability", "sort_by", "page", "page_size"
    ];
    for (const key of allowed) {
      const value = query[key];
      if (value === undefined || value === null || value === "") continue;
      if (key === "region" && value === "all") continue;
      params.set(key, String(value));
    }

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    return await request(`/tours${queryStr}`);
  }

  /**
   * Lấy chi tiết 1 tour từ Backend API
   */
  async function fetchTourById(tourId) {
    return await request(`/tours/${encodeURIComponent(tourId)}`);
  }

  /**
   * Lấy danh sách lịch khởi hành của 1 tour
   */
  async function fetchSchedules(tourId) {
    return await request(`/tours/${encodeURIComponent(tourId)}/schedules`);
  }

  async function fetchItinerary(tourId) {
    return await request(`/tours/${encodeURIComponent(tourId)}/itinerary`);
  }

  /**
   * Lấy danh sách mã ưu đãi công khai còn hiệu lực (có thể lọc theo tourId)
   */
  async function fetchPublicVouchers(tourId) {
    const q = tourId ? `?tour_id=${encodeURIComponent(tourId)}` : "";
    return await request(`/vouchers${q}`);
  }

  /**
   * Xác thực điều kiện áp dụng mã ưu đãi & tính số tiền giảm phía Backend
   */
  async function validateVoucher(payload) {
    return await request("/vouchers/validate", {
      method: "POST",
      body: payload
    });
  }

  /**
   * Báo giá tính tiền đơn đặt tour từ server
   */
  async function quoteBooking(quoteData) {
    return await request("/bookings/quote", {
      method: "POST",
      body: quoteData
    });
  }

  /**
   * Tạo đơn đặt chỗ mới trên Database server
   */
  async function createBooking(bookingData) {
    return await request("/bookings", {
      method: "POST",
      headers: {
        "Idempotency-Key": (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : ("IDEM-" + Date.now())
      },
      body: bookingData
    });
  }

  /**
   * Lấy danh sách đơn đặt của khách hàng đã đăng nhập
   */
  async function fetchMyBookings() {
    return await request("/bookings");
  }

  /**
   * Lấy chi tiết đơn đặt theo mã ID hoặc mã booking reference
   */
  async function fetchBookingById(bookingId) {
    return await request(`/bookings/${encodeURIComponent(bookingId)}`);
  }

  /**
   * Hủy đơn đặt chỗ trên server
   */
  async function cancelBooking(bookingId, reason) {
    return await request(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: "POST",
      body: { reason: reason || "Khách hàng yêu cầu hủy đơn" }
    });
  }

  // ===========================================================================
  // CÁC HÀM XÁC THỰC TÀI KHOẢN (AUTH API)
  // ===========================================================================

  async function login(emailOrPhone, password) {
    return await request("/auth/login", {
      method: "POST",
      body: { email: emailOrPhone, username: emailOrPhone, password }
    });
  }

  async function payBooking(bookingId, reference) {
    let ref = "VQR-" + Date.now().toString().slice(-8);
    let autoConfirm = false;
    if (typeof reference === "string" && reference.trim()) {
      ref = reference.trim();
    } else if (reference && typeof reference === "object") {
      ref = reference.reference || reference.payment_evidence || reference.paymentEvidence || ref;
      autoConfirm = !!reference.auto_confirm;
    }
    return await request(`/bookings/${encodeURIComponent(bookingId)}/pay`, {
      method: "POST",
      body: { reference: ref, payment_evidence: ref, auto_confirm: autoConfirm }
    });
  }

  async function adminConfirmPayment(bookingId, reference) {
    const ref = (reference && reference.trim()) ? reference.trim() : ("VQR-" + Date.now().toString().slice(-8));
    return await request(`/admin/bookings/${encodeURIComponent(bookingId)}/confirm-payment`, {
      method: "POST",
      body: { reference: ref }
    });
  }

  async function adminFetchMetrics() {
    return await request("/admin/metrics");
  }

  async function register(userData) {
    return await request("/auth/register", {
      method: "POST",
      body: {
        full_name: userData.fullName || userData.full_name,
        email: userData.email,
        phone: userData.phone,
        password: userData.password
      }
    });
  }

  async function getMe() {
    return await request("/auth/me");
  }

  async function logout() {
    return await request("/auth/logout", { method: "POST" });
  }

  // ===========================================================================
  // CÁC HÀM QUẢN TRỊ ADMIN API
  // ===========================================================================

  async function adminFetchDashboard() {
    return await request("/admin/dashboard");
  }

  async function adminFetchTours() {
    return await request("/admin/tours");
  }

  async function adminCreateTour(tourPayload) {
    return await request("/admin/tours", {
      method: "POST",
      body: tourPayload
    });
  }

  async function adminPatchTour(tourId, patchData) {
    return await request(`/admin/tours/${encodeURIComponent(tourId)}`, {
      method: "PATCH",
      body: patchData
    });
  }

  async function adminFetchTourDetails(tourId) {
    return await request(`/admin/tours/${encodeURIComponent(tourId)}/details`);
  }

  async function adminReplaceTourDetails(tourId, details) {
    return await request(`/admin/tours/${encodeURIComponent(tourId)}/details`, {
      method: "PUT",
      body: details
    });
  }

  async function adminDeleteTour(tourId) {
    return await request(`/admin/tours/${encodeURIComponent(tourId)}`, {
      method: "DELETE"
    });
  }

  async function adminFetchBookings() {
    return await request("/admin/bookings");
  }

  async function adminPatchBooking(bookingId, status, reason) {
    const body = { status };
    if (reason) body.reason = reason;
    return await request(`/admin/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      body
    });
  }

  async function adminFetchAudit() {
    return await request("/admin/audit");
  }

  async function adminFetchSchedules(tourId) {
    const q = tourId ? `?tour_id=${encodeURIComponent(tourId)}` : "";
    return await request(`/admin/schedules${q}`);
  }

  async function adminCreateSchedule(payload) {
    return await request("/admin/schedules", {
      method: "POST",
      body: payload
    });
  }

  async function adminPatchSchedule(scheduleId, patchData) {
    return await request(`/admin/schedules/${encodeURIComponent(scheduleId)}`, {
      method: "PATCH",
      body: patchData
    });
  }

  async function adminFetchVouchers() {
    return await request("/admin/vouchers");
  }

  async function adminCreateVoucher(voucherData) {
    return await request("/admin/vouchers", {
      method: "POST",
      body: voucherData
    });
  }

  async function adminPatchVoucher(voucherId, patchData) {
    return await request(`/admin/vouchers/${encodeURIComponent(voucherId)}`, {
      method: "PATCH",
      body: patchData
    });
  }

  async function adminDeleteVoucher(voucherId) {
    return await request(`/admin/vouchers/${encodeURIComponent(voucherId)}`, {
      method: "DELETE"
    });
  }

  async function changePassword(oldPassword, newPassword) {
    return await request("/auth/change-password", {
      method: "POST",
      body: { old_password: oldPassword, new_password: newPassword }
    });
  }

  async function getSession() {
    return await request("/auth/session");
  }

  async function updateProfile(fullName, phone, avatar) {
    const body = { full_name: fullName, phone };
    if (typeof avatar !== "undefined") body.avatar = avatar;
    return await request("/auth/profile", {
      method: "PATCH",
      body
    });
  }

  async function fetchFavorites() {
    return await request("/favorites");
  }

  async function addFavorite(tourId) {
    return await request(`/favorites/${encodeURIComponent(tourId)}`, {
      method: "POST"
    });
  }

  async function removeFavorite(tourId) {
    return await request(`/favorites/${encodeURIComponent(tourId)}`, {
      method: "DELETE"
    });
  }

  async function assistantChat(message, options = {}) {
    const payload = typeof message === "object" ? message : {
      message,
      history: options.history || [],
      lang: options.lang || (typeof getAppLanguage === "function" ? getAppLanguage() : "vi"),
      currentTourId: options.currentTourId || null
    };
    return await request("/assistant/chat", {
      method: "POST",
      body: payload
    });
  }

  // Tự động kiểm tra sức khỏe server khi script tải
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(checkHealth, 500);
  });

  return {
    API_BASE_URL,
    isOnline: () => isBackendOnline,
    getHealthData: () => backendHealthData,
    isCatalogReadOnly: () => backendHealthData?.catalogMode === "sqlserver_read_only",
    checkHealth,
    fetchTours,
    fetchTourById,
    fetchTour: fetchTourById,
    fetchSchedules,
    fetchItinerary,
    fetchPublicVouchers,
    validateVoucher,
    quoteBooking,
    createBooking,
    fetchMyBookings,
    fetchBookingById,
    cancelBooking,
    payBooking,
    login,
    register,
    getMe,
    getSession,
    logout,
    adminFetchDashboard,
    adminFetchTours,
    adminGetTours: adminFetchTours,
    adminCreateTour,
    adminPatchTour,
    adminFetchTourDetails,
    adminReplaceTourDetails,
    adminDeleteTour,
    adminFetchBookings,
    adminGetBookings: adminFetchBookings,
    adminPatchBooking,
    adminConfirmPayment,
    adminFetchAudit,
    adminGetAudit: adminFetchAudit,
    adminFetchMetrics,
    adminGetMetrics: adminFetchMetrics,
    adminFetchSchedules,
    adminGetSchedules: adminFetchSchedules,
    adminCreateSchedule,
    adminPatchSchedule,
    adminFetchVouchers,
    adminCreateVoucher,
    adminPatchVoucher,
    adminDeleteVoucher,
    changePassword,
    updateProfile,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    assistantChat
  };
})();

// Gán toàn cục để sử dụng trong main.js và admin.js
window.DeltaAPI = DeltaAPI;
