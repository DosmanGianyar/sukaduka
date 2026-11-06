const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../auth');
const { logActivity } = require('../logger');

// All member routes require auth
router.use(authMiddleware);

// GET /api/members
router.get('/', (req, res) => {
  const { search, status, type } = req.query;
  let query = 'SELECT * FROM members WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR nip LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (status && status !== 'SEMUA') {
    query += ' AND status = ?';
    params.push(status);
  }

  if (type && type !== 'SEMUA') {
    query += ' AND type = ?';
    params.push(type);
  }

  query += " ORDER BY CASE WHEN status = 'PENSIUN' THEN 1 ELSE 0 END ASC, member_no ASC, id ASC";

  const members = db.prepare(query).all(...params);
  res.json({ members });
});

// GET /api/members/:id
router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) {
    return res.status(404).json({ error: 'Anggota tidak ditemukan' });
  }

  // Riwayat iuran
  const contributions = db.prepare(`
    SELECT * FROM contributions WHERE member_id = ? ORDER BY year DESC, month ASC
  `).all(req.params.id);

  // Riwayat pengeluaran/santunan yang pernah diterima
  const expenses = db.prepare(`
    SELECT * FROM expenses WHERE member_id = ? ORDER BY date DESC
  `).all(req.params.id);

  res.json({ member, contributions, expenses });
});

// POST /api/members
router.post('/', (req, res) => {
  const { member_no, nip, name, type, status, join_year, join_month, pensiun_year, pensiun_month, phone, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama anggota wajib diisi' });
  }

  // Jika member_no kosong, cari no tertinggi + 1
  let nextNo = member_no;
  if (!nextNo) {
    const maxNo = db.prepare('SELECT MAX(member_no) as max_no FROM members').get();
    nextNo = (maxNo && maxNo.max_no) ? maxNo.max_no + 1 : 1;
  }

  const jYear = parseInt(join_year) || new Date().getFullYear();
  const jMonth = parseInt(join_month) || 1;
  const pYear = status === 'PENSIUN' ? (parseInt(pensiun_year) || new Date().getFullYear()) : null;
  const pMonth = status === 'PENSIUN' ? (parseInt(pensiun_month) || 1) : null;

  try {
    const result = db.prepare(`
      INSERT INTO members (member_no, nip, name, type, status, join_year, join_month, pensiun_year, pensiun_month, phone, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nextNo,
      nip ? nip.trim() : null,
      name.trim(),
      type || 'GURU',
      status || 'AKTIF',
      jYear,
      jMonth,
      pYear,
      pMonth,
      phone ? phone.trim() : null,
      notes ? notes.trim() : null
    );

    const newId = result.lastInsertRowid;

    // Siapkan slot iuran tahun berjalan
    const currentYear = new Date().getFullYear();
    const insertContrib = db.prepare(`
      INSERT OR IGNORE INTO contributions (member_id, year, month, amount, status)
      VALUES (?, ?, ?, 0, ?)
    `);
    const initContrib = db.transaction(() => {
      for (let m = 1; m <= 12; m++) {
        let mStatus = 'BELUM';
        if (currentYear < jYear || (currentYear === jYear && m < jMonth)) {
          mStatus = 'BELUM_MASUK';
        } else if (status === 'PENSIUN' && (currentYear > pYear || (currentYear === pYear && m >= pMonth))) {
          mStatus = 'PENSIUN';
        }
        insertContrib.run(newId, currentYear, m, mStatus);
      }
    });
    initContrib();

    logActivity(req, {
      module: 'ANGGOTA',
      action_type: 'CREATE',
      target_name: name.trim(),
      period: `Mulai ${jMonth}/${jYear}`,
      description: `Tambah Anggota Baru: ${name.trim()} (${type}, Status: ${status})`
    });

    res.json({ message: 'Anggota berhasil ditambahkan', id: newId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/members/:id
router.put('/:id', (req, res) => {
  const { member_no, nip, name, type, status, join_year, join_month, pensiun_year, pensiun_month, phone, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama anggota wajib diisi' });
  }

  const jYear = parseInt(join_year) || 2022;
  const jMonth = parseInt(join_month) || 1;
  const pYear = status === 'PENSIUN' ? (parseInt(pensiun_year) || new Date().getFullYear()) : null;
  const pMonth = status === 'PENSIUN' ? (parseInt(pensiun_month) || 1) : null;

  try {
    db.prepare(`
      UPDATE members
      SET member_no = ?, nip = ?, name = ?, type = ?, status = ?, join_year = ?, join_month = ?, pensiun_year = ?, pensiun_month = ?, phone = ?, notes = ?
      WHERE id = ?
    `).run(
      member_no,
      nip ? nip.trim() : null,
      name.trim(),
      type,
      status,
      jYear,
      jMonth,
      pYear,
      pMonth,
      phone ? phone.trim() : null,
      notes ? notes.trim() : null,
      req.params.id
    );

    // Update bulan-bulan sebelum mulai masuk menjadi BELUM_MASUK
    if (jYear && jMonth) {
      db.prepare(`
        UPDATE contributions
        SET status = 'BELUM_MASUK', amount = 0
        WHERE member_id = ?
          AND (year < ? OR (year = ? AND month < ?))
      `).run(req.params.id, jYear, jYear, jMonth);
    }

    // Jika diubah menjadi PENSIUN, otomatis perbarui status iuran mulai bulan/tahun pensiun
    if (status === 'PENSIUN' && pYear && pMonth) {
      db.prepare(`
        UPDATE contributions
        SET status = 'PENSIUN', amount = 0
        WHERE member_id = ?
          AND (year > ? OR (year = ? AND month >= ?))
      `).run(req.params.id, pYear, pYear, pMonth);
    }

    logActivity(req, {
      module: 'ANGGOTA',
      action_type: 'UPDATE',
      target_name: name.trim(),
      period: `Status: ${status}`,
      description: `Edit Data Anggota: ${name.trim()} (${type}, Status: ${status})`
    });

    res.json({ message: 'Data anggota berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/members/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT name FROM members WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);

    if (existing) {
      logActivity(req, {
        module: 'ANGGOTA',
        action_type: 'DELETE',
        target_name: existing.name,
        description: `Hapus Anggota: Menghapus data anggota ${existing.name} beserta seluruh riwayat iurannya`
      });
    }

    res.json({ message: 'Anggota dan riwayat iuran terkait berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

