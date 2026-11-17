"""Real temporary repositories/processes; never touches the product database."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('dev_assist', Path(__file__).resolve().parents[2] / 'scripts/dev_assist.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class LocalHelperTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='loft-helper-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.assist = helper.Assistant(self.root)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Helper Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.write('.gitignore', '.dev-assist/\n.env*\ndata/\n')
        self.write('packages/crm/package.json', '{"name":"@loft-studio/crm","version":"0.1.0"}')
        self.write('packages/crm/index.mjs', 'import { host } from "../module-core/index.mjs";\nexport const crm = "contacts";\n')
        self.write('packages/booking/index.mjs', 'export const booking = "appointments";\n')
        self.write('test/v2/booking.test.mjs', 'import "node:test";\n')
        self.write('vendor/site.js', 'const oldSite = true;\n')
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')

    def git(self, *args):
        subprocess.run(['git', *args], cwd=self.root, capture_output=True, check=True)

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
        return path

    def test_status_module_inventory_and_renamed_unicode_paths(self):
        self.git('mv', 'packages/crm/index.mjs', 'packages/crm/kişi listesi.mjs')
        result = self.assist.status()
        self.assertEqual(result['modules'][0]['name'], '@loft-studio/crm')
        self.assertEqual(result['changes'][0]['path'], 'packages/crm/kişi listesi.mjs')
        self.assertEqual(result['changes'][0]['from'], 'packages/crm/index.mjs')
        self.assertEqual(result['last_check']['status'], 'not_run')

    def test_context_selects_relevant_source_and_actual_line_range(self):
        result = self.assist.context(query='crm contacts')
        self.assertEqual(result['files'][0]['file'], 'packages/crm/index.mjs')
        self.assertIn('../module-core/index.mjs', result['files'][0]['imports'])
        exact = self.assist.context(files=['packages/crm/index.mjs'], start=2, lines=1)
        self.assertTrue(exact['files'][0]['content'].startswith('2: export'))
        self.assertTrue(exact['files'][0]['partial'])

    def test_ignored_secret_private_binary_and_escape_paths_are_rejected(self):
        self.write('.env', 'PASSWORD=do-not-read')
        self.write('data/customer.json', '{"name":"private"}')
        self.write('secret.json', '{"key":"private"}')
        self.write('secrets.json', '{"key":"private"}')
        self.write('fake.mjs', '\0binary')
        for name in ('.env', 'data/customer.json', 'secret.json', 'secrets.json', 'fake.mjs', '../outside.md',
                     '/etc/passwd', 'C:/outside.md', 'packages\\crm\\index.mjs'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.assist.context(files=[name])

    def test_symlink_source_and_storage_are_rejected(self):
        try:
            (self.root / 'link.mjs').symlink_to(self.root / 'packages/crm/index.mjs')
            (self.root / '.dev-assist').symlink_to(self.root / 'packages', target_is_directory=True)
        except OSError:
            self.skipTest('Symlink creation needs developer mode/privileges on this Windows host.')
        with self.assertRaises(ValueError):
            self.assist.context(files=['link.mjs'])
        with self.assertRaises(ValueError):
            self.assist.checkpoint('done', 'next')

    def test_redaction_handles_logs_source_tokens_and_multiline_ranges(self):
        secret = 'ghp_' + 'a' * 30
        text = f'normal\nAPI_KEY=hidden\nhttps://user:pass@example.invalid\n{secret}\n'
        result = helper.redact(text)
        for private in ('hidden', 'user:pass', secret):
            self.assertNotIn(private, result)
        self.write('keys.mjs', '-----BEGIN RSA PRIVATE KEY-----\nsecret-body\n-----END RSA PRIVATE KEY-----\n')
        result = self.assist.context(files=['keys.mjs'], start=2, lines=1)
        self.assertNotIn('secret-body', json.dumps(result))
        self.assertNotIn(secret, helper.compact_output({'branch': secret}, 1500))

    def test_output_is_valid_bounded_json_and_labels_partial_context(self):
        result = {'files': [{'file': 'huge.py', 'content': '\"\nç' * 10000}]}
        encoded = helper.compact_output(result, 1500)
        self.assertLessEqual(len(encoded), 1500)
        self.assertTrue(json.loads(encoded)['budget_limited'])
        encoded = helper.compact_output({'arbitrary': '\"\nç' * 10000}, 1500)
        self.assertLessEqual(len(encoded), 1500)
        self.assertTrue(json.loads(encoded)['truncated'])

    def test_snapshot_changes_on_content_index_and_vendor_changes(self):
        before = self.assist.snapshot()
        self.write('packages/crm/index.mjs', 'first')
        first = self.assist.snapshot()
        self.assertNotEqual(before, first)
        self.write('packages/crm/index.mjs', 'other')  # Same size, same porcelain status.
        self.assertNotEqual(first, self.assist.snapshot())
        self.git('add', 'packages/crm/index.mjs')
        staged = self.assist.snapshot()
        self.write('vendor/site.js', 'updated site')
        self.assertNotEqual(staged, self.assist.snapshot())

    def test_checkpoint_is_stale_after_source_change(self):
        self.assist.checkpoint('Module done', 'Next task')
        self.assertFalse(self.assist.status()['checkpoint']['stale'])
        self.write('packages/booking/index.mjs', 'changed')
        self.assertTrue(self.assist.status()['checkpoint']['stale'])

    def test_test_selection_rejects_commands_and_arbitrary_paths(self):
        with patch.dict(os.environ, {'LOFT_DEV_NODE': sys.executable}):
            commands = self.assist.commands('quick', ['test/v2/booking.test.mjs'])
            self.assertIn('--test', commands[0][1])
            for name in ('--eval=bad', 'packages/crm/index.mjs', 'test/../../bad.test.mjs', 'test/missing.test.mjs'):
                with self.assertRaises(ValueError):
                    self.assist.commands('quick', [name])

    def test_process_success_failure_timeout_and_output_limit(self):
        good = helper.execute([sys.executable, '-I', '-c', 'print("ok")'], self.root, 5)
        self.assertEqual(good['status'], 'passed')
        bad = helper.execute([sys.executable, '-I', '-c', 'raise SystemExit(7)'], self.root, 5)
        self.assertEqual(bad['exit_code'], 7)
        self.assertEqual(bad['status'], 'failed')
        slow = helper.execute([sys.executable, '-I', '-c', 'import time; time.sleep(20)'], self.root, 1)
        self.assertEqual(slow['status'], 'timeout')
        loud = helper.execute([sys.executable, '-I', '-c', 'print("x" * 1200000)'], self.root, 5)
        self.assertTrue(loud['log_truncated'])
        self.assertLessEqual(len(loud['output']), helper.MAX_LOG)

    def test_report_preserves_failure_redacts_log_and_does_not_run_later_steps(self):
        commands = [('fail', [sys.executable, '-I', '-c', 'print("PASSWORD=private-value"); raise SystemExit(3)']),
                    ('never', [sys.executable, '-I', '-c', 'print("never")'])]
        with patch.object(self.assist, 'commands', return_value=commands):
            result = self.assist.run()
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['not_run'], ['never'])
        self.assertEqual(result['steps'][0]['exit_code'], 3)
        logfile = self.root / result['steps'][0]['log']
        self.assertNotIn('private-value', logfile.read_text(encoding='utf-8'))
        self.assertFalse(self.assist.summary()['stale'])
        self.write('packages/booking/index.mjs', 'new code')
        self.assertTrue(self.assist.summary()['stale'])

    def test_success_captures_counts_and_detects_edits_during_run(self):
        code = 'from pathlib import Path; Path("new.mjs").write_text("new"); print("# tests 2\\n# pass 2\\n# fail 0")'
        with patch.object(self.assist, 'commands', return_value=[('fixture', [sys.executable, '-I', '-c', code])]):
            result = self.assist.run()
        self.assertEqual(result['status'], 'passed')
        self.assertEqual(result['steps'][0]['counts']['pass'], 2)
        self.assertTrue(result['changed_during_run'])
        self.assertTrue(self.assist.summary()['stale'])

    def test_startup_failure_replaces_previous_success_report(self):
        with patch.object(self.assist, 'commands', return_value=[('ok', [sys.executable, '-c', 'print("ok")'])]):
            self.assertEqual(self.assist.run()['status'], 'passed')
        with patch.object(self.assist, 'commands', return_value=[('missing', [str(self.root / 'missing-executable')])]):
            result = self.assist.run()
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(self.assist.summary()['status'], 'failed')
        self.assertEqual(result['steps'][0]['status'], 'error')

    def test_cli_failure_exit_and_invalid_profile(self):
        with patch.object(helper, 'ROOT', self.root), patch.object(helper, 'Assistant', return_value=self.assist):
            with patch.object(self.assist, 'run', return_value={'status': 'failed'}), patch('builtins.print'):
                self.assertEqual(helper.main(['run', '--profile', 'quick']), 1)
        parser = subprocess.run([sys.executable, '-I', str(Path(helper.__file__)), 'run', '--profile', 'arbitrary-shell'],
                                capture_output=True)
        self.assertEqual(parser.returncode, 2)

    def test_python_dictionary_is_not_reported_as_a_javascript_import(self):
        self.write('example.py', 'row["from"] = value\nprint("hello")\n')
        result = self.assist.context(files=['example.py'])
        self.assertEqual(result['files'][0]['imports'], [])

    def test_counts_support_node_tap_spec_and_python_unittest(self):
        for prefix in ('#', 'ℹ'):
            self.assertEqual(helper.test_counts(f'{prefix} tests 54\n{prefix} pass 54\n{prefix} fail 0'),
                             {'tests': 54, 'pass': 54, 'fail': 0})
        self.assertEqual(helper.test_counts('Ran 14 tests in 1.0s\n\nOK (skipped=1)'),
                         {'tests': 14, 'pass': 13, 'fail': 0, 'skipped': 1})
        self.assertEqual(helper.test_counts('Ran 3 tests in 1.0s\n\nFAILED (failures=1, errors=1)'),
                         {'tests': 3, 'fail': 2, 'skipped': 0})
        self.assertEqual(helper.test_counts('Ran 3 tests in 1.0s\n\nOK (expected failures=1)'),
                         {'tests': 3, 'fail': 0, 'skipped': 0, 'expected_failures': 1, 'pass': 2})
        self.assertEqual(helper.test_counts('Process failed before the runner started'), {})


if __name__ == '__main__':
    unittest.main()
