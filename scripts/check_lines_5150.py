with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for j in range(5150, min(len(lines), 5180)):
    print(f'{j+1}: {lines[j].rstrip()}')
