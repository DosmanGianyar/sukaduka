const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s1 = wb.Sheets['Data Lama'];
const rows1 = xlsx.utils.sheet_to_json(s1, { header: 1 });
console.log('Data Lama row count:', rows1.length);
console.log('Data Lama row 2:', rows1[2].slice(0, 5));
console.log('Data Lama row 3:', rows1[3].slice(0, 5));
console.log('Data Lama row 4:', rows1[4].slice(0, 5));

