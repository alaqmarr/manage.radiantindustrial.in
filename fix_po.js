const fs = require('fs');
let c = fs.readFileSync('src/app/actions/purchaseOrder.ts', 'utf8');

const replacement = `    const lastPo = await prisma.purchaseOrder.findFirst({
      orderBy: { poNumber: 'desc' },
      select: { poNumber: true }
    });
    let nextNum = 1;
    if (lastPo && lastPo.poNumber) {
      const match = lastPo.poNumber.match(/PO-(\\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const id = generateSlug(\`PO-\${Date.now()}-\${nextNum}\`);
    const poNumber = \`PO-\${String(nextNum).padStart(6, '0')}\`;`;

c = c.replace(/const count = await prisma\.purchaseOrder\.count\(\)[\s\S]*?const poNumber = [^\n]*\n/, replacement + '\n');
fs.writeFileSync('src/app/actions/purchaseOrder.ts', c);
