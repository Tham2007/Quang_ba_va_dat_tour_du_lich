/**
 * DELTA TRAVEL - CƠ SỞ DỮ LIỆU FRONTEND & STORAGE LAYER (DATA.JS)
 * -------------------------------------------------------------
 * File này lưu trữ:
 * 1. Danh mục Tour du lịch, chi tiết lịch trình từng ngày, bảng giá, chính sách, vouchers.
 * 2. Lịch khởi hành & Quản lý chỗ trống (Schedules & Slots).
 * 3. Danh sách Đơn đặt tour (Bookings) - Khởi tạo RỖNG (không bịa đặt thông tin).
 * 4. Đối soát thanh toán & Hoàn tiền (Payments & Refunds) - Khởi tạo RỖNG.
 * 5. Nhật ký kiểm toán hệ thống (Audit Logs) - Khởi tạo RỖNG.
 * 6. Bộ hàm Getter/Setter đồng bộ 2 chiều với LocalStorage.
 */

// =============================================================================
// I. CÁC HẰNG SỐ & KHÓA STORAGE TOÀN CỤC
// =============================================================================
const DELTA_STORAGE_KEYS = {
  TOURS: "delta_tours_v3",
  SCHEDULES: "delta_schedules_v3",
  BOOKINGS: "delta_bookings_v2",
  PAYMENTS: "delta_payments_v2",
  AUDIT_LOGS: "delta_audit_logs_v2",
  SYSTEM_INFO: "delta_system_info_v2",
  USERS: "delta_users_v2",
  CURRENT_USER: "delta_current_user_v2",
  WISHLIST: "delta_wishlist_v2"
};

// =============================================================================
// II. DỮ LIỆU MẪU BAN ĐẦU (SEED DATA - 100% TIẾNG VIỆT CHUẨN UTF-8)
// =============================================================================
const DEFAULT_TOURS = [
  {
    "id": "DL-HL01",
    "title": "Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ",
    "slug": "ha-long-lan-ha-cruise",
    "region": "north",
    "regionName": "Miền Bắc",
    "image": "assets/images/tour-ha-long.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "Hà Nội (Xe Limousine đón tận nơi)",
    "transport": "Du thuyền 5* + Limousine VIP",
    "originalPrice": 4290000,
    "price": 3890000,
    "rating": 4.9,
    "reviewsCount": 184,
    "badge": "KỲ QUAN THẾ GIỚI",
    "availableSeats": 8,
    "highlights": [
      "Trải nghiệm du thuyền 5 sao đẳng cấp quốc tế trên vịnh Lan Hạ",
      "Chèo thuyền Kayak xuyên qua hang động bí ẩn, tắm biển bãi Ba Trái Đào",
      "Tiệc trà hoàng hôn Sunset Party và tiệc Buffet hải sản tươi sống",
      "Khám phá làng chài cổ Việt Hải & Đảo Cát Bà thơ mộng"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Hà Nội - Vịnh Hạ Long - Check-in Du Thuyền 5 Sao - Vịnh Lan Hạ",
        "morning": "08:00 Xe Limousine đón quý khách tại khu vực Phố Cổ Hà Nội, khởi hành đi Tuần Châu qua cao tốc Hải Phòng hiện đại.",
        "afternoon": "12:00 Quý khách làm thủ tục lên du thuyền 5 sao, thưởng thức Welcome Drink và nhận phòng ban công hướng vịnh. Thưởng thức bữa trưa hải sản tươi sống khi tàu tiến vào vịnh Lan Hạ.",
        "evening": "15:30 Trải nghiệm chèo thuyền Kayak tại khu vực Ba Trái Đào. 17:30 Tham gia tiệc hoàng hôn Sunset Party trên Sundeck. 19:00 Dùng bữa tối lãng mạn phong cách hoàng gia, sau đó câu mực đêm cùng thủy thủ đoàn."
      },
      {
        "day": 2,
        "title": "Làng Cổ Việt Hải - Vườn Quốc Gia Cát Bà - Trải Nghiệm Văn Hóa",
        "morning": "06:30 Tập Thái Cực Quyền ngắm bình minh trên vịnh. Dùng điểm tâm sáng. 08:30 Cano đưa đoàn khám phá Làng Việt Hải nép mình giữa thung lũng đá vôi.",
        "afternoon": "12:00 Trải nghiệm đạp xe xuyên rừng nguyên sinh Cát Bà, mát-xa chân bằng cá tự nhiên. Thưởng thức bữa trưa đậm đà phong vị bản địa tại nhà hàng sinh thái.",
        "evening": "16:00 Tự do tắm biển, thư giãn tại bể sục Jacuzzi bốn mùa trên du thuyền. 19:00 Bữa tiệc nướng BBQ hải sản cao cấp và giao lưu âm nhạc Acoustic trên boong tàu."
      },
      {
        "day": 3,
        "title": "Hang Sáng Tối - Bữa Trưa Buffet - Tuần Châu - Hà Nội",
        "morning": "06:30 Chào ngày mới với lớp yoga đón ánh nắng mai. Dùng bữa sáng buffet tự chọn thịnh soạn. 07:45 Khám phá Hang Sáng Tối bằng thuyền nan do cư dân địa phương chèo.",
        "afternoon": "09:30 Về du thuyền hoàn tất thủ tục trả phòng. Thưởng thức bữa trưa sớm trong khi tàu nhẹ nhàng cập bến cảng Tuần Châu. 12:30 Xe đón đoàn về lại thủ đô Hà Nội.",
        "evening": "15:30 Đến Hà Nội, trả khách tại điểm hẹn. Hướng dẫn viên Delta Travel chia tay và hẹn gặp lại quý khách trong những hành trình tiếp theo!"
      }
    ],
    "inclusions": [
      "Xe đưa đón Limousine khứ hồi Hà Nội - Hạ Long máy lạnh cao cấp",
      "Phòng nghỉ hạng sang 5 sao trên du thuyền (có ban công riêng)",
      "05 bữa ăn chính theo tiêu chuẩn hải sản cao cấp + 02 bữa sáng buffet",
      "Thuyền nan, thuyền kayak tham quan hang động theo lịch trình",
      "Vé tham quan tất cả các thắng cảnh trong chương trình",
      "Hướng dẫn viên song ngữ Việt - Anh nhiệt huyết, chu đáo",
      "Bảo hiểm du lịch trọn gói mức bồi thường 100.000.000đ/vụ"
    ],
    "exclusions": [
      "Thuế VAT 8% (nếu quý khách có nhu cầu xuất hóa đơn đỏ)",
      "Chi phí phòng đơn riêng (nếu đi 1 mình có phụ thu)",
      "Đồ uống gọi thêm trong các bữa ăn (rượu vang, cocktail, bia lon...)",
      "Tiền tip (tiền bồi dưỡng) cho tài xế và thủy thủ đoàn (tùy tâm)"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 2528500
  },
  {
    "id": "DL-DN02",
    "title": "Thiên Đường Miền Trung: Đà Nẵng - Cầu Vàng - Phố Cổ Hội An",
    "slug": "da-nang-hoi-an-ba-na",
    "region": "central",
    "regionName": "Miền Trung",
    "image": "assets/images/tour-da-nang.jpg",
    "duration": "4N3Đ",
    "daysCount": 4,
    "departure": "TP. Hồ Chí Minh / Hà Nội (Vé máy bay)",
    "transport": "Máy bay khứ hồi + Xe du lịch đời mới",
    "originalPrice": 4890000,
    "price": 4490000,
    "rating": 4.95,
    "reviewsCount": 260,
    "badge": "DI SẢN & BIỂU TƯỢNG",
    "availableSeats": 5,
    "highlights": [
      "Chiêm ngưỡng Cầu Vàng Bàn Tay Khổng Lồ độc nhất vô nhị tại Bà Nà Hills",
      "Dạo bước phố cổ Hội An rực rỡ đèn lồng, thả hoa đăng trên sông Hoài",
      "Tắm biển Mỹ Khê - một trong những bãi biển đẹp nhất hành tinh",
      "Thưởng thức đặc sản mì Quảng, bánh tráng cuốn thịt heo hai đầu da"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Đón Sân Bay Đà Nẵng - Bán Đảo Sơn Trà - Chùa Linh Ứng - Biển Mỹ Khê",
        "morning": "Xe đón quý khách tại sân bay Đà Nẵng, đưa về khách sạn nhận phòng nghỉ ngơi.",
        "afternoon": "Khởi hành tham quan Bán đảo Sơn Trà, viếng Chùa Linh Ứng Bãi Bụt chiêm bái tượng Phật Bà Quan Âm cao 67m hướng ra biển Đông. Tự do tắm biển Mỹ Khê.",
        "evening": "Thưởng thức đặc sản Bánh tráng cuốn thịt heo hai đầu da, ngắm Cầu Rồng phun lửa và phun nước lung linh sắc màu."
      },
      {
        "day": 2,
        "title": "Bà Nà Hills - Cầu Vàng - Làng Pháp - Fantasy Park",
        "morning": "Cáp treo đạt kỷ lục thế giới lên đỉnh Bà Nà, sải bước check-in Cầu Vàng giữa biển mây bồng bềnh.",
        "afternoon": "Khám phá Hầm rượu Debay, Vườn hoa Pháp và vui chơi không giới hạn tại Fantasy Park. Ăn trưa buffet Á - Âu đỉnh núi.",
        "evening": "Trở về trung tâm Đà Nẵng, tự do dạo phố đêm sông Hàn và thưởng thức ẩm thực chợ đêm Sơn Trà."
      },
      {
        "day": 3,
        "title": "Rừng Dừa Bảy Mẫu - Đô Thị Cổ Hội An - Thả Hoa Đăng Sông Hoài",
        "morning": "Trải nghiệm chèo thuyền thúng xoay vòng vui nhộn tại Rừng dừa Bảy Mẫu Cẩm Thanh.",
        "afternoon": "Bách bộ tham quan Phố cổ Hội An: Chùa Cầu, Hội quán Phúc Kiến, Nhà cổ Phùng Hưng.",
        "evening": "Du thuyền sông Hoài thả hoa đăng lung linh cầu may mắn, dùng bữa tối ẩm thực Cao Lầu và Cơm gà Hội An."
      },
      {
        "day": 4,
        "title": "Ngũ Hành Sơn - Làng Đá Non Nước - Chợ Hàn - Tiễn Bay",
        "morning": "Khám phá ngọn Thủy Sơn, vãn cảnh động Huyền Không kỳ bí, ghé thăm Làng đá điêu khắc Non Nước 300 năm tuổi.",
        "afternoon": "Mua sắm đặc sản chả bò, hải sản khô tại Chợ Hàn. Xe tiễn quý khách ra sân bay Đà Nẵng kết thúc chuyến đi.",
        "evening": "Về đến điểm xuất phát, hẹn gặp lại quý khách trên những nẻo đường tiếp theo!"
      }
    ],
    "inclusions": [
      "Vé máy bay khứ hồi (đã gồm 7kg hành lý xách tay + 20kg ký gửi)",
      "Khách sạn 4 sao tiêu chuẩn trung tâm biển Mỹ Khê (2 khách/phòng)",
      "Vé cáp treo Bà Nà Hills trọn gói + 01 bữa trưa buffet Á - Âu đỉnh núi",
      "Xe ô tô máy lạnh đời mới vận chuyển suốt tuyến",
      "Vé tham quan tất cả các điểm theo chương trình",
      "Hướng dẫn viên chuyên nghiệp, tận tâm đồng hành suốt hành trình",
      "Bảo hiểm du lịch mức bồi thường 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Phụ thu phòng đơn nếu quý khách có nhu cầu ngủ riêng 1 mình",
      "Vé tham quan Bảo tàng Sáp tại Bà Nà Hills",
      "Chi phí cá nhân: giặt ủi, điện thoại, nước uống ngoài chương trình",
      "Tiền tip bồi dưỡng tài xế và hướng dẫn viên"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 2918500
  },
  {
    "id": "DL-PQ03",
    "title": "Đảo Ngọc Phú Quốc - Cáp Treo Hòn Thơm - Grand World",
    "slug": "phu-quoc-hon-thom-grand-world",
    "region": "south",
    "regionName": "Miền Nam",
    "image": "assets/images/tour-phu-quoc.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "TP. Hồ Chí Minh / Hà Nội (Vé máy bay)",
    "transport": "Vé máy bay + Cano vượt biển + Xe VIP",
    "originalPrice": 5190000,
    "price": 4690000,
    "rating": 4.88,
    "reviewsCount": 312,
    "badge": "THIÊN ĐƯỜNG ĐẢO NGỌC",
    "availableSeats": 12,
    "highlights": [
      "Cáp treo 3 dây vượt biển dài nhất thế giới sang đảo thiên đường Hòn Thơm",
      "Cano cao tốc tham quan 4 đảo hoang sơ: Hòn Mây Rút, Hòn Gầm Ghì, Hòn Móng Tay",
      "Lặn ngắm san hô tự nhiên với trang bị ống thở cao cấp và chụp ảnh Sup flycam",
      "Check-in thành phố không ngủ Grand World và show diễn Tinh Hoa Việt Nam"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Đón Sân Bay Phú Quốc - Suối Tranh - Dinh Cậu - Grand World Không Ngủ",
        "morning": "Xe và HDV đón khách tại Sân bay Phú Quốc, đưa về resort nhận phòng nghỉ ngơi.",
        "afternoon": "Thăm thắng cảnh Suối Tranh thanh bình, viếng Dinh Cậu ngắm hoàng hôn ráng chiều biển Tây.",
        "evening": "Khám phá Grand World Phú Quốc: du ngoạn kênh đào Venice, xem show nhạc nước triệu đô Sắc Màu Venice."
      },
      {
        "day": 2,
        "title": "Tour 4 Đảo Bằng Cano Cao Tốc - Lặn San Hô - Cáp Treo Hòn Thơm",
        "morning": "Cano cao tốc đưa đoàn khám phá Hòn Móng Tay, Hòn Gầm Ghì lặn ngắm rạn san hô nguyên sơ đầy sắc màu.",
        "afternoon": "Ăn trưa hải sản tươi sống tại Hòn Mây Rút Trong. Đi cáp treo vượt biển Hòn Thơm ngắm biển ngọc từ trên cao.",
        "evening": "Trải nghiệm Sunset Sanato check-in voi đá biển và thưởng thức bữa tối hải sản nướng thơm ngon."
      },
      {
        "day": 3,
        "title": "Cơ Sở Ngọc Trai - Nhà Thùng Nước Mắm - Tiễn Khách Sân Bay",
        "morning": "Thăm cơ sở nuôi cấy ngọc trai cao cấp và nhà thùng nước mắm truyền thống Phú Quốc trăm năm.",
        "afternoon": "Mua sắm đặc sản tiêu chín ngào đường, rượu sim rừng. Xe đưa quý khách ra sân bay Phú Quốc.",
        "evening": "Đáp chuyến bay về lại TP.HCM / Hà Nội. Kết thúc kỳ nghỉ tuyệt vời tại Đảo Ngọc!"
      }
    ],
    "inclusions": [
      "Vé máy bay khứ hồi khứ hồi TP.HCM/Hà Nội - Phú Quốc",
      "Resort 4 sao sát biển có hồ bơi vô cực và bãi tắm riêng",
      "Vé cáp treo Hòn Thơm và công viên nước Aquatopia",
      "Cano cao tốc tham quan 4 đảo + bộ kính lặn ống thở chuyên nghiệp",
      "Chụp ảnh máy cơ + quay clip Sup bằng Flycam miễn phí",
      "Các bữa ăn chính đặc sản hải sản tươi rói theo chương trình",
      "Bảo hiểm du lịch biển đảo mức cao nhất 100.000.000đ"
    ],
    "exclusions": [
      "Vé vào cổng VinWonders và Vinpearl Safari (tự chọn)",
      "Dịch vụ đi bộ dưới đáy biển Sea Walker",
      "Chi tiêu cá nhân ngoài thực đơn chương trình",
      "Tiền bồi dưỡng tài xế và thủy thủ đoàn"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 3048500
  },
  {
    "id": "DL-DL04",
    "title": "Thành Phố Ngàn Hoa: Đà Lạt Mộng Mơ - Đồi Chè Cầu Đất",
    "slug": "da-lat-tuyen-lam-cau-dat",
    "region": "central",
    "regionName": "Miền Trung",
    "image": "assets/images/dalat.png",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "TP. Hồ Chí Minh (Xe Limousine đón)",
    "transport": "Xe Limousine giường phòng VIP",
    "originalPrice": 2890000,
    "price": 2590000,
    "rating": 4.85,
    "reviewsCount": 142,
    "badge": "XỨ SỞ NGÀN HOA",
    "availableSeats": 15,
    "highlights": [
      "Săn mây biển ngàn thông sáng sớm tại Đồi chè Cầu Đất Panorama",
      "Check-in Thung Lũng Tình Yêu, Vườn hoa Cẩm Tú Cầu rực rỡ sắc màu",
      "Trải nghiệm máng trượt xuyên rừng thông dài nhất Đông Nam Á tại Thác Datanla",
      "Thưởng thức lẩu gà lá é Tao Ngộ, bánh tráng nướng Đà Lạt chợ đêm"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "TP.HCM - Cao Tốc Dầu Giây - Đà Lạt - Thung Lũng Đèn Phố Đêm",
        "morning": "Xe Limousine đón quý khách tại TP.HCM, khởi hành lên phố hoa Đà Lạt ngắm đèo Chuối và đèo Bảo Lộc hùng vĩ.",
        "afternoon": "Đến Đà Lạt nhận phòng khách sạn phong cách cổ điển Pháp, thưởng thức tách trà atiso ấm nóng.",
        "evening": "Thưởng thức lẩu gà lá é trứ danh, dạo quanh hồ Xuân Hương và chợ đêm Đà Lạt se lạnh."
      },
      {
        "day": 2,
        "title": "Săn Mây Cầu Đất - Thác Datanla - Ga Xe Lửa Cổ - Quảng Trường Lâm Viên",
        "morning": "05:00 Khởi hành săn mây tại Đồi chè Cầu Đất với tuabin gió khổng lồ, đón bình minh vàng rực rỡ.",
        "afternoon": "Chinh phục máng trượt Thác Datanla, ghé thăm Nhà ga Đà Lạt cổ kính - kiến trúc răng cưa độc đáo.",
        "evening": "Check-in nụ hoa Atiso khổng lồ tại Quảng trường Lâm Viên, nhâm nhi cà phê ngắm toàn cảnh thung lũng đèn đêm."
      },
      {
        "day": 3,
        "title": "Vườn Dâu Tây Công Nghệ Cao - Thiền Viện Trúc Lâm - Hồ Tuyền Lâm - Về TP.HCM",
        "morning": "Hái dâu tây chín mọng tại vườn công nghệ cao, vãn cảnh thanh tịnh Thiền Viện Trúc Lâm bên hồ Tuyền Lâm xanh biếc.",
        "afternoon": "Mua sắm đặc sản mứt dâu, trà atiso, hồng treo gió Đà Lạt. Xe khởi hành về lại TP.HCM.",
        "evening": "Về đến TP.HCM lúc 20:00, hướng dẫn viên chia tay đoàn và hẹn ngày tái ngộ!"
      }
    ],
    "inclusions": [
      "Xe Limousine giường phòng máy lạnh êm ái khứ hồi TP.HCM - Đà Lạt",
      "Khách sạn 3-4 sao trung tâm gần chợ Đà Lạt và hồ Xuân Hương",
      "Ăn uống theo chương trình: 02 bữa sáng + 05 bữa chính đặc sản",
      "Vé tham quan tất cả các địa danh trong lịch trình",
      "Vé máng trượt khứ hồi Thác Datanla",
      "Hướng dẫn viên chuyên nghiệp nhiệt tình vui vẻ",
      "Bảo hiểm du lịch trọn gói 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Chi phí hái dâu mang về tính theo kg thực tế",
      "Đồ uống gọi thêm trong các bữa ăn",
      "Phòng đơn nếu có nhu cầu ngủ 1 mình",
      "Tiền tip cho tài xế và hướng dẫn viên"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 1683500
  },
  {
    "id": "DL-SP05",
    "title": "Sa Pa Mờ Sương: Chinh Phục Nóc Nhà Fansipan - Bản Cát Cát",
    "slug": "sapa-fansipan-cat-cat",
    "region": "north",
    "regionName": "Miền Bắc",
    "image": "assets/images/tour-sapa.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "Hà Nội (Xe Cabin tình yêu VIP)",
    "transport": "Xe Cabin Limousine + Cáp treo Sun World",
    "originalPrice": 3590000,
    "price": 3190000,
    "rating": 4.92,
    "reviewsCount": 198,
    "badge": "NÓC NHÀ ĐÔNG DƯƠNG",
    "availableSeats": 10,
    "highlights": [
      "Chạm tay vào cột mốc 3.143m đỉnh Fansipan - Nóc nhà Đông Dương",
      "Hóa thân thành chàng trai, cô gái H'Mông xinh xắn tại Bản Cát Cát mộng mơ",
      "Check-in Thung Lũng Mường Hoa, Tàu hỏa leo núi Mường Hoa đỏ rực",
      "Thưởng thức lẩu cá hồi, cá tầm Sa Pa nóng hổi giữa tiết trời se lạnh"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Hà Nội - Cao Tốc Nội Bài Lào Cai - Sa Pa - Bản Cát Cát Thác Nước",
        "morning": "Xe Cabin tình yêu đón quý khách tại Hà Nội, khởi hành đi Sa Pa qua đường cao tốc hiện đại.",
        "afternoon": "Đến Sa Pa nhận phòng khách sạn, dùng bữa trưa lẩu cá hồi. Thăm Bản Cát Cát, ngắm thác Tiên Sa róc rách.",
        "evening": "Tự do dạo phố cổ Sa Pa, thăm Nhà thờ Đá, thưởng thức đồ nướng than hồng chợ đêm Sa Pa."
      },
      {
        "day": 2,
        "title": "Chinh Phục Đỉnh Fansipan 3.143m - Quần Thể Tâm Linh Đại Tượng Phật",
        "morning": "Đi tàu hỏa leo núi Mường Hoa, tiếp tục đi cáp treo Sun World băng qua thung lũng mây lên đỉnh Fansipan linh thiêng.",
        "afternoon": "Chạm tay cột mốc Nóc nhà Đông Dương, chiêm bái Đại Tượng Phật A Di Đà bằng đồng lớn nhất Việt Nam.",
        "evening": "Dùng bữa tối đặc sản lợn bản cắp nách, tắm lá thuốc người Dao Đỏ thư giãn toàn thân."
      },
      {
        "day": 3,
        "title": "Đèo Ô Quy Hồ - Cổng Trời Sa Pa - Chợ Sa Pa - Về Lại Hà Nội",
        "morning": "Chinh phục Đèo Ô Quy Hồ - một trong tứ đại đỉnh đèo hiểm trở bậc nhất Việt Nam ngắm thung lũng mây mù.",
        "afternoon": "Ghé chợ Sa Pa mua nấm hương rừng, thịt trâu gác bếp, đào mận Sa Pa. Xe đưa đoàn về lại thủ đô Hà Nội.",
        "evening": "19:30 Về đến Hà Nội, kết thúc chuyến phiêu lưu Sa Pa ấn tượng khó quên."
      }
    ],
    "inclusions": [
      "Xe Cabin VIP giường nằm đời mới khứ hồi Hà Nội - Sa Pa",
      "Khách sạn 3-4 sao trung tâm view núi Fansipan tuyệt đẹp",
      "Vé cáp treo Fansipan khứ hồi + vé tàu hỏa leo núi Mường Hoa",
      "Vé tham quan Bản Cát Cát và thuê trang phục dân tộc truyền thống",
      "05 bữa ăn chính tiêu chuẩn đặc sản vùng cao + 02 bữa sáng buffet",
      "Hướng dẫn viên am hiểu phong tục tập quán bản địa",
      "Bảo hiểm du lịch mức bồi thường 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Vé tàu hỏa leo núi lên đỉnh chặng cuối (nếu không muốn leo bậc thang đá)",
      "Chi phí tắm lá thuốc Dao Đỏ (dịch vụ tự chọn)",
      "Chi tiêu cá nhân ngoài chương trình",
      "Tiền tip tài xế và hướng dẫn viên"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 2073500
  },
  {
    "id": "DL-MT06",
    "title": "Sông Nước Miền Tây: Cần Thơ Chợ Nổi Cái Răng - Trà Sư",
    "slug": "mien-tay-cai-rang-tra-su",
    "region": "south",
    "regionName": "Miền Nam",
    "image": "assets/images/tour-can-tho.jpg",
    "duration": "2N1Đ",
    "daysCount": 2,
    "departure": "TP. Hồ Chí Minh (Xe đón tận nơi)",
    "transport": "Xe du lịch máy lạnh + Tàu máy xuồng ba lá",
    "originalPrice": 1890000,
    "price": 1690000,
    "rating": 4.86,
    "reviewsCount": 165,
    "badge": "MIỆT VƯỜN SÔNG NƯỚC",
    "availableSeats": 18,
    "highlights": [
      "Trải nghiệm nét văn hóa sông nước Chợ nổi Cái Răng từ mờ sáng",
      "Đi xuồng ba lá len lỏi trong thảm bèo xanh mướt Rừng tràm Trà Sư",
      "Thưởng thức trái cây miệt vườn tươi hái ngay tại cành và nghe đờn ca tài tử",
      "Ẩm thực Nam Bộ chân chất: cá lóc nướng trui, lẩu mắm cá linh bông điên điển"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "TP.HCM - Mỹ Tho - Bến Tre - Cần Thơ - Bến Ninh Kiều Về Đêm",
        "morning": "Xe đón quý khách tại TP.HCM, vượt cầu Rạch Miễu đến xứ dừa Bến Tre du ngoạn sông Tiền.",
        "afternoon": "Đi xe ngựa đường làng, thưởng thức mật ong hoa nhãn, nghe đờn ca tài tử Nam Bộ. Di chuyển về Tây Đô Cần Thơ.",
        "evening": "Lên du thuyền Cần Thơ dùng bữa tối ngắm sông Hậu và cầu Cần Thơ lung linh ánh đèn."
      },
      {
        "day": 2,
        "title": "Chợ Nổi Cái Răng - Rừng Tràm Trà Sư Mùa Nước Nổi - Về TP.HCM",
        "morning": "05:30 Đi thuyền máy tham quan Chợ nổi Cái Răng thưởng thức hủ tiếu lắc, cà phê kho trên sông.",
        "afternoon": "Đến rừng tràm Trà Sư, ngồi xuồng ba lá ngắm các loài chim quý hiếm bay rợp bóng mát. Dùng bữa trưa cá lóc nướng trui.",
        "evening": "Khởi hành về TP.HCM qua cầu Mỹ Thuận, kết thúc hành trình miệt vườn ấm áp tình người!"
      }
    ],
    "inclusions": [
      "Xe du lịch đời mới máy lạnh suốt hành trình",
      "Khách sạn 3-4 sao trung tâm Cần Thơ gần Bến Ninh Kiều",
      "Tàu máy du thuyền và xuồng chèo ba lá xuyên rừng tràm",
      "03 bữa ăn chính đặc sản miền Tây + 01 bữa sáng buffet",
      "Vé tham quan, đờn ca tài tử, trái cây ăn no nê",
      "Hướng dẫn viên vui vẻ hóm hỉnh chất phác",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Đồ uống gọi thêm ngoài thực đơn",
      "Chi phí phòng đơn nếu đi 1 mình",
      "Tiền tip bồi dưỡng đoàn"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 1098500
  },
  {
    "id": "DL-NB07",
    "title": "Tuyệt Tác Non Nước: Ninh Bình - Tràng An - Chùa Bái Đính - Hang Múa",
    "slug": "ninh-binh-trang-an-bai-dinh-hang-mua",
    "region": "north",
    "regionName": "Miền Bắc",
    "image": "assets/images/tour-ninh-binh.jpg",
    "duration": "2N1Đ",
    "daysCount": 2,
    "departure": "Hà Nội (Xe Limousine đón tận nơi)",
    "transport": "Xe Limousine VIP + Thuyền nan Tràng An",
    "originalPrice": 2290000,
    "price": 1990000,
    "rating": 4.94,
    "reviewsCount": 215,
    "badge": "DI SẢN TRÀNG AN",
    "availableSeats": 14,
    "highlights": [
      "Ngồi thuyền nan luồn lách qua hệ thống hang động ngập nước kỳ ảo Tràng An",
      "Chiêm bái Chùa Bái Đính - quần thể chùa Phật giáo lớn nhất Việt Nam",
      "Chinh phục gần 500 bậc đá đỉnh Hang Múa ngắm trọn vẹn cảnh sắc Tam Cốc",
      "Thưởng thức đặc sản cơm cháy Ninh Bình giòn rụm và thịt dê núi 7 món"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Hà Nội - Cố Đô Hoa Lư - Thắng Cảnh Tràng An - Phố Cổ Hoa Lư Về Đêm",
        "morning": "08:00 Xe Limousine đón quý khách tại Hà Nội, khởi hành về Ninh Bình thăm Cố đô Hoa Lư thờ vua Đinh - vua Lê.",
        "afternoon": "Lên thuyền nan xuôi dòng Sào Khê khám phá Quần thể danh thắng Tràng An di sản thế giới UNESCO.",
        "evening": "Nhận phòng khách sạn, dùng bữa tối thịt dê núi nướng tảng, tự do dạo phố cổ Hoa Lư ngắm tháp Kỳ Lân rực rỡ."
      },
      {
        "day": 2,
        "title": "Đại Tự Bái Đính - Đỉnh Hang Múa Ngắm Tam Cốc - Hà Nội",
        "morning": "Viếng Chùa Bái Đính chiêm bái Tượng Phật Di Lặc bằng đồng lớn nhất Đông Nam Á và hành lang La Hán dài nhất.",
        "afternoon": "Chinh phục đỉnh núi Múa check-in ngắm toàn cảnh dòng Ngô Đồng uốn lượn bên cánh đồng lúa Tam Cốc.",
        "evening": "16:30 Lên xe về lại thủ đô Hà Nội, trả khách tại điểm hẹn ban đầu."
      }
    ],
    "inclusions": [
      "Xe Limousine đưa đón khứ hồi Hà Nội - Ninh Bình",
      "Khách sạn / Resort 4 sao sinh thái Ninh Bình",
      "Vé thuyền nan tham quan danh thắng Tràng An",
      "Vé xe điện khứ hồi chùa Bái Đính",
      "Vé tham quan Hang Múa và Cố đô Hoa Lư",
      "03 bữa ăn chính đặc sản dê núi cơm cháy + 01 bữa sáng",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Chi phí cá nhân ngoài chương trình",
      "Phòng đơn nếu có nhu cầu",
      "Tiền tip bồi dưỡng hướng dẫn viên"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 1293500
  },
  {
    "id": "DL-HG08",
    "title": "Huyền Thoại Đá Sỏi: Hà Giang - Đèo Mã Pí Lèng - Du Thuyền Sông Nho Quế",
    "slug": "ha-giang-ma-pi-leng-nho-que",
    "region": "north",
    "regionName": "Miền Bắc",
    "image": "assets/images/tour-hagiang.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "Hà Nội (Xe Cung Điện Limousine)",
    "transport": "Xe Cung Điện VIP + Thuyền máy Sông Nho Quế",
    "originalPrice": 3890000,
    "price": 3490000,
    "rating": 4.96,
    "reviewsCount": 178,
    "badge": "KỲ QUAN ĐỈNH ĐÈO",
    "availableSeats": 9,
    "highlights": [
      "Chinh phục Đèo Mã Pí Lèng - vua của các con đèo hiểm trở bậc nhất Việt Nam",
      "Du thuyền trên dòng sông Nho Quế xanh như ngọc xuyên hẻm vực Tu Sản",
      "Check-in Cột cờ Lũng Cú - điểm cực Bắc thiêng liêng của Tổ quốc",
      "Thưởng thức thắng cố Đồng Văn, bánh tam giác mạch và rượu ngô men lá"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Hà Nội - Cột Mốc Km0 - Cổng Trời Quản Bạ - Rừng Thông Yên Minh - Đồng Văn",
        "morning": "Khởi hành từ Hà Nội theo cao tốc Tuyên Quang lên Hà Giang, check-in Cột mốc Km0 lịch sử.",
        "afternoon": "Vượt Dốc Bắc Sum lên Cổng trời Quản Bạ ngắm Núi Đôi Cô Tiên tuyệt tác thiên nhiên. Đi qua rừng thông Yên Minh.",
        "evening": "Đến Phố cổ Đồng Văn nhận phòng, dạo phố cổ và thưởng thức bánh cuốn nóng chan nước xương đậm đà."
      },
      {
        "day": 2,
        "title": "Cột Cờ Lũng Cú - Dinh Vua Mèo - Đèo Mã Pí Lèng - Sông Nho Quế",
        "morning": "Chinh phục đỉnh núi Rồng viếng Cột cờ Lũng Cú cực Bắc. Thăm Dinh thự họ Vương (Dinh Vua Mèo) cổ kính.",
        "afternoon": "Vượt Đèo Mã Pí Lèng hùng vĩ ngắm toàn cảnh hẻm Tu Sản. Đi thuyền máy trên dòng sông Nho Quế xanh màu ngọc bích.",
        "evening": "Thưởng thức lẩu gà đen vùng cao, giao lưu văn nghệ lửa trại cùng đồng bào vùng cao."
      },
      {
        "day": 3,
        "title": "Làng Văn Hóa Lũng Cẩm - Dốc Thẩm Mã - Hà Giang - Hà Nội",
        "morning": "Thăm Làng Lũng Cẩm - bối cảnh bộ phim nổi tiếng 'Chuyện của Pao'. Chụp ảnh trên con Dốc Thẩm Mã uốn lượn.",
        "afternoon": "Ăn trưa tại TP. Hà Giang, mua mật ong hoa bạc hà và chè Shan Tuyết cổ thụ. Xe khởi hành về Hà Nội.",
        "evening": "20:00 Về đến Hà Nội, kết thúc chuyến chinh phục cực Bắc hào hùng!"
      }
    ],
    "inclusions": [
      "Xe Cung Điện Limousine khứ hồi Hà Nội - Hà Giang",
      "Khách sạn tại Đồng Văn trung tâm tiện nghi",
      "Vé thuyền du ngoạn hẻm Tu Sản sông Nho Quế",
      "Vé xe điện tham quan Cột cờ Lũng Cú",
      "Vé tham quan tất cả các di tích theo chương trình",
      "05 bữa chính đặc sản vùng cao + 02 bữa sáng",
      "Bảo hiểm du lịch mạo hiểm mức 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Đồ uống ngoài thực đơn",
      "Chi phí cá nhân phát sinh",
      "Tiền tip bồi dưỡng tài xế và HDV"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 2268500
  },
  {
    "id": "DL-CB09",
    "title": "Vùng Biên Ải Hùng Vĩ: Cao Bằng - Thác Bản Giốc - Động Ngườm Ngao",
    "slug": "cao-bang-thac-ban-gioc-nguom-ngao",
    "region": "north",
    "regionName": "Miền Bắc",
    "image": "assets/images/tour-caobang.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "Hà Nội (Xe du lịch cao cấp)",
    "transport": "Xe giường nằm VIP + Bè mảng Bản Giốc",
    "originalPrice": 3200000,
    "price": 2890000,
    "rating": 4.9,
    "reviewsCount": 136,
    "badge": "ĐỆ NHẤT THÁC NƯỚC",
    "availableSeats": 11,
    "highlights": [
      "Chiêm ngưỡng Thác Bản Giốc - thác nước tự nhiên đẹp nhất Đông Nam Á",
      "Thám hiểm Động Ngườm Ngao kỳ ảo với hàng ngàn cột thạch nhũ vàng óng",
      "Vãn cảnh Khu di tích Pác Bó viếng Đền thờ Bác Hồ và suối Lê Nin trong vắt",
      "Thưởng thức vịt quay 7 vị Cao Bằng, hạt dẻ Trùng Khánh nướng thơm lừng"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Hà Nội - Thái Nguyên - Cao Bằng - Thác Bản Giốc Oai Hùng",
        "morning": "Khởi hành từ Hà Nội qua đèo Gió, đèo Khau Khang ngắm núi rừng Đông Bắc trập trùng.",
        "afternoon": "Đến Trùng Khánh, chiêm ngưỡng vẻ đẹp kỳ vĩ của Thác Bản Giốc tung bọt trắng xóa giữa biên cương.",
        "evening": "Nhận phòng khách sạn, thưởng thức vịt quay 7 vị và rau bò khai xào thịt bò thơm ngon."
      },
      {
        "day": 2,
        "title": "Động Ngườm Ngao - Làng Rèn Phúc Sen - Suối Lê Nin Núi Các Mác",
        "morning": "Thám hiểm Động Ngườm Ngao khám phá kiệt tác thạch nhũ hình hoa sen úp ngược.",
        "afternoon": "Ghé thăm làng nghề rèn dao Phúc Sen truyền thống của người Nùng An, viếng suối Lê Nin Pác Bó.",
        "evening": "Dạo phố đêm Cao Bằng, thưởng thức bánh áp chao giòn rụm và chè hạt dẻ thơm bùi."
      },
      {
        "day": 3,
        "title": "Chợ Phiên Vùng Cao - Bắc Kạn - Hà Nội",
        "morning": "Mua sắm đặc sản miến dong Phia Đén, nấm hương rừng và hạt dẻ Trùng Khánh.",
        "afternoon": "Lên xe khởi hành về lại Hà Nội, dừng chân ngắm cảnh hồ Ba Bể xanh trong.",
        "evening": "18:30 Về đến thủ đô Hà Nội, chia tay và hẹn gặp lại quý khách."
      }
    ],
    "inclusions": [
      "Xe du lịch đời mới máy lạnh khứ hồi Hà Nội - Cao Bằng",
      "Khách sạn 3-4 sao trung tâm Cao Bằng",
      "Vé bè mảng tiến sát chân Thác Bản Giốc",
      "Vé tham quan Động Ngườm Ngao và Khu di tích Pác Bó",
      "Các bữa ăn chính đặc sản bản địa phong phú",
      "Hướng dẫn viên chuyên tuyến Đông Bắc",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Chi tiêu cá nhân ngoài tour",
      "Phòng đơn nếu có yêu cầu",
      "Tiền bồi dưỡng hướng dẫn viên"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 1878500
  },
  {
    "id": "DL-MC10",
    "title": "Thảo Nguyên Mộc Châu: Đồi Chè Trái Tim - Thác Dải Yếm - Cầu Kính Bạch Long",
    "slug": "moc-chau-doi-che-cau-kinh-bach-long",
    "region": "north",
    "regionName": "Miền Bắc",
    "image": "assets/images/tour-mocchau.jpg",
    "duration": "2N1Đ",
    "daysCount": 2,
    "departure": "Hà Nội (Xe du lịch cao cấp)",
    "transport": "Xe du lịch Limousine cao cấp",
    "originalPrice": 2450000,
    "price": 2190000,
    "rating": 4.88,
    "reviewsCount": 154,
    "badge": "THẢO NGUYÊN XANH",
    "availableSeats": 16,
    "highlights": [
      "Chinh phục Cầu kính Bạch Long dài 632m - kỷ lục Guinness thế giới",
      "Check-in Đồi chè Trái Tim xanh ngát và thung lũng mận Nà Ka thơ mộng",
      "Ngắm Thác Dải Yếm hùng vĩ với dòng nước tuôn trào mềm mại như dải lụa",
      "Thưởng thức bê chao Mộc Châu thơm mềm, cá suối nướng và sữa bò tươi"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Hà Nội - Đèo Đá Trắng Thung Khe - Mộc Châu - Đồi Chè Trái Tim - Thác Dải Yếm",
        "morning": "Xe đón quý khách tại Hà Nội, dừng chân check-in Đèo Thung Khe (Đèo Đá Trắng) mù sương.",
        "afternoon": "Đến Mộc Châu, dạo bước chụp ảnh tại Đồi chè Trái Tim biểu tượng, ngắm Thác Dải Yếm tráng lệ.",
        "evening": "Thưởng thức đặc sản bê chao Bản Lóng Luông, đốt lửa trại giao lưu văn nghệ cùng đồng bào Thái."
      },
      {
        "day": 2,
        "title": "Cầu Kính Bạch Long - Rừng Thông Bản Áng - Về Hà Nội",
        "morning": "Trải nghiệm cảm giác bước đi giữa không trung trên Cầu kính Bạch Long đáy kính trong suốt xuyên núi.",
        "afternoon": "Ghé thăm Rừng thông Bản Áng được mệnh danh là Đà Lạt thu nhỏ của vùng Tây Bắc.",
        "evening": "18:00 Về đến Hà Nội, kết thúc chuyến nghỉ dưỡng trong lành tại cao nguyên Mộc Châu."
      }
    ],
    "inclusions": [
      "Xe du lịch Limousine tiện nghi khứ hồi Hà Nội - Mộc Châu",
      "Khách sạn / Homestay cao cấp giữa thảo nguyên",
      "Vé tham quan Thác Dải Yếm, Đồi chè Trái Tim, Rừng thông Bản Áng",
      "03 bữa chính đặc sản Tây Bắc + 01 bữa sáng",
      "Hướng dẫn viên am hiểu đời sống bản địa",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Vé trải nghiệm Cầu kính Bạch Long (dịch vụ tự chọn)",
      "Chi phí thuê trang phục dân tộc chụp ảnh",
      "Tiền tip bồi dưỡng đoàn"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 1423500
  },
  {
    "id": "DL-HU11",
    "title": "Hoàng Triều Cố Đô: Huế - Đại Nội Hoàng Cung - Ca Huế Sông Hương",
    "slug": "hue-co-do-dai-noi-song-huong",
    "region": "central",
    "regionName": "Miền Trung",
    "image": "assets/images/tour-hue.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "Đà Nẵng / Huế (Xe du lịch VIP)",
    "transport": "Xe VIP máy lạnh + Thuyền rồng Sông Hương",
    "originalPrice": 3390000,
    "price": 2990000,
    "rating": 4.93,
    "reviewsCount": 162,
    "badge": "HOÀNG TRIỀU CỐ ĐÔ",
    "availableSeats": 10,
    "highlights": [
      "Chiêm ngưỡng Ngọ Môn, Điện Thái Hòa và Tử Cấm Thành uy nghiêm của 13 triều vua Nguyễn",
      "Du thuyền rồng nghe Ca Huế và Nhã nhạc cung đình di sản phi vật thể thế giới",
      "Khám phá kiến trúc đỉnh cao Lăng Khải Định và vẻ thanh tịnh Lăng Tự Đức",
      "Thưởng thức ẩm thực cung đình Huế: Bún bò Huế gia truyền, bánh bèo, nậm, lọc"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Đón Khách - Chùa Thiên Mụ Cổ Kính - Du Thuyền Rồng Sông Hương",
        "morning": "Xe đón quý khách tại Huế, đưa về khách sạn nghỉ ngơi, dùng bữa trưa cơm niêu Huế.",
        "afternoon": "Viếng Chùa Thiên Mụ trăm năm ngắm tháp Phước Duyên soi bóng dòng sông Hương thơ mộng.",
        "evening": "Lên thuyền rồng thưởng thức Ca Huế ngọt ngào, tự tay thả đèn hoa đăng cầu an lành trên sông Hương."
      },
      {
        "day": 2,
        "title": "Đại Nội Hoàng Cung - Lăng Vua Khải Định - Lăng Vua Tự Đức",
        "morning": "Khám phá Quần thể Di tích Cố đô Huế: Ngọ Môn, Điện Thái Hòa, Thế Miếu, Hiển Lâm Các.",
        "afternoon": "Chiêm ngưỡng kiến trúc Đông Tây tinh xảo Lăng Khải Định và nét lãng mạn thi vị của Lăng Tự Đức.",
        "evening": "Thưởng thức bữa tối phong cách yến tiệc cung đình Huế, dạo phố đi bộ Chu Văn An sầm uất."
      },
      {
        "day": 3,
        "title": "Làng Hương Thủy Xuân - Chợ Đông Ba Mua Sắm - Tiễn Khách",
        "morning": "Check-in sống ảo muôn màu sắc tại Làng hương Thủy Xuân, học cách làm nón bài thơ truyền thống.",
        "afternoon": "Mua sắm đặc sản mè xửng, tôm chua, trà cung đình tại Chợ Đông Ba. Xe tiễn khách ra sân bay/ga Huế.",
        "evening": "Kết thúc chuyến du hành về miền di sản lịch sử vàng son!"
      }
    ],
    "inclusions": [
      "Xe du lịch đời mới đưa đón suốt chương trình",
      "Khách sạn 4 sao trung tâm thành phố Huế",
      "Vé vào cổng Đại Nội, Lăng Khải Định, Lăng Tự Đức",
      "Vé du thuyền rồng nghe Ca Huế trên sông Hương",
      "Các bữa ăn chính đậm đà phong vị xứ Huế",
      "Hướng dẫn viên chuyên nghiệp giọng Huế dịu dàng",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Vé máy bay / tàu hỏa đến Huế",
      "Đồ uống ngoài thực đơn",
      "Tiền bồi dưỡng hướng dẫn viên"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 1943500
  },
  {
    "id": "DL-NT12",
    "title": "Vịnh Ngọc Biển Xanh: Nha Trang - Vịnh San Hô - Đảo Điệp Sơn - Tắm Khoáng",
    "slug": "nha-trang-vinh-san-ho-diep-son",
    "region": "central",
    "regionName": "Miền Trung",
    "image": "assets/images/tour-nha-trang.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "TP. Hồ Chí Minh / Hà Nội (Vé máy bay / Xe VIP)",
    "transport": "Máy bay / Xe VIP + Cano cao tốc vịnh biển",
    "originalPrice": 4190000,
    "price": 3790000,
    "rating": 4.91,
    "reviewsCount": 204,
    "badge": "VỊNH BIỂN THƯỢNG LƯU",
    "availableSeats": 14,
    "highlights": [
      "Đi bộ trên con đường cát trắng xuyên biển độc nhất vô nhị tại Đảo Điệp Sơn",
      "Lặn ngắm rạn san hô sống phong phú bằng ống thở tại Vịnh San Hô đảo ngọc",
      "Thư giãn phục hồi sức khỏe với liệu trình ngâm bùn khoáng nóng thiên nhiên I-Resort",
      "Thưởng thức nem nướng Ninh Hòa trứ danh, tôm hùm nướng bơ tỏi và hải sản tươi rói"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Đón Sân Bay Cam Ranh - Tháp Bà Ponagar - Tắm Bùn Khoáng I-Resort",
        "morning": "Xe đón quý khách tại Sân bay Cam Ranh / Ga Nha Trang, đưa về khách sạn ven đường Trần Phú.",
        "afternoon": "Chiêm bái quần thể kiến trúc Chăm cổ kính Tháp Bà Ponagar, thư giãn ngâm bùn khoáng I-Resort.",
        "evening": "Thưởng thức đặc sản Nem nướng Ninh Hòa và dạo phố biển đêm Nha Trang gió mát lộng."
      },
      {
        "day": 2,
        "title": "Con Đường Xuyên Biển Đảo Điệp Sơn - Bãi Dốc Lết Cát Trắng",
        "morning": "Cano lướt sóng ra đảo Điệp Sơn, trải nghiệm bước chân trên con đường cát thủy đạo kỳ diệu giữa đại dương.",
        "afternoon": "Tự do tắm biển tại bãi biển Dốc Lết nước trong như pha lê, thưởng thức ghẹ hoa, mực tươi nướng muối ớt.",
        "evening": "Bữa tiệc hải sản tôm hùm, dạo chợ đêm Nha Trang mua ngọc trai và yến sào Khánh Hòa."
      },
      {
        "day": 3,
        "title": "Viện Hải Dương Học - Chùa Long Sơn - Mua Sắm Đặc Sản - Tiễn Bay",
        "morning": "Khám phá hàng ngàn sinh vật biển kỳ thú tại Viện Hải Dương Học lớn nhất Đông Nam Á.",
        "afternoon": "Viếng Chùa Long Sơn chiêm bái Tượng Kim Thân Phật Tổ uy nghiêm. Mua đặc sản mực một nắng, chả cá.",
        "evening": "Xe đưa quý khách ra sân bay Cam Ranh, kết thúc kỳ nghỉ vịnh biển trọn vẹn!"
      }
    ],
    "inclusions": [
      "Khách sạn 4 sao sát biển có hồ bơi vô cực ngắm vịnh",
      "Cano cao tốc tham quan đảo Điệp Sơn và Vịnh San Hô",
      "Vé ngâm bùn khoáng nóng cao cấp I-Resort",
      "Các bữa ăn chính hải sản tươi sống đầy đặn",
      "Xe máy lạnh chất lượng cao đưa đón toàn tuyến",
      "Hướng dẫn viên chuyên nghiệp biển đảo",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Vé máy bay khứ hồi (tùy thời điểm)",
      "Trò chơi dù bay, mô tô nước moto nước",
      "Tiền tip bồi dưỡng đoàn"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 2463500
  },
  {
    "id": "DL-QN13",
    "title": "Xứ Nẫu Biển Nhớ: Quy Nhơn - Kỳ Co - Eo Gió - Hòn Khô Hoang Sơ",
    "slug": "quy-nhon-ky-co-eo-gio",
    "region": "central",
    "regionName": "Miền Trung",
    "image": "assets/images/tour-quynhon.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "TP. Hồ Chí Minh / Hà Nội (Vé máy bay)",
    "transport": "Vé máy bay + Cano cao tốc biển đảo",
    "originalPrice": 3790000,
    "price": 3390000,
    "rating": 4.95,
    "reviewsCount": 182,
    "badge": "MALDIVES VIỆT NAM",
    "availableSeats": 11,
    "highlights": [
      "Bãi tắm Kỳ Co với nước biển hai màu xanh trong như ngọc lục bảo",
      "Check-in con đường đi bộ ven vách đá tuyệt mỹ tại Eo Gió lộng gió",
      "Lặn ngắm rạn san hô tự nhiên tại Hòn Khô và cây cầu gỗ sát vách núi",
      "Thưởng thức ốc biển, nhum biển nướng mỡ hành và bánh xèo tôm nhảy giòn rụm"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Đón Sân Bay Phù Cát - Tháp Đôi Chăm Pa - Ghềnh Ráng Tiên Sa - Hàn Mặc Tử",
        "morning": "Xe đón quý khách tại sân bay Phù Cát, đưa về trung tâm phố biển Quy Nhơn nhận phòng.",
        "afternoon": "Thăm Quần thể Ghềnh Ráng Tiên Sa viếng mộ thi sĩ Hàn Mặc Tử, bãi tắm Hoàng Hậu đá trứng độc đáo.",
        "evening": "Thưởng thức bánh xèo tôm nhảy rau mầm gia truyền, ngắm cảnh biển Quy Nhơn hiền hòa về đêm."
      },
      {
        "day": 2,
        "title": "Thiên Đường Biển Kỳ Co - Vắt Vẻo Eo Gió - Lặn Ngắm San Hô Hòn Khô",
        "morning": "Vượt Cầu Thị Nại, cano cao tốc lướt sóng đưa quý khách cập bãi biển Kỳ Co nước xanh trong vắt.",
        "afternoon": "Dạo bước cung đường đá uốn lượn ven biển Eo Gió ngắm sóng vỗ rì rào. Tắm biển lặn san hô.",
        "evening": "Thưởng thức đại tiệc hải sản tươi sống làng chài Nhơn Lý: nhum biển, ốc hương, tôm mũ ni nướng."
      },
      {
        "day": 3,
        "title": "Tịnh Xá Ngọc Hòa Tượng Phật Đôi - Mua Sắm Đặc Sản - Tiễn Bay",
        "morning": "Chiêm bái Tượng Phật Đôi cao nhất Việt Nam tại Tịnh xá Ngọc Hòa cầu bình an cho gia đạo.",
        "afternoon": "Mua sắm đặc sản bánh ít lá gai, nem Chợ Huyện, mực rim me. Xe tiễn khách ra sân bay Phù Cát.",
        "evening": "Đáp chuyến bay về lại điểm khởi hành, hẹn gặp lại quý khách trong các hành trình tiếp theo!"
      }
    ],
    "inclusions": [
      "Khách sạn 4 sao sát biển view đại dương",
      "Cano cao tốc khứ hồi sang bãi biển Kỳ Co",
      "Vé tham quan Eo Gió, Ghềnh Ráng Tiên Sa, Tháp Đôi",
      "Kính lặn ống thở ngắm san hô cao cấp",
      "Các bữa ăn hải sản tiêu chuẩn làng chài",
      "Hướng dẫn viên bản địa am hiểu sâu sắc",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Vé máy bay khứ hồi (tùy hãng bay)",
      "Chi tiêu cá nhân ngoài thực đơn",
      "Tiền tip bồi dưỡng đoàn"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 2203500
  },
  {
    "id": "DL-PY14",
    "title": "Xứ Sở Hoa Vàng Cỏ Xanh: Phú Yên - Ghềnh Đá Đĩa - Mũi Điện Đón Bình Minh",
    "slug": "phu-yen-ghenh-da-dia-mui-dien",
    "region": "central",
    "regionName": "Miền Trung",
    "image": "assets/images/tour-phuyen.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "Quy Nhơn / Tuy Hòa (Xe du lịch máy lạnh)",
    "transport": "Xe du lịch đời mới máy lạnh",
    "originalPrice": 3100000,
    "price": 2790000,
    "rating": 4.89,
    "reviewsCount": 149,
    "badge": "NON NƯỚC HOA VÀNG",
    "availableSeats": 13,
    "highlights": [
      "Tuyệt tác địa chất tự nhiên độc nhất vô nhị Ghềnh Đá Đĩa hình tổ ong xếp chồng",
      "Đón tia nắng bình minh đầu tiên trên đất liền Việt Nam tại Mũi Điện - Ngọn Hải Đăng",
      "Check-in Bãi Xép ngọn đồi cỏ xanh ngắt bối cảnh phim 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh'",
      "Thưởng thức cá ngừ đại dương chấm mù tạt cay nồng, mắt cá ngừ hầm thuốc bắc bổ dưỡng"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Đón Sân Bay Tuy Hòa - Tháp Nhạn Cổ - Bờ Kè Xóm Rớ Rêu Xanh",
        "morning": "Xe đón quý khách tại sân bay Tuy Hòa, đưa về khách sạn nhận phòng nghỉ ngơi.",
        "afternoon": "Thăm di tích kiến trúc Tháp Nhạn trên đỉnh núi, ngắm toàn cảnh dòng sông Đà Rằng uốn lượn.",
        "evening": "Thưởng thức món Mắt cá ngừ đại dương chưng cách thủy đặc sản nức tiếng Phú Yên."
      },
      {
        "day": 2,
        "title": "Mũi Điện Hải Đăng Đón Bình Minh - Bãi Môn - Vịnh Vũng Rô Tàu Không Số",
        "morning": "05:00 Khởi hành đi Mũi Điện chinh phục ngọn hải đăng Đại Lãnh đón ánh bình minh sớm nhất đất liền.",
        "afternoon": "Dạo bước trên bãi cát mịn Bãi Môn, thăm Di tích lịch sử Tàu không số Vịnh Vũng Rô oai hùng.",
        "evening": "Bữa tối hải sản tươi ngon trên bè nổi Vũng Rô, tự do khám phá phố đêm Tuy Hòa."
      },
      {
        "day": 3,
        "title": "Ghềnh Đá Đĩa Kỳ Vĩ - Nhà Thờ Mằng Lăng - Bãi Xép Hoa Vàng Cỏ Xanh - Tiễn Khách",
        "morning": "Chiêm ngưỡng kỳ quan Ghềnh Đá Đĩa, viếng Nhà thờ Mằng Lăng nơi lưu giữ cuốn sách chữ quốc ngữ đầu tiên.",
        "afternoon": "Ghé Bãi Xép lộng gió thả hồn giữa thảo nguyên xương rồng ngắm sóng biển. Xe tiễn khách ra sân bay.",
        "evening": "Kết thúc chuyến du ngoạn xứ sở hoa vàng cỏ xanh thanh bình và trù phú!"
      }
    ],
    "inclusions": [
      "Khách sạn 4 sao trung tâm thành phố Tuy Hòa",
      "Xe du lịch đời mới vận chuyển suốt tuyến",
      "Vé tham quan tất cả danh thắng trong chương trình",
      "Các bữa ăn chính phong phú đặc sản Phú Yên",
      "Hướng dẫn viên chuyên nghiệp nhiệt huyết",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Vé máy bay khứ hồi",
      "Đồ uống ngoài thực đơn",
      "Tiền tip cho hướng dẫn viên và tài xế"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 1813500
  },
  {
    "id": "DL-TN15",
    "title": "Đỉnh Thiêng Nam Bộ: Tây Ninh - Cáp Treo Đỉnh Núi Bà Đen - Tòa Thánh",
    "slug": "tay-ninh-nui-ba-den-toa-thanh",
    "region": "south",
    "regionName": "Miền Nam",
    "image": "assets/images/tour-tay-ninh.jpg",
    "duration": "1N",
    "daysCount": 1,
    "departure": "TP. Hồ Chí Minh (Xe Limousine đón trung tâm)",
    "transport": "Xe Limousine VIP + Cáp treo Sun World",
    "originalPrice": 1450000,
    "price": 1290000,
    "rating": 4.87,
    "reviewsCount": 230,
    "badge": "ĐỈNH CAO THIÊNG LIÊNG",
    "availableSeats": 20,
    "highlights": [
      "Hệ thống cáp treo hiện đại chinh phục Nóc nhà Nam Bộ cao 986m",
      "Chiêm bái Tượng Phật Bà Tây Bổ Đà Sơn bằng đồng cao nhất châu Á",
      "Chiêm ngưỡng kiến trúc nguy nga rực rỡ của Tòa Thánh Cao Đài Tây Ninh",
      "Thưởng thức bánh tráng phơi sương cuốn thịt luộc rau rừng, bò tơ Tây Ninh"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "TP.HCM - Tòa Thánh Tây Ninh - Sun World Núi Bà Đen - Về TP.HCM Trong Ngày",
        "morning": "06:30 Xe Limousine đón quý khách tại trung tâm TP.HCM, khởi hành đi Tây Ninh. Viếng Tòa Thánh Tây Ninh tham dự giờ kinh trưa thiêng liêng và trang nghiêm.",
        "afternoon": "Trải nghiệm cáp treo lên đỉnh Núi Bà Đen săn mây, chiêm bái Đại Tượng Phật Bà Tây Bổ Đà Sơn, ngắm vườn hoa rực rỡ trên đỉnh núi cao 986m. Dùng bữa trưa buffet phong phú đỉnh núi.",
        "evening": "16:30 Khởi hành về TP.HCM, thưởng thức món Bò tơ Tây Ninh nướng than hồng trên đường về. 19:30 Về đến TP.HCM, kết thúc chuyến hành hương ý nghĩa!"
      }
    ],
    "inclusions": [
      "Xe Limousine máy lạnh cao cấp khứ hồi TP.HCM - Tây Ninh",
      "Vé cáp treo Sun World khứ hồi lên đỉnh Núi Bà Đen",
      "01 bữa ăn trưa buffet cao cấp tại nhà hàng trên đỉnh núi",
      "Vé tham quan Tòa Thánh Tây Ninh",
      "Hướng dẫn viên chuyên nghiệp nhiệt tình đồng hành",
      "Khăn lạnh, nước suối chai 500ml/khách",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Vé cáp treo tuyến Chùa Hang (nếu quý khách có nhu cầu ghé thêm)",
      "Chi phí mua sắm đặc sản bánh tráng, muối tôm mang về",
      "Tiền tip bồi dưỡng tài xế và hướng dẫn viên"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 838500
  },
  {
    "id": "DL-CD16",
    "title": "Biển Trời Huyền Thoại: Côn Đảo - Nghĩa Trang Hàng Dương - Bãi Đầm Trầu",
    "slug": "con-dao-hang-duong-dam-trau",
    "region": "south",
    "regionName": "Miền Nam",
    "image": "assets/images/tour-condao.jpg",
    "duration": "3N2Đ",
    "daysCount": 3,
    "departure": "TP. Hồ Chí Minh / Cần Thơ (Tàu cao tốc / Máy bay)",
    "transport": "Tàu cao tốc 5 sao / Máy bay + Xe điện đảo",
    "originalPrice": 5490000,
    "price": 4890000,
    "rating": 4.97,
    "reviewsCount": 275,
    "badge": "LINH THIÊNG BIỂN TRỜI",
    "availableSeats": 10,
    "highlights": [
      "Viếng mộ nữ Anh hùng Lực lượng Vũ trang Nhân dân Võ Thị Sáu tại Nghĩa trang Hàng Dương",
      "Tham quan Hệ thống Nhà tù Côn Đảo - Chuồng Cọp Pháp, Chuồng Cọp Mỹ chấn động địa cầu",
      "Tắm biển tại Bãi Đầm Trầu hoang sơ ngắm máy bay cất hạ cánh ngay sát đỉnh đầu",
      "Thưởng thức hải sản cua mặt trăng, ốc vú nàng và hạt bàng ngào gừng đặc sản đảo"
    ],
    "itinerary": [
      {
        "day": 1,
        "title": "Đón Cảng Bến Đầm / Sân Bay Cỏ Ống - Miếu Bà Phi Yến - Bãi Nhát Ngắm Đỉnh Tình Yêu",
        "morning": "Xe đón quý khách tại Sân bay Cỏ Ống / Cảng Bến Đầm, đưa về thị trấn Côn Đảo nhận phòng resort ven biển.",
        "afternoon": "Viếng Miếu Bà Phi Yến (An Sơn Miếu), ngắm bãi biển Bãi Nhát hoang sơ và Đỉnh Tình Yêu lãng mạn.",
        "evening": "23:00 Viếng Nghĩa trang Hàng Dương, dâng lễ tại mộ Chị Võ Thị Sáu trong không gian trang nghiêm linh thiêng."
      },
      {
        "day": 2,
        "title": "Di Tích Lịch Sử Nhà Tù Côn Đảo - Bãi Đầm Trầu - Ngắm Hoàng Hôn Bãi Nhát",
        "morning": "Thăm di tích Nhà tù Côn Đảo: Trại Phú Hải, Chuồng Cọp Pháp, Chuồng Cọp Mỹ, Cầu Tàu 914 lịch sử.",
        "afternoon": "Nghỉ ngơi tắm biển tại Bãi Đầm Trầu nước xanh biếc, trải nghiệm khoảnh khắc máy bay lướt sát trên bãi biển.",
        "evening": "Thưởng thức đại tiệc hải sản cua mặt trăng, cá thu một nắng, tự do dạo phố biển đêm thanh bình."
      },
      {
        "day": 3,
        "title": "Chợ Côn Đảo - Mua Đặc Sản Hạt Bàng - Tiễn Khách Về Đất Liền",
        "morning": "Ghé Chợ Côn Đảo mua hạt bàng rang muối, mứt hạt bàng gừng, mực một nắng tươi ngon.",
        "afternoon": "Xe đưa quý khách ra sân bay Cỏ Ống / Cảng Bến Đầm làm thủ tục về lại TP.HCM / Cần Thơ.",
        "evening": "Về đến điểm xuất phát, kết thúc hành trình về miền đất thiêng đầy cảm xúc!"
      }
    ],
    "inclusions": [
      "Vé tàu cao tốc khứ hồi 5 sao hoặc vé máy bay theo gói chọn",
      "Resort 3-4 sao sát biển yên bình tại Côn Đảo",
      "Xe điện / xe máy lạnh đưa đón tham quan suốt tuyến",
      "Bộ lễ dâng viếng Nghĩa trang Hàng Dương chu đáo",
      "Các bữa ăn chính tiêu chuẩn hải sản biển đảo",
      "Hướng dẫn viên am hiểu sâu sắc lịch sử và tâm linh Côn Đảo",
      "Bảo hiểm du lịch 100.000.000 VNĐ"
    ],
    "exclusions": [
      "Đồ uống gọi thêm ngoài chương trình",
      "Chi phí phòng đơn nếu đi 1 mình",
      "Tiền bồi dưỡng hướng dẫn viên và tài xế"
    ],
    "status": "ACTIVE",
    "countryCode": "VN",
    "childPrice": 3178500
  }
];

const DEFAULT_SCHEDULES = [
  {
    "id": "SCH-DL-HL01-01",
    "tourId": "DL-HL01",
    "tourTitle": "Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ",
    "departureAt": "2026-11-15T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 3890000,
    "childPrice": 2528500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-DN02-01",
    "tourId": "DL-DN02",
    "tourTitle": "Thiên Đường Miền Trung: Đà Nẵng - Cầu Vàng - Phố Cổ Hội An",
    "departureAt": "2026-11-16T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 4490000,
    "childPrice": 2918500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-PQ03-01",
    "tourId": "DL-PQ03",
    "tourTitle": "Đảo Ngọc Phú Quốc - Cáp Treo Hòn Thơm - Grand World",
    "departureAt": "2026-11-17T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 4690000,
    "childPrice": 3048500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-DL04-01",
    "tourId": "DL-DL04",
    "tourTitle": "Thành Phố Ngàn Hoa: Đà Lạt Mộng Mơ - Đồi Chè Cầu Đất",
    "departureAt": "2026-11-18T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 2590000,
    "childPrice": 1683500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-SP05-01",
    "tourId": "DL-SP05",
    "tourTitle": "Sa Pa Mờ Sương: Chinh Phục Nóc Nhà Fansipan - Bản Cát Cát",
    "departureAt": "2026-11-19T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 3190000,
    "childPrice": 2073500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-MT06-01",
    "tourId": "DL-MT06",
    "tourTitle": "Sông Nước Miền Tây: Cần Thơ Chợ Nổi Cái Răng - Trà Sư",
    "departureAt": "2026-11-20T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 1690000,
    "childPrice": 1098500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-NB07-01",
    "tourId": "DL-NB07",
    "tourTitle": "Tuyệt Tác Non Nước: Ninh Bình - Tràng An - Chùa Bái Đính - Hang Múa",
    "departureAt": "2026-11-21T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 1990000,
    "childPrice": 1293500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-HG08-01",
    "tourId": "DL-HG08",
    "tourTitle": "Huyền Thoại Đá Sỏi: Hà Giang - Đèo Mã Pí Lèng - Du Thuyền Sông Nho Quế",
    "departureAt": "2026-11-22T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 3490000,
    "childPrice": 2268500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-CB09-01",
    "tourId": "DL-CB09",
    "tourTitle": "Vùng Biên Ải Hùng Vĩ: Cao Bằng - Thác Bản Giốc - Động Ngườm Ngao",
    "departureAt": "2026-11-23T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 2890000,
    "childPrice": 1878500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-MC10-01",
    "tourId": "DL-MC10",
    "tourTitle": "Thảo Nguyên Mộc Châu: Đồi Chè Trái Tim - Thác Dải Yếm - Cầu Kính Bạch Long",
    "departureAt": "2026-11-24T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 2190000,
    "childPrice": 1423500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-HU11-01",
    "tourId": "DL-HU11",
    "tourTitle": "Hoàng Triều Cố Đô: Huế - Đại Nội Hoàng Cung - Ca Huế Sông Hương",
    "departureAt": "2026-11-15T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 2990000,
    "childPrice": 1943500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-NT12-01",
    "tourId": "DL-NT12",
    "tourTitle": "Vịnh Ngọc Biển Xanh: Nha Trang - Vịnh San Hô - Đảo Điệp Sơn - Tắm Khoáng",
    "departureAt": "2026-11-16T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 3790000,
    "childPrice": 2463500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-QN13-01",
    "tourId": "DL-QN13",
    "tourTitle": "Xứ Nẫu Biển Nhớ: Quy Nhơn - Kỳ Co - Eo Gió - Hòn Khô Hoang Sơ",
    "departureAt": "2026-11-17T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 3390000,
    "childPrice": 2203500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-PY14-01",
    "tourId": "DL-PY14",
    "tourTitle": "Xứ Sở Hoa Vàng Cỏ Xanh: Phú Yên - Ghềnh Đá Đĩa - Mũi Điện Đón Bình Minh",
    "departureAt": "2026-11-18T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 2790000,
    "childPrice": 1813500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-TN15-01",
    "tourId": "DL-TN15",
    "tourTitle": "Đỉnh Thiêng Nam Bộ: Tây Ninh - Cáp Treo Đỉnh Núi Bà Đen - Tòa Thánh",
    "departureAt": "2026-11-19T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 1290000,
    "childPrice": 838500,
    "status": "OPEN"
  },
  {
    "id": "SCH-DL-CD16-01",
    "tourId": "DL-CD16",
    "tourTitle": "Biển Trời Huyền Thoại: Côn Đảo - Nghĩa Trang Hàng Dương - Bãi Đầm Trầu",
    "departureAt": "2026-11-20T08:00:00",
    "totalSeats": 25,
    "bookedSeats": 0,
    "adultPrice": 4890000,
    "childPrice": 3178500,
    "status": "OPEN"
  }
];

const DEFAULT_BOOKINGS = [];

const DEFAULT_PAYMENTS = [];

const DEFAULT_AUDIT_LOGS = [];

const VOUCHERS_DATA = [
  {
    "code": "DELTA10",
    "description": "Giảm ngay 10% tổng hóa đơn (Tối đa 1.000.000đ)",
    "discountType": "percent",
    "discountValue": 10,
    "maxDiscount": 1000000,
    "minOrderValue": 2000000
  },
  {
    "code": "HE2026",
    "description": "Mã mùa hè: Giảm trực tiếp 500.000đ cho đơn từ 3.000.000đ",
    "discountType": "fixed",
    "discountValue": 500000,
    "minOrderValue": 3000000
  },
  {
    "code": "VIPTOUR",
    "description": "Ưu đãi khách hàng VIP: Giảm 15% tổng tiền (Tối đa 1.500.000đ)",
    "discountType": "percent",
    "discountValue": 15,
    "maxDiscount": 1500000,
    "minOrderValue": 5000000
  },
  {
    "code": "BANMOI",
    "description": "Chào bạn mới: Giảm 200.000đ cho mọi đơn đặt tour",
    "discountType": "fixed",
    "discountValue": 200000,
    "minOrderValue": 1500000
  }
];

const ADDON_SERVICES = {
  "singleRoom": {
    "name": "Phụ thu phòng đơn riêng tư",
    "price": 500000,
    "unit": "phòng"
  },
  "airportShuttle": {
    "name": "Đưa đón sân bay VIP 2 chiều",
    "price": 300000,
    "unit": "chuyến"
  },
  "premiumInsurance": {
    "name": "Bảo hiểm du lịch cao cấp (mức 200tr)",
    "price": 150000,
    "unit": "khách"
  }
};

const DESTINATIONS_DATA = [
  {
    "name": "Vịnh Hạ Long",
    "count": "18+ Tours",
    "image": "assets/images/halong.png",
    "region": "north"
  },
  {
    "name": "Đà Nẵng - Hội An",
    "count": "25+ Tours",
    "image": "assets/images/danang.png",
    "region": "central"
  },
  {
    "name": "Phú Quốc Đảo Ngọc",
    "count": "15+ Tours",
    "image": "assets/images/phuquoc.png",
    "region": "south"
  },
  {
    "name": "Đà Lạt Mộng Mơ",
    "count": "20+ Tours",
    "image": "assets/images/dalat.png",
    "region": "central"
  },
  {
    "name": "Sa Pa Sương Mù",
    "count": "12+ Tours",
    "image": "assets/images/sapa.png",
    "region": "north"
  },
  {
    "name": "Sông Nước Miền Tây",
    "count": "14+ Tours",
    "image": "assets/images/mientay.png",
    "region": "south"
  }
];

// Biến TOURS_DATA toàn cục giữ nguyên để tương thích ngược 100% với mã nguồn hiện tại
const TOURS_DATA = [];
if (typeof window !== "undefined") {
  window.TOURS_DATA = TOURS_DATA;
}

// =============================================================================
// III. TẦNG QUẢN LÝ DỮ LIỆU LOCALSTORAGE (DATA ACCESS LAYER)
// =============================================================================

/**
 * Lấy danh sách Tours từ LocalStorage
 */
function getToursData() {
  try {
    const raw = localStorage.getItem(DELTA_STORAGE_KEYS.TOURS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= DEFAULT_TOURS.length) return parsed;
    }
  } catch (e) {
    console.warn("Lỗi đọc delta_tours:", e);
  }
  localStorage.setItem(DELTA_STORAGE_KEYS.TOURS, JSON.stringify(DEFAULT_TOURS));
  return [...DEFAULT_TOURS];
}

/**
 * Lưu danh sách Tours vào LocalStorage và đồng bộ mảng TOURS_DATA
 */
function saveToursData(tours) {
  localStorage.setItem(DELTA_STORAGE_KEYS.TOURS, JSON.stringify(tours));
  syncInMemoryTours(tours);
  window.dispatchEvent(new CustomEvent("delta_tours_updated", { detail: tours }));
}

/**
 * Lấy danh sách Lịch khởi hành
 */
function getSchedulesData() {
  try {
    const raw = localStorage.getItem(DELTA_STORAGE_KEYS.SCHEDULES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= DEFAULT_SCHEDULES.length) return parsed;
    }
  } catch (e) {
    console.warn("Lỗi đọc delta_schedules:", e);
  }
  localStorage.setItem(DELTA_STORAGE_KEYS.SCHEDULES, JSON.stringify(DEFAULT_SCHEDULES));
  return [...DEFAULT_SCHEDULES];
}

/**
 * Lưu danh sách Lịch khởi hành
 */
function saveSchedulesData(schedules) {
  localStorage.setItem(DELTA_STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
  window.dispatchEvent(new CustomEvent("delta_schedules_updated", { detail: schedules }));
}

/**
 * Lấy danh sách Đơn đặt tour (Rỗng nếu chưa có khách đặt)
 */
function getBookingsData() {
  try {
    const raw = localStorage.getItem(DELTA_STORAGE_KEYS.BOOKINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Lỗi đọc delta_bookings:", e);
  }
  localStorage.setItem(DELTA_STORAGE_KEYS.BOOKINGS, JSON.stringify(DEFAULT_BOOKINGS));
  return [...DEFAULT_BOOKINGS];
}

/**
 * Lưu danh sách Đơn đặt tour
 */
function saveBookingsData(bookings) {
  localStorage.setItem(DELTA_STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
  window.dispatchEvent(new CustomEvent("delta_bookings_updated", { detail: bookings }));
}

/**
 * Lấy danh sách Thanh toán (Rỗng nếu chưa có giao dịch)
 */
function getPaymentsData() {
  try {
    const raw = localStorage.getItem(DELTA_STORAGE_KEYS.PAYMENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Lỗi đọc delta_payments:", e);
  }
  localStorage.setItem(DELTA_STORAGE_KEYS.PAYMENTS, JSON.stringify(DEFAULT_PAYMENTS));
  return [...DEFAULT_PAYMENTS];
}

/**
 * Lưu danh sách Thanh toán
 */
function savePaymentsData(payments) {
  localStorage.setItem(DELTA_STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  window.dispatchEvent(new CustomEvent("delta_payments_updated", { detail: payments }));
}

/**
 * Lấy danh sách Nhật ký kiểm toán (Rỗng nếu chưa có sự kiện)
 */
function getAuditLogsData() {
  try {
    const raw = localStorage.getItem(DELTA_STORAGE_KEYS.AUDIT_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Lỗi đọc delta_audit_logs:", e);
  }
  localStorage.setItem(DELTA_STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(DEFAULT_AUDIT_LOGS));
  return [...DEFAULT_AUDIT_LOGS];
}

/**
 * Ghi lại sự kiện can thiệp vào Nhật ký kiểm toán
 */
function addAuditLog(action, entity, entityId, details, actorOverride) {
  const logs = getAuditLogsData();
  let actorName = actorOverride;
  if (!actorName) {
    try {
      const curUser = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
      actorName = curUser ? curUser.fullName : "Quản trị viên";
    } catch (e) {
      actorName = "Quản trị viên";
    }
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timeStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const newLog = {
    id: "AUD-" + Date.now().toString().slice(-6),
    timestamp: timeStr,
    actor: actorName,
    action: action,
    entity: entity,
    entityId: entityId || "-",
    details: details
  };

  logs.unshift(newLog);
  localStorage.setItem(DELTA_STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  window.dispatchEvent(new CustomEvent("delta_audit_updated", { detail: logs }));
  return newLog;
}

/**
 * Khôi phục danh mục Tour về mặc định và dọn rác
 */
function resetDeltaDataToDefaults() {
  localStorage.setItem(DELTA_STORAGE_KEYS.TOURS, JSON.stringify(DEFAULT_TOURS));
  localStorage.setItem(DELTA_STORAGE_KEYS.SCHEDULES, JSON.stringify(DEFAULT_SCHEDULES));
  localStorage.setItem(DELTA_STORAGE_KEYS.BOOKINGS, JSON.stringify([]));
  localStorage.setItem(DELTA_STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
  localStorage.setItem(DELTA_STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
  syncInMemoryTours(DEFAULT_TOURS);
  addAuditLog("FACTORY_RESET", "Hệ Thống", "ALL", "Khôi phục danh mục Tour và làm sạch dữ liệu kiểm toán");
  return true;
}

/**
 * Đồng bộ mảng TOURS_DATA trong RAM
 */
function syncInMemoryTours(tours) {
  TOURS_DATA.length = 0;
  (tours || []).forEach(t => TOURS_DATA.push(t));
}

// =============================================================================
// IV. TỰ ĐỘNG KHỞI TẠO BỘ NHỚ KHI SCRIPT ĐƯỢC NẠP
// =============================================================================
(function initStorageRuntime() {
  // Tự động dọn dẹp các key cũ nếu có lỗi font chữ hoặc dữ liệu giả lập cũ
  try {
    const oldTours = localStorage.getItem("delta_tours");
    if (oldTours && (oldTours.includes("Ã") || oldTours.includes("Ä") || oldTours.includes("Â"))) {
      localStorage.removeItem("delta_tours");
    }
    const oldBookings = localStorage.getItem("delta_bookings_v2");
    if (oldBookings && oldBookings.includes("DL-982101")) {
      localStorage.removeItem("delta_bookings_v2");
      localStorage.removeItem("delta_payments");
      localStorage.removeItem("delta_audit_logs");
    }
    localStorage.removeItem("delta_bookings_v2");
    localStorage.removeItem("delta_payments");
    localStorage.removeItem("delta_audit_logs");
  } catch (e) {}

  const currentTours = getToursData();
  syncInMemoryTours(currentTours);
  getSchedulesData();
  getBookingsData();
  getPaymentsData();
  getAuditLogsData();
})();
