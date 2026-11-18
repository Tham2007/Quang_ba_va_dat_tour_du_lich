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

skinparam class {
    BackgroundColor white
    ArrowColor #0D47A1
    BorderColor #1565C0
    HeaderBackgroundColor #E3F2FD
}

skinparam package {
    BackgroundColor #FAFAFA
    BorderColor #37474F
    FontColor #0D47A1
    FontStyle bold
}

title SƠ ĐỒ KIẾN TRÚC PHÂN TẦNG MVC THỰC TẾ HỆ THỐNG DELTA TRAVEL\\n(Frontend JS Client MVC - Backend FastAPI Layered MVC - SQL Server 12 Bảng 3NF)

' ============================================================================
' 1. FRONTEND TẦNG CLIENT (TRÌNH DUYỆT WEB)
' ============================================================================
package "1. FRONTEND TIER (Client-Side MVC trên Trình duyệt Web)" #E8F5E9 {
    
    package "VIEW (Giao diện HTML5 & CSS3 Liquid Glass)" #C8E6C9 {
        class "index.html (Home & Catalog View)" as IndexView {
            +Trang chủ & Banner 3D Hero
            +Bộ lọc tìm kiếm tour đa tiêu chí
            +Lưới danh sách thẻ tour du lịch
            +Modal xem chi tiết lịch trình & ảnh
            +Modal Đăng nhập / Đăng ký
        }
        class "booking.html (Checkout View)" as BookingView {
            +Bảng tóm tắt tour đã chọn
            +Form nhập số lượng khách & độ tuổi
            +Danh sách thông tin hành khách (CCCD/Passport)
            +Modal hiển thị mã VietQR động
            +Khu vực upload biên lai chuyển khoản
        }
        class "my-bookings.html (My Bookings View)" as MyBookingsView {
            +Bảng danh sách đơn đặt của tôi
            +Xem chi tiết vé điện tử & trạng thái
            +Modal gửi yêu cầu đổi / hủy tour
        }
        class "admin.html (Admin Dashboard View)" as AdminView {
            +Bảng điều khiển KPI & Doanh thu
            +Quản lý Tour, Lịch trình & Gallery
            +Duyệt đơn đặt tour & Đối soát VietQR
            +Xem nhật ký kiểm toán hệ thống
        }

        IndexView -[hidden]right- BookingView
        BookingView -[hidden]right- MyBookingsView
        MyBookingsView -[hidden]right- AdminView
    }

    package "CLIENT CONTROLLER (JavaScript Điều phối UI & Bắt sự kiện DOM)" #E0F2F1 {
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

    package "CLIENT SERVICE & MODEL (Dịch vụ mạng & Trạng thái phía Client)" #DCEDC8 {
        class "api.js (API Gateway Client)" as ApiService {
            +fetchWithAuth(endpoint, options)
            +getTours(), getTourDetail()
            +createBooking(), cancelBooking()
            +login(), register(), getCurrentUser()
        }
        class "vietqr-service.js" as VietQRService {
            +generateVietQRUrl(bank, acc, amount, memo)
            +verifyPaymentStatus(bookingId)
        }
        class "data.js & Storage (Client State)" as ClientModel {
            +cachedTours: Array
            +currentUser: Object
            +sessionToken (Cookie / LocalStorage)
        }

        ApiService -[hidden]right- VietQRService
        VietQRService -[hidden]right- ClientModel
    }

    IndexView -down-> MainCtrl : [1] Bắt sự kiện DOM (Lọc tour, Xem chi tiết)
    BookingView -down-> MainCtrl : [1] Submit Form đặt tour & Khách
    IndexView -down-> AuthCtrl : [1] Submit Form Đăng nhập/Đăng ký
    AdminView -down-> AdminCtrl : [1] Thao tác Quản trị (Duyệt đơn, Thêm tour)
    
    MainCtrl -down-> ApiService : [2] Gọi hàm API (getTours, createBooking)
    AuthCtrl -down-> ApiService : [2] Gọi hàm API (login, register)
    AdminCtrl -down-> ApiService : [2] Gọi hàm API Admin
    BookingView -down-> VietQRService : [2] Sinh chuỗi mã QR thanh toán

    MainCtrl .up.> IndexView : [7] Cập nhật DOM thẻ tour & Mở Modal
    MainCtrl .up.> BookingView : [7] Mở Modal VietQR & Hẹn giờ 15 phút
    AdminCtrl .up.> AdminView : [7] Render dữ liệu quản trị & Thống kê
}

' ============================================================================
' 2. GIAO THỨC TRUYỀN THÔNG (NETWORK / RESTful API)
' ============================================================================
interface "HTTP/HTTPS RESTful API\\n(JSON Payload, HTTP-Only Cookie, Authorization Header)" as ApiProtocol #B0BEC5

ApiService -down-> ApiProtocol : [3] Gửi HTTP Request bất đồng bộ (Fetch API)
ApiProtocol .up.> ApiService : [6] Trả về HTTP Response (JSON DTOs, Cookie phiên)

' ============================================================================
' 3. BACKEND TẦNG MÁY CHỦ (FASTAPI LAYERED MVC ARCHITECTURE)
' ============================================================================
package "2. BACKEND TIER (FastAPI Server-Side Layered MVC)" #E3F2FD {

    package "ROUTE LAYER (Khai báo Endpoints - api/routes/)" #BBDEFB {
        class "routes/auth.py" as AuthRoute {
            +POST /api/v1/auth/register
            +POST /api/v1/auth/login
            +GET /api/v1/auth/me
        }
        class "routes/tours.py" as TourRoute {
            +GET /api/v1/tours
            +GET /api/v1/tours/{id}
            +GET /api/v1/tours/{id}/schedules
        }
        class "routes/bookings.py" as BookingRoute {
            +POST /api/v1/bookings
            +GET /api/v1/bookings/my
            +POST /api/v1/bookings/{id}/cancel
        }
        class "routes/admin.py" as AdminRoute {
            +POST /api/v1/admin/tours
            +GET /api/v1/admin/bookings
            +GET /api/v1/admin/reports
        }

        AuthRoute -[hidden]right- TourRoute
        TourRoute -[hidden]right- BookingRoute
        BookingRoute -[hidden]right- AdminRoute
    }

    package "CONTROLLER LAYER (Điều phối HTTP - api/controllers/)" #90CAF9 {
        class "auth_controller.py" as AuthCtrlPy {
            +register(Signup, db)
            +login(Login, db)
            +current(user, db)
            +logout(response)
        }
        class "tour_controller.py" as TourCtrlPy {
            +tours(search_filters, db)
            +tour_one(tour_id, db)
            +schedules(tour_id, db)
        }
        class "booking_controller.py" as BookingCtrlPy {
            +create_booking(BookingInput, db)
            +my_bookings(user, db)
            +cancel_booking(booking_id, db)
            +pay_booking(booking_id, db)
        }
        class "admin_controller.py" as AdminCtrlPy {
            +admin_tour_create(dto, db)
            +admin_bookings(filters, db)
            +admin_reports(db)
            +admin_audit_logs(db)
        }

        AuthCtrlPy -[hidden]right- TourCtrlPy
        TourCtrlPy -[hidden]right- BookingCtrlPy
        BookingCtrlPy -[hidden]right- AdminCtrlPy
    }

    package "SERVICE LAYER (Logic nghiệp vụ - api/services/)" #FFF9C4 {
        class "auth_service.py" as AuthService {
            +credentials_match(user, pwd)
            +hash_password(pwd)
            +create_session_tokens()
        }
        class "tour_service.py" as TourService {
            +public_tour(t)
            +availability(schedule)
            +itinerary_items(db, tour_id)
        }
        class "booking_service.py" as BookingService {
            +place_booking(db, user, body)
            +ensure_capacity(avail, requested)
            +totals(price, adults, children)
            +sweep(db) (Thu hồi chỗ hết hạn)
        }
        class "payment_service.py" as PaymentService {
            +payment_reference_used(db, ref)
            +verify_transaction_amount()
        }

        AuthService -[hidden]right- TourService
        TourService -[hidden]right- BookingService
        BookingService -[hidden]right- PaymentService
    }

    package "REPOSITORY LAYER (Truy xuất CSDL - api/repositories/)" #FFE0B2 {
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
        }

        UserRepo -[hidden]right- TourRepo
        TourRepo -[hidden]right- ScheduleRepo
        ScheduleRepo -[hidden]right- BookingRepo
    }

    package "MODEL & SCHEMA (Mô hình thực thể & Hợp đồng dữ liệu)" #FFCCBC {
        class "ORM Entities (api/models/)" as OrmModels {
            +User (Tài khoản người dùng)
            +Tour (Sản phẩm tour)
            +TourSchedule (Đợt khởi hành)
            +Booking (Đơn đặt chỗ)
            +ItineraryItem, TourCostItem
            +AuditLog (Nhật ký kiểm toán)
        }
        class "Pydantic Schemas (api/schemas/)" as PydanticSchemas {
            +Signup, Login, UserOut
            +TourSearch, TourOut
            +BookingInput, BookingOut
            +QuoteInput, QuoteResponse
        }

        OrmModels -[hidden]right- PydanticSchemas
    }

    ApiProtocol -down-> TourRoute : [4] GET /api/v1/tours
    ApiProtocol -down-> BookingRoute : [4] POST /api/v1/bookings
    ApiProtocol -down-> AuthRoute : [4] POST /api/v1/auth/login
    ApiProtocol -down-> AdminRoute : [4] GET /api/v1/admin/reports

    AuthRoute -down-> AuthCtrlPy : Chuyển tiếp Request
    TourRoute -down-> TourCtrlPy : Chuyển tiếp Request
    BookingRoute -down-> BookingCtrlPy : Chuyển tiếp Request
    AdminRoute -down-> AdminCtrlPy : Chuyển tiếp Request

    AuthCtrlPy -down-> AuthService : Gọi xử lý đăng nhập / băm mật khẩu
    TourCtrlPy -down-> TourService : Gọi xử lý lọc & ghép ảnh/lịch trình
    BookingCtrlPy -down-> BookingService : Gọi xử lý đặt tour & chống Overbooking
    BookingCtrlPy ..> PydanticSchemas : Xác thực BookingInput & Serialize BookingOut

    AuthService -down-> UserRepo : Truy vấn User / Kiểm tra trùng
    TourService -down-> TourRepo : Lọc Tour theo điều kiện
    BookingService -down-> ScheduleRepo : Khóa giữ chỗ đợt khởi hành
    BookingService -down-> BookingRepo : Lưu đơn đặt chỗ & Hành khách

    UserRepo -down-> OrmModels : Ánh xạ User Entity
    TourRepo -down-> OrmModels : Ánh xạ Tour Entity
    BookingRepo -down-> OrmModels : Ánh xạ Booking Entity

    ' ========================================================
    ' CHIỀU QUAY NGƯỢC LẠI NỘI TẠI TẦNG BACKEND (REVERSE FEEDBACK)
    ' ========================================================
    OrmModels .up[#B71C1C,dashed,thickness=2].> BookingRepo : Trả về Entity Objects / Query Results
    BookingRepo .up[#B71C1C,dashed,thickness=2].> BookingService : Trả về BookingState / Số chỗ khả dụng
    BookingService .up[#B71C1C,dashed,thickness=2].> BookingCtrlPy : Trả về Booking DTO / Ném SeatShortageException (Hết chỗ)
    BookingCtrlPy .up[#B71C1C,dashed,thickness=2].> BookingRoute : Trả về HTTP 201 Created / HTTP 409 Conflict
    BookingRoute .up[#B71C1C,dashed,thickness=2].> ApiProtocol : [5] Stream JSON Response qua mạng
}

' ============================================================================
' 4. CƠ SỞ DỮ LIỆU MICROSOFT SQL SERVER (12 BẢNG 3NF)
' ============================================================================
package "3. DATABASE TIER (MICROSOFT SQL SERVER - 12 BẢNG CHUẨN 3NF)" #ECEFF1 {
    class "SQL Server Database (12 Bảng CSDL)" as MssqlDb {
        +NGUOIDUNG (Tài khoản & Phân quyền)
        +DANHMUC (Vùng miền du lịch)
        +TOUR (Sản phẩm tour cốt lõi)
        +HINHANH_TOUR (Bộ sưu tập gallery ảnh)
        +LICH_TRINH_DETAIL (Lộ trình chi tiết theo ngày)
        +CHUYENKHOIHANH (Đợt khởi hành & Số chỗ)
        +DATTOUR (Đơn đặt chỗ & Trạng thái)
        +CHITIET_HANHKHACH (Danh sách hành khách)
        +THANHTOAN (Giao dịch VietQR & Minh chứng)
        +DANHGIA (Nhận xét & Chấm điểm sao)
        +BAIVIET_QUANGBA (Cẩm nang du lịch)
        +AUDITLOG (Nhật ký kiểm toán hệ thống)
    }

    class "Ràng buộc & Trigger nghiệp vụ" as DbTriggers #FFCDD2 {
        +TRG_DATTOUR_CheckAndLockSeats (Khóa chỗ & Chống Overbooking)
        +FK Constraints & CHECK Constraints (Bảo vệ toàn vẹn 3NF)
        +Stored Procedures (sp_CreateBooking, sp_CancelBooking)
    }

    OrmModels -down-> MssqlDb : Thực thi T-SQL / LINQ Query (PyODBC / SQLAlchemy)
    MssqlDb -right-> DbTriggers : Tự động kích hoạt Trigger khóa chỗ & Kiểm tra ràng buộc
    MssqlDb .up[#B71C1C,dashed,thickness=2].> OrmModels : Trả về Raw Data Rows / Trigger Execution Status / Exception
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

    print("Rendering diagram via plantuml python library...")
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
