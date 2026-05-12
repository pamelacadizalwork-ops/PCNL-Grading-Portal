// routes/auth.js
// Handles login and logout for both teachers and students.

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const db       = require('../models/database');

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.findUserByUsername(username.trim());
  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok)   return res.status(401).json({ error: 'Invalid credentials.' });

  // Store key info in session (including username so profile updates reflect immediately)
  req.session.userId   = user.id;
  req.session.role     = user.role;
  req.session.name     = user.name;
  req.session.username = user.username;

  return res.json({ message: 'Login successful.', role: user.role, name: user.name, id: user.id });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logged out successfully.' });
  });
});

/**
 * GET /api/auth/me
 * Returns current session user info.
 */
router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated.' });
  return res.json({
    id:       req.session.userId,
    role:     req.session.role,
    name:     req.session.name,
    username: req.session.username
  });
});

module.exports = router;
