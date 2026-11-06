const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../auth');
const { logActivity } = require('../logger');

router.use(authMiddleware);

// GET /api/expenses
router.get('/', (req, res) => {
  const { year, category, section, search } = req.query;
  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];

  if (year && year !== 'ALL') {
    query += ' AND year = ?';
    params.push(parseInt(year));
  }

  if (category && category !== 'ALL') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (section && section !== 'ALL') {
    query += ' AND section = ?';
    params.push(section);
  }

  if (search) {
    query += ' AND (recipient_name LIKE ? OR notes LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY date DESC, id DESC';

  const expenses = db.prepare(query).all(...params);
  const totalAmount = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  res.json({ expenses, totalAmount, count: expenses.length });
});

// GET /api/expenses/categories
router.get('/categories', (req, res) => {
  const categories = [
    'Sakit',
    'Suami Sakit',
    'Istri Sakit',
    'Melahirkan',
    'Istri Melahirkan',
    'Menikah',
    'Duka / Meninggal',
    'Kenang-kenangan Pensiunan',
    'Lain-lain'
  ];
  res.json({ categories });
});

// POST /api/expenses
router.post('/', (req, res) => {
  const { date, recipient_name, member_id, category, section, amount, notes, period_label } = req.body;
  if (!recipient_name || !amount || !date) {
    return res.status(400).json({ error: 'Tanggal, Penerima, dan Nominal wajib diisi' });
  }

  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  // Max expense_no
  const maxNo = db.prepare('SELECT MAX(expense_no) as max_no FROM expenses').get();
  const expense_no = (maxNo && maxNo.max_no) ? maxNo.max_no + 1 : 1;

  try {
    const numAmount = parseFloat(amount);
    const result = db.prepare(`
      INSERT INTO expenses (expense_no, date, year, month, period_label, recipient_name, member_id, category, section, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      expense_no,
      date,
      year,
      month,
      period_label || `${month}/${year}`,
      recipient_name.trim(),
      member_id || null,
      category || 'Lain-lain',
      section || 'Pengeluaran',
      numAmount,
      notes ? notes.trim() : null
    );

    logActivity(req, {
      module: 'PENGELUARAN',
      action_type: 'CREATE',
      target_name: recipient_name.trim(),
      period: `${month}/${year}`,
      amount: numAmount,
      description: `Input Pengeluaran: Santunan ${category || 'Lain-lain'} untuk ${recipient_name.trim()} sebesar Rp ${numAmount.toLocaleString('id-ID')}`
    });

    res.json({ message: 'Pengeluaran berhasil disimpan', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id
router.put('/:id', (req, res) => {
  const { date, recipient_name, member_id, category, section, amount, notes, period_label } = req.body;
  if (!recipient_name || !amount || !date) {
    return res.status(400).json({ error: 'Tanggal, Penerima, dan Nominal wajib diisi' });
  }

  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const numAmount = parseFloat(amount);

  try {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);

    db.prepare(`
      UPDATE expenses
      SET date = ?, year = ?, month = ?, period_label = ?, recipient_name = ?, member_id = ?, category = ?, section = ?, amount = ?, notes = ?
      WHERE id = ?
    `).run(
      date,
      year,
      month,
      period_label || `${month}/${year}`,
      recipient_name.trim(),
      member_id || null,
      category,
      section,
      numAmount,
      notes ? notes.trim() : null,
      req.params.id
    );

    logActivity(req, {
      module: 'PENGELUARAN',
      action_type: 'UPDATE',
      target_name: recipient_name.trim(),
      period: `${month}/${year}`,
      amount: numAmount,
      description: `Edit Pengeluaran (ID: ${req.params.id}): Santunan ${category} untuk ${recipient_name.trim()} sebesar Rp ${numAmount.toLocaleString('id-ID')}`
    });

    res.json({ message: 'Pengeluaran berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);

    if (existing) {
      logActivity(req, {
        module: 'PENGELUARAN',
        action_type: 'DELETE',
        target_name: existing.recipient_name,
        period: `${existing.month}/${existing.year}`,
        amount: existing.amount,
        description: `Hapus Pengeluaran: Santunan ${existing.category} untuk ${existing.recipient_name} sebesar Rp ${existing.amount.toLocaleString('id-ID')}`
      });
    }

    res.json({ message: 'Pengeluaran berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

