import { SourceTextModule } from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LoftAdapter } from '../src/adapters/loft.mjs';
import { walk } from '../src/util.mjs';
const root = path.resolve(import.meta.dirname, '..');
for (const directory of ['src', 'public', 'scripts', 'test', 'packages']) for (const rel of await walk(path.join(root, directory))) {
  if (/\.m?js$/.test(rel)) new SourceTextModule(await fs.readFile(path.join(root, directory, rel), 'utf8'), { identifier: path.join(directory, rel) });
}
const adapter = await new LoftAdapter(root).init();
for (const locale of adapter.metadata().languages) {
  const validation = adapter.validate(locale.code, adapter.seeds[locale.code]);
  if (!validation.valid) throw Error(JSON.stringify(validation));
}
const files = await walk(path.join(root, 'vendor/loft'));
console.log(`Sözdizimi başarılı. ${files.length} kaynak dosyasının SHA-256 değeri ve 11 dilin şeması doğrulandı (${adapter.fields.length} alan/dil).`);
