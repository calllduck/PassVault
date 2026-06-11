require('dotenv').config();
const express = require('express');

const app = express();
const authRoutes = require('./routes/auth');
const vaultRoutes = require('./routes/vault');
const cookieParser = require('cookie-parser');

// Middleware: parsing request body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Template engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Static files
app.use(express.static('public'));
app.use('/auth', authRoutes);
app.use(cookieParser());
app.use('/vault', vaultRoutes);

// Route sementara untuk test
app.get('/', (req, res) => {
  res.send('PassVault is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
