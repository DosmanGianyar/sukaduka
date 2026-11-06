const db = require('./db');

// Inisialisasi tabel activity_logs
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    user_name TEXT,
    user_role TEXT,
    module TEXT NOT NULL,         -- 'IURAN', 'PENGELUARAN', 'ANGGOTA', 'AUTH', 'SISTEM'
    action_type TEXT NOT NULL,    -- 'TOGGLE', 'SET_CELL', 'BATCH_PAY', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
    target_name TEXT,             -- Nama anggota atau pihak terkait
    period TEXT,                  -- 'Januari 2026', 'Tahun 2026', dll
    amount REAL DEFAULT 0,        -- Nominal yang terpengaruh
    description TEXT NOT NULL,    -- Penjelasan detail yang mudah dibaca
    details_json TEXT,            -- Data JSON sebelum/sesudah perubahan jika ada
    ip_address TEXT,
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
  CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action_type);
`);

function getClientIp(req) {
  if (!req) return null;
  const forwarded = req.headers ? req.headers['x-forwarded-for'] : null;
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || null;
}

function logActivity(req, { module, action_type, target_name, period, amount = 0, description, details_json = null }) {
  try {
    const user = req?.user || {};
    const ip = getClientIp(req);

    const stmt = db.prepare(`
      INSERT INTO activity_logs (
        user_id, username, user_name, user_role,
        module, action_type, target_name, period,
        amount, description, details_json, ip_address, created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, datetime('now', 'localtime')
      )
    `);

    stmt.run(
      user.id || null,
      user.username || 'system',
      user.full_name || user.username || 'Sistem',
      user.role || null,
      module,
      action_type,
      target_name || null,
      period || null,
      amount || 0,
      description,
      typeof details_json === 'object' && details_json !== null ? JSON.stringify(details_json) : details_json,
      ip
    );
  } catch (err) {
    console.error('Gagal mencatat log aktivitas:', err);
  }
}

module.exports = {
  logActivity
};

