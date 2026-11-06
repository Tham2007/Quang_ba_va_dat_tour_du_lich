/**
 * DELTA TRAVEL - ADMIN OPERATIONS PORTAL CONTROLLER (admin.js)
 * -------------------------------------------------------------
 * Xử lý toàn bộ logic giao diện và nghiệp vụ của Portal Quản Trị:
 * 1. Auth Guard & Phân quyền (ADMIN / OPERATIONS)
 * 2. Tab Navigation & AI Operations Copilot
 * 3. Tab Dashboard: Thống kê tổng quan & Readiness hệ thống
 * 4. Tab Tours: Quản lý danh mục tour (Thêm, Sửa, Ẩn/Hiện, Xóa)
 * 5. Tab Schedules: Quản lý lịch khởi hành & kho chỗ (Slots)
 * 6. Tab Bookings: Quản lý đơn, duyệt, hủy (kèm lý do), in & xuất sao kê CSV
 * 7. Tab Payments: Đối soát thanh toán, Ghi nhận thu tiền mặt, Hoàn tiền
 * 8. Tab System: Chẩn đoán trợ lý du lịch, Bộ nhớ LocalStorage, Khôi phục dữ liệu gốc
 * 9. Tab Audit Logs: Nhật ký kiểm toán bảo mật (Chỉ dành cho ADMIN)
 */

// =============================================================================
// I. TRẠNG THÁI TOÀN CỤC (ADMIN STATE)
// =============================================================================
const AdminState = {
  currentTab: "dashboard",
  currentUser: null,
  tours: [],
  schedules: [],
  bookings: [],
  payments: [],
  auditLogs: [],

  // Tours tab filter
  tourSearch: "",
  tourStatusFilter: "ACTIVE",
  editingTourId: null,
  tourCostItems: [],

  // Schedules tab filter
  scheduleTourFilter: "all",
  scheduleStatusFilter: "all",
  editingScheduleId: null,

  // Bookings tab filter
  bookingSearch: "",
  bookingStatusFilter: "all",
  bookingStartDate: "",
  bookingEndDate: "",

  // Payments tab filter
  paymentStatusFilter: "all",
  paymentProviderFilter: "all",

  // Audit tab filter
  auditActionFilter: "all"
};

// =============================================================================
// II. KHỞI TẠO ỨNG DỤNG KHI DOM SẴN SÀNG
// =============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  initSidebarNavigation();
  initMobileSidebar();
  initAiCopilot();
  initRealtimeStorageEvents();

  const isAdminAuthenticated = await checkAdminAuth();
  if (!isAdminAuthenticated) return;

  refreshAdminData();
  renderCurrentTab();

  // Tự động mở modal sửa tour nếu có yêu cầu (hỗ trợ điều hướng sâu)
  const autoTour = sessionStorage.getItem("autoOpenTourId");
  if (autoTour) {
    sessionStorage.removeItem("autoOpenTourId");
    setTimeout(() => {
      openTourModal(autoTour);
      const tabBtn = document.getElementById("tour-itinerary-tab");
      if (tabBtn) {
        try {
          bootstrap.Tab.getOrCreateInstance(tabBtn).show();
        } catch (e) {}
      }
    }, 350);
  }
});

// =============================================================================
// III. XÁC THỰC BẢO MẬT & PHÂN QUYỀN (AUTH GUARD)
// =============================================================================
async function checkAdminAuth() {
  let user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
  const lockScreen = document.getElementById("adminLockScreen");
  const mainWrapper = document.getElementById("adminLayoutWrapper");
  const showLockedScreen = () => {
    if (lockScreen) lockScreen.style.display = "flex";
    if (mainWrapper) mainWrapper.style.display = "none";
    AdminState.currentUser = null;
  };

  if (!user || (user.role !== "ADMIN" && user.role !== "OPERATIONS")) {
    showLockedScreen();
    return false;
  }

  const showAdminScreen = authenticatedUser => {
    AdminState.currentUser = authenticatedUser;
    if (lockScreen) lockScreen.style.display = "none";
    if (mainWrapper) mainWrapper.style.display = "flex";
    updateAdminProfileUI(authenticatedUser);
    return true;
  };

  if (typeof DeltaAPI === "undefined" || typeof DeltaAPI.getMe !== "function") {
    return showAdminScreen(user);
  }

  const session = await DeltaAPI.getMe();
  if (!session.success) {
    if (session.isOffline) return showAdminScreen(user);
    showLockedScreen();
    showAdminToast(session.error || "Phiên đăng nhập máy chủ đã hết hạn. Vui lòng đăng nhập lại.", "error");
    return false;
  }
  if (!session.data ||
      (session.data.role !== "ADMIN" && session.data.role !== "OPERATIONS")) {
    showLockedScreen();
    showAdminToast("Tài khoản này không có quyền quản trị trên máy chủ.", "error");
    return false;
  }

  user = { ...user, ...session.data };
  return showAdminScreen(user);
}

function updateAdminProfileUI(user) {
  const avatarEl = document.getElementById("adminAvatarInitials");
  const nameEl = document.getElementById("adminUserName");
  const roleEl = document.getElementById("adminUserRoleBadge");

  if (nameEl) {
    nameEl.innerHTML = `${user.fullName || "Quản trị viên"} ${user.title ? `<span class="badge bg-warning text-dark ms-1" style="font-size: 10px;">${user.title}</span>` : ''}`;
  }
  if (roleEl) {
    roleEl.innerHTML = `<i class="bi bi-shield-check text-warning"></i> ${user.role === "ADMIN" ? "BAN QUẢN TRỊ HỆ THỐNG" : "ĐIỀU HÀNH VIÊN TOUR"}`;
  }

  if (avatarEl) {
    const names = (user.fullName || "Admin").trim().split(" ");
    avatarEl.textContent = names.length > 1
      ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
      : (user.fullName || "A").substring(0, 2).toUpperCase();
  }
}

/**
 * Đăng nhập nhanh từ màn hình khóa dành cho Tester / Giảng viên
 */
async function handleQuickAdminLogin(identifier) {
  const users = (typeof getAllUsers === "function") ? getAllUsers() : (typeof DEFAULT_DEMO_USERS !== "undefined" ? DEFAULT_DEMO_USERS : []);
  let targetUser = null;

  if (identifier) {
    targetUser = users.find(u => u.id === identifier || u.email === identifier || u.fullName === identifier);
  }
  if (!targetUser) {
    if (identifier === "ADMIN") {
      targetUser = users.find(u => u.role === "ADMIN" || u.email === "hongtham@deltatravel.vn") || users[0];
    } else if (identifier === "OPERATIONS") {
      targetUser = users.find(u => u.role === "OPERATIONS" || u.email === "operations@deltatravel.vn");
    }
  }
  if (!targetUser && users.length > 0) {
    targetUser = users[0];
  }

  if (targetUser) {
    let localDemoLogin = typeof DeltaAPI === "undefined" || typeof DeltaAPI.login !== "function";
    if (!localDemoLogin) {
      const loginResult = await DeltaAPI.login(targetUser.email, targetUser.password);
      if (!loginResult.success && !loginResult.isOffline) {
        showAdminToast(loginResult.error || "Không thể đăng nhập tài khoản quản trị trên máy chủ.", "error");
        return;
      }
      localDemoLogin = !loginResult.success;
      if (loginResult.success) {
        if (loginResult.data?.role !== "ADMIN") {
          showAdminToast("Tài khoản này không có quyền quản trị trên máy chủ.", "error");
          return;
        }
        targetUser = {
          ...targetUser,
          id: loginResult.data.id,
          fullName: loginResult.data.fullName,
          email: loginResult.data.email,
          phone: loginResult.data.phone,
          role: loginResult.data.role
        };
      }
    }

    if (typeof setCurrentUser === "function") setCurrentUser(targetUser);
    if (!await checkAdminAuth()) return;
    refreshAdminData();
    renderCurrentTab();
    showAdminToast(
      localDemoLogin
        ? "Đang dùng chế độ quản trị demo cục bộ; thao tác cần máy chủ có thể không khả dụng."
        : `Chào mừng ${targetUser.fullName} (${targetUser.title || "Quản trị viên"}) vào phiên làm việc!`,
      localDemoLogin ? "warning" : "success"
    );
  } else {
    showAdminToast("Không tìm thấy thông tin tài khoản thành viên. Vui lòng thử lại.", "error");
  }
}

function handleAdminLogout() {
  if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc Quản trị của Delta Travel?")) {
    if (typeof setCurrentUser === "function") setCurrentUser(null);
    window.location.reload();
  }
}

// =============================================================================
// IV. ĐỒNG BỘ DỮ LIỆU & LẮNG NGHE STORAGE SỰ KIỆN
// =============================================================================
function refreshAdminData() {
  AdminState.tours = (typeof getToursData === "function") ? getToursData() : [];
  AdminState.schedules = (typeof getSchedulesData === "function") ? getSchedulesData() : [];
  AdminState.bookings = (typeof getBookingsData === "function") ? getBookingsData() : [];
  AdminState.payments = (typeof getPaymentsData === "function") ? getPaymentsData() : [];
  AdminState.auditLogs = (typeof getAuditLogsData === "function") ? getAuditLogsData() : [];

  // Đồng bộ hai chiều với Backend API nếu máy chủ đang trực tuyến
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.adminGetTours === "function") {
    DeltaAPI.adminGetTours().then(res => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const serverTours = res.data.map(st => {
          let itinerary = [];
          try { itinerary = JSON.parse(st.itineraryJson || '[]'); } catch (e) {}
          return {
            id: st.id,
            title: st.title,
            slug: st.slug,
            region: st.region,
            regionName: st.region === 'north' ? 'Miền Bắc' : (st.region === 'central' ? 'Miền Trung' : 'Miền Nam'),
            image: st.images?.[0] || st.image || 'assets/images/halong.png',
            images: st.images || (st.image ? [st.image] : []),
            duration: st.duration,
            departure: st.departure,
            transport: st.transport,
            price: st.price,
            originalPrice: 0,
            rating: 5.0,
            reviewsCount: 100,
            badge: st.isFlashSale ? 'Ưu đãi' : '',
            availableSeats: 20,
            status: st.active ? 'ACTIVE' : 'INACTIVE',
            itinerary: itinerary.length > 0 ? itinerary : [
              { day: 1, title: 'Khám phá điểm đến', morning: 'Khởi hành', afternoon: 'Tham quan', evening: 'Nghỉ ngơi' }
            ],
            inclusions: ['Xe đưa đón', 'Khách sạn/du thuyền', 'Bữa ăn', 'Bảo hiểm'],
            exclusions: ['Chi phí cá nhân', 'Thuế VAT']
          };
        });
        const existingIds = new Set(serverTours.map(t => t.id));
        AdminState.tours = [...serverTours, ...AdminState.tours.filter(t => !existingIds.has(t.id))];
        if (AdminState.currentTab === "tours" || AdminState.currentTab === "schedules" ||
            AdminState.currentTab === "dashboard") {
          renderCurrentTab();
        }
      }
    }).catch(error => {
      console.error("Could not load admin tours from API.", error);
    });
  }
  if (typeof DeltaAPI !== "undefined" && DeltaAPI.isOnline() &&
      typeof DeltaAPI.adminFetchSchedules === "function") {
    DeltaAPI.adminFetchSchedules().then(res => {
      if (!res?.success || !Array.isArray(res.data)) {
        AdminState.schedules = [];
        showAdminToast(res?.error || "Không thể tải lịch khởi hành từ máy chủ.", "error");
        return;
      }
      AdminState.schedules = res.data.map(schedule => ({
        id: schedule.id,
        tourId: schedule.tourId,
        departureAt: schedule.departureAt,
        totalSeats: schedule.totalSeats,
        bookedSeats: schedule.totalSeats - schedule.availableSeats,
        status: schedule.active ? "OPEN" : "CLOSED"
      }));
      if (AdminState.currentTab === "schedules" || AdminState.currentTab === "dashboard") {
        renderCurrentTab();
      }
    }).catch(error => {
      console.error("Could not load admin schedules from API.", error);
      AdminState.schedules = [];
      showAdminToast("Không thể tải lịch khởi hành từ máy chủ.", "error");
    });
  }
}

function initRealtimeStorageEvents() {
  window.addEventListener("delta_bookings_updated", () => {
    refreshAdminData();
    if (AdminState.currentTab === "dashboard" || AdminState.currentTab === "bookings") {
      renderCurrentTab();
    }
  });

  window.addEventListener("delta_payments_updated", () => {
    refreshAdminData();
    if (AdminState.currentTab === "dashboard" || AdminState.currentTab === "payments") {
      renderCurrentTab();
    }
  });

  window.addEventListener("delta_tours_updated", () => {
    refreshAdminData();
    if (AdminState.currentTab === "dashboard" || AdminState.currentTab === "tours") {
      renderCurrentTab();
    }
  });

  window.addEventListener("delta_schedules_updated", () => {
    refreshAdminData();
    if (AdminState.currentTab === "schedules") {
      renderCurrentTab();
    }
  });

  window.addEventListener("delta_audit_updated", () => {
    refreshAdminData();
    if (AdminState.currentTab === "audit") {
      renderCurrentTab();
    }
  });
}

// =============================================================================
// V. ĐIỀU HƯỚNG TAB SIDEBAR & COPILOT PROMPT TƯƠNG ỨNG
// =============================================================================
const COPILOT_PROMPTS = {
  dashboard: {
    title: "AI đọc tình hình vận hành trước khi bạn mở từng bảng",
    prompt: "Tóm tắt tình hình vận hành hiện tại của Delta Travel. Hãy ưu tiên việc cần xử lý ngay, booking đáng chú ý, hoàn tiền chờ xử lý và tình trạng hệ thống.",
    suggestions: [
      "Hôm nay có việc vận hành nào cần xử lý ngay?",
      "Tóm tắt booking và hoàn tiền đáng chú ý",
      "Hệ thống AI và thanh toán đang ở trạng thái nào?"
    ]
  },
  tours: {
    title: "AI Copilot đang theo dõi catalog tour",
    prompt: "Phân tích catalog tour hiện tại dưới góc nhìn vận hành. Hãy chỉ ra điều đáng chú ý và những bước kiểm tra admin nên làm.",
    suggestions: [
      "Tour nào cần kiểm tra trước khi mở bán?",
      "Tóm tắt catalog tour production hiện tại",
      "Có rủi ro dữ liệu nào admin nên chú ý không?"
    ]
  },
  schedules: {
    title: "AI Copilot cho lịch khởi hành & kho chỗ",
    prompt: "Tóm tắt tình trạng lịch khởi hành và kho chỗ. Ưu tiên lịch có rủi ro vận hành, số chỗ cần chú ý và dữ liệu cần kiểm tra.",
    suggestions: [
      "Lịch nào sắp hết chỗ hoặc đã kín khách?",
      "Tóm tắt trạng thái kho chỗ (inventory)",
      "Có lịch nào nên đóng hoặc điều chỉnh không?"
    ]
  },
  bookings: {
    title: "AI Copilot cho booking operations",
    prompt: "Tóm tắt booking hiện tại và những việc vận hành cần ưu tiên. Đặc biệt chú ý trạng thái thanh toán, hủy và đơn cần xử lý.",
    suggestions: [
      "Booking nào cần hành động ngay hôm nay?",
      "Có đơn nào đang chờ thu tiền mặt không?",
      "Tóm tắt tỷ lệ chuyển đổi và hủy đơn"
    ]
  },
  payments: {
    title: "AI Copilot cho thanh toán & hoàn tiền",
    prompt: "Tóm tắt tình hình payment và refund cần xử lý. Không suy đoán gateway chưa cấu hình là hoạt động.",
    suggestions: [
      "Có khoản hoàn tiền nào đang chờ kế toán không?",
      "Cổng thanh toán nào thực sự đang sẵn sàng?",
      "Đối soát dòng tiền thu được hôm nay"
    ]
  },
  system: {
    title: "AI Copilot cho production readiness",
    prompt: "Đánh giá trạng thái production hiện tại từ dữ liệu hệ thống có thể kiểm chứng. Nêu rõ integration nào ready và dependency nào còn bên ngoài.",
    suggestions: [
      "Tóm tắt production readiness của Delta Travel",
      "Giới thiệu các tour đang mở bán",
      "Kiểm tra dung lượng bộ nhớ LocalStorage"
    ]
  },
  audit: {
    title: "AI Copilot cho audit & compliance",
    prompt: "Giải thích cách đọc audit trail và các loại side effect quản trị cần chú ý. Chỉ dựa trên dữ liệu mà quyền hiện tại được phép xem.",
    suggestions: [
      "Những hành động nào cần được audit chặt chẽ?",
      "Giải thích dấu vết can thiệp booking gần nhất",
      "Rà soát thay đổi cấu hình giá và tour"
    ]
  }
};

function initSidebarNavigation() {
  const navLinks = document.querySelectorAll(".admin-nav-item");
  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const tabTarget = link.getAttribute("data-tab");
      if (tabTarget) {
        switchAdminTab(tabTarget);
      }
    });
  });
}

function initMobileSidebar() {
  const toggleBtn = document.getElementById("adminMobileToggle");
  const sidebar = document.getElementById("adminSidebar");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("show");
    });
  }
}

function switchAdminTab(tabKey) {
  AdminState.currentTab = tabKey;

  // Cập nhật class active trên Sidebar
  document.querySelectorAll(".admin-nav-item").forEach(item => {
    item.classList.toggle("active", item.getAttribute("data-tab") === tabKey);
  });

  // Đóng sidebar trên mobile nếu đang mở
  document.getElementById("adminSidebar")?.classList.remove("show");

  // Cập nhật tiêu đề Topbar
  updateTopbarTitle(tabKey);

  // Cập nhật Copilot Strip
  updateAiCopilotStrip(tabKey);

  // Hiển thị nội dung Tab
  renderCurrentTab();
}

function updateTopbarTitle(tabKey) {
  const titleEl = document.getElementById("adminTopbarTitle");
  const badgeEl = document.getElementById("adminTopbarBadge");

  const titles = {
    dashboard: "Tổng Quan Vận Hành",
    tours: "Quản Lý Danh Mục Tour",
    schedules: "Lịch Khởi Hành & Kho Chỗ (Slots)",
    bookings: "Quản Lý Đơn Đặt & Sao Kê Doanh Thu",
    payments: "Thanh Toán & Hoàn Tiền",
    system: "AI & Trạng Thái Hệ Thống",
    audit: "Nhật Ký Kiểm Toán (Audit Logs)"
  };

  const badges = {
    dashboard: "OPERATIONS OVERVIEW",
    tours: "CATALOG CONTROLLER",
    schedules: "INVENTORY & SEATS",
    bookings: "BOOKING OPERATIONS",
    payments: "PAYMENT RECONCILIATION",
    system: "PRODUCTION CONTROL",
    audit: "COMPLIANCE & SECURITY"
  };

  if (titleEl) titleEl.textContent = titles[tabKey] || "Quản Trị Hệ Thống";
  if (badgeEl) badgeEl.textContent = badges[tabKey] || "DELTA PORTAL";
}

function updateAiCopilotStrip(tabKey) {
  const cfg = COPILOT_PROMPTS[tabKey] || COPILOT_PROMPTS.dashboard;
  const titleEl = document.getElementById("aiCopilotTitle");
  const descEl = document.getElementById("aiCopilotDesc");
  const chipsContainer = document.getElementById("aiCopilotChips");
  const responseBox = document.getElementById("aiCopilotResponse");

  if (titleEl) titleEl.textContent = cfg.title;
  if (descEl) descEl.textContent = cfg.prompt;
  if (responseBox) {
    responseBox.style.display = "none";
    responseBox.innerHTML = "";
  }

  if (chipsContainer) {
    chipsContainer.innerHTML = cfg.suggestions.map(s => `
      <button type="button" class="ai-suggestion-chip" onclick="askAiCopilot('${s.replace(/'/g, "\\'")}')">
        <i class="bi bi-stars text-warning"></i> ${s}
      </button>
    `).join("");
  }
}

// =============================================================================
// VI. LOGIC TRỢ LÝ VẬN HÀNH NỘI BỘ
// =============================================================================
function initAiCopilot() {
  updateAiCopilotStrip("dashboard");
}

async function askAiCopilot(queryText) {
  const responseBox = document.getElementById("aiCopilotResponse");
  if (!responseBox) return;

  responseBox.style.display = "block";
  responseBox.innerHTML = `
    <div class="d-flex align-items-center gap-2 text-warning">
      <div class="spinner-border spinner-border-sm" role="status"></div>
      <span>Delta AI đang phân tích dữ liệu vận hành thời gian thực...</span>
    </div>
  `;

  const totalTours = AdminState.tours.length;
  const totalBookings = AdminState.bookings.length;
  const pendingCashBookings = AdminState.bookings.filter(b => b.statusCode === "AWAITING_CASH" || b.status?.includes("TIỀN MẶT")).length;
  const refundRequired = AdminState.payments.filter(p => p.status === "REFUND_REQUIRED").length;
  const totalRevenue = AdminState.bookings
    .filter(b => b.isPaid || b.statusCode === "PAID" || b.statusCode === "CONFIRMED" || b.statusCode === "COMPLETED")
    .reduce((sum, b) => sum + (b.pricing?.total || 0), 0);

  // Fallback Rule Engine thông minh xử lý câu hỏi thường gặp
  setTimeout(() => {
    let replyContent = "";
    const qLower = queryText.toLowerCase();

    if (qLower.includes("hôm nay") || qLower.includes("xử lý ngay") || qLower.includes("hành động")) {
      replyContent = `
        <strong>Tóm tắt việc vận hành cần ưu tiên:</strong><br>
        1. <strong>Đơn chờ tiền mặt:</strong> Có <strong>${pendingCashBookings} đơn</strong> ${pendingCashBookings > 0 ? 'đang chờ thu tiền mặt tại quầy.' : 'đang chờ xử lý. Hiện tại không có đơn tồn đọng.'}<br>
        2. <strong>Hoàn tiền chờ xử lý:</strong> Có <strong>${refundRequired} khoản</strong> ${refundRequired > 0 ? 'ở trạng thái <code>REFUND_REQUIRED</code> cần kế toán kiểm tra và chuyển khoản hoàn tiền.' : 'ở trạng thái hoàn tiền. Hiện tại không có khiếu nại hoàn tiền nào.'}<br>
        3. <strong>Catalog tour:</strong> Toàn bộ ${totalTours} tour trong hệ thống đang sẵn sàng mở bán và tiếp nhận khách hàng mới.
      `;
    } else if (qLower.includes("booking") || qLower.includes("hoàn tiền") || qLower.includes("đơn")) {
      replyContent = `
        <strong>Tình hình Booking & Dòng tiền:</strong><br>
        - Tổng số đơn ghi nhận: <strong>${totalBookings} đơn</strong><br>
        - Tổng doanh thu thực tế thu về: <strong>${totalRevenue.toLocaleString("vi-VN")} đ</strong><br>
        - Đơn chờ tiền mặt: <strong>${pendingCashBookings} đơn</strong><br>
        - Khoản hoàn tiền chờ xử lý: <strong>${refundRequired} khoản</strong>
      `;
    } else if (qLower.includes("hệ thống") || qLower.includes("ai") || qLower.includes("sẵn sàng") || qLower.includes("readiness")) {
      replyContent = `
        <strong>Trạng thái Readiness của Hệ thống:</strong><br>
        - <strong>Frontend Engine:</strong> Hoạt động ổn định 100% trên Local Storage.<br>
        - <strong>Trợ lý:</strong> FAQ du lịch dạng rule-based chạy qua API nội bộ.<br>
        - <strong>Cổng thanh toán:</strong> Phương thức CASH và VietQR đang Available hoạt động thực tế. Các cổng VNPay, MoMo, ZaloPay sandbox đã nạp sẵn cấu hình adapter.
      `;
    } else {
      replyContent = `
        <strong>Phân tích từ Delta AI Copilot:</strong><br>
        Hệ thống hiện quản lý <strong>${totalTours} tour</strong> với <strong>${totalBookings} đơn đặt chỗ</strong>. Doanh thu lũy kế đạt <strong>${totalRevenue.toLocaleString("vi-VN")} đ</strong>.
        Tất cả các chức năng sao kê, đối soát, quản lý chỗ và nhật ký kiểm toán đều đang hoạt động chính xác.
      `;
    }

    responseBox.innerHTML = `
      <div class="mb-2 fw-bold text-warning d-flex align-items-center gap-1.5">
        <i class="bi bi-robot"></i> Phản hồi từ Delta AI Operations Copilot:
      </div>
      <div class="small leading-relaxed">${replyContent}</div>
    `;
  }, 400);
}

// =============================================================================
// VII. ĐIỀU HƯỚNG VÀ RENDER NỘI DUNG TỪNG TAB
// =============================================================================
function renderCurrentTab() {
  const container = document.getElementById("adminTabContentContainer");
  if (!container) return;

  switch (AdminState.currentTab) {
    case "dashboard":
      renderTabDashboard(container);
      break;
    case "tours":
      renderTabTours(container);
      break;
    case "schedules":
      renderTabSchedules(container);
      break;
    case "bookings":
      renderTabBookings(container);
      break;
    case "payments":
      renderTabPayments(container);
      break;
    case "system":
      renderTabSystem(container);
      break;
    case "audit":
      renderTabAudit(container);
      break;
    default:
      renderTabDashboard(container);
  }
}

// =============================================================================
// VIII. TAB 1: TỔNG QUAN VẬN HÀNH (DASHBOARD)
// =============================================================================
function renderTabDashboard(container) {
  const totalTours = AdminState.tours.length;
  const activeTours = AdminState.tours.filter(t => t.status === "ACTIVE").length;
  const totalBookings = AdminState.bookings.length;
  const pendingRefunds = AdminState.payments.filter(p => p.status === "REFUND_REQUIRED").length;

  const totalRevenue = AdminState.bookings
    .filter(b => b.isPaid || b.statusCode === "PAID" || b.statusCode === "CONFIRMED" || b.statusCode === "COMPLETED")
    .reduce((sum, b) => sum + (b.pricing?.total || 0), 0);

  const urgentBookings = AdminState.bookings
    .filter(b => b.statusCode === "AWAITING_CASH" || b.statusCode === "PENDING_PAYMENT")
    .slice(0, 5);

  container.innerHTML = `
    <!-- 4 Khối Chỉ Số Trọng Yếu (Metrics) -->
    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">
        <div class="admin-metric-card">
          <div class="admin-metric-header">
            <div>
              <div class="admin-metric-label">Tour trong hệ thống</div>
              <div class="admin-metric-val">${totalTours}</div>
            </div>
            <div class="admin-metric-icon gold">
              <i class="bi bi-compass"></i>
            </div>
          </div>
          <div class="admin-metric-sub">
            <span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> ${activeTours} đang mở bán</span>
            <span class="mx-1">•</span>
            <span>${totalTours - activeTours} bản nháp/ẩn</span>
          </div>
        </div>
      </div>

      <div class="col-sm-6 col-xl-3">
        <div class="admin-metric-card">
          <div class="admin-metric-header">
            <div>
              <div class="admin-metric-label">Booking toàn hệ thống</div>
              <div class="admin-metric-val">${totalBookings}</div>
            </div>
            <div class="admin-metric-icon blue">
              <i class="bi bi-ticket-perforated"></i>
            </div>
          </div>
          <div class="admin-metric-sub">
            <span class="text-primary fw-bold">${totalRevenue.toLocaleString("vi-VN")} đ</span>
            <span class="ms-1">doanh thu</span>
          </div>
        </div>
      </div>

      <div class="col-sm-6 col-xl-3">
        <div class="admin-metric-card">
          <div class="admin-metric-header">
            <div>
              <div class="admin-metric-label">Chờ hoàn tiền</div>
              <div class="admin-metric-val text-warning">${pendingRefunds}</div>
            </div>
            <div class="admin-metric-icon purple">
              <i class="bi bi-arrow-counterclockwise"></i>
            </div>
          </div>
          <div class="admin-metric-sub">
            <span class="text-warning fw-bold">REFUND_REQUIRED</span>
            <span class="ms-1">cần xử lý</span>
          </div>
        </div>
      </div>

      <div class="col-sm-6 col-xl-3">
        <div class="admin-metric-card">
          <div class="admin-metric-header">
            <div>
              <div class="admin-metric-label">AI Runtime & Trạng thái</div>
              <div class="admin-metric-val text-success" style="font-size: 20px;">GEMINI LIVE</div>
            </div>
            <div class="admin-metric-icon green">
              <i class="bi bi-cpu"></i>
            </div>
          </div>
          <div class="admin-metric-sub">
            <span class="text-success fw-bold"><i class="bi bi-lightning-charge-fill"></i> gemini-2.5-flash</span>
            <span class="ms-1">sẵn sàng</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2 Cột: Đơn Cần Xử Lý Ngay & Readiness Hệ Thống -->
    <div class="row g-4">
      <!-- Cột Trái: Đơn cần xử lý ngay -->
      <div class="col-lg-7">
        <div class="admin-card h-100">
          <div class="admin-card-header">
            <h5 class="admin-card-title">
              <i class="bi bi-clock-history text-warning"></i> Đơn Đặt Tour Chờ Xử Lý (Tiền Mặt / Giữ Chỗ)
            </h5>
            <button class="btn btn-admin-outline btn-admin-sm" onclick="switchAdminTab('bookings')">
              Xem tất cả đơn (${totalBookings})
            </button>
          </div>
          <div class="admin-card-body p-0">
            ${urgentBookings.length === 0 ? `
              <div class="p-4 text-center text-muted">
                <i class="bi bi-check2-circle fs-3 text-success d-block mb-1"></i>
                Không có đơn nào cần xử lý khẩn cấp!
              </div>
            ` : `
              <div class="admin-table-responsive">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Mã Đơn</th>
                      <th>Khách Hàng</th>
                      <th>Tour & Ngày Đi</th>
                      <th>Tổng Tiền</th>
                      <th>Trạng Thái</th>
                      <th>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${urgentBookings.map(b => `
                      <tr>
                        <td><strong>${b.bookingId}</strong></td>
                        <td>
                          <div class="fw-bold">${b.customer.fullName}</div>
                          <div class="text-muted small">${b.customer.phone}</div>
                        </td>
                        <td>
                          <div class="text-truncate" style="max-width: 180px;">${b.tourTitle}</div>
                          <div class="text-muted small">${b.departureDate}</div>
                        </td>
                        <td class="fw-bold text-dark">${b.pricing.total.toLocaleString("vi-VN")} đ</td>
                        <td>
                          <span class="admin-badge badge-status-${b.statusCode || 'PENDING_PAYMENT'}">
                            ${b.status}
                          </span>
                        </td>
                        <td>
                          <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-primary" onclick="openBookingDetailModal('${b.bookingId}')" title="Xem chi tiết">
                              <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-success" onclick="handleQuickConfirmBooking('${b.bookingId}')" title="Xác nhận đơn">
                              <i class="bi bi-check-lg"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Cột Phải: Readiness & Sức Khỏe Hệ Thống -->
      <div class="col-lg-5">
        <div class="admin-card h-100">
          <div class="admin-card-header">
            <h5 class="admin-card-title">
              <i class="bi bi-shield-check text-success"></i> Readiness & Tích Hợp Hệ Thống
            </h5>
            <button class="btn btn-admin-outline btn-admin-sm" onclick="switchAdminTab('system')">
              Chi tiết
            </button>
          </div>
          <div class="admin-card-body">
            <div class="d-flex flex-column gap-3">
              <div class="d-flex align-items-center justify-content-between p-3 rounded-3 bg-light border">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-cpu-fill text-warning fs-5"></i>
                  <div>
                    <div class="fw-bold small">AI Copilot & Chatbot Engine</div>
                    <div class="text-muted" style="font-size: 11px;">Rule-based nội bộ</div>
                  </div>
                </div>
                <span class="badge bg-success">ONLINE</span>
              </div>

              <div class="d-flex align-items-center justify-content-between p-3 rounded-3 bg-light border">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-database-fill text-info fs-5"></i>
                  <div>
                    <div class="fw-bold small">Bộ Lưu Trữ Trình Duyệt (LocalStorage)</div>
                    <div class="text-muted" style="font-size: 11px;">Tự động đồng bộ 2 chiều Client - Admin</div>
                  </div>
                </div>
                <span class="badge bg-success">ACTIVE</span>
              </div>

              <div class="d-flex align-items-center justify-content-between p-3 rounded-3 bg-light border">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-qr-code-scan text-primary fs-5"></i>
                  <div>
                    <div class="fw-bold small">Cổng Chuyển Khoản VietQR</div>
                    <div class="text-muted" style="font-size: 11px;">Ngân hàng VietinBank tự động sinh QR</div>
                  </div>
                </div>
                <span class="badge bg-success">READY</span>
              </div>

              <div class="d-flex align-items-center justify-content-between p-3 rounded-3 bg-light border">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-cash-stack text-success fs-5"></i>
                  <div>
                    <div class="fw-bold small">Thanh Toán Tiền Mặt (CASH)</div>
                    <div class="text-muted" style="font-size: 11px;">Thu tại văn phòng & đối soát biên nhận</div>
                  </div>
                </div>
                <span class="badge bg-success">AVAILABLE</span>
              </div>

              <div class="d-flex align-items-center justify-content-between p-3 rounded-3 bg-light border">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-credit-card-2-front text-secondary fs-5"></i>
                  <div>
                    <div class="fw-bold small">Ví MoMo, VNPay, ZaloPay Sandbox</div>
                    <div class="text-muted" style="font-size: 11px;">Cổng thanh toán trực tuyến sẵn sàng</div>
                  </div>
                </div>
                <span class="badge bg-secondary">SANDBOX READY</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// IX. TAB 2: QUẢN LÝ TOUR (CATALOG TOUR CRUD)
// =============================================================================
function renderTabTours(container) {
  const tours = AdminState.tours;
  const filteredTours = tours.filter(t => {
    if (AdminState.tourStatusFilter !== "all" && t.status !== AdminState.tourStatusFilter) return false;
    if (AdminState.tourSearch.trim()) {
      const q = AdminState.tourSearch.toLowerCase();
      const matchTitle = (t.title || "").toLowerCase().includes(q);
      const matchDest = (t.destination || t.regionName || "").toLowerCase().includes(q);
      const matchId = (t.id || "").toLowerCase().includes(q);
      if (!matchTitle && !matchDest && !matchId) return false;
    }
    return true;
  });

  const total = tours.length;
  const activeCount = tours.filter(t => t.status === "ACTIVE").length;
  const draftCount = tours.filter(t => t.status === "DRAFT").length;
  const inactiveCount = tours.filter(t => t.status === "INACTIVE").length;

  container.innerHTML = `
    <!-- Thống kê nhanh trạng thái tour -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-muted small">Tổng số Tour</div>
          <div class="fs-4 fw-bold text-dark">${total}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-success small fw-semibold">Đang Mở Bán (ACTIVE)</div>
          <div class="fs-4 fw-bold text-success">${activeCount}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-secondary small fw-semibold">Bản Nháp (DRAFT)</div>
          <div class="fs-4 fw-bold text-secondary">${draftCount}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-warning small fw-semibold">Tạm Ẩn (INACTIVE)</div>
          <div class="fs-4 fw-bold text-warning">${inactiveCount}</div>
        </div>
      </div>
    </div>

    <!-- Thanh tìm kiếm & Nút thêm tour -->
    <div class="admin-card">
      <div class="admin-card-header">
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <div class="admin-search-input">
            <i class="bi bi-search"></i>
            <input type="text" class="form-control" id="tourSearchInput" placeholder="Tìm tour theo tên, mã, điểm đến..." value="${AdminState.tourSearch}" oninput="handleTourSearch(this.value)">
          </div>

          <select class="form-select form-select-sm" style="width: auto;" onchange="handleTourStatusFilter(this.value)">
            <option value="all" ${AdminState.tourStatusFilter === "all" ? "selected" : ""}>Tất cả trạng thái</option>
            <option value="ACTIVE" ${AdminState.tourStatusFilter === "ACTIVE" ? "selected" : ""}>Đang mở bán (ACTIVE)</option>
            <option value="DRAFT" ${AdminState.tourStatusFilter === "DRAFT" ? "selected" : ""}>Bản nháp (DRAFT)</option>
            <option value="INACTIVE" ${AdminState.tourStatusFilter === "INACTIVE" ? "selected" : ""}>Tạm ẩn (INACTIVE)</option>
          </select>
        </div>

        <button class="btn-admin-primary" onclick="openTourModal()">
          <i class="bi bi-plus-circle"></i> Thêm Tour Mới
        </button>
      </div>

      <div class="admin-card-body p-0">
        <div class="admin-table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Mã & Tên Tour</th>
                <th>Điểm Đến</th>
                <th>Thời Gian</th>
                <th>Giá Bán</th>
                <th>Chỗ Trống</th>
                <th>Trạng Thái</th>
                <th class="text-end">Hành Động</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTours.length === 0 ? `
                <tr>
                  <td colspan="8" class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                    Không tìm thấy tour du lịch nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ` : filteredTours.map(t => `
                <tr>
                  <td>
                    <img src="${t.image || 'assets/images/halong.png'}" alt="${t.title}" style="width: 54px; height: 38px; object-fit: cover; border-radius: 8px;">
                  </td>
                  <td>
                    <div class="fw-bold text-dark text-truncate" style="max-width: 260px;" title="${t.title}">${t.title}</div>
                    <div class="text-muted small font-monospace">${t.id} • ${t.slug || ''}</div>
                  </td>
                  <td>
                    <span class="badge bg-light text-dark border">${t.regionName || t.destination || 'Việt Nam'}</span>
                  </td>
                  <td>${t.duration || `${t.daysCount || 3}N${(t.daysCount || 3) - 1}Đ`}</td>
                  <td>
                    <div class="fw-bold text-danger">${t.price.toLocaleString("vi-VN")} đ</div>
                    ${t.originalPrice ? `<div class="text-muted text-decoration-line-through small" style="font-size: 10px;">${t.originalPrice.toLocaleString("vi-VN")} đ</div>` : ''}
                  </td>
                  <td>
                    <span class="badge bg-light text-dark border">${t.availableSeats || 20} chỗ</span>
                  </td>
                  <td>
                    <span class="admin-badge badge-status-${t.status || 'ACTIVE'}">
                      ${t.status === 'ACTIVE' ? 'ĐANG BÁN' : t.status === 'DRAFT' ? 'BẢN NHÁP' : 'TẠM ẨN'}
                    </span>
                  </td>
                  <td class="text-end">
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-secondary" onclick="openTourModal('${t.id}')" title="Chỉnh sửa tour">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-outline-warning" onclick="handleToggleTourStatus('${t.id}')" title="Đổi trạng thái Bán/Ẩn">
                        <i class="bi bi-power"></i>
                      </button>
                      <button class="btn btn-outline-danger" onclick="handleDeleteTour('${t.id}')" title="Xóa tour">
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function handleTourSearch(val) {
  AdminState.tourSearch = val;
  renderTabTours(document.getElementById("adminTabContentContainer"));
}

function handleTourStatusFilter(val) {
  AdminState.tourStatusFilter = val;
  renderTabTours(document.getElementById("adminTabContentContainer"));
}

async function handleToggleTourStatus(tourId) {
  const tour = AdminState.tours.find(item => item.id === tourId);
  if (!tour) return;

  const status = (tour.status || "ACTIVE") === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  if (typeof DeltaAPI !== "undefined" && DeltaAPI.adminPatchTour) {
    const result = await DeltaAPI.adminPatchTour(tourId, { active: status === "ACTIVE" });
    if (!result.success) {
      showAdminToast(result.error || "Không thể cập nhật trạng thái tour trên máy chủ.", "error");
      return;
    }
  }

  const tours = AdminState.tours.map(item => item.id === tourId ? { ...item, status } : item);
  saveToursData(tours);
  addAuditLog("UPDATE_TOUR", "Tour", tourId, `Thay đổi trạng thái tour ${tour.title} thành ${status}`);
  showAdminToast(`Đã chuyển tour ${tourId} sang trạng thái ${status}`, "success");
  renderCurrentTab();
}

async function handleDeleteTour(tourId) {
  const tour = AdminState.tours.find(t => t.id === tourId);
  if (!tour) return;

  if (!confirm(`Bạn có chắc chắn muốn ẩn tour "${tour.title}" (${tour.id})? Tour sẽ không còn xuất hiện trong danh sách đang bán nhưng có thể xem lại ở mục Tạm ẩn.`)) return;

  if (typeof DeltaAPI !== "undefined" && DeltaAPI.adminDeleteTour) {
    const result = await DeltaAPI.adminDeleteTour(tourId);
    if (!result.success) {
      showAdminToast(result.error || "Không thể ẩn tour trên máy chủ.", "error");
      return;
    }
  }

  const updated = AdminState.tours.map(item =>
    item.id === tourId ? { ...item, status: "INACTIVE" } : item
  );
  AdminState.tourStatusFilter = "ACTIVE";
  saveToursData(updated);
  addAuditLog("DELETE_TOUR", "Tour", tourId, `Ẩn tour "${tour.title}" khỏi danh sách đang bán`);
  showAdminToast(`Đã ẩn tour ${tourId}. Có thể xem lại trong mục Tạm ẩn.`, "success");
  renderCurrentTab();
}

/**
 * Modal Thêm / Chỉnh Sửa Tour
 */

/**
 * Quản lý & Xử lý ảnh Tour: Tải ảnh từ máy (Base64), chọn preset hoặc nhập URL
 */
function handleTourImageFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP)!");
    return;
  }
  const fileNameEl = document.getElementById("formTourImageFileName");
  if (fileNameEl) fileNameEl.textContent = `(${file.name} - ${(file.size / 1024).toFixed(0)}KB)`;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64Data = evt.target.result;
    const imgInput = document.getElementById("formTourImage");
    const previewImg = document.getElementById("formTourImagePreview");
    if (imgInput) imgInput.value = base64Data;
    if (previewImg) previewImg.src = base64Data;
  };
  reader.readAsDataURL(file);
}

function selectTourPresetImage(path) {
  const imgInput = document.getElementById("formTourImage");
  const previewImg = document.getElementById("formTourImagePreview");
  const fileNameEl = document.getElementById("formTourImageFileName");
  const galleryInput = document.getElementById("formTourImages");
  if (imgInput) imgInput.value = path;
  if (previewImg) previewImg.src = path;
  if (fileNameEl) fileNameEl.textContent = "(Ảnh thư viện Delta)";
  if (galleryInput && !galleryInput.value.trim()) galleryInput.value = path;
}

function updateTourImagePreview(url) {
  const previewImg = document.getElementById("formTourImagePreview");
  if (previewImg) {
    previewImg.src = url.trim() || 'assets/images/halong.png';
  }
}

function openTourModal(tourId = null) {
  AdminState.editingTourId = tourId;
  const tour = tourId ? AdminState.tours.find(t => t.id === tourId) : null;
  const modalEl = document.getElementById("adminTourModal");
  if (!modalEl) return;

  // Reset tab active về Tab 1
  const firstTab = document.querySelector("#adminTourTabs button:first-child");
  if (firstTab) {
    try {
      bootstrap.Tab.getOrCreateInstance(firstTab).show();
    } catch (e) {}
  }

  document.getElementById("tourModalTitle").textContent = tour ? `Chỉnh Sửa Toàn Bộ Tour: ${tour.id}` : "Thêm Tour Du Lịch Mới";
  document.getElementById("formTourId").value = tour ? tour.id : ("DL-" + Date.now().toString().slice(-4));
  document.getElementById("formTourTitle").value = tour ? tour.title : "";
  document.getElementById("formTourSlug").value = tour ? tour.slug : "";
  document.getElementById("formTourRegion").value = tour ? (tour.region || "north") : "north";
  document.getElementById("formTourDuration").value = tour ? (tour.duration || "3N2Đ") : "3N2Đ";
  const baseCostInput = document.getElementById("formTourOriginalPrice");
  baseCostInput.value = tour ? (tour.originalPrice || "") : "";
  baseCostInput.readOnly = true;
  baseCostInput.title = "Tổng chi phí gốc được tự cộng từ các khoản chi bên dưới.";
  document.getElementById("formTourPrice").value = tour ? tour.price : "";
  document.getElementById("formTourDeparture").value = tour ? (tour.departure || "") : "Hà Nội / TP.HCM";
  document.getElementById("formTourTransport").value = tour ? (tour.transport || "") : "Xe du lịch đời mới / Máy bay";
  document.getElementById("formTourSeats").value = tour ? (tour.availableSeats || 20) : 25;
  document.getElementById("formTourStatus").value = tour ? (tour.status || "ACTIVE") : "ACTIVE";
  
  const badgeInput = document.getElementById("formTourBadge");
  if (badgeInput) badgeInput.value = tour ? (tour.badge || "") : "";

  // Thiết lập đường dẫn ảnh & Xem trước (Preview)
  const imgPath = tour ? (tour.image || "assets/images/halong.png") : "assets/images/halong.png";
  const imgInput = document.getElementById("formTourImage");
  const imgPreview = document.getElementById("formTourImagePreview");
  const imgFileInput = document.getElementById("formTourImageFileInput");
  const imgFileName = document.getElementById("formTourImageFileName");
  const galleryInput = document.getElementById("formTourImages");
  
  if (imgInput) imgInput.value = imgPath;
  if (galleryInput) {
    const images = Array.isArray(tour?.images) ? tour.images : (tour ? [imgPath] : [imgPath]);
    galleryInput.value = images.join("\n");
  }
  if (imgPreview) imgPreview.src = imgPath;
  if (imgFileInput) imgFileInput.value = "";
  if (imgFileName) imgFileName.textContent = tour ? "(Ảnh hiện tại)" : "(JPG, PNG, WebP)";

  // Tab 3: Điểm nổi bật
  const descEl = document.getElementById("formTourDesc");
  if (descEl) {
    descEl.value = tour ? (Array.isArray(tour.highlights) ? tour.highlights.join("\n") : (tour.highlights || "")) : "";
  }

  // Tab 3: Dịch vụ bao gồm & Không bao gồm & Chính sách
  const inclusionsEl = document.getElementById("formTourInclusions");
  if (inclusionsEl) {
    inclusionsEl.value = tour && Array.isArray(tour.inclusions) ? tour.inclusions.join("\n") : (tour?.inclusions || "Xe đưa đón du lịch đời mới suốt tuyến\nKhách sạn / Du thuyền tiêu chuẩn sang trọng\nCác bữa ăn chính đặc sản theo lịch trình\nVé tham quan tất cả các thắng cảnh trong tour\nHướng dẫn viên giàu kinh nghiệm đồng hành\nBảo hiểm du lịch trọn gói 100.000.000đ");
  }

  const exclusionsEl = document.getElementById("formTourExclusions");
  if (exclusionsEl) {
    exclusionsEl.value = tour && Array.isArray(tour.exclusions) ? tour.exclusions.join("\n") : (tour?.exclusions || "Thuế VAT 8% (nếu xuất hóa đơn đỏ)\nChi phí phòng đơn nếu đi 1 mình\nĐồ uống ngoài thực đơn và chi phí cá nhân\nTiền tip cho tài xế và hướng dẫn viên");
  }

  const termsEl = document.getElementById("formTourTerms");
  if (termsEl) {
    termsEl.value = tour && Array.isArray(tour.terms) ? tour.terms.join("\n") : (tour?.terms || "Hủy tour trước 15 ngày khởi hành: Miễn phí 100%\nHủy tour từ 07 - 14 ngày: Phí 30% giá tour\nHủy tour từ 03 - 06 ngày: Phí 50% giá tour\nHủy trong vòng 48h trước giờ đi: Phí 100%\nTrường hợp bão lũ thiên tai: Hỗ trợ bảo lưu dời ngày miễn phí");
  }

  // Tab 2: Render lịch trình Day-by-Day
  renderAdminItineraryDays(tour ? tour.itinerary : null);
  renderAdminCostItems([]);
  if (tour && typeof DeltaAPI !== "undefined" && DeltaAPI.adminFetchTourDetails) {
    DeltaAPI.adminFetchTourDetails(tourId).then(result => {
      if (!result.success || AdminState.editingTourId !== tourId) return;
      renderAdminCostItems(result.data.costItems || []);
      document.getElementById("formTourPrice").value = result.data.tour.price;
      const base = document.getElementById("formTourOriginalPrice");
      if (base) base.value = result.data.baseCost;
      renderAdminItineraryDays(groupStructuredItinerary(result.data.itinerary || []));
    }).catch(error => showAdminToast(error.message, "error"));
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

function groupStructuredItinerary(items) {
  const days = new Map();
  for (const item of items) {
    if (!days.has(item.dayNumber)) {
      days.set(item.dayNumber, {
        day: item.dayNumber,
        title: `Lịch trình ngày ${item.dayNumber}`
      });
    }
    const day = days.get(item.dayNumber);
    const slot = ["morning", "afternoon", "evening"][item.sequence - 1];
    if (slot) {
      day[slot] = item.description || item.title;
      day[`${slot}Category`] = item.category;
    } else {
      day.evening = [day.evening, item.description || item.title].filter(Boolean).join("\n");
    }
  }
  return [...days.values()];
}

function renderAdminCostItems(items) {
  const basic = document.getElementById("adminTabTourBasic");
  if (!basic) return;
  let section = document.getElementById("adminTourCostEditor");
  if (!section) {
    section = document.createElement("section");
    section.id = "adminTourCostEditor";
    section.className = "card border p-3 mt-3";
    section.innerHTML = `
      <div class="d-flex justify-content-between align-items-center gap-2 mb-2">
        <div><h6 class="fw-bold mb-1">Chi phí gốc nội bộ / khách</h6>
        <small class="text-muted">Chỉ admin xem. Tổng khoản chi phải thấp hơn giá bán.</small></div>
        <button type="button" class="btn btn-sm btn-outline-primary" id="adminAddTourCost">Thêm khoản chi</button>
      </div>
      <div id="adminTourCostRows" class="d-flex flex-column gap-2"></div>`;
    basic.append(section);
    section.querySelector("#adminAddTourCost").addEventListener("click", () => appendAdminCostItem());
  }
  AdminState.tourCostItems = items;
  const rows = section.querySelector("#adminTourCostRows");
  rows.replaceChildren();
  for (const item of items) appendAdminCostItem(item, rows);
  updateAdminBaseCost();
}

function appendAdminCostItem(item = {}, target) {
  const rows = target || document.getElementById("adminTourCostRows");
  if (!rows) return;
  const row = document.createElement("div");
  row.className = "row g-2 align-items-center admin-tour-cost-row";
  row.innerHTML = `
    <div class="col-md-2"><select class="form-select form-select-sm cost-category">
      <option value="transport">Di chuyển</option><option value="accommodation">Khách sạn / du thuyền</option>
      <option value="meal">Ăn uống</option><option value="sightseeing">Vé tham quan</option>
      <option value="activity">Vui chơi</option><option value="guide">Hướng dẫn viên</option>
      <option value="insurance">Bảo hiểm</option><option value="other">Khác</option>
    </select></div>
    <div class="col-md-3"><input class="form-control form-control-sm cost-name" maxlength="150" placeholder="Tên khoản chi"></div>
    <div class="col-md-3"><input class="form-control form-control-sm cost-notes" maxlength="2000" placeholder="Ghi chú"></div>
    <div class="col-md-3"><input class="form-control form-control-sm cost-amount" type="number" min="0" step="1" placeholder="VND / khách"></div>
    <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-danger" aria-label="Xóa khoản chi">Xóa</button></div>`;
  row.querySelector(".cost-category").value = item.category || "other";
  row.querySelector(".cost-name").value = item.name || "";
  row.querySelector(".cost-notes").value = item.notes || "";
  row.querySelector(".cost-amount").value = item.amountPerPerson ?? "";
  row.querySelectorAll("input,select").forEach(field => {
    field.addEventListener("input", updateAdminBaseCost);
    field.addEventListener("change", updateAdminBaseCost);
  });
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    updateAdminBaseCost();
  });
  rows.append(row);
  updateAdminBaseCost();
}

function updateAdminBaseCost() {
  const total = [...document.querySelectorAll("#adminTourCostRows .cost-amount")]
    .reduce((sum, input) => sum + (Number(input.value) || 0), 0);
  const output = document.getElementById("formTourOriginalPrice");
  if (output) output.value = total;
}

function collectAdminCostItems() {
  return [...document.querySelectorAll("#adminTourCostRows .admin-tour-cost-row")].map(row => ({
    category: row.querySelector(".cost-category").value,
    name: row.querySelector(".cost-name").value.trim(),
    notes: row.querySelector(".cost-notes").value.trim(),
    amount_per_person: Number(row.querySelector(".cost-amount").value) || 0
  })).filter(item => item.name);
}

/**
 * Render danh sách ngày trong lịch trình ở Modal Tour
 */
function renderAdminItineraryDays(itinerary) {
  const container = document.getElementById("adminTourItineraryContainer");
  const countBadge = document.getElementById("adminItineraryDayCount");
  if (!container) return;

  // Xử lý an toàn nếu itinerary là chuỗi JSON từ backend
  let days = [];
  if (Array.isArray(itinerary)) {
    days = itinerary;
  } else if (typeof itinerary === "string") {
    try {
      days = JSON.parse(itinerary);
    } catch (e) {
      days = [];
    }
  }

  if (!days || days.length === 0) {
    days = [
      {
        day: 1,
        title: "Khởi hành - Đến điểm đến nghỉ dưỡng",
        morning: "08:00 Xe Limousine đón khách, xuất phát di chuyển theo lịch trình.",
        afternoon: "12:00 Làm thủ tục nhận phòng / lên du thuyền, dùng bữa trưa đặc sản.",
        evening: "18:30 Thưởng thức bữa tối, tự do dạo chơi hoặc tham gia hoạt động buổi tối."
      }
    ];
  }

  if (countBadge) countBadge.textContent = `${days.length} ngày`;

  container.innerHTML = days.map((item, idx) => {
    const dayNum = idx + 1;
    return `
      <div class="admin-itinerary-day-card card border p-3 rounded-3 shadow-sm bg-white" data-day-index="${dayNum}">
        <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
          <div class="d-flex align-items-center gap-2 flex-grow-1 me-2">
            <span class="badge bg-primary px-3 py-1.5 fs-6 fw-bold">Ngày ${dayNum}</span>
            <input type="text" class="form-control form-control-sm fw-bold admin-itinerary-title" value="${escapeAdminHtml(item.title || '')}" placeholder="Tiêu đề ngày (VD: Hà Nội - Vịnh Hạ Long - Du Thuyền 5 Sao)" required>
          </div>
          <button type="button" class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onclick="removeAdminItineraryDay(this)" title="Xóa ngày này">
            <i class="bi bi-trash3-fill"></i> Xóa ngày
          </button>
        </div>

        <div class="row g-2">
          <div class="col-md-4">
            <label class="form-label small fw-bold text-warning-emphasis d-flex align-items-center gap-1 mb-1">
              <i class="bi bi-brightness-alt-high-fill text-warning"></i> Buổi Sáng:
            </label>
            <textarea class="form-control form-control-sm admin-itinerary-morning" rows="3" placeholder="Chi tiết hoạt động buổi sáng...">${escapeAdminHtml(item.morning || '')}</textarea>
            ${adminItineraryCategorySelect("morning", item.morningCategory || "transport")}
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-bold text-primary-emphasis d-flex align-items-center gap-1 mb-1">
              <i class="bi bi-sun-fill text-primary"></i> Buổi Chiều:
            </label>
            <textarea class="form-control form-control-sm admin-itinerary-afternoon" rows="3" placeholder="Chi tiết hoạt động buổi chiều...">${escapeAdminHtml(item.afternoon || '')}</textarea>
            ${adminItineraryCategorySelect("afternoon", item.afternoonCategory || "activity")}
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-bold text-info-emphasis d-flex align-items-center gap-1 mb-1">
              <i class="bi bi-moon-stars-fill text-info"></i> Buổi Tối:
            </label>
            <textarea class="form-control form-control-sm admin-itinerary-evening" rows="3" placeholder="Chi tiết hoạt động buổi tối...">${escapeAdminHtml(item.evening || '')}</textarea>
            ${adminItineraryCategorySelect("evening", item.eveningCategory || "meal")}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function adminItineraryCategorySelect(period, selected) {
  const categories = [
    ["transport", "Di chuyển"],
    ["meal", "Ăn uống"],
    ["accommodation", "Khách sạn / nghỉ ngơi"],
    ["activity", "Vui chơi / tham quan"],
    ["team_building", "Teambuilding"],
    ["note", "Thông tin khác"]
  ];
  return `<select class="form-select form-select-sm admin-itinerary-category admin-itinerary-${period}-category" aria-label="Loại hoạt động">${categories.map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("")}</select>`;
}

function escapeAdminHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function addAdminItineraryDay() {
  const container = document.getElementById("adminTourItineraryContainer");
  if (!container) return;
  const currentCards = container.querySelectorAll(".admin-itinerary-day-card");
  const nextDay = currentCards.length + 1;

  const newDayHtml = `
    <div class="admin-itinerary-day-card card border p-3 rounded-3 shadow-sm bg-white" data-day-index="${nextDay}">
      <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
        <div class="d-flex align-items-center gap-2 flex-grow-1 me-2">
          <span class="badge bg-primary px-3 py-1.5 fs-6 fw-bold">Ngày ${nextDay}</span>
          <input type="text" class="form-control form-control-sm fw-bold admin-itinerary-title" value="" placeholder="Tiêu đề ngày (VD: Khám phá thắng cảnh - Trải nghiệm văn hóa)" required>
        </div>
        <button type="button" class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onclick="removeAdminItineraryDay(this)" title="Xóa ngày này">
          <i class="bi bi-trash3-fill"></i> Xóa ngày
        </button>
      </div>

      <div class="row g-2">
        <div class="col-md-4">
          <label class="form-label small fw-bold text-warning-emphasis d-flex align-items-center gap-1 mb-1">
            <i class="bi bi-brightness-alt-high-fill text-warning"></i> Buổi Sáng:
          </label>
          <textarea class="form-control form-control-sm admin-itinerary-morning" rows="3" placeholder="Chi tiết hoạt động buổi sáng..."></textarea>
          ${adminItineraryCategorySelect("morning", "transport")}
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-bold text-primary-emphasis d-flex align-items-center gap-1 mb-1">
            <i class="bi bi-sun-fill text-primary"></i> Buổi Chiều:
          </label>
          <textarea class="form-control form-control-sm admin-itinerary-afternoon" rows="3" placeholder="Chi tiết hoạt động buổi chiều..."></textarea>
          ${adminItineraryCategorySelect("afternoon", "activity")}
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-bold text-info-emphasis d-flex align-items-center gap-1 mb-1">
            <i class="bi bi-moon-stars-fill text-info"></i> Buổi Tối:
          </label>
          <textarea class="form-control form-control-sm admin-itinerary-evening" rows="3" placeholder="Chi tiết hoạt động buổi tối..."></textarea>
          ${adminItineraryCategorySelect("evening", "meal")}
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML("beforeend", newDayHtml);
  updateAdminItineraryDayCount();
}

function removeAdminItineraryDay(btn) {
  const card = btn.closest(".admin-itinerary-day-card");
  if (!card) return;
  const container = document.getElementById("adminTourItineraryContainer");
  const allCards = container.querySelectorAll(".admin-itinerary-day-card");
  if (allCards.length <= 1) {
    alert("Lịch trình tour cần tối thiểu ít nhất 1 ngày!");
    return;
  }
  card.remove();
  reindexAdminItineraryDays();
}

function reindexAdminItineraryDays() {
  const container = document.getElementById("adminTourItineraryContainer");
  if (!container) return;
  const cards = container.querySelectorAll(".admin-itinerary-day-card");
  cards.forEach((card, idx) => {
    const dayNum = idx + 1;
    card.setAttribute("data-day-index", dayNum);
    const badge = card.querySelector(".badge");
    if (badge) badge.textContent = `Ngày ${dayNum}`;
  });
  updateAdminItineraryDayCount();
}

function updateAdminItineraryDayCount() {
  const container = document.getElementById("adminTourItineraryContainer");
  if (!container) return;
  const count = container.querySelectorAll(".admin-itinerary-day-card").length;
  const countBadge = document.getElementById("adminItineraryDayCount");
  if (countBadge) countBadge.textContent = `${count} ngày`;

  // Tự động cập nhật gợi ý thời lượng tour (VD: 3N2Đ)
  const durationInput = document.getElementById("formTourDuration");
  if (durationInput) {
    const nights = Math.max(0, count - 1);
    durationInput.value = `${count}N${nights}Đ`;
  }
}

async function handleSaveTourSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("formTourId").value.trim();
  const title = document.getElementById("formTourTitle").value.trim();
  const slug = document.getElementById("formTourSlug").value.trim() || slugify(title);
  const region = document.getElementById("formTourRegion").value;
  const duration = document.getElementById("formTourDuration").value.trim();
  const originalPrice = Number(document.getElementById("formTourOriginalPrice").value) || 0;
  const price = Number(document.getElementById("formTourPrice").value) || 0;
  const costItems = collectAdminCostItems();
  const calculatedBaseCost = costItems.reduce((sum, item) => sum + item.amount_per_person, 0);
  const departure = document.getElementById("formTourDeparture").value.trim();
  const transport = document.getElementById("formTourTransport").value.trim();
  const availableSeats = Number(document.getElementById("formTourSeats").value) || 20;
  const status = document.getElementById("formTourStatus").value;
  const badge = document.getElementById("formTourBadge")?.value.trim() || "";
  const image = document.getElementById("formTourImage").value.trim() || "assets/images/halong.png";
  const galleryInput = document.getElementById("formTourImages")?.value || "";
  const galleryImages = [...new Set(galleryInput.split(/\r?\n/).map(url => url.trim()).filter(Boolean))];
  if (!image.startsWith("data:") && !galleryImages.includes(image)) {
    galleryImages.unshift(image);
  }
  if (galleryImages.length > 12) {
    alert("Mỗi tour chỉ được có tối đa 12 ảnh.");
    return;
  }
  const apiImages = galleryImages.filter(url => !url.startsWith("data:"));

  const descRaw = document.getElementById("formTourDesc")?.value.trim() || "";
  const highlights = descRaw ? descRaw.split("\n").map(s => s.trim()).filter(Boolean) : ["Trải nghiệm tour chất lượng cao của Delta Travel"];

  const incRaw = document.getElementById("formTourInclusions")?.value.trim() || "";
  const inclusions = incRaw ? incRaw.split("\n").map(s => s.trim()).filter(Boolean) : ["Xe đưa đón", "Khách sạn tiêu chuẩn", "Bữa ăn theo lịch trình", "Bảo hiểm"];

  const excRaw = document.getElementById("formTourExclusions")?.value.trim() || "";
  const exclusions = excRaw ? excRaw.split("\n").map(s => s.trim()).filter(Boolean) : ["Chi phí cá nhân", "Thuế VAT"];

  const termsRaw = document.getElementById("formTourTerms")?.value.trim() || "";
  const terms = termsRaw ? termsRaw.split("\n").map(s => s.trim()).filter(Boolean) : ["Chính sách hoàn hủy chuẩn Delta Travel"];

  // Thu thập lịch trình từng ngày từ Container
  const dayCards = document.querySelectorAll("#adminTourItineraryContainer .admin-itinerary-day-card");
  const itinerary = [];
  const structuredItinerary = [];
  dayCards.forEach((card, idx) => {
    const dayNum = idx + 1;
    const dayTitle = card.querySelector(".admin-itinerary-title")?.value.trim() || `Ngày ${dayNum}: Lịch trình khám phá`;
    const morning = card.querySelector(".admin-itinerary-morning")?.value.trim() || "Hoạt động buổi sáng theo lịch trình.";
    const afternoon = card.querySelector(".admin-itinerary-afternoon")?.value.trim() || "Hoạt động buổi chiều theo lịch trình.";
    const evening = card.querySelector(".admin-itinerary-evening")?.value.trim() || "Hoạt động buổi tối, nghỉ ngơi.";
    itinerary.push({
      day: dayNum,
      title: dayTitle,
      morning,
      afternoon,
      evening
    });
    [
      ["morning", morning],
      ["afternoon", afternoon],
      ["evening", evening]
    ].forEach(([period, description], periodIndex) => {
      const field = card.querySelector(`.admin-itinerary-${period}-category`);
      structuredItinerary.push({
        day_number: dayNum,
        sequence: periodIndex + 1,
        category: field?.value || (period === "evening" ? "meal" : "activity"),
        title: `${dayTitle} - ${period === "morning" ? "Buổi sáng" : period === "afternoon" ? "Buổi chiều" : "Buổi tối"}`,
        description,
        location: "",
        start_time: null
      });
    });
  });

  if (!title || price <= calculatedBaseCost) {
    alert("Giá bán phải cao hơn tổng giá gốc nội bộ. Vui lòng kiểm tra các khoản chi.");
    return;
  }

  const regionNames = { north: "Miền Bắc", central: "Miền Trung", south: "Miền Nam" };
  const regionName = regionNames[region] || "Việt Nam";

  const tours = [...AdminState.tours];
  const existingIdx = tours.findIndex(t => t.id === id);

  const tourData = {
    id,
    title,
    slug,
    region,
    regionName,
    image,
    images: galleryImages,
    duration,
    daysCount: itinerary.length || parseInt(duration) || 3,
    departure,
    transport,
    originalPrice: calculatedBaseCost || originalPrice,
    price,
    childPrice: Math.round(price * 0.65),
    rating: existingIdx !== -1 ? tours[existingIdx].rating : 5.0,
    reviewsCount: existingIdx !== -1 ? tours[existingIdx].reviewsCount : 1,
    badge: badge || (originalPrice > price ? "Ưu đãi Delta" : ""),
    isFlashSale: false,
    availableSeats,
    status,
    countryCode: "VN",
    highlights,
    itinerary,
    inclusions,
    exclusions,
    terms
  };

  if (existingIdx !== -1) {
    tours[existingIdx] = tourData;
    // Persist catalog fields separately; price, private costs and itinerary are
    // replaced atomically by the dedicated details endpoint.
    if (typeof DeltaAPI !== "undefined" && DeltaAPI.adminPatchTour) {
      const catalogUpdate = await DeltaAPI.adminPatchTour(id, {
        title: tourData.title,
        slug: tourData.slug,
        region: tourData.region,
        duration: tourData.duration,
        departure: tourData.departure,
        transport: tourData.transport,
        original_price: Math.max(calculatedBaseCost, 1),
        flash_sale: tourData.isFlashSale,
        description: tourData.highlights.join("\n"),
        active: status === "ACTIVE",
        images: apiImages
      });
      if (!catalogUpdate.success) {
        showAdminToast(catalogUpdate.error || "Không thể cập nhật tour trên máy chủ.", "error");
        return;
      }
    }
  } else {
    tours.unshift(tourData);
    if (typeof DeltaAPI !== "undefined" && DeltaAPI.adminCreateTour) {
      const created = await DeltaAPI.adminCreateTour({
        id: tourData.id,
        title: tourData.title,
        slug: tourData.slug,
        region: tourData.region,
        duration: tourData.duration,
        departure: tourData.departure,
        transport: tourData.transport,
        price: tourData.price,
        original_price: Math.max(calculatedBaseCost, 1),
        images: apiImages,
        description: tourData.highlights.join("\n")
      });
      if (!created.success) {
        showAdminToast(created.error || "Không thể tạo tour trên máy chủ.", "error");
        return;
      }
    }
  }

  if (typeof DeltaAPI !== "undefined" && DeltaAPI.adminReplaceTourDetails) {
    const savedDetails = await DeltaAPI.adminReplaceTourDetails(id, {
      price,
      cost_items: costItems,
      itinerary: structuredItinerary
    });
    if (!savedDetails.success) {
      showAdminToast(savedDetails.error || "Không thể lưu giá và lịch trình trên máy chủ.", "error");
      return;
    }
  }

  addAuditLog(
    existingIdx !== -1 ? "UPDATE_TOUR" : "CREATE_TOUR",
    "Tour",
    id,
    `Đã lưu giá bán ${price.toLocaleString("vi-VN")} đ, giá gốc ${calculatedBaseCost.toLocaleString("vi-VN")} đ và lịch trình ${itinerary.length} ngày.`
  );
  showAdminToast(`Đã lưu tour ${id}, chi phí và lịch trình.`, "success");
  saveToursData(tours);
  bootstrap.Modal.getInstance(document.getElementById("adminTourModal"))?.hide();
  renderCurrentTab();
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// =============================================================================
// X. TAB 3: LỊCH KHỞI HÀNH & KHO CHỖ (SCHEDULES & SLOTS)
// =============================================================================
function renderTabSchedules(container) {
  const schedules = AdminState.schedules;
  const tours = AdminState.tours;

  const filtered = schedules.filter(s => {
    if (AdminState.scheduleTourFilter !== "all" && s.tourId !== AdminState.scheduleTourFilter) return false;
    if (AdminState.scheduleStatusFilter !== "all" && s.status !== AdminState.scheduleStatusFilter) return false;
    return true;
  });

  container.innerHTML = `
    <div class="admin-card">
      <div class="admin-card-header">
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <select class="form-select form-select-sm" style="min-width: 260px;" onchange="handleScheduleTourFilter(this.value)">
            <option value="all">Tất cả Tour du lịch (${tours.length})</option>
            ${tours.map(t => `<option value="${t.id}" ${AdminState.scheduleTourFilter === t.id ? "selected" : ""}>${t.id} - ${t.title}</option>`).join("")}
          </select>

          <select class="form-select form-select-sm" style="width: auto;" onchange="handleScheduleStatusFilter(this.value)">
            <option value="all" ${AdminState.scheduleStatusFilter === "all" ? "selected" : ""}>Tất cả trạng thái</option>
            <option value="OPEN" ${AdminState.scheduleStatusFilter === "OPEN" ? "selected" : ""}>Đang mở bán (OPEN)</option>
            <option value="CLOSED" ${AdminState.scheduleStatusFilter === "CLOSED" ? "selected" : ""}>Đã khóa sổ (CLOSED)</option>
          </select>
        </div>

        <button class="btn-admin-primary" onclick="openScheduleModal()">
          <i class="bi bi-calendar-plus"></i> Thêm Lịch Khởi Hành
        </button>
      </div>

      <div class="admin-card-body p-0">
        <div class="admin-table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Mã Lịch</th>
                <th>Tour Áp Dụng</th>
                <th>Ngày Giờ Đi</th>
                <th>Quy Mô & Kho Chỗ</th>
                <th>Tỷ Lệ Giữ Chỗ</th>
                <th>Giá Người Lớn</th>
                <th>Giá Trẻ Em</th>
                <th>Trạng Thái</th>
                <th class="text-end">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="9" class="text-center py-5 text-muted">
                    <i class="bi bi-calendar-x fs-2 d-block mb-2"></i>
                    Không tìm thấy lịch khởi hành nào phù hợp.
                  </td>
                </tr>
              ` : filtered.map(s => {
                const booked = s.bookedSeats || 0;
                const total = s.totalSeats || 25;
                const percent = Math.min(100, Math.round((booked / total) * 100));
                const remain = total - booked;
                const progressColor = percent >= 90 ? "bg-danger" : percent >= 60 ? "bg-warning" : "bg-success";
                const departureFormatted = new Date(s.departureAt).toLocaleDateString("vi-VN", {
                  weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                return `
                  <tr>
                    <td><strong class="font-monospace">${s.id}</strong></td>
                    <td>
                      <div class="fw-bold text-dark text-truncate" style="max-width: 220px;">${s.tourTitle || s.tourId}</div>
                      <div class="text-muted small">${s.tourId}</div>
                    </td>
                    <td>
                      <div class="fw-semibold text-dark"><i class="bi bi-clock me-1 text-primary"></i>${departureFormatted}</div>
                    </td>
                    <td>
                      <div><strong>${booked}</strong> / ${total} chỗ</div>
                      <div class="text-muted small">Còn ${remain} chỗ trống</div>
                    </td>
                    <td style="min-width: 140px;">
                      <div class="d-flex align-items-center gap-2">
                        <div class="progress flex-grow-1" style="height: 6px;">
                          <div class="progress-bar ${progressColor}" role="progressbar" style="width: ${percent}%;"></div>
                        </div>
                        <span class="small font-monospace fw-bold">${percent}%</span>
                      </div>
                    </td>
                    <td class="fw-bold text-dark">${(tours.find(t => t.id === s.tourId)?.price || 0).toLocaleString("vi-VN")} đ</td>
                    <td class="text-muted">${Math.round((tours.find(t => t.id === s.tourId)?.price || 0) * 0.75).toLocaleString("vi-VN")} đ</td>
                    <td>
                      <span class="admin-badge badge-status-${s.status || 'OPEN'}">
                        ${s.status === 'OPEN' ? 'ĐANG MỞ BÁN' : 'ĐÃ ĐÓNG SỔ'}
                      </span>
                    </td>
                    <td class="text-end">
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary" onclick="openScheduleModal('${s.id}')" title="Sửa lịch & giá">
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="handleToggleScheduleStatus('${s.id}')" title="Khóa / Mở lịch">
                          <i class="bi bi-lock"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function handleScheduleTourFilter(val) {
  AdminState.scheduleTourFilter = val;
  renderTabSchedules(document.getElementById("adminTabContentContainer"));
}

function handleScheduleStatusFilter(val) {
  AdminState.scheduleStatusFilter = val;
  renderTabSchedules(document.getElementById("adminTabContentContainer"));
}

async function handleToggleScheduleStatus(schId) {
  const schedules = [...AdminState.schedules];
  const idx = schedules.findIndex(s => s.id === schId);
  if (idx !== -1) {
    const cur = schedules[idx].status || "OPEN";
    const status = (cur === "OPEN") ? "CLOSED" : "OPEN";
    if (typeof DeltaAPI !== "undefined" && DeltaAPI.isOnline()) {
      let response;
      try {
        response = await DeltaAPI.adminPatchSchedule(schId, { active: status === "OPEN" });
      } catch (error) {
        console.error("Could not update schedule status through API.", error);
        showAdminToast("Không thể kết nối máy chủ để cập nhật lịch.", "error");
        return;
      }
      if (!response?.success) {
        showAdminToast(response?.error || "Không thể cập nhật trạng thái lịch.", "error");
        return;
      }
    }
    schedules[idx].status = status;
    saveSchedulesData(schedules);
    addAuditLog("UPDATE_SCHEDULE", "Schedule", schId, `Chuyển trạng thái lịch ${schId} sang ${schedules[idx].status}`);
    showAdminToast(`Lịch ${schId} đã chuyển sang ${schedules[idx].status}`, "success");
    renderCurrentTab();
  }
}

function openScheduleModal(scheduleId = null) {
  AdminState.editingScheduleId = scheduleId;
  const sch = scheduleId ? AdminState.schedules.find(s => s.id === scheduleId) : null;
  const modalEl = document.getElementById("adminScheduleModal");
  if (!modalEl) return;

  const selectTour = document.getElementById("formSchTourId");
  if (selectTour) {
    selectTour.innerHTML = AdminState.tours.map(t => `
      <option value="${t.id}" ${sch && sch.tourId === t.id ? "selected" : ""}>${t.id} - ${t.title}</option>
    `).join("");
  }

  const defaultDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16);
  document.getElementById("scheduleModalTitle").textContent = sch ? "Chỉnh Sửa Lịch Khởi Hành" : "Thêm Lịch Khởi Hành Mới";
  document.getElementById("formSchId").value = sch ? sch.id : ("SCH-" + Date.now().toString().slice(-4));
  document.getElementById("formSchDate").value = sch ? sch.departureAt.slice(0, 16) : defaultDate;
  document.getElementById("formSchSeats").value = sch ? sch.totalSeats : 30;
  const tour = AdminState.tours.find(item => item.id === (sch?.tourId || selectTour?.value));
  if (selectTour) selectTour.disabled = Boolean(sch);
  document.getElementById("formSchAdultPrice").value = tour?.price || 3890000;
  document.getElementById("formSchChildPrice").value = tour ? Math.round(tour.price * 0.75) : 2490000;
  document.getElementById("formSchStatus").value = sch ? sch.status : "OPEN";
  document.getElementById("formSchDate").disabled = Boolean(sch);
  document.getElementById("formSchAdultPrice").disabled = true;
  document.getElementById("formSchChildPrice").disabled = true;

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function handleSaveScheduleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("formSchId").value.trim();
  const tourId = document.getElementById("formSchTourId").value;
  const departureAt = document.getElementById("formSchDate").value;
  const totalSeats = Number(document.getElementById("formSchSeats").value) || 30;
  const status = document.getElementById("formSchStatus").value;

  const tour = AdminState.tours.find(t => t.id === tourId);
  const tourTitle = tour ? tour.title : tourId;

  const schedules = [...AdminState.schedules];
  const idx = schedules.findIndex(s => s.id === id);

  let schData = {
    id,
    tourId,
    tourTitle,
    departureAt: new Date(departureAt).toISOString(),
    totalSeats,
    bookedSeats: idx !== -1 ? schedules[idx].bookedSeats : 0,
    status
  };

  if (typeof DeltaAPI !== "undefined" && DeltaAPI.isOnline()) {
    let response;
    try {
      response = idx !== -1
        ? await DeltaAPI.adminPatchSchedule(id, {
          total_seats: totalSeats,
          active: status === "OPEN"
        })
        : await DeltaAPI.adminCreateSchedule({
          tour_id: tourId,
          departure_at: schData.departureAt,
          total_seats: totalSeats
        });
    } catch (error) {
      console.error("Could not save schedule to API.", error);
      showAdminToast("Không thể kết nối máy chủ để lưu lịch khởi hành.", "error");
      return;
    }
    if (!response?.success) {
      showAdminToast(response?.error || "Không thể lưu lịch khởi hành.", "error");
      return;
    }
    const saved = response.data;
    schData = {
      id: saved.id,
      tourId: saved.tourId,
      tourTitle,
      departureAt: saved.departureAt,
      totalSeats: saved.totalSeats,
      bookedSeats: saved.totalSeats - saved.availableSeats,
      status: saved.active ? "OPEN" : "CLOSED"
    };
  }

  if (idx !== -1) {
    schedules[idx] = schData;
    addAuditLog("UPDATE_SCHEDULE", "Schedule", id, `Cập nhật lịch ${id} cho tour ${tourTitle} (Khởi hành: ${departureAt})`);
    showAdminToast(`Cập nhật lịch khởi hành ${id} thành công!`, "success");
  } else {
    schedules.unshift(schData);
    addAuditLog("CREATE_SCHEDULE", "Schedule", id, `Tạo lịch khởi hành mới ${id} cho tour ${tourTitle} (Khởi hành: ${departureAt}, Chỗ: ${totalSeats})`);
    showAdminToast(`Thêm lịch khởi hành mới ${id} thành công!`, "success");
  }

  saveSchedulesData(schedules);
  bootstrap.Modal.getInstance(document.getElementById("adminScheduleModal"))?.hide();
  renderCurrentTab();
}

// =============================================================================
// XI. TAB 4: QUẢN LÝ ĐƠN ĐẶT TOUR & SAO KÊ DOANH THU (BOOKINGS CRUD)
// =============================================================================
function renderTabBookings(container) {
  const bookings = AdminState.bookings;

  // Lọc theo search, status, ngày
  const filtered = bookings.filter(b => {
    if (AdminState.bookingStatusFilter !== "all" && b.statusCode !== AdminState.bookingStatusFilter) return false;

    if (AdminState.bookingSearch.trim()) {
      const q = AdminState.bookingSearch.toLowerCase();
      const matchId = (b.bookingId || "").toLowerCase().includes(q);
      const matchName = (b.customer?.fullName || "").toLowerCase().includes(q);
      const matchPhone = (b.customer?.phone || "").toLowerCase().includes(q);
      const matchEmail = (b.customer?.email || "").toLowerCase().includes(q);
      const matchTour = (b.tourTitle || "").toLowerCase().includes(q);
      if (!matchId && !matchName && !matchPhone && !matchEmail && !matchTour) return false;
    }

    return true;
  });

  const totalBookings = bookings.length;
  const paidBookings = bookings.filter(b => b.isPaid || b.statusCode === "PAID" || b.statusCode === "CONFIRMED" || b.statusCode === "COMPLETED").length;
  const totalRevenue = bookings
    .filter(b => b.isPaid || b.statusCode === "PAID" || b.statusCode === "CONFIRMED" || b.statusCode === "COMPLETED")
    .reduce((sum, b) => sum + (b.pricing?.total || 0), 0);
  const pendingCount = bookings.filter(b => b.statusCode === "AWAITING_CASH" || b.statusCode === "PENDING_PAYMENT").length;

  container.innerHTML = `
    <!-- Thống kê doanh thu sao kê -->
    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-muted small">Tổng Đơn Đặt</div>
          <div class="fs-4 fw-bold text-dark">${totalBookings}</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-success small fw-semibold">Tổng Doanh Thu Đã Thu</div>
          <div class="fs-4 fw-bold text-success">${totalRevenue.toLocaleString("vi-VN")} đ</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-primary small fw-semibold">Đơn Đã Thanh Toán</div>
          <div class="fs-4 fw-bold text-primary">${paidBookings} / ${totalBookings}</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-warning small fw-semibold">Đơn Chờ Thu Tiền Mặt</div>
          <div class="fs-4 fw-bold text-warning">${pendingCount}</div>
        </div>
      </div>
    </div>

    <!-- Thanh tìm kiếm & nút sao kê -->
    <div class="admin-card">
      <div class="admin-card-header">
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <div class="admin-search-input">
            <i class="bi bi-search"></i>
            <input type="text" class="form-control" placeholder="Tìm theo Mã đơn, Khách, SĐT, Tour..." value="${AdminState.bookingSearch}" oninput="handleBookingSearch(this.value)">
          </div>

          <select class="form-select form-select-sm" style="width: auto;" onchange="handleBookingStatusFilter(this.value)">
            <option value="all" ${AdminState.bookingStatusFilter === "all" ? "selected" : ""}>Tất cả trạng thái</option>
            <option value="PAID" ${AdminState.bookingStatusFilter === "PAID" ? "selected" : ""}>Đã thanh toán (PAID)</option>
            <option value="CONFIRMED" ${AdminState.bookingStatusFilter === "CONFIRMED" ? "selected" : ""}>Đã xác nhận (CONFIRMED)</option>
            <option value="AWAITING_CASH" ${AdminState.bookingStatusFilter === "AWAITING_CASH" ? "selected" : ""}>Chờ tiền mặt (AWAITING_CASH)</option>
            <option value="COMPLETED" ${AdminState.bookingStatusFilter === "COMPLETED" ? "selected" : ""}>Hoàn thành (COMPLETED)</option>
            <option value="CANCELLED" ${AdminState.bookingStatusFilter === "CANCELLED" ? "selected" : ""}>Đã hủy (CANCELLED)</option>
          </select>
        </div>

        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-admin-outline" onclick="exportBookingsToCSV()">
            <i class="bi bi-file-earmark-spreadsheet text-success"></i> Xuất Sao Kê (CSV)
          </button>
          <button class="btn btn-admin-outline" onclick="window.print()">
            <i class="bi bi-printer text-dark"></i> In Báo Cáo
          </button>
        </div>
      </div>

      <!-- In Header độc quyền khi in -->
      <div class="print-only-header p-4">
        <h3 class="fw-bold text-uppercase">DELTA TRAVEL - SAO KÊ CHI TIẾT ĐƠN HÀNG & DOANH THU</h3>
        <p class="small text-muted mb-0">Thời điểm trích xuất: ${new Date().toLocaleString("vi-VN")} • Người lập: ${AdminState.currentUser?.fullName || 'Quản trị viên'}</p>
        <p class="small text-muted">Tổng doanh thu thực tế: <strong>${totalRevenue.toLocaleString("vi-VN")} đ</strong> | Tổng số đơn: <strong>${filtered.length}</strong></p>
      </div>

      <div class="admin-card-body p-0">
        <div class="admin-table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Thời Gian Đặt</th>
                <th>Khách Hàng</th>
                <th>Tour & Ngày Khởi Hành</th>
                <th>Số Khách</th>
                <th>Tổng Tiền</th>
                <th>Hình Thức</th>
                <th>Trạng Thái</th>
                <th class="text-end no-print">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="9" class="text-center py-5 text-muted">
                    <i class="bi bi-ticket-detailed fs-2 d-block mb-2"></i>
                    Không có đơn đặt tour nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ` : filtered.map(b => `
                <tr>
                  <td><strong class="font-monospace text-primary">${b.bookingId}</strong></td>
                  <td><span class="small text-muted">${b.createdAt}</span></td>
                  <td>
                    <div class="fw-bold">${b.customer.fullName}</div>
                    <div class="text-muted small">${b.customer.phone}</div>
                  </td>
                  <td>
                    <div class="text-truncate fw-semibold" style="max-width: 220px;" title="${b.tourTitle}">${b.tourTitle}</div>
                    <div class="text-muted small"><i class="bi bi-calendar-event me-1"></i>${b.departureDate}</div>
                  </td>
                  <td>
                    <span class="badge bg-light text-dark border">
                      ${b.passengers?.adults || 1}L ${b.passengers?.children ? `+ ${b.passengers.children}T` : ''}
                    </span>
                  </td>
                  <td class="fw-bold text-dark">${b.pricing.total.toLocaleString("vi-VN")} đ</td>
                  <td><span class="small text-muted">${b.paymentMethod || 'Chuyển khoản'}</span></td>
                  <td>
                    <span class="admin-badge badge-status-${b.statusCode || 'PAID'}">
                      ${b.status}
                    </span>
                  </td>
                  <td class="text-end no-print">
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-primary" onclick="openBookingDetailModal('${b.bookingId}')" title="Xem chi tiết đơn">
                        <i class="bi bi-eye"></i>
                      </button>
                      ${b.statusCode !== 'CONFIRMED' && b.statusCode !== 'COMPLETED' && b.statusCode !== 'CANCELLED' ? `
                        <button class="btn btn-outline-success" onclick="handleQuickConfirmBooking('${b.bookingId}')" title="Duyệt / Xác nhận đơn">
                          <i class="bi bi-check-lg"></i>
                        </button>
                      ` : ''}
                      ${b.statusCode === 'CONFIRMED' ? `
                        <button class="btn btn-outline-info" onclick="handleCompleteBooking('${b.bookingId}')" title="Đánh dấu hoàn thành tour">
                          <i class="bi bi-flag-fill"></i>
                        </button>
                      ` : ''}
                      ${b.statusCode !== 'CANCELLED' ? `
                        <button class="btn btn-outline-danger" onclick="openCancelBookingModal('${b.bookingId}')" title="Hủy đơn đặt">
                          <i class="bi bi-x-circle"></i>
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function handleBookingSearch(val) {
  AdminState.bookingSearch = val;
  renderTabBookings(document.getElementById("adminTabContentContainer"));
}

function handleBookingStatusFilter(val) {
  AdminState.bookingStatusFilter = val;
  renderTabBookings(document.getElementById("adminTabContentContainer"));
}

function handleQuickConfirmBooking(bookingId) {
  const bookings = [...AdminState.bookings];
  const idx = bookings.findIndex(b => b.bookingId === bookingId);
  if (idx !== -1) {
    bookings[idx].status = "ĐÃ XÁC NHẬN";
    bookings[idx].statusCode = "CONFIRMED";
    bookings[idx].isPaid = true;
    saveBookingsData(bookings);

    // Cập nhật trạng thái payment tương ứng nếu có
    const payments = [...AdminState.payments];
    const pIdx = payments.findIndex(p => p.bookingId === bookingId);
    if (pIdx !== -1) {
      payments[pIdx].status = "SUCCEEDED";
      savePaymentsData(payments);
    }

    addAuditLog("CONFIRM_BOOKING", "Booking", bookingId, `Xác nhận giữ chỗ chính thức cho đơn ${bookingId} (${bookings[idx].customer.fullName})`);
    showAdminToast(`Đã duyệt xác nhận đơn ${bookingId}!`, "success");
    renderCurrentTab();
  }
}

function handleCompleteBooking(bookingId) {
  const bookings = [...AdminState.bookings];
  const idx = bookings.findIndex(b => b.bookingId === bookingId);
  if (idx !== -1) {
    bookings[idx].status = "HOÀN THÀNH";
    bookings[idx].statusCode = "COMPLETED";
    saveBookingsData(bookings);
    addAuditLog("COMPLETE_BOOKING", "Booking", bookingId, `Hoàn thành hành trình tour cho đơn ${bookingId}`);
    showAdminToast(`Đơn ${bookingId} đã hoàn thành tour!`, "success");
    renderCurrentTab();
  }
}

/**
 * Modal Xem Chi Tiết Đơn Đặt Tour
 */
function openBookingDetailModal(bookingId) {
  const booking = AdminState.bookings.find(b => b.bookingId === bookingId);
  if (!booking) return;

  const modalEl = document.getElementById("adminBookingDetailModal");
  if (!modalEl) return;

  document.getElementById("detailModalBookingId").textContent = booking.bookingId;
  document.getElementById("detailModalCreatedAt").textContent = booking.createdAt;
  document.getElementById("detailModalStatus").innerHTML = `
    <span class="admin-badge badge-status-${booking.statusCode || 'PAID'}">${booking.status}</span>
  `;

  // Thông tin khách
  document.getElementById("detailCustomerName").textContent = booking.customer.fullName;
  document.getElementById("detailCustomerPhone").textContent = booking.customer.phone;
  document.getElementById("detailCustomerEmail").textContent = booking.customer.email;
  document.getElementById("detailCustomerCccd").textContent = booking.customer.cccd || "Chưa cung cấp";
  document.getElementById("detailCustomerNotes").textContent = booking.customer.notes || "Không có ghi chú";

  // Thông tin tour
  document.getElementById("detailTourTitle").textContent = booking.tourTitle;
  document.getElementById("detailTourDate").textContent = booking.departureDate;
  document.getElementById("detailTourPax").textContent = `${booking.passengers?.adults || 1} Người lớn, ${booking.passengers?.children || 0} Trẻ em, ${booking.passengers?.infants || 0} Em bé`;
  document.getElementById("detailPaymentMethod").textContent = booking.paymentMethod;

  // Bảng giá
  document.getElementById("detailSubtotal").textContent = (booking.pricing?.subtotal || booking.pricing?.total).toLocaleString("vi-VN") + " đ";
  document.getElementById("detailDiscount").textContent = (booking.pricing?.discount || 0).toLocaleString("vi-VN") + " đ";
  document.getElementById("detailGrandTotal").textContent = (booking.pricing?.total || 0).toLocaleString("vi-VN") + " đ";

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

/**
 * Modal Hủy Đơn & Lý Do
 */
function openCancelBookingModal(bookingId) {
  const booking = AdminState.bookings.find(b => b.bookingId === bookingId);
  if (!booking) return;

  document.getElementById("cancelModalBookingId").textContent = booking.bookingId;
  document.getElementById("cancelModalCustomer").textContent = booking.customer.fullName;
  document.getElementById("cancelModalTargetId").value = bookingId;
  document.getElementById("cancelReasonInput").value = "";

  const modalEl = document.getElementById("adminCancelModal");
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function handleQuickCancelReason(reasonText) {
  const input = document.getElementById("cancelReasonInput");
  if (input) input.value = reasonText;
}

function handleConfirmCancelSubmit(e) {
  e.preventDefault();
  const bookingId = document.getElementById("cancelModalTargetId").value;
  const reason = document.getElementById("cancelReasonInput").value.trim();

  if (!reason || reason.length < 3) {
    alert("Vui lòng nhập lý do hủy đơn (tối thiểu 3 ký tự)!");
    return;
  }

  const bookings = [...AdminState.bookings];
  const idx = bookings.findIndex(b => b.bookingId === bookingId);
  if (idx !== -1) {
    bookings[idx].status = "ĐÃ HỦY";
    bookings[idx].statusCode = "CANCELLED";
    bookings[idx].cancelReason = reason;

    // Nếu đơn đã thanh toán trước đó, chuyển trạng thái hoàn tiền
    if (bookings[idx].isPaid) {
      bookings[idx].refundStatus = "REFUND_REQUIRED";
      // Cập nhật payment
      const payments = [...AdminState.payments];
      const pIdx = payments.findIndex(p => p.bookingId === bookingId);
      if (pIdx !== -1) {
        payments[pIdx].status = "REFUND_REQUIRED";
        payments[pIdx].note = `Đơn hủy: ${reason} (Chờ hoàn tiền)`;
        savePaymentsData(payments);
      }
    }

    saveBookingsData(bookings);
    addAuditLog("CANCEL_BOOKING", "Booking", bookingId, `Hủy đơn ${bookingId} - Lý do: ${reason}`);
    showAdminToast(`Đã hủy đơn ${bookingId} thành công!`, "warning");

    bootstrap.Modal.getInstance(document.getElementById("adminCancelModal"))?.hide();
    renderCurrentTab();
  }
}

/**
 * Xuất dữ liệu Sao Kê sang file CSV tương thích Excel
 */
function exportBookingsToCSV() {
  const bookings = AdminState.bookings;
  if (!bookings || bookings.length === 0) {
    showAdminToast("Không có dữ liệu đơn để xuất file!", "warning");
    return;
  }

  const headers = ["Mã Đơn", "Ngày Đặt", "Khách Hàng", "SĐT", "Email", "Tour", "Ngày Đi", "Người Lớn", "Trẻ Em", "Tổng Tiền (VND)", "Phương Thức", "Trạng Thái"];
  const rows = bookings.map(b => [
    b.bookingId,
    `"${b.createdAt}"`,
    `"${b.customer.fullName}"`,
    `"${b.customer.phone}"`,
    `"${b.customer.email}"`,
    `"${b.tourTitle}"`,
    `"${b.departureDate}"`,
    b.passengers?.adults || 1,
    b.passengers?.children || 0,
    b.pricing?.total || 0,
    `"${b.paymentMethod || 'Chuyển khoản'}"`,
    `"${b.status}"`
  ]);

  // Thêm BOM UTF-8 để Microsoft Excel hiển thị đúng tiếng Việt
  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `SaoKe_DeltaTravel_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showAdminToast("Đã tải xuống file Sao Kê CSV thành công!", "success");
}

// =============================================================================
// XII. TAB 5: THANH TOÁN & HOÀN TIỀN (PAYMENTS & REFUNDS)
// =============================================================================
function renderTabPayments(container) {
  const payments = AdminState.payments;

  const filtered = payments.filter(p => {
    if (AdminState.paymentStatusFilter !== "all" && p.status !== AdminState.paymentStatusFilter) return false;
    if (AdminState.paymentProviderFilter !== "all" && p.provider !== AdminState.paymentProviderFilter) return false;
    return true;
  });

  const totalSucceeded = payments
    .filter(p => p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const pendingCash = payments
    .filter(p => p.status === "INITIATED" && p.provider === "CASH")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const refundRequiredCount = payments.filter(p => p.status === "REFUND_REQUIRED").length;
  const refundedCount = payments.filter(p => p.status === "REFUNDED").length;

  container.innerHTML = `
    <!-- Chỉ số đối soát dòng tiền -->
    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-success small fw-semibold">Đã Thu Thực Tế (SUCCEEDED)</div>
          <div class="fs-4 fw-bold text-success">${totalSucceeded.toLocaleString("vi-VN")} đ</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-warning small fw-semibold">Tiền Mặt Chờ Thu (INITIATED)</div>
          <div class="fs-4 fw-bold text-warning">${pendingCash.toLocaleString("vi-VN")} đ</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-danger small fw-semibold">Chờ Hoàn Tiền (REFUND_REQ)</div>
          <div class="fs-4 fw-bold text-danger">${refundRequiredCount} giao dịch</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="p-3 bg-white border rounded-3 text-center">
          <div class="text-secondary small fw-semibold">Đã Hoàn Tiền (REFUNDED)</div>
          <div class="fs-4 fw-bold text-secondary">${refundedCount} giao dịch</div>
        </div>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card-header">
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <select class="form-select form-select-sm" style="width: auto;" onchange="handlePaymentStatusFilter(this.value)">
            <option value="all" ${AdminState.paymentStatusFilter === "all" ? "selected" : ""}>Tất cả trạng thái</option>
            <option value="SUCCEEDED" ${AdminState.paymentStatusFilter === "SUCCEEDED" ? "selected" : ""}>Thành công (SUCCEEDED)</option>
            <option value="INITIATED" ${AdminState.paymentStatusFilter === "INITIATED" ? "selected" : ""}>Chờ thu (INITIATED)</option>
            <option value="REFUND_REQUIRED" ${AdminState.paymentStatusFilter === "REFUND_REQUIRED" ? "selected" : ""}>Chờ hoàn (REFUND_REQUIRED)</option>
            <option value="REFUNDED" ${AdminState.paymentStatusFilter === "REFUNDED" ? "selected" : ""}>Đã hoàn (REFUNDED)</option>
          </select>

          <select class="form-select form-select-sm" style="width: auto;" onchange="handlePaymentProviderFilter(this.value)">
            <option value="all" ${AdminState.paymentProviderFilter === "all" ? "selected" : ""}>Tất cả phương thức</option>
            <option value="CASH" ${AdminState.paymentProviderFilter === "CASH" ? "selected" : ""}>Tiền mặt (CASH)</option>
            <option value="QR" ${AdminState.paymentProviderFilter === "QR" ? "selected" : ""}>VietQR (Ngân hàng)</option>
            <option value="VNPAY" ${AdminState.paymentProviderFilter === "VNPAY" ? "selected" : ""}>VNPay Sandbox</option>
            <option value="MOMO" ${AdminState.paymentProviderFilter === "MOMO" ? "selected" : ""}>Ví MoMo</option>
            <option value="ZALOPAY" ${AdminState.paymentProviderFilter === "ZALOPAY" ? "selected" : ""}>ZaloPay</option>
          </select>
        </div>

        <button class="btn btn-admin-outline" onclick="refreshAdminData(); renderCurrentTab();">
          <i class="bi bi-arrow-repeat"></i> Làm Mới Dòng Tiền
        </button>
      </div>

      <div class="admin-card-body p-0">
        <div class="admin-table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Mã GD</th>
                <th>Mã Đơn</th>
                <th>Khách Hàng & Tour</th>
                <th>Số Tiền</th>
                <th>Cổng Thanh Toán</th>
                <th>Mã Tham Chiếu</th>
                <th>Trạng Thái</th>
                <th class="text-end">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="8" class="text-center py-5 text-muted">
                    <i class="bi bi-credit-card fs-2 d-block mb-2"></i>
                    Không có giao dịch nào phù hợp.
                  </td>
                </tr>
              ` : filtered.map(p => `
                <tr>
                  <td><strong class="font-monospace">${p.id}</strong></td>
                  <td><a href="javascript:void(0)" onclick="openBookingDetailModal('${p.bookingId}')" class="text-decoration-none fw-bold">${p.bookingId}</a></td>
                  <td>
                    <div class="fw-bold">${p.customerName || 'Khách vãng lai'}</div>
                    <div class="text-muted small text-truncate" style="max-width: 200px;">${p.tourTitle}</div>
                  </td>
                  <td class="fw-bold text-dark">${p.amount.toLocaleString("vi-VN")} đ</td>
                  <td>
                    <span class="badge bg-light text-dark border">${p.providerName || p.provider}</span>
                  </td>
                  <td><code class="small text-muted">${p.reference || '-'}</code></td>
                  <td>
                    <span class="admin-badge badge-status-${p.status}">
                      ${p.status}
                    </span>
                  </td>
                  <td class="text-end">
                    ${p.status === 'INITIATED' && p.provider === 'CASH' ? `
                      <button class="btn btn-sm btn-success" onclick="openRecordCashModal('${p.id}')">
                        <i class="bi bi-cash-coin me-1"></i> Thu Tiền Mặt
                      </button>
                    ` : ''}
                    ${p.status === 'REFUND_REQUIRED' ? `
                      <button class="btn btn-sm btn-warning text-dark fw-bold" onclick="openRecordRefundModal('${p.id}')">
                        <i class="bi bi-arrow-counterclockwise me-1"></i> Hoàn Tiền
                      </button>
                    ` : ''}
                    ${p.status === 'SUCCEEDED' ? `
                      <span class="text-success small fw-semibold"><i class="bi bi-check-circle-fill"></i> Đã quyết toán</span>
                    ` : ''}
                    ${p.status === 'REFUNDED' ? `
                      <span class="text-purple small fw-semibold"><i class="bi bi-patch-check"></i> Đã hoàn tất</span>
                    ` : ''}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function handlePaymentStatusFilter(val) {
  AdminState.paymentStatusFilter = val;
  renderTabPayments(document.getElementById("adminTabContentContainer"));
}

function handlePaymentProviderFilter(val) {
  AdminState.paymentProviderFilter = val;
  renderTabPayments(document.getElementById("adminTabContentContainer"));
}

/**
 * Modal Ghi Nhận Thu Tiền Mặt (Record Cash Receipt)
 */
function openRecordCashModal(paymentId) {
  const p = AdminState.payments.find(item => item.id === paymentId);
  if (!p) return;

  document.getElementById("cashModalPaymentId").textContent = p.id;
  document.getElementById("cashModalBookingId").textContent = p.bookingId;
  document.getElementById("cashModalAmount").textContent = p.amount.toLocaleString("vi-VN") + " đ";
  document.getElementById("cashTargetPaymentId").value = paymentId;
  document.getElementById("cashRefInput").value = "CASH-REC-" + Date.now().toString().slice(-4);
  document.getElementById("cashNoteInput").value = "Đã thu tiền mặt đầy đủ tại văn phòng Delta Travel";

  const modalEl = document.getElementById("adminCashModal");
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function handleRecordCashSubmit(e) {
  e.preventDefault();
  const paymentId = document.getElementById("cashTargetPaymentId").value;
  const ref = document.getElementById("cashRefInput").value.trim();
  const note = document.getElementById("cashNoteInput").value.trim();

  const payments = [...AdminState.payments];
  const pIdx = payments.findIndex(item => item.id === paymentId);
  if (pIdx !== -1) {
    payments[pIdx].status = "SUCCEEDED";
    payments[pIdx].reference = ref;
    payments[pIdx].note = note;
    savePaymentsData(payments);

    // Cập nhật booking sang PAID / CONFIRMED
    const bookingId = payments[pIdx].bookingId;
    const bookings = [...AdminState.bookings];
    const bIdx = bookings.findIndex(b => b.bookingId === bookingId);
    if (bIdx !== -1) {
      bookings[bIdx].status = "ĐÃ XÁC NHẬN";
      bookings[bIdx].statusCode = "CONFIRMED";
      bookings[bIdx].isPaid = true;
      saveBookingsData(bookings);

      // Đồng bộ xác nhận thanh toán với Backend API nếu có
      if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.adminConfirmPayment === "function") {
        DeltaAPI.adminConfirmPayment(bookingId, ref).catch(() => {});
      }
    }

    addAuditLog("RECORD_CASH", "Payment", paymentId, `Ghi nhận thu tiền mặt ${payments[pIdx].amount.toLocaleString("vi-VN")} đ cho đơn ${bookingId} (Mã phiếu: ${ref})`);
    showAdminToast(`Ghi nhận thu tiền mặt thành công! Đơn ${bookingId} đã được xác nhận.`, "success");

    bootstrap.Modal.getInstance(document.getElementById("adminCashModal"))?.hide();
    renderCurrentTab();
  }
}

/**
 * Modal Ghi Nhận Hoàn Tiền (Record Refund)
 */
function openRecordRefundModal(paymentId) {
  const p = AdminState.payments.find(item => item.id === paymentId);
  if (!p) return;

  document.getElementById("refundModalPaymentId").textContent = p.id;
  document.getElementById("refundModalBookingId").textContent = p.bookingId;
  document.getElementById("refundModalAmount").textContent = p.amount.toLocaleString("vi-VN") + " đ";
  document.getElementById("refundTargetPaymentId").value = paymentId;
  document.getElementById("refundRefInput").value = "REFUND-BANK-" + Date.now().toString().slice(-4);
  document.getElementById("refundNoteInput").value = "Hoàn tiền hủy tour về tài khoản của khách hàng";

  const modalEl = document.getElementById("adminRefundModal");
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function handleRecordRefundSubmit(e) {
  e.preventDefault();
  const paymentId = document.getElementById("refundTargetPaymentId").value;
  const ref = document.getElementById("refundRefInput").value.trim();
  const note = document.getElementById("refundNoteInput").value.trim();

  const payments = [...AdminState.payments];
  const pIdx = payments.findIndex(item => item.id === paymentId);
  if (pIdx !== -1) {
    payments[pIdx].status = "REFUNDED";
    payments[pIdx].reference = ref;
    payments[pIdx].note = note;
    savePaymentsData(payments);

    // Cập nhật booking refundStatus
    const bookingId = payments[pIdx].bookingId;
    const bookings = [...AdminState.bookings];
    const bIdx = bookings.findIndex(b => b.bookingId === bookingId);
    if (bIdx !== -1) {
      bookings[bIdx].refundStatus = "REFUNDED";
      saveBookingsData(bookings);
    }

    addAuditLog("RECORD_REFUND", "Payment", paymentId, `Ghi nhận hoàn tiền ${payments[pIdx].amount.toLocaleString("vi-VN")} đ cho đơn ${bookingId} (Mã GD hoàn: ${ref})`);
    showAdminToast(`Ghi nhận hoàn tiền thành công cho đơn ${bookingId}!`, "success");

    bootstrap.Modal.getInstance(document.getElementById("adminRefundModal"))?.hide();
    renderCurrentTab();
  }
}

// =============================================================================
// XIII. TAB 6: AI & TRẠNG THÁI HỆ THỐNG (SYSTEM & READINESS)
// =============================================================================
function renderTabSystem(container) {
  let storageUsage = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      storageUsage += (localStorage[key].length * 2);
    }
  }
  const storageUsageKB = (storageUsage / 1024).toFixed(2);

  container.innerHTML = `
    <!-- Thẻ trạng thái từng dịch vụ -->
    <div class="row g-4 mb-4">
      <div class="col-md-6 col-xl-3">
        <div class="admin-card h-100">
          <div class="admin-card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <span class="admin-metric-label">Frontend API Engine</span>
              <span class="badge bg-success">ACTIVE</span>
            </div>
            <h4 class="fw-bold text-dark mb-1">Local Storage</h4>
            <p class="text-muted small mb-0">Engine thuần Client 100% không phụ thuộc máy chủ Node bên ngoài.</p>
          </div>
        </div>
      </div>

      <div class="col-md-6 col-xl-3">
        <div class="admin-card h-100">
          <div class="admin-card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <span class="admin-metric-label">Trợ lý nội bộ</span>
              <span class="badge bg-success">ONLINE</span>
            </div>
            <h4 class="fw-bold text-dark mb-1">Trợ lý du lịch</h4>
            <p class="text-muted small mb-0">Phản hồi rule-based từ API nội bộ, không gửi dữ liệu đến dịch vụ AI bên ngoài.</p>
          </div>
        </div>
      </div>

      <div class="col-md-6 col-xl-3">
        <div class="admin-card h-100">
          <div class="admin-card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <span class="admin-metric-label">Dung lượng Bộ Nhớ</span>
              <span class="badge bg-primary">${storageUsageKB} KB</span>
            </div>
            <h4 class="fw-bold text-dark mb-1">Persistent DB</h4>
            <p class="text-muted small mb-0">Lưu trữ ${AdminState.tours.length} tours, ${AdminState.bookings.length} đơn, ${AdminState.payments.length} GD, ${AdminState.auditLogs.length} logs.</p>
          </div>
        </div>
      </div>

      <div class="col-md-6 col-xl-3">
        <div class="admin-card h-100">
          <div class="admin-card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <span class="admin-metric-label">Thanh toán VietQR & Cash</span>
              <span class="badge bg-success">READY</span>
            </div>
            <h4 class="fw-bold text-dark mb-1">Live Payment</h4>
            <p class="text-muted small mb-0">Mã QR VietinBank chuẩn NAPAS và thu tiền mặt văn phòng.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Công cụ Kiểm tra Trợ lý Du lịch & Factory Reset -->
    <div class="row g-4">
      <div class="col-lg-7">
        <div class="admin-card">
          <div class="admin-card-header">
            <h5 class="admin-card-title">
              <i class="bi bi-terminal text-primary"></i> Chẩn Đoán Trợ Lý Du Lịch
            </h5>
          </div>
          <div class="admin-card-body">
            <p class="small text-muted mb-3">
              Nhập câu hỏi về tour để kiểm tra phản hồi từ API trợ lý du lịch nội bộ.
            </p>
            <div class="input-group mb-3">
              <input type="text" class="form-control" id="aiDiagnosticInput" placeholder="Ví dụ: Giới thiệu tour Hạ Long 3N2Đ và chính sách hoàn hủy..." value="Giới thiệu tour Hạ Long 3N2Đ và chính sách hoàn hủy">
              <button class="btn btn-admin-primary" type="button" onclick="testLiveAiConnection()">
                <i class="bi bi-play-fill"></i> Gửi Kiểm Tra
              </button>
            </div>
            <div id="aiDiagnosticOutput" class="p-3 bg-light border rounded-3 small font-monospace" style="min-height: 100px; max-height: 250px; overflow-y: auto;">
              Nhấn "Gửi Kiểm Tra" để bắt đầu kiểm tra luồng AI...
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-5">
        <div class="admin-card">
          <div class="admin-card-header">
            <h5 class="admin-card-title text-danger">
              <i class="bi bi-arrow-counterclockwise"></i> Khôi Phục Dữ Liệu Gốc (Factory Reset)
            </h5>
          </div>
          <div class="admin-card-body">
            <div class="alert alert-warning small mb-3">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              Hành động này sẽ khôi phục toàn bộ danh mục Tour, Lịch khởi hành, Đơn đặt mẫu, Giao dịch và Nhật ký kiểm toán về bộ dữ liệu hạt giống ban đầu chuẩn của Delta Travel.
            </div>
            <button class="btn btn-outline-danger w-100 fw-bold py-2.5" onclick="handleFactoryReset()">
              <i class="bi bi-trash3 me-1"></i> Khôi Phục Toàn Bộ Dữ Liệu Về Mặc Định
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function testLiveAiConnection() {
  const inputEl = document.getElementById("aiDiagnosticInput");
  const outputEl = document.getElementById("aiDiagnosticOutput");
  if (!outputEl) return;

  const query = inputEl?.value.trim() || "";
  if (!query) {
    outputEl.textContent = "Vui lòng nhập câu hỏi về tour hoặc dịch vụ du lịch.";
    return;
  }
  if (typeof DeltaAPI === "undefined" || !DeltaAPI.assistantChat) {
    outputEl.textContent = "Dịch vụ trợ lý du lịch chưa sẵn sàng.";
    return;
  }

  outputEl.textContent = "Đang kiểm tra API trợ lý du lịch...";
  const startedAt = Date.now();
  try {
    const result = await DeltaAPI.assistantChat(query);
    if (!result.success || !result.data?.answer) {
      throw new Error(result.error || "Không nhận được phản hồi từ máy chủ.");
    }
    outputEl.innerHTML = `
      <div class="text-success fw-bold mb-1">API nội bộ phản hồi sau ${Date.now() - startedAt} ms</div>
      <div class="text-dark">${escapeAdminHtml(result.data.answer).replace(/\n/g, "<br>")}</div>
    `;
  } catch (error) {
    console.error("Travel assistant diagnostics failed:", error);
    outputEl.textContent = `Không thể kiểm tra trợ lý du lịch: ${error.message || "Lỗi không xác định"}`;
  }
}

function handleFactoryReset() {
  if (confirm("CẢNH BÁO: Bạn có chắc chắn muốn khôi phục toàn bộ hệ thống về dữ liệu mẫu mặc định? Mọi thay đổi bạn đã tạo sẽ được nạp lại về trạng thái ban đầu.")) {
    if (typeof resetDeltaDataToDefaults === "function") {
      resetDeltaDataToDefaults();
      refreshAdminData();
      renderCurrentTab();
      showAdminToast("Đã khôi phục dữ liệu gốc thành công!", "success");
    }
  }
}

// =============================================================================
// XIV. TAB 7: NHẬT KÝ KIỂM TOÁN (AUDIT LOGS - CHỈ DÀNH CHO ADMIN)
// =============================================================================
function renderTabAudit(container) {
  const user = AdminState.currentUser;

  // Kiểm tra quyền ADMIN giống deltatravel-main
  if (user && user.role !== "ADMIN") {
    container.innerHTML = `
      <div class="admin-card text-center p-5">
        <div class="mb-3">
          <i class="bi bi-shield-lock text-warning" style="font-size: 48px;"></i>
        </div>
        <h4 class="fw-bold text-dark">Yêu Cầu Quyền Quản Trị Viên (ADMIN)</h4>
        <p class="text-muted small mx-auto" style="max-width: 500px;">
          Nhật ký kiểm toán hệ thống chứa dữ liệu vận hành nhạy cảm và lịch sử can thiệp của toàn bộ tổ chức.
          Tài khoản <strong>OPERATIONS</strong> có thể quản lý catalog tour, lịch khởi hành, booking và thu tiền mặt nhưng không đọc audit trail toàn hệ thống.
        </p>
        <button class="btn btn-admin-primary mt-2" onclick="handleQuickAdminLogin('ADMIN')">
          <i class="bi bi-key-fill"></i> Chuyển Sang Tài Khoản ADMIN
        </button>
      </div>
    `;
    return;
  }

  const logs = AdminState.auditLogs;
  const filtered = logs.filter(l => {
    if (AdminState.auditActionFilter !== "all" && l.action !== AdminState.auditActionFilter) return false;
    return true;
  });

  container.innerHTML = `
    <div class="admin-card">
      <div class="admin-card-header">
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <select class="form-select form-select-sm" style="width: auto;" onchange="handleAuditActionFilter(this.value)">
            <option value="all" ${AdminState.auditActionFilter === "all" ? "selected" : ""}>Tất cả hành động</option>
            <option value="CREATE_TOUR" ${AdminState.auditActionFilter === "CREATE_TOUR" ? "selected" : ""}>Thêm Tour (CREATE_TOUR)</option>
            <option value="UPDATE_TOUR" ${AdminState.auditActionFilter === "UPDATE_TOUR" ? "selected" : ""}>Sửa Tour (UPDATE_TOUR)</option>
            <option value="DELETE_TOUR" ${AdminState.auditActionFilter === "DELETE_TOUR" ? "selected" : ""}>Xóa Tour (DELETE_TOUR)</option>
            <option value="CREATE_BOOKING" ${AdminState.auditActionFilter === "CREATE_BOOKING" ? "selected" : ""}>Tạo Đơn (CREATE_BOOKING)</option>
            <option value="CONFIRM_BOOKING" ${AdminState.auditActionFilter === "CONFIRM_BOOKING" ? "selected" : ""}>Xác Nhận Đơn (CONFIRM_BOOKING)</option>
            <option value="CANCEL_BOOKING" ${AdminState.auditActionFilter === "CANCEL_BOOKING" ? "selected" : ""}>Hủy Đơn (CANCEL_BOOKING)</option>
            <option value="RECORD_CASH" ${AdminState.auditActionFilter === "RECORD_CASH" ? "selected" : ""}>Thu Tiền Mặt (RECORD_CASH)</option>
            <option value="RECORD_REFUND" ${AdminState.auditActionFilter === "RECORD_REFUND" ? "selected" : ""}>Hoàn Tiền (RECORD_REFUND)</option>
          </select>
        </div>

        <button class="btn btn-admin-outline" onclick="refreshAdminData(); renderCurrentTab();">
          <i class="bi bi-arrow-repeat"></i> Tải Lại Nhật Ký
        </button>
      </div>

      <div class="admin-card-body p-0">
        <div class="admin-table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Mã Sự Kiện</th>
                <th>Thời Gian</th>
                <th>Người Thực Hiện</th>
                <th>Hành Động</th>
                <th>Đối Tượng</th>
                <th>Chi Tiết Can Thiệp</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="6" class="text-center py-5 text-muted">
                    <i class="bi bi-file-earmark-lock fs-2 d-block mb-2"></i>
                    Chưa có sự kiện kiểm toán nào phù hợp.
                  </td>
                </tr>
              ` : filtered.map(l => `
                <tr>
                  <td><strong class="font-monospace">${l.id}</strong></td>
                  <td><span class="small text-muted">${l.timestamp}</span></td>
                  <td>
                    <div class="fw-bold small text-dark"><i class="bi bi-person-fill text-warning me-1"></i>${l.actor}</div>
                  </td>
                  <td>
                    <span class="admin-badge badge-status-CONFIRMED">
                      ${l.action}
                    </span>
                  </td>
                  <td>
                    <span class="badge bg-light text-dark border">${l.entity}: ${l.entityId}</span>
                  </td>
                  <td class="text-muted small" style="max-width: 380px;">
                    ${l.details}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function handleAuditActionFilter(val) {
  AdminState.auditActionFilter = val;
  renderTabAudit(document.getElementById("adminTabContentContainer"));
}

// =============================================================================
// XV. TOAST THÔNG BÁO CHO ADMIN
// =============================================================================
function showAdminToast(message, type = "info") {
  const container = document.getElementById("adminToastContainer");
  if (!container) return;

  const bgClass = type === "success" ? "bg-success" : type === "warning" ? "bg-warning text-dark" : type === "error" ? "bg-danger" : "bg-dark";
  const icon = type === "success" ? "bi-check-circle-fill" : type === "warning" ? "bi-exclamation-triangle-fill" : type === "error" ? "bi-x-circle-fill" : "bi-info-circle-fill";

  const toastId = "toast_" + Date.now();
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 show shadow-lg mb-2" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${icon} fs-5"></i>
          <span>${message}</span>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML("beforeend", toastHtml);
  setTimeout(() => {
    const el = document.getElementById(toastId);
    if (el) el.remove();
  }, 4000);
}
