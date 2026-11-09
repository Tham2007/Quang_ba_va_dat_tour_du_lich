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
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Lưu danh sách users vào localStorage
 */
function saveUsers(users) {
  localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(users));
}

/**
 * Lấy tài khoản đang đăng nhập hiện tại từ LocalStorage
 */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Lưu tài khoản đang đăng nhập
 */
function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
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
      const res = await DeltaAPI.getSession();
      if (res && res.authenticated && res.user) {
        const u = res.user;
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
        // Kiểm tra xem có phiên hợp lệ qua DeltaAPI.getMe() không
        const meRes = await DeltaAPI.getMe();
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
          // Chưa đăng nhập trên backend
          localStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_USER);
          renderAuthHeader();
          syncUserWithBookingForm();
          return null;
        }
      }
    } catch (err) {
      console.warn("Lỗi đồng bộ phiên tài khoản:", err);
    }
  }
  renderAuthHeader();
  syncUserWithBookingForm();
  return getCurrentUser();
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
        <span class="text-light small me-2"><i class="bi bi-person-check text-warning"></i> ${user.fullName}</span>
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
function handleRegisterSubmit(e) {
  e.preventDefault();
  clearAuthErrors();

  const name = document.getElementById("registerName")?.value.trim();
  const email = document.getElementById("registerEmail")?.value.trim().toLowerCase();
  const phone = document.getElementById("registerPhone")?.value.trim();
  const password = document.getElementById("registerPassword")?.value;
  const confirmPassword = document.getElementById("registerConfirmPassword")?.value;
  const agreeTerms = document.getElementById("registerTerms")?.checked;

  let isValid = true;

  // 1. Kiểm tra Họ tên
  if (!name || name.length < 2) {
    showAuthError("registerNameError", "Vui lòng nhập họ và tên đầy đủ (tối thiểu 2 ký tự)");
    isValid = false;
  }

  // 2. Kiểm tra Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showAuthError("registerEmailError", "Email không đúng định dạng (VD: example@gmail.com)");
    isValid = false;
  }

  // 3. Kiểm tra Số điện thoại (10 số, bắt đầu 0)
  const phoneRegex = /^0[35789]\d{8}$/;
  if (!phone || !phoneRegex.test(phone)) {
    showAuthError("registerPhoneError", "Số điện thoại không hợp lệ (gồm 10 số, bắt đầu 03, 05, 07, 08, 09)");
    isValid = false;
  }

  // 4. Kiểm tra Mật khẩu (tối thiểu 6 ký tự)
  if (!password || password.length < 6) {
    showAuthError("registerPasswordError", "Mật khẩu phải có độ dài tối thiểu 6 ký tự");
    isValid = false;
  }

  // 5. Kiểm tra Xác nhận mật khẩu
  if (password !== confirmPassword) {
    showAuthError("registerConfirmError", "Mật khẩu xác nhận không khớp");
    isValid = false;
  }

  // 6. Kiểm tra đồng ý điều khoản
  if (!agreeTerms) {
    showAuthError("registerTermsError", "Bạn cần đồng ý với Điều khoản dịch vụ để tiếp tục");
    isValid = false;
  }

  if (!isValid) return;

  // 7. Kiểm tra trùng Email hoặc SĐT trong danh sách đã có
  const users = getAllUsers();
  const emailExists = users.some(u => u.email === email);
  if (emailExists) {
    showAuthError("registerEmailError", "Email này đã được sử dụng. Vui lòng chọn Email khác");
    return;
  }

  const phoneExists = users.some(u => u.phone === phone);
  if (phoneExists) {
    showAuthError("registerPhoneError", "Số điện thoại này đã được đăng ký tài khoản");
    return;
  }

  // 8. Đăng ký với Backend API nếu có
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.register === "function") {
    DeltaAPI.register({
      full_name: name,
      email: email,
      phone: phone,
      password: password
    }).then(res => {
      if (!res.success && !res.isOffline) {
        showAuthError("registerEmailError", res.error || "Đăng ký qua máy chủ thất bại.");
        return;
      }
      // Đăng nhập máy chủ để nhận session cookie
      DeltaAPI.login(email, password).then(loginRes => {
        const u = (loginRes && loginRes.success && loginRes.data) ? loginRes.data : null;
        const newUser = {
          id: u ? u.id : ("USR-" + Date.now()),
          fullName: u ? u.fullName : name,
          email: u ? u.email : email,
          phone: u ? u.phone : phone,
          password: password,
          role: u ? u.role : "CUSTOMER",
          title: (u && u.role === "ADMIN") ? "Ban Quản Trị" : "Thành viên mới",
          createdAt: new Date().toLocaleDateString("vi-VN")
        };
        users.push(newUser);
        saveUsers(users);
        setCurrentUser(newUser);
        bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();
        document.getElementById("registerForm")?.reset();
        if (typeof showToast === "function") {
          showToast(`Đăng ký thành công! Chào mừng ${newUser.fullName} gia nhập Delta Travel.`, "success");
        }
      });
    }).catch(err => {
      showAuthError("registerEmailError", err.message || "Lỗi đăng ký");
    });
    return;
  }

  const newUser = {
    id: "USR-" + Date.now(),
    fullName: name,
    email: email,
    phone: phone,
    password: password,
    role: "CUSTOMER",
    title: "Thành viên mới",
    createdAt: new Date().toLocaleDateString("vi-VN")
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);
  bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();
  document.getElementById("registerForm")?.reset();
  if (typeof showToast === "function") {
    showToast(`Đăng ký thành công! Chào mừng ${name} gia nhập Delta Travel.`, "success");
  }
}

/**
 * Xử lý Đăng nhập tài khoản
 */
async function handleLoginSubmit(e) {
  e.preventDefault();
  clearAuthErrors();

  const account = document.getElementById("loginAccount")?.value.trim().toLowerCase();
  const password = document.getElementById("loginPassword")?.value;

  if (!account) {
    showAuthError("loginAccountError", "Vui lòng nhập Email hoặc Số điện thoại");
    return;
  }

  if (!password) {
    showAuthError("loginPasswordError", "Vui lòng nhập mật khẩu");
    return;
  }

  // Thử đăng nhập qua Backend API trước nếu trực tuyến
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.login === "function") {
    const res = await DeltaAPI.login(account, password);
    if (res && res.success && res.data) {
      const u = res.data;
      const user = {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        password: password,
        role: u.role || "CUSTOMER",
        title: u.role === "ADMIN" ? "Ban Quản Trị" : "Thành viên",
        createdAt: new Date().toLocaleDateString("vi-VN")
      };
      const allUsers = getAllUsers();
      const existingIdx = allUsers.findIndex(item => item.id === user.id || item.email === user.email);
      if (existingIdx >= 0) allUsers[existingIdx] = user;
      else allUsers.push(user);
      saveUsers(allUsers);
      setCurrentUser(user);

      bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();
      document.getElementById("loginForm")?.reset();
      if (typeof showToast === "function") {
        showToast(`Đăng nhập thành công! Rất vui được gặp lại bạn, ${user.fullName}.`, "success");
      }
      return;
    } else if (res && !res.success && !res.isOffline) {
      showAuthError("loginGeneralError", res.error || "Tài khoản hoặc mật khẩu không chính xác.");
      return;
    }
  }

  // Fallback offline: Kiểm tra trong localStorage
  const users = getAllUsers();
  const user = users.find(u => u.email === account || u.phone === account);

  if (!user || user.password !== password) {
    showAuthError("loginGeneralError", "Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
    return;
  }

  // Đăng nhập thành công
  setCurrentUser(user);
  bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();
  document.getElementById("loginForm")?.reset();

  if (typeof showToast === "function") {
    showToast(`Đăng nhập thành công! Rất vui được gặp lại bạn, ${user.fullName}.`, "success");
  }
}

/**
 * Xử lý Quên mật khẩu
 */
function handleForgotSubmit(e) {
  e.preventDefault();
  clearAuthErrors();

  const account = document.getElementById("forgotAccount")?.value.trim().toLowerCase();
  const newPassword = document.getElementById("forgotNewPassword")?.value;
  const confirmPassword = document.getElementById("forgotConfirmPassword")?.value;

  if (!account) {
    showAuthError("forgotAccountError", "Vui lòng nhập Email hoặc Số điện thoại đã đăng ký");
    return;
  }

  if (!newPassword || newPassword.length < 6) {
    showAuthError("forgotNewPasswordError", "Mật khẩu mới phải có tối thiểu 6 ký tự");
    return;
  }

  if (newPassword !== confirmPassword) {
    showAuthError("forgotConfirmPasswordError", "Mật khẩu xác nhận không khớp");
    return;
  }

  const users = getAllUsers();
  const userIndex = users.findIndex(u => u.email === account || u.phone === account);

  if (userIndex === -1) {
    showAuthError("forgotAccountError", "Không tìm thấy tài khoản nào với Email hoặc Số điện thoại này");
    return;
  }

  // Cập nhật mật khẩu mới
  users[userIndex].password = newPassword;
  saveUsers(users);

  // Nếu người này đang đăng nhập thì cập nhật luôn
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === users[userIndex].id) {
    setCurrentUser(users[userIndex]);
  }

  // Thông báo và chuyển về tab đăng nhập
  if (typeof showToast === "function") {
    showToast("Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.", "success");
  }

  // Điền sẵn account vào tab đăng nhập
  const loginAccountInput = document.getElementById("loginAccount");
  if (loginAccountInput) loginAccountInput.value = account;

  switchAuthTab("login");
  document.getElementById("forgotForm")?.reset();
}

/**
 * Đăng xuất tài khoản
 */
function handleUserLogout() {
  if (confirm("Bạn có chắc chắn muốn đăng xuất tài khoản?")) {
    if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.logout === "function") {
      DeltaAPI.logout().catch(() => {});
    }
    setCurrentUser(null);
    if (typeof showToast === "function") {
      showToast("Bạn đã đăng xuất tài khoản thành công.", "info");
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
    alert("Vui lòng chọn một tệp hình ảnh (JPG, PNG, WebP) hợp lệ!");
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
    alert("Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự).");
    return;
  }

  const phoneRegex = /^0[35789]\d{8}$/;
  if (!newPhone || !phoneRegex.test(newPhone)) {
    alert("Số điện thoại không hợp lệ (10 số, bắt đầu 03, 05, 07, 08, 09).");
    return;
  }

  // Luôn cập nhật trực tiếp qua API cơ sở dữ liệu
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.updateProfile === "function") {
    const res = await DeltaAPI.updateProfile(newName, newPhone, user.avatar);
    if (!res.success) {
      if (typeof showToast === "function") {
        showToast(res.error || "Không thể cập nhật hồ sơ trên máy chủ.", "error");
      } else {
        alert(res.error || "Không thể cập nhật hồ sơ.");
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

  if (typeof showToast === "function") {
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
    alert("Mật khẩu mới phải có tối thiểu 6 ký tự!");
    return;
  }

  if (newPass !== confirmNewPass) {
    alert("Mật khẩu xác nhận không khớp!");
    return;
  }

  // Đổi mật khẩu qua API Backend
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.changePassword === "function") {
    const res = await DeltaAPI.changePassword(currentPass, newPass);
    if (!res.success) {
      if (typeof showToast === "function") {
        showToast(res.error || "Mật khẩu hiện tại không chính xác.", "error");
      } else {
        alert(res.error || "Mật khẩu hiện tại không chính xác.");
      }
      return;
    }
  }

  document.getElementById("changePasswordForm")?.reset();
  if (typeof showToast === "function") {
    showToast("Đổi mật khẩu thành công!", "success");
  }
}

// =============================================================================
// VI. ĐỒNG BỘ AUTO-FILL VỚI FORM ĐẶT TOUR (BOOKING SYNC)
// =============================================================================
/**
 * Tự động điền thông tin tài khoản vào form đặt tour nếu đã đăng nhập
 */
function syncUserWithBookingForm() {
  const user = getCurrentUser();
  const nameInput = document.getElementById("customerName");
  const emailInput = document.getElementById("customerEmail");
  const phoneInput = document.getElementById("customerPhone");

  if (user) {
    if (nameInput && !nameInput.value) nameInput.value = user.fullName;
    if (emailInput && !emailInput.value) emailInput.value = user.email;
    if (phoneInput && !phoneInput.value) phoneInput.value = user.phone;
  }
}

/**
 * Hook lắng nghe khi mở Booking Modal để auto-fill
 */
function hookBookingModalForAutoFill() {
  const bookingModalEl = document.getElementById("bookingModal");
  if (bookingModalEl) {
    bookingModalEl.addEventListener("show.bs.modal", () => {
      const user = getCurrentUser();
      if (user) {
        const nameInput = document.getElementById("customerName");
        const emailInput = document.getElementById("customerEmail");
        const phoneInput = document.getElementById("customerPhone");

        if (nameInput) nameInput.value = user.fullName;
        if (emailInput) emailInput.value = user.email;
        if (phoneInput) phoneInput.value = user.phone;
      }
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
