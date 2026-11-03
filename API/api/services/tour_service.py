"""Tour and schedule serializers."""
from api.core import iso


def public_tour(t):
    return {
        "id": t.id,
        "slug": t.slug,
        "title": t.title,
        "region": t.region,
        "duration": t.duration,
        "departure": t.departure,
        "transport": t.transport,
        "image": t.image,
        "description": t.description,
        "price": t.price,
        "originalPrice": t.original_price,
        "isFlashSale": t.flash_sale,
        "updatedAt": iso(t.updated_at),
    }

def availability(s):
    return {
        "id": s.id,
        "tourId": s.tour_id,
        "departureAt": iso(s.departure_at),
        "totalSeats": s.total_seats,
        "availableSeats": s.total_seats - s.reserved_seats,
        "active": s.active,
    }
