/**
 * DELTA TRAVEL - CUSTOM DROPDOWNS & DATE PICKER CONTROLLER (custom-dropdowns.js)
 * -----------------------------------------------------------------------------
 * Thay thế triệt để select và datepicker mặc định của hệ điều hành bằng
 * giao diện giấy tối giản (Trắng Đen), chuẩn mực thẩm mỹ cao cấp.
 */

(function () {
  const SELECT_IDS = [
    "heroRegion",
    "heroPrice",
    "tourSortSelect",
    "filterPriceRange",
    "filterDuration",
    "filterTransport",
    "filterAvailability"
  ];

  /**
   * Biến đổi 1 thẻ <select> thành Custom Dropdown chuẩn
   */
  function enhanceSelect(selectEl) {
    if (!selectEl || selectEl.dataset.customEnhanced === "true") return;

    // Đánh dấu đã chuyển đổi
    selectEl.dataset.customEnhanced = "true";
    selectEl.style.display = "none";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select-wrapper";
    wrapper.dataset.targetId = selectEl.id || "";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const textSpan = document.createElement("span");
    textSpan.className = "custom-select-text";
    
    // Lấy nhãn của option đang được chọn
    const currentOption = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
    textSpan.textContent = currentOption ? currentOption.text : "Chọn...";

    const caretIcon = document.createElement("i");
    caretIcon.className = "bi bi-chevron-down custom-select-caret";

    trigger.appendChild(textSpan);
    trigger.appendChild(caretIcon);

    // Menu danh sách tùy chọn
    const menu = document.createElement("div");
    menu.className = "custom-select-menu";
    menu.setAttribute("role", "listbox");

    function renderOptions() {
      menu.innerHTML = "";
      Array.from(selectEl.options).forEach((opt) => {
        const item = document.createElement("div");
        item.className = `custom-select-option ${opt.selected ? "is-selected" : ""}`;
        item.dataset.value = opt.value;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", opt.selected ? "true" : "false");

        item.innerHTML = `
          <span class="option-label">${opt.text}</span>
          <i class="bi bi-check-lg option-check"></i>
        `;

        item.addEventListener("click", (e) => {
          e.stopPropagation();
          selectOption(opt.value);
        });

        menu.appendChild(item);
      });
    }

    renderOptions();

    function selectOption(val) {
      if (selectEl.value !== val) {
        selectEl.value = val;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      updateUI();
      closeMenu();
    }

    function updateUI() {
      const selectedOpt = selectEl.options[selectEl.selectedIndex];
      if (selectedOpt) {
        textSpan.textContent = selectedOpt.text;
      }
      menu.querySelectorAll(".custom-select-option").forEach((el) => {
        const isMatch = el.dataset.value === selectEl.value;
        el.classList.toggle("is-selected", isMatch);
        el.setAttribute("aria-selected", isMatch ? "true" : "false");
      });
    }

    function openMenu() {
      closeAllDropdowns();
      wrapper.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    }

    function closeMenu() {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (wrapper.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Lắng nghe khi <select> thay đổi từ mã JavaScript bên ngoài (VD: nút Đặt lại)
    selectEl.addEventListener("change", () => {
      updateUI();
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);

    // Chèn wrapper ngay sau thẻ select
    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
  }

  /**
   * Biến đổi <input type="date"> thành Custom Date Picker & Calendar Popover
   */
  function enhanceDatePicker(dateInputEl) {
    if (!dateInputEl || dateInputEl.dataset.customDateEnhanced === "true") return;

    dateInputEl.dataset.customDateEnhanced = "true";
    dateInputEl.style.display = "none";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-datepicker-wrapper";
    wrapper.id = "customDatePickerWrapper";

    const inputTrigger = document.createElement("div");
    inputTrigger.className = "custom-datepicker-input";
    inputTrigger.tabIndex = 0;

    const displaySpan = document.createElement("span");
    displaySpan.className = "datepicker-display-text is-placeholder";
    displaySpan.textContent = "Chọn ngày khởi hành (ngày/tháng/năm)";

    const rightIcons = document.createElement("div");
    rightIcons.className = "d-flex align-items-center gap-2";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn-clear-date";
    clearBtn.style.display = "none";
    clearBtn.title = "Xóa ngày đã chọn";
    clearBtn.innerHTML = `<i class="bi bi-x-circle-fill"></i>`;

    const calIcon = document.createElement("i");
    calIcon.className = "bi bi-calendar-event fs-6 text-dark";

    rightIcons.appendChild(clearBtn);
    rightIcons.appendChild(calIcon);

    inputTrigger.appendChild(displaySpan);
    inputTrigger.appendChild(rightIcons);

    // Khung Lịch Popover
    const popover = document.createElement("div");
    popover.className = "custom-calendar-popover";

    // Trạng thái ngày giờ lịch
    let viewDate = new Date();
    if (dateInputEl.value) {
      const parts = dateInputEl.value.split("-");
      if (parts.length === 3) {
        viewDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }

    function renderCalendar() {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();

      // Tiêu đề tháng năm
      const monthNames = [
        "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
        "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
      ];
      
      const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      // Chuyển Chủ nhật sang cuối (Thứ 2 = 0 .. Chủ nhật = 6)
      const startOffset = (firstDay === 0) ? 6 : firstDay - 1;

      popover.innerHTML = `
        <div class="calendar-header">
          <button type="button" class="btn-cal-nav" id="calPrevBtn" title="Tháng trước"><i class="bi bi-chevron-left"></i></button>
          <div class="calendar-title">${monthNames[month]} / ${year}</div>
          <button type="button" class="btn-cal-nav" id="calNextBtn" title="Tháng sau"><i class="bi bi-chevron-right"></i></button>
        </div>
        <div class="calendar-weekdays">
          <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span class="cal-weekend">CN</span>
        </div>
        <div class="calendar-days-grid" id="calGrid"></div>
        <div class="calendar-actions">
          <button type="button" class="btn-cal-today" id="calTodayBtn">Hôm nay</button>
          <button type="button" class="btn-cal-close" id="calCloseBtn">Đóng</button>
        </div>
      `;

      const gridEl = popover.querySelector("#calGrid");

      // Ô trống đầu tháng
      for (let i = 0; i < startOffset; i++) {
        const empty = document.createElement("div");
        empty.className = "cal-day-cell is-empty";
        gridEl.appendChild(empty);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selectedStr = dateInputEl.value; // YYYY-MM-DD

      for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement("div");
        cell.className = "cal-day-cell";
        cell.textContent = d;

        const cellDate = new Date(year, month, d);
        cellDate.setHours(0, 0, 0, 0);

        const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

        if (cellDate.getTime() === today.getTime()) {
          cell.classList.add("is-today");
        }

        if (selectedStr && selectedStr === dStr) {
          cell.classList.add("is-selected");
        }

        cell.addEventListener("click", (e) => {
          e.stopPropagation();
          pickDate(dStr, `${String(d).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`);
        });

        gridEl.appendChild(cell);
      }

      popover.querySelector("#calPrevBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        viewDate.setMonth(viewDate.getMonth() - 1);
        renderCalendar();
      });

      popover.querySelector("#calNextBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        viewDate.setMonth(viewDate.getMonth() + 1);
        renderCalendar();
      });

      popover.querySelector("#calTodayBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const todayDisplay = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
        pickDate(todayStr, todayDisplay);
      });

      popover.querySelector("#calCloseBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        closeCalendar();
      });
    }

    function pickDate(valYYYYMMDD, displayDDMMYYYY) {
      dateInputEl.value = valYYYYMMDD;
      displaySpan.textContent = displayDDMMYYYY;
      displaySpan.classList.remove("is-placeholder");
      clearBtn.style.display = "inline-flex";
      dateInputEl.dispatchEvent(new Event("change", { bubbles: true }));
      closeCalendar();
    }

    function clearDate() {
      dateInputEl.value = "";
      displaySpan.textContent = "Chọn ngày khởi hành (ngày/tháng/năm)";
      displaySpan.classList.add("is-placeholder");
      clearBtn.style.display = "none";
      dateInputEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearDate();
    });

    function openCalendar() {
      closeAllDropdowns();
      renderCalendar();
      wrapper.classList.add("is-open");
    }

    function closeCalendar() {
      wrapper.classList.remove("is-open");
    }

    inputTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (wrapper.classList.contains("is-open")) {
        closeCalendar();
      } else {
        openCalendar();
      }
    });

    // Lắng nghe khi input gốc bị reset từ ngoài
    dateInputEl.addEventListener("change", () => {
      if (!dateInputEl.value) {
        displaySpan.textContent = "Chọn ngày khởi hành (ngày/tháng/năm)";
        displaySpan.classList.add("is-placeholder");
        clearBtn.style.display = "none";
      } else {
        const parts = dateInputEl.value.split("-");
        if (parts.length === 3) {
          displaySpan.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
          displaySpan.classList.remove("is-placeholder");
          clearBtn.style.display = "inline-flex";
        }
      }
    });

    wrapper.appendChild(inputTrigger);
    wrapper.appendChild(popover);

    dateInputEl.parentNode.insertBefore(wrapper, dateInputEl.nextSibling);
  }

  function closeAllDropdowns() {
    document.querySelectorAll(".custom-select-wrapper.is-open").forEach((el) => {
      el.classList.remove("is-open");
      el.querySelector(".custom-select-trigger")?.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".custom-datepicker-wrapper.is-open").forEach((el) => {
      el.classList.remove("is-open");
    });
  }

  // Đóng khi click ngoài
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-select-wrapper") && !e.target.closest(".custom-datepicker-wrapper")) {
      closeAllDropdowns();
    }
  });

  // Đóng khi bấm ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllDropdowns();
    }
  });

  // Khởi tạo tất cả Custom Dropdowns & Datepicker khi DOM sẵn sàng
  function initAllCustomControls() {
    SELECT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.tagName === "SELECT") {
        enhanceSelect(el);
      }
    });

    const dateEl = document.getElementById("filterDepartureDate");
    if (dateEl) {
      enhanceDatePicker(dateEl);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllCustomControls);
  } else {
    initAllCustomControls();
  }

  window.initAllCustomControls = initAllCustomControls;
})();
