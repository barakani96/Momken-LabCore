import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function generateTotpSecret(bytes = randomBytes(20)) {
  let bits = ''; for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let result = ''; for (let i = 0; i < bits.length; i += 5) result += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return result;
}
export function base32Decode(value: string) {
  const clean = value.toUpperCase().replace(/=+$/g, '').replace(/\s/g, ''); let bits = '';
  for (const char of clean) { const n = alphabet.indexOf(char); if (n < 0) throw new Error('Invalid base32 secret'); bits += n.toString(2).padStart(5, '0'); }
  const bytes: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(bytes);
}
export function totpAt(secret: string, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30000); const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(msg).digest(); const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | ((hmac[offset + 1] & 255) << 16) | ((hmac[offset + 2] & 255) << 8) | (hmac[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, '0');
}
export function verifyTotp(secret: string, code: string, timestamp = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  for (const drift of [-30000, 0, 30000]) { const expected = Buffer.from(totpAt(secret, timestamp + drift)); const actual = Buffer.from(code); if (timingSafeEqual(expected, actual)) return true; }
  return false;
}
export function encryptMfaSecret(secret: string) {
  const keyHex = process.env.MFA_ENCRYPTION_KEY;
  if (!keyHex || !/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error('MFA_ENCRYPTION_KEY must be a 32-byte hex key.');
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
export function decryptMfaSecret(value: string) {
  const keyHex = process.env.MFA_ENCRYPTION_KEY;
  if (!keyHex || !/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error('MFA_ENCRYPTION_KEY must be a 32-byte hex key.');
  const [iv, tag, encrypted] = value.split('.'); if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted MFA secret');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(iv, 'base64url')); decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}
export const hashRecoveryCode = (code: string) => createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
export function generateRecoveryCodes(count = 10) { return Array.from({ length: count }, () => { const raw = randomBytes(5).toString('hex').toUpperCase(); return `${raw.slice(0, 5)}-${raw.slice(5)}`; }); }
