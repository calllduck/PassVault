// Set ENCRYPTION_KEY untuk testing
process.env.ENCRYPTION_KEY = 'test_encryption_key_for_testing';

const { 
  hashPassword, 
  comparePassword, 
  encryptPassword, 
  decryptPassword 
} = require('../utils/crypto');


describe('hashPassword', () => {
  test('menghasilkan hash yang berbeda dari password asli', async () => {
    const password = 'password123';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
  });

  test('menghasilkan hash yang berbeda setiap kali', async () => {
    const password = 'password123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });
});

describe('comparePassword', () => {
  test('return true kalau password cocok dengan hash', async () => {
    const password = 'password123';
    const hash = await hashPassword(password);
    const result = await comparePassword(password, hash);
    expect(result).toBe(true);
  });

  test('return false kalau password salah', async () => {
    const password = 'password123';
    const hash = await hashPassword(password);
    const result = await comparePassword('passwordsalah', hash);
    expect(result).toBe(false);
  });
});

describe('encryptPassword & decryptPassword', () => {
  test('hasil dekripsi sama dengan teks asli', () => {
    const original = 'rahasia123';
    const { encrypted, iv, authTag } = encryptPassword(original);
    const decrypted = decryptPassword(encrypted, iv, authTag);
    expect(decrypted).toBe(original);
  });

  test('hasil enkripsi berbeda dari teks asli', () => {
    const original = 'rahasia123';
    const { encrypted } = encryptPassword(original);
    expect(encrypted).not.toBe(original);
  });

  test('enkripsi dua kali menghasilkan output berbeda', () => {
    const original = 'rahasia123';
    const { encrypted: enc1 } = encryptPassword(original);
    const { encrypted: enc2 } = encryptPassword(original);
    expect(enc1).not.toBe(enc2);
  });
});