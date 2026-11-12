/**
 * DELTA TRAVEL - VIETQR HIGH PERFORMANCE PAYMENT SERVICE
 * ======================================================
 * Tích hợp chuẩn thanh toán VietQR NAPAS 247 tối ưu hiệu năng cao nhất.
 * Tham chiếu chuẩn: https://vietqr.vn/qr-create
 * 
 * CẤU HÌNH NGÂN HÀNG THỤ HƯỞNG CHÍNH THỨC:
 * - Ngân hàng: MBBank (Ngân hàng TMCP Quân Đội)
 * - Mã định danh BIN: 970422 / Mã NH: MB
 * - Số tài khoản: 0325536936
 * - Tên chủ tài khoản: LE VAN AN
 * - Nội dung chuyển khoản: Tự động trích xuất [MÃ TOUR] + [ID TÀI KHOẢN / MÃ ĐẶT TOUR]
 */

const VietQRService = (() => {
  "use strict";

  // Cấu hình ngân hàng mặc định
  const CONFIG = {
    bankId: "MB",
    bankBin: "970422",
    bankName: "MBBank (Ngân hàng TMCP Quân Đội)",
    accountNo: "0325536936",
    accountName: "LE VAN AN",
    defaultTemplate: "compact2", // Template chuẩn: Logo Napas247 + MBBank + QR + Chi tiết tài khoản
    quickLinkBase: "https://img.vietqr.io/image",
    apiGenerateUrl: "https://api.vietqr.io/v2/generate"
  };

  // Memory Cache để tăng tốc độ phản hồi 0ms
  const urlCache = new Map();

  /**
   * Chuẩn hóa chuỗi text sang chuẩn ASCII in hoa không dấu
   * Phù hợp quy chuẩn chuyển khoản ngân hàng NAPAS 247
   */
  function sanitizeTransferText(str) {
    if (!str) return "";
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "D")
      .replace(/[^a-zA-Z0-9-_\s]/g, "")
      .trim()
      .toUpperCase();
  }

  /**
   * Tự động sinh nội dung chuyển khoản thông minh:
   * Kết hợp [MÃ TOUR] và [ID TÀI KHOẢN / MÃ ĐƠN ĐẶT TOUR]
   * Ví dụ:
   * - Tour DL-HL01, User USR-01, Booking BK722879 => "DL-HL01 USR-01 BK722879"
   * - Tour DL-CB09, Booking BK4556291778          => "DL-CB09 BK4556291778"
   * - Tour DL-DN02, User USR-01                   => "DL-DN02 USR-01"
   */
  function generateTransferContent(tourId, bookingId, userId) {
    let cleanTour = sanitizeTransferText(tourId || "TOUR");
    if (!cleanTour || cleanTour === "DEFAULT") cleanTour = "DELTA";

    // Trích xuất User ID từ tham số hoặc auth session
    let cleanUser = "";
    if (userId) {
      cleanUser = sanitizeTransferText(userId);
    } else {
      try {
        const authUser = JSON.parse(localStorage.getItem("delta_auth_user") || "null");
        if (authUser && (authUser.id || authUser.maNguoiDung || authUser.username)) {
          cleanUser = sanitizeTransferText(authUser.id || authUser.maNguoiDung || authUser.username);
        }
      } catch (_) {}
    }

    let cleanBooking = "";
    if (bookingId) {
      cleanBooking = sanitizeTransferText(bookingId);
      // Rút gọn nếu ID là UUID dài
      if (cleanBooking.includes("-") && cleanBooking.length > 18) {
        const parts = cleanBooking.split("-");
        cleanBooking = "BK" + parts[parts.length - 1];
      }
    }

    let content = "";
    if (cleanUser && cleanBooking) {
      // Ưu tiên: [MÃ TOUR] [USER_ID] [MÃ_ĐƠN]
      content = `${cleanTour} ${cleanUser} ${cleanBooking}`;
    } else if (cleanBooking) {
      content = `${cleanTour} ${cleanBooking}`;
    } else if (cleanUser) {
      content = `${cleanTour} ${cleanUser}`;
    } else {
      content = `${cleanTour} DATTOUR`;
    }

    // Giới hạn tối đa 30 ký tự theo chuẩn VietQR NAPAS 247
    if (content.length > 30) {
      content = content.substring(0, 30).trim();
    }
    return content;
  }

  /**
   * Tạo URL ảnh VietQR Quick Link (Tối ưu hiệu năng cao nhất qua Cloudflare CDN)
   * Phản hồi < 50ms, không tốn tài nguyên server
   */
  function getQuickLinkUrl(options = {}) {
    const amount = Math.max(0, Math.round(Number(options.amount || 0)));
    const memo = options.memo || generateTransferContent(options.tourId, options.bookingId, options.userId);
    const template = options.template || CONFIG.defaultTemplate;
    const accountNo = options.accountNo || CONFIG.accountNo;
    const bankBin = options.bankBin || CONFIG.bankBin;
    const accountName = options.accountName || CONFIG.accountName;

    const cacheKey = `${bankBin}_${accountNo}_${template}_${amount}_${memo}`;
    if (urlCache.has(cacheKey)) {
      return urlCache.get(cacheKey);
    }

    const params = new URLSearchParams();
    if (amount > 0) params.set("amount", String(amount));
    if (memo) params.set("addInfo", memo);
    if (accountName) params.set("accountName", accountName);

    // Chuẩn URL VietQR Quick Link: https://img.vietqr.io/image/<BANK_BIN>-<ACCOUNT_NO>-<TEMPLATE>.png?...
    const url = `${CONFIG.quickLinkBase}/${bankBin}-${accountNo}-${template}.png?${params.toString()}`;
    
    // Lưu vào cache
    urlCache.set(cacheKey, url);
    return url;
  }

  /**
   * Preload ảnh QR ngầm vào bộ nhớ cache của trình duyệt
   * Giúp ảnh xuất hiện tức thì 0ms khi người dùng nhấn xem thanh toán
   */
  function preloadQR(url) {
    if (!url) return;
    try {
      const img = new Image();
      img.src = url;
    } catch (_) {}
  }

  /**
   * Sao chép nội dung vào Clipboard kèm Toast thông báo Google Minimal mượt mà
   */
  async function copyToClipboard(text, label = "Thông tin") {
    if (!text) return false;
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(String(text));
        success = true;
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = String(text);
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textarea);
      }
    } catch (e) {
      console.warn("Lỗi sao chép:", e);
      success = false;
    }

    showCopyToast(label, text, success);
    return success;
  }

  /**
   * Hiển thị Toast thông báo sao chép phong cách Google Minimal sang trọng
   */
  function showCopyToast(label, text, success) {
    const existing = document.getElementById("vietqrCopyToast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "vietqrCopyToast";
    toast.setAttribute("role", "status");
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #0f172a;
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      pointer-events: none;
    `;

    const icon = success ? `<i class="bi bi-check-circle-fill" style="color: #4ade80;"></i>` : `<i class="bi bi-x-circle-fill" style="color: #f87171;"></i>`;
    const message = success ? `Đã sao chép ${label}: <strong>${text}</strong>` : `Không thể sao chép tự động`;
    toast.innerHTML = `${icon} <span>${message}</span>`;
    document.body.appendChild(toast);

    // Kích hoạt animation xuất hiện
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    });

    // Tự động biến mất sau 2.2 giây
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(10px)";
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  }

  /**
   * Tải ảnh QR Code về thiết bị của người dùng
   */
  async function downloadQR(url, filename = "VietQR_MBBank_0325536936.png") {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (_) {
      // Mở trực tiếp ảnh trong tab mới nếu bị chặn CORS download
      window.open(url, "_blank");
    }
  }

  return {
    CONFIG,
    sanitizeTransferText,
    generateTransferContent,
    getQuickLinkUrl,
    preloadQR,
    copyToClipboard,
    downloadQR
  };
})();

// Gắn toàn cục và xuất module
if (typeof window !== "undefined") {
  window.VietQRService = VietQRService;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = VietQRService;
}
