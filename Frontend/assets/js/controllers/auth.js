/**
 * DELTA TRAVEL - AUTHENTICATION & USER MANAGEMENT (auth.js)
 * -------------------------------------------------------------
 * Chức năng:
 * 1. Đăng ký, Đăng nhập, Quên mật khẩu thuần Frontend (localStorage).
 * 2. Validate định dạng Email, Số điện thoại VN, độ dài mật khẩu.
 * 3. Đồng bộ trạng thái Header (Avatar, Dropdown quản lý tài khoản).
 * 4. Tự động điền (Auto-fill) thông tin người dùng vào Form Đặt Tour.
 * 5. Quản lý Hồ sơ cá nhân (Đổi thông tin, đổi mật khẩu).
 */

// =============================================================================
// I. KHỞI TẠO DỮ LIỆU & STORAGE
// =============================================================================
const AUTH_STORAGE_KEYS = {
  USERS: "delta_users_v2",
  CURRENT_USER: "delta_current_user_v2"
};

// Danh sách lưu trữ local tạm thời (nếu có)
function getAllUsers() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.USERS);
    const users = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(users)) return [];
    // Remove passwords previously stored by older insecure demo releases.
    const safe = users.map(({password: _oldPassword, passwordHash: _oldHash, ...profile}) => profile);
    if (JSON.stringify(users) !== JSON.stringify(safe)) {
      localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(safe));
    }
    return safe;
  } catch (_) { return []; }
}

/**
 * Lưu danh sách users vào localStorage
 */
function saveUsers(users) {
  const safe = (Array.isArray(users) ? users : [])
    .map(({password: _oldPassword, passwordHash: _oldHash, ...profile}) => profile);
  localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(safe));
}

/**
 * Lấy tài khoản đang đăng nhập hiện tại từ LocalStorage
 */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_USER);
    if (!raw) return null;
    const {password: _oldPassword, passwordHash: _oldHash, ...profile} = JSON.parse(raw);
    if (JSON.stringify(profile) !== raw) {
      localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
    }
    return profile;
  } catch (e) {
    return null;
  }
}

/**
 * Lưu tài khoản đang đăng nhập
 */
function setCurrentUser(user) {
  if (user) {
    const {password: _oldPassword, passwordHash: _oldHash, ...safeProfile} = user;
    localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(safeProfile));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_USER);
  }
  renderAuthHeader();
  syncUserWithBookingForm();
}

/**
 * ĐỒNG BỘ TÀI KHOẢN THỰC TẾ VỚI CƠ SỞ DỮ LIỆU SQLITE / BACKEND API
 * Tuyệt đối không dùng dữ liệu giả mạo!
 */
async function syncCurrentSessionUser() {
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.getSession === "function") {
    try {
      const startedAt = Date.now();
      const res = await DeltaAPI.getSession();
      if (window.__adminLoginTimestamp && window.__adminLoginTimestamp > startedAt) {
        return getCurrentUser();
      }
      const sessionPayload = (res && res.success && res.data) ? res.data : res;
      if (sessionPayload && sessionPayload.authenticated && sessionPayload.user) {
        const u = sessionPayload.user;
        const realUser = {
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          role: u.role || "CUSTOMER",
          avatar: u.avatar || null,
          createdAt: u.createdAt || null,
          totalBookings: typeof u.totalBookings === "number" ? u.totalBookings : 0
        };
        localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(realUser));
        renderAuthHeader();
        syncUserWithBookingForm();
        return realUser;
      } else if (res && res.isOffline) {
        // A cached profile is not a valid authenticated server session.
        setCurrentUser(null);
        return null;
      } else {
        // Kiểm tra xem có phiên hợp lệ qua DeltaAPI.getMe() không
        const meRes = await DeltaAPI.getMe();
        if (window.__adminLoginTimestamp && window.__adminLoginTimestamp > startedAt) {
          return getCurrentUser();
        }
        if (meRes && meRes.success && meRes.data) {
          const u = meRes.data;
          const realUser = {
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            phone: u.phone,
            role: u.role || "CUSTOMER",
            avatar: u.avatar || null,
            createdAt: u.createdAt || null,
            totalBookings: typeof u.totalBookings === "number" ? u.totalBookings : 0
          };
          localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(realUser));
          renderAuthHeader();
          syncUserWithBookingForm();
          return realUser;
        } else {
          // No valid cookie-backed user, or the server is unreachable.
          setCurrentUser(null);
          return null;
        }
      }
    } catch (err) {
      console.warn("Lỗi đồng bộ phiên tài khoản:", err);
    }
  }
  setCurrentUser(null);
  return null;
}

// =============================================================================
// II. KHỞI TẠO GIAO DIỆN KHI TRANG TẢI
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  renderAuthHeader();
  initAuthEventListeners();
  hookBookingModalForAutoFill();
  syncCurrentSessionUser();
});

/**
 * Hiển thị trạng thái Đăng nhập / Đăng ký trên Header
 */
function renderAuthHeader() {
  const container = document.getElementById("headerAuthContainer");
  const topbarContainer = document.getElementById("topbarAuthContainer");
  const user = getCurrentUser();

  const loginText = typeof t === "function" ? t("btn_login") : "Đăng nhập";
  const registerText = typeof t === "function" ? t("btn_register") : "Đăng ký";
  const logoutText = typeof t === "function" ? t("topbar_logout") : "Đăng xuất";
  const profileTooltip = typeof t === "function" ? t("profile_title") : "Hồ sơ tài khoản & Đơn đặt";

  if (user) {
    // Tách lấy chữ cái đầu để làm Avatar
    const names = user.fullName.trim().split(" ");
    const initials = names.length > 1
      ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
      : names[0].substring(0, 2).toUpperCase();

    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" alt="${user.fullName}" class="user-avatar-gold-rim" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 2px solid #f59e0b;">`
      : `<div class="user-avatar-gold-rim">${initials}</div>`;

    const htmlContent = `
      <div class="d-inline-flex align-items-center gap-1.5">
        <!-- Liquid Glass User Profile Pill -->
        <button type="button" class="liquid-user-glass" onclick="openUserProfileModal()" title="${profileTooltip}">
          ${avatarHtml}
          <span class="liquid-user-name">${user.fullName}</span>
        </button>

        <!-- Logout Button in Matching Glass Pill -->
        <button type="button" class="liquid-logout-btn" onclick="handleUserLogout()" title="${logoutText}">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    `;

    if (container) container.innerHTML = htmlContent;
    if (topbarContainer) {
      topbarContainer.innerHTML = `
        <span class="text-dark small me-2"><i class="bi bi-person-check text-warning"></i> ${user.fullName}</span>
        <a href="javascript:void(0)" onclick="handleUserLogout()" class="text-warning small text-decoration-none">${logoutText}</a>
      `;
    }
  } else {
    // Trạng thái chưa đăng nhập: 2 nút kính chuẩn Apple Liquid Glass
    const htmlBtn = `
      <div class="d-inline-flex align-items-center gap-1.5">
        <button type="button" class="btn btn-sm btn-outline-dark rounded-pill px-2.5 px-sm-3 py-1.5 fw-bold" style="font-size: 12px; background: rgba(255,255,255,0.7); backdrop-filter: blur(12px);" onclick="openAuthModal('login')">
          ${loginText}
        </button>
        <button type="button" class="btn btn-sm btn-dark rounded-pill px-3 py-1.5 fw-bold text-white shadow-sm d-none d-sm-inline-block" style="font-size: 12px;" onclick="openAuthModal('register')">
          ${registerText}
        </button>
      </div>
    `;

    if (container) container.innerHTML = htmlBtn;
    if (topbarContainer) {
      topbarContainer.innerHTML = `
        <a href="javascript:void(0)" onclick="openAuthModal('login')"><i class="bi bi-box-arrow-in-right text-warning"></i> ${loginText}</a>
        <span class="topbar-divider"></span>
        <a href="javascript:void(0)" onclick="openAuthModal('register')"><i class="bi bi-person-plus text-info"></i> ${registerText}</a>
      `;
    }
  }
}

window.addEventListener("languageChanged", () => {
  renderAuthHeader();
});

// =============================================================================
// III. MODAL AUTH & CHUYỂN ĐỔI TAB (LOGIN / REGISTER / FORGOT)
// =============================================================================
/**
 * Mở modal Auth với tab được chỉ định ('login', 'register', 'forgot')
 */
function openAuthModal(tabName = "login") {
  switchAuthTab(tabName);
  const modalEl = document.getElementById("authModal");
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Chuyển đổi giữa 3 tab trong Auth Modal
 */
function switchAuthTab(tabName) {
  // Cập nhật tab buttons
  document.querySelectorAll(".auth-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  // Hiển thị khung tương ứng
  const panes = ["login", "register", "forgot"];
  panes.forEach(pane => {
    const paneEl = document.getElementById(`authPane_${pane}`);
    if (paneEl) {
      paneEl.style.display = (pane === tabName) ? "block" : "none";
    }
  });

  // Reset các thông báo lỗi
  clearAuthErrors();
}

function clearAuthErrors() {
  document.querySelectorAll(".auth-error-msg").forEach(el => {
    el.textContent = "";
    el.classList.remove("show");
  });
}

function showAuthError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.classList.add("show");
  }
}

/**
 * Toggle ẩn / hiện mật khẩu
 */
function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";

  const icon = btnEl.querySelector("i");
  if (icon) {
    icon.className = isPassword ? "bi bi-eye-slash-fill" : "bi bi-eye-fill";
  }
}

// =============================================================================
// IV. XỬ LÝ SỰ KIỆN SUBMIT FORM (LOGIN / REGISTER / FORGOT)
// =============================================================================
function initAuthEventListeners() {
  // Form Đăng ký
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegisterSubmit);
  }

  // Form Đăng nhập
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  // Form Quên mật khẩu
  const forgotForm = document.getElementById("forgotForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", handleForgotSubmit);
  }

  // Form Cập nhật hồ sơ
  const profileEditForm = document.getElementById("profileEditForm");
  if (profileEditForm) {
    profileEditForm.addEventListener("submit", handleProfileUpdate);
  }

  // Form Đổi mật khẩu
  const changePasswordForm = document.getElementById("changePasswordForm");
  if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", handleChangePassword);
  }
}

/**
 * Xử lý Đăng ký tài khoản mới
 */
async function handleRegisterSubmit(e) {
  e.preventDefault();
  clearAuthErrors();
  const name = document.getElementById("registerName")?.value.trim() || "";
  const email = document.getElementById("registerEmail")?.value.trim().toLowerCase() || "";
  const phone = document.getElementById("registerPhone")?.value.trim() || "";
  const password = document.getElementById("registerPassword")?.value || "";
  const confirm = document.getElementById("registerConfirmPassword")?.value || "";
  if (name.length < 2) return showAuthError("registerNameError", "Vui lòng nhập họ tên đầy đủ.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return showAuthError("registerEmailError", "Email không hợp lệ.");
  if (!/^0[35789]\d{8}$/.test(phone))
    return showAuthError("registerPhoneError", "Số điện thoại Việt Nam phải gồm 10 chữ số.");
  if (password.length < 12 || password.length > 128)
    return showAuthError("registerPasswordError", "Mật khẩu cần 12 đến 128 ký tự.");
  if (password !== confirm)
    return showAuthError("registerConfirmError", "Mật khẩu xác nhận không khớp.");
  if (!document.getElementById("registerTerms")?.checked)
    return showAuthError("registerTermsError", "Bạn cần đồng ý điều khoản.");
  if (typeof DeltaAPI === "undefined" || typeof DeltaAPI.register !== "function")
    return showAuthError("registerEmailError", "Không thể kết nối máy chủ đăng ký.");
  try {
    const result = await DeltaAPI.register({full_name:name, email, phone, password});
    if (!result?.success) return showAuthError("registerEmailError",
      result?.error || "Không đăng ký được trên máy chủ.");
    // Server confirms session. Never fabricate a user on transport failure.
    const me = await DeltaAPI.getMe();
    if (!me?.success || !me.data)
      return showAuthError("registerEmailError", "Đã tạo tài khoản. Vui lòng đăng nhập để xác minh phiên.");
    const u = me.data;
    const profile = {id:u.id, fullName:u.fullName, email:u.email, phone:u.phone,
      role:u.role || "CUSTOMER", title:"Thành viên"};
    const rest = getAllUsers().filter(x => x.id !== profile.id && x.email !== profile.email);
    saveUsers([...rest,profile]);
    setCurrentUser(profile);
    bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();
    document.getElementById("registerForm")?.reset();
    if (typeof showToast === "function") showToast("Đăng ký thành công trên máy chủ!", "success");

    const pendingTourId = sessionStorage.getItem("delta_pending_booking_tour_id");
    if (pendingTourId && !window.location.pathname.includes("booking.html")) {
      sessionStorage.removeItem("delta_pending_booking_tour_id");
      window.location.href = `booking.html?tourId=${encodeURIComponent(pendingTourId)}`;
    }
  } catch (_) {
    showAuthError("registerEmailError", "Lỗi kết nối máy chủ. Tài khoản không được tạo offline.");
  }
}

/**
 * Xử lý Đăng nhập tài khoản
 */
async function handleLoginSubmit(e) {
  e.preventDefault();
  clearAuthErrors();
  const account = document.getElementById("loginAccount")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  if (!account) return showAuthError("loginAccountError", "Vui lòng nhập email hoặc số điện thoại.");
  if (!password) return showAuthError("loginPasswordError", "Vui lòng nhập mật khẩu.");
  if (typeof DeltaAPI === "undefined" || typeof DeltaAPI.login !== "function")
    return showAuthError("loginGeneralError", "Không có máy chủ xác thực.");
  try {
    const res = await DeltaAPI.login(account,password);
    if (!res?.success || !res?.data) return showAuthError("loginGeneralError",
      res?.error || "Không thể xác thực trên máy chủ.");
    const u = res.data;
    const profile = {id:u.id, fullName:u.fullName, email:u.email, phone:u.phone,
      role:u.role || "CUSTOMER", title:u.role === "ADMIN" ? "Ban Quản Trị" : "Thành viên"};
    const rest = getAllUsers().filter(x => x.id !== profile.id && x.email !== profile.email);
    saveUsers([...rest,profile]);
    setCurrentUser(profile);
    bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();
    document.getElementById("loginForm")?.reset();
    if (typeof showToast === "function") showToast("Đăng nhập thành công!", "success");

    const pendingTourId = sessionStorage.getItem("delta_pending_booking_tour_id");
    if (pendingTourId && !window.location.pathname.includes("booking.html")) {
      sessionStorage.removeItem("delta_pending_booking_tour_id");
      window.location.href = `booking.html?tourId=${encodeURIComponent(pendingTourId)}`;
    }
  } catch (_) {
    showAuthError("loginGeneralError", "Máy chủ không phản hồi. Không hỗ trợ đăng nhập offline.");
  }
}

/**
 * Xử lý Quên mật khẩu
 */
async function handleForgotSubmit(e) {
  e.preventDefault();
  clearAuthErrors();
  const account = document.getElementById("forgotAccount")?.value.trim() || "";
  const newPass = document.getElementById("forgotNewPassword")?.value || "";
  const confirmPass = document.getElementById("forgotConfirmPassword")?.value || "";

  if (!account) return showAuthError("forgotAccountError", "Vui lòng nhập Email hoặc Số điện thoại.");
  if (!newPass || newPass.length < 6) return showAuthError("forgotNewPasswordError", "Mật khẩu mới phải có ít nhất 6 ký tự.");
  if (newPass !== confirmPass) return showAuthError("forgotConfirmPasswordError", "Mật khẩu xác nhận không khớp.");

  if (typeof DeltaAPI === "undefined" || typeof DeltaAPI.resetPassword !== "function") {
    return showAuthError("forgotAccountError", "Không thể kết nối máy chủ xác thực.");
  }

  try {
    const res = await DeltaAPI.resetPassword(account, newPass);
    if (!res || !res.success) {
      return showAuthError("forgotAccountError", res?.error || res?.detail || "Không thể đặt lại mật khẩu.");
    }
    if (res.user) {
      const u = res.user;
      const profile = { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, role: u.role || "CUSTOMER", title: u.role === "ADMIN" ? "Ban Quản Trị" : "Thành viên" };
      setCurrentUser(profile);
    }
    bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();
    document.getElementById("forgotForm")?.reset();
    if (typeof showToast === "function") {
      showToast("Đặt lại mật khẩu thành công! Đã tự động đăng nhập.", "success");
    }
  } catch (err) {
    showAuthError("forgotAccountError", err.message || "Lỗi kết nối máy chủ.");
  }
}

/**
 * Đăng xuất tài khoản
 */
async function handleUserLogout() {
  const isEn = typeof window.getAppLanguage === "function" && window.getAppLanguage() === "en";
  const ok = typeof showAppConfirm === "function"
    ? await showAppConfirm(
        isEn ? "Are you sure you want to sign out?" : "Bạn có chắc chắn muốn đăng xuất tài khoản?",
        isEn ? "Sign Out" : "Đăng Xuất",
        { danger: true, confirmText: isEn ? "Sign Out" : "Đăng xuất", cancelText: isEn ? "Cancel" : "Ở lại" }
      )
    : true;
  if (ok) {
    if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.logout === "function") {
      await DeltaAPI.logout().catch(() => {});
    }
    setCurrentUser(null);
    localStorage.removeItem("delta_customer_bookings");
    localStorage.removeItem("delta_user");
    sessionStorage.clear();

    if (typeof showAppToast === "function") {
      showAppToast(isEn ? "Signed out successfully." : "Bạn đã đăng xuất tài khoản thành công.", "info");
    } else if (typeof showToast === "function") {
      showToast("Bạn đã đăng xuất tài khoản thành công.", "info");
    }

    if (window.location.pathname.includes("my-bookings")) {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }
}

// =============================================================================
// V. MODAL THÔNG TIN TÀI KHOẢN (PROFILE MODAL - KẾT NỐI API THỰC TẾ)
// =============================================================================
async function openUserProfileModal() {
  let user = getCurrentUser();

  // Truy vấn dữ liệu mới nhất trực tiếp từ Backend API SQLite
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.getMe === "function") {
    try {
      const meRes = await DeltaAPI.getMe();
      if (meRes && meRes.success && meRes.data) {
        const u = meRes.data;
        user = {
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          role: u.role || "CUSTOMER",
          avatar: u.avatar || null,
          createdAt: u.createdAt || null,
          totalBookings: typeof u.totalBookings === "number" ? u.totalBookings : 0
        };
        setCurrentUser(user);
      }
    } catch (e) {
      console.warn("Không thể tải thông tin mới nhất từ máy chủ:", e);
    }
  }

  if (!user) {
    openAuthModal("login");
    return;
  }

  // Tách chữ cái đầu làm avatar nếu chưa có ảnh
  const names = (user.fullName || "Khách Hàng").trim().split(" ");
  const initials = names.length > 1
    ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
    : names[0].substring(0, 2).toUpperCase();

  const avatarEl = document.getElementById("profileAvatar");
  const nameEl = document.getElementById("profileFullName");
  const emailEl = document.getElementById("profileEmail");
  const phoneEl = document.getElementById("profilePhone");
  const createdEl = document.getElementById("profileCreatedAt");
  const rankEl = document.getElementById("profileMemberRank");
  const totalBookingsEl = document.getElementById("profileTotalBookings");

  if (avatarEl) {
    if (user.avatar) {
      avatarEl.innerHTML = `<img src="${user.avatar}" alt="${user.fullName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
      avatarEl.innerHTML = initials;
    }
  }
  if (nameEl) nameEl.textContent = user.fullName;
  if (emailEl) emailEl.textContent = user.email;
  if (phoneEl) phoneEl.textContent = user.phone;

  // Ngày tạo tài khoản thực tế từ database
  if (createdEl) {
    if (user.createdAt) {
      const d = new Date(user.createdAt);
      if (!isNaN(d.getTime())) {
        createdEl.textContent = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      } else {
        createdEl.textContent = String(user.createdAt);
      }
    } else {
      createdEl.textContent = "--/--/----";
    }
  }

  // Số lượng đơn hàng thực tế
  const total = typeof user.totalBookings === "number" ? user.totalBookings : 0;
  if (totalBookingsEl) totalBookingsEl.textContent = total;

  // Hạng thành viên tính toán theo dữ liệu thực tế
  if (rankEl) {
    const isEn = typeof getAppLanguage === "function" && getAppLanguage() === "en";
    if (user.role === "ADMIN") {
      rankEl.textContent = isEn ? "Administrator" : "Ban Quản Trị";
    } else if (total >= 5) {
      rankEl.textContent = isEn ? "Gold Member" : "Hạng Vàng";
    } else if (total >= 2) {
      rankEl.textContent = isEn ? "Silver Member" : "Hạng Bạc";
    } else {
      rankEl.textContent = isEn ? "Standard Member" : "Thành viên mới";
    }
  }

  // Điền sẵn vào form sửa thông tin
  const editName = document.getElementById("profileEditName");
  const editPhone = document.getElementById("profileEditPhone");
  const emailDisplay = document.getElementById("profileEmailDisplay");
  if (editName) editName.value = user.fullName;
  if (editPhone) editPhone.value = user.phone;
  if (emailDisplay) emailDisplay.value = user.email;

  const modalEl = document.getElementById("userProfileModal");
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Xử lý tải lên và đổi ảnh đại diện (Avatar) cho người dùng
 * Lưu trữ ảnh đại diện vào cơ sở dữ liệu SQLite
 */
function handleUserAvatarUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    if (typeof showAppNotice === "function") {
      showAppNotice("Vui lòng chọn một tệp hình ảnh (JPG, PNG, WebP) hợp lệ!", "Tệp Không Hợp Lệ", "warning");
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const rawBase64 = evt.target.result;
    
    // Nén ảnh nhỏ gọn qua HTML Canvas (~220x220)
    const img = new Image();
    img.onload = async function() {
      const canvas = document.createElement("canvas");
      const MAX_SIZE = 220;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round(height * (MAX_SIZE / width));
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width = Math.round(width * (MAX_SIZE / height));
          height = MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const optimizedBase64 = canvas.toDataURL("image/jpeg", 0.85);

      const user = getCurrentUser();
      if (!user) return;
      user.avatar = optimizedBase64;

      // Cập nhật ảnh đại diện lên SQLite Backend API
      if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.updateProfile === "function") {
        try {
          const apiRes = await DeltaAPI.updateProfile(user.fullName, user.phone, optimizedBase64);
          if (apiRes && apiRes.success && apiRes.data) {
            user.avatar = apiRes.data.avatar || optimizedBase64;
          }
        } catch (err) {
          console.warn("Lỗi lưu avatar lên server:", err);
        }
      }

      // Lưu trữ phiên đăng nhập
      setCurrentUser(user);

      // Cập nhật giao diện modal và header
      const avatarEl = document.getElementById("profileAvatar");
      if (avatarEl) {
        avatarEl.innerHTML = `<img src="${user.avatar}" alt="${user.fullName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      }
      renderAuthHeader();

      if (typeof showToast === "function") {
        showToast("Cập nhật ảnh đại diện thành công vào tài khoản!", "success");
      }
    };
    img.src = rawBase64;
  };
  reader.readAsDataURL(file);
}

/**
 * Cập nhật thông tin Họ tên, SĐT của tài khoản vào database
 */
async function handleProfileUpdate(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;

  const newName = document.getElementById("profileEditName")?.value.trim();
  const newPhone = document.getElementById("profileEditPhone")?.value.trim();

  if (!newName || newName.length < 2) {
    if (typeof showAppNotice === "function") {
      showAppNotice("Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự).", "Thông Tin Thiếu", "warning");
    }
    return;
  }

  const phoneRegex = /^0[35789]\d{8}$/;
  if (!newPhone || !phoneRegex.test(newPhone)) {
    if (typeof showAppNotice === "function") {
      showAppNotice("Số điện thoại không hợp lệ (10 số, bắt đầu 03, 05, 07, 08, 09).", "Số Điện Thoại Sai Định Dạng", "warning");
    }
    return;
  }

  // Luôn cập nhật trực tiếp qua API cơ sở dữ liệu
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.updateProfile === "function") {
    const res = await DeltaAPI.updateProfile(newName, newPhone, user.avatar);
    if (!res.success) {
      if (typeof showAppNotice === "function") {
        showAppNotice(res.error || "Không thể cập nhật hồ sơ trên máy chủ.", "Lỗi Cập Nhật", "error");
      } else if (typeof showToast === "function") {
        showToast(res.error || "Không thể cập nhật hồ sơ trên máy chủ.", "error");
      }
      return;
    }
    user.fullName = res.data.fullName || newName;
    user.phone = res.data.phone || newPhone;
  } else {
    user.fullName = newName;
    user.phone = newPhone;
  }

  setCurrentUser(user);
  openUserProfileModal();

  if (typeof showAppToast === "function") {
    showAppToast("Cập nhật thông tin tài khoản thành công!", "success");
  } else if (typeof showToast === "function") {
    showToast("Cập nhật thông tin tài khoản thành công!", "success");
  }
}

/**
 * Đổi mật khẩu trong hồ sơ cá nhân
 */
async function handleChangePassword(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;

  const currentPass = document.getElementById("profileCurrentPass")?.value;
  const newPass = document.getElementById("profileNewPass")?.value;
  const confirmNewPass = document.getElementById("profileConfirmNewPass")?.value;

  if (!newPass || newPass.length < 6) {
    if (typeof showAppNotice === "function") {
      showAppNotice("Mật khẩu mới phải có tối thiểu 6 ký tự!", "Mật Khẩu Quá Ngắn", "warning");
    }
    return;
  }

  if (newPass !== confirmNewPass) {
    if (typeof showAppNotice === "function") {
      showAppNotice("Mật khẩu xác nhận không khớp!", "Mật Khẩu Không Khớp", "warning");
    }
    return;
  }

  // Đổi mật khẩu qua API Backend
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.changePassword === "function") {
    const res = await DeltaAPI.changePassword(currentPass, newPass);
    if (!res.success) {
      const errMsg = res.error || "Mật khẩu hiện tại không chính xác.";
      if (typeof showAppNotice === "function") {
        showAppNotice(errMsg, "Đổi Mật Khẩu Thất Bại", "error");
      } else if (typeof showToast === "function") {
        showToast(errMsg, "error");
      }
      return;
    }
  }

  document.getElementById("changePasswordForm")?.reset();
  if (typeof showAppToast === "function") {
    showAppToast("Đổi mật khẩu thành công!", "success");
  } else if (typeof showToast === "function") {
    showToast("Đổi mật khẩu thành công!", "success");
  }
}

// =============================================================================
// VI. ĐỒNG BỘ AUTO-FILL VỚI FORM ĐẶT TOUR (BOOKING SYNC)
// =============================================================================
/**
 * Tự động điền thông tin tài khoản vào form đặt tour nếu đã đăng nhập (hỗ trợ cả modal và booking.html)
 */
function syncUserWithBookingForm() {
  const user = getCurrentUser();
  const nameInput = document.getElementById("customerFullName") || document.getElementById("customerName");
  const emailInput = document.getElementById("customerEmail");
  const phoneInput = document.getElementById("customerPhone");
  const authBanner = document.getElementById("bookingAuthRequiredBanner");
  const submitBtn = document.querySelector(".paper-btn-submit");

  if (user) {
    if (authBanner) authBanner.style.display = "none";
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = "";
      submitBtn.style.cursor = "pointer";
      submitBtn.onclick = () => { if (typeof submitBookingOrder === "function") submitBookingOrder(); };
      submitBtn.innerHTML = '<i class="bi bi-shield-check me-1"></i> <span data-i18n="booking_submit">Xác Nhận Đặt Tour & Thanh Toán</span>';
    }
    if (nameInput && (!nameInput.value || nameInput.value === "Nguyễn Văn A")) {
      nameInput.value = user.fullName || user.full_name || "";
    }
    if (emailInput && (!emailInput.value || emailInput.value === "example@email.com")) {
      emailInput.value = user.email || "";
    }
    if (phoneInput && (!phoneInput.value || phoneInput.value === "0901234567")) {
      phoneInput.value = user.phone || "";
    }
  } else {
    if (authBanner) authBanner.style.display = "block";
    if (submitBtn && !submitBtn.closest("#bookingSuccessReceipt")) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.75";
      submitBtn.style.cursor = "pointer";
      submitBtn.onclick = () => openAuthModal("login");
      submitBtn.innerHTML = '<i class="bi bi-shield-lock-fill me-1 text-warning"></i> Đăng Nhập Để Đặt Tour';
    }
  }
}

/**
 * Hook lắng nghe khi mở Booking Modal để auto-fill
 */
function hookBookingModalForAutoFill() {
  const bookingModalEl = document.getElementById("bookingModal");
  if (bookingModalEl) {
    bookingModalEl.addEventListener("show.bs.modal", () => {
      syncUserWithBookingForm();
    });
  }
}


/**
 * Điền nhanh thông tin tài khoản thành viên nhóm vào Form đăng nhập
 */
function fillQuickLogin(email, password) {
  const accountInput = document.getElementById("loginAccount");
  const passInput = document.getElementById("loginPassword");
  if (accountInput) accountInput.value = email;
  if (passInput) passInput.value = password;
}
