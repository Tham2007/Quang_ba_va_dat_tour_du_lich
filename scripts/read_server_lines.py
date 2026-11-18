with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in [4420, 4520, 4610]:
    print(f'=== Around line {i} ===')
    for j in range(max(0, i-5), min(len(lines), i+35)):
        print(f'{j+1}: {lines[j].rstrip()}')
    print('='*70)
