"""Tour and schedule serializers."""

import json

from sqlalchemy import select

from api.core import iso
from api.models import ItineraryItem, TourCostItem


def tour_images(image_value):
    try:
        images = json.loads(image_value)
    except (TypeError, json.JSONDecodeError):
        images = None
    if isinstance(images, list) and all(isinstance(image, str) for image in images):
        return [image for image in images if image]
    return [image_value] if image_value else []


def public_tour(t):
    images = tour_images(t.image)
    return {
        "id": t.id,
        "slug": t.slug,
        "title": t.title,
        "region": t.region,
        "duration": t.duration,
        "departure": t.departure,
        "transport": t.transport,
        "image": images[0] if images else "",
        "images": images,
        "description": t.description,
        "price": t.price,
        "isFlashSale": t.flash_sale,
        "updatedAt": iso(t.updated_at),
    }


def itinerary_items(db, tour_id):
    return [
        {
            "dayNumber": item.day_number,
            "sequence": item.sequence,
            "category": item.category,
            "title": item.title,
            "description": item.description,
            "location": item.location,
            "startTime": item.start_time.strftime("%H:%M") if item.start_time else None,
        }
        for item in db.scalars(
            select(ItineraryItem)
            .where(ItineraryItem.tour_id == tour_id)
            .order_by(ItineraryItem.day_number, ItineraryItem.sequence)
        ).all()
    ]


def admin_tour_details(db, tour):
    costs = db.scalars(
        select(TourCostItem)
        .where(TourCostItem.tour_id == tour.id)
        .order_by(TourCostItem.category, TourCostItem.name)
    ).all()
    cost_items = [
        {
            "id": item.id,
            "category": item.category,
            "name": item.name,
            "notes": item.notes,
            "amountPerPerson": item.amount_per_person,
        }
        for item in costs
    ]
    return {
        "tour": {**public_tour(tour), "active": tour.active},
        "baseCost": sum(item.amount_per_person for item in costs),
        "grossMarginPerPerson": tour.price
        - sum(item.amount_per_person for item in costs),
        "costItems": cost_items,
        "itinerary": itinerary_items(db, tour.id),
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
