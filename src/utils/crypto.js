const crypto = require('crypto');
const bcrypt = require('bcrypt');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const SALT_ROUNDS = 12;

// Hash password user dengan bcrypt
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Bandingkan password dengan hashnya
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Enkripsi password vault pakai AES-256-GCM
function encryptPassword(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

// Dekripsi password vault
function decryptPassword(encrypted, ivHex, authTagHex) {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = { hashPassword, comparePassword, encryptPassword, decryptPassword };