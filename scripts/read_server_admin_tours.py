with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if '/api/v1/admin/tours' in l:
        print(f'Line {i+1}: {l.rstrip()}')
        for j in range(i, min(len(lines), i+30)):
            print(f'  {j+1}: {lines[j].rstrip()}')
        print('='*70)
