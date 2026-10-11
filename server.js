const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const materialRoutes = require('./routes/materialRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const discussionRoutes = require('./routes/discussionRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const studentRoutes = require('./routes/studentRoutes');
const googleSyncRoutes = require('./routes/googleSyncRoutes');

// Initialize Database & Seeds
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares & Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/google-sync', googleSyncRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'EduPulse LMS (Informatika & KKA PJJ)',
    timestamp: new Date().toISOString()
  });
});

// Multer error handling & generic error middleware
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Ukuran file melebihi batas maksimal (Maks 25MB).' });
    }
    return res.status(400).json({ success: false, message: `Kesalahan unggah file: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message || 'Terjadi kesalahan pada server.' });
  }
  next();
});

// Fallback to index.html for Single Page Application
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 EduPulse LMS - Informatika & KKA (PJJ Tanggap Kabut Asap)`);
  console.log(`🌐 Server aktif dan dapat diakses di: http://localhost:${PORT}`);
  console.log(`👨‍🏫 Akun Guru : guru_infor / guru123`);
  console.log(`🧑‍💻 Akun Siswa: siswa_andi / siswa123`);
  console.log(`================================================================`);
});
