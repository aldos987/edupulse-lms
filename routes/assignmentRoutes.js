const express = require('express');
const router = express.Router();
const path = require('path');
const { db } = require('../database');
const { authMiddleware, teacherOnly } = require('../middleware/auth');
const { uploadAssignment } = require('../utils/uploader');

// Get all assignments with grade level separation
router.get('/', authMiddleware, (req, res) => {
  const isStudent = req.user.role === 'siswa';
  const gradeFilter = req.query.grade;
  const classFilter = req.query.class_name;

  if (isStudent) {
    // Student only sees assignments for their own grade level and class
    const query = `
      SELECT 
        a.*, 
        s.name as subject_name, 
        s.code as subject_code,
        s.color as subject_color,
        sub.id as submission_id,
        sub.submitted_at,
        sub.is_late,
        sub.score,
        sub.original_filename as student_file,
        sub.feedback,
        CASE 
          WHEN sub.id IS NULL THEN 'belum'
          WHEN sub.score IS NOT NULL THEN 'dinilai'
          ELSE 'dikumpulkan'
        END as status
      FROM assignments a
      JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN submissions sub ON a.id = sub.assignment_id AND sub.student_id = ?
      WHERE (a.grade_level = ? OR a.grade_level = 'ALL')
        AND (a.target_class = 'ALL' OR a.target_class = ?)
      ORDER BY a.due_date ASC
    `;
    const assignments = db.prepare(query).all(req.user.id, req.user.grade_level, req.user.class_name);
    return res.json({ success: true, assignments });
  } else {
    // Teacher sees assignments, can filter by grade
    let query = `
      SELECT 
        a.*, 
        s.name as subject_name, 
        s.code as subject_code,
        s.color as subject_color,
        (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id) as total_submitted,
        (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id AND sub.score IS NOT NULL) as total_graded,
        (SELECT COUNT(*) FROM users u WHERE u.role = 'siswa' AND (a.grade_level = 'ALL' OR u.grade_level = a.grade_level) AND (a.target_class = 'ALL' OR u.class_name = a.target_class)) as total_target_students
      FROM assignments a
      JOIN subjects s ON a.subject_id = s.id
    `;
    const params = [];

    if (gradeFilter && ['X', 'XI', 'XII'].includes(gradeFilter)) {
      query += ` WHERE (a.grade_level = ? OR a.grade_level = 'ALL')`;
      params.push(gradeFilter);
    }

    query += ` ORDER BY 
      CASE a.grade_level 
        WHEN 'X' THEN 1 
        WHEN 'XI' THEN 2 
        WHEN 'XII' THEN 3 
        ELSE 4 
      END, a.due_date ASC`;

    const assignments = db.prepare(query).all(...params);
    return res.json({ success: true, assignments });
  }
});

// Get single assignment detail
router.get('/:id', authMiddleware, (req, res) => {
  const assignmentId = req.params.id;
  const assignment = db.prepare(`
    SELECT a.*, s.name as subject_name, s.code as subject_code, s.color as subject_color, u.full_name as teacher_name
    FROM assignments a
    JOIN subjects s ON a.subject_id = s.id
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.id = ?
  `).get(assignmentId);

  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Penugasan tidak ditemukan.' });
  }

  // Access check for students
  if (req.user.role === 'siswa') {
    if (assignment.grade_level !== 'ALL' && assignment.grade_level !== req.user.grade_level) {
      return res.status(403).json({ success: false, message: 'Tugas ini bukan untuk tingkat kelas Anda.' });
    }
  }

  // If student, attach their own submission
  let userSubmission = null;
  if (req.user.role === 'siswa') {
    userSubmission = db.prepare(`
      SELECT * FROM submissions 
      WHERE assignment_id = ? AND student_id = ?
    `).get(assignmentId, req.user.id);
  }

  // If teacher, calculate submission statistics
  let stats = null;
  if (req.user.role === 'guru') {
    const totalStudents = db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE role = 'siswa' 
        AND (? = 'ALL' OR grade_level = ?)
        AND (? = 'ALL' OR class_name = ?)
    `).get(assignment.grade_level, assignment.grade_level, assignment.target_class, assignment.target_class).count;

    const submittedCount = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE assignment_id = ?").get(assignmentId).count;
    const gradedCount = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE assignment_id = ? AND score IS NOT NULL").get(assignmentId).count;

    stats = {
      totalStudents,
      submittedCount,
      gradedCount,
      pendingGrading: submittedCount - gradedCount
    };
  }

  res.json({
    success: true,
    assignment,
    userSubmission,
    stats
  });
});

// Create assignment (Teacher only)
router.post('/', authMiddleware, teacherOnly, uploadAssignment.single('attachment'), (req, res) => {
  const { subject_id, grade_level, target_class, title, description, due_date, max_score, allowed_types } = req.body;

  if (!subject_id || !title || !description || !due_date) {
    return res.status(400).json({ success: false, message: 'Mata pelajaran, judul, deskripsi, dan batas waktu wajib diisi.' });
  }

  let attachmentPath = null;
  let originalFilename = null;
  if (req.file) {
    attachmentPath = req.file.filename;
    originalFilename = req.file.originalname;
  }

  const stmt = db.prepare(`
    INSERT INTO assignments (
      subject_id, grade_level, target_class, title, description, due_date, max_score, allowed_types,
      attachment_path, original_filename, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    Number(subject_id),
    grade_level || 'ALL',
    target_class || 'ALL',
    title.trim(),
    description.trim(),
    due_date,
    Number(max_score) || 100,
    allowed_types || 'all',
    attachmentPath,
    originalFilename,
    req.user.id
  );

  res.status(201).json({
    success: true,
    message: `Penugasan berhasil dibuat untuk ${grade_level === 'ALL' ? 'Semua Tingkat' : 'Kelas ' + grade_level}.`,
    assignmentId: result.lastInsertRowid
  });
});

// Get all submissions for an assignment with class filtering (Teacher only)
router.get('/:id/submissions', authMiddleware, teacherOnly, (req, res) => {
  const assignmentId = req.params.id;
  const classFilter = req.query.class_name;

  const assignment = db.prepare('SELECT a.*, s.name as subject_name FROM assignments a JOIN subjects s ON a.subject_id = s.id WHERE a.id = ?').get(assignmentId);
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Penugasan tidak ditemukan.' });
  }

  let query = `
    SELECT 
      u.id as student_id,
      u.full_name as student_name,
      u.username as student_username,
      u.nisn_nip,
      u.grade_level,
      u.class_name,
      u.avatar,
      sub.id as submission_id,
      sub.submitted_at,
      sub.original_filename,
      sub.file_size,
      sub.file_path,
      sub.text_answer,
      sub.external_link,
      sub.is_late,
      sub.score,
      sub.feedback,
      sub.graded_at,
      CASE 
        WHEN sub.id IS NULL THEN 'Belum Mengumpulkan'
        WHEN sub.score IS NOT NULL THEN 'Sudah Dinilai'
        ELSE 'Menunggu Koreksi'
      END as submission_status
    FROM users u
    LEFT JOIN submissions sub ON sub.assignment_id = ? AND sub.student_id = u.id
    WHERE u.role = 'siswa'
  `;
  const params = [assignmentId];

  // Restrict to assignment's target grade level
  if (assignment.grade_level !== 'ALL') {
    query += ` AND u.grade_level = ?`;
    params.push(assignment.grade_level);
  }

  // Filter by specific class if requested
  if (classFilter && classFilter !== 'ALL') {
    query += ` AND u.class_name = ?`;
    params.push(classFilter);
  }

  query += ` ORDER BY u.class_name ASC, u.full_name ASC`;

  const studentsWithSubmissions = db.prepare(query).all(...params);

  res.json({
    success: true,
    assignment,
    submissions: studentsWithSubmissions
  });
});

// Export grades to CSV with class filtering (Teacher only)
router.get('/:id/export-csv', authMiddleware, teacherOnly, (req, res) => {
  const assignmentId = req.params.id;
  const classFilter = req.query.class_name;

  const assignment = db.prepare('SELECT a.*, s.name as subject_name FROM assignments a JOIN subjects s ON a.subject_id = s.id WHERE a.id = ?').get(assignmentId);
  if (!assignment) {
    return res.status(404).send('Penugasan tidak ditemukan.');
  }

  let query = `
    SELECT 
      u.nisn_nip as NISN,
      u.full_name as Nama_Siswa,
      u.class_name as Kelas,
      COALESCE(sub.submitted_at, '-') as Waktu_Kumpul,
      CASE 
        WHEN sub.id IS NULL THEN 'Belum Kumpul'
        WHEN sub.is_late = 1 THEN 'Terlambat'
        ELSE 'Tepat Waktu'
      END as Status_Kumpul,
      COALESCE(sub.score, 0) as Nilai,
      COALESCE(sub.feedback, '-') as Umpan_Balik
    FROM users u
    LEFT JOIN submissions sub ON sub.assignment_id = ? AND sub.student_id = u.id
    WHERE u.role = 'siswa'
  `;
  const params = [assignmentId];

  if (assignment.grade_level !== 'ALL') {
    query += ` AND u.grade_level = ?`;
    params.push(assignment.grade_level);
  }

  if (classFilter && classFilter !== 'ALL') {
    query += ` AND u.class_name = ?`;
    params.push(classFilter);
  }

  query += ` ORDER BY u.class_name ASC, u.full_name ASC`;

  const rows = db.prepare(query).all(...params);

  const headers = ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Waktu Kumpul', 'Status Kumpul', 'Nilai (Maks 100)', 'Catatan Guru'];
  const csvLines = [headers.join(',')];

  rows.forEach((r, idx) => {
    const cleanName = `"${r.Nama_Siswa.replace(/"/g, '""')}"`;
    const cleanFeedback = `"${r.Umpan_Balik.replace(/"/g, '""')}"`;
    csvLines.push([
      idx + 1,
      r.NISN,
      cleanName,
      r.Kelas,
      r.Waktu_Kumpul,
      r.Status_Kumpul,
      r.Nilai,
      cleanFeedback
    ].join(','));
  });

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Rekap_Nilai_${assignment.grade_level}_${assignment.title.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.csv"`);
  res.send(csvContent);
});

// Delete assignment (Teacher only)
router.delete('/:id', authMiddleware, teacherOnly, (req, res) => {
  const existing = db.prepare('SELECT id FROM assignments WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Penugasan tidak ditemukan.' });
  }

  db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Penugasan berhasil dihapus.' });
});

module.exports = router;
