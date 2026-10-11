const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

// Get all subjects (filtered by student grade level if student, or all/filtered for teacher)
router.get('/', authMiddleware, (req, res) => {
  const isStudent = req.user.role === 'siswa';
  const gradeQuery = req.query.grade;

  let query = `
    SELECT s.*, u.full_name as teacher_name,
      (SELECT COUNT(*) FROM materials m WHERE m.subject_id = s.id AND (m.grade_level = ? OR ? = 'GURU')) as material_count,
      (SELECT COUNT(*) FROM assignments a WHERE a.subject_id = s.id AND (a.grade_level = ? OR ? = 'GURU')) as assignment_count
    FROM subjects s
    LEFT JOIN users u ON s.teacher_id = u.id
  `;
  const params = [
    isStudent ? req.user.grade_level : 'GURU',
    isStudent ? req.user.grade_level : 'GURU',
    isStudent ? req.user.grade_level : 'GURU',
    isStudent ? req.user.grade_level : 'GURU'
  ];

  if (isStudent) {
    // If student:
    // - Kelas X -> gets Informatika & KKA (grade_level = 'X')
    // - Kelas XI -> gets Mulok (Informatika) (grade_level = 'XI,XII')
    // - Kelas XII -> gets Mulok (Informatika) (grade_level = 'XI,XII')
    query += ` WHERE instr(',' || s.grade_level || ',', ',' || ? || ',') > 0`;
    params.push(req.user.grade_level);
  } else if (gradeQuery && ['X', 'XI', 'XII'].includes(gradeQuery)) {
    query += ` WHERE instr(',' || s.grade_level || ',', ',' || ? || ',') > 0`;
    params.push(gradeQuery);
  }

  query += ` ORDER BY s.id ASC`;

  const subjects = db.prepare(query).all(...params);
  res.json({ success: true, subjects });
});

// Get subject details
router.get('/:id', authMiddleware, (req, res) => {
  const subjectId = req.params.id;
  const isStudent = req.user.role === 'siswa';

  const subject = db.prepare(`
    SELECT s.*, u.full_name as teacher_name
    FROM subjects s
    LEFT JOIN users u ON s.teacher_id = u.id
    WHERE s.id = ?
  `).get(subjectId);

  if (!subject) {
    return res.status(404).json({ success: false, message: 'Mata pelajaran tidak ditemukan.' });
  }

  // Student grade security check
  if (isStudent) {
    const allowedGrades = subject.grade_level.split(',').map(g => g.trim());
    if (!allowedGrades.includes(req.user.grade_level)) {
      return res.status(403).json({
        success: false,
        message: `Mata pelajaran ${subject.name} tidak tersedia untuk siswa tingkat ${req.user.grade_level}.`
      });
    }
  }

  let matQuery = 'SELECT * FROM materials WHERE subject_id = ?';
  let matParams = [subjectId];
  if (isStudent) {
    matQuery += ' AND (grade_level = ? OR grade_level = \'ALL\') AND (target_class = \'ALL\' OR target_class = ?)';
    matParams.push(req.user.grade_level, req.user.class_name);
  }
  matQuery += ' ORDER BY id ASC';

  let assignQuery = 'SELECT * FROM assignments WHERE subject_id = ?';
  let assignParams = [subjectId];
  if (isStudent) {
    assignQuery += ' AND (grade_level = ? OR grade_level = \'ALL\') AND (target_class = \'ALL\' OR target_class = ?)';
    assignParams.push(req.user.grade_level, req.user.class_name);
  }
  assignQuery += ' ORDER BY due_date ASC';

  const materials = db.prepare(matQuery).all(...matParams);
  const assignments = db.prepare(assignQuery).all(...assignParams);

  res.json({
    success: true,
    subject,
    materials,
    assignments
  });
});

module.exports = router;

