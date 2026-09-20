# Creator Control Deck

A USB desk controller built with an Arduino UNO, a 4×4 keypad, a 16×2 LCD, an RGB LED, and a buzzer. A small Node.js agent on your Mac opens apps, runs a meeting timer, and saves placeholder capture notes.

## What works

| Key | Action |
| --- | --- |
| `1` | Open Spotify |
| `2` | Open ChatGPT |
| `3` | Open Grok Bot (must be installed, or customize the mapping) |
| `4` | Open Google Chrome |
| `5` | Open Claude |
| `6` | Open Slack |
| `7` / `8` | Mute / Do Not Disturb placeholders; display a status message only |
| `9` | Start or restart a five-minute meeting timer |
| `*` | Save a timestamped placeholder note; microphone capture is not implemented |
| `0` | Cancel the meeting timer and clear the display |
| `#` | Show agent status |
| `A` / `B` / `C` / `D` | Alert test / RGB cycle / buzzer test / help |

## Quick start without hardware

Use Node.js **20.12 or newer**. `.nvmrc` selects Node 24 if you use nvm.

From this repository's root:

```sh
cd agent
npm ci --ignore-scripts
npm run simulate
```

Type `KEY:SPOTIFY`, `KEY:CAPTURE`, or `KEY:MEETING5`, then press Enter. Simulation prints its actions without opening apps, writing notes, contacting TypeSafe, or touching a serial port. Ctrl+C exits. Linux and other non-macOS systems run in simulation automatically.

## Set up the hardware

1. Wire an UNO-compatible board according to [WIRING.md](WIRING.md).
2. In Arduino IDE, install **Arduino AVR Boards**, **Keypad 3.1.1**, and **LiquidCrystal 1.0.7** through the board/library managers.
3. Open [creator_control_deck.ino](creator_control_deck.ino). If the IDE asks to create a sketch folder named `creator_control_deck`, allow it; Arduino requires the folder and sketch names to match.
4. Choose **Arduino Uno** and your USB port, then upload.
5. Open Serial Monitor at **9600 baud**. Press `1` and confirm `KEY:SPOTIFY` appears. Close Serial Monitor before starting the agent.
6. From `agent/`, run `npm start`.

The agent chooses the first `/dev/cu.usbmodem*`, then `/dev/cu.usbserial*`. Override it when multiple boards are connected:

```sh
PORT=/dev/cu.usbmodem14101 npm start
```

An unavailable port or serial library switches to simulation and prints the reason. A disconnected board ends the agent; reconnect it and restart `npm start`.

The buzzer code currently expects an **active buzzer**. The RGB LED wiring expects a **common-cathode** LED. This sketch uses a parallel LCD, not an I2C module.

## Configuration and capture

Copy `agent/.env.example` to `agent/.env` to set a port or optional API key. Environment variables set in the shell take precedence. No API key is needed for the default app controls or local captures.

Customize app names and URLs in [agent/src/apps.js](agent/src/apps.js). The legacy tokens `CURSOR` and `CODEX` open ChatGPT; `NOTION` opens Chrome, for compatibility with older firmware.

In hardware mode, CAPTURE creates or appends to `agent/inbox.md`. It currently saves a placeholder, not audio or dictated text. The inbox and `.env` files are ignored by Git. Optional TypeSafe setup and the serial protocol are documented in [agent/README.md](agent/README.md).

## Development and checks

```sh
cd agent
npm run check
npm test
npm audit
```

Tests use temporary files and fake external services. They do not launch your installed apps or connect to the board. The serial dependency ships native prebuilt bindings; `npm ci --ignore-scripts` avoids installation scripts. On an unsupported platform requiring a native build, inspect the dependency's build instructions before enabling scripts.

To compile the firmware without uploading, install Arduino CLI plus the same board and library versions, then run from the repository root:

```sh
arduino-cli core update-index
arduino-cli core install arduino:avr@1.8.6
arduino-cli lib install 'Keypad@3.1.1' 'LiquidCrystal@1.0.7'
bash scripts/check-firmware.sh
```

The script stages a copy in a temporary folder with Arduino's required name. Set `ARDUINO_CLI` to the executable path if it is not on your PATH. It never uploads to a board.

GitHub Actions runs JavaScript checks/tests on Linux and macOS and compiles the UNO sketch on pushes and pull requests. See [REVIEW.md](REVIEW.md) for this review's findings and remaining improvements.

## Project layout

```text
creator_control_deck.ino  Arduino firmware and keypad mapping
WIRING.md                 Pin assignments and components
agent/src/                macOS agent, app launcher, timer, capture
agent/test/               Automated regression tests
scripts/check-firmware.sh Compile-only Arduino check
.github/workflows/ci.yml   Automated checks
```

## Adding to GitHub

Create an empty GitHub repository and add its URL as this project's remote. Run commands from this directory, and confirm `git rev-parse --show-toplevel` points to this project before committing or pushing. Review `git status` to confirm only project files are included. Do not upload `node_modules`, `.env`, or `agent/inbox.md` manually.

## License

[MIT](LICENSE), matching the agent's existing package metadata.
