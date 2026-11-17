import { arabicOnKey } from "@/domain/typing/layout";

export interface KeyDef {
  /** Character the key types (lower case), or a name for modifier keys. */
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly arabic: string | null;
  readonly x: number;
  readonly y: number;
  /** Finger index 0–9 (left pinky → right pinky), used for colour-coded hints. */
  readonly finger: number;
}

const ROWS: ReadonlyArray<ReadonlyArray<readonly [id: string, label: string, width: number, finger: number]>> = [
  [["`", "`", 1, 0], ["1", "1", 1, 0], ["2", "2", 1, 1], ["3", "3", 1, 2], ["4", "4", 1, 3], ["5", "5", 1, 3], ["6", "6", 1, 6], ["7", "7", 1, 6], ["8", "8", 1, 7], ["9", "9", 1, 8], ["0", "0", 1, 9], ["-", "-", 1, 9], ["=", "=", 1, 9], ["backspace", "⌫", 2, 9]],
  [["tab", "Tab", 1.5, 0], ["q", "Q", 1, 0], ["w", "W", 1, 1], ["e", "E", 1, 2], ["r", "R", 1, 3], ["t", "T", 1, 3], ["y", "Y", 1, 6], ["u", "U", 1, 6], ["i", "I", 1, 7], ["o", "O", 1, 8], ["p", "P", 1, 9], ["[", "[", 1, 9], ["]", "]", 1, 9], ["\\", "\\", 1.5, 9]],
  [["caps", "Caps", 1.75, 0], ["a", "A", 1, 0], ["s", "S", 1, 1], ["d", "D", 1, 2], ["f", "F", 1, 3], ["g", "G", 1, 3], ["h", "H", 1, 6], ["j", "J", 1, 6], ["k", "K", 1, 7], ["l", "L", 1, 8], [";", ";", 1, 9], ["'", "'", 1, 9], ["enter", "Enter", 2.25, 9]],
  [["shift-left", "Shift", 2.25, 0], ["z", "Z", 1, 0], ["x", "X", 1, 1], ["c", "C", 1, 2], ["v", "V", 1, 3], ["b", "B", 1, 3], ["n", "N", 1, 6], ["m", "M", 1, 6], [",", ",", 1, 7], [".", ".", 1, 8], ["/", "/", 1, 9], ["shift-right", "Shift", 2.75, 9]],
  [[" ", "", 6.25, 4]],
];

export const KEY_UNIT = 40;
export const KEY_GAP = 4;
export const KEYBOARD_WIDTH = 15 * KEY_UNIT;
export const KEYBOARD_HEIGHT = 5 * KEY_UNIT;

export const KEYS: readonly KeyDef[] = ROWS.flatMap((row, r) => {
  const rowWidth = row.reduce((w, k) => w + k[2], 0);
  let x = r === 4 ? ((15 - rowWidth) / 2) * KEY_UNIT : 0;
  return row.map(([id, label, width, finger]) => {
    const key: KeyDef = { id, label, width, finger, x, y: r * KEY_UNIT, arabic: id.length === 1 ? arabicOnKey(id) : null };
    x += width * KEY_UNIT;
    return key;
  });
});

const SHIFTED: Readonly<Record<string, string>> = {
  "~": "`", "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  _: "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/",
};

/** The physical key (and whether Shift is needed) for a character. */
export function keyForChar(ch: string): { id: string; shift: boolean } | null {
  if (ch === " ") return { id: " ", shift: false };
  if (/^[a-z0-9`\-=[\]\\;',./]$/.test(ch)) return { id: ch, shift: false };
  if (/^[A-Z]$/.test(ch)) return { id: ch.toLowerCase(), shift: true };
  const base = SHIFTED[ch];
  return base ? { id: base, shift: true } : null;
}
