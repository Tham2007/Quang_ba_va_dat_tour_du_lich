import os
import re

print("Starting to assemble complete chapter2_builder.py...")

# Read build_use_case_docx.py
with open("scripts/build_use_case_docx.py", "r", encoding="utf-8") as f:
    uc_text = f.read()

# Read build_mvc_docx.py
with open("scripts/build_mvc_docx.py", "r", encoding="utf-8") as f:
    mvc_text = f.read()

# 1. Extract use case section content: from 'add_heading_1(doc, "1. TỔNG QUAN HỆ THỐNG VÀ DANH SÁCH TÁC NHÂN' to before target_ws
uc_start = uc_text.find('add_heading_1(doc, "1. TỔNG QUAN HỆ THỐNG VÀ DANH SÁCH TÁC NHÂN')
uc_end = uc_text.find('target_ws = os.path.abspath("MO_HINH_VA_DAC_TA_USE_CASE_DELTA_TRAVEL.docx")')
if uc_end == -1:
    uc_end = uc_text.find('target_ws =')
uc_content = uc_text[uc_start:uc_end].strip()

# Adjust headings in uc_content: change add_heading_1 to add_heading_3
uc_content_adjusted = uc_content.replace('add_heading_1(doc, "1. TỔNG QUAN HỆ THỐNG VÀ DANH SÁCH TÁC NHÂN (ACTORS)")', 'add_heading_3(doc, "Tác nhân (Actors) và Vai trò nghiệp vụ trong Sơ đồ Use Case")')
uc_content_adjusted = uc_content_adjusted.replace('add_heading_1(doc, "2. SƠ ĐỒ UML USE CASE HOÀN CHỈNH CỦA HỆ THỐNG DELTA TRAVEL")', 'add_heading_3(doc, "Sơ đồ UML Use Case tổng quát hợp nhất hoàn chỉnh (Hình 1)")')
uc_content_adjusted = uc_content_adjusted.replace('add_heading_1(doc, "3. MA TRẬN PHÂN QUYỀN VÀ TỔNG HỢP CÁC QUAN HỆ UML")', 'add_heading_3(doc, "Ma trận phân quyền và Tổng hợp các quan hệ UML (Include, Extend, Generalization)")')
uc_content_adjusted = uc_content_adjusted.replace('add_heading_1(doc, "4. ĐẶC TẢ CHI TIẾT TOÀN BỘ 23 USE CASE")', 'add_heading_3(doc, "Đặc tả chi tiết từng đỉnh chức năng cho toàn bộ 23 Use Case (UC01 - UC23)")')
uc_content_adjusted = uc_content_adjusted.replace('add_heading_1(doc, "5. PHỤ LỤC MÃ NGUỒN PLANTUML (.PUML) CHO SƠ ĐỒ HOÀN CHỈNH")', 'add_heading_3(doc, "Mã nguồn PlantUML nguyên bản của Sơ đồ Use Case hợp nhất")')

# 2. Extract MVC section content: from 'add_heading_1(doc, "1. TỔNG QUAN VÀ BẢN CHẤT KIẾN TRÚC' to before workspace_path
mvc_start = mvc_text.find('add_heading_1(doc, "1. TỔNG QUAN VÀ BẢN CHẤT KIẾN TRÚC')
mvc_end = mvc_text.find('workspace_path = os.path.join(os.path.dirname(os.path.dirname(__file__))')
if mvc_end == -1:
    mvc_end = mvc_text.find('workspace_path =')
mvc_content = mvc_text[mvc_start:mvc_end].strip()

# Adjust headings in mvc_content to nest properly under 2.3.3
mvc_content_adjusted = mvc_content.replace('add_heading_1(doc, "1. TỔNG QUAN VÀ BẢN CHẤT KIẾN TRÚC THỰC TẾ HỆ THỐNG DELTA TRAVEL")', 'add_heading_3(doc, "Tổng quan và Bản chất kiến trúc phân tầng MVC thực tế")')
mvc_content_adjusted = mvc_content_adjusted.replace('add_heading_1(doc, "2. SƠ ĐỒ KIẾN TRÚC PHÂN TẦNG MVC THỰC TẾ HỆ THỐNG DELTA TRAVEL")', 'add_heading_3(doc, "Sơ đồ kiến trúc phân tầng MVC thực tế hệ thống Delta Travel")')
mvc_content_adjusted = mvc_content_adjusted.replace('add_heading_1(doc, "3. ĐẶC TẢ CHI TIẾT CÁC THÀNH PHẦN THEO TRÁCH NHIỆM KIẾN TRÚC")', 'add_heading_3(doc, "Đặc tả chi tiết các phân tầng theo trách nhiệm kiến trúc MVC")')
mvc_content_adjusted = mvc_content_adjusted.replace('add_heading_1(doc, "4. ĐẶC TẢ CHUYÊN SÂU CHIỀU TƯƠNG TÁC QUAY NGƯỢC LẠI (REVERSE FLOW / FEEDBACK TỪ DATABASE/MODELS VỀ CONTROLLERS VÀ CLIENT)")', 'add_heading_3(doc, "Đặc tả chuyên sâu Chiều tương tác quay ngược lại (Reverse Feedback Flow)")')
mvc_content_adjusted = mvc_content_adjusted.replace('add_heading_1(doc, "5. BẢNG ĐỐI CHIẾU CHI TIẾT 100% THÀNH PHẦN KIẾN TRÚC VỚI SOURCE CODE THỰC TẾ (50 THÀNH PHẦN)")', 'add_heading_3(doc, "Bảng đối chiếu 100% thành phần kiến trúc với mã nguồn thực tế (50 components)")')
mvc_content_adjusted = mvc_content_adjusted.replace('add_heading_1(doc, "6. CHU TRÌNH 7 BƯỚC XỬ LÝ MỘT YÊU CẦU NGHIỆP VỤ HOÀN CHỈNH")', 'add_heading_3(doc, "Chu trình 7 bước xử lý một yêu cầu nghiệp vụ hoàn chỉnh (Request-Response Lifecycle)")')
mvc_content_adjusted = mvc_content_adjusted.replace('add_heading_1(doc, "7. MÃ NGUỒN PLANTUML NGUYÊN BẢN CỦA SƠ ĐỒ KIẾN TRÚC MVC")', 'add_heading_3(doc, "Mã nguồn PlantUML nguyên bản của Sơ đồ kiến trúc phân tầng MVC")')

# Helper to indent code properly
def indent_code(text, spaces=4):
    lines = text.splitlines()
    indented = []
    prefix = " " * spaces
    for line in lines:
        if line.strip():
            # strip existing leading whitespace then add prefix
            indented.append(prefix + line.strip())
        else:
            indented.append("")
    return "\n".join(indented)

uc_indented = indent_code(uc_content_adjusted, 4)
mvc_indented = indent_code(mvc_content_adjusted, 4)

# 3. Read original chapter2_builder.py to get Section 2.1, 2.2 up to 2.3
with open("scripts/chapter2_builder.py", "r", encoding="utf-8") as f:
    c2_orig = f.read()

pos_2_3 = c2_orig.find('add_heading_2(doc, "2.3: Thiết kế hệ thống :")')
c2_part1 = c2_orig[:pos_2_3].strip()

# Make sure c2_part1 contains def build_chapter_2(doc):
lines_part1 = c2_part1.splitlines()
b2_idx = 0
for idx, l in enumerate(lines_part1):
    if "def build_chapter_2(doc):" in l:
        b2_idx = idx
        break
c2_body_part1 = "\n".join(lines_part1[b2_idx:])

# Extract 2.3.2 Activity section from original
act_start = c2_orig.find('add_heading_3(doc, "2.3.2 activity: 5-7 luồng hoạt động text + code -> ảnh")')
act_end = c2_orig.find('add_heading_3(doc, "2.3.3: Class: từ phát biểu bài toán + và use case + activity để sinh ra ảnh mô tả theo chuẩn MVC")')
act_content = c2_orig[act_start:act_end].strip()
act_indented = indent_code(act_content, 4)

# 4. Check if 12 tables data dictionary is complete in c2_body_part1, if not, create complete 12 tables
tables_12_code = """
    # Từ điển dữ liệu chi tiết đầy đủ 12 bảng theo SSMS Database Diagram
    add_body_p(
        doc,
        "Dưới đây là từ điển dữ liệu (Data Dictionary) đặc tả chi tiết cấu trúc thuộc tính, kiểu dữ liệu, "
        "ràng buộc và vai trò nghiệp vụ của toàn bộ 12 bảng trong cơ sở dữ liệu Microsoft SQL Server:",
        bold_prefix="Từ điển dữ liệu chi tiết 12 bảng (Khớp 100% SSMS Database Diagram): "
    )

    # 1. NGUOIDUNG
    nguoidung_cols = [
        ["MaNguoiDung", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh duy nhất của người dùng"],
        ["HoTen", "NVARCHAR(100)", "None", "Không", "Họ và tên đầy đủ của người dùng"],
        ["Email", "VARCHAR(100)", "UNIQUE, CK_Email", "Không", "Địa chỉ email đăng nhập hệ thống"],
        ["SoDienThoai", "VARCHAR(15)", "UNIQUE, CK_SDT", "Không", "Số điện thoại liên lạc chính"],
        ["MatKhau", "VARCHAR(255)", "None", "Không", "Chuỗi băm mật khẩu bảo mật (Bcrypt/Argon2)"],
        ["DiaChi", "NVARCHAR(200)", "None", "Có", "Địa chỉ thường trú liên hệ"],
        ["TrangThai", "BIT", "DEFAULT 1", "Không", "Trạng thái kích hoạt tài khoản (1: Hoạt động, 0: Khóa)"],
        ["NgayTao", "DATETIME", "DEFAULT GETDATE()", "Không", "Thời điểm khởi tạo tài khoản"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], nguoidung_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4a: Đặc tả cấu trúc bảng NGUOIDUNG (Tài khoản người dùng)")

    # 2. DANHMUC
    danhmuc_cols = [
        ["MaDanhMuc", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh danh mục vùng miền"],
        ["TenDanhMuc", "NVARCHAR(100)", "UNIQUE", "Không", "Tên vùng miền (Miền Bắc, Miền Trung, Miền Nam, Biển đảo)"],
        ["MoTa", "NVARCHAR(500)", "None", "Có", "Mô tả khái quát về nét đặc trưng vùng miền"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], danhmuc_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4b: Đặc tả cấu trúc bảng DANHMUC (Phân loại du lịch)")

    # 3. TOUR
    tour_cols = [
        ["MaTour", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh sản phẩm tour du lịch"],
        ["MaDanhMuc", "INT", "FK -> DANHMUC", "Không", "Khóa ngoại liên kết danh mục phân loại"],
        ["TenTour", "NVARCHAR(200)", "None", "Không", "Tên gọi chính thức của tour du lịch"],
        ["MoTaChiTiet", "NVARCHAR(MAX)", "None", "Có", "Mô tả tổng quan, điểm nhấn trải nghiệm"],
        ["LichTrinhTongQuan", "NVARCHAR(500)", "None", "Có", "Tóm tắt lộ trình tour ngắn gọn"],
        ["GiaKhuyenNghi", "DECIMAL(18,2)", "CK_GiaKhuyenNghi > 0", "Không", "Mức giá niêm yết tham khảo ban đầu"],
        ["HinhAnhDaiDien", "VARCHAR(255)", "None", "Có", "Đường dẫn ảnh đại diện chính của tour"],
        ["TrangThai", "BIT", "DEFAULT 1", "Không", "Trạng thái mở bán (1: Đang mở, 0: Tạm ẩn)"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], tour_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4c: Đặc tả cấu trúc bảng TOUR (Sản phẩm du lịch)")

    # 4. HINHANH_TOUR
    hinhanh_cols = [
        ["MaHinhAnh", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh hình ảnh"],
        ["MaTour", "INT", "FK -> TOUR", "Không", "Khóa ngoại liên kết tour sở hữu ảnh"],
        ["DuongDanAnh", "VARCHAR(255)", "None", "Không", "Đường dẫn file ảnh trên hệ thống tĩnh / CDN"],
        ["GhiChu", "NVARCHAR(200)", "None", "Có", "Chú thích ngữ cảnh của bức ảnh"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], hinhanh_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4d: Đặc tả cấu trúc bảng HINHANH_TOUR (Bộ sưu tập hình ảnh)")

    # 5. LICH_TRINH_DETAIL
    lichtrinh_cols = [
        ["MaLichTrinh", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh chi tiết lịch trình"],
        ["MaTour", "INT", "FK -> TOUR", "Không", "Khóa ngoại liên kết sản phẩm tour"],
        ["NgayThu", "INT", "CK_NgayThu > 0", "Không", "Số thứ tự ngày trong hành trình (Ngày 1, Ngày 2...)"],
        ["TieuDeNgay", "NVARCHAR(200)", "None", "Không", "Tiêu đề chặng hành trình trong ngày"],
        ["NoiDungChiTiet", "NVARCHAR(MAX)", "None", "Không", "Thuyết minh chi tiết các hoạt động sáng, trưa, tối"],
        ["BuaAn", "NVARCHAR(100)", "None", "Có", "Thông tin các bữa ăn bao gồm (Sáng, Trưa, Tối)"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], lichtrinh_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4e: Đặc tả cấu trúc bảng LICH_TRINH_DETAIL (Lộ trình chi tiết theo ngày)")

    # 6. CHUYENKHOIHANH
    chuyen_cols = [
        ["MaChuyen", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh chuyến khởi hành"],
        ["MaTour", "INT", "FK -> TOUR", "Không", "Khóa ngoại liên kết sản phẩm tour gốc"],
        ["NgayKhoiHanh", "DATETIME", "None", "Không", "Ngày và giờ chính thức xuất phát"],
        ["NgayKetThuc", "DATETIME", "CK_NgayVe >= NgayDi", "Không", "Ngày và giờ kết thúc hành trình"],
        ["GiaThucTe", "DECIMAL(18,2)", "CK_GiaThucTe > 0", "Không", "Giá vé thực tế áp dụng cho đợt này"],
        ["SoChoToiDa", "INT", "CK_SoChoToiDa > 0", "Không", "Sức chứa tối đa của đoàn du lịch"],
        ["SoChoDaDat", "INT", "CK_SoChoDaDat >= 0", "Không", "Số ghế đã được khóa giữ bởi các đơn đặt"],
        ["TrangThaiChuyen", "NVARCHAR(50)", "None", "Không", "Trạng thái (ConCho, HetCho, KhoiHanh, HoanTat)"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], chuyen_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4f: Đặc tả cấu trúc bảng CHUYENKHOIHANH (Lịch khởi hành và số chỗ)")

    # 7. DATTOUR
    dattour_cols = [
        ["MaDatTour", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh đơn đặt tour trực tuyến"],
        ["MaKhachHang", "INT", "FK -> NGUOIDUNG", "Không", "Khóa ngoại liên kết khách hàng đặt vé"],
        ["MaChuyen", "INT", "FK -> CHUYENKHOIHANH", "Không", "Khóa ngoại liên kết chuyến khởi hành"],
        ["NgayDat", "DATETIME", "DEFAULT GETDATE()", "Không", "Thời điểm gửi đơn đặt vé"],
        ["SoLuongKhach", "INT", "CK_SoLuongKhach > 0", "Không", "Tổng số lượng ghế giữ chỗ cho đoàn"],
        ["TongTien", "DECIMAL(18,2)", "CK_TongTien >= 0", "Không", "Tổng chi phí thanh toán của đơn đặt vé"],
        ["TrangThaiDat", "NVARCHAR(50)", "None", "Không", "Trạng thái đơn (ChoXacNhan, DaXacNhan, DaHuy)"],
        ["TrangThaiThanhToan", "NVARCHAR(50)", "None", "Không", "Trạng thái tiền (ChuaThanhToan, DaThanhToan)"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], dattour_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4g: Đặc tả cấu trúc bảng DATTOUR (Đơn đặt tour trực tuyến)")

    # 8. CHITIET_HANHKHACH
    hanhkhach_cols = [
        ["MaHanhKhach", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh hành khách"],
        ["MaDatTour", "INT", "FK -> DATTOUR", "Không", "Khóa ngoại liên kết đơn đặt tour"],
        ["HoTen", "NVARCHAR(100)", "None", "Không", "Họ và tên đầy đủ của từng hành khách"],
        ["NgaySinh", "DATE", "None", "Có", "Ngày tháng năm sinh (phục vụ bảo hiểm)"],
        ["GioiTinh", "NVARCHAR(10)", "None", "Có", "Giới tính (Nam, Nữ, Khác)"],
        ["SoDienThoai", "VARCHAR(15)", "None", "Có", "Số điện thoại liên hệ cá nhân"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], hanhkhach_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4h: Đặc tả cấu trúc bảng CHITIET_HANHKHACH (Danh sách hành khách đi kèm)")

    # 9. THANHTOAN
    thanhtoan_cols = [
        ["MaThanhToan", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh giao dịch thanh toán"],
        ["MaDatTour", "INT", "FK -> DATTOUR", "Không", "Khóa ngoại liên kết đơn đặt tour"],
        ["PhuongThuc", "NVARCHAR(50)", "None", "Không", "Phương thức (VietQR, ChuyenKhoan, TienMat)"],
        ["SoTien", "DECIMAL(18,2)", "CK_SoTien > 0", "Không", "Số tiền chuyển khoản thực tế"],
        ["NgayThanhToan", "DATETIME", "DEFAULT GETDATE()", "Không", "Thời điểm hoàn tất chuyển khoản"],
        ["MaGiaoDich", "VARCHAR(100)", "None", "Có", "Mã tham chiếu ngân hàng / biên lai đối soát"],
        ["TrangThai", "NVARCHAR(50)", "None", "Không", "Trạng thái đối soát (ChoDoiSoat, ThanhCong, ThatBai)"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], thanhtoan_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4i: Đặc tả cấu trúc bảng THANHTOAN (Đối soát giao dịch ngân hàng)")

    # 10. DANHGIA
    danhgia_cols = [
        ["MaDanhGia", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh nhận xét đánh giá"],
        ["MaDatTour", "INT", "FK -> DATTOUR", "Không", "Khóa ngoại liên kết đơn đặt tour đã hoàn thành"],
        ["SoSao", "TINYINT", "CK_SoSao BETWEEN 1 AND 5", "Không", "Điểm đánh giá chất lượng từ 1 đến 5 sao"],
        ["NoiDung", "NVARCHAR(1000)", "None", "Có", "Nội dung nhận xét, cảm nhận chuyến đi"],
        ["HinhAnh", "NVARCHAR(255)", "None", "Có", "Đường dẫn ảnh chụp thực tế đính kèm"],
        ["NgayDanhGia", "DATETIME", "DEFAULT GETDATE()", "Không", "Thời điểm gửi bài đánh giá"],
        ["TrangThaiHienThi", "BIT", "DEFAULT 0", "Không", "Trạng thái kiểm duyệt (1: Đã duyệt, 0: Chờ duyệt)"],
        ["PhanHoiAdmin", "NVARCHAR(500)", "None", "Có", "Ý kiến phản hồi từ bộ phận chăm sóc khách hàng"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], danhgia_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4j: Đặc tả cấu trúc bảng DANHGIA (Đánh giá và nhận xét chất lượng)")

    # 11. BAIVIET_QUANGBA
    baiviet_cols = [
        ["MaBaiViet", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh bài viết cẩm nang"],
        ["TieuDe", "NVARCHAR(200)", "None", "Không", "Tiêu đề bài viết quảng bá du lịch"],
        ["Slug", "VARCHAR(200)", "UNIQUE", "Không", "Chuỗi định danh URL thân thiện chuẩn SEO"],
        ["TomTat", "NVARCHAR(500)", "None", "Có", "Đoạn tóm tắt nội dung hấp dẫn người đọc"],
        ["NoiDung", "NVARCHAR(MAX)", "None", "Không", "Nội dung bài viết chi tiết kèm định dạng"],
        ["HinhAnhDaiDien", "VARCHAR(255)", "None", "Có", "Ảnh thumbnail đại diện bài viết"],
        ["LuotXem", "INT", "DEFAULT 0", "Không", "Số lượt xem bài viết của độc giả"],
        ["NgayTao", "DATETIME", "DEFAULT GETDATE()", "Không", "Thời điểm đăng tải bài viết"],
        ["TrangThai", "BIT", "DEFAULT 1", "Không", "Trạng thái hiển thị (1: Xuất bản, 0: Bản nháp)"],
        ["MaNguoiDang", "INT", "FK -> NGUOIDUNG", "Không", "Khóa ngoại liên kết tác giả quản trị biên tập"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], baiviet_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4k: Đặc tả cấu trúc bảng BAIVIET_QUANGBA (Tin tức và cẩm nang du lịch)")

    # 12. AUDITLOG
    audit_cols = [
        ["MaLog", "INT", "PK, IDENTITY(1,1)", "Không", "Mã định danh nhật ký kiểm toán"],
        ["MaNguoiThucHien", "INT", "FK -> NGUOIDUNG", "Có", "Khóa ngoại liên kết người dùng/admin thực thi"],
        ["HanhDong", "NVARCHAR(100)", "None", "Không", "Loại hành động (UPDATE_PRICE, CANCEL_BOOKING...)"],
        ["DuLieuCu", "NVARCHAR(MAX)", "None", "Có", "Dữ liệu trước khi sửa đổi dưới dạng chuỗi JSON"],
        ["DuLieuMoi", "NVARCHAR(MAX)", "None", "Có", "Dữ liệu sau khi sửa đổi dưới dạng chuỗi JSON"],
        ["ThoiGian", "DATETIME", "DEFAULT GETDATE()", "Không", "Thời điểm chính xác ghi nhận thao tác"]
    ]
    create_styled_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc / Khóa", "Null", "Mô tả nghiệp vụ"], audit_cols, [1.5, 1.2, 1.5, 0.6, 1.6], "Bảng 2.4l: Đặc tả cấu trúc bảng AUDITLOG (Nhật ký kiểm toán an ninh)")
"""

# Replace the existing tables in c2_body_part1 with tables_12_code
pos_dict_start = c2_body_part1.find('    add_body_p(\n        doc,\n        "Dưới đây là từ điển dữ liệu')
if pos_dict_start == -1:
    pos_dict_start = c2_body_part1.find('add_body_p(\n        doc,\n        "Dưới đây là từ điển dữ liệu')

pos_dict_end = c2_body_part1.find('    add_heading_3(doc, "2.2.5: Sinh database mẫu ( có dữ liệu mẫu demo)")')
if pos_dict_end == -1:
    pos_dict_end = c2_body_part1.find('add_heading_3(doc, "2.2.5: Sinh database mẫu ( có dữ liệu mẫu demo)")')

if pos_dict_start != -1 and pos_dict_end != -1:
    c2_body_part1 = c2_body_part1[:pos_dict_start] + tables_12_code + "\n" + c2_body_part1[pos_dict_end:]

full_c2 = f"""import os
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from scripts.doc_helpers import (
    add_title, add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_image_with_caption,
    create_styled_table, add_code_block, set_cell_background, set_cell_margins,
    NAVY_BLUE, STEEL_BLUE, DARK_GRAY, BODY_COLOR
)

CLEAN_IMG_DIR = os.path.join(os.path.dirname(__file__), "clean_images")

def add_use_case_spec_table(doc, uc_id, uc_name, actors, description, preconditions, postconditions, main_flow, alt_flow, relationships="Không có (Độc lập)"):
    table_title = f"Bảng đặc tả: 【{{uc_id}}】 {{uc_name}}"
    
    p_t = doc.add_paragraph()
    p_t.paragraph_format.space_before = Pt(8)
    p_t.paragraph_format.space_after = Pt(2)
    p_t.paragraph_format.keep_with_next = True
    r_t = p_t.add_run(table_title)
    r_t.font.name = "Times New Roman"
    r_t.font.size = Pt(10)
    r_t.font.bold = True
    r_t.font.color.rgb = NAVY_BLUE

    rows_data = [
        ("Mã & Tên Use Case", f"【{{uc_id}}】 {{uc_name}}"),
        ("Tác nhân tham gia (Actors)", actors),
        ("Mục tiêu & Mô tả tóm tắt", description),
        ("Tiền điều kiện (Preconditions)", preconditions),
        ("Hậu điều kiện (Postconditions)", postconditions),
        ("Luồng sự kiện chính (Basic Flow)", main_flow),
        ("Luồng sự kiện phụ / Ngoại lệ (Alternative Flows)", alt_flow),
        ("Quan hệ phụ thuộc (Relationships)", relationships)
    ]

    tbl = doc.add_table(rows=len(rows_data), cols=2)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.style = 'Table Grid'

    col_widths = [1.8, 4.7]
    for row_idx, (field, val) in enumerate(rows_data):
        row = tbl.rows[row_idx]
        cell_lbl, cell_val = row.cells[0], row.cells[1]
        
        # Style label cell
        cell_lbl.text = field
        set_cell_background(cell_lbl, "F0F4F8")
        set_cell_margins(cell_lbl, top=80, bottom=80, left=100, right=100)
        p_l = cell_lbl.paragraphs[0]
        p_l.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_l.paragraph_format.space_before = Pt(0)
        p_l.paragraph_format.space_after = Pt(0)
        for r in p_l.runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9.5)
            r.font.bold = True
            r.font.color.rgb = NAVY_BLUE
            
        # Style value cell
        cell_val.text = val
        set_cell_background(cell_val, "FFFFFF")
        set_cell_margins(cell_val, top=80, bottom=80, left=120, right=120)
        p_v = cell_val.paragraphs[0]
        p_v.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_v.paragraph_format.space_before = Pt(0)
        p_v.paragraph_format.space_after = Pt(0)
        p_v.paragraph_format.line_spacing = 1.05
        for r in p_v.runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9)
            r.font.color.rgb = BODY_COLOR
            
    for row in tbl.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = Inches(width)
            
    p_post = doc.add_paragraph()
    p_post.paragraph_format.space_before = Pt(0)
    p_post.paragraph_format.space_after = Pt(4)
    return tbl

{c2_body_part1}

    # ==========================================
    # 2.3 THIẾT KẾ HỆ THỐNG
    # ==========================================
    add_heading_2(doc, "2.3: Thiết kế hệ thống :")

    # 2.3.1 USE CASE
    add_heading_3(doc, "2.3.1 use case : bằng cách + khung cho tất cả actor + đỉnh : từng actor để sinh code UML -> plantext , sau đó sinh mô tả cho use case")
{uc_indented}

    doc.add_page_break()

    # 2.3.2 ACTIVITY
{act_indented}

    doc.add_page_break()

    # 2.3.3 CLASS MVC
    add_heading_3(doc, "2.3.3: Class: từ phát biểu bài toán + và use case + activity để sinh ra ảnh mô tả theo chuẩn MVC")
{mvc_indented}

    doc.add_page_break()
"""

with open("scripts/chapter2_builder.py", "w", encoding="utf-8") as f:
    f.write(full_c2)

print("Saved updated scripts/chapter2_builder.py successfully!")
