/*
 * The grid's bench: the arpeggiator's clock and pattern, its four lanes into
 * the drone, its own two voices, the Value Menu and MIDI recording, and a
 * live view of what every lane is doing to the web.
 */
import { Knob, fmt } from './knob.js';
import { getPath, setPath } from '../state.js';
import {
  defaultGrid, CHORD_NAMES, SUBDIVS, CLOCKS, MODES, KEYS, TUNINGS, ENVS, WAVES, SLICE_MODES, SLICE_WHERE,
  ECHO_MAPS, ECHO_HEADS, VOICE_SEL, TEX_SOURCES, PAN_PATTERNS, VALUE_MENU, HARM_FOLLOW, STRIKE_ON, TAPE_TIME, orderFromMenu, tickMs, subdivLabel, buildMidiFile,
} from '../grid.js';
import { theme, rgba, fit } from './theme.js';

const D = { grid: defaultGrid() };
const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const noteName = (m) => `${NOTE[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined) e.append(kid);
  return e;
}

const beats = (v) => {
  const named = { 0.0625: '1/64', 0.125: '1/32', 0.25: '1/16', 0.5: '1/8', 0.75: '3/16', 1: '1/4', 1.5: '3/8', 2: '1/2', 3: '3/4', 4: '1 bar' };
  for (const [k, n] of Object.entries(named)) if (Math.abs(v - k) < 0.004) return `${n} note`;
  return `${v.toFixed(2)} beat`;
};

export function buildGrid(root, api) {
  const { getArch, changed, notify } = api;
  const G = () => getArch().grid;
  const syncs = [];
  const live = {};

  const knob = (path, def) => {
    const full = `grid.${path}`;
    const k = new Knob({
      size: 'sm',
      default: getPath(D, full),
      ...def,
      id: `k-${full.replace(/\./g, '-')}`,
      value: getPath(getArch(), full),
      onInput: (v) => { setPath(getArch(), full, v); changed(full); refreshMeta(); },
      onCommit: () => changed(full, true, def.label),
    });
    syncs.push(() => k.set(getPath(getArch(), full), { silent: true }));
    return k.el;
  };
  const select = (path, label, options, title) => {
    const full = `grid.${path}`;
    const id = `sel-${full.replace(/\./g, '-')}`;
    const s = h('select', { id, class: 'select', title });
    for (const o of options) s.append(h('option', { value: String(o.id), text: o.label }));
    s.addEventListener('change', () => {
      const cur = getPath(getArch(), full);
      setPath(getArch(), full, typeof cur === 'number' ? +s.value : typeof cur === 'boolean' ? s.value === 'true' : s.value);
      changed(full, true, label.toLowerCase());
      refreshMeta();
    });
    syncs.push(() => { s.value = String(getPath(getArch(), full)); });
    return h('label', { class: 'field', for: id }, h('span', { class: 'field__k', text: label }), s);
  };
  let segN = 0;
  const seg = (path, label, options) => {
    const full = `grid.${path}`;
    const name = `seg-${++segN}`;
    const box = h('fieldset', { class: 'seg seg--grid' }, h('legend', { class: 'field__k', text: label }));
    const inputs = [];
    for (const o of options) {
      const inp = h('input', { type: 'radio', name, value: String(o.id) });
      inp.addEventListener('change', () => {
        if (!inp.checked) return;
        const cur = getPath(getArch(), full);
        setPath(getArch(), full, typeof cur === 'number' ? +inp.value : inp.value);
        changed(full, true, label.toLowerCase());
        refreshMeta();
      });
      inputs.push(inp);
      box.append(h('label', {}, inp, h('span', { text: o.label })));
    }
    syncs.push(() => { const v = String(getPath(getArch(), full)); for (const i of inputs) i.checked = i.value === v; });
    return box;
  };
  const lane = (id, code, title, note, ...body) =>
    h('section', { class: `lane lane--${id}`, 'aria-labelledby': `lane-${id}` },
      h('header', { class: 'card__head' }, h('span', { class: 'code code--grid' }, code), h('h3', { id: `lane-${id}`, class: 'card__title', text: title })),
      note ? h('p', { class: 'card__note', text: note }) : null,
      ...body);

  /* ---- engage switch and meta ---- */
  const onBox = root.querySelector('#grid-on');
  onBox.addEventListener('change', () => {
    G().on = onBox.checked;
    changed('grid.on', true, onBox.checked ? 'engaged' : 'disengaged');
    refreshMeta();
  });
  syncs.push(() => { onBox.checked = G().on; });
  const meta = root.querySelector('#grid-meta');
  function refreshMeta() {
    const g = G();
    const rate = g.clock === 'tempo'
      ? `${Math.round(g.bpm)} BPM × ${subdivLabel(g.subdiv)} = ${tickMs(g.bpm, g.subdiv)} ms per tick`
      : g.clock === 'gates' ? 'clocked by the logic gates' : 'clocked by the breath';
    const thr = g.thrMax > 0 ? ` · steps every ${g.thrMin}–${g.thrMax} ticks` : '';
    meta.textContent = g.on ? `${rate}${thr}` : 'disengaged: the drone runs free';
    root.classList.toggle('is-off', !g.on);
  }
  syncs.push(refreshMeta);

  /* ---- Value Menu ---- */
  const menu = root.querySelector('#value-menu');
  let orderNo = 0;
  live.menuBtns = VALUE_MENU.map((p, i) => {
    const b = h('button', { type: 'button', class: 'menu__item', title: `${p.bpm} BPM, ${subdivLabel(p.subdiv)}, ${p.chord}, ${p.mode}` },
      h('span', { class: 'menu__name', text: p.name }), h('span', { class: 'menu__price', text: `$${p.price}` }));
    b.addEventListener('click', () => {
      orderFromMenu(G(), i, orderNo++);
      api.syncAll();
      changed('grid', true, `order: ${p.name}`);
      for (const x of live.menuBtns) x.classList.remove('is-on');
      b.classList.add('is-on');
      notify(`Order up: ${p.name}, $${p.price}. The clock and pattern change; the drone and the lanes stay as they are.`);
      api.mark?.(p.name);
    });
    menu.append(b);
    return b;
  });

  /* ---- clock ---- */
  const clock = lane('clock', '⏱', 'Clock', 'The arpeggiator’s tick. The throttle lets only some ticks through, every few to every hundred, so the slow menu items step only now and then.',
    h('div', { class: 'knobs knobs--row' },
      knob('bpm', { label: 'BPM', min: 20, max: 300, step: 1, format: (v) => `${Math.round(v)}`, title: 'Tempo of the grid' }),
      knob('thrMin', { label: 'Thr min', min: 0, max: 100, step: 1, format: (v) => `${Math.round(v)}`, title: 'Throttle: at least this many ticks between steps (with Thr max above 0)' }),
      knob('thrMax', { label: 'Thr max', min: 0, max: 100, step: 1, format: (v) => (v > 0 ? `${Math.round(v)}` : 'off'), title: 'Throttle: at most this many ticks between steps. 0 lets every tick through.' })),
    seg('subdiv', 'Subdivision', SUBDIVS),
    h('div', { class: 'fields' }, select('clock', 'Clocked by', CLOCKS, 'Tempo, or let the web clock the grid: a step whenever a logic gate opens or shuts, or whenever the loop breathes in or out')));

  /* ---- pattern ---- */
  const chordRow = h('div', { class: 'chips', role: 'group', 'aria-label': 'Chord' });
  const chips = CHORD_NAMES.map((c) => {
    const b = h('button', { type: 'button', class: 'chip-btn', text: c, 'aria-pressed': 'false' });
    b.addEventListener('click', () => { G().chord = c; changed('grid.chord', true, 'chord'); syncChips(); api.mark?.(c); });
    chordRow.append(b);
    return b;
  });
  const syncChips = () => { for (const b of chips) b.setAttribute('aria-pressed', String(b.textContent === G().chord)); };
  syncs.push(syncChips);
  const dice = h('button', { type: 'button', class: 'btn btn--small', title: 'A new seed for the grid’s random choices (random order, throttle, scatter, endpoints). The same seed always takes the same path.' }, 'Roll the dice');
  const seedOut = h('span', { class: 'live' });
  dice.addEventListener('click', () => {
    G().seed = (G().seed * 7919 + 4099) % 100000;
    changed('grid.seed', true, 'dice');
    seedOut.textContent = `seed ${G().seed}`;
  });
  syncs.push(() => { seedOut.textContent = `seed ${G().seed}`; });
  const pattern = lane('pattern', '♪', 'Pattern', 'Two voices walk a chord. Each voice takes the next tone of the chord on every step; the endpoints decide how many tones each one walks, so the voices fall in and out of phase. Following the web puts the chord on the drone’s own fundamental.',
    chordRow,
    h('div', { class: 'fields fields--3' },
      select('mode', 'Order', MODES, 'How each voice moves through the chord. The web chooses: rising loop level walks up, falling walks down, and an unusual spectrum leaps further.'),
      select('key', 'Key', KEYS, 'Follow the web: the chord sits on the fundamental of the harmonic series the generators lie on, and moves with it'),
      select('tuning', 'Tuning', TUNINGS, 'Just: chord tones in whole-number ratios, so slices land on the drone’s harmonics')),
    h('div', { class: 'knobs knobs--row' },
      knob('regA', { label: 'A oct', min: 24, max: 84, step: 12, format: (v) => noteName(v), title: 'Register of voice A' }),
      knob('regB', { label: 'B oct', min: 24, max: 84, step: 12, format: (v) => noteName(v), title: 'Register of voice B' }),
      knob('epMin', { label: 'EP min', min: 0, max: 8, step: 1, format: (v) => `${v}`, title: 'Endpoints: the fewest chord tones a voice walks' }),
      knob('epMax', { label: 'EP max', min: 0, max: 8, step: 1, format: (v) => (v > 0 ? `${v}` : 'all'), title: 'Endpoints: the most chord tones a voice walks. 0 walks the whole chord.' }),
      knob('attack', { label: 'Attack', min: 0.001, max: 2, curve: 'log', format: fmt.sec, title: 'In Glide, how long every lane takes to reach its step (and the voices to fade in)' })),
    h('div', { class: 'pattern__foot' }, seg('env', 'Envelope', ENVS), h('div', { class: 'dice' }, dice, seedOut)));

  /* ---- into the drone: what the arpeggiator tells the web itself ---- */
  live.inform = h('p', { class: 'card__live card__live--grid', text: 'Engage to hear the grid inform the drone.' });
  const inform = lane('inform', '⇄', 'Into the drone', 'The arpeggiator does not only act on the drone from outside; it informs the web itself. Its chord retunes the generators, which glide to the nearest chord tones as the chord changes. Its chord tones lead the harmonizer inside the loop. Its tempo sets the length of the tape loop and the self-recording reels, so every pass comes round on the beat. And its steps can pluck a chord tone into the loop, where the feedback lets it ring on.',
    h('div', { class: 'inform' },
      h('div', { class: 'knobs knobs--row' },
        knob('inform.tune', { label: 'Tune', min: 0, max: 1, format: fmt.pct, title: 'How far the generators settle onto the grid’s chord (at the glide’s pace)' }),
        knob('inform.harmMix', { label: 'Harmonize', min: 0, max: 0.9, format: fmt.pct, title: 'How much harmonizer the grid adds to the loop' }),
        knob('inform.strike', { label: 'Strike', min: 0, max: 1, format: fmt.pct, title: 'How hard each step plucks voice A’s chord tone into the loop' })),
      h('div', { class: 'fields fields--3' },
        select('inform.harm', 'Harmonizer sings', HARM_FOLLOW, 'Its own intervals (set in Shaper, exciter, harmonizer), the chord, or the two voices as they move'),
        select('inform.tape', 'Tape and reels', TAPE_TIME, 'In time: the loop’s tape takes the nearest musical length at the grid’s tempo, the right head a rhythmic relation to the left, and self-recording reels a whole number of beats'),
        select('inform.strikeOn', 'Strike on', STRIKE_ON))),
    live.inform);

  /* ---- the four lanes ---- */
  const slice = lane('slice', '1', 'Slice', 'Harmonic slicing. Two resonant filters jump to the voices’ chord tones a few octaves up and carve formants out of the continuous bed: a vowel shift that keeps time. Inside the loop, every pass is carved again.',
    h('div', { class: 'knobs knobs--grid' },
      knob('slice.mix', { label: 'Mix', min: 0, max: 1, format: fmt.pct }),
      knob('slice.q', { label: 'Reso', min: 0.7, max: 30, curve: 'log', format: fmt.q, title: 'Resonance of the two filters' }),
      knob('slice.oct', { label: 'Octave', min: -1, max: 4, step: 1, format: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v)} oct`, title: 'How far above the chord tones the formants sit' })),
    h('div', { class: 'fields' }, select('slice.mode', 'Shape', SLICE_MODES), select('slice.where', 'Where', SLICE_WHERE)));
  const echo = lane('echo', '2', 'Echo', 'Time-domain arpeggiation. The fundamental stays anchored; the echo’s heads jump to new times on every step, and the feedback changes with them, so the space around the drone keeps changing shape.',
    h('div', { class: 'knobs knobs--grid' },
      knob('echo.mix', { label: 'Mix', min: 0, max: 1, format: fmt.pct }),
      knob('echo.time', { label: 'Time', min: 0.0625, max: 4, curve: 'log', format: beats, title: 'Base echo time in beats. In chord ratios, a higher chord tone shortens it by its frequency ratio.' }),
      knob('echo.fb', { label: 'Feedback', min: 0, max: 0.92, format: fmt.pct }),
      knob('echo.fbStep', { label: 'Fb step', min: 0, max: 0.6, format: fmt.pct, title: 'How far each step moves the feedback: high chord tones regenerate more, low ones less' }),
      knob('echo.tone', { label: 'Tone', min: 0, max: 1, format: fmt.pct, title: 'Top end kept on each repeat' }),
      knob('echo.spread', { label: 'Spread', min: 0, max: 1, format: fmt.pct, title: 'Ping-pong between the sides' }),
      knob('echo.toLoop', { label: 'To loop', min: 0, max: 1, format: fmt.pct, title: 'Echoes sent into the drone’s own feedback loop' })),
    h('div', { class: 'fields fields--3' }, select('echo.map', 'Times', ECHO_MAPS), select('echo.heads', 'Heads', ECHO_HEADS), select('echo.voice', 'Follows', VOICE_SEL)));
  const tex = lane('tex', '3', 'Texture', 'Drift modulation on the grid. Each step pushes the generators’ fold, the wave shaper, the multiplication depth and the exciter, then lets them settle: the saturation breathes, tightens or blooms while the pitch never moves. Negative amounts invert.',
    h('div', { class: 'knobs knobs--grid' },
      knob('tex.fold', { label: 'Fold', min: -1, max: 1, format: fmt.signed }),
      knob('tex.shape', { label: 'Shape', min: -1, max: 1, format: fmt.signed }),
      knob('tex.mult', { label: 'Mult', min: -1, max: 1, format: fmt.signed, title: 'Ring-multiplier depth' }),
      knob('tex.exc', { label: 'Exciter', min: -1, max: 1, format: fmt.signed }),
      knob('tex.decay', { label: 'Decay', min: 0.02, max: 2, curve: 'log', format: fmt.sec, title: 'How fast a pulse relaxes' })),
    h('div', { class: 'fields' }, select('tex.src', 'Driven by', TEX_SOURCES)));
  const pan = lane('pan', '4', 'Pan', 'Spatial panning grid. The output is split into frequency bands, and each band is thrown across the stereo field in a geometric pattern on every step. Deep and steady in tone; its place in the room dances.',
    h('div', { class: 'knobs knobs--grid' },
      knob('pan.depth', { label: 'Depth', min: 0, max: 1, format: fmt.pct }),
      knob('pan.split', { label: 'Bands', min: 2, max: 4, step: 1, format: (v) => `${v}`, title: 'How many frequency bands are thrown about separately' }),
      knob('pan.slew', { label: 'Slew', min: 0.002, max: 1, curve: 'log', format: fmt.sec, title: 'How fast a band travels to its new place' }),
      knob('pan.cycle', { label: 'Cycle', min: 2, max: 32, step: 1, format: (v) => `${v} steps`, title: 'Orbit: steps per revolution' })),
    h('div', { class: 'fields' }, select('pan.pattern', 'Pattern', PAN_PATTERNS)));

  /* ---- voices and MIDI ---- */
  const midiArm = h('button', { type: 'button', class: 'btn btn--small' }, '● Arm rec');
  const midiSave = h('button', { type: 'button', class: 'btn btn--small', disabled: true }, '↓ Export .mid');
  const midiClear = h('button', { type: 'button', class: 'btn btn--small btn--quiet', disabled: true }, 'Clear');
  const midiInfo = h('span', { class: 'live', text: 'No steps recorded.' });
  const voices = lane('voices', '0', 'Voices and MIDI', 'The arpeggiator’s own two oscillators, silent by default. Bring them up to hear the pattern itself, or send them into the loop, where the web takes them in as material. MIDI records every step of both voices.',
    h('div', { class: 'knobs knobs--grid' },
      knob('voices.level', { label: 'Level', min: 0, max: 1, format: fmt.pct }),
      knob('voices.toLoop', { label: 'To loop', min: 0, max: 1, format: fmt.pct }),
      knob('voices.detune', { label: 'Detune', min: 0, max: 50, format: (v) => `${v.toFixed(0)}¢` }),
      knob('voices.width', { label: 'Width', min: 0, max: 1, format: fmt.pct })),
    h('div', { class: 'fields' }, select('voices.wave', 'Wave', WAVES)),
    h('div', { class: 'midi' }, h('div', { class: 'btns' }, midiArm, midiSave, midiClear), midiInfo));

  root.querySelector('#grid-lanes').append(clock, pattern, inform, slice, echo, tex, pan, voices);

  /* ---- MIDI recording ---- */
  const midi = { armed: false, events: [], last: [null, null] };
  const midiText = () => {
    const n = midi.events.filter((e) => e.type === 'on').length;
    const dur = midi.events.length ? (midi.events[midi.events.length - 1].t - midi.events[0].t).toFixed(1) : '0.0';
    midiInfo.textContent = n ? `${n} notes · ${dur} s · exports at ${Math.round(G().bpm)} BPM` : midi.armed ? 'Armed: recording the next steps.' : 'No steps recorded.';
    midiSave.disabled = !n; midiClear.disabled = !n;
  };
  const closeNotes = (t) => {
    for (let v = 0; v < 2; v++) if (midi.last[v] !== null) { midi.events.push({ t, pitch: midi.last[v], voice: v + 1, type: 'off' }); midi.last[v] = null; }
  };
  midiArm.addEventListener('click', () => {
    if (midi.armed) { midi.armed = false; closeNotes(api.elapsed()); midiArm.textContent = '● Arm rec'; midiArm.classList.remove('is-rec'); }
    else { midi.armed = true; midi.events = []; midi.last = [null, null]; midiArm.textContent = '■ Stop rec'; midiArm.classList.add('is-rec'); }
    midiText();
  });
  midiClear.addEventListener('click', () => { midi.events = []; midi.last = [null, null]; midiText(); });
  midiSave.addEventListener('click', () => {
    if (midi.armed) closeNotes(api.elapsed());
    const bytes = buildMidiFile(midi.events, G().bpm);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
    const a = h('a', { href: url, download: `arp-factor-${Math.round(G().bpm)}bpm-${Date.now()}.mid` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  /* ---- live view ---- */
  const view = new GridView(root.querySelector('#gridview'));

  return {
    sync() { for (const s of syncs) s(); },
    view,
    update(frame) {
      if (!frame.grid) return;
      view.push(frame);
      const g = frame.grid;
      if (g.length > 27) {
        const I = G().inform, beat = 60 / G().bpm;
        const ratio = (r) => { for (let q = 1; q <= 8; q++) { const n = Math.round(r * q); if (Math.abs(n / q - r) < 0.004) return `${n}:${q}`; } return `×${r.toFixed(3)}`; };
        const parts = [];
        parts.push(I.tune > 0 ? `generators ${Math.round(g[23] * 100)}% on the chord` : 'generators free');
        parts.push(I.tape ? `tape ${fmt.sec(g[24])} = ${+(g[24] / beat).toFixed(2)} beats` : `tape free, ${fmt.sec(g[24])}`);
        parts.push(I.harm === 'off' ? 'harmonizer on its own intervals' : `harmonizer ${ratio(g[25])} and ${ratio(g[26])}`);
        if (I.strike > 0) parts.push(g[27] > 0.05 ? 'strike ●' : 'strike ○');
        live.inform.textContent = parts.join(' · ');
      }
      const st = frame.steps;
      if (st && st.length) {
        for (let i = 0; i < st.length; i += 5) {
          const t = st[i];
          if (midi.armed) {
            closeNotes(t);
            for (let v = 0; v < 2; v++) { const p = st[i + 1 + v]; midi.events.push({ t, pitch: p, voice: v + 1, type: 'on' }); midi.last[v] = p; }
          }
        }
        if (midi.armed) midiText();
        const n = st.length - 5;
        api.onNotes?.(noteName(st[n + 1]), noteName(st[n + 2]), st[n + 3], st[n + 4], frame.grid[4], frame.grid[5]);
      }
    },
  };
}

/* What every lane is doing, over the last few seconds. */
const SPAN = 8;
class GridView {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.frames = [];
    this.steps = [];
    this.t = 0;
    window.addEventListener('resize', () => fit(this.cv));
  }

  reset() { this.frames = []; this.steps = []; }

  push(f) {
    const g = f.grid;
    this.t = f.el;
    this.frames.push({ t: f.el, sa: g[6], sb: g[7], et: g[8], fb: g[9], tex: g[10], pan: [g[12], g[13], g[14], g[15]], n: g[20], amt: g[16], depth: g[21] });
    while (this.frames.length && this.frames[0].t < f.el - SPAN - 0.5) this.frames.shift();
    if (this.frames.length && this.frames[this.frames.length - 1].t < this.frames[0].t) this.frames = [];
    const st = f.steps;
    if (st) for (let i = 0; i < st.length; i += 5) this.steps.push({ t: st[i], a: st[i + 3], b: st[i + 4], ea: g[4], eb: g[5], ma: st[i + 1], mb: st[i + 2] });
    while (this.steps.length && this.steps[0].t < f.el - SPAN - 0.5) this.steps.shift();
    this.last = g;
  }

  draw() {
    const cv = this.cv, ctx = this.ctx;
    fit(cv);
    const W = cv.width, H = cv.height, dpr = W / Math.max(1, cv.clientWidth);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.scale(dpr, dpr);
    const w = cv.clientWidth, hh = cv.clientHeight;
    const LW = w < 420 ? 52 : 66;
    const rows = [['Voices', 1.15], ['1 Slice', 1], ['2 Echo', 0.8], ['3 Texture', 0.8], ['4 Pan', 1.1]];
    const tot = rows.reduce((s, r) => s + r[1], 0);
    const pad = 6;
    let y = pad;
    const rowY = rows.map(([, k]) => { const r = [y, ((hh - pad * 2 - (rows.length - 1) * 4) * k) / tot]; y += r[1] + 4; return r; });
    const x = (t) => LW + ((t - (this.t - SPAN)) / SPAN) * (w - LW - 4);
    const amt = this.last ? this.last[16] : 0;
    ctx.font = `500 9.5px ${theme.fData}`;
    ctx.textBaseline = 'middle';
    for (let r = 0; r < rows.length; r++) {
      const [ry, rh] = rowY[r];
      ctx.fillStyle = rgba(theme.panel, 1);
      ctx.fillRect(LW, ry, w - LW - 4, rh);
      ctx.strokeStyle = theme.rule;
      ctx.strokeRect(LW + 0.5, ry + 0.5, w - LW - 5, rh - 1);
      ctx.fillStyle = r === 0 ? theme.dim : theme.grid;
      ctx.textAlign = 'left';
      ctx.fillText(rows[r][0], 2, ry + rh / 2);
    }
    // everything time-based stays inside the plot
    ctx.save();
    ctx.beginPath(); ctx.rect(LW + 1, 0, w - LW - 6, hh); ctx.clip();
    // step lines
    ctx.strokeStyle = rgba(theme.grid, 0.13);
    ctx.beginPath();
    for (const s of this.steps) { const sx = Math.round(x(s.t)) + 0.5; ctx.moveTo(sx, rowY[0][0]); ctx.lineTo(sx, y - 4); }
    ctx.stroke();
    const F = this.frames;
    const dim = 0.35 + 0.65 * Math.min(1, amt * 1.25);
    // voices: degree ladder
    {
      const [ry, rh] = rowY[0];
      for (const s of this.steps) {
        const sx = x(s.t);
        const ya = ry + rh - 4 - (s.ea > 1 ? s.a / (s.ea - 1) : 0.5) * (rh - 8);
        const yb = ry + rh - 4 - (s.eb > 1 ? s.b / (s.eb - 1) : 0.5) * (rh - 8);
        ctx.fillStyle = rgba(theme.signal, 0.9);
        ctx.fillRect(sx - 1.5, ya - 1.5, 3, 3);
        ctx.fillStyle = rgba(theme['grid-red'], 0.95);
        ctx.fillRect(sx - 1.5, yb - 1.5, 3, 3);
      }
    }
    const trace = (row, get, color, lo, hi, log = false, alpha = 1) => {
      const [ry, rh] = rowY[row];
      ctx.strokeStyle = rgba(color, alpha * dim);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      let first = true;
      for (const f of F) {
        let v = get(f);
        if (!isFinite(v)) continue;
        if (log) v = Math.log(Math.max(lo, v) / lo) / Math.log(hi / lo); else v = (v - lo) / (hi - lo);
        const py = ry + rh - 3 - Math.max(0, Math.min(1, v)) * (rh - 6);
        if (first) { ctx.moveTo(x(f.t), py); first = false; } else ctx.lineTo(x(f.t), py);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
    };
    trace(1, (f) => f.sa, theme.signal, 40, 12000, true);
    trace(1, (f) => f.sb, theme['grid-red'], 40, 12000, true);
    trace(2, (f) => f.et, theme.grid, 0.01, 4.4, true);
    trace(2, (f) => f.fb, theme.regulate, 0, 1, false, 0.6);
    trace(3, (f) => f.tex, theme.grid, -1, 1);
    const panCols = [theme.signal, theme.grid, theme.regulate, theme['grid-red']];
    for (let g = 0; g < 4; g++) trace(4, (f) => (g < f.n ? f.pan[g] * f.depth : NaN), panCols[g], -1, 1, false, 0.9);
    ctx.restore();
    // readouts at the right edge
    if (this.last) {
      const g = this.last;
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.dim;
      const R = w - 8;
      ctx.fillText(`${fmt.hz(g[6])} · ${fmt.hz(g[7])}`, R, rowY[1][0] + 9);
      ctx.fillText(`${fmt.sec(g[8])} · fb ${Math.round(g[9] * 100)}%`, R, rowY[2][0] + 9);
      ctx.fillText(`${g[10] >= 0 ? '+' : '−'}${Math.abs(g[10]).toFixed(2)}`, R, rowY[3][0] + 9);
      ctx.fillText('R', R, rowY[4][0] + 8);
      ctx.fillText('L', R, rowY[4][0] + rowY[4][1] - 8);
      const ls = this.steps[this.steps.length - 1];
      if (ls) ctx.fillText(`${noteName(ls.ma)} · ${noteName(ls.mb)}`, R, rowY[0][0] + 9);
    }
    if (!this.frames.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.faint;
      ctx.fillText('Engage to see the grid at work', LW + (w - LW) / 2, hh / 2);
    }
  }
}

export { hzToMidi };
