import os
import plantuml
from PIL import Image

def fixed_init(self, response, content):
    self.response = response
    self.content = content
    self.message = f"HTTP {response.status}"
    super(plantuml.PlantUMLHTTPError, self).__init__(self.message)

plantuml.PlantUMLHTTPError.__init__ = fixed_init

PUML_CODE = """@startuml mvc_architecture
top to bottom direction
skinparam shadowing false
skinparam packageStyle rectangle
skinparam classAttributeIconSize 0
skinparam defaultFontName "Arial"
skinparam defaultFontSize 11
skinparam roundCorner 6

' Styling classes
skinparam class {
    BackgroundColor white
    ArrowColor #0D47A1
    BorderColor #1565C0
    HeaderBackgroundColor #E3F2FD
}

' Styling packages
skinparam package {
    BackgroundColor #FAFAFA
    BorderColor #37474F
    FontColor #0D47A1
    FontStyle bold
}

title SƠ ĐỒ KIẾN TRÚC PHÂN TẦNG KẾT HỢP MÔ HÌNH MVC CỦA HỆ THỐNG DELTA TRAVEL\\n(Frontend Client MVC - RESTful API Protocol - Backend FastAPI Layered MVC - SQL Server 12 Bảng 3NF)

' ============================================================================
' 1. FRONTEND TIER (CLIENT-SIDE MVC)
' ============================================================================
package "1. FRONTEND TIER (Client-Side MVC trên Trình duyệt Web)" as FrontendTier #E8F5E9 {

    package "TẦNG VIEW (Giao diện HTML5 & CSS3 Liquid Glass)" as ViewPkg #C8E6C9 {
        class "index.html\\n(Home & Catalog View)" as IndexView {
            +Banner 3D Hero tương tác
            +Thanh tìm kiếm & Dropdown lọc tour
            +Lưới danh sách thẻ tour du lịch
            +Modal xem chi tiết lịch trình & ảnh
            +Modal Đăng nhập / Đăng ký
        }
        class "booking.html\\n(Checkout View)" as BookingView {
            +Bảng tóm tắt tour đã chọn & giá vé
            +Form nhập số lượng khách & độ tuổi
            +Danh sách thông tin hành khách (CCCD/Passport)
            +Modal hiển thị mã VietQR động
            +Khu vực upload biên lai chuyển khoản
        }
        class "my-bookings.html\\n(My Bookings View)" as MyBookingsView {
            +Bảng danh sách đơn đặt của tôi
            +Xem chi tiết vé điện tử & mã booking
            +Modal gửi yêu cầu đổi / hủy tour
        }
        class "admin.html\\n(Admin Dashboard View)" as AdminView {
            +Bảng điều khiển KPI doanh thu theo tháng
            +Bảng quản lý Tour, Lịch trình & Gallery
            +Duyệt đơn đặt tour & Đối soát VietQR
            +Xem nhật ký kiểm toán hệ thống
        }

        IndexView -[hidden]right- BookingView
        BookingView -[hidden]right- MyBookingsView
        MyBookingsView -[hidden]right- AdminView
    }

    package "TẦNG CLIENT CONTROLLER (JavaScript Điều phối DOM & Bắt sự kiện)" as ClientCtrlPkg #E0F2F1 {
        class "main.js" as MainCtrl {
            +renderTours()
            +handleFilters()
            +openTourModal()
            +initBookingRedirect()
        }
        class "auth.js" as AuthCtrl {
            +handleLogin()
            +handleRegister()
            +handleLogout()
            +checkAuthState()
        }
        class "admin.js" as AdminCtrl {
            +loadAdminDashboard()
            +handleTourCRUD()
            +handleApproveBooking()
            +renderAuditLogs()
        }
        class "chatbot.js" as ChatbotCtrl {
            +toggleChat()
            +sendAssistantMessage()
            +renderBotReply()
        }

        MainCtrl -[hidden]right- AuthCtrl
        AuthCtrl -[hidden]right- AdminCtrl
        AdminCtrl -[hidden]right- ChatbotCtrl
    }

    package "TẦNG CLIENT SERVICE & MODEL (Dịch vụ mạng & Trạng thái Client)" as ClientServicePkg #DCEDC8 {
        class "api.js\\n(API Gateway Client)" as ApiService {
            +fetchWithAuth(endpoint, options)
            +getTours(), getTourDetail()
            +createBooking(), cancelBooking()
            +login(), register(), getCurrentUser()
        }
        class "vietqr-service.js" as VietQRService {
            +generateVietQRUrl(bank, acc, amount, memo)
            +verifyPaymentStatus(bookingId)
        }
        class "ticket-invoice-service.js" as TicketService {
            +generateEInvoice(bookingData)
            +exportTicketPdf(bookingId)
        }
        class "data.js & Storage\\n(Client State Model)" as ClientModel {
            +cachedTours: Array
            +currentUser: Object
            +sessionToken (Cookie / LocalStorage)
        }

        ApiService -[hidden]right- VietQRService
        VietQRService -[hidden]right- TicketService
        TicketService -[hidden]right- ClientModel
    }

    ' Luồng nội tại Frontend
    IndexView -down-> MainCtrl : [1] Thao tác người dùng (Lọc tour, Xem chi tiết)
    BookingView -down-> MainCtrl : [1] Submit Form đặt tour & Hành khách
    IndexView -down-> AuthCtrl : [1] Submit Form Đăng nhập / Đăng ký
    AdminView -down-> AdminCtrl : [1] Thao tác Quản trị (Duyệt đơn, Thêm tour)

    MainCtrl -down-> ApiService : [2] Gọi API (getTours, createBooking)
    AuthCtrl -down-> ApiService : [2] Gọi API (login, register)
    AdminCtrl -down-> ApiService : [2] Gọi API Admin
    BookingView -down-> VietQRService : [2] Sinh chuỗi mã QR thanh toán
    BookingView -down-> TicketService : [2] Yêu cầu xuất vé điện tử
    MainCtrl -right-> ClientModel : Đọc / Ghi trạng thái tạm thời

    MainCtrl .up[#C2185B,dashed,thickness=2].> IndexView : [12] Cập nhật DOM thẻ tour & Mở Modal
    MainCtrl .up[#C2185B,dashed,thickness=2].> BookingView : [12] Mở Modal VietQR & Hẹn giờ 15 phút
    AdminCtrl .up[#C2185B,dashed,thickness=2].> AdminView : [12] Render dữ liệu quản trị & Thống kê
}

' ============================================================================
' 2. GIAO THỨC TRUYỀN THÔNG (NETWORK / RESTful API)
' ============================================================================
interface "HTTP/HTTPS RESTful API Protocol\\n(JSON Payload, HTTP-Only Cookie, Authorization Header)" as ApiProtocol #B0BEC5

ApiService -down-> ApiProtocol : [3] Gửi HTTP Request (GET / POST / PUT / DELETE)
ApiProtocol .up[#C2185B,dashed,thickness=2].> ApiService : [11] Trả về HTTP Response (JSON DTOs, Cookie phiên)

' ============================================================================
' 3. BACKEND TIER (FASTAPI LAYERED MVC)
' ============================================================================
package "2. BACKEND TIER (FastAPI Server-Side Layered Architecture)" as BackendTier #E3F2FD {

    package "TẦNG API ROUTER (Khai báo Endpoints - api/routes/)" as RoutePkg #BBDEFB {
        class "routes/auth.py" as AuthRoute {
            +POST /api/v1/auth/register
            +POST /api/v1/auth/login
            +GET /api/v1/auth/me
            +POST /api/v1/auth/logout
        }
        class "routes/tours.py" as TourRoute {
            +GET /api/v1/tours
            +GET /api/v1/tours/{id}
            +GET /api/v1/tours/{id}/schedules
            +GET /api/v1/tours/{id}/itinerary
        }
        class "routes/bookings.py" as BookingRoute {
            +POST /api/v1/bookings
            +GET /api/v1/bookings/my
            +GET /api/v1/bookings/{id}
            +POST /api/v1/bookings/{id}/cancel
            +POST /api/v1/bookings/{id}/pay
        }
        class "routes/admin.py" as AdminRoute {
            +POST /api/v1/admin/tours
            +GET /api/v1/admin/bookings
            +PATCH /api/v1/admin/bookings/{id}
            +GET /api/v1/admin/reports
            +GET /api/v1/admin/audit-logs
        }

        AuthRoute -[hidden]right- TourRoute
        TourRoute -[hidden]right- BookingRoute
        BookingRoute -[hidden]right- AdminRoute
    }

    package "TẦNG CONTROLLER (Điều phối HTTP Boundary - api/controllers/)" as CtrlPkg #90CAF9 {
        class "auth_controller.py" as AuthCtrlPy {
            +register(Signup, db)
            +login(Login, db)
            +current(user, db)
            +logout(response)
            +change_profile()
        }
        class "tour_controller.py" as TourCtrlPy {
            +tours(search_filters, db)
            +tour_one(tour_id, db)
            +tour_itinerary(tour_id, db)
            +schedules(tour_id, db)
        }
        class "booking_controller.py" as BookingCtrlPy {
            +quote(QuoteInput, db)
            +create_booking(BookingInput, db)
            +my_bookings(user, db)
            +cancel_booking(id, db)
            +pay_booking(id, db)
        }
        class "admin_controller.py" as AdminCtrlPy {
            +admin_tour_create(dto, db)
            +admin_bookings(filters, db)
            +admin_patch_booking(id, dto, db)
            +admin_reports(db)
            +admin_audit_logs(db)
        }

        AuthCtrlPy -[hidden]right- TourCtrlPy
        TourCtrlPy -[hidden]right- BookingCtrlPy
        BookingCtrlPy -[hidden]right- AdminCtrlPy
    }

    package "TẦNG SERVICE (Logic Nghiệp vụ Lữ hành - api/services/)" as ServicePkg #FFF9C4 {
        class "auth_service.py" as AuthService {
            +credentials_match(user, pwd)
            +hash_password(pwd)
            +create_session_tokens()
        }
        class "tour_service.py" as TourService {
            +public_tour(tour_entity)
            +availability(schedule_entity)
            +itinerary_items(db, tour_id)
            +tour_images(image_value)
        }
        class "booking_service.py" as BookingService {
            +place_booking(db, user, body, idemp)
            +ensure_capacity(avail, requested)
            +totals(price, adults, children)
            +sweep(db) (Quét thu hồi chỗ hết hạn)
        }
        class "payment_service.py" as PaymentService {
            +payment_reference_used(db, ref)
            +verify_transaction_amount()
        }
        class "admin_service.py" as AdminService {
            +admin_booking_record(booking)
            +aggregate_monthly_revenue()
        }

        AuthService -[hidden]right- TourService
        TourService -[hidden]right- BookingService
        BookingService -[hidden]right- PaymentService
        PaymentService -[hidden]right- AdminService
    }

    package "TẦNG REPOSITORY (Truy xuất CSDL - api/repositories/)" as RepoPkg #FFE0B2 {
        class "user_repository.py" as UserRepo {
            +find_user_by_email(db, email)
            +find_user_by_identifier(db, ident)
            +user_conflict(db, email, phone)
        }
        class "tour_repository.py" as TourRepo {
            +search_public_tours(db, filters)
            +_schedule_conditions(filters)
        }
        class "schedule_repository.py" as ScheduleRepo {
            +lock_schedule(db, schedule_id)
            +schedule_with_tour(db, schedule_id)
        }
        class "booking_repository.py" as BookingRepo {
            +find_by_idempotency(db, user, key)
            +lock_booking_for_owner(db, id, user)
            +list_bookings_for_user(db, user)
            +get_booking(db, booking_id)
        }

        UserRepo -[hidden]right- TourRepo
        TourRepo -[hidden]right- ScheduleRepo
        ScheduleRepo -[hidden]right- BookingRepo
    }

    package "TẦNG MODEL & SCHEMA (Mô hình Thực thể & Hợp đồng Dữ liệu)" as ModelSchemaPkg #FFCCBC {
        class "SQLAlchemy ORM Entities (api/models/)" as OrmModels {
            +User (Tài khoản người dùng)
            +Tour (Sản phẩm tour)
            +TourSchedule (Đợt khởi hành)
            +Booking (Đơn đặt chỗ)
            +TourCostItem, ItineraryItem
            +AuditLog (Nhật ký kiểm toán)
            +Favorite (Tour yêu thích)
        }
        class "Pydantic Schemas / DTOs (api/schemas/)" as PydanticSchemas {
            +Signup, Login, UserOut, ProfileUpdate
            +TourSearch, TourOut, TourCreate
            +BookingInput, BookingOut, QuoteInput
            +AssistantMessage
        }

        OrmModels -[hidden]right- PydanticSchemas
    }

    ' Luồng nội tại Backend
    ApiProtocol -down-> TourRoute : [4] GET /api/v1/tours
    ApiProtocol -down-> BookingRoute : [4] POST /api/v1/bookings
    ApiProtocol -down-> AuthRoute : [4] POST /api/v1/auth/login
    ApiProtocol -down-> AdminRoute : [4] GET /api/v1/admin/reports

    AuthRoute -down-> AuthCtrlPy : Chuyển tiếp Request
    TourRoute -down-> TourCtrlPy : Chuyển tiếp Request
    BookingRoute -down-> BookingCtrlPy : Chuyển tiếp Request
    AdminRoute -down-> AdminCtrlPy : Chuyển tiếp Request

    AuthCtrlPy -down-> AuthService : [5] Gọi logic xác thực & băm mật khẩu
    TourCtrlPy -down-> TourService : [5] Gọi logic lọc & ghép ảnh/lịch trình
    BookingCtrlPy -down-> BookingService : [5] Gọi logic đặt tour & chống Overbooking
    BookingCtrlPy ..> PydanticSchemas : Xác thực BookingInput & Serialize BookingOut
    AdminCtrlPy -down-> AdminService : [5] Gọi logic báo cáo & thống kê

    AuthService -down-> UserRepo : [6] Tìm User / Kiểm tra trùng lặp
    TourService -down-> TourRepo : [6] Truy vấn Tour theo tiêu chí
    BookingService -down-> ScheduleRepo : [6] Khóa giữ chỗ đợt khởi hành
    BookingService -down-> BookingRepo : [6] Lưu đơn đặt chỗ & Hành khách

    UserRepo -down-> OrmModels : [7] Ánh xạ User Entity
    TourRepo -down-> OrmModels : [7] Ánh xạ Tour Entity
    BookingRepo -down-> OrmModels : [7] Ánh xạ Booking Entity

    ' CHIỀU QUAY NGƯỢC LẠI NỘI TẠI BACKEND
    OrmModels .up[#C2185B,dashed,thickness=2].> BookingRepo : Trả về Entity Objects / Query Results
    BookingRepo .up[#C2185B,dashed,thickness=2].> BookingService : Trả về BookingState / Số chỗ khả dụng
    BookingService .up[#C2185B,dashed,thickness=2].> BookingCtrlPy : [9] Trả về Booking DTO / Ném SeatShortageException (Hết chỗ)
    BookingCtrlPy .up[#C2185B,dashed,thickness=2].> BookingRoute : Đóng gói HTTP 201 Created / HTTP 409 Conflict
    BookingRoute .up[#C2185B,dashed,thickness=2].> ApiProtocol : [10] Stream JSON Response qua mạng
}

' ============================================================================
' 4. DATABASE TIER (MICROSOFT SQL SERVER - 12 BẢNG 3NF)
' ============================================================================
package "3. DATABASE TIER (Microsoft SQL Server - 12 Bảng Chuẩn 3NF)" as DatabaseTier #ECEFF1 {

    class "Microsoft SQL Server Database (12 Bảng 3NF)" as MssqlDb {
        +dbo.NGUOIDUNG (Tài khoản người dùng & Phân quyền)
        +dbo.DANHMUC (Danh mục vùng miền du lịch)
        +dbo.TOUR (Sản phẩm tour cốt lõi & Giá gốc)
        +dbo.HINHANH_TOUR (Bộ sưu tập gallery hình ảnh)
        +dbo.LICH_TRINH_DETAIL (Lộ trình chi tiết từng ngày)
        +dbo.CHUYENKHOIHANH (Đợt khởi hành & Kiểm soát chỗ)
        +dbo.DATTOUR (Đơn đặt chỗ, mã BK... & Trạng thái)
        +dbo.CHITIET_HANHKHACH (Danh sách hành khách thực tế)
        +dbo.THANHTOAN (Giao dịch VietQR & Minh chứng bill)
        +dbo.DANHGIA (Đánh giá nhận xét & Điểm sao)
        +dbo.BAIVIET_QUANGBA (Bài viết cẩm nang quảng bá)
        +dbo.AUDITLOG (Nhật ký kiểm toán hệ thống bất biến)
    }

    class "Ràng buộc, Triggers & Stored Procedures Thực tế" as DbTriggers {
        +TRG_DATTOUR_CheckAndLockSeats (Khóa chỗ & Chống Overbooking)
        +TRG_DATTOUR_HandleCancellation (Hoàn trả số chỗ khi hủy đơn)
        +TRG_DANHGIA_CheckCompletedTour (Kiểm tra điều kiện đánh giá)
        +sp_TaoDonDatTour (Tạo đơn đặt tour an toàn)
        +sp_XacNhanThanhToanDonTour (Xác nhận thanh toán đơn)
        +sp_HuyDonDatTour (Hủy đơn & Hoàn trả chỗ trống)
        +sp_ThongKeDoanhThuVaDonHang (Thống kê báo cáo doanh thu)
    }

    MssqlDb -[hidden]right- DbTriggers

    OrmModels -down-> MssqlDb : [8] Thực thi T-SQL / LINQ Query (PyODBC / SQLAlchemy)
    MssqlDb -right-> DbTriggers : Tự động kích hoạt Trigger khóa chỗ & Kiểm tra ràng buộc
    MssqlDb .up[#C2185B,dashed,thickness=2].> OrmModels : [8b] Trả về Raw Data Rows / Trigger Execution Status / Rollback
}

@enduml
"""

def generate():
    out_puml = "mvc_architecture.puml"
    out_png = "mvc_architecture.png"
    clean_png = "scripts/clean_images/hinh_2_17_class_mvc.png"
    downloads_png = r"C:\Users\ACER\Downloads\mvc_architecture.png"
    downloads_puml = r"C:\Users\ACER\Downloads\mvc_architecture.puml"

    with open(out_puml, "w", encoding="utf-8") as f:
        f.write(PUML_CODE)
    with open(downloads_puml, "w", encoding="utf-8") as f:
        f.write(PUML_CODE)
    print("Saved PUML to:", out_puml)

    print("Rendering diagram via official PlantUML client...")
    server = plantuml.PlantUML(url='http://www.plantuml.com/plantuml/img/')
    png_data = server.processes(PUML_CODE)

    with open(out_png, "wb") as f:
        f.write(png_data)
    with open(clean_png, "wb") as f:
        f.write(png_data)
    try:
        with open(downloads_png, "wb") as f:
            f.write(png_data)
    except Exception as e:
        print("Note on downloads png:", e)

    im = Image.open(out_png)
    print(f"Generated {out_png} successfully: {im.size[0]} x {im.size[1]} px, Size: {len(png_data)} bytes")

if __name__ == "__main__":
    generate()
