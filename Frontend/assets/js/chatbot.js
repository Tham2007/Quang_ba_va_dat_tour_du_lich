const AI_API_KEY = ""; // Điền API Key (Gemini / OpenAI) vào đây
const AI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * DELTA TRAVEL - AI TRAVEL CONSULTANT CHATBOT (chatbot.js)
 * -------------------------------------------------------------
 * Chức năng:
 * 1. Gọi trực tiếp Google Gemini API thật qua fetch() async/await thuần Frontend.
 * 2. Tự động nạp toàn bộ cơ sở dữ liệu Tours, Lịch trình, Giá vé, Voucher từ data.js vào systemInstruction.
 * 3. Lưu trữ mảng lịch sử chat (chatHistory) để ghi nhớ ngữ cảnh hội thoại.
 * 4. Hiển thị hiệu ứng Typing Loading và xử lý bắt lỗi try...catch chi tiết.
 * 5. Định dạng tin nhắn Rich Text (Bold, Bullet, Voucher/Tour Tags).
 */

// =============================================================================
// I. TRẠNG THÁI CHATBOT (STATE & HISTORY)
// =============================================================================
let chatHistory = []; // Lưu trữ lịch sử dạng: [{ role: "user" | "model", parts: [{ text: "..." }] }]
let isChatbotOpen = false;
let isAILoading = false;

// =============================================================================
// II. KHỞI TẠO SYSTEM INSTRUCTION TỪ DATA.JS
// =============================================================================
/**
 * Trích xuất toàn bộ dữ liệu của Delta Travel thành văn bản System Prompt cho AI
 */
function buildDeltaSystemPrompt() {
  let toursSummary = "";
  if (typeof TOURS_DATA !== "undefined" && Array.isArray(TOURS_DATA)) {
    toursSummary = TOURS_DATA.map(t => {
      const highlights = (t.highlights || []).join("; ");
      const dailyItinerary = (t.itinerary || []).map(day => 
        `  * Ngày ${day.day}: ${day.title}. Sáng: ${day.morning || ""} Chiều: ${day.afternoon || ""} Tối: ${day.evening || ""}`
      ).join("\n");

      return `[MÃ TOUR: ${t.id}]
- Tên tour: ${t.title}
- Điểm đến: ${t.regionName} | Thời lượng: ${t.duration}
- Điểm khởi hành: ${t.departure} | Phương tiện: ${t.transport}
- Giá ưu đãi hiện tại: ${t.price ? t.price.toLocaleString("vi-VN") + " VNĐ" : "Liên hệ"} (Giá gốc: ${t.originalPrice ? t.originalPrice.toLocaleString("vi-VN") + " VNĐ" : ""})
- Đánh giá: ${t.rating}/5 sao (${t.reviewsCount} lượt đánh giá)
- Số chỗ còn nhận: ${t.availableSeats} chỗ
- Điểm nổi bật: ${highlights}
- Lịch trình chi tiết:
${dailyItinerary}
- Dịch vụ bao gồm: ${(t.inclusions || []).join(", ")}
- Dịch vụ không bao gồm: ${(t.exclusions || []).join(", ")}`;
    }).join("\n\n");
  }

  let vouchersSummary = "";
  if (typeof VOUCHERS_DATA !== "undefined" && Array.isArray(VOUCHERS_DATA)) {
    vouchersSummary = VOUCHERS_DATA.map(v => 
      `- Mã [${v.code}]: ${v.description} (Áp dụng cho đơn từ ${v.minOrderValue ? v.minOrderValue.toLocaleString("vi-VN") + "đ" : "0đ"})`
    ).join("\n");
  }

  let addonsSummary = "";
  if (typeof ADDON_SERVICES !== "undefined") {
    addonsSummary = Object.values(ADDON_SERVICES).map(a => 
      `- ${a.name}: ${a.price.toLocaleString("vi-VN")} VNĐ / ${a.unit}`
    ).join("\n");
  }

  return `Bạn là "Delta AI" - Chuyên viên tư vấn du lịch và lữ hành thông minh, chuyên nghiệp, nhiệt tình của thương hiệu DELTA TRAVEL (Việt Nam).
Website: https://deltatravel.vn | Hotline: 1900 8899 | Email: support@deltatravel.vn.

NHIỆM VỤ CỦA BẠN:
1. Tư vấn chi tiết các gói tour du lịch của Delta Travel, gợi ý tour phù hợp với ngân sách, thời gian, sở thích và điểm xuất phát của khách hàng.
2. Trả lời chính xác về lịch trình từng ngày, điểm tham quan, bữa ăn, khách sạn và dịch vụ bao gồm/không bao gồm.
3. Cung cấp và hướng dẫn khách áp dụng các mã giảm giá Voucher hiện có của Delta Travel.
4. Giải thích quy trình đặt tour trực tuyến, các phương thức thanh toán (chuyển khoản VietQR tức thì, thẻ ATM/Visa, ví MoMo, tiền mặt) và chính sách hoàn hủy vé:
   - Miễn phí hủy tour trước 7 ngày.
   - Hủy trước 3 - 6 ngày hoàn 50%.
   - Hủy dưới 3 ngày tính 100% phí.

QUY TẮC PHẢN HỒI:
- Luôn thân thiện, lịch sự, xưng "em/tôi" và gọi khách là "quý khách" hoặc "bạn".
- Sử dụng các emoji du lịch sinh động (🏖️, 🏔️, 🚢, ✈️, 🎟️, 💰, ⭐, 📋).
- Trình bày thông tin ngắn gọn, mạch lạc, dùng gạch đầu dòng rõ ràng, in đậm các thông tin quan trọng như Tên tour, Giá tiền, Mã Voucher, Mã Tour.
- Tuyệt đối không bịa đặt các tour không có trong dữ liệu. Nếu khách hỏi tour khác ngoài danh mục, hãy khéo léo giới thiệu các tour hiện có hoặc mời khách liên hệ Hotline 1900 8899 để thiết kế tour riêng.

CƠ SỞ DỮ LIỆU HIỆN CÓ CỦA DELTA TRAVEL:

=== DANH SÁCH TOUR DU LỊCH ===
${toursSummary}

=== CÁC MÃ GIẢM GIÁ (VOUCHER) ĐANG ÁP DỤNG ===
${vouchersSummary}

=== DỊCH VỤ GIA TĂNG TÙY CHỌN ===
${addonsSummary}`;
}

// =============================================================================
// III. HÀM GỌI API AI THẬT (FETCH ASYNC/AWAIT)
// =============================================================================
/**
 * Gửi yêu cầu tới Google Gemini API bằng fetch() thuần JavaScript
 * @param {string} userMessage - Tin nhắn người dùng nhập vào
 * @returns {Promise<string>} - Nội dung phản hồi từ AI
 */
async function callAIAPI(userMessage) {
  // 1. Kiểm tra cấu hình API Key
  if (!AI_API_KEY || AI_API_KEY.trim() === "") {
    throw new Error("KEY_NOT_CONFIGURED");
  }

  // 2. Chuẩn bị URL kèm API Key
  const endpointUrl = `${AI_API_URL}?key=${encodeURIComponent(AI_API_KEY.trim())}`;

  // 3. Chuẩn bị payload chuẩn Google Gemini API
  const systemInstructionText = buildDeltaSystemPrompt();

  // Đưa lịch sử hội thoại vào contents
  const requestContents = [
    ...chatHistory,
    {
      role: "user",
      parts: [{ text: userMessage }]
    }
  ];

  const payload = {
    systemInstruction: {
      parts: [{ text: systemInstructionText }]
    },
    contents: requestContents,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1200
    }
  };

  // 4. Gửi HTTP POST Request bằng fetch()
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  // 5. Kiểm tra mã trạng thái HTTP
  if (!response.ok) {
    let errorDetail = `Lỗi máy chủ (${response.status} ${response.statusText})`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error && errJson.error.message) {
        errorDetail = errJson.error.message;
      }
    } catch (_) {}
    throw new Error(errorDetail);
  }

  // 6. Đọc kết quả JSON trả về
  const data = await response.json();
  const botReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!botReply) {
    throw new Error("Không nhận được câu trả lời từ máy chủ AI.");
  }

  // 7. Cập nhật lịch sử cuộc trò chuyện
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
    // 3. Gọi API AI thật bằng fetch()
    const botResponse = await callAIAPI(messageText);

    // 4. Xóa loading và hiển thị câu trả lời của AI
    hideTypingIndicator();
    appendChatMessage("bot", botResponse);

  } catch (err) {
    hideTypingIndicator();

    if (err.message === "KEY_NOT_CONFIGURED") {
      // Thông báo chưa cấu hình API Key theo đúng yêu cầu
      appendChatWarning(
        "Chưa cấu hình API Key. Vui lòng thêm khóa vào biến AI_API_KEY trong file assets/js/chatbot.js để bắt đầu trò chuyện."
      );
    } else {
      // Thông báo lỗi mạng hoặc mã lỗi từ API
      appendChatWarning(
        `Không thể kết nối tới máy chủ AI. Chi tiết lỗi: ${err.message}. Vui lòng kiểm tra lại kết nối mạng hoặc tính hợp lệ của API Key.`
      );
    }
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
        <div class="fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> Thông Báo Cấu Hình API:</div>
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
