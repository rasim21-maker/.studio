import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
export const hash = value => createHash('sha256').update(value).digest('hex');
export class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
export const fail = (status, message, details) => { throw new HttpError(status, message, details); };
export async function walk(root, relative = '') {
  const list = [];
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error('Sembolik bağ kabul edilmez.');
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) list.push(...await walk(root, name));
    else if (entry.isFile()) list.push(name);
  }
  return list.sort();
}
export function within(root, relative) {
  const dest = path.resolve(root, relative);
  if (!dest.startsWith(path.resolve(root) + path.sep)) fail(404, 'Dosya bulunamadı.');
  return dest;
}
