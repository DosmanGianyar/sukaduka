const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s4 = wb.Sheets['Pengeluaran'];
const rows4 = xlsx.utils.sheet_to_json(s4, { header: 1 });

for (let i = 0; i <= 25; i++) {
  console.log(`Row ${i}:`, rows4[i]);
}

