process.env.ENCRYPTION_KEY = 'test_encryption_key_for_testing';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/passvault';

const request = require('supertest');
const app = require('../app');
const pool = require('../models/db');

// Bersihkan user test sebelum dan sesudah semua test
beforeAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.com'");
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.com'");
  await pool.end();
});

describe('POST /auth/register', () => {
  test('berhasil register dengan data valid', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'register@test.com', password: 'password123' });
    
    expect(res.status).toBe(302); // redirect setelah berhasil
  });

  test('gagal register dengan email yang sama', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'register@test.com', password: 'password123' });
    
    expect(res.status).toBe(200); // render halaman dengan error
    expect(res.text).toContain('Email sudah terdaftar');
  });

  test('gagal register tanpa email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ password: 'password123' });
    
    expect(res.status).toBe(200);
    expect(res.text).toContain('Email dan password wajib diisi');
  });

  test('gagal register dengan password kurang dari 8 karakter', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'short@test.com', password: '123' });
    
    expect(res.status).toBe(200);
    expect(res.text).toContain('Password minimal 8 karakter');
  });
});

describe('POST /auth/login', () => {
  test('berhasil login dengan kredensial benar', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'register@test.com', password: 'password123' });
    
    expect(res.status).toBe(302); // redirect ke /vault
    expect(res.headers['set-cookie']).toBeDefined(); // cookie JWT ada
  });

  test('gagal login dengan password salah', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'register@test.com', password: 'passwordsalah' });
    
    expect(res.status).toBe(200);
    expect(res.text).toContain('Email atau password salah');
  });

  test('gagal login dengan email tidak terdaftar', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'tidakada@test.com', password: 'password123' });
    
    expect(res.status).toBe(200);
    expect(res.text).toContain('Email atau password salah');
  });
});