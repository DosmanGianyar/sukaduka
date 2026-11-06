const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateToken, authMiddleware, hashPassword, comparePassword } = require('../auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const token = generateToken(user);
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  res.json({
    message: 'Login berhasil',
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout berhasil' });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, full_name, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }
  res.json({ user });
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req, res) => {
  const { full_name, current_password, new_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (new_password) {
    if (!current_password || !comparePassword(current_password, user.password_hash)) {
      return res.status(400).json({ error: 'Password lama tidak sesuai' });
    }
    const newHash = hashPassword(new_password);
    db.prepare('UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?').run(
      full_name || user.full_name,
      newHash,
      user.id
    );
  } else {
    db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(
      full_name || user.full_name,
      user.id
    );
  }

  res.json({ message: 'Profil berhasil diperbarui' });
});

// GET /api/auth/users (admin/ketua only)
router.get('/users', authMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, username, full_name, role, created_at FROM users ORDER BY id ASC').all();
  res.json({ users });
});

// POST /api/auth/users (admin/ketua only)
router.post('/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'ketua') {
    return res.status(403).json({ error: 'Hanya Admin atau Ketua yang dapat menambah user' });
  }
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Username, password, dan nama lengkap wajib diisi' });
  }

  try {
    const hash = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `).run(username.trim(), hash, full_name.trim(), role || 'pengurus');

    res.json({ message: 'User berhasil ditambahkan', id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/users/:id
router.put('/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'ketua') {
    return res.status(403).json({ error: 'Hanya Admin atau Ketua yang dapat mengedit user' });
  }
  const { id } = req.params;
  const { full_name, role, password } = req.body;

  try {
    if (password) {
      const hash = hashPassword(password);
      db.prepare('UPDATE users SET full_name = ?, role = ?, password_hash = ? WHERE id = ?').run(
        full_name,
        role,
        hash,
        id
      );
    } else {
      db.prepare('UPDATE users SET full_name = ?, role = ? WHERE id = ?').run(
        full_name,
        role,
        id
      );
    }
    res.json({ message: 'User berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'ketua') {
    return res.status(403).json({ error: 'Hanya Admin atau Ketua yang dapat menghapus user' });
  }
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ message: 'User berhasil dihapus' });
});

module.exports = router;

