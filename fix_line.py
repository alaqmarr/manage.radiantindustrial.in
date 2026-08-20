
with open('src/components/RfqActions.tsx', 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

lines[78] = '        subject: \Purchase Order - \ from \\,'

with open('src/components/RfqActions.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

