/**
 * DELTA TRAVEL - GOOGLE MINIMAL LUXURY DIALOG SYSTEM (app-dialogs.js)
 * Thay thế 100% hộp thoại alert() và confirm() mặc định xấu xí của trình duyệt.
 * Thiết kế chuẩn Google Minimal: Nền trắng tinh khiết, chữ đen, typography sang trọng,
 * icon biểu cảm tinh tế và animation mượt mà chuẩn Google Standard Easing.
 */

(function (window, document) {
  'use strict';

  // Chèn CSS tự động nếu chưa có
  function injectDialogStyles() {
    if (document.getElementById('delta-app-dialogs-css')) return;
    const style = document.createElement('style');
    style.id = 'delta-app-dialogs-css';
    style.textContent = `
      .app-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .app-modal-overlay.active {
        opacity: 1;
        pointer-events: auto;
      }
      .app-modal-card {
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #e2e8f0;
        border-radius: 22px;
        padding: 2.25rem 2rem;
        max-width: 440px;
        width: 100%;
        text-align: center;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.03);
        transform: scale(0.92) translateY(8px);
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .app-modal-overlay.active .app-modal-card {
        transform: scale(1) translateY(0);
      }
      .app-modal-icon-wrap {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1.25rem;
        font-size: 2rem;
      }
      .app-modal-icon-success {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
      }
      .app-modal-icon-warning {
        background: #fffbeb;
        color: #d97706;
        border: 1px solid #fde68a;
      }
      .app-modal-icon-danger,
      .app-modal-icon-error {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      .app-modal-icon-info {
        background: #f1f5f9;
        color: #0f172a;
        border: 1px solid #cbd5e1;
      }
      .app-modal-title {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 1.25rem;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 0.65rem 0;
        line-height: 1.3;
      }
      .app-modal-message {
        font-size: 0.95rem;
        color: #475569;
        line-height: 1.6;
        margin: 0 0 1.75rem 0;
        word-break: break-word;
      }
      .app-modal-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        width: 100%;
      }
      .app-modal-btn {
        flex: 1;
        padding: 0.8rem 1.4rem;
        border-radius: 9999px;
        font-size: 0.92rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        border: none;
        outline: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }
      .app-modal-btn:active {
        transform: scale(0.97);
      }
      .app-modal-btn-primary {
        background: #0f172a;
        color: #ffffff;
      }
      .app-modal-btn-primary:hover {
        background: #1e293b;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
      }
      .app-modal-btn-danger {
        background: #dc2626;
        color: #ffffff;
      }
      .app-modal-btn-danger:hover {
        background: #b91c1c;
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
      }
      .app-modal-btn-secondary {
        background: #ffffff;
        color: #475569;
        border: 1.5px solid #cbd5e1;
      }
      .app-modal-btn-secondary:hover {
        background: #f8fafc;
        border-color: #94a3b8;
        color: #0f172a;
      }

      /* Non-blocking Toast Alerts */
      .app-toast-container {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 10000000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
        max-width: 380px;
        width: 100%;
      }
      .app-toast-item {
        pointer-events: auto;
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 0.9rem 1.15rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.9rem;
        font-weight: 600;
        animation: appToastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition: all 0.25s ease;
      }
      .app-toast-item.hide {
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
      }
      @keyframes appToastIn {
        from { opacity: 0; transform: translateY(-12px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  // Khởi tạo container DOM
  let modalOverlay = null;
  let toastContainer = null;

  function ensureModalDOM() {
    injectDialogStyles();
    if (!modalOverlay) {
      modalOverlay = document.createElement('div');
      modalOverlay.className = 'app-modal-overlay';
      modalOverlay.innerHTML = `
        <div class="app-modal-card" role="dialog" aria-modal="true">
          <div class="app-modal-icon-wrap" id="appModalIcon"></div>
          <h4 class="app-modal-title" id="appModalTitle">Thông Báo</h4>
          <div class="app-modal-message" id="appModalMessage"></div>
          <div class="app-modal-actions" id="appModalActions"></div>
        </div>
      `;
      document.body.appendChild(modalOverlay);
    }
  }

  function ensureToastContainer() {
    injectDialogStyles();
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'app-toast-container';
      document.body.appendChild(toastContainer);
    }
  }

  /**
   * Hiển thị thông báo sang trọng Google Minimal (Thay thế alert)
   * @param {string} message - Nội dung thông báo
   * @param {string} title - Tiêu đề thông báo
   * @param {string} type - "info" | "success" | "warning" | "danger" | "error"
   * @param {string} btnText - Nhãn nút (Mặc định: "Đã hiểu" / "Got it")
   * @returns {Promise<void>}
   */
  function showAppNotice(message, title, type = 'warning', btnText) {
    return new Promise((resolve) => {
      ensureModalDOM();

      const isEn = typeof window.getAppLanguage === 'function' && window.getAppLanguage() === 'en';
      const defaultTitle = isEn ? 'Notice' : 'Thông Báo';
      const defaultBtn = isEn ? 'Got it' : 'Đã hiểu';

      const iconEl = modalOverlay.querySelector('#appModalIcon');
      const titleEl = modalOverlay.querySelector('#appModalTitle');
      const msgEl = modalOverlay.querySelector('#appModalMessage');
      const actionsEl = modalOverlay.querySelector('#appModalActions');

      titleEl.textContent = title || defaultTitle;
      msgEl.textContent = message || '';

      // Thiết lập Icon
      iconEl.className = 'app-modal-icon-wrap';
      if (type === 'success') {
        iconEl.classList.add('app-modal-icon-success');
        iconEl.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
      } else if (type === 'danger' || type === 'error') {
        iconEl.classList.add('app-modal-icon-danger');
        iconEl.innerHTML = '<i class="bi bi-x-circle-fill"></i>';
      } else if (type === 'info') {
        iconEl.classList.add('app-modal-icon-info');
        iconEl.innerHTML = '<i class="bi bi-info-circle-fill"></i>';
      } else {
        iconEl.classList.add('app-modal-icon-warning');
        iconEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i>';
      }

      actionsEl.innerHTML = `
        <button type="button" class="app-modal-btn app-modal-btn-primary" id="appModalPrimaryBtn">
          <span>${btnText || defaultBtn}</span>
        </button>
      `;

      function closeDialog() {
        modalOverlay.classList.remove('active');
        document.removeEventListener('keydown', keyHandler);
        setTimeout(resolve, 200);
      }

      function keyHandler(e) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          closeDialog();
        }
      }

      const btn = actionsEl.querySelector('#appModalPrimaryBtn');
      btn.onclick = closeDialog;
      document.addEventListener('keydown', keyHandler);

      modalOverlay.classList.add('active');
      btn.focus();
    });
  }

  /**
   * Hiển thị hộp thoại xác nhận Google Minimal (Thay thế confirm)
   * @param {string} message - Câu hỏi xác nhận
   * @param {string} title - Tiêu đề hộp thoại
   * @param {Object} options - { confirmText, cancelText, danger, type }
   * @returns {Promise<boolean>}
   */
  function showAppConfirm(message, title, options = {}) {
    return new Promise((resolve) => {
      ensureModalDOM();

      const isEn = typeof window.getAppLanguage === 'function' && window.getAppLanguage() === 'en';
      const defaultTitle = isEn ? 'Confirm Action' : 'Xác Nhận';
      const defaultConfirm = isEn ? 'Confirm' : 'Xác nhận';
      const defaultCancel = isEn ? 'Cancel' : 'Hủy bỏ';

      const iconEl = modalOverlay.querySelector('#appModalIcon');
      const titleEl = modalOverlay.querySelector('#appModalTitle');
      const msgEl = modalOverlay.querySelector('#appModalMessage');
      const actionsEl = modalOverlay.querySelector('#appModalActions');

      titleEl.textContent = title || defaultTitle;
      msgEl.textContent = message || '';

      const isDanger = options.danger || options.type === 'danger';

      iconEl.className = 'app-modal-icon-wrap';
      if (isDanger) {
        iconEl.classList.add('app-modal-icon-danger');
        iconEl.innerHTML = '<i class="bi bi-exclamation-octagon-fill"></i>';
      } else {
        iconEl.classList.add('app-modal-icon-info');
        iconEl.innerHTML = '<i class="bi bi-question-circle-fill"></i>';
      }

      const confirmBtnClass = isDanger ? 'app-modal-btn-danger' : 'app-modal-btn-primary';

      actionsEl.innerHTML = `
        <button type="button" class="app-modal-btn app-modal-btn-secondary" id="appModalCancelBtn">
          <span>${options.cancelText || defaultCancel}</span>
        </button>
        <button type="button" class="app-modal-btn ${confirmBtnClass}" id="appModalConfirmBtn">
          <span>${options.confirmText || defaultConfirm}</span>
        </button>
      `;

      function closeDialog(result) {
        modalOverlay.classList.remove('active');
        document.removeEventListener('keydown', keyHandler);
        setTimeout(() => resolve(result), 200);
      }

      function keyHandler(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeDialog(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          closeDialog(true);
        }
      }

      const cancelBtn = actionsEl.querySelector('#appModalCancelBtn');
      const confirmBtn = actionsEl.querySelector('#appModalConfirmBtn');

      cancelBtn.onclick = () => closeDialog(false);
      confirmBtn.onclick = () => closeDialog(true);
      document.addEventListener('keydown', keyHandler);

      modalOverlay.classList.add('active');
      confirmBtn.focus();
    });
  }

  /**
   * Hiển thị Toast thông báo nhanh (tự động biến mất sau duration)
   */
  function showAppToast(message, type = 'info', duration = 3500) {
    ensureToastContainer();
    const item = document.createElement('div');
    item.className = 'app-toast-item';

    let iconHtml = '<i class="bi bi-info-circle-fill text-primary"></i>';
    if (type === 'success') iconHtml = '<i class="bi bi-check-circle-fill text-success"></i>';
    else if (type === 'error' || type === 'danger') iconHtml = '<i class="bi bi-x-circle-fill text-danger"></i>';
    else if (type === 'warning') iconHtml = '<i class="bi bi-exclamation-triangle-fill text-warning"></i>';

    item.innerHTML = `
      ${iconHtml}
      <span class="flex-grow-1">${message}</span>
      <button type="button" style="background:none;border:none;color:#94a3b8;cursor:pointer;padding:0;font-size:1rem;" onclick="this.parentElement.remove()">
        <i class="bi bi-x"></i>
      </button>
    `;

    toastContainer.appendChild(item);

    setTimeout(() => {
      item.classList.add('hide');
      setTimeout(() => item.remove(), 250);
    }, duration);
  }

  // Ghi đè alert mặc định của trình duyệt để đảm bảo mọi nơi đều sang trọng
  window.alert = function (msg) {
    showAppNotice(String(msg || ''));
  };

  // Xuất API toàn cục
  window.showAppNotice = showAppNotice;
  window.showAppConfirm = showAppConfirm;
  window.showAppToast = showAppToast;

})(window, document);
