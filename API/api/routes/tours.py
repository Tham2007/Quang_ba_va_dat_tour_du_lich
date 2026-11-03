"""HTTP URL/method registration; request handling is in api.controllers."""

from fastapi import APIRouter
from api.controllers import tour_controller as controller

router = APIRouter()

router.add_api_route("/api/v1/tours", controller.tours, methods=["GET"])
router.add_api_route("/api/v1/tours/{tour_id}", controller.tour_one, methods=["GET"])
router.add_api_route(
    "/api/v1/tours/{tour_id}/schedules", controller.schedules, methods=["GET"]
)
