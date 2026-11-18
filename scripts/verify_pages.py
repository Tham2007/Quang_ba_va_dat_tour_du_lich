import docx

doc = docx.Document(r"C:\Users\ACER\Downloads\BAO_CAO_DU_AN_TOUR_DU_LICH_MOI_hoan_chinh.docx")
words = 0
for p in doc.paragraphs:
    words += len(p.text.split())
for t in doc.tables:
    for row in t.rows:
        for c in row.cells:
            words += len(c.text.split())

num_imgs = len([r.target_ref for r in doc.part.rels.values() if "image" in r.target_ref])
num_tables = len(doc.tables)

# Estimation based on standard Word page metrics
# 1 page of standard text = 320 words
# 1 image (6.0 in) + caption + margins = 0.55 page
# 1 table (average 6 rows) = 0.45 page
est_pages = (words / 320.0) + (num_imgs * 0.55) + (num_tables * 0.45)

print("=" * 50)
print(f"Total Words: {words}")
print(f"Total Tables: {num_tables}")
print(f"Total Images: {num_imgs}")
print(f"Estimated Pages in Word: {est_pages:.1f} pages")
print("=" * 50)
