"""HTTP URL/method registration; request handling is in api.controllers."""
from fastapi import APIRouter
from api.controllers import assistant_controller as controller

router = APIRouter()

router.add_api_route("/api/v1/assistant/chat", controller.assistant_message, methods=["POST"])
