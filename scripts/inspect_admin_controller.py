with open('API/api/controllers/admin_controller.py', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'@router\.(get|post|put|patch|delete)\([\'"]([^\'"]+)', text)
print('Routes in admin_controller.py:')
for m in matches:
    print(' ', m)
