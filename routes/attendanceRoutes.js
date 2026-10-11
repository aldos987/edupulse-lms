const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware, teacherOnly, studentOnly } = require('../middleware/auth');
const googleSyncService = require('../services/googleSyncService');

// Get today's attendance status
router.get('/today', authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const classFilter = req.query.class_name;
  const gradeFilter = req.query.grade;

  if (req.user.role === 'siswa') {
    const records = db.prepare(`
      SELECT a.*, s.name as subject_name, s.code as subject_code
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      WHERE a.student_id = ? AND a.date = ?
    `).all(req.user.id, today);

    return res.json({ success: true, today, records });
  } else {
    // Teacher sees recap for today
    let query = `
      SELECT 
        a.*, 
        u.full_name as student_name, 
        u.nisn_nip, 
        u.grade_level,
        u.class_name,
        s.name as subject_name,
        s.code as subject_code
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      WHERE a.date = ?
    `;
    const params = [today];

    if (gradeFilter && ['X', 'XI', 'XII'].includes(gradeFilter)) {
      query += ` AND u.grade_level = ?`;
      params.push(gradeFilter);
    }
    if (classFilter && classFilter !== 'ALL') {
      query += ` AND u.class_name = ?`;
      params.push(classFilter);
    }

    query += ` ORDER BY u.class_name, u.full_name`;
    const records = db.prepare(query).all(...params);

    return res.json({ success: true, today, records });
  }
});

// Student fills attendance
router.post('/record', authMiddleware, studentOnly, (req, res) => {
  const { subject_id, status, health_notes } = req.body;
  const today = new Date().toISOString().split('T')[0];

  if (!subject_id || !status) {
    return res.status(400).json({ success: false, message: 'Mata pelajaran dan status kehadiran wajib dipilih.' });
  }

  const validStatuses = ['Hadir', 'Sakit', 'Izin'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Status kehadiran tidak valid.' });
  }

  const sub = db.prepare('SELECT id, name, grade_level FROM subjects WHERE id = ?').get(subject_id);
  if (!sub) {
    return res.status(404).json({ success: false, message: 'Mata pelajaran tidak ditemukan.' });
  }
  const allowedGrades = sub.grade_level.split(',').map(g => g.trim());
  if (!allowedGrades.includes(req.user.grade_level)) {
    return res.status(400).json({
      success: false,
      message: `Mata pelajaran ${sub.name} tidak diajarkan untuk tingkat ${req.user.grade_level}.`
    });
  }

  // Trigger background sync to Google Sheets
  googleSyncService.runInBackground(async () => {
    await googleSyncService.syncAttendance({
      date: today,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      nisn_nip: req.user.nisn_nip,
      student_name: req.user.full_name,
      grade_level: req.user.grade_level,
      class_name: req.user.class_name,
      subject_name: sub.name,
      status,
      health_notes
    });
  });

  const existing = db.prepare('SELECT id FROM attendance WHERE student_id = ? AND subject_id = ? AND date = ?').get(req.user.id, subject_id, today);

  if (existing) {
    db.prepare(`
      UPDATE attendance 
      SET status = ?, health_notes = ?
      WHERE id = ?
    `).run(status, health_notes || null, existing.id);

    return res.json({ success: true, message: `Presensi Ruang Kelas ${req.user.class_name} berhasil diperbarui.` });
  } else {
    db.prepare(`
      INSERT INTO attendance (student_id, subject_id, grade_level, class_name, date, status, health_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, Number(subject_id), req.user.grade_level, req.user.class_name, today, status, health_notes || null);

    return res.status(201).json({ success: true, message: `Presensi kehadiran Ruang Kelas ${req.user.class_name} berhasil dicatat.` });
  }
});

// Teacher views full attendance recap
router.get('/recap', authMiddleware, teacherOnly, (req, res) => {
  const classFilter = req.query.class_name;
  const gradeFilter = req.query.grade;

  let query = `
    SELECT 
      a.*, 
      u.full_name as student_name, 
      u.nisn_nip, 
      u.grade_level,
      u.class_name,
      s.name as subject_name,
      s.code as subject_code
    FROM attendance a
    JOIN users u ON a.student_id = u.id
    JOIN subjects s ON a.subject_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (gradeFilter && ['X', 'XI', 'XII'].includes(gradeFilter)) {
    query += ` AND u.grade_level = ?`;
    params.push(gradeFilter);
  }
  if (classFilter && classFilter !== 'ALL') {
    query += ` AND u.class_name = ?`;
    params.push(classFilter);
  }

  query += ` ORDER BY a.date DESC, u.class_name, u.full_name`;
  const records = db.prepare(query).all(...params);

  res.json({ success: true, records });
});

module.exports = router;
