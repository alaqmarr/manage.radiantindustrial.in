const fs = require('fs');
let lines = fs.readFileSync('src/components/RfqActions.tsx', 'utf8').split('\n');
lines[78] = '        subject: \Purchase Order - \ from \\,';
fs.writeFileSync('src/components/RfqActions.tsx', lines.join('\n'));
