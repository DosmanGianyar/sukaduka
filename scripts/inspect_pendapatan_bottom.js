const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s2 = wb.Sheets['Pendapatan'];
const rows2 = xlsx.utils.sheet_to_json(s2, { header: 1 });

for (let r = 130; r < 150; r++) {
  if (rows2[r]) {
    console.log(`Row ${r}:`, rows2[r].slice(0, 5));
  }
}

