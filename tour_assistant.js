"use strict";

/** Rule-based, catalogue-grounded assistant, NOT an LLM or a payment processor.
 * In SQL catalog mode use the remote SQL Server READ-ONLY API exclusively.
 * Never silently fall back to stale SQLite when SQL Server fails.
 */
function fold(value) {
  return String(value || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g,"d")
    .replace(/\s+/g," ").trim();
}
const PLACES = [
  "ha long","lan ha","da nang","hoi an","phu quoc","da lat","sa pa",
  "sapa","ha giang","cao bang","ninh binh","moc chau","hue","nha trang",
  "quy nhon","phu yen","tay ninh","con dao","can tho","mien tay"
];
function has(text, word) {
  return text.includes(word);
}
function describe(t, schedules, mode) {
  const price = Number(t.price);
  let answer = "Tour: " + t.title + ".";
  if (Number.isFinite(price) && price > 0)
    answer += " Giá từ dữ liệu hiện tại: " + price.toLocaleString("vi-VN") + " đ/người.";
  else answer += " Chưa có giá hợp lệ trong dữ liệu.";
  if (t.duration) answer += " Thời lượng: " + t.duration + ".";
  if (t.departure) answer += " Điểm đón/khởi hành: " + t.departure + ".";
  if (t.description) answer += " Thông tin: " + String(t.description).slice(0, 280) + ".";
  const future = schedules.filter(s => s.active !== false && s.departureAt &&
    new Date(s.departureAt).getTime() > Date.now());
  if (future.length) {
    answer += " Lịch gần nhất: " + future.slice(0, 3).map(s => {
      const time = new Date(s.departureAt).toLocaleDateString("vi-VN",
        {timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric"});
      return time + " (còn " + Math.max(0,Number(s.availableSeats)||0) + " chỗ)";
    }).join(", ") + ".";
  } else answer += " Hiện chưa có lịch khởi hành tương lai được xác minh.";
  if (mode === "sqlserver_read_only")
    answer += " Hiện nguồn SQL Server chỉ đọc; chưa hỗ trợ tạo đơn hoặc thanh toán từ kênh này.";
  return answer;
}
function createTourAssistant({db, publicTour}) {
  return async function assistant(req,res) {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message || message.length > 800)
      return res.status(422).json({detail:"Câu hỏi phải có từ 1 đến 800 ký tự."});
    const query = fold(message);
    const target = typeof req.body?.contextTourId === "string"
      ? req.body.contextTourId.trim().slice(0,50) : "";
    const readOnly = Boolean(process.env.THAM_SQLSERVER_CATALOG_API_URL);
    const mode = readOnly ? "sqlserver_read_only" : "sqlite_staging";
    let tours;
    const base = String(process.env.THAM_SQLSERVER_CATALOG_API_URL || "").replace(/\/+$/,"");
    try {
      if (readOnly) {
        const u = new URL(base);
        if (!["https:","http:"].includes(u.protocol) || u.username || u.password)
          throw Error("Invalid SQL Server catalogue URL");
        const response = await fetch(new URL("/api/v1/tours",base),{
          signal:AbortSignal.timeout(7000),headers:{Accept:"application/json"}
        });
        if (!response.ok) throw Error("SQL Server read-only catalogue returned " + response.status);
        tours = await response.json();
        if (!Array.isArray(tours)) throw Error("Invalid SQL Server catalogue response");
      } else {
        tours = db.prepare("SELECT * FROM tours WHERE active=1 ORDER BY price,id")
          .all().map(publicTour);
      }
    } catch(error) {
      console.error("Catalogue assistant unavailable:", error.message);
      return res.status(503).json({detail:"Không thể truy vấn dữ liệu tour đang hoạt động."});
    }
    const live = tours.filter(t => t && t.id != null && t.title && t.active !== false);
    const explicitPlaces = PLACES.filter(place => query.includes(place));
    const explicitIds = live.filter(t => query.includes(fold(t.id)));
    const explicitTitles = live.filter(t => query.includes(fold(t.title)));
    let matches = explicitIds.length ? explicitIds : explicitTitles;
    if (!matches.length && explicitPlaces.length)
      matches = live.filter(t => explicitPlaces.some(place => fold(t.title).includes(place)));
    // If the customer says "tour này", follow the last verified ID from this chat.
    if (!matches.length && /tour nay|tour do|no |gia bao nhieu|lich khoi hanh|con cho/.test(query)
        && target)
      matches = live.filter(t => String(t.id) === target);
    const wantsMany = /so sanh|cac tour|nhung tour|danh sach|goi y|tim tour|kham pha/.test(query);
    const asksTravel = /tour|du lich|diem den|khoi hanh|chuyen di|lich trinh|gia|bao nhieu/.test(query)
      || explicitPlaces.length > 0;
    const asksPayment = /thanh toan|quet qr|hoan tien|chuyen khoan/.test(query);
    const asksAccount = /dang ky|dang nhap|tai khoan|mat khau/.test(query);
    if (asksPayment)
      return res.json({answer:"Đây là bản học phần: không thực hiện hoặc tự xác nhận chuyển tiền. Chỉ trạng thái do server xác minh mới có giá trị; vui lòng mở mục Đơn của tôi để xem trạng thái.",suggestedTours:[],contextTourId:target||null,mode,source:mode});
    if (asksAccount)
      return res.json({answer:"Bạn có thể chọn Đăng nhập/Đăng ký trên website. Nếu phiên máy chủ hết hạn, đăng nhập lại. Không cung cấp mật khẩu thật trên bản demo.",suggestedTours:[],contextTourId:target||null,mode,source:mode});
    if (!asksTravel && !wantsMany)
      return res.json({answer:"Mình chỉ hỗ trợ tra cứu tour và hướng dẫn chức năng Delta Travel. Bạn muốn hỏi tour nào?",suggestedTours:[],contextTourId:null,mode,source:mode});
    if (!matches.length && explicitPlaces.length) {
      return res.json({answer:"Hiện không tìm thấy tour phù hợp với địa điểm vừa hỏi trong dữ liệu đang hoạt động. Mình sẽ không tự tạo thông tin tour.",suggestedTours:[],contextTourId:null,mode,source:mode});
    }
    if (!matches.length && !wantsMany)
      return res.json({answer:"Bạn muốn tra cứu tour nào? Hãy cho mình tên tour hoặc điểm đến để trả lời chính xác.",suggestedTours:[],contextTourId:null,mode,source:mode});
    if (!matches.length && wantsMany) matches=live.slice(0,5);
    if (matches.length>1 && !wantsMany) {
      return res.json({answer:"Có nhiều tour phù hợp. Bạn hãy chọn rõ tour: "+matches.slice(0,4).map(t=>t.title).join("; ")+".",suggestedTours:matches.slice(0,4),contextTourId:null,mode,source:mode,canBook:!readOnly});
    }
    if (wantsMany) {
      const selected=matches.slice(0,5);
      return res.json({answer:"Các tour phù hợp đang có trong dữ liệu: "+selected.map(t=>t.title+" ("+Number(t.price).toLocaleString("vi-VN")+" đ)").join("; ")+".",suggestedTours:selected,contextTourId:selected.length===1?String(selected[0].id):null,mode,source:mode,canBook:!readOnly});
    }
    const t=matches[0];
    let schedules=[];
    try {
      if (readOnly) {
        const r=await fetch(new URL("/api/v1/tours/"+encodeURIComponent(t.id)+"/schedules",base),{
          signal:AbortSignal.timeout(7000),headers:{Accept:"application/json"}
        });
        if (!r.ok) throw Error("Schedule HTTP "+r.status);
        schedules=await r.json();
        if (!Array.isArray(schedules)) throw Error("Schedule shape");
      } else {
        schedules=db.prepare("SELECT * FROM schedules WHERE tour_id=? ORDER BY departure_at")
          .all(t.id).map(s=>({departureAt:s.departure_at,
            availableSeats:Math.max(0,s.total_seats-s.reserved_seats),active:Boolean(s.active)}));
      }
    } catch(error) {
      console.error("Assistant schedule read failed:",error.message);
      return res.status(503).json({detail:"Chưa thể kiểm chứng lịch khởi hành của tour này."});
    }
    return res.json({answer:describe(t,schedules,mode),suggestedTours:[t],
      contextTourId:String(t.id),mode,source:mode,canBook:!readOnly});
  };
}
module.exports={createTourAssistant,fold};
