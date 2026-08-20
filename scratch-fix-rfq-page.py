import re

with open('src/app/(dashboard)/rfq/[id]/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix prNo and rfqNo
code = re.sub(r'\{rfq\.prNo && <p><strong>PR No:</strong> \{rfq\.prNo\}</p>\}', '', code)
code = re.sub(r'\{rfq\.rfqNo && <p><strong>RFQ No:</strong> \{rfq\.rfqNo\}</p>\}', '', code)

# Fix rfqMessage
code = code.replace('settings?.rfqMessage', 'settings?.quotationMessage')
code = code.replace('settings.rfqMessage', 'settings.quotationMessage')

# Fix spSnapshot
code = code.replace('spSnapshot', 'cpSnapshot')

with open('src/app/(dashboard)/rfq/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
