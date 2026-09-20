# Creator Control Deck — Wiring (RexQualis UNO R3)

Power: USB from Mac only for v1. Common GND everywhere.

## 4×4 membrane keypad
Pad ribbon usually left→right: `R1 R2 R3 R4 C1 C2 C3 C4`.

| Keypad | UNO |
|--------|-----|
| R1 | D9 |
| R2 | D8 |
| R3 | D7 |
| R4 | D6 |
| C1 | D5 |
| C2 | D4 |
| C3 | D3 |
| C4 | D2 |

If keys come out scrambled, swap row/col in code — don’t re-solder first.

## LCD1602 (parallel, 4-bit) + contrast pot
Kit pot: outer legs to 5V and GND, wiper to LCD `Vo` (pin 3).

| LCD pin | Name | UNO / note |
|---------|------|------------|
| 1 | VSS | GND |
| 2 | VDD | 5V |
| 3 | Vo | pot wiper |
| 4 | RS | A0 |
| 5 | RW | GND |
| 6 | E | A1 |
| 11 | D4 | A2 |
| 12 | D5 | A3 |
| 13 | D6 | A4 |
| 14 | D7 | A5 |
| 15 | A (backlight +) | 5V via ~220Ω if bright |
| 16 | K (backlight −) | GND |

An **I2C** module (only 4 pins: GND VCC SDA SCL) requires a different sketch. SDA=A4, SCL=A5 on UNO (conflicts with this parallel map).

## Buzzer
| Buzzer | UNO |
|--------|-----|
| + | D11 |
| − | GND |

Use an **active buzzer** with this sketch: `digitalWrite` switches its internal oscillator on and off. A passive buzzer requires a `tone()` implementation; the current code does not generate a tone.

## RGB LED (common cathode)
| LED | via 220Ω | UNO |
|-----|----------|-----|
| R | resistor | D10 |
| G | resistor | D12 |
| B | resistor | D13 |
| cathode | — | GND |

For a common **anode** LED, connect the common pin to 5V and invert the HIGH/LOW logic in `setRgb()`. This sketch uses digital on/off signals, not PWM dimming.

## Mac check
Arduino IDE → Tools → Port → `/dev/cu.usbmodem…`

Serial Monitor **9600**, NL/CR either fine. Press keys → lines like `KEY:SPOTIFY` / `KEY:CAPTURE`.
