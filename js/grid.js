/*
 * The grid: an arpeggiator that never plays a note of its own (unless you
 * ask it to). Its clock, chords and patterns come from a two-voice
 * arpeggiator; its steps are wired into the drone instead of into pitch:
 *
 *   1. Slice    resonant filters step through the chord's frequencies,
 *               carving formants out of the continuous bed
 *   2. Echo     a delay whose time and feedback jump with each step
 *   3. Texture  fold, wave shaping, multiplication and excitation pulse
 *               with the clock while the pitch stays where it is
 *   4. Pan      the drone split into frequency bands, each thrown across
 *               the stereo field in a geometric pattern
 *
 * Pure data and pure functions, shared by the page and the offline renderer.
 * The signal engine keeps its own copy of the chord table (worklets cannot
 * import modules everywhere).
 */

export const CHORDS = {
  thirteenth: [0, 4, 7, 11, 14, 17, 21], seventh: [0, 4, 7, 11], ninth: [0, 4, 7, 11, 14],
  eleventh: [0, 4, 7, 11, 14, 17], major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6],
  augmented: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7], minor7: [0, 3, 7, 10],
  minor9: [0, 3, 7, 10, 14], dom7: [0, 4, 7, 10], maj9: [0, 4, 7, 11, 14],
  // harmonic: the first chord tones of the natural harmonic series (4:5:6:7:8:9:10:11)
  harmonic: [0, 4, 7, 10, 12, 14, 16, 17],
};
export const CHORD_NAMES = Object.keys(CHORDS);

export const SUBDIVS = [
  { id: 1, label: '1/4' }, { id: 2, label: '1/8' }, { id: 3, label: '1/8T' }, { id: 4, label: '1/16' }, { id: 8, label: '1/32' },
];
export const subdivLabel = (v) => (SUBDIVS.find((s) => s.id === v) || SUBDIVS[3]).label;

export const CLOCKS = [
  { id: 'tempo', label: 'Tempo' },
  { id: 'gates', label: 'Logic gates' },
  { id: 'breath', label: 'Breath' },
];
export const MODES = [
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
  { id: 'updown', label: 'Up and down' },
  { id: 'random', label: 'Random (seeded)' },
  { id: 'web', label: 'The web chooses' },
];
export const KEYS = [{ id: -1, label: 'Follow the web' },
  ...['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'].map((n, i) => ({ id: i, label: n }))];
export const TUNINGS = [{ id: 'just', label: 'Just' }, { id: 'equal', label: 'Equal' }];
export const ENVS = [{ id: 'instant', label: 'Step' }, { id: 'fade', label: 'Glide' }];
export const WAVES = ['sine', 'triangle', 'sawtooth', 'square'].map((w) => ({ id: w, label: w[0].toUpperCase() + w.slice(1) }));
export const SLICE_MODES = [
  { id: 'band', label: 'Formants (band)' },
  { id: 'peak', label: 'Peaks over the bed' },
  { id: 'low', label: 'Resonant low-pass' },
];
export const SLICE_WHERE = [{ id: 'out', label: 'After the loop' }, { id: 'loop', label: 'Inside the loop' }];
export const ECHO_MAPS = [{ id: 'chord', label: 'Chord ratios' }, { id: 'steps', label: 'Step multiples' }];
export const ECHO_HEADS = [{ id: 'jump', label: 'Jump (crossfade)' }, { id: 'glide', label: 'Glide (tape bend)' }];
export const VOICE_SEL = [{ id: 'a', label: 'Voice A' }, { id: 'b', label: 'Voice B' }];
export const TEX_SOURCES = [
  { id: 'a', label: 'Voice A degree' }, { id: 'b', label: 'Voice B degree' },
  { id: 'pulse', label: 'Pulse on every step' }, { id: 'alt', label: 'Alternate ±' },
];
export const PAN_PATTERNS = [
  { id: 'orbit', label: 'Orbit' }, { id: 'pingpong', label: 'Ping-pong' }, { id: 'mirror', label: 'Mirror' },
  { id: 'scatter', label: 'Scatter (seeded)' }, { id: 'chord', label: 'Follow voice A' },
];

export function defaultGrid() {
  return {
    on: true,
    clock: 'tempo',
    bpm: 75, subdiv: 4, thrMin: 0, thrMax: 0,
    chord: 'thirteenth', mode: 'up', key: -1, tuning: 'just',
    regA: 48, regB: 60, epMin: 3, epMax: 7,
    env: 'instant', attack: 0.01,
    seed: 1,
    voices: { level: 0, wave: 'sine', detune: 0, toLoop: 0, width: 0.5 },
    slice: { mix: 0.55, q: 9, oct: 2, mode: 'peak', where: 'out' },
    echo: { mix: 0.3, time: 0.75, fb: 0.45, fbStep: 0.25, map: 'chord', heads: 'jump', tone: 0.6, voice: 'b', toLoop: 0.08, spread: 0.5 },
    tex: { src: 'pulse', fold: 0.35, shape: 0.25, mult: 0.15, exc: 0.2, decay: 0.18 },
    pan: { depth: 0.7, pattern: 'orbit', split: 4, slew: 0.04, cycle: 8 },
  };
}

/*
 * The Value Menu: arpeggiator presets. They load the clock and pattern only,
 * never the drone or the lanes, so any web can be ordered at any size.
 */
export const VALUE_MENU = [
  { name: 'Slow Arp', price: '0.99', bpm: 75, subdiv: 4, thrMin: 60, thrMax: 72, chord: 'thirteenth', regs: [36, 48, 60], mode: 'random', env: 'fade', attack: 0.25, epMin: 0, epMax: 0 },
  { name: 'Slow Arp II', price: '1.29', bpm: 75, subdiv: 4, thrMin: 30, thrMax: 36, chord: 'thirteenth', regs: [36, 48, 60], mode: 'random', env: 'fade', attack: 0.2, epMin: 0, epMax: 0 },
  { name: 'Slow Arp III', price: '1.49', bpm: 75, subdiv: 4, thrMin: 30, thrMax: 36, chord: 'thirteenth', regs: [36, 48, 60, 72], mode: 'random', env: 'fade', attack: 0.15, epMin: 0, epMax: 0 },
  { name: 'Slow Arp IV', price: '1.69', bpm: 75, subdiv: 4, thrMin: 25, thrMax: 30, chord: 'thirteenth', regs: [36, 48, 60, 72], mode: 'random', env: 'fade', attack: 0.12, epMin: 0, epMax: 0 },
  { name: 'Fast Arp', price: '2.19', bpm: 75, subdiv: 4, thrMin: 0, thrMax: 0, chord: 'thirteenth', regs: [36, 48, 60, 72], mode: 'up', env: 'instant', attack: 0.01, epMin: 3, epMax: 7 },
  { name: 'Fast Arp II', price: '2.49', bpm: 75, subdiv: 4, thrMin: 0, thrMax: 0, chord: 'minor9', regs: [36, 48, 60, 72], mode: 'updown', env: 'instant', attack: 0.01, epMin: 3, epMax: 5 },
  { name: 'Super Fast', price: '2.99', bpm: 150, subdiv: 4, thrMin: 0, thrMax: 0, chord: 'thirteenth', regs: [36, 48, 60, 72], mode: 'up', env: 'instant', attack: 0.005, epMin: 0, epMax: 0 },
  { name: 'Biggie Web', price: '3.49', bpm: 96, subdiv: 2, thrMin: 0, thrMax: 0, chord: 'harmonic', regs: [36, 48, 60], mode: 'web', env: 'instant', attack: 0.01, epMin: 4, epMax: 8 },
];

/*
 * Ordering from the menu. Biggie picked a register for each voice at random;
 * here the pick is seeded by the order number, so the same order always
 * comes out the same.
 */
export function orderFromMenu(grid, idx, orderNo) {
  const p = VALUE_MENU[idx];
  if (!p) return grid;
  let t = (Math.imul(orderNo + 1, 0x9e3779b1) ^ (idx * 0x85ebca6b)) >>> 0;
  const rand = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  grid.bpm = p.bpm; grid.subdiv = p.subdiv; grid.thrMin = p.thrMin; grid.thrMax = p.thrMax;
  grid.chord = p.chord; grid.mode = p.mode; grid.env = p.env; grid.attack = p.attack;
  grid.epMin = p.epMin; grid.epMax = p.epMax;
  grid.regA = p.regs[Math.floor(rand() * p.regs.length)];
  grid.regB = p.regs[Math.floor(rand() * p.regs.length)];
  grid.seed = 1 + Math.floor(rand() * 9999);
  grid.clock = 'tempo';
  grid.on = true;
  return grid;
}

function num(v, d, lo, hi) {
  const n = typeof v === 'number' && isFinite(v) ? v : d;
  return Math.min(hi, Math.max(lo, n));
}
const pick = (v, list, d) => (list.some((o) => o.id === v) ? v : d);

export function normalizeGrid(input) {
  const d = defaultGrid();
  const g = input && typeof input === 'object' ? input : {};
  const V = g.voices || {}, Sl = g.slice || {}, E = g.echo || {}, T = g.tex || {}, P = g.pan || {};
  const thrMin = Math.round(num(g.thrMin, d.thrMin, 0, 100));
  return {
    on: typeof g.on === 'boolean' ? g.on : d.on,
    clock: pick(g.clock, CLOCKS, d.clock),
    bpm: num(g.bpm, d.bpm, 20, 300),
    subdiv: pick(g.subdiv, SUBDIVS, d.subdiv),
    thrMin,
    thrMax: Math.max(thrMin, Math.round(num(g.thrMax, d.thrMax, 0, 100))),
    chord: CHORDS[g.chord] ? g.chord : d.chord,
    mode: pick(g.mode, MODES, d.mode),
    key: Math.round(num(g.key, d.key, -1, 11)),
    tuning: pick(g.tuning, TUNINGS, d.tuning),
    regA: Math.round(num(g.regA, d.regA, 24, 84) / 12) * 12,
    regB: Math.round(num(g.regB, d.regB, 24, 84) / 12) * 12,
    epMin: Math.round(num(g.epMin, d.epMin, 0, 8)),
    epMax: Math.round(num(g.epMax, d.epMax, 0, 8)),
    env: pick(g.env, ENVS, d.env),
    attack: num(g.attack, d.attack, 0.001, 2),
    seed: Math.round(num(g.seed, d.seed, 0, 99999)),
    voices: {
      level: num(V.level, d.voices.level, 0, 1), wave: pick(V.wave, WAVES, d.voices.wave),
      detune: num(V.detune, d.voices.detune, 0, 50), toLoop: num(V.toLoop, d.voices.toLoop, 0, 1), width: num(V.width, d.voices.width, 0, 1),
    },
    slice: {
      mix: num(Sl.mix, d.slice.mix, 0, 1), q: num(Sl.q, d.slice.q, 0.7, 30), oct: Math.round(num(Sl.oct, d.slice.oct, -1, 4)),
      mode: pick(Sl.mode, SLICE_MODES, d.slice.mode), where: pick(Sl.where, SLICE_WHERE, d.slice.where),
    },
    echo: {
      mix: num(E.mix, d.echo.mix, 0, 1), time: num(E.time, d.echo.time, 0.0625, 4), fb: num(E.fb, d.echo.fb, 0, 0.92),
      fbStep: num(E.fbStep, d.echo.fbStep, 0, 0.6), map: pick(E.map, ECHO_MAPS, d.echo.map), heads: pick(E.heads, ECHO_HEADS, d.echo.heads),
      tone: num(E.tone, d.echo.tone, 0, 1), voice: pick(E.voice, VOICE_SEL, d.echo.voice), toLoop: num(E.toLoop, d.echo.toLoop, 0, 1),
      spread: num(E.spread, d.echo.spread, 0, 1),
    },
    tex: {
      src: pick(T.src, TEX_SOURCES, d.tex.src), fold: num(T.fold, d.tex.fold, -1, 1), shape: num(T.shape, d.tex.shape, -1, 1),
      mult: num(T.mult, d.tex.mult, -1, 1), exc: num(T.exc, d.tex.exc, -1, 1), decay: num(T.decay, d.tex.decay, 0.02, 2),
    },
    pan: {
      depth: num(P.depth, d.pan.depth, 0, 1), pattern: pick(P.pattern, PAN_PATTERNS, d.pan.pattern),
      split: Math.round(num(P.split, d.pan.split, 2, 4)), slew: num(P.slew, d.pan.slew, 0.002, 1), cycle: Math.round(num(P.cycle, d.pan.cycle, 2, 32)),
    },
  };
}

/* Milliseconds per tick, as the arpeggiator always showed it. */
export const tickMs = (bpm, subdiv) => Math.round(60000 / (bpm * subdiv));

/* A standard MIDI file of the grid's steps: voice A on channel 1, B on 2. */
export function buildMidiFile(events, bpm) {
  const tpb = 480;
  const ticksPerSec = (bpm / 60) * tpb;
  const vl = (v) => { const b = []; let x = v & 0x7f; b.unshift(x); v >>= 7; while (v > 0) { x = (v & 0x7f) | 0x80; b.unshift(x); v >>= 7; } return b; };
  const ws = (s) => Array.from(s).map((c) => c.charCodeAt(0));
  const w16 = (v) => [(v >> 8) & 0xff, v & 0xff];
  const w32 = (v) => [(v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const sorted = [...events].sort((a, b) => a.t - b.t || (a.type === 'off' ? -1 : 1));
  const tb = [];
  const uspqn = Math.round(60000000 / bpm);
  tb.push(0x00, 0xff, 0x51, 0x03, (uspqn >> 16) & 0xff, (uspqn >> 8) & 0xff, uspqn & 0xff);
  const nm = ws('ARP FACTOR GRID');
  tb.push(0x00, 0xff, 0x03, nm.length, ...nm);
  const t0 = sorted.length ? sorted[0].t : 0;
  let lt = 0;
  for (const ev of sorted) {
    const tick = Math.round((ev.t - t0) * ticksPerSec);
    const d = Math.max(0, tick - lt);
    const ch = ev.voice - 1;
    const st = ev.type === 'on' ? 0x90 | ch : 0x80 | ch;
    tb.push(...vl(d), st, ev.pitch & 0x7f, ev.type === 'on' ? 100 : 0);
    lt = Math.max(lt, tick);
  }
  tb.push(0x00, 0xff, 0x2f, 0x00);
  return new Uint8Array([...ws('MThd'), ...w32(6), ...w16(0), ...w16(1), ...w16(tpb), ...ws('MTrk'), ...w32(tb.length), ...tb]);
}
