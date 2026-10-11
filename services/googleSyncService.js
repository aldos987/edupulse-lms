const fs = require('fs');
const path = require('path');
const { db, getSetting, setSetting } = require('../database');

/**
 * Service to communicate with Google Sheets & Google Drive via Google Apps Script Webhook
 */
class GoogleSyncService {
  constructor() {
    this.timeoutMs = 15000; // 15s timeout
  }

  getWebhookUrl() {
    return getSetting('google_apps_script_url', '');
  }

  isEnabled() {
    const configured = Boolean(this.getWebhookUrl() && this.getWebhookUrl().trim());
    const enabled = getSetting('google_sync_enabled', '1') === '1';
    return configured && enabled;
  }

  getConfig() {
    const url = this.getWebhookUrl();
    return {
      configured: Boolean(url && url.trim()),
      webhook_url: url || '',
      sync_enabled: getSetting('google_sync_enabled', '1') === '1',
      spreadsheet_url: getSetting('google_spreadsheet_url', ''),
      drive_folder_url: getSetting('google_drive_folder_url', ''),
      last_synced_at: getSetting('google_last_synced_at', null),
      last_status: getSetting('google_last_sync_status', 'Belum pernah disinkronkan')
    };
  }

  saveConfig({ webhook_url, sync_enabled }) {
    if (webhook_url !== undefined) {
      setSetting('google_apps_script_url', (webhook_url || '').trim());
    }
    if (sync_enabled !== undefined) {
      setSetting('google_sync_enabled', sync_enabled ? '1' : '0');
    }
    return this.getConfig();
  }

  /**
   * Internal helper to send payload to Google Apps Script Web App
   */
  async sendPayload(payload, targetUrl = null) {
    const url = targetUrl || this.getWebhookUrl();
    if (!url || !url.trim()) {
      return { success: false, skipped: true, message: 'Google Apps Script URL belum dikonfigurasi.' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow', // Essential for GAS 302 redirects
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Google Apps Script merespons 404 (Not Found). Kemungkinan penyebab: 1. URL yang disalin salah/belum berakhiran "/exec", 2. Skrip belum dideploy (klik Deploy > New deployment > Web app), atau 3. Opsi "Who has access" belum disetel ke "Anyone".');
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('Google Apps Script menolak akses (401/403). Pastikan opsi "Who has access" (Yang memiliki akses) pada deployment disetel ke "Anyone" (Siapa saja).');
        }
        throw new Error(`Google Apps Script merespons dengan HTTP status ${response.status}`);
      }

      const data = await response.json();
      setSetting('google_last_synced_at', new Date().toISOString());
      setSetting('google_last_sync_status', data.success ? 'Sinkronisasi Berhasil' : (data.message || 'Gagal'));
      
      if (data.spreadsheetUrl) setSetting('google_spreadsheet_url', data.spreadsheetUrl);
      if (data.driveFolderUrl) setSetting('google_drive_folder_url', data.driveFolderUrl);

      return data;
    } catch (error) {
      console.warn('[GoogleSyncService Warning]: Gagal menghubungi Google Apps Script:', error.message);
      setSetting('google_last_sync_status', `Koneksi Terputus: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: `Gagal menghubungi Google Apps Script: ${error.message}`
      };
    }
  }

  /**
   * Run background task without blocking main thread
   */
  runInBackground(promiseFn) {
    setImmediate(async () => {
      try {
        await promiseFn();
      } catch (err) {
        console.warn('[GoogleSyncService Background Task Failed]:', err.message);
      }
    });
  }

  /**
   * Test connection to Google Apps Script Web App
   */
  async testConnection(targetUrl = null) {
    const res = await this.sendPayload({ action: 'test' }, targetUrl);
    return res;
  }

  /**
   * Sync single student (includes plain password for admin reference in spreadsheet)
   */
  async syncStudent(student) {
    if (!this.isEnabled()) return { success: false, skipped: true };
    return await this.sendPayload({
      action: 'sync_student',
      student: {
        nisn: student.nisn_nip,
        name: student.full_name,
        grade: student.grade_level,
        class_name: student.class_name,
        plain_password: student.plain_password || student.password || 'sekolah2026',
        is_default_password: student.is_default_password === 1,
        last_login_at: student.last_login_at || '-',
        status: 'Aktif'
      }
    });
  }

  /**
   * Batch sync all students (includes plain password for admin reference in spreadsheet)
   */
  async batchSyncStudents(studentsList = null) {
    if (!this.isEnabled() && !studentsList) return { success: false, skipped: true };
    
    let list = studentsList;
    if (!list) {
      list = db.prepare(`
        SELECT id, nisn_nip, full_name, grade_level, class_name, plain_password, is_default_password, last_login_at 
        FROM users 
        WHERE role = 'siswa' 
        ORDER BY 
          CASE grade_level WHEN 'X' THEN 1 WHEN 'XI' THEN 2 WHEN 'XII' THEN 3 ELSE 4 END,
          class_name, full_name
      `).all();
    }

    const students = list.map(s => ({
      nisn: s.nisn_nip,
      name: s.full_name,
      grade: s.grade_level,
      class_name: s.class_name,
      plain_password: s.plain_password || 'sekolah2026',
      is_default_password: s.is_default_password === 1,
      last_login_at: s.last_login_at || '-',
      status: 'Aktif'
    }));

    return await this.sendPayload({
      action: 'batch_sync_students',
      students
    });
  }

  /**
   * Sync student login event to Google Sheets tab Log_Login_Siswa
   */
  async syncLoginEvent(user, userAgent = '') {
    if (!this.isEnabled() || user.role !== 'siswa') return { success: false, skipped: true };

    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return await this.sendPayload({
      action: 'sync_login',
      login: {
        date: today,
        time: time,
        nisn: user.nisn_nip,
        name: user.full_name,
        grade: user.grade_level,
        class_name: user.class_name,
        is_default_password: user.is_default_password === 1,
        device: userAgent ? userAgent.substring(0, 100) : 'Browser Web'
      }
    });
  }

  /**
   * Sync changed password to Google Sheets tab Data_Siswa
   */
  async syncPasswordChange({ nisn, name, newPassword }) {
    if (!this.isEnabled()) return { success: false, skipped: true };

    return await this.sendPayload({
      action: 'change_student_password',
      data: {
        nisn: nisn,
        name: name,
        new_password: newPassword
      }
    });
  }

  /**
   * Sync attendance record
   */
  async syncAttendance(record) {
    if (!this.isEnabled()) return { success: false, skipped: true };
    return await this.sendPayload({
      action: 'sync_attendance',
      attendance: {
        date: record.date,
        time: record.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        nisn: record.nisn_nip,
        name: record.student_name,
        grade: record.grade_level,
        class_name: record.class_name,
        subject: record.subject_name,
        status: record.status,
        health_notes: record.health_notes || '-'
      }
    });
  }

  /**
   * Batch sync attendance
   */
  async batchSyncAttendance() {
    if (!this.isEnabled()) return { success: false, skipped: true };

    const records = db.prepare(`
      SELECT 
        a.id, a.date, a.status, a.health_notes, a.created_at,
        u.nisn_nip, u.full_name as name, u.grade_level as grade, u.class_name,
        s.name as subject
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      ORDER BY a.date DESC, u.class_name, u.full_name
    `).all();

    return await this.sendPayload({
      action: 'batch_sync_attendance',
      records
    });
  }

  /**
   * Upload submission to Google Drive and record in Google Sheets
   */
  async syncSubmission({ submissionId, physicalFilePath }) {
    if (!this.isEnabled()) return { success: false, skipped: true };

    const sub = db.prepare(`
      SELECT 
        sub.*, 
        u.nisn_nip, u.full_name, u.grade_level, u.class_name,
        a.title as assignment_title, a.id as assignment_id,
        s.name as subject_name
      FROM submissions sub
      JOIN users u ON sub.student_id = u.id
      JOIN assignments a ON sub.assignment_id = a.id
      JOIN subjects s ON a.subject_id = s.id
      WHERE sub.id = ?
    `).get(submissionId);

    if (!sub) return { success: false, message: 'Submission not found' };

    let fileData = null;
    if (physicalFilePath && fs.existsSync(physicalFilePath)) {
      try {
        const fileBuffer = fs.readFileSync(physicalFilePath);
        // If file is below 15MB, send base64 to Google Apps Script
        if (fileBuffer.length <= 15 * 1024 * 1024) {
          const ext = path.extname(physicalFilePath).toLowerCase();
          const mimeTypes = {
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.zip': 'application/zip',
            '.py': 'text/x-python',
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg'
          };

          fileData = {
            filename: `${sub.class_name}_${sub.nisn_nip}_${sub.full_name.replace(/[^a-zA-Z0-9]/g, '_')}_${sub.original_filename || path.basename(physicalFilePath)}`,
            mimeType: mimeTypes[ext] || 'application/octet-stream',
            base64: fileBuffer.toString('base64')
          };
        }
      } catch (err) {
        console.warn('[GoogleSyncService] Gagal membaca berkas untuk upload ke Drive:', err.message);
      }
    }

    const payload = {
      action: 'upload_submission',
      submission: {
        id: sub.id,
        assignment_id: sub.assignment_id,
        assignment_title: sub.assignment_title,
        subject_name: sub.subject_name,
        grade: sub.grade_level,
        class_name: sub.class_name,
        nisn: sub.nisn_nip,
        name: sub.full_name,
        filename: sub.original_filename,
        submitted_at: sub.submitted_at,
        is_late: sub.is_late ? 'Terlambat' : 'Tepat Waktu',
        score: sub.score,
        feedback: sub.feedback,
        text_answer: sub.text_answer || '-',
        external_link: sub.external_link || '-'
      },
      file: fileData
    };

    const result = await this.sendPayload(payload);

    // If Google Drive link was returned, save it back to SQLite
    if (result && result.driveUrl && result.driveUrl !== '-') {
      try {
        db.prepare(`
          UPDATE submissions 
          SET drive_file_url = ?, drive_file_id = ?
          WHERE id = ?
        `).run(result.driveUrl, result.fileId || null, sub.id);
      } catch (e) {
        console.warn('[GoogleSyncService] Error updating drive_file_url in SQLite:', e.message);
      }
    }

    return result;
  }

  /**
   * Sync grade update from teacher
   */
  async syncGrade(submissionId) {
    if (!this.isEnabled()) return { success: false, skipped: true };

    const sub = db.prepare(`
      SELECT 
        sub.*, 
        u.nisn_nip, u.full_name,
        a.title as assignment_title, a.id as assignment_id
      FROM submissions sub
      JOIN users u ON sub.student_id = u.id
      JOIN assignments a ON sub.assignment_id = a.id
      WHERE sub.id = ?
    `).get(submissionId);

    if (!sub) return { success: false, message: 'Submission not found' };

    return await this.sendPayload({
      action: 'sync_grade',
      grade: {
        assignment_id: sub.assignment_id,
        assignment_title: sub.assignment_title,
        nisn: sub.nisn_nip,
        score: sub.score,
        feedback: sub.feedback || '-'
      }
    });
  }

  /**
   * Batch sync all submissions
   */
  async batchSyncSubmissions() {
    if (!this.isEnabled()) return { success: false, skipped: true };

    const submissions = db.prepare(`
      SELECT 
        sub.id, sub.assignment_id, sub.submitted_at, sub.original_filename as filename,
        sub.drive_file_url, sub.external_link, sub.text_answer, sub.is_late, sub.score, sub.feedback,
        u.nisn_nip as nisn, u.full_name as name, u.class_name, u.grade_level as grade,
        a.title as assignment_title,
        s.name as subject_name
      FROM submissions sub
      JOIN users u ON sub.student_id = u.id
      JOIN assignments a ON sub.assignment_id = a.id
      JOIN subjects s ON a.subject_id = s.id
      ORDER BY sub.submitted_at DESC
    `).all();

    return await this.sendPayload({
      action: 'batch_sync_submissions',
      submissions
    });
  }
}

module.exports = new GoogleSyncService();
