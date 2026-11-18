import docx

doc = docx.Document('BAO_CAO_DU_AN_TOUR_DU_LICH_cap_nhat.docx')

print("=" * 70)
print("  1. KIỂM TRA TRANG BÌA (COVER PAGE)")
print("=" * 70)
cover_texts = [p.text.strip() for p in doc.paragraphs[:15] if p.text.strip()]
for t in cover_texts:
    print(" -", t)

print("\nBảng Table 0 (Bảng thông tin GVHD & Môn học trên bìa):")
t0 = doc.tables[0]
for r in t0.rows:
    print("  " + " | ".join([c.text.strip() for c in r.cells]))

print("\n" + "=" * 70)
print("  2. KIỂM TRA TẤT CẢ CÁC VỊ TRÍ NGẮT TRANG (PAGE BREAKS)")
print("=" * 70)
pb_locations = []
for idx, p in enumerate(doc.paragraphs):
    for r in p.runs:
        if 'w:br' in r._r.xml and 'w:type="page"' in r._r.xml:
            pb_locations.append((idx, p.text.strip()[:60]))

print(f"Tổng số vị trí ngắt trang trong toàn bộ tài liệu: {len(pb_locations)}")
for i, (p_idx, txt) in enumerate(pb_locations):
    print(f"  [Ngắt trang {i+1}] Đoạn #{p_idx}: context = {repr(txt)}")

print("\n" + "=" * 70)
print("  3. KIỂM TRA CẤU TRÚC ĐẦU MỤC (HEADINGS)")
print("=" * 70)
headings = [p.text for p in doc.paragraphs if p.style.name.startswith('Heading')]
print(f"Tổng số Tiêu đề (Headings): {len(headings)}")
for h in headings:
    print("  *", h)

print("\n" + "=" * 70)
print("  4. KIỂM TRA THỐNG KÊ TỔNG THỂ")
print("=" * 70)
num_paras = len(doc.paragraphs)
num_tables = len(doc.tables)
num_images = len([r.target_ref for r in doc.part.rels.values() if "image" in r.target_ref])
words = sum(len(p.text.split()) for p in doc.paragraphs) + sum(len(c.text.split()) for t in doc.tables for r in t.rows for c in r.cells)
est_pages = (words / 300.0) + (num_images * 0.55) + (num_tables * 0.45)

print(f"  • Số từ:       {words:,} từ")
print(f"  • Số đoạn văn: {num_paras}")
print(f"  • Số bảng:     {num_tables}")
print(f"  • Số hình ảnh: {num_images}")
print(f"  • Ước tính số trang: {est_pages:.1f} trang")
