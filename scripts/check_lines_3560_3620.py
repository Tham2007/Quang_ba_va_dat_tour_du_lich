with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for j in range(3560, 3620):
    print(f'{j+1}: {lines[j].rstrip()}')
