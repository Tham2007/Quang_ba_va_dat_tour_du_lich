with open('Frontend/assets/js/controllers/admin.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for j in range(2100, 2195):
    print(f'{j+1}: {lines[j].rstrip()}')
