/**
 * DELTA TRAVEL - INTERNATIONALIZATION SYSTEM (i18n.js)
 * -------------------------------------------------------------
 * Hệ thống chuyển đổi song ngữ Tiếng Việt (VI 🇻🇳) & Tiếng Anh (EN 🇬🇧)
 * Dịch đầy đủ 100% toàn bộ giao diện: Topbar, Header, Tab Bar, Hero,
 * Bộ lọc, Thẻ tour, AI Concierge, Quản lý đơn, Hồ sơ & Đặt vé.
 */

const DELTA_TRANSLATIONS = {
  vi: {
    // Topbar & Header
    topbar_commit: "Cam kết 100% bảo hiểm & giá chuẩn",
    topbar_track: "Tra cứu đơn đặt chỗ",
    topbar_wishlist: "Yêu thích",
    topbar_logout: "Đăng xuất",
    btn_login: "Đăng nhập",
    btn_register: "Đăng ký",
    btn_explore: "Khám phá Tour",
    brand_sub: "KHÁM PHÁ & NGHỈ DƯỠNG",

    // Central Nav Dock Tabs
    nav_home: "Trang chủ",
    nav_north: "Miền Bắc",
    nav_central: "Miền Trung",
    nav_south: "Miền Nam",
    nav_all_tours: "Tất cả tour",
    nav_my_bookings: "Đơn của tôi",
    nav_ai_assistant: "Trợ lý AI",

    // Hero 3D Section
    hero_badge: "Thương hiệu lữ hành xuất sắc nhất năm 2026",
    hero_title_1: "Khám Phá Vẻ Đẹp",
    hero_title_2: "Việt Nam Cùng",
    hero_desc: "Từ góc nhìn bao la của vũ trụ đến kỳ quan Vịnh Hạ Long, trải nghiệm những hành trình du lịch nghỉ dưỡng trọn vẹn 5 sao với dịch vụ cao cấp và mức giá ưu đãi hàng đầu.",
    hero_btn_explore: "Khám Phá Tour Ngay",
    hero_btn_search: "Tìm Chuyến Đi",
    hero_scroll: "Cuộn để khám phá",
    hero_phase2_badge: "Kỳ quan thiên nhiên thế giới",
    hero_phase2_title: "Băng Qua Những Tầng Mây Hùng Vĩ",
    hero_phase2_desc: "Đón ánh bình minh rực rỡ trên non nước hữu tình với hệ thống du thuyền 5 sao chuẩn quốc tế và hải trình độc bản.",
    hero_phase3_badge: "Điểm đến thiên đường nghỉ dưỡng",
    hero_slide2_badge: "Điểm đến thiên đường nghỉ dưỡng",
    hero_slide2_title: "Chào Mừng Đến Vịnh Hạ Long",
    hero_slide2_desc: "Hơn 50.000 du khách đã tin chọn Delta Travel cho những kỳ nghỉ đáng nhớ nhất cuộc đời.",
    hero_slide2_btn: "Đặt Chỗ Ngay Hôm Nay",

    // Hero Search Bar
    search_destination_label: "BẠN MUỐN ĐI ĐÂU?",
    search_destination_placeholder: "Nhập tên tour, Hạ Long, Phú Quốc...",
    search_region_label: "KHU VỰC / VÙNG MIỀN",
    search_region_all: "Tất cả vùng miền",
    search_region_north: "Miền Bắc (Hạ Long, Sa Pa...)",
    search_region_central: "Miền Trung (Đà Nẵng, Hội An, Đà Lạt...)",
    search_region_south: "Miền Nam (Phú Quốc, Miền Tây...)",
    search_budget_label: "MỨC NGÂN SÁCH",
    search_budget_all: "Tất cả mức giá",
    search_budget_under3m: "Dưới 3.000.000 đ",
    search_budget_3to5m: "Từ 3.000.000 - 5.000.000 đ",
    search_budget_above5m: "Trên 5.000.000 đ",
    search_btn_submit: "Tìm kiếm",

    // Tours Section & Sidebar Filters
    section_tag: "Hành trình chọn lọc",
    section_title: "Tour Du Lịch Trọn Gói Được Yêu Thích Nhất",
    section_subtitle: "Tận hưởng dịch vụ đẳng cấp quốc tế với đội ngũ hướng dẫn viên giàu kinh nghiệm và lịch trình thiết kế tối ưu nhất.",
    filter_heading: "Bộ lọc",
    filter_reset: "Đặt lại",
    filter_region: "Khu vực",
    filter_all: "Tất cả",
    filter_north: "Miền Bắc",
    filter_central: "Miền Trung",
    filter_south: "Miền Nam",
    filter_destination: "Điểm đến",
    filter_destination_placeholder: "Ví dụ: Hạ Long",
    filter_departure: "Điểm khởi hành",
    filter_departure_placeholder: "Ví dụ: Hà Nội",
    filter_departure_date: "Ngày khởi hành",
    filter_date_placeholder: "Chọn ngày khởi hành (ngày/tháng/năm)",
    filter_price_range: "Khoảng giá",
    filter_price_all: "Tất cả mức giá",
    filter_price_under2m: "Dưới 2 triệu",
    filter_price_2to5m: "2–5 triệu",
    filter_price_5to10m: "Trên 5–10 triệu",
    filter_price_10to20m: "Trên 10–20 triệu",
    filter_price_above20m: "Trên 20 triệu",
    filter_duration: "Thời lượng",
    filter_duration_all: "Mọi thời lượng",
    filter_duration_1d: "1 ngày",
    filter_duration_2d1n: "2 ngày 1 đêm",
    filter_duration_3d2n: "3 ngày 2 đêm",
    filter_duration_4d3n: "4 ngày 3 đêm",
    filter_duration_5d: "Từ 5 ngày trở lên",
    filter_transport: "Phương tiện",
    filter_transport_all: "Mọi phương tiện",
    filter_transport_flight: "Máy bay",
    filter_transport_bus: "Xe du lịch",
    filter_transport_train: "Tàu hỏa",
    filter_transport_cruise: "Tàu thủy / Du thuyền",
    filter_availability: "Tình trạng chỗ",
    filter_availability_all: "Mọi tình trạng",
    filter_availability_available: "Còn chỗ",
    filter_availability_soldout: "Hết chỗ",
    filter_btn_apply: "Áp dụng bộ lọc",
    filter_hot_tags: "Tag tìm kiếm hot",
    sort_label: "Sắp xếp:",
    sort_default: "Mặc định nổi bật",
    sort_price_asc: "Giá: Thấp đến Cao",
    sort_price_desc: "Giá: Cao đến Thấp",
    sort_duration: "Thời lượng: Ngắn đến Dài",
    sort_newest: "Tour mới nhất",
    sort_departure_soonest: "Ngày khởi hành gần nhất",
    tag_cruise: "Du thuyền 5*",
    support_title: "Tư vấn viên 24/7",
    support_sub: "Hỗ trợ miễn phí hành trình",
    support_chat: "Chat với tư vấn viên",
    commit_title: "Cam kết Delta Travel",
    commit_1: "100% Giá chuẩn niêm yết",
    commit_2: "Bảo hiểm du lịch toàn diện",
    commit_3: "Khách sạn & Du thuyền cao cấp",
    commit_4: "Đổi ngày khởi hành linh hoạt",
    showing_tours: "Hiển thị",

    // Tên 16 Tour Du Lịch Toàn Quốc
    tour_title_DL_HL01: "Tour Du Thuyền 5 Sao Vịnh Hạ Long - Vịnh Lan Hạ",
    tour_title_DL_DN02: "Thiên Đường Miền Trung: Đà Nẵng - Cầu Vàng - Phố Cổ Hội An",
    tour_title_DL_PQ03: "Đảo Ngọc Phú Quốc - Cáp Treo Hòn Thơm - Grand World",
    tour_title_DL_DL04: "Thành Phố Ngàn Hoa: Đà Lạt Mộng Mơ - Đồi Chè Cầu Đất",
    tour_title_DL_SP05: "Sa Pa Mờ Sương: Chinh Phục Nóc Nhà Fansipan - Bản Cát Cát",
    tour_title_DL_MT06: "Sông Nước Miền Tây: Cần Thơ Chợ Nổi Cái Răng - Trà Sư",
    tour_title_DL_NB07: "Tuyệt Tác Non Nước: Ninh Bình - Tràng An - Chùa Bái Đính - Hang Múa",
    tour_title_DL_HG08: "Huyền Thoại Đá Sỏi: Hà Giang - Đèo Mã Pí Lèng - Du Thuyền Sông Nho Quế",
    tour_title_DL_CB09: "Vùng Biên Ải Hùng Vĩ: Cao Bằng - Thác Bản Giốc - Động Ngườm Ngao",
    tour_title_DL_MC10: "Thảo Nguyên Mộc Châu: Đồi Chè Trái Tim - Thác Dải Yếm - Cầu Kính Bạch Long",
    tour_title_DL_HU11: "Hoàng Triều Cố Đô: Huế - Đại Nội Hoàng Cung - Ca Huế Sông Hương",
    tour_title_DL_NT12: "Vịnh Ngọc Biển Xanh: Nha Trang - Vịnh San Hô - Đảo Điệp Sơn - Tắm Khoáng",
    tour_title_DL_QN13: "Xứ Nẫu Biển Nhớ: Quy Nhơn - Kỳ Co - Eo Gió - Hòn Khô Hoang Sơ",
    tour_title_DL_PY14: "Xứ Sở Hoa Vàng Cỏ Xanh: Phú Yên - Ghềnh Đá Đĩa - Mũi Điện Đón Bình Minh",
    tour_title_DL_TN15: "Đỉnh Thiêng Nam Bộ: Tây Ninh - Cáp Treo Đỉnh Núi Bà Đen - Tòa Thánh",
    tour_title_DL_CD16: "Biển Trời Huyền Thoại: Côn Đảo - Nghĩa Trang Hàng Dương - Bãi Đầm Trầu",

    // Tour Cards
    card_featured: "TOUR NỔI BẬT",
    card_flashsale: "FLASH SALE",
    card_left_seats: "Còn {n} chỗ",
    card_sold_out: "Hết chỗ",
    card_per_guest: "/ khách",
    card_view_itinerary: "Xem lịch trình",
    card_book_now: "Đặt ngay",
    card_pickup: "Điểm đón:",
    card_departure: "Khởi hành:",
    card_reviews: "({n} đánh giá)",

    // AI Concierge
    ai_title: "Trợ Lý AI Concierge 5 Sao",
    ai_badge: "DELTA CONCIERGE",
    ai_sub: "Tư vấn hành trình cá nhân hóa, cập nhật thời tiết & hỗ trợ đặt chỗ trực tiếp",
    ai_section_topics: "GỢI Ý CÂU HỎI THỊNH HÀNH",
    ai_btn_reset: "Làm mới",
    ai_btn_close: "Đóng toàn màn hình",
    ai_hotline: "Tổng đài 24/7:",
    ai_live_sync: "Giá vé & chỗ trống đồng bộ theo thời gian thực",
    ai_input_placeholder: "Hỏi AI bất kỳ điều gì: 'Tìm tour Hạ Long 3 ngày', 'Tour đi Đà Lạt cho 2 người'...",
    ai_btn_send: "Gửi",
    ai_welcome_title: "Kính chào Quý khách! 👋",
    ai_welcome_body: "Tôi là Trợ lý AI Concierge của Delta Travel. Tôi có thể hỗ trợ bạn tìm kiếm các hành trình nghỉ dưỡng 5 sao, cung cấp chi tiết thời tiết, lộ trình và đề xuất tour để bạn bấm đặt giữ chỗ ngay trong hội thoại.",
    ai_suggested_tours_title: "Tour nổi bật có thể đặt ngay:",

    // User Profile Modal
    profile_title: "Hồ sơ cá nhân",
    profile_bookings_count: "Đơn đã đặt",
    profile_rank: "Hạng tài khoản",
    profile_joined: "Ngày tham gia",
    profile_tab_info: "Thông tin cá nhân",
    profile_tab_password: "Đổi mật khẩu",
    profile_name_label: "Họ và tên",
    profile_phone_label: "Số điện thoại",
    profile_email_label: "Email (Định danh tài khoản không đổi)",
    profile_btn_save: "Lưu Thay Đổi",

    // My Bookings Page
    mb_official_tag: "PHIẾU ĐIỆN TỬ CHÍNH THỨC",
    mb_title: "Quản Lý Đơn Đặt Tour & Tra Cứu Chuyến Đi",
    mb_sub: "Theo dõi tiến độ duyệt chỗ, thanh toán trực tuyến và in phiếu giữ chỗ chính thức chuẩn giấy.",
    mb_btn_print: "In toàn bộ danh sách",
    mb_search_placeholder: "Nhập mã đơn (BK.../DL...), SĐT hoặc tên tour...",
    mb_tab_all: "Tất cả đơn",
    mb_tab_pending: "Chờ thanh toán",
    mb_tab_paid: "Đã thanh toán",
    mb_tab_confirmed: "Đã duyệt giữ chỗ",
    mb_tab_cancelled: "Đã hủy",
    mb_empty_title: "Không tìm thấy đơn đặt tour nào",
    mb_empty_desc: "Bạn chưa có đơn đặt tour phù hợp với tiêu chí tra cứu hiện tại.",
    mb_empty_btn: "Khám phá & Đặt Tour Ngay",

    // Itinerary Modal
    itinerary_tab_daily: "Lịch Trình Từng Ngày",
    itinerary_tab_inclusions: "Dịch Vụ Bao Gồm",
    itinerary_tab_terms: "Chính Sách Hoàn Hủy",
    itinerary_package_price: "Giá trọn gói khuyến mãi:",
    itinerary_book_now: "Đặt tour này ngay",
    itinerary_included_title: "Giá Tour Bao Gồm",
    itinerary_excluded_title: "Giá Tour Không Bao Gồm",
    itinerary_terms_title: "Quy định hoàn / đổi vé tour",
    terms_1: "Hủy tour trước 15 ngày khởi hành: Miễn phí 100% chi phí hủy.",
    terms_2: "Hủy tour từ 07 - 14 ngày trước khởi hành: Tính phí 30% giá tour.",
    terms_3: "Hủy tour từ 03 - 06 ngày trước khởi hành: Tính phí 50% giá tour.",
    terms_4: "Hủy tour trong vòng 48h trước giờ xuất phát: Tính phí 100% giá tour.",
    terms_5: "Trường hợp thiên tai bão lũ, hoãn chuyến bay: Delta Travel hỗ trợ bảo lưu 100% tiền cọc hoặc đổi sang tour tương đương.",
    itinerary_morning: "Buổi sáng",
    itinerary_afternoon: "Buổi chiều",
    itinerary_evening: "Buổi tối",

    // Destinations Section
    dest_tag: "Tọa độ hấp dẫn",
    dest_title: "Khám Phá Những Vùng Đất Kỳ Thú",
    dest_desc: "Từ kỳ quan thiên nhiên thế giới Hạ Long đến bãi biển xanh ngọc Phú Quốc, cùng Delta Travel lưu giữ những khoảnh khắc đẹp nhất.",

    // Why Choose Us Section
    why_tag: "Giá trị cốt lõi",
    why_title: "Tại Sao Khách Hàng Luôn Tin Chọn Delta Travel?",
    why_desc: "Chúng tôi không chỉ bán tour du lịch, chúng tôi đồng hành và mang đến cho bạn những trải nghiệm cảm xúc đáng giá nhất.",
    why_1_title: "Giá Luôn Tốt & Rõ Ràng",
    why_1_desc: "Cam kết giá trọn gói minh bạch, không phí ẩn. Luôn có chính sách ưu đãi giảm giá tốt nhất thị trường.",
    why_2_title: "Khách Sạn & Du Thuyền 5*",
    why_2_desc: "Hợp tác độc quyền với các chuỗi resort, du thuyền và khách sạn cao cấp, phòng ốc tiện nghi đạt chuẩn.",
    why_3_title: "Bảo Hiểm Trọn Gói 100%",
    why_3_desc: "Mọi khách hàng đều được hưởng gói bảo hiểm du lịch toàn diện với mức bồi thường lên tới 120 triệu đồng.",
    why_4_title: "Hỗ Trợ 24/7 Tận Tâm",
    why_4_desc: "Đội ngũ chuyên viên tư vấn và hướng dẫn viên sẵn sàng hỗ trợ chăm sóc quý khách trên mọi cung đường.",

    // Testimonials Section
    testi_tag: "Khách hàng chia sẻ thực tế",
    testi_title: "Cảm Nhận Từ Những Người Bạn Đồng Hành",
    testi_desc: "Hơn 50.000 khách hàng đã trải nghiệm và đánh giá chất lượng chuẩn 5 sao cùng Delta Travel.",

    // Travel Blog
    blog_tag: "Cẩm nang du lịch",
    blog_title: "Kinh Nghiệm & Điểm Đến Mới Lạ",
    blog_desc: "Tổng hợp những thông tin hữu ích, địa điểm ăn uống ngon bổ rẻ và bí quyết chụp ảnh du lịch tuyệt đẹp.",
    blog_views_1: "1.250 lượt xem",
    blog_views_2: "2.140 lượt xem",
    blog_views_3: "980 lượt xem",
    blog_1_title: "Kinh nghiệm đi tour du thuyền Hạ Long 5 sao chi tiết từ A-Z",
    blog_1_desc: "Bỏ túi những lưu ý quan trọng về cách chọn hạng phòng, trang phục check-in hoàng hôn và hoạt động câu mực đêm thú vị.",
    blog_2_title: "Bí kíp săn biển mây Đồi Chè Cầu Đất Đà Lạt triệu view",
    blog_2_desc: "Thời điểm vàng để bắt trọn khoảnh khắc mây bồng bềnh lúc bình minh và những quán cafe view thung lũng đẹp mê hồn.",
    blog_3_title: "Thưởng thức tô hủ tiếu bồng bềnh tại Chợ Nổi Cái Răng",
    blog_3_desc: "Nét văn hóa giao thương độc đáo trên sông nước Cửu Long và trải nghiệm len lỏi rừng tràm xanh ngắt bằng xuồng ba lá.",
    blog_read_more: "Xem chi tiết hành trình",

    // FAQ
    faq_tag: "Giải đáp thắc mắc",
    faq_title: "Câu Hỏi Thường Gặp Về Dịch Vụ Tour",
    faq_desc: "Tất cả những thông tin bạn cần biết về thủ tục đặt lịch, chính sách giá vé trẻ em và hoàn tiền.",
    faq_q1: "1. Quy trình đặt tour trực tuyến tại Delta Travel diễn ra như thế nào?",
    faq_a1: "Bạn chỉ cần chọn tour ưng ý, bấm \"Đặt ngay\", điền thông tin người đi, số lượng khách và chọn phương thức thanh toán. Hệ thống sẽ cấp ngay vé điện tử có mã đặt chỗ hợp lệ.",
    faq_q2: "2. Chính sách giá tour dành cho trẻ em và em bé được tính ra sao?",
    faq_a2: "Người lớn (từ 11 tuổi trở lên) tính 100% giá tour tiêu chuẩn. Trẻ em (5-10 tuổi) tính 75% giá vé (có suất ăn và ghế riêng). Em bé (dưới 5 tuổi) phụ thu 10% bảo hiểm & thủ tục.",
    faq_q3: "3. Tôi có thể hủy hoặc đổi ngày khởi hành sau khi đã đặt không?",
    faq_a3: "Delta Travel hỗ trợ đổi ngày khởi hành hoàn toàn miễn phí nếu thông báo trước 07 ngày. Trong trường hợp hủy tour, bạn có thể vào mục \"Tra cứu đơn đặt chỗ\" để hủy trực tiếp trên website.",
    faq_q4: "4. Khi tham gia tour cần chuẩn bị những giấy tờ tùy thân gì?",
    faq_a4: "Quý khách cần mang theo CCCD hoặc Hộ chiếu còn hạn sử dụng. Trẻ em dưới 14 tuổi mang theo bản sao Giấy khai sinh trích lục để làm thủ tục check-in.",

    // Footer
    footer_desc: "Thương hiệu lữ hành 5 sao hàng đầu Việt Nam. Khám phá vẻ đẹp kỳ vĩ của đất nước cùng những chuyến đi nghỉ dưỡng trọn vẹn và an tâm tuyệt đối.",
    footer_quick_links: "Liên Kết Nhanh",
    footer_tours: "Tour Tiêu Biểu",
    footer_contact: "Thông Tin Liên Hệ",
    footer_rights: "Bản quyền thuộc về Delta Travel. Bảo lưu mọi quyền.",

    // AI Concierge Fullscreen
    ai_topic_1_title: "Tour Du Thuyền Hạ Long 5*",
    ai_topic_1_desc: "Trọn gói nghỉ dưỡng, chèo kayak Lan Hạ",
    ai_topic_2_title: "Đà Nẵng - Cầu Vàng - Hội An",
    ai_topic_2_desc: "Vé cáp treo Bà Nà & Phố cổ Hội An",
    ai_topic_3_title: "Tour giá tốt dưới 3 triệu",
    ai_topic_3_desc: "Nghỉ dưỡng cuối tuần tiết kiệm",
    ai_topic_4_title: "Săn mây & Check-in Đà Lạt",
    ai_topic_4_desc: "Xe Limousine phòng nằm, khách sạn view đẹp",
    ai_topic_5_title: "Chính sách hoàn hủy & Bảo hiểm",
    ai_topic_5_desc: "Cam kết 100% đổi ngày & hoàn tiền linh hoạt",
    ai_invite_text: "✨ Hỏi Delta AI về tour, giá vé & ưu đãi!",

    // User Profile Extra
    profile_card_tag: "Hồ Sơ Hội Viên Delta",
    profile_rank_val: "Thành viên",
    profile_upload_avatar: "Tải ảnh đại diện từ thiết bị",
    profile_name_placeholder: "Họ và tên thực tế",
    profile_phone_placeholder: "Số điện thoại thực tế",
    profile_curr_pass: "Mật khẩu hiện tại",
    profile_new_pass: "Mật khẩu mới (tối thiểu 6 ký tự)",
    profile_confirm_pass: "Xác nhận mật khẩu mới",
    profile_btn_update_pass: "Cập Nhật Mật Khẩu",

    // Booking Page (booking.html)
    booking_step_1: "Thông tin hành trình & Ngày khởi hành",
    booking_step_2: "Thông tin người đặt vé",
    booking_step_3: "Phương thức thanh toán trực tuyến",
    booking_itinerary_title: "Lịch trình chi tiết từng ngày",
    booking_itinerary_badge: "Chuẩn 5 sao",
    booking_sched_label: "Ngày khởi hành khả dụng *",
    booking_pickup_label: "Điểm đón khách yêu cầu",
    booking_pickup_placeholder: "Ví dụ: Khách sạn hoặc Sân bay...",
    booking_adults_label: "Người lớn (>11 tuổi)",
    booking_children_label: "Trẻ em (5-11 tuổi)",
    booking_infants_label: "Em bé (<5 tuổi)",
    booking_name_label: "Họ và tên người đại diện *",
    booking_name_placeholder: "Nguyễn Văn A",
    booking_phone_label: "Số điện thoại liên hệ *",
    booking_phone_placeholder: "0901234567",
    booking_email_label: "Địa chỉ Email nhận vé điện tử *",
    booking_email_placeholder: "example@email.com",
    booking_notes_label: "Ghi chú đặc biệt (nếu có)",
    booking_notes_placeholder: "Ăn chay, phòng đơn, ghế đầu...",
    pay_qr_title: "Quét mã VietQR chuyển khoản tự động (Khuyên dùng)",
    pay_qr_desc: "Xác nhận đơn ngay lập tức qua ứng dụng ngân hàng số không mất phí.",
    pay_card_title: "Thẻ ATM Nội Địa / Thẻ Quốc Tế (Visa/Mastercard)",
    pay_card_desc: "Cổng thanh toán bảo mật tiêu chuẩn quốc tế PCI-DSS.",
    pay_cash_title: "Thanh toán tiền mặt tại Văn phòng Delta Travel",
    pay_cash_desc: "Giữ chỗ trước và hoàn tất thanh toán trước ngày khởi hành 48 giờ.",
    inv_title: "HÓA ĐƠN CHIẾT TÍNH",
    inv_adult_price: "Đơn giá người lớn:",
    inv_guest_count: "Số lượng khách:",
    inv_guest_unit: "{n} khách ({a} lớn, {c} trẻ)",
    inv_insurance: "Bảo hiểm du lịch 100%:",
    inv_insurance_val: "MIỄN PHÍ",
    inv_tax: "Thuế VAT & Phí dịch vụ:",
    inv_tax_val: "Đã bao gồm",
    inv_voucher_placeholder: "Mã ưu đãi (VD: DELTA10)",
    inv_voucher_apply: "Áp dụng",
    inv_total_label: "TỔNG TIỀN NIÊM YẾT:",
    inv_btn_confirm: "XÁC NHẬN ĐẶT TOUR",
    inv_guarantee: "Cam kết 100% giữ chỗ chuẩn xác và bảo hiểm trọn gói.",
    receipt_success_tag: "ĐẶT TOUR THÀNH CÔNG",
    receipt_title: "Phiếu Xác Nhận Giữ Chỗ Chính Thức",
    receipt_desc: "Hệ thống Delta Travel đã ghi nhận thông tin đặt tour của bạn. Vui lòng hoàn tất thanh toán để hoàn tất giữ chỗ.",
    receipt_ref_label: "Mã hồ sơ đặt tour:",
    receipt_tour_label: "Hành trình:",
    receipt_customer_label: "Người đặt vé:",
    receipt_total_label: "Tổng tiền cần thanh toán:",
    receipt_qr_title: "Quét mã VietQR chuyển khoản",
    receipt_qr_desc: "Mở ứng dụng ngân hàng và quét mã để thanh toán tự động:",
    receipt_transfer_note: "Cú pháp chuyển khoản:",
    receipt_btn_print: "In phiếu xác nhận",
    receipt_btn_home: "Về Trang Chủ",
    receipt_btn_my_bookings: "Xem Đơn Của Tôi",
    btn_confirm_paid: "Đã chuyển",
    btn_save_invoice: "Lưu hóa đơn chứng từ chuẩn quốc tế",
    btn_zalo_contact: "Liên hệ Zalo: 0325536936"
  },

  en: {
    // Topbar & Header
    topbar_commit: "100% Verified Insurance & Best Price Guarantee",
    topbar_track: "Track Booking",
    topbar_wishlist: "Wishlist",
    topbar_logout: "Log Out",
    btn_login: "Log In",
    btn_register: "Sign Up",
    btn_explore: "Explore Tours",
    brand_sub: "EXPLORE & LUXURY RETREATS",

    // Central Nav Dock Tabs
    nav_home: "Home",
    nav_north: "Northern",
    nav_central: "Central",
    nav_south: "Southern",
    nav_all_tours: "All Tours",
    nav_my_bookings: "My Bookings",
    nav_ai_assistant: "AI Concierge",

    // Hero 3D Section
    hero_badge: "Vietnam's Premier Luxury Travel Brand 2026",
    hero_title_1: "Discover The Beauty",
    hero_title_2: "Of Vietnam With",
    hero_desc: "From the cosmic perspective to the natural wonders of Ha Long Bay, enjoy world-class 5-star resort journeys with unmatched hospitality and premier privileges.",
    hero_btn_explore: "Explore Tours Now",
    hero_btn_search: "Search Trips",
    hero_scroll: "Scroll to explore",
    hero_phase2_badge: "World Natural Heritage",
    hero_phase2_title: "Passing Through The Majestic Clouds",
    hero_phase2_desc: "Embrace the glorious sunrise over breathtaking landscapes aboard world-class 5-star cruises and signature voyages.",
    hero_phase3_badge: "World-Class Retreat Destination",
    hero_slide2_badge: "World-Class Retreat Destination",
    hero_slide2_title: "Welcome To Ha Long Bay",
    hero_slide2_desc: "Over 50,000 travelers have trusted Delta Travel for their most memorable vacation experiences.",
    hero_slide2_btn: "Book Your Journey Today",

    // Hero Search Bar
    search_destination_label: "WHERE WOULD YOU LIKE TO GO?",
    search_destination_placeholder: "Enter tour name, Ha Long, Phu Quoc...",
    search_region_label: "REGION / DESTINATION",
    search_region_all: "All Regions",
    search_region_north: "Northern (Ha Long, Sa Pa...)",
    search_region_central: "Central (Da Nang, Hoi An, Da Lat...)",
    search_region_south: "Southern (Phu Quoc, Mekong...)",
    search_budget_label: "BUDGET RANGE",
    search_budget_all: "All Budgets",
    search_budget_under3m: "Under 3,000,000 VND",
    search_budget_3to5m: "From 3,000,000 - 5,000,000 VND",
    search_budget_above5m: "Above 5,000,000 VND",
    search_btn_submit: "Search Trips",

    // Tours Section & Sidebar Filters
    section_tag: "Curated Journeys",
    section_title: "Most Loved All-Inclusive Travel Tours",
    section_subtitle: "Experience international 5-star hospitality with dedicated tour leaders and finely crafted itineraries.",
    filter_heading: "Filters",
    filter_reset: "Reset",
    filter_region: "Region",
    filter_all: "All",
    filter_north: "North",
    filter_central: "Central",
    filter_south: "South",
    filter_destination: "Destination",
    filter_destination_placeholder: "e.g. Ha Long",
    filter_departure: "Departure Point",
    filter_departure_placeholder: "e.g. Hanoi",
    filter_departure_date: "Departure Date",
    filter_date_placeholder: "Select departure date (DD/MM/YYYY)",
    filter_price_range: "Price Range",
    filter_price_all: "All Price Tiers",
    filter_price_under2m: "Under 2M VND",
    filter_price_2to5m: "2–5M VND",
    filter_price_5to10m: "5–10M VND",
    filter_price_10to20m: "10–20M VND",
    filter_price_above20m: "Above 20M VND",
    filter_duration: "Duration",
    filter_duration_all: "All Durations",
    filter_duration_1d: "1 day",
    filter_duration_2d1n: "2 days 1 night",
    filter_duration_3d2n: "3 days 2 nights",
    filter_duration_4d3n: "4 days 3 nights",
    filter_duration_5d: "5+ days",
    filter_transport: "Transportation",
    filter_transport_all: "All Transports",
    filter_transport_flight: "Flight",
    filter_transport_bus: "Tour Bus / Limousine",
    filter_transport_train: "Train",
    filter_transport_cruise: "Cruise / Yacht",
    filter_availability: "Availability",
    filter_availability_all: "All Statuses",
    filter_availability_available: "Available",
    filter_availability_soldout: "Sold Out",
    filter_btn_apply: "Apply Filters",
    filter_hot_tags: "Trending Tags",
    sort_label: "Sort by:",
    sort_default: "Featured (Default)",
    sort_price_asc: "Price: Low to High",
    sort_price_desc: "Price: High to Low",
    sort_duration: "Duration: Short to Long",
    sort_newest: "Newest Tours",
    sort_departure_soonest: "Soonest Departure",
    tag_cruise: "5* Cruise",
    support_title: "24/7 Travel Advisor",
    support_sub: "Free personalized journey support",
    support_chat: "Chat with travel advisor",
    commit_title: "Delta Travel Commitments",
    commit_1: "100% Official Listed Prices",
    commit_2: "Comprehensive Travel Insurance",
    commit_3: "Premium Hotels & Cruises",
    commit_4: "Flexible Departure Rescheduling",
    showing_tours: "Showing",

    // 16 Tour Titles
    tour_title_DL_HL01: "5-Star Luxury Cruise: Ha Long Bay - Lan Ha Bay",
    tour_title_DL_DN02: "Central Vietnam Paradise: Da Nang - Golden Bridge - Hoi An Ancient Town",
    tour_title_DL_PQ03: "Pearl Island Phu Quoc: Hon Thom Cable Car - Grand World",
    tour_title_DL_DL04: "City of Eternal Flowers: Da Lat - Tuyen Lam Lake - Cloud Hunting",
    tour_title_DL_SP05: "Misty Sa Pa: Fansipan Peak Conquer - Cat Cat Village",
    tour_title_DL_MT06: "Mekong Delta Waterways: Can Tho Floating Market - Tra Su Forest",
    tour_title_DL_NB07: "Majestic Landscapes: Ninh Binh - Trang An - Bai Dinh Pagoda - Mua Cave",
    tour_title_DL_HG08: "Northern Wonder: Ha Giang - Dong Van Karst Plateau - Ma Pi Leng Pass",
    tour_title_DL_CB09: "Majestic Northeast: Cao Bang - Ban Gioc Waterfall - Pac Bo",
    tour_title_DL_MC10: "Moc Chau Plateau: Heart-Shaped Tea Hills - Dai Yem Falls - Glass Bridge",
    tour_title_DL_HU11: "Ancient Imperial Citadel: Hue - Imperial Palace - Perfume River",
    tour_title_DL_NT12: "Azure Pearl Bay: Nha Trang - Coral Bay - Diep Son Island - Mineral Springs",
    tour_title_DL_QN13: "Coastal Paradise: Quy Nhon - Ky Co Beach - Eo Gio - Hon Kho",
    tour_title_DL_PY14: "Land of Yellow Flowers: Phu Yen - Da Dia Reef - Dai Lanh Cape Sunrise",
    tour_title_DL_TN15: "Sacred Southern Peak: Tay Ninh - Ba Den Mountain Cable Car - Holy See",
    tour_title_DL_CD16: "Sacred Haven: Con Dao - Hang Duong Memorial - Dam Trau Beach",

    // Tour Cards
    card_featured: "FEATURED TOUR",
    card_flashsale: "FLASH SALE",
    card_left_seats: "{n} seats left",
    card_sold_out: "Sold Out",
    card_per_guest: "/ guest",
    card_view_itinerary: "Itinerary",
    card_book_now: "Book Now",
    card_pickup: "Pick-up:",
    card_departure: "Departure:",
    card_reviews: "({n} reviews)",

    // AI Concierge
    ai_title: "5-Star AI Concierge Assistant",
    ai_badge: "DELTA CONCIERGE",
    ai_sub: "Personalized trip planning, live weather insights & direct reservation assistance",
    ai_section_topics: "POPULAR INQUIRIES",
    ai_btn_reset: "Reset",
    ai_btn_close: "Exit Fullscreen",
    ai_hotline: "24/7 Hotline:",
    ai_live_sync: "Live fares & seat availability synced in real time",
    ai_input_placeholder: "Ask AI anything: '3-day Ha Long cruise', 'Da Lat trip for 2'...",
    ai_btn_send: "Send",
    ai_welcome_title: "Welcome to Delta Travel! 👋",
    ai_welcome_body: "I am your 5-Star AI Concierge. I can help you explore premium resort packages across Vietnam, provide weather forecasts, detailed daily schedules, and interactive booking cards to reserve seats immediately.",
    ai_suggested_tours_title: "Curated tours available for instant booking:",

    // User Profile Modal
    profile_title: "User Profile",
    profile_bookings_count: "Bookings",
    profile_rank: "Account Tier",
    profile_joined: "Member Since",
    profile_tab_info: "Personal Details",
    profile_tab_password: "Change Password",
    profile_name_label: "Full Name",
    profile_phone_label: "Phone Number",
    profile_email_label: "Email (Account Identity)",
    profile_btn_save: "Save Changes",

    // My Bookings Page
    mb_official_tag: "OFFICIAL ELECTRONIC VOUCHER",
    mb_title: "Manage Bookings & Trip Tracker",
    mb_sub: "Track booking status, complete secure online payment, and print official paper-standard vouchers.",
    mb_btn_print: "Print All Vouchers",
    mb_search_placeholder: "Search by booking code (BK...), phone or tour title...",
    mb_tab_all: "All Bookings",
    mb_tab_pending: "Pending Payment",
    mb_tab_paid: "Paid",
    mb_tab_confirmed: "Confirmed",
    mb_tab_cancelled: "Cancelled",
    mb_empty_title: "No Bookings Found",
    mb_empty_desc: "You have no bookings matching the current filter criteria.",
    mb_empty_btn: "Explore & Book Now",

    // Itinerary Modal
    itinerary_tab_daily: "Daily Itinerary",
    itinerary_tab_inclusions: "Included Services",
    itinerary_tab_terms: "Cancellation Policy",
    itinerary_package_price: "Special Package Price:",
    itinerary_book_now: "Book This Tour Now",
    itinerary_included_title: "Included Services",
    itinerary_excluded_title: "Excluded Services",
    itinerary_terms_title: "Cancellation & Refund Policy",
    terms_1: "Cancellations 15+ days before departure: 100% free cancellation.",
    terms_2: "Cancellations 7 - 14 days before departure: 30% cancellation fee.",
    terms_3: "Cancellations 3 - 6 days before departure: 50% cancellation fee.",
    terms_4: "Cancellations within 48 hours of departure: 100% cancellation fee.",
    terms_5: "Force majeure (natural storms, flight cancellations): Delta Travel guarantees 100% deposit retention or equivalent tour transfer.",
    itinerary_morning: "Morning",
    itinerary_afternoon: "Afternoon",
    itinerary_evening: "Evening",

    // Destinations Section
    dest_tag: "Trending Destinations",
    dest_title: "Explore Wonderful Destinations",
    dest_desc: "From the world heritage of Ha Long Bay to the pristine shores of Phu Quoc, create unforgettable memories with Delta Travel.",

    // Why Choose Us Section
    why_tag: "Core Values",
    why_title: "Why Travelers Choose Delta Travel",
    why_desc: "We deliver exceptional hospitality, meticulously curated journeys, and unforgettable experiences.",
    why_1_title: "Best Transparent Pricing",
    why_1_desc: "100% all-inclusive pricing with zero hidden fees and exclusive member rates.",
    why_2_title: "5-Star Hotels & Cruises",
    why_2_desc: "Exclusive partnerships with premier luxury resorts, boutique hotels, and world-class yachts.",
    why_3_title: "Comprehensive Insurance",
    why_3_desc: "All travelers are fully protected with extensive international coverage up to 120M VND.",
    why_4_title: "24/7 Dedicated Support",
    why_4_desc: "Our travel experts and bilingual tour leaders are always available to assist you.",

    // Testimonials Section
    testi_tag: "Verified Guest Reviews",
    testi_title: "Voices From Our Travelers",
    testi_desc: "Over 50,000 travelers have enjoyed world-class vacations with Delta Travel.",

    // Travel Blog
    blog_tag: "Travel Guidebook",
    blog_title: "Travel Tips & Inspiring Destinations",
    blog_desc: "Essential travel guides, local foodie spots, and photography tips for your perfect vacation.",
    blog_views_1: "1,250 views",
    blog_views_2: "2,140 views",
    blog_views_3: "980 views",
    blog_1_title: "5-Star Ha Long Luxury Cruise Experience: Complete A-Z Guide",
    blog_1_desc: "Key advice on cabin selection, sunset check-in styles, and exciting night squid fishing activities.",
    blog_2_title: "Da Lat Cloud Hunting Guide: Cau Dat Tea Hill Million-Dollar View",
    blog_2_desc: "Golden hours to catch rolling sea of clouds at sunrise and the most scenic valley cafes.",
    blog_3_title: "Savor Floating Noodle Soup at Cai Rang Floating Market",
    blog_3_desc: "Unique trading culture on the Mekong Delta and scenic sampan boat rides through lush cajuput forests.",
    blog_read_more: "Explore Itinerary",

    // FAQ
    faq_tag: "Frequently Asked Questions",
    faq_title: "General Inquiries About Our Tours",
    faq_desc: "Everything you need to know about reservations, child pricing policies, and flexible cancellations.",
    faq_q1: "1. How does online tour booking work at Delta Travel?",
    faq_a1: "Simply choose your desired tour, click \"Book Now\", fill in guest details, and select your preferred payment method (VietQR, ATM/Card, or Cash). Your valid electronic ticket (E-Ticket) and reservation code will be issued instantly.",
    faq_q2: "2. How are child and infant tour fares calculated?",
    faq_a2: "Adults (11+ yrs) pay 100% standard fare. Children (5-10 yrs) enjoy a 25% discount (paying 75% with dedicated seat and meal). Infants (under 5 yrs) are only charged a 10% insurance & ticketing fee, sharing bed with parents.",
    faq_q3: "3. Can I cancel or reschedule my departure date after booking?",
    faq_a3: "Delta Travel offers 100% free departure rescheduling when notified at least 7 days in advance. To cancel, go to \"Track Booking\" to request cancellation online according to our flexible domestic policy.",
    faq_q4: "4. What identification documents are required for the tour?",
    faq_a4: "Guests need a valid National ID or Passport. For children under 14 without an ID card, please bring an official extract of their birth certificate for flight, hotel, and cruise check-in procedures.",

    // Footer
    footer_desc: "Vietnam's premier 5-star travel brand. Explore breathtaking wonders with curated luxury itineraries and complete peace of mind.",
    footer_quick_links: "Quick Links",
    footer_tours: "Featured Tours",
    footer_contact: "Contact Us",
    footer_rights: "All rights reserved by Delta Travel.",

    // AI Concierge Fullscreen
    ai_topic_1_title: "5* Ha Long Bay Cruise",
    ai_topic_1_desc: "All-inclusive retreat, Lan Ha kayaking",
    ai_topic_2_title: "Da Nang - Golden Bridge - Hoi An",
    ai_topic_2_desc: "Ba Na Hills cable car & Ancient town",
    ai_topic_3_title: "Budget Tours Under 3M",
    ai_topic_3_desc: "Weekend getaways with great value",
    ai_topic_4_title: "Da Lat Cloud Hunting",
    ai_topic_4_desc: "Luxury sleeper coach, scenic hotel",
    ai_topic_5_title: "Cancellation & Insurance",
    ai_topic_5_desc: "100% Flexible reschedule & refunds",
    ai_invite_text: "✨ Ask Delta AI for tours, prices & deals!",

    // User Profile Extra
    profile_card_tag: "Delta Member Profile",
    profile_rank_val: "Member",
    profile_upload_avatar: "Upload avatar from device",
    profile_name_placeholder: "Full name",
    profile_phone_placeholder: "Phone number",
    profile_curr_pass: "Current password",
    profile_new_pass: "New password (min 6 characters)",
    profile_confirm_pass: "Confirm new password",
    profile_btn_update_pass: "Update Password",

    // Booking Page (booking.html)
    booking_step_1: "Trip Itinerary & Departure Date",
    booking_step_2: "Contact & Guest Information",
    booking_step_3: "Online Payment Method",
    booking_itinerary_title: "Day-by-Day Detailed Itinerary",
    booking_itinerary_badge: "5-Star Standard",
    booking_sched_label: "Available Departure Date *",
    booking_pickup_label: "Requested Pick-up Point",
    booking_pickup_placeholder: "e.g. Hotel, Airport, Meeting point...",
    booking_adults_label: "Adults (>11 yrs)",
    booking_children_label: "Children (5-11 yrs)",
    booking_infants_label: "Infants (<5 yrs)",
    booking_name_label: "Full Name (Lead Guest) *",
    booking_name_placeholder: "e.g. John Doe",
    booking_phone_label: "Contact Phone Number *",
    booking_phone_placeholder: "+84 901 234 567",
    booking_email_label: "Email for E-Ticket Delivery *",
    booking_email_placeholder: "example@email.com",
    booking_notes_label: "Special Requests (Optional)",
    booking_notes_placeholder: "Vegetarian, single room, front seats...",
    pay_qr_title: "VietQR / Bank Transfer (Recommended)",
    pay_qr_desc: "Instant confirmation via mobile banking app with zero fees.",
    pay_card_title: "Credit / Debit Card (Visa, Mastercard, JCB)",
    pay_card_desc: "Secured by international PCI-DSS payment gateway.",
    pay_cash_title: "Cash Payment at Delta Travel Office",
    pay_cash_desc: "Hold seats now and pay at least 48 hours prior to departure.",
    inv_title: "PRICE BREAKDOWN",
    inv_adult_price: "Adult Unit Price:",
    inv_guest_count: "Number of Guests:",
    inv_guest_unit: "{n} guest(s) ({a} adult, {c} child)",
    inv_insurance: "100% Travel Insurance:",
    inv_insurance_val: "FREE",
    inv_tax: "VAT & Service Fees:",
    inv_tax_val: "Included",
    inv_voucher_placeholder: "Promo Code (e.g. DELTA10)",
    inv_voucher_apply: "Apply",
    inv_total_label: "TOTAL AMOUNT DUE:",
    inv_btn_confirm: "CONFIRM & BOOK TOUR",
    inv_guarantee: "100% Verified reservation & comprehensive insurance included.",
    receipt_success_tag: "BOOKING SUCCESSFUL",
    receipt_title: "Official Reservation Voucher",
    receipt_desc: "Your reservation has been confirmed. Please complete the payment to finalize your booking.",
    receipt_ref_label: "Booking Reference:",
    receipt_tour_label: "Itinerary:",
    receipt_customer_label: "Customer Name:",
    receipt_total_label: "Total Amount Due:",
    receipt_qr_title: "Scan VietQR Code to Pay",
    receipt_qr_desc: "Open your mobile banking app to scan and pay instantly:",
    receipt_transfer_note: "Transfer Reference:",
    receipt_btn_print: "Print Confirmation",
    receipt_btn_home: "Back to Home",
    receipt_btn_my_bookings: "View My Bookings",
    btn_confirm_paid: "Paid",
    btn_save_invoice: "Save Official International Invoice",
    btn_zalo_contact: "Contact Zalo: 0325536936"
  }
};

const TOUR_ITINERARIES_EN = {
  "DL-HL01": [
    {
      day: 1,
      title: "Hanoi – Ha Long Bay – 5-Star Cruise Check-in – Lan Ha Bay",
      morning: "08:00 VIP Limousine pick-up from Hanoi Old Quarter, departing along modern expressway to Tuan Chau Marina.",
      afternoon: "12:00 Board luxury 5-star cruise, enjoy welcome drink and gourmet seafood buffet while cruising amidst karst towers.",
      evening: "18:00 Sunset cocktail party on sundeck. 19:30 Fine dining dinner, night squid fishing, and acoustic lounge music."
    },
    {
      day: 2,
      title: "Lan Ha Bay – Ba Trai Dao Beach – Dark & Bright Cave Kayaking",
      morning: "06:30 Sunrise Tai Chi session on sundeck, followed by light breakfast. Transfer to explore Dark & Bright Cave by kayak.",
      afternoon: "12:30 Savor fresh lunch on board. Swim and relax at pristine Ba Trai Dao white sandy beach.",
      evening: "19:00 Romantic BBQ dinner on deck, stargazing, luxury spa relaxation, and peaceful overnight on emerald bay."
    },
    {
      day: 3,
      title: "Viet Hai Ancient Village – Ha Long Bay – Return to Hanoi",
      morning: "07:00 Breakfast buffet. Cycle through lush rainforest to visit 100-year-old Viet Hai ancient fishing village.",
      afternoon: "10:30 Check out cabins, early buffet lunch as cruise heads back to port. 12:30 Limousine transfer back to Hanoi.",
      evening: "16:00 Arrive safely at Hanoi meeting point. Tour ends with unforgettable memories."
    }
  ],
  "DL-DN02": [
    {
      day: 1,
      title: "Arrival Da Nang – Son Tra Peninsula – Linh Ung Pagoda – My Khe Beach",
      morning: "Pick-up at Da Nang Airport/Station, transfer to hotel for check-in and leisure relaxation.",
      afternoon: "Visit Son Tra Peninsula, admire majestic 67m Lady Buddha at Linh Ung Pagoda, stroll along world-famous My Khe Beach.",
      evening: "Dinner with Da Nang delicacies (Tran pork rice paper rolls, Quang noodles), admire Dragon Bridge fire and water performance."
    },
    {
      day: 2,
      title: "Ba Na Hills – Golden Bridge in the Clouds – Fantasy Park",
      morning: "Ascend via world-record cable car to Ba Na Hills, walk on iconic Golden Bridge held by colossal hands in misty clouds.",
      afternoon: "Explore French Village, Le Jardin D'Amour flower gardens, and enjoy over 100 indoor attractions at Fantasy Park.",
      evening: "Return to Da Nang city center, dinner at riverside restaurant, romantic Han River cruise."
    },
    {
      day: 3,
      title: "Marble Mountains – Non Nuoc Stone Village – Hoi An Ancient Town",
      morning: "Explore mysterious Marble Mountains (Ngu Hanh Son), Huyen Khong Cave, and 300-year-old Non Nuoc stone carving village.",
      afternoon: "Depart for UNESCO World Heritage Hoi An Ancient Town, stroll along lantern-lit streets and visit Japanese Covered Bridge.",
      evening: "Savor Hoi An specialties (Cao Lau, white rose dumplings, chicken rice), release floating flower lanterns on Hoai River."
    },
    {
      day: 4,
      title: "Cam Thanh Coconut Village – Da Nang Souvenirs – Departure",
      morning: "Experience thrilling basket boat rides through Bay Mau coconut forest with local fishermen spinning shows.",
      afternoon: "Shop for Central Vietnam dried seafood and souvenirs at Han Market. Limousine transfer to Da Nang Airport.",
      evening: "Board departure flight back to Hanoi / Ho Chi Minh City. End of marvelous Central Vietnam getaway."
    }
  ],
  "DL-PQ03": [
    {
      day: 1,
      title: "Phu Quoc Arrival – Grand World 'Sleepless City' – Teddy Bear Museum",
      morning: "Flight arrival at Phu Quoc International Airport, transfer to luxury resort, welcome coconut drink.",
      afternoon: "Explore Grand World Phu Quoc: cruise along Venice Canal, visit Bamboo Legend architecture and Teddy Bear Museum.",
      evening: "Enjoy world-class multimedia show 'Essence of Vietnam' & Venice water show with vibrant lights and fireworks."
    },
    {
      day: 2,
      title: "Hon Thom Cable Car – 4 Islands Speedboat Tour – Sunset Sanato",
      morning: "Ride world's longest sea-crossing cable car to Hon Thom Island, enjoy Aquatopia Water Park.",
      afternoon: "Canoe tour around Gam Ghi, May Rut, and Mong Tay islands for coral reef snorkeling and SUP photo shoots.",
      evening: "Sunset cocktails at Sunset Sanato Beach Club, fresh seafood dinner at Night Market."
    },
    {
      day: 3,
      title: "Phu Quoc Pearl Farm – Pepper Farm & Fish Sauce Factory – Departure",
      morning: "Breakfast buffet, visit local pearl culturing facility, traditional black pepper garden, and fish sauce barrel house.",
      afternoon: "Leisure swim at Bai Sao turquoise beach, souvenir shopping, airport transfer for departure flight.",
      evening: "Arrive at home destination. Conclude magical pearl island vacation."
    }
  ],
  "DL-DL04": [
    {
      day: 1,
      title: "Arrival Da Lat – Robin Hill Cable Car – Truc Lam Zen Monastery – Tuyen Lam Lake",
      morning: "Pick-up in Da Lat, breakfast with signature Xiu Mai bread, take scenic cable car over pine forests to Truc Lam Monastery.",
      afternoon: "Check-in boutique hotel, stroll along peaceful Tuyen Lam Lake, visit romantic Clay Tunnel.",
      evening: "Hotpot dinner (wild chicken with basil leaves), explore bustling Da Lat Night Market with grilled rice paper and hot soy milk."
    },
    {
      day: 2,
      title: "Cau Dat Tea Hill Cloud Hunting – Windmills – Puppy Farm – Langbiang Peak",
      morning: "05:00 Sunrise expedition hunting panoramic sea of clouds at Cau Dat Tea Hill and giant wind turbine fields.",
      afternoon: "Visit Puppy Farm with friendly pets and high-tech strawberry garden, take 4x4 Jeep up Langbiang mountain peak.",
      evening: "Join K'Ho ethnic campfire gong exchange show with roasted meat and Can wine under starry mountain sky."
    },
    {
      day: 3,
      title: "Domaine de Marie Church – Dalat Railway Station – Departure",
      morning: "Visit European-style Domaine de Marie Church, French Indochina architecture of Da Lat Railway Station, and hydrangea fields.",
      afternoon: "Shop for artichoke tea, dried fruit jams, and fresh local specialties at Da Lat Market. Transfer to airport or bus station.",
      evening: "Return to home city, concluding refreshing highland holiday."
    }
  ],
  "DL-SP05": [
    {
      day: 1,
      title: "Hanoi – Sa Pa – Cat Cat Village – Mountain Cultural Life",
      morning: "06:30 Sleeper limousine from Hanoi along Noi Bai - Lao Cai highway to foggy Sa Pa town.",
      afternoon: "Check in 4-star mountain view hotel. Walk down to Cat Cat Village, admire Tien Sa waterfall and H'Mong textile crafts.",
      evening: "Salmon hotpot dinner, stroll around Stone Church, try local grilled skewers in the cool mountain breeze."
    },
    {
      day: 2,
      title: "Conquer Fansipan 'Roof of Indochina' – Muong Hoa Funicular",
      morning: "Muong Hoa funicular ride through golden terraced valley, high-speed cable car climbing to 3,143m Fansipan summit.",
      afternoon: "Ring the peak bell at Roof of Indochina, visit giant Amitabha Buddha bronze statue and majestic pagodas in clouds.",
      evening: "Herbal foot bath of Red Dao people, fine dining dinner, leisure evening at romantic European-style cafes."
    },
    {
      day: 3,
      title: "Ham Rong Mountain – Sa Pa Central Market – Return to Hanoi",
      morning: "Hike Ham Rong flower garden, enjoy panoramic view of misty Sa Pa town and Muong Hoa valley from Cloud Yard.",
      afternoon: "Shop for mountain specialties, mushrooms, and brocade fabrics. 14:00 Limousine departs back to Hanoi.",
      evening: "20:00 Arrive safely at Hanoi drop-off point. Tour concludes."
    }
  ],
  "DL-MT06": [
    {
      day: 1,
      title: "HCMC – My Tho – Ben Tre – Can Tho – Ninh Kieu Wharf by Night",
      morning: "07:30 Limousine departs from HCMC, crosses Rach Mieu suspension bridge into the coconut kingdom of Ben Tre.",
      afternoon: "Horse-drawn carriage ride along village pathways, taste pure honey tea, listen to traditional Don Ca Tai Tu folk music. Travel to Can Tho.",
      evening: "Board Can Tho dinner cruise on the Hau River, enjoy Southern specialties with sparkling night lights along Ninh Kieu Wharf."
    },
    {
      day: 2,
      title: "Cai Rang Floating Market – Tra Su Cajuput Forest – Return to HCMC",
      morning: "05:30 Motorboat excursion to Cai Rang Floating Market, savor steaming Hu Tieu noodles and milk coffee on floating boats.",
      afternoon: "Visit Tra Su Cajuput Forest, glide on wooden sampans across bright green duckweed carpets amidst rare water birds. Enjoy grilled snakehead fish.",
      evening: "Depart for HCMC across My Thuan bridge. Arrive in the evening, concluding warm Mekong Delta journey."
    }
  ],
  "DL-NB07": [
    {
      day: 1,
      title: "Hanoi – Bai Dinh Pagoda – Trang An Ecotourism – Mua Cave",
      morning: "07:30 Limousine pick-up from Hanoi, travel to Ninh Binh to visit Southeast Asia's largest Buddhist complex, Bai Dinh Pagoda.",
      afternoon: "Rowboat cruise through Trang An UNESCO World Heritage, passing limestone peaks and mysterious caves. Climb 500 steps up Hang Mua peak.",
      evening: "Crispy rice and mountain goat banquet dinner. Return to Hanoi in the evening, concluding wonderful heritage discovery."
    }
  ],
  "DL-HG08": [
    {
      day: 1,
      title: "Hanoi – Ha Giang – Quan Ba Heaven Gate – Fairy Twin Mountains – Yen Minh",
      morning: "06:30 Depart Hanoi for Ha Giang, passing scenic green tea hills of Tuyen Quang.",
      afternoon: "Ascend Bac Sum Pass, marvel at Quan Ba Heaven Gate and Fairy Twin Mountains. Arrive at pine forests of Yen Minh.",
      evening: "Traditional dinner with ethnic homestay hosts, sip corn wine and rest in peaceful mountain valley."
    },
    {
      day: 2,
      title: "Dong Van Karst Plateau – Vuong Palace – Lung Cu Flag Tower – Ma Pi Leng – Nho Que River",
      morning: "Explore Tham Ma slope, H'Mong King Vuong Palace, and touch national flagpole at Lung Cu northernmost point.",
      afternoon: "Conquer legendary Ma Pi Leng Pass, board boat cruising on turquoise Nho Que River through Tu San Canyon.",
      evening: "Explore Dong Van Old Quarter, taste Men Men and Au Tau porridge, rest in ancient boutique hotel."
    },
    {
      day: 3,
      title: "Dong Van Sunday Market – Return to Hanoi",
      morning: "Immerse in vibrant ethnic market colors with H'Mong, Dao, Tay traders in festive traditional dress.",
      afternoon: "Scenic drive back via Ha Giang city, stop for photos and local dried beef specialties. Return towards Hanoi.",
      evening: "20:00 Arrive at Hanoi drop-off point. Conclude epic Ha Giang road trip."
    }
  ],
  "DL-CB09": [
    {
      day: 1,
      title: "Hanoi – Thai Nguyen – Bac Kan – Ba Be Lake / Cao Bang",
      morning: "06:30 Depart Hanoi via National Highway 3, passing scenic northern countryside.",
      afternoon: "Arrive in Cao Bang, check in hotel, visit historical monuments and local Tay villages.",
      evening: "Dinner featuring grilled mountain pork, 7-flavor roasted duck, and sticky rice."
    },
    {
      day: 2,
      title: "Ban Gioc Waterfall – Nguom Ngao Cave – Truc Lam Zen Monastery",
      morning: "Marvel at majestic Ban Gioc Waterfall, Southeast Asia's largest natural border waterfall, board bamboo raft near cascades.",
      afternoon: "Explore surreal stalactites inside Nguom Ngao Cave, visit Truc Lam Ban Gioc Buddhist Zen Monastery.",
      evening: "Return to Cao Bang city, explore night walking street, try local sour pho (Pho Chua)."
    },
    {
      day: 3,
      title: "Pac Bo Historical Site – Lenin Stream – Karl Marx Peak – Hanoi",
      morning: "Visit Pac Bo cave where President Ho Chi Minh lived, admire emerald Lenin Stream and Karl Marx Peak.",
      afternoon: "Depart back to Hanoi, stopping to purchase Cao Bang vermicelli, chestnuts, and sweet snacks.",
      evening: "19:30 Arrive safely in Hanoi. Tour concludes."
    }
  ],
  "DL-MC10": [
    {
      day: 1,
      title: "Hanoi – Thung Khe Pass – Moc Chau Plateau – Heart-Shaped Tea Hills",
      morning: "07:00 Depart Hanoi via Hoa Binh highway, stop at foggy white-stone Thung Khe Pass for roasted corn.",
      afternoon: "Visit lush Heart-Shaped Tea Hills of Moc Chau, explore colorful plum and peach blossom orchards.",
      evening: "Highland dinner with bamboo-tube rice, grilled stream fish, and campfire music."
    },
    {
      day: 2,
      title: "Bach Long Glass Bridge – Dai Yem Waterfall – Return to Hanoi",
      morning: "Walk across world-record Bach Long Glass Bridge, admire roaring Dai Yem Waterfall.",
      afternoon: "Shop for Moc Chau fresh dairy milk, dried strawberries, and tea. Depart for Hanoi.",
      evening: "18:30 Arrive in Hanoi. Tour ends."
    }
  ],
  "DL-HU11": [
    {
      day: 1,
      title: "Arrival Hue – Imperial Citadel (Dai Noi) – Dong Ba Market",
      morning: "Pick-up at Phu Bai Airport, transfer to riverside hotel, welcome royal herbal tea.",
      afternoon: "Tour UNESCO World Heritage Imperial Citadel, Ngo Mon Gate, Thai Hoa Palace, and Forbidden Purple City.",
      evening: "Board dragon boat on Perfume River, listen to Royal Ca Hue singing, float glowing paper lanterns."
    },
    {
      day: 2,
      title: "Khai Dinh Tomb – Tu Duc Tomb – Thien Mu Pagoda – Thuy Xuan Incense Village",
      morning: "Visit magnificent European-Asian Khai Dinh Mausoleum and poetic Tu Duc imperial tomb.",
      afternoon: "Explore 400-year-old Thien Mu Pagoda, take Instagram photos at rainbow-colored Thuy Xuan Incense Village.",
      evening: "Royal banquet dinner, taste Banh Beo, Nam, Loc, and Hue beef noodles."
    },
    {
      day: 3,
      title: "Lang Co Bay – Lap An Lagoon – Departure",
      morning: "Breakfast buffet, scenic excursion to serene Lap An Lagoon and stunning Lang Co Bay.",
      afternoon: "Shop for Hue royal tea, sesame candy (Me Xung), and fermented shrimp paste. Airport transfer.",
      evening: "Conclude majestic Hue imperial journey."
    }
  ],
  "DL-NT12": [
    {
      day: 1,
      title: "Arrival Nha Trang – VinWonders Harbor – Night City Tour",
      morning: "Arrival at Cam Ranh Airport, transfer along scenic coastal highway to beachfront resort.",
      afternoon: "Take sea-crossing cable car to VinWonders Nha Trang, enjoy water world and European castle square.",
      evening: "Enjoy Tata Show 3D mapping performance, seafood dinner at Tram Huong tower square."
    },
    {
      day: 2,
      title: "Coral Bay 3-Island Speedboat Tour – Diving & Floating Bar",
      morning: "Speedboat to Coral Bay (Vinh San Ho), snorkel among colorful coral reefs and marine life.",
      afternoon: "Visit fishing village raft, fresh seafood lunch, swim at Bai Tranh white sand beach.",
      evening: "Relax with hot mineral mud bath at I-Resort, dinner with grilled Nem Nuong Ninh Hoa."
    },
    {
      day: 3,
      title: "Diep Son Underwater Sandbar – Doc Let Beach",
      morning: "Excursion to Diep Son Island, walk across the unique underwater sandbar pathway in the ocean.",
      afternoon: "Swim at paradise-like Doc Let beach with powdery white sand and shallow calm waters.",
      evening: "Cocktails at high-altitude rooftop lounge overlooking Nha Trang bay by night."
    },
    {
      day: 4,
      title: "Ponagar Cham Towers – Long Son Pagoda – Departure",
      morning: "Visit historic Ponagar Cham Towers and sacred white Buddha at Long Son Pagoda.",
      afternoon: "Shop for Nha Trang bird's nests, dried squid, and mango rice paper. Airport transfer.",
      evening: "Departure flight home. Conclude sun-soaked beach vacation."
    }
  ],
  "DL-QN13": [
    {
      day: 1,
      title: "Arrival Quy Nhon – Ghenh Rang Tien Sa – Han Mac Tu Memorial",
      morning: "Flight arrival at Phu Cat Airport, check in seaside hotel.",
      afternoon: "Visit Ghenh Rang Tien Sa, Queen's Egg Stone Beach, and Han Mac Tu poet memorial site.",
      evening: "Dinner with jellyfish noodles, shrimp pancakes (Banh Xeo Tom Nhay), stroll along windy Xuan Dieu beach."
    },
    {
      day: 2,
      title: "Ky Co Beach 'Maldives of Vietnam' – Eo Gio – Hon Kho",
      morning: "Canoe to Ky Co beach with crystal-clear turquoise waters, enjoy water sports and coral viewing.",
      afternoon: "Walk along scenic cliffside coastal path at Eo Gio (Windy Strait), visit Ngoc Hoa Monastery with twin Buddha statues.",
      evening: "Seafood BBQ dinner, enjoy sunset at Nhon Ly fishing village cafes."
    },
    {
      day: 3,
      title: "Twin Cham Towers – Phuong Mai Sand Dunes – Departure",
      morning: "Explore 800-year-old Twin Cham Towers (Thap Doi) and sand-boarding at giant Phuong Mai sand dunes.",
      afternoon: "Shop for Binh Dinh specialties (Nem Cho Huyen, Bau Da wine). Transfer to airport for flight.",
      evening: "Safely return home. Tour concludes."
    }
  ],
  "DL-PY14": [
    {
      day: 1,
      title: "Arrival Tuy Hoa – Bai Xep 'Yellow Flowers Green Grass' – Mang Lang Church",
      morning: "Arrive at Tuy Hoa Airport, check in hotel along coastal Hung Vuong boulevard.",
      afternoon: "Visit picturesque Bai Xep beach where 'I See Yellow Flowers Upon the Green Grass' was filmed, visit gothic Mang Lang Church.",
      evening: "Dinner with ocean tuna eyes braised in Chinese herbs, stroll around Nghinh Phong Tower."
    },
    {
      day: 2,
      title: "Ganh Da Dia Prismatic Columns – O Loan Lagoon – Dai Lanh Cape",
      morning: "Marvel at Ganh Da Dia, world-class volcanic basalt columns naturally stacked like giant beehives.",
      afternoon: "Enjoy fresh blood cockle lunch at O Loan Lagoon, visit Mui Dien (Dai Lanh Cape) where mainland Vietnam sees sunrise first.",
      evening: "Sunset cocktails at Vung Ro Bay, night squid fishing and seafood feast."
    },
    {
      day: 3,
      title: "Nhan Tower – Tuy Hoa Market – Departure",
      morning: "Climb Nhan Mountain to admire ancient Champa Nhan Tower and panoramic Tuy Hoa city views.",
      afternoon: "Shop for dried sun-dried beef (Bo Mot Nang) with yellow ant salt. Airport transfer.",
      evening: "Return to home city. End of charming Phu Yen tour."
    }
  ],
  "DL-TN15": [
    {
      day: 1,
      title: "HCMC – Tay Ninh Holy See – Sun World Ba Den Mountain Peak",
      morning: "07:00 Depart HCMC, attend noon ceremonial service at magnificent Tay Ninh Cao Dai Holy See.",
      afternoon: "Modern cable car ascension to Ba Den Mountain summit, admire Asia's tallest bronze Lady Buddha statue.",
      evening: "Enjoy sunset buffet at the peak, walk through flower gardens in clouds. Return to HCMC in the evening."
    }
  ],
  "DL-CD16": [
    {
      day: 1,
      title: "Arrival Con Dao – Con Dao Prison Museum – Hang Duong Cemetery Tribute",
      morning: "Flight arrival at Con Dao Co Ong Airport, transfer through scenic coastal cliffs to resort.",
      afternoon: "Visit historical Con Dao Prison relics, French Tiger Cages, American Tiger Cages, and Pier 914.",
      evening: "23:00 Sacred candlelight tribute and incense offering at Hang Duong Cemetery and Vo Thi Sau memorial shrine."
    },
    {
      day: 2,
      title: "Dam Trau Beach – Bay Canh Island Coral Snorkeling – Turtle Sanctuary",
      morning: "Relax at pristine Dam Trau Beach, watch airplanes land close overhead while sipping fresh young coconuts.",
      afternoon: "Speedboat to Bay Canh Island, explore mangrove ecosystem, snorkel coral reefs, visit sea turtle nursery.",
      evening: "Fresh seafood dinner (red grouper, moon crab), peaceful nighttime walk along the historic seaside promenade."
    },
    {
      day: 3,
      title: "Con Dao Market – Van Son Pagoda – Departure",
      morning: "Panoramic view from Van Son Pagoda atop Mot Mountain, visit An Son shrine of Lady Phi Yen.",
      afternoon: "Shop for Con Dao almond seed sweets (Mut Hat Bang) and sun-dried fish. Transfer to airport.",
      evening: "Departure flight back to HCMC / Hanoi. Conclude profoundly moving and spiritual Con Dao journey."
    }
  ]
};

function getTourItineraryDays(tour, lang) {
  if (!tour) return [];
  const language = lang || (typeof getAppLanguage === "function" ? getAppLanguage() : "vi");
  const tourId = String(tour.id || "").trim().toUpperCase();

  if (language === "en" && TOUR_ITINERARIES_EN && TOUR_ITINERARIES_EN[tourId]) {
    return TOUR_ITINERARIES_EN[tourId];
  }

  if (Array.isArray(tour.itinerary) && tour.itinerary.length > 0) {
    return tour.itinerary;
  }
  if (typeof DEFAULT_TOURS !== "undefined" && Array.isArray(DEFAULT_TOURS)) {
    const def = DEFAULT_TOURS.find(d => String(d.id).trim().toUpperCase() === tourId);
    if (def && Array.isArray(def.itinerary) && def.itinerary.length > 0) {
      return def.itinerary;
    }
  }

  return [];
}

let currentAppLang = localStorage.getItem("delta_lang") || "vi";

function t(key, params = {}) {
  const dict = DELTA_TRANSLATIONS[currentAppLang] || DELTA_TRANSLATIONS.vi;
  let text = dict[key] || DELTA_TRANSLATIONS.vi[key] || key;
  Object.keys(params).forEach(p => {
    text = text.replace(`{${p}}`, params[p]);
  });
  return text;
}

function getAppLanguage() {
  return currentAppLang;
}

function setAppLanguage(lang) {
  if (lang !== "vi" && lang !== "en") return;
  currentAppLang = lang;
  localStorage.setItem("delta_lang", lang);

  // 1. Cập nhật trạng thái nút chuyển đổi công tắc trên toàn trang
  document.querySelectorAll(".lang-switch-capsule").forEach(capsule => {
    capsule.querySelectorAll(".lang-switch-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  });

  // 2. Dịch các phần tử có data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (key) {
      el.textContent = t(key);
    }
  });

  // 3. Dịch placeholder
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (key) {
      el.placeholder = t(key);
    }
  });

  // 4. Dịch title / tooltip
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.dataset.i18nTitle;
    if (key) {
      el.title = t(key);
    }
  });

  // 5. Cập nhật thẻ HTML lang
  document.documentElement.lang = lang;

  // 6. Phát sự kiện toàn cục để các component (Custom Select, Chatbot, Tour list) cập nhật
  window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang } }));

  // 7. Đồng bộ lại tour cards nếu đang ở trang chủ
  if (typeof renderTourCards === "function") {
    try {
      renderTourCards();
    } catch (e) {
      console.warn("Lỗi khi re-render tour cards:", e);
    }
  }
}

function toggleLanguage() {
  const next = currentAppLang === "vi" ? "en" : "vi";
  setAppLanguage(next);
}

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("delta_lang") || "vi";
  setAppLanguage(savedLang);
});

window.t = t;
window.getAppLanguage = getAppLanguage;
window.setAppLanguage = setAppLanguage;
window.toggleLanguage = toggleLanguage;
window.DELTA_TRANSLATIONS = DELTA_TRANSLATIONS;
window.TOUR_ITINERARIES_EN = TOUR_ITINERARIES_EN;
window.getTourItineraryDays = getTourItineraryDays;
