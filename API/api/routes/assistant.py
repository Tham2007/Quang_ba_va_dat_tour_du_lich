"""Clearly disclosed rule-based tour FAQ (not a generative AI integration)."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from api.core import db_session
from api.models import Tour
from api.schemas import AssistantMessage
from api.security import rate_limit

router = APIRouter()


@router.post("/api/v1/assistant/chat")
def assistant_message(
    body: AssistantMessage, request: Request, db: Session = Depends(db_session)
):
    rate_limit(
        "assistant:" + str(request.client.host if request.client else "unknown"), 20
    )
    text = body.message.lower()
    if any(x in text for x in ["giá", "bao nhiêu", "price"]):
        sample = db.scalars(
            select(Tour).where(Tour.active.is_(True)).order_by(Tour.price).limit(6)
        ).all()
        answer = (
            "Giá niêm yết hiện tại: "
            + "; ".join(f"{t.title}: {t.price:,} VND" for t in sample)
            + ". Kiểm tra lịch và báo giá chính thức trước khi đặt."
        )
    elif any(x in text for x in ["hủy", "hoàn tiền", "cancel"]):
        answer = "Đơn chưa thanh toán có thể hủy khi còn hơn 72 giờ trước khởi hành. Đơn đã thanh toán cần liên hệ bộ phận hỗ trợ. Chưa có hoàn tiền tự động."
    elif any(x in text for x in ["tour", "đi đâu", "địa điểm"]):
        answer = "Delta Travel đang hiển thị các tour Hạ Long, Đà Nẵng, Phú Quốc, Đà Lạt, Sa Pa và Miền Tây (dữ liệu demo)."
    else:
        answer = "Tôi hỗ trợ thông tin tour, giá và chính sách hủy. Hãy hỏi về một trong các chủ đề đó. Đây là trợ lý theo quy tắc, không phải AI sinh nội dung."
    return {
        "answer": answer,
        "mode": "rule_based",
        "source": "Delta Travel local database/policy",
    }
