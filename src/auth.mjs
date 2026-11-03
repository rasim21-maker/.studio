import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fail } from './util.mjs';
const derive = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
export const token = () => randomBytes(32).toString('base64url');
export function passwordPolicy(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 256) fail(422, 'Parola 14–256 karakter olmalı.');
}
export function normalizeEmail(email) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422, 'Geçerli bir e-posta adresi girin.');
  return email.trim().toLowerCase();
}
export async function passwordHash(password) {
  passwordPolicy(password);
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt, 64, options)).toString('hex')}`;
}
export async function passwordMatches(password, encoded) {
  const [, salt, digest] = encoded.split('$');
  const actual = await derive(password, salt, 64, options);
  return timingSafeEqual(actual, Buffer.from(digest, 'hex'));
}
