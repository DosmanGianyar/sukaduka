const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s2 = wb.Sheets['Pendapatan'];
const rows2 = xlsx.utils.sheet_to_json(s2, { header: 1 });

let totalPendapatan = 0;
for (let r = 2; r < rows2.length; r++) {
  const row = rows2[r];
  if (!row) continue;
  for (let c = 3; c <= 43; c++) {
    const val = row[c];
    if (val && !isNaN(Number(val))) {
      totalPendapatan += Number(val);
    }
  }
}
console.log('Total calculated Pendapatan:', totalPendapatan);

