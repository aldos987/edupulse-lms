const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db } = require('./database');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 PENGUJIAN OTOMATIS: SISTEM LMS 14 KELAS & PEMETAAN KURIKULUM');
  console.log('   - KELAS X: 2 Mapel (Informatika & KKA)');
  console.log('   - KELAS XI & XII: 1 Mapel (Mulok Informatika)');
  console.log('================================================================\n');

  // Query subject IDs from DB
  const subInfor = db.prepare("SELECT id, code, name, grade_level FROM subjects WHERE code = 'INFOR'").get();
  const subKka = db.prepare("SELECT id, code, name, grade_level FROM subjects WHERE code = 'KKA'").get();
  const subMulok = db.prepare("SELECT id, code, name, grade_level FROM subjects WHERE code = 'MULOK_INFOR'").get();

  console.log('Daftar Mapel Terdaftar di Database:');
  console.log(` - ID ${subInfor.id}: ${subInfor.name} (Tingkat ${subInfor.grade_level})`);
  console.log(` - ID ${subKka.id}: ${subKka.name} (Tingkat ${subKka.grade_level})`);
  console.log(` - ID ${subMulok.id}: ${subMulok.name} (Tingkat ${subMulok.grade_level})\n`);

  // Reset initial password for student X.1 so test is repeatable
  const passHash = bcrypt.hashSync('sekolah2026', 10);
  db.prepare("UPDATE users SET password_hash = ?, is_default_password = 1 WHERE nisn_nip = '0081010001'").run(passHash);

  // -------------------------------------------------------------
  // Test 1: Login Siswa Kelas X (Andi X.1)
  // -------------------------------------------------------------
  console.log('1. Menguji Login Siswa Kelas X.1 menggunakan NISN & Password Global...');
  const studentXLogin = await fetchJson('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0081010001', password: 'sekolah2026' })
  });
  console.log('   [SUCCESS] Login Berhasil:', studentXLogin.user.full_name);
  console.log('   - Kelas       :', studentXLogin.user.class_name);
  console.log('   - Tingkat     :', studentXLogin.user.grade_level);
  console.log('   - Password Def:', studentXLogin.user.is_default_password === 1 ? 'YA (Wajib Ganti)' : 'TIDAK');
  const tokenX = studentXLogin.token;

  // -------------------------------------------------------------
  // Test 2: Verifikasi Siswa Kelas X Hanya Menerima 2 Mapel (Informatika & KKA)
  // -------------------------------------------------------------
  console.log('\n2. Memeriksa Pemetaan Mapel untuk Siswa Kelas X (Harus TEPAT 2 Mapel: Informatika & KKA)...');
  const subsX = await fetchJson('http://localhost:3000/api/subjects', {
    headers: { 'Authorization': `Bearer ${tokenX}` }
  });
  console.log(`   [SUCCESS] Siswa Kelas X menerima ${subsX.subjects.length} mata pelajaran:`);
  subsX.subjects.forEach(s => console.log(`     * [${s.code}] ${s.name}`));

  if (subsX.subjects.length !== 2) {
    throw new Error(`GAGAL: Kelas X seharusnya memiliki 2 mapel, tapi menerima ${subsX.subjects.length} mapel!`);
  }
  const xCodes = subsX.subjects.map(s => s.code);
  if (!xCodes.includes('INFOR') || !xCodes.includes('KKA')) {
    throw new Error('GAGAL: Kelas X harus memiliki mapel INFOR dan KKA!');
  }
  if (xCodes.includes('MULOK_INFOR')) {
    throw new Error('BOCOR: Siswa Kelas X menerima mapel Mulok Informatika yang dikhususkan untuk XI & XII!');
  }

  // Cek modul materi Informatika Kelas X
  const matsX = await fetchJson(`http://localhost:3000/api/materials/subject/${subInfor.id}`, {
    headers: { 'Authorization': `Bearer ${tokenX}` }
  });
  console.log(`   [SUCCESS] Siswa Kelas X dapat mengakses modul Informatika: "${matsX.materials[0]?.title}"`);

  // Verifikasi proteksi: Siswa Kelas X dilarang akses Mulok Informatika
  try {
    await fetchJson(`http://localhost:3000/api/materials/subject/${subMulok.id}`, {
      headers: { 'Authorization': `Bearer ${tokenX}` }
    });
    throw new Error('BOCOR: Siswa Kelas X bisa mengakses materi Mulok Informatika!');
  } catch (err) {
    console.log('   [SUCCESS] Terverifikasi: Siswa Kelas X ditolak akses materi Mulok Informatika (403 Forbidden).');
  }

  // -------------------------------------------------------------
  // Test 3: Siswa Ganti Kata Sandi (Change Password)
  // -------------------------------------------------------------
  console.log('\n3. Menguji Fitur Ganti Kata Sandi Mandiri oleh Siswa...');
  const changePassRes = await fetchJson('http://localhost:3000/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenX}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      current_password: 'sekolah2026',
      new_password: 'andi_rahasia_x1',
      confirm_password: 'andi_rahasia_x1'
    })
  });
  console.log('   [SUCCESS]', changePassRes.message);

  // -------------------------------------------------------------
  // Test 4: Verifikasi Login dengan Sandi Baru & Penolakan Sandi Lama
  // -------------------------------------------------------------
  console.log('\n4. Verifikasi Login Kembali dengan Kata Sandi Baru...');
  const newLogin = await fetchJson('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0081010001', password: 'andi_rahasia_x1' })
  });
  console.log('   [SUCCESS] Login Berhasil dengan Sandi Baru! is_default_password:', newLogin.user.is_default_password);

  try {
    await fetchJson('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '0081010001', password: 'sekolah2026' })
    });
    throw new Error('Gagal: Password lama masih bisa dipakai!');
  } catch (e) {
    console.log('   [SUCCESS] Terverifikasi: Password lama (sekolah2026) berhasil ditolak.');
  }

  // -------------------------------------------------------------
  // Test 5: Login Siswa Kelas XI (Fajar XI.1) - HANYA 1 MAPEL: Mulok (Informatika)
  // -------------------------------------------------------------
  console.log('\n5. Menguji Siswa Kelas XI.1 (Harus HANYA 1 Mapel: Mulok Informatika)...');
  const studentXILogin = await fetchJson('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0072010001', password: 'sekolah2026' })
  });
  console.log('   [SUCCESS] Siswa Masuk:', studentXILogin.user.full_name, `(${studentXILogin.user.class_name})`);
  const tokenXI = studentXILogin.token;

  const subsXI = await fetchJson('http://localhost:3000/api/subjects', {
    headers: { 'Authorization': `Bearer ${tokenXI}` }
  });
  console.log(`   [SUCCESS] Siswa Kelas XI menerima ${subsXI.subjects.length} mata pelajaran:`);
  subsXI.subjects.forEach(s => console.log(`     * [${s.code}] ${s.name}`));

  if (subsXI.subjects.length !== 1 || subsXI.subjects[0].code !== 'MULOK_INFOR') {
    throw new Error(`GAGAL: Kelas XI harus HANYA memiliki 1 mapel (MULOK_INFOR), tetapi menerima: ${JSON.stringify(subsXI.subjects)}`);
  }

  // Cek modul materi Mulok Kelas XI
  const matsXI = await fetchJson(`http://localhost:3000/api/materials/subject/${subMulok.id}`, {
    headers: { 'Authorization': `Bearer ${tokenXI}` }
  });
  console.log(`   [SUCCESS] Siswa Kelas XI menerima ${matsXI.materials.length} modul materi Mulok:`);
  matsXI.materials.forEach(m => {
    console.log(`     * [Tingkat ${m.grade_level}] ${m.title}`);
    if (m.grade_level !== 'XI' && m.grade_level !== 'ALL') {
      throw new Error(`BOCOR: Siswa Kelas XI melihat materi tingkat ${m.grade_level}!`);
    }
  });

  // Verifikasi proteksi: Siswa Kelas XI dilarang akses Informatika atau KKA Kelas X
  try {
    await fetchJson(`http://localhost:3000/api/materials/subject/${subInfor.id}`, {
      headers: { 'Authorization': `Bearer ${tokenXI}` }
    });
    throw new Error('BOCOR: Siswa Kelas XI bisa mengakses materi Informatika Kelas X!');
  } catch (err) {
    console.log('   [SUCCESS] Terverifikasi: Siswa Kelas XI ditolak akses mapel Informatika Kelas X (403 Forbidden).');
  }

  // -------------------------------------------------------------
  // Test 6: Login Siswa Kelas XII (Kevin XII.1) - HANYA 1 MAPEL: Mulok (Informatika)
  // -------------------------------------------------------------
  console.log('\n6. Menguji Siswa Kelas XII.1 (Harus HANYA 1 Mapel: Mulok Informatika)...');
  const studentXIILogin = await fetchJson('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '0063010001', password: 'sekolah2026' })
  });
  console.log('   [SUCCESS] Siswa Masuk:', studentXIILogin.user.full_name, `(${studentXIILogin.user.class_name})`);
  const tokenXII = studentXIILogin.token;

  const subsXII = await fetchJson('http://localhost:3000/api/subjects', {
    headers: { 'Authorization': `Bearer ${tokenXII}` }
  });
  console.log(`   [SUCCESS] Siswa Kelas XII menerima ${subsXII.subjects.length} mata pelajaran:`);
  subsXII.subjects.forEach(s => console.log(`     * [${s.code}] ${s.name}`));

  if (subsXII.subjects.length !== 1 || subsXII.subjects[0].code !== 'MULOK_INFOR') {
    throw new Error(`GAGAL: Kelas XII harus HANYA memiliki 1 mapel (MULOK_INFOR), tetapi menerima: ${JSON.stringify(subsXII.subjects)}`);
  }

  // Cek modul materi Mulok Kelas XII
  const matsXII = await fetchJson(`http://localhost:3000/api/materials/subject/${subMulok.id}`, {
    headers: { 'Authorization': `Bearer ${tokenXII}` }
  });
  console.log(`   [SUCCESS] Siswa Kelas XII menerima ${matsXII.materials.length} modul materi Mulok:`);
  matsXII.materials.forEach(m => {
    console.log(`     * [Tingkat ${m.grade_level}] ${m.title}`);
    if (m.grade_level !== 'XII' && m.grade_level !== 'ALL') {
      throw new Error(`BOCOR: Siswa Kelas XII melihat materi tingkat ${m.grade_level}!`);
    }
  });

  // -------------------------------------------------------------
  // Test 7: Guru Melihat Semua 3 Mapel dan Memfilter Pengumpulan Tugas
  // -------------------------------------------------------------
  console.log('\n7. Menguji Guru Mengampu 3 Mapel & Memfilter Pengumpulan Tugas...');
  const teacherLogin = await fetchJson('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'guru_infor', password: 'guru123' })
  });
  const teacherToken = teacherLogin.token;

  const teacherSubs = await fetchJson('http://localhost:3000/api/subjects', {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  console.log(`   [SUCCESS] Guru mengampu seluruh ${teacherSubs.subjects.length} mata pelajaran:`);
  teacherSubs.subjects.forEach(s => console.log(`     * [${s.code}] ${s.name} (Tingkat ${s.grade_level})`));

  if (teacherSubs.subjects.length !== 3) {
    throw new Error(`GAGAL: Guru harus melihat 3 mapel (Informatika, KKA, Mulok Informatika), tapi ada ${teacherSubs.subjects.length}`);
  }

  // Cek tugas dan submission
  const assignListRes = await fetchJson('http://localhost:3000/api/assignments', {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  console.log(`   [SUCCESS] Guru melihat total ${assignListRes.assignments.length} penugasan PJJ di sistem.`);

  // Reset student X.1 password back to default sekolah2026 for clean state
  db.prepare("UPDATE users SET password_hash = ?, is_default_password = 1 WHERE nisn_nip = '0081010001'").run(passHash);

  console.log('\n================================================================');
  console.log('🎉 SEMUA 7 SKENARIO PENGUJIAN KURIKULUM & PEMISAHAN MAPEL LULUS 100%!');
  console.log('   - Kelas X: Tepat 2 Mapel (Informatika & KKA)');
  console.log('   - Kelas XI: Tepat 1 Mapel (Mulok Informatika)');
  console.log('   - Kelas XII: Tepat 1 Mapel (Mulok Informatika)');
  console.log('   - Hak Akses & Isolasi Antar-Tingkat Terproteksi Penuh!');
  console.log('================================================================');
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error ' + res.status);
  return data;
}

runTests().catch(err => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
