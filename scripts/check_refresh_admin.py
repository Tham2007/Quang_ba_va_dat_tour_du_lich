with open('Frontend/assets/js/controllers/admin.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function refreshAdminData')
if idx != -1:
    print(text[idx:idx+1500])
