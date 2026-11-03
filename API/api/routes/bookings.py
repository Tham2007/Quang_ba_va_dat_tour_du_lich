"""HTTP URL/method registration; request handling is in api.controllers."""

from fastapi import APIRouter
from api.controllers import booking_controller as controller

router = APIRouter()

router.add_api_route("/api/v1/bookings/quote", controller.quote, methods=["POST"])
router.add_api_route(
    "/api/v1/bookings", controller.create_booking, methods=["POST"], status_code=201
)
router.add_api_route("/api/v1/bookings", controller.my_bookings, methods=["GET"])
router.add_api_route(
    "/api/v1/bookings/{booking_id}", controller.my_booking, methods=["GET"]
)
router.add_api_route(
    "/api/v1/bookings/{booking_id}/cancel", controller.cancel_booking, methods=["POST"]
)
