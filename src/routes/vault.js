const express = require('express');
const pool = require('../models/db');
const requireAuth = require('../middleware/auth');
const { encryptPassword, decryptPassword } = require('../utils/crypto');

const router = express.Router();

// Semua route vault butuh login
router.use(requireAuth);

// GET halaman vault
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, service_name, service_url, username, category, created_at 
       FROM vault_entries 
       WHERE user_id = $1 
       ORDER BY service_name ASC`,
      [req.user.userId]
    );
    res.render('vault', { 
      user: req.user, 
      entries: result.rows 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// GET semua vault entries milik user yang login
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, service_name, service_url, username, category, created_at 
       FROM vault_entries 
       WHERE user_id = $1 
       ORDER BY service_name ASC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET satu entry + decrypt password (ini aksi sensitif!)
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM vault_entries 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry tidak ditemukan' });
    }

    const entry = result.rows[0];

    // Decrypt password
    const decrypted = decryptPassword(
      entry.encrypted_password,
      entry.iv,
      entry.auth_tag
    );

    // Catat di audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) 
       VALUES ($1, $2, $3)`,
      [req.user.userId, 'view_password', `Viewed password for ${entry.service_name}`]
    );

    res.json({ ...entry, password: decrypted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST buat entry baru
router.post('/', async (req, res) => {
  const { service_name, service_url, username, password, category } = req.body;

  // Validasi
  if (!service_name || !password) {
    return res.status(400).json({ error: 'Nama layanan dan password wajib diisi' });
  }

  try {
    // Enkripsi password
    const { encrypted, iv, authTag } = encryptPassword(password);

    const result = await pool.query(
      `INSERT INTO vault_entries 
       (user_id, service_name, service_url, username, encrypted_password, iv, auth_tag, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, service_name, username, category`,
      [req.user.userId, service_name, service_url, username, encrypted, iv, authTag, category]
    );

    res.redirect('/vault');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update entry
router.put('/:id', async (req, res) => {
  const { service_name, service_url, username, password, category } = req.body;

  try {
    // Pastikan entry milik user ini
    const existing = await pool.query(
      'SELECT id FROM vault_entries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Entry tidak ditemukan' });
    }

    // Enkripsi password baru
    const { encrypted, iv, authTag } = encryptPassword(password);

    const result = await pool.query(
      `UPDATE vault_entries 
       SET service_name=$1, service_url=$2, username=$3, 
           encrypted_password=$4, iv=$5, auth_tag=$6, 
           category=$7, updated_at=NOW()
       WHERE id=$8 AND user_id=$9
       RETURNING id, service_name, username, category`,
      [service_name, service_url, username, encrypted, iv, authTag, category, req.params.id, req.user.userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE entry
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM vault_entries WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry tidak ditemukan' });
    }

    res.json({ message: 'Entry berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;