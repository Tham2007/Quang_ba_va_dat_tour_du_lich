import os
from PIL import Image

output_dir = os.path.join(os.path.dirname(__file__), "clean_images")
os.makedirs(output_dir, exist_ok=True)

image_mapping = {
    "hinh_1_1_khao_sat_vietravel.png": "vietravel_screenshot.png",
    "hinh_2_1_ui_home.png": "extracted_images/web_home.png",
    "hinh_2_2_ui_booking.png": "extracted_images/web_booking.png",
    "hinh_2_3_erd_database.png": "extracted_images/tham_1.png",
    "hinh_2_4_use_case_tong_quat.png": r"C:\Users\ACER\Downloads\use_case_delta_travel.png",
    "hinh_2_5_use_case_khach_admin.png": r"C:\Users\ACER\Downloads\use_case_tuong_tac_khach_admin.png",
    "hinh_2_6_ad01_auth.png": "extracted_images/activity_1.png",
    "hinh_2_7_ad02_search.png": "extracted_images/activity_2.png",
    "hinh_2_8_ad03_booking.png": "extracted_images/activity_3.png",
    "hinh_2_9_ad04_payment.png": "extracted_images/activity_4.png",
    "hinh_2_10_ad05_admin_tour.png": "extracted_images/activity_5.png",
    "hinh_2_11_ad06_admin_booking.png": "extracted_images/activity_6.png",
    "hinh_2_12_ad07_cancel_tour.png": "extracted_images/activity_7.png",
    "hinh_2_13_class_mvc.png": "mvc_architecture.png",
    "hinh_4_1_ui_my_bookings.png": "extracted_images/web_my_bookings.png",
    "hinh_4_2_ui_admin_dashboard.png": "extracted_images/web_admin.png",
    "hinh_4_3_vietqr_payment.png": "Frontend/assets/images/qr-payment.png"
}

print("Sanitizing and preparing images...")
for dest_name, src_path in image_mapping.items():
    if not os.path.exists(src_path):
        print(f"ERROR: Missing source image {src_path}")
        continue
    dest_path = os.path.join(output_dir, dest_name)
    im = Image.open(src_path)
    im = im.convert("RGB")
    im.save(dest_path, "PNG")
    print(f"Prepared: {dest_name} ({im.size[0]}x{im.size[1]})")

print("All images prepared successfully.")
