import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function capture(t, responseCode) {
  const dir = mkdtempSync(path.join(tmpdir(), 'deck-capture-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(new URL('../src', import.meta.url), path.join(dir, 'src'), { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const sdk = path.join(dir, 'node_modules', '@typesafe-ai', 'sdk');
  mkdirSync(sdk, { recursive: true });
  writeFileSync(path.join(sdk, 'package.json'), '{"type":"module","exports":"./index.js"}');
  writeFileSync(path.join(sdk, 'index.js'), `
    export const choice = () => ({});
    export class TypeSafeClient {
      async systemOne() { ${responseCode} }
    }
  `);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { handleCapture } from './src/capture.js';
    await handleCapture({ log: console.log, simulate: false });
  `], {
    cwd: dir, encoding: 'utf8', timeout: 5000,
    env: { ...process.env, TYPESAFE_API_KEY: 'test-only-key' },
  });
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(path.join(dir, 'inbox.md'), 'utf8') + result.stdout;
}

test('a real capture saves the SDK route to the local inbox', (t) => {
  assert.match(capture(t, "return { answers: { route: { choice: 'idea', confidence: 0.8 } } };"),
    /\*\*idea\*\* conf=0.8/);
});

test('invalid SDK routes fall back to a note', (t) => {
  assert.match(capture(t, "return { answers: { route: { choice: 'invalid-route' } } };"),
    /\*\*note\*\* \(mock\)/);
});

test('SDK errors cannot copy credentials into the inbox or console', (t) => {
  const output = capture(t, "throw new Error('Authorization: Bearer test-only-key');");
  assert.match(output, /\*\*note\*\* \(mock\)/);
  assert.doesNotMatch(output, /test-only-key/);
});
