const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware, teacherOnly } = require('../middleware/auth');

// Get materials by subject (filtered by grade_level for students, or selectable for teachers)
router.get('/subject/:subjectId', authMiddleware, (req, res) => {
  const subjectId = req.params.subjectId;
  const isStudent = req.user.role === 'siswa';
  const gradeFilter = req.query.grade; // optional for teacher

  let query = '';
  let params = [];

  if (isStudent) {
    const sub = db.prepare('SELECT id, name, grade_level FROM subjects WHERE id = ?').get(subjectId);
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Mata pelajaran tidak ditemukan.' });
    }
    const allowedGrades = sub.grade_level.split(',').map(g => g.trim());
    if (!allowedGrades.includes(req.user.grade_level)) {
      return res.status(403).json({
        success: false,
        message: `Mata pelajaran ${sub.name} tidak diajarkan untuk tingkat ${req.user.grade_level}.`
      });
    }

    // Student only sees materials for their own grade level & class
    query = `
      SELECT m.*, u.full_name as author_name, s.name as subject_name, s.code as subject_code
      FROM materials m
      JOIN subjects s ON m.subject_id = s.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.subject_id = ? 
        AND (m.grade_level = ? OR m.grade_level = 'ALL')
        AND (m.target_class = 'ALL' OR m.target_class = ?)
      ORDER BY m.id ASC
    `;
    params = [subjectId, req.user.grade_level, req.user.class_name];
  } else {
    // Teacher sees materials, optionally filtered by grade
    if (gradeFilter && ['X', 'XI', 'XII'].includes(gradeFilter)) {
      query = `
        SELECT m.*, u.full_name as author_name, s.name as subject_name, s.code as subject_code
        FROM materials m
        JOIN subjects s ON m.subject_id = s.id
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.subject_id = ? AND (m.grade_level = ? OR m.grade_level = 'ALL')
        ORDER BY m.grade_level ASC, m.id ASC
      `;
      params = [subjectId, gradeFilter];
    } else {
      query = `
        SELECT m.*, u.full_name as author_name, s.name as subject_name, s.code as subject_code
        FROM materials m
        JOIN subjects s ON m.subject_id = s.id
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.subject_id = ?
        ORDER BY 
          CASE m.grade_level 
            WHEN 'X' THEN 1 
            WHEN 'XI' THEN 2 
            WHEN 'XII' THEN 3 
            ELSE 4 
          END, m.id ASC
      `;
      params = [subjectId];
    }
  }

  const materials = db.prepare(query).all(...params);
  res.json({ success: true, materials });
});

// Get single material
router.get('/:id', authMiddleware, (req, res) => {
  const material = db.prepare(`
    SELECT m.*, s.name as subject_name, s.code as subject_code, u.full_name as author_name
    FROM materials m
    JOIN subjects s ON m.subject_id = s.id
    LEFT JOIN users u ON m.created_by = u.id
    WHERE m.id = ?
  `).get(req.params.id);

  if (!material) {
    return res.status(404).json({ success: false, message: 'Materi pembelajaran tidak ditemukan.' });
  }

  // Access check for students: cannot view materials from different grades
  if (req.user.role === 'siswa' && material.grade_level !== 'ALL' && material.grade_level !== req.user.grade_level) {
    return res.status(403).json({ success: false, message: 'Materi ini khusus untuk tingkat kelas yang berbeda.' });
  }

  res.json({ success: true, material });
});

// Create material (Teacher only)
router.post('/', authMiddleware, teacherOnly, (req, res) => {
  const { subject_id, grade_level, target_class, title, topic, content, video_url, meet_url } = req.body;

  if (!subject_id || !title || !content) {
    return res.status(400).json({ success: false, message: 'Mata pelajaran, judul materi, dan konten wajib diisi.' });
  }

  const stmt = db.prepare(`
    INSERT INTO materials (subject_id, grade_level, target_class, title, topic, content, video_url, meet_url, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    Number(subject_id),
    grade_level || 'ALL',
    target_class || 'ALL',
    title.trim(),
    topic ? topic.trim() : 'Umum',
    content,
    video_url ? video_url.trim() : null,
    meet_url ? meet_url.trim() : null,
    req.user.id
  );

  res.status(201).json({
    success: true,
    message: `Materi pembelajaran berhasil ditambahkan untuk ${grade_level === 'ALL' ? 'Semua Tingkat' : 'Kelas ' + grade_level}.`,
    materialId: result.lastInsertRowid
  });
});

// Delete material (Teacher only)
router.delete('/:id', authMiddleware, teacherOnly, (req, res) => {
  const existing = db.prepare('SELECT id FROM materials WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Materi tidak ditemukan.' });
  }

  db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Materi berhasil dihapus.' });
});

module.exports = router;
