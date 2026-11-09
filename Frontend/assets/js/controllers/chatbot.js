/**
 * DELTA TRAVEL - TRỢ LÝ AI CONCIERGE 5 SAO (chatbot.js)
 * -------------------------------------------------------------
 * Chức năng:
 * 1. Hỗ trợ 2 chế độ:
 *    - Khung chat lớn (Large AI Chat Modal) khi click trên thanh tab/header
 *    - Khung chat nhỏ (Small AI Floating Widget) khi click nút ở góc màn hình
 * 2. Huấn luyện chuyên sâu về danh mục 16 tour của Delta Travel
 * 3. Tự động gợi ý và hiển thị thẻ tour tương tác để người dùng ĐẶT NGAY trong cuộc hội thoại
 */

let chatHistory = [];
let isChatbotOpen = false;
let isAILoading = false;

/**
 * Gửi yêu cầu tới API trợ lý du lịch ở backend
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
  const suggestedTours = result.data.suggestedTours || [];

  chatHistory.push({
    role: "user",
    parts: [{ text: userMessage }]
  });

  chatHistory.push({
    role: "model",
    parts: [{ text: botReply }]
  });

  return { answer: botReply, suggestedTours };
}

document.addEventListener("DOMContentLoaded", () => {
  initChatbotUI();
});

/**
 * Khởi tạo sự kiện cho Chatbot
 */
function initChatbotUI() {
  const launcherBtn = document.getElementById("chatbotLauncherBtn");
  const invitePill = document.getElementById("chatbotInvitePill");
  const closeBtn = document.getElementById("chatbotCloseBtn");
  const resetBtn = document.getElementById("chatbotResetBtn");
  const sendBtn = document.getElementById("chatbotSendBtn");
  const chatInput = document.getElementById("chatbotInput");
  const quickReplyBtns = document.querySelectorAll(".quick-reply-btn");

  // Nút mở chat nhỏ ở góc
  if (launcherBtn) launcherBtn.addEventListener("click", () => toggleChatbotWindow());
  if (invitePill) invitePill.addEventListener("click", () => toggleChatbotWindow());
  if (closeBtn) closeBtn.addEventListener("click", () => toggleChatbotWindow(false));

  if (resetBtn) resetBtn.addEventListener("click", resetChatConversation);
  if (sendBtn) sendBtn.addEventListener("click", () => handleSendMessage(false));

  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(false);
      }
    });
  }

  // Khung chat lớn
  const largeInput = document.getElementById("largeAIChatInput");
  if (largeInput) {
    largeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(true);
      }
    });
  }

  quickReplyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const query = btn.dataset.query || btn.textContent.trim();
      sendQuickReply(query);
    });
  });
}

/**
 * MỞ KHUNG CHAT AI LỚN (Khi người dùng click Trợ lý AI trên Header / Thanh Tab)
 */
function openLargeAIChat() {
  const modalEl = document.getElementById("largeAIChatModal");
  if (!modalEl) {
    // Dự phòng mở khung chat nhỏ nếu không tìm thấy modal lớn
    toggleChatbotWindow(true);
    return;
  }
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
  setTimeout(() => {
    document.getElementById("largeAIChatInput")?.focus();
    scrollChatToBottom("largeAIChatMessages");
  }, 250);
}

/**
 * Ẩn / Hiện Cửa sổ Chatbot Nhỏ Ở Góc
 */
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
      scrollChatToBottom("chatbotMessages");
    }, 200);
  } else {
    windowEl.classList.add("hidden");
  }
}

function openSmallAIChat() {
  toggleChatbotWindow(true);
}

window.openLargeAIChat = openLargeAIChat;
window.openSmallAIChat = openSmallAIChat;
window.openChatbot = openLargeAIChat;
window.toggleChatbotWindow = toggleChatbotWindow;

/**
 * Xử lý gửi tin nhắn từ người dùng (Hỗ trợ cả khung chat lớn và nhỏ)
 */
async function handleSendMessage(isLarge = false) {
  const inputId = isLarge ? "largeAIChatInput" : "chatbotInput";
  const containerId = isLarge ? "largeAIChatMessages" : "chatbotMessages";
  const inputEl = document.getElementById(inputId);
  if (!inputEl || isAILoading) return;

  const messageText = inputEl.value.trim();
  if (!messageText) return;

  inputEl.value = "";

  // 1. Hiển thị tin nhắn người dùng
  appendChatMessage("user", messageText, [], containerId);

  // 2. Hiệu ứng Loading
  showTypingIndicator(containerId);
  isAILoading = true;
  toggleSendButtonState(true, isLarge);

  try {
    // 3. Gọi backend AI Concierge
    const response = await callAIAPI(messageText);

    hideTypingIndicator(containerId);
    // 4. Hiển thị câu trả lời kèm thẻ gợi ý tour tương tác
    appendChatMessage("bot", response.answer, response.suggestedTours, containerId);

  } catch (err) {
    hideTypingIndicator(containerId);
    console.error("Travel assistant request failed:", err);
    appendChatWarning(
      `Không thể kết nối trợ lý du lịch: ${err.message || "Lỗi không xác định"}. Vui lòng thử lại sau.`,
      containerId
    );
  } finally {
    isAILoading = false;
    toggleSendButtonState(false, isLarge);
  }
}

window.handleLargeSendMessage = () => handleSendMessage(true);

/**
 * Gửi nhanh câu hỏi từ cột gợi ý trong khung chat lớn
 */
function sendLargeAIMessage(queryText) {
  const inputEl = document.getElementById("largeAIChatInput");
  if (inputEl) {
    inputEl.value = queryText;
    handleSendMessage(true);
  }
}
window.sendLargeAIMessage = sendLargeAIMessage;

function sendQuickReply(queryText) {
  const inputEl = document.getElementById("chatbotInput");
  if (inputEl) {
    inputEl.value = queryText;
    handleSendMessage(false);
  }
}

/**
 * Đính kèm tin nhắn vào khung chat chỉ định
 */
function appendChatMessage(sender, rawText, suggestedTours = [], containerId = "chatbotMessages") {
  const messagesContainer = document.getElementById(containerId);
  if (!messagesContainer) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-msg ${sender}`;

  const formattedHtml = (sender === "bot") ? formatAIMessage(rawText) : escapeHTML(rawText);

  const avatarHtml = (sender === "bot")
    ? `<div class="chat-msg-avatar" title="Delta AI"><i class="bi bi-robot"></i></div>`
    : `<div class="chat-msg-avatar" title="Bạn"><i class="bi bi-person-fill"></i></div>`;

  // Thẻ tour tương tác đặt ngay
  let toursHtml = "";
  if (sender === "bot" && Array.isArray(suggestedTours) && suggestedTours.length > 0) {
    toursHtml = `
      <div class="chat-suggested-tours mt-3">
        <div class="small fw-bold text-dark mb-2">
          <i class="bi bi-compass-fill text-warning me-1"></i> Tour nổi bật có thể đặt ngay:
        </div>
        <div class="row g-2">
          ${suggestedTours.map(t => `
            <div class="col-12 col-sm-6">
              <div class="chat-tour-card p-2 rounded-3 border bg-white shadow-xs">
                <div class="d-flex gap-2">
                  <img src="${t.image || 'assets/images/halong.png'}" style="width: 60px; height: 50px; object-fit: cover; border-radius: 6px;" alt="${t.title}" onerror="this.src='assets/images/halong.png'">
                  <div class="flex-1 min-w-0" style="overflow: hidden;">
                    <div class="fw-bold text-dark small text-truncate" title="${t.title}">${t.title}</div>
                    <div class="text-muted" style="font-size: 11px;"><i class="bi bi-clock"></i> ${t.duration || '3N2Đ'}</div>
                    <div class="text-danger fw-bold small">${Number(t.price).toLocaleString("vi-VN")} đ</div>
                  </div>
                </div>
                <div class="d-flex gap-1 mt-2">
                  <a href="booking.html?tourId=${encodeURIComponent(t.id)}" class="btn btn-dark btn-sm w-100 fw-bold py-1" style="font-size: 11px;">
                    <i class="bi bi-cart-check"></i> Đặt ngay
                  </a>
                  <button type="button" onclick="openItineraryModal('${t.id}')" class="btn btn-outline-dark btn-sm w-100 py-1" style="font-size: 11px;">
                    Lịch trình
                  </button>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  msgDiv.innerHTML = `
    ${avatarHtml}
    <div class="chat-msg-bubble">
      <div>${formattedHtml}</div>
      ${toursHtml}
      <span class="chat-msg-time">${timeStr}</span>
    </div>
  `;

  messagesContainer.appendChild(msgDiv);
  scrollChatToBottom(containerId);
}

function appendChatWarning(warningText, containerId = "chatbotMessages") {
  const messagesContainer = document.getElementById(containerId);
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
  scrollChatToBottom(containerId);
}

function formatAIMessage(text) {
  if (!text) return "";
  let html = escapeHTML(text);
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  return `<p class="mb-1">${html}</p>`;
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showTypingIndicator(containerId = "chatbotMessages") {
  const messagesContainer = document.getElementById(containerId);
  if (!messagesContainer || messagesContainer.querySelector(".chat-typing")) return;

  const typingDiv = document.createElement("div");
  typingDiv.className = "chat-msg bot chat-typing";
  typingDiv.innerHTML = `
    <div class="chat-msg-avatar"><i class="bi bi-robot"></i></div>
    <div class="chat-msg-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  messagesContainer.appendChild(typingDiv);
  scrollChatToBottom(containerId);
}

function hideTypingIndicator(containerId = "chatbotMessages") {
  const container = document.getElementById(containerId);
  const typingEl = container?.querySelector(".chat-typing");
  if (typingEl) typingEl.remove();
}

function scrollChatToBottom(containerId = "chatbotMessages") {
  const container = document.getElementById(containerId);
  if (container) {
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }
}

function toggleSendButtonState(isLoading, isLarge = false) {
  const btnId = isLarge ? "largeAIChatSendBtn" : "chatbotSendBtn";
  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.disabled = isLoading;
  if (isLoading) {
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
  } else {
    btn.innerHTML = `<i class="bi bi-send-fill me-1"></i> Gửi`;
  }
}

function resetChatConversation() {
  chatHistory = [];
  const container = document.getElementById("chatbotMessages");
  if (container) {
    container.innerHTML = `
      <div class="chat-msg bot">
        <div class="chat-msg-avatar" title="Delta AI"><i class="bi bi-robot"></i></div>
        <div class="chat-msg-bubble">
          <div>Xin chào Quý khách! 👋 Tôi có thể tư vấn lộ trình và gợi ý tour đặt ngay cho bạn.</div>
          <span class="chat-msg-time">Vừa xong</span>
        </div>
      </div>
    `;
  }
}

function resetLargeChatConversation() {
  chatHistory = [];
  const container = document.getElementById("largeAIChatMessages");
  if (container) {
    container.innerHTML = `
      <div class="chat-msg bot">
        <div class="chat-msg-avatar" title="Delta AI"><i class="bi bi-robot"></i></div>
        <div class="chat-msg-bubble">
          <div>Xin chào Quý khách! Tôi là Trợ lý AI Concierge 5 sao của Delta Travel. Bạn muốn tìm tour hay điểm đến nào hôm nay?</div>
          <span class="chat-msg-time">Vừa xong</span>
        </div>
      </div>
    `;
  }
}
window.resetLargeChatConversation = resetLargeChatConversation;
