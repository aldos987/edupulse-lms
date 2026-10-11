// EduPulse LMS Frontend Main Controller
// Supporting 14 Classes: X.1-X.5, XI.1-XI.5, XII.1-XII.4 with NISN Login & Grade Separation

let currentUser = null;
let currentTab = 'dashboard';
let currentTeacherGradeFilter = 'ALL'; // 'ALL', 'X', 'XI', 'XII'
let currentFilter = 'all'; // 'all', 'INFOR', 'KKA'
let subjectsList = [];
let assignmentsList = [];
let currentSelectedSubjectId = null;
let schoolClassesData = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  initPlayground();
  setupEventListeners();
  await loadClassDirectory();
  await checkAuthAndInitialize();
});

// Setup All Interactive Event Listeners
function setupEventListeners() {
  // 1. Login Page Interactions
  const studentTab = document.getElementById('loginTabStudent');
  const teacherTab = document.getElementById('loginTabTeacher');
  const loginIdLabel = document.getElementById('loginIdLabel');
  const loginIdentifier = document.getElementById('loginIdentifier');
  const loginIdHelper = document.getElementById('loginIdHelper');
  const studentTip = document.getElementById('studentPasswordTip');
  const loginForm = document.getElementById('mainLoginForm');
  const togglePassBtn = document.getElementById('togglePasswordBtn');
  const passwordInput = document.getElementById('loginPassword');

  let loginMode = 'student'; // 'student' or 'teacher'

  if (studentTab && teacherTab) {
    studentTab.addEventListener('click', () => {
      loginMode = 'student';
      studentTab.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition bg-white text-indigo-700 shadow-sm flex items-center justify-center gap-1.5';
      teacherTab.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5';
      loginIdLabel.textContent = 'Nomor Induk Siswa Nasional (NISN)';
      loginIdentifier.placeholder = 'Masukkan 10 digit NISN Anda...';
      loginIdHelper.textContent = 'Gunakan NISN yang terdaftar di kelas Anda (contoh: 0081010001).';
      studentTip.classList.remove('hidden');
    });

    teacherTab.addEventListener('click', () => {
      loginMode = 'teacher';
      teacherTab.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition bg-white text-indigo-700 shadow-sm flex items-center justify-center gap-1.5';
      studentTab.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5';
      loginIdLabel.textContent = 'NIP / Username Guru';
      loginIdentifier.placeholder = 'guru_infor atau NIP...';
      loginIdHelper.textContent = 'Gunakan username atau NIP guru pengampu Informatika & KKA.';
      studentTip.classList.add('hidden');
    });
  }

  // Toggle Password Visibility
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePassBtn.innerHTML = type === 'password' ? '<i class="fas fa-eye text-sm"></i>' : '<i class="fas fa-eye-slash text-sm"></i>';
    });
  }

  // Submit Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('loginIdentifier').value.trim();
      const password = document.getElementById('loginPassword').value;
      const submitBtn = document.getElementById('loginSubmitBtn');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...';

      try {
        const res = await api.login(identifier, password);
        currentUser = res.user;
        showToast(res.message || `Selamat datang di Ruang Kelas ${currentUser.class_name}!`, 'success');
        showAppScreen();
        await onUserAuthenticated();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Masuk ke Ruang Kelas Saya</span> <i class="fas fa-arrow-right text-xs"></i>';
      }
    });
  }

  // Toggle Directory Drawer
  const toggleDirBtn = document.getElementById('toggleDirectoryBtn');
  const dirContainer = document.getElementById('classDirectoryContainer');
  const dirChevron = document.getElementById('directoryChevron');
  if (toggleDirBtn && dirContainer) {
    toggleDirBtn.addEventListener('click', () => {
      dirContainer.classList.toggle('hidden');
      dirChevron.classList.toggle('rotate-180');
    });
  }

  // 2. Change Password Form Submission
  const cpForm = document.getElementById('changePasswordForm');
  if (cpForm) {
    cpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const curr = document.getElementById('cpCurrentPassword').value;
      const newP = document.getElementById('cpNewPassword').value;
      const conf = document.getElementById('cpConfirmPassword').value;

      try {
        const res = await api.changePassword(curr, newP, conf);
        showToast(res.message, 'success');
        closeModal('changePasswordModal');
        cpForm.reset();
        currentUser.is_default_password = 0;
        document.getElementById('defaultPasswordWarning').classList.add('hidden');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // 3. Navigation tabs
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      navigateTo(tab);
    });
  });

  // 4. Quick switch dropdown
  const switchBtn = document.getElementById('quickSwitchBtn');
  const switchMenu = document.getElementById('quickSwitchMenu');
  if (switchBtn && switchMenu) {
    switchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      switchMenu.classList.add('hidden');
    });
  }

  // 5. Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api.logout();
    currentUser = null;
    showToast('Berhasil keluar. Silakan masuk kembali dengan NISN Anda.', 'info');
    showLoginScreen();
  });

  // 6. Teacher Grade Filter Buttons on Dashboard
  document.querySelectorAll('.grade-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.grade-filter-btn').forEach(b => {
        b.className = 'grade-filter-btn bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition';
      });
      e.currentTarget.className = 'grade-filter-btn active bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm';
      currentTeacherGradeFilter = e.currentTarget.getAttribute('data-grade');
      refreshCurrentView();
    });
  });

  // 7. Teacher Grade Filter on Materials Page
  document.querySelectorAll('.mat-grade-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.mat-grade-btn').forEach(b => {
        b.className = 'mat-grade-btn text-slate-600 hover:bg-white/60 px-3 py-1 rounded-lg';
      });
      e.currentTarget.className = 'mat-grade-btn active bg-white font-bold text-indigo-600 px-3 py-1 rounded-lg shadow-sm';
      currentTeacherGradeFilter = e.currentTarget.getAttribute('data-grade');
      if (currentSelectedSubjectId) {
        loadMaterialsForSubject(currentSelectedSubjectId);
      }
    });
  });

  // 8. Teacher Grade Filter on Assignments Page
  document.querySelectorAll('.assign-grade-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.assign-grade-btn').forEach(b => {
        b.className = 'assign-grade-btn text-slate-600 hover:bg-white/60 px-3 py-1 rounded-lg';
      });
      e.currentTarget.className = 'assign-grade-btn active bg-white font-bold text-indigo-600 px-3 py-1 rounded-lg shadow-sm';
      currentTeacherGradeFilter = e.currentTarget.getAttribute('data-grade');
      loadAssignments().then(() => renderAssignmentsList());
    });
  });

  // 9. Modal Subject Selection Sync to Grade
  const newAssignSubEl = document.getElementById('newAssignSubject');
  if (newAssignSubEl) {
    newAssignSubEl.addEventListener('change', () => {
      const selectedSubId = Number(newAssignSubEl.value);
      const subObj = subjectsList.find(s => s.id === selectedSubId);
      if (subObj) {
        const gradeEl = document.getElementById('newAssignGradeLevel');
        if (subObj.grade_level === 'X') {
          gradeEl.value = 'X';
        } else if (subObj.grade_level === 'XI,XII' && gradeEl.value === 'X') {
          gradeEl.value = 'XI';
        }
        gradeEl.dispatchEvent(new Event('change'));
      }
    });
  }

  const newMatSubEl = document.getElementById('newMatSubject');
  if (newMatSubEl) {
    newMatSubEl.addEventListener('change', () => {
      const selectedSubId = Number(newMatSubEl.value);
      const subObj = subjectsList.find(s => s.id === selectedSubId);
      if (subObj) {
        const gradeEl = document.getElementById('newMatGradeLevel');
        if (subObj.grade_level === 'X') {
          gradeEl.value = 'X';
        } else if (subObj.grade_level === 'XI,XII' && gradeEl.value === 'X') {
          gradeEl.value = 'XI';
        }
        gradeEl.dispatchEvent(new Event('change'));
      }
    });
  }

  // 10. Edit Emergency Status
  document.getElementById('editEmergencyBtn').addEventListener('click', () => {
    openModal('editEmergencyModal');
  });

  document.getElementById('emergencyStatusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      air_quality_index: document.getElementById('editIspuInput').value,
      air_quality_category: document.getElementById('editIspuCategory').value,
      pjj_announcement: document.getElementById('editAnnouncementText').value,
      live_meet_link: document.getElementById('editLiveMeetUrl').value
    };
    try {
      await api.updateEmergencyStatus(payload);
      showToast('Status tanggap kabut asap berhasil diperbarui!', 'success');
      closeModal('editEmergencyModal');
      await loadEmergencyStatus();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 11. Add Assignment Button
  document.getElementById('addAssignmentBtn').addEventListener('click', () => {
    populateSubjectSelect('newAssignSubject');
    setupGradeAndClassDropdowns('newAssignGradeLevel', 'newAssignTargetClass');
    const d = new Date();
    d.setDate(d.getDate() + 5);
    d.setHours(23, 59, 0, 0);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('newAssignDueDate').value = localIso;
    openModal('createAssignmentModal');
  });

  document.getElementById('createAssignmentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
      await api.createAssignment(formData);
      showToast('Penugasan berhasil dibuat dan disiarkan ke kelas!', 'success');
      closeModal('createAssignmentModal');
      form.reset();
      await loadAssignments();
      renderAssignmentsList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 12. Add Material Button
  document.getElementById('addMaterialBtn').addEventListener('click', () => {
    populateSubjectSelect('newMatSubject');
    setupGradeAndClassDropdowns('newMatGradeLevel', 'newMatTargetClass');
    openModal('createMaterialModal');
  });

  document.getElementById('createMaterialForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      subject_id: document.getElementById('newMatSubject').value,
      grade_level: document.getElementById('newMatGradeLevel').value,
      target_class: document.getElementById('newMatTargetClass').value,
      topic: document.getElementById('newMatTopic').value,
      title: document.getElementById('newMatTitle').value,
      content: document.getElementById('newMatContent').value,
      video_url: document.getElementById('newMatVideo').value
    };

    try {
      await api.createMaterial(payload);
      showToast('Materi pembelajaran berhasil ditambahkan!', 'success');
      closeModal('createMaterialModal');
      e.target.reset();
      if (currentSelectedSubjectId) {
        await loadMaterialsForSubject(currentSelectedSubjectId);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 13. Student Attendance Form
  document.getElementById('recordAttendanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const subjectId = document.getElementById('attSubjectSelect').value;
    const status = document.querySelector('input[name="attStatus"]:checked').value;
    const healthNotes = document.getElementById('attHealthNotes').value;

    try {
      const res = await api.recordAttendance(subjectId, status, healthNotes);
      showToast(res.message || 'Presensi berhasil dicatat!', 'success');
      await loadAttendanceView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 14. Drag and Drop for Submissions
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('submissionFileInput');
  const fileNameDisplay = document.getElementById('selectedFileName');

  if (dropZone && fileInput) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelected(fileInput.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        handleFileSelected(fileInput.files[0]);
      }
    });
  }

  function handleFileSelected(file) {
    if (!file) return;
    fileNameDisplay.textContent = `File terpilih: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    fileNameDisplay.classList.remove('hidden');
  }

  // 15. Submit Task
  document.getElementById('submissionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const assignmentId = document.getElementById('subModalAssignmentId').value;
    const form = e.target;
    const formData = new FormData(form);

    const submitBtn = document.getElementById('submitTaskBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim Berkas...';

    try {
      const res = await api.submitAssignment(assignmentId, formData);
      showToast(res.message || 'Tugas berhasil dikumpulkan!', 'success');
      closeModal('submitModal');
      form.reset();
      fileNameDisplay.classList.add('hidden');
      await loadAssignments();
      renderAssignmentsList();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kumpulkan Sekarang';
    }
  });

  // 16. Teacher Grade Student
  document.getElementById('gradeStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submissionId = document.getElementById('gradeSubmissionId').value;
    const score = document.getElementById('gradeScoreInput').value;
    const feedback = document.getElementById('gradeFeedbackInput').value;

    try {
      const res = await api.gradeSubmission(submissionId, score, feedback);
      showToast(res.message || 'Nilai berhasil disimpan!', 'success');
      closeModal('gradeStudentModal');
      const curAssignId = document.getElementById('exportCsvBtn').getAttribute('data-assign-id');
      if (curAssignId) {
        openGradingModal(curAssignId);
      }
      await loadAssignments();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 17. Discussions
  document.getElementById('newDiscussionBtn').addEventListener('click', () => {
    populateSubjectSelect('newDiscSubject');
    openModal('newDiscussionModal');
  });

  document.getElementById('newDiscussionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const subjectId = document.getElementById('newDiscSubject').value;
    const title = document.getElementById('newDiscTitle').value;
    const message = document.getElementById('newDiscMessage').value;

    try {
      await api.createDiscussion(subjectId, title, message);
      showToast('Topik diskusi berhasil dikirim!', 'success');
      closeModal('newDiscussionModal');
      e.target.reset();
      await loadDiscussionsView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 18. Student Management Events (Admin / Guru)
  const openAddStudentBtn = document.getElementById('openAddStudentModalBtn');
  if (openAddStudentBtn) {
    openAddStudentBtn.addEventListener('click', () => {
      setupGradeAndClassDropdowns('newStudentGrade', 'newStudentClass');
      openModal('addStudentModal');
    });
  }

  const addStudentForm = document.getElementById('addStudentForm');
  if (addStudentForm) {
    addStudentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        full_name: document.getElementById('newStudentName').value.trim(),
        nisn: document.getElementById('newStudentNisn').value.trim(),
        grade_level: document.getElementById('newStudentGrade').value,
        class_name: document.getElementById('newStudentClass').value,
        password: document.getElementById('newStudentPass').value.trim() || 'sekolah2026'
      };

      try {
        const res = await api.addStudent(payload);
        showToast(res.message, 'success');
        closeModal('addStudentModal');
        addStudentForm.reset();
        await loadStudentsView();
        await loadClassDirectory();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const openBatchBtn = document.getElementById('openBatchStudentModalBtn');
  if (openBatchBtn) {
    openBatchBtn.addEventListener('click', () => {
      openModal('batchStudentModal');
    });
  }

  const batchForm = document.getElementById('batchStudentForm');
  if (batchForm) {
    batchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawText = document.getElementById('batchStudentTextarea').value;
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      const studentData = [];
      lines.forEach(line => {
        // Expected format: NISN, Nama, Kelas
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          studentData.push({
            nisn: parts[0],
            full_name: parts[1],
            class_name: parts[2]
          });
        }
      });

      if (studentData.length === 0) {
        showToast('Format teks salah. Pastikan format: NISN, Nama Lengkap, Ruang Kelas', 'error');
        return;
      }

      const procBtn = document.getElementById('btnProcessBatch');
      procBtn.disabled = true;
      procBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

      try {
        const res = await api.batchAddStudents(studentData);
        showToast(res.message, 'success');
        closeModal('batchStudentModal');
        batchForm.reset();
        await loadStudentsView();
        await loadClassDirectory();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        procBtn.disabled = false;
        procBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Proses Import';
      }
    });
  }

  const studentSearch = document.getElementById('studentSearchInput');
  if (studentSearch) {
    let searchTimeout = null;
    studentSearch.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadStudentsView();
      }, 350);
    });
  }

  const filterGradeEl = document.getElementById('studentFilterGrade');
  const filterClassEl = document.getElementById('studentFilterClass');
  if (filterGradeEl && filterClassEl) {
    filterGradeEl.addEventListener('change', () => {
      populateStudentClassFilterDropdown();
      loadStudentsView();
    });
    filterClassEl.addEventListener('change', () => {
      loadStudentsView();
    });
  }

  const refreshStudentsBtn = document.getElementById('refreshStudentsBtn');
  if (refreshStudentsBtn) {
    refreshStudentsBtn.addEventListener('click', () => {
      loadStudentsView();
      showToast('Data siswa berhasil disegarkan', 'info');
    });
  }

  // 12. Google Drive & Sheets Sync Listeners
  const gsConfigForm = document.getElementById('googleSyncConfigForm');
  if (gsConfigForm) {
    gsConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('gsSaveConfigBtn');
      const webhookUrl = document.getElementById('gsWebhookUrlInput').value.trim();
      const syncEnabled = document.getElementById('gsAutoSyncCheckbox').checked;

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

      try {
        const res = await api.saveGoogleSyncConfig({
          webhook_url: webhookUrl,
          sync_enabled: syncEnabled
        });
        showToast(res.message || 'Konfigurasi Google Apps Script berhasil disimpan!', 'success');
        await loadGoogleSyncView();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Simpan & Uji Koneksi';
      }
    });
  }

  const gsTestBtn = document.getElementById('gsTestPingBtn');
  if (gsTestBtn) {
    gsTestBtn.addEventListener('click', async () => {
      const webhookUrl = document.getElementById('gsWebhookUrlInput').value.trim();
      const feedback = document.getElementById('gsTestFeedback');
      
      gsTestBtn.disabled = true;
      gsTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menguji Ping...';
      feedback.textContent = 'Menghubungi Google Apps Script...';
      feedback.className = 'text-xs font-semibold text-slate-500';

      try {
        const res = await api.testGoogleSync(webhookUrl || null);
        if (res.success) {
          feedback.textContent = '✓ Koneksi Berhasil & Respons Valid!';
          feedback.className = 'text-xs font-semibold text-emerald-600';
          showToast('Koneksi Google Sheets & Drive terverifikasi aktif!', 'success');
          await loadGoogleSyncView();
        } else {
          feedback.textContent = '✗ ' + (res.message || 'Gagal terhubung.');
          feedback.className = 'text-xs font-semibold text-red-600';
          showToast(res.message || 'Gagal terhubung ke Google Apps Script', 'error');
        }
      } catch (err) {
        feedback.textContent = '✗ ' + err.message;
        feedback.className = 'text-xs font-semibold text-red-600';
        showToast('Kesalahan uji koneksi: ' + err.message, 'error');
      } finally {
        gsTestBtn.disabled = false;
        gsTestBtn.innerHTML = '<i class="fas fa-network-wired"></i> Tes Ping Saja';
      }
    });
  }

  // Bulk Sync Buttons
  const gsSyncStudentsBtn = document.getElementById('gsSyncStudentsBtn');
  const gsSyncAttBtn = document.getElementById('gsSyncAttendanceBtn');
  const gsSyncSubBtn = document.getElementById('gsSyncSubmissionsBtn');
  const gsProgressBox = document.getElementById('gsSyncProgressBox');
  const gsProgressText = document.getElementById('gsSyncProgressText');

  async function handleBulkSync(actionName, apiFn) {
    if (gsProgressBox) {
      gsProgressBox.classList.remove('hidden');
      gsProgressText.textContent = `Sedang menyinkronkan ${actionName} ke Google Cloud...`;
    }
    try {
      const res = await apiFn();
      if (res.success) {
        showToast(res.message || `Sinkronisasi ${actionName} berhasil!`, 'success');
        await loadGoogleSyncView();
      } else {
        showToast(res.message || `Gagal menyinkronkan ${actionName}. Pastikan URL Web App sudah benar.`, 'error');
      }
    } catch (err) {
      showToast(`Terjadi kesalahan: ${err.message}`, 'error');
    } finally {
      if (gsProgressBox) {
        gsProgressBox.classList.add('hidden');
      }
    }
  }

  if (gsSyncStudentsBtn) {
    gsSyncStudentsBtn.addEventListener('click', () => handleBulkSync('Data Siswa (14 Kelas)', () => api.syncAllStudentsToGoogle()));
  }
  if (gsSyncAttBtn) {
    gsSyncAttBtn.addEventListener('click', () => handleBulkSync('Rekap Presensi Siswa', () => api.syncAllAttendanceToGoogle()));
  }
  if (gsSyncSubBtn) {
    gsSyncSubBtn.addEventListener('click', () => handleBulkSync('Data Tugas & Nilai', () => api.syncAllSubmissionsToGoogle()));
  }

  // Copy Script Code Button
  const gsCopyBtn = document.getElementById('gsCopyScriptCodeBtn');
  const gsCopyText = document.getElementById('gsCopyScriptText');
  const gsCodePre = document.getElementById('gsCodePre');
  if (gsCopyBtn && gsCodePre) {
    gsCopyBtn.addEventListener('click', async () => {
      try {
        const textToCopy = gsCodePre.textContent;
        await navigator.clipboard.writeText(textToCopy);
        gsCopyText.textContent = 'Kode Tersalin! ✓';
        gsCopyBtn.classList.add('bg-emerald-100', 'text-emerald-800');
        showToast('Kode Google Apps Script disalin ke clipboard!', 'success');
        setTimeout(() => {
          gsCopyText.textContent = 'Salin Kode Apps Script';
          gsCopyBtn.classList.remove('bg-emerald-100', 'text-emerald-800');
        }, 3000);
      } catch (err) {
        showToast('Gagal menyalin otomatis. Silakan pilih teks kode dan tekan Ctrl+C.', 'warning');
      }
    });
  }

  // Toggle Code Box Button
  const gsToggleCodeBtn = document.getElementById('gsToggleCodeBoxBtn');
  const gsCodeContainer = document.getElementById('gsCodeContainer');
  const gsCodeChevron = document.getElementById('gsCodeChevron');
  if (gsToggleCodeBtn && gsCodeContainer) {
    gsToggleCodeBtn.addEventListener('click', () => {
      gsCodeContainer.classList.toggle('hidden');
      if (gsCodeChevron) gsCodeChevron.classList.toggle('rotate-180');
    });
  }
}

// Check Authentication on Page Load
async function checkAuthAndInitialize() {
  try {
    const res = await api.getMe();
    currentUser = res.user;
    showAppScreen();
    await onUserAuthenticated();
  } catch (err) {
    // Not logged in -> show dedicated login screen
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
}

// Called once user is logged in
async function onUserAuthenticated() {
  updateUserUI();
  await loadEmergencyStatus();
  await loadDemoAccounts();
  await refreshCurrentView();
}

// User UI Updates (Classroom Redirection & Theme)
function updateUserUI() {
  if (!currentUser) return;

  const isStudent = currentUser.role === 'siswa';

  // Avatar & Name
  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userAvatar').textContent = currentUser.avatar || (isStudent ? '🧑‍💻' : '👨‍🏫');

  // Classroom Badge in Navbar
  const navBadge = document.getElementById('navClassroomBadge');
  const roleBadge = document.getElementById('userRoleBadge');
  const heroClassBadge = document.getElementById('dashClassroomBadgeText');

  if (isStudent) {
    navBadge.textContent = `KELAS ${currentUser.class_name}`;
    navBadge.className = 'bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm';
    roleBadge.innerHTML = `<span class="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold uppercase text-[10px]">${currentUser.class_name} • NISN: ${currentUser.nisn_nip}</span>`;
    heroClassBadge.textContent = `Ruang Kelas Maya: KELAS ${currentUser.class_name} (${currentUser.grade_level})`;

    // Check if using default password
    const warningBanner = document.getElementById('defaultPasswordWarning');
    if (currentUser.is_default_password === 1) {
      warningBanner.classList.remove('hidden');
    } else {
      warningBanner.classList.add('hidden');
    }

    // Role-based elements
    document.getElementById('addAssignmentBtn').classList.add('hidden');
    document.getElementById('addMaterialBtn').classList.add('hidden');
    document.getElementById('editEmergencyBtn').classList.add('hidden');
    document.getElementById('teacherGradeFilterBar').classList.add('hidden');
    document.getElementById('materialsGradeFilterBar').classList.add('hidden');
    document.getElementById('assignmentsGradeFilterBar').classList.add('hidden');
    document.getElementById('studentAttendanceCard').classList.remove('hidden');

    document.getElementById('dashPrimaryAction').textContent = 'Kumpulkan Tugas Saya';
    document.getElementById('dashWelcomeTitle').textContent = `Selamat Belajar di Ruang Kelas ${currentUser.class_name}`;
    
    if (currentUser.grade_level === 'X') {
      document.getElementById('dashWelcomeSubtitle').textContent = `Mata Pelajaran: Informatika & KKA (2 Mapel Fase E). Modul dan penugasan telah disesuaikan dengan kurikulum kelas Anda.`;
      document.getElementById('materialsPageHeading').textContent = `Materi Pembelajaran: Informatika & KKA (Kelas X)`;
      document.getElementById('materialsPageSubheading').textContent = `Modul ajar digital 2 mata pelajaran khusus untuk siswa Ruang Kelas ${currentUser.class_name}.`;
      document.getElementById('assignmentsPageHeading').textContent = `Penugasan Siswa: Informatika & KKA (Kelas X)`;
      document.getElementById('assignmentsPageSubheading').textContent = `Pengumpulan tugas Informatika & KKA untuk Ruang Kelas ${currentUser.class_name}.`;
    } else {
      document.getElementById('dashWelcomeSubtitle').textContent = `Mata Pelajaran: Mulok (Informatika) tingkat Kelas ${currentUser.grade_level}. Modul dan penugasan telah disesuaikan dengan kurikulum kelas Anda.`;
      document.getElementById('materialsPageHeading').textContent = `Materi Pembelajaran: Mulok (Informatika) - Kelas ${currentUser.grade_level}`;
      document.getElementById('materialsPageSubheading').textContent = `Modul ajar digital Muatan Lokal Informatika khusus untuk siswa Ruang Kelas ${currentUser.class_name}.`;
      document.getElementById('assignmentsPageHeading').textContent = `Penugasan Siswa: Mulok (Informatika) - Kelas ${currentUser.grade_level}`;
      document.getElementById('assignmentsPageSubheading').textContent = `Pengumpulan tugas Mulok Informatika untuk Ruang Kelas ${currentUser.class_name}.`;
    }
    
    // Hide Student Management & Google Sync Tab for students
    const navStudentsTab = document.getElementById('navStudentsTab');
    if (navStudentsTab) navStudentsTab.classList.add('hidden');
    const navGoogleSyncTab = document.getElementById('navGoogleSyncTab');
    if (navGoogleSyncTab) navGoogleSyncTab.classList.add('hidden');
    const mobileNavGoogleSyncTab = document.getElementById('mobileNavGoogleSyncTab');
    if (mobileNavGoogleSyncTab) mobileNavGoogleSyncTab.classList.add('hidden');
    const dashGSCard = document.getElementById('dashGoogleSyncCard');
    if (dashGSCard) dashGSCard.classList.add('hidden');
  } else {
    // Teacher
    navBadge.textContent = 'GURU MAPEL';
    navBadge.className = 'bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm';
    roleBadge.innerHTML = `<span class="bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-bold uppercase text-[10px]">GURU (14 KELAS)</span>`;
    heroClassBadge.textContent = 'Panel Guru Mapel: 14 Kelas (X: Infor & KKA, XI-XII: Mulok)';

    document.getElementById('defaultPasswordWarning').classList.add('hidden');
    document.getElementById('addAssignmentBtn').classList.remove('hidden');
    document.getElementById('addMaterialBtn').classList.remove('hidden');
    document.getElementById('editEmergencyBtn').classList.remove('hidden');
    document.getElementById('teacherGradeFilterBar').classList.remove('hidden');
    document.getElementById('materialsGradeFilterBar').classList.remove('hidden');
    document.getElementById('assignmentsGradeFilterBar').classList.remove('hidden');
    document.getElementById('studentAttendanceCard').classList.add('hidden');

    // Show Student Management & Google Sync Tab for teacher
    const navStudentsTab = document.getElementById('navStudentsTab');
    if (navStudentsTab) navStudentsTab.classList.remove('hidden');
    const navGoogleSyncTab = document.getElementById('navGoogleSyncTab');
    if (navGoogleSyncTab) navGoogleSyncTab.classList.remove('hidden');
    const mobileNavGoogleSyncTab = document.getElementById('mobileNavGoogleSyncTab');
    if (mobileNavGoogleSyncTab) mobileNavGoogleSyncTab.classList.remove('hidden');
    const dashGSCardTeacher = document.getElementById('dashGoogleSyncCard');
    if (dashGSCardTeacher) dashGSCardTeacher.classList.remove('hidden');

    document.getElementById('dashPrimaryAction').textContent = 'Kelola & Koreksi Tugas Siswa';
    document.getElementById('dashWelcomeTitle').textContent = `Selamat Datang, ${currentUser.full_name}`;
    document.getElementById('dashWelcomeSubtitle').textContent = 'Mengampu 14 Kelas Daring PJJ: Kelas X (Informatika & KKA), Kelas XI & XII (Mulok Informatika).';

    document.getElementById('materialsPageHeading').textContent = 'Materi Pembelajaran (Informatika, KKA & Mulok)';
    document.getElementById('materialsPageSubheading').textContent = 'Kelola silabus: Kelas X (Informatika & KKA), Kelas XI & XII (Mulok Informatika).';

    document.getElementById('assignmentsPageHeading').textContent = 'Penugasan & Pengumpulan Tugas Siswa';
    document.getElementById('assignmentsPageSubheading').textContent = 'Pemeriksaan pengumpulan tugas koding dan ekspor rekap nilai per kelas.';
  }
}

// Populate Class Directory in Login Page
async function loadClassDirectory() {
  try {
    const res = await api.getClasses();
    schoolClassesData = res.classes;
    const container = document.getElementById('classDirectoryContainer');
    if (!container) return;
    container.innerHTML = '';

    ['X', 'XI', 'XII'].forEach(grade => {
      const gradeSection = document.createElement('div');
      gradeSection.className = 'bg-slate-50 border border-slate-200 rounded-xl p-2.5';

      let gradeTitle = grade === 'X' ? 'Kelas X (Fase E)' : grade === 'XI' ? 'Kelas XI (Fase F)' : 'Kelas XII (Fase F Lanjut)';
      gradeSection.innerHTML = `
        <div class="text-[11px] font-black text-indigo-700 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>${gradeTitle}</span>
          <span class="text-[10px] text-slate-400 font-semibold">${schoolClassesData[grade].length} Kelas</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5" id="dirList_${grade}"></div>
      `;

      const listGrid = gradeSection.querySelector(`#dirList_${grade}`);
      schoolClassesData[grade].forEach(clsObj => {
        const sampleStudent = clsObj.students[0];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 p-2 rounded-lg text-left transition shadow-xs';
        btn.innerHTML = `
          <div class="font-bold text-xs text-slate-800 flex items-center justify-between">
            <span>${clsObj.class_name}</span>
            <span class="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded font-bold">${clsObj.grade_level}</span>
          </div>
          <div class="text-[10px] text-slate-500 truncate mt-0.5">${sampleStudent ? sampleStudent.full_name.split(' ')[0] : 'Siswa'}</div>
          <div class="text-[9px] text-slate-400 font-mono">NISN: ${sampleStudent ? sampleStudent.nisn_nip : '-'}</div>
        `;

        btn.addEventListener('click', () => {
          if (sampleStudent) {
            // Auto fill student login
            document.getElementById('loginTabStudent').click();
            document.getElementById('loginIdentifier').value = sampleStudent.nisn_nip;
            document.getElementById('loginPassword').value = 'sekolah2026';
            showToast(`Mengisi data login untuk ${sampleStudent.full_name} (${clsObj.class_name})`, 'info');
          }
        });

        listGrid.appendChild(btn);
      });

      container.appendChild(gradeSection);
    });

    // Add Teacher sample
    const teacherCard = document.createElement('div');
    teacherCard.className = 'bg-indigo-50/60 border border-indigo-200 rounded-xl p-2.5 flex items-center justify-between cursor-pointer hover:bg-indigo-100 transition';
    teacherCard.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xl">👨‍🏫</span>
        <div>
          <div class="font-bold text-xs text-indigo-950">Akun Guru (Bpk. H. Rahmat Hidayat)</div>
          <div class="text-[10px] text-indigo-700 font-mono">Username: guru_infor / Password: guru123</div>
        </div>
      </div>
      <span class="text-xs font-bold text-indigo-600">Pilih &rarr;</span>
    `;
    teacherCard.onclick = () => {
      document.getElementById('loginTabTeacher').click();
      document.getElementById('loginIdentifier').value = 'guru_infor';
      document.getElementById('loginPassword').value = 'guru123';
      showToast('Mengisi data login akun Guru Informatika & KKA', 'info');
    };
    container.appendChild(teacherCard);

  } catch (err) {
    console.error('Failed to load classes directory:', err);
  }
}

// Emergency & ISPU Status
async function loadEmergencyStatus() {
  try {
    const res = await api.getEmergencyStatus();
    const data = res.data;

    document.getElementById('bannerIspuBadge').textContent = `ISPU ${data.air_quality_index} • ${data.air_quality_category}`;
    document.getElementById('bannerAnnouncementText').textContent = data.pjj_announcement;
    document.getElementById('liveMeetBtn').href = data.live_meet_link;
    document.getElementById('dashIspuVal').textContent = data.air_quality_index;

    document.getElementById('editIspuInput').value = data.air_quality_index;
    document.getElementById('editIspuCategory').value = data.air_quality_category;
    document.getElementById('editAnnouncementText').value = data.pjj_announcement;
    document.getElementById('editLiveMeetUrl').value = data.live_meet_link;
  } catch (err) {
    console.error('Failed to load emergency status:', err);
  }
}

// Demo Accounts Switcher (Navbar)
async function loadDemoAccounts() {
  try {
    const res = await api.getDemoAccounts();
    const listContainer = document.getElementById('demoAccountsList');
    listContainer.innerHTML = '';

    res.users.forEach(user => {
      const btn = document.createElement('button');
      btn.className = 'w-full px-3 py-2 text-left hover:bg-indigo-50 flex items-center space-x-2.5 transition text-xs';
      btn.innerHTML = `
        <span class="text-base">${user.avatar || '👤'}</span>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-slate-800 truncate">${user.full_name}</div>
          <div class="text-[10px] text-slate-500">${user.class_name} • ${user.role.toUpperCase()}</div>
        </div>
        ${currentUser && currentUser.id === user.id ? '<i class="fas fa-check text-indigo-600 text-xs"></i>' : ''}
      `;

      btn.addEventListener('click', async () => {
        try {
          const switchRes = await api.quickLogin(user.username);
          currentUser = switchRes.user;
          updateUserUI();
          showToast(`Beralih ke ${user.full_name} (${user.class_name})`, 'info');
          await loadDemoAccounts();
          await refreshCurrentView();
        } catch (e) {
          showToast(e.message, 'error');
        }
      });

      listContainer.appendChild(btn);
    });
  } catch (err) {
    console.error('Failed to load demo accounts:', err);
  }
}

// Tab Navigation
function navigateTo(tabId) {
  currentTab = tabId;

  document.querySelectorAll('.view-content').forEach(view => {
    view.classList.add('hidden');
  });

  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) {
    activeView.classList.remove('hidden');
  }

  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.mobile-nav-item').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  refreshCurrentView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function refreshCurrentView() {
  if (currentTab === 'dashboard') {
    await loadDashboard();
  } else if (currentTab === 'subjects') {
    await loadSubjectsView();
  } else if (currentTab === 'assignments') {
    await loadAssignments();
    renderAssignmentsList();
  } else if (currentTab === 'attendance') {
    await loadAttendanceView();
  } else if (currentTab === 'discussions') {
    await loadDiscussionsView();
  } else if (currentTab === 'students') {
    await loadStudentsView();
  } else if (currentTab === 'google-sync') {
    await loadGoogleSyncView();
  }
}

// 1. Dashboard View
async function loadDashboard() {
  await Promise.all([loadSubjects(), loadAssignments()]);

  // Render Dashboard Subjects Cards
  const subjectsGrid = document.getElementById('dashSubjectsGrid');
  subjectsGrid.innerHTML = '';
  subjectsList.forEach(s => {
    const card = document.createElement('div');
    card.className = 'border border-slate-200 hover:border-indigo-300 rounded-xl p-4 transition bg-slate-50/50 hover:bg-white hover:shadow-sm cursor-pointer';
    card.onclick = () => {
      navigateTo('subjects');
      selectSubjectTab(s.id);
    };
    const gradeLabel = currentUser.role === 'siswa' 
      ? `Kelas ${currentUser.grade_level}` 
      : (s.grade_level === 'X' ? 'Kelas X' : 'Kelas XI & XII');
    card.innerHTML = `
      <div class="flex items-center gap-3 mb-2">
        <span class="text-2xl">${s.icon || '📚'}</span>
        <div>
          <h3 class="font-bold text-sm text-slate-800">${s.name}</h3>
          <span class="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">${s.code} • ${gradeLabel}</span>
        </div>
      </div>
      <p class="text-xs text-slate-500 line-clamp-2 mt-1">${s.description || ''}</p>
      <div class="mt-3 pt-2 border-t border-slate-200/60 flex justify-between text-[11px] font-medium text-slate-500">
        <span><i class="fas fa-book-reader mr-1"></i>${currentUser.role === 'siswa' ? `Materi ${currentUser.grade_level}` : 'Semua Modul'}</span>
        <span><i class="fas fa-tasks mr-1"></i>${s.assignment_count !== undefined ? s.assignment_count + ' Tugas' : 'Tugas Aktif'}</span>
      </div>
    `;
    subjectsGrid.appendChild(card);
  });

  // Render Dashboard Recent Assignments
  const assignList = document.getElementById('dashAssignmentsList');
  assignList.innerHTML = '';
  const recentAssignments = assignmentsList.slice(0, 3);

  if (recentAssignments.length === 0) {
    assignList.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center">Belum ada tugas untuk tingkat kelas Anda.</div>`;
  } else {
    recentAssignments.forEach(a => {
      const item = document.createElement('div');
      item.className = 'border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer';
      item.onclick = () => navigateTo('assignments');

      let statusBadge = '';
      if (currentUser.role === 'siswa') {
        if (a.status === 'dinilai') {
          statusBadge = `<span class="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded">Nilai: ${a.score}</span>`;
        } else if (a.status === 'dikumpulkan') {
          statusBadge = `<span class="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">Sudah Kumpul</span>`;
        } else {
          statusBadge = `<span class="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded">Belum Kumpul</span>`;
        }
      } else {
        statusBadge = `<span class="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">Kelas ${a.grade_level}</span>`;
      }

      item.innerHTML = `
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold">
            <i class="fas fa-file-alt"></i>
          </div>
          <div>
            <div class="font-bold text-xs text-slate-800 line-clamp-1">${a.title}</div>
            <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
              <span>${a.subject_name}</span>
              <span>•</span>
              <span class="text-orange-600 font-semibold"><i class="far fa-clock mr-1"></i>Batas: ${formatDate(a.due_date)}</span>
            </div>
          </div>
        </div>
        <div>${statusBadge}</div>
      `;
      assignList.appendChild(item);
    });
  }

  // Update Stats Cards
  document.getElementById('dashAssignmentCount').textContent = `${assignmentsList.length} Tugas`;
  const stat4Label = document.getElementById('dashStat4Label');
  const stat4Val = document.getElementById('dashStat4Val');
  const stat4Sub = document.getElementById('dashStat4Sub');

  if (currentUser.role === 'siswa') {
    stat4Label.textContent = 'Tugas Saya';
    const submittedCount = assignmentsList.filter(a => a.status === 'dikumpulkan' || a.status === 'dinilai').length;
    stat4Val.textContent = `${submittedCount} / ${assignmentsList.length}`;
    stat4Sub.textContent = 'Telah Dikumpulkan';
  } else {
    stat4Label.textContent = 'Koreksi Tugas';
    const totalSubmissions = assignmentsList.reduce((acc, a) => acc + (a.total_submitted || 0), 0);
    const totalGraded = assignmentsList.reduce((acc, a) => acc + (a.total_graded || 0), 0);
    stat4Val.textContent = `${totalGraded} / ${totalSubmissions}`;
    stat4Sub.textContent = 'Sudah Dinilai';
  }
}

// 2. Subjects & Materials (Grade Separated)
async function loadSubjects() {
  try {
    const res = await api.getSubjects();
    subjectsList = res.subjects || [];
  } catch (err) {
    console.error('Failed to load subjects:', err);
  }
}

async function loadSubjectsView() {
  await loadSubjects();

  const container = document.getElementById('subjectCardsContainer');
  container.innerHTML = '';

  const pillsContainer = document.getElementById('subjectSelectorPills');
  pillsContainer.innerHTML = '';

  if (subjectsList.length === 0) return;

  if (!currentSelectedSubjectId || !subjectsList.some(s => s.id === currentSelectedSubjectId)) {
    currentSelectedSubjectId = subjectsList[0].id;
  }

  subjectsList.forEach((s) => {
    const isSelected = s.id === currentSelectedSubjectId;
    const card = document.createElement('div');
    card.className = `p-6 rounded-2xl border transition cursor-pointer ${
      isSelected ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200 bg-white hover:border-indigo-300'
    }`;
    card.onclick = () => selectSubjectTab(s.id);
    const gradeSubtitle = currentUser.role === 'siswa'
      ? `Tingkat ${currentUser.grade_level} (${currentUser.class_name})`
      : (s.grade_level === 'X' ? 'Khusus Kelas X (Fase E)' : 'Khusus Kelas XI & XII (Fase F)');
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-2xl">
            ${s.icon || '📚'}
          </div>
          <div>
            <h3 class="font-extrabold text-base text-slate-800">${s.name}</h3>
            <p class="text-xs text-indigo-600 font-semibold">${gradeSubtitle}</p>
          </div>
        </div>
        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}">
          ${currentUser.role === 'siswa' ? 'Modul ' + currentUser.grade_level : (s.grade_level === 'X' ? 'Kelas X' : 'Kelas XI & XII')}
        </span>
      </div>
      <p class="text-xs text-slate-600 mt-3 leading-relaxed">${s.description || ''}</p>
      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span><i class="fas fa-chalkboard-teacher mr-1 text-slate-400"></i> ${s.teacher_name || 'Bpk. Rahmat'}</span>
        <span class="text-indigo-600 font-bold hover:underline">Buka Silabus &rarr;</span>
      </div>
    `;
    container.appendChild(card);

    // Pill Selector
    const pill = document.createElement('button');
    pill.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition ${
      isSelected ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
    }`;
    pill.textContent = s.code === 'MULOK_INFOR' ? 'Mulok Informatika' : s.name.length > 20 ? s.code : s.name;
    pill.onclick = () => selectSubjectTab(s.id);
    pillsContainer.appendChild(pill);
  });

  await loadMaterialsForSubject(currentSelectedSubjectId);
}

async function selectSubjectTab(subjectId) {
  currentSelectedSubjectId = subjectId;
  const sub = subjectsList.find(s => s.id === subjectId);
  if (sub) {
    document.getElementById('currentSubjectTitle').textContent = sub.name;
    document.getElementById('currentSubjectIcon').textContent = sub.icon || '💻';
    document.getElementById('currentSubjectDesc').textContent = currentUser.role === 'siswa' 
      ? `Daftar Modul Tingkat ${currentUser.grade_level} (${currentUser.class_name})` 
      : `Daftar Modul & Bahan Ajar (${sub.grade_level === 'X' ? 'Kelas X' : 'Kelas XI & XII'})`;
  }
  await loadSubjectsView();
}

async function loadMaterialsForSubject(subjectId) {
  try {
    const gradeParam = currentUser.role === 'guru' && currentTeacherGradeFilter !== 'ALL' ? currentTeacherGradeFilter : '';
    const res = await api.getMaterials(subjectId, gradeParam);
    const container = document.getElementById('materialsListContainer');
    container.innerHTML = '';

    if (!res.materials || res.materials.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Belum ada modul ajar yang ditambahkan untuk kriteria ini.</div>`;
      return;
    }

    res.materials.forEach((m, idx) => {
      const item = document.createElement('div');
      item.className = 'border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition bg-white';
      
      const gradeBadge = m.grade_level === 'ALL' 
        ? '<span class="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">Semua Tingkat</span>' 
        : `<span class="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Kelas ${m.grade_level}</span>`;

      item.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">${idx + 1}</span>
            ${gradeBadge}
            <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">${m.topic || 'Umum'}</span>
            <h4 class="font-bold text-sm text-slate-800">${m.title}</h4>
          </div>
          <div class="flex items-center space-x-2">
            ${m.video_url ? '<span class="text-[11px] text-red-600 bg-red-50 px-2 py-0.5 rounded font-bold"><i class="fab fa-youtube mr-1"></i>Video</span>' : ''}
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition shadow-sm read-mat-btn">
              Baca Materi & Kode
            </button>
          </div>
        </div>
        <p class="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-3">${m.content.replace(/[#*`]/g, '').substring(0, 220)}...</p>
        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
          <span><i class="far fa-user mr-1"></i>${m.author_name || 'Guru'}</span>
          <span><i class="far fa-calendar-alt mr-1"></i>${formatDate(m.created_at)}</span>
        </div>
      `;

      item.querySelector('.read-mat-btn').onclick = () => openReadMaterialModal(m);
      container.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load materials:', err);
  }
}

function openReadMaterialModal(m) {
  document.getElementById('readMatTopic').textContent = m.topic || 'Umum';
  document.getElementById('readMatGrade').textContent = m.grade_level === 'ALL' ? 'Semua Tingkat' : `Kelas ${m.grade_level}`;
  document.getElementById('readMatTitle').textContent = m.title;
  document.getElementById('readMatAuthor').textContent = `Oleh: ${m.author_name || 'Guru'}`;
  document.getElementById('readMatDate').textContent = formatDate(m.created_at);

  const videoContainer = document.getElementById('readMatVideoContainer');
  const videoLink = document.getElementById('readMatVideoLink');
  if (m.video_url) {
    videoContainer.classList.remove('hidden');
    videoLink.href = m.video_url;
  } else {
    videoContainer.classList.add('hidden');
  }

  document.getElementById('readMatBody').textContent = m.content;
  openModal('readMaterialModal');
}

// 3. Assignments & Submissions (Grade Separated)
async function loadAssignments() {
  try {
    const gradeParam = currentUser.role === 'guru' && currentTeacherGradeFilter !== 'ALL' ? currentTeacherGradeFilter : '';
    const res = await api.getAssignments(gradeParam);
    assignmentsList = res.assignments || [];
    if (currentFilter !== 'all' && !subjectsList.some(s => s.code === currentFilter)) {
      currentFilter = 'all';
    }
  } catch (err) {
    console.error('Failed to load assignments:', err);
  }
}

// Render Dynamic Subject Filters on Assignments Page
function renderAssignmentSubjectFilters() {
  const container = document.getElementById('assignSubjectFilterContainer');
  if (!container) return;

  container.innerHTML = '<span class="mr-1">Filter Mapel:</span>';

  // "Semua" button
  const allBtn = document.createElement('button');
  allBtn.className = `assign-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
    currentFilter === 'all' ? 'active bg-white shadow-sm font-bold text-indigo-600' : 'text-slate-600 hover:bg-white/60'
  }`;
  allBtn.textContent = 'Semua';
  allBtn.onclick = () => {
    currentFilter = 'all';
    renderAssignmentsList();
  };
  container.appendChild(allBtn);

  subjectsList.forEach(s => {
    const btn = document.createElement('button');
    const isActive = currentFilter === s.code;
    btn.className = `assign-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
      isActive ? 'active bg-white shadow-sm font-bold text-indigo-600' : 'text-slate-600 hover:bg-white/60'
    }`;
    btn.textContent = s.code === 'MULOK_INFOR' ? 'Mulok (Informatika)' : s.name.length > 20 ? s.code : s.name;
    btn.onclick = () => {
      currentFilter = s.code;
      renderAssignmentsList();
    };
    container.appendChild(btn);
  });
}

function renderAssignmentsList() {
  renderAssignmentSubjectFilters();

  const container = document.getElementById('assignmentsListContainer');
  container.innerHTML = '';

  let filtered = assignmentsList;
  if (currentFilter !== 'all') {
    filtered = assignmentsList.filter(a => a.subject_code === currentFilter || (a.subject_code && a.subject_code.includes(currentFilter)));
  }

  document.getElementById('assignmentCountBadge').textContent = `Menampilkan ${filtered.length} dari ${assignmentsList.length} Tugas`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">Tidak ada penugasan untuk kategori ini.</div>`;
    return;
  }

  filtered.forEach(a => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-indigo-300 transition flex flex-col md:flex-row md:items-center justify-between gap-5';

    const isStudent = currentUser && currentUser.role === 'siswa';
    const dueTime = new Date(a.due_date);
    const now = new Date();
    const isExpired = now > dueTime;

    let statusPill = '';
    let actionButtons = '';

    if (isStudent) {
      if (a.status === 'dinilai') {
        statusPill = `<span class="bg-indigo-100 text-indigo-700 text-xs font-black px-2.5 py-1 rounded-full border border-indigo-200"><i class="fas fa-star mr-1"></i>Nilai: ${a.score} / ${a.max_score}</span>`;
        actionButtons = `
          <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm open-submit-btn">
            <i class="fas fa-eye mr-1"></i> Lihat Hasil & Feedback
          </button>
        `;
      } else if (a.status === 'dikumpulkan') {
        const lateBadge = a.is_late ? '<span class="text-red-500 font-bold ml-1">(Terlambat)</span>' : '';
        statusPill = `<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200"><i class="fas fa-check-circle mr-1"></i>Sudah Dikumpulkan ${lateBadge}</span>`;
        actionButtons = `
          <button class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm open-submit-btn">
            <i class="fas fa-edit mr-1"></i> Edit Pengumpulan
          </button>
        `;
      } else {
        if (isExpired) {
          statusPill = `<span class="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200"><i class="fas fa-exclamation-triangle mr-1"></i>Lewat Batas Waktu</span>`;
        } else {
          statusPill = `<span class="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200"><i class="far fa-clock mr-1"></i>Belum Mengumpulkan</span>`;
        }
        actionButtons = `
          <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md open-submit-btn">
            <i class="fas fa-upload mr-1"></i> Kumpulkan Tugas
          </button>
        `;
      }
    } else {
      // Teacher view
      statusPill = `
        <span class="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full">
          <i class="fas fa-users mr-1"></i> ${a.total_submitted || 0} Terkumpul (${a.total_graded || 0} Dinilai)
        </span>
      `;
      actionButtons = `
        <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md open-grading-btn">
          <i class="fas fa-tasks mr-1"></i> Periksa Pengumpulan Siswa
        </button>
      `;
    }

    const gradeLabel = a.grade_level === 'ALL' ? 'Semua Tingkat' : `Kelas ${a.grade_level}`;

    card.innerHTML = `
      <div class="flex-1 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
            ${a.subject_name}
          </span>
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700">
            ${gradeLabel}
          </span>
          ${statusPill}
        </div>
        <h3 class="text-base font-bold text-slate-800">${a.title}</h3>
        <p class="text-xs text-slate-600 line-clamp-2 leading-relaxed">${a.description}</p>
        <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
          <span class="flex items-center text-orange-600 font-semibold">
            <i class="far fa-calendar-alt mr-1.5"></i> Batas: ${formatDate(a.due_date)}
          </span>
          <span><i class="fas fa-award mr-1 text-slate-400"></i> Maks: ${a.max_score}</span>
          ${a.attachment_path ? `
            <a href="/api/submissions/attachment/${a.id}" target="_blank" class="text-indigo-600 font-bold hover:underline flex items-center">
              <i class="fas fa-paperclip mr-1"></i> Unduh Lampiran Soal
            </a>
          ` : ''}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        ${actionButtons}
      </div>
    `;

    if (isStudent) {
      card.querySelector('.open-submit-btn').onclick = () => openSubmitModal(a);
    } else {
      card.querySelector('.open-grading-btn').onclick = () => openGradingModal(a.id);
    }

    container.appendChild(card);
  });
}

// Student Submission Modal
async function openSubmitModal(assignment) {
  try {
    const res = await api.getAssignment(assignment.id);
    const assignData = res.assignment;
    const subData = res.userSubmission;

    document.getElementById('subModalAssignmentId').value = assignData.id;
    document.getElementById('subModalAssignmentTitle').textContent = assignData.title;
    document.getElementById('subModalSubject').textContent = `${assignData.subject_name} • Kelas ${assignData.grade_level}`;
    document.getElementById('subModalDueDate').textContent = formatDate(assignData.due_date);

    const isExpired = new Date() > new Date(assignData.due_date);
    const deadlineEl = document.getElementById('subModalDeadlineStatus');
    if (isExpired) {
      deadlineEl.innerHTML = `<span class="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded text-[11px]"><i class="fas fa-exclamation-triangle mr-1"></i>Sudah Melewati Batas Waktu</span>`;
    } else {
      deadlineEl.innerHTML = `<span class="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px]"><i class="fas fa-check-circle mr-1"></i>Masih Dalam Waktu Pengerjaan</span>`;
    }

    const fileLabel = document.getElementById('selectedFileName');
    if (subData) {
      document.getElementById('subExternalLink').value = subData.external_link || '';
      document.getElementById('subTextAnswer').value = subData.text_answer || '';
      if (subData.original_filename) {
        fileLabel.innerHTML = `File sebelumnya: <a href="/api/submissions/download/${subData.id}" class="underline text-indigo-700">${subData.original_filename}</a>`;
        fileLabel.classList.remove('hidden');
      } else {
        fileLabel.classList.add('hidden');
      }

      if (subData.score !== null && subData.score !== undefined) {
        showToast(`Tugas ini sudah dinilai guru: ${subData.score} / 100`, 'info');
      }
    } else {
      document.getElementById('subExternalLink').value = '';
      document.getElementById('subTextAnswer').value = '';
      fileLabel.classList.add('hidden');
    }

    openModal('submitModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Teacher Grading Modal with Class Filter
async function openGradingModal(assignmentId) {
  try {
    const classFilterSelect = document.getElementById('gradingClassFilter');
    const selectedClass = classFilterSelect.value || 'ALL';

    const res = await api.getSubmissions(assignmentId, selectedClass === 'ALL' ? '' : selectedClass);
    const assign = res.assignment;
    const submissions = res.submissions;

    document.getElementById('gradingModalTitle').textContent = `Koreksi Tugas: ${assign.title}`;
    document.getElementById('gradingModalSubtitle').textContent = `Tingkat ${assign.grade_level} • Batas: ${formatDate(assign.due_date)}`;

    const exportBtn = document.getElementById('exportCsvBtn');
    exportBtn.href = `/api/assignments/${assignmentId}/export-csv${selectedClass !== 'ALL' ? '?class_name=' + selectedClass : ''}`;
    exportBtn.setAttribute('data-assign-id', assignmentId);

    // Populate class filter dropdown based on assignment grade level
    classFilterSelect.innerHTML = '<option value="ALL">Semua Kelas</option>';
    if (schoolClassesData) {
      const targetGrades = assign.grade_level === 'ALL' ? ['X', 'XI', 'XII'] : [assign.grade_level];
      targetGrades.forEach(g => {
        if (schoolClassesData[g]) {
          schoolClassesData[g].forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.class_name;
            opt.textContent = `Kelas ${c.class_name}`;
            if (c.class_name === selectedClass) opt.selected = true;
            classFilterSelect.appendChild(opt);
          });
        }
      });
    }

    classFilterSelect.onchange = () => openGradingModal(assignmentId);

    const tbody = document.getElementById('gradingTableBody');
    tbody.innerHTML = '';

    if (submissions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 text-xs">Belum ada siswa terdaftar pada kelas yang dipilih.</td></tr>`;
      openModal('gradingModal');
      return;
    }

    submissions.forEach(sub => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

      let fileOrLinkContent = '-';
      if (sub.original_filename) {
        fileOrLinkContent = `
          <a href="/api/submissions/download/${sub.submission_id}" class="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            <i class="fas fa-file-download"></i> ${sub.original_filename}
          </a>
        `;
      } else if (sub.external_link) {
        fileOrLinkContent = `
          <a href="${sub.external_link}" target="_blank" class="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-800 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
            <i class="fas fa-external-link-alt"></i> Tautan Proyek
          </a>
        `;
      }

      let scoreContent = '-';
      if (sub.score !== null && sub.score !== undefined) {
        scoreContent = `<span class="font-extrabold text-sm text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">${sub.score}</span>`;
      } else if (sub.submission_id) {
        scoreContent = `<span class="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">Menunggu Nilai</span>`;
      } else {
        scoreContent = `<span class="text-xs text-slate-400">Belum Kumpul</span>`;
      }

      tr.innerHTML = `
        <td class="p-3">
          <div class="flex items-center space-x-2.5">
            <span class="text-xl">${sub.avatar || '🧑‍💻'}</span>
            <div>
              <div class="font-bold text-xs text-slate-800">${sub.student_name}</div>
              <div class="text-[10px] text-slate-500">
                <span class="bg-indigo-100 text-indigo-800 font-bold px-1 rounded">${sub.class_name}</span> • NISN: ${sub.nisn_nip}
              </div>
            </div>
          </div>
        </td>
        <td class="p-3 text-xs text-slate-600">
          ${sub.submitted_at ? formatDate(sub.submitted_at) : '<span class="text-slate-400">-</span>'}
          ${sub.is_late ? '<span class="text-red-600 font-bold text-[10px] block">Terlambat</span>' : ''}
        </td>
        <td class="p-3">${fileOrLinkContent}</td>
        <td class="p-3">${scoreContent}</td>
        <td class="p-3 text-right">
          ${sub.submission_id ? `
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm grade-btn">
              <i class="fas fa-edit mr-1"></i> ${sub.score !== null ? 'Ubah Nilai' : 'Beri Nilai'}
            </button>
          ` : `
            <span class="text-xs text-slate-400 italic">Belum Mengumpulkan</span>
          `}
        </td>
      `;

      if (sub.submission_id) {
        tr.querySelector('.grade-btn').onclick = () => openGradeStudentModal(sub);
      }

      tbody.appendChild(tr);
    });

    openModal('gradingModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openGradeStudentModal(sub) {
  document.getElementById('gradeSubmissionId').value = sub.submission_id;
  document.getElementById('gradeStudentName').textContent = `Siswa: ${sub.student_name} (Kelas ${sub.class_name} • NISN: ${sub.nisn_nip})`;
  document.getElementById('gradeScoreInput').value = sub.score !== null ? sub.score : '';
  document.getElementById('gradeFeedbackInput').value = sub.feedback || '';
  document.getElementById('gradeStudentTextAnswer').textContent = sub.text_answer || 'Tidak ada catatan teks.';

  const linkCont = document.getElementById('gradeStudentLinkContainer');
  const linkEl = document.getElementById('gradeStudentLink');
  if (sub.external_link) {
    linkCont.classList.remove('hidden');
    linkEl.href = sub.external_link;
  } else {
    linkCont.classList.add('hidden');
  }

  const fileCont = document.getElementById('gradeStudentFileContainer');
  const fileDl = document.getElementById('gradeStudentDownloadBtn');
  if (sub.file_path) {
    fileCont.classList.remove('hidden');
    fileDl.href = `/api/submissions/download/${sub.submission_id}`;
  } else {
    fileCont.classList.add('hidden');
  }

  openModal('gradeStudentModal');
}

// 4. Attendance View
async function loadAttendanceView() {
  populateSubjectSelect('attSubjectSelect');

  try {
    const res = await api.getTodayAttendance();
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '';

    const records = res.records || [];
    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 text-xs">Belum ada catatan presensi untuk hari ini (${res.today}).</td></tr>`;
      return;
    }

    records.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-slate-50 transition';

      let statusBadge = '';
      if (r.status === 'Hadir') {
        statusBadge = '<span class="bg-emerald-100 text-emerald-800 font-bold text-xs px-2.5 py-0.5 rounded-full"><i class="fas fa-check-circle mr-1"></i>Hadir</span>';
      } else if (r.status === 'Sakit') {
        statusBadge = '<span class="bg-red-100 text-red-800 font-bold text-xs px-2.5 py-0.5 rounded-full"><i class="fas fa-procedures mr-1"></i>Sakit</span>';
      } else {
        statusBadge = '<span class="bg-amber-100 text-amber-800 font-bold text-xs px-2.5 py-0.5 rounded-full"><i class="fas fa-info-circle mr-1"></i>Izin</span>';
      }

      tr.innerHTML = `
        <td class="p-3 text-xs font-semibold text-slate-600">${r.date}</td>
        <td class="p-3 text-xs font-bold text-slate-800">${r.student_name || currentUser.full_name}</td>
        <td class="p-3 text-xs font-bold text-indigo-700">${r.class_name || currentUser.class_name}</td>
        <td class="p-3 text-xs font-semibold text-slate-700">${r.subject_name}</td>
        <td class="p-3">${statusBadge}</td>
        <td class="p-3 text-xs text-slate-600 italic">${r.health_notes || '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load attendance:', err);
  }
}

// 5. Discussions View
async function loadDiscussionsView() {
  await loadSubjects();
  if (subjectsList.length === 0) return;

  const subjectId = currentSelectedSubjectId || subjectsList[0].id;
  try {
    const res = await api.getDiscussions(subjectId);
    const container = document.getElementById('discussionThreadsContainer');
    container.innerHTML = '';

    const threads = res.threads || [];
    if (threads.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">Belum ada diskusi untuk kelas ini. Jadilah yang pertama bertanya!</div>`;
      return;
    }

    threads.forEach(t => {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3';
      card.innerHTML = `
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-2.5">
            <span class="text-2xl">${t.author_avatar || '👤'}</span>
            <div>
              <h4 class="font-bold text-sm text-slate-800">${t.title}</h4>
              <div class="text-[11px] text-slate-500 flex items-center gap-2">
                <span class="font-semibold text-indigo-600">${t.author_name} (${t.author_role.toUpperCase()})</span>
                <span>•</span>
                <span>${formatDate(t.created_at)}</span>
              </div>
            </div>
          </div>
          <span class="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            <i class="far fa-comment-dots mr-1"></i>${t.reply_count || 0} Balasan
          </span>
        </div>
        <p class="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">${t.message}</p>
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button class="text-xs font-bold text-indigo-600 hover:text-indigo-800 view-replies-btn flex items-center gap-1.5">
            <i class="fas fa-reply"></i> Lihat & Balas Diskusi
          </button>
        </div>
        <div class="replies-box hidden pt-3 border-t border-slate-100 space-y-3">
          <div class="replies-list space-y-2 text-xs"></div>
          <div class="flex gap-2 pt-2">
            <input type="text" placeholder="Tuliskan balasan Anda..." class="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs outline-none reply-input">
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition send-reply-btn">
              Kirim
            </button>
          </div>
        </div>
      `;

      const viewBtn = card.querySelector('.view-replies-btn');
      const repliesBox = card.querySelector('.replies-box');
      const repliesList = card.querySelector('.replies-list');
      const replyInput = card.querySelector('.reply-input');
      const sendBtn = card.querySelector('.send-reply-btn');

      viewBtn.onclick = async () => {
        repliesBox.classList.toggle('hidden');
        if (!repliesBox.classList.contains('hidden')) {
          const detail = await api.getDiscussion(t.id);
          renderReplies(detail.replies, repliesList);
        }
      };

      sendBtn.onclick = async () => {
        const val = replyInput.value.trim();
        if (!val) return;
        try {
          await api.replyDiscussion(t.id, val);
          replyInput.value = '';
          const detail = await api.getDiscussion(t.id);
          renderReplies(detail.replies, repliesList);
        } catch (e) {
          showToast(e.message, 'error');
        }
      };

      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load discussions:', err);
  }
}

function renderReplies(replies, container) {
  container.innerHTML = '';
  if (!replies || replies.length === 0) {
    container.innerHTML = '<div class="text-slate-400 italic">Belum ada balasan.</div>';
    return;
  }
  replies.forEach(r => {
    const rEl = document.createElement('div');
    rEl.className = 'bg-slate-50 rounded-xl p-2.5 border border-slate-200/60';
    rEl.innerHTML = `
      <div class="flex items-center justify-between text-[11px] mb-1">
        <span class="font-bold text-slate-800">${r.author_name} <span class="text-indigo-600 font-semibold">(${r.author_role.toUpperCase()})</span></span>
        <span class="text-slate-400">${formatDate(r.created_at)}</span>
      </div>
      <p class="text-xs text-slate-700 leading-relaxed">${r.message}</p>
    `;
    container.appendChild(rEl);
  });
}

// Ensure School Classes Data is Loaded
async function ensureSchoolClassesLoaded() {
  if (!schoolClassesData) {
    try {
      const res = await api.getClasses();
      schoolClassesData = res.classes;
    } catch (e) {
      console.error('Error loading school classes:', e);
    }
  }
}

// Utility: Setup Grade & Class Dropdowns for Forms
function setupGradeAndClassDropdowns(gradeSelectId, classSelectId) {
  const gradeSel = document.getElementById(gradeSelectId);
  const classSel = document.getElementById(classSelectId);
  if (!gradeSel || !classSel) return;

  async function updateClassOptions() {
    await ensureSchoolClassesLoaded();
    const selectedGrade = gradeSel.value;
    classSel.innerHTML = '';

    // If it's target class for assignments/materials, allow "ALL"
    if (classSelectId !== 'newStudentClass') {
      const allOpt = document.createElement('option');
      allOpt.value = 'ALL';
      allOpt.textContent = 'Semua Kelas';
      classSel.appendChild(allOpt);
    }

    if (schoolClassesData && schoolClassesData[selectedGrade]) {
      schoolClassesData[selectedGrade].forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.class_name;
        opt.textContent = `Kelas ${c.class_name}`;
        classSel.appendChild(opt);
      });
    }
  }

  gradeSel.onchange = updateClassOptions;
  updateClassOptions();
}

// Utility: Populate Subject Dropdowns
function populateSubjectSelect(elementId) {
  const sel = document.getElementById(elementId);
  if (!sel) return;
  sel.innerHTML = '';
  subjectsList.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    let gradeLabel = s.grade_level === 'X' ? 'Kelas X' : s.grade_level === 'XI,XII' ? 'Kelas XI & XII' : `Kelas ${s.grade_level}`;
    opt.textContent = `${s.name} (${gradeLabel})`;
    sel.appendChild(opt);
  });
}

// Utility: Date Formatter
function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Modal Helpers
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('hidden');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
}

function openChangePasswordModal() {
  const sub = document.getElementById('changePasswordSub');
  if (sub && currentUser) {
    sub.textContent = `Akun: ${currentUser.full_name} (${currentUser.class_name})`;
  }
  openModal('changePasswordModal');
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');

  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-slate-900 text-white'
  };

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };

  toast.className = `${bgColors[type] || bgColors.info} px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2.5 text-xs font-semibold pointer-events-auto transform transition-all duration-300 translate-y-2 opacity-0`;
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 7. Student Management Functions (Admin / Guru)
async function populateStudentClassFilterDropdown() {
  await ensureSchoolClassesLoaded();
  const gradeEl = document.getElementById('studentFilterGrade');
  const classEl = document.getElementById('studentFilterClass');
  if (!gradeEl || !classEl) return;

  const selectedGrade = gradeEl.value;
  classEl.innerHTML = '<option value="ALL">Semua Kelas (14)</option>';

  if (selectedGrade === 'ALL') {
    if (schoolClassesData) {
      ['X', 'XI', 'XII'].forEach(g => {
        if (schoolClassesData[g]) {
          schoolClassesData[g].forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.class_name;
            opt.textContent = `Kelas ${c.class_name}`;
            classEl.appendChild(opt);
          });
        }
      });
    }
  } else {
    if (schoolClassesData && schoolClassesData[selectedGrade]) {
      schoolClassesData[selectedGrade].forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.class_name;
        opt.textContent = `Kelas ${c.class_name}`;
        classEl.appendChild(opt);
      });
    }
  }
}

async function loadStudentsView() {
  const tableBody = document.getElementById('studentsTableBody');
  if (!tableBody) return;

  await ensureSchoolClassesLoaded();
  populateStudentClassFilterDropdown();

  const gradeFilter = document.getElementById('studentFilterGrade')?.value || 'ALL';
  const classFilter = document.getElementById('studentFilterClass')?.value || 'ALL';
  const searchQuery = document.getElementById('studentSearchInput')?.value || '';

  tableBody.innerHTML = `
    <tr>
      <td colspan="5" class="p-8 text-center text-slate-400">
        <i class="fas fa-spinner fa-spin text-lg mr-2 text-indigo-600"></i> Memuat data siswa...
      </td>
    </tr>
  `;

  try {
    const res = await api.getStudents(gradeFilter, classFilter, searchQuery);
    const { students, totalStats } = res;

    // Update Statistics
    if (totalStats) {
      const totEl = document.getElementById('statStudentTotal');
      const xEl = document.getElementById('statStudentGradeX');
      const xiEl = document.getElementById('statStudentGradeXI');
      const xiiEl = document.getElementById('statStudentGradeXII');

      if (totEl) totEl.textContent = totalStats.total || 0;
      if (xEl) xEl.textContent = totalStats.gradeX || 0;
      if (xiEl) xiEl.textContent = totalStats.gradeXI || 0;
      if (xiiEl) xiiEl.textContent = totalStats.gradeXII || 0;
    }

    if (!students || students.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="p-8 text-center text-slate-400">
            <i class="fas fa-user-slash text-2xl mb-2 block"></i>
            Tidak ada data siswa yang cocok dengan kriteria pencarian/filter.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = '';
    students.forEach(st => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/80 transition';

      const passStatusBadge = st.is_default_password === 1
        ? `<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
             <i class="fas fa-exclamation-triangle"></i> Default (sekolah2026)
           </span>`
        : `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
             <i class="fas fa-shield-alt"></i> Sandi Pribadi Siswa
           </span>`;

      const studentPass = st.plain_password || 'sekolah2026';
      const lastLoginDisplay = st.last_login_at 
        ? new Date(st.last_login_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
        : 'Belum pernah login';

      tr.innerHTML = `
        <td class="p-3.5 flex items-center gap-2.5">
          <span class="text-xl">${st.avatar || '🧑‍💻'}</span>
          <div>
            <div class="font-bold text-slate-800">${st.full_name}</div>
            <div class="text-[11px] text-slate-400 font-mono">${st.username}</div>
          </div>
        </td>
        <td class="p-3.5 font-mono font-bold text-slate-700">
          ${st.nisn_nip}
        </td>
        <td class="p-3.5">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
            st.grade_level === 'X' ? 'bg-purple-50 text-purple-700' :
            st.grade_level === 'XI' ? 'bg-blue-50 text-blue-700' :
            'bg-emerald-50 text-emerald-700'
          }">
            <i class="fas fa-chalkboard"></i> Kelas ${st.class_name}
          </span>
        </td>
        <td class="p-3.5">
          <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 w-fit shadow-2xs">
            <span class="font-mono text-xs font-bold text-slate-800 student-pass-text select-all" data-pass="${studentPass}" data-hidden="true">••••••••</span>
            <button type="button" class="btn-toggle-eye text-slate-400 hover:text-indigo-600 p-0.5 ml-1 transition" title="Lihat Sandi">
              <i class="fas fa-eye text-xs"></i>
            </button>
            <button type="button" class="btn-copy-pass text-slate-400 hover:text-emerald-600 p-0.5 transition" title="Salin Sandi">
              <i class="fas fa-copy text-xs"></i>
            </button>
          </div>
          <div class="mt-1">${passStatusBadge}</div>
        </td>
        <td class="p-3.5">
          <div class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full ${st.last_login_at ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}"></span>
            <span>${lastLoginDisplay}</span>
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5">Tersinkron di Log_Login_Siswa</div>
        </td>
        <td class="p-3.5 text-right space-x-1.5">
          <button class="btn-reset-pass text-xs bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-semibold px-2.5 py-1 rounded-lg border border-slate-200 transition" title="Reset kata sandi siswa ke sekolah2026" data-id="${st.id}" data-name="${st.full_name}" data-class="${st.class_name}">
            <i class="fas fa-key text-[10px]"></i> Reset Sandi
          </button>
          <button class="btn-delete-student text-xs bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 font-semibold px-2.5 py-1 rounded-lg border border-slate-200 transition" title="Hapus siswa" data-id="${st.id}" data-name="${st.full_name}">
            <i class="fas fa-trash-alt text-[10px]"></i>
          </button>
        </td>
      `;

      // Eye toggle password button
      const eyeBtn = tr.querySelector('.btn-toggle-eye');
      const passText = tr.querySelector('.student-pass-text');
      if (eyeBtn && passText) {
        eyeBtn.addEventListener('click', () => {
          const isHidden = passText.getAttribute('data-hidden') === 'true';
          if (isHidden) {
            passText.textContent = passText.getAttribute('data-pass');
            passText.setAttribute('data-hidden', 'false');
            eyeBtn.innerHTML = '<i class="fas fa-eye-slash text-xs text-indigo-600"></i>';
          } else {
            passText.textContent = '••••••••';
            passText.setAttribute('data-hidden', 'true');
            eyeBtn.innerHTML = '<i class="fas fa-eye text-xs"></i>';
          }
        });
      }

      // Copy password button
      const copyBtn = tr.querySelector('.btn-copy-pass');
      if (copyBtn && passText) {
        copyBtn.addEventListener('click', async () => {
          const pwd = passText.getAttribute('data-pass');
          try {
            await navigator.clipboard.writeText(pwd);
            showToast(`Kata sandi siswa ${st.full_name} (${pwd}) berhasil disalin!`, 'success');
          } catch (e) {
            showToast(`Kata sandi: ${pwd}`, 'info');
          }
        });
      }

      tr.querySelector('.btn-reset-pass').addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const name = e.currentTarget.getAttribute('data-name');
        const cls = e.currentTarget.getAttribute('data-class');
        if (confirm(`Reset kata sandi siswa ${name} (${cls}) kembali ke default "sekolah2026"?`)) {
          try {
            const r = await api.resetStudentPassword(id);
            showToast(r.message, 'success');
            await loadStudentsView();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });

      tr.querySelector('.btn-delete-student').addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const name = e.currentTarget.getAttribute('data-name');
        if (confirm(`Yakin ingin menghapus siswa ${name}? Tindakan ini tidak dapat dibatalkan.`)) {
          try {
            const r = await api.deleteStudent(id);
            showToast(r.message, 'success');
            await loadStudentsView();
            await loadClassDirectory();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });

      tableBody.appendChild(tr);
    });
  } catch (err) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-red-500 font-semibold">
          <i class="fas fa-exclamation-triangle mr-1"></i> Gagal memuat data siswa: ${err.message}
        </td>
      </tr>
    `;
  }
}

// 8. Google Drive & Sheets Integration View
async function loadGoogleSyncView() {
  const badge = document.getElementById('gsLiveStatusBadge');
  const sheetBtn = document.getElementById('gsOpenSheetBtn');
  const sheetStatus = document.getElementById('gsSheetStatusText');
  const driveBtn = document.getElementById('gsOpenDriveBtn');
  const driveStatus = document.getElementById('gsDriveStatusText');
  const lastSyncStatus = document.getElementById('gsLastSyncStatus');
  const lastSyncTime = document.getElementById('gsLastSyncTime');
  const autoSyncBadge = document.getElementById('gsAutoSyncStatusBadge');
  const urlInput = document.getElementById('gsWebhookUrlInput');
  const autoCheckbox = document.getElementById('gsAutoSyncCheckbox');
  const codePre = document.getElementById('gsCodePre');

  try {
    const res = await api.getGoogleSyncConfig();
    const config = res.config;

    if (config.configured && config.webhook_url) {
      if (badge) {
        badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Terhubung ke Google Apps Script';
      }
      if (urlInput) urlInput.value = config.webhook_url;
    } else {
      if (badge) {
        badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span> Belum Dikonfigurasi';
      }
      if (urlInput) urlInput.value = '';
    }

    if (autoCheckbox) autoCheckbox.checked = config.sync_enabled;
    if (autoSyncBadge) {
      if (config.sync_enabled) {
        autoSyncBadge.textContent = 'Otomatis Aktif';
        autoSyncBadge.className = 'text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md';
      } else {
        autoSyncBadge.textContent = 'Nonaktif';
        autoSyncBadge.className = 'text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md';
      }
    }

    if (sheetBtn && sheetStatus) {
      if (config.spreadsheet_url) {
        sheetBtn.href = config.spreadsheet_url;
        sheetBtn.classList.remove('opacity-50', 'pointer-events-none');
        sheetStatus.textContent = 'Siap dibuka di Google';
      } else {
        sheetBtn.href = 'https://docs.google.com/spreadsheets';
        sheetStatus.textContent = 'Belum terhubung';
      }
    }

    if (driveBtn && driveStatus) {
      if (config.drive_folder_url) {
        driveBtn.href = config.drive_folder_url;
        driveBtn.classList.remove('opacity-50', 'pointer-events-none');
        driveStatus.textContent = 'Folder: LMS_SEKOLAH_PJJ';
      } else {
        driveBtn.href = 'https://drive.google.com';
        driveStatus.textContent = 'Folder Drive Aktif';
      }
    }

    if (lastSyncStatus) lastSyncStatus.textContent = config.last_status || 'Belum pernah disinkronkan';
    if (lastSyncTime) {
      lastSyncTime.textContent = config.last_synced_at 
        ? new Date(config.last_synced_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Belum ada aktivitas sinkron';
    }

    // Load Apps Script code into preview container
    if (codePre && (!codePre.textContent || codePre.textContent.startsWith('Memuat'))) {
      try {
        const codeRes = await api.getGoogleScriptCode();
        if (codeRes.success) {
          codePre.textContent = codeRes.code;
        }
      } catch (e) {
        codePre.textContent = '// Silakan lihat file google-apps-script.js pada folder project.';
      }
    }
  } catch (err) {
    showToast('Gagal memuat status integrasi Google: ' + err.message, 'error');
  }
}


