# Thanh toán và giữ chỗ V1: phạm vi chờ phê duyệt

**Nguồn:** tài liệu `phan_tich_nghiep_vu_12_bang_txt.txt` của Thắm, SQL trigger/procedure trên `main`, và backend FastAPI hiện có. **Trạng thái:** BẢN ĐỀ XUẤT; việc thu tiền thật/hoàn tiền thật chưa được triển khai/kiểm chứng.

## Bất biến bắt buộc trước khi bật ghi đơn

1. `SoChoConLai = SoChoToiDa - SoChoDaDat` với `0 <= SoChoDaDat <= SoChoToiDa`, concurrency không vượt chỗ.
2. Tạo đơn/giữ chỗ phải **tăng số giữ/đã đặt một lần duy nhất**, trong một transaction. Khi xác minh đã thanh toán **không** tăng thêm nếu ghế đã được giữ lúc tạo.
3. Hủy hoặc hết hạn chỉ hoàn ghế **một lần**, không hoàn ghế của đơn chưa chiếm ghế. Luồng giữ chỗ phải có hạn hoặc quy trình giải phóng chỗ được duyệt.
4. Server định giá từ lịch khởi hành; lưu snapshot giá tại lúc đặt. Không tin số tiền frontend gửi; chưa có quy tắc trẻ em/infant thì không giả định giá.
5. Cần idempotency key và khóa unique nhằm chống khách retry tạo hai booking khi mạng lỗi.
6. Chỉ nhân viên có quyền đã xác thực, sau đối soát giao dịch độc lập, mới được xác nhận đã thanh toán. Không cho client tự đặt `PAID`, chống dùng lại mã giao dịch, xác minh số tiền và trạng thái.
7. Hủy đơn đã thanh toán không tương đương hoàn tiền ngân hàng; cần quy trình kiểm tra và duyệt hoàn tiền riêng.
8. Audit không làm lộ thông tin xác thực/tài chính nhạy cảm.

## Mâu thuẫn đã tìm trong mã nguồn

Trigger `TRG_DATTOUR_CheckAndLockSeats` trong `database/04_programmability/01_triggers_booking_inventory.sql` tăng `SoChoDaDat` khi thêm `DATTOUR`, trong khi AC4 của Thắm lại nêu tăng `SoChoDaDat` ở bước xác nhận thanh toán. **Nếu làm cả hai sẽ trừ ghế hai lần**.

`sp_XacNhanThanhToanDonTour` trong `database/04_programmability/02_stored_procedures_booking.sql` chưa kiểm tra đủ mã giao dịch trùng, giá trị thu, quyền người xác minh và trạng thái/đơn đã thanh toán. **Không** nối endpoint public hoặc admin vào thủ tục này ngay.

## Cần quyết định/tài liệu bàn giao

- Thắm: transaction booking, trạng thái giữ chỗ/expiry, idempotency, RBAC và migration đã review.
- Mạnh: OpenAPI, triển khai auth/booking và xác nhận tiền theo đặc tả được duyệt.
- Đăng: 20 requests tranh 1 ghế, retry, expiry, hủy 2 lần, đã paid không paid lần hai, giao dịch trùng.
- Phúc: staging SQL Server riêng, snapshot/backup và rollback.

**Release gate:** API ghi đơn, xác minh thanh toán chưa được kích hoạt trong `api.tham_sqlserver_app`; chỉ cho mở khi kiểm thử bằng SQL Server thật đạt.
