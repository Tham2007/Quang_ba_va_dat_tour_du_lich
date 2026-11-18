with open('Frontend/assets/js/models/data.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for j in range(1380, 1460):
    print(f'{j+1}: {lines[j].rstrip()}')
