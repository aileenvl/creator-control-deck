/**
 * Board feedback helpers + MEETING5 local timer.
 * Agent → UNO lines: LCD:text (≤32), BUZZ:n (1–5), RGB:red|green|blue|yellow|off|white
 */

const MEETING_MS = 5 * 60 * 1000;

/** @typedef {{ writeLine: (line: string) => void, log: (...args: unknown[]) => void, simulate: boolean }} BoardCtx */

/**
 * @param {BoardCtx} ctx
 * @param {string} text
 */
export function sendLcd(ctx, text) {
  // The LCD expects single-byte characters; newlines would start another command.
  const clipped = String(text ?? '').replace(/[^\x20-\x7e]/g, ' ').slice(0, 32);
  const line = `LCD:${clipped}`;
  ctx.log(`[→ board] ${line}`);
  ctx.writeLine(line);
}

/**
 * @param {BoardCtx} ctx
 * @param {number} n
 */
export function sendBuzz(ctx, n = 1) {
  const count = Math.min(5, Math.max(1, Math.trunc(Number(n)) || 1));
  const line = `BUZZ:${count}`;
  ctx.log(`[→ board] ${line}`);
  ctx.writeLine(line);
}

/**
 * @param {BoardCtx} ctx
 * @param {string} color
 */
export function sendRgb(ctx, color) {
  const c = String(color || 'off').toLowerCase();
  const allowed = new Set(['red', 'green', 'blue', 'yellow', 'off', 'white']);
  const safe = allowed.has(c) ? c : 'off';
  const line = `RGB:${safe}`;
  ctx.log(`[→ board] ${line}`);
  ctx.writeLine(line);
}

/** CLEAR: green + Ready */
export function clearBoard(ctx) {
  sendRgb(ctx, 'green');
  sendLcd(ctx, 'Ready');
}

/** ALERT_TEST from agent side */
export function alertTest(ctx) {
  sendRgb(ctx, 'yellow');
  sendLcd(ctx, 'ALERT TEST from agent');
  sendBuzz(ctx, 2);
}

let meetingTimer = null;

/**
 * Schedule a 5-minute local timer, then LCD + BUZZ on the board.
 * @param {BoardCtx} ctx
 * @param {{ ms?: number }} [opts]
 */
export function scheduleMeeting5(ctx, opts = {}) {
  const ms = opts.ms ?? MEETING_MS;
  if (!Number.isInteger(ms) || ms < 1 || ms > 2147483647) {
    throw new RangeError('Meeting duration must be an integer from 1 to 2147483647 ms');
  }
  if (meetingTimer) {
    clearTimeout(meetingTimer);
    meetingTimer = null;
    ctx.log('[meeting] previous timer cancelled');
  }

  const label =
    ms >= 60000
      ? `${Math.round(ms / 60000)}m`
      : `${Math.round(ms / 1000)}s`;
  sendRgb(ctx, 'blue');
  sendLcd(ctx, `Meeting ${label} started`);
  ctx.log(`[meeting] timer armed for ${ms}ms (${label})`);

  meetingTimer = setTimeout(() => {
    meetingTimer = null;
    ctx.log('[meeting] TIME UP');
    sendRgb(ctx, 'red');
    sendLcd(ctx, 'Meeting time up!');
    sendBuzz(ctx, 3);
  }, ms);
}

export function cancelMeetingTimer() {
  if (meetingTimer) {
    clearTimeout(meetingTimer);
    meetingTimer = null;
  }
}
