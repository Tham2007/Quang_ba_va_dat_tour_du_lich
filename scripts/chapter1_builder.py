import os
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from scripts.doc_helpers import (
    add_title, add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_image_with_caption,
    create_styled_table, add_native_toc, NAVY_BLUE, STEEL_BLUE, BODY_COLOR
)

CLEAN_IMG_DIR = os.path.join(os.path.dirname(__file__), "clean_images")

def build_cover_and_preface(doc):
    # GIỮ NGUYÊN BÌA BÁO CÁO Y HỆT FILE GỐC CỦA NGƯỜI DÙNG
    p0 = doc.add_paragraph()
    p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p0.paragraph_format.space_before = Pt(0)
    p0.paragraph_format.space_after = Pt(2)
    r0 = p0.add_run("BỘ GIÁO DỤC VÀ ĐÀO TẠO")
    r0.font.name = "Times New Roman"
    r0.font.size = Pt(14)
    r0.font.bold = True
    r0.font.color.rgb = RGBColor(0, 0, 0)

    p1 = doc.add_paragraph()
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p1.paragraph_format.space_before = Pt(2)
    p1.paragraph_format.space_after = Pt(2)
    r1 = p1.add_run("TRƯỜNG ĐẠI HỌC CMC")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(14)
    r1.font.bold = True
    r1.font.color.rgb = RGBColor(0, 0, 0)

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_before = Pt(2)
    p2.paragraph_format.space_after = Pt(40)
    r2 = p2.add_run("KHOA CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG")
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(13)
    r2.font.bold = True
    r2.font.color.rgb = RGBColor(0, 0, 0)

    # BÁO CÁO BÀI TẬP LỚN
    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p3.paragraph_format.space_before = Pt(30)
    p3.paragraph_format.space_after = Pt(16)
    r3 = p3.add_run("BÁO CÁO BÀI TẬP LỚN")
    r3.font.name = "Times New Roman"
    r3.font.size = Pt(15)
    r3.font.bold = True
    r3.font.color.rgb = RGBColor(0, 0, 0)

    # ĐỀ TÀI:
    p4 = doc.add_paragraph()
    p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p4.paragraph_format.space_before = Pt(12)
    p4.paragraph_format.space_after = Pt(36)
    r4_1 = p4.add_run("ĐỀ TÀI: ")
    r4_1.font.name = "Times New Roman"
    r4_1.font.size = Pt(13)
    r4_1.font.bold = True
    r4_1.font.color.rgb = RGBColor(0, 0, 0)
    r4_2 = p4.add_run("Website quảng bá và đặt tour du lịch trực tuyến tại Việt Nam (Delta Travel)")
    r4_2.font.name = "Times New Roman"
    r4_2.font.size = Pt(13)
    r4_2.font.color.rgb = RGBColor(0, 0, 0)

    # BẢNG THÔNG TIN Y HỆT FILE GỐC (TABLE 0: Giảng viên hướng dẫn, Học phần, Khoa)
    tbl_cover = doc.add_table(rows=3, cols=3)
    tbl_cover.alignment = WD_TABLE_ALIGNMENT.CENTER
    cover_data = [
        ["Giảng viên hướng dẫn", ":", "ThS. Nguyễn Đức Giang"],
        ["Học phần", ":", "Phát triển ứng dụng web"],
        ["Khoa", ":", "Công nghệ thông tin và truyền thông"]
    ]
    col_widths = [Inches(2.1), Inches(0.3), Inches(3.6)]
    for r_idx, row_items in enumerate(cover_data):
        row = tbl_cover.rows[r_idx]
        for c_idx, val in enumerate(row_items):
            cell = row.cells[c_idx]
            cell.width = col_widths[c_idx]
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(3)
            p.paragraph_format.space_after = Pt(3)
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(13)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0, 0, 0)

    # Nhóm thực hiện:
    p5 = doc.add_paragraph()
    p5.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p5.paragraph_format.space_before = Pt(30)
    p5.paragraph_format.space_after = Pt(8)
    r5 = p5.add_run("Nhóm thực hiện:")
    r5.font.name = "Times New Roman"
    r5.font.size = Pt(13)
    r5.font.bold = True
    r5.font.color.rgb = RGBColor(0, 0, 0)

    # 5 Thành viên:
    members = [
        "Lê Văn Mạnh - BAI250042",
        "Phạm Thị Hồng Thắm - BAI250057",
        "Lê Văn An - BAI250001",
        "Lê Hải Đăng - BAI250012",
        "Nguyễn Văn Phúc - BCS252351"
    ]
    for m in members:
        pm = doc.add_paragraph()
        pm.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pm.paragraph_format.space_before = Pt(2)
        pm.paragraph_format.space_after = Pt(2)
        rm = pm.add_run(m)
        rm.font.name = "Times New Roman"
        rm.font.size = Pt(13)
        rm.font.bold = True
        rm.font.color.rgb = RGBColor(0, 0, 0)

    # HẾT TRANG BÌA: NGẮT 1 TRANG DUY NHẤT
    doc.add_page_break()

    # LỜI CẢM ƠN (GIỮ NGUYÊN TỪ FILE CŨ)
    add_heading_1(doc, "LỜI CẢM ƠN")
    add_body_p(
        doc,
        "Trong quá trình thực hiện đề tài \"Website quảng bá và đặt tour du lịch trực tuyến tại Việt Nam (Delta Travel)\", "
        "nhóm 3 đã nhận được sự hướng dẫn tận tình và những góp ý quý báu của ThS. Nguyễn Đức Giang trong suốt học phần "
        "Phát triển ứng dụng web. Nhóm xin bày tỏ lòng biết ơn sâu sắc tới thầy."
    )
    add_body_p(
        doc,
        "Nhóm cũng xin gửi lời cảm ơn tới Trường Đại học CMC và Khoa Công nghệ thông tin và Truyền thông đã tạo điều kiện "
        "về môi trường học tập và cơ sở vật chất để các thành viên hoàn thành đồ án."
    )
    add_body_p(
        doc,
        "Do thời gian và kinh nghiệm còn hạn chế, báo cáo không tránh khỏi những thiếu sót. "
        "Nhóm rất mong nhận được ý kiến nhận xét của thầy cô và các bạn để đề tài được hoàn thiện hơn trong các giai đoạn tiếp theo."
    )
    p_sign = doc.add_paragraph()
    p_sign.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_sign.paragraph_format.space_before = Pt(8)
    p_sign.paragraph_format.space_after = Pt(12)
    r_sign = p_sign.add_run("Nhóm 3 (Delta Travel)\nSinh viên thực hiện đề tài")
    r_sign.font.name = "Times New Roman"
    r_sign.font.size = Pt(11)
    r_sign.font.italic = True
    r_sign.font.bold = True
    r_sign.font.color.rgb = NAVY_BLUE

    # MỤC LỤC TỰ ĐỘNG VÀ BẢNG MỤC LỤC (KHÔNG NGẮT TRANG ĐỂ TRÁNH TRANG TRỐNG)
    add_heading_1(doc, "MỤC LỤC HỆ THỐNG")
    add_body_p(
        doc,
        "Mục lục tự động phản ánh đầy đủ cấu trúc phân cấp từ Chương 1 đến Chương 5 của đề tài. "
        "Quý thầy cô và bạn đọc có thể nhấp chuột hoặc nhấn Ctrl + Click vào từng đầu mục để di chuyển nhanh đến nội dung tương ứng:"
    )
    add_native_toc(doc)

    toc_data = [
        ["DANH MỤC TỪ NGỮ VIẾT TẮT", "Bảng tra cứu các khái niệm, từ viết tắt và chuẩn kỹ thuật", "Trang vi"],
        ["DANH MỤC HÌNH ẢNH", "Danh mục 23 hình ảnh giao diện, sơ đồ ERD, Use Case, Activity và MVC", "Trang vii"],
        ["DANH MỤC BẢNG BIỂU", "Danh mục 36 bảng biểu đặc tả CSDL, Use Case, phân công và kiểm thử", "Trang ix"],
        ["BẢNG PHÂN CÔNG CÔNG VIỆC VÀ TIẾN ĐỘ", "Kế hoạch phân công nhiệm vụ và kết quả 4 giai đoạn của 5 thành viên", "Trang xi"],
        ["CHƯƠNG 1: PHÁT BIỂU BÀI TOÁN (LÀM CHI TIẾT)", "Bối cảnh số hóa, 5 bài toán nghiệp vụ, phạm vi và khảo sát Vietravel", "Trang 1"],
        ["1.1: Giới thiệu, phát biểu", "Phát biểu bài toán, bối cảnh thực tế và phân định 3 nhóm đối tượng", "Trang 1"],
        ["1.2: Khảo sát : web để lấy: text=> sinh database và lấy chức năng phù hợp", "Khảo sát Vietravel (travel.com.vn), sinh 12 bảng và chọn chức năng phù hợp", "Trang 6"],
        ["CHƯƠNG 2: PHÂN TÍCH VÀ THIẾT KẾ", "Thiết kế UI Liquid Glass, CSDL 12 bảng 3NF, Use Case, Activity, MVC", "Trang 12"],
        ["2.1: Thiết kế giao diện", "Nguyên lý Liquid Glass, hệ thống lưới Responsive, chi tiết các màn hình", "Trang 12"],
        ["2.2: Thiết kế cơ sở dữ liệu ( lấy từ phát biểu bài toán )", "Xác định thực thể, khóa, chuẩn hóa 3NF, ERD 12 bảng, DDL và Triggers", "Trang 18"],
        ["2.2.1: xác định thực thể, khóa chính", "Danh mục 12 thực thể nghiệp vụ và khóa chính chuẩn hóa", "Trang 18"],
        ["2.2.2 xác định mối quan hệ , ràng buộc", "11 Khóa ngoại FK toàn vẹn và 14 Ràng buộc CHECK nghiệp vụ", "Trang 20"],
        ["2.2.3: chuẩn hóa 3nf", "Quy trình chuẩn hóa 1NF, 2NF, 3NF triệt tiêu dư thừa dữ liệu", "Trang 24"],
        ["2.2.4: ERD - data drigram -> table", "Sơ đồ Database Diagram thực tế từ SQL Server và Từ điển 12 bảng", "Trang 28"],
        ["2.2.5: Sinh database mẫu ( có dữ liệu mẫu demo)", "DDL tạo bảng, Trigger khóa chỗ TRG_DATTOUR, hoàn chỗ và seed data", "Trang 35"],
        ["2.3: Thiết kế hệ thống :", "Mô hình hóa Use Case tổng quát, 7 Luồng Activity và Kiến trúc MVC", "Trang 44"],
        ["2.3.1 use case : bằng cách + khung cho tất cả actor + đỉnh...", "Sơ đồ Use Case mới nhất (Hình 1), ma trận phân quyền và đặc tả 23 Use Case", "Trang 44"],
        ["2.3.2 activity: 5-7 luồng hoạt động text + code -> ảnh", "Đặc tả chi tiết 7 luồng hoạt động AD-01 đến AD-07 và biểu đồ UML Activity", "Trang 62"],
        ["2.3.3: Class: từ phát biểu bài toán + và use case + activity...", "Sơ đồ kiến trúc MVC chuẩn, chiều tương tác hai chiều và bảng đối chiếu", "Trang 74"],
        ["CHƯƠNG 3: TRIỂN KHAI", "Phân công nhiệm vụ, kiến trúc mã nguồn Backend & Frontend, kiểm thử", "Trang 84"],
        ["3.1: Kế hoạch: cho nhiệm vụ của thành viên", "Quy trình Agile/Scrum, phân công chi tiết 5 thành viên và ma trận RACI", "Trang 84"],
        ["3.2: code gồm có FE và BE  ; làm BE ( hãy code web bằng ASP.NET MVC)", "Cấu trúc mã nguồn thực tế, module Backend kết nối SQL Server, Frontend JS", "Trang 87"],
        ["3.3: test", "Chiến lược kiểm định, sinh mã kiểm thử tự động và bảng Test Cases 6 cột", "Trang 96"],
        ["3.3.1: test plane", "Mục tiêu kiểm thử, tiêu chí chấp nhận và phạm vi kiểm định hệ thống", "Trang 96"],
        ["3.3.2: test case => sinh code", "Bảng Test Cases tự động 6 cột chuẩn hóa và mã kiểm thử Concurrency", "Trang 98"],
        ["CHƯƠNG 4: KẾT QUẢ VÀ HƯỚNG PHÁT TRIỂN", "Đánh giá kết quả đạt được, hình ảnh thực tế và định hướng tương lai", "Trang 104"],
        ["4.1: Kết quả : chụp ra", "Tổng kết thành quả đạt được và hình ảnh chụp thực tế hệ thống vận hành", "Trang 104"],
        ["4.2: Hướng phát triển", "Bốn hướng nâng cấp mở rộng: Webhook IPN, AI Tour Assistant, Mobile App, B2B", "Trang 108"],
        ["CHƯƠNG 5: TÀI LIỆU THAM KHẢO", "Danh mục 10 tài liệu học thuật và tiêu chuẩn kỹ thuật chuyên ngành", "Trang 111"]
    ]
    create_styled_table(doc, ["Đầu mục nội dung", "Tóm tắt phạm vi và nghiệp vụ", "Trang ước tính"], toc_data, [2.2, 3.6, 0.9])

    # DANH MỤC HÌNH ẢNH (KHÔNG NGẮT TRANG)
    add_heading_1(doc, "DANH MỤC HÌNH ẢNH")
    figures_list = [
        ["Hình 1.1", "Giao diện khảo sát thực tế website du lịch Vietravel - Danh mục tour du lịch Miền Bắc (travel.com.vn)", "Chương 1"],
        ["Hình 1.2", "Giao diện khảo sát thực tế website du lịch Vietravel - Chi tiết sản phẩm tour, lịch trình và chính sách giá", "Chương 1"],
        ["Hình 2.1", "Giao diện Trang chủ Delta Travel (Phong cách Liquid Glass với Hero Banner và Tìm kiếm nhanh)", "Chương 2"],
        ["Hình 2.2", "Giao diện Trang chủ Delta Travel - Danh mục tour nổi bật ba miền Bắc - Trung - Nam", "Chương 2"],
        ["Hình 2.3", "Giao diện Trang chủ Delta Travel phiên bản Tiếng Anh hỗ trợ du khách quốc tế", "Chương 2"],
        ["Hình 2.4", "Giao diện Đặt tour trực tuyến - Form nhập thông tin liên hệ và số lượng khách hàng", "Chương 2"],
        ["Hình 2.5", "Giao diện Nhập danh sách hành khách chi tiết theo độ tuổi (Người lớn, Trẻ em, Em bé)", "Chương 2"],
        ["Hình 2.6", "Giao diện Hướng dẫn thanh toán trực tuyến và Tóm tắt chi phí đơn đặt tour", "Chương 2"],
        ["Hình 2.7", "Sơ đồ Database Diagram thực tế 12 bảng chuẩn hóa 3NF trích xuất từ Microsoft SQL Server (SSMS)", "Chương 2"],
        ["Hình 2.8", "Sơ đồ UML Use Case tổng quát hệ thống Delta Travel (Hình 1 - 23 Use Cases của 3 Tác nhân)", "Chương 2"],
        ["Hình 2.9", "Biểu đồ hoạt động AD-01 - Quy trình Đăng ký & Đăng nhập tài khoản bảo mật", "Chương 2"],
        ["Hình 2.10", "Biểu đồ hoạt động AD-02 - Quy trình Tìm kiếm, Lọc & Xem chi tiết Tour", "Chương 2"],
        ["Hình 2.11", "Biểu đồ hoạt động AD-03 - Quy trình Đặt tour Trực tuyến & Khóa giữ chỗ tự động chống Overbooking", "Chương 2"],
        ["Hình 2.12", "Biểu đồ hoạt động AD-04 - Quy trình Gửi minh chứng Thanh toán VietQR & Đối soát Admin", "Chương 2"],
        ["Hình 2.13", "Biểu đồ hoạt động AD-05 - Quy trình Hủy đơn Đặt tour & Hoàn trả chỗ ngồi tự động", "Chương 2"],
        ["Hình 2.14", "Biểu đồ hoạt động AD-06 - Quy trình Quản trị CRUD Tour, Lịch trình & Lịch khởi hành", "Chương 2"],
        ["Hình 2.15", "Biểu đồ hoạt động AD-07 - Quy trình Thống kê Báo cáo & Tra cứu Nhật ký Audit Log", "Chương 2"],
        ["Hình 2.16", "Sơ đồ kiến trúc phân tầng MVC chi tiết hệ thống Delta Travel (Hai chiều tương tác Client - Backend - DB)", "Chương 2"],
        ["Hình 4.1", "Giao diện Tra cứu và Quản lý đơn đặt tour của tôi (My Bookings)", "Chương 4"],
        ["Hình 4.2", "Giao diện Quản trị viên Admin Dashboard (Quản lý tour, lịch khởi hành và duyệt đơn)", "Chương 4"],
        ["Hình 4.3", "Module Thanh toán thông minh qua mã VietQR động chuẩn NAPAS247", "Chương 4"]
    ]
    create_styled_table(doc, ["Mã hình", "Tên hình ảnh mô tả", "Vị trí chương"], figures_list, [1.0, 4.8, 1.0])

    # DANH MỤC BẢNG BIỂU (KHÔNG NGẮT TRANG)
    add_heading_1(doc, "DANH MỤC BẢNG BIỂU")
    tables_list = [
        ["Bảng 0.1", "Danh mục các từ viết tắt và thuật ngữ công nghệ trong báo cáo", "Phần mở đầu"],
        ["Bảng I", "Bảng phân công nhiệm vụ và kết quả hoàn thành của các thành viên Nhóm 3", "Phần mở đầu"],
        ["Bảng II", "Kế hoạch và tiến độ hoàn thành các mốc thời gian (Milestones)", "Phần mở đầu"],
        ["Bảng 1.1", "Ma trận sinh thực thể CSDL từ kết quả phân tích văn bản website khảo sát Vietravel", "Chương 1"],
        ["Bảng 1.2", "Bảng tổng hợp đối tượng sử dụng, chức năng chi tiết và ràng buộc nghiệp vụ", "Chương 1"],
        ["Bảng 2.1", "Danh mục 12 Thực thể CSDL và Khóa chính chuẩn hóa", "Chương 2"],
        ["Bảng 2.2", "Danh mục 11 Mối quan hệ Khóa ngoại (Foreign Keys) bảo vệ tính toàn vẹn tham chiếu", "Chương 2"],
        ["Bảng 2.3", "Danh mục 14 Ràng buộc kiểm tra (CHECK Constraints) bảo vệ toàn vẹn dữ liệu", "Chương 2"],
        ["Bảng 2.4a - 2.4l", "Từ điển dữ liệu chi tiết cho 12 bảng trong cơ sở dữ liệu SQL Server", "Chương 2"],
        ["Bảng 2.5", "Ma trận phân quyền chi tiết cho 23 Use Case của hệ thống Delta Travel", "Chương 2"],
        ["Bảng 2.6", "Bảng tổng hợp và phân tích các mối quan hệ UML (Include, Extend, Generalization)", "Chương 2"],
        ["Bảng 2.7a - 2.7w", "Bảng đặc tả chi tiết 23 Use Case trong hệ thống Delta Travel", "Chương 2"],
        ["Bảng 2.8a - 2.8g", "Bảng đặc tả chi tiết 7 Luồng hoạt động (Activity Workflows AD-01 đến AD-07)", "Chương 2"],
        ["Bảng 2.9", "Bảng đối chiếu 100% thành phần kiến trúc MVC với mã nguồn thực tế", "Chương 2"],
        ["Bảng 3.1", "Ma trận phân công trách nhiệm nhóm theo mô hình RACI", "Chương 3"],
        ["Bảng 3.2", "Bảng tổng hợp kết quả thực thi kiểm thử tự động của hệ thống Delta Travel", "Chương 3"],
        ["Bảng 3.3", "Bảng Test Case kiểm thử tự động chuẩn hóa 6 cột (Mã TC, Mô tả, Dữ liệu, Kỳ vọng, Thực tế, Đánh giá)", "Chương 3"],
        ["Bảng 5.1", "Danh mục các tài liệu và tiêu chuẩn kỹ thuật tham khảo", "Chương 5"]
    ]
    create_styled_table(doc, ["Mã bảng", "Tên bảng biểu mô tả", "Vị trí chương"], tables_list, [1.3, 4.5, 1.0])

    # DANH MỤC TỪ NGỮ VIẾT TẮT (KHÔNG NGẮT TRANG)
    add_heading_1(doc, "DANH MỤC TỪ NGỮ VIẾT TẮT")
    abbreviations = [
        ["1NF, 2NF, 3NF", "First, Second, Third Normal Form", "Các dạng chuẩn 1, 2, 3 trong chuẩn hóa cơ sở dữ liệu quan hệ"],
        ["ACID", "Atomicity, Consistency, Isolation, Durability", "Tính nguyên tử, nhất quán, cô lập và bền vững của giao dịch CSDL"],
        ["API", "Application Programming Interface", "Giao diện lập trình ứng dụng cho phép kết nối giữa Frontend và Backend"],
        ["ASP.NET MVC", "Model - View - Controller Framework", "Khung phát triển ứng dụng web hiện đại của Microsoft trên nền tảng .NET"],
        ["CHECK", "Check Constraint", "Ràng buộc kiểm tra tính hợp lệ của miền giá trị tại tầng CSDL"],
        ["CSRF", "Cross-Site Request Forgery", "Tấn công giả mạo yêu cầu từ phía người dùng tin cậy"],
        ["DDL", "Data Definition Language", "Ngôn ngữ định nghĩa dữ liệu (CREATE, ALTER, DROP)"],
        ["ERD", "Entity Relationship Diagram", "Sơ đồ quan hệ thực thể thể hiện cấu trúc logic dữ liệu"],
        ["FK", "Foreign Key", "Khóa ngoại liên kết toàn vẹn tham chiếu giữa các bảng"],
        ["JWT", "JSON Web Token", "Chuẩn mã hóa thông tin xác thực phiên làm việc người dùng không lưu trạng thái (Stateless)"],
        ["MVC", "Model - View - Controller", "Mô hình kiến trúc phân tách rõ ràng giữa Dữ liệu, Giao diện và Điều khiển"],
        ["Overbooking", "Tình trạng đặt vé vượt quá sức chứa", "Hiện tượng số lượng vé bán ra vượt quá số chỗ ngồi khả dụng thực tế"],
        ["PK", "Primary Key", "Khóa chính định danh duy nhất cho một dòng dữ liệu trong bảng"],
        ["REST", "Representational State Transfer", "Kiến trúc thiết kế dịch vụ web chuẩn mực dựa trên giao thức HTTP"],
        ["SSMS", "SQL Server Management Studio", "Phần mềm quản trị CSDL Microsoft SQL Server chuyên nghiệp"],
        ["UI/UX", "User Interface / User Experience", "Thiết kế giao diện và trải nghiệm tương tác của người dùng"],
        ["VietQR", "Chuẩn mã QR thanh toán quốc gia", "Định dạng mã QR thanh toán do NAPAS và các ngân hàng Việt Nam ban hành"]
    ]
    create_styled_table(doc, ["Từ viết tắt", "Thuật ngữ Tiếng Anh", "Giải thích ý nghĩa nghiệp vụ"], abbreviations, [1.4, 2.3, 2.7], "Bảng 0.1: Danh mục các từ viết tắt và thuật ngữ công nghệ trong báo cáo")

    # BẢNG PHÂN CÔNG CÔNG VIỆC VÀ TIẾN ĐỘ HOÀN THÀNH (KHÔNG NGẮT TRANG)
    add_heading_1(doc, "BẢNG PHÂN CÔNG CÔNG VIỆC VÀ TIẾN ĐỘ HOÀN THÀNH")
    add_body_p(
        doc,
        "Căn cứ vào kế hoạch thực hiện đồ án môn học và sự thống nhất của các thành viên trong Nhóm 3 (Delta Travel), "
        "dưới đây là bảng phân công trách nhiệm chi tiết, sản phẩm bàn giao (Deliverables) và tiến độ hoàn thành thực tế "
        "của từng thành viên trong suốt quá trình phát triển hệ thống:"
    )

    team_assignment_data = [
        ["1", "Lê Văn Mạnh\n(Trưởng nhóm)", "Backend, API & Kiến trúc",
         "• Thiết kế hợp đồng API RESTful (API Contract & Schemas)\n"
         "• Phát triển Backend xử lý logic đặt tour, giao dịch ACID Concurrency\n"
         "• Quản trị CRUD Tour, kiểm soát khóa chỗ, hủy đơn, hoàn chỗ\n"
         "• Tích hợp đồng bộ FE - BE - DB và kiểm soát phiên an toàn JWT\n"
         "• Chủ trì biên tập Báo cáo đồ án và kiến trúc hệ thống MVC", "100%"],
        ["2", "Phạm Thị Hồng Thắm", "Thiết kế CSDL & SQL Server",
         "• Khảo sát bài toán, xác định 12 thực thể nghiệp vụ chuẩn hóa\n"
         "• Chuẩn hóa dữ liệu đạt Dạng chuẩn 3 (3NF) chi tiết từng bước\n"
         "• Triển khai CSDL trên Microsoft SQL Server\n"
         "• Viết script tạo bảng, chỉ mục và Triggers chống Overbooking\n"
         "• Xây dựng sơ đồ Database Diagram và Từ điển dữ liệu 12 bảng", "100%"],
        ["3", "Lê Văn An", "Frontend & UI/UX",
         "• Thiết kế giao diện theo phong cách Liquid Glass sang trọng\n"
         "• Xây dựng trang chủ, danh sách tour, bộ lọc đa tiêu chí\n"
         "• Phát triển trang chi tiết tour (Gallery + Day-by-Day)\n"
         "• Thiết kế form đặt tour, tích hợp mã VietQR động chuẩn NAPAS247\n"
         "• Phát triển Cổng quản trị Admin và các module tương tác người dùng", "100%"],
        ["4", "Lê Hải Đăng", "Kiểm thử hệ thống (QA/Test)",
         "• Xây dựng Kế hoạch kiểm thử tổng thể (Test Plan)\n"
         "• Thiết kế và chạy bộ 58 Test Cases API tự động (100% PASS)\n"
         "• Kiểm thử bảo mật (Auth, Role RBAC, CSRF)\n"
         "• Kiểm thử tải đồng thời chống Overbooking tại CSDL (17 Test Cases)\n"
         "• Xây dựng bảng Test Case tự động 6 cột và kiểm thử tự động", "100%"],
        ["5", "Nguyễn Văn Phúc", "Bảo mật & Quản trị Admin",
         "• Phân tích kiến trúc an ninh, chống SQL Injection, XSS, CSRF\n"
         "• Thiết kế phân hệ Quản trị Admin, phân quyền người dùng (RBAC)\n"
         "• Xây dựng cấu trúc bảng AUDITLOG lưu vết kiểm toán bất biến\n"
         "• Hỗ trợ triển khai Docker SQL Server và staging môi trường cloud", "100%"]
    ]
    create_styled_table(doc, ["STT", "Họ và tên", "Vai trò phụ trách", "Nhiệm vụ kỹ thuật cụ thể & Sản phẩm bàn giao", "Tiến độ"], team_assignment_data, [0.5, 1.4, 1.5, 2.5, 0.6], "Bảng I: Bảng phân công nhiệm vụ và kết quả hoàn thành của các thành viên Nhóm 3")

    sprint_milestones = [
        ["Giai đoạn 1", "Khảo sát bài toán, thu thập yêu cầu và phân tích nghiệp vụ du lịch lữ hành. Khảo sát website Vietravel, xác định 12 thực thể và thực hiện chuẩn hóa dữ liệu 3NF.", "20/10/2026 - 25/10/2026", "Hồng Thắm, Lê Văn Mạnh", "Tài liệu phân tích 12 bảng, Bản thảo Database Diagram", "100% (Hoàn thành)"],
        ["Giai đoạn 2", "Thiết kế CSDL trên Microsoft SQL Server, viết Trigger chống Overbooking và hoàn chỗ. Thiết kế giao diện Liquid Glass và dựng khung Frontend tĩnh.", "26/10/2026 - 30/10/2026", "Hồng Thắm, Lê Văn An", "CSDL 12 bảng live trên SQL Server, Wireframe UI", "100% (Hoàn thành)"],
        ["Giai đoạn 3", "Xây dựng Backend, thiết kế RESTful API, tích hợp FE - BE - DB, xử lý đặt tour với khóa Serializable và mã VietQR động.", "31/10/2026 - 04/11/2026", "Lê Văn Mạnh, Lê Văn An", "API Gateway, luồng đặt tour và đối soát thanh toán", "100% (Hoàn thành)"],
        ["Giai đoạn 4", "Hoàn thiện Cổng quản trị Admin, kiểm duyệt đánh giá. Thiết kế kịch bản kiểm thử, chạy tự động 58 API + 17 DB Test Cases, đóng gói tài liệu báo cáo.", "05/11/2026 - 08/11/2026", "Lê Hải Đăng, Nguyễn Phúc, Cả nhóm", "Kịch bản test tự động (100% PASS), Báo cáo hoàn chỉnh", "100% (Hoàn thành)"]
    ]
    create_styled_table(doc, ["Giai đoạn", "Nội dung công việc chính", "Thời gian", "Người phụ trách", "Sản phẩm đầu ra", "Tiến độ"], sprint_milestones, [1.0, 2.2, 1.1, 1.1, 1.3, 0.7], "Bảng II: Kế hoạch và tiến độ hoàn thành các mốc thời gian (Milestones)")

    # NGẮT TRANG DUY NHẤT ĐỂ BƯỚC VÀO CHƯƠNG 1
    doc.add_page_break()

def build_chapter_1(doc):
    # CHƯƠNG 1 THEO ĐÚNG TÊN FILE HƯỚNG DẪN: PHÁT BIỂU BÀI TOÁN (LÀM CHI TIẾT)
    add_heading_1(doc, "CHƯƠNG 1: PHÁT BIỂU BÀI TOÁN (LÀM CHI TIẾT)")

    # 1.1 GIỚI THIỆU, PHÁT BIỂU
    add_heading_2(doc, "1.1: Giới thiệu, phát biểu")
    
    add_body_p(
        doc,
        "Ngành du lịch Việt Nam đang bước vào giai đoạn chuyển đổi số toàn diện và bùng nổ mạnh mẽ sau đại dịch. "
        "Sự phổ cập của mạng Internet băng thông rộng, sự thông dụng của điện thoại thông minh cùng với các giải pháp thanh toán số "
        "nhanh chóng (như chuyển khoản ngân hàng qua mã VietQR, ví điện tử) đã định hình lại căn bản thói quen và hành vi của người tiêu dùng du lịch. "
        "Trước đây, mô hình vận hành của các công ty lữ hành truyền thống phụ thuộc gần như hoàn toàn vào kênh phân phối trực tiếp: "
        "du khách phải đến tận trụ sở đại lý du lịch hoặc văn phòng bán vé để xem các tập sách giới thiệu (brochure in màu), "
        "nghe nhân viên tư vấn thuyết minh lộ trình, đối chiếu lịch khởi hành trên bảng giấy và thanh toán bằng tiền mặt. "
        "Phương thức vận hành thủ công này đã bộc lộ những rào cản chí mạng: chi phí in ấn tài liệu đắt đỏ, thông tin giá vé "
        "và lịch trình không thể cập nhật theo thời gian thực, du khách mất nhiều thời gian di chuyển, khó khăn trong việc so sánh "
        "các gói dịch vụ và đặc biệt là sự thiếu minh bạch tuyệt đối về tình trạng số chỗ ngồi thực tế còn trống trên từng chuyến xe hay máy bay."
    )
    
    add_body_p(
        doc,
        "Trong kỷ nguyên kinh tế số hiện nay, xu hướng đặt dịch vụ du lịch trực tuyến (Online Travel Booking - OTA) "
        "đang chiếm lĩnh vị thế chủ đạo. Du khách hiện đại đòi hỏi tính chủ động và tiện lợi cao: họ mong muốn có thể ngồi tại nhà, "
        "sử dụng máy tính hoặc điện thoại để tìm kiếm các gói tour theo nhiều tiêu chí linh hoạt (theo điểm đến, vùng miền, ngân sách, "
        "ngày đi dự kiến), xem bộ sưu tập hình ảnh thực tế đa góc nhìn, nghiên cứu kỹ lưỡng lịch trình chi tiết từng ngày (Day-by-Day "
        "với các thông tin cụ thể: sáng tham quan đâu, trưa ăn đặc sản gì, tối nghỉ dưỡng tại khách sạn tiêu chuẩn mấy sao), "
        "nắm bắt chính xác số lượng chỗ còn lại theo thời gian thực và thực hiện giao dịch giữ chỗ an toàn, thanh toán tiện lợi qua mã VietQR ngân hàng."
    )

    add_body_p(
        doc,
        "Tuy nhiên, qua khảo sát thực trạng công nghệ tại hàng loạt doanh nghiệp lữ hành vừa và nhỏ (SMEs) tại Việt Nam, "
        "nhóm nghiên cứu nhận thấy phần lớn các website du lịch hiện nay chỉ dừng lại ở mức độ là các trang web tĩnh (brochure điện tử đơn thuần) "
        "hoặc các hệ thống bán hàng chắp vá. Các hệ thống này đang trực tiếp đối mặt với 5 bài toán nghiệp vụ nan giải, "
        "gây thiệt hại nghiêm trọng về doanh thu, phát sinh chi phí vận hành thủ công và làm tổn hại sâu sắc đến uy tín thương hiệu:",
        bold_prefix="Năm bài toán nghiệp vụ thực tế cấp bách cần giải quyết: "
    )

    challenges = [
        ("1. Bài toán Overbooking (Đặt trùng chỗ, bán vượt quá sức chứa cho phép): ",
         "Đây là sự cố nghiêm trọng và phổ biến nhất trong kinh doanh lữ hành trực tuyến. Vào các dịp cao điểm như lễ Tết, "
         "kỳ nghỉ hè hoặc các đợt phát hành mã giảm giá giờ vàng, website thường phải tiếp nhận hàng trăm lượt truy cập đồng thời "
         "trong cùng một giây. Khi một chuyến khởi hành chỉ còn lại 1 hoặc 2 chỗ trống cuối cùng, nếu hệ thống ứng dụng không có cơ chế "
         "quản lý giao dịch đồng thời (ACID Concurrency Control) và cơ sở dữ liệu thiếu cơ chế khóa bản ghi giữ chỗ tạm thời (Temporary Seat Locking) "
         "ở mức độ cô lập cao (Serializable Isolation Level), thì cả hai người dùng đều thấy chỗ còn trống, cùng gửi lệnh đặt tour "
         "và cả hai giao dịch đều được ghi nhận thành công vào cơ sở dữ liệu. Hậu quả là doanh nghiệp đã bán vượt quá số ghế quy định "
         "của phương tiện vận chuyển (ô tô du lịch, khoang máy bay hoặc phòng khách sạn). Điều này dẫn tới xung đột gay gắt giữa khách hàng "
         "và doanh nghiệp tại thời điểm khởi hành, buộc công ty phải hủy chuyến của khách, bồi thường chi phí tài chính nặng nề "
         "và hứng chịu khủng hoảng truyền thông tẩy chay thương hiệu trên mạng xã hội."),
        
        ("2. Bài toán cấu trúc dữ liệu lịch trình phân mảnh, thiếu trực quan và thiếu minh bạch chi phí: ",
         "Phần lớn website du lịch hiện nay lưu trữ toàn bộ nội dung lộ trình tour trong một trường văn bản tự do (free text) hoặc file PDF đính kèm. "
         "Cách làm này khiến dữ liệu bị phân mảnh, khách hàng không thể xem được lịch trình bóc tách rõ ràng theo từng ngày (Day-by-Day Itinerary: "
         "Ngày 1 di chuyển những đâu, Ngày 2 trải nghiệm hoạt động gì, Ngày 3 kết thúc). Bên cạnh đó, website thiếu hệ thống thư viện hình ảnh đa phương tiện "
         "(Image Gallery) và thiếu bảng kê danh mục dịch vụ 'Bao gồm / Không bao gồm' (Inclusions / Exclusions) rõ ràng. "
         "Tình trạng thông tin mù mờ này tạo ra tâm lý e ngại về chi phí ẩn, làm giảm tỷ lệ chuyển đổi khách hàng từ xem sang đặt tour."),
         
        ("3. Bài toán mất đồng bộ dữ liệu hai chiều thời gian thực (Bi-directional Data Desynchronization): ",
         "Tồn tại khoảng trống thông tin rất lớn giữa bộ phận Quản trị / Điều hành tour và Khách hàng trên giao diện. "
         "Khi quản trị viên cập nhật giá bán mới, mở thêm đợt khởi hành hoặc điều chỉnh lộ trình tour do biến động thời tiết, "
         "dữ liệu thường không được đồng bộ tức thì lên giao diện khách hàng. Ngược lại, khi khách hàng gửi đơn đặt tour hoặc yêu cầu hủy đổi chỗ, "
         "thông tin không được phản hồi lập tức về trung tâm quản trị, gây ra hiện tượng số liệu thống kê bị vênh lệch, "
         "ảnh hưởng tiêu cực đến công tác hậu cần đặt phòng khách sạn và bố trí phương tiện đưa đón."),
         
        ("4. Bài toán đối soát thanh toán chuyển khoản thủ công và sai lệch mã đơn hàng: ",
         "Phương thức chuyển khoản ngân hàng truyền thống tiềm ẩn rủi ro sai sót rất lớn: khách hàng thường tự gõ nội dung chuyển khoản "
         "theo thói quen cá nhân (ví dụ: 'chuyen tien du lich', 'nguyen van a coc tour'...) mà không ghi đúng mã đơn đặt chỗ (Booking ID). "
         "Hàng ngày, bộ phận kế toán phải mất hàng giờ đồng hồ rà soát từng dòng sao kê tài khoản ngân hàng, gọi điện thoại cho khách để đối soát số tiền lẻ, "
         "gây chậm trễ trong việc xác nhận vé và xuất hóa đơn, trực tiếp làm suy giảm trải nghiệm dịch vụ của khách hàng."),
         
        ("5. Bài toán kiểm soát chất lượng & Kiểm toán an ninh bất biến (Audit Trail): ",
         "Vấn nạn đánh giá giả mạo (Fake / Spam Reviews) tràn lan do website cho phép bất kỳ ai cũng có thể bình luận mà không kiểm tra xem "
         "người đó đã thực sự trải nghiệm tour hay chưa, tạo kẽ hở cho đối thủ cạnh tranh không lành mạnh bôi nhọ uy tín doanh nghiệp. "
         "Đồng thời, mọi thao tác nhạy cảm của nhân viên nội bộ (như điều chỉnh giá bán, hủy vé của khách, cập nhật trạng thái đơn) "
         "không được lưu vết tự động vào cơ sở dữ liệu, dẫn đến việc không thể truy cứu trách nhiệm khi xảy ra sai phạm hay tranh chấp nội bộ.")
    ]

    for title, desc in challenges:
        add_bullet_p(doc, desc, bold_prefix=title)

    add_body_p(
        doc,
        "Đề tài 'Hệ thống Website Quảng bá và Đặt tour Du lịch Trực tuyến (Delta Travel)' được xây dựng nhằm giải quyết triệt để "
        "toàn diện 5 bài toán nghiệp vụ nêu trên. Hệ thống cung cấp một giải pháp phần mềm tổng thể: "
        "1) Chuẩn hóa cơ sở dữ liệu 12 bảng đạt chuẩn 3NF trên nền tảng Microsoft SQL Server; "
        "2) Ứng dụng cơ chế khóa giao dịch đồng thời (ACID Serializable Locking) kết hợp Triggers tự động kiểm soát giữ chỗ và hoàn chỗ, ngăn chặn Overbooking tuyệt đối; "
        "3) Tích hợp công nghệ thanh toán thông minh VietQR chuẩn NAPAS247 tự động điền số tiền và mã đơn hàng; "
        "4) Xây dựng bảng AUDITLOG lưu vết kiểm toán bất biến bảo vệ an toàn vận hành; "
        "5) Phát triển giao diện Liquid Glass hiện đại, tương thích đa nền tảng.",
        bold_prefix="Mục tiêu cốt lõi của giải pháp Delta Travel: "
    )

    # ĐỐI TƯỢNG SỬ DỤNG VÀ PHẠM VI HỆ THỐNG (LÀM CHI TIẾT THEO YÊU CẦU PROMPT MỚI)
    add_body_p(
        doc,
        "Nhằm xây dựng một hệ thống phần mềm có tính tổ chức cao, bảo mật chặt chẽ và phân định rõ ràng quyền hạn nghiệp vụ, "
        "phạm vi hệ thống Delta Travel được thiết kế phân chia tường minh cho 3 nhóm đối tượng người dùng chính. "
        "Mỗi nhóm đối tượng đều được đặc tả chi tiết về danh mục chức năng được phép thực thi và các ràng buộc nghiệp vụ bắt buộc phải tuân thủ:",
        bold_prefix="Đối tượng sử dụng và phạm vi hệ thống (Phân tích chi tiết chức năng và ràng buộc): "
    )

    # Nhóm 1: Khách viếng thăm
    add_body_p(
        doc,
        "Khách viếng thăm là những người dùng vãng lai chưa thực hiện đăng nhập hoặc chưa có tài khoản thành viên trong hệ thống Delta Travel. "
        "Họ truy cập vào website thông qua các công cụ tìm kiếm hoặc liên kết mạng xã hội để tham khảo thông tin.",
        bold_prefix="1. Nhóm Khách viếng thăm (Guest / Anonymous User): "
    )
    add_bullet_p(doc, "Tìm kiếm tour đa tiêu chí theo điểm đến, phân loại vùng miền (Bắc, Trung, Nam), khoảng giá và thời gian khởi hành.", bold_prefix="• Chức năng Tra cứu & Tìm kiếm: ")
    add_bullet_p(doc, "Xem chi tiết tour du lịch bao gồm lộ trình từng ngày (Day-by-Day), bộ sưu tập hình ảnh thực tế đa góc nhìn, các dịch vụ 'Bao gồm / Không bao gồm' và bảng giá niêm yết.", bold_prefix="• Chức năng Khám phá chi tiết: ")
    add_bullet_p(doc, "Đọc các bài viết cẩm nang du lịch, bài viết quảng bá điểm đến, văn hóa ẩm thực địa phương do ban quản trị biên tập.", bold_prefix="• Chức năng Đọc tin tức & Cẩm nang: ")
    add_bullet_p(doc, "Gửi biểu mẫu yêu cầu tư vấn nhanh (Contact Form) gồm họ tên, số điện thoại, email và nội dung quan tâm để nhận hỗ trợ từ tư vấn viên.", bold_prefix="• Chức năng Gửi yêu cầu tư vấn: ")
    add_bullet_p(doc, "Đăng ký tài khoản thành viên mới bằng cách cung cấp họ tên, email duy nhất, số điện thoại hợp lệ và mật khẩu bảo mật.", bold_prefix="• Chức năng Đăng ký tài khoản: ")
    add_bullet_p(doc, "Khách viếng thăm chỉ có quyền ĐỌC (Read-Only) đối với các thông tin công khai; không được phép thực hiện các thao tác ghi dữ liệu nhạy cảm. Không được chọn số ghế, không được gửi yêu cầu đặt tour (muốn đặt tour bắt buộc phải chuyển sang tài khoản thành viên). Mọi biểu mẫu gửi lên (Tư vấn, Đăng ký) đều phải qua cơ chế kiểm tra định dạng dữ liệu (Validation) và giới hạn tần suất gửi (Rate-limiting) để ngăn ngừa tấn công Spam Bot.", bold_prefix="• Ràng buộc nghiệp vụ & An ninh: ")

    # Nhóm 2: Khách hàng thành viên
    add_body_p(
        doc,
        "Khách hàng thành viên là người dùng đã hoàn tất quy trình đăng ký và định danh tài khoản hợp lệ trong cơ sở dữ liệu. "
        "Họ là chủ thể trực tiếp thực hiện các giao dịch thương mại đặt tour và thanh toán dịch vụ.",
        bold_prefix="2. Nhóm Khách hàng thành viên (Registered Customer): "
    )
    add_bullet_p(doc, "Đăng nhập an toàn qua hệ thống xác thực JSON Web Token (JWT), quản lý thông tin hồ sơ cá nhân, đổi mật khẩu và khôi phục mật khẩu quên qua email xác thực.", bold_prefix="• Chức năng Xác thực & Hồ sơ: ")
    add_bullet_p(doc, "Xem danh sách các chuyến khởi hành cụ thể kèm số lượng chỗ còn nhận thực tế theo thời gian thực; thực hiện quy trình đặt chỗ trực tuyến qua biểu mẫu 3 bước trực quan.", bold_prefix="• Chức năng Đặt tour trực tuyến: ")
    add_bullet_p(doc, "Khai báo đầy đủ danh sách hành khách tham gia chuyến đi bao gồm: Họ tên, Ngày tháng năm sinh, Giới tính, phân loại nhóm tuổi (Người lớn, Trẻ em, Em bé) phục vụ kê khai bảo hiểm du lịch bắt buộc.", bold_prefix="• Chức năng Khai báo hành khách: ")
    add_bullet_p(doc, "Nhận mã VietQR động chuẩn NAPAS247 hiển thị tức thời trên màn hình có tự động điền sẵn số tiền chính xác và nội dung chuyển khoản chứa mã đơn; tải ảnh chụp biên lai giao dịch thành công lên hệ thống.", bold_prefix="• Chức năng Thanh toán & Tải biên lai: ")
    add_bullet_p(doc, "Truy cập mục 'Đơn đặt tour của tôi' (My Bookings) để theo dõi trạng thái tiến trình đơn hàng (Chờ thanh toán, Đã cọc, Đã thanh toán, Hoàn tất, Đã hủy).", bold_prefix="• Chức năng Quản lý lịch sử đặt tour: ")
    add_bullet_p(doc, "Gửi yêu cầu đổi ngày khởi hành hoặc hủy tour trực tuyến có kèm lý do cụ thể theo chính sách hoàn hủy của công ty.", bold_prefix="• Chức năng Yêu cầu Đổi / Hủy tour: ")
    add_bullet_p(doc, "Viết nhận xét, đánh giá chất lượng dịch vụ và chấm điểm từ 1 đến 5 sao kèm hình ảnh thực tế sau khi chuyến đi đã hoàn thành.", bold_prefix="• Chức năng Đánh giá & Phản hồi: ")
    add_bullet_p(doc, "Lưu lại các sản phẩm tour yêu thích vào danh sách quan tâm cá nhân (Wishlist) để theo dõi biến động giá và ưu đãi.", bold_prefix="• Chức năng Quản lý Tour yêu thích: ")
    add_bullet_p(doc, "Khách hàng bắt buộc phải có token JWT hợp lệ kèm vai trò Khách hàng (Role = Customer). Khách hàng chỉ có quyền xem, chỉnh sửa thông tin cá nhân và quản lý các đơn hàng thuộc chính chủ sở hữu của mình; tuyệt đối không thể truy cập đơn hàng của khách hàng khác. Số lượng hành khách nhập trong danh sách bắt buộc phải khớp 100% với số lượng chỗ đã đăng ký giữ. Chức năng hủy hoặc đổi tour chỉ được phép kích hoạt khi đơn hàng thỏa mãn điều kiện quy chế thời gian trước khởi hành (ví dụ: trước 5 ngày khởi hành). Đánh giá tour chỉ được phép tạo khi đơn hàng đã chuyển sang trạng thái 'Đã hoàn thành'.", bold_prefix="• Ràng buộc nghiệp vụ & An ninh: ")

    # Nhóm 3: Quản trị viên
    add_body_p(
        doc,
        "Quản trị viên là nhân sự quản lý nghiệp vụ, điều hành tour và kiểm soát kỹ thuật của công ty lữ hành Delta Travel. "
        "Họ có thẩm quyền cao nhất để vận hành, điều phối toàn bộ tài nguyên thông tin và giao dịch thương mại của hệ thống.",
        bold_prefix="3. Nhóm Quản trị viên hệ thống (Administrator): "
    )
    add_bullet_p(doc, "Quản lý danh sách tài khoản người dùng, cấp quyền, khóa hoặc mở khóa tài khoản người dùng khi phát hiện dấu hiệu vi phạm điều khoản.", bold_prefix="• Quản lý Tài khoản & Phân quyền: ")
    add_bullet_p(doc, "Thực hiện đầy đủ các thao tác Thêm, Sửa, Ẩn, Kích hoạt đối với danh mục tour, thông tin tour chi tiết, bộ sưu tập hình ảnh và lộ trình từng ngày (Day-by-Day).", bold_prefix="• Quản lý Sản phẩm Tour & Lịch trình: ")
    add_bullet_p(doc, "Thiết lập các chuyến khởi hành cụ thể cho từng tour, quy định ngày bắt đầu, ngày kết thúc, giá vé phân loại và sức chứa chỗ ngồi tối đa.", bold_prefix="• Quản lý Lịch khởi hành & Sức chứa: ")
    add_bullet_p(doc, "Tiếp nhận toàn bộ các đơn đặt tour gửi về hệ thống, theo dõi tiến độ, cập nhật trạng thái đơn (Xác nhận, Đã thanh toán, Hoàn thành, Hủy).", bold_prefix="• Quản lý Đơn đặt tour: ")
    add_bullet_p(doc, "Kiểm tra ảnh chụp biên lai chuyển khoản của khách hàng, đối soát với hệ thống ngân hàng thụ hưởng, xác nhận trạng thái thanh toán thành công.", bold_prefix="• Quản lý Đối soát Thanh toán: ")
    add_bullet_p(doc, "Kiểm duyệt nội dung và hình ảnh đánh giá của khách hàng trước khi xuất bản công khai lên website, phản hồi thắc mắc của du khách.", bold_prefix="• Kiểm duyệt Đánh giá chất lượng: ")
    add_bullet_p(doc, "Soạn thảo, biên tập, đăng tải và quản lý các bài viết cẩm nang du lịch, tin tức khuyến mãi theo chuẩn biên tập nội dung số.", bold_prefix="• Quản lý Bài viết & Nội dung: ")
    add_bullet_p(doc, "Theo dõi bảng điều khiển số liệu thống kê (Admin Dashboard) tổng quan: tổng doanh thu theo kỳ, số lượng đơn hàng, tỷ lệ lấp đầy ghế trên từng chuyến, danh sách tour bán chạy nhất.", bold_prefix="• Thống kê & Báo cáo điều hành: ")
    add_bullet_p(doc, "Tra cứu toàn bộ lịch sử thao tác của các tài khoản quản trị trong hệ thống thông qua bảng nhật ký kiểm toán AUDITLOG bất biến phục vụ an ninh và thanh tra.", bold_prefix="• Tra cứu Nhật ký Kiểm toán Hệ thống: ")
    add_bullet_p(doc, "Quản trị viên bắt buộc phải xác thực với tài khoản có quyền Admin cao nhất. Mọi hành động làm thay đổi trạng thái dữ liệu trọng yếu (Cập nhật giá tour, Hủy đơn của khách, Thay đổi trạng thái thanh toán, Phân quyền) bắt buộc phải được kích hoạt ghi log tự động vào bảng AUDITLOG gồm mã người thực hiện, hành động, dữ liệu trước và sau khi thay đổi. Quản trị viên không được phép xóa cứng (Hard Delete) các tour hoặc chuyến khởi hành đã có khách hàng đặt vé; chỉ được phép thay đổi trạng thái sang 'Tạm dừng nhận khách' để bảo toàn tính toàn vẹn lịch sử giao dịch và kế toán.", bold_prefix="• Ràng buộc nghiệp vụ & An ninh: ")

    # Bảng ma trận đối tượng, chức năng và ràng buộc
    actor_matrix_data = [
        ["Khách viếng thăm\n(Guest)",
         "• Tra cứu, tìm kiếm và lọc tour đa tiêu chí\n"
         "• Xem chi tiết tour, lộ trình Day-by-Day và ảnh gallery\n"
         "• Đọc bài viết cẩm nang du lịch và tin tức\n"
         "• Gửi form yêu cầu tư vấn hỗ trợ\n"
         "• Đăng ký tài khoản thành viên mới",
         "• Chỉ có quyền đọc (Read-Only) dữ liệu công khai\n"
         "• Không được chọn ghế, không được gửi đơn đặt tour\n"
         "• Form gửi dữ liệu chịu ràng buộc Validation & Rate-limit chống spam"],
        ["Khách hàng thành viên\n(Customer)",
         "• Đăng nhập, quản lý hồ sơ cá nhân, đổi mật khẩu\n"
         "• Đặt tour trực tuyến, chọn chuyến và ngày đi\n"
         "• Khai báo danh sách hành khách chi tiết theo nhóm tuổi\n"
         "• Thanh toán qua VietQR động và tải ảnh biên lai\n"
         "• Quản lý lịch sử đơn đặt tour trong 'My Bookings'\n"
         "• Gửi yêu cầu đổi hoặc hủy tour kèm lý do\n"
         "• Viết đánh giá, chấm điểm sao cho tour đã trải nghiệm\n"
         "• Quản lý danh mục tour yêu thích (Wishlist)",
         "• Bắt buộc xác thực qua JWT token hợp lệ\n"
         "• Chỉ được xem và thao tác trên đơn hàng chính chủ của mình\n"
         "• Số lượng hành khách phải khớp 100% với số chỗ đặt giữ\n"
         "• Hủy/đổi tour tuân thủ nghiêm ngặt quy chế thời gian trước khởi hành\n"
         "• Chỉ đánh giá các tour có trạng thái đơn 'Đã hoàn thành'"],
        ["Quản trị viên\n(Administrator)",
         "• Quản lý tài khoản người dùng, phân quyền RBAC\n"
         "• Quản trị CRUD danh mục tour, sản phẩm tour và lịch trình\n"
         "• Quản trị các chuyến khởi hành, giá bán và số chỗ mở bán\n"
         "• Tiếp nhận, xử lý và cập nhật trạng thái đơn đặt tour\n"
         "• Đối soát thanh toán ngân hàng qua biên lai VietQR\n"
         "• Kiểm duyệt đánh giá của khách hàng trước khi xuất bản\n"
         "• Quản trị hệ thống bài viết cẩm nang du lịch CMS\n"
         "• Xem dashboard thống kê doanh thu và báo cáo lấp đầy chỗ\n"
         "• Tra cứu nhật ký kiểm toán hệ thống (Audit Log)",
         "• Bắt buộc tài khoản có quyền Admin cao nhất\n"
         "• Mọi thao tác CUD nhạy cảm bắt buộc tự động ghi log vào AUDITLOG\n"
         "• Tuyệt đối không xóa cứng (Hard Delete) tour/chuyến đã có booking\n"
         "• Tuân thủ quy trình kiểm soát đối soát tài chính hai bước"]
    ]
    create_styled_table(doc, ["Nhóm đối tượng người dùng", "Danh mục chức năng chi tiết trong phạm vi", "Các ràng buộc nghiệp vụ & an ninh bắt buộc"], actor_matrix_data, [1.5, 2.8, 2.4], "Bảng 1.2: Bảng tổng hợp đối tượng sử dụng, chức năng chi tiết và ràng buộc nghiệp vụ")

    

    # 1.2 KHẢO SÁT THEO ĐÚNG TÊN FILE HƯỚNG DẪN
    add_heading_2(doc, "1.2: Khảo sát : web  để lấy: text=> sinh database và lấy chức năng phù hợp")
    
    add_body_p(
        doc,
        "Nhằm xây dựng một hệ thống phần mềm đặt tour thực sự có giá trị thương mại và sát với thực tế vận hành tại Việt Nam, "
        "nhóm nghiên cứu đã tiến hành khảo sát thực nghiệm trực tiếp website du lịch hàng đầu cả nước là Vietravel "
        "(liên kết khảo sát trực tiếp: https://travel.com.vn/du-lich-mien-bac.aspx). "
        "Vietravel là doanh nghiệp lữ hành tiêu biểu tại Việt Nam với hệ sinh thái phân phối tour trực tuyến quy mô lớn, "
        "quy trình chuẩn mực và phục vụ hàng triệu lượt du khách trong và ngoài nước mỗi năm.",
        bold_prefix="Khảo sát website thực tế Vietravel: "
    )

    # Chèn 2 ảnh chụp Vietravel
    img_vietravel_1 = os.path.join(CLEAN_IMG_DIR, "hinh_1_1_vietravel_1.png")
    add_image_with_caption(doc, img_vietravel_1, "Hình 1.1: Giao diện khảo sát thực tế website du lịch Vietravel - Danh mục tour du lịch Miền Bắc (travel.com.vn)", width_inches=6.0)

    img_vietravel_2 = os.path.join(CLEAN_IMG_DIR, "hinh_1_2_vietravel_2.png")
    add_image_with_caption(doc, img_vietravel_2, "Hình 1.2: Giao diện khảo sát thực tế website du lịch Vietravel - Chi tiết sản phẩm tour, lịch trình và chính sách giá", width_inches=6.0)

    add_body_p(
        doc,
        "Thông qua việc phân tích chuyên sâu các khối văn bản (Text), các trường dữ liệu hiển thị và cấu trúc luồng tương tác trên website Vietravel, "
        "nhóm đã thực hiện bóc tách và phân loại văn bản thành các thành phần nghiệp vụ cốt lõi sau:",
        bold_prefix="Bóc tách văn bản (Text) trên website khảo sát: "
    )

    vietravel_text_breakdown = [
        ("Khối văn bản Thông tin sản phẩm Tour: ",
         "Tên tour chuẩn hóa (VD: 'Hà Nội - Đền Hùng - Khoáng nóng Thanh Thủy - Làng cổ Đường Lâm'), Mã định danh tour (VD: 'NNDVN240-001'), "
         "Danh mục phân loại vùng miền (Miền Bắc, Miền Trung, Miền Nam, Du lịch Biển đảo), Điểm khởi hành (Hà Nội), Điểm đến (Phú Thọ, Hà Tây), "
         "Thời lượng hành trình (3 Ngày 2 Đêm), Phương tiện di chuyển (Xe du lịch đời mới), Tiêu chuẩn lưu trú (Khách sạn 4 sao), "
         "Mức giá niêm yết gốc và Mức giá khuyến nghị sau giảm giá."),
        
        ("Khối văn bản Lộ trình từng ngày (Day-by-Day Itinerary): ",
         "Lịch trình được bóc tách khoa học theo từng ngày: Ngày 1 (Hà Nội - Đền Hùng: Sáng đón khách, trưa thưởng thức ẩm thực Đất Tổ, chiều dâng hương tưởng niệm), "
         "Ngày 2 (Thanh Thủy - Trải nghiệm khoáng nóng Onsen Nhật Bản), Ngày 3 (Làng cổ Đường Lâm - Chùa Thầy - Trở về Hà Nội). "
         "Đi kèm là danh sách dịch vụ 'Bao gồm' (Xe đưa đón, vé tham quan danh lam thắng cảnh, bữa ăn tiêu chuẩn theo chương trình, bảo hiểm du lịch tối đa 100.000.000 VNĐ/vụ) "
         "và 'Không bao gồm' (Chi phí giặt là, đồ uống tự gọi, tiền bồi dưỡng hướng dẫn viên)."),
         
        ("Khối văn bản Lịch khởi hành và Quản lý số chỗ: ",
         "Mỗi tour có nhiều đợt khởi hành khác nhau: Ngày khởi hành cụ thể, Ngày kết thúc hành trình, Mức giá vé phân loại chi tiết "
         "(Giá người lớn áp dụng cho khách từ 12 tuổi trở lên, Giá trẻ em từ 5 đến 11 tuổi bằng 75% giá gốc, Giá em bé dưới 5 tuổi miễn phí vé), "
         "Số chỗ tối đa mở bán của đoàn (Total Seats) và Số chỗ còn nhận thực tế (Available Seats). Khi số chỗ còn nhận bằng 0, "
         "hệ thống tự động hiển thị nhãn 'Hết chỗ' và vô hiệu hóa nút đặt vé."),
         
        ("Khối văn bản Đặt tour và Thu thập thông tin hành khách: ",
         "Biểu mẫu thu thập dữ liệu gồm hai phần rõ rệt: 1) Thông tin người đại diện liên hệ (Họ tên, Số điện thoại di động, Email xác nhận, Địa chỉ); "
         "2) Danh sách hành khách đi cùng đoàn (Họ tên từng người, Ngày tháng năm sinh, Giới tính, Nhóm tuổi Người lớn / Trẻ em / Em bé, Số căn cước công dân hoặc Hộ chiếu) "
         "nhằm phục vụ việc mua bảo hiểm trách nhiệm dân sự bắt buộc."),
         
        ("Khối văn bản Thanh toán và Đối soát giao dịch: ",
         "Phương thức chuyển khoản ngân hàng hiển thị mã QR kèm đầy đủ thông số: Tên ngân hàng thụ hưởng, Số tài khoản doanh nghiệp, "
         "Tên chủ tài khoản, Số tiền chính xác và Mã đặt tour (Booking Code) được tích hợp trong cú pháp chuyển khoản để hệ thống ngân hàng "
         "tự động đối soát khớp lệnh nhanh chóng.")
    ]

    for title, desc in vietravel_text_breakdown:
        add_bullet_p(doc, desc, bold_prefix=title)

    add_body_p(
        doc,
        "Từ các khối văn bản phân tích được ở trên, nhóm đã tiến hành mô hình hóa dữ liệu, loại bỏ dư thừa và sinh ra cấu trúc "
        "cơ sở dữ liệu quan hệ hoàn chỉnh gồm đúng 12 thực thể nghiệp vụ chuẩn hóa, phản ánh chính xác cấu trúc thực tế:",
        bold_prefix="Từ Text khảo sát => Sinh Cơ sở dữ liệu 12 bảng: "
    )

    db_from_text = [
        ["NGUOIDUNG", "Khối thông tin tài khoản người đặt tour và ban quản trị", "Lưu trữ họ tên, email, số điện thoại, mật khẩu băm và địa chỉ"],
        ["DANHMUC", "Khối phân loại vùng miền trên thanh điều hướng", "Quản lý danh mục Miền Bắc, Miền Trung, Miền Nam, Biển đảo"],
        ["TOUR", "Khối thông tin sản phẩm tour du lịch gốc", "Mã tour, tên tour, mô tả chi tiết, lịch trình tổng quan, giá khuyến nghị"],
        ["HINHANH_TOUR", "Khối bộ sưu tập ảnh (Gallery) của tour", "Lưu trữ các hình ảnh thực tế đa góc nhìn phục vụ trình chiếu slide"],
        ["LICH_TRINH_DETAIL", "Khối lộ trình chi tiết từng ngày (Day-by-Day)", "Bóc tách hoạt động theo từng ngày (Ngày 1, 2, 3) kèm điểm tham quan"],
        ["CHUYENKHOIHANH", "Khối lịch khởi hành và kiểm soát chỗ", "Quản lý các ngày đi cụ thể, giá vé thực tế, số chỗ tối đa, số chỗ đã đặt"],
        ["DATTOUR", "Khối đơn đặt vé và theo dõi trạng thái", "Lưu mã booking, khách hàng, chuyến, ngày đặt, số lượng, tổng tiền, trạng thái"],
        ["CHITIET_HANHKHACH", "Khối danh sách hành khách đi kèm", "Lưu họ tên, ngày sinh, giới tính, số điện thoại từng hành khách trong đoàn"],
        ["THANHTOAN", "Khối minh chứng chuyển khoản VietQR", "Lưu phương thức, mã giao dịch ngân hàng, số tiền và trạng thái đối soát"],
        ["DANHGIA", "Khối nhận xét và đánh giá trải nghiệm", "Lưu điểm sao (1-5 sao), bình luận thực tế, ảnh đính kèm và kiểm duyệt"],
        ["BAIVIET_QUANGBA", "Khối tin tức và cẩm nang du lịch", "Quản lý các bài viết quảng bá văn hóa, điểm đến hấp dẫn chuẩn SEO"],
        ["AUDITLOG", "Khối nhật ký kiểm toán hệ thống", "Lưu vết tự động các thao tác thay đổi giá, đổi trạng thái đơn, hủy chỗ bất biến"]
    ]
    create_styled_table(doc, ["Tên thực thể sinh ra", "Khối văn bản khảo sát tương ứng", "Vai trò nghiệp vụ trong hệ thống"], db_from_text, [1.6, 2.3, 2.5], "Bảng 1.1: Ma trận sinh thực thể CSDL từ kết quả phân tích văn bản website khảo sát Vietravel")

    # LỰA CHỌN CHỨC NĂNG PHÙ HỢP (LÀM CHI TIẾT 5 CHỨC NĂNG CHÍNH VÀ CÁC CHỨC NĂNG PHỤ)
    add_body_p(
        doc,
        "Qua khảo sát, nhóm nhận thấy một website thương mại du lịch lớn như Vietravel thường tích hợp rất nhiều mảng dịch vụ mở rộng "
        "(như đặt vé máy bay lẻ toàn cầu, đặt phòng khách sạn quốc tế, làm visa xuất cảnh các nước, dịch vụ thuê xe tự lái, tổ chức sự kiện mice...). "
        "Để đảm bảo tính khả thi cao nhất cho một dự án bài tập lớn đại học nhưng vẫn thể hiện chiều sâu kỹ thuật phần mềm vượt trội, "
        "nhóm đã chọn lọc và thiết kế 5 chức năng cốt lõi cùng các chức năng phụ trợ hoàn chỉnh cho hệ thống Delta Travel:",
        bold_prefix="Lựa chọn chức năng phù hợp cho hệ thống Delta Travel (Phân tích chi tiết 5 chức năng chính và các chức năng phụ): "
    )

    core_and_sub_functions = [
        ("1. Chức năng Tra cứu, Tìm kiếm và Lọc tour thông minh đa tiêu chí (Chức năng chính): ",
         "Đây là chức năng cửa ngõ tiếp cận khách hàng. Hệ thống xây dựng bộ lọc đa tầng kết hợp: "
         "1) Lọc theo từ khóa điểm đến (hỗ trợ tìm kiếm không dấu và tiếng Việt có dấu nhờ cơ chế tối ưu Full-Text Search); "
         "2) Lọc theo vùng miền địa lý (Miền Bắc, Miền Trung, Miền Nam); "
         "3) Lọc theo khoảng ngân sách tài chính (dưới 2 triệu, từ 2 đến 5 triệu, trên 5 triệu); "
         "4) Lọc theo khoảng thời gian khởi hành. Kết quả trả về hiển thị dưới dạng lưới thẻ tour sinh động (Card Grid) "
         "với các thông tin hấp dẫn: ảnh đại diện sắc nét, thời lượng tour, giá bán ưu đãi, số chỗ còn nhận và điểm đánh giá sao trung bình. "
         "Khi click vào tour, trang chi tiết hiển thị toàn diện: lộ trình chi tiết từng ngày, dịch vụ bao gồm/không bao gồm và bộ sưu tập ảnh đa góc nhìn."),
        
        ("2. Chức năng Đặt tour trực tuyến & Khóa giữ chỗ tự động chống Overbooking (Chức năng chính): ",
         "Đây là hạt nhân nghiệp vụ quan trọng nhất của hệ thống. Khách hàng lựa chọn chuyến khởi hành còn chỗ, "
         "nhập thông tin người liên hệ và danh sách từng hành khách theo nhóm tuổi. Tại thời điểm người dùng nhấn nút 'Xác nhận đặt tour', "
         "Backend kích hoạt một Database Transaction với mức độ cô lập tuần tự hóa nghiêm ngặt (Serializable Isolation Level) "
         "kết hợp Trigger SQL Server `TRG_DATTOUR_CheckAndLockSeats`. Hệ thống tức thời kiểm tra số ghế khả dụng: "
         "nếu `SoChoDaDat + SoLuongKhachMoi <= SoChoToiDa`, hệ thống ngay lập tức ghi nhận bản ghi đơn hàng vào bảng `DATTOUR`, "
         "tự động cộng dồn số ghế đã bán trong bảng `CHUYENKHOIHANH` và trả về mã đặt chỗ duy nhất (Booking Code). "
         "Ngược lại, nếu số chỗ không đủ, Transaction lập tức Rollback và thông báo lỗi hết chỗ rõ ràng cho người dùng, "
         "ngăn chặn triệt để 100% rủi ro Overbooking ngay cả khi có hàng chục yêu cầu gửi đồng thời."),
         
        ("3. Chức năng Thanh toán thông minh qua mã VietQR động chuẩn NAPAS247 (Chức năng chính): ",
         "Ngay sau khi đơn hàng được ghi nhận giữ chỗ thành công, hệ thống tự động sinh một mã QR thanh toán động "
         "theo tiêu chuẩn kỹ thuật VietQR của Công ty Cổ phần Thanh toán Quốc gia Việt Nam (NAPAS). "
         "Mã QR này tích hợp sẵn mã định danh ngân hàng thụ hưởng (BIN), số tài khoản doanh nghiệp, "
         "số tiền thanh toán chính xác đến từng đồng (tương ứng với tổng chi phí đơn tour) và cú pháp nội dung chuyển khoản chuẩn mực "
         "(ví dụ: `DT` + Mã đơn hàng). Khách hàng chỉ cần mở ứng dụng ngân hàng bất kỳ (Mobile Banking) để quét mã mà không cần "
         "nhập tay bất kỳ ký tự nào, loại bỏ hoàn toàn các lỗi sai sót mã đơn hoặc nhầm số tiền. Đồng thời, giao diện cung cấp "
         "nút tải ảnh biên lai chuyển khoản để khách hàng đính kèm minh chứng đối soát nhanh chóng."),
         
        ("4. Chức năng Quản lý đơn hàng, Tra cứu lịch sử & Xử lý Yêu cầu Đổi/Hủy tour (Chức năng chính): ",
         "Khách hàng thành viên có thể truy cập khu vực 'Đơn đặt tour của tôi' (My Bookings) để tra cứu toàn bộ lịch sử các chuyến đi. "
         "Đối với các đơn hàng chưa khởi hành, khách hàng có thể gửi yêu cầu Đổi ngày đi hoặc Hủy tour trực tuyến có kèm lý do. "
         "Hệ thống tự động đối chiếu thời điểm gửi yêu cầu với ngày khởi hành của chuyến đi: nếu thỏa mãn quy định (ví dụ: gửi trước ngày đi ít nhất 5 ngày), "
         "yêu cầu sẽ được phê duyệt, trạng thái đơn chuyển sang 'Đã hủy', và Trigger SQL Server `TRG_DATTOUR_RefundSeatsOnCancel` "
         "sẽ tự động hoàn trả lại số ghế tương ứng vào kho vé khả dụng của chuyến đi để khách hàng khác có thể tiếp tục đặt."),
         
        ("5. Chức năng Quản trị vận hành toàn diện & Dashboard Thống kê (Chức năng chính): ",
         "Cổng quản trị Admin Dashboard cung cấp cho ban quản lý bức tranh toàn cảnh về hoạt động kinh doanh: "
         "1) Biểu đồ trực quan theo dõi doanh thu theo từng tháng và theo từng danh mục tour; "
         "2) Thống kê tỷ lệ lấp đầy ghế trên từng chuyến xe/máy bay; "
         "3) Quản lý toàn bộ vòng đời sản phẩm tour (CRUD tour, thêm ảnh, cập nhật lịch trình); "
         "4) Phân hệ tiếp nhận và đối soát thanh toán đơn hàng; "
         "5) Quản lý tài khoản người dùng và phân quyền quản trị."),
         
        ("6. Chức năng Đánh giá & Phản hồi chất lượng tour - Reviews & Ratings (Chức năng phụ): ",
         "Cho phép du khách đã trải nghiệm chuyến đi viết bài chia sẻ cảm nhận, chấm điểm số sao từ 1 đến 5 sao và đăng tải các bức ảnh "
         "chụp thực tế trong chuyến đi. Nhằm ngăn chặn spam và bình luận xấu độc hại từ đối thủ, hệ thống áp dụng cơ chế kiểm duyệt trước (Pre-moderation): "
         "đánh giá mới tạo sẽ ở trạng thái chờ duyệt, chỉ sau khi Quản trị viên kiểm tra nội dung và phê duyệt thì đánh giá mới được "
         "hiển thị công khai lên website, đồng thời điểm số sao trung bình của tour sẽ được tự động tính toán lại."),
         
        ("7. Chức năng Quản lý Thư viện Bài viết & Cẩm nang du lịch - Travel Blog / Guides (Chức năng phụ): ",
         "Hệ thống CMS tích hợp cho phép ban biên tập đăng tải các bài viết chia sẻ kinh nghiệm du lịch, cẩm nang khám phá ẩm thực "
         "và văn hóa các vùng miền. Mỗi bài viết được quản lý theo cấu trúc chuẩn SEO: tiêu đề hấp dẫn, đường dẫn thân thiện (slug URL), "
         "đoạn tóm tắt thu hút, ảnh đại diện và nội dung định dạng phong phú, giúp gia tăng lưu lượng truy cập tự nhiên (Organic Traffic) cho website."),
         
        ("8. Chức năng Tiếp nhận & Điều phối Yêu cầu Tư vấn - Contact / Inquiry Leads (Chức năng phụ): ",
         "Biểu mẫu liên hệ tư vấn nhanh được bố trí tại các vị trí thuận tiện trên website. Khách viếng thăm chỉ cần để lại số điện thoại "
         "và điểm đến mong muốn, hệ thống sẽ tự động lưu trữ thông tin vào cơ sở dữ liệu và gửi thông báo cho đội ngũ tư vấn viên để gọi điện "
         "chăm sóc khách hàng kịp thời, tối đa hóa tỷ lệ chuyển đổi khách hàng tiềm năng."),
         
        ("9. Chức năng Quản lý Danh sách Tour Yêu thích - Wishlist (Chức năng phụ): ",
         "Tính năng cá nhân hóa trải nghiệm người dùng, cho phép khách hàng đăng nhập nhấn lưu lại các tour du lịch mà mình yêu thích "
         "vào một danh sách riêng để theo dõi biến động giá cả hoặc chờ đợt khuyến mãi trước khi đưa ra quyết định đặt vé chính thức."),
         
        ("10. Chức năng Kiểm toán An ninh và Nhật ký Hệ thống - Audit Logging (Chức năng phụ): ",
         "Phân hệ kiểm toán hoạt động độc lập ngầm trong hệ thống. Mỗi khi có thao tác làm thay đổi dữ liệu nhạy cảm "
         "(như quản trị viên sửa giá tour, hủy đơn hàng của khách, thay đổi trạng thái thanh toán hoặc phân quyền tài khoản), "
         "hệ thống tự động trích xuất mã người thực hiện, hành động, dữ liệu trước và sau khi thay đổi (dưới định dạng chuỗi JSON) "
         "và ghi nhận bất biến (Append-only) vào bảng `AUDITLOG` để phục vụ công tác thanh tra và đảm bảo an ninh vận hành.")
    ]

    for title, desc in core_and_sub_functions:
        add_bullet_p(doc, desc, bold_prefix=title)

    doc.add_page_break()
