require('dotenv').config();
const express = require('express');
app.set('trust proxy', 1);
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const authRoutes = require('./routes/auth');
const vaultRoutes = require('./routes/vault');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100,                  // max 100 request per 15 menit
  message: { error: 'Terlalu banyak request, coba lagi nanti' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20,                   // max 20 request login/register per 15 menit
  message: { error: 'Terlalu banyak percobaan login, coba lagi nanti' }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(limiter);

// CSRF protection
const { doubleCsrf } = require('csrf-csrf');
const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.JWT_SECRET,
  getSessionIdentifier: (req) => req.cookies['token'] || req.ip,
  getCsrfTokenFromRequest: (req) => req.body?._csrf || req.headers['x-csrf-token'],
  cookieName: 'csrf-token',
  cookieOptions: { sameSite: 'strict', secure: process.env.NODE_ENV === 'production' },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS']
});
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    req.csrfToken = () => 'test-csrf-token';
    return next();
  }
  return doubleCsrfProtection(req, res, next);
});

// Template engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Static files
app.use(express.static('public'));
app.use('/auth', authLimiter, authRoutes);
app.use('/vault', vaultRoutes);

// Route sementara untuk test
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;