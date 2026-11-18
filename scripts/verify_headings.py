import docx

doc = docx.Document(r"C:\Users\ACER\Downloads\BAO_CAO_DU_AN_TOUR_DU_LICH_MOI_hoan_chinh.docx")
print("=== ALL HEADINGS IN GENERATED DOCUMENT ===")
for p in doc.paragraphs:
    txt = p.text.strip()
    if txt.startswith("CHƯƠNG") or txt.startswith("1.") or txt.startswith("2.") or txt.startswith("3.") or txt.startswith("4.") or txt.startswith("5.") or txt.startswith("Bảng 2.5") or txt.startswith("Bảng 2.6") or txt.startswith("DANH MỤC") or txt.startswith("BẢNG PHÂN CÔNG"):
        print("  -", txt[:120])
