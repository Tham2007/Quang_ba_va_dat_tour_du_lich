"""HTTP URL/method registration; request handling is in api.controllers."""

from fastapi import APIRouter
from api.controllers import auth_controller as controller

router = APIRouter()

router.add_api_route(
    "/api/v1/auth/register", controller.register, methods=["POST"], status_code=201
)
router.add_api_route("/api/v1/auth/login", controller.login, methods=["POST"])
router.add_api_route("/api/v1/auth/me", controller.current, methods=["GET"])
router.add_api_route("/api/v1/auth/session", controller.auth_session, methods=["GET"])
router.add_api_route("/api/v1/auth/logout", controller.logout, methods=["POST"])
router.add_api_route(
    "/api/v1/auth/profile", controller.change_profile, methods=["PATCH"]
)
router.add_api_route("/api/v1/favorites", controller.favorites, methods=["GET"])
router.add_api_route(
    "/api/v1/favorites/{tour_id}", controller.favorite_add, methods=["POST"]
)
router.add_api_route(
    "/api/v1/favorites/{tour_id}", controller.favorite_remove, methods=["DELETE"]
)
router.add_api_route(
    "/api/v1/auth/change-password", controller.change_password, methods=["POST"]
)
