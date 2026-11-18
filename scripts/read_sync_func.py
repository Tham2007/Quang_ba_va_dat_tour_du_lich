with open('server.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function syncSqlServerCatalogToLocalDb')
if idx == -1:
    idx = text.find('syncSqlServerCatalogToLocalDb')
print(text[idx:idx+2500])
