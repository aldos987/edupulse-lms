const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const googleSyncService = require('../services/googleSyncService');
const { authMiddleware, teacherOnly } = require('../middleware/auth');

// Get current Google Sync configuration & status
router.get('/config', authMiddleware, teacherOnly, (req, res) => {
  const config = googleSyncService.getConfig();
  res.json({ success: true, config });
});

// Save configuration and optionally test
router.post('/config', authMiddleware, teacherOnly, async (req, res) => {
  const { webhook_url, sync_enabled } = req.body;

  if (webhook_url && !webhook_url.startsWith('https://script.google.com/macros/s/')) {
    return res.status(400).json({
      success: false,
      message: 'Format URL Web App Google Apps Script tidak valid. URL harus diawali dengan: https://script.google.com/macros/s/.../exec'
    });
  }

  const updatedConfig = googleSyncService.saveConfig({ webhook_url, sync_enabled });

  // If a URL was provided and enabled, run a test ping
  let testResult = null;
  if (webhook_url && webhook_url.trim()) {
    testResult = await googleSyncService.testConnection(webhook_url.trim());
  }

  res.json({
    success: true,
    message: testResult && testResult.success 
      ? 'Konfigurasi Google Apps Script berhasil disimpan dan terverifikasi terhubung!'
      : 'Konfigurasi berhasil disimpan.',
    config: googleSyncService.getConfig(),
    testResult
  });
});

// Test current connection
router.post('/test', authMiddleware, teacherOnly, async (req, res) => {
  const { test_url } = req.body || {};
  const result = await googleSyncService.testConnection(test_url || null);
  res.json({
    success: result.success || false,
    message: result.message || (result.success ? 'Koneksi terhubung!' : 'Gagal terhubung ke Google Apps Script.'),
    details: result
  });
});

// Trigger full sync of all 14 classes of students
router.post('/sync-all-students', authMiddleware, teacherOnly, async (req, res) => {
  if (!googleSyncService.isEnabled()) {
    return res.status(400).json({
      success: false,
      message: 'Integrasi Google Sheets belum diaktifkan atau URL belum dikonfigurasi.'
    });
  }

  const result = await googleSyncService.batchSyncStudents();
  res.json(result);
});

// Trigger full sync of attendance recap
router.post('/sync-all-attendance', authMiddleware, teacherOnly, async (req, res) => {
  if (!googleSyncService.isEnabled()) {
    return res.status(400).json({
      success: false,
      message: 'Integrasi Google Sheets belum diaktifkan atau URL belum dikonfigurasi.'
    });
  }

  const result = await googleSyncService.batchSyncAttendance();
  res.json(result);
});

// Trigger full sync of submissions
router.post('/sync-all-submissions', authMiddleware, teacherOnly, async (req, res) => {
  if (!googleSyncService.isEnabled()) {
    return res.status(400).json({
      success: false,
      message: 'Integrasi Google Sheets belum diaktifkan atau URL belum dikonfigurasi.'
    });
  }

  const result = await googleSyncService.batchSyncSubmissions();
  res.json(result);
});

// Get the Google Apps Script code to copy
router.get('/script-code', authMiddleware, teacherOnly, (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '..', 'google-apps-script.js');
    const code = fs.readFileSync(scriptPath, 'utf8');
    res.json({ success: true, code });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membaca file kode Google Apps Script.' });
  }
});

module.exports = router;
