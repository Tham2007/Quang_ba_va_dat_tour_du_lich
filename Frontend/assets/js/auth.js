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

// Danh sách tài khoản của 5 thành viên nhóm phát triển Delta Travel
const DEFAULT_DEMO_USERS = [
  {
    id: "USR-01",
    fullName: "Hồng Thắm",
    email: "hongtham@deltatravel.vn",
    phone: "0901112233",
    password: "password123",
    role: "ADMIN",
    title: "Trưởng nhóm",
    createdAt: "01/10/2026"
  },
  {
    id: "USR-02",
    fullName: "Lê Văn An",
    email: "an.levan@gmail.com",
    phone: "0987654321",
    password: "password123",
    role: "ADMIN",
    title: "Thành viên nhóm",
    createdAt: "15/10/2026"
  },
  {
    id: "USR-03",
    fullName: "Lê Hải Đăng",
    email: "haidang@deltatravel.vn",
    phone: "0902223344",
    password: "password123",
    role: "ADMIN",
    title: "Thành viên nhóm",
    createdAt: "01/10/2026"
  },
  {
    id: "USR-04",
    fullName: "Nguyễn Phúc",
    email: "nguyenphuc@deltatravel.vn",
    phone: "0903334455",
    password: "password123",
    role: "ADMIN",
    title: "Thành viên nhóm",
    createdAt: "01/10/2026"
  },
  {
    id: "USR-05",
    fullName: "Mạnh Lê",
    email: "manhle@deltatravel.vn",
    phone: "0905556677",
    password: "password123",
    role: "ADMIN",
    title: "Thành viên nhóm",
    createdAt: "01/10/2026"
  },
  {
    id: "USR-ADMIN",
    fullName: "Ban Quản Trị Nhóm",
    email: "admin@deltatravel.vn",
    phone: "0900009999",
    password: "admin123456",
    role: "ADMIN",
    title: "Nhóm Dự Án",
    createdAt: "01/10/2026"
  }
];

/**
 * Lấy danh sách tài khoản đã đăng ký từ localStorage
 */
function getAllUsers() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.USERS);
    let users = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(users) || users.length === 0) {
      users = [...DEFAULT_DEMO_USERS];
      localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(users));
      return users;
    }
    let changed = false;
    DEFAULT_DEMO_USERS.forEach(demo => {
      const idx = users.findIndex(u => u.email === demo.email);
      if (idx === -1) {
        users.push(demo);
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(users));
    }
    return users;
  } catch (e) {
    console.error("Lỗi đọc danh sách users:", e);
    return [...DEFAULT_DEMO_USERS];
  }
}

/**
 * Lưu danh sách users vào localStorage
 */
function saveUsers(users) {
  localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(users));
}

/**
 * Lấy tài khoản đang đăng nhập hiện tại
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

// =============================================================================
// II. KHỞI TẠO GIAO DIỆN KHI TRANG TẢI
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  getAllUsers(); // Đảm bảo khởi tạo demo user
  renderAuthHeader();
  initAuthEventListeners();
  hookBookingModalForAutoFill();
});

/**
 * Hiển thị trạng thái Đăng nhập / Đăng ký trên Header
 */
function renderAuthHeader() {
  const container = document.getElementById("headerAuthContainer");
  const topbarContainer = document.getElementById("topbarAuthContainer");
  const user = getCurrentUser();

  if (user) {
    // Tách lấy chữ cái đầu để làm Avatar
    const names = user.fullName.trim().split(" ");
    const initials = names.length > 1
      ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
      : names[0].substring(0, 2).toUpperCase();

    const htmlContent = `
      <div class="d-inline-flex align-items-center gap-1.5">
        <!-- Liquid Glass User Profile Pill -->
        <button type="button" class="liquid-user-glass" onclick="openUserProfileModal()" title="Hồ sơ tài khoản & Đơn đặt">
          <div class="user-avatar-gold-rim">${initials}</div>
          <span class="liquid-user-name">${user.fullName}</span>
        </button>

        <!-- Logout Button in Matching Glass Pill -->
        <button type="button" class="liquid-logout-btn" onclick="handleUserLogout()" title="Đăng xuất tài khoản">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    `;

    if (container) container.innerHTML = htmlContent;
    if (topbarContainer) {
      topbarContainer.innerHTML = `
        <span class="text-light small me-2"><i class="bi bi-person-check text-warning"></i> ${user.fullName}</span>
        <a href="javascript:void(0)" onclick="handleUserLogout()" class="text-warning small text-decoration-none">Đăng xuất</a>
      `;
    }
  } else {
    // Trạng thái chưa đăng nhập: 2 nút kính chuẩn Apple Liquid Glass
    const htmlBtn = `
      <div class="d-inline-flex align-items-center gap-1.5">
        <button type="button" class="btn btn-sm btn-outline-dark rounded-pill px-2.5 px-sm-3 py-1.5 fw-bold" style="font-size: 12px; background: rgba(255,255,255,0.7); backdrop-filter: blur(12px);" onclick="openAuthModal('login')">
          Đăng nhập
        </button>
        <button type="button" class="btn btn-sm btn-dark rounded-pill px-3 py-1.5 fw-bold text-white shadow-sm d-none d-sm-inline-block" style="font-size: 12px;" onclick="openAuthModal('register')">
          Đăng ký
        </button>
      </div>
    `;

    if (container) container.innerHTML = htmlBtn;
    if (topbarContainer) {
      topbarContainer.innerHTML = `
        <a href="javascript:void(0)" onclick="openAuthModal('login')"><i class="bi bi-box-arrow-in-right text-warning"></i> Đăng nhập</a>
        <span class="topbar-divider"></span>
        <a href="javascript:void(0)" onclick="openAuthModal('register')"><i class="bi bi-person-plus text-info"></i> Đăng ký</a>
      `;
    }
  }
}

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
  const phoneRegex = /^0[3|5|7|8|9]\d{8}$/;
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

  // 8. Tạo tài khoản mới
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

  // Tự động đăng nhập
  setCurrentUser(newUser);

  // Đóng modal
  bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();

  // Reset form
  document.getElementById("registerForm")?.reset();

  // Hiển thị thông báo thành công
  if (typeof showToast === "function") {
    showToast(`Đăng ký thành công! Chào mừng ${name} gia nhập Delta Travel.`, "success");
  }
}

/**
 * Xử lý Đăng nhập tài khoản
 */
function handleLoginSubmit(e) {
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

  const users = getAllUsers();
  const user = users.find(u => u.email === account || u.phone === account);

  if (!user || user.password !== password) {
    showAuthError("loginGeneralError", "Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
    return;
  }

  // Đăng nhập thành công
  setCurrentUser(user);

  // Đóng modal
  bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();

  // Reset form
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
    setCurrentUser(null);
    if (typeof showToast === "function") {
      showToast("Bạn đã đăng xuất tài khoản thành công.", "info");
    }
  }
}

// =============================================================================
// V. MODAL THÔNG TIN TÀI KHOẢN (PROFILE MODAL)
// =============================================================================
function openUserProfileModal() {
  const user = getCurrentUser();
  if (!user) {
    openAuthModal("login");
    return;
  }

  // Cập nhật thông tin vào modal Profile
  const names = user.fullName.trim().split(" ");
  const initials = names.length > 1
    ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
    : names[0].substring(0, 2).toUpperCase();

  const avatarEl = document.getElementById("profileAvatar");
  const nameEl = document.getElementById("profileFullName");
  const emailEl = document.getElementById("profileEmail");
  const phoneEl = document.getElementById("profilePhone");
  const createdEl = document.getElementById("profileCreatedAt");
  const totalBookingsEl = document.getElementById("profileTotalBookings");

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = user.fullName;
  if (emailEl) emailEl.textContent = user.email;
  if (phoneEl) phoneEl.textContent = user.phone;
  if (createdEl) createdEl.textContent = user.createdAt || "15/10/2026";

  // Đếm số lượng đơn hàng của user này trong delta_bookings
  try {
    const bookings = JSON.parse(localStorage.getItem("delta_bookings_v2")) || [];
    const userBookings = bookings.filter(b => 
      b.customer?.email?.toLowerCase() === user.email.toLowerCase() ||
      b.customer?.phone === user.phone ||
      b.userId === user.id
    );
    if (totalBookingsEl) totalBookingsEl.textContent = userBookings.length;
  } catch (e) {
    if (totalBookingsEl) totalBookingsEl.textContent = "0";
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
 * Cập nhật thông tin Họ tên, SĐT của tài khoản
 */
function handleProfileUpdate(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;

  const newName = document.getElementById("profileEditName")?.value.trim();
  const newPhone = document.getElementById("profileEditPhone")?.value.trim();

  if (!newName || newName.length < 2) {
    alert("Vui lòng nhập họ và tên hợp lệ.");
    return;
  }

  const phoneRegex = /^0[3|5|7|8|9]\d{8}$/;
  if (!newPhone || !phoneRegex.test(newPhone)) {
    alert("Số điện thoại không hợp lệ (10 số, bắt đầu 03, 05, 07, 08, 09).");
    return;
  }

  const users = getAllUsers();
  // Kiểm tra nếu đổi SĐT mà bị trùng với tài khoản khác
  if (newPhone !== user.phone) {
    const exists = users.some(u => u.phone === newPhone && u.id !== user.id);
    if (exists) {
      alert("Số điện thoại này đã được sử dụng bởi tài khoản khác.");
      return;
    }
  }

  const userIndex = users.findIndex(u => u.id === user.id);
  if (userIndex !== -1) {
    users[userIndex].fullName = newName;
    users[userIndex].phone = newPhone;
    saveUsers(users);

    user.fullName = newName;
    user.phone = newPhone;
    setCurrentUser(user);

    openUserProfileModal(); // Tải lại modal
    if (typeof showToast === "function") {
      showToast("Cập nhật thông tin tài khoản thành công!", "success");
    }
  }
}

/**
 * Đổi mật khẩu trong hồ sơ cá nhân
 */
function handleChangePassword(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;

  const currentPass = document.getElementById("profileCurrentPass")?.value;
  const newPass = document.getElementById("profileNewPass")?.value;
  const confirmNewPass = document.getElementById("profileConfirmNewPass")?.value;

  if (currentPass !== user.password) {
    alert("Mật khẩu hiện tại không chính xác!");
    return;
  }

  if (!newPass || newPass.length < 6) {
    alert("Mật khẩu mới phải có tối thiểu 6 ký tự!");
    return;
  }

  if (newPass !== confirmNewPass) {
    alert("Mật khẩu xác nhận không khớp!");
    return;
  }

  const users = getAllUsers();
  const userIndex = users.findIndex(u => u.id === user.id);
  if (userIndex !== -1) {
    users[userIndex].password = newPass;
    saveUsers(users);

    user.password = newPass;
    setCurrentUser(user);

    document.getElementById("changePasswordForm")?.reset();
    if (typeof showToast === "function") {
      showToast("Đổi mật khẩu thành công!", "success");
    }
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
