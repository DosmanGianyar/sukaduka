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

  // Transaksi Tahun Berjalan (misal 2026 - mengecualikan pengurus bebas kas)
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

  // Total Kas Terkini: Saldo Awal Excel (Rp 32.425.000) + Pemasukan Tahun Ini - Pengeluaran Tahun Ini
  const currentBalance = saldoAwalExcel + totalIncomeYear - totalExpenseYear;

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
      totalIncome: totalIncomeYear,
      totalExpense: totalExpenseYear,
      balance: currentBalance
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

module.exports = router;
