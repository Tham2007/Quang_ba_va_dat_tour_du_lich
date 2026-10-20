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
