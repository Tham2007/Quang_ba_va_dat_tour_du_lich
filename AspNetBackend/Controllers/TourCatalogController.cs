using System.Data;
using DeltaTravel.AspNet.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace DeltaTravel.AspNet.Controllers;

/// <summary>
/// ASP.NET Core MVC Controller + Razor View demonstration of the SQL Server
/// catalogue. The team's official frontend remains An's unchanged UI.
/// </summary>
[Route("mvc/tours")]
public sealed class TourCatalogController : Controller
{
    private readonly Database _database;

    public TourCatalogController(Database database) => _database = database;

    [HttpGet("")]
    [HttpGet("/mvc")]
    public async Task<IActionResult> Index([FromQuery] string? q, CancellationToken ct)
    {
        var query = (q ?? string.Empty).Trim();
        if (query.Length > 100) query = query[..100];

        if (!_database.Configured)
        {
            Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            return View(new TourCatalogViewModel
            {
                Query = query,
                StatusMessage = "SQL Server chưa được cấu hình. Đây là giao diện MVC kiểm thử, không phải dữ liệu đặt tour thật."
            });
        }

        try
        {
            await using var conn = await _database.OpenAsync(ct);
            await using var cmd = new SqlCommand(@"
SELECT TOP (30) t.MaTour, t.TenTour, d.TenDanhMuc, t.GiaKhuyenNghi
FROM dbo.TOUR t
INNER JOIN dbo.DANHMUC d ON d.MaDanhMuc = t.MaDanhMuc
WHERE t.TrangThai = 1
  AND (@q = N'' OR t.TenTour LIKE N'%' + @q + N'%')
ORDER BY t.MaTour DESC", conn);
            cmd.Parameters.Add("@q", SqlDbType.NVarChar, 100).Value = query;

            var items = new List<TourCatalogItem>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                items.Add(new TourCatalogItem(
                    reader.GetInt32(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetDecimal(3)));
            }
            return View(new TourCatalogViewModel { Query = query, Tours = items });
        }
        catch (SqlException)
        {
            Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            return View(new TourCatalogViewModel
            {
                Query = query,
                StatusMessage = "Không thể truy cập SQL Server. Không sử dụng dữ liệu giả để thay thế."
            });
        }
        catch (InvalidOperationException)
        {
            Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            return View(new TourCatalogViewModel
            {
                Query = query,
                StatusMessage = "SQL Server chưa sẵn sàng. Vui lòng thử lại sau."
            });
        }
    }
}
