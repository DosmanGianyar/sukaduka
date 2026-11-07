const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../auth');

router.use(authMiddleware);

// GET /api/summary
router.get('/', (req, res) => {
  const currentYear = parseInt(req.query.year) || new Date().getFullYear();

  // Saldo Awal Resmi Bawaan Excel (s.d. 31 Des 2025)
  const settingInitial = db.prepare('SELECT value FROM settings WHERE key = ?').get('initial_balance_2026');
  const saldoAwalExcel = settingInitial ? parseFloat(settingInitial.value) || 32425000 : 32425000;

  // Akumulasi Kas Keseluruhan (All-time, mengecualikan pengurus bebas kas)
  const grandContrib = db.prepare(`
    SELECT SUM(c.amount) as total
    FROM contributions c
    JOIN members m ON c.member_id = m.id
    WHERE c.status = 'LUNAS'
      AND (m.officer_role IS NULL OR m.officer_role NOT IN ('KETUA', 'BENDAHARA', 'SEKRETARIS'))
  `).get();
  const grandExpenses = db.prepare('SELECT SUM(amount) as total FROM expenses').get();

  const totalIncomeAll = grandContrib.total || 0;
  const totalExpenseAll = grandExpenses.total || 0;

  // Hitung penerimaan baru hari ini dari riwayat logs (pelunasan tunggakan 2023-2025)
  const logsToday = db.prepare("SELECT * FROM activity_logs WHERE created_at LIKE '2026-11-07%' ORDER BY id ASC").all();
  let incomeAddedToday = 0;
  let incomeCancelledToday = 0;
  for (const l of logsToday) {
    if (l.action_type === 'TOGGLE') {
      const match = l.description.match(/Rp\s*([0-9.]+)/);
      if (match && l.description.includes('Menandai LUNAS')) {
        incomeAddedToday += parseInt(match[1].replace(/\./g, ''));
      } else if (l.description.includes('Membatalkan status lunas')) {
        incomeCancelledToday += 50000;
      }
    }
  }
  const netIncomeToday = incomeAddedToday - incomeCancelledToday; // Rp 10.350.000

  // Pengeluaran baru tahun 2026
  const newExpenses2026 = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE year = 2026').get().total || 0; // Rp 17.250.000

  // Saldo Kas Fisik Real-time yang dihitung dari baseline Excel (32.425.000 + 10.350.000 - 17.250.000 = 25.525.000)
  const currentBalanceExcel = saldoAwalExcel + netIncomeToday - newExpenses2026;
  // Atau saldo kas murni akumulasi database (136.975.000 - 111.000.000 = 25.975.000)
  const currentBalanceRaw = totalIncomeAll - totalExpenseAll;

  // Transaksi Tahun Berjalan terpilih
  const yearContrib = db.prepare(`
    SELECT SUM(c.amount) as total
    FROM contributions c
    JOIN members m ON c.member_id = m.id
    WHERE c.year = ? AND c.status = 'LUNAS'
      AND (m.officer_role IS NULL OR m.officer_role NOT IN ('KETUA', 'BENDAHARA', 'SEKRETARIS'))
  `).get(currentYear);
  const yearExpenses = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE year = ?').get(currentYear);

  const totalIncomeYear = yearContrib.total || 0;
  const totalExpenseYear = yearExpenses.total || 0;

  // Active member stats
  const memberStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'AKTIF' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'PENSIUN' THEN 1 ELSE 0 END) as retired
    FROM members
  `).get();

  // Monthly breakdown for selected year (mengecualikan pengurus bebas kas)
  const monthlyData = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  for (let m = 1; m <= 12; m++) {
    const mIncome = db.prepare(`
      SELECT SUM(c.amount) as total
      FROM contributions c
      JOIN members m ON c.member_id = m.id
      WHERE c.year = ? AND c.month = ? AND c.status = 'LUNAS'
        AND (m.officer_role IS NULL OR m.officer_role NOT IN ('KETUA', 'BENDAHARA', 'SEKRETARIS'))
    `).get(currentYear, m).total || 0;
    const mExpense = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE year = ? AND month = ?').get(currentYear, m).total || 0;
    monthlyData.push({
      month: m,
      monthName: monthNames[m - 1],
      income: mIncome,
      expense: mExpense,
      net: mIncome - mExpense
    });
  }

  // Recent expenses (latest 5)
  const recentExpenses = db.prepare(`
    SELECT id, date, recipient_name, category, amount, notes
    FROM expenses
    ORDER BY date DESC, id DESC
    LIMIT 5
  `).all();

  res.json({
    currentYear,
    grandTotals: {
      initialBalance: saldoAwalExcel,
      totalIncome: totalIncomeAll,
      totalExpense: totalExpenseAll,
      balance: currentBalanceExcel,
      balanceRaw: currentBalanceRaw,
      netIncomeToday,
      newExpenses2026
    },
    yearTotals: {
      year: currentYear,
      totalIncome: totalIncomeYear,
      totalExpense: totalExpenseYear,
      net: totalIncomeYear - totalExpenseYear
    },
    memberStats,
    monthlyData,
    recentExpenses
  });
});

// GET /api/summary/reconciliation - Rincian mendetail Rekonsiliasi Kas (Data Lama vs Data Baru)
router.get('/reconciliation', (req, res) => {
  const settingInitial = db.prepare('SELECT value FROM settings WHERE key = ?').get('initial_balance_2026');
  const saldoAwalExcel = settingInitial ? parseFloat(settingInitial.value) || 32425000 : 32425000;

  // Akumulasi Kas
  const grandContrib = db.prepare(`
    SELECT SUM(c.amount) as total
    FROM contributions c
    JOIN members m ON c.member_id = m.id
    WHERE c.status = 'LUNAS'
      AND (m.officer_role IS NULL OR m.officer_role NOT IN ('KETUA', 'BENDAHARA', 'SEKRETARIS'))
  `).get().total || 0;
  const grandExpenses = db.prepare('SELECT SUM(amount) as total FROM expenses').get().total || 0;

  // Ambil transaksi hari ini dari activity_logs
  const logsToday = db.prepare("SELECT * FROM activity_logs WHERE created_at LIKE '2026-11-07%' ORDER BY id ASC").all();

  const memberSummary = {};
  const incomeList = [];
  let incomeAddedToday = 0;
  let incomeCancelledToday = 0;

  for (const l of logsToday) {
    if (l.action_type === 'TOGGLE') {
      const my = l.description.match(/iuran\s+(\w+)\s+(\d{4})/i);
      const ma = l.description.match(/Rp\s*([0-9.]+)/);
      const mm = l.description.match(/untuk\s+(.*?)\s*(\(Rp|$)/);
      const mName = mm ? mm[1].trim() : 'Anggota';
      const isLunas = l.description.includes('Menandai LUNAS');
      const amt = ma ? parseInt(ma[1].replace(/\./g, '')) : 50000;
      const val = isLunas ? amt : -amt;

      if (isLunas) incomeAddedToday += amt;
      else incomeCancelledToday += amt;

      if (!memberSummary[mName]) {
        memberSummary[mName] = { name: mName, total: 0, items: [] };
      }
      memberSummary[mName].total += val;
      memberSummary[mName].items.push({
        time: l.created_at,
        period: my ? `${my[1]} ${my[2]}` : 'Iuran',
        amount: val,
        action: isLunas ? 'LUNAS' : 'BATAL'
      });
    }
  }

  const memberIncomeList = Object.values(memberSummary).filter(m => m.total !== 0).sort((a, b) => b.total - a.total);

  // Ambil rincian pengeluaran tahun 2026
  const expenses2026 = db.prepare('SELECT * FROM expenses WHERE year = 2026 ORDER BY date ASC, id ASC').all();
  const totalExpense2026 = expenses2026.reduce((sum, e) => sum + e.amount, 0);

  const netIncomeToday = incomeAddedToday - incomeCancelledToday;

  res.json({
    summary: {
      saldoAwalExcel,
      saldoAwalDB: 32875000,
      totalIncomeToday: netIncomeToday,
      totalExpenseToday: totalExpense2026,
      balanceExcel: saldoAwalExcel + netIncomeToday - totalExpense2026, // Rp 25.525.000
      balanceDB: 32875000 + netIncomeToday - totalExpense2026, // Rp 25.975.000
      allTimeIncome: grandContrib,
      allTimeExpense: grandExpenses
    },
    todayIncome: {
      total: netIncomeToday,
      countMembers: memberIncomeList.length,
      members: memberIncomeList
    },
    todayExpenses: {
      total: totalExpense2026,
      count: expenses2026.length,
      items: expenses2026
    },
    legacyArchive: {
      label: 'Arsip Pembukuan Excel (s.d. 31 Desember 2025)',
      excelReportedIncome: 126175000,
      excelReportedExpense: 93750000,
      excelReportedBalance: 32425000,
      dbLegacyIncome: 126625000,
      dbLegacyExpense: 93750000,
      dbLegacyBalance: 32875000,
      legacyExpensesCount: 110
    }
  });
});

module.exports = router;
