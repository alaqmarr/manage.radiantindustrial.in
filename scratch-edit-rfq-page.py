import re

with open('src/app/(dashboard)/rfq/[id]/edit/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('supplier: true', '')
code = code.replace('sellingPrice: true,', 'sellingPrice: true, costPrice: true,')
code = code.replace('/rfqs', '/rfq')

with open('src/app/(dashboard)/rfq/[id]/edit/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
