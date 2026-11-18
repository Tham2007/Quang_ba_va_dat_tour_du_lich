with open('Frontend/assets/js/controllers/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [l.strip() for l in text.split('\n') if 'getToursData' in l or 'DeltaAPI' in l or 'fetch(' in l or '/api/v1/tours' in l]
print('Matches in main.js:', len(matches))
for m in matches[:25]:
    print('  ', m[:120])
