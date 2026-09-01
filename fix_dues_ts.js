const fs = require('fs');
let c = fs.readFileSync('src/app/(dashboard)/quotation-dues/page.tsx', 'utf8');

c = c.replace('quote.client.companyName', 'quote.client.name');

fs.writeFileSync('src/app/(dashboard)/quotation-dues/page.tsx', c);
