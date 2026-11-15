# BÁO CÁO BÀN GIAO KỸ THUẬT: HỒNG THẮM | SQL SERVER, SƠ ĐỒ DỮ LIỆU & BẰNG CHỨNG DB
**Dự án:** Hệ thống Quảng bá và Đặt Tour Du lịch Trực tuyến (Delta Travel 2.0)  
**Người phụ trách:** Hồng Thắm (Trưởng nhóm / Senior Database Architect)  
**Mốc bàn giao:** 11:00 Ngày 15/11/2026 — Nhóm 6  
**Commit kiểm chiếu:** [`61df25a`](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/commit/61df25a) (Author: `Tham2007 <phamtham312007@gmail.com>`)  
**Tài nguyên Database Cloud:** Microsoft SQL Server 2022 (SmarterASP.NET Host: `sql8020.site4now.net:1433` | Database: `db_ad0b71_dattour`)

---

## TỔNG HỢP TRẠNG THÁI BÀN GIAO (EXECUTIVE SUMMARY)

| Mã Công Việc | Mức Độ | Nội Dung Trọng Tâm | Hiện Trạng Thực Tế | Đánh Giá (Status) |
| :--- | :---: | :--- | :--- | :---: |
| **THAM-01** | **P0** | Chốt Database website thực sự ghi vào & cơ chế kết nối | Node.js Server (`server.js`) kết nối trực tiếp SQL Server qua driver `mssql` (ghi voucher audit log và proxy catalog). Staging FastAPI trên Render chạy SQLite/Postgres độc lập. | **PASS** *(cho Node Web/SQL Server)* <br>**CHƯA TÍCH HỢP SQL SERVER VÀO FASTAPI RENDER** |
| **THAM-02** | **P0** | Kiểm tra 12 bảng chuẩn 3NF, ERD, ràng buộc, Triggers | 12/12 bảng đầy đủ, chuẩn hóa 3NF, 11 Foreign Keys, 14 Check Constraints, 2 Triggers giữ/hoàn chỗ tự động. | **PASS** |
| **THAM-03** | **P0** | Thử nghiệm đặt/hủy chỗ với dữ liệu an toàn | Đặt 2 chỗ: `18 -> 20/25` chỗ; Hủy đơn: `20 -> 18/25` chỗ. Không overbooking, rollback sạch. | **PASS** |
| **THAM-05** | **P1** | Bàn giao tài liệu schema, ERD, bảng dữ liệu mẫu che thông tin | Cung cấp đầy đủ danh mục file SQL, ERD Mermaid, bảng dữ liệu che danh tính (masked) và log truy vấn trước/sau. | **PASS** |

---

## 1. THAM-01 (P0): CHỐT DATABASE WEBSITE THỰC TẾ GHI VÀO

### 1.1. Bằng chứng kiểm tra Endpoint hệ thống (`/api/v1/health/ready`)
Truy vấn trực tiếp máy chủ đang vận hành (`http://127.0.0.1:8000/api/v1/health/ready`):

```json
{
  "status": "ok",
  "db": "SQL Server (vouchers) + SQLite",
  "sqlServerDiagnosticConnection": true,
  "sqlServerConnected": true,
  "voucherDatabase": "SQL Server",
  "writesDatabase": "SQL Server (vouchers) + SQLite",
  "tours": 16,
  "catalogMode": "sqlite"
}
```

### 1.2. Phân định rõ ràng kiến trúc Database giữa các thành phần
Theo đúng quy tắc trung thực khoa học được nêu trong biên bản phân công:
1. **Hệ thống Web Node.js thương mại (`server.js` - Port 8000):**
   - Đã tích hợp kết nối trực tiếp (**Live Direct Connection**) tới Microsoft SQL Server đám mây thông qua thư viện `mssql@12.7.14`.
   - **Các nghiệp vụ ghi thực tế vào SQL Server:** Toàn bộ lịch sử định nghĩa voucher (`VOUCHER_DEF`), lượt sử dụng voucher (`VOUCHER_USE`) và đối soát hoàn lượt khi hủy đơn được ghi trực tiếp vào bảng `dbo.AUDITLOG` của SQL Server.
   - Các đơn đặt chỗ khách hàng được lưu song song vào bảng `bookings` nội bộ kết hợp ghi vết audit log trên SQL Server.
2. **Website FastAPI triển khai trên Render (`delta-travel-group6-real-api-staging.onrender.com`):**
   - Hiện tại máy chủ Render đang sử dụng engine PostgreSQL/SQLite nội bộ của Render, **chưa mở cổng kết nối mạng ra ngoài tới SQL Server SmarterASP.NET** do giới hạn mạng firewall/outbound IP của gói Render miễn phí.
   - **Kết luận quy chuẩn bàn giao:** **CHƯA TÍCH HỢP SQL SERVER VÀO WEBSITE FASTAPI RENDER**. Buổi bảo vệ sẽ trình diễn chính thức trên máy chủ thương mại chạy Node.js + SQL Server trực tiếp.

---

## 2. THAM-02 (P0): HỆ THỐNG 12 BẢNG SQL SERVER CHUẨN 3NF & RÀNG BUỘC

### 2.1. Danh mục 12 Bảng và Số Dòng Dữ Liệu Thực Tế trên SmarterASP.NET
*(Truy vấn trực tiếp lúc 09:57:25 ngày 15/11/2026 từ database `db_ad0b71_dattour`)*

| STT | Tên Bảng (Table Name) | Khóa Chính (PK) | Số dòng thực tế | Mục đích nghiệp vụ |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `dbo.NGUOIDUNG` | `MaNguoiDung` (INT IDENTITY) | **6** | Tài khoản khách hàng & nhân viên quản trị (Mật khẩu băm) |
| 2 | `dbo.DANHMUC` | `MaDanhMuc` (INT IDENTITY) | **4** | Phân loại điểm đến: Miền Bắc, Miền Trung, Miền Nam, Biển đảo |
| 3 | `dbo.TOUR` | `MaTour` (INT IDENTITY) | **4** | Thông tin tổng quan tour, giá khuyến nghị, ảnh đại diện |
| 4 | `dbo.HINHANH_TOUR` | `MaHinhAnh` (INT IDENTITY) | **10** | Bộ sưu tập ảnh slide gallery (Chuẩn 3NF tách riêng) |
| 5 | `dbo.LICH_TRINH_DETAIL` | `MaLichTrinh` (INT IDENTITY) | **10** | Lịch trình chi tiết Ngày 1, Ngày 2, Ngày 3, bữa ăn, hoạt động |
| 6 | `dbo.CHUYENKHOIHANH` | `MaChuyen` (INT IDENTITY) | **9** | Lịch khởi hành thời gian thực, quản lý số chỗ tối đa & đã đặt |
| 7 | `dbo.DATTOUR` | `MaDatTour` (INT IDENTITY) | **7** | Đơn đặt tour du lịch, tổng tiền, trạng thái đơn & thanh toán |
| 8 | `dbo.CHITIET_HANHKHACH` | `MaHanhKhach` (INT IDENTITY) | **11** | Danh sách hành khách đi cùng đoàn trong từng đơn đặt |
| 9 | `dbo.THANHTOAN` | `MaThanhToan` (INT IDENTITY) | **5** | Lịch sử giao dịch chuyển khoản VietQR, mã giao dịch, số tiền |
| 10 | `dbo.DANHGIA` | `MaDanhGia` (INT IDENTITY) | **2** | Đánh giá nhận xét & số sao (1-5★) của khách sau khi đi tour |
| 11 | `dbo.BAIVIET_QUANGBA` | `MaBaiViet` (INT IDENTITY) | **3** | Bài viết cẩm nang du lịch, quảng bá điểm đến và SEO |
| 12 | `dbo.AUDITLOG` | `MaLog` (INT IDENTITY) | **49** | Nhật ký an ninh, ghi vết toàn bộ thao tác đặt/hủy/voucher |

### 2.2. Sơ đồ Quan hệ Thực thể (Mermaid ERD)

```mermaid
erDiagram
    DANHMUC ||--o{ TOUR : "chứa (1:N)"
    TOUR ||--o{ HINHANH_TOUR : "có slide ảnh (1:N)"
    TOUR ||--o{ LICH_TRINH_DETAIL : "có lịch trình ngày (1:N)"
    TOUR ||--o{ CHUYENKHOIHANH : "mở chuyến (1:N)"
    
    NGUOIDUNG ||--o{ DATTOUR : "đặt tour (1:N)"
    NGUOIDUNG ||--o{ BAIVIET_QUANGBA : "đăng bài (1:N)"
    NGUOIDUNG ||--o{ AUDITLOG : "thực hiện (1:N)"
    
    CHUYENKHOIHANH ||--o{ DATTOUR : "thuộc chuyến (1:N)"
    DATTOUR ||--o{ CHITIET_HANHKHACH : "gồm hành khách (1:N)"
    DATTOUR ||--o{ THANHTOAN : "thanh toán (1:N)"
    DATTOUR ||--o| DANHGIA : "đánh giá 1 lần (1:1)"

    NGUOIDUNG {
        int MaNguoiDung PK
        nvarchar HoTen
        varchar Email UK
        varchar SoDienThoai
        varchar MatKhau
        bit TrangThai
    }

    TOUR {
        int MaTour PK
        int MaDanhMuc FK
        nvarchar TenTour
        decimal GiaKhuyenNghi
        varchar HinhAnhDaiDien
        bit TrangThai
    }

    CHUYENKHOIHANH {
        int MaChuyen PK
        int MaTour FK
        datetime NgayKhoiHanh
        decimal GiaThucTe
        int SoChoToiDa
        int SoChoDaDat
        nvarchar TrangThaiChuyen
    }

    DATTOUR {
        int MaDatTour PK
        int MaKhachHang FK
        int MaChuyen FK
        datetime NgayDat
        int SoLuongKhach
        decimal TongTien
        nvarchar TrangThaiDat
        nvarchar TrangThaiThanhToan
    }

    CHITIET_HANHKHACH {
        int MaHanhKhach PK
        int MaDatTour FK
        nvarchar HoTen
        date NgaySinh
        nvarchar GioiTinh
    }

    THANHTOAN {
        int MaThanhToan PK
        int MaDatTour FK
        nvarchar PhuongThuc
        decimal SoTien
        varchar MaGiaoDich
    }

    DANHGIA {
        int MaDanhGia PK
        int MaDatTour FK_UK
        tinyint SoSao
        nvarchar NoiDung
    }
```

### 2.3. Bằng chứng Chuẩn hóa 3NF (Third Normal Form)
- **1NF (Chuẩn 1):** Mọi thuộc tính đều mang giá trị nguyên tử (Atomic). Danh sách ảnh không lưu dạng mảng chuỗi trong `TOUR` mà tách thành bảng `HINHANH_TOUR`. Lịch trình từng ngày tách riêng thành `LICH_TRINH_DETAIL`.
- **2NF (Chuẩn 2):** Toàn bộ các bảng sử dụng Khóa chính đơn (`MaTour`, `MaDatTour`, `MaChuyen`...) hoặc nếu là khóa kết hợp thì mọi thuộc tính không khóa đều phụ thuộc đầy đủ vào toàn bộ khóa chính, loại bỏ hoàn toàn phụ thuộc một phần.
- **3NF (Chuẩn 3):** Không có thuộc tính nào phụ thuộc bắc cầu (Transitive Dependency). Ví dụ: `CHITIET_HANHKHACH` chỉ lưu thông tin khách đi kèm và tham chiếu `MaDatTour`, không lưu lặp lại thông tin chuyến đi hay thông tin người đặt tiền.

### 2.4. Hệ thống Khóa Ngoại (Foreign Keys) & Ràng Buộc Kiểm Tra (Check Constraints)
- **11 Khóa ngoại bảo vệ tính toàn vẹn:**
  1. `FK_TOUR_DANHMUC`: `TOUR(MaDanhMuc) -> DANHMUC(MaDanhMuc)` (Chặn xóa danh mục khi còn tour).
  2. `FK_HINHANHTOUR_TOUR`: `HINHANH_TOUR(MaTour) -> TOUR(MaTour)` (ON DELETE CASCADE).
  3. `FK_LICHTRINH_TOUR`: `LICH_TRINH_DETAIL(MaTour) -> TOUR(MaTour)` (ON DELETE CASCADE).
  4. `FK_CHUYENKHOIHANH_TOUR`: `CHUYENKHOIHANH(MaTour) -> TOUR(MaTour)` (ON DELETE NO ACTION).
  5. `FK_DATTOUR_NGUOIDUNG`: `DATTOUR(MaKhachHang) -> NGUOIDUNG(MaNguoiDung)` (Bảo vệ dữ liệu kế toán, không xóa khách khi đã có đơn).
  6. `FK_DATTOUR_CHUYENKHOIHANH`: `DATTOUR(MaChuyen) -> CHUYENKHOIHANH(MaChuyen)` (Không xóa chuyến khi đã có khách đặt).
  7. `FK_CHITIETHANHKHACH_DATTOUR`: `CHITIET_HANHKHACH(MaDatTour) -> DATTOUR(MaDatTour)` (ON DELETE CASCADE).
  8. `FK_THANHTOAN_DATTOUR`: `THANHTOAN(MaDatTour) -> DATTOUR(MaDatTour)` (Bảo vệ chứng từ thanh toán).
  9. `FK_DANHGIA_DATTOUR`: `DANHGIA(MaDatTour) -> DATTOUR(MaDatTour)` (ON DELETE CASCADE).
  10. `FK_BAIVIET_NGUOIDUNG`: `BAIVIET_QUANGBA(MaNguoiDang) -> NGUOIDUNG(MaNguoiDung)`.
  11. `FK_AUDITLOG_NGUOIDUNG`: `AUDITLOG(MaNguoiThucHien) -> NGUOIDUNG(MaNguoiDung)` (ON DELETE SET NULL).
- **Các Ràng buộc Kiểm tra Toàn vẹn (Check Constraints) tiêu biểu:**
  - `CK_CHUYEN_SoChoHopLe`: `CHECK (SoChoDaDat >= 0 AND SoChoDaDat <= SoChoToiDa)` — Bảo đảm tuyệt đối không bao giờ âm hoặc vượt số chỗ.
  - `CK_DANHGIA_SoSao`: `CHECK (SoSao BETWEEN 1 AND 5)` — Chỉ cho phép chấm từ 1 đến 5 sao.
  - `CK_DATTOUR_TrangThaiDat`: `CHECK (TrangThaiDat IN (N'Chờ xác nhận', N'Đã xác nhận', N'Đã hoàn thành', N'Đã hủy'))`.
  - `CK_THANHTOAN_SoTien`: `CHECK (SoTien > 0)` — Chặn số tiền thanh toán âm hoặc bằng 0.

### 2.5. Triggers Nghiệp Vụ Cốt Lõi (Core Business Triggers)
1. **Trigger chống Overbooking & Tự động khóa chỗ (`TRG_DATTOUR_CheckAndLockSeats`):**
   - Kích hoạt: `AFTER INSERT ON dbo.DATTOUR`.
   - Cơ chế: Kiểm tra số chỗ trống `(SoChoToiDa - SoChoDaDat) >= SoLuongKhach`. Nếu thiếu chỗ, lập tức bắn `RAISERROR (Msg 50000)` và `ROLLBACK TRANSACTION`.
   - Nếu đủ chỗ: Tự động cộng `SoChoDaDat = SoChoDaDat + TongKhachDat`. Khi số chỗ đạt tối đa, tự động cập nhật `TrangThaiChuyen = N'Hết chỗ'`. Tự động ghi 1 dòng log vào `dbo.AUDITLOG`.
2. **Trigger hoàn chỗ khi hủy đơn (`TRG_DATTOUR_HandleCancellation`):**
   - Kích hoạt: `AFTER UPDATE ON dbo.DATTOUR`.
   - Cơ chế: Khi `TrangThaiDat` chuyển sang `N'Đã hủy'`, trigger tự động hoàn trả số ghế `SoChoDaDat = SoChoDaDat - SoLuongKhach` và mở lại trạng thái `N'Mở bán'` nếu chuyến đang bị đánh dấu hết chỗ.

---

## 3. THAM-03 (P0): KIỂM THỬ THỰC TẾ LƯU ĐƠN, GIỮ CHỖ & HỦY HOÀN CHỖ

Toàn bộ quá trình kiểm thử được chạy trực tiếp trên SQL Server SmarterASP.NET (`sql8020.site4now.net:1433`) với đơn thử nghiệm hoàn toàn sạch, **không chứa bất kỳ dữ liệu cá nhân hay thông tin nhạy cảm nào**.

### 3.1. Bằng chứng Thực thi Kịch bản Kiểm thử (`scripts/test_tham_delivery.js`)

```text
Connecting to SQL Server...
Connected successfully!

=== 12 BẢNG SQL SERVER (SMARTERASP.NET) VÀ SỐ DÒNG HIỆN CÓ ===
- NGUOIDUNG: 6 rows
- DANHMUC: 4 rows
- TOUR: 4 rows
- HINHANH_TOUR: 10 rows
- LICH_TRINH_DETAIL: 10 rows
- CHUYENKHOIHANH: 9 rows
- DATTOUR: 7 rows
- CHITIET_HANHKHACH: 11 rows
- THANHTOAN: 5 rows
- DANHGIA: 2 rows
- BAIVIET_QUANGBA: 3 rows
- AUDITLOG: 49 rows

=== THÔNG TIN CHUYẾN KHỞI HÀNH MẪU (TRƯỚC TEST) ===
Chuyến MaChuyen = 1 | MaTour = 1 | Giá: 3.890.000 VNĐ | Tối đa: 25 chỗ | Đã đặt: 18 chỗ | Trạng thái: Mở bán

=== KIỂM THỬ TRỰC TIẾP: LƯU ĐƠN - GIỮ CHỖ - HỦY HOÀN CHỖ (TRANSACTION SAFE) ===
[BƯỚC 1] Số chỗ đã đặt trước khi đặt: 18/25 chỗ
[BƯỚC 2] Tạo đơn qua Stored Procedure sp_api_CreateBooking:
         -> Kết quả: StatusCode = 201 (Created), MaDatTour = 26, TongTien = 7.780.000 VNĐ (2 khách)
[BƯỚC 3] Số chỗ sau khi đặt (+2): 20/25 chỗ
         -> Trigger TRG_DATTOUR_CheckAndLockSeats tăng chỗ đã đặt đúng 1 lần từ 18 lên 20.
[BƯỚC 4] Thêm hành khách thứ 2 qua sp_api_AddPassenger thành công:
         -> Họ tên: 'Trần Hành Khách 2', Ngày sinh: '1999-01-01', Giới tính: 'Nam'.
[BƯỚC 5] Hủy đơn qua sp_api_CancelBooking (Mã đơn 26, Khách hàng 1):
         -> Trạng thái đơn chuyển sang: 'Đã hủy'.
[BƯỚC 6] Số chỗ sau khi hủy (-2): 18/25 chỗ
         -> Trigger TRG_DATTOUR_HandleCancellation hoàn trả đúng 2 chỗ về nguyên trạng 18 chỗ!
[BƯỚC 7] ROLLBACK TRANSACTION thành công:
         -> Bảo toàn 100% số dòng dữ liệu thực tế trên Cloud Database (Không làm rác database).
```

### 3.2. Bằng chứng Phòng chống Overbooking (Kiểm tra TC-LUUDON-02A & 02B)
- **Kịch bản đặt vượt chỗ:** Chuyến 1 còn `25 - 18 = 7` chỗ trống. Gửi yêu cầu đặt `12` chỗ (`ConLai + 5`).
- **Kết quả SQL Server phản hồi:**
  ```json
  {
    "Success": 0,
    "StatusCode": 400,
    "Message": "Không đủ số chỗ trống. Hiện chỉ còn 7 chỗ."
  }
  ```
- **Nếu cố tình INSERT trực tiếp bỏ qua SP:** Trigger `TRG_DATTOUR_CheckAndLockSeats` lập tức ném lỗi:
  `Msg 50000: LỖI NGHIỆP VỤ: Số chỗ còn lại của chuyến khởi hành không đủ đáp ứng số lượng khách yêu cầu. Giao dịch bị hủy bỏ!` và tự động kích hoạt `Msg 3609: The transaction ended in the trigger. The batch has been aborted.`

---

## 4. THAM-05 (P1): BÀN GIAO DỮ LIỆU MẪU ĐÃ CHE THÔNG TIN & DANH MỤC FILE SQL

### 4.1. Bảng Dữ Liệu Khách Hàng & Đơn Đặt Mẫu (Đã Che Thông Tin Riêng Tư)

#### Bảng `dbo.NGUOIDUNG` (Đã ẩn danh thông tin cá nhân):
| MaNguoiDung | HoTen | Email (Masked) | SoDienThoai (Masked) | TrangThai | NgayTao |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | Quản Trị Viên Hệ Thống | `admin@***vietnam.vn` | `0901***001` | 1 | 2026-10-15 |
| 2 | Nguyễn Văn An | `an.nguyen@***.vn` | `0912***456` | 1 | 2026-10-16 |
| 3 | Trần Thị Bình | `binh.tran@***.com` | `0987***321` | 1 | 2026-10-18 |
| 4 | Lê Hoàng Long | `long.le@***.com` | `0934***789` | 1 | 2026-10-20 |
| 5 | Phạm Thị Hương | `huong.pham@***.vn` | `0978***654` | 1 | 2026-10-22 |
| 6 | Đỗ Minh Quân | `quan.do@***.com` | `0945***123` | 1 | 2026-10-25 |

#### Bảng `dbo.CHUYENKHOIHANH` (Lịch khởi hành thực tế):
| MaChuyen | MaTour | NgayKhoiHanh | GiaThucTe | SoChoToiDa | SoChoDaDat | ConLai | TrangThaiChuyen |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | 1 | 2026-11-15 08:00 | 3.890.000 đ | 25 | **18** | **7** | **Mở bán** |
| **2** | 1 | 2026-12-20 08:00 | 4.290.000 đ | 25 | **25** | **0** | **Hết chỗ** |
| **3** | 1 | 2027-01-10 08:00 | 3.890.000 đ | 25 | **4** | **21** | **Mở bán** |
| **4** | 2 | 2026-11-25 07:30 | 5.490.000 đ | 30 | **22** | **8** | **Mở bán** |
| **5** | 2 | 2026-12-30 07:30 | 5.990.000 đ | 30 | **30** | **0** | **Hết chỗ** |

### 4.2. Danh Mục Các File Mã Nguồn SQL Đã Hoàn Thiện Trong Kho Lưu Trữ
Toàn bộ mã nguồn cơ sở dữ liệu đã được commit đẩy đủ lên nhánh `main` của repository GitHub:

1. **Khởi tạo Database & 12 Bảng 3NF:**
   - [01_create_database.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/database/01_schema/01_create_database.sql) — Tạo Database `TourDuLichDB` / cấu hình collation `Vietnamese_CI_AS`.
   - [02_create_tables_3nf.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/database/01_schema/02_create_tables_3nf.sql) — Tạo cấu trúc 12 bảng chuẩn hóa 3NF.
2. **Khóa Ngoại & Ràng Buộc Kiểm Tra:**
   - [01_foreign_keys_and_checks.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/database/02_constraints/01_foreign_keys_and_checks.sql) — 11 Foreign Keys & 14 Check Constraints.
3. **Chỉ Mục Tối Ưu Hóa (Performance Indexes):**
   - [01_indexes_optimization.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/database/03_indexes/01_indexes_optimization.sql) — Nonclustered Indexes trên `Email`, `NgayKhoiHanh`, `MaTour`, `MaDatTour`.
4. **Triggers & Thủ Tục Lưu Trữ (Programmability):**
   - [01_triggers_booking_inventory.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/database/04_programmability/01_triggers_booking_inventory.sql) — Triggers khóa giữ chỗ, chống overbooking, hoàn chỗ khi hủy.
   - [02_stored_procedures_booking.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/database/04_programmability/02_stored_procedures_booking.sql) — `sp_api_CreateBooking`, `sp_api_AddPassenger`, `sp_api_CancelBooking`.
   - [05_api_endpoints_procedures.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/database/04_programmability/05_api_endpoints_procedures.sql) — Các SP nghiệp vụ chi tiết hỗ trợ API.
5. **Dữ Liệu Khởi Tạo Thực Tế (Seed Data):**
   - [01_sample_data_realistic.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/database/05_seed_data/01_sample_data_realistic.sql) — Dữ liệu mẫu chuẩn 16 tour, lịch khởi hành, người dùng, đánh giá.
6. **Bộ Kịch Bản Kiểm Thử Độc Lập:**
   - [test_luu_don_database.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/test%20database/test_luu_don_database.sql) — Kịch bản T-SQL test nghiệp vụ lưu đơn và giữ chỗ.
   - [test_database_constraints.sql](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/test%20database/test_database_constraints.sql) — Kịch bản T-SQL test ràng buộc UNIQUE, CHECK, FK.
   - [test_luu_don_va_database.js](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/test%20database/test_luu_don_va_database.js) — Tool tự động chạy test đối soát số dòng trước và sau.
   - [TEST_PLAN_VA_TEST_CASES.md](file:///c:/Users/ACER/Downloads/Quang_ba_va_dat_tour_du_lich/database/test%20database/TEST_PLAN_VA_TEST_CASES.md) — Kế hoạch và bảng 17 test cases chi tiết.

---

## 5. MẪU BÁO CÁO GỬI VÀO NHÓM THEO QUY CHUẨN

```text
[THAM] [THAM-01, THAM-02, THAM-03, THAM-05] BÀN GIAO LÚC 11:00

1. THAM-01 (P0): PASS (Node.js Server) / BÁO CÁO TRẠNG THÁI (Render FastAPI).
   - Website Node.js (Port 8000) kết nối TRỰC TIẾP thành công tới SQL Server (sql8020.site4now.net:1433 / db_ad0b71_dattour), ghi nhận trực tiếp VOUCHER_DEF, VOUCHER_USE và đối soát qua dbo.AUDITLOG.
   - Website Render FastAPI đang chạy độc lập SQLite/Postgres của Render, CHƯA TÍCH HỢP TOÀN BỘ 12 BẢNG SQL SERVER VÀO WEBFastAPI RENDER. Đề xuất demo chính thức trên bản Node.js Server.

2. THAM-02 (P0): PASS.
   - Đủ 12/12 bảng chuẩn 3NF: NGUOIDUNG (6), DANHMUC (4), TOUR (4), HINHANH_TOUR (10), LICH_TRINH_DETAIL (10), CHUYENKHOIHANH (9), DATTOUR (7), CHITIET_HANHKHACH (11), THANHTOAN (5), DANHGIA (2), BAIVIET_QUANGBA (3), AUDITLOG (49).
   - ERD, 11 Khóa ngoại, 14 Check constraints, 2 Triggers giữ/hủy chỗ tự động sẵn sàng.

3. THAM-03 (P0): PASS.
   - Chạy test trực tiếp trên database SmarterASP.NET với đơn thử nghiệm sạch (không dữ liệu nhạy cảm):
     + Đặt 2 chỗ: SoChoDaDat tăng từ 18 lên 20/25 (HTTP 201).
     + Hủy đơn: SoChoDaDat hoàn trả từ 20 về 18/25 đúng 1 lần.
     + Overbooking: Chặn đặt vượt chỗ, trả lỗi HTTP 400 và Trigger chặn INSERT.

4. THAM-05 (P1): PASS.
   - Đã bàn giao tài liệu chi tiết tại file ngoài: C:\Users\ACER\Downloads\HONG_THAM_SQLSERVER_BAN_GIAO_11H_15_11_2026.md
   - Link commit: https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/commit/61df25a
```
