using System.Data;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using System.Threading.RateLimiting;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<Database>();
// ASP.NET Core MVC architecture required by the course (Controller + Model + Razor View).
builder.Services.AddControllersWithViews();
builder.Services.AddSingleton<IPasswordHasher<UserPassword>, PasswordHasher<UserPassword>>();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "delta_session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = builder.Environment.IsProduction() ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromHours(4);
        options.SlidingExpiration = false;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-Token";
    options.Cookie.Name = "delta_csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = builder.Environment.IsProduction() ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
    options.Cookie.SameSite = SameSiteMode.Strict;
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
});
var keyDirectory = Environment.GetEnvironmentVariable("DATA_PROTECTION_KEYS_PATH");
if (!string.IsNullOrWhiteSpace(keyDirectory))
{
    Directory.CreateDirectory(keyDirectory);
    builder.Services.AddDataProtection().SetApplicationName("DeltaTravel.AspNet")
        .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory));
}
var app = builder.Build();
app.UseExceptionHandler(a => a.Run(async context =>
{
    context.Response.StatusCode = 500;
    await context.Response.WriteAsJsonAsync(new { error = "INTERNAL_SERVER_ERROR" });
}));
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Cache-Control"] = "no-store";
    await next();
});
app.UseHttpsRedirection();
// Keep the team's existing website designed by An as the only public frontend.
// The ASP.NET service provides /api/v1 endpoints; it is not a replacement UI.
// Do not redirect HEAD: hosting health probes may use HEAD on /.
app.Use(async (context, next) =>
{
    if (HttpMethods.IsGet(context.Request.Method)
        && (context.Request.Path == "/" || context.Request.Path == "/index.html"))
    {
        context.Response.Redirect("https://delta-travel-group6-kthp-demo.onrender.com/", permanent: false);
        return;
    }
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/v1/health/live", () => Results.Ok(new { status = "live", framework = "ASP.NET Core 10" }));
app.MapGet("/api/v1/health/ready", async (Database database, CancellationToken ct) =>
{
    if (!database.Configured) return Results.Json(new { status = "not_ready", database = "not_configured" }, statusCode: 503);
    try
    {
        await using var db = await database.OpenAsync(ct);
        await using var cmd = new SqlCommand(@"SELECT
(SELECT COUNT_BIG(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') AND name IN ('NGUOIDUNG','DANHMUC','TOUR','CHUYENKHOIHANH','DATTOUR','CHITIET_HANHKHACH','THANHTOAN','DANHGIA','BAIVIET_QUANGBA','AUDITLOG','HINHANH_TOUR','LICH_TRINH_DETAIL')),
(SELECT COUNT_BIG(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo')),
(SELECT COUNT_BIG(*) FROM sys.triggers WHERE parent_id=OBJECT_ID(N'dbo.DATTOUR') AND is_disabled=0 AND name IN (N'TRG_DATTOUR_CheckAndLockSeats',N'TRG_DATTOUR_HandleCancellation'))", db);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return Results.Json(new { status = "schema_unavailable" }, statusCode: 503);
        var count = reader.GetInt64(0);
        var total = reader.GetInt64(1);
        var triggers = reader.GetInt64(2);
        return count == 12 && total == 12 && triggers == 2
            ? Results.Ok(new { status = "ready", schemaTablesFound = count, inventoryTriggersEnabled = triggers })
            : Results.Json(new { status = "schema_or_trigger_mismatch", schemaTablesFound = count, actualTableCount = total, inventoryTriggersEnabled = triggers }, statusCode: 503);
    }
    catch (SqlException) { return Results.Json(new { status = "database_unreachable" }, statusCode: 503); }
});

app.MapGet("/api/v1/auth/csrf", (HttpContext context, IAntiforgery antiforgery) =>
{
    var tokens = antiforgery.GetAndStoreTokens(context);
    return Results.Ok(new { csrfToken = tokens.RequestToken });
});

app.MapPost("/api/v1/auth/register", async (RegisterRequest req, HttpContext context, IAntiforgery csrf, Database database, IPasswordHasher<UserPassword> hasher, CancellationToken ct) =>
{
    if (!await csrf.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "CSRF_INVALID" });
    string email = (req.Email ?? "").Trim().ToLowerInvariant();
    string name = (req.FullName ?? "").Trim();
    string phone = (req.Phone ?? "").Trim();
    if (name.Length is < 2 or > 100 || !Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$") || email.Length > 100
        || !Regex.IsMatch(phone, @"^\+?[0-9]{9,15}$") || phone.Length > 15 || req.Password is null || req.Password.Length is < 12 or > 128)
        return Results.BadRequest(new { error = "INVALID_REGISTRATION" });
    var hashed = hasher.HashPassword(new UserPassword(), req.Password);
    try
    {
        await using var db = await database.OpenAsync(ct);
        await using var cmd = new SqlCommand(@"INSERT INTO dbo.NGUOIDUNG(HoTen,Email,SoDienThoai,MatKhau,TrangThai,NgayTao)
OUTPUT INSERTED.MaNguoiDung VALUES (@name,@email,@phone,@hash,1,GETDATE())", db);
        cmd.Parameters.Add("@name", SqlDbType.NVarChar, 100).Value = name;
        cmd.Parameters.Add("@email", SqlDbType.VarChar, 100).Value = email;
        cmd.Parameters.Add("@phone", SqlDbType.VarChar, 15).Value = phone;
        cmd.Parameters.Add("@hash", SqlDbType.VarChar, 255).Value = hashed;
        var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
        await SignIn(context, id, name);
        return Results.Created("/api/v1/auth/me", new { id, name, email });
    }
    catch (SqlException e) when (e.Number is 2601 or 2627) { return Results.Conflict(new { error = "EMAIL_ALREADY_EXISTS" }); }
    catch (SqlException) { return Results.Json(new { error = "DATABASE_UNAVAILABLE" }, statusCode: 503); }
    catch (InvalidOperationException) { return Results.Json(new { error = "DATABASE_NOT_CONFIGURED" }, statusCode: 503); }
}).RequireRateLimiting("auth");

app.MapPost("/api/v1/auth/login", async (LoginRequest req, HttpContext context, IAntiforgery csrf, Database database, IPasswordHasher<UserPassword> hasher, CancellationToken ct) =>
{
    if (!await csrf.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "CSRF_INVALID" });
    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrEmpty(req.Password)) return Results.Unauthorized();
    try
    {
        await using var db = await database.OpenAsync(ct);
        await using var cmd = new SqlCommand("SELECT MaNguoiDung, HoTen, MatKhau FROM dbo.NGUOIDUNG WHERE Email=@email AND TrangThai=1", db);
        cmd.Parameters.Add("@email", SqlDbType.VarChar, 100).Value = req.Email.Trim().ToLowerInvariant();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return Results.Unauthorized();
        var id = reader.GetInt32(0);
        var name = reader.GetString(1);
        var hashed = reader.GetString(2);
        var verify = hasher.VerifyHashedPassword(new UserPassword(), hashed, req.Password);
        if (verify == PasswordVerificationResult.Failed) return Results.Unauthorized();
        await reader.CloseAsync();
        await SignIn(context, id, name);
        return Results.Ok(new { id, name });
    }
    catch (FormatException) { return Results.Unauthorized(); }
    catch (SqlException) { return Results.Json(new { error = "DATABASE_UNAVAILABLE" }, statusCode: 503); }
    catch (InvalidOperationException) { return Results.Json(new { error = "DATABASE_NOT_CONFIGURED" }, statusCode: 503); }
}).RequireRateLimiting("auth");
app.MapGet("/api/v1/auth/me", (ClaimsPrincipal user) =>
    user.Identity?.IsAuthenticated == true ? Results.Ok(new { id = GetUserId(user), name = user.Identity.Name }) : Results.Unauthorized());
app.MapPost("/api/v1/auth/logout", async (HttpContext context, IAntiforgery csrf) =>
{
    if (!await csrf.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "CSRF_INVALID" });
    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok(new { signedOut = true });
}).RequireAuthorization();

app.MapGet("/api/v1/tours", async (string? q, int? limit, Database database, CancellationToken ct) =>
{
    try
    {
        await using var db = await database.OpenAsync(ct);
        await using var cmd = new SqlCommand(@"SELECT TOP (@limit) t.MaTour, t.TenTour, t.MoTaChiTiet, t.GiaKhuyenNghi, t.HinhAnhDaiDien, d.TenDanhMuc
FROM dbo.TOUR t INNER JOIN dbo.DANHMUC d ON d.MaDanhMuc=t.MaDanhMuc
WHERE t.TrangThai=1 AND (@q=N'' OR t.TenTour LIKE N'%' + @q + N'%') ORDER BY t.MaTour DESC", db);
        cmd.Parameters.Add("@limit", SqlDbType.Int).Value = Math.Clamp(limit ?? 30, 1, 100);
        cmd.Parameters.Add("@q", SqlDbType.NVarChar, 100).Value = (q ?? "").Trim()[..Math.Min((q ?? "").Trim().Length, 100)];
        var list = new List<object>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) list.Add(new { id = reader.GetInt32(0), name = reader.GetString(1), description = OptString(reader, 2), price = reader.GetDecimal(3), image = OptString(reader, 4), category = reader.GetString(5) });
        return Results.Ok(new { items = list, count = list.Count });
    }
    catch (SqlException) { return Results.Json(new { error = "DATABASE_UNAVAILABLE" }, statusCode: 503); }
    catch (InvalidOperationException) { return Results.Json(new { error = "DATABASE_NOT_CONFIGURED" }, statusCode: 503); }
});
app.MapGet("/api/v1/tours/{tourId:int}/schedules", async (int tourId, Database database, CancellationToken ct) =>
{
    try
    {
        await using var db = await database.OpenAsync(ct);
        await using var cmd = new SqlCommand(@"SELECT MaChuyen, NgayKhoiHanh, NgayKetThuc, GiaThucTe, SoChoToiDa, SoChoDaDat, TrangThaiChuyen
FROM dbo.CHUYENKHOIHANH WHERE MaTour=@tour AND NgayKhoiHanh > GETDATE() ORDER BY NgayKhoiHanh", db);
        cmd.Parameters.Add("@tour", SqlDbType.Int).Value = tourId;
        var list = new List<object>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) list.Add(new { id = reader.GetInt32(0), start = reader.GetDateTime(1), end = reader.GetDateTime(2), price = reader.GetDecimal(3), capacity = reader.GetInt32(4), booked = reader.GetInt32(5), available = Math.Max(0, reader.GetInt32(4) - reader.GetInt32(5)), status = OptString(reader, 6) });
        return Results.Ok(new { items = list });
    }
    catch (SqlException) { return Results.Json(new { error = "DATABASE_UNAVAILABLE" }, statusCode: 503); }
    catch (InvalidOperationException) { return Results.Json(new { error = "DATABASE_NOT_CONFIGURED" }, statusCode: 503); }
});

app.MapPost("/api/v1/bookings/quote", async (BookingQuote req, Database database, CancellationToken ct) =>
{
    if (req.ScheduleId <= 0 || req.Quantity is < 1 or > 20) return Results.BadRequest(new { error = "INVALID_QUANTITY" });
    try
    {
        await using var db = await database.OpenAsync(ct);
        await using var cmd = new SqlCommand(@"SELECT GiaThucTe, SoChoToiDa-SoChoDaDat, CASE WHEN NgayKhoiHanh>GETDATE() THEN 1 ELSE 0 END, TrangThaiChuyen
FROM dbo.CHUYENKHOIHANH WHERE MaChuyen=@id", db);
        cmd.Parameters.Add("@id", SqlDbType.Int).Value = req.ScheduleId;
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return Results.NotFound(new { error = "SCHEDULE_NOT_FOUND" });
        var price = reader.GetDecimal(0);
        if (reader.GetInt32(1) < req.Quantity || reader.GetInt32(2) == 0 || OptString(reader, 3) != "Mở bán") return Results.Conflict(new { error = "UNAVAILABLE" });
        return Results.Ok(new { amount = price * req.Quantity, unitPrice = price, quantity = req.Quantity, currency = "VND" });
    }
    catch (SqlException) { return Results.Json(new { error = "DATABASE_UNAVAILABLE" }, statusCode: 503); }
    catch (InvalidOperationException) { return Results.Json(new { error = "DATABASE_NOT_CONFIGURED" }, statusCode: 503); }
});

app.MapPost("/api/v1/bookings", async (CreateBooking req, HttpContext context, IAntiforgery csrf, Database database, CancellationToken ct) =>
{
    if (!await csrf.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "CSRF_INVALID" });
    if (req.ScheduleId <= 0 || req.Quantity is < 1 or > 20 || req.Travellers is null || req.Travellers.Length != req.Quantity
        || req.Travellers.Any(x => string.IsNullOrWhiteSpace(x) || x.Trim().Length > 100)) return Results.BadRequest(new { error = "INVALID_TRAVELLERS" });
    try
    {
        await using var db = await database.OpenAsync(ct);
        await using var transaction = (SqlTransaction)await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (!await InventoryTriggersReady(db, transaction, ct))
            return Results.Json(new { error = "INVENTORY_TRIGGERS_NOT_READY" }, statusCode: 503);
        await using var schedule = new SqlCommand(@"SELECT SoChoToiDa, SoChoDaDat, GiaThucTe, CASE WHEN NgayKhoiHanh>GETDATE() THEN 1 ELSE 0 END, TrangThaiChuyen
FROM dbo.CHUYENKHOIHANH WITH (UPDLOCK, HOLDLOCK) WHERE MaChuyen=@id", db, transaction);
        schedule.Parameters.Add("@id", SqlDbType.Int).Value = req.ScheduleId;
        var capacity = 0; var booked = 0; var price = 0m; var future = false; var status = "";
        await using (var r = await schedule.ExecuteReaderAsync(ct))
        {
            if (!await r.ReadAsync(ct)) return Results.NotFound(new { error = "SCHEDULE_NOT_FOUND" });
            capacity = r.GetInt32(0); booked = r.GetInt32(1); price = r.GetDecimal(2); future = r.GetInt32(3) == 1; status = OptString(r, 4) ?? "";
        }
        if (!future || status != "Mở bán" || capacity < booked || capacity - booked < req.Quantity)
            return Results.Conflict(new { error = "SOLD_OUT" });
        // TRG_DATTOUR_CheckAndLockSeats owns inventory. Do not increment seats in C#.
        await using var insert = new SqlCommand(@"INSERT dbo.DATTOUR (MaKhachHang,MaChuyen,NgayDat,SoLuongKhach,TongTien,TrangThaiDat,TrangThaiThanhToan)
VALUES (@user,@schedule,GETDATE(),@qty,@amount,N'Chờ xác nhận',N'Chưa thanh toán');
SELECT CAST(SCOPE_IDENTITY() AS int)", db, transaction);
        insert.Parameters.Add("@user", SqlDbType.Int).Value = GetUserId(context.User);
        insert.Parameters.Add("@schedule", SqlDbType.Int).Value = req.ScheduleId;
        insert.Parameters.Add("@qty", SqlDbType.Int).Value = req.Quantity;
        var amount = insert.Parameters.Add("@amount", SqlDbType.Decimal);
        amount.Precision = 18; amount.Scale = 2; amount.Value = price * req.Quantity;
        var bookingId = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));
        // Detect disabled/altered trigger behavior and roll back instead of over/under-selling.
        await using (var verify = new SqlCommand("SELECT SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen=@schedule", db, transaction))
        {
            verify.Parameters.Add("@schedule", SqlDbType.Int).Value = req.ScheduleId;
            if (Convert.ToInt32(await verify.ExecuteScalarAsync(ct)) != booked + req.Quantity)
                throw new InvalidOperationException("INVENTORY_INCREASE_MISMATCH");
        }
        foreach (var traveller in req.Travellers)
        {
            await using var passenger = new SqlCommand("INSERT dbo.CHITIET_HANHKHACH(MaDatTour,HoTen) VALUES (@booking,@name)", db, transaction);
            passenger.Parameters.Add("@booking", SqlDbType.Int).Value = bookingId;
            passenger.Parameters.Add("@name", SqlDbType.NVarChar, 100).Value = traveller.Trim();
            await passenger.ExecuteNonQueryAsync(ct);
        }
        await Audit(db, transaction, GetUserId(context.User), "CreateBooking", bookingId.ToString(), ct);
        await transaction.CommitAsync(ct);
        return Results.Created($"/api/v1/bookings/{bookingId}", new { id = bookingId, status = "Chờ xác nhận", amount = price * req.Quantity, currency = "VND", payment = "Chưa thanh toán" });
    }
    catch (SqlException e) when (e.Number is 1205 or 1222) { return Results.Conflict(new { error = "RETRY_BOOKING" }); }
    catch (SqlException) { return Results.Json(new { error = "DATABASE_UNAVAILABLE" }, statusCode: 503); }
    catch (InvalidOperationException) { return Results.Json(new { error = "BOOKING_UNAVAILABLE" }, statusCode: 503); }
}).RequireAuthorization();

app.MapGet("/api/v1/bookings/me", async (ClaimsPrincipal user, Database database, CancellationToken ct) =>
{
    try
    {
        await using var db = await database.OpenAsync(ct);
        await using var cmd = new SqlCommand(@"SELECT TOP (100) b.MaDatTour, t.TenTour, c.NgayKhoiHanh, b.SoLuongKhach, b.TongTien, b.TrangThaiDat, b.TrangThaiThanhToan
FROM dbo.DATTOUR b JOIN dbo.CHUYENKHOIHANH c ON b.MaChuyen=c.MaChuyen JOIN dbo.TOUR t ON c.MaTour=t.MaTour
WHERE b.MaKhachHang=@user ORDER BY b.MaDatTour DESC", db);
        cmd.Parameters.Add("@user", SqlDbType.Int).Value = GetUserId(user);
        var list = new List<object>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) list.Add(new { id = r.GetInt32(0), tour = r.GetString(1), departure = r.GetDateTime(2), quantity = r.GetInt32(3), amount = r.GetDecimal(4), status = OptString(r, 5), payment = OptString(r, 6) });
        return Results.Ok(new { items = list });
    }
    catch (SqlException) { return Results.Json(new { error = "DATABASE_UNAVAILABLE" }, statusCode: 503); }
    catch (InvalidOperationException) { return Results.Json(new { error = "DATABASE_NOT_CONFIGURED" }, statusCode: 503); }
}).RequireAuthorization();

app.MapPost("/api/v1/bookings/{bookingId:int}/cancel", async (int bookingId, HttpContext context, IAntiforgery csrf, Database database, CancellationToken ct) =>
{
    if (!await csrf.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "CSRF_INVALID" });
    try
    {
        await using var db = await database.OpenAsync(ct);
        await using var tx = (SqlTransaction)await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (!await InventoryTriggersReady(db, tx, ct))
            return Results.Json(new { error = "INVENTORY_TRIGGERS_NOT_READY" }, statusCode: 503);
        await using var read = new SqlCommand(@"SELECT b.MaChuyen,b.SoLuongKhach,b.TrangThaiDat,b.TrangThaiThanhToan,CASE WHEN c.NgayKhoiHanh>DATEADD(HOUR,72,GETDATE()) THEN 1 ELSE 0 END,c.SoChoDaDat
FROM dbo.DATTOUR b WITH (UPDLOCK,HOLDLOCK) JOIN dbo.CHUYENKHOIHANH c WITH (UPDLOCK,HOLDLOCK) ON c.MaChuyen=b.MaChuyen
WHERE b.MaDatTour=@booking AND b.MaKhachHang=@user", db, tx);
        read.Parameters.Add("@booking", SqlDbType.Int).Value = bookingId;
        read.Parameters.Add("@user", SqlDbType.Int).Value = GetUserId(context.User);
        int scheduleId; int qty; int bookedBeforeCancel; string status; string payment; bool cancellationWindow;
        await using (var r = await read.ExecuteReaderAsync(ct))
        {
            if (!await r.ReadAsync(ct)) return Results.NotFound(new { error = "BOOKING_NOT_FOUND" });
            scheduleId = r.GetInt32(0); qty = r.GetInt32(1); status = OptString(r, 2) ?? ""; payment = OptString(r, 3) ?? ""; cancellationWindow = r.GetInt32(4) == 1; bookedBeforeCancel = r.GetInt32(5);
        }
        if (status == "Đã hủy") return Results.Ok(new { id = bookingId, status = "Đã hủy", alreadyCancelled = true });
        if (status != "Chờ xác nhận" || payment != "Chưa thanh toán" || !cancellationWindow)
            return Results.Conflict(new { error = "MANUAL_CANCELLATION_REQUIRED" });
        await using var cancel = new SqlCommand("UPDATE dbo.DATTOUR SET TrangThaiDat=N'Đã hủy' WHERE MaDatTour=@id AND TrangThaiDat=N'Chờ xác nhận'", db, tx);
        cancel.Parameters.Add("@id", SqlDbType.Int).Value = bookingId;
        if (await cancel.ExecuteNonQueryAsync(ct) != 1) return Results.Conflict(new { error = "STATE_CHANGED" });
        // TRG_DATTOUR_HandleCancellation returns seats. Never subtract them twice.
        await using (var verify = new SqlCommand("SELECT SoChoDaDat FROM dbo.CHUYENKHOIHANH WHERE MaChuyen=@schedule", db, tx))
        {
            verify.Parameters.Add("@schedule", SqlDbType.Int).Value = scheduleId;
            if (bookedBeforeCancel < qty || Convert.ToInt32(await verify.ExecuteScalarAsync(ct)) != bookedBeforeCancel - qty)
                throw new InvalidOperationException("INVENTORY_RELEASE_MISMATCH");
        }
        await Audit(db, tx, GetUserId(context.User), "CancelBooking", bookingId.ToString(), ct);
        await tx.CommitAsync(ct);
        return Results.Ok(new { id = bookingId, status = "Đã hủy" });
    }
    catch (SqlException e) when (e.Number is 1205 or 1222) { return Results.Conflict(new { error = "RETRY_CANCELLATION" }); }
    catch (SqlException) { return Results.Json(new { error = "DATABASE_UNAVAILABLE" }, statusCode: 503); }
    catch (InvalidOperationException) { return Results.Json(new { error = "CANCELLATION_FAILED_SAFE" }, statusCode: 503); }
}).RequireAuthorization();

app.MapGet("/api/v1/updates/schedules/{tourId:int}", async (int tourId, HttpContext context, Database database) =>
{
    if (tourId <= 0 || !database.Configured) { context.Response.StatusCode = 503; return; }
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers.CacheControl = "no-cache, no-transform";
    context.Response.Headers.Append("X-Accel-Buffering", "no");
    string? last = null;
    try
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        do
        {
            await using var db = await database.OpenAsync(context.RequestAborted);
            await using var command = new SqlCommand("SELECT MaChuyen,SoChoToiDa-SoChoDaDat AS Available FROM dbo.CHUYENKHOIHANH WHERE MaTour=@tour AND NgayKhoiHanh>GETDATE() ORDER BY MaChuyen", db);
            command.Parameters.Add("@tour", SqlDbType.Int).Value = tourId;
            var availability = new List<object>();
            await using (var r = await command.ExecuteReaderAsync(context.RequestAborted))
                while (await r.ReadAsync(context.RequestAborted)) availability.Add(new { scheduleId = r.GetInt32(0), available = r.GetInt32(1) });
            var payload = JsonSerializer.Serialize(availability);
            if (payload != last)
            {
                await context.Response.WriteAsync($"event: seats\ndata: {payload}\n\n", context.RequestAborted);
                last = payload;
            }
            else await context.Response.WriteAsync(": keep-alive\n\n", context.RequestAborted);
            await context.Response.Body.FlushAsync(context.RequestAborted);
        } while (await timer.WaitForNextTickAsync(context.RequestAborted));
    }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
    catch (SqlException)
    {
        await context.Response.WriteAsync("event: server-error\ndata: {\"error\":\"DATABASE_UNAVAILABLE\"}\n\n");
    }
});
// Route the actual MVC catalogue before the An frontend fallback.
app.MapControllers();
// Do not serve the backend prototype UI for unknown pages; An owns the public UI.
app.MapFallback((HttpContext context) =>
    context.Request.Path.StartsWithSegments("/api")
        ? (IResult)Results.NotFound(new { error = "NOT_FOUND" })
        : Results.Redirect("https://delta-travel-group6-kthp-demo.onrender.com/", permanent: false));
app.Run();

static async Task<bool> InventoryTriggersReady(SqlConnection db, SqlTransaction tx, CancellationToken ct)
{
    await using var check = new SqlCommand(@"SELECT COUNT_BIG(*) FROM sys.triggers
WHERE parent_id=OBJECT_ID(N'dbo.DATTOUR') AND is_disabled=0
AND name IN (N'TRG_DATTOUR_CheckAndLockSeats',N'TRG_DATTOUR_HandleCancellation')", db, tx);
    return Convert.ToInt64(await check.ExecuteScalarAsync(ct)) == 2;
}

static int GetUserId(ClaimsPrincipal user) => int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
static string? OptString(SqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetString(i);
static async Task SignIn(HttpContext context, int userId, string name)
{
    var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
    {
        new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Name, name)
    }, CookieAuthenticationDefaults.AuthenticationScheme));
    await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
}
static async Task Audit(SqlConnection connection, SqlTransaction tx, int actor, string action, string value, CancellationToken ct)
{
    await using var audit = new SqlCommand("INSERT dbo.AUDITLOG(MaNguoiThucHien,HanhDong,DuLieuMoi,ThoiGian) VALUES (@actor,@action,@value,GETDATE())", connection, tx);
    audit.Parameters.Add("@actor", SqlDbType.Int).Value = actor;
    audit.Parameters.Add("@action", SqlDbType.NVarChar, 100).Value = action;
    audit.Parameters.Add("@value", SqlDbType.NVarChar, -1).Value = value;
    await audit.ExecuteNonQueryAsync(ct);
}
public sealed class Database
{
    private readonly string? _connectionString = Environment.GetEnvironmentVariable("SQLSERVER_CONNECTION_STRING");
    public bool Configured => !string.IsNullOrWhiteSpace(_connectionString);
    public async Task<SqlConnection> OpenAsync(CancellationToken ct)
    {
        if (!Configured) throw new InvalidOperationException("SQLSERVER_CONNECTION_STRING not configured");
        var connection = new SqlConnection(_connectionString);
        try { await connection.OpenAsync(ct); return connection; }
        catch { await connection.DisposeAsync(); throw; }
    }
}
public sealed record UserPassword;
public sealed record RegisterRequest(string? FullName, string? Email, string? Phone, string? Password);
public sealed record LoginRequest(string? Email, string? Password);
public sealed record BookingQuote(int ScheduleId, int Quantity);
public sealed record CreateBooking(int ScheduleId, int Quantity, string[]? Travellers);