const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

// Get all threads for a subject
router.get('/subject/:subjectId', authMiddleware, (req, res) => {
  const threads = db.prepare(`
    SELECT 
      d.*, 
      u.full_name as author_name, 
      u.role as author_role, 
      u.avatar as author_avatar,
      (SELECT COUNT(*) FROM discussion_replies r WHERE r.discussion_id = d.id) as reply_count
    FROM discussions d
    JOIN users u ON d.user_id = u.id
    WHERE d.subject_id = ?
    ORDER BY d.created_at DESC
  `).all(req.params.subjectId);

  res.json({ success: true, threads });
});

// Get single thread with replies
router.get('/:id', authMiddleware, (req, res) => {
  const thread = db.prepare(`
    SELECT 
      d.*, 
      u.full_name as author_name, 
      u.role as author_role, 
      u.avatar as author_avatar,
      s.name as subject_name
    FROM discussions d
    JOIN users u ON d.user_id = u.id
    JOIN subjects s ON d.subject_id = s.id
    WHERE d.id = ?
  `).get(req.params.id);

  if (!thread) {
    return res.status(404).json({ success: false, message: 'Topik diskusi tidak ditemukan.' });
  }

  const replies = db.prepare(`
    SELECT 
      r.*, 
      u.full_name as author_name, 
      u.role as author_role, 
      u.avatar as author_avatar
    FROM discussion_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.discussion_id = ?
    ORDER BY r.created_at ASC
  `).all(req.params.id);

  res.json({ success: true, thread, replies });
});

// Create new discussion thread
router.post('/', authMiddleware, (req, res) => {
  const { subject_id, title, message } = req.body;

  if (!subject_id || !title || !message) {
    return res.status(400).json({ success: false, message: 'Mata pelajaran, judul, dan pesan wajib diisi.' });
  }

  const result = db.prepare(`
    INSERT INTO discussions (subject_id, user_id, title, message)
    VALUES (?, ?, ?, ?)
  `).run(Number(subject_id), req.user.id, title.trim(), message.trim());

  res.status(201).json({
    success: true,
    message: 'Topik diskusi berhasil dikirim.',
    threadId: result.lastInsertRowid
  });
});

// Reply to a thread
router.post('/:id/reply', authMiddleware, (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Balasan tidak boleh kosong.' });
  }

  const thread = db.prepare('SELECT id FROM discussions WHERE id = ?').get(req.params.id);
  if (!thread) {
    return res.status(404).json({ success: false, message: 'Topik diskusi tidak ditemukan.' });
  }

  db.prepare(`
    INSERT INTO discussion_replies (discussion_id, user_id, message)
    VALUES (?, ?, ?)
  `).run(req.params.id, req.user.id, message.trim());

  res.status(201).json({ success: true, message: 'Balasan berhasil dikirim.' });
});

module.exports = router;
