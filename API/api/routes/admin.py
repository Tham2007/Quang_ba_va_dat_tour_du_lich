"""HTTP URL/method registration; request handling is in api.controllers."""

from fastapi import APIRouter
from api.controllers import admin_controller as controller

router = APIRouter()

router.add_api_route(
    "/api/v1/admin/tours",
    controller.admin_tour_create,
    methods=["POST"],
    status_code=201,
)
router.add_api_route(
    "/api/v1/admin/tours/{tour_id}", controller.admin_tour_patch, methods=["PATCH"]
)
router.add_api_route(
    "/api/v1/admin/tours/{tour_id}/details",
    controller.get_admin_tour_details,
    methods=["GET"],
)
router.add_api_route(
    "/api/v1/admin/tours/{tour_id}/details",
    controller.replace_admin_tour_details,
    methods=["PUT"],
)
router.add_api_route(
    "/api/v1/admin/tours/{tour_id}", controller.admin_tour_delete, methods=["DELETE"]
)
router.add_api_route(
    "/api/v1/admin/schedules",
    controller.add_schedule,
    methods=["POST"],
    status_code=201,
)
router.add_api_route(
    "/api/v1/admin/schedules/{schedule_id}",
    controller.patch_schedule,
    methods=["PATCH"],
)
router.add_api_route(
    "/api/v1/admin/bookings/{booking_id}/confirm-payment",
    controller.confirm_payment,
    methods=["POST"],
)
router.add_api_route(
    "/api/v1/admin/bookings", controller.admin_bookings, methods=["GET"]
)
router.add_api_route("/api/v1/admin/tours", controller.admin_tours, methods=["GET"])
router.add_api_route(
    "/api/v1/admin/schedules", controller.admin_all_schedules, methods=["GET"]
)
router.add_api_route("/api/v1/admin/metrics", controller.metrics, methods=["GET"])
router.add_api_route("/api/v1/admin/dashboard", controller.metrics, methods=["GET"])
router.add_api_route("/api/v1/admin/audit", controller.audit_list, methods=["GET"])
