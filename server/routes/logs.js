const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../auth');

router.use(authMiddleware);

const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// GET /api/logs
router.get('/', (req, res) => {
  const { module, action_type, date_filter, search, page = 1, limit = 50 } = req.query;
  const numLimit = Math.min(Math.max(parseInt(limit) || 50, 10), 200);
  const numPage = Math.max(parseInt(page) || 1, 1);
  const offset = (numPage - 1) * numLimit;

  let query = 'SELECT * FROM activity_logs WHERE 1=1';
  const params = [];

  if (module && module !== 'ALL') {
    query += ' AND module = ?';
    params.push(module);
  }

  if (action_type && action_type !== 'ALL') {
    query += ' AND action_type = ?';
    params.push(action_type);
  }

  if (date_filter === 'TODAY') {
    query += " AND date(created_at) = date('now', 'localtime')";
  } else if (date_filter === '7DAYS') {
    query += " AND created_at >= datetime('now', '-7 days', 'localtime')";
  } else if (date_filter === 'THIS_MONTH') {
    query += " AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')";
  } else if (date_filter && /^\d{4}-\d{2}-\d{2}$/.test(date_filter)) {
    query += ' AND date(created_at) = ?';
    params.push(date_filter);
  }

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query += ' AND (target_name LIKE ? OR description LIKE ? OR user_name LIKE ? OR username LIKE ?)';
    params.push(s, s, s, s);
  }

  // Hitung total data
  const countQuery = `SELECT count(*) as total FROM (${query})`;
  const total = db.prepare(countQuery).get(...params).total;

  // Query paginasi
  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  const logs = db.prepare(query).all(...params, numLimit, offset);

  res.json({
    logs,
    pagination: {
      total,
      page: numPage,
      limit: numLimit,
      totalPages: Math.ceil(total / numLimit)
    }
  });
});

// GET /api/logs/stats - Ringkasan aktivitas audit
router.get('/stats', (req, res) => {
  const todayCount = db.prepare(`
    SELECT count(*) as count FROM activity_logs WHERE date(created_at) = date('now', 'localtime')
  `).get().count;

  const todayIncomeChange = db.prepare(`
    SELECT coalesce(sum(amount), 0) as total FROM activity_logs
    WHERE date(created_at) = date('now', 'localtime') AND module = 'IURAN' AND amount > 0
  `).get().total;

  const todayExpenseChange = db.prepare(`
    SELECT coalesce(sum(amount), 0) as total FROM activity_logs
    WHERE date(created_at) = date('now', 'localtime') AND module = 'PENGELUARAN' AND action_type IN ('CREATE', 'UPDATE')
  `).get().total;

  const totalAllLogs = db.prepare('SELECT count(*) as count FROM activity_logs').get().count;

  // Pengguna paling aktif hari ini
  const activeUser = db.prepare(`
    SELECT user_name, count(*) as actions
    FROM activity_logs
    WHERE date(created_at) = date('now', 'localtime')
    GROUP BY user_id, user_name
    ORDER BY actions DESC
    LIMIT 1
  `).get();

  res.json({
    todayCount,
    todayIncomeChange,
    todayExpenseChange,
    totalAllLogs,
    activeUser: activeUser ? `${activeUser.user_name} (${activeUser.actions} aksi)` : 'Belum ada input hari ini'
  });
});

// DELETE /api/logs/clear - Bersihkan log lebih lama dari 90 hari (khusus admin)
router.delete('/clear', (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya Administrator yang berwenang membersihkan riwayat log' });
  }

  const { days = 90 } = req.body;
  const numDays = Math.max(parseInt(days) || 90, 30);

  const info = db.prepare(`
    DELETE FROM activity_logs WHERE created_at < datetime('now', ? || ' days', 'localtime')
  `).run(`-${numDays}`);

  res.json({
    message: `Berhasil membersihkan ${info.changes} riwayat log yang berusia lebih dari ${numDays} hari.`
  });
});

module.exports = router;

