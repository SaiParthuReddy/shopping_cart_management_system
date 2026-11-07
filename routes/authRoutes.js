const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getPool, dbState } = require('../config/db');
const { authenticateToken, generateToken } = require('../middleware/auth');

// Helper to ensure DB is connected before running query
function checkDb(res) {
  if (!dbState.connected) {
    res.status(503).json({
      success: false,
      message: 'MySQL Database is currently unreachable. Please verify MySQL service and .env configuration.',
      dbError: dbState.error
    });
    return false;
  }
  return true;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  if (!checkDb(res)) return;

  const { name, email, password, phone } = req.body;

  // Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Name is required.' });
  }
  if (!email || !email.trim() || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
  }

  try {
    const pool = getPool();

    // Check duplicate email
    const [existing] = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hashedPassword, phone ? phone.trim() : null, 'customer']
    );

    const newUser = {
      user_id: result.insertId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'customer'
    };

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to Parthu Reddy\'s Online Cart.',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  if (!checkDb(res)) return;

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const pool = getPool();
    const [users] = await pool.query(
      'SELECT user_id, name, email, password, phone, role FROM users WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const safeUser = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    const token = generateToken(safeUser);

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// GET /api/auth/me - Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const pool = getPool();
    const [users] = await pool.query(
      'SELECT user_id, name, email, phone, role, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      user: users[0]
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return res.status(500).json({ success: false, message: 'Error retrieving user profile.' });
  }
});

module.exports = router;
