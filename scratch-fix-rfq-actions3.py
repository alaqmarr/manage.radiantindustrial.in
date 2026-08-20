import re

with open('src/components/RfqActions.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'subject: \Purchase Order - \ from \,',
    'subject: Purchase Order -  from ,',
)

with open('src/components/RfqActions.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
