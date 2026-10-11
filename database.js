const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'lms.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for high performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Define the 14 official classes
const SCHOOL_CLASSES = {
  'X': ['X.1', 'X.2', 'X.3', 'X.4', 'X.5'],
  'XI': ['XI.1', 'XI.2', 'XI.3', 'XI.4', 'XI.5'],
  'XII': ['XII.1', 'XII.2', 'XII.3', 'XII.4']
};

function initDatabase() {
  // Create tables with grade_level, target_class, and is_default_password support
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT CHECK(role IN ('guru', 'siswa')) NOT NULL,
      nisn_nip TEXT UNIQUE NOT NULL,
      grade_level TEXT NOT NULL,
      class_name TEXT NOT NULL,
      is_default_password INTEGER DEFAULT 1,
      plain_password TEXT DEFAULT 'sekolah2026',
      last_login_at TEXT,
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      grade_level TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      teacher_id INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      grade_level TEXT NOT NULL,
      target_class TEXT DEFAULT 'ALL',
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      content TEXT NOT NULL,
      file_path TEXT,
      original_filename TEXT,
      video_url TEXT,
      meet_url TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      grade_level TEXT NOT NULL,
      target_class TEXT DEFAULT 'ALL',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      due_date TEXT NOT NULL,
      max_score INTEGER DEFAULT 100,
      allowed_types TEXT DEFAULT 'all',
      attachment_path TEXT,
      original_filename TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      submitted_at TEXT DEFAULT (datetime('now', 'localtime')),
      file_path TEXT,
      original_filename TEXT,
      file_size INTEGER,
      text_answer TEXT,
      external_link TEXT,
      is_late INTEGER DEFAULT 0,
      score REAL,
      feedback TEXT,
      graded_at TEXT,
      graded_by INTEGER,
      UNIQUE(assignment_id, student_id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      grade_level TEXT NOT NULL,
      class_name TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT CHECK(status IN ('Hadir', 'Sakit', 'Izin')) NOT NULL,
      health_notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(student_id, subject_id, date),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS discussions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      grade_level TEXT NOT NULL,
      target_class TEXT DEFAULT 'ALL',
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS discussion_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discussion_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Safe migration for submissions Google Drive integration columns
  try { db.exec('ALTER TABLE submissions ADD COLUMN drive_file_url TEXT;'); } catch (e) {}
  try { db.exec('ALTER TABLE submissions ADD COLUMN drive_file_id TEXT;'); } catch (e) {}

  // Safe migration for users plain_password (for admin lookup) and last_login_at
  try { db.exec("ALTER TABLE users ADD COLUMN plain_password TEXT DEFAULT 'sekolah2026';"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT;"); } catch (e) {}
  try {
    db.exec("UPDATE users SET plain_password = 'sekolah2026' WHERE plain_password IS NULL AND role = 'siswa';");
    db.exec("UPDATE users SET plain_password = 'guru123' WHERE plain_password IS NULL AND role = 'guru';");
  } catch (e) {}

  seedInitialData();
}

function seedInitialData() {
  // Check if we need to seed or re-seed (ensure MULOK_INFOR is present)
  let mulokExists = 0;
  try {
    mulokExists = db.prepare("SELECT count(*) as count FROM subjects WHERE code = 'MULOK_INFOR'").get().count;
  } catch (e) {
    mulokExists = 0;
  }
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount >= 15 && mulokExists > 0) {
    return; // Already seeded with 14 classes, teacher, and Mulok Informatika
  }

  console.log('Seeding curriculum data: Kelas X (Informatika & KKA), Kelas XI & XII (Mulok Informatika)...');

  // Clear older data to avoid conflicts
  db.exec(`
    DELETE FROM submissions;
    DELETE FROM assignments;
    DELETE FROM materials;
    DELETE FROM subjects;
    DELETE FROM attendance;
    DELETE FROM discussion_replies;
    DELETE FROM discussions;
    DELETE FROM users;
  `);

  const salt = bcrypt.genSaltSync(10);
  const teacherHash = bcrypt.hashSync('guru123', salt);
  const globalStudentHash = bcrypt.hashSync('sekolah2026', salt); // Default global password

  // Insert Teacher
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, nisn_nip, grade_level, class_name, is_default_password, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const teacher = insertUser.run(
    'guru_infor',
    teacherHash,
    'Aldo Sapriansyah, S.Kom., Gr.',
    'guru',
   'NIY.Y223188',
    'GURU',
    'Guru Mapel Informatika, KKA & Mulok',
    0,
    '👨‍🏫'
  );
  const teacherId = teacher.lastInsertRowid;

  // Insert Students for all 14 classes
  // Format NISN: X (008...), XI (007...), XII (006...)
  const studentSeeds = [
    // Kelas X: X.1 s/d X.5
    { uname: 'siswa_x1', nisn: '0081010001', name: 'Andi Pratama Wijaya', grade: 'X', cls: 'X.1', av: '🧑‍💻' },
    { uname: 'siswa_x2', nisn: '0081020002', name: 'Budi Santoso', grade: 'X', cls: 'X.2', av: '🧑‍🔬' },
    { uname: 'siswa_x3', nisn: '0081030003', name: 'Cantika Dewi Lestari', grade: 'X', cls: 'X.3', av: '👩‍💻' },
    { uname: 'siswa_x4', nisn: '0081040004', name: 'Dimas Anggara Putra', grade: 'X', cls: 'X.4', av: '🧑‍🎓' },
    { uname: 'siswa_x5', nisn: '0081050005', name: 'Eka Rahmawati Putri', grade: 'X', cls: 'X.5', av: '👩‍🔬' },

    // Kelas XI: XI.1 s/d XI.5
    { uname: 'siswa_xi1', nisn: '0072010001', name: 'Fajar Nugraha Pratama', grade: 'XI', cls: 'XI.1', av: '🧑‍💻' },
    { uname: 'siswa_xi2', nisn: '0072020002', name: 'Gita Permata Sari', grade: 'XI', cls: 'XI.2', av: '👩‍💻' },
    { uname: 'siswa_xi3', nisn: '0072030003', name: 'Hendra Wijaya Kusuma', grade: 'XI', cls: 'XI.3', av: '🧑‍🔬' },
    { uname: 'siswa_xi4', nisn: '0072040004', name: 'Intan Maharani Putri', grade: 'XI', cls: 'XI.4', av: '👩‍🎓' },
    { uname: 'siswa_xi5', nisn: '0072050005', name: 'Joko Prasetyo Utomo', grade: 'XI', cls: 'XI.5', av: '🧑‍🎓' },

    // Kelas XII: XII.1 s/d XII.4
    { uname: 'siswa_xii1', nisn: '0063010001', name: 'Kevin Sanjaya Wardhana', grade: 'XII', cls: 'XII.1', av: '🧑‍💻' },
    { uname: 'siswa_xii2', nisn: '0063020002', name: 'Larasati Ayu Ningrum', grade: 'XII', cls: 'XII.2', av: '👩‍💻' },
    { uname: 'siswa_xii3', nisn: '0063030003', name: 'Maulana Malik Ibrahim', grade: 'XII', cls: 'XII.3', av: '🧑‍🔬' },
    { uname: 'siswa_xii4', nisn: '0063040004', name: 'Nadya Zafira Ramadhani', grade: 'XII', cls: 'XII.4', av: '👩‍🎓' }
  ];

  const studentMap = {};
  studentSeeds.forEach(s => {
    const res = insertUser.run(
      s.uname,
      globalStudentHash,
      s.name,
      'siswa',
      s.nisn,
      s.grade,
      s.cls,
      1, // is_default_password = 1 (can be changed by student)
      s.av
    );
    studentMap[s.uname] = res.lastInsertRowid;
  });

  // Insert Subjects:
  // - Kelas X: Informatika dan KKA
  // - Kelas XI & XII: Mulok (Informatika)
  const insertSubject = db.prepare(`
    INSERT INTO subjects (code, name, grade_level, description, icon, color, teacher_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Mapel 1: Informatika (Khusus Kelas X / Fase E)
  const inforSub = insertSubject.run(
    'INFOR',
    'Informatika',
    'X',
    'Mata Pelajaran Wajib Kelas X: Berpikir Komputasional, Algoritma Pemrograman, Analisis Data, Jaringan Komputer, dan Dampak Sosial Informatika.',
    '💻',
    '#3b82f6',
    teacherId
  );

  // Mapel 2: KKA - Koding dan Kecerdasan Artifisial (Khusus Kelas X / Fase E)
  const kkaSub = insertSubject.run(
    'KKA',
    'KKA (Koding dan Kecerdasan Artifisial)',
    'X',
    'Mata Pelajaran Pilihan Kelas X: Dasar Pemrograman Python, Logika Algoritma Cerdas, Model Machine Learning, Pemantauan ISPU & Etika AI.',
    '🤖',
    '#8b5cf6',
    teacherId
  );

  // Mapel 3: Mulok (Informatika) (Khusus Kelas XI & XII / Fase F & F Lanjut)
  const mulokSub = insertSubject.run(
    'MULOK_INFOR',
    'Mulok (Informatika)',
    'XI,XII',
    'Mata Pelajaran Muatan Lokal Kelas XI & XII: Basis Data Relasional, Rekayasa Perangkat Lunak, RESTful API, Cyber Security, Deep Learning & Proyek Software.',
    '🌐',
    '#0ea5e9',
    teacherId
  );

  // Insert System Settings (Kabut Asap PJJ)
  const insertSetting = db.prepare(`
    INSERT OR REPLACE INTO system_settings (key, value)
    VALUES (?, ?)
  `);

  insertSetting.run('air_quality_index', '215');
  insertSetting.run('air_quality_category', 'Sangat Tidak Sehat');
  insertSetting.run('air_quality_location', 'Stasiun Pemantau Kualitas Udara Sekolah');
  insertSetting.run('pjj_announcement', 'PEMBERITAHUAN DARURAT PJJ: Kondisi kabut asap tebal (ISPU 215). Seluruh KBM kelas X (X.1-X.5), XI (XI.1-XI.5), dan XII (XII.1-XII.4) dilaksanakan PJJ penuh secara daring. Wajib gunakan masker dan tetap berada di dalam ruangan.');
  insertSetting.run('live_meet_link', 'https://meet.google.com/pjj-infor-kka');
  insertSetting.run('global_default_password', 'sekolah2026');

  // Insert Materials Separated by Grade Level & Subjects
  const insertMaterial = db.prepare(`
    INSERT INTO materials (subject_id, grade_level, target_class, title, topic, content, video_url, meet_url, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // --- KELAS X (2 Mapel: Informatika & KKA) ---
  insertMaterial.run(
    inforSub.lastInsertRowid,
    'X',
    'ALL',
    '[Kelas X] Modul 1: Berpikir Komputasional & Dekomposisi Sistem Alarm Asap',
    'Berpikir Komputasional',
    `### Berpikir Komputasional (Fase E - Kelas X)

Empat pilar pemecahan masalah komputasi dalam mitigasi kabut asap:
1. **Dekomposisi**: Membagi masalah bencana kabut asap menjadi: sensor deteksi, pengolah ambang batas, dan broadcast peringatan.
2. **Pengenalan Pola**: Mengamati grafik peningkatan partikulat PM2.5 pada jam-jam tertentu.
3. **Abstraksi**: Mengabaikan data cuaca tidak relevan dan fokus pada angka konsentrasi debu asap.
4. **Perancangan Algoritma**: Menyusun alur keputusan peringatan dini (IF-THEN).`,
    'https://www.youtube.com/watch?v=mUXo-S7gkds',
    'https://meet.google.com/pjj-kelas-x',
    teacherId
  );

  insertMaterial.run(
    kkaSub.lastInsertRowid,
    'X',
    'ALL',
    '[Kelas X] Modul 1: Dasar Pemrograman Python & Logika Kondisi ISPU',
    'Dasar Python AI',
    `### Dasar Pemrograman Python (Fase E - Kelas X)

Python adalah gerbang utama dalam mempelajari Koding dan Kecerdasan Artifisial.

\`\`\`python
# Evaluasi Tingkat Bahaya ISPU untuk Siswa Kelas X
ispu = 215

if ispu <= 50:
    print("Udara BAIK: Belajar tatap muka normal.")
elif ispu <= 100:
    print("Udara SEDANG: Kurangi kegiatan luar kelas.")
elif ispu <= 200:
    print("Udara TIDAK SEHAT: Wajib masker.")
elif ispu <= 300:
    print("Udara SANGAT TIDAK SEHAT: PJJ Daring Diberlakukan!")
else:
    print("Udara BERBAHAYA: Kondisi Darurat.")
\`\`\`
Jalankan kode di atas di **Code Playground** untuk melihat hasil eksekusinya.`,
    'https://www.youtube.com/watch?v=_uQrJ0TkZlc',
    'https://meet.google.com/pjj-kelas-x',
    teacherId
  );

  // --- KELAS XI (1 Mapel: Mulok Informatika) ---
  insertMaterial.run(
    mulokSub.lastInsertRowid,
    'XI',
    'ALL',
    '[Kelas XI] Modul 1: Struktur Data Lanjut & Pengelolaan Basis Data Relasional',
    'Basis Data Relasional',
    `### Struktur Data & Basis Data Relasional (Mulok Informatika - Kelas XI)

Pada tingkat XI, kita mempelajari bagaimana data presensi dan nilai ribuan siswa dikelola secara terstruktur:
1. **Struktur Data Linear vs Non-Linear**: Array, Stack, Queue, Hash Table, dan Tree.
2. **Entity Relationship Diagram (ERD)**: Relasi tabel Siswa (NISN), Kelas (XI.1 s/d XI.5), Mata Pelajaran, dan Nilai Tugas.
3. **Query SQL Terparameter**: Menghindari SQL Injection dengan prepared statements.`,
    'https://www.youtube.com/watch?v=2Tz8i3XbWbA',
    'https://meet.google.com/pjj-kelas-xi',
    teacherId
  );

  insertMaterial.run(
    mulokSub.lastInsertRowid,
    'XI',
    'ALL',
    '[Kelas XI] Modul 2: Machine Learning Terapan: Klasifikasi Indeks Polusi Udara',
    'Machine Learning Terapan',
    `### Machine Learning Terapan (Mulok Informatika - Kelas XI)

Pembelajaran mesin memungkinkan komputer belajar dari data historis tanpa diprogram secara eksplisit.

#### Alur Kerja (ML Pipeline):
1. **Pengumpulan Data**: Dataset historis polusi udara 30 hari terakhir (Suhu, Kelembaban, PM2.5, PM10).
2. **Preprocessing**: Normalisasi data dan penanganan missing values.
3. **Model Klasifikasi**: K-Nearest Neighbors (KNN) dan Decision Tree.
4. **Evaluasi**: Menghitung akurasi prediksi kelayakan sekolah dibuka tatap muka vs PJJ.`,
    'https://www.youtube.com/watch?v=jGwO_EbCTjA',
    'https://meet.google.com/pjj-kelas-xi',
    teacherId
  );

  // --- KELAS XII (1 Mapel: Mulok Informatika) ---
  insertMaterial.run(
    mulokSub.lastInsertRowid,
    'XII',
    'ALL',
    '[Kelas XII] Modul 1: Rekayasa Perangkat Lunak, REST API & Cyber Hygiene PJJ',
    'Software Engineering & Security',
    `### Arsitektur Web & Keamanan Siber (Mulok Informatika - Kelas XII)

Mempersiapkan siswa tingkat akhir untuk dunia industri dan perguruan tinggi:
1. **Arsitektur Client-Server & RESTful API**: HTTP methods (GET, POST, PUT, DELETE), status codes (200, 401, 403, 500).
2. **Otentikasi & Autorisasi Modern**: JWT (JSON Web Token), hashing bcrypt, dan proteksi sesi.
3. **Audit Keamanan Berkas**: Sanitasi nama berkas tugas siswa, MIME validation, dan mitigasi Path Traversal.`,
    'https://www.youtube.com/watch?v=lsMQRaeKNDk',
    'https://meet.google.com/pjj-kelas-xii',
    teacherId
  );

  insertMaterial.run(
    mulokSub.lastInsertRowid,
    'XII',
    'ALL',
    '[Kelas XII] Modul 2: Deep Learning, LLM & Prompt Engineering Beretika',
    'Generative AI & LLM',
    `### Kecerdasan Artifisial Lanjut & Large Language Models (Mulok Informatika - Kelas XII)

1. **Konsep Dasar Neural Networks**: Perceptron, bobot, fungsi aktivasi (ReLU/Sigmoid), dan Backpropagation.
2. **Generative AI & LLM**: Arsitektur Transformer, mekanisme Attention, dan tokenisasi teks.
3. **Advanced Prompt Engineering Framework (RISEN)**:
   - Role (Peran)
   - Input Context (Konteks Masalah)
   - Steps (Langkah Instruksi)
   - Expectation (Output yang Diharapkan)
   - Narrowing (Batasan Format)
4. **Etika AI & Integritas Akademik**: Menghindari plagiarisme koding dan bias data AI.`,
    'https://www.youtube.com/watch?v=aircAruvnKk',
    'https://meet.google.com/pjj-kelas-xii',
    teacherId
  );

  // Insert Assignments Separated by Grade Level & Subject
  const insertAssignment = db.prepare(`
    INSERT INTO assignments (subject_id, grade_level, target_class, title, description, due_date, max_score, allowed_types, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Tugas Kelas X (Informatika & KKA)
  const assignX1 = insertAssignment.run(
    inforSub.lastInsertRowid,
    'X',
    'ALL',
    'Tugas 1 (Kelas X - Infor): Dekomposisi & Flowchart Sistem Alarm Asap',
    `**Instruksi Khusus Kelas X (X.1 - X.5):**
1. Buatlah analisis dekomposisi masalah mengenai alur pendeteksian partikel asap pekat.
2. Buat flowchart logika pengambilan keputusan kapan siswa harus PJJ dan kapan boleh tatap muka.
3. Unggah tugas dalam format file PDF atau gambar (PNG/JPG).`,
    '2026-10-15 23:59:00',
    100,
    '.pdf,.docx,.png,.jpg',
    teacherId
  );

  insertAssignment.run(
    kkaSub.lastInsertRowid,
    'X',
    'ALL',
    'Tugas Koding 1 (Kelas X - KKA): Program Python Evaluasi Bahaya ISPU',
    `**Instruksi Khusus Kelas X (X.1 - X.5):**
1. Buat file Python (\`ispu_kelas_x.py\`) yang menerima input angka ISPU dan menampilkan kategori bahaya serta saran masker.
2. Unggah file \`.py\` atau \`.ipynb\` atau cantumkan tautan Google Colab publik Anda.`,
    '2026-10-14 20:00:00',
    100,
    '.py,.ipynb,.zip,.txt',
    teacherId
  );

  // Tugas Kelas XI (Mulok Informatika)
  const assignXI1 = insertAssignment.run(
    mulokSub.lastInsertRowid,
    'XI',
    'ALL',
    'Tugas 1 (Kelas XI - Mulok): Perancangan Basis Data Relasional Sistem Presensi PJJ',
    `**Instruksi Khusus Kelas XI (XI.1 - XI.5):**
1. Rancanglah skema basis data relasional (ERD) untuk mencatat presensi harian siswa dan keluhan gejala ISPA saat kabut asap.
2. Tuliskan query SQL DDL (CREATE TABLE) dan contoh 3 query DML (SELECT dengan WHERE & JOIN).
3. Unggah file dokumen \`.pdf\` atau script \`.sql\`.`,
    '2026-10-16 23:59:00',
    100,
    '.pdf,.sql,.docx',
    teacherId
  );

  insertAssignment.run(
    mulokSub.lastInsertRowid,
    'XI',
    'ALL',
    'Tugas Koding 1 (Kelas XI - Mulok): Analisis Dataset Polusi Udara dengan Python',
    `**Instruksi Khusus Kelas XI (XI.1 - XI.5):**
1. Buat skrip Python untuk menganalisis data rata-rata kualitas udara selama 7 hari dan kelompokkan statusnya.
2. Hitung statistik dasar (mean, median, nilai maksimum) menggunakan fungsi bawaan atau pustaka Python.
3. Unggah berkas \`.py\` atau \`.ipynb\` atau link GitHub / Colab.`,
    '2026-10-15 21:00:00',
    100,
    '.py,.ipynb,.zip',
    teacherId
  );

  // Tugas Kelas XII (Mulok Informatika)
  insertAssignment.run(
    mulokSub.lastInsertRowid,
    'XII',
    'ALL',
    'Tugas 1 (Kelas XII - Mulok): Desain Arsitektur REST API & Audit Keamanan File LMS',
    `**Instruksi Khusus Kelas XII (XII.1 - XII.4):**
1. Tuliskan analisis desain sistem pengumpulan tugas yang aman dari serangan directory traversal.
2. Jelaskan peranan autentikasi JWT dan hashing kata sandi siswa dengan bcrypt.
3. Unggah berkas laporan studi kasus dalam format \`.pdf\`.`,
    '2026-10-17 23:59:00',
    100,
    '.pdf,.docx',
    teacherId
  );

  insertAssignment.run(
    mulokSub.lastInsertRowid,
    'XII',
    'ALL',
    'Tugas Koding 1 (Kelas XII - Mulok): Implementasi Prompt Engineering Pipeline Beretika',
    `**Instruksi Khusus Kelas XII (XII.1 - XII.4):**
1. Buatlah script Python yang menerapkan framework prompt engineering RISEN untuk menghasilkan modul belajar adaptif selama PJJ kabut asap.
2. Sertakan dokumentasi uji coba minimal 3 variasi prompt dan hasil evaluasi logikanya.
3. Unggah berkas proyek koding (\`.py\`, \`.ipynb\` atau link GitHub).`,
    '2026-10-16 22:00:00',
    100,
    '.py,.ipynb,.zip',
    teacherId
  );

  // Seed sample submissions
  const insertSubmission = db.prepare(`
    INSERT INTO submissions (
      assignment_id, student_id, submitted_at, original_filename, file_size,
      text_answer, external_link, is_late, score, feedback, graded_at, graded_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Andi (X.1) submitted Tugas 1 Kelas X (already graded)
  insertSubmission.run(
    assignX1.lastInsertRowid,
    studentMap['siswa_x1'],
    '2026-10-08 08:30:00',
    'Tugas1_Andi_X1_Dekomposisi.pdf',
    215000,
    'Tugas dekomposisi sistem alarm asap Pekanbaru telah selesai. Dibuat dengan 3 subsistem utama.',
    'https://github.com/andipratama/infor-tugas1',
    0,
    95.0,
    'Analisis sangat runtut dan flowchart sudah memenuhi standar ISO!',
    '2026-10-08 09:00:00',
    teacherId
  );

  // Fajar (XI.1) submitted Tugas 1 Kelas XI (pending grading)
  insertSubmission.run(
    assignXI1.lastInsertRowid,
    studentMap['siswa_xi1'],
    '2026-10-08 08:45:00',
    'ERD_Presensi_PJJ_Fajar_XI1.pdf',
    340000,
    'Berikut rancangan ERD dan script SQL DDL untuk tabel presensi siswa.',
    'https://github.com/fajarnugraha/db-pjj-erd',
    0,
    null,
    null,
    null,
    null
  );

  console.log('Database successfully seeded with 14 classes and segregated materials for X, XI, and XII!');
}

function getSetting(key, defaultValue = null) {
  try {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setSetting(key, value) {
  try {
    db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now', 'localtime'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, String(value));
    return true;
  } catch (e) {
    console.error('Error setting key', key, e);
    return false;
  }
}

module.exports = {
  db,
  initDatabase,
  SCHOOL_CLASSES,
  getSetting,
  setSetting
};
