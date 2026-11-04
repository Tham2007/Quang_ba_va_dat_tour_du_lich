import sqlite3

conn = sqlite3.connect("API/delta_dev.db")
cur = conn.cursor()
cur.execute("UPDATE tours SET description = 'Tour du lịch chất lượng cao, trọn gói dịch vụ tiêu chuẩn Delta Travel.' WHERE description LIKE '%minh họa%' OR description LIKE '%demo%'")
conn.commit()
print("Updated rows:", cur.rowcount)
conn.close()

