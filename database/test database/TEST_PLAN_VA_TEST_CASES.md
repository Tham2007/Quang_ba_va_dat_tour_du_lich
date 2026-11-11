# TEST PLAN, TEST LƯU ĐƠN VÀ TEST DATABASE — DELTA TRAVEL 2.0

Tài liệu và bộ kịch bản kiểm thử tự động cho 2 mảng trọng tâm: **Test Lưu đơn Đặt tour cho Database** và **Test Cơ sở dữ liệu SQL Server (12 bảng chuẩn 3NF)**.

---

## 1. TEST PLAN (KẾ HOẠCH KIỂM THỬ)

### 1.1. Mục tiêu kiểm thử
- Bảo đảm **100%** quy trình lưu đơn đặt tour và danh sách hành khách vào CSDL tuân thủ giao dịch **ACID**, tự động cập nhật `SoChoDaDat` / `reserved_seats` và ghi vết nhật ký `AUDITLOG`.
- Kiểm chứng cơ chế **chống Overbooking khi có giao dịch đồng thời (Concurrency)** bằng `UPDLOCK, HOLDLOCK` trên SQL Server và giao dịch `BEGIN ... COMMIT` + `Idempotency-Key` ở tầng API.
- Xác minh toàn bộ ràng buộc toàn vẹn trên **12 bảng chuẩn 3NF** của SQL Server (`PK`, `FK`, `UNIQUE`, `CHECK`, `TRIGGER`).
- Bảo toàn **100%** dữ liệu thực tế trên CSDL cloud thông qua cơ chế `BEGIN TRANSACTION ... ROLLBACK TRANSACTION` cho mọi ca test SQL Server.

### 1.2. Phạm vi kiểm thử
- **In-Scope:**
  - **Mảng Test Lưu đơn cho Database:** Lưu `DATTOUR`, `CHITIET_HANHKHACH`, `THANHTOAN`, `AUDITLOG` thông qua Stored Procedures (`sp_api_CreateBooking`, `sp_api_AddPassenger`, `sp_api_CancelBooking`, `sp_XacNhanThanhToanDonTour`), Trigger (`TRG_DATTOUR_CheckAndLockSeats`, `TRG_DATTOUR_HandleCancellation`), và API (`POST /api/v1/bookings`, `POST /api/v1/bookings/:id/pay`).
  - **Mảng Test Database SQL Server (12 bảng 3NF):** Kiểm thử `UQ_NGUOIDUNG_Email`, `CK_DANHGIA_SoSao`, `TRG_DANHGIA_CheckCompletedTour`, `FK_DATTOUR_CHUYENKHOIHANH`, `CK_CHUYEN_SoChoHopLe`.
- **Out-of-Scope:** Kiểm thử tích hợp cổng thanh toán trực tuyến bên thứ ba ở môi trường tiền thật (VNPAY/MoMo Live).

### 1.3. Môi trường kiểm thử & Phân bổ tài nguyên
- **Môi trường Database SQL Server:** Microsoft SQL Server `sql8020.site4now.net:1433`, Database `db_ad0b71_dattour` (tương thích `TourDuLichDB`), thực thi qua SSMS hoặc Node.js driver `mssql@12.7.14`.
- **Môi trường API & Concurrency:** Node.js `v26.9.0` + Express `5.3.0` (`server.js`) chạy trên SQLite tạm cô lập (`os.tmpdir()`), gửi yêu cầu song song bằng `fetch` + `Promise.all`.
- **Phân bổ tệp kiểm thử (tập trung toàn bộ trong `database/test database/`):**
  1. [test_luu_don_database.sql](test_luu_don_database.sql): Kịch bản T-SQL kiểm thử lưu đơn, khóa chỗ, hủy hoàn chỗ và lưu thanh toán trong SQL Server.
  2. [test_database_constraints.sql](test_database_constraints.sql): Kịch bản T-SQL kiểm thử `UNIQUE`, `CHECK`, `FOREIGN KEY` và Trigger đánh giá trên 12 bảng 3NF.
  3. [test_luu_don_va_database.js](test_luu_don_va_database.js): Script Node.js tự động chạy cả 2 mảng (API Concurrency + T-SQL trên SQL Server) và đối soát số dòng trước/sau để bảo đảm `ROLLBACK` sạch.
  4. [KET_QUA_CHAY_TEST.txt](KET_QUA_CHAY_TEST.txt): Log kết quả chạy thực tế từ Terminal (`17/17 PASS`).

### 1.4. Tiêu chí PASS / FAIL (Exit Criteria)
- **PASS:** `100%` kịch bản đạt kết quả mong đợi; trạng thái cuối `17/17` Test Cases đạt `[PASS]`; số lượng bản ghi trên SQL Server trước và sau kiểm thử giữ nguyên (`NGUOIDUNG=6`, `CHUYENKHOIHANH=9`, `DATTOUR=7`, `CHITIET_HANHKHACH=11`, `THANHTOAN=5`, `DANHGIA=2`, `AUDITLOG=4`).
- **FAIL:** Bất kỳ kịch bản nào cho phép đặt vượt `SoChoToiDa`, tạo trùng đơn với cùng `Idempotency-Key`, vượt qua ràng buộc `UNIQUE`/`CHECK`/`FK`/`TRIGGER`, hoặc làm thay đổi dữ liệu gốc sau `ROLLBACK`.

---

## 2. TEST LƯU ĐƠN CHO DATABASE

| Mã TC | Mô tả Kịch bản | Bộ dữ liệu đầu vào (Input) | Kết quả mong đợi (Expected Result) | Kết quả thực tế (Actual Result) | Đánh giá (Status) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-LUUDON-01** | **Lưu đơn thành công & Trigger cộng `SoChoDaDat`:** Kiểm tra `sp_api_CreateBooking` + `sp_api_AddPassenger` lưu `DATTOUR`, `CHITIET_HANHKHACH` và ghi `AUDITLOG`. | `MaKhachHang = 1`, `MaChuyen = 1` (`18/25` chỗ), `SoLuongKhach = 2`, 2 hành khách (`Nguyễn Văn An Test`, `Trần Thị Bình Test`) trong `BEGIN TRAN ... ROLLBACK`. | `StatusCode = 201`, lưu `1` đơn `DATTOUR`, `2` dòng `CHITIET_HANHKHACH`, `SoChoDaDat` tăng `18 -> 20`, `AUDITLOG` tăng `1` dòng trước khi rollback. | Lưu đơn `#10` (`HTTP 201`), `SoChoDaDat` tăng `18->20`, `Hành khách=2`, `AUDITLOG` tăng `4->5`; sau `ROLLBACK`, dữ liệu gốc giữ nguyên. | **PASS** |
| **TC-LUUDON-02A** | **Kiểm tra khóa `UPDLOCK, HOLDLOCK` trong `sp_api_CreateBooking` khi thiếu chỗ:** Từ chối lưu đơn vượt số chỗ còn lại. | Gọi `EXEC dbo.sp_api_CreateBooking` với `MaChuyen = 1` (còn `7` chỗ trống) và `@SoLuongKhach = 12` (`ConLai + 5`). | Thủ tục tự `ROLLBACK`, không lưu đơn và trả về `Success = 0`, `StatusCode = 400`. | Trả đúng JSON SQL Server: `{"Success":0,"StatusCode":400,"Message":"Không đủ số chỗ trống. Hiện chỉ còn 7 chỗ."}`. | **PASS** |
| **TC-LUUDON-02B** | **Trigger `TRG_DATTOUR_CheckAndLockSeats` chống Overbooking:** Chặn `INSERT` trực tiếp vượt chỗ trống. | Trong `BEGIN TRAN`, `INSERT INTO dbo.DATTOUR` trực tiếp vào `MaChuyen = 1` với `SoLuongKhach = 17` (`ConLai + 10`). | Trigger phát hiện thiếu chỗ, bắn `RAISERROR` (`Msg 50000`) và tự động `ROLLBACK TRANSACTION` (`Msg 3609`). | Bắt đúng `Msg 50000: LỖI NGHIỆP VỤ: Số chỗ còn lại của chuyến khởi hành không đủ đáp ứng số lượng khách yêu cầu. Giao dịch bị hủy bỏ!` + `Msg 3609`. | **PASS** |
| **TC-LUUDON-03** | **Hủy đơn & Trigger hoàn trả chỗ trống:** Kiểm tra `sp_api_CancelBooking` + `TRG_DATTOUR_HandleCancellation`. | Tạo tạm đơn `2` chỗ trên `MaChuyen = 1` (`18->20`), sau đó gọi `sp_api_CancelBooking` cho đơn vừa tạo trong `BEGIN TRAN ... ROLLBACK`. | Đơn chuyển `TrangThaiDat = N'Đã hủy'`, `SoChoDaDat` hoàn trả đúng `20 -> 18` và ghi `AUDITLOG`. | Hủy đơn `#12` thành công, `SoChoDaDat` biến đổi `18->20->18` (hoàn chỗ chính xác). | **PASS** |
| **TC-LUUDON-04** | **Lưu chứng từ thanh toán & Cập nhật trạng thái đơn:** Kiểm tra `sp_XacNhanThanhToanDonTour`. | Tạo tạm đơn `1` chỗ, gọi `sp_XacNhanThanhToanDonTour` với `PhuongThuc = N'Chuyển khoản QR'`, `MaGiaoDich = 'VQR_TEST_SQL_20261111'`. | Chèn `1` dòng `THANHTOAN`, cập nhật `DATTOUR` sang `'Đã xác nhận'` & `'Đã thanh toán'`, ghi `AUDITLOG`. | Lưu thanh toán đơn `#13` thành công (`TrangThaiDat=Đã xác nhận`, `ThanhToan=Đã thanh toán`). | **PASS** |
| **TC-API-BOOK-01** | **Lưu đơn qua API (`POST /api/v1/bookings`) Happy Path:** Lưu đơn và khóa chỗ trên lịch mẫu `4` chỗ. | Gửi `adults = 2, children = 1, infants = 0` (`3` chỗ) kèm `Idempotency-Key` hợp lệ. | Trả `HTTP 201`, tạo đơn `PENDING_PAYMENT`, `reserved_seats = 3/4`. | Trả `HTTP 201`, `ref=BK8852099534`, `totalPrice=10697500`, `reserved=3/4`. | **PASS** |
| **TC-API-BOOK-02** | **Kiểm thử đồng thời (Concurrency `Promise.all`) tranh 1 chỗ cuối cùng:** 2 khách cùng bấm đặt khi còn đúng `1` chỗ. | Sau khi giữ `3/4` chỗ, Khách 1 và Khách 2 gửi đồng thời 2 request `POST /api/v1/bookings` (`adults = 1`, khác `Idempotency-Key`). | Đúng `1` request nhận `201 Created`, `1` request nhận `409 Conflict`, `reserved_seats = 4/4` (không overbooking). | Kết quả `Status=[201, 409]`, `reserved=4/4`. | **PASS** |
| **TC-API-BOOK-03** | **Chống trùng đơn bấm đúp (`Idempotency-Key`):** Gửi lặp lại cùng request tạo đơn. | Gửi lại payload của `TC-API-BOOK-01` lần thứ 2 với cùng header `Idempotency-Key`. | Trả `HTTP 200` với đúng `id` đơn cũ, `dbCount = 1`, không trừ chỗ lần 2. | Trả `HTTP 200`, trùng `id=e970b192-bb38-4925-b433-3bf002f9f4b0`, `dbCount=1`, `reserved=3/4`. | **PASS** |
| **TC-API-VAL / PAY** | **Validation `422` & Thanh toán VietQR `202`:** Kiểm tra thiếu khóa/thông tin và gửi mã GD VietQR. | (1) Gửi thiếu `Idempotency-Key` hoặc thiếu tên khách; (2) Gửi `POST /pay` với `'123'` và `'VCB_VIETQR_20261111'`. | Validation trả `422`; mã `< 8` ký tự trả `422`; mã hợp lệ trả `202` (`PENDING_MANUAL_VERIFICATION`, chưa `PAID`). | Validation `HTTP [422, 422]`; Pay `Bad=422`, `Valid=202 (PENDING_MANUAL_VERIFICATION)`. | **PASS** |

---

## 3. TEST DATABASE SQL SERVER (RÀNG BUỘC 12 BẢNG CHUẨN 3NF)

| Mã TC | Mô tả Kịch bản | Bộ dữ liệu đầu vào (Input) | Kết quả mong đợi (Expected Result) | Kết quả thực tế (Actual Result) | Đánh giá (Status) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-DB-01** | **Ràng buộc `UNIQUE` Email (`UQ_NGUOIDUNG_Email`):** Chặn đăng ký trùng Email trên bảng `NGUOIDUNG`. | Trong `BEGIN TRAN`, `INSERT INTO dbo.NGUOIDUNG` với `Email = 'admin@tourvietnam.vn'` (đã tồn tại). | SQL Server chặn bản ghi trùng, trả mã lỗi `2627` (hoặc `2601`) và `ROLLBACK`. | Đã chặn bởi `UQ_NGUOIDUNG_Email` (`Error 2627`: `Violation of UNIQUE KEY constraint 'UQ_NGUOIDUNG_Email'...`). | **PASS** |
| **TC-DB-02** | **Ràng buộc `CHECK` số sao (`CK_DANHGIA_SoSao`):** Chặn điểm đánh giá ngoài khoảng `1..5`. | Chọn `MaDatTour` chưa có đánh giá; trong `BEGIN TRAN`, `INSERT INTO dbo.DANHGIA` với `SoSao = 6`. | SQL Server chặn bản ghi vi phạm `CK_DANHGIA_SoSao`, trả lỗi `547` và `ROLLBACK`. | Đã chặn bởi `CK_DANHGIA_SoSao` (`Error 547`: `conflicted with the CHECK constraint "CK_DANHGIA_SoSao"`). | **PASS** |
| **TC-DB-03** | **Trigger `TRG_DANHGIA_CheckCompletedTour`:** Chỉ cho đánh giá khi đơn ở trạng thái `'Đã hoàn thành'`. | Chọn `MaDatTour` có `TrangThaiDat <> N'Đã hoàn thành'` và chưa có đánh giá; trong `BEGIN TRAN`, `INSERT DANHGIA` với `SoSao = 5`. | Trigger phát hiện sai trạng thái, bắn `RAISERROR` (`Msg 50000`) và `ROLLBACK TRANSACTION`. | Bắt đúng `Msg 50000: LỖI NGHIỆP VỤ: Quý khách chỉ có thể gửi đánh giá cho những đơn đặt tour đã hoàn thành chuyến đi!` + `Msg 3609`. | **PASS** |
| **TC-DB-04A** | **Ràng buộc Khóa ngoại (`FK_DATTOUR_CHUYENKHOIHANH`):** Chặn lưu đơn tham chiếu chuyến đi không tồn tại. | Trong `BEGIN TRAN`, `INSERT INTO dbo.DATTOUR` với `MaChuyen = -999999`. | SQL Server từ chối bản ghi mồ côi do vi phạm Foreign Key, trả lỗi `547` và `ROLLBACK`. | Đã chặn bởi `FK_DATTOUR_CHUYENKHOIHANH` (`Error 547`). | **PASS** |
| **TC-DB-04B** | **Ràng buộc `CHECK` số chỗ (`CK_CHUYEN_SoChoHopLe`):** Chặn `SoChoDaDat > SoChoToiDa`. | Trong `BEGIN TRAN`, `UPDATE dbo.CHUYENKHOIHANH SET SoChoDaDat = SoChoToiDa + 5`. | SQL Server từ chối cập nhật sai toàn vẹn sức chứa, trả lỗi `547` và `ROLLBACK`. | Đã chặn bởi `CK_CHUYEN_SoChoHopLe` (`Error 547`). | **PASS** |
| **DB-ROLLBACK-SAFE** | **Kiểm chứng bảo toàn dữ liệu sau toàn bộ bộ test:** Đối chiếu số dòng trước và sau khi chạy 2 script SQL Server. | Truy vấn `COUNT(*)` trên 7 bảng nghiệp vụ chính trước và sau khi chạy xong toàn bộ batch T-SQL. | Số dòng trước và sau hoàn toàn trùng khớp (`0` bản ghi bẩn còn sót lại). | Khớp 100%: `NGUOIDUNG=6`, `CHUYENKHOIHANH=9`, `DATTOUR=7`, `CHITIET_HANHKHACH=11`, `THANHTOAN=5`, `DANHGIA=2`, `AUDITLOG=4`. | **PASS** |

---

## 4. HƯỚNG DẪN CHẠY LẠI BỘ KIỂM THỬ

1. **Chạy tự động toàn bộ cả 2 mảng từ gốc dự án:**
   ```powershell
   node "database/test database/test_luu_don_va_database.js"
   ```
2. **Chạy trực tiếp trên SQL Server Management Studio (SSMS):**
   - Mở và nhấn `F5` trên [test_luu_don_database.sql](test_luu_don_database.sql) để test lưu đơn/Stored Procedures/Triggers.
   - Mở và nhấn `F5` trên [test_database_constraints.sql](test_database_constraints.sql) để test các ràng buộc 12 bảng 3NF.

