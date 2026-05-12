// middleware/auth.js
// Role-based access control middleware.

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  req.user = {
    id:   req.session.userId,
    role: req.session.role,
    name: req.session.name,
    username: req.session.username
  };
  next();
}

function requireTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Forbidden. Teacher access only.' });
  }
  next();
}

function requireStudent(req, res, next) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Forbidden. Student access only.' });
  }
  next();
}

module.exports = { requireAuth, requireTeacher, requireStudent };
