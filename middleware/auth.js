const jwt = require('jsonwebtoken');
const { db } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'lms_infor_kka_super_secret_pjj_key_2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      grade_level: user.grade_level,
      class_name: user.class_name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  let token = null;

  // Check Cookies first
  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Autentikasi dibutuhkan. Silakan login terlebih dahulu.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Fetch fresh user data from DB to ensure user is active
    const user = db.prepare('SELECT id, username, full_name, role, nisn_nip, grade_level, class_name, is_default_password, avatar FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Sesi login telah kedaluwarsa atau tidak valid.' });
  }
}

function teacherOnly(req, res, next) {
  if (req.user && req.user.role === 'guru') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Akses ditolak. Fitur ini hanya dapat diakses oleh Guru.' });
}

function studentOnly(req, res, next) {
  if (req.user && req.user.role === 'siswa') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Akses ditolak. Fitur ini hanya untuk Siswa.' });
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authMiddleware,
  teacherOnly,
  studentOnly
};
