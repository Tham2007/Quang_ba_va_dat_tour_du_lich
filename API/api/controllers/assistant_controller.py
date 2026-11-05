"""Clearly disclosed rule-based tour FAQ (not a generative AI integration)."""

import unicodedata

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from api.core import db_session
from api.models import Schedule, Tour, now
from api.schemas import AssistantMessage
from api.core.security import rate_limit


TRAVEL_TERMS = (
    "tour",
    "du lich",
    "di dau",
    "di diem",
    "hanh trinh",
    "lich trinh",
    "khoi hanh",
    "chuyen di",
    "dat ve",
    "dat tour",
    "du thuyen",
    "khach san",
    "di chuyen",
    "phuong tien",
    "di lai",
    "hanh ly",
    "visa",
    "thoi tiet",
    "am thuc",
    "mon an",
    "diem tham quan",
    "gia tour",
)
DESTINATIONS = (
    "ha long",
    "lan ha",
    "sa pa",
    "sapa",
    "da nang",
    "hoi an",
    "phu quoc",
    "da lat",
    "can tho",
    "mien tay",
    "fansipan",
    "moc chau",
)


def _fold(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    folded = "".join(
        char for char in decomposed if unicodedata.category(char) != "Mn"
    )
    return folded.replace("đ", "d")


def _matching_tours(db: Session, message: str):
    tours = db.scalars(
        select(Tour).where(Tour.active.is_(True)).order_by(Tour.price, Tour.id)
    ).all()
    folded_message = _fold(message)
    destination_matches = [
        tour
        for tour in tours
        if any(
            destination in folded_message
            and destination in _fold(tour.title + " " + tour.description)
            for destination in DESTINATIONS
        )
    ]
    named = destination_matches or [
        tour
        for tour in tours
        if any(
            len(term) > 3 and _fold(term) in folded_message
            for term in (tour.title, tour.region)
        )
    ]
    return named or tours


def assistant_message(
    body: AssistantMessage, request: Request, db: Session = Depends(db_session)
):
    rate_limit(
        "assistant:" + str(request.client.host if request.client else "unknown"), 20
    )
    text = _fold(body.message)
    tours = _matching_tours(db, body.message)
    has_tour_context = any(destination in text for destination in DESTINATIONS) or (
        bool(tours)
        and any(
            _fold(tour.title) in text or _fold(tour.region) in text for tour in tours
        )
    )
    if not has_tour_context and not any(term in text for term in TRAVEL_TERMS):
        answer = (
            "Xin lỗi, tôi chỉ hỗ trợ các câu hỏi về tour, điểm đến, lịch trình, "
            "giá và dịch vụ du lịch của Delta Travel."
        )
    elif any(x in text for x in ["gia", "bao nhieu", "price", "chi phi"]):
        sample = tours[:6]
        answer = (
            "Giá niêm yết hiện tại"
            + (f" cho {sample[0].title}: " if len(sample) == 1 else ": ")
            + "; ".join(f"{t.title}: {t.price:,} VND" for t in sample)
            + ". Kiểm tra lịch và báo giá chính thức trước khi đặt."
        )
    elif any(x in text for x in ["huy", "hoan tien", "cancel"]):
        answer = "Đơn chưa thanh toán có thể hủy khi còn hơn 72 giờ trước khởi hành. Đơn đã thanh toán cần liên hệ bộ phận hỗ trợ. Chưa có hoàn tiền tự động."
    elif any(x in text for x in ["lich", "ngay khoi hanh", "con cho", "cho trong"]):
        lines = []
        for tour in tours[:6]:
            schedules = db.scalars(
                select(Schedule)
                .where(
                    Schedule.tour_id == tour.id,
                    Schedule.active.is_(True),
                    Schedule.departure_at > now(),
                )
                .order_by(Schedule.departure_at)
                .limit(1)
            ).all()
            if schedules:
                schedule = schedules[0]
                lines.append(
                    f"{tour.title}: {schedule.departure_at:%d/%m/%Y}, "
                    f"còn {schedule.total_seats - schedule.reserved_seats} chỗ"
                )
        answer = (
            "Lịch khởi hành gần nhất: " + "; ".join(lines)
            if lines
            else "Hiện chưa có lịch khởi hành phù hợp được công bố. Vui lòng thử lại sau."
        )
    elif any(x in text for x in ["dat", "booking", "thanh toan"]):
        answer = (
            "Bạn chọn tour và lịch khởi hành còn chỗ, gửi yêu cầu đặt tour để hệ thống "
            "giữ chỗ tạm thời. Thanh toán chỉ được xác nhận sau khi nhân viên kiểm tra."
        )
    elif any(x in text for x in ["tour", "di dau", "diem den", "dia diem"]):
        answer = "Các tour phù hợp trong danh mục: " + "; ".join(
            f"{tour.title} ({tour.price:,} VND)" for tour in tours[:6]
        )
    else:
        answer = (
            "Tôi hỗ trợ thông tin tour, điểm đến, lịch khởi hành, giá và chính sách "
            "đặt/hủy của Delta Travel. Bạn muốn hỏi về nội dung nào?"
        )
    return {
        "answer": answer,
        "mode": "rule_based",
        "source": "Delta Travel local database/policy",
    }
