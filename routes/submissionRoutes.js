const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { authMiddleware, teacherOnly, studentOnly } = require('../middleware/auth');
const { uploadSubmission, submissionsDir, assignmentsDir } = require('../utils/uploader');
const googleSyncService = require('../services/googleSyncService');

// Student submits an assignment
router.post('/submit/:assignmentId', authMiddleware, studentOnly, uploadSubmission.single('submission_file'), (req, res) => {
  const assignmentId = req.params.assignmentId;
  const studentId = req.user.id;
  const { text_answer, external_link } = req.body;

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Penugasan tidak ditemukan.' });
  }

  // Check if student provided at least a file, text answer, or external link
  if (!req.file && (!text_answer || !text_answer.trim()) && (!external_link || !external_link.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Harap lampirkan minimal satu bukti pengerjaan: Unggah File tugas, Tulis Kode/Jawaban, atau Lampirkan Tautan (GitHub/Colab).'
    });
  }

  // Calculate is_late
  const now = new Date();
  const dueDate = new Date(assignment.due_date);
  const isLate = now > dueDate ? 1 : 0;

  // Check existing submission
  const existing = db.prepare('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?').get(assignmentId, studentId);

  let filePath = existing ? existing.file_path : null;
  let originalFilename = existing ? existing.original_filename : null;
  let fileSize = existing ? existing.file_size : null;

  if (req.file) {
    // Delete old uploaded file if replacing
    if (existing && existing.file_path) {
      const oldFullPath = path.join(submissionsDir, existing.file_path);
      if (fs.existsSync(oldFullPath)) {
        try { fs.unlinkSync(oldFullPath); } catch (e) { /* ignore */ }
      }
    }
    filePath = req.file.filename;
    originalFilename = req.file.originalname;
    fileSize = req.file.size;
  }

  let subId = null;
  if (existing) {
    // Update existing submission
    db.prepare(`
      UPDATE submissions
      SET submitted_at = datetime('now', 'localtime'),
          file_path = ?,
          original_filename = ?,
          file_size = ?,
          text_answer = ?,
          external_link = ?,
          is_late = ?
      WHERE id = ?
    `).run(
      filePath,
      originalFilename,
      fileSize,
      text_answer ? text_answer.trim() : null,
      external_link ? external_link.trim() : null,
      isLate,
      existing.id
    );
    subId = existing.id;
  } else {
    // Insert new submission
    const insertRes = db.prepare(`
      INSERT INTO submissions (
        assignment_id, student_id, file_path, original_filename, file_size,
        text_answer, external_link, is_late
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assignmentId,
      studentId,
      filePath,
      originalFilename,
      fileSize,
      text_answer ? text_answer.trim() : null,
      external_link ? external_link.trim() : null,
      isLate
    );
    subId = insertRes.lastInsertRowid;
  }

  // Trigger Google Drive & Sheets Sync in background
  const physicalFilePath = filePath ? path.join(submissionsDir, filePath) : null;
  googleSyncService.runInBackground(async () => {
    await googleSyncService.syncSubmission({
      submissionId: subId,
      physicalFilePath
    });
  });

  return res.status(existing ? 200 : 201).json({
    success: true,
    message: isLate 
      ? (existing ? 'Tugas berhasil diperbarui (Status: Terlambat karena melewati batas waktu).' : 'Tugas berhasil dikumpulkan (Status: Terlambat).')
      : (existing ? 'Tugas berhasil diperbarui sebelum batas waktu.' : 'Tugas berhasil dikumpulkan tepat waktu! Hebat!')
  });
});

// Teacher grades a submission
router.post('/grade/:submissionId', authMiddleware, teacherOnly, (req, res) => {
  const submissionId = req.params.submissionId;
  const { score, feedback } = req.body;

  if (score === undefined || score === null || isNaN(score)) {
    return res.status(400).json({ success: false, message: 'Nilai angka wajib diisi (0 - 100).' });
  }

  const numScore = Number(score);
  if (numScore < 0 || numScore > 100) {
    return res.status(400).json({ success: false, message: 'Nilai harus berada dalam rentang 0 hingga 100.' });
  }

  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Data pengumpulan tugas tidak ditemukan.' });
  }

  db.prepare(`
    UPDATE submissions
    SET score = ?,
        feedback = ?,
        graded_at = datetime('now', 'localtime'),
        graded_by = ?
    WHERE id = ?
  `).run(
    numScore,
    feedback ? feedback.trim() : null,
    req.user.id,
    submissionId
  );

  // Trigger Google Sheets Grade Sync in background
  googleSyncService.runInBackground(async () => {
    await googleSyncService.syncGrade(submissionId);
  });

  res.json({
    success: true,
    message: 'Nilai dan umpan balik berhasil disimpan dan diteruskan ke siswa.'
  });
});

// Secure Download for Student Submission
router.get('/download/:submissionId', authMiddleware, (req, res) => {
  const submissionId = req.params.submissionId;
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);

  if (!submission || !submission.file_path) {
    return res.status(404).json({ success: false, message: 'File tidak ditemukan di sistem.' });
  }

  // Access Control: Only the submitting student OR any teacher can download
  if (req.user.role !== 'guru' && req.user.id !== submission.student_id) {
    return res.status(403).json({ success: false, message: 'Anda tidak memiliki hak akses untuk mengunduh berkas siswa lain.' });
  }

  // Prevent directory traversal
  const safeFilename = path.basename(submission.file_path);
  const targetPath = path.resolve(submissionsDir, safeFilename);

  if (!targetPath.startsWith(path.resolve(submissionsDir))) {
    return res.status(400).json({ success: false, message: 'Akses path tidak valid.' });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ success: false, message: 'Berkas fisik tidak ditemukan di penyimpanan server.' });
  }

  res.download(targetPath, submission.original_filename || safeFilename);
});

// Secure Download for Assignment Attachment (Teacher template/rubrik)
router.get('/attachment/:assignmentId', authMiddleware, (req, res) => {
  const assignmentId = req.params.assignmentId;
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);

  if (!assignment || !assignment.attachment_path) {
    return res.status(404).json({ success: false, message: 'Lampiran soal tidak ditemukan.' });
  }

  const safeFilename = path.basename(assignment.attachment_path);
  const targetPath = path.resolve(assignmentsDir, safeFilename);

  if (!targetPath.startsWith(path.resolve(assignmentsDir))) {
    return res.status(400).json({ success: false, message: 'Akses path tidak valid.' });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ success: false, message: 'Berkas lampiran tidak ditemukan.' });
  }

  res.download(targetPath, assignment.original_filename || safeFilename);
});

module.exports = router;
