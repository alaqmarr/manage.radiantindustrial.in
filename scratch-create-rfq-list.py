with open('src/app/(dashboard)/rfq/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix link paths
code = code.replace('/rfqs', '/rfq')
code = code.replace('Rfqs', 'Purchase Orders / RFQs')
code = code.replace('rfqs', 'purchase orders')
code = code.replace('prNo', 'id')  # Quick hack to fix non-existent fields

# Fix table columns
code = code.replace('<th className=\"px-6 py-5 font-medium tracking-wider\">PR No</th>', '')
code = code.replace('<th className=\"px-6 py-5 font-medium tracking-wider\">Est. Profit</th>', '')
code = code.replace('<td className=\"px-6 py-4 text-zinc-300\">{quote.id || \'-\'}</td>', '')

# Remove profit calculation cell
import re
code = re.sub(
    r'<td className=\"px-6 py-4 font-medium text-emerald-500\">.*?</td>',
    '',
    code,
    flags=re.DOTALL
)

code = code.replace('colSpan={8}', 'colSpan={6}')

with open('src/app/(dashboard)/rfq/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
