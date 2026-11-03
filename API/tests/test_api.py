import os
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

TEST_FOLDER=tempfile.TemporaryDirectory(prefix='delta-tests-')
os.environ['DATABASE_URL']='sqlite:///'+str(Path(TEST_FOLDER.name)/'test.db')
os.environ['DELTA_ENV']='development'
os.environ['AUTO_CREATE_SCHEMA']='1'
os.environ['DEMO_SEED']='1'
import pytest
from api.security import _limiter

@pytest.fixture(autouse=True)
def reset_test_limiter():
    _limiter.clear()

from fastapi.testclient import TestClient
from sqlalchemy import select
from api.app import app
from api.models import SessionLocal, User, Schedule, Booking, Tour


def reg(client,num):
    email=f'user{num}@example.com';phone=f'091{num:07d}'
    payload={'full_name':f'Khach {num}','email':email,'phone':phone,'password':'aLongVerySecurePassword1!'}
    r=client.post('/api/v1/auth/register',json=payload)
    assert r.status_code==201,r.text
    assert r.json()['role']=='CUSTOMER'
    assert client.get('/api/v1/auth/me').status_code==200
    return payload


def csrf(client):return {'X-CSRF-Token':client.cookies.get('delta_csrf')}


def booking_body(client,people=1):
    s=client.get('/api/v1/tours/DL-HL01/schedules').json()[0]
    return {'schedule_id':s['id'],'adults':people,'children':0,'infants':0,
            'customer_name':'Nguyen Van A','customer_phone':'0912345678',
            'customer_email':'booker@example.com'}


def post_booking(client,body,key=None,headers=None):
    h={**csrf(client),'Idempotency-Key':key or str(uuid.uuid4()),**(headers or {})}
    return client.post('/api/v1/bookings',json=body,headers=h)


def test_a_site_and_tour_search():
    with TestClient(app) as c:
        assert c.get('/').status_code==200
        assert c.get('/assets/app.js').status_code==200
        assert c.get('/api/v1/health/ready').json()['status']=='ok'
        assert len(c.get('/api/v1/tours').json())==6
        assert len(c.get('/api/v1/tours?region=north').json())==2
        assert len(c.get('/api/v1/tours?flash=true').json())==3
        assert c.get('/api/v1/tours?max_price=2000000').json()[0]['id']=='DL-MT06'


def test_b_login_register_cookie_and_logout():
    with TestClient(app) as c:
        p=reg(c,100)
        assert 'delta_session' in c.cookies
        assert c.post('/api/v1/auth/register',json=p).status_code==409
        assert c.post('/api/v1/auth/logout',json={}).status_code==403
        assert c.post('/api/v1/auth/logout',json={},headers=csrf(c)).status_code==200
        assert c.get('/api/v1/auth/me').status_code==401
        bad=c.post('/api/v1/auth/login',json={'email':p['email'],'password':'badpass'})
        assert bad.status_code==401
        assert c.post('/api/v1/auth/login',json={'email':p['email'],'password':p['password']}).status_code==200


def test_c_server_price_idempotency_and_no_fake_paid():
    with TestClient(app) as c:
        reg(c,101)
        body=booking_body(c,2)
        quote=c.post('/api/v1/bookings/quote',json={k:body[k] for k in ('schedule_id','adults','children','infants')})
        assert quote.status_code==200
        assert quote.json()['totalPrice']==7780000
        assert c.post('/api/v1/bookings/quote',json={**body,'price':1}).status_code==422
        assert post_booking(c,{**body,'status':'PAID','total_price':1}).status_code==422
        key=str(uuid.uuid4())
        a=post_booking(c,body,key);b=post_booking(c,body,key)
        assert a.status_code==201,a.text
        assert b.status_code==201 and a.json()['id']==b.json()['id']
        assert a.json()['paid'] is False and a.json()['status']=='PENDING_PAYMENT'
        assert post_booking(c,{**body,'adults':1},key).status_code==409
        assert len(c.get('/api/v1/bookings').json())==1


def test_d_cancel_once_and_releases_seats():
    with TestClient(app) as c:
        reg(c,102)
        body=booking_body(c)
        s_before=c.get('/api/v1/tours/DL-HL01/schedules').json()[0]['availableSeats']
        b=post_booking(c,body).json()
        assert c.get('/api/v1/tours/DL-HL01/schedules').json()[0]['availableSeats']==s_before-1
        url='/api/v1/bookings/'+b['id']+'/cancel'
        assert c.post(url,headers=csrf(c),json={}).json()['status']=='CANCELLED'
        assert c.post(url,headers=csrf(c),json={}).json()['status']=='CANCELLED'
        assert c.get('/api/v1/tours/DL-HL01/schedules').json()[0]['availableSeats']==s_before


def test_e_idor_and_admin_access_denied():
    with TestClient(app) as c1, TestClient(app) as c2:
        reg(c1,103);reg(c2,104)
        b=post_booking(c1,booking_body(c1)).json()
        assert c2.get('/api/v1/bookings/'+b['id']).status_code==404
        assert c2.post('/api/v1/bookings/'+b['id']+'/cancel',json={},headers=csrf(c2)).status_code==404
        assert c1.post('/api/v1/admin/bookings/'+b['id']+'/confirm-payment',json={'reference':'bank-transaction-123456'},headers=csrf(c1)).status_code==403
        assert c2.get('/api/v1/admin/metrics').status_code==403


def test_f_expired_hold_released_only_once():
    with TestClient(app) as c:
        p=reg(c,105)
        body=booking_body(c)
        before=c.get('/api/v1/tours/DL-HL01/schedules').json()[0]['availableSeats']
        b=post_booking(c,body).json()
        with SessionLocal.begin() as db:
            o=db.get(Booking,b['id']);o.expires_at=datetime.now(timezone.utc)-timedelta(seconds=3)
        for _ in range(2):
            assert c.get('/api/v1/bookings/'+b['id']).json()['status']=='EXPIRED'
        assert c.get('/api/v1/tours/DL-HL01/schedules').json()[0]['availableSeats']==before
        assert c.post('/api/v1/bookings/'+b['id']+'/cancel',json={},headers=csrf(c)).status_code==409


def test_g_admin_audit_capacity_and_payment_manual():
    with TestClient(app) as c:
        p=reg(c,106)
        with SessionLocal.begin() as db:
            db.scalar(select(User).where(User.email==p['email'])).role='ADMIN'
        body=booking_body(c)
        sched=body['schedule_id']
        b=post_booking(c,body).json()
        assert c.get('/api/v1/admin/metrics').status_code==200
        assert c.patch('/api/v1/admin/schedules/'+sched,json={'total_seats':0},headers=csrf(c)).status_code==422
        with SessionLocal() as db:
            held=db.get(Schedule,sched).reserved_seats
        assert held>1
        assert c.patch('/api/v1/admin/schedules/'+sched,json={'total_seats':held-1},headers=csrf(c)).status_code==409
        assert c.patch('/api/v1/admin/schedules/'+sched,json={'total_seats':held},headers=csrf(c)).status_code==200
        res=c.post('/api/v1/admin/bookings/'+b['id']+'/confirm-payment',json={'reference':'bank-proof-2026-123'},headers=csrf(c))
        assert res.status_code==200,res.text
        assert res.json()['paid'] is True
        assert c.post('/api/v1/admin/bookings/'+b['id']+'/confirm-payment',json={'reference':'different-bank-ref'},headers=csrf(c)).status_code==409
        assert c.post('/api/v1/bookings/'+b['id']+'/cancel',json={},headers=csrf(c)).status_code==409
        assert any(x['event']=='PAYMENT_MANUALLY_VERIFIED' for x in c.get('/api/v1/admin/audit').json())
        assert c.patch('/api/v1/admin/tours/DL-HL01',json={'price':4000000},headers=csrf(c)).json()['price']==4000000
        # Previously booked price snapshot remains unchanged.
        assert c.get('/api/v1/bookings/'+b['id']).json()['unitPrice']==3890000


def test_h_wrong_csrf_and_invalid_input():
    with TestClient(app) as c:
        reg(c,107)
        body=booking_body(c)
        assert c.post('/api/v1/bookings',json=body,headers={'Idempotency-Key':str(uuid.uuid4())}).status_code==403
        assert post_booking(c,body,headers={'X-CSRF-Token':'bad'}).status_code==403
        assert post_booking(c,{**body,'adults':21}).status_code==422
        assert post_booking(c,{**body,'customer_phone':'123'}).status_code==422
        assert post_booking(c,body,key='arbitrary').status_code==422


def test_i_concurrent_last_seat():
    with TestClient(app) as admin_client:
        account=reg(admin_client,108)
        with SessionLocal.begin() as db:
            db.scalar(select(User).where(User.email==account['email'])).role='ADMIN'
        schedule=booking_body(admin_client)['schedule_id']
        # Other earlier tests released their holds or used different schedule but one paid; use new schedule.
        future=(datetime.now(timezone.utc)+timedelta(days=100)).replace(microsecond=0)
        created=admin_client.post('/api/v1/admin/schedules',headers=csrf(admin_client),json={'tour_id':'DL-HL01','departure_at':future.isoformat(),'total_seats':1})
        assert created.status_code==201,created.text
        schedule=created.json()['id']
    def attempt(idx):
        with TestClient(app) as c:
            reg(c,200+idx)
            body=booking_body(c);body['schedule_id']=schedule
            return post_booking(c,body).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(attempt,[0,1]))
    assert sorted(results)==[201,409],results
    with SessionLocal() as db:
        s=db.get(Schedule,schedule)
        assert s.total_seats==1 and s.reserved_seats==1


def test_j_no_auth_reset_no_fake_gateway():
    with TestClient(app) as c:
        assert c.post('/api/v1/auth/forgot-password',json={'email':'x@a.com','password':'new'}).status_code==404
        assert c.post('/api/v1/payments/success',json={'paid':True}).status_code==404
        assert c.post('/api/v1/assistant/chat',json={'message':'Giá tour'}).json()['mode']=='rule_based'


def test_k_profile_changes_and_favorites_are_user_scoped():
    with TestClient(app) as c1,TestClient(app) as c2:
        reg(c1,300);reg(c2,301)
        assert c1.patch('/api/v1/auth/profile',json={'full_name':'Ten Moi','phone':'0931234567'},headers=csrf(c1)).status_code==200
        assert c1.get('/api/v1/auth/me').json()['fullName']=='Ten Moi'
        assert c1.get('/api/v1/auth/me').json()['phone']=='0931234567'
        assert c1.patch('/api/v1/auth/profile',json={'role':'ADMIN'},headers=csrf(c1)).status_code==422
        assert c1.post('/api/v1/favorites/DL-HL01',json={},headers=csrf(c1)).status_code==200
        assert c1.post('/api/v1/favorites/DL-HL01',json={},headers=csrf(c1)).status_code==200
        assert c1.get('/api/v1/favorites').json()==['DL-HL01']
        assert c2.get('/api/v1/favorites').json()==[]
        assert c1.delete('/api/v1/favorites/DL-HL01',headers=csrf(c1)).status_code==200
        assert c1.get('/api/v1/favorites').json()==[]


def test_l_password_rotation_invalidates_all_sessions():
    with TestClient(app) as c1,TestClient(app) as c2:
        p=reg(c1,302)
        assert c2.post('/api/v1/auth/login',json={'email':p['email'],'password':p['password']}).status_code==200
        r=c1.post('/api/v1/auth/change-password',headers=csrf(c1),json={'old_password':p['password'],'new_password':'NewVeryStrongPassword123!'})
        assert r.status_code==200,r.text
        assert c1.get('/api/v1/auth/me').status_code==401
        assert c2.get('/api/v1/auth/me').status_code==401
        assert c1.post('/api/v1/auth/login',json={'email':p['email'],'password':p['password']}).status_code==401
        assert c1.post('/api/v1/auth/login',json={'email':p['email'],'password':'NewVeryStrongPassword123!'}).status_code==200


def test_m_anonymous_safe_session_probe_does_not_weaken_auth():
    with TestClient(app) as client:
        # A normal first visit should not generate 401 noise in the frontend.
        anonymous = client.get('/api/v1/auth/session')
        assert anonymous.status_code == 200
        assert anonymous.json() == {'authenticated': False, 'user': None}
        assert anonymous.headers['cache-control'] == 'no-store'
        # Protected route must still require authentication.
        assert client.get('/api/v1/auth/me').status_code == 401
        reg(client, 401)
        signed_in = client.get('/api/v1/auth/session')
        assert signed_in.status_code == 200
        assert signed_in.json()['authenticated'] is True
        assert signed_in.json()['user']['email'] == 'user401@example.com'
        assert 'token' not in signed_in.text.lower()
        assert client.post('/api/v1/auth/logout', json={}, headers=csrf(client)).status_code == 200
        assert client.get('/api/v1/auth/session').json() == {'authenticated': False, 'user': None}
        assert client.get('/api/v1/auth/me').status_code == 401


def test_n_expired_or_forged_cookie_cannot_become_authenticated():
    with TestClient(app) as client:
        reg(client, 402)
        client.cookies.set('delta_session', 'forged-session-value')
        assert client.get('/api/v1/auth/session').json()['authenticated'] is False
        assert client.get('/api/v1/auth/me').status_code == 401


def test_o_local_favicon_and_references_are_servable():
    with TestClient(app) as client:
        assert 'href="/favicon.svg"' in client.get('/').text
        image = client.get('/favicon.svg')
        assert image.status_code == 200
        assert '<svg ' in image.text
        legacy = client.get('/favicon.ico', follow_redirects=False)
        assert legacy.status_code == 307
        assert legacy.headers['location'] == '/favicon.svg'
        assert client.get('/favicon.ico').status_code == 200


def test_p_admin_tour_crud_soft_delete_preserves_references_and_permissions():
    """KTHP CRUD: create/read/update/soft-delete/restore with ADMIN + CSRF."""
    with TestClient(app) as admin_client, TestClient(app) as customer_client:
        person = reg(admin_client, 601)
        reg(customer_client, 602)
        with SessionLocal.begin() as db:
            db.scalar(select(User).where(User.email == person["email"])).role = "ADMIN"

        target = "/api/v1/admin/tours/DL-KTHP99"
        body = {
            "id": "DL-KTHP99",
            "slug": "tour-kiem-thu-kthp-2026",
            "title": "Tour kiểm thử quản lý danh mục",
            "price": 1200000,
            "original_price": 1300000,
            "region": "north",
            "duration": "2N1D",
            "departure": "Hà Nội",
            "transport": "Xe du lịch",
            "image": "/static/test-tour.jpg",
        }

        assert customer_client.post(
            "/api/v1/admin/tours", json=body, headers=csrf(customer_client)
        ).status_code == 403
        assert admin_client.post("/api/v1/admin/tours", json=body).status_code == 403

        created = admin_client.post(
            "/api/v1/admin/tours", json=body, headers=csrf(admin_client)
        )
        assert created.status_code == 201, created.text
        assert created.json()["id"] == body["id"]
        assert admin_client.post(
            "/api/v1/admin/tours", json=body, headers=csrf(admin_client)
        ).status_code == 409
        assert admin_client.get("/api/v1/tours/DL-KTHP99").status_code == 200

        changed = admin_client.patch(
            target, json={"title": "Tour KTHP đã cập nhật", "price": 1400000},
            headers=csrf(admin_client)
        )
        assert changed.status_code == 200, changed.text
        assert changed.json()["price"] == 1400000

        assert customer_client.delete(target, headers=csrf(customer_client)).status_code == 403
        assert admin_client.delete(target).status_code == 403
        removed = admin_client.delete(target, headers=csrf(admin_client))
        assert removed.status_code == 200, removed.text
        assert removed.json() == {"id": "DL-KTHP99", "active": False, "deleted": True}
        assert admin_client.get("/api/v1/tours/DL-KTHP99").status_code == 404

        # DELETE is idempotent and must not duplicate audit events.
        assert admin_client.delete(target, headers=csrf(admin_client)).status_code == 200
        event_count = sum(
            e["event"] == "TOUR_SOFT_DELETED" and e["subjectId"] == body["id"]
            for e in admin_client.get("/api/v1/admin/audit").json()
        )
        assert event_count == 1
        listing = admin_client.get("/api/v1/admin/tours").json()
        assert next(x for x in listing if x["id"] == body["id"])["active"] is False

        restored = admin_client.patch(
            target, json={"active": True}, headers=csrf(admin_client)
        )
        assert restored.status_code == 200
        assert admin_client.get("/api/v1/tours/DL-KTHP99").status_code == 200
        assert admin_client.delete(
            "/api/v1/admin/tours/DL-DOESNOTEXIST", headers=csrf(admin_client)
        ).status_code == 404


def test_q_payment_reference_unique_across_bookings_and_reject_invalid_proof():
    """A bank transfer reference cannot approve two independent orders."""
    with TestClient(app) as c:
        account = reg(c, 701)
        with SessionLocal.begin() as db:
            db.scalar(select(User).where(User.email == account["email"])).role = "ADMIN"
        body = booking_body(c)
        departure = (datetime.now(timezone.utc) + timedelta(days=150)).replace(
            microsecond=0
        )
        schedule = c.post(
            "/api/v1/admin/schedules",
            headers=csrf(c),
            json={
                "tour_id": "DL-HL01",
                "departure_at": departure.isoformat(),
                "total_seats": 10,
            },
        )
        assert schedule.status_code == 201, schedule.text
        body["schedule_id"] = schedule.json()["id"]
        first = post_booking(c, body)
        second = post_booking(c, body)
        assert first.status_code == 201 and second.status_code == 201
        assert first.json()["id"] != second.json()["id"]

        url1 = "/api/v1/admin/bookings/" + first.json()["id"] + "/confirm-payment"
        url2 = "/api/v1/admin/bookings/" + second.json()["id"] + "/confirm-payment"
        ref = "BANK-KTHP-00001"
        ok = c.post(url1, json={"reference": "  " + ref + "  "}, headers=csrf(c))
        assert ok.status_code == 200, ok.text
        assert ok.json()["paid"] is True

        same = c.post(url1, json={"reference": ref}, headers=csrf(c))
        assert same.status_code == 200, same.text

        duplicate = c.post(url2, json={"reference": ref}, headers=csrf(c))
        assert duplicate.status_code == 409, duplicate.text
        assert c.get("/api/v1/bookings/" + second.json()["id"]).json()["paid"] is False

        assert c.post(url2, json={"reference": "         "}, headers=csrf(c)).status_code == 422
        assert c.post(url2, json={"reference": "BANK-NEW-00002", "paid": True}, headers=csrf(c)).status_code == 422
        independent = c.post(url2, json={"reference": "BANK-NEW-00002"}, headers=csrf(c))
        assert independent.status_code == 200, independent.text
        assert independent.json()["paid"] is True


def test_r_an_original_frontend_served_on_same_origin_as_fastapi():
    """An's existing UI and independently labeled live booking panel share API origin."""
    with TestClient(app) as c:
        html = c.get("/an-live/")
        assert html.status_code == 200
        assert "assets/js/services/live-api-bridge.js" in html.text
        admin = c.get("/an-live/admin.html")
        assert admin.status_code == 200
        assert "assets/js/live-api-bridge.js" in admin.text
        bridge = c.get("/an-live/assets/js/live-api-bridge.js")
        assert bridge.status_code == 200
        assert "javascript" in bridge.headers.get("content-type", "").lower()
        assert '"/api/v1"' in bridge.text
        assert "credentials: \"same-origin\"" in bridge.text
        assert c.get("/api/v1/tours").status_code == 200
