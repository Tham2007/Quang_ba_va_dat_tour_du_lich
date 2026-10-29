# Delta Travel — Đối chiếu gói backend mới Thắm gửi ngày 29/10/2026

**Trạng thái:** REVIEW / INTEGRATION BLOCKED. Bằng chứng đối chiếu: file `Quang_ba_va_dat_tour_du_lich.zip` (bên trong một tệp RAR) do nhóm cung cấp và `main` của repo chung ngày 29/10.

## Kết quả xác minh, không suy đoán

- Gói nén giải được; có thư mục `backend/app/` mới phân lớp thành `controllers`, `services`, `repositories`, `models`, `schemas` cùng `backend/tests/test_api.py`. `backend/` **chưa có trên `main`** khi audit.
- Các SQL script gốc **trùng Git blob SHA** trên `main`, bao gồm `database/01_schema/02_create_tables_3nf.sql` SHA `b78af5b8ea6883ed17d1cfba61298542de294078`, stored booking procedures SHA `3630134e37ecabcd9787195a110cd81947f828de`, API procedures SQL SHA `80ce37562925e7fdaf206e8371568139c893da10`. Như vậy ZIP **không chứng minh SQL script đã được sửa mới và push lên main**.
- Backend mới dùng SQLAlchemy **`users,tours,schedules,bookings,booking_travelers,payments,`...** và khóa kiểu chuỗi; SQL Server của Thắm dùng **`NGUOIDUNG,TOUR,CHUYENKHOIHANH,DATTOUR,CHITIET_HANHKHACH,THANHTOAN`** với khóa `INT IDENTITY`. Chúng **không tương thích** bằng cách đổi URL.
- `backend/app/core/database.py` bản nộp đang cho phép tùy ý ORM schema; không được trỏ nó vào `mssql+pyodbc://...`. `backend/app/main.py` tự `create_all()` và seed khi dev, không được chạy trên SQL Server có dữ liệu. Để test read-only SQL Server, dùng công cụ đã merge `API/scripts/check_tham_sqlserver.py`.
- `backend/tests/test_api.py` gốc chạy **4 passed (SQLite mock/demo)** tại máy kiểm tra. Bộ vá offline mới (giao Mạnh) đã tăng lên **14 passed**: kiểm tra trạng thái đặt/hủy/thanh toán/idempotency, thử **20 yêu cầu tranh 1 chỗ trên SQLite**, chống quyền admin sai và không dùng mật khẩu seed cố định. **Không** khẳng định kết nối SQL Server hay UI E2E.
- `Frontend/` của An đã được import trên `main` (PR #12) và Chrome browser smoke CI thành công. Nhưng frontend vẫn dùng localStorage cho tài khoản/role/booking nên chưa gọi backend/SQL Server thật.
- Bản ZIP cũng chứa `Frontend/` cũ (`views/index.html`, `js/main.js`). **Không copy đè** bản An mới trong `Frontend/` của `main`.

## Những lỗi/rủi ro backend mới đã sửa trong gói vá offline

1. Chặn `mssql` với ORM chưa tương thích; SQLite demo mới được tự tạo bảng; production PostgreSQL phải có migrations.
2. Bỏ mật khẩu demo cố định, account sample chỉ tạo khi biến môi trường test được thiết lập chủ động.
3. Chặn hủy đã thanh toán làm tự hoàn chỗ sai; xác nhận tiền phải có mã đối soát, chưa hết hạn, chỉ 1 lần, chống transaction code trùng.
4. Đánh giá chỉ khi `COMPLETED`; fingerprint idempotency bao gồm ghi chú/danh sách hành khách.
5. Bổ sung health query DB và tìm đúng `Frontend/index.html`/assets/admin/favicons khi chạy backend riêng.
6. 14/14 kiểm thử SQLite demo đạt (gồm 20 requests/1 seat). Chưa có staging SQL Server, chưa có E2E live.

## Thứ tự tích hợp được đề xuất (không tự chốt DBMS thay nhóm)

**Thắm:** Chốt DBMS với thầy/nhóm. Nếu SQL Server chính: bàn giao ERD, data dictionary, migration non-destructive cho 12 bảng, rules role/auth/session, trạng thái ghế, TTL/idempotency. Nếu PostgreSQL chính: chuyển toàn bộ thiết kế T-SQL sang PostgreSQL có review và migration/test, không gọi mã SQL Server là tương thích.

**Phúc:** Thiết lập SQL Server **test riêng** (nếu chọn SQL Server) và user SELECT-only/TLS; không gửi user/password vào GitHub/Zalo; lưu log thành công `python -m scripts.check_tham_sqlserver` từ `API/`. Không chạy `DROP DATABASE` trên DB có dữ liệu.

**Mạnh:** Review gói vá backend, đưa `backend/` trên branch riêng qua PR, sau đó **chọn một backend chính** và triển khai API ghi theo ERD được duyệt. Không merge hai backend cùng trỏ vào hai nguồn đơn khác nhau.

**An:** Tích hợp `Frontend/` đã merge vào endpoint đã xác minh. Không dùng localStorage làm nguồn quyền/người dùng/đơn, tránh XSS ở HTML động.

**Đăng:** Test 20 yêu cầu giữ 1 chỗ bằng SQL Server **thật** (không phải kết quả SQLite), 401/403, xác nhận thanh toán trùng, hoàn tiền, admin IDOR, và E2E FE→API→DB.

## Release gate

- [ ] Thắm/nhóm xác nhận DBMS và ERD cuối cùng.
- [ ] Database test chạy và `READ_ONLY_OK` trên schema thật.
- [ ] Backend tích hợp auth/booking/payment với đúng DBMS, kiểm thử transaction và RBAC.
- [ ] Frontend An gọi API thật, không ghi đơn hay tiền giả ở localStorage.
- [ ] Đăng nghiệm thu QA và Phúc triển khai staging đúng repo.

**Hiện tại: chưa thể báo hoàn thành kết nối database thật.** Không merge `backend/` mới vào ứng dụng chính trước khi review mô hình và CI.
