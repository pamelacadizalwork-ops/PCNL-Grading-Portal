// models/database.js
// In-memory database for demo purposes.
// In production, replace with SQLite, PostgreSQL, or MongoDB.
//
// NEW IN V2:
//  - updateTeacherProfile()    — edit teacher name + username + password
//  - setStudentPassword()      — set/reset an individual student's password
//  - deleteStudent()           — remove a student's account + all their grades
//  - upsertGrades() now reads an optional 'password' field from CSV rows
//  - hasCustomPassword flag    — tracks whether a student has a custom password

const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────
// USERS STORE
// ─────────────────────────────────────────────
const users = [
  {
    id: 'teacher1',
    username: 'teacher',
    passwordHash: bcrypt.hashSync('teach123', 10),
    role: 'teacher',
    name: 'Ms. Rivera',
    hasCustomPassword: true
  },
  {
    id: 'STU001',
    username: 'STU001',
    passwordHash: bcrypt.hashSync('pass001', 10),
    role: 'student',
    name: 'Alice Santos',
    hasCustomPassword: true
  },
  {
    id: 'STU002',
    username: 'STU002',
    passwordHash: bcrypt.hashSync('pass002', 10),
    role: 'student',
    name: 'Ben Cruz',
    hasCustomPassword: true
  },
  {
    id: 'STU003',
    username: 'STU003',
    passwordHash: bcrypt.hashSync('pass003', 10),
    role: 'student',
    name: 'Carla Reyes',
    hasCustomPassword: true
  }
];

// ─────────────────────────────────────────────
// GRADES STORE
// ─────────────────────────────────────────────
let grades = [
  { id: 1,  studentId: 'STU001', studentName: 'Alice Santos',  subject: 'Mathematics', grade: 92 },
  { id: 2,  studentId: 'STU001', studentName: 'Alice Santos',  subject: 'Science',     grade: 88 },
  { id: 3,  studentId: 'STU001', studentName: 'Alice Santos',  subject: 'English',     grade: 95 },
  { id: 4,  studentId: 'STU002', studentName: 'Ben Cruz',      subject: 'Mathematics', grade: 78 },
  { id: 5,  studentId: 'STU002', studentName: 'Ben Cruz',      subject: 'Science',     grade: 82 },
  { id: 6,  studentId: 'STU002', studentName: 'Ben Cruz',      subject: 'English',     grade: 74 },
  { id: 7,  studentId: 'STU003', studentName: 'Carla Reyes',   subject: 'Mathematics', grade: 96 },
  { id: 8,  studentId: 'STU003', studentName: 'Carla Reyes',   subject: 'Science',     grade: 91 },
  { id: 9,  studentId: 'STU003', studentName: 'Carla Reyes',   subject: 'English',     grade: 89 }
];

let nextId = 10;

// ─────────────────────────────────────────────
// DATABASE HELPER METHODS
// ─────────────────────────────────────────────
const db = {

  // ── USER LOOKUPS ─────────────────────────────

  findUserByUsername(username) {
    return users.find(u => u.username === username) || null;
  },

  findUserById(id) {
    return users.find(u => u.id === id) || null;
  },

  /** Return all student users with safe public fields (no passwordHash). */
  getAllStudentUsers() {
    return users
      .filter(u => u.role === 'student')
      .map(({ id, username, name, hasCustomPassword }) => ({
        id, username, name,
        passwordStatus: hasCustomPassword ? 'custom' : 'default'
      }));
  },

  // ── TEACHER PROFILE ──────────────────────────

  /**
   * Update a teacher's display name, username, and optionally their password.
   * Returns the updated safe user object, or an error string.
   *
   * @param {string} teacherId       - ID of the teacher to update (from session)
   * @param {string} newName         - New display name
   * @param {string} newUsername     - New login username
   * @param {string|null} newPassword - New plaintext password, or null to keep current
   */
  async updateTeacherProfile(teacherId, newName, newUsername, newPassword) {
    const user = users.find(u => u.id === teacherId);
    if (!user) return { error: 'Teacher not found.' };

    // Check username uniqueness (ignore the current teacher's own record)
    const conflict = users.find(u => u.username === newUsername && u.id !== teacherId);
    if (conflict) return { error: 'That username is already taken.' };

    user.name     = newName.trim();
    user.username = newUsername.trim();

    if (newPassword) {
      user.passwordHash      = await bcrypt.hash(newPassword, 10);
      user.hasCustomPassword = true;
    }

    return { id: user.id, name: user.name, username: user.username };
  },

  // ── STUDENT PASSWORD ─────────────────────────

  /**
   * Set (or reset) a student's password.
   * Returns true on success, or an error string.
   *
   * @param {string} studentId    - The student's ID
   * @param {string} newPassword  - The new plaintext password
   */
  async setStudentPassword(studentId, newPassword) {
    const user = users.find(u => u.id === studentId && u.role === 'student');
    if (!user) return { error: 'Student not found.' };

    user.passwordHash      = await bcrypt.hash(newPassword, 10);
    user.hasCustomPassword = true;
    return { success: true };
  },

  // ── DELETE STUDENT ───────────────────────────

  /**
   * Delete a student's account and all their grade records.
   * Returns { deletedGrades: number } on success, or an error string.
   *
   * @param {string} studentId - The student to remove
   */
  deleteStudent(studentId) {
    const userIndex = users.findIndex(u => u.id === studentId && u.role === 'student');
    if (userIndex === -1) return { error: 'Student not found.' };

    // Count + remove their grades
    const before = grades.length;
    grades = grades.filter(g => g.studentId !== studentId);
    const deletedGrades = before - grades.length;

    // Remove the user account
    users.splice(userIndex, 1);

    return { deletedGrades };
  },

  // ── GRADE METHODS ─────────────────────────────

  getAllGrades() {
    return [...grades];
  },

  getGradesByStudentId(studentId) {
    return grades.filter(g => g.studentId === studentId);
  },

  getAllStudents() {
    const map = {};
    grades.forEach(g => {
      if (!map[g.studentId]) {
        map[g.studentId] = { studentId: g.studentId, studentName: g.studentName };
      }
    });
    return Object.values(map);
  },

  updateGrade(id, newGrade) {
    const index = grades.findIndex(g => g.id === id);
    if (index === -1) return null;
    grades[index] = { ...grades[index], grade: Number(newGrade) };
    return grades[index];
  },

  /**
   * Bulk upsert grades from a CSV upload.
   * Now also reads an optional 'password' field per row to set student passwords.
   *
   * @param {Array} newRecords - Array of { studentId, studentName, subject, grade, password? }
   */
  async upsertGrades(newRecords) {
    for (const record of newRecords) {
      // Upsert the grade record
      const existingIndex = grades.findIndex(
        g => g.studentId === record.studentId && g.subject === record.subject
      );
      if (existingIndex !== -1) {
        grades[existingIndex] = { ...grades[existingIndex], ...record };
      } else {
        grades.push({ id: nextId++, ...record });
      }

      // Register student user if new
      const existingUser = users.find(u => u.id === record.studentId);
      if (!existingUser) {
        const initialPassword = record.password || record.studentId;
        users.push({
          id:             record.studentId,
          username:       record.studentId,
          passwordHash:   await bcrypt.hash(initialPassword, 10),
          role:           'student',
          name:           record.studentName,
          hasCustomPassword: !!record.password
        });
      } else if (record.password) {
        // Update password if CSV explicitly provided one
        existingUser.passwordHash      = await bcrypt.hash(record.password, 10);
        existingUser.hasCustomPassword = true;
      }
    }
    return grades;
  },

  clearGrades() {
    grades = [];
  }
};

module.exports = db;
