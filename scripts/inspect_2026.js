const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s3 = wb.Sheets['2026'];
const rows3 = xlsx.utils.sheet_to_json(s3, { header: 1 });

console.log('2026 rows count:', rows3.length);
for (let r = 2; r < rows3.length; r++) {
  const row = rows3[r];
  if (!row) continue;
  // check if any month has value
  const vals = [];
  for (let c = 2; c <= 13; c++) {
    if (row[c] !== undefined && row[c] !== null && row[c] !== '') {
      vals.push(`col${c}=${row[c]}`);
    }
  }
  if (vals.length > 0) {
    console.log(`Row ${r} (${row[1]}): ${vals.join(', ')}`);
  }
}

