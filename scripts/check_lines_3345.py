with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('Total lines in server.js:', len(lines))

# Print lines 3345 to 3375
print('=== 3345 - 3375 ===')
for j in range(3345, 3375):
    print(f'{j+1}: {lines[j].rstrip()}')
