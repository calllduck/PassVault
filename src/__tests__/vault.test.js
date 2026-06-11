process.env.ENCRYPTION_KEY = 'test_encryption_key_for_testing_32b';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://kein:kein@localhost:5432/passvault';

const request = require('supertest');
const app = require('../app');
const pool = require('../models/db');

let cookie; // simpan cookie JWT setelah login

beforeAll(async () => {
  // Bersihkan data test
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.com'");

  // Buat user test
  await request(app)
    .post('/auth/register')
    .send({ email: 'vault@test.com', password: 'password123' });

  // Login untuk dapat cookie JWT
  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'vault@test.com', password: 'password123' });

  cookie = loginRes.headers['set-cookie'];
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.com'");
  await pool.end();
});

describe('POST /vault', () => {
  test('berhasil tambah entry baru', async () => {
    const res = await request(app)
      .post('/vault')
      .set('Cookie', cookie)
      .send({
        service_name: 'Github',
        service_url: 'https://github.com',
        username: 'testuser',
        password: 'supersecret123',
        category: 'dev'
      });

    expect(res.status).toBe(302); // redirect ke /vault setelah berhasil
  });

  test('gagal tambah entry tanpa service_name', async () => {
    const res = await request(app)
      .post('/vault')
      .set('Cookie', cookie)
      .send({
        service_url: 'https://github.com',
        username: 'testuser',
        password: 'supersecret123'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('wajib diisi');
  });

  test('gagal tambah entry tanpa login', async () => {
    const res = await request(app)
      .post('/vault')
      .send({
        service_name: 'Github',
        password: 'supersecret123'
      });

    expect(res.status).toBe(401);
  });
});

describe('GET /vault/:id', () => {
  let entryId;

  beforeAll(async () => {
    // Buat entry dulu untuk ditest
    await request(app)
      .post('/vault')
      .set('Cookie', cookie)
      .send({
        service_name: 'TestService',
        password: 'secretpassword',
        username: 'testuser'
      });

    // Ambil id entry yang baru dibuat
    const dbRes = await pool.query(
      `SELECT id FROM vault_entries 
       WHERE user_id = (SELECT id FROM users WHERE email = 'vault@test.com')
       ORDER BY created_at DESC LIMIT 1`
    );
    entryId = dbRes.rows[0].id;
  });

  test('berhasil ambil entry dan decrypt password', async () => {
    const res = await request(app)
      .get(`/vault/${entryId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.password).toBe('secretpassword');
  });

  test('gagal ambil entry milik user lain', async () => {
    const res = await request(app)
      .get('/vault/99999')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /vault/:id', () => {
  let entryId;

  beforeAll(async () => {
    // Buat entry untuk didelete
    await request(app)
      .post('/vault')
      .set('Cookie', cookie)
      .send({
        service_name: 'ToDelete',
        password: 'deletepassword',
        username: 'testuser'
      });

    const dbRes = await pool.query(
      `SELECT id FROM vault_entries 
       WHERE user_id = (SELECT id FROM users WHERE email = 'vault@test.com')
       ORDER BY created_at DESC LIMIT 1`
    );
    entryId = dbRes.rows[0].id;
  });

  test('berhasil delete entry', async () => {
    const res = await request(app)
      .delete(`/vault/${entryId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('berhasil dihapus');
  });

  test('gagal delete entry yang tidak ada', async () => {
    const res = await request(app)
      .delete('/vault/99999')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});