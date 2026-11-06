const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'sukaduka.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance and concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'pengurus',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_no INTEGER,
    nip TEXT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'GURU',
    status TEXT DEFAULT 'AKTIF',
    officer_role TEXT,
    join_year INTEGER DEFAULT 2022,
    join_month INTEGER DEFAULT 1,
    pensiun_year INTEGER,
    pensiun_month INTEGER,
    phone TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'LUNAS',
    paid_at DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, year, month)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_no INTEGER,
    date DATE NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    period_label TEXT,
    recipient_name TEXT NOT NULL,
    member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    section TEXT DEFAULT 'Pengeluaran',
    amount REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_contrib_year_month ON contributions(year, month);
  CREATE INDEX IF NOT EXISTS idx_contrib_member ON contributions(member_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_year_month ON expenses(year, month);
`);

// Auto-migrate new columns if missing
try {
  db.exec('ALTER TABLE members ADD COLUMN officer_role TEXT;');
} catch (e) {}
try {
  db.exec('ALTER TABLE members ADD COLUMN join_year INTEGER DEFAULT 2022;');
} catch (e) {}
try {
  db.exec('ALTER TABLE members ADD COLUMN join_month INTEGER DEFAULT 1;');
} catch (e) {}
try {
  db.exec('ALTER TABLE members ADD COLUMN pensiun_year INTEGER;');
} catch (e) {}
try {
  db.exec('ALTER TABLE members ADD COLUMN pensiun_month INTEGER;');
} catch (e) {}

module.exports = db;

