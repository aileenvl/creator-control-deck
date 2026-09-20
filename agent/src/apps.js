/**
 * Pad layout (live):
 *   1 Spotify   2 ChatGPT   3 Grok Bot
 *   4 Chrome    5 Claude    6 Slack
 *
 * Old Arduino may send CURSOR for key 2 — mapped to ChatGPT.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const APP_MAP = {
  SPOTIFY: { kind: 'app', name: 'Spotify', label: 'Spotify' },
  CURSOR: { kind: 'app', name: 'ChatGPT', label: 'ChatGPT' },
  CHATGPT: { kind: 'app', name: 'ChatGPT', label: 'ChatGPT' },
  CODEX: { kind: 'app', name: 'ChatGPT', label: 'ChatGPT' },
  GROKBOT: { kind: 'app', name: 'Grok Bot', label: 'Grok Bot' },
  CHROME: { kind: 'app', name: 'Google Chrome', label: 'Chrome' },
  NOTION: { kind: 'app', name: 'Google Chrome', label: 'Chrome' },
  CLAUDE: { kind: 'app', name: 'Claude', label: 'Claude' },
  SLACK: { kind: 'app', name: 'Slack', label: 'Slack' },
};

export function openCommand(entry) {
  if (!entry) return null;
  if (entry.kind === 'app') {
    return ['open', '-a', entry.name];
  }
  if (entry.kind === 'url') {
    return ['open', entry.url];
  }
  return null;
}

export function describeOpen(entry) {
  const cmd = openCommand(entry);
  if (!cmd) return entry?.note || '(no open)';
  return cmd.map((p) => (/\s/.test(p) ? `"${p}"` : p)).join(' ');
}

/** Short name for the 16x2 LCD (max 16 chars per line). */
export function lcdLabel(entry, key) {
  if (entry?.label) return String(entry.label).slice(0, 16);
  return String(key || '').slice(0, 16);
}

export async function runOpen(ctx, entry) {
  const cmd = openCommand(entry);
  if (!cmd) throw new Error('No app mapping');
  const pretty = describeOpen(entry);
  if (ctx.simulate) {
    ctx.log(`[open] (simulate) ${pretty}`);
    return;
  }
  ctx.log(`[open] ${pretty}`);
  const [bin, ...args] = cmd;
  // Wait for macOS to accept the launch before showing a success message.
  await execFileAsync(bin, args, { timeout: 10000 });
}
