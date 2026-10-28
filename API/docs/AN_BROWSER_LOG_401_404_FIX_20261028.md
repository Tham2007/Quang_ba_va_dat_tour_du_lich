# Hướng dẫn xử lý log An gửi ngày 28/10/2026

Ảnh của An có:
- `GET /api/v1/auth/me` → `401 Unauthorized`
- `GET /api/v1/tours` → `200 OK`
- `GET /assets/fonts/Inter-ExtraBold.woff2`, `Inter-Regular.woff2`, `Inter-Bold.woff2`, `Inter-Medium.woff2` → `404 Not Found`
- `GET /favicon.ico` → `404 Not Found`

## 1. Phân biệt hiện tượng

**401 với /auth/me** là **đúng** khi chưa đăng nhập. Không đổi endpoint bảo vệ thành luôn 200 hoặc bỏ auth, không tạo cookie giả. Mã FastAPI demo trong `API/api/app.py` vẫn giữ 401 cho yêu cầu có quyền.

Để trang chủ không vô tình in 401 trong log với khách, PR này bổ sung endpoint **GET /api/v1/auth/session**: không có phiên hợp lệ thì `200 {"authenticated":false,"user":null}`, có phiên hợp lệ thì trả user đã được xác thực. `API/frontend/assets/app.js` dùng endpoint mới chỉ để đồng bộ trạng thái giao diện. Các API cần xác thực tiếp tục dùng `/auth/me`/session cookie và CSRF như cũ.

**404 font** là tệp tĩnh không tìm thấy hoặc bị tham chiếu sai. Trên `main` hiện tại, `API/frontend/assets/styles.css` dùng Google Fonts, **không** khai báo đường dẫn `/assets/fonts/Inter-*.woff2`; `Frontend/` của nhóm mới chỉ có README. Repo frontend cũ `Anniehatani/deltatrdelt2.0` cũng không có những file font này. Vì vậy screenshot nhiều khả năng thuộc **bản frontend đang chạy cục bộ hoặc bản chưa được push**. Không thể xác nhận đã sửa đủ trên máy An chỉ bằng sửa backend.

**404 favicon** ở backend FastAPI demo được sửa bằng `API/frontend/favicon.svg`, link icon trong HTML và redirect `/favicon.ico` → `/favicon.svg`.

## 2. Cách An xử lý font ngay trên source An đang chạy

1. Mở đúng folder An chạy bằng VS Code. Tìm toàn workspace: `Inter-ExtraBold.woff2`, `Inter-Regular.woff2`, `Inter-Bold.woff2`, `Inter-Medium.woff2`. Tìm cả `@font-face` và `/assets/fonts/`.
2. **Nếu font thực sự tồn tại và có quyền phân phối**: đặt ở đúng thư mục static được máy chủ phục vụ, sửa đường dẫn `url(...)` tương ứng. Ví dụ server mount `assets` từ `<frontend_root>/assets` thì URL `/assets/fonts/Inter-Regular.woff2` phải ánh xạ tới `<frontend_root>/assets/fonts/Inter-Regular.woff2`. Không upload file font không rõ quyền sử dụng.
3. **Nếu font không có**: xóa các khai báo `@font-face` trỏ đến URL 404 và chọn font CDN hợp pháp (như Google Fonts) hoặc font hệ thống. Ví dụ trong CSS (không dùng đồng thời với @font-face không tồn tại):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root { font-family: Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif; }
```

4. Trang đã chỉnh cần reload hard-refresh (Ctrl+Shift+R), mở Network lọc `font`, `404`, đảm bảo không còn các yêu cầu font nội bộ 404. Đừng chỉ lọc log bằng console hoặc cấu hình server trả `200` cho tệp không tồn tại.

Từ thư mục `API/` có thể tự quét local static references:

```powershell
py -3 -m scripts.check_static_assets .\frontend
```

Để quét source frontend của An: `py -3 -m scripts.check_static_assets "C:\\duong-dan-frontend-cua-An"` (thay đường dẫn thư mục thật). Script không chỉnh sửa gì, chỉ báo đường dẫn font/favicon/JS/CSS/ảnh không có file.

## 3. Các phép thử tối thiểu

Trên **backend demo FastAPI** từ `API/` (không phải SQL Server adapter):

```powershell
py -3 -m pip install -r requirements.txt pytest httpx
py -3 -m pytest -q tests/test_api.py tests/test_legacy_schema_guard.py tests/test_static_assets.py
py -3 -m scripts.check_static_assets
py -3 -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

Mở `http://127.0.0.1:8000/` và kiểm tra:
- `GET /api/v1/auth/session` khi chưa login: HTTP 200, authenticated=false.
- `GET /api/v1/auth/me` khi chưa login: HTTP 401 **đúng** (chỉ test trực tiếp, frontend không tự gọi).
- `GET /api/v1/tours` khi DB demo đã seed: HTTP 200.
- `GET /favicon.svg` và `GET /favicon.ico` (theo redirect): HTTP 200.
- CSS/JS/font mà HTML thực tế tham chiếu phải trả HTTP 200; không có font 404.
- Sau login thật, `/auth/session` trả authenticated=true và user, `/auth/me` trả 200; sau logout trở lại false.

**Ràng buộc quan trọng:** Những thay đổi trong PR này sửa đường dẫn tĩnh và trải nghiệm phiên ẩn danh của **FastAPI demo**, không phải đã tích hợp SQL Server thật. `API/api/tham_sqlserver_app.py` hiện là ứng dụng SQL Server **read-only**, chưa có đăng nhập hoặc POST booking/payment. Tuyệt đối không dùng cách sửa 401 làm giả thao tác đăng nhập hay đánh dấu đã tích hợp FE–BE–DB.

## 4. Tiêu chí nghiệm thu cho An và Đăng

- An đưa source đang chạy ra một PR trong `Frontend/` của repo chính (không chỉ screenshot), với cách khởi động chính xác và bản lock/static tương ứng.
- Đăng tái hiện log trên đúng commit và URL/port, xác minh sau khi chưa đăng nhập, đăng nhập, logout, hard refresh và một browser mới. Đánh giá riêng HTTP 401 đúng ngữ nghĩa và HTTP 404 thực sự phải sửa.
- Báo cáo gồm commit SHA, URL test, log Network/Console, font/HTML/CSS paths, kết quả QA.
