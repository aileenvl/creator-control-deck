import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { cancelMeetingTimer, scheduleMeeting5, sendBuzz, sendLcd } from '../src/alerts.js';

const agentDir = fileURLToPath(new URL('..', import.meta.url));

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'deck-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(path.join(agentDir, 'src'), path.join(dir, 'src'), { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  return dir;
}

function run(dir, args, input, extraEnv = {}) {
  const result = spawnSync(process.execPath, ['src/index.js', ...args], {
    cwd: dir,
    input,
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, TYPESAFE_API_KEY: '', PORT: '/nonexistent/deck', ...extraEnv },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('simulation previews CAPTURE without writing an inbox or calling TypeSafe', (t) => {
  const dir = fixture(t);
  const output = run(dir, ['--simulate'], 'KEY:CAPTURE\n', { TYPESAFE_API_KEY: 'test-not-a-real-key' });
  assert.equal(existsSync(path.join(dir, 'inbox.md')), false);
  assert.match(output, /would write note/);
  assert.doesNotMatch(output, /TypeSafe unavailable/);
});

test('automatic fallback uses simulation for app launches and captures', (t) => {
  const dir = fixture(t);
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  const marker = path.join(dir, 'opened');
  writeFileSync(path.join(bin, 'open'), '#!/bin/sh\ntouch "$DECK_TEST_MARKER"\n', { mode: 0o755 });
  const output = run(dir, [], 'KEY:SPOTIFY\nKEY:CAPTURE\n', {
    PATH: `${bin}:${process.env.PATH}`, DECK_TEST_MARKER: marker,
  });
  assert.match(output, /\[open\] \(simulate\)/);
  assert.equal(existsSync(marker), false);
  assert.equal(existsSync(path.join(dir, 'inbox.md')), false);
});

test('an unavailable serial device falls back safely with dependencies installed', (t) => {
  const dir = fixture(t);
  symlinkSync(path.join(agentDir, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  const output = run(dir, [], 'KEY:CAPTURE\nKEY:STATUS\n');
  assert.match(output, /SIMULATE mode/);
  assert.match(output, /LCD:OK simulate/);
  assert.equal(existsSync(path.join(dir, 'inbox.md')), false);
});

test('LCD text cannot introduce another serial command and stays ASCII', () => {
  const lines = [];
  sendLcd({ log() {}, writeLine: (line) => lines.push(line) }, 'Hi\nBUZZ:5\r\0→');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^LCD:[\x20-\x7e]*$/);
  assert.ok(lines[0].length <= 36);
});

test('buzzer count is an integer between one and five', () => {
  const lines = [];
  const ctx = { log() {}, writeLine: (line) => lines.push(line) };
  for (const value of [2.8, -3, 10, NaN]) sendBuzz(ctx, value);
  assert.deepEqual(lines, ['BUZZ:2', 'BUZZ:1', 'BUZZ:5', 'BUZZ:1']);
});

test('simulation reads its timer override from .env', (t) => {
  const dir = fixture(t);
  writeFileSync(path.join(dir, '.env'), 'SIMULATE_MEETING_MS=3000 # quick demo\n');
  const previous = process.env.SIMULATE_MEETING_MS;
  delete process.env.SIMULATE_MEETING_MS;
  t.after(() => {
    if (previous !== undefined) process.env.SIMULATE_MEETING_MS = previous;
  });
  const output = run(dir, ['--simulate'], 'KEY:MEETING5\nKEY:CLEAR\n');
  assert.match(output, /timer armed for 3000ms/);
});

test('invalid timer durations are rejected instead of firing immediately', () => {
  const ctx = { log() {}, writeLine() {} };
  try {
    for (const ms of [-1, NaN, Infinity, 2 ** 31]) {
      assert.throws(() => scheduleMeeting5(ctx, { ms }), /duration/);
    }
  } finally {
    cancelMeetingTimer();
  }
});

test('meeting timer alerts once and CLEAR cancels the next timer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.after(cancelMeetingTimer);
  const lines = [];
  const ctx = { log() {}, writeLine: (line) => lines.push(line) };
  scheduleMeeting5(ctx, { ms: 3000 });
  t.mock.timers.tick(3000);
  assert.ok(lines.includes('LCD:Meeting time up!'));
  assert.equal(lines.filter((line) => line === 'BUZZ:3').length, 1);
  scheduleMeeting5(ctx, { ms: 3000 });
  cancelMeetingTimer();
  t.mock.timers.tick(3000);
  assert.equal(lines.filter((line) => line === 'BUZZ:3').length, 1);
});
