const path = require('path');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const db = require('../server/db');

console.log('--- Memulai Import Data Lengkap Suka Duka dari Excel ---');

const excelPath = path.join(__dirname, '..', 'print 3 02 2026.xlsx');
const wb = xlsx.readFile(excelPath);

const monthNamesIndo = {
  'januari': 1, 'jan': 1,
  'februari': 2, 'feb': 2,
  'maret': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'mei': 5, 'may': 5,
  'juni': 6, 'jun': 6,
  'juli': 7, 'jul': 7,
  'agustus': 8, 'aug': 8,
  'september': 9, 'sep': 9,
  'oktober': 10, 'oct': 10,
  'november': 11, 'nopember': 11, 'nov': 11, 'nop': 11,
  'desember': 12, 'dec': 12
};

function parsePeriod(periodStr) {
  if (!periodStr) return { year: 2023, month: 1 };
  const str = String(periodStr).trim().toLowerCase();
  const parts = str.split(/\s+/);
  let month = 1;
  let year = 2023;
  for (const part of parts) {
    if (!isNaN(parseInt(part)) && parseInt(part) >= 2020 && parseInt(part) <= 2030) {
      year = parseInt(part);
    } else if (monthNamesIndo[part]) {
      month = monthNamesIndo[part];
    }
  }
  return { year, month };
}

// 1. Inisialisasi Pengaturan & User Default
const initSettings = db.transaction(() => {
  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('school_name', 'PENGURUS SUKA DUKA GURU DAN PEGAWAI');
  insertSetting.run('leader_name', 'Nyoman Suwita, S.Pd, M.Pd');
  insertSetting.run('leader_title', 'Ketua');
  insertSetting.run('treasurer_name', 'Wayan Setiawati');
  insertSetting.run('treasurer_title', 'Bendahara');
  insertSetting.run('secretary_name', 'I Putu Darma Putra');
  insertSetting.run('secretary_title', 'Sekretaris');
  insertSetting.run('default_dues_amount', '50000');

  // Insert default users (Ketua, Bendahara, Sekretaris, Admin)
  const salt = bcrypt.genSaltSync(10);
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
  
  insertUser.run('admin', bcrypt.hashSync('admin123', salt), 'Administrator', 'admin');
  insertUser.run('ketua', bcrypt.hashSync('ketua123', salt), 'Nyoman Suwita, S.Pd, M.Pd', 'ketua');
  insertUser.run('bendahara', bcrypt.hashSync('bendahara123', salt), 'Wayan Setiawati', 'bendahara');
  insertUser.run('sekretaris', bcrypt.hashSync('sekretaris123', salt), 'I Putu Darma Putra', 'sekretaris');
});
initSettings();
console.log('✓ Pengaturan default & akun pengurus berhasil disiapkan');

// 2. Baca Anggota dari Sheet 'Pendapatan' & 'Data Lama'
const sPendapatan = wb.Sheets['Pendapatan'];
const rowsPendapatan = xlsx.utils.sheet_to_json(sPendapatan, { header: 1 });

const sDataLama = wb.Sheets['Data Lama'];
const rowsDataLama = sDataLama ? xlsx.utils.sheet_to_json(sDataLama, { header: 1 }) : [];

const s2026 = wb.Sheets['2026'];
const rows2026 = xlsx.utils.sheet_to_json(s2026, { header: 1 });

// Bersihkan data lama
db.exec('DELETE FROM contributions; DELETE FROM expenses; DELETE FROM members;');

// Pemetaan kolom bulan di Sheet 'Pendapatan'
const colMap = [
  // 2022
  { col: 3, year: 2022, month: 10, label: 'Okt 2022' },
  { col: 4, year: 2022, month: 11, label: 'Nov 2022' },
  { col: 5, year: 2022, month: 12, label: 'Des 2022' },
  // 2023
  { col: 6, year: 2023, month: 1, label: 'Jan 2023' },
  { col: 7, year: 2023, month: 2, label: 'Feb 2023' },
  { col: 8, year: 2023, month: 3, label: 'Mar 2023' },
  { col: 9, year: 2023, month: 4, label: 'Apr 2023' },
  { col: 10, year: 2023, month: 5, label: 'Mei 2023' },
  { col: 11, year: 2023, month: 6, label: 'Jun 2023' },
  { col: 12, year: 2023, month: 7, label: 'Jul 2023' },
  { col: 13, year: 2023, month: 8, label: 'Agu 2023' },
  { col: 14, year: 2023, month: 9, label: 'Sep 2023' },
  { col: 15, year: 2023, month: 10, label: 'Okt 2023' },
  { col: 16, year: 2023, month: 11, label: 'Nov 2023' },
  { col: 17, year: 2023, month: 12, label: 'Des 2023' },
  // 2024
  { col: 19, year: 2024, month: 1, label: 'Jan 2024' },
  { col: 20, year: 2024, month: 2, label: 'Feb 2024' },
  { col: 21, year: 2024, month: 3, label: 'Mar 2024' },
  { col: 22, year: 2024, month: 4, label: 'Apr 2024' },
  { col: 23, year: 2024, month: 5, label: 'Mei 2024' },
  { col: 24, year: 2024, month: 6, label: 'Jun 2024' },
  { col: 25, year: 2024, month: 7, label: 'Jul 2024' },
  { col: 26, year: 2024, month: 8, label: 'Agu 2024' },
  { col: 27, year: 2024, month: 9, label: 'Sep 2024' },
  { col: 28, year: 2024, month: 10, label: 'Okt 2024' },
  { col: 29, year: 2024, month: 11, label: 'Nov 2024' },
  { col: 30, year: 2024, month: 12, label: 'Des 2024' },
  // 2025
  { col: 32, year: 2025, month: 1, label: 'Jan 2025' },
  { col: 33, year: 2025, month: 2, label: 'Feb 2025' },
  { col: 34, year: 2025, month: 3, label: 'Mar 2025' },
  { col: 35, year: 2025, month: 4, label: 'Apr 2025' },
  { col: 36, year: 2025, month: 5, label: 'Mei 2025' },
  { col: 37, year: 2025, month: 6, label: 'Jun 2025' },
  { col: 38, year: 2025, month: 7, label: 'Jul 2025' },
  { col: 39, year: 2025, month: 8, label: 'Agu 2025' },
  { col: 40, year: 2025, month: 9, label: 'Sep 2025' },
  { col: 41, year: 2025, month: 10, label: 'Okt 2025' },
  { col: 42, year: 2025, month: 11, label: 'Nov 2025' },
  { col: 43, year: 2025, month: 12, label: 'Des 2025' }
];

// Langkah 1: Kumpulkan seluruh data mentah anggota dan pisahkan Aktif vs Pensiun
const rawActive = [];
const rawRetired = [];

for (let r = 2; r < rowsPendapatan.length; r++) {
  const row = rowsPendapatan[r];
  if (!row) continue;

  const rawNo = row[0];
  const rawName = row[1];
  const rawNip = row[2];

  if (!rawName || typeof rawName !== 'string') continue;
  const nameTrim = rawName.trim();
  if (nameTrim.toUpperCase().includes('TOTAL') || nameTrim.toUpperCase().includes('JUMLAH')) continue;

  const nip = rawNip ? String(rawNip).trim() : null;

  // Cek apakah ada status pensiun dan temukan bulan mulai pensiun
  let isRetired = false;
  let pensiunYear = null;
  let pensiunMonth = null;

  for (const m of colMap) {
    const val = row[m.col];
    if (val && String(val).toUpperCase().includes('PENSIUN')) {
      isRetired = true;
      if (!pensiunYear) {
        pensiunYear = m.year;
        pensiunMonth = m.month;
      }
    }
  }

  // Jika berada di kelompok bawah Excel (r >= 137), pasti pensiun
  if (r >= 137) {
    isRetired = true;
    if (!pensiunYear) {
      pensiunYear = 2023;
      pensiunMonth = 1;
    }
  }

  let type = 'GURU';
  if (!nip && r >= 108 && r <= 118) {
    type = 'PEGAWAI';
  }

  const memberItem = {
    rowIdx: r,
    name: nameTrim,
    nip,
    type,
    isRetired,
    pensiunYear,
    pensiunMonth
  };

  if (isRetired) {
    rawRetired.push(memberItem);
  } else {
    rawActive.push(memberItem);
  }
}

console.log(`Ditemukan ${rawActive.length} anggota aktif dan ${rawRetired.length} anggota purna tugas (pensiun).`);

// Langkah 2: Masukkan ke Database dengan nomor urut yang rapi:
// Anggota Aktif: Nomor 1 s/d N (paling atas)
// Anggota Pensiun: Nomor N+1 s/d akhir (paling bawah)
const insertMember = db.prepare(`
  INSERT INTO members (member_no, nip, name, type, status, pensiun_year, pensiun_month, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const memberMapByName = new Map();
const allMembersList = [];

let currentNo = 1;

// Masukkan Aktif terlebih dahulu (Nomor 1 s/d 108)
for (const m of rawActive) {
  const res = insertMember.run(currentNo, m.nip, m.name, m.type, 'AKTIF', null, null, null);
  const id = res.lastInsertRowid;
  memberMapByName.set(m.name.toLowerCase(), id);
  allMembersList.push({ id, name: m.name, rowIdx: m.rowIdx, status: 'AKTIF', pensiunYear: null, pensiunMonth: null });
  currentNo++;
}

// Masukkan Pensiun di paling bawah (Nomor 109 s/d 120)
for (const m of rawRetired) {
  const notes = `Pensiun sejak ${m.pensiunMonth}/${m.pensiunYear}`;
  const res = insertMember.run(currentNo, m.nip, m.name, m.type, 'PENSIUN', m.pensiunYear, m.pensiunMonth, notes);
  const id = res.lastInsertRowid;
  memberMapByName.set(m.name.toLowerCase(), id);
  allMembersList.push({ id, name: m.name, rowIdx: m.rowIdx, status: 'PENSIUN', pensiunYear: m.pensiunYear, pensiunMonth: m.pensiunMonth });
  currentNo++;
}

console.log(`✓ Berhasil mengimpor ${allMembersList.length} total anggota (Pensiun dikelompokkan di bagian paling bawah)`);

// Langkah 3: Impor Iuran Bulanan (2022 - 2025)
const insertContrib = db.prepare(`
  INSERT OR REPLACE INTO contributions (member_id, year, month, amount, status, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);

let totalContribCount = 0;
let totalContribSum = 0;

const dataLamaMap = new Map();
const normalize = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
for (let r = 2; r < rowsDataLama.length; r++) {
  const row = rowsDataLama[r];
  if (row && row[1]) dataLamaMap.set(normalize(row[1]), row);
}

const importContributions = db.transaction(() => {
  for (const m of allMembersList) {
    const row = rowsPendapatan[m.rowIdx];
    if (!row) continue;
    const lamaRow = dataLamaMap.get(normalize(m.name));

    for (const mapping of colMap) {
      let val = row[mapping.col];
      // Jika kosong di Pendapatan, fallback ke Data Lama
      if ((val === undefined || val === null || val === '') && lamaRow) {
        val = lamaRow[mapping.col];
      }

      let amount = 0;
      let status = 'BELUM';
      let notes = null;

      if (val !== undefined && val !== null && val !== '') {
        const valStr = String(val).trim().toUpperCase();
        if (!isNaN(Number(val))) {
          amount = Number(val);
          status = 'LUNAS';
          totalContribSum += amount;
        } else if (valStr.includes('PENSIUN')) {
          status = 'PENSIUN';
          notes = 'Pensiun';
        } else if (valStr === '-') {
          status = 'BELUM';
        } else {
          notes = valStr;
        }
      }

      // Jika anggota sudah pensiun sebelum/pada periode ini, set otomatis PENSIUN
      if (m.pensiunYear && (mapping.year > m.pensiunYear || (mapping.year === m.pensiunYear && mapping.month >= m.pensiunMonth))) {
        if (amount === 0) {
          status = 'PENSIUN';
        }
      }

      insertContrib.run(m.id, mapping.year, mapping.month, amount, status, notes);
      totalContribCount++;
    }
  }
});
importContributions();
console.log(`✓ Berhasil mengimpor ${totalContribCount} data iuran bulanan (2022-2025)`);

// Langkah 4: Impor Iuran Tahun 2026 dari Sheet '2026'
let contrib2026Count = 0;
const import2026 = db.transaction(() => {
  for (let r = 2; r < rows2026.length; r++) {
    const row = rows2026[r];
    if (!row) continue;
    const rawName = row[1];
    if (!rawName || typeof rawName !== 'string') continue;
    const nameTrim = rawName.trim();
    if (nameTrim.toUpperCase().includes('TOTAL')) continue;

    let memberId = memberMapByName.get(nameTrim.toLowerCase());
    let memberObj = allMembersList.find(x => x.id === memberId);

    if (!memberId) {
      const res = insertMember.run(currentNo++, null, nameTrim, 'GURU', 'AKTIF', null, null, 'Baru 2026');
      memberId = res.lastInsertRowid;
      memberMapByName.set(nameTrim.toLowerCase(), memberId);
      memberObj = { id: memberId, name: nameTrim, status: 'AKTIF' };
      allMembersList.push(memberObj);
    }

    for (let month = 1; month <= 12; month++) {
      const col = month + 1;
      const val = row[col];
      let amount = 0;
      let status = 'BELUM';
      let notes = null;

      if (val !== undefined && val !== null && val !== '') {
        if (!isNaN(Number(val)) && Number(val) > 0) {
          amount = Number(val);
          status = 'LUNAS';
          totalContribSum += amount;
        } else if (String(val).toUpperCase().includes('PENSIUN')) {
          status = 'PENSIUN';
        }
      }

      // Jika anggota pensiun sebelum 2026, status otomatis PENSIUN
      if (memberObj && memberObj.pensiunYear && memberObj.pensiunYear <= 2026) {
        if (amount === 0) {
          status = 'PENSIUN';
        }
      }

      insertContrib.run(memberId, 2026, month, amount, status, notes);
      contrib2026Count++;
    }
  }

  // Lengkapi slot 2026 untuk anggota pensiun lama
  for (const m of allMembersList) {
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM contributions WHERE member_id = ? AND year = 2026').get(m.id);
    if (!existing || existing.cnt === 0) {
      for (let month = 1; month <= 12; month++) {
        const status = m.status === 'PENSIUN' ? 'PENSIUN' : 'BELUM';
        insertContrib.run(m.id, 2026, month, 0, status, null);
        contrib2026Count++;
      }
    }
  }
});
import2026();
console.log(`✓ Berhasil mengimpor slot iuran tahun 2026`);

// Langkah 5: Impor Pengeluaran
const sPengeluaran = wb.Sheets['Pengeluaran'];
const rowsPengeluaran = xlsx.utils.sheet_to_json(sPengeluaran, { header: 1 });

const insertExpense = db.prepare(`
  INSERT INTO expenses (expense_no, date, year, month, period_label, recipient_name, member_id, category, section, amount, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let totalExpenseCount = 0;
let totalExpenseSum = 0;
let currentSection = 'Kekurangan Bayar Pengurus Sebelumnya';

const importExpenses = db.transaction(() => {
  for (let r = 0; r < rowsPengeluaran.length; r++) {
    const row = rowsPengeluaran[r];
    if (!row) continue;

    const firstCell = String(row[0] || '').trim();
    const secondCell = String(row[1] || '').trim();

    if (firstCell.includes('Kekurangan Bayar')) {
      currentSection = 'Kekurangan Bayar Pengurus Sebelumnya';
      continue;
    }
    if (firstCell === 'Pengeluaran' || secondCell === 'Pengeluaran') {
      currentSection = 'Pengeluaran';
      continue;
    }
    if (firstCell === 'No' || secondCell === 'Bulan' || firstCell.toUpperCase() === 'TOTAL') {
      continue;
    }

    const no = parseInt(row[0]) || null;
    const periodStr = row[1] ? String(row[1]).trim() : '';
    const recipient = row[2] ? String(row[2]).trim() : '';
    const amountVal = row[4];
    const ket = row[5] ? String(row[5]).trim() : '';

    if (!recipient && !amountVal) continue;
    if (isNaN(Number(amountVal)) || Number(amountVal) <= 0) continue;

    const amount = Number(amountVal);
    const { year, month } = parsePeriod(periodStr);
    const date = `${year}-${String(month).padStart(2, '0')}-15`;

    const memberId = memberMapByName.get(recipient.toLowerCase()) || null;

    let category = ket || 'Lain-lain';
    const ketLower = ket.toLowerCase();
    if (ketLower.includes('istri melahirkan')) category = 'Istri Melahirkan';
    else if (ketLower.includes('melahirkan')) category = 'Melahirkan';
    else if (ketLower.includes('suami sakit')) category = 'Suami Sakit';
    else if (ketLower.includes('istri sakit')) category = 'Istri Sakit';
    else if (ketLower.includes('sakit') || ketLower.includes('opname')) category = 'Sakit';
    else if (ketLower.includes('menikah')) category = 'Menikah';
    else if (ketLower.includes('meninggal')) category = 'Duka / Meninggal';
    else if (recipient.toLowerCase().includes('kenang-kenangan') || currentSection.includes('pensiunan')) category = 'Kenang-kenangan Pensiunan';

    insertExpense.run(
      no,
      date,
      year,
      month,
      periodStr || `${month}/${year}`,
      recipient,
      memberId,
      category,
      currentSection,
      amount,
      ket
    );

    totalExpenseCount++;
    totalExpenseSum += amount;
  }
});
importExpenses();
console.log(`✓ Berhasil mengimpor ${totalExpenseCount} transaksi pengeluaran (Total: Rp ${totalExpenseSum.toLocaleString('id-ID')})`);

// Langkah 6: Tetapkan Peran Pengurus Inti (Ketua, Bendahara, Sekretaris)
db.prepare("UPDATE members SET officer_role = 'KETUA' WHERE name LIKE '%Suwita%'").run();
db.prepare("UPDATE members SET officer_role = 'BENDAHARA' WHERE name LIKE '%Setiawati%'").run();
db.prepare("UPDATE members SET officer_role = 'SEKRETARIS' WHERE name LIKE '%Darma Putra%'").run();
console.log('✓ Peran pengurus inti (Ketua, Bendahara, Sekretaris) berhasil ditetapkan');

console.log('\n================ DATA BERHASIL DIMUTAKHIRKAN ================');
const memberStats = db.prepare("SELECT COUNT(*) as cnt, SUM(CASE WHEN status = 'AKTIF' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status = 'PENSIUN' THEN 1 ELSE 0 END) as retired FROM members").get();
console.log(`Total Anggota : ${memberStats.cnt} (Aktif: ${memberStats.active}, Pensiun: ${memberStats.retired})`);
console.log('=============================================================\n');
