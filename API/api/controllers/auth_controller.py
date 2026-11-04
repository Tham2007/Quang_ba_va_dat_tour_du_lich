"""Accounts, session, profile and customer favourites."""

from fastapi import Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from api.core import (
    CSRF_NAME,
    SECURE_COOKIE,
    SESSION_NAME,
    db_session,
    fail,
    me,
    new_id,
    set_auth_cookies,
    user_dict,
    utc,
)
from api.models import User, Tour, SessionToken, Favorite, lock_writes, now
from api.schemas import Signup, Login, ProfilePatch, ChangePassword
from api.core.security import hash_password, verify_password, rate_limit, token_hash
from api.repositories.user_repository import user_conflict, find_user_by_email, find_user_by_identifier
from api.services.auth_service import credentials_match


def register(
    body: Signup,
    request: Request,
    response: Response,
    db: Session = Depends(db_session),
):
    rate_limit(
        "register:" + str(request.client.host if request.client else "unknown"), 5
    )
    with db.begin():
        lock_writes(db)
        if user_conflict(db, body.email, body.phone):
            fail(409, "Email hoặc số điện thoại đã đăng ký.")
        u = User(
            id=new_id(),
            full_name=body.full_name.strip(),
            email=body.email,
            phone=body.phone,
            password_hash=hash_password(body.password),
            role="CUSTOMER",
        )
        db.add(u)
        db.flush()
        set_auth_cookies(response, db, u)
    return user_dict(u)


def login(
    body: Login, request: Request, response: Response, db: Session = Depends(db_session)
):
    ip = request.client.host if request.client else "unknown"
    rate_limit("login:" + ip, 10)
    u = find_user_by_identifier(db, body.identifier)
    if not credentials_match(u, body.password):
        fail(401, "Thông tin đăng nhập không chính xác.")
    with db.begin_nested():
        set_auth_cookies(response, db, u)
    db.commit()
    return user_dict(u)


def current(user=Depends(me)):
    return user_dict(user)


def auth_session(
    request: Request, response: Response, db: Session = Depends(db_session)
):
    """Non-error bootstrap probe for anonymous visitors.

    This is NOT an authentication bypass: /auth/me and every protected
    endpoint keep their 401/403 semantics. Session tokens are never returned.
    """
    response.headers["Cache-Control"] = "no-store"
    raw = request.cookies.get(SESSION_NAME, "")
    if not raw:
        return {"authenticated": False, "user": None}
    session = db.get(SessionToken, token_hash(raw))
    if session is None or utc(session.expires_at) <= now():
        return {"authenticated": False, "user": None}
    u = db.get(User, session.user_id)
    if u is None or not u.active:
        return {"authenticated": False, "user": None}
    return {"authenticated": True, "user": user_dict(u)}


def logout(
    request: Request,
    response: Response,
    user=Depends(me),
    db: Session = Depends(db_session),
):
    with db.begin_nested():
        s = db.get(SessionToken, token_hash(request.cookies[SESSION_NAME]))
        if s:
            db.delete(s)
    db.commit()
    for c in (SESSION_NAME, CSRF_NAME):
        response.delete_cookie(c, path="/", samesite="strict", secure=SECURE_COOKIE)
    return {"status": "logged_out"}


def change_profile(
    body: ProfilePatch, user=Depends(me), db: Session = Depends(db_session)
):
    patch = body.model_dump(exclude_unset=True)
    if not patch or any(v is None for v in patch.values()):
        fail(422, "Không có nội dung hợp lệ để cập nhật.")
    with db.begin_nested():
        lock_writes(db)
        locked = db.scalar(select(User).where(User.id == user.id).with_for_update())
        if "full_name" in patch:
            locked.full_name = patch["full_name"].strip()
        if "phone" in patch:
            locked.phone = patch["phone"]
    db.commit()
    return user_dict(locked)


def favorites(user=Depends(me), db: Session = Depends(db_session)):
    return [
        f.tour_id
        for f in db.scalars(select(Favorite).where(Favorite.user_id == user.id)).all()
    ]


def favorite_add(tour_id: str, user=Depends(me), db: Session = Depends(db_session)):
    with db.begin_nested():
        lock_writes(db)
        t = db.get(Tour, tour_id)
        if not t or not t.active:
            fail(404, "Không tìm thấy tour.")
        existing = db.scalar(
            select(Favorite).where(
                Favorite.tour_id == tour_id, Favorite.user_id == user.id
            )
        )
        if not existing:
            db.add(Favorite(id=new_id(), user_id=user.id, tour_id=tour_id))
    db.commit()
    return {"saved": True, "tourId": tour_id}


def favorite_remove(tour_id: str, user=Depends(me), db: Session = Depends(db_session)):
    with db.begin_nested():
        lock_writes(db)
        existing = db.scalar(
            select(Favorite).where(
                Favorite.tour_id == tour_id, Favorite.user_id == user.id
            )
        )
        if existing:
            db.delete(existing)
    db.commit()
    return {"saved": False, "tourId": tour_id}


def change_password(
    body: ChangePassword,
    request: Request,
    response: Response,
    user=Depends(me),
    db: Session = Depends(db_session),
):
    if not verify_password(body.old_password, user.password_hash):
        fail(400, "Mật khẩu hiện tại không đúng.")
    with db.begin_nested():
        user.password_hash = hash_password(body.new_password)
        for session in db.scalars(
            select(SessionToken).where(SessionToken.user_id == user.id)
        ).all():
            db.delete(session)
    db.commit()
    response.delete_cookie(
        SESSION_NAME, path="/", samesite="strict", secure=SECURE_COOKIE
    )
    response.delete_cookie(CSRF_NAME, path="/", samesite="strict", secure=SECURE_COOKIE)
    return {"status": "changed", "loginRequired": True}
