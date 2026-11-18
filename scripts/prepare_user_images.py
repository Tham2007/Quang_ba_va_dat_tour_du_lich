import os
import shutil
from PIL import Image

src_dir = "user_extracted_images"
dst_dir = "scripts/clean_images"
os.makedirs(dst_dir, exist_ok=True)

# Map extracted images from user's edited docx
image_map = {
    # Ch 1 Vietravel
    "img_p27_rId6.png": "hinh_1_1_vietravel_1.png",
    "img_p29_rId7.png": "hinh_1_2_vietravel_2.png",
    # Ch 2.1 UI
    "img_p51_rId8.png": "hinh_2_1_ui_home_hero.png",
    "img_p55_rId9.png": "hinh_2_2_ui_home_categories.png",
    "img_p57_rId10.png": "hinh_2_3_ui_home_english.png",
    "img_p60_rId11.png": "hinh_2_4_ui_booking_form.png",
    "img_p62_rId12.png": "hinh_2_5_ui_booking_passengers.png",
    "img_p63_rId13.png": "hinh_2_6_ui_booking_summary.png",
    # Ch 2.2 ERD
    "img_p84_rId14.png": "hinh_2_7_erd_database.png",
    # Ch 2.3.1 Use Case
    "img_p105_rId15.png": "hinh_2_8_use_case_tong_quat.png",
    "img_p107_rId16.png": "hinh_2_9_use_case_khach_admin.png",
    # Ch 2.3.2 Activity Diagrams (7)
    "img_p123_rId17.png": "hinh_2_10_ad01_auth.png",
    "img_p130_rId18.png": "hinh_2_11_ad02_search.png",
    "img_p137_rId19.png": "hinh_2_12_ad03_booking.png",
    "img_p144_rId20.png": "hinh_2_13_ad04_payment.png",
    "img_p151_rId21.png": "hinh_2_14_ad05_cancel.png",
    "img_p158_rId22.png": "hinh_2_15_ad06_admin_tour.png",
    "img_p165_rId23.png": "hinh_2_16_ad07_report_audit.png",
    # Ch 2.3.3 Class Diagram MVC
    "img_p172_rId24.png": "hinh_2_17_class_mvc.png",
    # Ch 4.1 Screenshots
    "img_p225_rId25.png": "hinh_4_1_ui_my_bookings.png",
    "img_p227_rId26.png": "hinh_4_2_ui_admin_dashboard.png",
    "img_p229_rId27.png": "hinh_4_3_vietqr_payment.png"
}

print("Sanitizing and preparing all 22 user images...")
for src_name, dst_name in image_map.items():
    src_path = os.path.join(src_dir, src_name)
    dst_path = os.path.join(dst_dir, dst_name)
    if os.path.exists(src_path):
        im = Image.open(src_path)
        im = im.convert("RGB")
        im.save(dst_path, "PNG")
        print(f"  OK: {src_name} -> {dst_name} ({im.size[0]}x{im.size[1]})")
    else:
        print(f"  ERROR: Missing {src_path}")

print("Total images prepared:", len(os.listdir(dst_dir)))
