with open('server.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('async function proxySqlServerCatalog')
if idx != -1:
    print(text[idx:idx+1500])
