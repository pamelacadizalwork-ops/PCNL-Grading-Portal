// routes/student.js
// Students can only view their own grades.
// The studentId is always sourced from the server-side session — never from the request.

const express = require('express');
const router  = express.Router();
const db      = require('../models/database');
const { requireAuth, requireStudent } = require('../middleware/auth');

router.use(requireAuth, requireStudent);

/**
 * GET /api/student/grades
 * Returns ONLY the grades belonging to the currently logged-in student.
 */
router.get('/grades', (req, res) => {
  const studentId = req.user.id; // from verified session — cannot be forged
  const grades    = db.getGradesByStudentId(studentId);
  return res.json({ studentId, studentName: req.user.name, grades });
});

module.exports = router;
