# Hồ sơ minh chứng KTHP | Phần Lê Văn Mạnh (02/11/2026)

**Sinh viên:** Lê Văn Mạnh (BAI250042), trưởng Nhóm 6, học phần Công nghệ phần mềm. **Đề tài:** Delta Travel, website quảng bá và đặt tour du lịch Việt Nam.

## Phạm vi được phân công và đã chuẩn bị

1. **A. Phát biểu bài toán:** vai trò Guest, Customer, Staff, Admin; mục tiêu tìm kiếm, đặt tour, kiểm soát số chỗ và quản trị; phân biệt V1/V2.
2. **B2. Phân tích/thiết kế hệ thống:** 20 Use Case UC01–UC20 từ tài liệu Thắm; bảng UC05/08/13 và truy vết UC→12 bảng; **6 Activity Diagram** (đăng nhập, đặt tour, CRUD tour, tìm/lọc, hủy đơn, xác minh thanh toán thủ công); Class Diagram theo vai trò MVC; mô hình deploy.
3. **3.2 Backend:** phân hệ FastAPI `auth/tours/bookings/admin/assistant`, schema Pydantic, SQLAlchemy và các cơ chế cookie phiên, CSRF, role-based access, idempotency, transaction.
4. **4.2 Kết luận và hạn chế:** nêu chính xác tình trạng online demo, phân biệt frontend localStorage với API demo và SQL Server read-only adapter.
5. **Điều phối:** khung tổng hợp báo cáo A/B1/B2/3/4/5 và checklist nộp từng thành viên, yêu cầu 5 nhánh + PR.

**Tài liệu Word/PDF, các hình PNG/SVG/.dot và kịch bản thuyết trình** đã được biên soạn trong gói bàn giao KTHP cho trưởng nhóm. Tệp này là chỉ mục có thể truy cập qua repository, không thay thế bản Word/PDF cần nộp.

## CRUD tour đã bổ sung ở PR này

| Method | Endpoint | Ý nghĩa | Bảo vệ |
|---|---|---|---|
| POST | `/api/v1/admin/tours` | Create | ADMIN, cookie session, CSRF |
| GET | `/api/v1/admin/tours` | Read tất cả | ADMIN |
| PATCH | `/api/v1/admin/tours/{tour_id}` | Update / khôi phục | ADMIN, CSRF |
| DELETE | `/api/v1/admin/tours/{tour_id}` | Delete mềm: `active=false` | ADMIN, CSRF |

DELETE không phá bản ghi lịch sử, idempotent nếu gọi lặp và chỉ tạo Audit lần đầu. GET công khai loại tour ẩn; admin vẫn quản trị để khôi phục.

**Chốt thanh toán demo:** nếu hai đơn khác nhau cùng sử dụng `payment_evidence`, thao tác xác minh thứ hai phải trả HTTP 409. Bổ sung unique constraint trong ORM demo cho cơ sở dữ liệu **tạo mới**, validator trim và chặn trường bất ngờ. **DB hiện hữu cần migration được kiểm tra trước**, thay đổi không áp dụng cho SQL Server 12 bảng của Thắm.

## Kiểm thử minh chứng

- GitHub Actions trên nhánh: [run 41386118340](https://github.com/Tham2007/Quang_ba_va_dat_tour_du_lich/actions/runs/41386118340), **41 passed, 1 warning**, Ruff format: 10 files already formatted, lint undefined names đạt.
- Trường hợp test mới: create/read/update/delete/restore tour, phân quyền CUSTOMER vs ADMIN, CSRF, idempotent delete; cùng mã thanh toán ở hai đơn bị từ chối; chứng từ chỉ dấu cách bị từ chối.
- Các test khác: CRUD schedule, giá server snapshot, cookie/session, chống giữ chỗ vượt giới hạn trong **SQLite demo**.
- Staging frontend nhóm tại https://delta-travel-group6-kthp-demo.onrender.com được Render báo live, **không** phải FastAPI nối DB thật.

## 6 Activity (đã có hình và lời giải thích trong báo cáo Word/PDF)

| Sơ đồ | Trọng tâm | Giới hạn xác minh |
|---|---|---|
| Activity 01 | Đăng ký, đăng nhập, cookie/CSRF | FastAPI demo |
| Activity 02 | Đặt tour, giữ chỗ một lần, retry | SQLite demo |
| Activity 03 | CRUD tour, RBAC, audit | SQLite demo |
| Activity 04 | Tìm/lọc tour | FE dữ liệu demo / SQL adapter mocked |
| Activity 05 | Hủy đơn, hoàn chỗ một lần | SQLite demo |
| Activity 06 | Đối soát chuyển khoản thủ công | Quy trình đề xuất; chưa tích hợp ngân hàng |

## Các bước còn BLOCKED theo phân công nhóm

- **Thắm:** chốt DBMS (T-SQL SQL Server hay PostgreSQL), ERD 12 bảng, migration, phân quyền/expiry/idempotency/seat rules.
- **Phúc:** tạo database test chạy thật và lưu kết quả `READ_ONLY_OK` không lộ credentials.
- **Mạnh:** sau DBMS/schema được duyệt, triển khai backend ghi đọc và migration đúng schema, sau đó đối chiếu hợp đồng API.
- **An:** đổi frontend localStorage thành API; không dùng user/role/PAID từ browser làm nguồn sự thật.
- **Đăng:** E2E trên DB thật, security, concurrency, 401/403, rollback và thống kê số bài kiểm thử cuối.

**Không được tuyên bố đã hoàn tất FE→FastAPI→SQL Server nếu chưa có log, URL backend và kết quả kiểm thử thật.**

Nguồn gốc yêu cầu: `huongdanvietbaocao.txt`, `phan_tich_nghiep_vu_12_bang_txt.txt` và repo nhóm.