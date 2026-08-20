import re

with open('src/app/(dashboard)/rfq/[id]/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the sticky bottom bar for totals because it contains a lot of profit calculation logic.
code = re.sub(
    r'<div className=\"h-32 print:hidden\"></div>\s*<div className=\"fixed bottom-0.*?</>.*?\);\s*\}\)\(\)\}\s*</div>',
    '',
    code,
    flags=re.DOTALL
)

# And remove profit calculation from print totals
code = re.sub(
    r'<div className=\"flex justify-between text-amber-500/80 font-medium pt-3 border-t border-premium-border/50\">\s*<span>Total P. Cost</span>.*?return null;\s*\}\)\(\)\}',
    '',
    code,
    flags=re.DOTALL
)

# Remove profit/cost columns from the table headers and rows
code = re.sub(
    r'<th className="py-3 px-4 font-medium text-right w-32 text-amber-500/80">P. Cost</th>.*?<th className="py-3 px-4 font-medium text-right w-32 text-emerald-500/80">Profit</th>',
    '',
    code,
    flags=re.DOTALL
)

code = re.sub(
    r'<td className="py-4 px-4 text-right text-amber-500/80">\s*\{formatRupee\(Math\.round\(\(item\.cpSnapshot \|\| 0\) \* item\.quantity\)\)\}\s*</td>.*?<td className="py-4 px-4 text-right text-emerald-500 font-medium">\s*\{formatRupee\(Math\.round\(\(item\.spSnapshot - \(item\.cpSnapshot \|\| 0\)\) \* item\.quantity\)\)\}\s*</td>',
    '',
    code,
    flags=re.DOTALL
)

with open('src/app/(dashboard)/rfq/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
