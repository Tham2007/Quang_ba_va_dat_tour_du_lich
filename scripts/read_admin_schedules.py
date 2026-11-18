with open('Frontend/assets/js/controllers/admin.js', 'r', encoding='utf-8') as f:
    text = f.read()

funcs = ['handleSaveScheduleSubmit', 'handleDeleteSchedule', 'handleToggleScheduleStatus']
for fn in funcs:
    idx = text.find(f'function {fn}')
    if idx == -1:
        idx = text.find(fn)
    if idx != -1:
        print(f'=== {fn} ===')
        print(text[idx:idx+1500])
        print('='*70)
