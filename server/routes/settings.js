const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../auth');

router.use(authMiddleware);

// GET /api/settings
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  res.json({ settings });
});

// POST /api/settings
router.post('/', (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'ketua') {
    return res.status(403).json({ error: 'Hanya Admin atau Ketua yang dapat mengubah pengaturan sistem' });
  }

  const {
    school_name,
    leader_name,
    leader_title,
    treasurer_name,
    treasurer_title,
    secretary_name,
    secretary_title,
    default_dues_amount
  } = req.body;

  const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const runUpdate = db.transaction(() => {
    if (school_name !== undefined) updateSetting.run('school_name', school_name);
    if (leader_name !== undefined) updateSetting.run('leader_name', leader_name);
    if (leader_title !== undefined) updateSetting.run('leader_title', leader_title);
    if (treasurer_name !== undefined) updateSetting.run('treasurer_name', treasurer_name);
    if (treasurer_title !== undefined) updateSetting.run('treasurer_title', treasurer_title);
    if (secretary_name !== undefined) updateSetting.run('secretary_name', secretary_name);
    if (secretary_title !== undefined) updateSetting.run('secretary_title', secretary_title);
    if (default_dues_amount !== undefined) updateSetting.run('default_dues_amount', String(default_dues_amount));
  });
  runUpdate();

  res.json({ message: 'Pengaturan berhasil disimpan' });
});

module.exports = router;

