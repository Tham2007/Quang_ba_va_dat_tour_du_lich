# Delta Travel 2.0: checklist bàn giao nhóm

## Bản bàn giao này đã tạo gì?

- Mạnh: API FastAPI, session và CSRF, CRUD tour/lịch có phân quyền, hold/cancel, snapshot giá, idempotency, admin/payment manual/audit, FAQ giới hạn, PostgreSQL-compatible ORM và test SQLite.
- Frontend mới có thể chạy độc lập: dựa trên style tham khảo screenshots, gọi API thật, danh sách tour, tìm và lọc, tài khoản, hồ sơ, yêu thích, giữ chỗ, đơn của tôi, admin UI, trợ lý quy tắc.
- Đăng: đã có 12 kịch bản automated API trong `tests/` để tiếp tục mở rộng. Chrome layout chạy với dữ liệu mô phỏng; Chrome kết nối tới local HTTP bị chính môi trường thử nghiệm chặn.
- Phúc: Dockerfile, Docker Compose demo, GitHub Actions CI mẫu, README và release gate. Chưa chứng minh được triển khai cloud/backup live.
- Thắm: phiếu công việc riêng `docs/THAM_DATABASE_HANDOFF.md`, rất chi tiết về Postgres migration/DB real-time/rollback/backups/test concurrency.

## Các hạng mục chưa nghiệm thu

- **An:** tích hợp giao diện HTML/CSS gốc 1:1 nếu cần giữ bản đẹp hiện tại; xóa luồng đánh dấu thanh toán và auth localStorage; kiểm tra tất cả modal, responsive, accessibility và dữ liệu tour chi tiết.
- **Thắm:** xây/duyệt migrations PostgreSQL, CHECK constraints và kiểm tra cạnh tranh trên Postgres, backup/restore, bảng ảnh/lịch trình nếu cần.
- **Đăng:** test browser live desktop/mobile trên staging, XSS/IDOR/race, smoke logout/session expiration, UI validation, đọc logs; viết report có bằng chứng.
- **Phúc:** tạo hosting và secrets theo quyền hợp lệ, TLS, staging + CI, container security, scheduler expired bookings, giám sát lỗi, backup/restore rehearsal, rollback; không bật payment chưa verify.
- **Mạnh:** duyệt hợp đồng API, migration và tất cả release gate; quyết định phạm vi demo/production; không công bố thanh toán thương mại.

## Gợi ý cách hợp nhất vào repository gốc

1. An tải hai ZIP code (repo upstream và bundle này) về máy, tạo nhánh `feature/backend-integration` sau khi owner cấp quyền ghi/PR.
2. Đưa `api/`, `scripts/`, `tests/`, `docs/`, `Dockerfile`, `compose.yaml`, `requirements.txt`, workflow vào repo. Không ghi đè UI gốc trước review.
3. An so sánh `frontend/` demo với `index.html` và `assets/js/{main,auth,chatbot}.js` gốc; chuyển DOM/CSS gốc sang frontend bảo mật, hoặc sử dụng frontend mẫu có sẵn nếu deadline gấp.
4. Thắm tạo PR database/migration, Đăng thực hiện e2e sau khi merge. Phúc tạo staging và chạy CI.
5. Leader review tất cả gate trong `docs/RELEASE_GATE.md`; release demo chỉ khi không còn luồng thanh toán giả hoặc dữ liệu tài khoản cũ.

**Lưu ý:** Bản này không tự động push, merge hoặc deploy lên GitHub của An do thiếu quyền ghi và credential deploy. Không nên tuyên bố đã hoàn thành những bước đó.
