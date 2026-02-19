/**
 * Precomputed color lookup tables for DMX channel visualisation.
 *
 * Ramp: near-black (value 0) → deep blue → bright cyan-blue (value 255).
 * Using a lookup table avoids per-frame color math in the template.
 */

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function buildBgColorTable(): ReadonlyArray<string> {
  const table: string[] = new Array(256);
  for (let v = 0; v < 256; v++) {
    if (v === 0) {
      table[v] = '#1c1c1e'; // near-black
    } else {
      const t = v / 255;
      // R: stays near 0
      // G: rises slowly to ~110 (subtle teal at max)
      // B: rises from 60 to 255 (strong blue, full brightness at max)
      const r = 0;
      const g = Math.round(110 * t * t);          // quadratic – slow rise
      const b = Math.round(60 + 195 * t);         // linear  – dominant channel
      table[v] = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }
  return table;
}

function buildValueTextColorTable(): ReadonlyArray<string> {
  const table: string[] = new Array(256);
  for (let v = 0; v < 256; v++) {
    if (v === 0) {
      table[v] = '#444444';
    } else if (v >= 200) {
      table[v] = '#ffffff';
    } else {
      const gray = Math.round(100 + 155 * (v / 200));
      const h = toHex(gray);
      table[v] = `#${h}${h}${h}`;
    }
  }
  return table;
}

/**
 * `CHANNEL_BG[value]` → hex background color for a channel box.
 * Index 0 = dark (value 0), index 255 = bright cyan-blue.
 */
export const CHANNEL_BG: ReadonlyArray<string> = buildBgColorTable();

/**
 * `CHANNEL_TEXT[value]` → hex text color for the DMX value label.
 * Scales from dim (#444) at 0 to white at 255.
 */
export const CHANNEL_TEXT: ReadonlyArray<string> = buildValueTextColorTable();
