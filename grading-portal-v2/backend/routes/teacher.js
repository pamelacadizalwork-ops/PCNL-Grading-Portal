// routes/teacher.js
// All routes require authentication + teacher role.
//
// NEW IN V2:
//  PUT  /api/teacher/profile              — edit teacher name / username / password
//  GET  /api/teacher/students/list        — list all students with password status
//  PUT  /api/teacher/students/:id/password — set a student's password
//  DELETE /api/teacher/students/:id        — delete a student + all their grades
//  POST /api/teacher/upload               — CSV now supports optional Password column

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { parse } = require('csv-parse/sync');
const db       = require('../models/database');
const { requireAuth, requireTeacher } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'), false);
    }
  }
});

router.use(requireAuth, requireTeacher);

// ─────────────────────────────────────────────
// TEACHER PROFILE
// ─────────────────────────────────────────────

/**
 * PUT /api/teacher/profile
 * Body: { name, username, newPassword? }
 * Allows the teacher to update their display name, login username, and password.
 */
router.put('/profile', async (req, res) => {
  const { name, username, newPassword, confirmPassword } = req.body;

  if (!name?.trim())     return res.status(400).json({ error: 'Display name is required.' });
  if (!username?.trim()) return res.status(400).json({ error: 'Username is required.' });

  // If a new password is supplied, both fields must match
  if (newPassword || confirmPassword) {
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }
  }

  const result = await db.updateTeacherProfile(
    req.user.id,
    name.trim(),
    username.trim(),
    newPassword || null
  );

  if (result.error) return res.status(400).json({ error: result.error });

  // Sync updated name + username back into the active session
  req.session.name     = result.name;
  req.session.username = result.username;

  return res.json({ message: 'Profile updated successfully.', user: result });
});

// ─────────────────────────────────────────────
// GRADES
// ─────────────────────────────────────────────

/** GET /api/teacher/grades — all grade records */
router.get('/grades', (req, res) => {
  return res.json({ grades: db.getAllGrades() });
});

/** PUT /api/teacher/grades/:id — update one grade */
router.put('/grades/:id', (req, res) => {
  const id       = parseInt(req.params.id, 10);
  const gradeNum = Number(req.body.grade);

  if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
    return res.status(400).json({ error: 'Grade must be between 0 and 100.' });
  }

  const updated = db.updateGrade(id, gradeNum);
  if (!updated) return res.status(404).json({ error: 'Grade record not found.' });

  return res.json({ message: 'Grade updated.', grade: updated });
});

// ─────────────────────────────────────────────
// STUDENT MANAGEMENT
// ─────────────────────────────────────────────

/**
 * GET /api/teacher/students/list
 * Returns all student users with their password status (safe — no hashes).
 */
router.get('/students/list', (req, res) => {
  return res.json({ students: db.getAllStudentUsers() });
});

/**
 * PUT /api/teacher/students/:id/password
 * Body: { password, confirmPassword }
 * Sets or resets a specific student's login password.
 */
router.put('/students/:id/password', async (req, res) => {
  const { password, confirmPassword } = req.body;
  const studentId = req.params.id;

  if (!password)           return res.status(400).json({ error: 'Password is required.' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const result = await db.setStudentPassword(studentId, password);
  if (result.error) return res.status(404).json({ error: result.error });

  return res.json({ message: `Password updated for student ${studentId}.` });
});

/**
 * DELETE /api/teacher/students/:id
 * Removes the student's login account and all their grade records.
 */
router.delete('/students/:id', (req, res) => {
  const studentId = req.params.id;
  const result    = db.deleteStudent(studentId);

  if (result.error) return res.status(404).json({ error: result.error });

  return res.json({
    message: `Student ${studentId} deleted. ${result.deletedGrades} grade record(s) removed.`,
    deletedGrades: result.deletedGrades
  });
});

// ─────────────────────────────────────────────
// CSV UPLOAD
// ─────────────────────────────────────────────

/**
 * POST /api/teacher/upload
 * Accepts a CSV file. Now supports an optional "Password" column.
 *
 * Columns: Student ID, Name, Subject, Grade, Password (optional)
 *   - If Password is provided, it becomes that student's login password.
 *   - If omitted, new students get their Student ID as the default password.
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  let records;
  try {
    records = parse(req.file.buffer, {
      columns: header => header.map(col => col.trim().toLowerCase().replace(/\s+/g, '_')),
      skip_empty_lines: true,
      trim: true
    });
  } catch (err) {
    return res.status(400).json({ error: `CSV parse error: ${err.message}` });
  }

  const mapped = [];
  const errors = [];

  records.forEach((row, index) => {
    const studentId   = row['student_id'] || row['studentid'] || row['id'];
    const studentName = row['name']        || row['student_name'];
    const subject     = row['subject'];
    const grade       = row['grade'];
    // Optional password column
    const password    = row['password'] || row['pass'] || row['pwd'] || null;

    if (!studentId || !studentName || !subject || grade === undefined) {
      errors.push(`Row ${index + 2}: Missing required columns.`);
      return;
    }

    const gradeNum = Number(grade);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
      errors.push(`Row ${index + 2}: Invalid grade "${grade}".`);
      return;
    }

    mapped.push({
      studentId:   studentId.trim(),
      studentName: studentName.trim(),
      subject:     subject.trim(),
      grade:       gradeNum,
      password:    password ? password.trim() : null
    });
  });

  if (errors.length > 0 && mapped.length === 0) {
    return res.status(400).json({ error: 'Upload failed.', details: errors });
  }

  await db.upsertGrades(mapped);

  return res.json({
    message:  `Upload successful. ${mapped.length} records processed.`,
    warnings: errors.length > 0 ? errors : undefined,
    count:    mapped.length
  });
});

module.exports = router;
