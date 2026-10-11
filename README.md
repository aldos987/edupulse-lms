# EduPulse LMS - Platform Pembelajaran Jarak Jauh (Informatika & KKA)
### Tanggap Darurat Bencana Kabut Asap (14 Kelas: X.1-X.5, XI.1-XI.5, XII.1-XII.4)

Platform Learning Management System (LMS) modern, aman, dan terintegrasi untuk pembelajaran jarak jauh (PJJ) saat kondisi darurat kabut asap melanda sekolah. Dilengkapi pembagian ruang kelas otomatis untuk 14 kelas, login berbasis NISN, dan pemisahan materi & tugas antar tingkat kelas (X, XI, XII).

---

## 🏫 Struktur Kelas & Sistem Autentikasi

### 1. Pembagian 14 Kelas
- **Kelas X (Fase E):** `X.1`, `X.2`, `X.3`, `X.4`, `X.5`
- **Kelas XI (Fase F):** `XI.1`, `XI.2`, `XI.3`, `XI.4`, `XI.5`
- **Kelas XII (Fase F Lanjut):** `XII.1`, `XII.2`, `XII.3`, `XII.4`

### 2. Autentikasi Siswa
- **ID Masuk:** **NISN** Siswa (10 Digit).
- **Kata Sandi Global:** `sekolah2026` (Dapat diganti mandiri oleh siswa setelah masuk).
- **Redireksi Otomatis:** Saat siswa berhasil masuk, sistem langsung mengarahkan ke dashboard **Ruang Kelas Maya** miliknya lengkap dengan badge kelas dan kurikulum tingkatnya.
- **Fitur Ganti Kata Sandi Mandiri:** Tersedia notifikasi keamanan jika siswa masih menggunakan sandi bawaan, dan formulir ganti sandi pribadi kapan saja.

### 3. Autentikasi Guru
- **ID Masuk:** Username `guru_infor` atau NIP `198504122010011008`.
- **Kata Sandi:** `guru123`.
- **Hak Akses:** Mengelola seluruh 14 kelas, memilih tingkat target materi/tugas, memeriksa pengumpulan, dan mengekspor nilai per kelas.

---

## 📚 Pemisahan Materi & Penugasan per Tingkat

| Tingkat | Fokus Kurikulum Informatika | Fokus Kurikulum KKA (Koding & AI) |
|---|---|---|
| **Kelas X** (Fase E) | Berpikir Komputasional & Dekomposisi Sistem Monitoring Asap | Dasar Python & Logika Percabangan (Sensor ISPU) |
| **Kelas XI** (Fase F) | Struktur Data Lanjut & Basis Data Relasional Presensi PJJ | Machine Learning Dasar & Klasifikasi Indeks Polutan Udara |
| **Kelas XII** (Fase F Lanjut) | Rekayasa Perangkat Lunak, REST API & Keamanan Digital | Deep Learning, LLM & Prompt Engineering Beretika Lanjut |

---

## 👥 Direktori Akun Uji Coba

Buka browser di **`http://localhost:3000`** dan buka menu **"Direktori Akun Kelas"** di halaman login:

| Tingkat | Kelas | Nama Siswa Contoh | NISN Siswa | Password Awal |
|---|---|---|---|---|
| **Kelas X** | X.1 | Andi Pratama Wijaya | `0081010001` | `sekolah2026` |
| | X.2 | Budi Santoso | `0081020002` | `sekolah2026` |
| | X.3 | Cantika Dewi Lestari | `0081030003` | `sekolah2026` |
| | X.4 | Dimas Anggara Putra | `0081040004` | `sekolah2026` |
| | X.5 | Eka Rahmawati Putri | `0081050005` | `sekolah2026` |
| **Kelas XI** | XI.1 | Fajar Nugraha Pratama | `0072010001` | `sekolah2026` |
| | XI.2 | Gita Permata Sari | `0072020002` | `sekolah2026` |
| | XI.3 | Hendra Wijaya Kusuma | `0072030003` | `sekolah2026` |
| | XI.4 | Intan Maharani Putri | `0072040004` | `sekolah2026` |
| | XI.5 | Joko Prasetyo Utomo | `0072050005` | `sekolah2026` |
| **Kelas XII** | XII.1 | Kevin Sanjaya Wardhana | `0063010001` | `sekolah2026` |
| | XII.2 | Larasati Ayu Ningrum | `0063020002` | `sekolah2026` |
| | XII.3 | Maulana Malik Ibrahim | `0063030003` | `sekolah2026` |
| | XII.4 | Nadya Zafira Ramadhani | `0063040004` | `sekolah2026` |
| **Guru** | Semua | Bpk. H. Rahmat Hidayat | `guru_infor` / `198504122010011008` | `guru123` |

---

## 🔒 Fitur Keamanan Sistem

1. **Role-Based Access Control (RBAC):** Hak akses guru dan siswa dipisahkan secara ketat dengan token JWT dan HTTP-only cookie.
2. **Isolasi Berkas:** Pengumpulan tugas tersimpan di [`uploads/submissions/`](file:///C:/Users/aldo/.gemini/antigravity/scratch/lms-infor-kka/uploads/submissions) dengan nama unik acak untuk mencegah penimpaan file dan directory traversal.
3. **Whitelist Ekstensi File:** Mendukung berkas koding (`.py`, `.ipynb`, `.zip`), laporan (`.pdf`, `.docx`), dan gambar tugas (`.png`, `.jpg`), serta memblokir file executable berbahaya.
4. **Pencegahan SQL Injection:** Menggunakan query parameterized prepared statements via SQLite.
5. **Enkripsi Kata Sandi:** Hashing kata sandi menggunakan pustaka *bcrypt* dengan salt rounds 10.

---

## ☁️ Integrasi Google Drive & Google Sheets (Dual Cloud Backup)

EduPulse LMS kini terintegrasi penuh dengan **Google Drive** dan **Google Sheets**:
1. **Google Drive:** Berkas tugas siswa (.pdf, .docx, .zip, .py) otomatis diunggah dan ditata rapi ke subfolder Google Drive guru (`LMS_SEKOLAH_PJJ/KELAS_X/INFORMATIKA`, `KELAS_X/KKA`, `KELAS_XI/MULOK_INFORMATIKA`, `KELAS_XII/MULOK_INFORMATIKA`).
2. **Google Sheets:** Berfungsi sebagai buku nilai dan rekapan kehadiran langsung yang dapat dibuka guru dari smartphone:
   - **Tab `Data_Siswa`:** Menampung NISN, nama lengkap, tingkat (X, XI, XII), dan kelas (X.1 s/d XII.4).
   - **Tab `Rekap_Presensi`:** Menampung timestamp, tanggal, jam, NISN, nama siswa, status (Hadir/Sakit/Izin), dan catatan kondisi asap.
   - **Tab `Pengumpulan_Tugas`:** Menampung riwayat pengumpulan, direct link Google Drive, ketepatan waktu, nilai, dan umpan balik guru.
3. **Penyambungan Praktis via Google Apps Script:** Cukup salin skrip `google-apps-script.js`, tempel di menu *Ekstensi > Apps Script* pada Google Sheet Anda, deploy sebagai Web App, dan masukkan URL-nya ke panel Guru LMS.
