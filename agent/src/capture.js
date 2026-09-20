/**
 * CAPTURE v1 stub — no mic yet.
 * Appends a note to inbox.md in hardware mode; simulation previews only.
 * If TYPESAFE_API_KEY is set, optionally runs a TypeSafe/Jev Choice
 * (@typesafe-ai/sdk). If the SDK/key is missing, uses a mock Choice.
 *
 * Docs: https://docs.typesafe.ai/sdk/javascript.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const INBOX_PATH = path.resolve(__dirname, '..', 'inbox.md');

const MOCK_CHOICE = {
  type: 'choice',
  choice: 'note',
  confidence: 0.5,
  probabilities: { note: 0.5, task: 0.3, idea: 0.2 },
  mock: true,
};

/**
 * @returns {Promise<{ choice: string, confidence?: number, mock?: boolean, raw?: unknown }>}
 */
async function runTypeSafeChoice(stateText) {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) {
    return { ...MOCK_CHOICE, reason: 'TYPESAFE_API_KEY not set' };
  }

  try {
    // Optional dependency — see the versioned installation command in README.md.
    const { choice, TypeSafeClient } = await import('@typesafe-ai/sdk');
    const client = new TypeSafeClient({ apiKey: key, timeout: 5000, retry: { maxRetries: 0 } });
    const response = await client.systemOne({
      state: { capture: stateText },
      questions: {
        route: choice('How should this capture be filed?', {
          note: 'General note for inbox',
          task: 'Actionable to-do',
          idea: 'Idea / brainstorm',
        }),
      },
    });
    const ans = response.answers?.route;
    if (!['note', 'task', 'idea'].includes(ans?.choice)) {
      throw new Error('Invalid capture route');
    }
    return {
      choice: ans.choice,
      confidence: Number.isFinite(ans.confidence) && ans.confidence >= 0 && ans.confidence <= 1
        ? ans.confidence : undefined,
      probabilities: ans?.probabilities,
      mock: false,
      raw: ans,
    };
  } catch {
    // SDK errors may include request details; do not persist them with the note.
    return {
      ...MOCK_CHOICE,
      reason: 'TypeSafe unavailable or invalid response; check the SDK and API key',
    };
  }
}

/**
 * @param {{ log: (...a: unknown[]) => void, simulate: boolean }} ctx
 */
export async function handleCapture(ctx) {
  const ts = new Date().toISOString();
  const stubText =
    `[CAPTURE stub ${ts}] No mic yet — placeholder capture from Creator Control Deck.`;

  const route = ctx.simulate
    ? { ...MOCK_CHOICE, reason: 'Simulation: no API call or file write' }
    : await runTypeSafeChoice(stubText);

  const block = [
    '',
    `## Capture ${ts}`,
    '',
    `- Destination: \`${INBOX_PATH}\``,
    `- TypeSafe Choice: **${route.choice}**` +
      (route.mock ? ' (mock)' : '') +
      (route.confidence != null ? ` conf=${route.confidence}` : ''),
    route.reason ? `- Note: ${route.reason}` : null,
    '',
    stubText,
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');

  if (!ctx.simulate) fs.appendFileSync(INBOX_PATH, block, 'utf8');

  ctx.log(`[capture] ${ctx.simulate ? 'would write note' : 'wrote note'} → ${INBOX_PATH}`);
  ctx.log(`[capture] Choice → ${route.choice}${route.mock ? ' (mock)' : ''}`);
  if (route.reason) ctx.log(`[capture] ${route.reason}`);

  return { inboxPath: INBOX_PATH, route };
}
