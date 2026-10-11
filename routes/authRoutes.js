const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db, SCHOOL_CLASSES } = require('../database');
const { generateToken, authMiddleware } = require('../middleware/auth');
const googleSyncService = require('../services/googleSyncService');

// Get all official classes and student roster summary
router.get('/classes', (req, res) => {
  const students = db.prepare(`
    SELECT id, username, full_name, nisn_nip, grade_level, class_name, avatar, is_default_password
    FROM users 
    WHERE role = 'siswa'
    ORDER BY 
      CASE grade_level 
        WHEN 'X' THEN 1 
        WHEN 'XI' THEN 2 
        WHEN 'XII' THEN 3 
        ELSE 4 
      END, class_name ASC, full_name ASC
  `).all();

  const classesGrouped = {
    'X': SCHOOL_CLASSES['X'].map(cls => ({
      class_name: cls,
      grade_level: 'X',
      students: students.filter(s => s.class_name === cls)
    })),
    'XI': SCHOOL_CLASSES['XI'].map(cls => ({
      class_name: cls,
      grade_level: 'XI',
      students: students.filter(s => s.class_name === cls)
    })),
    'XII': SCHOOL_CLASSES['XII'].map(cls => ({
      class_name: cls,
      grade_level: 'XII',
      students: students.filter(s => s.class_name === cls)
    }))
  };

  res.json({
    success: true,
    classes: classesGrouped,
    default_password: 'sekolah2026'
  });
});

// List demo accounts
router.get('/demo-accounts', (req, res) => {
  const users = db.prepare(`
    SELECT id, username, full_name, role, nisn_nip, grade_level, class_name, is_default_password, avatar 
    FROM users 
    ORDER BY role DESC, 
      CASE grade_level 
        WHEN 'X' THEN 1 
        WHEN 'XI' THEN 2 
        WHEN 'XII' THEN 3 
        ELSE 0 
      END, class_name ASC, id ASC
  `).all();
  res.json({ success: true, users });
});

// Current user profile
router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Login (supports NISN for students or Username/NIP for teachers)
router.post('/login', (req, res) => {
  const { identifier, username, password } = req.body;
  const loginId = (identifier || username || '').trim();

  if (!loginId || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'NISN / Username dan kata sandi wajib diisi.' 
    });
  }

  // Find user by NISN, username, or NIP
  const user = db.prepare(`
    SELECT * FROM users 
    WHERE nisn_nip = ? OR username = ?
  `).get(loginId, loginId);

  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Akun dengan NISN atau Username tersebut tidak ditemukan.' 
    });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ 
      success: false, 
      message: 'Kata sandi tidak sesuai. Jika belum pernah mengganti, gunakan kata sandi default sekolah (sekolah2026).' 
    });
  }

  const token = generateToken(user);

  // Update last_login_at in SQLite
  try {
    db.prepare("UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?").run(user.id);
  } catch (e) {}

  // Trigger Google Sheets sync to Log_Login_Siswa and update Data_Siswa
  if (user.role === 'siswa') {
    googleSyncService.runInBackground(async () => {
      await googleSyncService.syncLoginEvent(user, req.headers['user-agent']);
    });
  }

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  const { password_hash, ...userProfile } = user;
  res.json({
    success: true,
    message: `Selamat datang kembali di Ruang Kelas ${user.class_name}, ${user.full_name}!`,
    token,
    user: userProfile
  });
});

// Change Password (Siswa or Guru)
router.post('/change-password', authMiddleware, (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;

  if (!current_password || !new_password || !confirm_password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Semua kolom kata sandi wajib diisi.' 
    });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Kata sandi baru minimal harus 6 karakter demi keamanan akun Anda.' 
    });
  }

  if (new_password !== confirm_password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Konfirmasi kata sandi baru tidak cocok.' 
    });
  }

  // Get current user password_hash
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  const isMatch = bcrypt.compareSync(current_password, user.password_hash);

  if (!isMatch) {
    return res.status(400).json({ 
      success: false, 
      message: 'Kata sandi saat ini yang Anda masukkan salah.' 
    });
  }

  // Hash new password and set is_default_password = 0, store plain_password for admin reference
  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(new_password, salt);

  db.prepare(`
    UPDATE users 
    SET password_hash = ?, plain_password = ?, is_default_password = 0
    WHERE id = ?
  `).run(newHash, new_password, req.user.id);

  // Sync changed password to Google Sheets tab Data_Siswa
  if (req.user.role === 'siswa') {
    googleSyncService.runInBackground(async () => {
      await googleSyncService.syncPasswordChange({
        nisn: req.user.nisn_nip,
        name: req.user.full_name,
        newPassword: new_password
      });
    });
  }

  res.json({
    success: true,
    message: 'Kata sandi Anda berhasil diperbarui! Silakan gunakan kata sandi baru ini pada login berikutnya.'
  });
});

// Quick demo switch
router.post('/quick-login', (req, res) => {
  const { username, nisn } = req.body;
  const target = (username || nisn || '').trim();

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR nisn_nip = ?').get(target, target);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Pengguna demo tidak ditemukan.' });
  }

  const token = generateToken(user);
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  const { password_hash, ...userProfile } = user;
  res.json({
    success: true,
    message: `Beralih ke akun ${user.full_name} (${user.role.toUpperCase()} - ${user.class_name})`,
    token,
    user: userProfile
  });
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Berhasil keluar dari sistem.' });
});

module.exports = router;
