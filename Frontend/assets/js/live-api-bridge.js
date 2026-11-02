/* Delta Travel KTHP: API-backed functions on An's original page.
 * Only active under /an-live/ where FastAPI serves this UI same-origin.
 * Legacy buttons remain educational localStorage simulations. This panel
 * is independent and uses only authenticated server-side endpoints.
 */
(() => {
  "use strict";
  if (!location.pathname.startsWith("/an-live")) return;
  const BASE = "/api/v1";
  const state = { user: null, tours: [], view: "tours", authMode: "login" };
  const $ = (selector, root = document) => root.querySelector(selector);
  const node = (tag, value, cls = "") => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value !== undefined) e.textContent = value;
    return e;
  };
  const date = value => new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
  const money = amount => new Intl.NumberFormat("vi-VN", {
    style: "currency", currency: "VND", maximumFractionDigits: 0
  }).format(amount);
  const csrf = () => {
    const c = document.cookie.split("; ").find(s => s.startsWith("delta_csrf="));
    return c ? decodeURIComponent(c.slice("delta_csrf=".length)) : "";
  };
  const api = async (path, method = "GET", body, extra = {}) => {
    const headers = { "Accept": "application/json", ...extra };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (!["GET", "HEAD"].includes(method) && csrf()) headers["X-CSRF-Token"] = csrf();
    const response = await fetch(BASE + path, {
      method, headers, credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.detail;
      const msg = typeof detail === "string" ? detail :
        Array.isArray(detail) ? detail.map(x => x.msg).join("; ") :
        "Không thể hoàn tất yêu cầu (HTTP " + response.status + ")";
      throw new Error(msg);
    }
    return data;
  };

  const style = node("style");
  style.textContent = `
    #kthpLiveBtn{position:fixed!important;right:17px;bottom:22px;z-index:2147483646;
      background:#0c4960;color:white;border:2px solid white;border-radius:35px;
      box-shadow:0 9px 27px #0006;font:700 14px/1.4 system-ui,sans-serif;
      padding:13px 19px;cursor:pointer}
    #kthpLivePanel{z-index:20010;border:0;border-radius:16px;padding:0;
      box-shadow:0 20px 75px #0008;width:min(510px,95vw);max-height:88vh;color:#172f3c}
    #kthpLivePanel::backdrop{background:#0009}
    #kthpLivePanel .kthp-head{background:#0c4960;padding:17px;color:white;
      display:flex;justify-content:space-between;gap:8px;align-items:center}
    #kthpLivePanel .kthp-main{padding:17px;overflow-y:auto;max-height:70vh}
    #kthpLivePanel button{cursor:pointer;padding:9px 13px;border:1px solid #b8c6d0;
      border-radius:8px;background:white;color:#17425b}
    #kthpLivePanel button.kthp-primary{background:#086b78;color:white;border-color:#086b78}
    #kthpLivePanel button:disabled{opacity:.45;cursor:not-allowed}
    #kthpLivePanel .kthp-card{border:1px solid #dce5ea;padding:12px;
      border-radius:10px;margin:11px 0}
    #kthpLivePanel .kthp-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
    #kthpLivePanel .kthp-label{display:block;margin:10px 0;font-weight:600}
    #kthpLivePanel input,#kthpLivePanel select{display:block;width:100%;max-width:100%;
      border:1px solid #bac7d0;border-radius:7px;padding:10px;margin-top:4px;background:white;color:#16232b}
    #kthpLivePanel .kthp-status{background:#edf6fa;padding:11px;border-radius:8px;
      white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
    #kthpLivePanel .kthp-muted{color:#62747e;font-size:13px;line-height:1.5}
  `;
  document.head.append(style);
  const button = node("button", "🔒 Đặt tour qua API thật");
  button.id = "kthpLiveBtn";
  button.type = "button";
  const dialog = node("dialog");
  dialog.id = "kthpLivePanel";
  const header = node("div", undefined, "kthp-head");
  const heading = node("strong", "Delta Travel · Staging API");
  const close = node("button", "✕");
  close.type = "button";
  close.setAttribute("aria-label", "Đóng");
  close.addEventListener("click", () => dialog.close());
  header.append(heading, close);
  const main = node("div", undefined, "kthp-main");
  const info = node("p",
    "Đây là luồng API thật trên server, dùng dữ liệu giả để thi. " +
    "Các nút cũ bên ngoài vẫn mô phỏng localStorage. Không nhập CCCD, " +
    "mật khẩu cá nhân hay chuyển tiền.", "kthp-muted");
  const status = node("p", "", "kthp-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const surface = node("div");
  main.append(info, status, surface);
  dialog.append(header, main);
  // An's old admin lock is a full-viewport pointer barrier. Place the
  // separate real-API entry point INSIDE that barrier, not underneath it.
  const legacyAdminLock = document.getElementById("adminLockScreen");
  if (legacyAdminLock) legacyAdminLock.append(button);
  else document.body.append(button);
  document.body.append(dialog);
  const flash = message => { status.textContent = message; };
  const action = (name, callback, primary = false) => {
    const b = node("button", name, primary ? "kthp-primary" : "");
    b.type = "button";
    b.addEventListener("click", async () => {
      b.disabled = true;
      try { await callback(); }
      catch (err) { flash("Lỗi: " + (err?.message || "Mất kết nối")); }
      finally { b.disabled = false; }
    });
    return b;
  };
  const field = (parent, label, name, type = "text", opts = {}) => {
    const wrapper = node("label", label, "kthp-label");
    const inp = node("input");
    inp.name = name;
    inp.type = type;
    inp.required = opts.required !== false;
    if (opts.value !== undefined) inp.value = opts.value;
    if (opts.min !== undefined) inp.min = opts.min;
    if (opts.max !== undefined) inp.max = opts.max;
    if (opts.minlength !== undefined) inp.minLength = opts.minlength;
    if (opts.pattern !== undefined) inp.pattern = opts.pattern;
    wrapper.append(inp);
    parent.append(wrapper);
    return inp;
  };
  const row = parent => {
    const r = node("div", undefined, "kthp-row");
    parent.append(r);
    return r;
  };
  const clear = () => surface.replaceChildren();
  async function sync() {
    const s = await api("/auth/session");
    state.user = s.authenticated ? s.user : null;
    return state.user;
  }
  async function home() {
    clear();
    await sync();
    surface.append(node("h3", state.user
      ? "Xin chào, " + state.user.fullName
      : "Đăng nhập để lưu đơn thực sự trên server"));
    const menu = row(surface);
    if (!state.user) {
      menu.append(action("Đăng nhập", () => auth("login"), true));
      menu.append(action("Đăng ký thử nghiệm", () => auth("register")));
    } else {
      menu.append(action("Tour và lịch", catalog, true));
      menu.append(action("Đơn của tôi", orders));
      menu.append(action("Đăng xuất", async () => {
        await api("/auth/logout", "POST", {});
        state.user = null;
        flash("Đã đăng xuất khỏi server.");
        await home();
      }));
      if (state.user.role === "ADMIN") menu.append(action("Quản trị", adminView));
    }
    surface.append(node("p", "Tài khoản và đơn đặt hiển thị ở đây đến từ API /api/v1, không đọc localStorage.", "kthp-muted"));
    await catalog();
  }
  async function auth(mode) {
    clear();
    state.authMode = mode;
    surface.append(node("h3", mode === "login" ? "Đăng nhập API" : "Đăng ký API"));
    const form = node("form");
    const name = mode === "register" ? field(form, "Họ tên giả lập", "name", "text", {minlength:2}) : null;
    const email = field(form, "Email", "email", "email");
    const phone = mode === "register" ? field(form, "Số điện thoại test", "phone", "tel", {pattern:"0[35789][0-9]{8}"}) : null;
    const pass = field(form, "Mật khẩu thử nghiệm (ít nhất 12 ký tự)", "password", "password", {minlength: mode === "register" ? 12 : 1});
    const submit = node("button", mode === "login" ? "Đăng nhập" : "Tạo tài khoản", "kthp-primary");
    submit.type = "submit";
    form.append(submit);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      submit.disabled = true;
      try {
        const payload = mode === "register" ?
          {full_name:name.value, email:email.value, phone:phone.value, password:pass.value} :
          {email:email.value, password:pass.value};
        await api("/auth/" + (mode === "register" ? "register" : "login"), "POST", payload);
        flash("Xác thực server thành công.");
        await home();
      } catch (err) { flash("Lỗi: " + err.message); }
      finally { submit.disabled = false; }
    });
    surface.append(form);
    row(surface).append(
      action(mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?", () =>
        auth(mode === "login" ? "register" : "login")),
      action("Quay lại", home)
    );
  }
  async function catalog() {
    clear();
    const tours = await api("/tours");
    state.tours = tours;
    surface.append(node("h3", "Danh sách tour trên database (" + tours.length + ")"));
    const nav = row(surface);
    if (state.user) nav.append(action("Xem đơn của tôi", orders));
    else nav.append(action("Đăng ký / Đăng nhập", () => auth("register"), true),
      action("Đã có tài khoản", () => auth("login")));
    for (const t of tours) {
      const card = node("article", undefined, "kthp-card");
      card.append(node("strong", t.title),
        node("p", money(t.price) + " · " + t.duration));
      card.append(action("Xem lịch & giữ chỗ", () => booking(t)));
      surface.append(card);
    }
  }
  async function booking(t) {
    if (!state.user) { flash("Vui lòng đăng nhập trước."); return auth("login"); }
    clear();
    const schedules = (await api("/tours/" + encodeURIComponent(t.id) + "/schedules"))
      .filter(s => s.availableSeats > 0);
    surface.append(node("h3", "Giữ chỗ: " + t.title));
    if (!schedules.length) {
      surface.append(node("p", "Không có chuyến còn chỗ."));
      row(surface).append(action("Quay lại", catalog));
      return;
    }
    const form = node("form");
    const label = node("label", "Ngày khởi hành", "kthp-label");
    const select = node("select");
    select.required = true;
    for (const s of schedules) {
      const option = node("option", date(s.departureAt) + " · còn " + s.availableSeats + " chỗ");
      option.value = s.id;
      select.append(option);
    }
    label.append(select);form.append(label);
    const adults = field(form, "Người lớn", "adults", "number", {min:1,max:20,value:1});
    const children = field(form, "Trẻ em", "children", "number", {min:0,max:20,value:0});
    const infants = field(form, "Em bé", "infants", "number", {min:0,max:20,value:0});
    const customer = field(form, "Người liên hệ", "customer_name", "text", {value:state.user.fullName});
    const phone = field(form, "Số điện thoại", "customer_phone", "tel", {value:state.user.phone,pattern:"0[35789][0-9]{8}"});
    const email = field(form, "Email", "customer_email", "email", {value:state.user.email});
    const comment = field(form, "Ghi chú", "note", "text", {required:false});
    const quote = node("p", "Đang tính giá từ server...");
    form.append(quote);
    const quantities = () => ({
      schedule_id:select.value,adults:Number(adults.value),
      children:Number(children.value),infants:Number(infants.value)
    });
    const refresh = async () => {
      try {
        const q = await api("/bookings/quote", "POST", quantities());
        quote.textContent = money(q.totalPrice) + " · còn " + q.availableSeats + " chỗ";
      } catch (err) { quote.textContent = err.message; }
    };
    [select, adults, children, infants].forEach(inp => inp.addEventListener("change", refresh));
    const submit = node("button", "Giữ chỗ trên server", "kthp-primary");
    submit.type = "submit";
    form.append(submit);
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      submit.disabled = true;
      try {
        const body = {
          ...quantities(), customer_name:customer.value,
          customer_phone:phone.value, customer_email:email.value,
          note:comment.value
        };
        const b = await api("/bookings", "POST", body,
          {"Idempotency-Key":crypto.randomUUID()});
        flash("Đã lưu đơn " + b.reference + " vào server. CHƯA thanh toán.");
        await orders();
      } catch (err) { flash("Lỗi: " + err.message); }
      finally { submit.disabled = false; }
    });
    surface.append(form);
    row(surface).append(action("Quay lại", catalog));
    await refresh();
  }
  async function orders() {
    if (!state.user) return auth("login");
    clear();
    const list = await api("/bookings");
    surface.append(node("h3", "Đơn đặt lưu trong database"));
    row(surface).append(action("Xem tour", catalog));
    if (!list.length) surface.append(node("p", "Chưa có đơn."));
    for (const b of list) {
      const card = node("div", undefined, "kthp-card");
      card.append(node("strong", b.reference),
        node("p", b.tourTitle + " · " + money(b.totalPrice)),
        node("p", "Trạng thái: " + b.status + (b.paid ? " · Đã xác nhận" : " · CHƯA thanh toán")));
      if (b.status === "PENDING_PAYMENT") {
        card.append(action("Hủy giữ chỗ", async () => {
          await api("/bookings/" + encodeURIComponent(b.id) + "/cancel", "POST", {});
          flash("Đã hủy và trả số chỗ trên server.");
          await orders();
        }));
      }
      surface.append(card);
    }
  }
  async function adminView() {
    if (state.user?.role !== "ADMIN") return;
    clear();
    const tours = await api("/admin/tours");
    surface.append(node("h3", "Quản trị qua API, ADMIN xác thực"));
    row(surface).append(action("Xem tour", catalog), action("Đơn", orders));
    for (const t of tours) {
      const c = node("div", undefined, "kthp-card");
      c.append(node("strong", t.title), node("p", money(t.price)));
      c.append(action("Sửa giá", async () => {
        const v = prompt("Giá VND mới:", String(t.price));
        if (v === null) return;
        if (!/^\\d+$/.test(v) || Number(v) < 1 || Number(v) > 2000000000) {
          flash("Giá không hợp lệ.");return;
        }
        await api("/admin/tours/" + encodeURIComponent(t.id), "PATCH", {price:Number(v)});
        flash("Đã cập nhật giá trên máy chủ.");
        await adminView();
      }));
      surface.append(c);
    }
  }
  button.addEventListener("click", async () => {
    dialog.showModal();
    flash("Đang xác minh máy chủ...");
    try { await home(); flash("API đang hoạt động. Không nhập thông tin thật."); }
    catch (err) { clear(); flash("Không thể kết nối API: " + err.message); }
  });
})();
