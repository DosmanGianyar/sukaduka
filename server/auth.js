const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'sukaduka-secret-key-bali-2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak: Silakan login terlebih dahulu' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Sesi habis atau tidak valid: Silakan login ulang' });
  }

  req.user = decoded;
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  verifyToken,
  authMiddleware,
  hashPassword: (pw) => bcrypt.hashSync(pw, 10),
  comparePassword: (pw, hash) => bcrypt.compareSync(pw, hash)
};

