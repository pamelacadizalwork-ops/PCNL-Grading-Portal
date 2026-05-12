// server.js — Grading Portal v2
// Run: node server.js

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway / reverse proxy support
app.set('trust proxy', 1);

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || true,
  credentials: true
}));

// Session config
app.use(session({
  secret: process.env.SESSION_SECRET || 'gradebook-v2-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8 // 8 hours
  }
}));

// ─────────────────────────────────────────────
// FRONTEND FILES
// ─────────────────────────────────────────────
const frontendPath = path.join(__dirname, 'frontend');

app.use(express.static(frontendPath));

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);

// ─────────────────────────────────────────────
// SPA FALLBACK
// ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'pages', 'login.html'));
});

// ─────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎓 GradeBook v2 running on port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('Teacher login: teacher / teach123');
  console.log('Student logins:');
  console.log('  STU001 / pass001');
  console.log('  STU002 / pass002');
  console.log('  STU003 / pass003\n');
});
