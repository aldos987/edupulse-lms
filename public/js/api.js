// API Client Utility for EduPulse LMS
const api = {
  async request(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        ...options
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Request failed with status ${res.status}`);
        }
        return data;
      }
      return res;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  },

  // Auth
  async getMe() {
    return this.request('/api/auth/me');
  },
  async login(identifier, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
  },
  async changePassword(current_password, new_password, confirm_password) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password, confirm_password })
    });
  },
  async getClasses() {
    return this.request('/api/auth/classes');
  },
  async quickLogin(usernameOrNisn) {
    return this.request('/api/auth/quick-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameOrNisn, nisn: usernameOrNisn })
    });
  },
  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  },
  async getDemoAccounts() {
    return this.request('/api/auth/demo-accounts');
  },

  // Student Administration (Teacher / Admin)
  async getStudents(grade = '', className = '', search = '') {
    let url = '/api/students';
    const params = [];
    if (grade && grade !== 'ALL') params.push(`grade=${grade}`);
    if (className && className !== 'ALL') params.push(`class_name=${className}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.request(url);
  },
  async addStudent(payload) {
    return this.request('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  async batchAddStudents(studentData) {
    return this.request('/api/students/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentData })
    });
  },
  async resetStudentPassword(studentId) {
    return this.request(`/api/students/${studentId}/reset-password`, {
      method: 'POST'
    });
  },
  async deleteStudent(studentId) {
    return this.request(`/api/students/${studentId}`, {
      method: 'DELETE'
    });
  },

  // Emergency / ISPU
  async getEmergencyStatus() {
    return this.request('/api/emergency/status');
  },
  async updateEmergencyStatus(payload) {
    return this.request('/api/emergency/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  // Subjects
  async getSubjects() {
    return this.request('/api/subjects');
  },
  async getSubject(id) {
    return this.request(`/api/subjects/${id}`);
  },

  // Materials (with optional grade filter for teachers)
  async getMaterials(subjectId, grade = '') {
    const url = grade ? `/api/materials/subject/${subjectId}?grade=${grade}` : `/api/materials/subject/${subjectId}`;
    return this.request(url);
  },
  async createMaterial(payload) {
    return this.request('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  // Assignments
  async getAssignments(grade = '') {
    const url = grade ? `/api/assignments?grade=${grade}` : '/api/assignments';
    return this.request(url);
  },
  async getAssignment(id) {
    return this.request(`/api/assignments/${id}`);
  },
  async createAssignment(formData) {
    return this.request('/api/assignments', {
      method: 'POST',
      body: formData // multipart/form-data
    });
  },
  async getSubmissions(assignmentId, className = '') {
    const url = className ? `/api/assignments/${assignmentId}/submissions?class_name=${className}` : `/api/assignments/${assignmentId}/submissions`;
    return this.request(url);
  },

  // Submissions
  async submitAssignment(assignmentId, formData) {
    return this.request(`/api/submissions/submit/${assignmentId}`, {
      method: 'POST',
      body: formData
    });
  },
  async gradeSubmission(submissionId, score, feedback) {
    return this.request(`/api/submissions/grade/${submissionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, feedback })
    });
  },

  // Attendance
  async getTodayAttendance(grade = '', className = '') {
    let url = '/api/attendance/today';
    const params = [];
    if (grade) params.push(`grade=${grade}`);
    if (className) params.push(`class_name=${className}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.request(url);
  },
  async recordAttendance(subjectId, status, healthNotes) {
    return this.request('/api/attendance/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id: subjectId, status, health_notes: healthNotes })
    });
  },
  async getAttendanceRecap(grade = '', className = '') {
    let url = '/api/attendance/recap';
    const params = [];
    if (grade) params.push(`grade=${grade}`);
    if (className) params.push(`class_name=${className}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.request(url);
  },

  // Discussions
  async getDiscussions(subjectId) {
    return this.request(`/api/discussions/subject/${subjectId}`);
  },
  async getDiscussion(id) {
    return this.request(`/api/discussions/${id}`);
  },
  async createDiscussion(subjectId, title, message) {
    return this.request('/api/discussions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id: subjectId, title, message })
    });
  },
  async replyDiscussion(id, message) {
    return this.request(`/api/discussions/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
  },

  // Student Management (Teacher / Admin)
  async getStudents(grade = '', className = '', search = '') {
    let url = '/api/students';
    const params = [];
    if (grade && grade !== 'ALL') params.push(`grade=${encodeURIComponent(grade)}`);
    if (className && className !== 'ALL') params.push(`class_name=${encodeURIComponent(className)}`);
    if (search && search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.request(url);
  },
  async addStudent(data) {
    return this.request('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  async batchAddStudents(studentData) {
    return this.request('/api/students/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentData })
    });
  },
  async resetStudentPassword(studentId) {
    return this.request(`/api/students/${studentId}/reset-password`, {
      method: 'POST'
    });
  },
  async deleteStudent(studentId) {
    return this.request(`/api/students/${studentId}`, {
      method: 'DELETE'
    });
  },

  // Google Drive & Sheets Sync (Teacher / Admin)
  async getGoogleSyncConfig() {
    return this.request('/api/google-sync/config');
  },
  async saveGoogleSyncConfig(data) {
    return this.request('/api/google-sync/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  async testGoogleSync(test_url = null) {
    return this.request('/api/google-sync/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_url })
    });
  },
  async syncAllStudentsToGoogle() {
    return this.request('/api/google-sync/sync-all-students', {
      method: 'POST'
    });
  },
  async syncAllAttendanceToGoogle() {
    return this.request('/api/google-sync/sync-all-attendance', {
      method: 'POST'
    });
  },
  async syncAllSubmissionsToGoogle() {
    return this.request('/api/google-sync/sync-all-submissions', {
      method: 'POST'
    });
  },
  async getGoogleScriptCode() {
    return this.request('/api/google-sync/script-code');
  }
};

