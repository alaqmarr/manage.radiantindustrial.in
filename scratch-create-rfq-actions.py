import os
import re

with open('src/components/QuotationActions.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replaces for RfqActions
code = code.replace('QuotationActions', 'RfqActions')
code = code.replace('quotation', 'rfq')
code = code.replace('Quotation', 'Purchase Order')
code = code.replace('deleteQuotation', 'deleteRfq')
code = code.replace('@/app/actions/quotation', '@/app/actions/rfq')
code = code.replace('/quotations', '/rfq')
code = code.replace('Quote To', 'Vendor')
code = code.replace('rfq.client.name', 'rfq.supplier.name')
code = code.replace('rfq.client.email', 'rfq.supplier.email')
code = code.replace('spSnapshot', 'cpSnapshot')
code = code.replace('Quote No:', 'PO No:')

# Vendor address details
address_block = '''<td valign="top" width="50%" style={{ paddingLeft: "16px", borderLeft: "1px solid #f3f4f6" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "10px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.5px" }}>Ship To</h3>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#111827" }}>{settings?.companyName}</p>
                  {settings?.shippingAddress && <p style={{ margin: "0 0 2px 0", color: "#4b5563", whiteSpace: "pre-wrap" }}>{settings.shippingAddress}</p>}
                </td>'''

code = re.sub(
    r'<td valign=\"top\" width=\"50%\" style=\{\{ paddingLeft: \"16px\", borderLeft: \"1px solid #f3f4f6\" \}\}>.*?</td>',
    address_block,
    code,
    flags=re.DOTALL
)

with open('src/components/RfqActions.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
