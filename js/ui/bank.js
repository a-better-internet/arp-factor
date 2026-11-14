/*
 * The third-octave bank. Pale columns are band energy after carving; violet
 * from the top is how far each band's inverted VCA is holding it down. The
 * line with handles is the carving curve you draw; the dotted line is that
 * curve as the system is currently bending it (tilt and rotation).
 */
import { theme, rgba, fit, dprOf } from './theme.js';
import { BAND_HZ, BAND_LABELS } from '../state.js';
import { CHORDS } from '../grid.js';

const NB = 24;

export class Bank {
  constructor(canvas, readout, { getArch, onChange }) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.readout = readout;
    this.getArch = getArch;
    this.onChange = onChange;
    this.hover = -1;
    this.drawing = null;
    this.peak = new Float32Array(NB);
    this.bind();
  }

  geom() {
    const W = this.cv.clientWidth, H = this.cv.clientHeight;
    const padL = 30, padR = 6, padT = 8, padB = 20;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    return { W, H, padL, padR, padT, padB, plotW, plotH, col: plotW / NB };
  }

  draw(frame) {
    fit(this.cv);
    const ctx = this.ctx, dpr = dprOf();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = this.geom();
    ctx.clearRect(0, 0, g.W, g.H);
    const gains = this.getArch().bank.gains;
    const gmax = Math.max(0.01, ...gains);

    // scale: band energy is shown on a 54 dB window
    ctx.font = `400 8.5px ${theme.fData}`;
    ctx.fillStyle = theme.faint;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const [db, f] of [[0, 1], [-18, 2 / 3], [-36, 1 / 3], [-54, 0]]) {
      const y = g.padT + g.plotH * (1 - f);
      ctx.fillText(`${db}`, g.padL - 6, y);
      ctx.fillStyle = theme.rule;
      ctx.fillRect(g.padL, Math.round(y) + 0.5, g.plotW, 1);
      ctx.fillStyle = theme.faint;
    }

    for (let k = 0; k < NB; k++) {
      const x = g.padL + k * g.col;
      const w = Math.max(2, g.col - (g.col > 14 ? 4 : 2));
      const x0 = x + (g.col - w) / 2;
      const e = frame ? frame.bands[k] : 0;
      this.peak[k] = Math.max(e, this.peak[k] - 0.004);
      const h = e * g.plotH;
      if (k === this.hover) {
        ctx.fillStyle = rgba(theme.signal, 0.06);
        ctx.fillRect(x, g.padT, g.col, g.plotH);
      }
      const grad = ctx.createLinearGradient(0, g.padT + g.plotH, 0, g.padT);
      grad.addColorStop(0, rgba(theme['signal-deep'], 0.55));
      grad.addColorStop(1, rgba(theme.signal, 0.95));
      ctx.fillStyle = grad;
      ctx.fillRect(x0, g.padT + g.plotH - h, w, h);
      // peak hold tick
      ctx.fillStyle = rgba(theme['signal-hi'], 0.7);
      ctx.fillRect(x0, g.padT + g.plotH * (1 - this.peak[k]) - 1, w, 1.5);
      // clamp: dB held down, from the top
      if (frame) {
        const held = -20 * Math.log10(Math.max(1e-4, frame.clamp[k]));
        const ch = Math.min(1, held / 18) * g.plotH;
        if (ch > 0.5) {
          ctx.fillStyle = rgba(theme.regulate, 0.22 + Math.min(0.6, held / 30));
          ctx.fillRect(x0, g.padT, w, ch);
          ctx.fillStyle = theme.regulate;
          ctx.fillRect(x0, g.padT + ch - 1, w, 1.5);
        }
      }
    }

    // live bent curve
    if (frame) {
      let em = 0.001;
      for (let k = 0; k < NB; k++) em = Math.max(em, frame.eff[k]);
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = rgba(theme.ink, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < NB; k++) {
        const x = g.padL + (k + 0.5) * g.col;
        const y = g.padT + g.plotH * (1 - Math.min(1, frame.eff[k] / em));
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // carving curve
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let k = 0; k < NB; k++) {
      const x = g.padL + (k + 0.5) * g.col;
      const y = g.padT + g.plotH * (1 - gains[k] / gmax);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let k = 0; k < NB; k++) {
      const x = g.padL + (k + 0.5) * g.col;
      const y = g.padT + g.plotH * (1 - gains[k] / gmax);
      ctx.fillStyle = k === this.hover ? theme.ink : theme.panel;
      ctx.strokeStyle = theme.ink;
      ctx.beginPath(); ctx.arc(x, y, k === this.hover ? 3.5 : 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // the grid on the spectrum: its two slice filters, the chord's tones
    // along the floor, and where the pan splits the bands
    if (frame && frame.grid && frame.grid[0] > 0) {
      const G = frame.grid, A = this.getArch().grid;
      const xOf = (f) => g.padL + (3 * Math.log2(f / 63) + 0.5) * g.col;
      const inX = (x) => x >= g.padL && x <= g.padL + g.plotW;
      const tick = G[11], amt = G[16];
      // chord tones: every octave of the chord the generators are pulled to
      const root = A.key >= 0 ? 440 * Math.pow(2, (60 + A.key - 69) / 12) : G[22] > 0 ? G[22] : 55;
      ctx.fillStyle = rgba(theme.grid, 0.55 * (0.4 + 0.6 * amt));
      for (const c of (CHORDS[A.chord] || [])) {
        for (let o = -4; o < 10; o++) {
          const x = xOf(root * Math.pow(2, c / 12 + o));
          if (inX(x)) ctx.fillRect(x - 0.5, g.padT + g.plotH - 5, 1, 5);
        }
      }
      // pan splits
      const split = [[700], [300, 2400], [200, 800, 3200]][Math.round(G[20]) - 2] || [];
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = rgba(theme.grid, 0.25 * amt * (A.pan.depth > 0 ? 1 : 0.3));
      for (const f of split) { const x = Math.round(xOf(f)) + 0.5; ctx.beginPath(); ctx.moveTo(x, g.padT); ctx.lineTo(x, g.padT + g.plotH); ctx.stroke(); }
      ctx.setLineDash([]);
      // the two slice filters, glowing on each step
      if (A.slice.mix > 0) {
        for (const [f, col] of [[G[6], theme.signal], [G[7], theme['grid-red']]]) {
          const x = xOf(f);
          if (!inX(x)) continue;
          const grad = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
          grad.addColorStop(0, rgba(col, 0));
          grad.addColorStop(0.5, rgba(col, (0.12 + 0.3 * tick) * A.slice.mix * amt));
          grad.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = grad;
          ctx.fillRect(x - 10, g.padT, 20, g.plotH);
          ctx.fillStyle = rgba(col, 0.5 + 0.5 * tick);
          ctx.fillRect(x - 0.75, g.padT, 1.5, g.plotH);
        }
      }
    }

    // frequency labels
    ctx.font = `400 8.5px ${theme.fData}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const every = g.col < 18 ? 3 : g.col < 30 ? 2 : 1;
    for (let k = 0; k < NB; k++) {
      if (k % every) continue;
      ctx.fillStyle = k === this.hover ? theme.ink : theme.dim;
      ctx.fillText(BAND_LABELS[k], g.padL + (k + 0.5) * g.col, g.H - 6);
    }
    this.updateReadout(frame);
  }

  updateReadout(frame) {
    const k = this.hover;
    if (k < 0) {
      this.readout.textContent = 'Draw across the bank to carve which bands the loop favours.';
      return;
    }
    const gains = this.getArch().bank.gains;
    const gmax = Math.max(0.01, ...gains);
    const held = frame ? -20 * Math.log10(Math.max(1e-4, frame.clamp[k])) : 0;
    const level = frame ? Math.round(frame.bands[k] * 54 - 54) : null;
    const hz = BAND_HZ[k] >= 1000 ? `${BAND_HZ[k] / 1000} kHz` : `${BAND_HZ[k]} Hz`;
    this.readout.textContent = `${hz} · carve ${(gains[k] / gmax).toFixed(2)}${level !== null ? ` · level ${level} dB` : ''}${held > 0.1 ? ` · held ${held.toFixed(1)} dB` : ''}`;
  }

  bandAt(x) {
    const g = this.geom();
    return Math.max(0, Math.min(NB - 1, Math.floor((x - g.padL) / g.col)));
  }
  gainAt(y) {
    const g = this.geom();
    const gains = this.getArch().bank.gains;
    const gmax = Math.max(0.2, ...gains);
    return Math.max(0, Math.min(1, 1 - (y - g.padT) / g.plotH)) * Math.min(1, gmax);
  }

  bind() {
    const cv = this.cv;
    cv.tabIndex = 0;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Third-octave filter bank. Draw to set the carving curve; arrow keys pick a band and change its gain.');
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const paint = (x, y) => {
      const k = this.bandAt(x), v = +this.gainAt(y).toFixed(3);
      const gains = this.getArch().bank.gains;
      const last = this.drawing.last;
      if (last !== null && last !== k) {
        const step = k > last ? 1 : -1;
        const lv = this.drawing.lastV;
        for (let i = last + step; i !== k; i += step) gains[i] = +(lv + (v - lv) * ((i - last) / (k - last))).toFixed(3);
      }
      gains[k] = v;
      this.drawing.last = k;
      this.drawing.lastV = v;
      this.hover = k;
      this.onChange();
    };
    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      cv.setPointerCapture(e.pointerId);
      e.preventDefault();
      this.drawing = { last: null, lastV: 0 };
      paint(...pos(e));
    });
    cv.addEventListener('pointermove', (e) => {
      const [x, y] = pos(e);
      if (this.drawing) paint(x, y);
      else this.hover = this.bandAt(x);
    });
    const end = () => { if (this.drawing) { this.drawing = null; this.onChange(true); } };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { if (!this.drawing) this.hover = -1; });
    cv.addEventListener('keydown', (e) => {
      const gains = this.getArch().bank.gains;
      if (this.hover < 0) this.hover = 0;
      let used = true;
      if (e.key === 'ArrowLeft') this.hover = Math.max(0, this.hover - 1);
      else if (e.key === 'ArrowRight') this.hover = Math.min(NB - 1, this.hover + 1);
      else if (e.key === 'ArrowUp') { gains[this.hover] = Math.min(1.5, +(gains[this.hover] + 0.05).toFixed(3)); this.onChange(true); }
      else if (e.key === 'ArrowDown') { gains[this.hover] = Math.max(0, +(gains[this.hover] - 0.05).toFixed(3)); this.onChange(true); }
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    });
  }
}
