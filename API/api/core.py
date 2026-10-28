"""Authentication dependencies, security helpers and shared session settings."""
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from api.models import SessionLocal, User, SessionToken, Audit, now
from api.security import random_token, token_hash

ENV = os.getenv('DELTA_ENV', 'development')
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

def db_session():
    with SessionLocal() as db:
        yield db

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

def audit(db,u,event,subject,detail=None):
    db.add(Audit(id=new_id(),actor_id=u.id,event_type=event,subject_id=subject,
                 details=json.dumps(detail or {},ensure_ascii=False)))
