const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware, teacherOnly } = require('../middleware/auth');

// Get current emergency settings
router.get('/status', (req, res) => {
  const settingsRows = db.prepare('SELECT key, value FROM system_settings').all();
  const settings = {};
  settingsRows.forEach(row => {
    settings[row.key] = row.value;
  });

  res.json({
    success: true,
    data: {
      air_quality_index: Number(settings.air_quality_index) || 215,
      air_quality_category: settings.air_quality_category || 'Sangat Tidak Sehat',
      air_quality_location: settings.air_quality_location || 'Stasiun Pemantau Kualitas Udara',
      pjj_announcement: settings.pjj_announcement || 'Status Tanggap Darurat Bencana Asap: PJJ Online.',
      live_meet_link: settings.live_meet_link || 'https://meet.google.com/pjj-infor-kka'
    }
  });
});

// Teacher updates emergency settings
router.post('/status', authMiddleware, teacherOnly, (req, res) => {
  const { air_quality_index, air_quality_category, air_quality_location, pjj_announcement, live_meet_link } = req.body;

  const insertOrUpdate = db.prepare(`
    INSERT OR REPLACE INTO system_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now', 'localtime'))
  `);

  if (air_quality_index !== undefined) insertOrUpdate.run('air_quality_index', String(air_quality_index));
  if (air_quality_category !== undefined) insertOrUpdate.run('air_quality_category', String(air_quality_category));
  if (air_quality_location !== undefined) insertOrUpdate.run('air_quality_location', String(air_quality_location));
  if (pjj_announcement !== undefined) insertOrUpdate.run('pjj_announcement', String(pjj_announcement));
  if (live_meet_link !== undefined) insertOrUpdate.run('live_meet_link', String(live_meet_link));

  res.json({ success: true, message: 'Status tanggap darurat PJJ kabut asap berhasil diperbarui.' });
});

module.exports = router;
