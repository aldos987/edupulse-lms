/**
 * =========================================================================================
 * EDUPULSE LMS - GOOGLE APPS SCRIPT SYNC BRIDGE (GOOGLE SHEETS & GOOGLE DRIVE)
 * =========================================================================================
 * Skrip ini dipasang pada Google Spreadsheet guru untuk menghubungkan EduPulse LMS
 * dengan Google Drive & Google Sheets secara otomatis (Dual Cloud Backup & Rekapitulasi).
 * 
 * STRUKTUR LEMBAR KERJA (4 TAB OTOMATIS):
 * 1. Data_Siswa      : Roster siswa 14 kelas lengkap dengan KATA SANDI AKTIF & status akun.
 * 2. Log_Login_Siswa : Riwayat setiap kali siswa login (Waktu, NISN, Nama, Kelas, Perangkat).
 * 3. Rekap_Presensi  : Riwayat presensi harian & pemantauan kesehatan kabut asap.
 * 4. Pengumpulan_Tugas: Rekap berkas tugas siswa (Tautan Drive), nilai, & umpan balik guru.
 * 
 * CARA PEMASANGAN:
 * 1. Buka Google Spreadsheet di Google Drive Anda (misal: "LMS_Informatika_PJJ_2026")
 * 2. Klik menu "Ekstensi" (Extensions) > "Apps Script"
 * 3. Hapus semua kode bawaan, lalu PASTE seluruh isi file ini ke editor Apps Script.
 * 4. Klik ikon disket "Simpan" (Ctrl+S).
 * 5. Pada menu dropdown fungsi (di samping tombol Debug), pilih "setupSheets", lalu klik "Jalankan" (Run).
 *    (Beri otorisasi / Izinkan jika Google meminta konfirmasi izin).
 * 6. Klik tombol biru "Terapkan" (Deploy) > "Penerapan baru" (New deployment).
 *    - Pilih jenis: Aplikasi Web (Web app)
 *    - Deskripsi: EduPulse LMS Sync
 *    - Jalankan sebagai: Saya (Akun Google Anda)
 *    - Yang memiliki akses: Siapa saja (Anyone) -> WAJIB DIPILIH
 * 7. Salin URL Aplikasi Web yang berakhiran "/exec" dan tempel ke menu "Google Drive & Sheets" di LMS!
 * =========================================================================================
 */

// Konfigurasi Nama Tab & Folder Utama
var ROOT_FOLDER_NAME = "LMS_SEKOLAH_PJJ";
var TAB_SISWA = "Data_Siswa";
var TAB_LOGIN = "Log_Login_Siswa";
var TAB_PRESENSI = "Rekap_Presensi";
var TAB_TUGAS = "Pengumpulan_Tugas";

/**
 * Inisialisasi otomatis tab spreadsheet & folder Google Drive dengan warna & format rapi
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Tab Data Siswa (Dengan Kolom Kata Sandi Aktif untuk Admin)
  var sheetSiswa = getOrCreateSheet(ss, TAB_SISWA);
  var headersSiswa = ["Waktu Sinkron", "NISN", "Nama Lengkap", "Tingkat", "Ruang Kelas", "Kata Sandi (Password)", "Status Sandi", "Terakhir Login"];
  formatHeaderRow(sheetSiswa, headersSiswa, "#4338ca"); // Indigo

  // 2. Setup Tab Log Login Siswa (Riwayat Aktivitas Masuk Siswa)
  var sheetLogin = getOrCreateSheet(ss, TAB_LOGIN);
  var headersLogin = ["Waktu Login", "Tanggal", "Jam", "NISN", "Nama Siswa", "Tingkat", "Ruang Kelas", "Status Kata Sandi", "Perangkat / Browser"];
  formatHeaderRow(sheetLogin, headersLogin, "#1d4ed8"); // Biru Modern

  // 3. Setup Tab Rekap Presensi
  var sheetPresensi = getOrCreateSheet(ss, TAB_PRESENSI);
  var headersPresensi = ["Waktu Catat", "Tanggal", "Jam", "NISN", "Nama Siswa", "Tingkat", "Ruang Kelas", "Mata Pelajaran", "Status Kehadiran", "Catatan Kesehatan / Asap"];
  formatHeaderRow(sheetPresensi, headersPresensi, "#047857"); // Emerald

  // 4. Setup Tab Pengumpulan Tugas
  var sheetTugas = getOrCreateSheet(ss, TAB_TUGAS);
  var headersTugas = ["Waktu Pengumpulan", "ID Tugas", "Judul Tugas", "Mata Pelajaran", "Ruang Kelas", "NISN", "Nama Siswa", "Nama File", "Tautan Berkas Google Drive", "Status Waktu", "Nilai", "Catatan / Umpan Balik Guru", "Tautan Eksternal / Teks"];
  formatHeaderRow(sheetTugas, headersTugas, "#b45309"); // Amber

  // 5. Setup Root Folder Google Drive
  var rootFolder = getOrCreateDriveFolder(ROOT_FOLDER_NAME);
  
  // Subfolder Kelas X, XI, XII
  var folderX = getOrCreateSubFolder(rootFolder, "KELAS_X");
  getOrCreateSubFolder(folderX, "INFORMATIKA");
  getOrCreateSubFolder(folderX, "KKA");

  var folderXI = getOrCreateSubFolder(rootFolder, "KELAS_XI");
  getOrCreateSubFolder(folderXI, "MULOK_INFORMATIKA");

  var folderXII = getOrCreateSubFolder(rootFolder, "KELAS_XII");
  getOrCreateSubFolder(folderXII, "MULOK_INFORMATIKA");

  Logger.log("Setup Berhasil! Folder Drive: " + rootFolder.getUrl());
  return {
    status: "success",
    spreadsheetUrl: ss.getUrl(),
    driveFolderUrl: rootFolder.getUrl()
  };
}

/**
 * Handler GET request untuk verifikasi status webhook
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rootFolder = getOrCreateDriveFolder(ROOT_FOLDER_NAME);
  
  var response = {
    status: "online",
    message: "EduPulse LMS Google Sheets & Drive Webhook aktif dan siap menerima data.",
    timestamp: new Date().toISOString(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    driveFolderUrl: rootFolder.getUrl()
  };

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handler POST request utama dari server LMS
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(false, "Payload kosong atau tidak valid.");
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Action: Test Koneksi
    if (action === "test" || action === "ping") {
      var rootFolder = getOrCreateDriveFolder(ROOT_FOLDER_NAME);
      return jsonResponse(true, "Koneksi berhasil! Terhubung dengan Google Sheets dan Google Drive.", {
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        driveFolderUrl: rootFolder.getUrl()
      });
    }

    // 2. Action: Catat Log Login Siswa
    if (action === "sync_login") {
      var loginData = payload.login;
      var sheetLog = getOrCreateSheet(ss, TAB_LOGIN);
      var now = formatDate(new Date());

      // Simpan log ke Tab Log_Login_Siswa
      sheetLog.appendRow([
        now,
        loginData.date,
        loginData.time,
        loginData.nisn,
        loginData.name,
        loginData.grade,
        loginData.class_name,
        loginData.is_default_password ? "Default (sekolah2026)" : "Kustom (Diganti)",
        loginData.device || "-"
      ]);

      // Update kolom Terakhir Login di Tab Data_Siswa
      var sheetSiswa = getOrCreateSheet(ss, TAB_SISWA);
      updateStudentLastLogin(sheetSiswa, loginData);

      return jsonResponse(true, "Log login siswa " + loginData.name + " (" + loginData.nisn + ") berhasil dicatat.");
    }

    // 3. Action: Sinkronkan 1 Siswa (Termasuk Kata Sandi)
    if (action === "sync_student") {
      var student = payload.student;
      var sheet = getOrCreateSheet(ss, TAB_SISWA);
      upsertStudent(sheet, student);
      return jsonResponse(true, "Data siswa " + student.name + " (" + student.nisn + ") berhasil disinkronkan.");
    }

    // 4. Action: Update Kata Sandi Siswa yang Baru Diganti
    if (action === "change_student_password") {
      var passData = payload.data;
      var sheetSiswa = getOrCreateSheet(ss, TAB_SISWA);
      updateStudentPassword(sheetSiswa, passData);
      return jsonResponse(true, "Kata sandi siswa " + passData.name + " berhasil diperbarui di spreadsheet.");
    }

    // 5. Action: Batch Sinkronkan Seluruh Siswa (Lengkap dengan Kata Sandi)
    if (action === "batch_sync_students") {
      var students = payload.students || [];
      var sheet = getOrCreateSheet(ss, TAB_SISWA);
      
      // Bersihkan data lama, pertahankan baris 1 (header)
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }

      var now = formatDate(new Date());
      var rows = students.map(function(s) {
        return [
          now,
          s.nisn,
          s.name,
          s.grade,
          s.class_name,
          s.plain_password || s.password || "sekolah2026",
          s.is_default_password ? "Default (sekolah2026)" : "Kustom (Diganti Mandiri)",
          s.last_login_at || "-"
        ];
      });

      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }

      return jsonResponse(true, "Berhasil menyinkronkan " + rows.length + " siswa beserta kata sandi ke Google Sheets.");
    }

    // 6. Action: Sinkronkan Presensi Siswa
    if (action === "sync_attendance") {
      var att = payload.attendance;
      var sheet = getOrCreateSheet(ss, TAB_PRESENSI);
      var now = formatDate(new Date());
      
      sheet.appendRow([
        now,
        att.date,
        att.time || "",
        att.nisn,
        att.name,
        att.grade,
        att.class_name,
        att.subject,
        att.status,
        att.health_notes || "-"
      ]);

      return jsonResponse(true, "Presensi " + att.name + " (" + att.status + ") berhasil dicatat ke Google Sheets.");
    }

    // 7. Action: Batch Sinkronkan Presensi
    if (action === "batch_sync_attendance") {
      var records = payload.records || [];
      var sheet = getOrCreateSheet(ss, TAB_PRESENSI);
      
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }

      var rows = records.map(function(att) {
        return [
          formatDate(new Date(att.created_at || Date.now())),
          att.date,
          att.time || "",
          att.nisn,
          att.name,
          att.grade,
          att.class_name,
          att.subject,
          att.status,
          att.health_notes || "-"
        ];
      });

      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }

      return jsonResponse(true, "Berhasil menyinkronkan " + rows.length + " data presensi.");
    }

    // 8. Action: Upload Tugas ke Google Drive & Rekap ke Google Sheets
    if (action === "upload_submission") {
      var sub = payload.submission;
      var fileData = payload.file;
      var fileUrl = "-";
      var fileId = null;

      // Jika ada file fisik, simpan ke Google Drive
      if (fileData && fileData.base64) {
        var rootFolder = getOrCreateDriveFolder(ROOT_FOLDER_NAME);
        var gradeFolderName = "KELAS_" + (sub.grade || "X");
        var gradeFolder = getOrCreateSubFolder(rootFolder, gradeFolderName);
        
        var cleanSubject = (sub.subject_name || "TUGAS").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
        var subjectFolder = getOrCreateSubFolder(gradeFolder, cleanSubject);

        var decodedBytes = Utilities.base64Decode(fileData.base64);
        var blob = Utilities.newBlob(decodedBytes, fileData.mimeType || "application/octet-stream", fileData.filename || sub.filename);
        
        var uploadedFile = subjectFolder.createFile(blob);
        uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        fileUrl = uploadedFile.getUrl();
        fileId = uploadedFile.getId();
      } else if (sub.external_link) {
        fileUrl = sub.external_link;
      }

      // Catat ke Sheet Pengumpulan Tugas
      var sheet = getOrCreateSheet(ss, TAB_TUGAS);
      upsertSubmissionRow(sheet, sub, fileUrl);

      return jsonResponse(true, "Tugas berhasil diunggah ke Google Drive dan dicatat di Google Sheets!", {
        driveUrl: fileUrl,
        fileId: fileId
      });
    }

    // 9. Action: Update Nilai dari Guru (Sync Grade)
    if (action === "sync_grade") {
      var grade = payload.grade;
      var sheet = getOrCreateSheet(ss, TAB_TUGAS);
      var updated = updateSubmissionGrade(sheet, grade);
      return jsonResponse(true, updated ? "Nilai berhasil diperbarui di Google Sheets." : "Baris tugas tidak ditemukan, tetap dicatat.");
    }

    // 10. Action: Batch Sinkronkan Semua Submissions
    if (action === "batch_sync_submissions") {
      var submissions = payload.submissions || [];
      var sheet = getOrCreateSheet(ss, TAB_TUGAS);
      
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }

      var rows = submissions.map(function(s) {
        return [
          s.submitted_at || formatDate(new Date()),
          s.assignment_id,
          s.assignment_title,
          s.subject_name,
          s.class_name,
          s.nisn,
          s.name,
          s.filename || "-",
          s.drive_file_url || s.external_link || "-",
          s.is_late ? "Terlambat" : "Tepat Waktu",
          s.score !== null && s.score !== undefined ? s.score : "-",
          s.feedback || "-",
          s.external_link || s.text_answer || "-"
        ];
      });

      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }

      return jsonResponse(true, "Berhasil menyinkronkan " + rows.length + " rekaman tugas ke Google Sheets.");
    }

    return jsonResponse(false, "Action tidak dikenali: " + action);

  } catch (error) {
    Logger.log("Error pada doPost: " + error.toString());
    return jsonResponse(false, "Terjadi kesalahan di Google Apps Script: " + error.message);
  }
}

// =========================================================================================
// FUNGSI PENDUKUNG (HELPER FUNCTIONS)
// =========================================================================================

function jsonResponse(success, message, extraData) {
  var output = {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };
  if (extraData) {
    for (var key in extraData) {
      output[key] = extraData[key];
    }
  }
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function formatHeaderRow(sheet, headers, bgColor) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold");
  headerRange.setFontColor("#ffffff");
  headerRange.setBackground(bgColor);
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  for (var i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

function getOrCreateDriveFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(name);
}

function getOrCreateSubFolder(parentFolder, name) {
  var folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

function upsertStudent(sheet, student) {
  var data = sheet.getDataRange().getValues();
  var now = formatDate(new Date());
  var targetRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(student.nisn)) {
      targetRow = i + 1;
      break;
    }
  }

  var rowValues = [
    now,
    student.nisn,
    student.name,
    student.grade,
    student.class_name,
    student.plain_password || student.password || "sekolah2026",
    student.is_default_password ? "Default (sekolah2026)" : "Kustom (Diganti Mandiri)",
    student.last_login_at || "-"
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function updateStudentLastLogin(sheet, loginData) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(loginData.nisn)) {
      // Kolom 7: Status Sandi, Kolom 8: Terakhir Login
      sheet.getRange(i + 1, 7).setValue(loginData.is_default_password ? "Default (sekolah2026)" : "Kustom (Diganti Mandiri)");
      sheet.getRange(i + 1, 8).setValue(formatDate(new Date()));
      break;
    }
  }
}

function updateStudentPassword(sheet, passData) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(passData.nisn)) {
      // Kolom 6: Kata Sandi, Kolom 7: Status Sandi
      sheet.getRange(i + 1, 6).setValue(passData.new_password);
      sheet.getRange(i + 1, 7).setValue("Kustom (Diganti Mandiri)");
      break;
    }
  }
}

function upsertSubmissionRow(sheet, sub, fileUrl) {
  var data = sheet.getDataRange().getValues();
  var now = formatDate(new Date());
  var targetRow = -1;

  for (var i = 1; i < data.length; i++) {
    var matchAssignment = String(data[i][1]) === String(sub.assignment_id);
    var matchNisn = String(data[i][5]) === String(sub.nisn);
    if (matchAssignment && matchNisn) {
      targetRow = i + 1;
      break;
    }
  }

  var rowValues = [
    sub.submitted_at || now,
    sub.assignment_id,
    sub.assignment_title,
    sub.subject_name,
    sub.class_name,
    sub.nisn,
    sub.name,
    sub.filename || "-",
    fileUrl,
    sub.is_late || "Tepat Waktu",
    sub.score !== null && sub.score !== undefined ? sub.score : "-",
    sub.feedback || "-",
    sub.external_link || sub.text_answer || "-"
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function updateSubmissionGrade(sheet, grade) {
  var data = sheet.getDataRange().getValues();
  var updated = false;

  for (var i = 1; i < data.length; i++) {
    var matchAssignment = String(data[i][1]) === String(grade.assignment_id);
    var matchNisn = String(data[i][5]) === String(grade.nisn);
    if (matchAssignment && matchNisn) {
      // Kolom 11: Nilai (Score), Kolom 12: Catatan Guru (Feedback)
      sheet.getRange(i + 1, 11).setValue(grade.score);
      sheet.getRange(i + 1, 12).setValue(grade.feedback || "-");
      updated = true;
      break;
    }
  }
  return updated;
}

function formatDate(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
}
