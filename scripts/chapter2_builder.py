import os
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
from scripts.build_refined_mvc_diagram import PUML_CODE

def add_use_case_spec_table(doc, uc_id, uc_name, actors, description, preconditions, postconditions, main_flow, alt_flow, relationships="Không có (Độc lập)"):
    table_title = f"Bảng đặc tả: 【{uc_id}】 {uc_name}"
    
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
        ("Mã & Tên Use Case", f"【{uc_id}】 {uc_name}"),
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

def build_chapter_2(doc):
    # CHƯƠNG 2 THEO ĐÚNG TÊN FILE HƯỚNG DẪN
    add_heading_1(doc, "CHƯƠNG 2: PHÂN TÍCH VÀ THIẾT KẾ")

    # 2.1 THIẾT KẾ GIAO DIỆN
    add_heading_2(doc, "2.1: Thiết kế giao diện")
    add_body_p(
        doc,
        "Giao diện của hệ thống Delta Travel được xây dựng theo phong cách thiết kế hiện đại 'Liquid Glass' "
        "(kính lỏng kết hợp kính mờ đa tầng - backdrop blur), mang lại cảm giác sang trọng, thanh lịch và khơi gợi "
        "cảm xúc du lịch trải nghiệm cho du khách. Màu sắc chủ đạo của hệ thống là xanh đại dương (Deep Ocean Blue #1B365D), "
        "kết hợp cùng các dải màu gradient thiên nhiên và nền trắng ngà trang nhã, tạo nên độ tương phản tối ưu và bảo vệ thị giác người dùng."
    )
    add_body_p(
        doc,
        "Đặc biệt, hệ thống tuân thủ nghiêm ngặt nguyên tắc thiết kế tương thích đa thiết bị (Responsive Web Design), "
        "sử dụng hệ thống lưới linh hoạt (Fluid Grid) và CSS Flexbox/Grid hiện đại, đảm bảo giao diện hiển thị hoàn hảo "
        "trên tất cả các kích thước màn hình: Màn hình máy tính để bàn (Desktop 1920x1080), Máy tính xách tay (Laptop 1366x768), "
        "Máy tính bảng (Tablet 768x1024) và Điện thoại di động (Smartphone 375x667)."
    )

    # Chèn các ảnh giao diện
    img_h1 = os.path.join(CLEAN_IMG_DIR, "hinh_2_1_ui_home_hero.png")
    add_image_with_caption(doc, img_h1, "Hình 2.1: Giao diện Trang chủ Delta Travel (Phong cách Liquid Glass với Hero Banner và Tìm kiếm nhanh)", width_inches=6.0)

    img_h2 = os.path.join(CLEAN_IMG_DIR, "hinh_2_2_ui_home_categories.png")
    add_image_with_caption(doc, img_h2, "Hình 2.2: Giao diện Trang chủ Delta Travel - Danh mục tour nổi bật ba miền Bắc - Trung - Nam", width_inches=6.0)

    img_h3 = os.path.join(CLEAN_IMG_DIR, "hinh_2_3_ui_home_english.png")
    add_image_with_caption(doc, img_h3, "Hình 2.3: Giao diện Trang chủ Delta Travel phiên bản Tiếng Anh hỗ trợ du khách quốc tế", width_inches=6.0)

    add_body_p(
        doc,
        "Quy trình đặt tour trên giao diện được thiết kế tối ưu hóa trải nghiệm người dùng qua biểu mẫu 3 bước trực quan: "
        "Khách hàng lựa chọn lịch khởi hành cụ thể, hệ thống tự động kiểm tra số chỗ khả dụng; khách hàng nhập thông tin người liên hệ "
        "và danh sách hành khách đi kèm (Người lớn, Trẻ em, Em bé). Hệ thống tự động tính toán tổng tiền thanh toán theo thời gian thực "
        "và hiển thị hướng dẫn thanh toán kèm mã VietQR tự động:",
        bold_prefix="Giao diện quy trình Đặt tour và Nhập thông tin hành khách: "
    )

    img_h4 = os.path.join(CLEAN_IMG_DIR, "hinh_2_4_ui_booking_form.png")
    add_image_with_caption(doc, img_h4, "Hình 2.4: Giao diện Đặt tour trực tuyến - Form nhập thông tin liên hệ và số lượng khách hàng", width_inches=6.0)

    img_h5 = os.path.join(CLEAN_IMG_DIR, "hinh_2_5_ui_booking_passengers.png")
    add_image_with_caption(doc, img_h5, "Hình 2.5: Giao diện Nhập danh sách hành khách chi tiết theo độ tuổi (Người lớn, Trẻ em, Em bé)", width_inches=6.0)

    img_h6 = os.path.join(CLEAN_IMG_DIR, "hinh_2_6_ui_booking_summary.png")
    add_image_with_caption(doc, img_h6, "Hình 2.6: Giao diện Hướng dẫn thanh toán trực tuyến và Tóm tắt chi phí đơn đặt tour", width_inches=6.0)


    # 2.2 THIẾT KẾ CƠ SỞ DỮ LIỆU
    add_heading_2(doc, "2.2: Thiết kế cơ sở dữ liệu ( lấy từ phát biểu bài toán )")

    # 2.2.1 Xác định thực thể, khóa chính
    add_heading_3(doc, "2.2.1: xác định thực thể, khóa chính")
    add_body_p(
        doc,
        "Căn cứ vào phát biểu bài toán nghiệp vụ du lịch và kết quả khảo sát thực tế tại Vietravel, "
        "hệ thống xác định chính xác 12 thực thể cốt lõi. Mỗi thực thể sở hữu một khóa chính (Primary Key - PK) duy nhất "
        "nhằm đảm bảo tính toàn vẹn thực thể (Entity Integrity):"
    )

    entities_data = [
        ["1", "NGUOIDUNG", "MaNguoiDung (INT IDENTITY)", "Quản lý thông tin tài khoản người dùng, khách hàng và cán bộ quản trị"],
        ["2", "DANHMUC", "MaDanhMuc (INT IDENTITY)", "Phân loại tour theo vùng miền địa lý (Miền Bắc, Trung, Nam, Biển đảo)"],
        ["3", "TOUR", "MaTour (INT IDENTITY)", "Lưu trữ thông tin gốc về sản phẩm tour du lịch, tiêu đề, thời lượng, phương tiện"],
        ["4", "HINHANH_TOUR", "MaHinhAnh (INT IDENTITY)", "Bộ sưu tập gallery đa ảnh minh họa sống động cho từng tour"],
        ["5", "LICH_TRINH_DETAIL", "MaLichTrinh (INT IDENTITY)", "Chi tiết lộ trình từng ngày (Day-by-Day itinerary) bóc tách hoạt động cụ thể"],
        ["6", "CHUYENKHOIHANH", "MaChuyen (INT IDENTITY)", "Quản lý các đợt khởi hành cụ thể, giá vé phân loại, số chỗ tổng và chỗ đã đặt"],
        ["7", "DATTOUR", "MaDatTour (INT IDENTITY)", "Quản lý đơn đặt tour, mã booking định danh, ngày đặt, tổng tiền, trạng thái"],
        ["8", "CHITIET_HANHKHACH", "MaHanhKhach (INT IDENTITY)", "Danh sách từng hành khách đi kèm: họ tên, ngày sinh, loại tuổi, CCCD"],
        ["9", "THANHTOAN", "MaThanhToan (INT IDENTITY)", "Thông tin giao dịch ngân hàng, biên lai, số tiền thanh toán, trạng thái đối soát"],
        ["10", "DANHGIA", "MaDanhGia (INT IDENTITY)", "Ý kiến nhận xét và chấm điểm sao của khách hàng sau khi hoàn thành chuyến đi"],
        ["11", "BAIVIET_QUANGBA", "MaBaiViet (INT IDENTITY)", "Bài viết cẩm nang du lịch, kinh nghiệm khám phá điểm đến quảng bá văn hóa"],
        ["12", "AUDITLOG", "MaLog (INT IDENTITY)", "Nhật ký kiểm toán lưu vết tự động mọi thao tác nhạy cảm để truy vết trách nhiệm"]
    ]
    create_styled_table(doc, ["STT", "Tên bảng thực thể", "Khóa chính (PK)", "Ý nghĩa nghiệp vụ trong hệ thống"], entities_data, [0.5, 1.8, 2.0, 2.1], "Bảng 2.1: Danh mục 12 Thực thể CSDL và Khóa chính chuẩn hóa")

    # 2.2.2 Xác định mối quan hệ, ràng buộc
    add_heading_3(doc, "2.2.2 xác định mối quan hệ , ràng buộc")
    add_body_p(
        doc,
        "Hệ thống thiết lập 11 mối quan hệ khóa ngoại (Foreign Keys) chặt chẽ giữa 12 bảng thực thể "
        "nhằm đảm bảo tính toàn vẹn tham chiếu (Referential Integrity):"
    )

    fks_data = [
        ["FK_TOUR_DANHMUC", "TOUR(MaDanhMuc)", "DANHMUC(MaDanhMuc)", "1 - N", "Một danh mục vùng miền có nhiều tour du lịch thuộc về"],
        ["FK_HINHANH_TOUR", "HINHANH_TOUR(MaTour)", "TOUR(MaTour)", "1 - N (Cascade)", "Một tour sở hữu bộ sưu tập gồm nhiều hình ảnh gallery"],
        ["FK_LICHTRINH_TOUR", "LICH_TRINH_DETAIL(MaTour)", "TOUR(MaTour)", "1 - N (Cascade)", "Một tour có lộ trình chi tiết chia theo nhiều ngày"],
        ["FK_CHUYEN_TOUR", "CHUYENKHOIHANH(MaTour)", "TOUR(MaTour)", "1 - N (Cascade)", "Một tour được mở bán ở nhiều chuyến khởi hành khác nhau"],
        ["FK_DATTOUR_NGUOIDUNG", "DATTOUR(MaNguoiDung)", "NGUOIDUNG(MaNguoiDung)", "1 - N", "Một người dùng có thể thực hiện nhiều đơn đặt tour"],
        ["FK_DATTOUR_CHUYEN", "DATTOUR(MaChuyen)", "CHUYENKHOIHANH(MaChuyen)", "1 - N", "Nhiều đơn đặt tour cùng thuộc về một chuyến khởi hành"],
        ["FK_HANHKHACH_DATTOUR", "CHITIET_HANHKHACH(MaDatTour)", "DATTOUR(MaDatTour)", "1 - N (Cascade)", "Một đơn đặt tour chứa danh sách nhiều hành khách đi kèm"],
        ["FK_THANHTOAN_DATTOUR", "THANHTOAN(MaDatTour)", "DATTOUR(MaDatTour)", "1 - 1", "Mỗi đơn đặt tour tương ứng với một bản ghi thanh toán đối soát"],
        ["FK_DANHGIA_TOUR", "DANHGIA(MaTour)", "TOUR(MaTour)", "1 - N", "Một tour nhận được nhiều phản hồi đánh giá từ khách hàng"],
        ["FK_DANHGIA_NGUOIDUNG", "DANHGIA(MaNguoiDung)", "NGUOIDUNG(MaNguoiDung)", "1 - N", "Mỗi đánh giá do một khách hàng đã tham gia tour viết"],
        ["FK_BAIVIET_NGUOIDUNG", "BAIVIET_QUANGBA(MaTacGia)", "NGUOIDUNG(MaNguoiDung)", "1 - N", "Mỗi bài viết cẩm nang du lịch do một tác giả biên soạn"]
    ]
    create_styled_table(doc, ["Tên ràng buộc FK", "Bảng con (Khóa ngoại)", "Bảng cha (Khóa chính)", "Lực lượng", "Ý nghĩa nghiệp vụ liên kết"], fks_data, [1.5, 1.8, 1.6, 0.7, 1.8], "Bảng 2.2: Danh mục 11 Mối quan hệ Khóa ngoại (Foreign Keys) bảo vệ tính toàn vẹn tham chiếu")

    add_body_p(
        doc,
        "Bên cạnh các khóa ngoại, hệ thống áp dụng 14 ràng buộc kiểm tra CHECK nghiêm ngặt tại tầng CSDL "
        "để ngăn chặn triệt để dữ liệu rác, số âm hoặc trạng thái bất hợp lệ:",
        bold_prefix="Danh mục 14 Ràng buộc kiểm tra CHECK: "
    )

    checks_data = [
        ["CK_NGUOIDUNG_Email", "NGUOIDUNG", "Email LIKE '%_@__%.__%'", "Bắt buộc định dạng email chuẩn quốc tế"],
        ["CK_NGUOIDUNG_SDT", "NGUOIDUNG", "LEN(SoDienThoai) >= 9 AND SoDienThoai NOT LIKE '%[^0-9]%'", "Số điện thoại chỉ chứa chữ số, độ dài từ 9 ký tự"],
        ["CK_TOUR_GiaCoBan", "TOUR", "GiaCoBan > 0", "Giá tour cơ bản phải luôn là số dương lớn hơn 0"],
        ["CK_TOUR_ThoiLuong", "TOUR", "SoNgay > 0 AND SoDem >= 0", "Số ngày đi tour phải > 0 và số đêm nghỉ dưỡng >= 0"],
        ["CK_CHUYEN_SoChoToiDa", "CHUYENKHOIHANH", "SoChoToiDa > 0", "Tổng số chỗ ngồi trên một chuyến phải lớn hơn 0"],
        ["CK_CHUYEN_SoChoDaDat", "CHUYENKHOIHANH", "SoChoDaDat >= 0 AND SoChoDaDat <= SoChoToiDa", "Số chỗ đã đặt không được âm và không vượt quá số chỗ tối đa"],
        ["CK_CHUYEN_GiaVe", "CHUYENKHOIHANH", "GiaNguoiLon > 0 AND GiaTreEm >= 0", "Giá vé người lớn phải > 0, giá trẻ em không được âm"],
        ["CK_CHUYEN_NgayDiVe", "CHUYENKHOIHANH", "NgayVe >= NgayKhoiHanh", "Ngày kết thúc tour phải bằng hoặc sau ngày khởi hành"],
        ["CK_DATTOUR_SoKhach", "DATTOUR", "SoLuongKhach > 0", "Mỗi đơn đặt tour phải có ít nhất 1 hành khách tham gia"],
        ["CK_DATTOUR_TongTien", "DATTOUR", "TongTien >= 0", "Tổng tiền thanh toán của đơn đặt vé không được âm"],
        ["CK_DATTOUR_TrangThai", "DATTOUR", "TrangThai IN (N'Chờ thanh toán', N'Đã thanh toán', N'Đã hủy')", "Trạng thái đơn hàng chỉ nhận một trong 3 giá trị chuẩn"],
        ["CK_HANHKHACH_DoTuoi", "CHITIET_HANHKHACH", "LoaiKhach IN (N'Người lớn', N'Trẻ em', N'Em bé')", "Hành khách bắt buộc phân loại đúng 3 nhóm tuổi"],
        ["CK_THANHTOAN_SoTien", "THANHTOAN", "SoTienThanhToan > 0", "Số tiền giao dịch thực tế phải lớn hơn 0"],
        ["CK_DANHGIA_DiemSao", "DANHGIA", "DiemDanhGia BETWEEN 1 AND 5", "Điểm đánh giá trải nghiệm dịch vụ từ 1 đến 5 sao"]
    ]
    create_styled_table(doc, ["Tên ràng buộc CHECK", "Bảng áp dụng", "Biểu thức điều kiện kiểm tra (SQL Condition)", "Mục đích bảo vệ toàn vẹn"], checks_data, [1.5, 1.2, 2.2, 1.5], "Bảng 2.3: Danh mục 14 Ràng buộc kiểm tra (CHECK Constraints) bảo vệ toàn vẹn dữ liệu")

    # 2.2.3 Chuẩn hóa 3NF
    add_heading_3(doc, "2.2.3: chuẩn hóa 3nf")
    add_body_p(
        doc,
        "Chuẩn hóa dữ liệu là phương pháp khoa học nhằm tối ưu hóa cấu trúc các bảng, loại bỏ dư thừa dữ liệu (Data Redundancy) "
        "và ngăn ngừa triệt để các dị thường trong thao tác Thêm, Sửa, Xóa (Insert, Update, Delete Anomalies). "
        "Quá trình chuẩn hóa được thực hiện tuần tự qua 4 bước bài bản:"
    )

    add_body_p(
        doc,
        "Khảo sát biểu mẫu đặt tour sơ khai ban đầu chứa toàn bộ các thuộc tính gộp chung: "
        "THONG_TIN_DAT_TOUR (Mã phiếu, Tên khách hàng, Email, Số điện thoại, Mã tour, Tên tour, Danh mục vùng miền, "
        "Danh sách hình ảnh gallery, Danh sách ngày lịch trình, Ngày khởi hành, Ngày về, Số chỗ, Danh sách hành khách đi kèm, "
        "Tổng tiền, Phương thức thanh toán, Mã giao dịch, Đánh giá nhận xét). "
        "Bảng này ở dạng Chưa chuẩn hóa (UNF) vì chứa các thuộc tính lặp và thuộc tính phức hợp đa trị.",
        bold_prefix="Bước 1 - Khảo sát dạng chưa chuẩn hóa (UNF - Unnormalized Form): "
    )

    add_body_p(
        doc,
        "Định nghĩa Dạng chuẩn 1 (1NF) yêu cầu mọi thuộc tính trong bảng phải mang giá trị nguyên tử (Atomic Values), "
        "không được chứa nhóm lặp (Repeating Groups) hoặc mảng dữ liệu đa trị. "
        "Giải pháp phân rã: Tách các nhóm lặp ra thành các bảng độc lập có khóa chính riêng: "
        "1) Tách danh sách hành khách đi kèm thành bảng CHITIET_HANHKHACH; "
        "2) Tách bộ sưu tập ảnh đa góc nhìn thành bảng HINHANH_TOUR; "
        "3) Tách lộ trình chi tiết từng ngày thành bảng LICH_TRINH_DETAIL. "
        "Sau bước này, tất cả các thuộc tính đều đạt tính nguyên tử đơn trị, bảng đạt chuẩn 1NF.",
        bold_prefix="Bước 2 - Đưa về Dạng chuẩn 1 (1NF - First Normal Form): "
    )

    add_body_p(
        doc,
        "Định nghĩa Dạng chuẩn 2 (2NF) yêu cầu bảng đã đạt 1NF và mọi thuộc tính không khóa phải phụ thuộc hàm đầy đủ "
        "(Full Functional Dependency) vào toàn bộ khóa chính, không được phụ thuộc vào một phần của khóa chính phức hợp (Partial Dependency). "
        "Giải pháp phân rã: Trong quan hệ giữa Tour và Lịch khởi hành, thuộc tính Tên tour, Giá sàn, Điểm đi, Điểm đến chỉ phụ thuộc vào Mã tour, "
        "không phụ thuộc vào Ngày khởi hành cụ thể. Nhóm đã tách riêng bảng TOUR (chứa thông tin gốc bất biến của sản phẩm tour) "
        "và bảng CHUYENKHOIHANH (chứa thông tin biến động theo từng đợt mở bán: ngày đi, ngày về, số chỗ đã đặt). "
        "Đồng thời, tách Đơn đặt tour thành bảng DATTOUR độc lập. Sau bước này, toàn bộ 12 bảng đều đạt chuẩn 2NF.",
        bold_prefix="Bước 3 - Đưa về Dạng chuẩn 2 (2NF - Second Normal Form): "
    )

    add_body_p(
        doc,
        "Định nghĩa Dạng chuẩn 3 (3NF) yêu cầu bảng đã đạt 2NF và không tồn tại phụ thuộc hàm bắc cầu (Transitive Dependency) "
        "giữa các thuộc tính không khóa (nghĩa là không tồn tại quan hệ X -> Y và Y -> Z dẫn đến X -> Z với X là khóa chính, Y và Z là thuộc tính không khóa). "
        "Giải pháp phân rã triệt để: "
        "1) Trong bảng TOUR: MaTour -> MaDanhMuc và MaDanhMuc -> TenDanhMuc. Tách riêng bảng DANHMUC độc lập, bảng TOUR chỉ giữ MaDanhMuc làm khóa ngoại; "
        "2) Trong bảng DATTOUR: MaDatTour -> MaThanhToan và MaThanhToan -> (PhuongThuc, MaGiaoDich, SoTien). Tách riêng bảng THANHTOAN độc lập liên kết 1-1 với DATTOUR; "
        "3) Trong bảng DATTOUR: MaDatTour -> MaNguoiDung và MaNguoiDung -> (HoTen, Email, SoDienThoai). Tách bảng NGUOIDUNG độc lập. "
        "Kết luận: Sau khi hoàn thành phân rã, toàn bộ 12 bảng đều thỏa mãn Dạng chuẩn 3 (3NF) 100%, bảo toàn thông tin và phụ thuộc hàm hoàn hảo.",
        bold_prefix="Bước 4 - Đưa về Dạng chuẩn 3 (3NF - Third Normal Form): "
    )

    # 2.2.4 ERD - Data Diagram
    add_heading_3(doc, "2.2.4: ERD - data drigram -> table")
    add_body_p(
        doc,
        "Mô hình Quan hệ Thực thể (Entity Relationship Diagram - ERD) thể hiện trực quan toàn bộ 12 thực thể, "
        "các thuộc tính, khóa chính (PK), khóa ngoại (FK) và lực lượng liên kết (Cardinality 1-1, 1-N) "
        "đã được kiểm tra và xác thực trên Microsoft SQL Server:"
    )

    img_erd = os.path.join(CLEAN_IMG_DIR, "hinh_2_7_erd_database.png")
    add_image_with_caption(doc, img_erd, "Hình 2.7: Sơ đồ Quan hệ Thực thể (ERD) 12 bảng chuẩn hóa 3NF trên Microsoft SQL Server", width_inches=6.0)

    # Từ điển dữ liệu chi tiết 12 bảng
    
    # Từ điển dữ liệu chi tiết đầy đủ 12 bảng theo SSMS Database Diagram

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

    add_heading_3(doc, "2.2.5: Sinh database mẫu ( có dữ liệu mẫu demo)")
    add_body_p(
        doc,
        "Dưới đây là tập hợp mã nguồn T-SQL thực tế được trích xuất trực tiếp từ thư mục `database/database/` của dự án, "
        "đáp ứng đầy đủ các tiêu chuẩn lập trình cơ sở dữ liệu trên Microsoft SQL Server:"
    )

    add_body_p(doc, "Mã DDL khởi tạo Database và bảng chuẩn hóa 3NF (Trích từ `01_schema/02_create_tables_3nf.sql`):", bold_prefix="1. Kịch bản DDL tạo bảng cơ sở dữ liệu: ")
    ddl_full = """-- Khởi tạo Database và các bảng cốt lõi chuẩn 3NF
USE master;
GO
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'TourDuLichDB')
    CREATE DATABASE TourDuLichDB COLLATE Vietnamese_CI_AS;
GO
USE TourDuLichDB;
GO

-- 1. Bảng NGUOIDUNG
CREATE TABLE dbo.NGUOIDUNG (
    MaNguoiDung INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    HoTen       NVARCHAR(100)     NOT NULL,
    Email       VARCHAR(100)      NOT NULL UNIQUE,
    SoDienThoai VARCHAR(15)       NOT NULL UNIQUE,
    MatKhau     VARCHAR(255)      NOT NULL,
    DiaChi      NVARCHAR(200)     NULL,
    NgayTao     DATETIME          NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CK_NGUOIDUNG_Email CHECK (Email LIKE '%_@__%.__%'),
    CONSTRAINT CK_NGUOIDUNG_SDT CHECK (LEN(SoDienThoai) >= 9 AND SoDienThoai NOT LIKE '%[^0-9]%')
);

-- 2. Bảng DANHMUC
CREATE TABLE dbo.DANHMUC (
    MaDanhMuc   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TenDanhMuc  NVARCHAR(100)     NOT NULL UNIQUE,
    MoTa        NVARCHAR(500)     NULL,
    HinhAnh     VARCHAR(255)      NULL,
    KichHoat    BIT               NOT NULL DEFAULT 1
);

-- 3. Bảng TOUR
CREATE TABLE dbo.TOUR (
    MaTour       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaDanhMuc    INT               NOT NULL,
    TenTour      NVARCHAR(200)     NOT NULL,
    GiaCoBan     DECIMAL(18,2)     NOT NULL,
    SoNgay       INT               NOT NULL,
    SoDem        INT               NOT NULL,
    DiemKhoiHanh NVARCHAR(100)     NOT NULL,
    DiemDen      NVARCHAR(100)     NOT NULL,
    HinhAnhChinh VARCHAR(255)      NULL,
    CONSTRAINT FK_TOUR_DANHMUC FOREIGN KEY (MaDanhMuc) REFERENCES dbo.DANHMUC(MaDanhMuc),
    CONSTRAINT CK_TOUR_GiaCoBan CHECK (GiaCoBan > 0),
    CONSTRAINT CK_TOUR_ThoiLuong CHECK (SoNgay > 0 AND SoDem >= 0)
);

-- 4. Bảng CHUYENKHOIHANH
CREATE TABLE dbo.CHUYENKHOIHANH (
    MaChuyen     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaTour       INT               NOT NULL,
    NgayKhoiHanh DATE              NOT NULL,
    NgayVe       DATE              NOT NULL,
    GiaNguoiLon  DECIMAL(18,2)     NOT NULL,
    GiaTreEm     DECIMAL(18,2)     NOT NULL,
    SoChoToiDa   INT               NOT NULL,
    SoChoDaDat   INT               NOT NULL DEFAULT 0,
    TrangThai    NVARCHAR(50)      NOT NULL DEFAULT N'Còn chỗ',
    CONSTRAINT FK_CHUYEN_TOUR FOREIGN KEY (MaTour) REFERENCES dbo.TOUR(MaTour) ON DELETE CASCADE,
    CONSTRAINT CK_CHUYEN_SoChoToiDa CHECK (SoChoToiDa > 0),
    CONSTRAINT CK_CHUYEN_SoChoDaDat CHECK (SoChoDaDat >= 0 AND SoChoDaDat <= SoChoToiDa),
    CONSTRAINT CK_CHUYEN_NgayDiVe CHECK (NgayVe >= NgayKhoiHanh)
);"""
    add_code_block(doc, ddl_full)

    add_body_p(doc, "Mã Trigger tự động kiểm soát chỗ ngồi và chống Overbooking (Trích từ `04_programmability/01_triggers_booking_inventory.sql`):", bold_prefix="2. Trigger kiểm soát chỗ ngồi và chống Overbooking tự động: ")
    trg_code = """-- Trigger TRG_DATTOUR_CheckAndLockSeats: Khóa giữ chỗ tự động và ngăn chặn Overbooking
CREATE TRIGGER dbo.TRG_DATTOUR_CheckAndLockSeats
ON dbo.DATTOUR
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Kiểm tra nếu số khách đặt vượt quá số chỗ còn lại của chuyến
        IF EXISTS (
            SELECT 1 
            FROM inserted i
            JOIN dbo.CHUYENKHOIHANH c ON i.MaChuyen = c.MaChuyen
            WHERE (c.SoChoDaDat + i.SoLuongKhach) > c.SoChoToiDa
        )
        BEGIN
            RAISERROR(N'LỖI OVERBOOKING: Chuyến khởi hành không đủ số chỗ trống khả dụng cho yêu cầu đặt vé này!', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END;

        -- Nếu đủ chỗ: Tự động cộng số chỗ đã đặt
        UPDATE c
        SET c.SoChoDaDat = c.SoChoDaDat + i.SoLuongKhach,
            c.TrangThai = CASE WHEN (c.SoChoDaDat + i.SoLuongKhach) >= c.SoChoToiDa 
                               THEN N'Hết chỗ' ELSE N'Còn chỗ' END
        FROM dbo.CHUYENKHOIHANH c
        JOIN inserted i ON c.MaChuyen = i.MaChuyen;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;"""
    add_code_block(doc, trg_code)

    add_body_p(doc, "Mã Stored Procedure đặt tour với giao dịch độc quyền UPDLOCK (Trích từ `04_programmability/02_stored_procedures_booking.sql`):", bold_prefix="3. Stored Procedure đặt tour an toàn với ACID Transaction: ")
    sp_full = """-- Stored Procedure tạo đơn đặt tour an toàn với khóa UPDLOCK chống tranh chấp đồng thời
CREATE PROCEDURE dbo.sp_TaoDonDatTour
    @MaKhachHang   INT,
    @MaChuyen      INT,
    @SoLuongKhach  INT,
    @TongTien      DECIMAL(18,2),
    @MaDatTourMoi  INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Khóa dòng chuyến khởi hành bằng UPDLOCK và HOLDLOCK
        DECLARE @SoChoToiDa INT, @SoChoDaDat INT;
        SELECT @SoChoToiDa = SoChoToiDa, @SoChoDaDat = SoChoDaDat
        FROM dbo.CHUYENKHOIHANH WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChuyen = @MaChuyen;

        IF (@SoChoToiDa - @SoChoDaDat) < @SoLuongKhach
        BEGIN
            RAISERROR(N'Chuyến khởi hành không đủ chỗ khả dụng.', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN -1;
        END;

        -- Tạo mã Booking chuẩn hóa BK...
        DECLARE @MaBooking VARCHAR(20) = 'BK' + CAST(ABS(CHECKSUM(NEWID())) % 90000000 + 10000000 AS VARCHAR);

        -- Chèn đơn đặt vé mới
        INSERT INTO dbo.DATTOUR (MaNguoiDung, MaChuyen, MaBooking, SoLuongKhach, TongTien, TrangThai)
        VALUES (@MaKhachHang, @MaChuyen, @MaBooking, @SoLuongKhach, @TongTien, N'Chờ thanh toán');

        SET @MaDatTourMoi = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;"""
    add_code_block(doc, sp_full)

    add_body_p(doc, "Mã INSERT dữ liệu mẫu demo phong phú (Trích từ `05_seed_data/01_sample_data_realistic.sql`):", bold_prefix="4. Dữ liệu mẫu demo (Seed Data): ")
    seed_sql = """-- Dữ liệu mẫu Danh mục du lịch
INSERT INTO dbo.DANHMUC (TenDanhMuc, MoTa, KichHoat) VALUES
(N'Du lịch Miền Bắc', N'Khám phá văn hóa ngàn năm, vịnh Hạ Long và núi rừng Tây Bắc hùng vĩ', 1),
(N'Du lịch Miền Trung', N'Con đường di sản miền Trung: Cố đô Huế, Phố cổ Hội An và biển Mỹ Khê Đà Nẵng', 1),
(N'Du lịch Miền Nam & Tây Nam Bộ', N'Trải nghiệm sông nước miền Tây miệt vườn và đảo ngọc Phú Quốc biển xanh', 1);

-- Dữ liệu mẫu Sản phẩm Tour
INSERT INTO dbo.TOUR (MaDanhMuc, TenTour, GiaCoBan, SoNgay, SoDem, DiemKhoiHanh, DiemDen, HinhAnhChinh) VALUES
(1, N'Hà Nội - Vịnh Hạ Long - Du thuyền 5 sao đẳng cấp', 3850000, 2, 1, N'Hà Nội', N'Quảng Ninh', '/assets/images/tour-ha-long.jpg'),
(1, N'Hà Giang mùa hoa tam giác mạch - Đồng Văn - Lũng Cú', 4200000, 3, 2, N'Hà Nội', N'Hà Giang', '/assets/images/tour-hagiang.jpg'),
(2, N'Đà Nẵng - Bán đảo Sơn Trà - Bà Nà Hills - Cầu Vàng - Hội An', 5500000, 4, 3, N'TP. Hồ Chí Minh', N'Đà Nẵng', '/assets/images/tour-da-nang.jpg'),
(3, N'Khám phá Đảo Ngọc Phú Quốc - Grand World - Cáp treo Hòn Thơm', 6800000, 3, 2, N'Hà Nội', N'Kiên Giang', '/assets/images/tour-phu-quoc.jpg');

-- Dữ liệu mẫu Chuyến khởi hành
INSERT INTO dbo.CHUYENKHOIHANH (MaTour, NgayKhoiHanh, NgayVe, GiaNguoiLon, GiaTreEm, SoChoToiDa, SoChoDaDat) VALUES
(1, '2026-12-05', '2026-12-06', 3850000, 2887500, 25, 6),
(2, '2026-12-10', '2026-12-12', 4200000, 3150000, 20, 4),
(3, '2026-12-15', '2026-12-18', 5500000, 4125000, 30, 8),
(4, '2026-12-20', '2026-12-22', 6800000, 5100000, 35, 12);"""
    add_code_block(doc, seed_sql)


    # 2.3 THIẾT KẾ HỆ THỐNG

    # ==========================================
    # 2.3 THIẾT KẾ HỆ THỐNG
    # ==========================================

    # ==========================================
    # 2.3 THIẾT KẾ HỆ THỐNG
    # ==========================================

    # ==========================================
    # 2.3 THIẾT KẾ HỆ THỐNG
    # ==========================================

    # ==========================================
    # 2.3 THIẾT KẾ HỆ THỐNG
    # ==========================================
    add_heading_2(doc, "2.3: Thiết kế hệ thống :")

    # 2.3.1 USE CASE
    add_heading_3(doc, "2.3.1 use case : bằng cách + khung cho tất cả actor + đỉnh : từng actor để sinh code UML -> plantext , sau đó sinh mô tả cho use case")
    add_heading_3(doc, "Tác nhân (Actors) và Vai trò nghiệp vụ trong Sơ đồ Use Case")
    add_body_p(
    doc,
    "Hệ thống Website Quảng bá và Đặt tour Du lịch Trực tuyến (Delta Travel) được mô hình hóa theo phương pháp "
    "phân tích thiết kế hướng đối tượng (OOAD) dựa trên chuẩn đặc tả quốc tế OMG UML 2.5. "
    "Mô hình Use Case đóng vai trò xác định rõ ranh giới hệ thống (System Boundary), các tác nhân bên ngoài (Actors) "
    "và các ca sử dụng chức năng mà hệ thống cung cấp nhằm thỏa mãn các mục tiêu nghiệp vụ lữ hành thực tế."
    )
    add_body_p(
    doc,
    "Trong phiên bản hoàn chỉnh này, hệ thống đã tích hợp và hợp nhất toàn bộ các ca sử dụng đơn lẻ "
    "cùng 5 luồng tương tác nghiệp vụ hai chiều giữa Khách hàng và Quản trị viên vào một Sơ đồ Use Case tổng quát duy nhất (Hình 1). "
    "Hệ thống xác định 3 tác nhân chính tham gia tương tác:",
    bold_prefix="Danh sách các Tác nhân (Actors): "
    )

    actors_data = [
    ["1", "Khách viếng thăm\n(Guest)", "Tác nhân cơ sở\n(Chưa đăng nhập)",
    "Người dùng tự do truy cập vào website để khám phá thông tin du lịch: tìm kiếm và lọc tour theo vùng miền, địa danh, khoảng giá; "
    "xem chi tiết lịch trình và bộ sưu tập ảnh; đọc bài viết cẩm nang quảng bá; gửi form yêu cầu tư vấn; thực hiện đăng ký tài khoản mới "
    "hoặc đăng nhập vào hệ thống."],
    ["2", "Khách hàng\n(Customer)", "Kế thừa từ\nKhách viếng thăm",
    "Người dùng đã xác thực tài khoản định danh trong hệ thống. Khách hàng kế thừa toàn bộ quyền của Khách viếng thăm, đồng thời sở hữu "
    "các quyền hạn thành viên: quản lý hồ sơ cá nhân, lưu tour yêu thích, đặt tour trực tuyến, và tham gia trực tiếp vào các luồng tương tác "
    "hai chiều với Quản trị viên (đặt tour và xử lý đơn, thanh toán chuyển khoản VietQR, gửi yêu cầu đổi/hủy tour, gửi đánh giá tour)."],
    ["3", "Quản trị viên\n(Admin)", "Cán bộ điều hành &\nQuản trị hệ thống",
    "Nhân sự nội bộ của đơn vị lữ hành chịu trách nhiệm vận hành hệ thống: quản lý tài khoản và phân quyền người dùng; quản lý thông tin tour, "
    "ảnh gallery và lịch trình; quản lý các đợt khởi hành và số chỗ; tiếp nhận và xử lý đơn đặt tour; cập nhật trạng thái thanh toán và đối soát; "
    "kiểm duyệt đánh giá của khách hàng; biên tập bài viết quảng bá; xem báo cáo thống kê doanh thu và tra cứu nhật ký kiểm toán hệ thống."]
    ]
    create_styled_table(doc, ["STT", "Tên Tác nhân", "Kế thừa / Quan hệ", "Phạm vi trách nhiệm và quyền hạn nghiệp vụ"], actors_data, [0.5, 1.4, 1.4, 3.2], "Bảng 1: Danh sách và vai trò của 3 Tác nhân (Actors) trong hệ thống Delta Travel")


    # MỤC 2: SƠ ĐỒ UML USE CASE HOÀN CHỈNH
    add_heading_3(doc, "Sơ đồ UML Use Case tổng quát hợp nhất hoàn chỉnh (Hình 1)")
    add_body_p(
    doc,
    "Sơ đồ dưới đây biểu diễn mô hình Use Case hoàn chỉnh của hệ thống Delta Travel. "
    "Sơ đồ đã thay thế toàn bộ 2 sơ đồ riêng rẽ cũ để tạo nên một bức tranh kiến trúc chức năng duy nhất, toàn diện và mạch lạc. "
    "Mô hình thể hiện rõ ranh giới hệ thống, 3 tác nhân bên ngoài, mối quan hệ kế thừa giữa Khách hàng và Khách viếng thăm, "
    "cùng đầy đủ các liên kết Hiệp hội (Association), Bao hàm (<<include>>) và Mở rộng (<<extend>>) kèm điều kiện nghiệp vụ cụ thể:"
    )

    # Chèn ảnh use case hoàn chỉnh mới
    img_uc_new = os.path.join(CLEAN_IMG_DIR, "use_case_unified_new.png")
    add_image_with_caption(doc, img_uc_new, "Hình 1. Sơ đồ UML Use Case tổng quát – Delta Travel (Mô hình hợp nhất hoàn chỉnh)", width_inches=6.2)

    add_body_p(
    doc,
    "Kiến trúc sơ đồ Use Case hợp nhất được tổ chức thành 4 phân vùng chức năng rõ rệt:",
    bold_prefix="Phân tích cấu trúc phân vùng nghiệp vụ trong Sơ đồ Hình 1: "
    )
    add_bullet_p(doc, "Gồm 5 Use Case tra cứu công khai (Đăng ký tài khoản, Tìm kiếm và lọc tour, Xem bài viết quảng bá, Gửi yêu cầu tư vấn, Xem chi tiết tour) và 2 Use Case xác thực (Đăng nhập, Quên mật khẩu). Trong đó, 'Quên mật khẩu' là điểm mở rộng <<extend>> của 'Đăng nhập' khi người dùng chọn quên mật khẩu.", bold_prefix="1. Phân vùng Khách viếng thăm (Public & Authentication): ")
    add_bullet_p(doc, "Gồm các ca sử dụng thành viên: 'Đặt tour trực tuyến', 'Quản lý tour yêu thích' và 'Quản lý hồ sơ cá nhân'. Để thực hiện đặt tour hoặc lưu tour yêu thích, hệ thống bắt buộc bao hàm <<include>> ca sử dụng 'Đăng nhập'.", bold_prefix="2. Phân vùng Khách hàng thành viên (Member Services): ")
    add_bullet_p(doc, "Gồm 5 Use Case nằm ở trung tâm sơ đồ có sự tham gia của cả Khách hàng và Quản trị viên: 'Thanh toán và đối soát đơn', 'Hiển thị thông tin tour và bài viết', 'Đánh giá và kiểm duyệt tour', 'Đặt tour và xử lý đơn', và 'Yêu cầu đổi / hủy tour'.", bold_prefix="3. Phân vùng Tương tác hai chiều Khách hàng - Quản trị viên (Interactive Collaboration): ")
    add_bullet_p(doc, "Gồm các ca sử dụng dành riêng cho Quản trị viên để quản lý hệ thống: 'Quản lý tài khoản và phân quyền', 'Quản lý thông tin tour', 'Quản lý lịch khởi hành', 'Quản lý bài viết quảng bá', 'Xem thống kê báo cáo', 'Quản lý đơn đặt tour', 'Cập nhật trạng thái thanh toán' và 'Tra cứu nhật ký hệ thống'.", bold_prefix="4. Phân vùng Quản trị hệ thống (System Administration): ")


    # MỤC 3: MA TRẬN PHÂN QUYỀN VÀ PHÂN TÍCH QUAN HỆ UML
    add_heading_3(doc, "Ma trận phân quyền và Tổng hợp các quan hệ UML (Include, Extend, Generalization)")
    add_heading_2(doc, "3.1. Ma trận phân quyền chi tiết cho 23 Use Case")
    add_body_p(doc, "Bảng dưới đây tổng hợp quyền truy cập và mục tiêu nghiệp vụ của toàn bộ 23 Use Case xuất hiện trên sơ đồ Hình 1:")

    matrix_data = [
    ["1", "UC01", "Đăng ký tài khoản", "✔ Trực tiếp", "— (Đã có TK)", "—", "Tạo tài khoản mới trong hệ thống bằng thông tin cá nhân và mật khẩu."],
    ["2", "UC02", "Tìm kiếm và lọc tour", "✔ Trực tiếp", "✔ Kế thừa", "—", "Tìm kiếm và lọc tour du lịch theo tên, địa danh, khoảng giá và thời gian khởi hành."],
    ["3", "UC03", "Xem bài viết quảng bá", "✔ Trực tiếp", "✔ Kế thừa", "—", "Đọc các bài viết cẩm nang, giới thiệu điểm đến và văn hóa du lịch."],
    ["4", "UC04", "Gửi yêu cầu tư vấn", "✔ Trực tiếp", "✔ Kế thừa", "—", "Gửi thông tin liên hệ và nội dung cần tư vấn về lịch trình tour riêng."],
    ["5", "UC05", "Xem chi tiết tour", "✔ Trực tiếp", "✔ Kế thừa", "—", "Xem thông tin chi tiết lộ trình từng ngày, bộ ảnh gallery, dịch vụ bao gồm và số chỗ còn lại."],
    ["6", "UC06", "Đăng nhập", "✔ Trực tiếp", "✔ Trực tiếp", "✔ Trực tiếp", "Xác thực người dùng và cấp quyền truy cập hệ thống."],
    ["7", "UC07", "Quên mật khẩu", "✔ Trực tiếp", "✔ Trực tiếp", "—", "Khôi phục mật khẩu tài khoản thông qua email xác thực (Mở rộng từ Đăng nhập)."],
    ["8", "UC08", "Đặt tour trực tuyến", "—", "✔ Trực tiếp", "—", "Lựa chọn lịch khởi hành, nhập thông tin hành khách và gửi yêu cầu đặt tour (Bao hàm Đăng nhập)."],
    ["9", "UC09", "Quản lý tour yêu thích", "—", "✔ Trực tiếp", "—", "Lưu các tour quan tâm vào danh sách yêu thích để theo dõi sau (Bao hàm Đăng nhập)."],
    ["10", "UC10", "Quản lý hồ sơ cá nhân", "—", "✔ Trực tiếp", "—", "Xem, cập nhật thông tin cá nhân và thay đổi mật khẩu tài khoản."],
    ["11", "UC11", "Thanh toán và đối soát đơn", "—", "✔ Tương tác", "✔ Tương tác", "Khách hàng chuyển khoản VietQR gửi minh chứng; Quản trị viên đối soát giao dịch."],
    ["12", "UC12", "Hiển thị thông tin tour và bài viết", "—", "✔ Tương tác", "✔ Tương tác", "Quản trị viên xuất bản dữ liệu tour/bài viết; Khách hàng tiếp nhận tra cứu."],
    ["13", "UC13", "Đánh giá và kiểm duyệt tour", "—", "✔ Tương tác", "✔ Tương tác", "Khách hàng gửi nhận xét/chấm điểm; Quản trị viên kiểm duyệt nội dung trước khi công khai."],
    ["14", "UC14", "Đặt tour và xử lý đơn", "—", "✔ Tương tác", "✔ Tương tác", "Khách hàng gửi yêu cầu đặt chỗ; Quản trị viên tiếp nhận, kiểm tra và xử lý đơn."],
    ["15", "UC15", "Yêu cầu đổi / hủy tour", "—", "✔ Tương tác", "✔ Tương tác", "Khách hàng gửi yêu cầu đổi/hủy đơn; Quản trị viên xem xét phê duyệt."],
    ["16", "UC16", "Cập nhật trạng thái thanh toán", "—", "—", "✔ Trực tiếp", "Quản trị viên cập nhật trạng thái thanh toán (Bao hàm bởi Quản lý đơn, Mở rộng khi hủy đơn)."],
    ["17", "UC17", "Quản lý tài khoản và phân quyền", "—", "—", "✔ Trực tiếp", "Quản lý danh sách tài khoản người dùng, thiết lập phân quyền và trạng thái hoạt động."],
    ["18", "UC18", "Quản lý thông tin tour", "—", "—", "✔ Trực tiếp", "Thêm mới, chỉnh sửa, cập nhật thông tin lịch trình, giá bán và hình ảnh tour."],
    ["19", "UC19", "Quản lý lịch khởi hành", "—", "—", "✔ Trực tiếp", "Thêm mới và cập nhật ngày khởi hành, ngày kết thúc và số chỗ của từng chuyến."],
    ["20", "UC20", "Quản lý bài viết quảng bá", "—", "—", "✔ Trực tiếp", "Soạn thảo, chỉnh sửa và đăng tải các bài viết cẩm nang du lịch."],
    ["21", "UC21", "Xem thống kê báo cáo", "—", "—", "✔ Trực tiếp", "Xem báo cáo thống kê doanh thu, số lượng đơn theo mốc thời gian."],
    ["22", "UC22", "Quản lý đơn đặt tour", "—", "—", "✔ Trực tiếp", "Tiếp nhận, kiểm tra thông tin hành khách, duyệt/hủy đơn và kích hoạt cập nhật thanh toán."],
    ["23", "UC23", "Tra cứu nhật ký hệ thống", "—", "—", "✔ Trực tiếp", "Tra cứu nhật ký kiểm toán (AUDITLOG) lưu vết các thao tác thay đổi dữ liệu."]
    ]
    create_styled_table(doc, ["STT", "Mã UC", "Tên Use Case", "Khách viếng thăm", "Khách hàng", "Quản trị viên", "Tóm tắt mục tiêu nghiệp vụ"], matrix_data, [0.4, 0.6, 1.8, 0.7, 0.7, 0.7, 1.6], "Bảng 2: Ma trận phân quyền chi tiết cho 23 Use Case trong Sơ đồ Hình 1")

    add_heading_2(doc, "3.2. Bảng tổng hợp và phân tích các quan hệ UML chuẩn hóa")
    add_body_p(doc, "Sơ đồ Use Case Hình 1 ứng dụng đầy đủ các quan hệ chuẩn tắc theo đặc tả OMG UML 2.5:")

    uml_relations_data = [
    ["Generalization (Kế thừa)", "Khách hàng (Customer)", "Khách viếng thăm (Guest)", "Mặc định", "Khách hàng kế thừa toàn bộ các chức năng tìm kiếm, xem tour, xem bài viết và đăng nhập của Khách viếng thăm."],
    ["Include (Bao hàm)", "Đặt tour trực tuyến (UC08)", "Đăng nhập (UC06)", "Bắt buộc", "Khi khách hàng bấm đặt tour, hệ thống yêu cầu bắt buộc phải đăng nhập tài khoản định danh để lưu đơn."],
    ["Include (Bao hàm)", "Quản lý tour yêu thích (UC09)", "Đăng nhập (UC06)", "Bắt buộc", "Khách hàng phải đăng nhập để lưu trữ và quản lý danh sách tour yêu thích gắn liền với tài khoản."],
    ["Include (Bao hàm)", "Quản lý đơn đặt tour (UC22)", "Cập nhật trạng thái thanh toán (UC16)", "Bắt buộc", "Khi quản trị viên duyệt đơn đặt tour, quy trình bắt buộc phải cập nhật trạng thái thanh toán tương ứng."],
    ["Extend (Mở rộng)", "Quên mật khẩu (UC07)", "Đăng nhập (UC06)", "Chọn quên mật khẩu", "Tại màn hình Đăng nhập, người dùng có thể kích hoạt luồng mở rộng khôi phục mật khẩu qua email."],
    ["Extend (Mở rộng)", "Đánh giá và kiểm duyệt tour (UC13)", "Đặt tour và xử lý đơn (UC14)", "Đơn đã hoàn thành", "Chỉ những đơn đặt tour đã hoàn thành chuyến đi thực tế mới được phép kích hoạt chức năng đánh giá và kiểm duyệt."],
    ["Extend (Mở rộng)", "Yêu cầu đổi / hủy tour (UC15)", "Đặt tour và xử lý đơn (UC14)", "Đơn đủ điều kiện đổi/hủy", "Đơn đặt tour đang ở trạng thái hợp lệ và trước thời hạn khởi hành quy định mới được kích hoạt nhánh đổi/hủy tour."],
    ["Extend (Mở rộng)", "Cập nhật trạng thái thanh toán (UC16)", "Yêu cầu đổi / hủy tour (UC15)", "Có hoàn tiền / chênh lệch", "Khi yêu cầu đổi hoặc hủy tour phát sinh nghiệp vụ hoàn tiền hoặc thu phí chênh lệch, hệ thống kích hoạt mở rộng cập nhật thanh toán."]
    ]
    create_styled_table(doc, ["Loại quan hệ UML", "Thành phần nguồn", "Thành phần đích", "Điều kiện kích hoạt", "Ý nghĩa nghiệp vụ"], uml_relations_data, [1.4, 1.4, 1.4, 1.1, 1.2], "Bảng 3: Tổng hợp các quan hệ Kế thừa, Bao hàm và Mở rộng trong Sơ đồ Hình 1")


    # MỤC 4: ĐẶC TẢ CHI TIẾT TOÀN BỘ 23 USE CASE
    add_heading_3(doc, "Đặc tả chi tiết từng đỉnh chức năng cho toàn bộ 23 Use Case (UC01 - UC23)")
    add_body_p(
    doc,
    "Dưới đây là bảng đặc tả chi tiết cho toàn bộ 23 Use Case xuất hiện trên sơ đồ Hình 1 theo chuẩn quốc tế: "
    "Tác nhân tham gia, Mô tả tóm tắt, Tiền điều kiện, Hậu điều kiện, Luồng sự kiện chính (Basic Flow), "
    "Luồng sự kiện phụ / Ngoại lệ (Alternative Flows) và Quan hệ phụ thuộc:"
    )

    # 4.1 NHÓM KHÁCH VIẾNG THĂM & XÁC THỰC
    add_heading_2(doc, "4.1. Nhóm Chức năng Khách viếng thăm & Xác thực (UC01 - UC07)")

    add_use_case_spec_table(
    doc, "UC01", "Đăng ký tài khoản",
    "Khách viếng thăm (Guest)",
    "Cho phép người dùng chưa có tài khoản tạo tài khoản mới trong hệ thống bằng thông tin cá nhân hợp lệ.",
    "Người dùng đã truy cập vào website và mở biểu mẫu Đăng ký.",
    "Tài khoản mới được lưu thành công vào bảng NGUOIDUNG; người dùng có thể đăng nhập ngay.",
    "1. Người dùng bấm nút 'Đăng ký' trên thanh điều hướng.\n"
    "2. Hệ thống hiển thị form yêu cầu nhập: Họ và tên, Email, Số điện thoại, Mật khẩu và Xác nhận mật khẩu.\n"
    "3. Người dùng điền đầy đủ thông tin và bấm 'Đăng ký ngay'.\n"
    "4. Hệ thống kiểm tra tính hợp lệ dữ liệu (Email đúng định dạng, SĐT đúng chuẩn, mật khẩu khớp nhau).\n"
    "5. Hệ thống truy vấn CSDL kiểm tra trùng lặp Email và Số điện thoại.\n"
    "6. Hệ thống băm mật khẩu bảo mật (Bcrypt/Argon2), chèn bản ghi mới vào NGUOIDUNG.\n"
    "7. Hệ thống thông báo 'Đăng ký tài khoản thành công' và chuyển hướng người dùng sang form Đăng nhập.",
    "• A1 (Thiếu trường bắt buộc): Hệ thống báo đỏ tại trường bị thiếu và yêu cầu điền bổ sung.\n"
    "• A2 (Trùng Email hoặc SĐT): Hệ thống hiển thị cảnh báo 'Email hoặc Số điện thoại đã được sử dụng' và yêu cầu dùng thông tin khác."
    )

    add_use_case_spec_table(
    doc, "UC02", "Tìm kiếm và lọc tour",
    "Khách viếng thăm, Khách hàng",
    "Cung cấp công cụ tra cứu tour du lịch thông minh đa tiêu chí theo từ khóa, vùng miền, khoảng giá và thời lượng.",
    "Người dùng đang ở Trang chủ hoặc Trang Danh mục tour.",
    "Danh sách các tour du lịch thỏa mãn điều kiện lọc được hiển thị trực quan kèm mức giá và thời lượng.",
    "1. Người dùng nhập từ khóa vào ô tìm kiếm (tên tour, điểm đến) hoặc chọn bộ lọc (Vùng miền, Mức giá, Thời lượng).\n"
    "2. Người dùng nhấn nút 'Tìm kiếm' hoặc thay đổi lựa chọn bộ lọc.\n"
    "3. Hệ thống gửi yêu cầu lọc tới API Backend.\n"
    "4. Hệ thống xây dựng câu truy vấn SQL có điều kiện tương ứng và thực thi trên bảng TOUR, DANHMUC.\n"
    "5. CSDL trả về tập dữ liệu tour phù hợp.\n"
    "6. Hệ thống render danh sách thẻ tour kèm hình ảnh, giá cơ bản và xếp hạng sao.",
    "• A1 (Không tìm thấy kết quả): Hệ thống hiển thị thông báo 'Không tìm thấy tour phù hợp với tiêu chí của bạn' kèm gợi ý mở rộng khoảng giá hoặc xóa bộ lọc."
    )

    add_use_case_spec_table(
    doc, "UC03", "Xem bài viết quảng bá",
    "Khách viếng thăm, Khách hàng",
    "Cho phép người dùng đọc các bài viết cẩm nang du lịch, kinh nghiệm khám phá điểm đến và giới thiệu văn hóa ẩm thực.",
    "Người dùng truy cập vào mục 'Cẩm nang du lịch' hoặc nhấn vào liên kết bài viết.",
    "Nội dung chi tiết bài viết, hình ảnh minh họa và tác giả được hiển thị đầy đủ.",
    "1. Người dùng bấm vào tiêu đề bài viết trong danh sách cẩm nang du lịch.\n"
    "2. Hệ thống tiếp nhận mã bài viết và truy vấn bảng BAIVIET_QUANGBA.\n"
    "3. Hệ thống hiển thị giao diện bài viết gồm: Tiêu đề, Tác giả, Ngày đăng, Ảnh bìa và Toàn văn nội dung.\n"
    "4. Hệ thống gợi ý danh sách các bài viết liên quan và các tour du lịch tương ứng với địa danh trong bài viết.",
    "• A1 (Bài viết không tồn tại hoặc đã bị ẩn): Hệ thống hiển thị trang thông báo 'Bài viết không tồn tại hoặc đang cập nhật' và gợi ý quay về trang chủ."
    )

    add_use_case_spec_table(
    doc, "UC04", "Gửi yêu cầu tư vấn",
    "Khách viếng thăm, Khách hàng",
    "Cho phép người dùng gửi thông tin liên hệ và nhu cầu thiết kế tour riêng hoặc giải đáp thắc mắc dịch vụ.",
    "Người dùng mở form 'Liên hệ tư vấn' trên website.",
    "Thông tin yêu cầu tư vấn được gửi thành công tới hòm thư quản trị viên.",
    "1. Người dùng mở mục 'Liên hệ / Tư vấn tour'.\n"
    "2. Người dùng nhập: Họ tên, Số điện thoại, Email, Điểm đến quan tâm và Lời nhắn yêu cầu.\n"
    "3. Người dùng nhấn 'Gửi yêu cầu'.\n"
    "4. Hệ thống validate số điện thoại và email hợp lệ.\n"
    "5. Hệ thống ghi nhận yêu cầu và gửi email thông báo tới ban tư vấn chăm sóc khách hàng.\n"
    "6. Hệ thống hiển thị popup 'Gửi yêu cầu tư vấn thành công! Nhân viên tư vấn sẽ liên hệ lại với quý khách trong vòng 30 phút'.",
    "• A1 (Sai định dạng SĐT hoặc Email): Hệ thống thông báo lỗi cú pháp và yêu cầu chỉnh sửa lại."
    )

    add_use_case_spec_table(
    doc, "UC05", "Xem chi tiết tour",
    "Khách viếng thăm, Khách hàng",
    "Hiển thị toàn bộ thông tin chi tiết của một sản phẩm tour: bộ ảnh gallery, lộ trình từng ngày, danh sách chuyến khởi hành và chính sách giá.",
    "Người dùng nhấn vào một tour du lịch bất kỳ trên danh sách.",
    "Trang chi tiết tour được tải hoàn chỉnh kèm trạng thái số chỗ khả dụng.",
    "1. Người dùng nhấn chọn một thẻ tour du lịch.\n"
    "2. Hệ thống gửi mã MaTour tới Backend API.\n"
    "3. Backend truy vấn dữ liệu từ TOUR, HINHANH_TOUR, LICH_TRINH_DETAIL và CHUYENKHOIHANH.\n"
    "4. Giao diện hiển thị: Slide ảnh gallery thực tế, Bảng tổng quan thông tin (Thời lượng, Phương tiện, Điểm đón), Các tabs lộ trình từng ngày (Day-by-Day), Danh mục dịch vụ 'Bao gồm / Không bao gồm' và Bảng chọn lịch khởi hành kèm số chỗ còn nhận.\n"
    "5. Người dùng có thể chọn ngày khởi hành và bấm 'Đặt tour ngay'.",
    "• A1 (Tour đã ngừng mở bán): Hệ thống hiển thị nhãn 'Tạm ngừng mở bán' và ẩn nút đặt tour."
    )

    add_use_case_spec_table(
    doc, "UC06", "Đăng nhập",
    "Khách viếng thăm, Khách hàng, Quản trị viên",
    "Xác thực danh tính người dùng và cấp quyền truy cập hệ thống tương ứng với vai trò.",
    "Người dùng đã có tài khoản và đang ở giao diện Đăng nhập.",
    "Phiên đăng nhập an toàn được thiết lập; giao diện cập nhật trạng thái đã đăng nhập kèm menu người dùng.",
    "1. Người dùng bấm nút 'Đăng nhập' trên thanh điều hướng.\n"
    "2. Người dùng nhập Email (hoặc Số điện thoại) và Mật khẩu, sau đó bấm 'Đăng nhập'.\n"
    "3. Hệ thống kiểm tra cú pháp và gửi yêu cầu tới Auth API.\n"
    "4. Backend truy vấn tài khoản trong bảng NGUOIDUNG theo Email.\n"
    "5. Backend so khớp chuỗi băm mật khẩu.\n"
    "6. Nếu khớp: Hệ thống tạo Token phiên (JWT/Session Cookie), lưu thông tin phiên đăng nhập an toàn.\n"
    "7. Hệ thống chuyển hướng người dùng về trang trước đó hoặc trang Dashboard quản trị nếu là Quản trị viên.",
    "• A1 (Sai thông tin đăng nhập): Hệ thống hiển thị cảnh báo 'Email hoặc Mật khẩu không chính xác'.\n"
    "• A2 (Quên mật khẩu): Người dùng bấm vào liên kết 'Quên mật khẩu?' -> Kích hoạt điểm mở rộng <<extend>> sang UC07.",
    "Quan hệ mở rộng: Mở rộng bởi UC07 (Quên mật khẩu) theo nhánh <<extend>> [Chọn quên mật khẩu]"
    )

    add_use_case_spec_table(
    doc, "UC07", "Quên mật khẩu",
    "Khách viếng thăm, Khách hàng",
    "Hỗ trợ người dùng khôi phục quyền truy cập tài khoản thông qua đường dẫn xác thực gửi về email đã đăng ký.",
    "Người dùng chọn liên kết 'Quên mật khẩu' tại màn hình Đăng nhập (UC06).",
    "Mật khẩu mới được cập nhật thành công và người dùng có thể đăng nhập bằng mật khẩu mới.",
    "1. Người dùng chọn 'Quên mật khẩu?' tại form đăng nhập (Điểm mở rộng của UC06).\n"
    "2. Hệ thống hiển thị form yêu cầu nhập Email tài khoản cần khôi phục.\n"
    "3. Người dùng nhập Email và bấm 'Gửi mã xác nhận'.\n"
    "4. Hệ thống kiểm tra sự tồn tại của Email trong bảng NGUOIDUNG.\n"
    "5. Hệ thống sinh mã token khôi phục ngẫu nhiên kèm thời hạn 15 phút, gửi email chứa liên kết khôi phục tới hòm thư người dùng.\n"
    "6. Người dùng nhấn vào liên kết trong email, chuyển tới trang đặt lại mật khẩu.\n"
    "7. Người dùng nhập mật khẩu mới và xác nhận mật khẩu, bấm 'Cập nhật'.\n"
    "8. Hệ thống băm mật khẩu mới, cập nhật vào CSDL và thông báo thành công.",
    "• A1 (Email không tồn tại trong hệ thống): Hệ thống thông báo 'Không tìm thấy tài khoản với email này'.\n"
    "• A2 (Mã xác thực hết hạn): Hệ thống báo 'Liên kết khôi phục đã hết hạn, vui lòng thao tác lại'.",
    "Quan hệ mở rộng: Là Use Case mở rộng <<extend>> của UC06 (Đăng nhập) với điều kiện [Chọn quên mật khẩu]"
    )


    # 4.2 NHÓM DÀNH RIÊNG CHO KHÁCH HÀNG
    add_heading_2(doc, "4.2. Nhóm Chức năng Dành Riêng Cho Khách Hàng (UC08 - UC10)")

    add_use_case_spec_table(
    doc, "UC08", "Đặt tour trực tuyến",
    "Khách hàng (Customer)",
    "Cho phép khách hàng lựa chọn lịch khởi hành cụ thể, nhập thông tin liên hệ và danh sách hành khách chi tiết theo độ tuổi để gửi yêu cầu đặt tour.",
    "Khách hàng đã đăng nhập tài khoản (hoặc hệ thống gọi <<include>> UC06) và đã chọn một tour du lịch cụ thể.",
    "Yêu cầu đặt vé được tạo thành công, số chỗ khả dụng được kiểm tra và chuyển tiếp sang bước thanh toán.",
    "1. Khách hàng xem trang chi tiết tour, lựa chọn ngày khởi hành cụ thể từ danh sách và bấm 'Đặt tour'.\n"
    "2. Hệ thống kiểm tra phiên đăng nhập; nếu chưa đăng nhập, kích hoạt quan hệ <<include>> UC06 để đăng nhập.\n"
    "3. Hệ thống hiển thị biểu mẫu Đặt tour gồm: Thông tin người đặt (tự động điền theo hồ sơ tài khoản), Bảng chọn số lượng khách phân theo nhóm tuổi (Người lớn, Trẻ em, Em bé).\n"
    "4. Khách hàng nhập danh sách họ tên, ngày sinh, số CCCD cho từng hành khách đi kèm.\n"
    "5. Hệ thống tự động tính toán tổng tiền tạm tính theo bảng giá của chuyến đi và hiển thị tóm tắt chi phí.\n"
    "6. Khách hàng kiểm tra lại thông tin và bấm 'Xác nhận đặt tour'.\n"
    "7. Hệ thống chuyển tiếp dữ liệu sang luồng tương tác Đặt tour và xử lý đơn (UC14) và màn hình Thanh toán VietQR (UC11).",
    "• A1 (Không đủ số chỗ trống): Hệ thống cảnh báo 'Số lượng chỗ còn nhận không đủ cho đoàn của bạn' và yêu cầu giảm số khách hoặc chọn ngày khởi hành khác.\n"
    "• A2 (Thông tin hành khách không hợp lệ): Hệ thống chỉ rõ ô nhập thiếu thông tin bắt buộc.",
    "Quan hệ bao hàm: Bao hàm <<include>> UC06 (Đăng nhập)"
    )

    add_use_case_spec_table(
    doc, "UC09", "Quản lý tour yêu thích",
    "Khách hàng (Customer)",
    "Cho phép khách hàng lưu trữ các tour quan tâm vào danh sách yêu thích cá nhân (Wishlist) để dễ dàng theo dõi biến động giá và đặt sau.",
    "Khách hàng đang xem trang danh sách hoặc chi tiết tour.",
    "Tour được thêm hoặc xóa khỏi danh mục yêu thích của tài khoản khách hàng.",
    "1. Khách hàng bấm vào biểu tượng 'Trái tim / Yêu thích' trên thẻ tour.\n"
    "2. Hệ thống kiểm tra phiên đăng nhập (Bao hàm <<include>> UC06 nếu chưa đăng nhập).\n"
    "3. Hệ thống lưu mã MaTour vào danh sách yêu thích của tài khoản trong CSDL/LocalStorage.\n"
    "4. Biểu tượng trái tim đổi sang trạng thái sáng đỏ xác nhận đã lưu.\n"
    "5. Khách hàng có thể truy cập mục 'Tour yêu thích' trên thanh menu để xem lại toàn bộ danh sách đã lưu và bấm đặt tour nhanh chóng.\n"
    "6. Khách hàng có thể bấm lại biểu tượng trái tim để gỡ tour khỏi danh sách yêu thích.",
    "• A1 (Lỗi kết nối): Hệ thống hiển thị thông báo 'Không thể lưu tour yêu thích, vui lòng thử lại'.",
    "Quan hệ bao hàm: Bao hàm <<include>> UC06 (Đăng nhập)"
    )

    add_use_case_spec_table(
    doc, "UC10", "Quản lý hồ sơ cá nhân",
    "Khách hàng (Customer)",
    "Cung cấp giao diện để khách hàng theo dõi và cập nhật thông tin cá nhân, số điện thoại, địa chỉ và đổi mật khẩu bảo mật.",
    "Khách hàng đã đăng nhập tài khoản và truy cập trang 'Thông tin cá nhân'.",
    "Thông tin hồ sơ mới được cập nhật chính xác vào bảng NGUOIDUNG.",
    "1. Khách hàng bấm vào tên tài khoản trên thanh điều hướng, chọn 'Hồ sơ cá nhân'.\n"
    "2. Hệ thống tải và hiển thị thông tin hiện tại: Họ tên, Email, Số điện thoại, Địa chỉ thường trú.\n"
    "3. Khách hàng chỉnh sửa các trường thông tin mong muốn (hoặc mở tab 'Đổi mật khẩu' để nhập mật khẩu hiện tại và mật khẩu mới).\n"
    "4. Khách hàng bấm 'Lưu thay đổi'.\n"
    "5. Hệ thống kiểm tra tính hợp lệ dữ liệu và cập nhật bản ghi trong bảng NGUOIDUNG.\n"
    "6. Hệ thống hiển thị thông báo 'Cập nhật hồ sơ cá nhân thành công!'.",
    "• A1 (Sai mật khẩu cũ khi đổi mật khẩu): Hệ thống thông báo 'Mật khẩu hiện tại không chính xác' và không cho phép đổi mật khẩu.\n"
    "• A2 (Số điện thoại mới bị trùng lặp): Hệ thống thông báo số điện thoại đã thuộc về tài khoản khác."
    )


    # 4.3 NHÓM TƯƠNG TÁC KHÁCH HÀNG - QUẢN TRỊ VIÊN
    add_heading_2(doc, "4.3. Nhóm Chức năng Tương Tác Nghiệp Vụ Khách Hàng - Quản Trị Viên (UC11 - UC15)")

    add_use_case_spec_table(
    doc, "UC11", "Thanh toán và đối soát đơn",
    "Khách hàng, Quản trị viên",
    "Thực hiện quy trình chuyển khoản trực tuyến qua mã VietQR chuẩn ngân hàng và đối soát giao dịch xác nhận thanh toán giữa hai phía.",
    "Đơn đặt tour đã được tạo thành công ở trạng thái 'Chờ thanh toán'.",
    "Minh chứng thanh toán được tải lên, quản trị viên đối soát khớp lệnh và đơn hàng chuyển sang trạng thái 'Đã thanh toán'.",
    "1. (Khách hàng): Trên màn hình thanh toán, hệ thống hiển thị mã VietQR động chuẩn NAPAS247 chứa chính xác số tài khoản ngân hàng, số tiền và mã booking.\n"
    "2. (Khách hàng): Mở ứng dụng ngân hàng số trên điện thoại, quét mã QR và xác nhận chuyển khoản.\n"
    "3. (Khách hàng): Tải ảnh chụp biên lai giao dịch thành công lên hệ thống và bấm 'Tôi đã thanh toán'.\n"
    "4. (Hệ thống): Cập nhật trạng thái thanh toán trong THANHTOAN sang 'Chờ đối soát'.\n"
    "5. (Quản trị viên): Đăng nhập cổng Admin, mở phân hệ 'Đối soát thanh toán' để kiểm tra danh sách đơn chờ đối soát.\n"
    "6. (Quản trị viên): So khớp số tiền, mã booking trên biên lai với sao kê tài khoản ngân hàng của doanh nghiệp.\n"
    "7. (Quản trị viên): Nhấn nút 'Xác nhận thanh toán hợp lệ'.\n"
    "8. (Hệ thống): Cập nhật trạng thái đơn trong DATTOUR và THANHTOAN sang 'Đã thanh toán', ghi log kiểm toán và gửi email xác nhận vé điện tử tới khách hàng.",
    "• A1 (Biên lai sai lệch thông tin hoặc thiếu tiền): Quản trị viên nhấn 'Từ chối đối soát' kèm lý do; hệ thống gửi thông báo yêu cầu khách hàng kiểm tra lại giao dịch.\n"
    "• A2 (Khách hàng thanh toán tự động qua SePay IPN Webhook): Hệ thống tự động đối soát theo biến động số dư ngân hàng và cập nhật đơn ngay lập tức mà không cần thao tác tay."
    )

    add_use_case_spec_table(
    doc, "UC12", "Hiển thị thông tin tour và bài viết",
    "Khách hàng, Quản trị viên",
    "Đảm bảo luồng cung cấp thông tin liên tục: Quản trị viên cập nhật dữ liệu tour/bài viết và hệ thống lưu trữ, cung cấp thông tin đã cập nhật để khách hàng tra cứu.",
    "Quản trị viên xuất bản dữ liệu mới hoặc cập nhật nội dung có sẵn.",
    "Thông tin tour và bài viết mới nhất được lưu trữ an toàn trong CSDL và cung cấp chính xác cho khách hàng tra cứu.",
    "1. (Quản trị viên): Biên tập thông tin tour mới, lộ trình chi tiết từng ngày, bảng giá vé, ảnh gallery hoặc soạn thảo bài viết cẩm nang du lịch.\n"
    "2. (Quản trị viên): Nhấn nút 'Xuất bản / Lưu dữ liệu'.\n"
    "3. (Hệ thống): Kiểm tra các ràng buộc toàn vẹn dữ liệu, lưu trữ thông tin vào các bảng TOUR, LICH_TRINH_DETAIL, HINHANH_TOUR, BAIVIET_QUANGBA.\n"
    "4. (Hệ thống): Cập nhật trạng thái hiển thị của bản ghi sang kích hoạt (KichHoat = 1).\n"
    "5. (Khách hàng): Truy cập website, tìm kiếm và duyệt danh mục tour hoặc chuyên mục cẩm nang du lịch.\n"
    "6. (Hệ thống): Truy vấn CSDL và kết xuất thông tin đã cập nhật lên giao diện để khách hàng theo dõi, nghiên cứu và đưa ra quyết định đặt tour.",
    "• A1 (Quản trị viên chọn 'Ẩn hiển thị'): Dữ liệu chỉ được lưu trong CSDL mà không xuất hiện công khai trên giao diện người dùng."
    )

    add_use_case_spec_table(
    doc, "UC13", "Đánh giá và kiểm duyệt tour",
    "Khách hàng, Quản trị viên",
    "Cho phép khách hàng đã hoàn thành chuyến đi gửi nhận xét và chấm điểm sao; quản trị viên xem xét nội dung và kiểm duyệt trước khi hiển thị công khai.",
    "Khách hàng đã tham gia và hoàn thành chuyến đi thực tế của đơn đặt tour (Điều kiện mở rộng [Đơn đã hoàn thành] từ UC14).",
    "Đánh giá được kiểm duyệt và hiển thị công khai tại mục đánh giá của trang chi tiết tour.",
    "1. (Khách hàng): Sau khi chuyến đi kết thúc, khách hàng truy cập 'Đơn đặt của tôi' và bấm 'Đánh giá tour' (Điểm mở rộng của UC14).\n"
    "2. (Khách hàng): Chọn số sao đánh giá (từ 1 đến 5 sao), nhập nội dung bình luận trải nghiệm và bấm 'Gửi đánh giá'.\n"
    "3. (Hệ thống): Lưu bản ghi vào bảng DANHGIA với trạng thái 'Chờ kiểm duyệt'.\n"
    "4. (Quản trị viên): Truy cập phân hệ 'Kiểm duyệt đánh giá' trên cổng Admin Dashboard.\n"
    "5. (Quản trị viên): Đọc nội dung bình luận, kiểm tra tính văn minh, loại bỏ từ ngữ thô tục hoặc spam.\n"
    "6. (Quản trị viên): Nhấn nút 'Duyệt hiển thị' (hoặc 'Ẩn đánh giá' nếu vi phạm quy chuẩn).\n"
    "7. (Hệ thống): Cập nhật trạng thái hiển thị và tính toán lại điểm đánh giá trung bình của sản phẩm tour.",
    "• A1 (Đơn tour chưa hoàn thành): Hệ thống từ chối mở form đánh giá và thông báo 'Quý khách chỉ có thể đánh giá sau khi chuyến đi đã kết thúc'.",
    "Quan hệ mở rộng: Là Use Case mở rộng <<extend>> của UC14 (Đặt tour và xử lý đơn) với điều kiện [Đơn đã hoàn thành]"
    )

    add_use_case_spec_table(
    doc, "UC14", "Đặt tour và xử lý đơn",
    "Khách hàng, Quản trị viên",
    "Luồng phối hợp cốt lõi: Khách hàng gửi yêu cầu đặt tour, hệ thống kiểm tra và giữ chỗ; quản trị viên tiếp nhận, kiểm tra thông tin hành khách và xử lý đơn hàng.",
    "Khách hàng đã hoàn thành biểu mẫu đặt tour và bấm xác nhận gửi yêu cầu.",
    "Đơn đặt tour được ghi nhận vào bảng DATTOUR, số chỗ khả dụng được cập nhật và chuyển sang trạng thái xử lý.",
    "1. (Khách hàng): Lựa chọn tour, lịch khởi hành, nhập danh sách hành khách và bấm 'Xác nhận đặt tour'.\n"
    "2. (Hệ thống): Khởi tạo giao dịch an toàn (Serializable Transaction), gọi Stored Procedure khóa dòng chuyến khởi hành.\n"
    "3. (Hệ thống): Kiểm tra số chỗ còn trống; nếu đủ chỗ, tạo đơn mới (BK...), kích hoạt Trigger TRG_DATTOUR_CheckAndLockSeats trừ số chỗ khả dụng và lưu đơn ở trạng thái 'Chờ thanh toán'.\n"
    "4. (Quản trị viên): Nhận được thông báo có đơn đặt mới trên Admin Dashboard.\n"
    "5. (Quản trị viên): Mở chi tiết đơn hàng, kiểm tra danh sách hành khách (CCCD, độ tuổi), lịch trình chuyến đi.\n"
    "6. (Quản trị viên): Tiếp nhận đơn hàng và chuẩn bị công tác hậu cần (liên hệ nhà xe, khách sạn).\n"
    "7. (Khách hàng & Quản trị viên): Phối hợp tiếp tục luồng Thanh toán và đối soát đơn (UC11).",
    "• A1 (Hết chỗ khả dụng do tranh chấp đồng thời): Hệ thống rollback giao dịch và thông báo lỗi Overbooking cho khách hàng.\n"
    "• A2 (Khách hàng gửi yêu cầu đổi/hủy đơn): Kích hoạt điểm mở rộng <<extend>> sang UC15 nếu đơn đủ điều kiện.",
    "Quan hệ mở rộng: Được mở rộng bởi UC13 (Đánh giá và kiểm duyệt tour) [Đơn đã hoàn thành] và UC15 (Yêu cầu đổi / hủy tour) [Đơn đủ điều kiện đổi/hủy]"
    )

    add_use_case_spec_table(
    doc, "UC15", "Yêu cầu đổi / hủy tour",
    "Khách hàng, Quản trị viên",
    "Cho phép khách hàng gửi yêu cầu đổi ngày hoặc hủy đơn đặt tour kèm lý do; quản trị viên xem xét phê duyệt và hệ thống tự động hoàn trả số chỗ trống.",
    "Đơn đặt tour đang ở trạng thái hợp lệ và đáp ứng quy định thời gian trước ngày khởi hành (Điểm mở rộng của UC14).",
    "Đơn đặt tour chuyển trạng thái sang 'Đã hủy', số chỗ trống được hoàn trả tự động về chuyến khởi hành.",
    "1. (Khách hàng): Vào mục 'Đơn đặt của tôi', chọn đơn hàng cần xử lý và bấm 'Yêu cầu hủy / đổi tour' (Điểm mở rộng của UC14).\n"
    "2. (Khách hàng): Chọn loại yêu cầu (Hủy tour hoặc Đổi ngày khởi hành), nhập lý do cụ thể và bấm 'Gửi yêu cầu'.\n"
    "3. (Hệ thống): Kiểm tra chính sách thời gian (ví dụ: trước 5 ngày khởi hành) và lưu yêu cầu vào hệ thống.\n"
    "4. (Quản trị viên): Nhận thông báo yêu cầu hủy/đổi đơn trên cổng Admin.\n"
    "5. (Quản trị viên): Kiểm tra lý do và chính sách phạt hủy theo điều khoản hợp đồng lữ hành.\n"
    "6. (Quản trị viên): Nhấn nút 'Phê duyệt hủy đơn' (hoặc phê duyệt đổi ngày khởi hành mới).\n"
    "7. (Hệ thống): Cập nhật trạng thái đơn thành 'Đã hủy', kích hoạt Trigger TRG_DATTOUR_CancelAndReleaseSeats tự động giảm số chỗ đã đặt, giải phóng chỗ trống về CHUYENKHOIHANH.\n"
    "8. (Hệ thống): Nếu phát sinh hoàn tiền vé hoặc thu phí chênh lệch, kích hoạt điểm mở rộng <<extend>> sang UC16 để cập nhật trạng thái thanh toán.",
    "• A1 (Quá hạn hủy tour theo quy định): Hệ thống hiển thị thông báo từ chối hủy tự động và hướng dẫn khách hàng liên hệ đường dây nóng hotline để được hỗ trợ đặc biệt.",
    "Quan hệ mở rộng: Là Use Case mở rộng <<extend>> của UC14 [Đơn đủ điều kiện đổi/hủy]; Mở rộng sang UC16 theo nhánh <<extend>> [Có hoàn tiền / chênh lệch]"
    )


    # 4.4 NHÓM QUẢN TRỊ HỆ THỐNG
    add_heading_2(doc, "4.4. Nhóm Chức năng Quản Trị Hệ Thống (UC16 - UC23)")

    add_use_case_spec_table(
    doc, "UC16", "Cập nhật trạng thái thanh toán",
    "Quản trị viên (Admin)",
    "Quản trị viên cập nhật trạng thái dòng tiền thanh toán của đơn hàng (Đã thanh toán, Chờ đối soát, Đã hoàn tiền) trong các luồng duyệt đơn hoặc hoàn hủy vé.",
    "Quản trị viên có phiên làm việc hợp lệ; đơn hàng đã được đối soát hoặc được phê duyệt hoàn tiền.",
    "Bản ghi THANHTOAN được cập nhật chính xác và ghi nhận biến động số dư trong AUDITLOG.",
    "1. Quản trị viên mở phân hệ 'Quản lý thanh toán' hoặc thao tác trực tiếp từ màn hình chi tiết đơn đặt tour.\n"
    "2. Quản trị viên chọn trạng thái thanh toán mới: 'Đã thanh toán' (khi nhận đủ tiền) hoặc 'Đã hoàn tiền' (khi hủy đơn hoàn tiền).\n"
    "3. Quản trị viên nhập mã tham chiếu giao dịch ngân hàng và ghi chú nghiệp vụ.\n"
    "4. Quản trị viên bấm 'Lưu trạng thái'.\n"
    "5. Hệ thống cập nhật bảng THANHTOAN và bảng DATTOUR.\n"
    "6. Trigger tự động ghi nhật ký biến động tài chính vào bảng AUDITLOG.",
    "• A1 (Lỗi kết nối CSDL): Hệ thống rollback và thông báo thử lại.",
    "Quan hệ: Được bao hàm <<include>> bởi UC22 (Quản lý đơn đặt tour); Mở rộng <<extend>> từ UC15 (Yêu cầu đổi / hủy tour) [Có hoàn tiền / chênh lệch]"
    )

    add_use_case_spec_table(
    doc, "UC17", "Quản lý tài khoản và phân quyền",
    "Quản trị viên (Admin)",
    "Quản trị viên quản lý danh sách tài khoản người dùng, thiết lập phân quyền quản trị và quản lý trạng thái hoạt động của tài khoản.",
    "Quản trị viên đã đăng nhập tài khoản có quyền Quản trị tối cao (Super Admin).",
    "Thông tin tài khoản và quyền hạn được cập nhật trong CSDL.",
    "1. Quản trị viên truy cập mục 'Quản lý tài khoản' trên thanh điều hướng Admin Dashboard.\n"
    "2. Hệ thống tải và hiển thị danh sách tất cả tài khoản người dùng trong bảng NGUOIDUNG.\n"
    "3. Quản trị viên có thể tìm kiếm tài khoản theo Họ tên, Email, Số điện thoại.\n"
    "4. Quản trị viên chọn tài khoản để xem chi tiết lịch sử đặt tour.\n"
    "5. Quản trị viên thực hiện thao tác: Khóa tài khoản (khi phát hiện gian lận) hoặc Mở khóa tài khoản.\n"
    "6. Hệ thống lưu trạng thái mới và ghi vết vào AUDITLOG.",
    "• A1 (Không thể tự khóa chính mình): Hệ thống ngăn chặn quản trị viên tự khóa tài khoản đang đăng nhập."
    )

    add_use_case_spec_table(
    doc, "UC18", "Quản lý thông tin tour",
    "Quản trị viên (Admin)",
    "Quản trị viên thực hiện các thao tác thêm mới, chỉnh sửa, cập nhật thông tin lịch trình, mức giá và hình ảnh gallery của sản phẩm tour.",
    "Quản trị viên đã đăng nhập và truy cập phân hệ 'Quản lý sản phẩm tour'.",
    "Dữ liệu tour mới hoặc thông tin cập nhật được lưu trữ hoàn chỉnh vào các bảng TOUR, HINHANH_TOUR, LICH_TRINH_DETAIL.",
    "1. Quản trị viên mở trang 'Quản lý tour' trên Admin Dashboard.\n"
    "2. Quản trị viên nhấn 'Thêm tour mới' (hoặc bấm biểu tượng Sửa tại một tour có sẵn).\n"
    "3. Nhập các trường thông tin: Tên tour, Danh mục vùng miền, Giá cơ bản, Số ngày/đêm, Điểm đón, Điểm đến.\n"
    "4. Tải lên ảnh đại diện chính và các ảnh trong bộ sưu tập gallery (lưu vào HINHANH_TOUR).\n"
    "5. Nhập nội dung lịch trình chi tiết bóc tách từng ngày (Day 1, Day 2...) lưu vào LICH_TRINH_DETAIL.\n"
    "6. Nhấn nút 'Lưu thông tin tour'.\n"
    "7. Hệ thống validate dữ liệu (Giá > 0, Số ngày > 0) và lưu vào CSDL, đồng bộ hiển thị lên giao diện khách hàng.",
    "• A1 (Vi phạm ràng buộc CHECK): Hệ thống thông báo lỗi giá trị âm và yêu cầu chỉnh sửa lại."
    )

    add_use_case_spec_table(
    doc, "UC19", "Quản lý lịch khởi hành",
    "Quản trị viên (Admin)",
    "Cho phép quản trị viên mở bán các chuyến khởi hành cụ thể cho từng tour, thiết lập ngày đi, ngày về, giá vé người lớn/trẻ em và số chỗ tối đa.",
    "Tour du lịch tương ứng đã tồn tại trong bảng TOUR.",
    "Chuyến khởi hành mới được khởi tạo trong CHUYENKHOIHANH và mở bán công khai trên website.",
    "1. Quản trị viên mở phân hệ 'Quản lý lịch khởi hành'.\n"
    "2. Chọn tour du lịch cần mở chuyến đi mới.\n"
    "3. Nhập các thông số: Ngày khởi hành, Ngày kết thúc, Giá vé người lớn, Giá vé trẻ em, Tổng số chỗ tối đa mở bán (SoChoToiDa).\n"
    "4. Hệ thống kiểm tra ràng buộc Ngày kết thúc >= Ngày khởi hành và Số chỗ tối đa > 0.\n"
    "5. Quản trị viên nhấn 'Tạo lịch khởi hành'.\n"
    "6. Hệ thống chèn bản ghi mới vào bảng CHUYENKHOIHANH với SoChoDaDat = 0 và TrangThai = N'Còn chỗ'.\n"
    "7. Chuyến khởi hành mới lập tức xuất hiện tại bảng chọn ngày trên trang chi tiết tour của khách hàng.",
    "• A1 (Ngày khởi hành trong quá khứ): Hệ thống cảnh báo ngày đi phải lớn hơn hoặc bằng ngày hiện tại."
    )

    add_use_case_spec_table(
    doc, "UC20", "Quản lý bài viết quảng bá",
    "Quản trị viên (Admin)",
    "Hỗ trợ biên tập viên soạn thảo, đăng tải và quản lý các bài viết tin tức, cẩm nang du lịch và kinh nghiệm khám phá văn hóa.",
    "Quản trị viên đã đăng nhập và mở mục 'Quản lý bài viết'.",
    "Bài viết được xuất bản và hiển thị tại chuyên mục Cẩm nang du lịch.",
    "1. Quản trị viên chọn 'Quản lý bài viết' -> Bấm 'Viết bài mới'.\n"
    "2. Nhập Tiêu đề bài viết, Chọn ảnh bìa đại diện, Nhập tóm tắt và Soạn thảo nội dung chi tiết bài viết.\n"
    "3. Quản trị viên nhấn 'Đăng bài'.\n"
    "4. Hệ thống kiểm tra tiêu đề không được rỗng và lưu vào bảng BAIVIET_QUANGBA kèm mã tác giả (MaTacGia).\n"
    "5. Bài viết xuất hiện trên website để khách viếng thăm và khách hàng theo dõi.",
    "• A1 (Chỉnh sửa hoặc xóa bài viết): Quản trị viên có thể cập nhật nội dung hoặc xóa bài viết khỏi CSDL."
    )

    add_use_case_spec_table(
    doc, "UC21", "Xem thống kê báo cáo",
    "Quản trị viên (Admin)",
    "Cung cấp các biểu đồ thống kê trực quan về doanh thu theo tháng, số lượng đơn đặt vé, tỷ lệ lấp đầy chỗ ngồi và các tour du lịch bán chạy nhất.",
    "Quản trị viên đã đăng nhập và truy cập trang 'Thống kê & Báo cáo'.",
    "Dữ liệu tổng hợp và các biểu đồ phân tích kinh doanh được kết xuất trực quan.",
    "1. Quản trị viên mở tab 'Báo cáo doanh thu' trên Admin Dashboard.\n"
    "2. Chọn khoảng thời gian cần xem báo cáo (Theo tuần, Theo tháng, Theo quý hoặc Tùy chọn ngày).\n"
    "3. Hệ thống thực thi các câu lệnh truy vấn tổng hợp (SUM TongTien, COUNT MaDatTour, GROUP BY Month) trên bảng DATTOUR và THANHTOAN.\n"
    "4. Hệ thống hiển thị các chỉ số KPI: Tổng doanh thu, Số lượng đơn thành công, Số lượng đơn đã hủy, Tỷ lệ lấp đầy ghế bình quân.\n"
    "5. Hệ thống vẽ biểu đồ cột doanh thu theo từng tháng và biểu đồ tròn tỷ trọng thị phần tour theo vùng miền.",
    "• A1 (Xuất file Excel/PDF): Quản trị viên có thể bấm nút 'Xuất báo cáo' để tải file thống kê về máy."
    )

    add_use_case_spec_table(
    doc, "UC22", "Quản lý đơn đặt tour",
    "Quản trị viên (Admin)",
    "Cho phép quản trị viên tiếp nhận toàn bộ các đơn đặt vé từ khách hàng, kiểm tra tính hợp lệ của thông tin hành khách, phê duyệt đơn và kích hoạt cập nhật thanh toán.",
    "Đơn đặt tour đã được tạo bởi khách hàng trong bảng DATTOUR.",
    "Đơn hàng được xử lý, trạng thái thanh toán được cập nhật tương ứng thông qua quan hệ <<include>> UC16.",
    "1. Quản trị viên mở phân hệ 'Quản lý đơn hàng' trên cổng Admin.\n"
    "2. Hệ thống hiển thị danh sách tất cả các đơn đặt vé với các thông tin: Mã Booking, Tên khách, Tour đặt, Ngày khởi hành, Tổng tiền, Trạng thái.\n"
    "3. Quản trị viên bấm 'Xem chi tiết' để kiểm tra danh sách hành khách, số CCCD, giấy tờ liên quan.\n"
    "4. Quản trị viên tiến hành phê duyệt đơn đặt hàng.\n"
    "5. Hệ thống bắt buộc kích hoạt quan hệ bao hàm <<include>> UC16 (Cập nhật trạng thái thanh toán) để cập nhật tình trạng giao dịch.\n"
    "6. Hệ thống gửi email thông báo xác nhận lịch trình chính thức tới khách hàng.",
    "• A1 (Khách hàng không thanh toán đúng hạn): Quản trị viên chọn 'Hủy đơn do quá hạn' -> Hệ thống kích hoạt hoàn trả chỗ trống.",
    "Quan hệ bao hàm: Bao hàm <<include>> UC16 (Cập nhật trạng thái thanh toán)"
    )

    add_use_case_spec_table(
    doc, "UC23", "Tra cứu nhật ký hệ thống",
    "Quản trị viên (Admin)",
    "Cung cấp công cụ tra cứu nhật ký kiểm toán bất biến (Audit Trail) để kiểm tra toàn bộ lịch sử các thao tác thay đổi giá, đổi trạng thái đơn, hủy vé phục vụ an ninh vận hành.",
    "Quản trị viên truy cập mục 'Nhật ký kiểm toán' trên Admin Dashboard.",
    "Bảng dữ liệu nhật ký chi tiết được hiển thị có sắp xếp theo thứ tự thời gian giảm dần.",
    "1. Quản trị viên mở tab 'Nhật ký kiểm toán (Audit Log)'.\n"
    "2. Hệ thống truy vấn toàn bộ bản ghi trong bảng AUDITLOG theo thứ tự thời gian mới nhất xếp trước.\n"
    "3. Bảng hiển thị các cột: Mã log, Tên bảng bị tác động (DATTOUR, THANHTOAN, TOUR), Hành động (INSERT, UPDATE, DELETE), Người thực hiện, Dữ liệu cũ, Dữ liệu mới, Thời điểm thực thi.\n"
    "4. Quản trị viên có thể lọc log theo Người thực hiện hoặc theo Khoảng ngày.\n"
    "5. Quản trị viên kiểm tra và phát hiện kịp thời các hành vi thao tác bất thường hoặc sai lệch quy trình.",
    "• A1 (Tìm kiếm không thấy bản ghi): Hệ thống thông báo không có thao tác kiểm toán nào trong khung thời gian đã chọn."
    )


    # MỤC 5: PHỤ LỤC MÃ NGUỒN PLANTUML
    add_heading_3(doc, "Mã nguồn PlantUML nguyên bản của Sơ đồ Use Case hợp nhất")
    add_body_p(
    doc,
    "Dưới đây là toàn bộ mã nguồn PlantUML nguyên bản dùng để render ra sơ đồ Use Case hợp nhất hoàn chỉnh (Hình 1) trong tài liệu. "
    "Mã nguồn được biên soạn chuẩn xác theo cú pháp UML 2.5, có thể copy và biên dịch trực tiếp trên mọi môi trường PlantUML:"
    )

    puml_source = """@startuml use_case_delta_travel_hoan_chinh
    title Hệ thống Website Quảng bá và Đặt tour Du lịch
    left to right direction
    skinparam packageStyle rectangle
    skinparam shadowing false
    skinparam defaultFontName Arial
    skinparam defaultFontSize 11
    skinparam actorStyle awesome

    actor "Khách viếng thăm" as Guest
    actor "Khách hàng" as Customer
    actor "Quản trị viên" as Admin

    Customer -up-|> Guest

    rectangle "Hệ thống Website Quảng bá và Đặt tour Du lịch" {
    ' Nhóm 1: Khách viếng thăm
    usecase "Đăng ký tài khoản" as UC_Register
    usecase "Tìm kiếm và lọc tour" as UC_Search
    usecase "Xem bài viết quảng bá" as UC_ViewArticle
    usecase "Gửi yêu cầu tư vấn" as UC_Consult
    usecase "Xem chi tiết tour" as UC_TourDetail
    usecase "Đăng nhập" as UC_Login
    usecase "Quên mật khẩu" as UC_ForgotPass

    ' Nhóm 2: Khách hàng
    usecase "Đặt tour trực tuyến" as UC_BookOnline
    usecase "Quản lý tour yêu thích" as UC_Wishlist
    usecase "Quản lý hồ sơ cá nhân" as UC_Profile

    ' Nhóm 3: Tương tác Khách hàng & Quản trị viên
    usecase "Thanh toán và đối soát đơn" as UC_Payment
    usecase "Hiển thị thông tin tour và bài viết" as UC_DisplayTourArticle
    usecase "Đánh giá và kiểm duyệt tour" as UC_Review
    usecase "Đặt tour và xử lý đơn" as UC_OrderProcess
    usecase "Yêu cầu đổi / hủy tour" as UC_ChangeCancel
    usecase "Cập nhật trạng thái thanh toán" as UC_UpdatePaymentStatus

    ' Nhóm 4: Quản trị viên
    usecase "Quản lý tài khoản và phân quyền" as UC_AdminUsers
    usecase "Quản lý thông tin tour" as UC_AdminTour
    usecase "Quản lý lịch khởi hành" as UC_AdminSchedule
    usecase "Quản lý bài viết quảng bá" as UC_AdminArticle
    usecase "Xem thống kê báo cáo" as UC_AdminReports
    usecase "Quản lý đơn đặt tour" as UC_AdminOrders
    usecase "Tra cứu nhật ký hệ thống" as UC_AdminAudit
    }

    ' Liên kết Khách viếng thăm
    Guest -- UC_Register
    Guest -- UC_Search
    Guest -- UC_ViewArticle
    Guest -- UC_Consult
    Guest -- UC_TourDetail
    Guest -- UC_Login

    ' Quan hệ Include & Extend phía người dùng
    UC_ForgotPass .> UC_Login : <<extend>>\\n(Chọn quên mật khẩu)
    UC_BookOnline .> UC_Login : <<include>>
    UC_Wishlist .> UC_Login : <<include>>

    ' Liên kết Khách hàng
    Customer -- UC_BookOnline
    Customer -- UC_Wishlist
    Customer -- UC_Profile

    ' Liên kết tương tác: Khách hàng và Quản trị viên
    Customer -- UC_Payment
    UC_Payment -- Admin

    Customer -- UC_DisplayTourArticle
    UC_DisplayTourArticle -- Admin

    Customer -- UC_Review
    UC_Review -- Admin

    Customer -- UC_OrderProcess
    UC_OrderProcess -- Admin

    Customer -- UC_ChangeCancel
    UC_ChangeCancel -- Admin

    ' Quan hệ Extend & Include giữa các khối tương tác và quản trị
    UC_Review ..> UC_OrderProcess : <<extend>>\\n(Đơn đã hoàn thành)
    UC_ChangeCancel ..> UC_OrderProcess : <<extend>>\\n(Đơn đủ điều kiện đổi/hủy)
    UC_UpdatePaymentStatus ..> UC_ChangeCancel : <<extend>>\\n(Có hoàn tiền / chênh lệch)

    UC_AdminOrders .> UC_UpdatePaymentStatus : <<include>>

    ' Liên kết Quản trị viên
    Admin -- UC_AdminUsers
    Admin -- UC_AdminTour
    Admin -- UC_AdminSchedule
    Admin -- UC_AdminArticle
    Admin -- UC_AdminReports
    Admin -- UC_AdminOrders
    Admin -- UC_UpdatePaymentStatus
    Admin -- UC_AdminAudit
    @enduml"""
    add_code_block(doc, puml_source)

    # LƯU RA CẢ 2 NƠI


    # 2.3.2 ACTIVITY
    add_heading_3(doc, "2.3.2 activity: 5-7 luồng hoạt động text + code -> ảnh")
    add_body_p(
    doc,
    "Biểu đồ hoạt động (Activity Diagram) thể hiện chi tiết luồng xử lý dữ liệu động, các nhánh rẽ điều kiện (Decision Nodes) "
    "và sự phối hợp giữa các làn bơi (Swimlanes: Người dùng / Giao diện, Hệ thống Backend API, Cơ sở dữ liệu SQL Server). "
    "Hệ thống mô hình hóa 7 luồng hoạt động trọng tâm nhất:"
    )

    activities = [
    ("AD-01", "Quy trình Đăng ký & Đăng nhập tài khoản", "hinh_2_10_ad01_auth.png",
    "Mô tả luồng nghiệp vụ: Khách hàng truy cập form Đăng ký/Đăng nhập. Hệ thống kiểm tra tính hợp lệ của dữ liệu đầu vào. "
    "Backend kiểm tra trùng Email/SĐT tại CSDL. Nếu hợp lệ, mật khẩu được băm an toàn và lưu vào NGUOIDUNG. "
    "Khi đăng nhập thành công, hệ thống cấp phát phiên làm việc an toàn.",
    "Swimlanes: Người dùng | Auth Controller / API | CSDL SQL Server (NGUOIDUNG)",
    """@startuml
    |Người dùng|
    start
    :Nhập Email và Mật khẩu;
    :Bấm "Đăng nhập";
    |Auth Controller|
    :Validate cú pháp Email/Password;
    |CSDL SQL Server|
    :Truy vấn NGUOIDUNG theo Email;
    |Auth Controller|
    if (Email tồn tại & Mật khẩu khớp?) then (Đúng)
    :Tạo Token phiên làm việc;
    :Thiết lập Cookie an toàn;
    |Người dùng|
    :Chuyển hướng về Trang chủ / Dashboard;
    stop
    else (Sai)
    |Người dùng|
    :Hiển thị thông báo "Sai tài khoản hoặc mật khẩu";
    stop
    endif
    @enduml"""),

    ("AD-02", "Quy trình Tìm kiếm, Lọc & Xem chi tiết Tour", "hinh_2_11_ad02_search.png",
    "Mô tả luồng nghiệp vụ: Người dùng nhập từ khóa tìm kiếm (theo tên, địa danh) hoặc chọn bộ lọc (vùng miền, mức giá, số ngày). "
    "API tiếp nhận truy vấn và gọi câu lệnh SQL tối ưu hóa kết hợp Full-Text Search. CSDL trả về danh sách tour phù hợp. "
    "Khi người dùng nhấn chọn tour cụ thể, hệ thống truy vấn thông tin chi tiết kèm bộ sưu tập ảnh gallery và lịch trình từng ngày.",
    "Swimlanes: Khách viếng thăm | Tour Controller | CSDL (TOUR, DANHMUC, HINHANH, LICH_TRINH)",
    """@startuml
    |Khách viếng thăm|
    start
    :Chọn bộ lọc tìm kiếm (Miền, Khoảng giá, Điểm đến);
    |Tour Controller|
    :Xây dựng truy vấn lọc đa tiêu chí;
    |CSDL SQL Server|
    :SELECT * FROM TOUR WHERE Gia BETWEEN ... AND MaDanhMuc = ...;
    :SELECT * FROM HINHANH_TOUR, LICH_TRINH_DETAIL;
    |Tour Controller|
    :Tổng hợp DTO chi tiết tour;
    |Khách viếng thăm|
    :Hiển thị chi tiết lộ trình Day-by-Day và ảnh Gallery;
    stop
    @enduml"""),

    ("AD-03", "Quy trình Đặt tour Trực tuyến & Khóa giữ chỗ tự động", "hinh_2_12_ad03_booking.png",
    "Mô tả luồng nghiệp vụ: Khách hàng chọn lịch khởi hành, nhập số lượng và danh sách hành khách chi tiết. "
    "Backend bắt đầu một Transaction mức độ SERIALIZABLE, gọi Stored Procedure `sp_TaoDonDatTour` có khóa UPDLOCK. "
    "CSDL kiểm tra số chỗ trống: Nếu đủ chỗ, Trigger tự động khóa giữ chỗ, tạo đơn đặt hàng mới (BK...) và trả về trạng thái 'Chờ thanh toán'. "
    "Nếu hết chỗ, giao dịch bị ROLLBACK ngay lập tức và thông báo cho khách hàng.",
    "Swimlanes: Khách hàng | Booking Controller | CSDL (CHUYENKHOIHANH, DATTOUR, CHITIET_HANHKHACH)",
    """@startuml
    |Khách hàng|
    start
    :Chọn ngày khởi hành & nhập danh sách hành khách;
    :Bấm "Xác nhận đặt tour";
    |Booking Controller|
    :Bắt đầu Transaction Serializable;
    |CSDL SQL Server|
    :Khóa dòng CHUYENKHOIHANH bằng UPDLOCK;
    if (SoChoToiDa - SoChoDaDat >= SoLuongKhach?) then (Đủ chỗ)
    :INSERT vào DATTOUR (Mã BK...);
    :INSERT danh sách vào CHITIET_HANHKHACH;
    :Trigger TRG_DATTOUR_CheckAndLockSeats cộng số chỗ;
    :COMMIT Transaction;
    |Khách hàng|
    :Hiển thị màn hình Thanh toán VietQR;
    stop
    else (Hết chỗ)
    :ROLLBACK Transaction;
    |Khách hàng|
    :Thông báo "Chuyến đi đã hết chỗ trống";
    stop
    endif
    @enduml"""),

    ("AD-04", "Quy trình Gửi minh chứng Thanh toán & Đối soát Admin", "hinh_2_13_ad04_payment.png",
    "Mô tả luồng nghiệp vụ: Hệ thống tự động tạo mã VietQR chuẩn NAPAS247 chứa chính xác số tiền và mã booking. "
    "Khách hàng quét mã trên app ngân hàng để chuyển khoản, sau đó tải ảnh chụp biên lai giao dịch lên hệ thống. "
    "Quản trị viên/Kế toán đối soát biến động số dư tài khoản ngân hàng, nhấn 'Xác nhận thanh toán'. "
    "Hệ thống cập nhật trạng thái đơn thành 'Đã thanh toán', gửi email xác nhận và ghi vết vào bảng AUDITLOG.",
    "Swimlanes: Khách hàng | Admin / Kế toán | CSDL (THANHTOAN, DATTOUR, AUDITLOG)",
    """@startuml
    |Khách hàng|
    start
    :Quét mã VietQR chuyển khoản ngân hàng;
    :Tải ảnh biên lai giao dịch;
    |Admin / Kế toán|
    :Kiểm tra thông báo biến động số dư ngân hàng;
    :Đối chiếu số tiền và Mã Booking BK...;
    if (Khớp thông tin chuyển khoản?) then (Hợp lệ)
    :Nhấn "Xác nhận thanh toán";
    |CSDL SQL Server|
    :UPDATE THANHTOAN Set TrangThai = N'Đã thanh toán';
    :UPDATE DATTOUR Set TrangThai = N'Đã thanh toán';
    :Trigger ghi log vào AUDITLOG;
    |Khách hàng|
    :Nhận email xác nhận vé tour thành công;
    stop
    else (Sai lệch)
    :Nhấn "Yêu cầu kiểm tra lại";
    stop
    endif
    @enduml"""),

    ("AD-05", "Quy trình Hủy đơn Đặt tour & Hoàn trả chỗ ngồi tự động", "hinh_2_14_ad05_cancel.png",
    "Mô tả luồng nghiệp vụ: Khách hàng vào mục 'Đơn đặt của tôi', chọn đơn và bấm 'Yêu cầu hủy tour', nhập lý do hủy. "
    "Hệ thống kiểm tra điều kiện hủy (trước ngày khởi hành quy định). Nếu hợp lệ, đơn chuyển trạng thái sang 'Đã hủy'. "
    "Trigger `TRG_DATTOUR_CancelAndReleaseSeats` tự động trừ số chỗ đã đặt tại CHUYENKHOIHANH, hoàn trả số vé về kho bán công khai.",
    "Swimlanes: Khách hàng | Booking Controller | CSDL (DATTOUR, CHUYENKHOIHANH)",
    """@startuml
    |Khách hàng|
    start
    :Vào "Đơn đặt của tôi" -> Chọn "Hủy tour";
    :Nhập lý do hủy đơn;
    |Booking Controller|
    :Kiểm tra chính sách thời gian trước ngày đi;
    if (Đủ điều kiện hủy?) then (Hợp lệ)
    |CSDL SQL Server|
    :UPDATE DATTOUR Set TrangThai = N'Đã hủy';
    :Trigger TRG_DATTOUR_CancelAndReleaseSeats kích hoạt;
    :Giảm SoChoDaDat, chuyển trạng thái sang 'Còn chỗ';
    |Khách hàng|
    :Thông báo hủy tour thành công;
    stop
    else (Quá hạn)
    |Khách hàng|
    :Thông báo "Quá hạn hủy tour, vui lòng liên hệ hotline";
    stop
    endif
    @enduml"""),

    ("AD-06", "Quy trình Quản trị CRUD Tour, Lịch trình & Lịch khởi hành", "hinh_2_15_ad06_admin_tour.png",
    "Mô tả luồng nghiệp vụ: Quản trị viên đăng nhập cổng Admin, thêm tour mới, tải ảnh gallery, thiết lập lộ trình từng ngày "
    "và tạo các đợt khởi hành cụ thể kèm giá vé và sức chứa tối đa. Hệ thống kiểm tra các ràng buộc CHECK và lưu vào CSDL, "
    "đồng bộ tức thì lên giao diện khách hàng.",
    "Swimlanes: Quản trị viên | Admin Controller | CSDL (TOUR, HINHANH, LICH_TRINH, CHUYENKHOIHANH)",
    """@startuml
    |Quản trị viên|
    start
    :Nhập thông tin tour, giá vé, ảnh gallery, lịch trình;
    :Thiết lập lịch khởi hành và số chỗ tối đa;
    :Bấm "Lưu thông tin";
    |Admin Controller|
    :Kiểm tra hợp lệ dữ liệu và quyền Admin;
    |CSDL SQL Server|
    :INSERT INTO TOUR, HINHANH_TOUR, LICH_TRINH_DETAIL, CHUYENKHOIHANH;
    :Ghi nhật ký thay đổi vào AUDITLOG;
    |Quản trị viên|
    :Hiển thị thông báo "Cập nhật tour thành công";
    stop
    @enduml"""),

    ("AD-07", "Quy trình Thống kê Báo cáo & Tra cứu Nhật ký Audit Log", "hinh_2_16_ad07_report_audit.png",
    "Mô tả luồng nghiệp vụ: Quản trị viên truy cập mục Thống kê. Hệ thống thực hiện các phép tổng hợp dữ liệu (SUM, COUNT, GROUP BY) "
    "trên bảng DATTOUR và THANHTOAN để vẽ biểu đồ doanh thu theo tháng, tỷ lệ lấp đầy chỗ ngồi của từng tour. "
    "Đồng thời cho phép tra cứu toàn bộ lịch sử thao tác từ bảng AUDITLOG để đảm bảo an ninh vận hành.",
    "Swimlanes: Quản trị viên | Report & Audit Controller | CSDL (DATTOUR, THANHTOAN, AUDITLOG)",
    """@startuml
    |Quản trị viên|
    start
    :Chọn mốc thời gian báo cáo doanh thu;
    |Report & Audit Controller|
    :Thực thi hàm tổng hợp dữ liệu doanh thu;
    |CSDL SQL Server|
    :SELECT SUM(TongTien) FROM DATTOUR GROUP BY MONTH(NgayDat);
    :SELECT * FROM AUDITLOG ORDER BY ThoiGian DESC;
    |Report & Audit Controller|
    :Tổng hợp DTO và sinh dữ liệu biểu đồ;
    |Quản trị viên|
    :Hiển thị Dashboard doanh thu trực quan và bảng tra cứu log;
    stop
    @enduml""")
    ]

    for code, name, img_name, desc, swimlanes, puml in activities:
        add_heading_3(doc, f"{code}: {name}")
        add_body_p(doc, desc, bold_prefix="Mô tả luồng nghiệp vụ: ")
        add_body_p(doc, swimlanes, bold_prefix="Các thành phần tham gia (Swimlanes): ")

        img_p = os.path.join(CLEAN_IMG_DIR, img_name)
        idx = int(code.split('-')[1])
        add_image_with_caption(doc, img_p, f"Hình 2.{9 + idx}: Biểu đồ hoạt động {code} - {name}", width_inches=6.0)

        add_body_p(doc, f"Mã nguồn PlantUML của {code}:", bold_prefix="Mã PlantUML: ")
        add_code_block(doc, puml)


        # 2.3.3 CLASS DIAGRAM MVC (LÀM CỰC KỲ CHI TIẾT)


        # 2.3.3 CLASS MVC


        # 2.3.3 CLASS MVC


        # 2.3.3 CLASS MVC


        # 2.3.3 CLASS MVC
    add_heading_3(doc, "2.3.3: Class: từ phát biểu bài toán + và use case + activity để sinh ra ảnh mô tả theo chuẩn MVC")
    add_heading_3(doc, "Tổng quan và Bản chất kiến trúc phân tầng MVC thực tế")
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


    # MỤC 2: SƠ ĐỒ LỚP KIẾN TRÚC THỰC TẾ
    add_heading_3(doc, "Sơ đồ kiến trúc phân tầng MVC thực tế hệ thống Delta Travel")
    add_body_p(
    doc,
    "Sơ đồ dưới đây phản ánh chính xác 100% cấu trúc các thành phần đang chạy trong mã nguồn thực tế của hệ thống. "
    "Sơ đồ phân chia thành 3 phân vùng lớn: Frontend Tier (Client), Backend Tier (FastAPI Server) và Database Tier (SQL Server 12 Bảng 3NF). "
    "Đặc biệt, sơ đồ làm nổi bật hai chiều giao tiếp: Chiều thuận (mũi tên liền màu xanh) gửi yêu cầu và "
    "Chiều quay ngược lại (mũi tên nét đứt màu đỏ đậm) phản hồi dữ liệu, trạng thái trigger và ngoại lệ nghiệp vụ:"
    )

    img_mvc = os.path.join(CLEAN_IMG_DIR, "hinh_2_17_class_mvc.png")
    add_image_with_caption(doc, img_mvc, "Hình 2.17: Sơ đồ kiến trúc phân tầng MVC thực tế hệ thống Delta Travel (Frontend - Backend - SQL Server)", width_inches=6.2)


    # MỤC 3: ĐẶC TẢ CHI TIẾT CÁC PHÂN TẦNG
    add_heading_3(doc, "Đặc tả chi tiết các phân tầng theo trách nhiệm kiến trúc MVC")

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
    add_heading_3(doc, "Chu trình 7 bước xử lý một yêu cầu nghiệp vụ hoàn chỉnh (Request-Response Lifecycle)")
    add_body_p(doc, "Chu trình xử lý một yêu cầu đặt chỗ và thanh toán diễn ra tuần tự qua 7 bước như sau:")
    add_bullet_p(doc, "Người dùng điền danh sách hành khách trên giao diện booking.html và nhấn 'Xác nhận đặt tour'.", bold_prefix="Bước 1 (Client Action): ")
    add_bullet_p(doc, "Client Controller (main.js) kiểm tra định dạng số điện thoại, CCCD/Passport ở phía máy khách.", bold_prefix="Bước 2 (Client Validation): ")
    add_bullet_p(doc, "api.js đóng gói dữ liệu thành đối tượng JSON BookingInput và gửi HTTP POST tới /api/v1/bookings.", bold_prefix="Bước 3 (API Request Dispatching): ")
    add_bullet_p(doc, "FastAPI Route chuyển giao cho booking_controller.py, kiểm tra xác thực định danh và Pydantic Schema.", bold_prefix="Bước 4 (Backend Controller & Auth Guard): ")
    add_bullet_p(doc, "booking_service.py mở giao dịch CSDL, gọi schedule_repository.lock_schedule() để khóa dòng và kiểm tra số chỗ trống.", bold_prefix="Bước 5 (Service Execution & Capacity Check): ")
    add_bullet_p(doc, "TẦNG CSDL & CHIỀU QUAY NGƯỢC LẠI: SQL Server kích hoạt Trigger kiểm tra chỗ, ghi bản ghi đơn hàng mới vào DATTOUR, cập nhật số chỗ trên CHUYENKHOIHANH, và phản hồi kết quả Commit quay ngược lên tầng Service & Controller.", bold_prefix="Bước 6 (Database Execution & Reverse Flow): ")
    add_bullet_p(doc, "Controller trả về JSON BookingOut (HTTP 201). Trình duyệt tiếp nhận dữ liệu, gọi vietqr-service.js tạo mã QR ngân hàng động và mở modal thanh toán kèm bộ đếm 15 phút.", bold_prefix="Bước 7 (Response Stream & Dynamic UI Render): ")


    # MỤC 7: MÃ NGUỒN PLANTUML
    add_heading_3(doc, "Mã nguồn PlantUML nguyên bản của Sơ đồ kiến trúc phân tầng MVC")
    add_body_p(
    doc,
    "Dưới đây là toàn bộ mã nguồn PlantUML nguyên bản dùng để kết xuất Sơ đồ kiến trúc phân tầng MVC thực tế (Hình 2.17). "
    "Mã nguồn được biên soạn chuẩn tắc theo cú pháp UML 2.5, hỗ trợ tái lập và xuất bản trực tiếp trên mọi môi trường PlantUML hoặc VS Code:"
    )
    add_code_block(doc, PUML_CODE)

    # Lưu tài liệu

    doc.add_page_break()
