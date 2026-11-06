const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const db = require('../db');
const { authMiddleware } = require('../auth');

router.use(authMiddleware);

// Helper function to calculate full financial report for a specific year
function getYearReportData(year, members) {
  // Contributions for this year
  const contribRows = db.prepare('SELECT member_id, month, amount, status, notes FROM contributions WHERE year = ?').all(year);
  const contribMap = {};
  for (const c of contribRows) {
    if (!contribMap[c.member_id]) contribMap[c.member_id] = {};
    contribMap[c.member_id][c.month] = c;
  }

  // Monthly totals & grid
  const monthlyTotals = {};
  for (let m = 1; m <= 12; m++) monthlyTotals[m] = 0;
  let totalIncomeYear = 0;

  const rows = members.map(m => {
    const mData = contribMap[m.id] || {};
    const months = {};
    let memberSum = 0;
    const isOfficerExempt = ['KETUA', 'BENDAHARA', 'SEKRETARIS'].includes(m.officer_role);

    for (let mth = 1; mth <= 12; mth++) {
      const cell = mData[mth];
      const isBeforeJoin = m.join_year && (
        year < m.join_year ||
        (year === m.join_year && mth < m.join_month)
      );

      const isRetiredThisMonth = m.status === 'PENSIUN' && (
        !m.pensiun_year ||
        year > m.pensiun_year ||
        (year === m.pensiun_year && mth >= m.pensiun_month)
      );

      if (isBeforeJoin) {
        months[mth] = '-';
      } else if (cell && cell.status === 'LUNAS' && cell.amount > 0) {
        months[mth] = cell.amount;
        memberSum += cell.amount;
        if (!isOfficerExempt) {
          monthlyTotals[mth] += cell.amount;
          totalIncomeYear += cell.amount;
        }
      } else if ((cell && cell.status === 'PENSIUN') || isRetiredThisMonth) {
        months[mth] = 'PENSIUN';
      } else {
        months[mth] = '-';
      }
    }

    return {
      no: m.member_no,
      name: m.name,
      nip: m.nip || '-',
      status: m.status,
      officer_role: m.officer_role,
      is_officer_exempt: isOfficerExempt,
      months,
      total: memberSum
    };
  });

  // Expenses this year
  const expenses = db.prepare('SELECT * FROM expenses WHERE year = ? ORDER BY date ASC, id ASC').all(year);
  const totalExpenseYear = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Saldo awal (semua pemasukan kas sebelum tahun ini dikurangi pengeluaran, mengecualikan pengurus bebas kas)
  const priorIncome = db.prepare(`
    SELECT SUM(c.amount) as total
    FROM contributions c
    JOIN members m ON c.member_id = m.id
    WHERE c.year < ? AND c.status = 'LUNAS'
      AND (m.officer_role IS NULL OR m.officer_role NOT IN ('KETUA', 'BENDAHARA', 'SEKRETARIS'))
  `).get(year).total || 0;
  const priorExpense = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE year < ?').get(year).total || 0;
  const saldoAwal = priorIncome - priorExpense;
  const saldoAkhir = saldoAwal + totalIncomeYear - totalExpenseYear;

  return {
    year,
    rows,
    monthlyTotals,
    totalIncomeYear,
    expenses,
    totalExpenseYear,
    saldoAwal,
    saldoAkhir
  };
}

// GET /api/reports/landscape-data?year=2026 or ?year=ALL
router.get('/landscape-data', (req, res) => {
  // Settings
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const s of settingsRows) settings[s.key] = s.value;

  // Members
  const members = db.prepare("SELECT * FROM members ORDER BY CASE WHEN status = 'PENSIUN' THEN 1 ELSE 0 END ASC, member_no ASC, id ASC").all();

  const isAll = (req.query.year || '').toUpperCase() === 'ALL';

  if (isAll) {
    const distinctYears = db.prepare('SELECT DISTINCT year FROM contributions ORDER BY year ASC').all().map(r => r.year);
    const years = distinctYears.length ? distinctYears : [2022, 2023, 2024, 2025, 2026];
    const reports = years.map(y => getYearReportData(y, members));

    return res.json({
      isAllYears: true,
      years,
      settings,
      reports
    });
  }

  const year = parseInt(req.query.year) || 2026;
  const report = getYearReportData(year, members);

  res.json({
    isAllYears: false,
    settings,
    ...report
  });
});

// Helper to append a single year's iuran and expenses to a workbook
function appendYearSheets(wb, year, members) {
  const contribRows = db.prepare('SELECT member_id, month, amount, status FROM contributions WHERE year = ?').all(year);
  const contribMap = {};
  for (const c of contribRows) {
    if (!contribMap[c.member_id]) contribMap[c.member_id] = {};
    contribMap[c.member_id][c.month] = c;
  }

  // Sheet 1: Rekap Iuran
  const wsData = [
    ['REKAPITULASI IURAN SUKA DUKA GURU DAN PEGAWAI TAHUN ' + year],
    [],
    ['NO', 'NAMA', 'NIP', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des', 'JUMLAH']
  ];

  const monthTotals = Array(13).fill(0);
  let grandTotal = 0;
  let hasPensiunExcelSection = false;

  for (const m of members) {
    if (m.status === 'PENSIUN' && !hasPensiunExcelSection) {
      hasPensiunExcelSection = true;
      wsData.push([]);
      wsData.push(['DAFTAR ANGGOTA PURNA TUGAS / PENSIUN']);
    }

    const row = [m.member_no, m.name, m.nip || '-'];
    let mTotal = 0;
    const mData = contribMap[m.id] || {};
    const isOfficerExempt = ['KETUA', 'BENDAHARA', 'SEKRETARIS'].includes(m.officer_role);

    for (let month = 1; month <= 12; month++) {
      const cell = mData[month];
      const isBeforeJoin = m.join_year && (
        year < m.join_year ||
        (year === m.join_year && month < m.join_month)
      );

      const isRetiredThisMonth = m.status === 'PENSIUN' && (
        !m.pensiun_year ||
        year > m.pensiun_year ||
        (year === m.pensiun_year && month >= m.pensiun_month)
      );

      if (isBeforeJoin) {
        row.push('-');
      } else if (cell && cell.status === 'LUNAS' && cell.amount > 0) {
        row.push(cell.amount);
        mTotal += cell.amount;
        if (!isOfficerExempt) {
          monthTotals[month] += cell.amount;
          grandTotal += cell.amount;
        }
      } else if ((cell && cell.status === 'PENSIUN') || isRetiredThisMonth) {
        row.push('PENSIUN');
      } else {
        row.push('-');
      }
    }
    row.push(mTotal);
    wsData.push(row);
  }

  // Baris Total
  const totalRow = ['TOTAL', '', ''];
  for (let m = 1; m <= 12; m++) {
    totalRow.push(monthTotals[m]);
  }
  totalRow.push(grandTotal);
  wsData.push(totalRow);

  const ws = xlsx.utils.aoa_to_sheet(wsData);
  xlsx.utils.book_append_sheet(wb, ws, `Iuran ${year}`);

  // Sheet 2: Pengeluaran
  const expenses = db.prepare('SELECT * FROM expenses WHERE year = ? ORDER BY date ASC, id ASC').all(year);
  const expData = [
    ['DAFTAR PENGELUARAN SANTUNAN SUKA DUKA TAHUN ' + year],
    [],
    ['NO', 'TANGGAL / BULAN', 'NAMA PENERIMA', 'KATEGORI', 'JUMLAH', 'KETERANGAN']
  ];
  let expTotal = 0;
  expenses.forEach((e, idx) => {
    expTotal += e.amount;
    expData.push([idx + 1, e.period_label || e.date, e.recipient_name, e.category, e.amount, e.notes || '']);
  });
  expData.push(['TOTAL', '', '', '', expTotal, '']);

  const wsExp = xlsx.utils.aoa_to_sheet(expData);
  xlsx.utils.book_append_sheet(wb, wsExp, `Pengeluaran ${year}`);
}

// GET /api/reports/export-excel?year=2026 or ?year=ALL
router.get('/export-excel', (req, res) => {
  const members = db.prepare("SELECT * FROM members ORDER BY CASE WHEN status = 'PENSIUN' THEN 1 ELSE 0 END ASC, member_no ASC, id ASC").all();
  const isAll = (req.query.year || '').toUpperCase() === 'ALL';
  const wb = xlsx.utils.book_new();

  if (isAll) {
    const distinctYears = db.prepare('SELECT DISTINCT year FROM contributions ORDER BY year ASC').all().map(r => r.year);
    const years = distinctYears.length ? distinctYears : [2022, 2023, 2024, 2025, 2026];

    // Summary Sheet
    const summaryData = [
      ['REKAPITULASI KEUANGAN SUKA DUKA SEMUA TAHUN (' + years[0] + ' - ' + years[years.length - 1] + ')'],
      [],
      ['TAHUN', 'SALDO AWAL KAS', 'TOTAL PEMASUKAN IURAN', 'TOTAL PENGELUARAN SANTUNAN', 'SALDO AKHIR KAS', 'JUMLAH KASUS']
    ];

    let grandIncome = 0;
    let grandExpense = 0;

    for (const y of years) {
      const rep = getYearReportData(y, members);
      grandIncome += rep.totalIncomeYear;
      grandExpense += rep.totalExpenseYear;
      summaryData.push([
        y,
        rep.saldoAwal,
        rep.totalIncomeYear,
        rep.totalExpenseYear,
        rep.saldoAkhir,
        rep.expenses.length
      ]);
    }

    const lastRep = getYearReportData(years[years.length - 1], members);
    summaryData.push([]);
    summaryData.push([
      'TOTAL KESELURUHAN',
      '',
      grandIncome,
      grandExpense,
      lastRep.saldoAkhir,
      ''
    ]);

    const wsSummary = xlsx.utils.aoa_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Multi-Tahun');

    // Append sheets for each year
    for (const y of years) {
      appendYearSheets(wb, y, members);
    }

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Rekap_SukaDuka_Semua_Tahun_${years[0]}-${years[years.length - 1]}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  }

  const year = parseInt(req.query.year) || 2026;
  appendYearSheets(wb, year, members);

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="Rekap_SukaDuka_${year}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

module.exports = router;
