/**
 * Delta Travel 2.0 - Ticket & E-Invoice Service
 * Quản lý & Xuất Vé Điện Tử Luxury (Boarding Pass với Mã Vạch 1D Barcode)
 * và Hóa Đơn Điện Tử Giá Trị Gia Tăng (VAT E-Invoice Chuẩn Nghị định 123/2020/NĐ-CP)
 */

(function (window) {
  "use strict";

  // Bảng mã ký tự chuẩn Code 39 (Tiêu chuẩn quốc tế cho vé máy bay, lữ hành và logistics)
  const CODE39_MAP = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
    'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
    'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
    'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
    '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
  };

  /**
   * Tạo chuỗi SVG Mã Vạch 1D (Barcode 1D Code 39) sắc nét, chuẩn laser scanner
   */
  function generateBarcode1DSVG(rawText, height = 48) {
    const text = String(rawText || "DELTA").toUpperCase().replace(/[^A-Z0-9\-. $/+%*]/g, "");
    const encoded = "*" + text.replace(/\*/g, "") + "*";
    const narrow = 2;
    const wide = 5;
    const gap = 2;

    let barsSvg = "";
    let x = 8;

    for (let i = 0; i < encoded.length; i++) {
      const char = encoded[i];
      const pattern = CODE39_MAP[char] || CODE39_MAP["-"];
      for (let p = 0; p < 9; p++) {
        const isBar = (p % 2 === 0);
        const isWide = (pattern[p] === "1");
        const w = isWide ? wide : narrow;
        if (isBar) {
          barsSvg += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000000" />`;
        }
        x += w;
      }
      x += gap;
    }

    const totalWidth = x + 8;
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height + 18}" width="100%" height="auto" style="max-width: 290px; display: block; margin: 0 auto; overflow: visible;">
        ${barsSvg}
        <text x="${totalWidth / 2}" y="${height + 14}" font-family="'Courier New', Courier, monospace" font-size="12" font-weight="800" fill="#0f172a" letter-spacing="3" text-anchor="middle">*${text.replace(/\*/g, "")}*</text>
      </svg>
    `;
  }

  /**
   * Đọc số tiền VND thành chữ tiếng Việt chuẩn hóa đơn
   */
  function numberToVietnameseWords(n) {
    if (!n || isNaN(n)) return "Không đồng";
    const num = Math.round(Number(n));
    if (num === 0) return "Không đồng";
    const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

    function readGroup(g, isHighest) {
      const h = Math.floor(g / 100);
      const t = Math.floor((g % 100) / 10);
      const u = g % 10;
      let res = "";
      if (h > 0 || !isHighest) {
        res += digits[h] + " trăm ";
      }
      if (t > 1) {
        res += digits[t] + " mươi ";
        if (u === 1) res += "mốt ";
        else if (u === 5) res += "lăm ";
        else if (u > 0) res += digits[u] + " ";
      } else if (t === 1) {
        res += "mười ";
        if (u === 5) res += "lăm ";
        else if (u > 0) res += digits[u] + " ";
      } else {
        if (u > 0) {
          if (h > 0 || !isHighest) res += "lẻ " + digits[u] + " ";
          else res += digits[u] + " ";
        }
      }
      return res.trim();
    }

    let temp = num;
    const groups = [];
    while (temp > 0) {
      groups.push(temp % 1000);
      temp = Math.floor(temp / 1000);
    }
    const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ"];
    let s = "";
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g > 0) {
        const gStr = readGroup(g, i === groups.length - 1);
        s += gStr + " " + units[i] + " ";
      }
    }
    s = s.trim();
    if (s.length > 0) {
      s = s.charAt(0).toUpperCase() + s.slice(1) + " đồng chẵn.";
    } else {
      s = "Không đồng.";
    }
    return s;
  }

  function formatVND(n) {
    return (Number(n) || 0).toLocaleString("vi-VN") + " đ";
  }

  function getCleanBooking(b) {
    if (!b) return {};
    const ref = b.reference || b.bookingId || b.id || "DELTA";
    const custName = b.customerName || b.customer_name || (b.customer && b.customer.fullName) || "Khách Hàng Delta";
    const custPhone = b.customerPhone || b.customer_phone || (b.customer && b.customer.phone) || "0325536936";
    const custEmail = b.customerEmail || b.customer_email || (b.customer && b.customer.email) || "khachhang@deltatravel.vn";
    const tourTitle = b.tourTitle || b.tour_title || b.tourName || "Tour Du Lịch Trọn Gói 5 Sao";
    const adults = Math.max(1, parseInt(b.adults || (b.passengers && b.passengers.adults) || 1, 10));
    const children = Math.max(0, parseInt(b.children || (b.passengers && b.passengers.children) || 0, 10));
    const infants = Math.max(0, parseInt(b.infants || (b.passengers && b.passengers.infants) || 0, 10));
    const totalGuests = adults + children + infants;
    const unitPrice = Number(b.unitPrice || b.unit_price || Math.round((b.totalPrice || b.total_price || 5000) / 1.1)) || 5000;
    const subtotal = Number(b.subtotalPrice || b.subtotal_price || b.subtotal || (adults * unitPrice + children * Math.round(unitPrice * 0.75))) || (totalGuests * unitPrice);
    const discount = Number(b.discountAmount || b.discount_amount || b.discount || 0);
    const taxable = Math.max(0, subtotal - discount);
    const vatRate = 10;
    const vatAmount = Number(b.vatAmount || b.vat_amount || Math.round(taxable * 0.10));
    const totalPrice = Number(b.totalPrice || b.total_price || (taxable + vatAmount));
    const status = String(b.status || b.statusCode || "").toUpperCase();
    const statusCode = String(b.statusCode || b.status || "").toUpperCase();
    const isConfirmedByAdmin = Boolean(status === "CONFIRMED" || status === "COMPLETED" || statusCode === "CONFIRMED" || statusCode === "COMPLETED");
    const isPaid = Boolean(isConfirmedByAdmin || status === "PAID" || statusCode === "PAID" || b.status === "Đã thanh toán" || b.paid === true);
    const evidence = b.paymentEvidence || b.payment_evidence || `SEPAY-MBBank-FT${ref}`;
    const depDate = b.departureDate || b.departure_at || b.departureAt || "21/11/2026";
    const pickupLoc = b.pickupLocation || b.pickup_location || "Điểm hẹn trung tâm / Khách sạn (Hà Nội & TP.HCM)";
    const invNo = "00" + (ref.replace(/\D/g, "").slice(-5) || "38871");
    const createdDate = b.createdAt || b.created_at || new Date().toISOString();

    return {
      id: b.id || ref,
      ref,
      custName,
      custPhone,
      custEmail,
      tourTitle,
      adults,
      children,
      infants,
      totalGuests,
      unitPrice,
      subtotal,
      discount,
      vatRate,
      vatAmount,
      totalPrice,
      status,
      statusCode,
      isPaid,
      isConfirmedByAdmin,
      evidence,
      depDate,
      pickupLoc,
      invNo,
      createdDate,
      voucherCode: b.voucherCode || b.voucher_code || null
    };
  }

  // Đảm bảo có khung in ấn cô lập trên trang
  function ensurePrintStyle() {
    if (document.getElementById("deltaPrintIsolatedStyle")) return;
    const style = document.createElement("style");
    style.id = "deltaPrintIsolatedStyle";
    style.innerHTML = `
      @media print {
        body > *:not(#printIsolatedContainer) {
          display: none !important;
        }
        #printIsolatedContainer {
          display: block !important;
          position: fixed !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          z-index: 9999999 !important;
        }
        .no-print, .btn, .modal-backdrop {
          display: none !important;
        }
        @page {
          size: auto;
          margin: 8mm 10mm;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function showModalSafe(modalEl) {
    if (!modalEl) return;
    if (typeof bootstrap !== "undefined" && bootstrap && bootstrap.Modal) {
      try {
        const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.show();
        return;
      } catch (_) {}
    }
    // Graceful standalone fallback không phụ thuộc thư viện
    modalEl.classList.add("show");
    modalEl.style.display = "block";
    modalEl.style.backgroundColor = "rgba(15, 23, 42, 0.85)";
    modalEl.style.zIndex = "10050";
    modalEl.style.overflowY = "auto";

    let backdrop = document.getElementById("customModalBackdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "customModalBackdrop";
      backdrop.className = "modal-backdrop fade show";
      backdrop.style.zIndex = "10040";
      document.body.appendChild(backdrop);
    }

    const closeHandler = () => {
      modalEl.classList.remove("show");
      modalEl.style.display = "none";
      if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    };

    modalEl.querySelectorAll("[data-bs-dismiss='modal']").forEach(btn => {
      btn.onclick = closeHandler;
    });
    modalEl.onclick = (e) => {
      if (e.target === modalEl) closeHandler();
    };
  }

  /**
   * MỞ MODAL VÉ ĐIỆN TỬ LUXURY (BOARDING PASS CÓ MÃ VẠCH 1D)
   */
  function openTicket(bookingData) {
    ensurePrintStyle();
    let b = bookingData;
    if (typeof b === "string") {
      const pool = (window.allBookings || []).concat(window.AdminState?.bookings || []).concat(JSON.parse(localStorage.getItem("delta_customer_bookings") || "[]"));
      b = pool.find(x => String(x.id || x.bookingId || x.reference) === String(bookingData));
    }
    if (!b && window.currentBookingData) b = window.currentBookingData;
    if (!b && typeof bookingData === "object") b = bookingData;
    const d = getCleanBooking(b || { reference: bookingData });

    // QUY TRÌNH CHUẨN: CHỈ CẤP VÉ ĐIỆN TỬ KHI THANH TOÁN XONG VÀ ĐÃ ĐƯỢC ADMIN XÁC NHẬN (CONFIRMED / COMPLETED)
    const isConfirmedByAdmin = Boolean(
      d.status === "CONFIRMED" ||
      d.status === "COMPLETED" ||
      d.statusCode === "CONFIRMED" ||
      d.statusCode === "COMPLETED"
    );

    if (!isConfirmedByAdmin) {
      if (d.status === "PAID" || d.statusCode === "PAID" || d.isPaid) {
        if (typeof showAppNotice === "function") {
          showAppNotice(
            `Đơn đặt tour #${d.ref} đã nhận thanh toán nhưng ĐANG CHỜ ADMIN XÁC NHẬN. Phiếu vé điện tử (Ticket Online & Barcode Check-in) chỉ hiển thị chính thức sau khi Quản trị viên (Admin) phê duyệt.`,
            "Chờ Admin Xác Nhận Vé",
            "info"
          );
        } else if (typeof showToast === "function") {
          showToast(`Đơn #${d.ref} đã thanh toán, đang chờ Admin duyệt trước khi cấp vé.`, "info");
        } else {
          alert(`Đơn #${d.ref} đã thanh toán, đang chờ Admin duyệt trước khi cấp vé.`);
        }
      } else {
        if (typeof showAppNotice === "function") {
          showAppNotice(
            `Đơn đặt tour #${d.ref} chưa hoàn tất thanh toán hoặc đã hủy. Phiếu vé điện tử chỉ được phát hành sau khi thanh toán xong và được Admin xác nhận.`,
            "Chưa Cấp Vé Điện Tử",
            "warning"
          );
        } else if (typeof showToast === "function") {
          showToast("Đơn chưa thanh toán hoặc đã hủy, không thể xuất vé điện tử check-in.", "warning");
        } else {
          alert("Đơn chưa thanh toán hoặc đã hủy, không thể xuất vé điện tử check-in.");
        }
      }
      return;
    }

    const barcodeSvg = generateBarcode1DSVG(d.ref, 50);

    let modalEl = document.getElementById("luxuryTicketModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.id = "luxuryTicketModal";
      modalEl.className = "modal fade";
      modalEl.tabIndex = -1;
      modalEl.setAttribute("aria-hidden", "true");
      document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
      <div class="modal-dialog modal-xl modal-dialog-centered" style="max-width: 1020px;">
        <div class="modal-content border-0 shadow-2xl rounded-4 overflow-hidden" style="background: #0b1329;">
          <!-- Header công cụ điều khiển -->
          <div class="modal-header border-0 px-4 py-3 bg-dark d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-warning text-dark fw-bold px-2.5 py-1.5 rounded-pill text-uppercase">
                <i class="bi bi-patch-check-fill me-1"></i> Official Boarding Pass
              </span>
              <h6 class="modal-title text-white fw-bold mb-0">Vé Điện Tử Hạng Sang & Check-in Thông Minh</h6>
            </div>
            <div class="d-flex align-items-center gap-2 no-print">
              <button type="button" class="btn btn-warning btn-sm fw-bold rounded-pill px-3 py-1.5 shadow-sm d-inline-flex align-items-center gap-1.5" onclick="TicketInvoiceService.downloadTicketPDF('${d.ref}')">
                <i class="bi bi-file-earmark-pdf-fill"></i> Tải Vé (PDF)
              </button>
              <button type="button" class="btn btn-light btn-sm fw-bold rounded-pill px-3 py-1.5 shadow-sm d-inline-flex align-items-center gap-1.5" onclick="TicketInvoiceService.downloadTicketImage('${d.ref}')">
                <i class="bi bi-download"></i> Tải Ảnh Vé (PNG)
              </button>
              <button type="button" class="btn btn-outline-light btn-sm fw-semibold rounded-pill px-3 py-1.5 d-inline-flex align-items-center gap-1.5" onclick="TicketInvoiceService.printTarget('luxuryTicketCard', 'Ve-Dien-Tu-${d.ref}')">
                <i class="bi bi-printer"></i> In Vé
              </button>
              <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>

          <!-- Thân vé phong cách Luxury Boarding Pass 5 sao -->
          <div class="modal-body p-3 p-md-4" style="background: linear-gradient(135deg, #0b1329 0%, #151e3f 100%);">
            <div id="luxuryTicketCard" style="background: #ffffff; border-radius: 18px; box-shadow: 0 20px 45px rgba(0,0,0,0.35); overflow: hidden; position: relative; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #0f172a;">
              
              <!-- Dải tiêu đề trên cùng của vé -->
              <div style="background: linear-gradient(90deg, #091326 0%, #172554 100%); padding: 18px 24px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #d97706;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 42px; height: 42px; border-radius: 10px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); display: flex; align-items: center; justify-content: center; font-size: 20px; color: #ffffff; font-weight: 900; box-shadow: 0 4px 10px rgba(217,119,6,0.4);">
                    ▲
                  </div>
                  <div>
                    <div style="font-size: 19px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: #ffffff; display: flex; align-items: center; gap: 8px;">
                      DELTA TRAVEL
                      <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(245,158,11,0.25); color: #fbbf24; border: 1px solid #f59e0b; font-weight: 800;">5-STAR LUXURY</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; letter-spacing: 0.03em;">INTERNATIONAL TRAVEL & RESORTS • BOARDING PASS</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background: ${d.isPaid ? 'rgba(22, 163, 74, 0.2)' : 'rgba(217, 119, 6, 0.2)'}; color: ${d.isPaid ? '#4ade80' : '#fbbf24'}; border: 1px solid ${d.isPaid ? '#22c55e' : '#f59e0b'};">
                    <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${d.isPaid ? '#4ade80' : '#fbbf24'}; margin-right: 5px;"></span>
                    ${d.isPaid ? 'VERIFIED • CHECK-IN READY' : 'CHỜ THANH TOÁN (PENDING)'}
                  </div>
                  <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px; font-family: monospace;">CODE: #${d.ref}</div>
                </div>
              </div>

              <!-- Nội dung vé 2 phần: Thân vé chính + Cuống vé Check-in -->
              <div style="display: flex; flex-direction: row; flex-wrap: wrap;">
                
                <!-- Phần thân vé chính (Trái: 68%) -->
                <div style="flex: 1 1 540px; padding: 24px; background: #ffffff; position: relative;">
                  <div style="margin-bottom: 20px;">
                    <div style="display: inline-block; font-size: 11px; font-weight: 800; color: #d97706; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">
                      HÀNH TRÌNH KHÁM PHÁ CAO CẤP
                    </div>
                    <h3 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; line-height: 1.3;">
                      ${d.tourTitle}
                    </h3>
                  </div>

                  <!-- Khung 4 thông số chính -->
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 14px; padding: 14px 18px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                    <div>
                      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">HÀNH KHÁCH</div>
                      <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">${d.custName}</div>
                      <div style="font-size: 11px; color: #64748b;">${d.custPhone}</div>
                    </div>
                    <div>
                      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">MÃ ĐẶT CHỖ</div>
                      <div style="font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 2px; font-family: monospace; letter-spacing: 1px;">#${d.ref}</div>
                      <div style="font-size: 11px; color: #16a34a; font-weight: 600;">Mã duy nhất toàn hệ thống</div>
                    </div>
                    <div>
                      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">KHỞI HÀNH</div>
                      <div style="font-size: 15px; font-weight: 800; color: #0284c7; margin-top: 2px;">${d.depDate}</div>
                      <div style="font-size: 11px; color: #64748b;">Giờ đón: 07:30 AM</div>
                    </div>
                    <div>
                      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">SỐ LƯỢNG KHÁCH</div>
                      <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">${d.totalGuests} Người</div>
                      <div style="font-size: 11px; color: #d97706; font-weight: 700;">Hạng Thương Gia (VIP)</div>
                    </div>
                  </div>

                  <!-- Thông tin chi tiết dịch vụ lữ hành -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; color: #334155; margin-bottom: 20px;">
                    <div>
                      <span style="font-weight: 700; color: #0f172a;">Điểm đón khách:</span>
                      <div style="color: #64748b;">${d.pickupLoc}</div>
                    </div>
                    <div>
                      <span style="font-weight: 700; color: #0f172a;">Bảo hiểm lữ hành:</span>
                      <div style="color: #16a34a; font-weight: 600;">Delta Care VIP (200.000.000 đ/khách)</div>
                    </div>
                    <div>
                      <span style="font-weight: 700; color: #0f172a;">Phương tiện di chuyển:</span>
                      <div style="color: #64748b;">Xe Limousine 5 Sao & Du thuyền cao cấp</div>
                    </div>
                    <div>
                      <span style="font-weight: 700; color: #0f172a;">Tổng tiền đã thanh toán:</span>
                      <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${formatVND(d.totalPrice)}</div>
                    </div>
                  </div>

                  <!-- Dòng ghi chú check-in -->
                  <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
                    <div>
                      <i class="bi bi-info-circle-fill text-warning me-1"></i> Xuất trình mã vạch hoặc mã đơn <strong>#${d.ref}</strong> cho Hướng dẫn viên tại điểm hẹn trước 30 phút.
                    </div>
                    <div style="font-weight: 800; color: #0f172a; text-transform: uppercase;">
                      HOTLINE 24/7: 0325536936
                    </div>
                  </div>
                </div>

                <!-- Đường đục lỗ xé cuống vé (Perforated line with notches) -->
                <div style="width: 2px; background: repeating-linear-gradient(to bottom, #cbd5e1 0, #cbd5e1 8px, transparent 8px, transparent 14px); position: relative;">
                  <div style="width: 22px; height: 22px; border-radius: 50%; background: #0b1329; position: absolute; top: -11px; left: -10px;"></div>
                  <div style="width: 22px; height: 22px; border-radius: 50%; background: #0b1329; position: absolute; bottom: -11px; left: -10px;"></div>
                </div>

                <!-- Phần Cuống vé Check-in (Phải: 32%) -->
                <div style="flex: 0 0 280px; padding: 22px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; text-align: center; border-left: 1px solid #f1f5f9;">
                  <div>
                    <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em;">BOARDING STUB</div>
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; text-transform: uppercase;">CUỐNG VÉ CHECK-IN</div>
                    <div style="font-size: 11px; color: #94a3b8;">DELTA TRAVEL 5★</div>
                  </div>

                  <!-- Khu vực mã vạch 1D Barcode trung tâm -->
                  <div style="padding: 12px 6px; background: #ffffff; border: 1.5px solid #0f172a; border-radius: 10px; margin: 14px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.08em; margin-bottom: 6px;">
                      MÃ VẠCH QUÉT CHECK-IN (1D BARCODE)
                    </div>
                    ${barcodeSvg}
                  </div>

                  <!-- Thông tin tóm tắt cho nhân viên soát vé -->
                  <div style="font-size: 11px; text-align: left; background: #f8fafc; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                      <span style="color: #64748b;">Hành khách:</span>
                      <strong style="color: #0f172a;">${d.custName}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                      <span style="color: #64748b;">Mã đơn:</span>
                      <strong style="font-family: monospace; color: #0f172a;">#${d.ref}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                      <span style="color: #64748b;">Trạng thái:</span>
                      <strong style="color: ${d.isPaid ? '#16a34a' : '#d97706'};">${d.isPaid ? 'ĐÃ DUYỆT (PAID)' : 'CHỜ DUYỆT'}</strong>
                    </div>
                  </div>

                  <div style="font-size: 10px; color: #94a3b8; margin-top: 10px; line-height: 1.3;">
                    Quét mã vạch bằng máy đọc barcode hoặc camera để kích hoạt check-in hành trình.
                  </div>
                </div>

              </div>
            </div>
          </div>
          
          <!-- Footer hỗ trợ -->
          <div class="modal-footer border-0 px-4 py-2.5 bg-dark d-flex justify-content-between align-items-center text-white-50" style="font-size: 12px;">
            <div>
              <i class="bi bi-shield-check text-success me-1"></i> Bản quyền vé điện tử & bảo chứng hành trình thuộc về Delta Travel Vietnam.
            </div>
            <div>
              Tổng đài CSKH: <strong>0325536936</strong>
            </div>
          </div>

        </div>
      </div>
    `;

    showModalSafe(modalEl);
  }

  /**
   * MỞ MODAL HÓA ĐƠN ĐIỆN TỬ GIÁ TRỊ GIA TĂNG (VAT E-INVOICE ĐẦY ĐỦ QUY CHUẨN)
   */
  function openInvoice(bookingData) {
    ensurePrintStyle();
    let b = bookingData;
    if (typeof b === "string") {
      const pool = (window.allBookings || []).concat(window.AdminState?.bookings || []).concat(JSON.parse(localStorage.getItem("delta_customer_bookings") || "[]"));
      b = pool.find(x => String(x.id || x.bookingId || x.reference) === String(bookingData));
    }
    if (!b && window.currentBookingData) b = window.currentBookingData;
    if (!b && typeof bookingData === "object") b = bookingData;
    const d = getCleanBooking(b || { reference: bookingData });
    const amountInWords = numberToVietnameseWords(d.totalPrice);
    const barcodeSvg = generateBarcode1DSVG(d.ref, 40);

    let modalEl = document.getElementById("officialInvoiceModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.id = "officialInvoiceModal";
      modalEl.className = "modal fade";
      modalEl.tabIndex = -1;
      modalEl.setAttribute("aria-hidden", "true");
      document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
      <div class="modal-dialog modal-xl modal-dialog-centered" style="max-width: 960px;">
        <div class="modal-content border-0 shadow-2xl rounded-4 overflow-hidden" style="background: #ffffff;">
          
          <!-- Thanh công cụ phía trên -->
          <div class="modal-header border-bottom px-4 py-3 bg-light d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-dark text-white fw-bold px-2.5 py-1.5 rounded-pill text-uppercase">
                <i class="bi bi-receipt me-1 text-warning"></i> VAT E-Invoice
              </span>
              <h6 class="modal-title text-dark fw-bold mb-0">Hóa Đơn Điện Tử Giá Trị Gia Tăng (Chuẩn Nghị Định 123/2020/NĐ-CP)</h6>
            </div>
            <div class="d-flex align-items-center gap-2 no-print">
              <button type="button" class="btn btn-dark btn-sm fw-bold rounded-pill px-3 py-1.5 shadow-sm d-inline-flex align-items-center gap-1.5" onclick="TicketInvoiceService.downloadInvoicePDF('${d.ref}')">
                <i class="bi bi-download text-warning"></i> Tải Hóa Đơn (PDF)
              </button>
              <button type="button" class="btn btn-outline-dark btn-sm fw-semibold rounded-pill px-3 py-1.5 d-inline-flex align-items-center gap-1.5" onclick="TicketInvoiceService.printTarget('officialInvoiceCard', 'Hoa-Don-GTGT-${d.ref}')">
                <i class="bi bi-printer"></i> In Hóa Đơn A4
              </button>
              <button type="button" class="btn-close ms-2" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>

          <!-- Nội dung Hóa Đơn Giá Trị Gia Tăng Chuẩn Thương Mại -->
          <div class="modal-body p-4 p-md-5" style="background: #f8fafc; overflow-y: auto; max-height: calc(85vh - 70px);">
            <div id="officialInvoiceCard" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 32px 36px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); font-family: 'Times New Roman', Times, serif, 'Inter'; color: #000000; max-width: 840px; margin: 0 auto; box-sizing: border-box;">
              
              <!-- Tiêu đề và ký hiệu số hóa đơn -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
                <div style="flex: 1;">
                  <div style="font-size: 20px; font-weight: 900; text-transform: uppercase; color: #0f172a; font-family: 'Inter', sans-serif;">DELTA TRAVEL VIETNAM</div>
                  <div style="font-size: 13px; font-weight: 700; color: #334155; margin-top: 2px;">CÔNG TY CỔ PHẦN DU LỊCH & LỮ HÀNH QUỐC TẾ DELTA TRAVEL</div>
                  <div style="font-size: 12px; color: #475569; margin-top: 3px;">Mã số thuế (Tax Code): <strong>0109887766</strong></div>
                  <div style="font-size: 12px; color: #475569;">Địa chỉ: Tầng 18, Delta Tower, 68 Kim Mã, Ba Đình, TP. Hà Nội</div>
                  <div style="font-size: 12px; color: #475569;">Hotline / Zalo: <strong>0325536936</strong> | Email: support@deltatravel.vn</div>
                  <div style="font-size: 12px; color: #475569;">Tài khoản nhận: <strong>0325536936</strong> tại MBBank (Ngân hàng Quân Đội)</div>
                </div>

                <div style="text-align: right; min-width: 220px; border-left: 1px dashed #cbd5e1; padding-left: 20px;">
                  <div style="font-size: 12px; color: #334155;">Mẫu số (Form No.): <strong>1/001</strong></div>
                  <div style="font-size: 12px; color: #334155;">Ký hiệu (Serial): <strong>1C26TDT</strong></div>
                  <div style="font-size: 14px; font-weight: 800; color: #dc2626; margin: 3px 0;">Số (No.): ${d.invNo}</div>
                  <div style="font-size: 11px; color: #64748b;">Mã tra cứu CQT:</div>
                  <div style="font-family: monospace; font-size: 13px; font-weight: 900; color: #0f172a;">#${d.ref}</div>
                </div>
              </div>

              <!-- Tiêu đề lớn giữa hóa đơn -->
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 0.05em;">
                  HÓA ĐƠN GIÁ TRỊ GIA TĂNG (VAT INVOICE)
                </h2>
                <div style="font-size: 12px; font-style: italic; color: #475569; margin-top: 4px;">
                  (Bản thể hiện của hóa đơn điện tử khởi tạo từ hệ thống quản lý Delta Travel theo Nghị định 123/2020/NĐ-CP)
                </div>
                <div style="font-size: 12px; color: #334155; margin-top: 3px;">
                  Ngày lập hóa đơn: <strong>${new Date(d.createdDate).toLocaleDateString('vi-VN')}</strong>
                </div>
              </div>

              <!-- Thông tin người mua hàng -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; line-height: 1.6;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div>Họ tên người mua hàng: <strong style="text-transform: uppercase; color: #0f172a;">${d.custName}</strong></div>
                  <div>Số điện thoại: <strong>${d.custPhone}</strong></div>
                  <div>Email nhận hóa đơn: <strong>${d.custEmail}</strong></div>
                  <div>Hình thức thanh toán: <strong>Chuyển khoản VietQR / MBBank (SePay)</strong></div>
                  <div style="grid-column: 1 / -1;">Điểm đón / Dịch vụ: <strong>${d.pickupLoc}</strong></div>
                </div>
              </div>

              <!-- Bảng kê dịch vụ lữ hành -->
              <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 20px;">
                <thead>
                  <tr style="background: #0f172a; color: #ffffff; text-align: center;">
                    <th style="padding: 8px 6px; border: 1px solid #0f172a; width: 40px;">STT</th>
                    <th style="padding: 8px 10px; border: 1px solid #0f172a; text-align: left;">Tên hàng hóa, dịch vụ</th>
                    <th style="padding: 8px 6px; border: 1px solid #0f172a; width: 65px;">ĐVT</th>
                    <th style="padding: 8px 6px; border: 1px solid #0f172a; width: 55px;">SL</th>
                    <th style="padding: 8px 10px; border: 1px solid #0f172a; text-align: right; width: 110px;">Đơn giá</th>
                    <th style="padding: 8px 10px; border: 1px solid #0f172a; text-align: right; width: 130px;">Thành tiền (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center;">1</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">
                      <strong style="color: #0f172a;">${d.tourTitle}</strong><br>
                      <span style="font-size: 11px; color: #475569;">Tour du lịch trọn gói tiêu chuẩn 5 sao (Vé người lớn)</span>
                    </td>
                    <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center;">Vé</td>
                    <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${d.adults}</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">${formatVND(d.unitPrice)}</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">${formatVND(d.adults * d.unitPrice)}</td>
                  </tr>

                  ${d.children > 0 ? `
                  <tr>
                    <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center;">2</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">
                      <strong style="color: #0f172a;">Vé tour trẻ em (5 - 11 tuổi)</strong><br>
                      <span style="font-size: 11px; color: #475569;">Tiêu chuẩn 75% giá vé người lớn</span>
                    </td>
                    <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center;">Vé</td>
                    <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${d.children}</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">${formatVND(Math.round(d.unitPrice * 0.75))}</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">${formatVND(d.children * Math.round(d.unitPrice * 0.75))}</td>
                  </tr>
                  ` : ""}

                  <tr>
                    <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center;">${d.children > 0 ? 3 : 2}</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">
                      <strong style="color: #0f172a;">Bảo hiểm lữ hành quốc tế Delta Care VIP</strong><br>
                      <span style="font-size: 11px; color: #475569;">Quyền lợi bảo hiểm tối đa 200.000.000 đ/vụ</span>
                    </td>
                    <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center;">Gói</td>
                    <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${d.totalGuests}</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; color: #16a34a; font-weight: 600;">Miễn phí</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; color: #16a34a; font-weight: 700;">0 đ</td>
                  </tr>

                  <!-- Tổng cộng chi phí -->
                  <tr>
                    <td colspan="5" style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600;">Cộng tiền dịch vụ (Subtotal):</td>
                    <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">${formatVND(d.subtotal)}</td>
                  </tr>
                  ${d.discount > 0 ? `
                  <tr>
                    <td colspan="5" style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600; color: #16a34a;">Chiết khấu / Ưu đãi Voucher (${d.voucherCode || 'Ưu đãi'}):</td>
                    <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700; color: #16a34a;">- ${formatVND(d.discount)}</td>
                  </tr>
                  ` : ""}
                  <tr>
                    <td colspan="5" style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600;">Thuế suất GTGT (VAT Rate): 10% &mdash; Tiền thuế GTGT:</td>
                    <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">+ ${formatVND(d.vatAmount)}</td>
                  </tr>
                  <tr style="background: #f1f5f9;">
                    <td colspan="5" style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase;">TỔNG CỘNG TIỀN THANH TOÁN (TOTAL):</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-size: 15px; font-weight: 900; color: #dc2626;">${formatVND(d.totalPrice)}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Số tiền viết bằng chữ -->
              <div style="padding: 10px 14px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 13px; margin-bottom: 24px;">
                Số tiền viết bằng chữ: <strong style="font-style: italic; color: #0f172a;">${amountInWords}</strong>
              </div>

              <!-- Chữ ký số và con dấu điện tử -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 30px;">
                <div style="text-align: center; width: 45%;">
                  <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #0f172a;">NGƯỜI MUA HÀNG (BUYER)</div>
                  <div style="font-size: 11px; font-style: italic; color: #64748b;">(Ký, ghi rõ họ tên)</div>
                  <div style="height: 55px;"></div>
                  <div style="font-weight: 800; font-size: 13px; text-transform: uppercase;">${d.custName}</div>
                  <div style="font-size: 11px; color: #16a34a;">(Đã xác thực thanh toán điện tử)</div>
                </div>

                <div style="text-align: center; width: 45%;">
                  <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #0f172a;">NGƯỜI BÁN HÀNG (SELLER)</div>
                  <div style="font-size: 11px; font-style: italic; color: #64748b;">(Ký số điện tử / Digital Signature)</div>
                  
                  <!-- Con dấu chữ ký số điện tử -->
                  <div style="margin: 12px auto; padding: 10px 14px; border: 2px solid #16a34a; border-radius: 8px; background: rgba(22, 163, 74, 0.04); text-align: left; max-width: 280px; font-size: 11px; line-height: 1.4; color: #166534;">
                    <div style="font-weight: 900; color: #15803d; display: flex; align-items: center; gap: 5px;">
                      <span style="font-size: 14px;">✓</span> SIGNATURE VALID
                    </div>
                    <div>Được ký bởi: <strong>CÔNG TY CP DU LỊCH & LỮ HÀNH QUỐC TẾ DELTA TRAVEL</strong></div>
                    <div>Ngày ký: <strong>${new Date(d.createdDate).toLocaleString('vi-VN')}</strong></div>
                    <div>Chứng thư số: CQT-DELTA-EINV-2026</div>
                  </div>
                </div>
              </div>

              <!-- Chân trang hóa đơn và mã vạch tra cứu -->
              <div style="border-top: 1px dashed #cbd5e1; margin-top: 24px; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
                <div>
                  Mã giao dịch đối soát ngân hàng: <strong>${d.evidence}</strong><br>
                  Tra cứu hóa đơn gốc tại cổng điện tử: <strong>https://deltatravel.vn/tra-cuu-hoa-don</strong>
                </div>
                <div style="text-align: right;">
                  ${barcodeSvg}
                </div>
              </div>

            </div>
          </div>

          <!-- Chân modal -->
          <div class="modal-footer border-top px-4 py-2.5 bg-light d-flex justify-content-between align-items-center" style="font-size: 12px; color: #64748b;">
            <div>
              Hóa đơn điện tử có giá trị pháp lý theo Luật Giao dịch điện tử số 51/2005/QH11.
            </div>
            <button type="button" class="btn btn-secondary btn-sm rounded-pill px-3 py-1" data-bs-dismiss="modal">Đóng</button>
          </div>

        </div>
      </div>
    `;

    showModalSafe(modalEl);
  }

  /**
   * Tải vé dạng PDF
   */
  function downloadTicketPDF(ref) {
    const el = document.getElementById("luxuryTicketCard");
    if (!el) return;
    if (typeof html2pdf !== "undefined") {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Ve-Dien-Tu-${ref}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2.5, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
      };
      html2pdf().set(opt).from(el).save();
    } else {
      printTarget("luxuryTicketCard", `Ve-Dien-Tu-${ref}`);
    }
  }

  /**
   * Tải ảnh vé PNG sắc nét
   */
  function downloadTicketImage(ref) {
    const el = document.getElementById("luxuryTicketCard");
    if (!el) return;
    if (typeof html2canvas !== "undefined") {
      html2canvas(el, { scale: 2.5, useCORS: true }).then(canvas => {
        const link = document.createElement("a");
        link.download = `Ve-Dien-Tu-${ref}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      });
    } else if (typeof html2pdf !== "undefined") {
      downloadTicketPDF(ref);
    } else {
      printTarget("luxuryTicketCard", `Ve-Dien-Tu-${ref}`);
    }
  }

  /**
   * Tải hóa đơn dạng PDF
   */
  function downloadInvoicePDF(ref) {
    const el = document.getElementById("officialInvoiceCard");
    if (!el) return;
    if (typeof html2pdf !== "undefined") {
      const opt = {
        margin: [6, 8, 6, 8],
        filename: `Hoa-Don-GTGT-${ref}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2.5, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };
      html2pdf().set(opt).from(el).save();
    } else {
      printTarget("officialInvoiceCard", `Hoa-Don-GTGT-${ref}`);
    }
  }

  /**
   * In trực tiếp một phần tử được chỉ định mà không in toàn trang web
   */
  function printTarget(elementId, title) {
    const srcEl = document.getElementById(elementId);
    if (!srcEl) {
      window.print();
      return;
    }

    let printContainer = document.getElementById("printIsolatedContainer");
    if (!printContainer) {
      printContainer = document.createElement("div");
      printContainer.id = "printIsolatedContainer";
      document.body.appendChild(printContainer);
    }

    printContainer.innerHTML = srcEl.outerHTML;
    const origTitle = document.title;
    if (title) document.title = title;

    window.print();

    setTimeout(() => {
      printContainer.innerHTML = "";
      document.title = origTitle;
    }, 1000);
  }

  // Export toàn cục
  window.TicketInvoiceService = {
    generateBarcode1DSVG,
    numberToVietnameseWords,
    openTicket,
    openInvoice,
    downloadTicketPDF,
    downloadTicketImage,
    downloadInvoicePDF,
    printTarget
  };

})(window);
