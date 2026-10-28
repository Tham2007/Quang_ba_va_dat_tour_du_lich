"""Delta Travel 2.0 backend. API is authority for prices, inventory and paid status."""
import hashlib
import json
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends, Request, Response, Header
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from api.models import (Base, engine, SessionLocal, User, SessionToken, Tour,
                        Schedule, Booking, Audit, Favorite, lock_writes, now)
from api.security import hash_password, verify_password, random_token, token_hash, rate_limit
from api.seed import seed_demo

ENV = os.getenv('DELTA_ENV','development')
SECURE_COOKIE = ENV == 'production'
SESSION_NAME = 'delta_session'
CSRF_NAME = 'delta_csrf'
HOLD_MINUTES = 15


def utc(dt):
    if dt is None: return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def iso(dt):
    return utc(dt).isoformat() if dt else None


def new_id():
    return str(uuid.uuid4())


def fail(code, message):
    raise HTTPException(code, message)


@asynccontextmanager
async def lifespan(app):
    if ENV == 'production':
        if engine.dialect.name == 'sqlite':
            raise RuntimeError('Production requires PostgreSQL + audited migrations.')
        if os.getenv('DEMO_SEED') == '1':
            raise RuntimeError('DEMO_SEED must never run in production.')
        if os.getenv('AUTO_CREATE_SCHEMA') == '1':
            raise RuntimeError('Production requires reviewed schema migrations.')
    elif os.getenv('AUTO_CREATE_SCHEMA','1') == '1':
        Base.metadata.create_all(engine)
        if os.getenv('DEMO_SEED','1') == '1':
            seed_demo()
    yield


app = FastAPI(title='Delta Travel 2.0 API', version='2.0.0', lifespan=lifespan,
                 docs_url=None if ENV=='production' else '/docs',
                 redoc_url=None if ENV=='production' else '/redoc')

@app.middleware('http')
async def safe_headers(request:Request,call_next):
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='strict-origin-when-cross-origin'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
    if request.url.path not in ('/docs','/redoc'):
        response.headers['Content-Security-Policy']=(
            "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' https://raw.githubusercontent.com data:; "
        "connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'")
    return response


@app.exception_handler(IntegrityError)
def integrity_error(request, exc):
    return JSONResponse(status_code=409, content={'detail':'Dữ liệu trùng hoặc không hợp lệ.'})


def db_session():
    with SessionLocal() as db:
        yield db


def email_ok(v):
    v=v.strip().lower()
    if len(v)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',v):
        raise ValueError('Email không hợp lệ')
    return v


class Signup(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str
    phone: str = Field(pattern=r'^0[35789][0-9]{8}$')
    password: str = Field(min_length=12, max_length=128)
    @field_validator('email')
    @classmethod
    def valid_email(cls,v): return email_ok(v)
    @field_validator('full_name')
    @classmethod
    def valid_name(cls,v):
        v=v.strip()
        if len(v)<2:raise ValueError('Họ tên phải có ít nhất 2 ký tự.')
        return v


class Login(BaseModel):
    email: str
    password: str
    @field_validator('email')
    @classmethod
    def valid_email(cls,v): return email_ok(v)


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    full_name: str | None = Field(default=None,min_length=2,max_length=120)
    phone: str | None = Field(default=None,pattern=r'^0[35789][0-9]{8}$')


class ChangePassword(BaseModel):
    old_password: str
    new_password: str = Field(min_length=12, max_length=128)


class BookingInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schedule_id: str = Field(min_length=1, max_length=36)
    adults: int = Field(ge=1, le=20)
    children: int = Field(ge=0, le=20)
    infants: int = Field(ge=0, le=20)
    customer_name: str = Field(min_length=2, max_length=120)
    customer_phone: str = Field(pattern=r'^0[35789][0-9]{8}$')
    customer_email: str
    note: str = Field(default='', max_length=500)
    @field_validator('customer_email')
    @classmethod
    def valid_email(cls,v): return email_ok(v)
    @field_validator('customer_name')
    @classmethod
    def valid_customer(cls,v):
        if len(v.strip())<2:raise ValueError('Tên khách không hợp lệ.')
        return v.strip()
    @field_validator('infants')
    @classmethod
    def non_neg(cls,v):return v


class QuoteInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schedule_id: str
    adults: int = Field(ge=1, le=20)
    children: int = Field(ge=0, le=20)
    infants: int = Field(ge=0, le=20)


class TourPatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    price: int | None = Field(default=None, ge=1, le=2_000_000_000)
    original_price: int | None = Field(default=None, ge=1, le=2_000_000_000)
    description: str | None = Field(default=None, max_length=6000)
    active: bool | None = None
    flash_sale: bool | None = None


class TourCreate(TourPatch):
    id: str = Field(pattern=r'^DL-[A-Z0-9]{2,20}$')
    slug: str = Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
    title: str = Field(min_length=3, max_length=255)
    price: int = Field(ge=1, le=2_000_000_000)
    original_price: int = Field(ge=1, le=2_000_000_000)
    region: str = Field(pattern=r'^(north|central|south)$')
    duration: str = Field(min_length=3, max_length=30)
    departure: str = Field(min_length=2, max_length=255)
    transport: str = Field(min_length=2, max_length=255)
    image: str = Field(default='', max_length=1200)


class ScheduleCreate(BaseModel):
    tour_id: str
    departure_at: datetime
    total_seats: int = Field(ge=1, le=10000)
    @field_validator('departure_at')
    @classmethod
    def tz_required(cls,v):
        if v.tzinfo is None: raise ValueError('departure_at must have UTC offset')
        return v


class SchedulePatch(BaseModel):
    total_seats: int | None = Field(default=None, ge=1, le=10000)
    active: bool | None = None


class PaymentEvidence(BaseModel):
    reference: str = Field(min_length=8, max_length=250)


def me(request:Request, db:Session=Depends(db_session)):
    raw=request.cookies.get(SESSION_NAME,'')
    if not raw: fail(401,'Bạn cần đăng nhập.')
    session=db.get(SessionToken,token_hash(raw))
    if not session or utc(session.expires_at)<=now():fail(401,'Phiên đăng nhập hết hạn.')
    u=db.get(User,session.user_id)
    if not u or not u.active:fail(401,'Tài khoản không hoạt động.')
    if request.method not in ('GET','HEAD','OPTIONS'):
        header=request.headers.get('X-CSRF-Token','')
        c=request.cookies.get(CSRF_NAME,'')
        if not c or not header or not __import__('hmac').compare_digest(c,header) or token_hash(header)!=session.csrf_hash:
            fail(403,'CSRF token không hợp lệ.')
    return u


def admin(user=Depends(me)):
    if user.role!='ADMIN': fail(403,'Chỉ quản trị viên được phép.')
    return user


def user_dict(u):
    return {'id':u.id,'fullName':u.full_name,'email':u.email,'phone':u.phone,
            'role':u.role,'createdAt':iso(u.created_at),'updatedAt':iso(u.updated_at)}


def set_auth_cookies(res, db, u):
    raw=random_token(); csrf=random_token()
    db.add(SessionToken(token_hash=token_hash(raw),user_id=u.id,csrf_hash=token_hash(csrf),
                        expires_at=now()+timedelta(days=7)))
    res.set_cookie(SESSION_NAME,raw,max_age=7*86400,httponly=True,secure=SECURE_COOKIE,
                   samesite='strict',path='/')
    res.set_cookie(CSRF_NAME,csrf,max_age=7*86400,httponly=False,secure=SECURE_COOKIE,
                   samesite='strict',path='/')


@app.get('/api/v1/health/ready')
def ready(db:Session=Depends(db_session)):
    db.execute(select(func.count()).select_from(Tour)).scalar_one()
    return {'status':'ok','db':'connected'}


@app.post('/api/v1/auth/register',status_code=201)
def register(body:Signup, request:Request, response:Response, db:Session=Depends(db_session)):
    rate_limit('register:'+str(request.client.host if request.client else 'unknown'),5)
    with db.begin():
        lock_writes(db)
        if db.scalar(select(User.id).where((User.email==body.email)|(User.phone==body.phone))):
            fail(409,'Email hoặc số điện thoại đã đăng ký.')
        u=User(id=new_id(),full_name=body.full_name.strip(),email=body.email,phone=body.phone,
               password_hash=hash_password(body.password),role='CUSTOMER')
        db.add(u)
        db.flush()
        set_auth_cookies(response,db,u)
    return user_dict(u)


@app.post('/api/v1/auth/login')
def login(body:Login,request:Request,response:Response,db:Session=Depends(db_session)):
    ip=request.client.host if request.client else 'unknown'
    rate_limit('login:'+ip,10)
    u=db.scalar(select(User).where(User.email==body.email))
    if not u or not u.active or not verify_password(body.password,u.password_hash):
        fail(401,'Thông tin đăng nhập không chính xác.')
    with db.begin_nested():
        set_auth_cookies(response,db,u)
    db.commit()
    return user_dict(u)


@app.get('/api/v1/auth/me')
def current(user=Depends(me)):
    return user_dict(user)


@app.get('/api/v1/auth/session')
def auth_session(request:Request, response:Response, db:Session=Depends(db_session)):
    """Non-error bootstrap probe for anonymous visitors.

    This is NOT an authentication bypass: /auth/me and every protected
    endpoint keep their 401/403 semantics. Session tokens are never returned.
    """
    response.headers['Cache-Control'] = 'no-store'
    raw = request.cookies.get(SESSION_NAME, '')
    if not raw:
        return {'authenticated': False, 'user': None}
    session = db.get(SessionToken, token_hash(raw))
    if session is None or utc(session.expires_at) <= now():
        return {'authenticated': False, 'user': None}
    u = db.get(User, session.user_id)
    if u is None or not u.active:
        return {'authenticated': False, 'user': None}
    return {'authenticated': True, 'user': user_dict(u)}


@app.post('/api/v1/auth/logout')
def logout(request:Request,response:Response,user=Depends(me),db:Session=Depends(db_session)):
    with db.begin_nested():
        s=db.get(SessionToken,token_hash(request.cookies[SESSION_NAME]))
        if s: db.delete(s)
    db.commit()
    for c in (SESSION_NAME,CSRF_NAME): response.delete_cookie(c,path='/',samesite='strict',secure=SECURE_COOKIE)
    return {'status':'logged_out'}


@app.patch('/api/v1/auth/profile')
def change_profile(body:ProfilePatch,user=Depends(me),db:Session=Depends(db_session)):
    patch=body.model_dump(exclude_unset=True)
    if not patch or any(v is None for v in patch.values()):fail(422,'Không có nội dung hợp lệ để cập nhật.')
    with db.begin_nested():
        lock_writes(db)
        locked=db.scalar(select(User).where(User.id==user.id).with_for_update())
        if 'full_name' in patch: locked.full_name=patch['full_name'].strip()
        if 'phone' in patch: locked.phone=patch['phone']
    db.commit()
    return user_dict(locked)


@app.get('/api/v1/favorites')
def favorites(user=Depends(me),db:Session=Depends(db_session)):
    return [f.tour_id for f in db.scalars(select(Favorite).where(Favorite.user_id==user.id)).all()]


@app.post('/api/v1/favorites/{tour_id}')
def favorite_add(tour_id:str,user=Depends(me),db:Session=Depends(db_session)):
    with db.begin_nested():
        lock_writes(db)
        t=db.get(Tour,tour_id)
        if not t or not t.active:fail(404,'Không tìm thấy tour.')
        existing=db.scalar(select(Favorite).where(Favorite.tour_id==tour_id,Favorite.user_id==user.id))
        if not existing:db.add(Favorite(id=new_id(),user_id=user.id,tour_id=tour_id))
    db.commit()
    return {'saved':True,'tourId':tour_id}


@app.delete('/api/v1/favorites/{tour_id}')
def favorite_remove(tour_id:str,user=Depends(me),db:Session=Depends(db_session)):
    with db.begin_nested():
        lock_writes(db)
        existing=db.scalar(select(Favorite).where(Favorite.tour_id==tour_id,Favorite.user_id==user.id))
        if existing:db.delete(existing)
    db.commit()
    return {'saved':False,'tourId':tour_id}


@app.post('/api/v1/auth/change-password')
def change_password(body:ChangePassword,request:Request,response:Response,user=Depends(me),db:Session=Depends(db_session)):
    if not verify_password(body.old_password,user.password_hash): fail(400,'Mật khẩu hiện tại không đúng.')
    with db.begin_nested():
        user.password_hash=hash_password(body.new_password)
        for session in db.scalars(select(SessionToken).where(SessionToken.user_id==user.id)).all():
            db.delete(session)
    db.commit()
    response.delete_cookie(SESSION_NAME,path='/',samesite='strict',secure=SECURE_COOKIE)
    response.delete_cookie(CSRF_NAME,path='/',samesite='strict',secure=SECURE_COOKIE)
    return {'status':'changed','loginRequired':True}


def public_tour(t):
    return {'id':t.id,'slug':t.slug,'title':t.title,'region':t.region,'duration':t.duration,
            'departure':t.departure,'transport':t.transport,'image':t.image,
            'description':t.description,'price':t.price,'originalPrice':t.original_price,
            'isFlashSale':t.flash_sale,'updatedAt':iso(t.updated_at)}


def sweep(db):
    """Release expired unpaid holds inside the caller's write transaction."""
    expired=db.scalars(select(Booking).where(Booking.status=='PENDING_PAYMENT', Booking.expires_at<=now())
                      .with_for_update()).all()
    for b in expired:
        sched=db.get(Schedule,b.schedule_id)
        if sched:
            sched.reserved_seats-=b.seats_held
            if sched.reserved_seats<0: raise RuntimeError('Inventory invariant violated')
        b.status='EXPIRED'
    return len(expired)


def availability(s):
    return {'id':s.id,'tourId':s.tour_id,'departureAt':iso(s.departure_at),
            'totalSeats':s.total_seats,'availableSeats':s.total_seats-s.reserved_seats,
            'active':s.active}


@app.get('/api/v1/tours')
def tours(q:str='',region:str='',flash:bool=False,max_price:int|None=None,db:Session=Depends(db_session)):
    stmt=select(Tour).where(Tour.active.is_(True))
    if region: stmt=stmt.where(Tour.region==region)
    if flash: stmt=stmt.where(Tour.flash_sale.is_(True))
    if max_price is not None: stmt=stmt.where(Tour.price<=max_price)
    if q: stmt=stmt.where(Tour.title.ilike('%'+q.replace('%','\\%').replace('_','\\_')+'%', escape='\\'))
    return [public_tour(t) for t in db.scalars(stmt.order_by(Tour.id)).all()]


@app.get('/api/v1/tours/{tour_id}')
def tour_one(tour_id:str,db:Session=Depends(db_session)):
    t=db.get(Tour,tour_id)
    if not t or not t.active: fail(404,'Không tìm thấy tour.')
    return public_tour(t)


@app.get('/api/v1/tours/{tour_id}/schedules')
def schedules(tour_id:str,db:Session=Depends(db_session)):
    t=db.get(Tour,tour_id)
    if not t or not t.active: fail(404,'Không tìm thấy tour.')
    with db.begin_nested():
        lock_writes(db)
        sweep(db)
    db.commit()
    return [availability(s) for s in db.scalars(select(Schedule).where(Schedule.tour_id==tour_id,
                 Schedule.active.is_(True),Schedule.departure_at>now()).order_by(Schedule.departure_at)).all()]


def totals(price, adults, children, infants):
    return price*adults + ((price*75+50)//100)*children + ((price*10+50)//100)*infants


def check_people(adults,children,infants):
    seats=adults+children+infants
    if seats>20:fail(422,'Tối đa 20 hành khách mỗi đơn.')
    return seats


@app.post('/api/v1/bookings/quote')
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


def booking_dict(b):
    return {'id':b.id,'reference':b.reference,'scheduleId':b.schedule_id,'tourTitle':b.tour_title,
            'customerName':b.customer_name,'adults':b.adults,'children':b.children,'infants':b.infants,
            'seats':b.seats_held,'unitPrice':b.unit_price,'totalPrice':b.total_price,
            'status':b.status,'paid':b.status in ('PAID','CONFIRMED','COMPLETED'),
            'expiresAt':iso(b.expires_at),'createdAt':iso(b.created_at)}


@app.post('/api/v1/bookings',status_code=201)
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


@app.get('/api/v1/bookings')
def my_bookings(user=Depends(me),db:Session=Depends(db_session)):
    with db.begin_nested():
        lock_writes(db);sweep(db)
    db.commit()
    return [booking_dict(b) for b in db.scalars(select(Booking).where(Booking.user_id==user.id)
                  .order_by(Booking.created_at.desc())).all()]


@app.get('/api/v1/bookings/{booking_id}')
def my_booking(booking_id:str,user=Depends(me),db:Session=Depends(db_session)):
    with db.begin_nested():
        lock_writes(db);sweep(db)
    db.commit()
    b=db.get(Booking,booking_id)
    if not b or (b.user_id!=user.id and user.role!='ADMIN'):fail(404,'Không tìm thấy đơn.')
    return booking_dict(b)


@app.post('/api/v1/bookings/{booking_id}/cancel')
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


def audit(db,u,event,subject,detail=None):
    db.add(Audit(id=new_id(),actor_id=u.id,event_type=event,subject_id=subject,
                 details=json.dumps(detail or {},ensure_ascii=False)))


@app.post('/api/v1/admin/tours',status_code=201)
def admin_tour_create(body:TourCreate,user=Depends(admin),db:Session=Depends(db_session)):
    data=body.model_dump(exclude_none=True)
    data.setdefault('description','');data.setdefault('flash_sale',False);data.setdefault('active',True)
    with db.begin_nested():
        lock_writes(db)
        if db.get(Tour,body.id):fail(409,'Mã tour đã tồn tại.')
        t=Tour(**data);db.add(t);audit(db,user,'TOUR_CREATED',t.id)
    db.commit()
    return public_tour(t)


@app.patch('/api/v1/admin/tours/{tour_id}')
def admin_tour_patch(tour_id:str,body:TourPatch,user=Depends(admin),db:Session=Depends(db_session)):
    patch=body.model_dump(exclude_unset=True)
    if any(v is None for v in patch.values()):fail(422,'Không được gán null.')
    with db.begin_nested():
        lock_writes(db)
        t=db.scalar(select(Tour).where(Tour.id==tour_id).with_for_update())
        if not t:fail(404,'Không tìm thấy tour.')
        for key,value in patch.items():setattr(t,key,value)
        audit(db,user,'TOUR_UPDATED',t.id,{'fields':list(patch.keys())})
    db.commit()
    return public_tour(t)


@app.post('/api/v1/admin/schedules',status_code=201)
def add_schedule(body:ScheduleCreate,user=Depends(admin),db:Session=Depends(db_session)):
    if body.departure_at.astimezone(timezone.utc)<=now()+timedelta(hours=72):fail(422,'Lịch phải cách tối thiểu 72 giờ.')
    with db.begin_nested():
        lock_writes(db)
        t=db.get(Tour,body.tour_id)
        if not t:fail(404,'Không tìm thấy tour.')
        s=Schedule(id=new_id(),tour_id=body.tour_id,departure_at=body.departure_at.astimezone(timezone.utc),
                   total_seats=body.total_seats,reserved_seats=0)
        db.add(s);audit(db,user,'SCHEDULE_CREATED',s.id)
    db.commit()
    return availability(s)


@app.patch('/api/v1/admin/schedules/{schedule_id}')
def patch_schedule(schedule_id:str,body:SchedulePatch,user=Depends(admin),db:Session=Depends(db_session)):
    patch=body.model_dump(exclude_unset=True)
    if any(v is None for v in patch.values()):fail(422,'Không được gán null.')
    with db.begin_nested():
        lock_writes(db);sweep(db)
        s=db.scalar(select(Schedule).where(Schedule.id==schedule_id).with_for_update())
        if not s:fail(404,'Không tìm thấy lịch.')
        if body.total_seats is not None and body.total_seats<s.reserved_seats:fail(409,'Không thể giảm dưới số chỗ đã giữ.')
        for k,v in patch.items():setattr(s,k,v)
        audit(db,user,'SCHEDULE_UPDATED',s.id,{'fields':list(patch.keys())})
    db.commit()
    return availability(s)


@app.post('/api/v1/admin/bookings/{booking_id}/confirm-payment')
def confirm_payment(booking_id:str,body:PaymentEvidence,user=Depends(admin),db:Session=Depends(db_session)):
    """Offline bank verification MUST be performed by a human before using this endpoint.
    This is NOT an automated payment gateway and does not read a client payment flag.
    """
    with db.begin_nested():
        lock_writes(db);sweep(db)
        b=db.scalar(select(Booking).where(Booking.id==booking_id).with_for_update())
        if not b:fail(404,'Không tìm thấy đơn.')
        if b.status=='PAID':
            if b.payment_evidence!=body.reference:fail(409,'Bằng chứng thanh toán không khớp.')
            return booking_dict(b)
        if b.status!='PENDING_PAYMENT':fail(409,'Đơn không còn chờ thanh toán. Cần xử lý hoàn tiền ngoài hệ thống nếu đã chuyển.')
        b.status='PAID';b.payment_evidence=body.reference;b.payment_confirmed_at=now()
        audit(db,user,'PAYMENT_MANUALLY_VERIFIED',b.id,{'proofReference':body.reference})
    db.commit()
    return booking_dict(b)


@app.get('/api/v1/admin/bookings')
def admin_bookings(user=Depends(admin),db:Session=Depends(db_session)):
    with db.begin_nested():
        lock_writes(db);sweep(db)
    db.commit()
    result=[]
    for b in db.scalars(select(Booking).order_by(Booking.created_at.desc()).limit(100)).all():
        record=booking_dict(b)
        record.update({'customerPhone':b.customer_phone,'customerEmail':b.customer_email,
                       'paymentEvidence':b.payment_evidence,'userId':b.user_id})
        result.append(record)
    return result


@app.get('/api/v1/admin/tours')
def admin_tours(user=Depends(admin),db:Session=Depends(db_session)):
    return [{**public_tour(t),'active':t.active} for t in db.scalars(select(Tour).order_by(Tour.id)).all()]


@app.get('/api/v1/admin/schedules')
def admin_all_schedules(tour_id:str|None=None,user=Depends(admin),db:Session=Depends(db_session)):
    stmt=select(Schedule)
    if tour_id:stmt=stmt.where(Schedule.tour_id==tour_id)
    return [availability(s) for s in db.scalars(stmt.order_by(Schedule.departure_at)).all()]


@app.get('/api/v1/admin/metrics')
def metrics(user=Depends(admin),db:Session=Depends(db_session)):
    statuses=db.execute(select(Booking.status,func.count()).group_by(Booking.status)).all()
    return {'users':db.scalar(select(func.count()).select_from(User)),
            'tours':db.scalar(select(func.count()).select_from(Tour)),
            'bookings':dict(statuses)}


@app.get('/api/v1/admin/audit')
def audit_list(user=Depends(admin),db:Session=Depends(db_session)):
    return [{'id':e.id,'event':e.event_type,'actorId':e.actor_id,'subjectId':e.subject_id,
             'details':json.loads(e.details),'at':iso(e.created_at)} for e in
            db.scalars(select(Audit).order_by(Audit.created_at.desc()).limit(100)).all()]


class AssistantMessage(BaseModel):
    message: str = Field(min_length=1,max_length=1000)

@app.post('/api/v1/assistant/chat')
def assistant_message(body:AssistantMessage,request:Request,db:Session=Depends(db_session)):
    rate_limit('assistant:'+str(request.client.host if request.client else 'unknown'),20)
    text=body.message.lower()
    if any(x in text for x in ['giá','bao nhiêu','price']):
        sample=db.scalars(select(Tour).where(Tour.active.is_(True)).order_by(Tour.price).limit(6)).all()
        answer='Giá niêm yết hiện tại: '+ '; '.join(f'{t.title}: {t.price:,} VND' for t in sample)+'. Kiểm tra lịch và báo giá chính thức trước khi đặt.'
    elif any(x in text for x in ['hủy','hoàn tiền','cancel']):
        answer='Đơn chưa thanh toán có thể hủy khi còn hơn 72 giờ trước khởi hành. Đơn đã thanh toán cần liên hệ bộ phận hỗ trợ. Chưa có hoàn tiền tự động.'
    elif any(x in text for x in ['tour','đi đâu','địa điểm']):
        answer='Delta Travel đang hiển thị các tour Hạ Long, Đà Nẵng, Phú Quốc, Đà Lạt, Sa Pa và Miền Tây (dữ liệu demo).'
    else:
        answer='Tôi hỗ trợ thông tin tour, giá và chính sách hủy. Hãy hỏi về một trong các chủ đề đó. Đây là trợ lý theo quy tắc, không phải AI sinh nội dung.'
    return {'answer':answer,'mode':'rule_based','source':'Delta Travel local database/policy'}


@app.api_route('/api/v1/{unknown_path:path}',methods=['GET','POST','PUT','PATCH','DELETE'],include_in_schema=False)
def unknown_api(unknown_path:str):
    fail(404,'API endpoint không tồn tại.')


@app.get('/favicon.ico',include_in_schema=False)
def favicon_compat():
    # Browsers may request the classic ICO URL even when the page uses SVG.
    return RedirectResponse('/favicon.svg',status_code=307)


FRONTEND=Path(__file__).resolve().parents[1]/'frontend'
app.mount('/',StaticFiles(directory=str(FRONTEND),html=True),name='frontend')
