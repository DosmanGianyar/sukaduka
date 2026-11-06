const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s2 = wb.Sheets['Pendapatan'];
const rows2 = xlsx.utils.sheet_to_json(s2, { header: 1 });

for (let r = 100; r <= 136; r++) {
  if (rows2[r]) {
    console.log(`Row ${r}: No=${rows2[r][0]}, Nama=${rows2[r][1]}, NIP=${rows2[r][2]}`);
  }
}

