"""DEMO ONLY: six tour descriptions/prices transcribed from Delta Travel 2.0 UI data.js.
Departure schedules are synthetic and are NOT commercial commitments."""
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from api.models import Tour, Schedule, SessionLocal

REMOTE = 'https://raw.githubusercontent.com/Anniehatani/deltatrdelt2.0/main/assets/images/'
TOURS = [
 ('DL-HL01','ha-long-lan-ha-cruise','Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ','north','3N2Đ',3890000,4890000,8,'halong.png','Hà Nội (Xe Limousine đón tận nơi)','Du thuyền 5* + Limousine VIP',1),
 ('DL-DN02','da-nang-hoi-an-ba-na','Thiên Đường Miền Trung: Đà Nẵng - Cầu Vàng - Phố Cổ Hội An','central','4N3Đ',4490000,5490000,5,'danang.png','TP. Hồ Chí Minh / Hà Nội (Vé máy bay)','Máy bay khứ hồi + Xe du lịch đời mới',1),
 ('DL-PQ03','phu-quoc-hon-thom-grand-world','Đảo Ngọc Phú Quốc - Cáp Treo Hòn Thơm - Grand World Không Ngủ','south','3N2Đ',4690000,5990000,12,'phuquoc.png','TP. Hồ Chí Minh / Hà Nội (Vé máy bay)','Vé máy bay + Cano vượt biển + Xe VIP',1),
 ('DL-DL04','da-lat-tuyen-lam-cau-dat','Thành Phố Ngàn Hoa: Đà Lạt - Hồ Tuyền Lâm - Săn Mây Cầu Đất','central','3N2Đ',2590000,3200000,15,'dalat.png','TP. Hồ Chí Minh / Hà Nội','Xe Limousine phòng nằm cao cấp',0),
 ('DL-SP05','sapa-fansipan-cat-cat','Sa Pa Mờ Sương - Chinh Phục Đỉnh Fansipan - Bản Cát Cát','north','3N2Đ',3190000,3990000,10,'sapa.png','Hà Nội (Xe Cabin Tình Yêu)','Xe Cabin cao cấp + Tàu hỏa Mường Hoa',0),
 ('DL-MT06','mien-tay-cai-rang-tra-su','Sông Nước Miền Tây: Cần Thơ - Chợ Nổi Cái Răng - Rừng Tràm Trà Sư','south','2N1Đ',1690000,2190000,18,'mientay.png','TP. Hồ Chí Minh','Xe du lịch máy lạnh + Xuồng ba lá',0)
]


def seed_demo():
    with SessionLocal.begin() as db:
        for i,(id,slug,title,region,duration,price,old_price,seats,image,departure,transport,flash) in enumerate(TOURS):
            if db.get(Tour,id):
                continue
            db.add(Tour(id=id,slug=slug,title=title,region=region,duration=duration,price=price,
                        original_price=old_price,image=REMOTE+image,departure=departure,transport=transport,
                        flash_sale=bool(flash),description='Dữ liệu minh họa. Chưa mở bán thương mại.'))
            db.flush()
            for days in (14+i, 30+i, 45+i):
                day=datetime.now(timezone.utc).date()+timedelta(days=days)
                depart=datetime(day.year,day.month,day.day,2,0,0,tzinfo=timezone.utc)
                db.add(Schedule(id=str(uuid.uuid4()),tour_id=id,departure_at=depart,total_seats=seats,reserved_seats=0))
