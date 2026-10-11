const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db, SCHOOL_CLASSES } = require('../database');
const { authMiddleware, teacherOnly } = require('../middleware/auth');
const googleSyncService = require('../services/googleSyncService');

// Get all students (Teacher only, with filter by grade, class, and search query)
router.get('/', authMiddleware, teacherOnly, (req, res) => {
  const { grade, class_name, search } = req.query;

  let query = `
    SELECT id, username, full_name, role, nisn_nip, grade_level, class_name, is_default_password, plain_password, last_login_at, avatar, created_at
    FROM users
    WHERE role = 'siswa'
  `;
  const params = [];

  if (grade && ['X', 'XI', 'XII'].includes(grade)) {
    query += ` AND grade_level = ?`;
    params.push(grade);
  }

  if (class_name && class_name !== 'ALL') {
    query += ` AND class_name = ?`;
    params.push(class_name);
  }

  if (search && search.trim()) {
    query += ` AND (full_name LIKE ? OR nisn_nip LIKE ?)`;
    const searchParam = `%${search.trim()}%`;
    params.push(searchParam, searchParam);
  }

  query += ` ORDER BY 
    CASE grade_level 
      WHEN 'X' THEN 1 
      WHEN 'XI' THEN 2 
      WHEN 'XII' THEN 3 
      ELSE 4 
    END, class_name ASC, full_name ASC
  `;

  const students = db.prepare(query).all(...params);

  // Stats per grade
  const totalStats = {
    total: db.prepare("SELECT count(*) as count FROM users WHERE role = 'siswa'").get().count,
    gradeX: db.prepare("SELECT count(*) as count FROM users WHERE role = 'siswa' AND grade_level = 'X'").get().count,
    gradeXI: db.prepare("SELECT count(*) as count FROM users WHERE role = 'siswa' AND grade_level = 'XI'").get().count,
    gradeXII: db.prepare("SELECT count(*) as count FROM users WHERE role = 'siswa' AND grade_level = 'XII'").get().count
  };

  res.json({
    success: true,
    totalStats,
    students
  });
});

// Add Single Student (Teacher only)
router.post('/', authMiddleware, teacherOnly, (req, res) => {
  const { full_name, nisn, grade_level, class_name, password } = req.body;

  if (!full_name || !nisn || !grade_level || !class_name) {
    return res.status(400).json({ 
      success: false, 
      message: 'Nama lengkap, NISN, Tingkat Kelas, dan Ruang Kelas wajib diisi.' 
    });
  }

  const cleanNisn = nisn.trim();
  const cleanName = full_name.trim();

  // Validate Class belongs to Grade
  if (!SCHOOL_CLASSES[grade_level] || !SCHOOL_CLASSES[grade_level].includes(class_name)) {
    return res.status(400).json({ 
      success: false, 
      message: `Ruang kelas "${class_name}" tidak valid untuk Tingkat ${grade_level}. Pilihan kelas yang tersedia: ${SCHOOL_CLASSES[grade_level]?.join(', ')}.` 
    });
  }

  // Check if NISN already exists
  const existing = db.prepare('SELECT id, full_name, class_name FROM users WHERE nisn_nip = ?').get(cleanNisn);
  if (existing) {
    return res.status(400).json({ 
      success: false, 
      message: `NISN ${cleanNisn} sudah terdaftar atas nama ${existing.full_name} di kelas ${existing.class_name}.` 
    });
  }

  // Generate unique username based on clean name or nisn
  const username = `siswa_${cleanNisn}`;
  const salt = bcrypt.genSaltSync(10);
  const defaultPass = (password && password.trim()) ? password.trim() : 'sekolah2026';
  const passHash = bcrypt.hashSync(defaultPass, salt);

  const avatars = ['🧑‍💻', '👩‍💻', '🧑‍🔬', '👩‍🔬', '🧑‍🎓', '👩‍🎓'];
  const avatar = avatars[Math.floor(Math.random() * avatars.length)];

  const result = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, nisn_nip, grade_level, class_name, is_default_password, plain_password, avatar)
    VALUES (?, ?, ?, 'siswa', ?, ?, ?, 1, ?, ?)
  `).run(username, passHash, cleanName, cleanNisn, grade_level, class_name, defaultPass, avatar);

  // Trigger Google Sheets sync
  googleSyncService.runInBackground(async () => {
    await googleSyncService.syncStudent({
      nisn_nip: cleanNisn,
      full_name: cleanName,
      grade_level,
      class_name,
      plain_password: defaultPass,
      is_default_password: 1
    });
  });

  res.status(201).json({
    success: true,
    message: `Siswa "${cleanName}" berhasil didaftarkan ke Ruang Kelas ${class_name}!`,
    student: {
      id: result.lastInsertRowid,
      nisn: cleanNisn,
      full_name: cleanName,
      class_name,
      grade_level,
      default_password: defaultPass
    }
  });
});

// Batch Import Students (Teacher only - multiple lines: NISN,Nama,Kelas)
router.post('/batch', authMiddleware, teacherOnly, (req, res) => {
  const { studentData } = req.body;

  if (!studentData || !Array.isArray(studentData) || studentData.length === 0) {
    return res.status(400).json({ success: false, message: 'Data siswa tidak boleh kosong.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const defaultPass = 'sekolah2026';
  const passHash = bcrypt.hashSync(defaultPass, salt);
  const avatars = ['🧑‍💻', '👩‍💻', '🧑‍🔬', '👩‍🔬', '🧑‍🎓', '👩‍🎓'];

  const insertStmt = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, nisn_nip, grade_level, class_name, is_default_password, plain_password, avatar)
    VALUES (?, ?, ?, 'siswa', ?, ?, ?, 1, 'sekolah2026', ?)
  `);

  const results = {
    added: 0,
    skipped: 0,
    errors: []
  };

  studentData.forEach((item, idx) => {
    const cleanNisn = (item.nisn || '').trim();
    const cleanName = (item.full_name || item.name || '').trim();
    const cleanClass = (item.class_name || item.kelas || '').trim().toUpperCase();

    if (!cleanNisn || !cleanName || !cleanClass) {
      results.skipped++;
      results.errors.push(`Baris ${idx + 1}: Data tidak lengkap (NISN, Nama, dan Kelas wajib diisi).`);
      return;
    }

    // Determine grade level from class name
    let gradeLevel = 'X';
    if (cleanClass.startsWith('XII')) {
      gradeLevel = 'XII';
    } else if (cleanClass.startsWith('XI')) {
      gradeLevel = 'XI';
    } else if (cleanClass.startsWith('X')) {
      gradeLevel = 'X';
    }

    // Check duplicate
    const exists = db.prepare('SELECT id FROM users WHERE nisn_nip = ?').get(cleanNisn);
    if (exists) {
      results.skipped++;
      results.errors.push(`Baris ${idx + 1}: NISN ${cleanNisn} (${cleanName}) sudah ada di sistem.`);
      return;
    }

    try {
      const username = `siswa_${cleanNisn}`;
      const avatar = avatars[idx % avatars.length];
      insertStmt.run(username, passHash, cleanName, cleanNisn, gradeLevel, cleanClass, avatar);
      results.added++;
    } catch (e) {
      results.skipped++;
      results.errors.push(`Baris ${idx + 1}: Gagal menyimpan - ${e.message}`);
    }
  });

  if (results.added > 0) {
    googleSyncService.runInBackground(async () => {
      await googleSyncService.batchSyncStudents();
    });
  }

  res.json({
    success: true,
    message: `Berhasil menambahkan ${results.added} siswa ke database sekolah! (${results.skipped} dilewati)`,
    results
  });
});

// Reset Student Password back to default 'sekolah2026' (Teacher only)
router.post('/:id/reset-password', authMiddleware, teacherOnly, (req, res) => {
  const student = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'siswa'").get(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const defaultPass = 'sekolah2026';
  const passHash = bcrypt.hashSync(defaultPass, salt);

  db.prepare(`
    UPDATE users 
    SET password_hash = ?, plain_password = 'sekolah2026', is_default_password = 1
    WHERE id = ?
  `).run(passHash, student.id);

  // Sync password reset to Google Sheets tab Data_Siswa
  googleSyncService.runInBackground(async () => {
    await googleSyncService.syncPasswordChange({
      nisn: student.nisn_nip,
      name: student.full_name,
      newPassword: 'sekolah2026'
    });
  });

  res.json({
    success: true,
    message: `Kata sandi siswa ${student.full_name} (${student.class_name}) berhasil direset kembali ke sandi default: "sekolah2026".`
  });
});

// Delete Student (Teacher only)
router.delete('/:id', authMiddleware, teacherOnly, (req, res) => {
  const student = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'siswa'").get(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan.' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(student.id);
  res.json({
    success: true,
    message: `Data siswa ${student.full_name} (${student.class_name}) berhasil dihapus.`
  });
});

module.exports = router;
