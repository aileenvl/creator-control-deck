#!/usr/bin/env node
/**
 * Creator Control Deck — macOS serial agent
 * Listens for KEY:* / EVENT:* from Arduino UNO @ 9600 and drives apps + board feedback.
 *
 * Usage:
 *   npm start
 *   npm start -- --simulate
 *   PORT=/dev/cu.usbmodemXXXX npm start
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { APP_MAP, runOpen, lcdLabel } from './apps.js';
import {
  alertTest,
  cancelMeetingTimer,
  clearBoard,
  scheduleMeeting5,
  sendBuzz,
  sendLcd,
  sendRgb,
} from './alerts.js';
import { handleCapture, INBOX_PATH } from './capture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BAUD = 9600;
const SIMULATE = process.argv.includes('--simulate');

function log(...args) {
  console.log(...args);
}

/** Prefer /dev/cu.usbmodem*, then /dev/cu.usbserial*; PORT env wins. */
export function detectPort() {
  if (process.env.PORT) return process.env.PORT;
  try {
    const entries = fs.readdirSync('/dev');
    const cu = entries
      .filter((n) => n.startsWith('cu.usbmodem') || n.startsWith('cu.usbserial'))
      .map((n) => `/dev/${n}`)
      .sort((a, b) => {
        const am = a.includes('usbmodem') ? 0 : 1;
        const bm = b.includes('usbmodem') ? 0 : 1;
        return am - bm || a.localeCompare(b);
      });
    return cu[0] || null;
  } catch {
    return null;
  }
}

function createBoardWriter(port) {
  return {
    writeLine(line) {
      const payload = line.endsWith('\n') ? line : `${line}\n`;
      if (port && port.isOpen) {
        port.write(payload, (err) => {
          if (err) log('[serial write error]', err.message);
        });
      }
    },
    log,
    simulate: !port,
  };
}

/**
 * @param {ReturnType<typeof createBoardWriter>} ctx
 * @param {string} raw
 */
async function handleLine(ctx, raw) {
  const line = String(raw || '').trim();
  if (!line) return;

  log(`[← board] ${line}`);

  if (line.startsWith('EVENT:')) {
    const ev = line.slice(6);
    if (ev === 'BOOT') {
      sendRgb(ctx, 'green');
      sendLcd(ctx, 'Agent linked');
    }
    return;
  }

  if (!line.startsWith('KEY:')) {
    log(`[warn] ignored line: ${line}`);
    return;
  }

  const key = line.slice(4).trim().toUpperCase();

  switch (key) {
    case 'SPOTIFY':
    case 'CURSOR':
    case 'GROKBOT':
    case 'CHATGPT':
    case 'CODEX':
    case 'CLAUDE':
    case 'NOTION':
    case 'CHROME':
    case 'SLACK': {
      const entry = APP_MAP[key];
      try {
        await runOpen(ctx, entry);
      } catch (err) {
        log(`[open error] ${err.message}`);
        sendLcd(ctx, `Open failed: ${lcdLabel(entry, key)}`);
        sendRgb(ctx, 'red');
        break;
      }
      // Line1 = Opened, Line2 = app name (Arduino LCD: packs 32 chars → 2×16)
      sendLcd(ctx, `Opened          ${lcdLabel(entry, key)}`);
      sendRgb(ctx, 'white');
      break;
    }
    case 'MUTE':
      // v1 stub — macOS mute needs osascript; document later
      log('[mute] stub — toggle system mute (TODO: osascript)');
      sendLcd(ctx, 'MUTE stub');
      sendRgb(ctx, 'yellow');
      break;
    case 'DND':
      log('[dnd] stub — Focus / DND (TODO: shortcuts)');
      sendLcd(ctx, 'DND stub');
      sendRgb(ctx, 'yellow');
      break;
    case 'MEETING5': {
      const override = ctx.simulate ? process.env.SIMULATE_MEETING_MS : undefined;
      scheduleMeeting5(ctx, override ? { ms: Number(override) } : {});
      break;
    }
    case 'CAPTURE': {
      sendRgb(ctx, 'blue');
      sendLcd(ctx, 'Capture...');
      let result;
      try {
        result = await handleCapture(ctx);
      } catch (err) {
        log(`[capture error] ${err.message}`);
        sendLcd(ctx, 'Capture failed');
        sendRgb(ctx, 'red');
        break;
      }
      sendLcd(ctx, `Cap: ${result.route.choice}`);
      sendRgb(ctx, 'green');
      log(`[capture] destination: ${result.inboxPath}`);
      break;
    }
    case 'CLEAR':
      cancelMeetingTimer();
      clearBoard(ctx);
      break;
    case 'STATUS': {
      const portHint = ctx.simulate ? 'simulate' : process.env.PORT || detectPort();
      sendLcd(ctx, `OK ${String(portHint).slice(-12)}`);
      sendRgb(ctx, 'green');
      log(`[status] inbox=${INBOX_PATH}`);
      break;
    }
    case 'ALERT_TEST':
      alertTest(ctx);
      break;
    case 'RGB_CYCLE':
      // Board also cycles locally; agent ack
      sendLcd(ctx, 'RGB cycle ack');
      break;
    case 'BEEP_TEST':
      sendBuzz(ctx, 1);
      sendLcd(ctx, 'Beep ack');
      break;
    case 'HELP':
      sendLcd(ctx, '1-6 apps *cap 0clr');
      break;
    default:
      log(`[warn] unknown KEY:${key}`);
      sendLcd(ctx, `?${key}`.slice(0, 32));
      sendRgb(ctx, 'red');
  }
}

async function startSerial(portPath) {
  let SerialPort;
  let ReadlineParser;
  try {
    ({ SerialPort, ReadlineParser } = await import('serialport'));
  } catch (err) {
    log(`[error] serialport not available: ${err.message}`);
    log('Run: npm install');
    log('Falling back to --simulate mode.');
    return null;
  }

  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: portPath, baudRate: BAUD }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ port, parser });
    });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    port.on('error', (err) => log('[serial error]', err.message));
  });
}

async function runSimulate(ctx) {
  log('=== Creator Control Deck agent — SIMULATE mode ===');
  log('Type KEY: lines (e.g. KEY:SPOTIFY) or EVENT:BOOT. Ctrl+C to quit.');
  log(`Inbox path: ${INBOX_PATH}`);
  log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt('deck> ');
  rl.prompt();
  // Serialize handlers so async CAPTURE finishes before the next KEY line
  let chain = Promise.resolve();
  rl.on('line', (line) => {
    chain = chain.then(async () => {
      try {
        await handleLine(ctx, line);
      } catch (e) {
        log('[error]', e);
      }
      rl.prompt();
    });
  });
  rl.on('close', () => {
    chain.finally(() => {
      cancelMeetingTimer();
    });
  });
}

async function main() {
  // Use Node's parser for quoted values, comments, and shell-env precedence.
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    process.loadEnvFile(envPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  if (SIMULATE || process.platform !== 'darwin') {
    const ctx = createBoardWriter(null);
    await runSimulate(ctx);
    return;
  }

  const portPath = detectPort();
  if (!portPath) {
    log('[warn] No /dev/cu.usbmodem* or /dev/cu.usbserial* found.');
    log('Set PORT=... or re-run with --simulate');
    log('Entering simulate mode.');
    const ctx = createBoardWriter(null);
    await runSimulate(ctx);
    return;
  }

  log(`[serial] opening ${portPath} @ ${BAUD}`);
  let connection;
  try {
    connection = await startSerial(portPath);
  } catch (err) {
    log(`[error] could not open ${portPath}: ${err.message}`);
    log('Entering simulate mode. Use --simulate or fix PORT.');
    const ctx = createBoardWriter(null);
    await runSimulate(ctx);
    return;
  }

  if (!connection) {
    const ctx = createBoardWriter(null);
    await runSimulate(ctx);
    return;
  }

  const { port, parser } = connection;
  const ctx = createBoardWriter(port);
  log(`[serial] linked. Apps map: ${Object.keys(APP_MAP).join(', ')}`);
  log(`[serial] inbox → ${INBOX_PATH}`);

  let serialChain = Promise.resolve();
  parser.on('data', (data) => {
    serialChain = serialChain.then(async () => {
      try {
        await handleLine(ctx, String(data));
      } catch (e) {
        log('[error]', e);
      }
    });
  });

  port.on('close', () => {
    log('[serial] port closed');
    cancelMeetingTimer();
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
