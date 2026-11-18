import plantuml
from PIL import Image

server = plantuml.PlantUML(url='http://www.plantuml.com/plantuml/img/')

puml_code = """@startuml mvc_class_diagram_delta_travel
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
    BackgroundColor #F8F9FA
    BorderColor #263238
    FontColor #0D47A1
    FontStyle bold
}

title SƠ ĐỒ LỚP CHI TIẾT THEO KIẾN TRÚC MVC 3 TẦNG HAI CHIỀU - DELTA TRAVEL

package "1. TẦNG HIỂN THỊ (VIEW LAYER - Client Interface)" #E8F5E9 {
    class HomeCatalogView {
        +renderTourList()
        +applyFilters()
        +showContactModal()
    }
    class TourDetailView {
        +renderTourDetail()
        +renderGallery()
        +renderItinerary()
        +renderSchedules()
    }
    class AuthModalView {
        +renderLoginForm()
        +renderRegisterForm()
        +renderForgotModal()
    }
    class BookingCheckoutView {
        +renderBookingForm()
        +collectPassengers()
        +submitBookingRequest()
    }
    class VietQRModalView {
        +renderDynamicQR()
        +uploadPaymentReceipt()
        +countdownTimer()
    }
    class MyBookingsView {
        +renderOrderHistory()
        +renderBookingDetail()
        +submitCancelRequest()
    }
    class AdminDashboardView {
        +renderOverviewStats()
        +renderTourManager()
        +renderOrderApprovalTable()
        +renderAuditLogViewer()
    }

    HomeCatalogView -[hidden]right- TourDetailView
    TourDetailView -[hidden]right- AuthModalView
    HomeCatalogView -[hidden]down- BookingCheckoutView
    BookingCheckoutView -[hidden]right- VietQRModalView
    VietQRModalView -[hidden]right- MyBookingsView
    MyBookingsView -[hidden]right- AdminDashboardView
}

package "2. TẦNG ĐIỀU KHIỂN (CONTROLLER LAYER - Application Orchestration)" #E3F2FD {
    class AccountController {
        +register(RegisterDTO): Response
        +login(LoginDTO): Response
        +getProfile(userId): Response
        +updateProfile(ProfileDTO): Response
        +forgotPassword(email): Response
    }
    class TourCatalogController {
        +getCategories(): Response
        +searchTours(FilterDTO): Response
        +getTourDetail(tourId): Response
        +getSchedules(tourId): Response
    }
    class BookingProcessController {
        +createBooking(BookingDTO): Response
        +getUserBookings(userId): Response
        +requestCancelTour(CancelDTO): Response
        +approveCancellation(id): Response
    }
    class PaymentCallbackController {
        +generateVietQR(bookingId): Response
        +uploadReceipt(ReceiptDTO): Response
        +reconcilePayment(ref): Response
        +confirmPayment(id): Response
    }
    class AdminManagementController {
        +saveTour(TourDTO): Response
        +saveSchedule(ScheduleDTO): Response
        +approveOrder(id): Response
        +getRevenueReport(): Response
        +queryAuditLogs(): Response
    }

    AccountController -[hidden]right- TourCatalogController
    AccountController -[hidden]down- BookingProcessController
    BookingProcessController -[hidden]right- PaymentCallbackController
    PaymentCallbackController -[hidden]right- AdminManagementController
}

package "3. TẦNG MÔ HÌNH (MODEL LAYER - 12 Bảng CSDL và Data Access)" #FFF3E0 {
    class TourDbContext {
        +DbSet<User> Users
        +DbSet<Tour> Tours
        +DbSet<Booking> Bookings
        +DbSet<Schedule> Schedules
        +DbSet<Payment> Payments
        +DbSet<AuditLog> AuditLogs
        +beginSerializableTx()
        +commitTx()
        +rollbackTx()
    }

    class NguoiDung {
        +int MaNguoiDung
        +string HoTen, Email, SoDienThoai
        +string MatKhauHash, VaiTro
        +bool verifyPassword(rawPwd)
        +void hashPassword(rawPwd)
    }

    class Tour {
        +int MaTour, MaDanhMuc
        +string TenTour, DiemKhoiHanh, DiemDen
        +decimal GiaCoBan
        +int SoNgay, SoDem
    }

    class ChuyenKhoiHanh {
        +int MaChuyen, MaTour
        +DateTime NgayKhoiHanh, NgayVe
        +decimal GiaNguoiLon, GiaTreEm
        +int SoChoToiDa, SoChoDaDat
        +bool checkAndLockSeats(qty)
        +void restoreSeats(qty)
    }

    class DatTour {
        +int MaDatTour, MaNguoiDung, MaChuyen
        +string MaBooking, TrangThai
        +DateTime NgayDat
        +int SoLuongKhach
        +decimal TongTien
        +void changeStatus(newStatus)
    }

    class ChiTietHanhKhach {
        +int MaHanhKhach, MaDatTour
        +string HoTen, LoaiKhach, SoGiayTo
        +DateTime NgaySinh
    }

    class ThanhToan {
        +int MaThanhToan, MaDatTour
        +string PhuongThuc, MaGiaoDich, TrangThai
        +decimal SoTienThanhToan
        +DateTime NgayThanhToan
        +string AnhMinhChung
    }

    class AuditLog {
        +int MaLog
        +string TenBang, HanhDong, NguoiThucHien
        +string DuLieuCu, DuLieuMoi
        +DateTime ThoiGian
    }

    TourDbContext -[hidden]right- NguoiDung
    NguoiDung -[hidden]right- Tour
    TourDbContext -[hidden]down- ChuyenKhoiHanh
    ChuyenKhoiHanh -[hidden]right- DatTour
    DatTour -[hidden]right- ChiTietHanhKhach
    ChuyenKhoiHanh -[hidden]down- ThanhToan
    ThanhToan -[hidden]right- AuditLog
}

' ========================================================
' KÊNH TƯƠNG TÁC 3 TẦNG (THỂ HIỆN RÕ 2 CHIỀU GIỮA CONTROLLER VÀ MODEL)
' ========================================================

' [1] View -> Controller
HomeCatalogView --> TourCatalogController : [1] HTTP GET / AJAX
TourDetailView --> TourCatalogController : [1] HTTP GET Detail
AuthModalView --> AccountController : [1] HTTP POST AuthDTO
BookingCheckoutView --> BookingProcessController : [1] HTTP POST BookingDTO
VietQRModalView --> PaymentCallbackController : [1] HTTP POST Upload Receipt
MyBookingsView --> BookingProcessController : [1] HTTP POST CancelDTO
AdminDashboardView --> AdminManagementController : [1] HTTP Admin Requests

' [2] Controller -> Model (CHIỀU THUẬN: Invocation & Commands)
AccountController --> NguoiDung : [2a] Query/Create/Verify
TourCatalogController --> Tour : [2a] LINQ Filter/Search
BookingProcessController --> TourDbContext : [2a] Open Serializable Tx
BookingProcessController --> ChuyenKhoiHanh : [2b] Lock & Deduct Seats
BookingProcessController --> DatTour : [2c] Insert Booking (BK...)
BookingProcessController --> ChiTietHanhKhach : [2d] Insert Passenger List
PaymentCallbackController --> ThanhToan : [2a] Save Payment & Evidence
AdminManagementController --> AuditLog : [2a] Write Audit Records

' [3] Model ..> Controller (CHIỀU QUAY NGƯỢC LẠI - CỐT LÕI)
NguoiDung ..[#B71C1C,dashed,thickness=2].> AccountController : [3a] Trả về UserEntity, AuthResult (Hash Match/Fail)
Tour ..[#B71C1C,dashed,thickness=2].> TourCatalogController : [3b] Trả về TourDetailDTO, Gallery, Lịch trình, Giá vé
ChuyenKhoiHanh ..[#B71C1C,dashed,thickness=2].> BookingProcessController : [3c] Trả về SeatLockResult (Success/Exhausted)\\nNém ngoại lệ SeatShortageException
DatTour ..[#B71C1C,dashed,thickness=2].> BookingProcessController : [3d] Trả về BookingState, Bắn sự kiện OnSeatsLockedEvent
ThanhToan ..[#B71C1C,dashed,thickness=2].> PaymentCallbackController : [3e] Trả về PaymentStatus, Bắn sự kiện OnPaymentVerifiedEvent
ChuyenKhoiHanh ..[#B71C1C,dashed,thickness=2].> BookingProcessController : [3f] Trả về RestoredSeatsCount, Bắn OnBookingCancelledEvent
TourDbContext ..[#B71C1C,dashed,thickness=2].> AdminManagementController : [3g] Trả về DbCommitStatus, AuditRecords

' [4] Controller ..> View
AccountController ..> AuthModalView : [4] Set-Cookie (JWT) / HTTP 200 UserDTO
TourCatalogController ..> TourDetailView : [4] HTTP 200 JSON TourDetail
BookingProcessController ..> BookingCheckoutView : [4] HTTP 201 JSON BookingConfirmation
PaymentCallbackController ..> VietQRModalView : [4] HTTP 200 PaymentSuccessDTO
BookingProcessController ..> MyBookingsView : [4] HTTP 200 OrderUpdatedDTO
AdminManagementController ..> AdminDashboardView : [4] HTTP 200 AdminDataDTO

' Model internal associations
Tour "1" *-- "0..*" ChuyenKhoiHanh : Lịch khởi hành
ChuyenKhoiHanh "1" *-- "0..*" DatTour : Đơn đặt chỗ
DatTour "1" *-- "1..*" ChiTietHanhKhach : Danh sách khách
DatTour "1" *-- "0..1" ThanhToan : Giao dịch VietQR
NguoiDung "1" *-- "0..*" DatTour : Lịch sử đặt
@enduml
"""

try:
    data = server.processes(puml_code)
    with open('scripts/clean_images/test_layout.png', 'wb') as f:
        f.write(data)
    im = Image.open('scripts/clean_images/test_layout.png')
    print(f"SUCCESS! Rendered dimensions: {im.size[0]} x {im.size[1]} px, size: {len(data)} bytes")
except Exception as e:
    print("Error:", e)
