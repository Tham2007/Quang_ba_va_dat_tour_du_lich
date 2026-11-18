import os
import zlib
import urllib.request
from PIL import Image

def puml_url(code):
    z = zlib.compress(code.encode('utf-8'))[2:-4]
    b = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'
    r = ''
    for i in range(0, len(z), 3):
        b1 = z[i]
        b2 = z[i+1] if i+1 < len(z) else 0
        b3 = z[i+2] if i+2 < len(z) else 0
        r += b[b1 >> 2] + b[((b1 & 3) << 4) | (b2 >> 4)] + b[((b2 & 15) << 2) | (b3 >> 6)] + b[b3 & 63]
    return 'http://www.plantuml.com/plantuml/png/~1' + r

puml_code = """@startuml mvc_class_diagram_delta_travel
skinparam shadowing false
skinparam packageStyle rectangle
skinparam classAttributeIconSize 0
skinparam defaultFontName "Times New Roman"
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
        +renderTourList(tours: List)
        +applyFilters(category, price, date)
        +showContactModal()
    }
    class TourDetailView {
        +renderTourDetail(tour: Tour)
        +renderGallery(images: List)
        +renderItinerary(days: List)
        +renderDepartureSchedules(schedules: List)
    }
    class AuthModalView {
        +renderLoginForm()
        +renderRegisterForm()
        +renderForgotPasswordModal()
    }
    class BookingCheckoutView {
        +renderBookingForm(schedule: Schedule)
        +collectPassengerDetails(): List
        +submitBookingRequest()
    }
    class VietQRModalView {
        +renderDynamicQR(bankCode, accountNo, amount, memo)
        +uploadPaymentReceipt(file)
        +startCountdownTimer(15_minutes)
    }
    class MyBookingsView {
        +renderOrderHistory(bookings: List)
        +renderBookingDetail(bookingId)
        +submitCancelRequest(bookingId, reason)
    }
    class AdminDashboardView {
        +renderOverviewStats(revenue, orders)
        +renderTourManager()
        +renderOrderApprovalTable()
        +renderAuditLogViewer()
    }
}

package "2. TẦNG ĐIỀU KHIỂN (CONTROLLER LAYER - Application Orchestration)" #E3F2FD {
    class AccountController {
        +register(dto: RegisterDTO): Response
        +login(dto: LoginDTO): Response
        +getProfile(userId: int): Response
        +updateProfile(dto: ProfileDTO): Response
        +forgotPassword(email: string): Response
    }
    class TourCatalogController {
        +getCategories(): Response
        +searchTours(filter: TourFilterDTO): Response
        +getTourDetail(tourId: int): Response
        +getSchedules(tourId: int): Response
    }
    class BookingProcessController {
        +createBooking(dto: BookingDTO): Response
        +getUserBookings(userId: int): Response
        +requestCancelTour(dto: CancelDTO): Response
        +approveCancellation(bookingId: int): Response
    }
    class PaymentCallbackController {
        +generateVietQR(bookingId: int): Response
        +uploadReceipt(dto: ReceiptDTO): Response
        +reconcilePayment(transRef: string): Response
        +confirmPayment(paymentId: int): Response
    }
    class AdminManagementController {
        +saveTour(dto: TourFormDTO): Response
        +saveSchedule(dto: ScheduleDTO): Response
        +approveOrder(bookingId: int): Response
        +getRevenueReport(timeRange): Response
        +queryAuditLogs(filters): Response
    }
}

package "3. TẦNG MÔ HÌNH (MODEL LAYER - 12 Thực thể CSDL & Data Access)" #FFF3E0 {
    class TourDbContext {
        +Users: DbSet<NguoiDung>
        +Categories: DbSet<DanhMuc>
        +Tours: DbSet<Tour>
        +Images: DbSet<HinhAnhTour>
        +Itineraries: DbSet<LichTrinhDetail>
        +Schedules: DbSet<ChuyenKhoiHanh>
        +Bookings: DbSet<DatTour>
        +Passengers: DbSet<ChiTietHanhKhach>
        +Payments: DbSet<ThanhToan>
        +Reviews: DbSet<DanhGia>
        +Articles: DbSet<BaiVietQuangBa>
        +AuditLogs: DbSet<AuditLog>
        +beginSerializableTransaction()
        +commitTransaction()
        +rollbackTransaction()
    }

    class NguoiDung {
        +int MaNguoiDung
        +string HoTen
        +string Email
        +string SoDienThoai
        +string MatKhauHash
        +string VaiTro
        +bool verifyPassword(rawPwd)
        +void hashPassword(rawPwd)
    }

    class Tour {
        +int MaTour
        +int MaDanhMuc
        +string TenTour
        +decimal GiaCoBan
        +int SoNgay
        +int SoDem
        +string DiemKhoiHanh
        +string DiemDen
    }

    class ChuyenKhoiHanh {
        +int MaChuyen
        +int MaTour
        +DateTime NgayKhoiHanh
        +DateTime NgayVe
        +decimal GiaNguoiLon
        +decimal GiaTreEm
        +int SoChoToiDa
        +int SoChoDaDat
        +bool checkAndLockSeats(qty: int)
        +void restoreSeats(qty: int)
    }

    class DatTour {
        +int MaDatTour
        +int MaNguoiDung
        +int MaChuyen
        +string MaBooking
        +DateTime NgayDat
        +int SoLuongKhach
        +decimal TongTien
        +string TrangThai
        +void changeStatus(newStatus)
    }

    class ChiTietHanhKhach {
        +int MaHanhKhach
        +int MaDatTour
        +string HoTen
        +DateTime NgaySinh
        +string LoaiKhach
        +string SoGiayTo
    }

    class ThanhToan {
        +int MaThanhToan
        +int MaDatTour
        +string PhuongThuc
        +string MaGiaoDich
        +decimal SoTienThanhToan
        +DateTime NgayThanhToan
        +string TrangThai
        +string AnhMinhChung
    }

    class DanhGia {
        +int MaDanhGia
        +int MaTour
        +int MaNguoiDung
        +int DiemDanhGia
        +string BinhLuan
        +DateTime NgayDanhGia
    }

    class BaiVietQuangBa {
        +int MaBaiViet
        +int MaTacGia
        +string TieuDe
        +string NoiDung
        +string HinhAnhBia
        +DateTime NgayDang
    }

    class AuditLog {
        +int MaLog
        +string TenBang
        +string HanhDong
        +string NguoiThucHien
        +string DuLieuCu
        +string DuLieuMoi
        +DateTime ThoiGian
    }
}

' ========================================================
' CÁC KÊNH TƯƠNG TÁC GIỮA 3 TẦNG KIẾN TRÚC (HAI CHIỀU)
' ========================================================

' 1. TẦNG VIEW GỌI TẦNG CONTROLLER
HomeCatalogView --> TourCatalogController : [1] HTTP GET / AJAX
TourDetailView --> TourCatalogController : [1] HTTP GET
AuthModalView --> AccountController : [1] HTTP POST AuthDTO
BookingCheckoutView --> BookingProcessController : [1] HTTP POST BookingDTO
VietQRModalView --> PaymentCallbackController : [1] HTTP POST Upload Receipt
MyBookingsView --> BookingProcessController : [1] HTTP POST CancelDTO
AdminDashboardView --> AdminManagementController : [1] HTTP Admin Requests

' 2. TẦNG CONTROLLER TƯƠNG TÁC TẦNG MODEL (CHIỀU THUẬN)
AccountController --> NguoiDung : [2a] Query/Create/Verify
TourCatalogController --> Tour : [2a] LINQ Filter/Search
BookingProcessController --> TourDbContext : [2a] Open Serializable Tx
BookingProcessController --> ChuyenKhoiHanh : [2b] Lock & Deduct Seats
BookingProcessController --> DatTour : [2c] Insert Booking (BK...)
BookingProcessController --> ChiTietHanhKhach : [2d] Insert Passenger List
PaymentCallbackController --> ThanhToan : [2a] Save Payment & Evidence
AdminManagementController --> AuditLog : [2a] Write Audit Records

' 3. TẦNG MODEL PHẢN HỒI TẦNG CONTROLLER (CHIỀU QUAY NGƯỢC LẠI - CỐT LÕI)
NguoiDung ..> AccountController : [3a] Trả về UserEntity, AuthResult (Hash Match/Fail)
Tour ..> TourCatalogController : [3b] Trả về TourDetailDTO, Gallery, Lịch trình, Giá vé
ChuyenKhoiHanh ..> BookingProcessController : [3c] Trả về SeatLockResult (Success/Exhausted)\nhoặc ném SeatShortageException
DatTour ..> BookingProcessController : [3d] Trả về BookingState, bắn OnSeatsLockedEvent
ThanhToan ..> PaymentCallbackController : [3e] Trả về PaymentStatus, bắn OnPaymentVerifiedEvent
ChuyenKhoiHanh ..> BookingProcessController : [3f] Trả về RestoredSeatsCount, OnBookingCancelledEvent
TourDbContext ..> AdminManagementController : [3g] Trả về DbCommitStatus, TransactionResult, AuditList

' 4. TẦNG CONTROLLER TRẢ PHẢN HỒI CHO TẦNG VIEW
AccountController ..> AuthModalView : [4] Set-Cookie (JWT) / HTTP 200 UserDTO
TourCatalogController ..> TourDetailView : [4] HTTP 200 JSON TourDetail
BookingProcessController ..> BookingCheckoutView : [4] HTTP 201 JSON BookingConfirmation
PaymentCallbackController ..> VietQRModalView : [4] HTTP 200 PaymentSuccessDTO
BookingProcessController ..> MyBookingsView : [4] HTTP 200 OrderUpdatedDTO
AdminManagementController ..> AdminDashboardView : [4] HTTP 200 AdminDataDTO

' ========================================================
' QUAN HỆ THỰC THỂ NỘI TẠI TRONG TẦNG MODEL
' ========================================================
Tour "1" *-- "0..*" ChuyenKhoiHanh : Lịch khởi hành
ChuyenKhoiHanh "1" *-- "0..*" DatTour : Đơn đặt chỗ
DatTour "1" *-- "1..*" ChiTietHanhKhach : Danh sách khách
DatTour "1" *-- "0..1" ThanhToan : Giao dịch VietQR
NguoiDung "1" *-- "0..*" DatTour : Lịch sử đặt
Tour "1" *-- "0..*" DanhGia : Đánh giá review
@enduml
"""

def generate():
    out_dir = os.path.join(os.path.dirname(__file__), "clean_images")
    os.makedirs(out_dir, exist_ok=True)
    out_png = os.path.join(out_dir, "hinh_2_17_class_mvc.png")
    root_png = os.path.join(os.path.dirname(os.path.dirname(__file__)), "mvc_architecture.png")
    puml_file = os.path.join(os.path.dirname(__file__), "class_diagram_mvc_delta_travel.puml")
    
    # Save puml file
    with open(puml_file, "w", encoding="utf-8") as f:
        f.write(puml_code)
    print("Saved PUML file:", puml_file)

    # Render PNG
    print("Sending PUML to PlantUML server for rendering...")
    url = puml_url(puml_code)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
        with open(out_png, "wb") as f:
            f.write(data)
        with open(root_png, "wb") as f:
            f.write(data)
    
    im = Image.open(out_png)
    print(f"Rendered successfully to {out_png}")
    print(f"Dimensions: {im.size[0]} x {im.size[1]} px, File size: {len(data)} bytes")

if __name__ == "__main__":
    generate()
