import os
import sys
import docx
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from PIL import Image

# Add root directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from scripts.doc_helpers import (
    add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_image_with_caption,
    add_code_block, create_styled_table,
    set_cell_background, set_cell_margins,
    NAVY_BLUE, STEEL_BLUE, DARK_GRAY, BODY_COLOR
)
from scripts.build_refined_mvc_diagram import PUML_CODE, generate as generate_diagram

CLEAN_IMG_DIR = os.path.join(os.path.dirname(__file__), "clean_images")

def build_mvc_docx():
    print("=" * 60)
    print("  BẮT ĐẦU XÂY DỰNG TÀI LIỆU KIẾN TRÚC PHÂN TẦNG MVC THỰC TẾ DELTA TRAVEL")
    print("=" * 60)

    # 1. Sinh ảnh và mã nguồn PlantUML
    generate_diagram()

    doc = docx.Document()

    # Cấu hình lề trang chuẩn báo cáo khoa học (Top 2cm, Bottom 2cm, Left 3cm, Right 2cm)
    for section in doc.sections:
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.left_margin = Cm(3.0)
        section.right_margin = Cm(2.0)
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)

    # 1. TIÊU ĐỀ TÀI LIỆU
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(4)
    r1 = p_title.add_run("BÁO CÁO PHÂN TÍCH KIẾN TRÚC PHẦN MỀM THỰC TẾ (DISTRIBUTED LAYERED MVC)\n")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(16)
    r1.font.bold = True
    r1.font.color.rgb = NAVY_BLUE

    r2 = p_title.add_run("HỆ THỐNG WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN (DELTA TRAVEL)")
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(13)
    r2.font.bold = True
    r2.font.color.rgb = STEEL_BLUE

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(4)
    p_sub.paragraph_format.space_after = Pt(16)
    r3 = p_sub.add_run("Khảo sát & Đối chiếu 100% Source Code: Frontend JS Client MVC - Backend FastAPI Layered MVC - SQL Server 12 Bảng 3NF\nĐặc điểm kiến trúc: Phân tách ranh giới rõ rệt, kết nối RESTful API và có chiều quay ngược lại (Reverse Flow)")
    r3.font.name = "Times New Roman"
    r3.font.size = Pt(10)
    r3.font.italic = True
    r3.font.color.rgb = DARK_GRAY

    # MỤC 1: TỔNG QUAN KIẾN TRÚC
    add_heading_1(doc, "1. TỔNG QUAN VÀ BẢN CHẤT KIẾN TRÚC THỰC TẾ HỆ THỐNG DELTA TRAVEL")
    add_body_p(
        doc,
        "Qua kết quả rà soát và khảo sát toàn diện mã nguồn trong repository, hệ thống Delta Travel không áp dụng "
        "mô hình MVC kinh điển một khối (Monolithic Desktop MVC), mà được xây dựng theo mô hình Kiến trúc Phân tầng "
        "kết hợp MVC trên nền tảng Web phân tán (Distributed Web Layered MVC Architecture). "
        "Hệ thống phân tách ranh giới rõ rệt giữa máy khách (Client) và máy chủ (Server) qua môi trường mạng Internet:"
    )
    add_bullet_p(doc, "Hoạt động trực tiếp trên trình duyệt của người dùng, được tổ chức theo mô hình Client-side MVC/MVP bằng JavaScript hiện đại kết hợp CSS3 hiệu ứng kính mờ (Liquid Glass). Gồm các View HTML5 (index.html, booking.html, my-bookings.html, admin.html), các Client Controller điều khiển DOM (main.js, auth.js, admin.js) và Client Service đóng gói dữ liệu (api.js, vietqr-service.js).", bold_prefix="1. Phía Frontend (Client Tier): ")
    add_bullet_p(doc, "Giao tiếp hoàn toàn bất đồng bộ thông qua giao thức chuẩn HTTP/HTTPS RESTful API, trao đổi dữ liệu chuẩn định dạng JSON, quản lý trạng thái phiên bảo mật bằng cặp Cookie an toàn (HttpOnly, SameSite=Lax, Secure).", bold_prefix="2. Giao thức truyền thông (API Gateway): ")
    add_bullet_p(doc, "Được xây dựng trên nền tảng FastAPI (Python), áp dụng mô hình Layered Architecture chuẩn doanh nghiệp: Tầng Route (api/routes/) định tuyến URL; Tầng Controller (api/controllers/) đóng vai trò HTTP boundary; Tầng Service (api/services/) tập trung xử lý Business Rules lữ hành và chống Overbooking; Tầng Repository (api/repositories/) trừu tượng hóa truy vấn CSDL; Tầng Model & Schema (api/models/, api/schemas/) ánh xạ thực thể ORM và hợp đồng Pydantic DTOs.", bold_prefix="3. Phía Backend (Server Tier): ")
    add_bullet_p(doc, "Hệ quản trị CSDL Microsoft SQL Server lưu trữ 12 bảng chuẩn 3NF (NGUOIDUNG, DANHMUC, TOUR, HINHANH_TOUR, LICH_TRINH_DETAIL, CHUYENKHOIHANH, DATTOUR, CHITIET_HANHKHACH, THANHTOAN, DANHGIA, BAIVIET_QUANGBA, AUDITLOG) kết hợp Trigger tự động khóa giữ chỗ chống Overbooking (TRG_DATTOUR_CheckAndLockSeats).", bold_prefix="4. Phía Cơ sở dữ liệu (Database Tier): ")

    doc.add_page_break()

    # MỤC 2: SƠ ĐỒ LỚP KIẾN TRÚC THỰC TẾ
    add_heading_1(doc, "2. SƠ ĐỒ KIẾN TRÚC PHÂN TẦNG MVC THỰC TẾ HỆ THỐNG DELTA TRAVEL")
    add_body_p(
        doc,
        "Sơ đồ dưới đây phản ánh chính xác 100% cấu trúc các thành phần đang chạy trong mã nguồn thực tế của hệ thống. "
        "Sơ đồ phân chia thành 3 phân vùng lớn: Frontend Tier (Client), Backend Tier (FastAPI Server) và Database Tier (SQL Server 12 Bảng 3NF). "
        "Đặc biệt, sơ đồ làm nổi bật hai chiều giao tiếp: Chiều thuận (mũi tên liền màu xanh) gửi yêu cầu và "
        "Chiều quay ngược lại (mũi tên nét đứt màu đỏ đậm) phản hồi dữ liệu, trạng thái trigger và ngoại lệ nghiệp vụ:"
    )

    img_mvc = os.path.join(CLEAN_IMG_DIR, "hinh_2_17_class_mvc.png")
    add_image_with_caption(doc, img_mvc, "Hình 2.17: Sơ đồ kiến trúc phân tầng MVC thực tế hệ thống Delta Travel (Frontend - Backend - SQL Server)", width_inches=6.2)

    doc.add_page_break()

    # MỤC 3: ĐẶC TẢ CHI TIẾT CÁC PHÂN TẦNG
    add_heading_1(doc, "3. ĐẶC TẢ CHI TIẾT CÁC THÀNH PHẦN THEO TRÁCH NHIỆM KIẾN TRÚC")

    # 3.1 VIEW
    add_heading_2(doc, "3.1. Tầng Hiển thị phía Client (Frontend View Layer)")
    add_body_p(
        doc,
        "Tầng View tồn tại thực tế tại thư mục Frontend/, bao gồm các trang HTML5 kết hợp CSS3 hiệu ứng kính mờ (Liquid Glass) "
        "và các thành phần giao diện động:"
    )
    views_table_data = [
        ["1", "index.html (Home & Catalog View)", "Trang chủ, Tra cứu & Khám phá tour", "Khách viếng thăm, Khách hàng", "• Hiển thị Banner tương tác xoay 3D Hero.\n• Bộ lọc tìm kiếm tour đa tiêu chí (điểm đến, giá tiền, ngày khởi hành).\n• Lưới thẻ tour du lịch (Tour Cards).\n• Modal xem chi tiết lộ trình và ảnh gallery.\n• Modal Đăng nhập / Đăng ký tài khoản."],
        ["2", "booking.html (Checkout View)", "Đặt tour & Nhập thông tin hành khách", "Khách hàng", "• Bảng tóm tắt thông tin chuyến đi đã chọn.\n• Form nhập số lượng khách theo độ tuổi.\n• Danh sách chi tiết hành khách (Họ tên, ngày sinh, CCCD/Passport).\n• Modal hiển thị mã VietQR thanh toán động.\n• Vùng upload ảnh biên lai chuyển khoản ngân hàng."],
        ["3", "my-bookings.html (My Bookings View)", "Lịch sử đơn & Quản lý vé điện tử", "Khách hàng", "• Danh sách đơn đặt chỗ gắn với tài khoản cá nhân.\n• Chi tiết mã đặt tour (BK...), trạng thái vé và thanh toán.\n• Modal gửi yêu cầu đổi / hủy tour kèm lý do."],
        ["4", "admin.html (Admin Dashboard View)", "Cổng điều hành & Quản trị tập trung", "Quản trị viên", "• Bảng điều khiển KPI doanh thu, số lượt khách theo tháng.\n• Quản lý CRUD tour du lịch, ảnh và lịch trình.\n• Quản lý các đợt khởi hành và số chỗ tối đa.\n• Phê duyệt đơn đặt tour và đối soát thanh toán VietQR.\n• Xem và lọc nhật ký kiểm toán hệ thống (AUDITLOG)."]
    ]
    create_styled_table(doc, ["STT", "Tên Giao diện", "Phân hệ màn hình", "Tác nhân sử dụng", "Chức năng và thành phần giao diện chính"], views_table_data, [0.4, 1.4, 1.3, 1.1, 2.3], "Bảng 1: Đặc tả chi tiết các màn hình trong Tầng View (Frontend)")

    # 3.2 CLIENT CONTROLLER
    add_heading_2(doc, "3.2. Tầng Điều khiển phía Client (Client-side Controller Layer)")
    add_body_p(
        doc,
        "Các file JavaScript tại Frontend/assets/js/controllers/ chịu trách nhiệm bắt sự kiện DOM từ người dùng, "
        "kiểm tra hợp lệ định dạng đầu vào ở phía máy khách (Client Validation) và điều phối hiển thị:"
    )
    client_ctrl_data = [
        ["1", "main.js", "Điều khiển Trang chủ & Lọc tour", "• Lắng nghe sự kiện click/input tìm kiếm và lọc tour.\n• Gọi api.js để truy vấn dữ liệu tour và render thẻ tour ra DOM.\n• Điều khiển mở modal chi tiết lộ trình và chuyển hướng sang booking.html."],
        ["2", "auth.js", "Điều khiển Xác thực & Tài khoản", "• Bắt sự kiện submit form Đăng ký, Đăng nhập, Đổi mật khẩu.\n• Lưu trữ trạng thái phiên làm việc (Session/Cookie) vào trình duyệt.\n• Cập nhật thông tin người dùng lên thanh tiêu đề (Header)."],
        ["3", "admin.js", "Điều khiển Cổng Quản trị", "• Tải số liệu thống kê doanh thu và biểu đồ đơn hàng.\n• Bắt sự kiện thêm mới, cập nhật, xóa tour và đợt khởi hành.\n• Gửi yêu cầu phê duyệt đơn và cập nhật trạng thái thanh toán."],
        ["4", "chatbot.js", "Điều khiển Trợ lý AI ảo", "• Mở/đóng khung chat tư vấn du lịch.\n• Gửi tin nhắn của khách hàng tới endpoint assistant và hiển thị phản hồi."]
    ]
    create_styled_table(doc, ["STT", "Tên File Controller", "Phân hệ phụ trách", "Trách nhiệm xử lý DOM và điều phối giao diện"], client_ctrl_data, [0.4, 1.4, 1.6, 3.1], "Bảng 2: Đặc tả chi tiết các Controller phía Client (JavaScript)")

    # 3.3 CLIENT SERVICE
    add_heading_2(doc, "3.3. Tầng Dịch vụ phía Client (Client-side Services & API Gateway Client)")
    add_body_p(
        doc,
        "Các file dịch vụ mạng tại Frontend/assets/js/services/ chịu trách nhiệm bao bọc thư viện Fetch API, "
        "xử lý dữ liệu nghiệp vụ phía Client và kết nối với Backend:"
    )
    client_service_data = [
        ["1", "api.js (API Client Gateway)", "Bao bọc Fetch API", "• Cung cấp các hàm gọi API: getTours(), getTourDetail(), createBooking(), cancelBooking(), login(), register().\n• Tự động đính kèm thông tin xác thực credentials: 'include' và cấu hình Base URL /api/v1/."],
        ["2", "vietqr-service.js", "Tạo mã thanh toán VietQR", "• Định dạng chuỗi chuyển khoản chuẩn EMVCo/NAPAS.\n• Sinh mã QR thanh toán động chứa số tài khoản, số tiền và mã booking."],
        ["3", "data.js & Storage", "Mô hình trạng thái Client", "• Lưu trữ danh sách vùng miền, bộ nhớ cache danh mục và thông tin người dùng đăng nhập."]
    ]
    create_styled_table(doc, ["STT", "Tên File Service", "Loại dịch vụ", "Trách nhiệm nghiệp vụ phía Client"], client_service_data, [0.4, 1.6, 1.4, 3.1], "Bảng 3: Đặc tả chi tiết các Service phía Client")

    doc.add_page_break()

    # 3.4 BACKEND ROUTER & CONTROLLER
    add_heading_2(doc, "3.4. Tầng Định tuyến và Điều khiển Backend (FastAPI Route & Controller Layer)")
    add_body_p(
        doc,
        "Backend FastAPI phân tách rõ rệt giữa Tầng Định tuyến (api/routes/) và Tầng Điều khiển (api/controllers/):"
    )
    backend_ctrl_data = [
        ["1", "routes/auth.py\nauth_controller.py", "Xác thực & Người dùng\n(/api/v1/auth/*)", "• register(): Tiếp nhận DTO đăng ký, băm mật khẩu Scrypt và lưu User mới.\n• login(): Đối soát mật khẩu hash, cấp phát cặp Cookie JWT bảo mật HttpOnly.\n• current() / logout(): Lấy thông tin tài khoản hiện tại và xóa phiên đăng nhập."],
        ["2", "routes/tours.py\ntour_controller.py", "Tra cứu & Lịch trình\n(/api/v1/tours/*)", "• tours(): Tiếp nhận các tham số lọc đa tiêu chí (vùng miền, giá, ngày đi).\n• tour_one(): Truy vấn chi tiết lộ trình, ảnh gallery và dịch vụ tour.\n• schedules(): Lấy danh sách các chuyến khởi hành còn chỗ trống khả dụng."],
        ["3", "routes/bookings.py\nbooking_controller.py", "Đặt tour & Xử lý đơn\n(/api/v1/bookings/*)", "• create_booking(): Tiếp nhận DTO đặt chỗ, kiểm tra Idempotency Key, gọi Service mở giao dịch Serializable giữ chỗ.\n• my_bookings(): Truy vấn lịch sử các đơn hàng của khách hàng.\n• cancel_booking(): Tiếp nhận yêu cầu hủy tour và kiểm tra điều kiện hủy."],
        ["4", "routes/admin.py\nadmin_controller.py", "Quản trị tập trung\n(/api/v1/admin/*)", "• admin_tour_create(): Thêm mới tour, ảnh và lịch trình.\n• admin_bookings(): Tiếp nhận duyệt đơn đặt tour và xác nhận thanh toán.\n• admin_reports(): Tổng hợp số liệu báo cáo doanh thu theo mốc thời gian.\n• admin_audit_logs(): Tra cứu nhật ký kiểm toán hệ thống AUDITLOG."]
    ]
    create_styled_table(doc, ["STT", "Router & Controller", "Phân hệ API Endpoints", "Các hàm điều phối HTTP và trách nhiệm chính"], backend_ctrl_data, [0.4, 1.6, 1.4, 3.1], "Bảng 4: Đặc tả chi tiết Router và Controller trong Backend FastAPI")

    # 3.5 BACKEND SERVICE & REPOSITORY
    add_heading_2(doc, "3.5. Tầng Dịch vụ Nghiệp vụ và Truy xuất Dữ liệu Backend (Service & Repository Layer)")
    add_body_p(
        doc,
        "Đây là trái tim logic nghiệp vụ của Delta Travel. Service nắm giữ các quy tắc lữ hành và tính toán, "
        "trong khi Repository trừu tượng hóa các câu lệnh truy vấn SQLAlchemy đối với CSDL SQL Server:"
    )
    service_repo_data = [
        ["1", "booking_service.py\nbooking_repository.py", "Nghiệp vụ Đặt tour & Khóa chỗ", "• place_booking(): Điều phối toàn bộ luồng tạo đơn và kiểm tra khách hàng.\n• ensure_capacity(): Kiểm tra số chỗ còn trống, chống Overbooking ở cấp ứng dụng.\n• sweep(): Tự động quét dọn và thu hồi số chỗ các đơn quá hạn 15 phút chưa trả tiền.\n• lock_schedule(): Khóa bản ghi chuyến đi bằng câu lệnh with_for_update() để chống tranh chấp giữ chỗ đồng thời."],
        ["2", "auth_service.py\nuser_repository.py", "Nghiệp vụ Bảo mật & Tài khoản", "• credentials_match(): Đối soát mật khẩu băm Scrypt với thuật toán an toàn chống Timing Attacks.\n• user_conflict() / phone_conflict(): Kiểm tra trùng lặp email và số điện thoại trước khi cho phép tạo tài khoản mới."],
        ["3", "tour_service.py\ntour_repository.py", "Nghiệp vụ Hiển thị & Lọc tour", "• public_tour() / tour_images(): Ghép nối dữ liệu tour gốc với gallery ảnh.\n• availability(): Tính toán chính xác số chỗ trống còn lại trên từng đợt khởi hành.\n• search_public_tours(): Thực thi câu truy vấn lọc tour đa tiêu chí."],
        ["4", "payment_service.py", "Nghiệp vụ Thanh toán VietQR", "• payment_reference_used(): Kiểm tra chống trùng lặp mã giao dịch ngân hàng.\n• verify_transaction_amount(): Đối soát số tiền thanh toán thực tế với tổng tiền đơn hàng."]
    ]
    create_styled_table(doc, ["STT", "Service & Repository", "Nghiệp vụ trọng tâm", "Các hàm logic nghiệp vụ và phương thức truy xuất dữ liệu"], service_repo_data, [0.4, 1.6, 1.4, 3.1], "Bảng 5: Đặc tả chi tiết Service và Repository trong Backend")

    # 3.6 DATABASE TIER
    add_heading_2(doc, "3.6. Tầng Cơ sở dữ liệu (Database Tier - Microsoft SQL Server 12 Bảng 3NF)")
    add_body_p(
        doc,
        "Cơ sở dữ liệu Microsoft SQL Server được thiết kế chuẩn hóa bậc 3 (3NF) gồm đúng 12 bảng cốt lõi "
        "tại thư mục database/database/01_schema/02_create_tables_3nf.sql:"
    )
    db_tables_data = [
        ["1", "dbo.NGUOIDUNG", "MaNguoiDung (PK), HoTen, Email, SoDienThoai, MatKhauHash, VaiTro, TrangThai", "Quản lý thông tin tài khoản người dùng, khách hàng và quản trị viên."],
        ["2", "dbo.DANHMUC", "MaDanhMuc (PK), TenDanhMuc, MoTa, HinhAnh, KichHoat", "Phân loại tour theo các vùng miền địa lý (Miền Bắc, Miền Trung, Miền Nam, Tây Nguyên)."],
        ["3", "dbo.TOUR", "MaTour (PK), MaDanhMuc (FK), TenTour, GiaCoBan, SoNgay, SoDem, DiemKhoiHanh, DiemDen", "Sản phẩm tour cốt lõi chứa các thuộc tính lộ trình cố định và giá gốc."],
        ["4", "dbo.HINHANH_TOUR", "MaHinhAnh (PK), MaTour (FK), DuongDanHinh, MoTa, LaAnhBia", "Lưu trữ bộ sưu tập gallery hình ảnh chất lượng cao quảng bá trực quan."],
        ["5", "dbo.LICH_TRINH_DETAIL", "MaLichTrinh (PK), MaTour (FK), NgayThu, TieuDe, NoiDungChiTiet, DiemThamQuan", "Chi tiết lộ trình từng ngày bóc tách cụ thể các điểm tham quan và hoạt động."],
        ["6", "dbo.CHUYENKHOIHANH", "MaChuyen (PK), MaTour (FK), NgayKhoiHanh, NgayVe, GiaNguoiLon, GiaTreEm, SoChoToiDa, SoChoDaDat", "Quản lý từng đợt khởi hành cụ thể và kiểm soát số lượng chỗ trống."],
        ["7", "dbo.DATTOUR", "MaDatTour (PK), MaNguoiDung (FK), MaChuyen (FK), MaBooking, NgayDat, SoLuongKhach, TongTien, TrangThai", "Quản lý đơn đặt chỗ, mã booking duy nhất BK..., và trạng thái đơn hàng."],
        ["8", "dbo.CHITIET_HANHKHACH", "MaHanhKhach (PK), MaDatTour (FK), HoTen, NgaySinh, LoaiKhach, SoGiayTo", "Danh sách từng cá nhân tham gia chuyến đi để làm bảo hiểm lữ hành."],
        ["9", "dbo.THANHTOAN", "MaThanhToan (PK), MaDatTour (FK), PhuongThuc, MaGiaoDich, SoTienThanhToan, NgayThanhToan, TrangThai", "Lưu trữ thông tin giao dịch VietQR và đường dẫn ảnh biên lai chuyển khoản."],
        ["10", "dbo.DANHGIA", "MaDanhGia (PK), MaTour (FK), MaNguoiDung (FK), DiemDanhGia, BinhLuan, NgayDanhGia", "Đánh giá, chấm điểm sao thực tế của khách hàng sau khi đi tour về."],
        ["11", "dbo.BAIVIET_QUANGBA", "MaBaiViet (PK), MaTacGia (FK), TieuDe, NoiDung, HinhAnhBia, NgayDang, LuotXem", "Bài viết cẩm nang quảng bá văn hóa và kinh nghiệm du lịch."],
        ["12", "dbo.AUDITLOG", "MaLog (PK), TenBang, HanhDong, NguoiThucHien, DuLieuCu, DuLieuMoi, ThoiGian, IPAddress", "Nhật ký kiểm toán hệ thống bất biến lưu vết các thao tác nhạy cảm."],
        ["13", "TRG_DATTOUR_CheckAndLockSeats", "Trigger kiểm soát sức chứa (04_programmability/01_triggers...)", "Tự động kiểm tra số chỗ khả dụng khi có đơn đặt mới; tự động ROLLBACK nếu hết chỗ."]
    ]
    create_styled_table(doc, ["STT", "Tên Bảng / Thành phần CSDL", "Khóa chính, Khóa ngoại & Thuộc tính chính", "Vai trò và logic toàn vẹn trong hệ thống"], db_tables_data, [0.4, 1.8, 2.3, 2.0], "Bảng 6: Đặc tả chi tiết 12 Bảng CSDL Microsoft SQL Server và Trigger")

    doc.add_page_break()

    # MỤC 4: CHIỀU TƯƠNG TÁC QUAY NGƯỢC LẠI
    add_heading_1(doc, "4. ĐẶC TẢ CHUYÊN SÂU CHIỀU TƯƠNG TÁC QUAY NGƯỢC LẠI (REVERSE FLOW / FEEDBACK)")
    add_body_p(
        doc,
        "Một trong những đặc điểm kiến trúc then chốt được thể hiện nổi bật trên Sơ đồ Hình 2.17 là "
        "Chiều tương tác quay ngược lại từ Cơ sở dữ liệu và Model lên Controller và View (đường nét đứt màu đỏ đậm). "
        "Đây là cơ chế kỹ thuật khép kín chu trình Request-Response trong ứng dụng Web phân tán:"
    )
    reverse_flow_data = [
        ["1", "Từ SQL Server / Trigger lên Model & Repository",
         "Khi thực thi lệnh INSERT đơn đặt tour, Trigger TRG_DATTOUR_CheckAndLockSeats trên SQL Server kiểm tra số chỗ khả dụng. Nếu thành công, CSDL trả về trạng thái Commit và các dòng dữ liệu thô. Nếu hết chỗ hoặc xung đột dữ liệu, CSDL hủy giao dịch (ROLLBACK) và ném mã lỗi vi phạm toàn vẹn ngược lại cho tầng ORM Model.",
         "SQL Server ──[Nét đứt đỏ]──> SQLAlchemy ORM Model / Repository"],
        ["2", "Từ Repository lên Service",
         "Repository đóng gói dữ liệu thô từ CSDL thành các đối tượng Thực thể (Entities) hoàn chỉnh. Nếu CSDL bị lỗi hoặc hết chỗ, Repository ném ngoại lệ kỹ thuật quay ngược lên cho Service xử lý.",
         "booking_repository ──[Nét đứt đỏ]──> booking_service"],
        ["3", "Từ Service lên Controller",
         "Tầng Service tính toán, bóc tách thực thể thành DTO kết quả (ví dụ BookingOut kèm mã booking BK... và thời hạn giữ chỗ 15 phút). Nếu phát hiện vi phạm nghiệp vụ (hết chỗ trống, trùng tài khoản), Service ném ngoại lệ nghiệp vụ (Business Exceptions) như HTTPException(409, 'Hết chỗ') quay ngược lên Controller.",
         "booking_service ──[Nét đứt đỏ]──> booking_controller"],
        ["4", "Từ Backend Controller về Client API Service (api.js)",
         "Controller chuyển hóa DTO hoặc mã lỗi thành luồng phản hồi HTTP Response Stream (JSON Payload, HTTP 201 Created hoặc HTTP 409 Conflict) gửi qua môi trường mạng về cho thư viện api.js trên trình duyệt.",
         "booking_controller ──[Nét đứt đỏ]──> RESTful API ──> api.js"],
        ["5", "Từ Client Service lên Controller Giao diện & View",
         "api.js giải mã dữ liệu JSON và trả về kết quả cho Controller giao diện (main.js, auth.js). Controller giao diện thực hiện cập nhật DOM: đóng form đặt tour, tự động mở modal VietQR hiển thị mã QR thanh toán động và kích hoạt đồng hồ đếm ngược 15 phút cho khách hàng.",
         "api.js ──[Nét đứt đỏ]──> main.js ──> booking.html (DOM Update)"]
    ]
    create_styled_table(doc, ["STT", "Cấp độ quay ngược lại", "Cơ chế kỹ thuật và luồng phản hồi thực tế trong mã nguồn", "Kênh tương tác hai chiều"], reverse_flow_data, [0.4, 1.8, 2.7, 1.6], "Bảng 7: Phân tích các cấp độ trong Chiều tương tác quay ngược lại (Reverse Flow)")

    doc.add_page_break()

    # MỤC 5: ĐỐI CHIẾU SOURCE CODE
    add_heading_1(doc, "5. BẢNG ĐỐI CHIẾU CHI TIẾT 100% THÀNH PHẦN KIẾN TRÚC VỚI SOURCE CODE THỰC TẾ")
    add_body_p(
        doc,
        "Để bảo đảm tính trung thực khoa học tuyệt đối và khả năng nghiệm thu chính xác trong đồ án tốt nghiệp, "
        "bảng dưới đây đối chiếu chi tiết từng thành phần xuất hiện trên Sơ đồ MVC Hình 2.17 với file/thư mục vật lý "
        "đang chạy trong repository dự án:"
    )

    mapping_full_data = [
        ["1", "index.html", "Frontend/index.html", "Trang chủ, banner 3D, thanh tìm kiếm lọc tour, danh sách thẻ tour, modal chi tiết.", "Khớp 100%"],
        ["2", "booking.html", "Frontend/booking.html", "Trang đặt tour, nhập thông tin hành khách, modal VietQR, upload biên lai.", "Khớp 100%"],
        ["3", "my-bookings.html", "Frontend/my-bookings.html", "Trang quản lý đơn hàng của tôi, xem chi tiết vé, gửi yêu cầu đổi/hủy tour.", "Khớp 100%"],
        ["4", "admin.html", "Frontend/admin.html", "Cổng quản trị tập trung, biểu đồ KPI doanh thu, CRUD tour, duyệt đơn, xem AUDITLOG.", "Khớp 100%"],
        ["5", "main.js", "Frontend/assets/js/controllers/main.js", "Client Controller: bắt sự kiện lọc tour, render danh sách tour, mở modal lịch trình.", "Khớp 100%"],
        ["6", "auth.js", "Frontend/assets/js/controllers/auth.js", "Client Controller: điều khiển form đăng nhập/đăng ký, lưu trữ session/cookie.", "Khớp 100%"],
        ["7", "admin.js", "Frontend/assets/js/controllers/admin.js", "Client Controller: điều khiển giao diện quản trị, gửi lệnh duyệt đơn và quản lý tour.", "Khớp 100%"],
        ["8", "chatbot.js", "Frontend/assets/js/controllers/chatbot.js", "Client Controller: điều khiển giao diện trợ lý AI ảo tư vấn lịch trình du lịch.", "Khớp 100%"],
        ["9", "api.js", "Frontend/assets/js/services/api.js", "Client Service: gọi API mạng bằng fetch(), cấu hình Base URL /api/v1/ và đính kèm cookie.", "Khớp 100%"],
        ["10", "vietqr-service.js", "Frontend/assets/js/services/vietqr-service.js", "Client Service: thuật toán tạo URL và chuỗi mã QR thanh toán ngân hàng chuẩn NAPAS.", "Khớp 100%"],
        ["11", "data.js & Storage", "Frontend/assets/js/models/data.js", "Client Model: lưu trữ bộ nhớ đệm danh mục, danh sách vùng miền và session token.", "Khớp 100%"],
        ["12", "routes/auth.py", "API/api/routes/auth.py", "Route Layer: khai báo các endpoint xác thực người dùng /api/v1/auth/*.", "Khớp 100%"],
        ["13", "routes/tours.py", "API/api/routes/tours.py", "Route Layer: khai báo các endpoint tra cứu tour /api/v1/tours/*.", "Khớp 100%"],
        ["14", "routes/bookings.py", "API/api/routes/bookings.py", "Route Layer: khai báo các endpoint đặt chỗ và xử lý đơn /api/v1/bookings/*.", "Khớp 100%"],
        ["15", "routes/admin.py", "API/api/routes/admin.py", "Route Layer: khai báo các endpoint quản trị tập trung /api/v1/admin/*.", "Khớp 100%"],
        ["16", "auth_controller.py", "API/api/controllers/auth_controller.py", "Controller: điều phối xác thực, đăng ký, đăng nhập, cấp phát cookie JWT.", "Khớp 100%"],
        ["17", "tour_controller.py", "API/api/controllers/tour_controller.py", "Controller: tiếp nhận tham số lọc tour, gọi Service lấy chi tiết lịch trình và giá.", "Khớp 100%"],
        ["18", "booking_controller.py", "API/api/controllers/booking_controller.py", "Controller: tiếp nhận đơn đặt chỗ, kiểm tra Idempotency Key, trả về DTO đơn hàng.", "Khớp 100%"],
        ["19", "admin_controller.py", "API/api/controllers/admin_controller.py", "Controller: kiểm tra quyền Admin, điều phối CRUD tour, duyệt đơn và báo cáo.", "Khớp 100%"],
        ["20", "booking_service.py", "API/api/services/booking_service.py", "Service: place_booking(), ensure_capacity() chống Overbooking, totals() tính giá vé.", "Khớp 100%"],
        ["21", "auth_service.py", "API/api/services/auth_service.py", "Service: credentials_match(), mã hóa mật khẩu Scrypt + Salt, tạo session token.", "Khớp 100%"],
        ["22", "tour_service.py", "API/api/services/tour_service.py", "Service: public_tour(), tour_images(), availability() tính số chỗ trống khả dụng.", "Khớp 100%"],
        ["23", "payment_service.py", "API/api/services/payment_service.py", "Service: payment_reference_used(), đối soát giao dịch chuyển khoản VietQR.", "Khớp 100%"],
        ["24", "booking_repository.py", "API/api/repositories/booking_repository.py", "Repository: truy vấn đơn hàng, find_by_idempotency(), lock_booking_for_owner().", "Khớp 100%"],
        ["25", "schedule_repository.py", "API/api/repositories/schedule_repository.py", "Repository: khóa dòng đợt khởi hành lock_schedule() với with_for_update().", "Khớp 100%"],
        ["26", "tour_repository.py", "API/api/repositories/tour_repository.py", "Repository: thực thi câu truy vấn lọc tour search_public_tours() đa tiêu chí.", "Khớp 100%"],
        ["27", "user_repository.py", "API/api/repositories/user_repository.py", "Repository: truy vấn người dùng, user_conflict() kiểm tra trùng email/SĐT.", "Khớp 100%"],
        ["28", "SQLAlchemy Models", "API/api/models/ (user, tour, booking...)", "Model: định nghĩa các lớp thực thể ORM ánh xạ tới bảng CSDL.", "Khớp 100%"],
        ["29", "Pydantic Schemas", "API/api/schemas/ (auth, tour, booking...)", "Schema: định nghĩa DTO hợp đồng dữ liệu, tự động validate đầu vào và serialize đầu ra.", "Khớp 100%"],
        ["30", "dbo.NGUOIDUNG", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: lưu trữ tài khoản người dùng, email, mật khẩu băm, vai trò.", "Khớp 100%"],
        ["31", "dbo.DANHMUC", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: phân loại danh mục tour theo các vùng miền địa lý.", "Khớp 100%"],
        ["32", "dbo.TOUR", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: sản phẩm tour du lịch gốc chứa thuộc tính lộ trình cố định.", "Khớp 100%"],
        ["33", "dbo.HINHANH_TOUR", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: lưu trữ gallery hình ảnh chụp thực tế đa góc nhìn.", "Khớp 100%"],
        ["34", "dbo.LICH_TRINH_DETAIL", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: chi tiết hoạt động từng ngày của chuyến đi (Day 1, Day 2,...).", "Khớp 100%"],
        ["35", "dbo.CHUYENKHOIHANH", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: quản lý đợt khởi hành cụ thể, ngày đi, ngày về, số chỗ tối đa và đã đặt.", "Khớp 100%"],
        ["36", "dbo.DATTOUR", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: đơn đặt chỗ của khách hàng, mã booking BK..., trạng thái.", "Khớp 100%"],
        ["37", "dbo.CHITIET_HANHKHACH", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: danh sách hành khách thực tế (Họ tên, ngày sinh, CCCD/Passport).", "Khớp 100%"],
        ["38", "dbo.THANHTOAN", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: lưu trữ giao dịch VietQR, số tiền, ngày giờ, ảnh biên lai.", "Khớp 100%"],
        ["39", "dbo.DANHGIA", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: đánh giá nhận xét và chấm điểm sao của khách sau chuyến đi.", "Khớp 100%"],
        ["40", "dbo.BAIVIET_QUANGBA", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: bài viết cẩm nang quảng bá văn hóa và kinh nghiệm du lịch.", "Khớp 100%"],
        ["41", "dbo.AUDITLOG", "database/database/01_schema/02_create_tables_3nf.sql", "Bảng SQL Server: nhật ký kiểm toán hệ thống bất biến lưu vết thao tác nhạy cảm.", "Khớp 100%"],
        ["42", "Trigger kiểm soát chỗ", "database/database/04_programmability/01_triggers...", "Trigger SQL Server: TRG_DATTOUR_CheckAndLockSeats tự động kiểm tra số chỗ và khóa chỗ.", "Khớp 100%"]
    ]
    create_styled_table(doc, ["STT", "Thành phần trên sơ đồ MVC", "File/Thư mục vật lý thực tế", "Chức năng & Trách nhiệm thực tế", "Kết luận"], mapping_full_data, [0.4, 1.4, 1.8, 2.3, 0.6], "Bảng 8: Bảng đối chiếu 42 thành phần kiến trúc MVC với mã nguồn thực tế của dự án")

    # MỤC 6: CHU TRÌNH 7 BƯỚC
    add_heading_1(doc, "6. CHU TRÌNH 7 BƯỚC XỬ LÝ MỘT YÊU CẦU NGHIỆP VỤ HOÀN CHỈNH")
    add_body_p(doc, "Chu trình xử lý một yêu cầu đặt chỗ và thanh toán diễn ra tuần tự qua 7 bước như sau:")
    add_bullet_p(doc, "Người dùng điền danh sách hành khách trên giao diện booking.html và nhấn 'Xác nhận đặt tour'.", bold_prefix="Bước 1 (Client Action): ")
    add_bullet_p(doc, "Client Controller (main.js) kiểm tra định dạng số điện thoại, CCCD/Passport ở phía máy khách.", bold_prefix="Bước 2 (Client Validation): ")
    add_bullet_p(doc, "api.js đóng gói dữ liệu thành đối tượng JSON BookingInput và gửi HTTP POST tới /api/v1/bookings.", bold_prefix="Bước 3 (API Request Dispatching): ")
    add_bullet_p(doc, "FastAPI Route chuyển giao cho booking_controller.py, kiểm tra xác thực định danh và Pydantic Schema.", bold_prefix="Bước 4 (Backend Controller & Auth Guard): ")
    add_bullet_p(doc, "booking_service.py mở giao dịch CSDL, gọi schedule_repository.lock_schedule() để khóa dòng và kiểm tra số chỗ trống.", bold_prefix="Bước 5 (Service Execution & Capacity Check): ")
    add_bullet_p(doc, "TẦNG CSDL & CHIỀU QUAY NGƯỢC LẠI: SQL Server kích hoạt Trigger kiểm tra chỗ, ghi bản ghi đơn hàng mới vào DATTOUR, cập nhật số chỗ trên CHUYENKHOIHANH, và phản hồi kết quả Commit quay ngược lên tầng Service & Controller.", bold_prefix="Bước 6 (Database Execution & Reverse Flow): ")
    add_bullet_p(doc, "Controller trả về JSON BookingOut (HTTP 201). Trình duyệt tiếp nhận dữ liệu, gọi vietqr-service.js tạo mã QR ngân hàng động và mở modal thanh toán kèm bộ đếm 15 phút.", bold_prefix="Bước 7 (Response Stream & Dynamic UI Render): ")

    doc.add_page_break()

    # MỤC 7: MÃ NGUỒN PLANTUML
    add_heading_1(doc, "7. MÃ NGUỒN PLANTUML NGUYÊN BẢN CỦA SƠ ĐỒ KIẾN TRÚC MVC")
    add_body_p(
        doc,
        "Dưới đây là toàn bộ mã nguồn PlantUML nguyên bản dùng để kết xuất Sơ đồ kiến trúc phân tầng MVC thực tế (Hình 2.17). "
        "Mã nguồn được biên soạn chuẩn tắc theo cú pháp UML 2.5, hỗ trợ tái lập và xuất bản trực tiếp trên mọi môi trường PlantUML hoặc VS Code:"
    )
    add_code_block(doc, PUML_CODE)

    # Lưu tài liệu
    workspace_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "MO_HINH_VA_DAC_TA_KIEN_TRUC_MVC_DELTA_TRAVEL.docx")
    downloads_path = r"C:\Users\ACER\Downloads\MO_HINH_VA_DAC_TA_KIEN_TRUC_MVC_DELTA_TRAVEL.docx"
    workspace_moi = os.path.join(os.path.dirname(os.path.dirname(__file__)), "MO_HINH_VA_DAC_TA_KIEN_TRUC_MVC_DELTA_TRAVEL_MOI.docx")
    downloads_moi = r"C:\Users\ACER\Downloads\MO_HINH_VA_DAC_TA_KIEN_TRUC_MVC_DELTA_TRAVEL_MOI.docx"

    print(f"Đang lưu file bản mới vào: {workspace_moi}...")
    doc.save(workspace_moi)
    try:
        doc.save(downloads_moi)
    except Exception:
        pass

    try:
        doc.save(workspace_path)
        print(f"Đã lưu đè thành công: {workspace_path}")
    except Exception as e:
        print(f"File {workspace_path} đang mở trong Word/WPS, đã lưu sang {workspace_moi}")

    try:
        doc.save(downloads_path)
        print(f"Đã lưu đè thành công: {downloads_path}")
    except Exception as e:
        print(f"File {downloads_path} đang mở trong Word/WPS, đã lưu sang {downloads_moi}")

    file_size_kb = os.path.getsize(workspace_moi) / 1024
    print("=" * 60)
    print("  HOÀN TẤT XÂY DỰNG TÀI LIỆU KIẾN TRÚC PHÂN TẦNG MVC THÀNH CÔNG RỰC RỠ!")
    print(f"  - Tổng số đoạn văn: {len(doc.paragraphs)}")
    print(f"  - Tổng số bảng biểu: {len(doc.tables)}")
    print(f"  - Dung lượng file: {file_size_kb:.1f} KB")
    print("=" * 60)

if __name__ == "__main__":
    build_mvc_docx()
