import re

with open('src/components/RfqActions.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix prNo and rfqNo
code = re.sub(r'\{rfq\.prNo && <p.*?PR No:.*?\{rfq\.prNo\}</p>\}', '', code)
code = re.sub(r'\{rfq\.rfqNo && <p.*?RFQ No:.*?\{rfq\.rfqNo\}</p>\}', '', code)

# Fix rfqMessage
code = code.replace('settings?.rfqMessage', 'settings?.quotationMessage')
code = code.replace('settings.rfqMessage', 'settings.quotationMessage')

with open('src/components/RfqActions.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
