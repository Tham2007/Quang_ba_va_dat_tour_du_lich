"""Quote, create, retrieve and cancel bookings (demo persistence only)."""
import hashlib
import uuid
from datetime import timedelta
from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from api.core import HOLD_MINUTES, db_session, fail, me, new_id, utc
from api.logic import totals, check_people, sweep, booking_dict
from api.models import Booking, Schedule, Tour, lock_writes, now
from api.schemas import QuoteInput, BookingInput

router = APIRouter()

@router.post('/api/v1/bookings/quote')
def quote(body:QuoteInput,db:Session=Depends(db_session)):
    seats=check_people(body.adults,body.children,body.infants)
    s=db.get(Schedule,body.schedule_id)
    t=db.get(Tour,s.tour_id) if s else None
    if not s or not t or not s.active or not t.active or utc(s.departure_at)<=now():
        fail(404,'Lịch khởi hành không tồn tại.')
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
    db.commit()
    return {'scheduleId':s.id,'tourId':t.id,'seats':seats,'availableSeats':s.total_seats-s.reserved_seats,
            'unitPrice':t.price,'totalPrice':totals(t.price,body.adults,body.children,body.infants),
            'currency':'VND','pricingRules':{'childPercent':75,'infantPercent':10},
            'addonsSupported':False,'vouchersSupported':False}



@router.post('/api/v1/bookings',status_code=201)
def create_booking(body:BookingInput,request:Request,user=Depends(me),db:Session=Depends(db_session),
                   idempotency_key:str=Header(...,alias='Idempotency-Key')):
    try: uuid.UUID(idempotency_key)
    except (ValueError,TypeError): fail(422,'Idempotency-Key phải là UUID.')
    seats=check_people(body.adults,body.children,body.infants)
    payload=body.model_dump_json(exclude_none=True)
    fingerprint=hashlib.sha256(payload.encode()).hexdigest()
    with db.begin_nested():
        lock_writes(db)
        existing=db.scalar(select(Booking).where(Booking.user_id==user.id,Booking.idempotency_key==idempotency_key))
        if existing:
            if existing.payload_fingerprint!=fingerprint:fail(409,'Idempotency-Key đã được sử dụng với nội dung khác.')
            return booking_dict(existing)
        sweep(db)
        s=db.scalar(select(Schedule).where(Schedule.id==body.schedule_id).with_for_update())
        t=db.get(Tour,s.tour_id) if s else None
        if not s or not t or not s.active or not t.active or utc(s.departure_at)<=now()+timedelta(hours=72):
            fail(409,'Không có lịch khởi hành hợp lệ (cần trước ít nhất 72 giờ).')
        if s.total_seats-s.reserved_seats<seats:fail(409,'Tour không còn đủ chỗ.')
        s.reserved_seats+=seats
        b=Booking(id=new_id(),reference='DT-'+uuid.uuid4().hex[:14].upper(),user_id=user.id,
                  schedule_id=s.id,idempotency_key=idempotency_key,payload_fingerprint=fingerprint,
                  tour_title=t.title,customer_name=body.customer_name.strip(),customer_phone=body.customer_phone,
                  customer_email=body.customer_email,note=body.note,adults=body.adults,children=body.children,
                  infants=body.infants,seats_held=seats,unit_price=t.price,
                  total_price=totals(t.price,body.adults,body.children,body.infants),
                  status='PENDING_PAYMENT',expires_at=now()+timedelta(minutes=HOLD_MINUTES))
        db.add(b)
    db.commit()
    return booking_dict(b)


@router.get('/api/v1/bookings')
def my_bookings(user=Depends(me),db:Session=Depends(db_session)):
    with db.begin_nested():
        lock_writes(db);sweep(db)
    db.commit()
    return [booking_dict(b) for b in db.scalars(select(Booking).where(Booking.user_id==user.id)
                  .order_by(Booking.created_at.desc())).all()]


@router.get('/api/v1/bookings/{booking_id}')
def my_booking(booking_id:str,user=Depends(me),db:Session=Depends(db_session)):
    with db.begin_nested():
        lock_writes(db);sweep(db)
    db.commit()
    b=db.get(Booking,booking_id)
    if not b or (b.user_id!=user.id and user.role!='ADMIN'):fail(404,'Không tìm thấy đơn.')
    return booking_dict(b)


@router.post('/api/v1/bookings/{booking_id}/cancel')
def cancel_booking(booking_id:str,user=Depends(me),db:Session=Depends(db_session)):
    with db.begin_nested():
        lock_writes(db);sweep(db)
        b=db.scalar(select(Booking).where(Booking.id==booking_id,Booking.user_id==user.id).with_for_update())
        if not b:fail(404,'Không tìm thấy đơn.')
        s=db.get(Schedule,b.schedule_id)
        if b.status=='CANCELLED':return booking_dict(b)
        if b.status!='PENDING_PAYMENT':fail(409,'Không thể tự hủy đơn đã thanh toán hoặc hết hạn.')
        if utc(s.departure_at)<=now()+timedelta(hours=72):fail(409,'Đã qua hạn hủy 72 giờ.')
        b.status='CANCELLED';s.reserved_seats-=b.seats_held
        if s.reserved_seats<0:raise RuntimeError('Inventory invariant violated')
    db.commit()
    return booking_dict(b)
