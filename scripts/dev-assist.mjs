// A small launcher; the development helper itself runs locally in Python.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python');
const candidates = process.env.LOFT_DEV_PYTHON
  ? [[process.env.LOFT_DEV_PYTHON]]
  : [[path.join(bundled, 'python.exe')], [path.join(bundled, 'bin/python3')],
    ['python3'], ['python'], ['py', '-3']];
let interpreter;
let blocked;
for (const candidate of candidates) {
  if (path.isAbsolute(candidate[0]) && !existsSync(candidate[0])) continue;
  if (process.platform === 'win32' && !path.isAbsolute(candidate[0])) {
    const resolved = (process.env.PATH ?? '').split(path.delimiter)
      .map(dir => path.join(dir, candidate[0] + '.exe')).find(existsSync);
    if (resolved?.toLowerCase().includes('\\microsoft\\windowsapps\\')) continue;
  }
  const probe = spawnSync(candidate[0], [...candidate.slice(1), '-I', '-c',
    'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'],
  { encoding: 'utf8', windowsHide: true, timeout: 5000, shell: false });
  if (['EPERM', 'EACCES'].includes(probe.error?.code)) blocked = probe.error.code;
  if (probe.status === 0) { interpreter = candidate; break; }
}
if (!interpreter) {
  console.error(blocked
    ? `Python alt süreci izin sınırı nedeniyle başlatılamadı (${blocked}). Mevcut sandbox/izin politikasını kullanın.`
    : 'Python 3.10+ gerekli. LOFT_DEV_PYTHON ortam değişkenine python çalıştırıcısının tam yolunu verin.');
  process.exit(2);
}
const args = process.argv.slice(2);
const command = args[0] === 'self-test'
  ? ['-I', '-B', '-m', 'unittest', 'discover', '-s', 'test/dev-assist', '-p', 'test_*.py']
  : ['-I', '-B', path.join(root, 'scripts/dev_assist.py'), ...args];
const result = spawnSync(interpreter[0], [...interpreter.slice(1), ...command], {
  cwd: root, stdio: 'inherit', windowsHide: true, shell: false,
  env: { ...process.env, PYTHONIOENCODING: 'utf-8', LOFT_DEV_NODE: process.execPath,
    ...(process.env.npm_execpath ? { LOFT_DEV_NPM_CLI: process.env.npm_execpath } : {}) },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 2);
