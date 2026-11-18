with open('API/api/sqlserver_writes.py', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'@router\.(get|post|put|patch|delete)\([\'"]([^\'"]+)', text)
print('Routes in sqlserver_writes.py:')
for m in matches:
    print(' ', m)

with open('API/api/tham_sqlserver_app.py', 'r', encoding='utf-8') as f:
    text2 = f.read()

matches2 = re.findall(r'@app\.(get|post|put|patch|delete)\([\'"]([^\'"]+)', text2)
print('\nRoutes in tham_sqlserver_app.py:')
for m in matches2:
    print(' ', m)
