const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s2 = wb.Sheets['Pendapatan'];
const rows = xlsx.utils.sheet_to_json(s2, { header: 1 });

const colMap = [
  { col: 3, year: 2022, month: 10, label: 'Oktober 2022' },
  { col: 4, year: 2022, month: 11, label: 'November 2022' },
  { col: 5, year: 2022, month: 12, label: 'Desember 2022' },
  { col: 6, year: 2023, month: 1, label: 'Januari 2023' },
  { col: 7, year: 2023, month: 2, label: 'Februari 2023' },
  { col: 8, year: 2023, month: 3, label: 'Maret 2023' },
  { col: 9, year: 2023, month: 4, label: 'April 2023' },
  { col: 10, year: 2023, month: 5, label: 'Mei 2023' },
  { col: 11, year: 2023, month: 6, label: 'Juni 2023' },
  { col: 12, year: 2023, month: 7, label: 'Juli 2023' },
  { col: 13, year: 2023, month: 8, label: 'Agustus 2023' },
  { col: 14, year: 2023, month: 9, label: 'September 2023' },
  { col: 15, year: 2023, month: 10, label: 'Oktober 2023' },
  { col: 16, year: 2023, month: 11, label: 'November 2023' },
  { col: 17, year: 2023, month: 12, label: 'Desember 2023' },
  { col: 19, year: 2024, month: 1, label: 'Januari 2024' },
  { col: 20, year: 2024, month: 2, label: 'Februari 2024' },
  { col: 21, year: 2024, month: 3, label: 'Maret 2024' },
  { col: 22, year: 2024, month: 4, label: 'April 2024' },
  { col: 23, year: 2024, month: 5, label: 'Mei 2024' },
  { col: 24, year: 2024, month: 6, label: 'Juni 2024' },
  { col: 25, year: 2024, month: 7, label: 'Juli 2024' },
  { col: 26, year: 2024, month: 8, label: 'Agustus 2024' },
  { col: 27, year: 2024, month: 9, label: 'September 2024' },
  { col: 28, year: 2024, month: 10, label: 'Oktober 2024' },
  { col: 29, year: 2024, month: 11, label: 'November 2024' },
  { col: 30, year: 2024, month: 12, label: 'Desember 2024' },
  { col: 32, year: 2025, month: 1, label: 'Januari 2025' },
  { col: 33, year: 2025, month: 2, label: 'Februari 2025' },
  { col: 34, year: 2025, month: 3, label: 'Maret 2025' },
  { col: 35, year: 2025, month: 4, label: 'April 2025' },
  { col: 36, year: 2025, month: 5, label: 'Mei 2025' },
  { col: 37, year: 2025, month: 6, label: 'Juni 2025' },
  { col: 38, year: 2025, month: 7, label: 'Juli 2025' },
  { col: 39, year: 2025, month: 8, label: 'Agustus 2025' },
  { col: 40, year: 2025, month: 9, label: 'September 2025' },
  { col: 41, year: 2025, month: 10, label: 'Oktober 2025' },
  { col: 42, year: 2025, month: 11, label: 'November 2025' },
  { col: 43, year: 2025, month: 12, label: 'Desember 2025' }
];

console.log('=== PEMETAAN LENGKAP ANGGOTA PENSIUN & BULAN MULAI PENSIUN ===');
for (let r = 2; r < rows.length; r++) {
  const row = rows[r];
  if (!row || !row[1] || typeof row[1] !== 'string') continue;
  if (row[1].toUpperCase().includes('TOTAL')) continue;

  let firstPensiun = null;
  for (const m of colMap) {
    const val = row[m.col];
    if (val && String(val).toUpperCase().includes('PENSIUN')) {
      if (!firstPensiun) firstPensiun = m;
    }
  }

  if (firstPensiun || r >= 137) {
    console.log(`Row ${r} [No ${row[0]}]: ${row[1]} -> Bulan Pensiun: ${firstPensiun ? firstPensiun.label : 'Januari 2023 (Kelompok Bawah)'}`);
  }
}

