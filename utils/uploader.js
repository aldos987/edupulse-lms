const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload folders exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const assignmentsDir = path.join(uploadsDir, 'assignments');
const submissionsDir = path.join(uploadsDir, 'submissions');

[uploadsDir, assignmentsDir, submissionsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Whitelist extensions
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.zip', '.rar', '.7z',
  '.py', '.ipynb', '.java', '.cpp', '.c',
  '.html', '.css', '.js', '.json',
  '.png', '.jpg', '.jpeg', '.txt', '.csv'
]);

// Storage for assignment attachments (Guru)
const assignmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, assignmentsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `tugas_${uniqueSuffix}_${cleanBase}${ext}`);
  }
});

// Storage for student submissions (Siswa)
const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, submissionsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `sub_${req.user ? req.user.id : 'anon'}_${uniqueSuffix}_${cleanBase}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipe file "${ext}" tidak diizinkan. Ekstensi yang diperbolehkan: PDF, DOCX, ZIP, RAR, Python (.py, .ipynb), Gambar (PNG/JPG), Kode Web (.html/.js), TXT, CSV.`));
  }
};

const uploadAssignment = multer({
  storage: assignmentStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter
});

const uploadSubmission = multer({
  storage: submissionStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter
});

module.exports = {
  uploadsDir,
  assignmentsDir,
  submissionsDir,
  uploadAssignment,
  uploadSubmission
};
