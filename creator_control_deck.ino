/*
  Creator Control Deck — weekend v1 panel
  RexQualis UNO R3: 4x4 keypad + LCD1602 + RGB + buzzer
  USB serial @ 9600 → macOS agent

  Libraries (Library Manager):
    - Keypad by Mark Stanley, Alexander Brevig
    - LiquidCrystal by Arduino
*/

#include <Keypad.h>
#include <LiquidCrystal.h>

// --- Pins (match WIRING.md) ---
// Keypad's constructor takes mutable byte arrays.
byte ROW_PINS[4] = {9, 8, 7, 6};
byte COL_PINS[4] = {5, 4, 3, 2};

const int PIN_BUZZER = 11;
const int PIN_LED_R = 10;
const int PIN_LED_G = 12;
const int PIN_LED_B = 13;

// LCD: RS, E, D4, D5, D6, D7 on A0..A5
LiquidCrystal lcd(A0, A1, A2, A3, A4, A5);

char keys[4][4] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

Keypad keypad = Keypad(makeKeymap(keys), ROW_PINS, COL_PINS, 4, 4);

String lastLine = "Ready";

void setRgb(bool r, bool g, bool b) {
  digitalWrite(PIN_LED_R, r ? HIGH : LOW);
  digitalWrite(PIN_LED_G, g ? HIGH : LOW);
  digitalWrite(PIN_LED_B, b ? HIGH : LOW);
}

void beep(int ms) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(ms);
  digitalWrite(PIN_BUZZER, LOW);
}

void showLcd(const String &line1, const String &line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, 16));
}

// Map keypad char → serial token for the Mac agent
String tokenForKey(char k) {
  switch (k) {
    case '1': return "SPOTIFY";
    case '2': return "CHATGPT";
    case '3': return "GROKBOT";
    case '4': return "CHROME";
    case '5': return "CLAUDE";
    case '6': return "SLACK";
    case '7': return "MUTE";
    case '8': return "DND";
    case '9': return "MEETING5";
    case '*': return "CAPTURE";
    case '0': return "CLEAR";
    case '#': return "STATUS";
    case 'A': return "ALERT_TEST";
    case 'B': return "RGB_CYCLE";
    case 'C': return "BEEP_TEST";
    case 'D': return "HELP";
    default:  return "UNKNOWN";
  }
}

void handlePcCommand(String line) {
  line.trim();
  if (line.length() == 0) return;

  // PC → UNO: LCD:text (max 32 chars → 2 lines)
  if (line.startsWith("LCD:")) {
    String msg = line.substring(4);
    String a = msg.substring(0, 16);
    String b = msg.length() > 16 ? msg.substring(16, 32) : "";
    showLcd(a, b);
    lastLine = a;
    return;
  }

  if (line.startsWith("BUZZ:")) {
    int n = line.substring(5).toInt();
    if (n < 1) n = 1;
    if (n > 5) n = 5;
    for (int i = 0; i < n; i++) {
      beep(80);
      delay(80);
    }
    return;
  }

  if (line.startsWith("RGB:")) {
    String c = line.substring(4);
    c.toLowerCase();
    if (c == "red") setRgb(true, false, false);
    else if (c == "green") setRgb(false, true, false);
    else if (c == "blue") setRgb(false, false, true);
    else if (c == "yellow") setRgb(true, true, false);
    else if (c == "off") setRgb(false, false, false);
    else if (c == "white") setRgb(true, true, true);
    return;
  }
}

void setup() {
  Serial.begin(9600);

  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  setRgb(false, true, false); // green = ready

  lcd.begin(16, 2);
  showLcd("Control Deck", "Ready");
  Serial.println("EVENT:BOOT");
}

void loop() {
  // Read commands from Mac agent
  static String incoming;
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (incoming.length() > 0) {
        handlePcCommand(incoming);
        incoming = "";
      }
    } else {
      incoming += c;
      if (incoming.length() > 80) incoming = "";
    }
  }

  char key = keypad.getKey();
  if (!key) return;

  String token = tokenForKey(key);
  Serial.print("KEY:");
  Serial.println(token);

  // Local feedback (agent will refine later)
  if (token == "CLEAR") {
    setRgb(false, true, false);
    showLcd("Control Deck", "Ready");
    beep(40);
  } else if (token == "CAPTURE") {
    setRgb(false, false, true);
    showLcd("Capture", "Listening...");
    beep(120);
  } else if (token == "ALERT_TEST") {
    setRgb(true, true, false);
    showLcd("Alert test", "BUZZ x2");
    beep(80); delay(80); beep(80);
  } else if (token == "RGB_CYCLE") {
    setRgb(true, false, false); delay(150);
    setRgb(false, true, false); delay(150);
    setRgb(false, false, true); delay(150);
    setRgb(false, true, false);
    showLcd("RGB", "OK");
  } else if (token == "BEEP_TEST") {
    beep(200);
    showLcd("Beep", "OK");
  } else if (token == "HELP") {
    showLcd("1-6 apps *cap", "0 clr # status");
    beep(40);
  } else {
    setRgb(true, true, true);
    showLcd(token.substring(0, 16), "sent");
    beep(50);
    delay(80);
    setRgb(false, true, false);
  }
}
