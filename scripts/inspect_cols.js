const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s2 = wb.Sheets['Pendapatan'];
const rows2 = xlsx.utils.sheet_to_json(s2, { header: 1 });

const row0 = rows2[0];
const row1 = rows2[1];

console.log('Columns mapping:');
let currentYear = null;
const colMap = [];

for (let c = 0; c < row1.length; c++) {
  if (row0[c] && !isNaN(parseInt(row0[c]))) {
    currentYear = parseInt(row0[c]);
  }
  const month = row1[c];
  colMap.push({ col: c, year: currentYear, month: month });
  console.log(`Col ${c}: year=${currentYear}, month=${month}`);
}

console.log('\nTotal rows in Pendapatan:', rows2.length);
let memberCount = 0;
for (let r = 2; r < rows2.length; r++) {
  const row = rows2[r];
  if (row && (row[1] || row[0])) {
    memberCount++;
  }
}
console.log('Member rows count:', memberCount);

