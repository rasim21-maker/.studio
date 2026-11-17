"""Bounded local development tools. Standard library only; no LLM/API calls."""
import argparse
from collections import deque
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
EXCLUDED = {'.git', '.codex', '.agents', '.aws', '.dev-assist', 'node_modules',
            'data', 'test-results', 'coverage', 'dist', 'build', 'vendor', '.venv', '__pycache__'}
TEXT_TYPES = {'.py', '.mjs', '.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.css', '.html', '.yml', '.yaml'}
PRIVATE_NAME = re.compile(r'(^\.env($|\.)|(^|[._-])(secrets?|credentials?|backup|private[-_]?key)([._-]|$)|^id_(rsa|ed25519)$)', re.I)
SENSITIVE = re.compile(r'(?i)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|client[_-]?secret|authorization)\s*["\x27]?\s*[:=]\s*\S+')
ANSI = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')
MAX_FILE = 512 * 1024
MAX_LOG = 1024 * 1024
PROFILES = {
    'quick': ('typecheck', 'check'),
    'v2': ('test:v2',), 'legacy': ('test',), 'packages': ('test:packages',),
    'helper': ('test:dev-assist',),
    'full': ('test:dev-assist', 'typecheck', 'build', 'check', 'test', 'test:v2',
             'test:packages', 'licenses', 'sbom', 'audit'),
}


def redact(text):
    text = ANSI.sub('', text)
    text = re.sub(r'-----BEGIN [^-]*PRIVATE KEY-----.*?(?:-----END [^-]*PRIVATE KEY-----|\Z)',
                  '[REDACTED PRIVATE KEY]', text, flags=re.S)
    text = re.sub(r'(?i)\b(?:gh[pousr]_[a-z0-9_]{16,}|github_pat_[a-z0-9_]{16,}|sk-[a-z0-9_-]{16,}|sk_(?:live|test)_[a-z0-9]{12,})', '[REDACTED TOKEN]', text)
    text = re.sub(r'(?i)(https?://)[^\s/@]+:[^\s/@]+@', r'\1[REDACTED]@', text)
    return '\n'.join('[REDACTED sensitive line]' if SENSITIVE.search(line) else line
                     for line in text.splitlines())


def compact_output(data, limit):
    def scrub(value):
        if isinstance(value, str):
            return redact(value)
        if isinstance(value, list):
            return [scrub(v) for v in value]
        if isinstance(value, dict):
            return {k: scrub(v) for k, v in value.items()}
        return value
    data = scrub(data)
    if isinstance(data.get('files'), list):
        while len(json.dumps(data, ensure_ascii=False, separators=(',', ':'))) > limit and data['files']:
            data['budget_limited'] = True
            if len(data['files']) > 1:
                data['files'].pop()
            else:
                item = data['files'][0]
                item['partial'] = True
                if len(item['content']) > 200:
                    item['content'] = item['content'][:len(item['content']) // 2]
                else:
                    data['files'].pop()
    value = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    if len(value) <= limit:
        return value
    result = {'truncated': True, 'original_chars': len(value),
              'note': 'Narrow the query or request a specific file/range.', 'excerpt': ''}
    # Keep valid JSON even when the excerpt contains escaped quotes/newlines.
    low, high = 0, limit
    while low < high:
        mid = (low + high + 1) // 2
        result['excerpt'] = value[:mid]
        if len(json.dumps(result, ensure_ascii=False, separators=(',', ':'))) <= limit:
            low = mid
        else:
            high = mid - 1
    result['excerpt'] = value[:low]
    return json.dumps(result, ensure_ascii=False, separators=(',', ':'))


def bounded_number(low, high):
    def parse(value):
        number = int(value)
        if not low <= number <= high:
            raise argparse.ArgumentTypeError(f'Expected {low}..{high}')
        return number
    return parse


def test_counts(text):
    counts = {k: int(v) for k, v in re.findall(
        r'^(?:#|ℹ) (tests|pass|fail|cancelled|skipped) (\d+)\s*$', text, re.M)}
    if not counts:
        match = re.search(r'^Ran (\d+) tests? in ', text, re.M)
        outcome = re.search(r'^(OK|FAILED)(?: \(([^\n]+)\))?\s*$', text, re.M)
        if match and outcome:
            details = {key.strip(): value for key, value in
                       re.findall(r'([a-z ]+)=(\d+)', outcome[2] or '')}
            failed = sum(int(details.get(k, 0)) for k in ('failures', 'errors', 'unexpected successes'))
            skipped = int(details.get('skipped', 0))
            counts = {'tests': int(match[1]), 'fail': failed, 'skipped': skipped}
            if 'expected failures' in details:
                counts['expected_failures'] = int(details['expected failures'])
            if outcome[1] == 'OK':
                counts['pass'] = counts['tests'] - skipped - int(details.get('expected failures', 0))
    return counts


class Assistant:
    def __init__(self, root=ROOT):
        self.root = Path(root).resolve()
        self.storage = self.root / '.dev-assist'

    def git(self, *args):
        result = subprocess.run(['git', *args], cwd=self.root, capture_output=True,
                                timeout=30, shell=False)
        if result.returncode:
            raise ValueError('Git command failed: ' + redact(result.stderr.decode('utf-8', 'replace'))[:400])
        return result.stdout.decode('utf-8', 'replace')

    def safe_path(self, relative, *, source=True):
        relative = str(relative)
        if '\\' in relative or ':' in relative or Path(relative).is_absolute():
            raise ValueError('Use a repository-relative path with forward slashes.')
        parts = Path(relative).parts
        if not parts or any(p in ('..', '.') for p in parts):
            raise ValueError('Invalid relative path.')
        path = self.root
        for part in parts:
            path = path / part
            if path.is_symlink() or getattr(path, 'is_junction', lambda: False)():
                raise ValueError('Linked paths are excluded.')
        if not path.resolve().is_relative_to(self.root):
            raise ValueError('Path escapes the repository.')
        if source and (any(p.lower() in EXCLUDED or PRIVATE_NAME.search(p) for p in parts)
                       or path.suffix.lower() not in TEXT_TYPES or path.name == 'package-lock.json'):
            raise ValueError('This file is excluded from context.')
        return path

    def inventory(self):
        paths = sorted(set(self.git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0')) - {''})
        if len(paths) > 20000:
            raise ValueError('Repository inventory limit exceeded; narrow the checkout.')
        return paths

    def changes(self):
        fields = self.git('status', '--porcelain=v1', '-z', '--untracked-files=all').split('\0')
        rows, i = [], 0
        while i < len(fields) and fields[i]:
            item = fields[i]
            row = {'status': item[:2], 'path': item[3:]}
            i += 1
            if 'R' in item[:2] or 'C' in item[:2]:
                row['from'] = fields[i]
                i += 1
            rows.append(row)
        return rows

    def snapshot(self):
        commit = self.git('rev-parse', 'HEAD').strip()
        digest = hashlib.sha256(commit.encode())
        for row in self.changes():
            # Runtime output must not invalidate its own report, even before .gitignore is committed.
            if row['path'].split('/')[0] == '.dev-assist':
                continue
            digest.update(json.dumps(row, sort_keys=True).encode())
            try:
                path = self.safe_path(row['path'], source=False)
                if path.is_file():
                    if path.stat().st_size > 8 * 1024 * 1024:
                        raise ValueError('Changed file too large for a reliable snapshot.')
                    with path.open('rb') as stream:
                        for block in iter(lambda: stream.read(65536), b''):
                            digest.update(block)
            except OSError as error:
                raise ValueError('Cannot fingerprint a changed file.') from error
        # Include staged contents; two different index states must not reuse the same evidence.
        digest.update(self.git('diff', '--cached', '--no-ext-diff', '--no-textconv', '--raw', '--no-abbrev').encode())
        return {'commit': commit, 'worktree': digest.hexdigest()}

    def read_json(self, name):
        path = self.safe_path('.dev-assist/' + name, source=False)
        if not path.exists():
            return None
        if path.stat().st_size > MAX_LOG:
            raise ValueError('Stored report exceeds the size limit.')
        return json.loads(path.read_text(encoding='utf-8'))

    def save(self, name, value):
        path = self.safe_path('.dev-assist/' + name, source=False)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
        temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(temp, path)
        return path.relative_to(self.root).as_posix()

    def summary(self):
        report = self.read_json('latest.json')
        if report:
            report['stale'] = report['snapshot'] != self.snapshot() or report['changed_during_run']
        return report or {'status': 'not_run'}

    def status(self):
        snapshot = self.snapshot()
        changes = self.changes()
        modules = []
        for name in self.inventory():
            if re.fullmatch(r'packages/[^/]+/package\.json', name):
                data = json.loads(self.safe_path(name).read_text(encoding='utf-8'))
                modules.append({'name': data['name'], 'version': data['version'], 'path': name.rsplit('/', 1)[0]})
        state = self.read_json('state.json')
        if state:
            state['stale'] = state['snapshot'] != snapshot
        return {**snapshot, 'branch': self.git('branch', '--show-current').strip(),
                'changes': changes[:30], 'change_count': len(changes), 'modules': modules,
                'checkpoint': state, 'last_check': self.summary()}

    def context(self, query='', files=(), start=1, lines=60):
        if len(files) > 8:
            raise ValueError('Request at most 8 files.')
        if start != 1 and len(files) != 1:
            raise ValueError('--start requires exactly one --file.')
        known = set(self.inventory())
        terms = re.findall(r'[\w-]+', query.lower())[:12]
        changed = {r['path'] for r in self.changes()}
        candidates, skipped, scanned = [], 0, 0
        scan_limited = False
        scan_bytes = 0
        for name in files or sorted(known):
            try:
                if name not in known:
                    raise ValueError('File is not tracked or is ignored.')
                path = self.safe_path(name)
                size = path.stat().st_size
                if size > MAX_FILE:
                    raise ValueError('File exceeds the context size limit.')
                if not files and not terms and name not in changed:
                    continue
                if scanned >= 600 or scan_bytes + size > 12 * 1024 * 1024:
                    scan_limited = True
                    break
                content = path.read_text(encoding='utf-8')
                if '\0' in content:
                    raise ValueError('Binary content is excluded.')
                scanned += 1
                scan_bytes += size
                score = sum(10 * (t in name.lower()) + min(3, content.lower().count(t)) for t in terms)
                if files or not terms or score:
                    candidates.append((score + (name in changed), name, content))
            except (ValueError, OSError, UnicodeError):
                if files:
                    raise ValueError('Requested file is unavailable or excluded: ' + name)
                skipped += 1
        candidates.sort(key=lambda row: (-row[0], row[1]))
        selected = []
        for _, name, content in candidates[:6 if not files else 8]:
            source_lines = content.splitlines()
            offset = start - 1
            if not files and terms:
                match = next((i for i, line in enumerate(source_lines) if any(t in line.lower() for t in terms)), 0)
                offset = max(0, match - 5)
            # Redact before slicing so a multi-line private key cannot escape by range selection.
            safe_lines = redact(content).splitlines()
            # Redaction can collapse a block; never claim original line numbers after that.
            if len(safe_lines) != len(source_lines):
                safe_lines = ['[REDACTED: file contains multi-line sensitive material]']
                offset = 0
            snippet = '\n'.join(f'{i + 1}: {line}' for i, line in enumerate(safe_lines[offset:offset + lines], offset))
            imports = re.findall(r'(?:\bfrom\s+|\bimport\s*(?:\(\s*)?)[\x27"]([^\x27"\r\n]+)[\x27"]', content) \
                if Path(name).suffix in {'.js', '.mjs', '.ts', '.tsx', '.jsx'} else []
            selected.append({'file': name, 'content': snippet,
                             'imports': sorted(set(imports))[:12],
                             'total_lines': len(source_lines), 'partial': offset > 0 or len(source_lines) > lines})
        return {'snapshot': self.snapshot(), 'query': redact(query), 'files': selected,
                'candidates': len(candidates), 'scanned': scanned, 'excluded': skipped,
                'selection': 'Lexical hints, not a complete dependency graph. Request exact ranges when needed.',
                'scan_limited': scan_limited}

    def commands(self, profile, tests):
        node = os.environ.get('LOFT_DEV_NODE') or shutil.which('node')
        if not node:
            raise ValueError('Node.js is required for project checks.')
        if tests:
            if len(tests) > 12:
                raise ValueError('At most 12 test files per targeted run.')
            known = set(self.inventory())
            for name in tests:
                if name not in known or not name.startswith('test/') or not name.endswith('.test.mjs'):
                    raise ValueError('Use an existing repository test/*.test.mjs path.')
                self.safe_path(name, source=False)
            isolation = [] if all(t.startswith('test/v2/') for t in tests) else ['--experimental-test-isolation=none']
            return [('targeted', [node, '--test', *isolation, '--test-concurrency=1', *tests])]
        npm = os.environ.get('LOFT_DEV_NPM_CLI')
        if not npm:
            npm = next((str(p) for p in (Path(node).parent / 'node_modules/npm/bin/npm-cli.js',
                       Path(node).resolve().parent.parent / 'lib/node_modules/npm/bin/npm-cli.js') if p.is_file()), None)
        if not npm or not Path(npm).is_file():
            raise ValueError('Run via npm run dev:assist so npm CLI can be located.')
        return [(name, [node, npm, 'audit', '--audit-level=moderate'] if name == 'audit'
                 else [node, npm, 'run', name]) for name in PROFILES[profile]]

    def run(self, profile='quick', tests=(), timeout=600):
        commands = self.commands(profile, tests)
        snapshot = self.snapshot()
        run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:8]
        steps = []
        for name, command in commands:
            try:
                step = execute(command, self.root, timeout)
            except (OSError, subprocess.SubprocessError, ValueError) as error:
                step = {'status': 'error', 'exit_code': None, 'output': str(error), 'seconds': 0,
                        'log_truncated': False}
            raw = step.pop('output')
            safe = redact(raw)
            logfile = self.save(f'runs/{run_id}/{name.replace(":", "-")}.json', {'output': safe})
            counts = test_counts(safe)
            tail = list(deque(safe.splitlines(), maxlen=16)) if step['status'] != 'passed' else []
            steps.append({'check': name, **step, 'counts': counts, 'tail': tail, 'log': logfile})
            if step['status'] != 'passed':
                break
        report = {'run_id': run_id, 'snapshot': snapshot,
                  'profile': 'targeted' if tests else profile, 'tests': list(tests),
                  'status': 'passed' if all(s['status'] == 'passed' for s in steps) else 'failed',
                  'changed_during_run': snapshot != self.snapshot(), 'steps': steps,
                  'not_run': [name for name, _ in commands[len(steps):]]}
        self.save(f'runs/{run_id}/report.json', report)
        self.save('latest.json', report)
        return report

    def checkpoint(self, done, next_task):
        state = {'snapshot': self.snapshot(), 'done': redact(done), 'next': redact(next_task),
                 'note': 'Human/agent supplied notes; test evidence is recorded separately.'}
        self.save('state.json', state)
        return state


def execute(command, cwd, timeout):
    started = time.monotonic()
    chunks, length = [], [0]
    proc = subprocess.Popen(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            shell=False, start_new_session=os.name != 'nt',
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)

    def drain():
        while True:
            chunk = proc.stdout.read(8192)
            if not chunk:
                break
            keep = max(0, MAX_LOG - length[0])
            chunks.append(chunk[:keep]) if keep else None
            length[0] += len(chunk)

    reader = threading.Thread(target=drain, daemon=True)
    reader.start()
    timed_out = False
    try:
        proc.wait(timeout=timeout)
    except (subprocess.TimeoutExpired, KeyboardInterrupt):
        timed_out = True
        if os.name == 'nt':
            subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'], capture_output=True, timeout=10,
                           creationflags=subprocess.CREATE_NO_WINDOW)
        else:
            os.killpg(proc.pid, signal.SIGKILL)
        proc.wait(timeout=10)
    reader.join(timeout=5)
    if reader.is_alive():
        raise ValueError('A child process kept the output stream open after its parent exited.')
    proc.stdout.close()
    return {'status': 'timeout' if timed_out else ('passed' if proc.returncode == 0 else 'failed'),
            'exit_code': proc.returncode, 'seconds': round(time.monotonic() - started, 2),
            'output': b''.join(chunks).decode('utf-8', 'replace'), 'output_bytes': length[0],
            'log_truncated': length[0] > MAX_LOG}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--max-chars', type=bounded_number(1500, 24000), default=10000)
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('status')
    context = sub.add_parser('context')
    context.add_argument('--query', default='')
    context.add_argument('--file', action='append', default=[])
    context.add_argument('--start', type=bounded_number(1, 100000), default=1)
    context.add_argument('--lines', type=bounded_number(1, 120), default=60)
    run = sub.add_parser('run')
    choice = run.add_mutually_exclusive_group()
    choice.add_argument('--profile', choices=PROFILES, default='quick')
    choice.add_argument('--test', action='append', default=[])
    run.add_argument('--timeout', type=bounded_number(1, 1800), default=600)
    sub.add_parser('summary')
    checkpoint = sub.add_parser('checkpoint')
    checkpoint.add_argument('--done', required=True)
    checkpoint.add_argument('--next', default='')
    args = parser.parse_args(argv)
    helper = Assistant()
    try:
        if args.action == 'context':
            result = helper.context(args.query, args.file, args.start, args.lines)
        elif args.action == 'run':
            result = helper.run(args.profile, args.test, args.timeout)
        elif args.action == 'checkpoint':
            if max(len(args.done), len(args.next)) > 2000:
                raise ValueError('Checkpoint notes must be at most 2000 characters each.')
            result = helper.checkpoint(args.done, args.next)
        else:
            result = getattr(helper, args.action)()
        print(compact_output(result, args.max_chars))
        return 1 if args.action == 'run' and result['status'] != 'passed' else 0
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(compact_output({'error': redact(str(error))[:800]}, args.max_chars))
        return 2


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
