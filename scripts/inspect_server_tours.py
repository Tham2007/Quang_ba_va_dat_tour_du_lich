with open('server.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'app\.(post|patch|put|delete)\([\'"]/api/v1/admin/tours', text)]
for idx in matches:
    print(text[idx:idx+1200])
    print('='*70)
