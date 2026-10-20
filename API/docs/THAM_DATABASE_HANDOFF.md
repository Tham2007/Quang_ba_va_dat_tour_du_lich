# PHIẾU GIAO VIỆC HỒNG THẮM: DATABASE DỮ LIỆU ĐỘNG DELTA TRAVEL 2.0

**Người giao:** Lê Văn Mạnh, phụ trách backend/API.
**Người thực hiện:** Hồng Thắm, phụ trách Database và đồng bộ dữ liệu.
**Ngày giao:** 18/10/2026.
**Mức độ:** Bắt buộc cho bàn giao cuối, không được tự ý đưa dữ liệu khách thật vào môi trường demo.

## 1. Mục tiêu và phạm vi

Thực hiện **PostgreSQL schema/migrations thật**, duy trì chính xác dữ liệu thay đổi theo thời gian: tour, giá, thời gian khởi hành, tổng số chỗ, chỗ đã giữ, hồ sơ người dùng, đơn hàng và bằng chứng đối soát thanh toán. Backend hiện có ORM trong `api/models.py`. Thắm **không thiết kế một database song song** khiến thông tin lệch nhau. `frontend/assets/app.js` tuyệt đối không được dùng `localStorage` làm nguồn sự thật cho tài khoản, giá, số chỗ, trạng thái thanh toán.

### 1.1 Các bảng tối thiểu đang có

| Bảng | Khoá chính/ngoại | Ý nghĩa | Điều kiện bất biến |
|---|---|---|---|
| `users` | `id` UUID string | Họ tên, email, SĐT, password hash, role, active | email và SĐT unique, không lưu mật khẩu gốc; role khách mặc định CUSTOMER |
| `favorites` | `id`, `user_id`, `tour_id` FK | Danh sách tour yêu thích theo tài khoản | unique(user_id,tour_id), không lưu vào localStorage làm nguồn sự thật |
| `sessions` | `token_hash`; `user_id` FK | Phiên đăng nhập, CSRF, hết hạn | chỉ lưu hash token, không tiết lộ token; xóa phiên khi đổi mật khẩu |
| `tours` | `id` dạng DL-HL01 | Nội dung, slug, vùng, giá VND, tình trạng mở bán | price > 0, không suy đoán giá từ frontend; audit mọi thay đổi |
| `schedules` | `id`, `tour_id` FK | Ngày khởi hành, `total_seats`, `reserved_seats` | 0 <= reserved_seats <= total_seats; unique tour+departure |
| `bookings` | `id`, `user_id`, `schedule_id` FK | Đơn, snapshot giá, người liên hệ, số khách, trạng thái | unique(user_id,idempotency_key); có hết hạn; khách chỉ xem đơn mình |
| `audit_events` | `id`, `actor_id` | Nhật ký chỉnh tour, lịch, thanh toán | lịch sử chính xác, giới hạn quyền đọc, không lưu secrets |

**Đề xuất mở rộng có kiểm soát:** `tour_itinerary_days`, `tour_images`, `tour_inclusions`, `tour_exclusions`, `tour_reviews` (chỉ review đã kiểm duyệt), `payment_transactions`, `vouchers`, `booking_travelers`, `outbox_events`. Trước khi thêm, gửi migration và DTO để Mạnh/An review; không thêm toàn bộ nếu chưa có nhu cầu SRS và test.

### 1.2 Quy trình cập nhật dữ liệu thời gian thực

1. Admin hợp lệ sửa tour hoặc lịch qua `/api/v1/admin/tours/{id}`, `/api/v1/admin/schedules/{id}`. Server kiểm tra role trong database, validate input và ghi audit trong cùng transaction.
2. PostgreSQL COMMIT thành công mới trả response 200. UI đọc lại `GET /api/v1/tours`, `GET /api/v1/tours/{id}/schedules`; frontend demo hiện polling danh mục 30 giây và lấy chỗ mới khi mở hộp đặt tour. Vì vậy đây là **near-real-time**, không phải WebSocket tức thời.
3. Nếu yêu cầu cập nhật tức thời dưới 2 giây, thiết kế `outbox_events` và SSE/WebSocket kèm sequence/version. Chỉ phát sau commit; client reconnect/fallback poll; không chuyển dữ liệu riêng tư sang public events. Tối thiểu phải kiểm thử client A cập nhật, client B nhìn thấy sau khoảng trễ được công bố.
4. Khi khách đặt: backend khoá row `schedules` (`SELECT ... FOR UPDATE` trên PostgreSQL), kiểm tra đủ chỗ, cộng `reserved_seats`, lưu giá snapshot và đơn với `PENDING_PAYMENT` trong **cùng một transaction**.
5. Đơn chưa thanh toán hết hạn 15 phút phải trả chỗ **đúng một lần**, kể cả nhiều worker hoặc retry. Demo có sweep khi gọi API; production cần background worker độc lập chạy định kỳ, có giám sát và báo lỗi.
6. Hủy hợp lệ trừ chỗ đúng một lần. Đơn đã PAID giữ chỗ, không được xóa cứng nếu chưa có quy trình hoàn tiền.
7. Trên production, callback cổng thanh toán cần verify chữ ký, amount, merchant, reference, chống replay và đối soát; **không xác định PAID bằng redirect trình duyệt hoặc cờ tự gửi lên**.

## 2. Bản giao nộp bắt buộc

- `db/migrations/001_initial.sql` hoặc Alembic migration có upgrade + downgrade được review, đồng bộ đúng với `api/models.py`, đảm bảo kiểu `BIGINT` cho tiền VND và timezone UTC.
- `db/migrations/002_invariants.sql`: CHECK giá > 0, `reserved_seats >= 0`, `total_seats > 0`, `reserved_seats <= total_seats`, số khách hợp lệ, status enum/check. UNIQUE và foreign keys đã có phải giữ nguyên; **đừng dùng CASCADE DELETE với bookings**.
- ERD Mermaid hoặc PNG thể hiện 7 bảng hiện tại và mối quan hệ 1-N.
- `db/README.md` mô tả tạo DB, biến môi trường `DATABASE_URL`, migration/rollback, dữ liệu demo, backup/restore và an toàn dữ liệu cá nhân.
- `db/seed_demo.py` hoặc SQL seed chỉ để local/test, idempotent, **không tạo mật khẩu demo cố định**, không đưa CCCD/thông tin thanh toán cá nhân vào git.
- Kết quả chạy PostgreSQL thực: ảnh/log `CREATE/ALTER`, test migrations fresh, test rollback trên DB rỗng, snapshot restore, 20 booking đồng thời tranh 1 chỗ, kết quả reserved không vượt tổng.
- SQL/README báo cáo thay đổi giá và trạng thái tồn chỗ dưới 2 user session, mô tả độ trễ cập nhật thực tế (poll 30s hoặc SSE được kiểm thử).
- PR gửi Mạnh review, không force push hoặc sửa lén schema API.

## 3. Các tiêu chí nghiệm thu (Acceptance Criteria)

- [ ] PostgreSQL mới tạo chạy migrate thành công, chạy migrate lần nữa không phá dữ liệu.
- [ ] `BIGINT` cho giá, tổng đơn; tiền tính VND nguyên, không dùng float.
- [ ] Email/SĐT unique, password hash có salt, không có password trong log.
- [ ] Một người không truy xuất được bookings của người khác (IDOR trả 404).
- [ ] 20 requests cùng đặt 1 chỗ chỉ 1 đơn thành công, không oversell.
- [ ] Retry cùng `Idempotency-Key` không tạo thêm booking; đổi body cùng key trả 409.
- [ ] Thay giá sau đặt không thay giá snapshot của đơn cũ.
- [ ] Đơn quá hạn/hủy trả chỗ đúng một lần và không làm `reserved_seats` âm.
- [ ] Admin không giảm sức chứa dưới lượng đã giữ/đã thanh toán.
- [ ] Mở 2 trình duyệt: cập nhật tour/giá từ admin và hiển thị mới theo SLA đã nêu.
- [ ] Bảng audit ghi ai đã sửa giá/chỗ/đơn, khi nào, bản ghi nào; chỉ ADMIN được xem.
- [ ] Backup và restore chạy được, không commit dữ liệu thật/secrets.
- [ ] Schema khác với API model thì có migration và cập nhật contract trong cùng PR.
- [ ] Deploy production có TLS, secrets quản lý an toàn, backup, metric/alert; không seed tour demo.

## 4. Ranh giới công việc với Mạnh, An, Đăng, Phúc

**Thắm:** Postgres schema, migrations, check constraints, seed, scripts, backup/restore; xác minh cập nhật đồng thời và data integrity.
**Mạnh:** Giữ sở hữu `api/`, auth, booking transaction, kiểm soát quyền, endpoint admin, đối soát và review migrations.
**An:** Hoàn thiện giao diện của An bằng cách gọi API; loại bỏ `localStorage` tài khoản/booking và mọi màn hình “ĐÃ THANH TOÁN” giả.
**Đăng:** E2E và regression test 2 trình duyệt, race, bảo mật input, mobile.
**Phúc:** Container, CI/CD, staging, release, backup restore rehearsal, rollback và logs.

## 5. API contract cần thống nhất

API docs tự sinh ở `GET /docs` (FastAPI OpenAPI); URL gốc `http://localhost:8000/api/v1` trong môi trường dev. Các field tour dùng camelCase ở response để sát frontend của An; admin input dùng snake_case theo backend model. Nếu đổi tên field, Thắm phải phối hợp Mạnh + An review đồng thời; **không đổi schema bằng cách sửa trực tiếp dữ liệu production**.

**Lưu ý thanh toán:** Phiên bản bàn giao chưa có merchant sandbox/production nên chỉ hỗ trợ giữ chỗ và admin xác minh thủ công sau khi tra cứu giao dịch thật. Không công bố là có cổng thanh toán tự động, không thu nhập số thẻ/CVV trong frontend.

## 6. Câu trả lời yêu cầu từ Thắm khi hoàn thành

> Em đã tạo PR database, đính kèm đường dẫn PR + migration, ERD, log migrations/rollback, demo hai người cùng tranh một chỗ, backup/restore và kết quả các acceptance criteria. Nếu có mục chưa đạt, em ghi rõ tên lỗi và ETA sửa. Em không thay đổi code auth/booking/payment khi chưa có review của Mạnh.
