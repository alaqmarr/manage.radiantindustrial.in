import re

with open('src/components/RfqActions.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix the broken subject line
code = re.sub(
    r'subject: Purchase Order -  from ,',
    'subject: Purchase Order -  from ,',
    code
)

with open('src/components/RfqActions.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
