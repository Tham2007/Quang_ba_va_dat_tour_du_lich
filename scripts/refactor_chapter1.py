import os

cover_and_preface_code = '''def build_cover_and_preface(doc):
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
        "Trong quá trình thực hiện đề tài \\"Website quảng bá và đặt tour du lịch trực tuyến tại Việt Nam (Delta Travel)\\", "
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
    r_sign = p_sign.add_run("Nhóm 3 (Delta Travel)\\nSinh viên thực hiện đề tài")
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
        ["1", "Lê Văn Mạnh\\n(Trưởng nhóm)", "Backend, API & Kiến trúc",
         "• Thiết kế hợp đồng API RESTful (API Contract & Schemas)\\n"
         "• Phát triển Backend xử lý logic đặt tour, giao dịch ACID Concurrency\\n"
         "• Quản trị CRUD Tour, kiểm soát khóa chỗ, hủy đơn, hoàn chỗ\\n"
         "• Tích hợp đồng bộ FE - BE - DB và kiểm soát phiên an toàn JWT\\n"
         "• Chủ trì biên tập Báo cáo đồ án và kiến trúc hệ thống MVC", "100%"],
        ["2", "Phạm Thị Hồng Thắm", "Thiết kế CSDL & SQL Server",
         "• Khảo sát bài toán, xác định 12 thực thể nghiệp vụ chuẩn hóa\\n"
         "• Chuẩn hóa dữ liệu đạt Dạng chuẩn 3 (3NF) chi tiết từng bước\\n"
         "• Triển khai CSDL trên Microsoft SQL Server\\n"
         "• Viết script tạo bảng, chỉ mục và Triggers chống Overbooking\\n"
         "• Xây dựng sơ đồ Database Diagram và Từ điển dữ liệu 12 bảng", "100%"],
        ["3", "Lê Văn An", "Frontend & UI/UX",
         "• Thiết kế giao diện theo phong cách Liquid Glass sang trọng\\n"
         "• Xây dựng trang chủ, danh sách tour, bộ lọc đa tiêu chí\\n"
         "• Phát triển trang chi tiết tour (Gallery + Day-by-Day)\\n"
         "• Thiết kế form đặt tour, tích hợp mã VietQR động chuẩn NAPAS247\\n"
         "• Phát triển Cổng quản trị Admin và các module tương tác người dùng", "100%"],
        ["4", "Lê Hải Đăng", "Kiểm thử hệ thống (QA/Test)",
         "• Xây dựng Kế hoạch kiểm thử tổng thể (Test Plan)\\n"
         "• Thiết kế và chạy bộ 58 Test Cases API tự động (100% PASS)\\n"
         "• Kiểm thử bảo mật (Auth, Role RBAC, CSRF)\\n"
         "• Kiểm thử tải đồng thời chống Overbooking tại CSDL (17 Test Cases)\\n"
         "• Xây dựng bảng Test Case tự động 6 cột và kiểm thử tự động", "100%"],
        ["5", "Nguyễn Văn Phúc", "Bảo mật & Quản trị Admin",
         "• Phân tích kiến trúc an ninh, chống SQL Injection, XSS, CSRF\\n"
         "• Thiết kế phân hệ Quản trị Admin, phân quyền người dùng (RBAC)\\n"
         "• Xây dựng cấu trúc bảng AUDITLOG lưu vết kiểm toán bất biến\\n"
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
'''

with open("scripts/chapter1_builder.py", "r", encoding="utf-8") as f:
    c1_full = f.read()

# Find where build_chapter_1(doc): begins
b1_idx = c1_full.find("def build_chapter_1(doc):")

# Header imports of chapter1_builder.py
imports_code = '''import os
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from scripts.doc_helpers import (
    add_title, add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_image_with_caption,
    create_styled_table, add_native_toc, NAVY_BLUE, STEEL_BLUE, BODY_COLOR
)

CLEAN_IMG_DIR = os.path.join(os.path.dirname(__file__), "clean_images")
'''

chapter1_body = c1_full[b1_idx:]

# In chapter1_body, remove the internal page break between 1.1 and 1.2
# Look for doc.add_page_break() before 1.2
pos_1_2 = chapter1_body.find('add_heading_2(doc, "1.2: Khảo sát : web')
# find doc.add_page_break() right before pos_1_2
pb_idx = chapter1_body.rfind("doc.add_page_break()", 0, pos_1_2)
if pb_idx != -1:
    chapter1_body = chapter1_body[:pb_idx] + chapter1_body[pb_idx + len("doc.add_page_break()"): ]

new_chapter1 = imports_code + "\n" + cover_and_preface_code + "\n" + chapter1_body

with open("scripts/chapter1_builder.py", "w", encoding="utf-8") as f:
    f.write(new_chapter1)

print("Updated chapter1_builder.py successfully with EXACT cover page and no redundant page breaks!")
