/**
 * DELTA TRAVEL - MAIN JAVASCRIPT CONTROLLER (main.js)
 * -------------------------------------------------------------
 * File này chứa toàn bộ logic xử lý phía Client:
 * 1. Khởi tạo & nạp dữ liệu Tours, Điểm đến
 * 2. Bộ lọc tìm kiếm & sắp xếp thông minh
 * 3. Đồng hồ đếm ngược Flash Sale
 * 4. Hệ thống danh sách Yêu thích (Wishlist)
 * 5. Hiển thị Modal chi tiết Lịch trình từng ngày
 * 6. Tính toán chi phí Tour theo thời gian thực (Real-time pricing & Voucher)
 * 7. Kiểm tra hợp lệ dữ liệu (Form Validation) & Xử lý thanh toán
 * 8. Xuất Vé Điện Tử (E-Ticket) & In ấn
 * 9. Quản lý / Tra cứu / Hủy đơn đặt chỗ từ localStorage
 */

// =============================================================================
// I. TRẠNG THÁI ỨNG DỤNG TOÀN CỤC (GLOBAL STATE)
// =============================================================================
const AppState = {
  activeRegion: "all",           // Vùng miền đang lọc ('all', 'north', 'central', 'south', 'sale')
  searchKeyword: "",             // Từ khóa tìm kiếm
  selectedPriceRange: "all",     // Khoảng giá ('all', 'under3m', '3to5m', 'above5m')
  sortCriteria: "default",       // Sắp xếp ('default', 'price-asc', 'price-desc', 'rating-desc')
  currentBookingTour: null,      // Tour đang được chọn để đặt
  currentSchedules: [],
  appliedVoucher: null,          // Voucher đang áp dụng
  bookingReference: "",          // Mã đặt chỗ tạm tính
  selectedPaymentMethod: "qr",   // Phương thức thanh toán đang chọn
  activeDestination: "",
  allTours: [],
  destinationCounts: null,
  destinationCountsLoading: false,
  serverCatalog: false,
  serverTotal: 0,
  currentPage: 1,
  pageSize: 12,
  totalPages: 0,
  loadingTours: false,
  tourSearchError: "",
  searchRequestId: 0
};

// =============================================================================
// II. KHỞI TẠO ỨNG DỤNG KHI TẢI TRANG (DOM CONTENT LOADED)
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  updateCustomerBookingCounters();
  initNavbarScroll();
  initFlashSaleTimer();
  renderDestinations();
  renderTourCards();
  initFilterEvents();
  initBookingListeners();
  updateWishlistCounter();
  initFloatingButtons();
  setMinimumDepartureDate();

  // Load the catalog from the API when available; the initial list remains a
  // clearly local preview until the database-backed response arrives.
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.checkHealth === "function") {
    DeltaAPI.checkHealth().then(status => {
      if (status && status.online) {
        searchToursFromApi(1);
      }
    }).catch(() => {});
  }
});

// =============================================================================
// III. HIỆU ỨNG THANH ĐIỀU HƯỚNG & NÚT CUỘN TRANG
// =============================================================================
/**
 * Lắng nghe sự kiện cuộn trang để thêm hiệu ứng nền mờ cho Navbar
 */

/**
 * Lọc Tour theo Vùng miền từ thanh Liquid Glass Nav Dock
 */
function filterToursRegion(region, element) {
  if (element) {
    setActiveNavLink(element);
  }
  
  AppState.activeRegion = region;
  AppState.activeDestination = "";
  const destinationInput = document.getElementById("filterDestination");
  if (destinationInput) destinationInput.value = "";

  // Cập nhật trạng thái active của các nút filter-pill
  const pills = document.querySelectorAll(".filter-pill");
  pills.forEach(pill => {
    pill.classList.toggle("active", pill.dataset.region === region);
  });

  // Đồng bộ ô chọn vùng miền ở Hero Search
  const heroRegion = document.getElementById("heroRegion");
  if (heroRegion) {
    heroRegion.value = region;
  }

  searchToursFromApi(1);

  // Cuộn mượt đến danh sách tour
  const section = document.getElementById("toursSection");
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
}

function openChatbot() {
  if (typeof toggleChatbotWindow === "function") {
    toggleChatbotWindow(true);
  } else {
    const windowEl = document.getElementById("chatbotWindow");
    if (windowEl) windowEl.classList.remove("hidden");
  }
}
window.openChatbot = openChatbot;

function setActiveNavLink(element) {
  const links = document.querySelectorAll(".liquid-nav-link");
  links.forEach(l => l.classList.remove("active"));
  if (element) element.classList.add("active");
  if (typeof closeLargeAIChat === "function") {
    const fullscreenEl = document.getElementById("largeAIChatFullscreen");
    if (fullscreenEl && fullscreenEl.style.display !== "none") {
      closeLargeAIChat();
    }
  }
}

function toggleMobileMenu() {
  const drawer = document.getElementById("mobileDrawerMenu");
  const icon = document.getElementById("mobileMenuIcon");
  if (!drawer) return;
  const isShowing = drawer.classList.toggle("show");
  if (icon) {
    icon.className = isShowing ? "bi bi-x-lg fs-5" : "bi bi-list fs-5";
  }
}

function closeMobileMenu() {
  const drawer = document.getElementById("mobileDrawerMenu");
  const icon = document.getElementById("mobileMenuIcon");
  if (drawer) drawer.classList.remove("show");
  if (icon) icon.className = "bi bi-list fs-5";
}

function closeMobileNav() {
  closeMobileMenu();
}

window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.closeMobileNav = closeMobileNav;

function updateCustomerBookingCounters() {
  const bookings = getLocalBookings();
  const count = bookings.length;
  const badgeDesk = document.getElementById("navBookingBadge");
  const badgeMobile = document.getElementById("navBookingBadgeMobile");

  if (badgeDesk) {
    if (count > 0) {
      badgeDesk.textContent = count;
      badgeDesk.style.display = "inline-block";
    } else {
      badgeDesk.style.display = "none";
    }
  }
  if (badgeMobile) {
    if (count > 0) {
      badgeMobile.textContent = count;
      badgeMobile.style.display = "inline-block";
    } else {
      badgeMobile.style.display = "none";
    }
  }
}

function initNavbarScroll() {
  const header = document.querySelector("header.sticky-top");
  const navbar = document.querySelector(".navbar-delta");
  const backToTopBtn = document.getElementById("backToTopBtn");
  const heroSection = document.getElementById("hero3DShowcase");

  function updateNavbar() {
    const scrollY = window.scrollY;

    // Khi người dùng đang ở phần Hero 3D thì thanh bar hoàn toàn trong suốt
    if (heroSection) {
      const heroThreshold = heroSection.offsetTop + heroSection.offsetHeight - 140;
      if (scrollY < heroThreshold) {
        header?.classList.add("hero-transparent");
        navbar?.classList.remove("scrolled");
      } else {
        header?.classList.remove("hero-transparent");
        navbar?.classList.add("scrolled");
      }
    } else {
      if (scrollY > 60) {
        navbar?.classList.add("scrolled");
      } else {
        navbar?.classList.remove("scrolled");
      }
    }

    if (scrollY > 300) {
      backToTopBtn?.classList.add("show");
    } else {
      backToTopBtn?.classList.remove("show");
    }
  }

  window.addEventListener("scroll", updateNavbar, { passive: true });
  updateNavbar();
}

/**
 * Hỗ trợ lọc nhanh theo tag phổ biến từ sidebar
 */
window.quickFilterTag = function(tag) {
  const input = document.getElementById("filterDestination");
  if (input) {
    input.value = tag;
  }
  AppState.searchKeyword = tag;
  searchToursFromApi(1);
  document.getElementById("toursSection")?.scrollIntoView({ behavior: "smooth" });
};

/**
 * Xử lý nút cuộn nhanh lên đầu trang (Back to Top)
 */
function initFloatingButtons() {
  const backToTopBtn = document.getElementById("backToTopBtn");
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

// =============================================================================
// IV. ĐỒNG HỒ ĐẾM NGƯỢC FLASH SALE (COUNTDOWN TIMER)
// =============================================================================
/**
 * Chạy đồng hồ đếm ngược giờ Flash Sale thực tế (kết thúc cuối ngày)
 */
function initFlashSaleTimer() {
  const hoursEl = document.getElementById("countdownHours");
  const minutesEl = document.getElementById("countdownMinutes");
  const secondsEl = document.getElementById("countdownSeconds");

  if (!hoursEl || !minutesEl || !secondsEl) return;

  function updateTimer() {
    const now = new Date();
    // Đếm ngược đến 23:59:59 của ngày hôm nay
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const diff = endOfDay - now;
    if (diff <= 0) {
      hoursEl.textContent = "00";
      minutesEl.textContent = "00";
      secondsEl.textContent = "00";
      return;
    }

    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    hoursEl.textContent = String(hours).padStart(2, "0");
    minutesEl.textContent = String(minutes).padStart(2, "0");
    secondsEl.textContent = String(seconds).padStart(2, "0");
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// =============================================================================
// V. HIỂN THỊ ĐIỂM ĐẾN NỔI BẬT
// =============================================================================
/**
 * Hiển thị các khối Điểm Đến Nổi Bật từ mảng DESTINATIONS_DATA
 */
function renderDestinations() {
  const container = document.getElementById("destinationsGrid");
  if (!container) return;

  container.replaceChildren();
  const catalog = AppState.allTours.length ? AppState.allTours : TOURS_DATA;
  for (const destination of DESTINATIONS_DATA) {
    const count = AppState.destinationCounts?.[destination.name] ??
      catalog.filter(tour => destinationMatches(tour, destination.name)).length;
    const column = document.createElement("div");
    column.className = "col-lg-4 col-md-6 mb-4";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "dest-card border-0 p-0 w-100 text-start";
    card.addEventListener("click", () => filterByDestination(destination.region, destination.name));
    const image = document.createElement("img");
    image.src = destination.image;
    image.alt = destination.name;
    image.loading = "lazy";
    const overlay = document.createElement("span");
    overlay.className = "dest-overlay";
    const name = document.createElement("span");
    name.className = "dest-name";
    name.textContent = destination.name;
    const countLabel = document.createElement("span");
    countLabel.className = "dest-tours-count";
    countLabel.textContent = `${count} tour`;
    overlay.append(name, countLabel);
    card.append(image, overlay);
    column.append(card);
    container.append(column);
  }
}

function normalizeDestinationText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

function destinationTerms(destinationName) {
  const name = normalizeDestinationText(destinationName);
  if (name.includes("ha long")) return ["ha long", "lan ha"];
  if (name.includes("da nang")) return ["da nang", "hoi an"];
  if (name.includes("phu quoc")) return ["phu quoc"];
  if (name.includes("da lat")) return ["da lat"];
  if (name.includes("sa pa") || name.includes("sapa")) return ["sa pa", "sapa", "fansipan"];
  if (name.includes("mien tay")) return ["mien tay", "can tho", "tra su"];
  return [name];
}

function destinationPrimaryTerm(destinationName) {
  const name = normalizeDestinationText(destinationName);
  if (name.includes("ha long")) return "Hạ Long";
  if (name.includes("da nang")) return "Đà Nẵng";
  if (name.includes("phu quoc")) return "Phú Quốc";
  if (name.includes("da lat")) return "Đà Lạt";
  if (name.includes("sa pa") || name.includes("sapa")) return "Sa Pa";
  if (name.includes("mien tay")) return "Miền Tây";
  return destinationName;
}

function destinationMatches(tour, destinationName) {
  const searchable = normalizeDestinationText([
    tour.title,
    tour.regionName,
    tour.description,
    ...(Array.isArray(tour.itinerary) ? tour.itinerary.map(day => day.title || "") : [])
  ].join(" "));
  return destinationTerms(destinationName).some(term => searchable.includes(term));
}

/**
 * Lọc nhanh tour khi người dùng bấm vào một thẻ Điểm Đến
 */
function filterByDestination(region, destName) {
  AppState.activeRegion = region;
  AppState.searchKeyword = "";
  AppState.activeDestination = destName;
  const destinationInput = document.getElementById("filterDestination");
  if (destinationInput) destinationInput.value = destinationPrimaryTerm(destName);

  // Đồng bộ lại các nút pill bộ lọc
  document.querySelectorAll(".filter-pill").forEach(pill => {
    pill.classList.toggle("active", pill.dataset.region === region);
  });

  searchToursFromApi(1);

  // Cuộn mượt xuống khu vực danh sách tour
  const toursSection = document.getElementById("toursSection");
  if (toursSection) {
    toursSection.scrollIntoView({ behavior: "smooth" });
  }

  showToast(`Đang hiển thị các tour tại ${destName}`, "info");
}

// =============================================================================
// VI. HIỂN THỊ & LỌC DANH SÁCH TOUR DU LỊCH (TOUR CARDS)
// =============================================================================
/**
 * Hàm định dạng tiền tệ Việt Nam Đồng (VND), ví dụ: 3890000 -> 3.890.000 đ
 */
function formatVND(amount) {
  if (isNaN(amount)) return "0 đ";
  return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
}

/**
 * Lọc và kết xuất danh sách tour theo bộ lọc hiện tại
 */
function renderTourCards() {
  const container = document.getElementById("toursContainer");
  const countEl = document.getElementById("tourResultCount");
  if (!container) return;

  const wishlist = getWishlist();

  // 1. Lọc theo từ khóa, vùng miền, mức giá, flash sale
  let filtered = AppState.serverCatalog ? [...TOURS_DATA] : TOURS_DATA.filter(tour => {
    // Lọc theo vùng miền
    if (AppState.activeRegion !== "all") {
      if (tour.region !== AppState.activeRegion) return false;
    }
    if (AppState.activeDestination && !destinationMatches(tour, AppState.activeDestination)) {
      return false;
    }

    // Lọc theo từ khóa tìm kiếm
    if (AppState.searchKeyword.trim() !== "") {
      const kw = AppState.searchKeyword.toLowerCase().trim();
      const matchTitle = tour.title.toLowerCase().includes(kw);
      const matchDeparture = tour.departure.toLowerCase().includes(kw);
      const matchRegion = tour.regionName.toLowerCase().includes(kw);
      if (!matchTitle && !matchDeparture && !matchRegion) return false;
    }

    // Lọc theo khoảng giá
    if (AppState.selectedPriceRange === "under3m") {
      if (tour.price >= 3000000) return false;
    } else if (AppState.selectedPriceRange === "3to5m") {
      if (tour.price < 3000000 || tour.price > 5000000) return false;
    } else if (AppState.selectedPriceRange === "above5m") {
      if (tour.price <= 5000000) return false;
    }

    return true;
  });

  // 2. Sắp xếp theo tiêu chí
  if (!AppState.serverCatalog) {
    if (AppState.sortCriteria === "price-asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (AppState.sortCriteria === "price-desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (AppState.sortCriteria === "rating-desc") {
      filtered.sort((a, b) => b.rating - a.rating);
    }
  }

  // 3. Hiển thị số lượng kết quả
  if (countEl) {
    const total = AppState.serverCatalog ? AppState.serverTotal : filtered.length;
    countEl.textContent = `Hiển thị ${filtered.length} / ${total} tour`;
  }
  renderActiveTourFilters();
  renderTourPagination();

  // 4. Nếu không tìm thấy tour phù hợp
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-12 py-5 text-center">
        <div class="mb-3">
          <i class="bi bi-search text-muted" style="font-size: 3.5rem;"></i>
        </div>
        <h4 class="fw-bold text-muted">Không tìm thấy tour phù hợp</h4>
        <p class="text-muted">Vui lòng thử thay đổi từ khóa hoặc điều chỉnh lại bộ lọc tìm kiếm.</p>
        <button class="btn btn-delta-primary mt-2" onclick="resetAllFilters()">
          <i class="bi bi-arrow-clockwise"></i> Đặt lại bộ lọc
        </button>
      </div>
    `;
    return;
  }

  // 5. Kết xuất HTML thẻ tour
  container.innerHTML = filtered.map(tour => {
    const isFav = wishlist.includes(tour.id);
    const schedules = Array.isArray(tour.schedules) ? tour.schedules : [];
    const selectedDate = document.getElementById("filterDepartureDate")?.value || "";
    const availability = document.getElementById("filterAvailability")?.value || "";
    const nextSchedule = schedules.find(schedule => {
      const dateMatches = !selectedDate ||
        String(schedule.departureAt || "").slice(0, 10) === selectedDate;
      const seatsMatch = availability === "available"
        ? schedule.availableSeats > 0
        : availability === "sold_out"
          ? schedule.availableSeats <= 0
          : true;
      return dateMatches && seatsMatch;
    }) || schedules.find(schedule => schedule.availableSeats > 0) || schedules[0] || null;
    const seats = nextSchedule ? nextSchedule.availableSeats : tour.availableSeats;
    const departureDate = nextSchedule
      ? new Date(nextSchedule.departureAt).toLocaleDateString(typeof getAppLanguage === "function" && getAppLanguage() === "en" ? "en-US" : "vi-VN")
      : "";

    const isEn = typeof getAppLanguage === "function" && getAppLanguage() === "en";
    const durationDisplay = isEn
      ? String(tour.duration || "").replace(/N/g, "D").replace(/Đ/g, "N")
      : tour.duration;
    const badgeText = tour.badge === "FLASH SALE"
      ? (typeof t === "function" ? t("card_flashsale") : "FLASH SALE")
      : (typeof t === "function" ? t("card_featured") : (tour.badge || "TOUR NỔI BẬT"));
    const seatsText = seats > 0
      ? (typeof t === "function" ? t("card_left_seats", { n: seats }) : `Còn ${seats} chỗ`)
      : (nextSchedule ? (typeof t === "function" ? t("card_sold_out") : "Hết chỗ") : "---");
    const pickupLabel = typeof t === "function" ? t("card_pickup") : "Điểm đón:";
    const departureLabel = typeof t === "function" ? t("card_departure") : "Khởi hành:";
    const priceUnit = typeof t === "function" ? t("card_per_guest") : "/ khách";
    const viewItineraryText = typeof t === "function" ? t("card_view_itinerary") : "Xem lịch trình";
    const bookNowText = typeof t === "function" ? t("card_book_now") : "Đặt ngay";

    return `
      <div class="col-12 col-md-6 col-xl-4 col-xxl-3 mb-4">
        <div class="tour-card">
          <!-- Ảnh đại diện tour (Click để xem chi tiết lịch trình) -->
          <div class="tour-card-thumb" style="cursor: pointer;" onclick="openItineraryModal('${tour.id}')" title="${viewItineraryText}: ${tour.title}">
            <img src="${tour.image}" alt="${tour.title}" loading="lazy" onerror="this.onerror=null; this.src='assets/images/halong.png';">
            <div class="tour-badge-group">
              <span class="badge-tour badge-tour-popular">${badgeText}</span>
            </div>
            <button class="btn-wishlist ${isFav ? 'active' : ''}" onclick="toggleWishlist('${tour.id}', event)" title="Yêu thích">
              <i class="bi ${isFav ? 'bi-heart-fill' : 'bi-heart'}"></i>
            </button>
            <div class="tour-thumb-meta">
              <span class="tour-duration-tag"><i class="bi bi-clock"></i> ${durationDisplay}</span>
              <span class="tour-seats-tag">${seatsText}</span>
            </div>
          </div>

          <!-- Nội dung chi tiết thẻ -->
          <div class="tour-card-body">
            <div class="tour-code-row">
              <span class="tour-code">${tour.id}</span>
              <span class="tour-region"><i class="bi bi-geo-alt"></i> ${tour.regionName}</span>
            </div>

            <h3 class="tour-title" style="cursor: pointer;" onclick="openItineraryModal('${tour.id}')" title="${viewItineraryText}: ${tour.title}">${tour.title}</h3>

            <!-- Thông số tóm tắt -->
            <div class="tour-specs">
              <div class="tour-spec-item" title="${pickupLabel} ${tour.departure}">
                <i class="bi bi-geo-fill"></i>
                <span>${pickupLabel} ${tour.departure}</span>
              </div>
              ${departureDate ? `<div class="tour-spec-item"><i class="bi bi-calendar-event"></i><span>${departureLabel} ${departureDate}</span></div>` : ""}
              <div class="tour-spec-item">
                <i class="bi bi-bus-front-fill"></i>
                <span>${tour.transport}</span>
              </div>
            </div>

            <!-- Giá tour -->
            <div class="tour-price-box">
              <div class="tour-price-current">
                ${formatVND(tour.price)}
                <span class="tour-price-unit">${priceUnit}</span>
              </div>
            </div>

            <!-- Nút thao tác -->
            <div class="tour-card-actions">
              <button class="btn-tour-detail" onclick="openItineraryModal('${tour.id}')">
                <i class="bi bi-calendar4-week"></i> ${viewItineraryText}
              </button>
              <button class="btn-tour-book" onclick="openBookingModal('${tour.id}')">
                <i class="bi bi-cart-check-fill"></i> ${bookNowText}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function currentTourFilters(page = 1) {
  const priceRange = document.getElementById("filterPriceRange")?.value || "";
  const ranges = {
    under2m: [undefined, 1999999],
    "2to5m": [2000000, 5000000],
    "5to10m": [5000001, 10000000],
    "10to20m": [10000001, 20000000],
    above20m: [20000001, undefined]
  };
  const [rangeMin, rangeMax] = ranges[priceRange] || [];
  const quickRange = document.getElementById("heroPrice")?.value || "all";
  const quickBounds = {
    under3m: [undefined, 2999999],
    "3to5m": [3000000, 5000000],
    above5m: [5000001, undefined]
  }[quickRange];
  const [minPrice, maxPrice] = ranges[priceRange] || quickBounds || [];
  const sortValue = document.getElementById("tourSortSelect")?.value || "default";
  const sortBy = {
    "price-asc": "price_asc",
    "price-desc": "price_desc",
    newest: "newest",
    "departure-soonest": "departure_soonest"
  }[sortValue] || "relevance";

  return {
    q: document.getElementById("heroKeyword")?.value.trim() || "",
    region: AppState.activeRegion || "all",
    destination: document.getElementById("filterDestination")?.value.trim() || "",
    departure_location: document.getElementById("filterDeparture")?.value.trim() || "",
    departure_date: document.getElementById("filterDepartureDate")?.value || "",
    min_price: minPrice,
    max_price: maxPrice,
    duration: document.getElementById("filterDuration")?.value || "",
    transport: document.getElementById("filterTransport")?.value || "",
    availability: document.getElementById("filterAvailability")?.value || "",
    sort_by: sortBy,
    page,
    page_size: AppState.pageSize
  };
}

function filterLegacyApiTours(tours, filters) {
  const folded = value => normalizeDestinationText(value);
  const filtered = tours.filter(tour => {
    const text = folded([tour.title, tour.description, tour.regionName].join(" "));
    if (filters.region !== "all" && tour.region !== filters.region) return false;
    if (filters.q && !text.includes(folded(filters.q))) return false;
    if (filters.destination && !text.includes(folded(filters.destination))) return false;
    if (filters.departure_location && !folded(tour.departure).includes(folded(filters.departure_location))) return false;
    if (filters.min_price !== undefined && tour.price < filters.min_price) return false;
    if (filters.max_price !== undefined && tour.price > filters.max_price) return false;
    if (filters.duration && !folded(tour.duration).includes(folded(filters.duration))) return false;
    if (filters.transport && !folded(tour.transport).includes(folded(filters.transport))) return false;
    const schedules = Array.isArray(tour.schedules) ? tour.schedules : [];
    if (filters.departure_date && !schedules.some(schedule =>
      String(schedule.departureAt || "").slice(0, 10) === filters.departure_date
    )) return false;
    if (filters.availability === "available" && !schedules.some(schedule => schedule.availableSeats > 0)) return false;
    if (filters.availability === "sold_out" && !schedules.some(schedule => schedule.availableSeats <= 0)) return false;
    return true;
  });
  if (filters.sort_by === "price_asc") filtered.sort((a, b) => a.price - b.price);
  else if (filters.sort_by === "price_desc") filtered.sort((a, b) => b.price - a.price);
  else if (filters.sort_by === "newest") filtered.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  else if (filters.sort_by === "departure_soonest") filtered.sort((a, b) =>
    String(a.schedules?.[0]?.departureAt || "").localeCompare(String(b.schedules?.[0]?.departureAt || ""))
  );
  return filtered;
}

async function refreshDestinationCounts() {
  if (AppState.destinationCountsLoading || !DeltaAPI?.fetchTours) return;
  AppState.destinationCountsLoading = true;
  try {
    const results = await Promise.all(DESTINATIONS_DATA.map(async destination => {
      const result = await DeltaAPI.fetchTours({
        region: destination.region,
        destination: destinationPrimaryTerm(destination.name),
        page: 1,
        page_size: 1
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || `Invalid count response for ${destination.name}`);
      }
      if (Array.isArray(result.data)) {
        return [
          destination.name,
          filterLegacyApiTours(result.data, {
            region: destination.region,
            destination: destinationPrimaryTerm(destination.name)
          }).length
        ];
      }
      if (!Number.isFinite(Number(result.data.total))) {
        throw new Error(`Invalid count response for ${destination.name}`);
      }
      return [destination.name, Number(result.data.total)];
    }));
    AppState.destinationCounts = Object.fromEntries(results);
    renderDestinations();
  } catch (error) {
    console.error("Could not load destination tour counts:", error);
    const status = document.getElementById("tourFilterStatus");
    if (status) {
      status.dataset.state = "error";
      status.textContent = "Không tải được số lượng tour theo điểm đến từ máy chủ.";
    }
  } finally {
    AppState.destinationCountsLoading = false;
  }
}

async function searchToursFromApi(page = 1) {
  if (typeof DeltaAPI === "undefined" || typeof DeltaAPI.fetchTours !== "function") {
    AppState.tourSearchError = "API tour chưa sẵn sàng. Hãy khởi chạy FastAPI để tìm kiếm dữ liệu.";
    AppState.serverCatalog = true;
    AppState.serverTotal = 0;
    TOURS_DATA.splice(0, TOURS_DATA.length);
    renderTourCards();
    return;
  }

  const requestId = ++AppState.searchRequestId;
  const filters = currentTourFilters(page);
  AppState.currentPage = page;
  AppState.loadingTours = true;
  AppState.tourSearchError = "";
  const status = document.getElementById("tourFilterStatus");
  if (status) {
    status.dataset.state = "loading";
    status.textContent = "Đang tìm tour theo điều kiện đã chọn...";
  }
  renderTourCards();

  const result = await DeltaAPI.fetchTours(filters);
  if (requestId !== AppState.searchRequestId) return;
  AppState.loadingTours = false;
  if (!result.success) {
    AppState.serverCatalog = true;
    AppState.serverTotal = 0;
    AppState.totalPages = 0;
    AppState.tourSearchError = result.error || "Không thể tải danh sách tour.";
    TOURS_DATA.splice(0, TOURS_DATA.length);
    if (status) {
      status.dataset.state = "error";
      status.textContent = `Không thể tìm tour: ${AppState.tourSearchError}`;
    }
    renderTourCards();
    return;
  }

  const payload = result.data;
  const rawItems = Array.isArray(payload) ? payload : payload?.items;
  if (!Array.isArray(rawItems)) {
    AppState.serverCatalog = true;
    AppState.serverTotal = 0;
    AppState.tourSearchError = "API trả về dữ liệu tour không đúng định dạng.";
    TOURS_DATA.splice(0, TOURS_DATA.length);
    if (status) {
      status.dataset.state = "error";
      status.textContent = AppState.tourSearchError;
    }
    renderTourCards();
    return;
  }

  const serverTours = await Promise.all(rawItems.map(async tour => {
    let schedules = Array.isArray(tour.schedules) ? tour.schedules : null;
    if (schedules === null && DeltaAPI.fetchSchedules) {
      const scheduleResult = await DeltaAPI.fetchSchedules(tour.id);
      schedules = scheduleResult.success && Array.isArray(scheduleResult.data)
        ? scheduleResult.data
        : [];
    }
    const images = Array.isArray(tour.images) && tour.images.length
      ? tour.images
      : (tour.image ? [tour.image] : []);
    return {
      ...tour,
      regionName: tour.region === "north" ? "Miền Bắc" :
        tour.region === "central" ? "Miền Trung" :
        tour.region === "south" ? "Miền Nam" : tour.region,
      image: images[0] || "assets/images/halong.png",
      images,
      schedules,
      availableSeats: schedules[0]?.availableSeats ?? 0,
      originalPrice: tour.originalPrice ?? tour.price,
      rating: tour.rating ?? 0,
      reviewsCount: tour.reviewsCount ?? 0,
      badge: tour.isFlashSale ? "FLASH SALE" : "TOUR NỔI BẬT",
      itinerary: Array.isArray(tour.itinerary) ? tour.itinerary : []
    };
  }));
  if (requestId !== AppState.searchRequestId) return;

  let visibleTours = serverTours;
  if (Array.isArray(payload)) {
    const matches = filterLegacyApiTours(serverTours, filters);
    AppState.serverTotal = matches.length;
    AppState.totalPages = Math.ceil(matches.length / AppState.pageSize);
    visibleTours = matches.slice((page - 1) * AppState.pageSize, page * AppState.pageSize);
  } else {
    AppState.serverTotal = Number(payload.total) || 0;
    AppState.totalPages = Number(payload.totalPages) || 0;
  }
  AppState.serverCatalog = true;
  TOURS_DATA.splice(0, TOURS_DATA.length, ...visibleTours);
  if (page === 1 && !filters.q && filters.region === "all" &&
      !filters.destination && !filters.departure_location && !filters.departure_date &&
      filters.min_price === undefined && filters.max_price === undefined &&
      !filters.duration && !filters.transport && !filters.availability) {
    AppState.allTours = serverTours;
    renderDestinations();
    if (!AppState.destinationCounts) refreshDestinationCounts();
  }
  if (status) {
    if (serverTours.length === 0 && DeltaAPI?.isCatalogReadOnly?.()) {
      status.dataset.state = "empty";
      status.textContent = "SQL Server đã kết nối nhưng hiện không có tour nào đang mở bán.";
    } else {
      status.dataset.state = "";
      status.textContent = "";
    }
  }
  renderTourCards();
}

function renderActiveTourFilters() {
  const summary = document.getElementById("tourActiveFilters");
  if (!summary) return;
  const filters = currentTourFilters(AppState.currentPage);
  const labels = [];
  if (filters.q) labels.push(`Từ khóa: ${filters.q}`);
  if (filters.destination) labels.push(`Điểm đến: ${filters.destination}`);
  const regionLabels = {
    north: "Miền Bắc",
    central: "Miền Trung",
    south: "Miền Nam"
  };
  if (filters.region !== "all") labels.push(`Khu vực: ${regionLabels[filters.region] || filters.region}`);
  if (filters.departure_location) labels.push(`Khởi hành: ${filters.departure_location}`);
  if (filters.departure_date) labels.push(`Ngày: ${filters.departure_date}`);
  if (filters.min_price !== undefined || filters.max_price !== undefined) {
    labels.push(`Giá: ${filters.min_price === undefined ? "dưới" : formatVND(filters.min_price)} – ${
      filters.max_price === undefined ? "không giới hạn" : formatVND(filters.max_price)
    }`);
  }
  if (filters.duration) labels.push(`Thời lượng: ${filters.duration}`);
  if (filters.transport) labels.push(`Phương tiện: ${filters.transport}`);
  if (filters.availability) {
    labels.push(`Tình trạng: ${filters.availability === "available" ? "Còn chỗ" : "Hết chỗ"}`);
  }
  summary.textContent = labels.length ? `Đang áp dụng: ${labels.join(" · ")}` : "";
}

function renderTourPagination() {
  const container = document.getElementById("tourPagination");
  if (!container) return;
  if (!AppState.serverCatalog || AppState.totalPages <= 1) {
    container.replaceChildren();
    return;
  }
  const pages = [];
  for (let page = Math.max(1, AppState.currentPage - 2);
       page <= Math.min(AppState.totalPages, AppState.currentPage + 2); page++) {
    pages.push(`<li class="page-item ${page === AppState.currentPage ? "active" : ""}">
      <button class="page-link" type="button" data-tour-page="${page}" aria-label="Trang ${page}">${page}</button>
    </li>`);
  }
  container.innerHTML = `<div class="pagination-wrapper">
    <ul class="pagination pagination-liquid">
      <li class="page-item ${AppState.currentPage <= 1 ? "disabled" : ""}">
        <button class="page-link" type="button" data-tour-page="${AppState.currentPage - 1}" ${AppState.currentPage <= 1 ? "disabled" : ""}>
          <i class="bi bi-chevron-left"></i> Trước
        </button>
      </li>
      ${pages.join("")}
      <li class="page-item ${AppState.currentPage >= AppState.totalPages ? "disabled" : ""}">
        <button class="page-link" type="button" data-tour-page="${AppState.currentPage + 1}" ${AppState.currentPage >= AppState.totalPages ? "disabled" : ""}>
          Sau <i class="bi bi-chevron-right"></i>
        </button>
      </li>
    </ul>
  </div>`;
}

// =============================================================================
// VII. SỰ KIỆN BỘ LỌC TÌM KIẾM (FILTER & SEARCH EVENTS)
// =============================================================================
function initFilterEvents() {
  // 1. Các nút Tab chọn Vùng miền
  const pills = document.querySelectorAll(".filter-pill");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      AppState.activeRegion = pill.dataset.region || "all";
      AppState.activeDestination = "";
      const destinationInput = document.getElementById("filterDestination");
      if (destinationInput) destinationInput.value = "";
      
      // Đồng bộ Liquid Nav Dock
      const navLinks = document.querySelectorAll(".liquid-nav-dock .liquid-nav-link");
      navLinks.forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        if (AppState.activeRegion === "all" && text.includes("tất cả")) {
          setActiveNavLink(link);
        } else if (AppState.activeRegion === "north" && text.includes("bắc")) {
          setActiveNavLink(link);
        } else if (AppState.activeRegion === "central" && text.includes("trung")) {
          setActiveNavLink(link);
        } else if (AppState.activeRegion === "south" && text.includes("nam")) {
          setActiveNavLink(link);
        }
      });
      
      searchToursFromApi(1);
    });
  });

  // 2. Select sắp xếp
  const sortSelect = document.getElementById("tourSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      AppState.sortCriteria = e.target.value;
      searchToursFromApi(1);
    });
  }

  // 3. Form tìm kiếm nhanh tại Banner Hero
  const searchForm = document.getElementById("heroSearchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const kwInput = document.getElementById("heroKeyword");
      const regionSelect = document.getElementById("heroRegion");
      const priceSelect = document.getElementById("heroPrice");

      AppState.searchKeyword = kwInput?.value || "";
      AppState.activeRegion = regionSelect?.value || "all";
      AppState.selectedPriceRange = priceSelect?.value || "all";
      AppState.activeDestination = "";

      // Đồng bộ lại nút pill
      pills.forEach(p => {
        p.classList.toggle("active", p.dataset.region === AppState.activeRegion);
      });

      searchToursFromApi(1);

      // Cuộn xuống danh sách tour
      document.getElementById("toursSection")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  const advancedFilters = document.getElementById("advancedTourFilters");
  if (advancedFilters) {
    advancedFilters.addEventListener("submit", event => {
      event.preventDefault();
      AppState.searchKeyword = document.getElementById("heroKeyword")?.value || "";
      searchToursFromApi(1);
    });
  }

  document.getElementById("clearTourFilters")?.addEventListener("click", resetAllFilters);
  document.getElementById("tourPagination")?.addEventListener("click", event => {
    const button = event.target.closest("[data-tour-page]");
    if (!button || button.disabled) return;
    const page = Number(button.dataset.tourPage);
    if (Number.isInteger(page) && page >= 1 && page <= AppState.totalPages) {
      searchToursFromApi(page);
      document.getElementById("toursSection")?.scrollIntoView({ behavior: "smooth" });
    }
  });
}

/**
 * Đặt lại toàn bộ bộ lọc về mặc định
 */
function resetAllFilters() {
  AppState.activeRegion = "all";
  AppState.searchKeyword = "";
  AppState.selectedPriceRange = "all";
  AppState.sortCriteria = "default";
  AppState.activeDestination = "";
  AppState.currentPage = 1;

  const kwInput = document.getElementById("heroKeyword");
  const regionSelect = document.getElementById("heroRegion");
  const priceSelect = document.getElementById("heroPrice");
  const sortSelect = document.getElementById("tourSortSelect");
  const advancedFilters = document.getElementById("advancedTourFilters");

  if (kwInput) kwInput.value = "";
  if (regionSelect) {
    regionSelect.value = "all";
    regionSelect.dispatchEvent(new Event("change"));
  }
  if (priceSelect) {
    priceSelect.value = "all";
    priceSelect.dispatchEvent(new Event("change"));
  }
  if (sortSelect) {
    sortSelect.value = "default";
    sortSelect.dispatchEvent(new Event("change"));
  }
  if (advancedFilters) {
    advancedFilters.reset();
    advancedFilters.querySelectorAll("select, input").forEach(el => el.dispatchEvent(new Event("change")));
  }

  document.querySelectorAll(".filter-pill").forEach(p => {
    p.classList.toggle("active", p.dataset.region === "all");
  });

  searchToursFromApi(1);
  showToast("Đã đặt lại bộ lọc tìm kiếm", "info");
}

// =============================================================================
// VIII. HỆ THỐNG DANH SÁCH YÊU THÍCH (WISHLIST VỚI LOCALSTORAGE)
// =============================================================================
function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem("delta_wishlist")) || [];
  } catch (e) {
    return [];
  }
}

function saveWishlist(list) {
  localStorage.setItem("delta_wishlist", JSON.stringify(list));
  updateWishlistCounter();
}

function updateWishlistCounter() {
  const count = getWishlist().length;
  const counterEls = document.querySelectorAll(".wishlist-counter");
  counterEls.forEach(el => {
    el.textContent = count;
  });
}

function toggleWishlist(tourId, event) {
  if (event) event.stopPropagation();

  let list = getWishlist();
  const index = list.indexOf(tourId);

  if (index > -1) {
    list.splice(index, 1);
    showToast("Đã xóa tour khỏi danh sách yêu thích", "warning");
  } else {
    list.push(tourId);
    showToast("Đã thêm tour vào danh sách yêu thích!", "success");
  }

  saveWishlist(list);
  renderTourCards();
}

/**
 * Mở Modal xem danh sách các tour đã yêu thích
 */
function openWishlistModal() {
  const list = getWishlist();
  const modalEl = document.getElementById("wishlistModal");
  const container = document.getElementById("wishlistContainer");
  if (!modalEl || !container) return;

  const favoriteTours = TOURS_DATA.filter(t => list.includes(t.id));

  if (favoriteTours.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-heart text-muted" style="font-size: 3rem;"></i>
        <h5 class="fw-bold text-muted mt-3">Chưa có tour yêu thích nào</h5>
        <p class="text-muted small">Hãy bấm vào biểu tượng trái tim trên các thẻ tour để lưu lại những chuyến đi bạn yêu thích!</p>
      </div>
    `;
  } else {
    container.innerHTML = favoriteTours.map(t => `
      <div class="d-flex align-items-center justify-content-between p-3 mb-2 bg-light rounded-3 border">
        <div class="d-flex align-items-center gap-3">
          <img src="${t.image}" alt="${t.title}" style="width: 70px; height: 50px; object-fit: cover; border-radius: 8px;">
          <div>
            <h6 class="mb-0 fw-bold">${t.title}</h6>
            <span class="text-danger fw-bold">${formatVND(t.price)}</span> &bull; <span class="text-muted small">${t.duration}</span>
          </div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-delta-primary" onclick="closeModal('wishlistModal'); openBookingModal('${t.id}')">Đặt ngay</button>
          <button class="btn btn-sm btn-outline-danger" onclick="toggleWishlist('${t.id}'); openWishlistModal()"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    `).join("");
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

// =============================================================================
// IX. MODAL CHI TIẾT LỊCH TRÌNH TỪNG NGÀY (ITINERARY MODAL)
// =============================================================================
/**
 * Mở modal xem toàn bộ lịch trình chi tiết từng ngày của Tour
 */
async function openItineraryModal(tourId) {
  // Tìm tour an toàn theo id (hỗ trợ cả uppercase, lowercase, string)
  const tour = TOURS_DATA.find(t => String(t.id).trim().toLowerCase() === String(tourId).trim().toLowerCase());
  if (!tour) {
    console.warn("Không tìm thấy tour với mã:", tourId);
    return;
  }

  const modalEl = document.getElementById("itineraryModal");
  if (!modalEl) return;

  // Reset tab active về tab Timeline đầu tiên
  const firstTabBtn = document.getElementById("timeline-tab");
  if (firstTabBtn) {
    try {
      bootstrap.Tab.getOrCreateInstance(firstTabBtn).show();
    } catch (e) {}
  }

  // 1. Điền thông tin cơ bản
  const titleEl = document.getElementById("itineraryModalTitle");
  if (titleEl) titleEl.textContent = tour.title;

  const heroImg = document.getElementById("itineraryHeroImg");
  if (heroImg) {
    heroImg.src = tour.image || "assets/images/halong.png";
    heroImg.alt = tour.title;
    heroImg.onerror = () => { heroImg.src = "assets/images/halong.png"; };
  }
  const gallery = document.getElementById("itineraryGallery");
  if (gallery) {
    gallery.replaceChildren();
    const images = Array.isArray(tour.images) && tour.images.length
      ? tour.images
      : (tour.image ? [tour.image] : []);
    images.forEach((url, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle("active", index === 0);
      button.setAttribute("aria-label", `Xem ảnh ${index + 1} của tour`);
      const thumbnail = document.createElement("img");
      thumbnail.src = url;
      thumbnail.alt = `${tour.title} - ảnh ${index + 1}`;
      thumbnail.loading = "lazy";
      button.append(thumbnail);
      button.addEventListener("click", () => {
        if (heroImg) heroImg.src = url;
        gallery.querySelectorAll("button").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
      });
      gallery.append(button);
    });
  }

  const codeEl = document.getElementById("itineraryCode");
  if (codeEl) codeEl.textContent = tour.id;

  const durationEl = document.getElementById("itineraryDuration");
  if (durationEl) durationEl.textContent = tour.duration || "3N2Đ";

  const departureEl = document.getElementById("itineraryDeparture");
  if (departureEl) departureEl.textContent = tour.departure || "Hà Nội / TP.HCM";

  const transportEl = document.getElementById("itineraryTransport");
  if (transportEl) transportEl.textContent = tour.transport || "Xe du lịch đời mới / Máy bay";

  const priceEl = document.getElementById("itineraryPrice");
  if (priceEl) priceEl.textContent = formatVND(tour.price);

  // Tải lịch trình: API -> tour object -> DEFAULT_TOURS
  let itineraryDays = [];
  if (typeof DeltaAPI !== "undefined" && DeltaAPI.isOnline() && DeltaAPI.fetchItinerary) {
    try {
      const response = await DeltaAPI.fetchItinerary(tour.id);
      if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
        const grouped = new Map();
        for (const activity of response.data) {
          if (!grouped.has(activity.dayNumber)) grouped.set(activity.dayNumber, []);
          grouped.get(activity.dayNumber).push(activity);
        }
        itineraryDays = [...grouped.entries()].map(([day, activities]) => ({
          day,
          title: `Lịch trình ngày ${day}`,
          activities
        }));
      }
    } catch (e) {
      console.warn("fetchItinerary error:", e);
    }
  }

  if (!itineraryDays || itineraryDays.length === 0) {
    if (Array.isArray(tour.itinerary) && tour.itinerary.length > 0) {
      itineraryDays = tour.itinerary;
    } else if (typeof tour.itinerary === "string") {
      try {
        const parsed = JSON.parse(tour.itinerary);
        if (Array.isArray(parsed) && parsed.length > 0) itineraryDays = parsed;
      } catch (e) {}
    } else if (tour.itinerary_json) {
      try {
        const parsed = JSON.parse(tour.itinerary_json);
        if (Array.isArray(parsed) && parsed.length > 0) itineraryDays = parsed;
      } catch (e) {}
    }
  }

  // Tra cứu DEFAULT_TOURS nếu danh mục online chưa kịp đồng bộ đầy đủ ngày
  if (!itineraryDays || itineraryDays.length === 0) {
    const def = (typeof DEFAULT_TOURS !== "undefined")
      ? DEFAULT_TOURS.find(d => String(d.id).toUpperCase() === String(tour.id).toUpperCase())
      : null;
    if (def && Array.isArray(def.itinerary) && def.itinerary.length > 0) {
      itineraryDays = def.itinerary;
    }
  }

  if (!itineraryDays || itineraryDays.length === 0) {
    itineraryDays = [
      {
        day: 1,
        title: "Khởi hành & Trải nghiệm điểm đến",
        morning: "08:00 Hướng dẫn viên và xe limousine Delta Travel đón quý khách theo điểm hẹn, bắt đầu chuyến đi.",
        afternoon: "12:00 Quý khách nhận phòng / lên du thuyền, thưởng thức bữa trưa với thực đơn đặc sản địa phương.",
        evening: "18:30 Dùng bữa tối lãng mạn, tự do dạo phố đêm, thưởng ngoạn cảnh đẹp và tham gia các hoạt động giải trí."
      }
    ];
  }

  const timelineEl = document.getElementById("itineraryTimeline");
  if (timelineEl) {
    timelineEl.innerHTML = itineraryDays.map((day, idx) => {
      const dayNum = day.day || (idx + 1);
      const dayTitle = day.title || `Khám phá ngày ${dayNum}`;
      if (Array.isArray(day.activities)) {
        return `
          <div class="itinerary-day-card">
            <div class="itinerary-day-badge">${dayNum}</div>
            <h5 class="itinerary-day-title">Ngày ${dayNum}: ${escapeHtml(dayTitle)}</h5>
            ${day.activities.map(activity => `
              <div class="day-period-block">
                <div class="period-icon-wrap period-morning"><i class="bi bi-calendar-check"></i></div>
                <div class="period-content">
                  <h6>${escapeHtml([activity.startTime, activity.title].filter(Boolean).join(" · "))}</h6>
                  <p>${escapeHtml(activity.description || "")}</p>
                  ${activity.location ? `<small>${escapeHtml(activity.location)}</small>` : ""}
                </div>
              </div>
            `).join("")}
          </div>`;
      }
      const morningText = day.morning || day.activities || "Hoạt động tham quan buổi sáng theo hướng dẫn viên.";
      const afternoonText = day.afternoon || "Hoạt động buổi chiều và khám phá các danh lam thắng cảnh tiêu biểu.";
      const eveningText = day.evening || "Hoạt động buổi tối, ăn tối và tự do dạo chơi.";

      return `
        <div class="itinerary-day-card">
          <div class="itinerary-day-badge">${dayNum}</div>
          <h5 class="itinerary-day-title">Ngày ${dayNum}: ${dayTitle}</h5>

          <!-- Buổi Sáng -->
          <div class="day-period-block">
            <div class="period-icon-wrap period-morning">
              <i class="bi bi-brightness-alt-high-fill"></i>
            </div>
            <div class="period-content">
              <h6>Buổi Sáng</h6>
              <p>${escapeHtml(morningText)}</p>
            </div>
          </div>

          <!-- Buổi Chiều -->
          <div class="day-period-block">
            <div class="period-icon-wrap period-afternoon">
              <i class="bi bi-sun-fill"></i>
            </div>
            <div class="period-content">
              <h6>Buổi Chiều</h6>
              <p>${escapeHtml(afternoonText)}</p>
            </div>
          </div>

          <!-- Buổi Tối -->
          <div class="day-period-block">
            <div class="period-icon-wrap period-evening">
              <i class="bi bi-moon-stars-fill"></i>
            </div>
            <div class="period-content">
              <h6>Buổi Tối</h6>
              <p>${escapeHtml(eveningText)}</p>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  // 3. Điền Dịch vụ bao gồm & Không bao gồm
  let inclusions = [];
  if (Array.isArray(tour.inclusions)) {
    inclusions = tour.inclusions;
  } else if (typeof tour.inclusions === "string") {
    inclusions = tour.inclusions.split("\n").map(s => s.trim()).filter(Boolean);
  }
  if (!inclusions || inclusions.length === 0) {
    inclusions = [
      "Xe đưa đón du lịch đời mới máy lạnh suốt tuyến",
      "Khách sạn / Du thuyền tiêu chuẩn 4-5 sao cao cấp",
      "Các bữa ăn chính đặc sản theo lịch trình",
      "Vé tham quan tất cả các thắng cảnh trong tour",
      "Hướng dẫn viên chuyên nghiệp đồng hành chu đáo",
      "Bảo hiểm du lịch trọn gói mức 100.000.000đ"
    ];
  }

  const inclusionsEl = document.getElementById("itineraryInclusions");
  if (inclusionsEl) {
    inclusionsEl.innerHTML = inclusions.map(inc => `
      <li><i class="bi bi-check-circle-fill"></i> <span>${inc}</span></li>
    `).join("");
  }

  let exclusions = [];
  if (Array.isArray(tour.exclusions)) {
    exclusions = tour.exclusions;
  } else if (typeof tour.exclusions === "string") {
    exclusions = tour.exclusions.split("\n").map(s => s.trim()).filter(Boolean);
  }
  if (!exclusions || exclusions.length === 0) {
    exclusions = [
      "Thuế VAT 8% (nếu quý khách có nhu cầu xuất hóa đơn đỏ)",
      "Chi phí phòng đơn nếu đi 1 mình có phụ thu",
      "Đồ uống gọi thêm trong các bữa ăn (rượu vang, bia, nước ngọt)",
      "Tiền tip bồi dưỡng cho tài xế và hướng dẫn viên (tùy tâm)"
    ];
  }

  const exclusionsEl = document.getElementById("itineraryExclusions");
  if (exclusionsEl) {
    exclusionsEl.innerHTML = exclusions.map(exc => `
      <li><i class="bi bi-x-circle-fill"></i> <span>${exc}</span></li>
    `).join("");
  }

  // 4. Gắn sự kiện nút Đặt ngay trong Modal
  const bookBtn = document.getElementById("itineraryBookBtn");
  if (bookBtn) {
    bookBtn.onclick = () => {
      bootstrap.Modal.getInstance(modalEl)?.hide();
      openBookingModal(tour.id);
    };
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

/**
 * Điều hướng Carousel Nhận xét khách hàng (Testimonials)
 */
function nextTestimonial() {
  const carouselEl = document.getElementById("testimonialsCarousel");
  if (carouselEl) {
    const carousel = bootstrap.Carousel.getOrCreateInstance(carouselEl);
    carousel.next();
  }
}

function prevTestimonial() {
  const carouselEl = document.getElementById("testimonialsCarousel");
  if (carouselEl) {
    const carousel = bootstrap.Carousel.getOrCreateInstance(carouselEl);
    carousel.prev();
  }
}

// =============================================================================
// X. HỆ THỐNG ĐẶT LỊCH & TÍNH TIỀN THEO THỜI GIAN THỰC (BOOKING & REAL-TIME PRICING)
// =============================================================================
/**
 * Khởi tạo ngày đi tối thiểu là ngày mai
 */
function setMinimumDepartureDate() {
  const dateInput = document.getElementById("bookingDepartureDate");
  if (dateInput) dateInput.replaceChildren(new Option("Đang tải ngày khởi hành...", ""));
  const filterDate = document.getElementById("filterDepartureDate");
  if (filterDate) {
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    filterDate.min = localDate;
  }
}

/**
 * Mở Trang Đặt tour riêng biệt chuẩn giấy (Không đè lên 3D web)
 */
async function openBookingModal(tourId) {
  if (DeltaAPI?.isCatalogReadOnly?.()) {
    showToast("Danh mục đang kết nối SQL Server chỉ đọc; chức năng đặt tour chưa được tích hợp.", "warning");
    return;
  }
  const id = tourId || "DL-HL01";
  window.location.href = `booking.html?tourId=${encodeURIComponent(id)}`;
}

/**
 * Lắng nghe tất cả sự kiện thay đổi trên Form Đặt Tour để tính tiền Real-time
 */
function initBookingListeners() {
  // Thay đổi số lượng hành khách
  ["Adults", "Children", "Infants"].forEach(type => {
    const input = document.getElementById(`qty${type}`);
    if (input) {
      input.addEventListener("change", calculateOrderPricing);
    }
  });
  document.getElementById("bookingDepartureDate")?.addEventListener("change", calculateOrderPricing);

  // Tích chọn dịch vụ gia tăng
  document.querySelectorAll(".addon-checkbox").forEach(cb => {
    cb.addEventListener("change", (e) => {
      // Đổi class để tạo viền sáng đẹp
      const parent = e.target.closest(".addon-item");
      if (parent) parent.classList.toggle("selected", e.target.checked);
      calculateOrderPricing();
    });
  });

  // Nút áp dụng Voucher
  const applyVoucherBtn = document.getElementById("btnApplyVoucher");
  if (applyVoucherBtn) {
    applyVoucherBtn.addEventListener("click", applyVoucherCode);
  }

  // Form xác nhận hoàn tất đặt tour
  const bookingForm = document.getElementById("deltaBookingForm");
  if (bookingForm) {
    bookingForm.addEventListener("submit", handleBookingSubmission);
  }
}

/**
 * Tăng/giảm số lượng hành khách bằng nút (+)/(-)
 */
function changePassengerQty(type, delta) {
  const input = document.getElementById(`qty${type}`);
  if (!input) return;

  let current = parseInt(input.value) || 0;
  let min = (type === "Adults") ? 1 : 0; // Ít nhất phải có 1 người lớn
  const selected = AppState.currentSchedules.find(schedule => schedule.id === document.getElementById("bookingDepartureDate")?.value);
  const max = selected ? selected.availableSeats : 20;

  const total = ["Adults", "Children", "Infants"].reduce((sum, passengerType) => {
    return sum + (Number(document.getElementById(`qty${passengerType}`)?.value) || 0);
  }, 0);
  if (delta > 0 && total >= max) {
    showToast(`Chỉ còn ${max} chỗ cho ngày khởi hành này.`, "warning");
    return;
  }

  current += delta;
  if (current < min) current = min;
  if (current > max) current = max;

  input.value = current;
  calculateOrderPricing();
}

/**
 * Tính toán chi tiết toàn bộ số tiền đơn hàng trong thời gian thực
 */
function calculateOrderPricing() {
  const tour = AppState.currentBookingTour;
  if (!tour) return;

  const adultQty = parseInt(document.getElementById("qtyAdults")?.value) || 1;
  const childQty = parseInt(document.getElementById("qtyChildren")?.value) || 0;
  const infantQty = parseInt(document.getElementById("qtyInfants")?.value) || 0;

  // 1. Tiền vé cơ bản
  const adultTotal = adultQty * tour.price;
  const childTotal = childQty * Math.round(tour.price * 0.75); // Trẻ em 75%
  const infantTotal = infantQty * Math.round(tour.price * 0.10); // Em bé 10% (phí bảo hiểm)

  // 2. Dịch vụ cộng thêm
  let addonTotal = 0;
  const cbSingleRoom = document.getElementById("addonSingleRoom");
  const cbAirport = document.getElementById("addonAirport");
  const cbInsurance = document.getElementById("addonInsurance");

  if (cbSingleRoom?.checked) addonTotal += ADDON_SERVICES.singleRoom.price;
  if (cbAirport?.checked) addonTotal += ADDON_SERVICES.airportShuttle.price;
  if (cbInsurance?.checked) {
    const totalPassengers = adultQty + childQty + infantQty;
    addonTotal += ADDON_SERVICES.premiumInsurance.price * totalPassengers;
  }

  // Tạm tính
  const subtotal = adultTotal + childTotal + infantTotal + addonTotal;

  // 3. Giảm giá Voucher
  let discountAmount = 0;
  if (AppState.appliedVoucher) {
    const v = AppState.appliedVoucher;
    if (v.discountType === "percent") {
      discountAmount = Math.round((subtotal * v.discountValue) / 100);
      if (v.maxDiscount && discountAmount > v.maxDiscount) {
        discountAmount = v.maxDiscount;
      }
    } else if (v.discountType === "fixed") {
      discountAmount = v.discountValue;
    }
  }

  // Tổng thanh toán cuối cùng (không âm)
  const grandTotal = Math.max(0, subtotal - discountAmount);

  // 4. Cập nhật lên giao diện Tóm tắt (DOM)
  document.getElementById("costAdultText").textContent = `${adultQty} x ${formatVND(tour.price)}`;
  document.getElementById("costAdultTotal").textContent = formatVND(adultTotal);

  const costChildRow = document.getElementById("costChildRow");
  if (costChildRow) {
    if (childQty > 0) {
      costChildRow.style.display = "flex";
      document.getElementById("costChildText").textContent = `${childQty} x ${formatVND(Math.round(tour.price * 0.75))}`;
      document.getElementById("costChildTotal").textContent = formatVND(childTotal);
    } else {
      costChildRow.style.display = "none";
    }
  }

  const costInfantRow = document.getElementById("costInfantRow");
  if (costInfantRow) {
    if (infantQty > 0) {
      costInfantRow.style.display = "flex";
      document.getElementById("costInfantText").textContent = `${infantQty} x ${formatVND(Math.round(tour.price * 0.10))}`;
      document.getElementById("costInfantTotal").textContent = formatVND(infantTotal);
    } else {
      costInfantRow.style.display = "none";
    }
  }

  const costAddonRow = document.getElementById("costAddonRow");
  if (costAddonRow) {
    if (addonTotal > 0) {
      costAddonRow.style.display = "flex";
      document.getElementById("costAddonTotal").textContent = formatVND(addonTotal);
    } else {
      costAddonRow.style.display = "none";
    }
  }

  // Hàng Voucher
  const costDiscountRow = document.getElementById("costDiscountRow");
  if (costDiscountRow) {
    if (discountAmount > 0) {
      costDiscountRow.style.display = "flex";
      document.getElementById("costDiscountVal").textContent = `-${formatVND(discountAmount)}`;
    } else {
      costDiscountRow.style.display = "none";
    }
  }

  // Tổng số tiền cần thanh toán
  document.getElementById("checkoutGrandTotal").textContent = formatVND(grandTotal);

  // Cập nhật số tiền và nội dung chuyển khoản trên Box QR Code
  const qrAmountEl = document.getElementById("qrTransferAmount");
  const qrCodeEl = document.getElementById("qrTransferContent");
  if (qrAmountEl) qrAmountEl.textContent = formatVND(grandTotal);
  if (qrCodeEl) qrCodeEl.textContent = AppState.bookingReference;

  return {
    tourId: tour.id,
    tourTitle: tour.title,
    adultQty,
    childQty,
    infantQty,
    adultTotal,
    childTotal,
    infantTotal,
    addonTotal,
    subtotal,
    discountAmount,
    grandTotal
  };
}

/**
 * Xử lý kiểm tra và áp dụng mã giảm giá Voucher
 */
function applyVoucherCode() {
  const input = document.getElementById("voucherCodeInput");
  const msgEl = document.getElementById("voucherStatusMsg");
  if (!input || !msgEl) return;

  const code = input.value.trim().toUpperCase();
  if (!code) {
    msgEl.className = "voucher-status-msg error";
    msgEl.textContent = "Vui lòng nhập mã giảm giá.";
    return;
  }

  const voucher = VOUCHERS_DATA.find(v => v.code === code);
  if (!voucher) {
    msgEl.className = "voucher-status-msg error";
    msgEl.textContent = "Mã voucher không tồn tại hoặc đã hết hạn!";
    AppState.appliedVoucher = null;
    calculateOrderPricing();
    return;
  }

  // Kiểm tra điều kiện đơn hàng tối thiểu
  const pricing = calculateOrderPricing();
  if (voucher.minOrderValue && pricing.subtotal < voucher.minOrderValue) {
    msgEl.className = "voucher-status-msg error";
    msgEl.textContent = `Mã này chỉ áp dụng cho đơn từ ${formatVND(voucher.minOrderValue)}`;
    AppState.appliedVoucher = null;
    calculateOrderPricing();
    return;
  }

  AppState.appliedVoucher = voucher;
  msgEl.className = "voucher-status-msg success";
  msgEl.textContent = `Áp dụng thành công: ${voucher.description}`;
  calculateOrderPricing();
  showToast("Áp dụng mã giảm giá thành công!", "success");
}

// =============================================================================
// XI. XỬ LÝ CHUYỂN TAB PHƯƠNG THỨC THANH TOÁN
// =============================================================================
function selectPaymentTab(method) {
  AppState.selectedPaymentMethod = method;

  // Cập nhật nút tab
  document.querySelectorAll(".payment-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.method === method);
  });

  // Hiển thị khung nội dung tương ứng
  const panes = ["qr", "card", "ewallet", "cash"];
  panes.forEach(p => {
    const paneEl = document.getElementById(`paymentPane_${p}`);
    if (paneEl) {
      paneEl.style.display = (p === method) ? "block" : "none";
    }
  });
}

// =============================================================================
// XII. KIỂM TRA HỢP LỆ VÀ XÁC NHẬN ĐẶT TOUR (SUBMIT & CHECKOUT)
// =============================================================================
async function handleBookingSubmission(e) {
  e.preventDefault();

  // 1. Lấy dữ liệu người đặt
  const fullName = document.getElementById("customerName")?.value.trim();
  const phone = document.getElementById("customerPhone")?.value.trim();
  const email = document.getElementById("customerEmail")?.value.trim();
  const cccd = document.getElementById("customerCCCD")?.value.trim();
  const departureDate = document.getElementById("bookingDepartureDate")?.value;
  const notes = document.getElementById("customerNotes")?.value.trim();

  // 2. Validate cơ bản
  if (!fullName) {
    showToast("Vui lòng nhập họ và tên của bạn", "error");
    document.getElementById("customerName")?.focus();
    return;
  }

  // Kiểm tra số điện thoại Việt Nam (10 số, bắt đầu bằng 0)
  const phoneRegex = /^0[35789][0-9]{8}$/;
  if (!phone || !phoneRegex.test(phone)) {
    showToast("Số điện thoại không hợp lệ (gồm 10 số, VD: 0987654321)", "error");
    document.getElementById("customerPhone")?.focus();
    return;
  }

  // Kiểm tra Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showToast("Vui lòng nhập địa chỉ email hợp lệ để nhận vé điện tử", "error");
    document.getElementById("customerEmail")?.focus();
    return;
  }

  if (!/^[0-9]{12}$/.test(cccd || "")) {
    showToast("Vui lòng nhập CCCD gồm đúng 12 chữ số.", "error");
    document.getElementById("customerCCCD")?.focus();
    return;
  }

  if (!departureDate) {
    showToast("Vui lòng chọn ngày khởi hành", "error");
    document.getElementById("bookingDepartureDate")?.focus();
    return;
  }
  const selectedSchedule = AppState.currentSchedules.find(schedule => schedule.id === departureDate);
  if (!selectedSchedule) {
    showToast("Ngày khởi hành đã chọn không hợp lệ. Vui lòng chọn lại.", "error");
    return;
  }
  const pricing = calculateOrderPricing();
  const requestedSeats = pricing.adultQty + pricing.childQty + pricing.infantQty;
  if (selectedSchedule && requestedSeats > selectedSchedule.availableSeats) {
    showToast(`Số khách vượt quá số chỗ còn (${selectedSchedule.availableSeats}).`, "error");
    return;
  }

  // Thanh toán bảo mật qua hệ thống cổng thanh toán trực tuyến
  if (AppState.selectedPaymentMethod === "card") {
    showToast("Cổng thanh toán thẻ Quốc tế đang bảo trì định kỳ. Quý khách vui lòng chọn Chuyển khoản QR để nhận vé tức thì.", "warning");
    return;
  }

  // 4. Tính toán số tiền cuối
  // 5. Kiểm tra đăng nhập tài khoản
  let currentUser = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
  if (!currentUser) {
    showToast("Vui lòng đăng nhập tài khoản để đặt tour!", "warning");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("authModal"))?.show();
    return;
  }

  if (typeof DeltaAPI === "undefined" || typeof DeltaAPI.createBooking !== "function") {
    showToast("Hệ thống đặt tour chưa sẵn sàng. Vui lòng thử lại sau.", "error");
    return;
  }
  if (!DeltaAPI.isOnline()) {
    const health = await DeltaAPI.checkHealth();
    if (!health.online) {
      showToast("Không thể đặt tour khi máy chủ không kết nối; CCCD không được lưu trên thiết bị.", "error");
      return;
    }
  }

  showToast("Đang tạo đơn giữ chỗ trên máy chủ...", "info");
  const bookRes = await DeltaAPI.createBooking({
    schedule_id: departureDate,
    adults: pricing.adultQty,
    children: pricing.childQty,
    infants: pricing.infantQty,
    customer_name: fullName,
    customer_phone: phone,
    customer_email: email,
    customer_identity: cccd,
    note: notes || ""
  });
  if (!bookRes.success || !bookRes.data) {
    showToast(bookRes.error || "Không thể tạo đơn đặt tour trên máy chủ.", "error");
    return;
  }

  const sb = bookRes.data;
  const isPaid = false;
  const statusCode = "PENDING_DEMO";
  const newOrder = {
    bookingId: sb.reference || AppState.bookingReference,
    serverBookingId: sb.id,
    tourId: pricing.tourId,
    tourTitle: pricing.tourTitle,
    departureDate: selectedSchedule.departureAt,
    userId: currentUser.id,
    userEmail: currentUser.email,
    customer: {
      fullName,
      phone,
      email,
      notes: notes || "Không có yêu cầu đặc biệt"
    },
    cccd: "Bảo mật hệ thống",
    passengers: {
      adults: pricing.adultQty,
      children: pricing.childQty,
      infants: pricing.infantQty
    },
    pricing: {
      subtotal: pricing.subtotal,
      discount: pricing.discountAmount,
      total: sb.totalPrice || pricing.grandTotal
    },
    paymentMethod: getPaymentMethodLabel(AppState.selectedPaymentMethod),
    status: "CHỜ THANH TOÁN (GIỮ CHỖ 15 PHÚT)",
    statusCode,
    isPaid,
    createdAt: new Date().toLocaleString("vi-VN")
  };

  saveBookingToLocalStorage(newOrder);
  const docInput = document.getElementById("customerCCCD");
  if (docInput) docInput.value = "";

  bootstrap.Modal.getInstance(document.getElementById("bookingModal"))?.hide();
  updateCustomerBookingCounters();
  openCustomerBookingDetail(newOrder.bookingId);
  showToast(`Đặt tour thành công qua Backend API! Mã đơn: ${newOrder.bookingId}`, "success");
}

function getPaymentMethodLabel(method) {
  switch (method) {
    case "qr": return "Chuyển khoản QR Ngân hàng (VietQR)";
    case "card": return "Thẻ Quốc tế / ATM Nội địa";
    case "ewallet": return "Ví điện tử MoMo / VNPay";
    case "cash": return "Tiền mặt tại Văn phòng Delta Travel";
    default: return "Chuyển khoản ngân hàng";
  }
}

// =============================================================================
// XIII. QUẢN LÝ ĐƠN HÀNG TRÊN LOCALSTORAGE
// =============================================================================
function getLocalBookings() {
  if (typeof getBookingsData === "function") {
    return getBookingsData();
  }
  try {
    return JSON.parse(localStorage.getItem("delta_bookings_v2")) || [];
  } catch (e) {
    return [];
  }
}

function saveBookingToLocalStorage(order) {
  const orders = getLocalBookings();
  orders.unshift(order); // Đưa đơn mới lên đầu mảng
  if (typeof saveBookingsData === "function") {
    saveBookingsData(orders);
  } else {
    localStorage.setItem("delta_bookings_v2", JSON.stringify(orders));
  }

  // Ghi nhận thanh toán vào hệ thống
  try {
    const payments = (typeof getPaymentsData === "function") ? getPaymentsData() : [];
    const providerKey = (AppState.selectedPaymentMethod === "cash") ? "CASH" : (AppState.selectedPaymentMethod === "qr") ? "QR" : (AppState.selectedPaymentMethod === "ewallet") ? "MOMO" : "VNPAY";
    const refCode = order.isPaid ? ("VQR-" + Math.floor(100000 + Math.random() * 900000)) : ("CASH-PENDING-" + order.bookingId);
    const newPay = {
      id: "PAY-" + Date.now().toString().slice(-6),
      bookingId: order.bookingId,
      customerName: order.customer.fullName,
      tourTitle: order.tourTitle,
      amount: order.pricing.total,
      provider: providerKey,
      providerName: getPaymentMethodLabel(AppState.selectedPaymentMethod),
      status: order.isPaid ? "SUCCEEDED" : "INITIATED",
      reference: refCode,
      note: "Giao dịch thanh toán trực tuyến",
      createdAt: order.createdAt
    };
    payments.unshift(newPay);
    if (typeof savePaymentsData === "function") {
      savePaymentsData(payments);
    }
  } catch (err) {
    console.warn("Lỗi lưu payment:", err);
  }

  // Tự động ghi nhật ký kiểm toán hệ thống
  try {
    if (typeof addAuditLog === "function") {
      addAuditLog("CREATE_BOOKING", "Booking", order.bookingId, `Khách hàng ${order.customer.fullName} đặt tour ${order.tourTitle} (${order.passengers.adults} lớn, ${order.passengers.children} trẻ) - Tổng tiền: ${order.pricing.total.toLocaleString("vi-VN")} đ [${order.paymentMethod}]`);
    }
  } catch (e) {}

  window.dispatchEvent(new CustomEvent("delta_bookings_updated", { detail: orders }));
}

// =============================================================================
// XIV. HIỂN THỊ VÉ ĐIỆN TỬ (E-TICKET / HÓA ĐƠN XÁC NHẬN)
// =============================================================================
function displayETicket(order) {
  const modalEl = document.getElementById("eticketModal");
  if (!modalEl) return;

  // Điền dữ liệu vào vé
  document.getElementById("ticketBookingId").textContent = order.bookingId;
  document.getElementById("ticketStatusBadge").textContent = order.status;
  document.getElementById("ticketStatusBadge").className = order.isPaid
    ? "eticket-status-bar paid"
    : "eticket-status-bar pending";

  document.getElementById("ticketCreatedAt").textContent = order.createdAt;
  document.getElementById("ticketTourTitle").textContent = order.tourTitle;
  document.getElementById("ticketDepartureDate").textContent = order.departureDate;

  // Thông tin hành khách
  document.getElementById("ticketCustomerName").textContent = order.customer.fullName;
  document.getElementById("ticketCustomerPhone").textContent = order.customer.phone;
  document.getElementById("ticketCustomerEmail").textContent = order.customer.email;
  document.getElementById("ticketCustomerCCCD").textContent = order.customer.cccd;

  // Số lượng khách
  const passengerStr = `${order.passengers.adults} Người lớn`
    + (order.passengers.children ? `, ${order.passengers.children} Trẻ em` : "")
    + (order.passengers.infants ? `, ${order.passengers.infants} Em bé` : "");
  document.getElementById("ticketPassengerCount").textContent = passengerStr;

  // Thanh toán
  document.getElementById("ticketPaymentMethod").textContent = order.paymentMethod;
  document.getElementById("ticketTotalAmount").textContent = formatVND(order.pricing.total);

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

/**
 * In vé điện tử hoặc lưu file PDF qua hộp thoại in của trình duyệt
 */
function printETicket() {
  window.print();
}

// =============================================================================
// XV. QUẢN LÝ ĐƠN HÀNG CỦA TÔI (MY BOOKINGS & CHI TIẾT ĐƠN HÀNG)
// Ported 100% from deltatravel-main apps/web/src/app/(account)/bookings/
// =============================================================================

let activeCountdownTimer = null;
let currentCustomerBookingFilter = "all";
let currentCustomerBookingSearch = "";

/**
 * Mở Trang Quản lý đơn đặt tour riêng biệt chuẩn giấy (Không đè lên 3D web)
 */
function openMyBookingsModal() {
  window.location.href = "my-bookings.html";
}

/**
 * Kết xuất danh sách đơn đặt của khách hàng
 */
function renderCustomerOrdersList(searchFilter = "", statusFilter = "all") {
  const container = document.getElementById("myBookingsContainer");
  if (!container) return;

  currentCustomerBookingSearch = searchFilter;
  currentCustomerBookingFilter = statusFilter;

  let bookings = getLocalBookings();

  // Lọc theo từ khóa tìm kiếm
  if (searchFilter.trim() !== "") {
    const kw = searchFilter.trim().toLowerCase();
    bookings = bookings.filter(b =>
      (b.bookingId && b.bookingId.toLowerCase().includes(kw)) ||
      (b.customer?.phone && b.customer.phone.includes(kw)) ||
      (b.customer?.fullName && b.customer.fullName.toLowerCase().includes(kw)) ||
      (b.tourTitle && b.tourTitle.toLowerCase().includes(kw))
    );
  }

  // Lọc theo trạng thái
  if (statusFilter !== "all") {
    bookings = bookings.filter(b => b.statusCode === statusFilter);
  }

  // Khi chưa có đơn hàng nào (Empty State chuẩn deltatravel-main)
  if (bookings.length === 0) {
    container.innerHTML = `
      <div class="rounded-4 border border-dashed border-2 p-5 text-center bg-white my-3 shadow-xs">
        <div class="mb-3">
          <i class="bi bi-ticket-detailed text-muted" style="font-size: 52px;"></i>
        </div>
        <h4 class="fw-bold text-dark mb-2">Bạn chưa có đơn đặt tour nào</h4>
        <p class="text-muted small mx-auto mb-4" style="max-width: 440px;">
          Hãy khám phá các hành trình du lịch & nghỉ dưỡng 5 sao của Delta Travel và tiến hành đặt chỗ ngay hôm nay.
        </p>
        <button class="btn btn-dark rounded-pill px-4 py-2.5 fw-bold shadow-sm" onclick="bootstrap.Modal.getInstance(document.getElementById('myBookingsModal'))?.hide(); document.getElementById('toursSection')?.scrollIntoView({behavior: 'smooth'});">
          <i class="bi bi-compass me-1"></i> Khám phá Tour ngay
        </button>
      </div>
    `;
    return;
  }

  // Render danh sách thẻ đơn hàng chuẩn luxury
  container.innerHTML = bookings.map(b => {
    // Trạng thái badge
    let statusClass = "status-paid";
    let statusLabel = b.status || "ĐÃ THANH TOÁN";
    
    if (b.statusCode === "PENDING_PAYMENT" || b.statusCode === "PENDING_DEMO") {
      statusClass = "status-pending";
      statusLabel = "Chờ thanh toán (15 phút)";
    } else if (b.statusCode === "AWAITING_CASH") {
      statusClass = "status-cash";
      statusLabel = "Chờ thu tiền mặt tại quầy";
    } else if (b.statusCode === "PAID") {
      statusClass = "status-paid";
      statusLabel = "Đã thanh toán";
    } else if (b.statusCode === "CONFIRMED") {
      statusClass = "status-confirmed";
      statusLabel = "Đã duyệt giữ chỗ";
    } else if (b.statusCode === "COMPLETED") {
      statusClass = "status-completed";
      statusLabel = "Hoàn thành chuyến đi";
    } else if (b.statusCode === "CANCELLED") {
      statusClass = "status-cancelled";
      statusLabel = "Đã hủy đơn";
    }

    const canCancel = (b.statusCode === "PENDING_PAYMENT" || b.statusCode === "PENDING_DEMO" || b.statusCode === "AWAITING_CASH" || b.statusCode === "PAID");

    return `
      <div class="booking-luxury-card">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom pb-3 mb-3">
          <div class="d-flex align-items-center gap-2">
            <span class="booking-status-pill ${statusClass}">
              <i class="bi bi-circle-fill" style="font-size: 6px;"></i> ${statusLabel}
            </span>
            <span class="text-muted font-monospace small">#${b.bookingId}</span>
          </div>
          <span class="text-muted small"><i class="bi bi-clock me-1"></i> ${b.createdAt}</span>
        </div>

        <div class="row align-items-center g-3">
          <div class="col-md-7">
            <h5 class="fw-bold text-dark mb-1">${b.tourTitle}</h5>
            <div class="small text-secondary mb-1">
              <i class="bi bi-calendar-event me-1 text-primary"></i> Khởi hành: <strong>${b.departureDate}</strong>
              <span class="mx-1.5">•</span>
              <i class="bi bi-people me-1 text-info"></i> ${b.passengers?.adults || 1} Người lớn${b.passengers?.children ? `, ${b.passengers.children} Trẻ em` : ''}
            </div>
            <div class="small text-muted">
              <i class="bi bi-credit-card me-1"></i> Phương thức: <strong>${b.paymentMethod || 'Chuyển khoản QR'}</strong>
            </div>
          </div>

          <div class="col-md-5 text-md-end">
            <div class="small text-muted text-uppercase fw-semibold" style="font-size: 11px;">Tổng tiền thanh toán</div>
            <div class="fw-bold text-danger fs-5 mb-2">${formatVND(b.pricing?.total || 0)}</div>
            
            <div class="d-flex flex-wrap gap-1.5 justify-content-md-end">
              <button class="btn btn-sm btn-dark rounded-pill px-3 fw-bold" onclick="openCustomerBookingDetail('${b.bookingId}')">
                <i class="bi bi-arrow-right-circle me-1"></i> Chi tiết & Thanh toán
              </button>
              ${canCancel ? `
                <button class="btn btn-sm btn-outline-danger rounded-pill px-2.5" onclick="openCustomerCancelModal('${b.bookingId}')" title="Hủy đơn đặt">
                  <i class="bi bi-x-circle"></i> Hủy
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function handleCustomerBookingSearch(val) {
  renderCustomerOrdersList(val, currentCustomerBookingFilter);
}

function filterCustomerBookings(status, btnEl) {
  const btns = document.querySelectorAll("#customerBookingStatusFilters button");
  btns.forEach(b => {
    b.classList.remove("btn-dark", "active");
    b.classList.add("btn-outline-secondary");
  });
  if (btnEl) {
    btnEl.classList.remove("btn-outline-secondary");
    btnEl.classList.add("btn-dark", "active");
  }
  renderCustomerOrdersList(currentCustomerBookingSearch, status);
}

/**
 * Xử lý AI Trip Concierge trong modal Đơn của tôi
 */
function handleAiConciergePrompt(type) {
  const box = document.getElementById("aiConciergeResponseBox");
  if (!box) return;

  box.style.display = "block";
  box.innerHTML = `<div class="text-warning small"><i class="bi bi-arrow-repeat spin"></i> Delta AI đang phân tích dữ liệu booking của bạn...</div>`;

  const bookings = getLocalBookings();

  setTimeout(() => {
    let reply = "";
    if (type === "pending") {
      const pendingList = bookings.filter(b => b.statusCode === "PENDING_PAYMENT" || b.statusCode === "PENDING_DEMO" || b.statusCode === "AWAITING_CASH");
      if (pendingList.length === 0) {
        reply = "Tuyệt vời! Bạn không có đơn đặt tour nào đang chờ thanh toán. Tất cả các hành trình của bạn đều đã được bảo đảm.";
      } else {
        reply = `Bạn hiện có <strong>${pendingList.length} đơn</strong> đang chờ hoàn tất: <br>`
          + pendingList.map(b => `- Đơn <strong>${b.bookingId}</strong> (${b.tourTitle}): Số tiền ${formatVND(b.pricing?.total || 0)}. Vui lòng thanh toán qua VietQR hoặc tại quầy trước hạn giữ chỗ.`).join("<br>");
      }
    } else if (type === "cancel") {
      reply = "<strong>Chính sách hủy tour minh bạch của Delta Travel:</strong><br>"
        + "- Miễn phí hủy tour 100% khi thực hiện trước 48 giờ so với ngày khởi hành.<br>"
        + "- Hủy trong vòng 24h - 48h: Phí dịch vụ 20%.<br>"
        + "- Các đơn chưa thanh toán hoặc chờ tiền mặt có thể hủy trực tiếp tức thì trên ứng dụng mà không phát sinh phí.";
    } else if (type === "next") {
      if (bookings.length === 0) {
        reply = "Bạn chưa có chuyến đi nào sắp tới. Hãy xem qua danh sách tour nổi bật của Delta Travel để chọn cho mình một kỳ nghỉ lý tưởng!";
      } else {
        const nextBooking = bookings.find(b => b.statusCode !== "CANCELLED") || bookings[0];
        reply = `Hành trình sắp tới của bạn là <strong>${nextBooking.tourTitle}</strong> (Khởi hành ngày ${nextBooking.departureDate}).<br>`
          + "- Hãy chuẩn bị CCCD / Hộ chiếu bản gốc của các thành viên.<br>"
          + "- Hướng dẫn viên Delta Travel sẽ gọi điện thoại xác nhận điểm đón trước giờ xuất phát 12 giờ.<br>"
          + "- Bạn có thể bấm 'Xem chi tiết đơn' để tải vé điện tử hoặc in hóa đơn xác nhận.";
      }
    }

    box.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-1 text-warning fw-bold small">
        <i class="bi bi-robot"></i> Trợ lý Delta AI Concierge:
      </div>
      <div>${reply}</div>
    `;
  }, 350);
}

/**
 * Mở modal Chi tiết đơn hàng & Cổng thanh toán (Booking Detail & Payment Gateway)
 * Ported 100% từ deltatravel-main app/(account)/bookings/[id]/page.tsx
 */
function openCustomerBookingDetail(bookingId) {
  const bookings = getLocalBookings();
  const b = bookings.find(item => item.bookingId === bookingId);
  if (!b) return;

  // Ẩn modal danh sách nếu đang mở
  bootstrap.Modal.getInstance(document.getElementById("myBookingsModal"))?.hide();

  document.getElementById("cDetailBookingCode").textContent = b.bookingId;
  document.getElementById("cDetailTourTitle").textContent = b.tourTitle;

  const bodyEl = document.getElementById("customerBookingDetailBody");
  if (!bodyEl) return;

  // Xóa timer cũ nếu có
  if (activeCountdownTimer) {
    clearInterval(activeCountdownTimer);
    activeCountdownTimer = null;
  }

  const isPending = (b.statusCode === "PENDING_PAYMENT" || b.statusCode === "PENDING_DEMO");
  const isAwaitingCash = (b.statusCode === "AWAITING_CASH");
  const isPaid = (b.statusCode === "PAID" || b.statusCode === "CONFIRMED");
  const isCancelled = (b.statusCode === "CANCELLED");

  bodyEl.innerHTML = `
    ${isPending ? `
      <!-- Khung đếm ngược giữ chỗ 15 phút -->
      <div class="booking-countdown-box">
        <div class="d-flex align-items-center gap-3">
          <div class="countdown-radar"></div>
          <div>
            <div class="fw-bold text-dark small">Thời gian giữ chỗ ưu đãi còn lại:</div>
            <div class="text-muted" style="font-size: 11.5px;">Vui lòng hoàn tất thanh toán trước khi thời gian giữ chỗ kết thúc</div>
          </div>
        </div>
        <div class="countdown-digits" id="bookingDetailTimer">14:59</div>
      </div>

      <!-- Cổng thanh toán trực tuyến -->
      <div class="p-3 bg-white rounded-3 border mb-4 shadow-xs">
        <h6 class="fw-bold text-dark mb-3"><i class="bi bi-shield-check text-success me-1"></i> Chọn Phương Thức Thanh Toán</h6>
        
        <div class="payment-methods-grid">
          <!-- 1. Quét mã VietQR -->
          <div class="payment-option-card selected" onclick="selectDetailPaymentOption('QR', this)">
            <div class="d-flex align-items-center gap-2.5">
              <i class="bi bi-qr-code fs-4 text-primary"></i>
              <div>
                <div class="fw-bold small text-dark">Chuyển khoản VietQR Ngân Hàng (Khuyên dùng)</div>
                <div class="text-muted" style="font-size: 11px;">Quét mã QR qua app ngân hàng để thanh toán tự động 24/7</div>
              </div>
            </div>
            <input type="radio" name="detailPayMethod" value="QR" checked class="form-check-input">
          </div>

          <!-- Chi tiết VietQR -->
          <div id="detailVietQrBox" class="p-3 bg-light rounded-3 border mb-2 text-center">
            <img src="assets/images/qr-payment.png" alt="Mã VietQR Thanh Toán" style="width: 160px; height: 160px; object-fit: contain; border-radius: 8px;" class="mb-2 shadow-xs" onerror="this.onerror=null; this.src='assets/images/qr-payment.png';">
            <div class="small fw-bold text-dark">VIETQR THANH TOÁN TỰ ĐỘNG 24/7</div>
            <div class="small text-muted font-monospace">Hệ thống xử lý vé điện tử tức thì</div>
            <div class="small text-danger fw-bold mt-1">Cú pháp CK: <code class="p-1 bg-white border rounded text-danger">${b.bookingId}</code></div>
          </div>

          <!-- 2. Tiền mặt tại quầy -->
          <div class="payment-option-card" onclick="selectDetailPaymentOption('CASH', this)">
            <div class="d-flex align-items-center gap-2.5">
              <i class="bi bi-cash-coin fs-4 text-success"></i>
              <div>
                <div class="fw-bold small text-dark">Thanh toán Tiền mặt tại quầy giao dịch Delta</div>
                <div class="text-muted" style="font-size: 11px;">Giữ chỗ 24h và thanh toán trực tiếp tại văn phòng Hà Nội / TP.HCM</div>
              </div>
            </div>
            <input type="radio" name="detailPayMethod" value="CASH" class="form-check-input">
          </div>

          <!-- 3. Cổng VNPay -->
          <div class="payment-option-card" onclick="selectDetailPaymentOption('VNPAY', this)">
            <div class="d-flex align-items-center gap-2.5">
              <i class="bi bi-credit-card fs-4 text-info"></i>
              <div>
                <div class="fw-bold small text-dark">Cổng thanh toán VNPay Sandbox</div>
                <div class="text-muted" style="font-size: 11px;">Hỗ trợ thẻ ATM nội địa của 40+ ngân hàng Việt Nam</div>
              </div>
            </div>
            <input type="radio" name="detailPayMethod" value="VNPAY" class="form-check-input">
          </div>

          <!-- 4. Ví MoMo -->
          <div class="payment-option-card" onclick="selectDetailPaymentOption('MOMO', this)">
            <div class="d-flex align-items-center gap-2.5">
              <i class="bi bi-wallet2 fs-4 text-danger"></i>
              <div>
                <div class="fw-bold small text-dark">Ví điện tử MoMo</div>
                <div class="text-muted" style="font-size: 11px;">Thanh toán siêu tốc qua ứng dụng MoMo</div>
              </div>
            </div>
            <input type="radio" name="detailPayMethod" value="MOMO" class="form-check-input">
          </div>
        </div>

        <button type="button" class="btn btn-dark w-100 py-2.5 fw-bold rounded-3 shadow-sm mt-2" onclick="handleCustomerPayNow('${b.bookingId}')">
          <i class="bi bi-check-circle-fill text-warning me-1"></i> Xác nhận thanh toán ngay (${formatVND(b.pricing?.total || 0)})
        </button>
      </div>
    ` : ''}

    ${isAwaitingCash ? `
      <div class="alert alert-info d-flex align-items-center gap-3 rounded-3 mb-4">
        <i class="bi bi-info-circle-fill fs-3 text-info"></i>
        <div>
          <div class="fw-bold">Đơn hàng đang chờ thu tiền mặt tại quầy</div>
          <div class="small">Vui lòng ghé văn phòng Delta Travel (Tầng 8 Delta Tower, Hà Nội hoặc Chi nhánh Quận 1, TP.HCM) trong vòng 24 giờ để hoàn tất thủ tục giữ chỗ.</div>
        </div>
      </div>
    ` : ''}

    ${isPaid ? `
      <div class="alert alert-success d-flex align-items-center justify-content-between rounded-3 mb-4">
        <div class="d-flex align-items-center gap-3">
          <i class="bi bi-check-circle-fill fs-2 text-success"></i>
          <div>
            <div class="fw-bold">Đơn hàng đã được thanh toán & xác nhận giữ chỗ thành công!</div>
            <div class="small">Vé điện tử và hợp đồng bảo hiểm du lịch đã sẵn sàng.</div>
          </div>
        </div>
        <button class="btn btn-sm btn-success fw-bold rounded-pill" onclick="displayETicket(getLocalBookings().find(x => x.bookingId === '${b.bookingId}'))">
          <i class="bi bi-receipt"></i> Xem E-Ticket
        </button>
      </div>
    ` : ''}

    ${isCancelled ? `
      <div class="alert alert-secondary d-flex align-items-center gap-3 rounded-3 mb-4">
        <i class="bi bi-x-circle-fill fs-3 text-danger"></i>
        <div>
          <div class="fw-bold text-dark">Đơn hàng này đã bị hủy</div>
          <div class="small text-muted">Lý do hủy: <strong>${b.cancelReason || 'Người dùng yêu cầu hủy'}</strong></div>
        </div>
      </div>
    ` : ''}

    <!-- 2 Cột: Thông tin khách hàng & Bảng kê chi phí -->
    <div class="row g-4">
      <div class="col-md-6">
        <div class="p-3 bg-white rounded-3 border h-100">
          <h6 class="fw-bold text-uppercase small text-muted border-bottom pb-2 mb-3">Thông Tin Người Đặt Chỗ</h6>
          <div class="d-flex flex-column gap-2 small">
            <div><span class="text-muted">Họ và tên:</span> <strong>${b.customer?.fullName || 'Khách hàng'}</strong></div>
            <div><span class="text-muted">Số điện thoại:</span> <strong>${b.customer?.phone || '-'}</strong></div>
            <div><span class="text-muted">Email nhận vé:</span> <strong>${b.customer?.email || '-'}</strong></div>
            <div><span class="text-muted">CCCD / Hộ chiếu:</span> <strong>${b.customer?.cccd || 'Đã xác thực'}</strong></div>
            <div><span class="text-muted">Ghi chú đặc biệt:</span> <p class="p-2 bg-light rounded border text-muted mb-0 mt-1">${b.customer?.notes || 'Không có yêu cầu'}</p></div>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="p-3 bg-white rounded-3 border h-100">
          <h6 class="fw-bold text-uppercase small text-muted border-bottom pb-2 mb-3">Chi Tiết Hành Trình & Chi Phí</h6>
          <div class="d-flex flex-column gap-2 small">
            <div><span class="text-muted">Hành trình tour:</span> <strong>${b.tourTitle}</strong></div>
            <div><span class="text-muted">Ngày khởi hành:</span> <strong class="text-primary">${b.departureDate}</strong></div>
            <div><span class="text-muted">Số lượng khách:</span> <strong>${b.passengers?.adults || 1} Người lớn${b.passengers?.children ? `, ${b.passengers.children} Trẻ em` : ''}</strong></div>
            <div><span class="text-muted">Hình thức:</span> <strong>${b.paymentMethod || 'VietQR'}</strong></div>

            <div class="p-2.5 bg-light rounded-3 border mt-2">
              <div class="d-flex justify-content-between mb-1">
                <span>Tạm tính giá tour:</span>
                <strong>${formatVND(b.pricing?.subtotal || b.pricing?.total || 0)}</strong>
              </div>
              ${b.pricing?.discount ? `
                <div class="d-flex justify-content-between mb-1 text-success">
                  <span>Ưu đãi Voucher:</span>
                  <strong>- ${formatVND(b.pricing.discount)}</strong>
                </div>
              ` : ''}
              <div class="d-flex justify-content-between border-top pt-2 mt-2 fs-6">
                <span class="fw-bold">Tổng thanh toán:</span>
                <strong class="text-danger fw-bold">${formatVND(b.pricing?.total || 0)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Kích hoạt đồng hồ đếm ngược 15 phút nếu đơn đang PENDING_PAYMENT
  if (isPending) {
    let timeLeft = 15 * 60; // 15 phút
    activeCountdownTimer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(activeCountdownTimer);
        const timerEl = document.getElementById("bookingDetailTimer");
        if (timerEl) timerEl.textContent = "00:00 (Hết hạn)";
        return;
      }
      const mins = Math.floor(timeLeft / 60);
      const secs = timeLeft % 60;
      const timerEl = document.getElementById("bookingDetailTimer");
      if (timerEl) {
        timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("customerBookingDetailModal"));
  modal.show();
}

function selectDetailPaymentOption(provider, cardEl) {
  const cards = document.querySelectorAll(".payment-option-card");
  cards.forEach(c => c.classList.remove("selected"));
  if (cardEl) {
    cardEl.classList.add("selected");
    const radio = cardEl.querySelector("input[type='radio']");
    if (radio) radio.checked = true;
  }

  const qrBox = document.getElementById("detailVietQrBox");
  if (qrBox) {
    qrBox.style.display = (provider === "QR") ? "block" : "none";
  }
}

/**
 * Xử lý Khách Hàng Thanh Toán Ngay từ màn hình chi tiết
 */
async function handleCustomerPayNow(bookingId) {
  const bookings = getLocalBookings();
  const booking = bookings.find(b => b.bookingId === bookingId);
  if (!booking) {
    showToast("Không tìm thấy đơn đặt tour.", "error");
    return;
  }

  showToast("Đơn hàng đang chờ nhân viên đối soát hoặc chuyển khoản qua mã QR.", "info");
}

/**
 * Mở modal Hủy Đơn của khách hàng (Ported 100% từ deltatravel-main)
 */
function openCustomerCancelModal(bookingId) {
  const bookings = getLocalBookings();
  const b = bookings.find(x => x.bookingId === bookingId);
  if (!b) return;

  document.getElementById("customerCancelTargetId").value = bookingId;
  document.getElementById("customerCancelBookingId").textContent = bookingId;
  document.getElementById("customerCancelTourTitle").textContent = b.tourTitle;
  document.getElementById("customerCancelReasonInput").value = "";

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("customerCancelBookingModal"));
  modal.show();
}

function setCustomerCancelReason(txt) {
  const input = document.getElementById("customerCancelReasonInput");
  if (input) input.value = txt;
}

/**
 * Xác nhận Hủy Đơn từ phía khách hàng
 */
function handleCustomerConfirmCancel(e) {
  e.preventDefault();
  const bookingId = document.getElementById("customerCancelTargetId").value;
  const reason = document.getElementById("customerCancelReasonInput").value.trim();

  if (!reason) {
    alert("Vui lòng nhập lý do hủy đơn!");
    return;
  }

  const bookings = getLocalBookings();
  const idx = bookings.findIndex(x => x.bookingId === bookingId);
  if (idx === -1) return;
  if (bookings[idx].statusCode === "CANCELLED") {
    showToast("Đơn mẫu đã được hủy trước đó.", "info");
    return;
  }
  if (bookings[idx].isPaid || ["PAID", "CONFIRMED", "COMPLETED"].includes(bookings[idx].statusCode)) {
    showToast("Đơn đã xác nhận cần quản trị viên xử lý hủy hoặc hoàn tiền.", "error");
    return;
  }

  const wasPaid = false;

  bookings[idx].statusCode = "CANCELLED";
  bookings[idx].status = "ĐÃ HỦY THEO YÊU CẦU";
  bookings[idx].cancelReason = reason;

  if (typeof saveBookingsData === "function") {
    saveBookingsData(bookings);
  } else {
    localStorage.setItem("delta_bookings_v2", JSON.stringify(bookings));
  }

  // Đồng bộ hủy đơn với Backend API nếu có
  if (typeof DeltaAPI !== "undefined" && typeof DeltaAPI.cancelBooking === "function") {
    const targetId = bookings[idx].serverBookingId || bookingId;
    DeltaAPI.cancelBooking(targetId, reason).catch(() => {});
  }

  // Đơn demo không giữ chỗ ở database nên không được cộng tồn kho lúc hủy.
  // Ghi nhật ký kiểm toán
  try {
    if (typeof addAuditLog === "function") {
      addAuditLog("CANCEL_BOOKING", "Booking", bookingId, `Khách hàng ${bookings[idx].customer.fullName} tự thao tác hủy đơn ${bookingId}. Lý do: ${reason}`);
    }
  } catch (e) {}

  bootstrap.Modal.getInstance(document.getElementById("customerCancelBookingModal"))?.hide();
  updateCustomerBookingCounters();
  renderCustomerOrdersList(currentCustomerBookingSearch, currentCustomerBookingFilter);
  showToast(`Đã hủy thành công đơn ${bookingId} theo yêu cầu!`, "warning");
}

function printETicketFromDetail() {
  const code = document.getElementById("cDetailBookingCode")?.textContent;
  const bookings = getLocalBookings();
  const b = bookings.find(x => x.bookingId === code);
  if (b) {
    displayETicket(b);
  }
}

// =============================================================================
// XVI. THÔNG BÁO TOAST THÂN THIỆN (TOAST NOTIFICATIONS)
// =============================================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `custom-toast toast-${type}`;

  let icon = "bi-info-circle-fill text-primary";
  if (type === "success") icon = "bi-check-circle-fill text-success";
  if (type === "error") icon = "bi-exclamation-triangle-fill text-danger";
  if (type === "warning") icon = "bi-exclamation-circle-fill text-warning";

  toast.innerHTML = `
    <i class="bi ${icon} fs-5"></i>
    <div class="flex-grow-1 small fw-semibold">${message}</div>
    <button type="button" class="btn-close btn-close-sm" style="font-size: 0.75rem;" onclick="this.parentElement.remove()"></button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    bootstrap.Modal.getInstance(el)?.hide();
  }
}

// Xử lý tham số URL (?ai=open hoặc ?region=...) khi người dùng điều hướng từ trang khác
document.addEventListener("DOMContentLoaded", () => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ai") === "open") {
      setTimeout(() => {
        if (typeof openLargeAIChat === "function") openLargeAIChat();
      }, 350);
    }
    const reg = params.get("region");
    if (reg) {
      setTimeout(() => {
        const tab = document.querySelector(`.liquid-nav-link[onclick*="'${reg}'"]`);
        if (tab && typeof filterToursRegion === "function") filterToursRegion(reg, tab);
      }, 450);
    }
  } catch (err) {
    console.warn("URL params check error:", err);
  }
});

// Lắng nghe sự kiện chuyển đổi ngôn ngữ
window.addEventListener("languageChanged", () => {
  if (typeof renderTourCards === "function") renderTourCards();
});
