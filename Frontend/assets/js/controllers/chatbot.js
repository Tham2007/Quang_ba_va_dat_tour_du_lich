/**
 * DELTA TRAVEL - API-backed travel assistant (chatbot.js)
 * -------------------------------------------------------------
 * Chức năng:
 * 1. Gửi câu hỏi đến trợ lý có phạm vi du lịch ở backend.
 * 2. Lưu lịch sử hội thoại trong phiên trình duyệt.
 * 3. Hiển thị trạng thái tải và lỗi kết nối rõ ràng.
 * 4. Định dạng tin nhắn Rich Text (Bold, Bullet, Voucher/Tour Tags).
 */

// =============================================================================
// I. TRẠNG THÁI CHATBOT (STATE & HISTORY)
// =============================================================================
let chatHistory = []; // Lưu trữ lịch sử dạng: [{ role: "user" | "model", parts: [{ text: "..." }] }]
let isChatbotOpen = false;
let isAILoading = false;

// =============================================================================
// II. GỌI TRỢ LÝ TRONG PHẠM VI DU LỊCH Ở BACKEND
// =============================================================================
/**
 * Gửi yêu cầu tới API du lịch để áp dụng cùng một chính sách phạm vi cho mọi UI.
 * @param {string} userMessage - Tin nhắn người dùng nhập vào
 * @returns {Promise<string>} - Nội dung phản hồi từ AI
 */
async function callAIAPI(userMessage) {
  if (typeof DeltaAPI === "undefined" || !DeltaAPI.assistantChat) {
    throw new Error("Dịch vụ tư vấn du lịch chưa sẵn sàng.");
  }
  const result = await DeltaAPI.assistantChat(userMessage);
  if (!result.success || !result.data?.answer) {
    throw new Error(result.error || "Không nhận được phản hồi từ máy chủ.");
  }
  const botReply = result.data.answer;
  chatHistory.push({
    role: "user",
    parts: [{ text: userMessage }]
  });

  chatHistory.push({
    role: "model",
    parts: [{ text: botReply }]
  });

  return botReply;
}

// =============================================================================
// IV. QUẢN LÝ GIAO DIỆN & SỰ KIỆN CHATBOT (UI CONTROLLER)
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initChatbotUI();
});

/**
 * Khởi tạo các sự kiện cho Widget Chatbot
 */
function initChatbotUI() {
  const launcherBtn = document.getElementById("chatbotLauncherBtn");
  const invitePill = document.getElementById("chatbotInvitePill");
  const closeBtn = document.getElementById("chatbotCloseBtn");
  const resetBtn = document.getElementById("chatbotResetBtn");
  const sendBtn = document.getElementById("chatbotSendBtn");
  const chatInput = document.getElementById("chatbotInput");
  const quickReplyBtns = document.querySelectorAll(".quick-reply-btn");

  // Nút mở/đóng chat
  if (launcherBtn) launcherBtn.addEventListener("click", toggleChatbotWindow);
  if (invitePill) invitePill.addEventListener("click", toggleChatbotWindow);
  if (closeBtn) closeBtn.addEventListener("click", () => toggleChatbotWindow(false));

  // Nút xóa đoạn chat làm mới
  if (resetBtn) resetBtn.addEventListener("click", resetChatConversation);

  // Nút gửi tin nhắn
  if (sendBtn) sendBtn.addEventListener("click", handleSendMessage);

  // Bắt phím Enter trong ô input
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  // Các nút gợi ý câu hỏi nhanh (Quick Replies)
  quickReplyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const query = btn.dataset.query || btn.textContent.trim();
      sendQuickReply(query);
    });
  });
}

/**
 * Ẩn / Hiện Cửa sổ Chatbot
 */

function openChatbot() {
  toggleChatbotWindow(true);
}
window.openChatbot = openChatbot;
window.toggleChatbotWindow = toggleChatbotWindow;

function toggleChatbotWindow(forceState) {
  const windowEl = document.getElementById("chatbotWindow");
  const invitePill = document.getElementById("chatbotInvitePill");
  if (!windowEl) return;

  isChatbotOpen = (typeof forceState === "boolean") ? forceState : !isChatbotOpen;

  if (isChatbotOpen) {
    windowEl.classList.remove("hidden");
    if (invitePill) invitePill.style.display = "none";
    setTimeout(() => {
      document.getElementById("chatbotInput")?.focus();
      scrollChatToBottom();
    }, 200);
  } else {
    windowEl.classList.add("hidden");
  }
}

/**
 * Xử lý gửi tin nhắn từ người dùng
 */
async function handleSendMessage() {
  const inputEl = document.getElementById("chatbotInput");
  if (!inputEl || isAILoading) return;

  const messageText = inputEl.value.trim();
  if (!messageText) return;

  // Xóa nội dung trong ô input
  inputEl.value = "";

  // 1. Hiển thị tin nhắn của User lên màn hình
  appendChatMessage("user", messageText);

  // 2. Hiển thị hiệu ứng Loading của AI
  showTypingIndicator();
  isAILoading = true;
  toggleSendButtonState(true);

  try {
    // 3. Gọi trợ lý du lịch nội bộ
    const botResponse = await callAIAPI(messageText);

    // 4. Xóa loading và hiển thị câu trả lời của AI
    hideTypingIndicator();
    appendChatMessage("bot", botResponse);

  } catch (err) {
    hideTypingIndicator();
    console.error("Travel assistant request failed:", err);
    appendChatWarning(
      `Không thể kết nối trợ lý du lịch. Chi tiết: ${err.message || "Lỗi không xác định"}. Vui lòng thử lại sau.`
    );
  } finally {
    isAILoading = false;
    toggleSendButtonState(false);
  }
}

/**
 * Gửi câu hỏi nhanh từ Quick Reply
 */
function sendQuickReply(queryText) {
  const inputEl = document.getElementById("chatbotInput");
  if (inputEl) {
    inputEl.value = queryText;
    handleSendMessage();
  }
}

/**
 * Đính kèm tin nhắn vào khung chat
 * @param {"user" | "bot"} sender - Người gửi
 * @param {string} rawText - Nội dung tin nhắn
 */
function appendChatMessage(sender, rawText) {
  const messagesContainer = document.getElementById("chatbotMessages");
  if (!messagesContainer) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-msg ${sender}`;

  const formattedHtml = (sender === "bot") ? formatAIMessage(rawText) : escapeHTML(rawText);

  const avatarHtml = (sender === "bot")
    ? `<div class="chat-msg-avatar" title="Delta AI"><i class="bi bi-robot"></i></div>`
    : `<div class="chat-msg-avatar" title="Bạn"><i class="bi bi-person-fill"></i></div>`;

  msgDiv.innerHTML = `
    ${avatarHtml}
    <div class="chat-msg-bubble">
      <div>${formattedHtml}</div>
      <span class="chat-msg-time">${timeStr}</span>
    </div>
  `;

  messagesContainer.appendChild(msgDiv);
  scrollChatToBottom();
}

/**
 * Hiển thị khung thông báo cảnh báo/lỗi trong khung chat
 */
function appendChatWarning(warningText) {
  const messagesContainer = document.getElementById("chatbotMessages");
  if (!messagesContainer) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  const msgDiv = document.createElement("div");
  msgDiv.className = "chat-msg bot";

  msgDiv.innerHTML = `
    <div class="chat-msg-avatar" title="Delta AI"><i class="bi bi-robot"></i></div>
    <div class="chat-msg-bubble">
      <div class="ai-api-warning">
        <div class="fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> Thông báo trợ lý:</div>
        <div>${escapeHTML(warningText)}</div>
      </div>
      <span class="chat-msg-time">${timeStr}</span>
    </div>
  `;

  messagesContainer.appendChild(msgDiv);
  scrollChatToBottom();
}

/**
 * Định dạng văn bản từ AI (Markdown nhẹ, in đậm, gạch đầu dòng, gắn thẻ Voucher/Tour)
 */
function formatAIMessage(text) {
  if (!text) return "";

  let html = escapeHTML(text);

  // In đậm: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // In nghiêng: *text*
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Gắn thẻ nổi bật cho các mã voucher
  html = html.replace(/\b(DELTA10|HE2026|VIPTOUR|BANMOI)\b/g, '<span class="ai-tag ai-tag-voucher"><i class="bi bi-ticket-perforated me-1"></i>$1</span>');

  // Gắn thẻ nổi bật cho các mã tour
  html = html.replace(/\b(DL-HL01|DL-DN02|DL-PQ03|DL-DL04|DL-SP05|DL-MT06)\b/g, '<span class="ai-tag ai-tag-tour"><i class="bi bi-compass me-1"></i>$1</span>');

  // Danh sách gạch đầu dòng (- hoặc *)
  html = html.replace(/(?:^|\n)[-*•]\s+(.+)/g, '<li class="my-1">$1</li>');
  html = html.replace(/(<li.*<\/li>)/s, '<ul class="ps-3 my-2">$1</ul>');

  // Danh sách đánh số (1. 2. 3.)
  html = html.replace(/(?:^|\n)\d+\.\s+(.+)/g, '<li class="my-1">$1</li>');

  // Xuống dòng tự nhiên
  html = html.replace(/\n\n/g, "<br><br>");
  html = html.replace(/\n/g, "<br>");

  return html;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Hiệu ứng Typing Indicator (3 dấu chấm nhảy)
 */
function showTypingIndicator() {
  const messagesContainer = document.getElementById("chatbotMessages");
  if (!messagesContainer) return;

  hideTypingIndicator(); // Tránh trùng lặp

  const typingDiv = document.createElement("div");
  typingDiv.className = "chat-msg bot";
  typingDiv.id = "aiTypingIndicator";

  typingDiv.innerHTML = `
    <div class="chat-msg-avatar" title="Delta AI"><i class="bi bi-robot"></i></div>
    <div class="chat-msg-bubble">
      <div class="d-flex align-items-center gap-2">
        <span class="small text-muted">Delta AI đang trả lời</span>
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;

  messagesContainer.appendChild(typingDiv);
  scrollChatToBottom();
}

function hideTypingIndicator() {
  const typingEl = document.getElementById("aiTypingIndicator");
  if (typingEl) typingEl.remove();
}

function toggleSendButtonState(disabled) {
  const sendBtn = document.getElementById("chatbotSendBtn");
  const inputEl = document.getElementById("chatbotInput");
  if (sendBtn) sendBtn.disabled = disabled;
  if (inputEl) inputEl.disabled = disabled;
}

function scrollChatToBottom() {
  const messagesContainer = document.getElementById("chatbotMessages");
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

/**
 * Xóa lịch sử và làm mới cuộc hội thoại
 */
function resetChatConversation() {
  if (confirm("Bạn có muốn làm mới cuộc trò chuyện với Delta AI không?")) {
    chatHistory = [];
    const messagesContainer = document.getElementById("chatbotMessages");
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="chat-msg bot">
          <div class="chat-msg-avatar" title="Delta AI"><i class="bi bi-robot"></i></div>
          <div class="chat-msg-bubble">
            <p class="mb-1">Xin chào bạn! 👋 Tôi là <strong>Delta AI</strong> - Trợ lý tư vấn du lịch thông minh của <strong>Delta Travel</strong>.</p>
            <p class="mb-2">Tôi được tích hợp dữ liệu thực tế về lịch trình, bảng giá, ưu đãi và các chính sách của toàn bộ tour hiện có. Bạn cần em tư vấn điều gì hôm nay?</p>
            <span class="chat-msg-time">Vừa xong</span>
          </div>
        </div>
      `;
    }
    if (typeof showToast === "function") {
      showToast("Đã làm mới cuộc hội thoại với Delta AI.", "info");
    }
  }
}
