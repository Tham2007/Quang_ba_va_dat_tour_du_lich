namespace DeltaTravel.AspNet.Models;

/// <summary>
/// Read-only MVC projection of the existing dbo.TOUR and dbo.DANHMUC schema.
/// This is a staging demonstration, not a second database or source of truth.
/// </summary>
public sealed record TourCatalogItem(int Id, string Name, string Category, decimal Price);

public sealed class TourCatalogViewModel
{
    public string? Query { get; init; }
    public string? StatusMessage { get; init; }
    public IReadOnlyList<TourCatalogItem> Tours { get; init; } = [];
}
