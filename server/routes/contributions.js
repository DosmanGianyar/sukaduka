const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../auth');

router.use(authMiddleware);

// GET /api/contributions/years
router.get('/years', (req, res) => {
  const years = db.prepare('SELECT DISTINCT year FROM contributions ORDER BY year ASC').all().map(r => r.year);
  if (!years.includes(2026)) years.push(2026);
  res.json({ years });
});

// GET /api/contributions/grid?year=2026
router.get('/grid', (req, res) => {
  const year = parseInt(req.query.year) || 2026;
  const statusFilter = req.query.status || 'ALL';

  let memberQuery = 'SELECT id, member_no, nip, name, type, status, officer_role, join_year, join_month, pensiun_year, pensiun_month FROM members WHERE 1=1';
  const memberParams = [];
  if (statusFilter !== 'ALL') {
    memberQuery += ' AND status = ?';
    memberParams.push(statusFilter);
  }
  memberQuery += " ORDER BY CASE WHEN status = 'PENSIUN' THEN 1 ELSE 0 END ASC, member_no ASC, id ASC";

  const members = db.prepare(memberQuery).all(...memberParams);

  // Ambil data iuran untuk tahun tersebut
  const contribRows = db.prepare(`
    SELECT member_id, month, amount, status, notes
    FROM contributions
    WHERE year = ?
  `).all(year);

  // Buat map: member_id -> { month: { amount, status, notes } }
  const contribMap = new Map();
  for (const c of contribRows) {
    if (!contribMap.has(c.member_id)) {
      contribMap.set(c.member_id, {});
    }
    contribMap.get(c.member_id)[c.month] = {
      amount: c.amount,
      status: c.status,
      notes: c.notes
    };
  }

  // Monthly totals accumulator
  const monthlyTotals = {};
  for (let m = 1; m <= 12; m++) monthlyTotals[m] = 0;
  let grandTotal = 0;

  // Format data grid
  const grid = members.map(m => {
    const mData = contribMap.get(m.id) || {};
    const months = {};
    let memberTotal = 0;

    // Cek apakah pengurus inti (Ketua, Bendahara, Sekretaris)
    // Sesuai aturan: mereka tetap berstatus LUNAS dan ditampilkan 50k,
    // TETAPI uangnya TIDAK PERNAH dijumlahkan ke saldo/total kas!
    const isOfficerExempt = ['KETUA', 'BENDAHARA', 'SEKRETARIS'].includes(m.officer_role);

    for (let month = 1; month <= 12; month++) {
      let cell = mData[month];

      // Cek apakah sebelum mulai masuk / bergabung
      const isBeforeJoin = m.join_year && (
        year < m.join_year ||
        (year === m.join_year && month < m.join_month)
      );

      // Cek apakah pada tahun dan bulan ini anggota sudah pensiun
      const isRetiredThisMonth = m.status === 'PENSIUN' && (
        !m.pensiun_year ||
        year > m.pensiun_year ||
        (year === m.pensiun_year && month >= m.pensiun_month)
      );

      if (isBeforeJoin) {
        cell = {
          amount: 0,
          status: 'BELUM_MASUK',
          notes: `Mulai masuk: ${m.join_month || 1}/${m.join_year || 2026}`
        };
      } else if (!cell) {
        cell = {
          amount: 0,
          status: isRetiredThisMonth ? 'PENSIUN' : 'BELUM',
          notes: isRetiredThisMonth ? `Pensiun (${m.pensiun_month || 1}/${m.pensiun_year || 2023})` : null
        };
      } else if (isRetiredThisMonth && cell.amount === 0) {
        cell.status = 'PENSIUN';
      }

      months[month] = cell;

      // HANYA jumlahkan jika BUKAN pengurus yang bebas iuran kas
      if (cell.status === 'LUNAS' && cell.amount > 0) {
        memberTotal += cell.amount;
        if (!isOfficerExempt) {
          monthlyTotals[month] += cell.amount;
          grandTotal += cell.amount;
        }
      }
    }

    return {
      id: m.id,
      member_no: m.member_no,
      nip: m.nip,
      name: m.name,
      type: m.type,
      status: m.status,
      officer_role: m.officer_role,
      is_officer_exempt: isOfficerExempt,
      join_year: m.join_year,
      join_month: m.join_month,
      pensiun_year: m.pensiun_year,
      pensiun_month: m.pensiun_month,
      months,
      total: memberTotal
    };
  });

  res.json({
    year,
    grid,
    monthlyTotals,
    grandTotal,
    totalMembers: members.length
  });
});

// POST /api/contributions/cell
// Update a single cell in the grid
router.post('/cell', (req, res) => {
  const { member_id, year, month, amount, status, notes } = req.body;
  if (!member_id || !year || !month) {
    return res.status(400).json({ error: 'member_id, year, and month wajib diisi' });
  }

  // Cek apakah bulan sebelum anggota mulai bergabung
  const member = db.prepare('SELECT join_year, join_month, name FROM members WHERE id = ?').get(member_id);
  if (member && member.join_year && (year < member.join_year || (year === member.join_year && month < member.join_month))) {
    return res.status(400).json({
      error: `Tidak dapat menginput iuran: ${member.name} baru mulai bergabung pada bulan ${member.join_month}/${member.join_year}`
    });
  }

  const numAmount = parseFloat(amount) || 0;
  let cellStatus = status;
  if (!cellStatus) {
    cellStatus = numAmount > 0 ? 'LUNAS' : 'BELUM';
  }

  db.prepare(`
    INSERT INTO contributions (member_id, year, month, amount, status, notes, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE)
    ON CONFLICT(member_id, year, month) DO UPDATE SET
      amount = excluded.amount,
      status = excluded.status,
      notes = excluded.notes,
      paid_at = CURRENT_DATE
  `).run(member_id, year, month, numAmount, cellStatus, notes || null);

  res.json({ message: 'Iuran berhasil disimpan', member_id, year, month, amount: numAmount, status: cellStatus });
});

// POST /api/contributions/quick-pay
// Quick toggle or pay Rp 50.000 (or default amount from settings)
router.post('/quick-pay', (req, res) => {
  const { member_id, year, month } = req.body;
  if (!member_id || !year || !month) {
    return res.status(400).json({ error: 'member_id, year, and month wajib diisi' });
  }

  // Cek apakah bulan sebelum anggota mulai bergabung
  const member = db.prepare('SELECT join_year, join_month, name FROM members WHERE id = ?').get(member_id);
  if (member && member.join_year && (year < member.join_year || (year === member.join_year && month < member.join_month))) {
    return res.status(400).json({
      error: `Tidak dapat menginput iuran: ${member.name} baru mulai bergabung pada bulan ${member.join_month}/${member.join_year}`
    });
  }

  const existing = db.prepare(`
    SELECT amount, status FROM contributions WHERE member_id = ? AND year = ? AND month = ?
  `).get(member_id, year, month);

  const defaultDuesSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_dues_amount');
  const defaultAmount = defaultDuesSetting ? parseFloat(defaultDuesSetting.value) || 50000 : 50000;

  let newAmount = defaultAmount;
  let newStatus = 'LUNAS';

  // Toggle jika sudah lunas
  if (existing && existing.status === 'LUNAS' && existing.amount > 0) {
    newAmount = 0;
    newStatus = 'BELUM';
  }

  db.prepare(`
    INSERT INTO contributions (member_id, year, month, amount, status, paid_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_DATE)
    ON CONFLICT(member_id, year, month) DO UPDATE SET
      amount = excluded.amount,
      status = excluded.status,
      paid_at = CURRENT_DATE
  `).run(member_id, year, month, newAmount, newStatus);

  res.json({ message: 'Status iuran berhasil diubah', amount: newAmount, status: newStatus });
});

// POST /api/contributions/batch-month
// Bayar kolektif 1 bulan untuk semua anggota aktif yang sudah bergabung
router.post('/batch-month', (req, res) => {
  const { year, month, amount } = req.body;
  if (!year || !month) {
    return res.status(400).json({ error: 'year dan month wajib diisi' });
  }

  const numYear = parseInt(year);
  const numMonth = parseInt(month);

  const defaultDuesSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_dues_amount');
  const numAmount = amount ? parseFloat(amount) : (defaultDuesSetting ? parseFloat(defaultDuesSetting.value) || 50000 : 50000);

  // Anggota aktif yang sudah bergabung pada atau sebelum bulan ini
  const activeMembers = db.prepare(`
    SELECT id FROM members
    WHERE status = 'AKTIF'
      AND (join_year IS NULL OR join_year < ? OR (join_year = ? AND join_month <= ?))
  `).all(numYear, numYear, numMonth);

  const insertOrUpdate = db.prepare(`
    INSERT INTO contributions (member_id, year, month, amount, status, paid_at)
    VALUES (?, ?, ?, ?, 'LUNAS', CURRENT_DATE)
    ON CONFLICT(member_id, year, month) DO UPDATE SET
      amount = excluded.amount,
      status = 'LUNAS',
      paid_at = CURRENT_DATE
  `);

  const runBatch = db.transaction(() => {
    for (const m of activeMembers) {
      insertOrUpdate.run(m.id, numYear, numMonth, numAmount);
    }
  });
  runBatch();

  res.json({
    message: `Berhasil mengeset iuran bulan ${numMonth}/${numYear} lunas untuk ${activeMembers.length} anggota aktif`,
    count: activeMembers.length,
    amountPerMember: numAmount
  });
});

module.exports = router;

