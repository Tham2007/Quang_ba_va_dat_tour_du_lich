with open('server.js', 'r', encoding='utf-8') as f:
    text = f.read()

funcs = ['function publicTour', 'function adminTourDetails', 'function publicSchedule']
for fn in funcs:
    idx = text.find(fn)
    if idx != -1:
        print(f'=== {fn} ===')
        print(text[idx:idx+1200])
        print('='*70)
