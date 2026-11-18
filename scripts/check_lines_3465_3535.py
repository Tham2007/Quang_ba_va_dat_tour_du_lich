with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for j in range(3465, 3535):
    print(f'{j+1}: {lines[j].rstrip()}')
