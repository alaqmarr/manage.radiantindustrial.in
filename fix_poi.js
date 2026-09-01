const fs = require('fs');
let c = fs.readFileSync('src/app/actions/purchaseOrder.ts', 'utf8');

c = c.replace('id: generateSlug(`POI--`),', 'id: generateSlug(`POI-${id}-${index}`),');

fs.writeFileSync('src/app/actions/purchaseOrder.ts', c);
