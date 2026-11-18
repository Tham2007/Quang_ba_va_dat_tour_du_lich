with open('Frontend/assets/js/controllers/admin.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'function handleSaveScheduleSubmit' in l:
        for j in range(i, min(len(lines), i+60)):
            print(f'{j+1}: {lines[j].rstrip()}')
        break
