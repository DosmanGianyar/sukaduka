const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join(__dirname, '..', 'print 3 02 2026.xlsx'));
const s2 = wb.Sheets['Pendapatan'];
const rows2 = xlsx.utils.sheet_to_json(s2, { header: 1 });

for (let r = 120; r < 160; r++) {
  if (rows2[r] && rows2[r].some(x => x !== undefined && x !== null && x !== '')) {
    const preview = rows2[r].map((v, i) => v !== undefined && v !== '' ? `[${i}]:${v}` : null).filter(Boolean);
    console.log(`Row ${r}:`, preview.slice(0, 8).join(', '));
  }
}

