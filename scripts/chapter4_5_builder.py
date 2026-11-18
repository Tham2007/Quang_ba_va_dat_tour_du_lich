import os
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from scripts.doc_helpers import (
    add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_image_with_caption,
    create_styled_table, NAVY_BLUE, STEEL_BLUE, BODY_COLOR
)

CLEAN_IMG_DIR = os.path.join(os.path.dirname(__file__), "clean_images")

def build_chapters_4_and_5(doc):
    # CHƯƠNG 4 THEO ĐÚNG TÊN FILE HƯỚNG DẪN
    add_heading_1(doc, "CHƯƠNG 4: KẾT QUẢ VÀ HƯỚNG PHÁT TRIỂN")

    # 4.1 KẾT QUẢ: CHỤP RA
    add_heading_2(doc, "4.1: Kết quả : chụp ra")
    add_body_p(
        doc,
        "Trải qua quá trình nghiên cứu, khảo sát thực tế và triển khai bài bản, nhóm 3 đã hoàn thành xuất sắc "
        "toàn bộ các mục tiêu đặt ra cho đề tài 'Hệ thống Website Quảng bá và Đặt tour Du lịch Trực tuyến (Delta Travel)'. "
        "Hệ thống vận hành trơn tru, ổn định và mang lại giá trị thực tiễn cao:",
        bold_prefix="Đánh giá tổng quan kết quả dự án: "
    )

    achievements = [
        ("Về Cơ sở dữ liệu: ", "Thiết kế hoàn chỉnh mô hình CSDL 12 bảng đạt Dạng chuẩn 3 (3NF) trên nền tảng Microsoft SQL Server. "
         "Thiết lập thành công 11 khóa ngoại FK, 14 ràng buộc CHECK bảo vệ dữ liệu, các Trigger kiểm soát giữ chỗ và hoàn chỗ tự động "
         "ngăn chặn triệt để hiện tượng Overbooking, cùng bảng AUDITLOG lưu vết kiểm toán bất biến."),
        
        ("Về Phân tích và Thiết kế hệ thống: ", "Xây dựng hoàn chỉnh Sơ đồ UML Use Case tổng quát hợp nhất (Hình 1: 23 Use Cases của 3 Tác nhân: Khách viếng thăm, Khách hàng, Quản trị viên), "
         "7 Biểu đồ hoạt động (Activity Diagrams) chi tiết theo luồng nghiệp vụ thực tế, và Biểu đồ kiến trúc phân tầng MVC hai chiều (Client - Backend - Database)."),
        
        ("Về Backend và Kiến trúc: ", "Xây dựng hệ thống Backend chuyên nghiệp bằng ASP.NET Core MVC kết hợp Entity Framework Core, "
         "quản lý giao dịch ACID ở mức cô lập cao nhất (Serializable Concurrency Control), đảm bảo tính toàn vẹn dữ liệu khi có nhiều người cùng truy cập."),
        
        ("Về Frontend và Trải nghiệm người dùng: ", "Hiện thực hóa giao diện hiện đại theo phong cách Liquid Glass sang trọng, "
         "tương thích hoàn hảo trên mọi kích thước màn hình (Responsive Design), tích hợp module thanh toán VietQR động chuẩn NAPAS247."),
        
        ("Về Kiểm thử và Đảm bảo chất lượng: ", "Đạt tỷ lệ thành công tuyệt đối 100% PASS trên toàn bộ 58 kịch bản kiểm thử API "
         "và 17 kịch bản kiểm thử toàn vẹn CSDL, chứng minh hệ thống có độ tin cậy và khả năng chống lỗi vững chắc.")
    ]
    for title, desc in achievements:
        add_bullet_p(doc, desc, bold_prefix=title)

    add_body_p(
        doc,
        "Dưới đây là một số hình ảnh chụp thực tế các màn hình chức năng chính của hệ thống Delta Travel đang vận hành:",
        bold_prefix="Hình ảnh giao diện các phân hệ chính: "
    )

    # Chèn 3 ảnh chụp thực tế
    img_my_bookings = os.path.join(CLEAN_IMG_DIR, "hinh_4_1_ui_my_bookings.png")
    add_image_with_caption(doc, img_my_bookings, "Hình 4.1: Giao diện Tra cứu và Quản lý đơn đặt tour của tôi (My Bookings)", width_inches=6.0)

    img_admin = os.path.join(CLEAN_IMG_DIR, "hinh_4_2_ui_admin_dashboard.png")
    add_image_with_caption(doc, img_admin, "Hình 4.2: Giao diện Quản trị viên Admin Dashboard (Quản lý tour, lịch khởi hành và duyệt đơn)", width_inches=6.0)

    img_qr = os.path.join(CLEAN_IMG_DIR, "hinh_4_3_vietqr_payment.png")
    add_image_with_caption(doc, img_qr, "Hình 4.3: Module Thanh toán thông minh qua mã VietQR động chuẩn NAPAS247 (Tự động điền số tài khoản, số tiền và mã booking)", width_inches=3.5)

    # 4.2 HƯỚNG PHÁT TRIỂN
    add_heading_2(doc, "4.2: Hướng phát triển")
    add_body_p(
        doc,
        "Để nâng tầm hệ thống từ phiên bản học thuật thành một nền tảng thương mại điện tử du lịch quy mô lớn, "
        "nhóm định hướng các hướng phát triển nâng cấp tiếp theo trong các giai đoạn tương lai:",
        bold_prefix="Các hướng mở rộng tiềm năng: "
    )

    future_plans = [
        ("1. Tự động hóa cổng thanh toán qua Webhook IPN: ",
         "Đăng ký kết nối chính thức với các cổng thanh toán trực tuyến uy tín tại Việt Nam (VNPAY IPN, MoMo Business, ZaloPay). "
         "Khi khách hàng quét mã VietQR và tiền về tài khoản ngân hàng, hệ thống cổng thanh toán sẽ tự động gửi Webhook callback "
         "để máy chủ cập nhật trạng thái đơn sang 'Đã thanh toán' ngay lập tức mà không cần nhân viên kế toán đối soát thủ công."),
        
        ("2. Nâng cấp Trợ lý Du lịch AI thông minh (AI Tour Assistant): ",
         "Ứng dụng mô hình ngôn ngữ lớn (Large Language Models) kết hợp kỹ thuật RAG (Retrieval-Augmented Generation) để xây dựng chatbot AI "
         "có khả năng tư vấn lịch trình cá nhân hóa dựa trên sở thích, ngân sách và thời tiết thực tế tại điểm đến của từng gia đình."),
        
        ("3. Phát triển ứng dụng di động Mobile App đa nền tảng: ",
         "Xây dựng ứng dụng di động cho cả hai hệ điều hành iOS và Android bằng công nghệ Flutter hoặc React Native. "
         "Hỗ trợ tính năng thông báo đẩy (Push Notification) nhắc nhở giờ khởi hành, tra cứu vé điện tử offline và định vị GPS xe đưa đón theo thời gian thực."),
        
        ("4. Mở rộng Hệ sinh thái Doanh nghiệp lữ hành (B2B Agent Portal): ",
         "Xây dựng phân hệ cổng thông tin đại lý (B2B Portal) cho phép các cộng tác viên, đại lý du lịch cấp 2 phân phối vé tour, "
         "áp dụng cơ chế tính toán chiết khấu hoa hồng tự động và phân hệ quản lý phân công hướng dẫn viên du lịch theo từng chuyến đi.")
    ]
    for title, desc in future_plans:
        add_bullet_p(doc, desc, bold_prefix=title)

    doc.add_page_break()

    # CHƯƠNG 5 THEO ĐÚNG TÊN FILE HƯỚNG DẪN
    add_heading_1(doc, "CHƯƠNG 5: TÀI LIỆU THAM KHẢO")
    add_body_p(doc, "Danh mục các tài liệu học thuật, giáo trình chuyên ngành và tiêu chuẩn kỹ thuật được tham khảo trong quá trình thực hiện đề tài:")

    refs = [
        ["[1]", "Object Management Group (OMG), 'Unified Modeling Language (UML) Specification Version 2.5.1', OMG Standard Document, 2017."],
        ["[2]", "C.J. Date, 'An Introduction to Database Systems', 8th Edition, Addison-Wesley, 2003 (Chương về Chuẩn hóa CSDL và Dạng chuẩn 3NF)."],
        ["[3]", "Ramez Elmasri, Shamkant B. Navathe, 'Fundamentals of Database Systems', 7th Edition, Pearson, 2015."],
        ["[4]", "Microsoft Learn, 'ASP.NET Core MVC Overview and Entity Framework Core Documentation', Microsoft Corporation, 2024."],
        ["[5]", "Microsoft Learn, 'Transaction Locking and Row Versioning Guide in SQL Server', Microsoft Documentation, 2024."],
        ["[6]", "Công ty Cổ phần Thanh toán Quốc gia Việt Nam (NAPAS), 'Tiêu chuẩn kỹ thuật định dạng mã QR thanh toán quốc gia VietQR', 2021."],
        ["[7]", "Công ty Cổ phần Du lịch và Tiếp thị Giao thông Vận tải Việt Nam (Vietravel), 'Hệ thống đặt tour du lịch trực tuyến travel.com.vn', Khảo sát thực tế tháng 9 - 11/2026."],
        ["[8]", "Martin Fowler, 'Patterns of Enterprise Application Architecture', Addison-Wesley Professional, 2002."],
        ["[9]", "RFC 7519, 'JSON Web Token (JWT)', Internet Engineering Task Force (IETF), 2015."],
        ["[10]", "Open Web Application Security Project (OWASP), 'Top 10 Web Application Security Risks', OWASP Foundation, 2021."]
    ]
    create_styled_table(doc, ["STT", "Tên tài liệu, Tác giả và Nguồn xuất bản"], refs, [0.8, 5.6], "Bảng 5.1: Danh mục các tài liệu và tiêu chuẩn kỹ thuật tham khảo")
