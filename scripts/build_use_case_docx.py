import os
import sys
import docx
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

# Add root directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from scripts.doc_helpers import (
    add_title, add_heading_1, add_heading_2, add_heading_3,
    add_body_p, add_bullet_p, add_image_with_caption,
    add_code_block, create_styled_table,
    set_cell_background, set_cell_margins,
    NAVY_BLUE, STEEL_BLUE, DARK_GRAY, BODY_COLOR
)

CLEAN_IMG_DIR = os.path.join(os.path.dirname(__file__), "clean_images")

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
            r.font.size = Pt(9)
            r.font.bold = True
            r.font.color.rgb = NAVY_BLUE

        # Style value cell
        cell_val.text = val
        set_cell_background(cell_val, "FFFFFF")
        set_cell_margins(cell_val, top=80, bottom=80, left=120, right=120)
        p_v = cell_val.paragraphs[0]
        p_v.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p_v.paragraph_format.space_before = Pt(0)
        p_v.paragraph_format.space_after = Pt(0)
        p_v.paragraph_format.line_spacing = 1.1
        for r in p_v.runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9)
            r.font.color.rgb = BODY_COLOR

        cell_lbl.width = Inches(col_widths[0])
        cell_val.width = Inches(col_widths[1])

    p_post = doc.add_paragraph()
    p_post.paragraph_format.space_before = Pt(0)
    p_post.paragraph_format.space_after = Pt(4)

def build_use_case_document():
    print("=" * 60)
    print("  BẮT ĐẦU XÂY DỰNG TÀI LIỆU MÔ HÌNH VÀ ĐẶC TẢ USE CASE HOÀN CHỈNH")
    print("=" * 60)

    doc = docx.Document()

    # Cấu hình lề trang chuẩn A4 (Top 2cm, Bottom 2cm, Left 3cm, Right 2cm)
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
    r1 = p_title.add_run("TÀI LIỆU MÔ HÌNH HÓA VÀ ĐẶC TẢ USE CASE HOÀN CHỈNH\n")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(18)
    r1.font.bold = True
    r1.font.color.rgb = NAVY_BLUE

    r2 = p_title.add_run("HỆ THỐNG WEBSITE QUẢNG BÁ VÀ ĐẶT TOUR DU LỊCH TRỰC TUYẾN (DELTA TRAVEL)")
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(14)
    r2.font.bold = True
    r2.font.color.rgb = STEEL_BLUE

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(4)
    p_sub.paragraph_format.space_after = Pt(16)
    r3 = p_sub.add_run("Chuẩn thiết kế: OMG UML 2.5 | Cấu trúc: 1 Sơ đồ Use Case hợp nhất hoàn chỉnh (Hình 1) + 23 Bảng đặc tả chi tiết\nPhiên bản hoàn thiện: Tháng 11/2026")
    r3.font.name = "Times New Roman"
    r3.font.size = Pt(10)
    r3.font.italic = True
    r3.font.color.rgb = DARK_GRAY

    # MỤC 1: TỔNG QUAN HỆ THỐNG VÀ DANH SÁCH TÁC NHÂN
    add_heading_1(doc, "1. TỔNG QUAN HỆ THỐNG VÀ DANH SÁCH TÁC NHÂN (ACTORS)")
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

    doc.add_page_break()

    # MỤC 2: SƠ ĐỒ UML USE CASE HOÀN CHỈNH
    add_heading_1(doc, "2. SƠ ĐỒ UML USE CASE HOÀN CHỈNH CỦA HỆ THỐNG DELTA TRAVEL")
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

    doc.add_page_break()

    # MỤC 3: MA TRẬN PHÂN QUYỀN VÀ PHÂN TÍCH QUAN HỆ UML
    add_heading_1(doc, "3. MA TRẬN PHÂN QUYỀN VÀ TỔNG HỢP CÁC QUAN HỆ UML")
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

    doc.add_page_break()

    # MỤC 4: ĐẶC TẢ CHI TIẾT TOÀN BỘ 23 USE CASE
    add_heading_1(doc, "4. ĐẶC TẢ CHI TIẾT TOÀN BỘ 23 USE CASE")
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

    doc.add_page_break()

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

    doc.add_page_break()

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

    doc.add_page_break()

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

    doc.add_page_break()

    # MỤC 5: PHỤ LỤC MÃ NGUỒN PLANTUML
    add_heading_1(doc, "5. PHỤ LỤC MÃ NGUỒN PLANTUML (.PUML) CHO SƠ ĐỒ HOÀN CHỈNH")
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
    target_ws = os.path.abspath("MO_HINH_VA_DAC_TA_USE_CASE_DELTA_TRAVEL.docx")
    target_dl = r"C:\Users\ACER\Downloads\MO_HINH_VA_DAC_TA_USE_CASE_DELTA_TRAVEL.docx"

    print(f"Đang lưu file vào Workspace: {target_ws}...")
    doc.save(target_ws)

    print(f"Đang lưu file vào Downloads: {target_dl}...")
    doc.save(target_dl)

    # Lưu mã PUML ra file để tiện tra cứu
    puml_file_ws = os.path.abspath("scripts/use_case_delta_travel_hoan_chinh.puml")
    with open(puml_file_ws, "w", encoding="utf-8") as f:
        f.write(puml_source)
    print(f"Đã lưu file PlantUML: {puml_file_ws}")

    print("=" * 60)
    print("  HOÀN TẤT CẬP NHẬT TÀI LIỆU USE CASE THÀNH CÔNG RỰC RỠ!")
    print(f"  - Tổng số đoạn văn: {len(doc.paragraphs)}")
    print(f"  - Tổng số bảng biểu: {len(doc.tables)} (Bao gồm Bảng 1, Bảng 2, Bảng 3 và 23 Bảng đặc tả Use Case)")
    print(f"  - Dung lượng file: {os.path.getsize(target_ws) / 1024:.1f} KB")
    print("=" * 60)

if __name__ == "__main__":
    build_use_case_document()
