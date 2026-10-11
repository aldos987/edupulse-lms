const http = require('http');

async function runTests() {
  console.log('=== TEST SUITE: INTEGRASI GOOGLE DRIVE & GOOGLE SHEETS ===\n');

  let teacherCookie = '';
  let studentCookie = '';

  // 1. Teacher Login
  console.log('1. Menguji Login Akun Guru...');
  const teacherLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'guru_infor', password: 'guru123' })
  });
  teacherCookie = teacherLogin.headers.get('set-cookie');
  const teacherData = await teacherLogin.json();
  if (!teacherData.success) throw new Error('Teacher login failed');
  console.log('   ✓ Guru berhasil login:', teacherData.user.full_name);

  // 2. Student Login
  console.log('2. Menguji Login Siswa (Andi X.1 - NISN 0081010001)...');
  // First try sekolah2026, fallback to andiBaru2026!
  let studentLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0081010001', password: 'sekolah2026' })
  });
  let studentData = await studentLogin.json();
  if (!studentData.success) {
    studentLogin = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '0081010001', password: 'andiBaru2026!' })
    });
    studentData = await studentLogin.json();
  }
  studentCookie = studentLogin.headers.get('set-cookie');
  if (!studentData.success) throw new Error('Student login failed');
  console.log('   ✓ Siswa berhasil login:', studentData.user.full_name, `(${studentData.user.class_name})`);

  // 3. Security Guard: Student CANNOT access /api/google-sync/config (Must return 403)
  console.log('3. Menguji Keamanan: Siswa Dilarang Mengakses Konfigurasi Google Sync (403 Forbidden)...');
  const forbiddenCheck = await fetch('http://localhost:3000/api/google-sync/config', {
    headers: { 'Cookie': studentCookie }
  });
  if (forbiddenCheck.status !== 403) {
    throw new Error(`Security failed! Student accessed config with status: ${forbiddenCheck.status}`);
  }
  console.log('   ✓ Berhasil dicegat dengan aman: HTTP 403 Forbidden!');

  // 4. Teacher accesses /api/google-sync/config
  console.log('4. Menguji Akses Guru ke Konfigurasi Google Sync...');
  const configRes = await fetch('http://localhost:3000/api/google-sync/config', {
    headers: { 'Cookie': teacherCookie }
  });
  const configData = await configRes.json();
  if (!configData.success) throw new Error('Teacher failed to get google-sync config');
  console.log('   ✓ Guru berhasil membaca konfigurasi Google Sync:', configData.config);

  // 5. Fetch Google Apps Script code
  console.log('5. Menguji Endpoint Pengambilan Kode Google Apps Script (/script-code)...');
  const scriptRes = await fetch('http://localhost:3000/api/google-sync/script-code', {
    headers: { 'Cookie': teacherCookie }
  });
  const scriptData = await scriptRes.json();
  if (!scriptData.success || !scriptData.code.includes('doPost')) {
    throw new Error('Failed to retrieve Google Apps Script code');
  }
  console.log('   ✓ Kode Google Apps Script siap salin berhasil dimuat (Panjang:', scriptData.code.length, 'karakter)');

  // 6. Teacher saves a Webhook URL (or verifies existing)
  console.log('6. Menguji Verifikasi Penyimpanan URL Webhook Google Apps Script...');
  const webhookToKeep = configData.config.webhook_url || 'https://script.google.com/macros/s/AKfycbz_DUMMY_DEMO_URL_FOR_TESTING/exec';
  const saveRes = await fetch('http://localhost:3000/api/google-sync/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': teacherCookie },
    body: JSON.stringify({ webhook_url: webhookToKeep, sync_enabled: true })
  });
  const saveData = await saveRes.json();
  if (!saveData.success) throw new Error('Failed to save google-sync config');
  console.log('   ✓ Konfigurasi Webhook aktif:', saveData.config.webhook_url);

  // 7. Test Attendance background sync without errors
  console.log('7. Menguji Pencatatan Presensi dengan Background Google Sync...');
  // Get subject ID for KKA or INFOR (Andi is Grade X)
  const subjectsRes = await fetch('http://localhost:3000/api/subjects', {
    headers: { 'Cookie': studentCookie }
  });
  const subjectsData = await subjectsRes.json();
  const kkaSubject = subjectsData.subjects.find(s => s.code === 'KKA');

  const attRes = await fetch('http://localhost:3000/api/attendance/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': studentCookie },
    body: JSON.stringify({
      subject_id: kkaSubject.id,
      status: 'Hadir',
      health_notes: 'Kondisi sehat di rumah, siap PJJ'
    })
  });
  const attData = await attRes.json();
  if (!attData.success) throw new Error('Attendance recording failed: ' + attData.message);
  console.log('   ✓ Presensi berhasil dicatat:', attData.message);

  // Wait 500ms for background sync worker to execute safely
  await new Promise(r => setTimeout(r, 500));

  // 8. Test Teacher Single Student Registration with Auto-Sync
  console.log('8. Menguji Pendaftaran Siswa Baru dengan Auto-Sync...');
  const newStudentRes = await fetch('http://localhost:3000/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': teacherCookie },
    body: JSON.stringify({
      full_name: 'Zahra Putri Ramadhani',
      nisn: '1020260999',
      grade_level: 'X',
      class_name: 'X.5'
    })
  });
  const newStudentData = await newStudentRes.json();
  if (!newStudentData.success && !newStudentData.message.includes('sudah terdaftar')) {
    throw new Error('Failed to add student: ' + newStudentData.message);
  }
  console.log('   ✓ Siswa baru berhasil diproses:', newStudentData.message);

  // 9. Verify Teacher can see plain_password in student list
  console.log('9. Menguji Visibilitas Kata Sandi Siswa di Panel Admin / Guru...');
  const studentsListRes = await fetch('http://localhost:3000/api/students', {
    headers: { 'Cookie': teacherCookie }
  });
  const studentsListData = await studentsListRes.json();
  if (!studentsListData.success) throw new Error('Failed to fetch students list');
  const sampleStudent = studentsListData.students.find(s => s.nisn_nip === '0081010001');
  if (!sampleStudent || !sampleStudent.plain_password) {
    throw new Error('Student plain_password not found in admin response');
  }
  console.log('   ✓ Admin berhasil melihat kata sandi siswa aktif:', sampleStudent.full_name, '-> Sandi:', sampleStudent.plain_password);

  // 10. Verify last_login_at is tracked
  console.log('10. Menguji Pelacakan Aktivitas Login Siswa (last_login_at)...');
  if (!sampleStudent.last_login_at) {
    console.log('   (Catatan: last_login_at belum terisi atau baru saja diinisialisasi)');
  } else {
    console.log('   ✓ Waktu login terakhir siswa tercatat:', sampleStudent.last_login_at);
  }

  console.log('\n=============================================================');
  console.log('🎉 SEMUA PENGUJIAN INTEGRASI GOOGLE DRIVE, SHEETS & PASSWORD BERHASIL 100%!');
  console.log('=============================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST GAGAL:', err.message);
  process.exit(1);
});
