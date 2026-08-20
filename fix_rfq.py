import re

with open('src/components/RfqForm.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix the duplicate Supplier Name and <!-- MATCHED -->
pattern = r'              <!-- MATCHED --></label>.*?</div>\s*<div>\s*<label className="block text-sm font-medium text-zinc-400 mb-1">GST Number</label>'
code = re.sub(pattern, '              <div>\n                <label className="block text-sm font-medium text-zinc-400 mb-1">GST Number</label>', code, flags=re.DOTALL)

with open('src/components/RfqForm.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

