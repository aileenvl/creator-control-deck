import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { APP_MAP, openCommand, runOpen } from '../src/apps.js';

test('failed app launches are reported to the caller', async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'deck-open-'));
  const previousPath = process.env.PATH;
  t.after(() => {
    process.env.PATH = previousPath;
    rmSync(dir, { recursive: true, force: true });
  });
  writeFileSync(path.join(dir, 'open'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  process.env.PATH = dir;
  await assert.rejects(async () => runOpen({ log() {}, simulate: false }, APP_MAP.SPOTIFY));
});

test('app names are passed as one argument without shell interpolation', () => {
  assert.deepEqual(openCommand({ kind: 'app', name: 'An App; echo test' }),
    ['open', '-a', 'An App; echo test']);
});
