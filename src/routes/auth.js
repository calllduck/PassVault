const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../models/db');
const { hashPassword, comparePassword } = require('../utils/crypto');

const router = express.Router();

// GET halaman login
router.get('/login', (req, res) => {
  res.render('login');
});

// GET halaman register
router.get('/register', (req, res) => {
  res.render('register');
});

// REGISTER
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('register', { error: 'Email dan password wajib diisi' });
  }
  if (!email.includes('@')) {
    return res.render('register', { error: 'Format email tidak valid' });
  }
  if (password.length < 8) {
    return res.render('register', { error: 'Password minimal 8 karakter' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.render('register', { error: 'Email sudah terdaftar' });
    }

    const password_hash = await hashPassword(password);

    await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
      [email, password_hash]
    );

    res.redirect('/auth/login');

  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Server error, coba lagi' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('login', { error: 'Email dan password wajib diisi' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.render('login', { error: 'Email atau password salah' });
    }

    const user = result.rows[0];

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.render('login', { error: 'Email atau password salah' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    });

    res.redirect('/vault');

  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Server error, coba lagi' });
  }
});

// LOGOUT
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/auth/login');
});

module.exports = router;