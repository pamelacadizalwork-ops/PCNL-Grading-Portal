// server.js — Grading Portal v2 entry point
// Run: node server.js  (or: npm start)

const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');

const authRoutes    = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ───────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'gradebook-v2-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,  // blocks JS access to cookie (XSS protection)
    secure:   false, // set true in HTTPS production
    maxAge:   1000 * 60 * 60 * 8 // 8-hour sessions
  }
}));

// ── STATIC FRONTEND ──────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API ROUTES ───────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);

// ── CATCH-ALL (SPA fallback) ─────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
 });

// ── GLOBAL ERROR HANDLER ─────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

// ── START ────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎓 GradeBook v2 running → http://localhost:${PORT}`);
  console.log('   Teacher:  username=teacher   password=teach123');
  console.log('   Students: STU001/pass001  STU002/pass002  STU003/pass003\n');
});
