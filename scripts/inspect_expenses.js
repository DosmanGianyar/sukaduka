const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s4 = wb.Sheets['Pengeluaran'];
const rows4 = xlsx.utils.sheet_to_json(s4, { header: 1 });

console.log('Total rows in Pengeluaran:', rows4.length);
let validExpenses = 0;
let totalSum = 0;

for (let r = 2; r < rows4.length; r++) {
  const row = rows4[r];
  if (!row) continue;
  const no = row[0];
  const bulan = row[1];
  const nama = row[2];
  const jumlah = row[4];
  const ket = row[5];
  
  if (jumlah && !isNaN(Number(jumlah))) {
    validExpenses++;
    totalSum += Number(jumlah);
    if (validExpenses <= 5 || validExpenses >= 115) {
      console.log(`[${r}] No: ${no}, Bulan: ${bulan}, Nama: ${nama}, Jumlah: ${jumlah}, Ket: ${ket}`);
    }
  } else if (nama || no) {
    console.log(`Special row [${r}]:`, row);
  }
}
console.log('Valid expenses count:', validExpenses, 'Total calculated sum:', totalSum);

