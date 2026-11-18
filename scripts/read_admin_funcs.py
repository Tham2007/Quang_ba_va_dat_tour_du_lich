with open('API/api/controllers/admin_controller.py', 'r', encoding='utf-8') as f:
    text = f.read()

funcs = ['admin_tour_create', 'admin_tour_patch', 'replace_admin_tour_details', 'admin_tour_delete', 'add_schedule', 'patch_schedule']

for fn in funcs:
    idx = text.find(f'def {fn}')
    if idx != -1:
        print(f'=== {fn} ===')
        print(text[idx:idx+1500])
        print('='*70)
