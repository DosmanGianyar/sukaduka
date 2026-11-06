const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'print 3 02 2026.xlsx');
const wb = xlsx.readFile(filePath);
console.log('Sheets found:', wb.SheetNames);

const s2 = wb.Sheets['Pendapatan'];
const rows2 = xlsx.utils.sheet_to_json(s2, { header: 1 });
console.log('\n--- Pendapatan Row 0 (Years) ---');
console.log(rows2[0]);
console.log('\n--- Pendapatan Row 1 (Months) ---');
console.log(rows2[1]);
console.log('\n--- Pendapatan Row 2 (First Member) ---');
console.log(rows2[2]);
console.log('\n--- Pendapatan Row 3 (Second Member) ---');
console.log(rows2[3]);

const s3 = wb.Sheets['2026'];
const rows3 = xlsx.utils.sheet_to_json(s3, { header: 1 });
console.log('\n--- 2026 Row 0 ---');
console.log(rows3[0]);
console.log('\n--- 2026 Row 1 ---');
console.log(rows3[1]);
console.log('\n--- 2026 Row 2 ---');
console.log(rows3[2]);

const s4 = wb.Sheets['Pengeluaran'];
const rows4 = xlsx.utils.sheet_to_json(s4, { header: 1 });
console.log('\n--- Pengeluaran Row 0 ---');
console.log(rows4[0]);
console.log('\n--- Pengeluaran Row 1 ---');
console.log(rows4[1]);
console.log('\n--- Pengeluaran Sample Rows ---');
for (let i = 2; i < 10; i++) {
  console.log(rows4[i]);
}
console.log('\n--- Pengeluaran Last 15 Rows ---');
for (let i = Math.max(0, rows4.length - 15); i < rows4.length; i++) {
  console.log(rows4[i]);
}

