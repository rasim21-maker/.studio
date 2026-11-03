import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const source = process.argv[2];
if (!source) throw Error('Kaynak dizini gerekli.');
const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'vendor/loft');
try { await fs.access(target); throw Error('Kaynak daha önce içe aktarılmış; üzerine yazılmaz.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const files = {};
async function copy(dir = '') {
  for (const entry of await fs.readdir(path.join(source, dir), { withFileTypes: true })) {
    if (['.git', '.openai'].includes(entry.name)) continue;
    if (entry.isSymbolicLink()) throw Error('Sembolik bağ kabul edilmez.');
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) { await copy(rel); continue; }
    const bytes = await fs.readFile(path.join(source, rel));
    await fs.mkdir(path.dirname(path.join(target, rel)), { recursive: true });
    await fs.writeFile(path.join(target, rel), bytes);
    files[rel] = createHash('sha256').update(bytes).digest('hex');
  }
}
await copy();
await fs.writeFile(path.join(root, 'vendor/loft-manifest.json'), JSON.stringify({
  repository: 'https://github.com/rasim21-maker/loftpethouse',
  reportedCommit: '52cfb56be4a781e6cc2b08e32efd76acb07db509',
  provenance: 'Önceki sohbette doğrulanmış yerel kaynak kopyasından alındı; bu içe aktarım GitHub karşılaştırmasını tekrarlamaz.',
  excluded: ['.openai (mevcut Sites kimliği)', '.git'],
  files
}, null, 2) + '\n');
console.log(`${Object.keys(files).length} dosya birebir kopyalandı; SHA-256 manifesti yazıldı.`);
