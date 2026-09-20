# Creator Control Deck — macOS serial agent

Node.js agent that talks to the Arduino UNO sketch over USB serial (**9600 baud**).

Keypad presses arrive as lines like `KEY:SPOTIFY`; the agent opens macOS apps and can send `LCD:`, `BUZZ:`, and `RGB:` back to the board.

Pairs with:

- Sketch: [`../creator_control_deck.ino`](../creator_control_deck.ino)
- Wiring: [`../WIRING.md`](../WIRING.md)

## Requirements

- macOS (for `open -a "AppName"`)
- Node.js 20.12+ (Node 24 selected by the repository's `.nvmrc`)
- Arduino UNO flashed with `creator_control_deck.ino`, USB connected
- Close **Arduino Serial Monitor** while the agent runs (only one process can own the port)

## Install

```bash
cd creator-control-deck/agent
npm ci --ignore-scripts
```

Optional (CAPTURE TypeSafe / Jev Choice — not required for v1):

```bash
npm install --no-save --package-lock=false @typesafe-ai/sdk@0.6.0
cp .env.example .env
# edit .env → set TYPESAFE_API_KEY=...
```

## Run

```bash
npm start
```

### Simulate (no hardware / Linux / CI)

Prints the `open -a` commands, LCD/BUZZ/RGB lines, and proposed file writes. It does not launch apps, write the inbox, call TypeSafe, or touch a serial port. Automatic fallback uses the same safe simulation behavior:

```bash
npm start -- --simulate
# or
npm run simulate
```

Then type lines interactively:

```text
deck> KEY:SPOTIFY
deck> KEY:CAPTURE
deck> KEY:MEETING5
deck> KEY:CLEAR
deck> KEY:ALERT_TEST
deck> EVENT:BOOT
```

Tip: for a fast meeting alert in simulate, use:

```bash
SIMULATE_MEETING_MS=3000 npm start -- --simulate
```

Then `KEY:MEETING5` and wait ~3s for the LCD/BUZZ alert.

The override applies only in simulation and must be a positive integer no larger than 2147483647. Closing stdin cancels pending timers; keep the interactive session open to see the alert.

## Pick a serial port

Auto-detect order:

1. `PORT` environment variable (if set)
2. First `/dev/cu.usbmodem*`
3. Else first `/dev/cu.usbserial*`

Examples:

```bash
# list candidates
ls /dev/cu.usbmodem* /dev/cu.usbserial* 2>/dev/null

PORT=/dev/cu.usbmodem14101 npm start
```

Or copy `.env.example` → `.env` and set `PORT=...`. Node's built-in `.env` loader supports comments and quotes; shell environment values take precedence.

## Edit which apps open

Edit [`src/apps.js`](src/apps.js). Defaults:

| Key token   | Opens              |
|-------------|--------------------|
| `SPOTIFY`   | Spotify            |
| `CHATGPT`   | ChatGPT            |
| `GROKBOT`   | Grok Bot           |
| `CHROME`    | Google Chrome      |
| `CLAUDE`    | Claude             |
| `SLACK`     | Slack              |

Legacy aliases: `CURSOR` / `CODEX` → ChatGPT, `NOTION` → Google Chrome. Apps must be installed under the configured names; failed launches show a red LED and an error message.

### Change GROKBOT to a URL

In `src/apps.js`:

```js
GROKBOT: { kind: 'url', url: 'https://x.com/i/grok' },
```

App entries use `open -a "Name"`; URL entries use `open "https://..."`.

## Protocol (UNO ↔ agent)

**UNO → Mac** (newline-terminated):

- `KEY:SPOTIFY` … `KEY:HELP` (see sketch `tokenForKey`)
- `EVENT:BOOT` on reset

**Mac → UNO**:

| Line | Meaning |
|------|---------|
| `LCD:text` | Up to 32 chars → 2×16 LCD |
| `BUZZ:n` | Beep 1–5 times |
| `RGB:red\|green\|blue\|yellow\|off\|white` | Status LED |

### Agent key behavior (v1)

| Key | Agent action |
|-----|----------------|
| App keys 1–6 | `open -a` / URL from `apps.js` + LCD ack |
| `MUTE` / `DND` | Stub (LCD note; real OS hooks TBD) |
| `MEETING5` | Local 5‑min timer → `RGB:red` + `LCD:Meeting time up!` + `BUZZ:3` |
| `CAPTURE` | In hardware mode, stub note → `agent/inbox.md`; optional TypeSafe Choice if `TYPESAFE_API_KEY` set. Simulation previews only. |
| `CLEAR` | Cancel meeting timer; `RGB:green` + `LCD:Ready` |
| `STATUS` | LCD status snippet |
| `ALERT_TEST` | Agent-side LCD + BUZZ + yellow RGB |
| `RGB_CYCLE` / `BEEP_TEST` / `HELP` | Mostly board-local; agent acknowledges |

## CAPTURE + TypeSafe (optional)

In hardware mode, without a key, CAPTURE:

1. Appends a timestamped stub note to `inbox.md` (created automatically and ignored by Git)
2. Logs the destination path
3. Uses a **mock Choice** (`note` / `task` / `idea`)

With `TYPESAFE_API_KEY` and `@typesafe-ai/sdk` installed, CAPTURE sends the placeholder text to TypeSafe using `systemOne` + `choice()` per the [TypeSafe JS SDK](https://docs.typesafe.ai/sdk/javascript.md). It labels the saved note as `note`, `task`, or `idea`; all routes still write to the same inbox. The call has a five-second timeout and no retries. If the SDK/call fails or returns an invalid route, the agent falls back to the mock and still writes the inbox. Raw SDK errors are not persisted or logged. Simulation always uses the mock without an API call. The optional SDK is not part of the default lockfile; running `npm ci` removes it.

## Project layout

```text
agent/
  package.json
  .env.example
  README.md
  inbox.md          # created/appended by CAPTURE
  src/
    index.js        # serial loop + KEY dispatch
    apps.js         # edit me — app / URL map
    alerts.js       # LCD/BUZZ/RGB + meeting timer
    capture.js      # CAPTURE stub + TypeSafe hook
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port busy / open failed | Quit Serial Monitor; unplug/replug USB; set `PORT=` |
| Keys do nothing on Mac | Confirm Serial Monitor shows `KEY:…` at 9600; then run agent alone |
| Wrong app opens | Edit `src/apps.js` names to match Applications folder |
| Linux box / CI | Use `--simulate` — `open -a` is only executed on darwin outside simulate |

## Weekend checklist

1. Wire per `WIRING.md`, flash `creator_control_deck.ino`
2. Serial Monitor: press keys → see `KEY:…`
3. Close Monitor → `cd agent && npm ci --ignore-scripts && npm start`
4. Press `1` → Spotify; `*` → inbox note; `9` → 5‑min timer; `0` → Ready
