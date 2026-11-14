# Arp Factor

A self-regulating drone, forced through an arpeggiator's grid. It runs in the browser.

It combines two instruments:

* **The drone** is the Kybernetes engine: a closed web of generators, ring multipliers, a tape loop, a filter bank, a frequency shifter and a smear, all inside one feedback loop. It watches its own levels, spectrum and rate of change and turns its own knobs. It pushes itself toward instability, regulates itself back, and settles somewhere new.
* **The grid** is the Biggie Size Meal arpeggiator: a clock with BPM, subdivision and a throttle; a chord; an order; two voices with their own registers and endpoints; a Value Menu of patterns; and MIDI export.

The grid almost never plays a note. Its steps are wired into the drone instead of into pitch, through four lanes:

| Lane | What a step does | What you hear |
| --- | --- | --- |
| **1 · Slice** | Two resonant filters (one per voice) jump to the voices' chord tones, a few octaves up. | The bed stays continuous while formants and harmonic peaks are cut out of it in time: a vowel shift that keeps tempo. |
| **2 · Echo** | A delay's heads jump to new times, either in the chord's own frequency ratios or in multiples of the step, and its feedback rises and falls with the chord tone. | The fundamental stays put while the echoes and their tails jump between rhythmic intervals, so the space around the drone keeps changing shape. |
| **3 · Texture** | Pushes the generators' fold, the wave shaper, the ring-multiplier depth and the exciter, then lets them relax. | The saturation breathes, tightens or blooms with the clock, and the pitch never moves. |
| **4 · Pan** | Splits the output into 2 to 4 frequency bands and moves each band to its own place in the stereo field. | The tone stays still while the position of each part of the spectrum moves around the room in a precise pattern. |

It also **informs the drone itself**, so the drone takes on the arpeggiator's harmony and time:

| Into the drone | What changes in the drone |
| --- | --- |
| **Tune** | The generators glide to the nearest tones of the grid's chord, in its key and tuning, at the glide's pace. Change the chord and the whole drone moves to the new harmony. |
| **Harmonizer sings** | The harmonizer inside the loop takes the chord's fifth and its third an octave down. Set it to the voices instead and it follows the two tones the arpeggiator is on, step by step, so every pass of the loop is harmonized by the pattern. |
| **Tape and reels in time** | The loop's tape takes the nearest musical length at the grid's tempo (a whole, half, quarter... or dotted number of beats), and the right head a rhythmic ratio to the left. Self-recording reels loop a whole number of beats. The drone's own echoes then come round on the grid. |
| **Strike** | On every step, or whenever voice A reaches the root, a short pluck of voice A's chord tone goes into the loop. The feedback keeps it ringing and the homeostat absorbs it. |

The drone itself still has no LFOs and no noise generators. The grid's random choices (random order, throttle, scatter, endpoints) come from a generator seeded by the architecture, so **the same architecture, left alone, still takes the same path.** Roll the dice for a new seed.

## Running it

It's a static site with no build step and no dependencies. ES modules and the AudioWorklet need to be served over HTTP:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> and press **Engage**. It needs a current Chrome, Edge, Firefox or Safari.

## The grid

**Clock.** BPM (20 to 300) and a subdivision (1/4, 1/8, 1/8T, 1/16, 1/32) set the tick. The throttle (Thr min and max) lets a step through only every *n* ticks, with *n* drawn between the two each time. The slow Value Menu items step once every 25 to 72 ticks. With Thr max at 0, every tick is a step. The web can also keep time: **Clocked by** set to *Logic gates* makes a step whenever a gate opens or shuts, and *Breath* makes one whenever the loop starts to inhale or exhale.

**Pattern.** Each voice walks a chord (the arpeggiator's fourteen chords, plus *harmonic*, the natural harmonic series from the 4th to the 11th partial). It moves up, down, up and down, in seeded random order, or in an order the web chooses: rising loop level walks up, falling level walks down, and an unusual spectrum leaps further. The endpoints (EP min and max) set how many chord tones each voice walks. They're drawn per voice whenever the chord or range changes, so the two voices drift in and out of phase. **Key: Follow the web** puts the chord on the fundamental of the harmonic series the generators lie on, and it moves with them. In **Just** tuning, chord tones are whole-number ratios (the minor seventh is the harmonic 7:4), so the slices land on the drone's own harmonics. **Envelope: Step** moves every lane at once (3 ms). **Glide** moves every lane over the Attack time, and fades the voices in on each step.

**Slice.** Two state-variable filters follow voice A and voice B. *Formants* keeps only the two resonant bands. *Peaks over the bed* adds them on top of the full drone. *Resonant low-pass* sweeps two ladder-like low-passes. **Where** puts the slicer after the loop, for a crisp cut, or inside it, so every pass is carved again and the homeostat has to answer it.

**Echo.** A stereo delay up to 4.4 s long, with a tone filter and a soft knee in its feedback. In *Chord ratios*, the base time is divided by the chord tone's frequency ratio, so a major triad's 4:5:6 becomes echo times of 1 : 4/5 : 2/3. In *Step multiples*, the time is one to eight steps. **Jump** heads crossfade on a raised cosine (at most 20 ms, never longer than 40% of a step). **Glide** heads bend the delay time like tape changing speed. **To loop** sends the echoes into the drone's own feedback.

**Texture.** Driven by voice A's or voice B's place in the chord (bipolar), by a pulse on every step that relaxes over Decay, or by alternating ±. Negative amounts invert.

**Pan.** Linkwitz-Riley crossovers split the output into 2, 3 or 4 bands, at 700 Hz, at 300 Hz and 2.4 kHz, or at 200 Hz, 800 Hz and 3.2 kHz. The lower bands pass through the allpasses of the splits above them, so the bands sum back flat (within 0.01 dB). Each band is panned at equal power, and its side signal narrows as it's thrown to one speaker. Patterns: *Orbit* (bands rotate, one revolution per Cycle steps), *Ping-pong*, *Mirror* (low and high swap sides), *Scatter* (seeded) and *Follow voice A*.

**Voices and MIDI.** The arpeggiator's own two oscillators (sine, triangle, and band-limited sawtooth and square) are silent by default. Raise **Level** to hear the pattern, or **To loop** to feed it to the web. **Arm rec** records every step of both voices, and **Export .mid** writes a standard MIDI file at the grid's tempo, with voice A on channel 1 and voice B on channel 2.

**Into the drone** (the aqua-edged card): Tune, Harmonize, Strike, and selects for what the harmonizer sings, whether the tape and reels run free or in time, and when strikes fall. Its live line shows what the drone has taken on: how far the generators have settled onto the chord, the tape length in beats, the harmonizer's ratios, and each strike.

**The helm's Grid knob** scales every lane and the voices together, and glides like the rest of the helm. At 0% the drone runs free while the clock keeps counting.

**The grid as an eye.** Two new rows in the matrix: **ARP** (voice A's place in the chord, −1 to +1) and **TICK** (a pulse on every step). Any of the drone's 22 knobs can follow the grid, and a logic gate can watch it too.

**The Value Menu** loads only the clock and the pattern, so any web can take any order: Slow Arp ($0.99) to Super Fast ($2.99), plus Biggie Web ($3.49), where the web chooses the notes. As in the original, each order picks a register for each voice from the item's list. Here the pick is seeded by the order number.

## How the machine is built

```
 G1 ─┐            (every generator through the wave shaper)
     ×1 ──┐
 G2 ─┘    ×2 ──┐
 G3 ──────┘    ×3 ──┐
 G4 ───────────┘    ×4 ──► TAPE ──► BANK ──► SHIFT ──► EXCITE ──► HARM ──► SMEAR ──┬──► OUT ──► reels record it
                    ▲       ▲                                                        │
                    │       └───────────────────── feedback ─────────────────────────┤
                    └───────────────────── multiplied by the return ─────────────────┤
 generators' phase ◄────────────────────────── pushed by the return ─────────────────┘
```

* **Generators (G1–G4).** Four oscillators that modulate their own phase (fold), pull toward small whole-number frequency ratios with their neighbour (coupling), and have their phase pushed by the loop's return.
* **Glide.** Anything that changes pitch moves at the glide's pace, stretched by Era: generator pitch, tape speed (a long glide makes a heavy transport that never bends far), reel speed, frequency shift, and the bank's tilt and rotation. The default of 10 seconds makes the web drift rather than swoop. The restless presets use 1.5–2 seconds.
* **Ratios.** How closely the generators keep their tuning relative to one another as they drift. The cascade's combination tones beat at rates set by small differences between the generators. Let them drift apart and a beat can slide from a fraction of a hertz to several hertz, which sounds like the music speeding up and slowing down. Held ratios (85% by default) make the generators drift together, so the beats stay steady.
* **No ramps by default.** The calm architectures play their reels at the material's own speed, forwards or backwards. They mirror the frequency shifter (left up, right down), so nothing spirals upward or downward, and none of their pins vary reel speed or shift. The matrix can still move tape length, shift and reel speed when you patch it, but over narrower ranges than before.
* **Wave shaper.** Each generator's sine passes through a polynomial transfer curve before the cascade. A unit sine through the n-th Chebyshev polynomial is exactly its n-th harmonic, so Shape adds harmonics 2 to 6 in a falling series, from a pure sine toward a bright, saw-like wave, and nothing else. Odd leaves out the even harmonics for a hollow, square-like tone. Any harmonic that would pass 15 kHz fades out, so the shaper never aliases. The cascade then multiplies all those harmonics against each other, which is where most of the new complexity comes from.
* **Multiplier cascade (×1–×4).** Four ring multipliers in series. Multiplication cancels the input frequencies and leaves their sums and differences. The fourth stage multiplies by the loop's own return: multiplied feedback.
* **The loop.** A stereo tape delay with two heads, a bank of 24 third-octave band-pass filters (63 Hz to 12.5 kHz), a single-sideband frequency shifter, an exciter, a harmonizer and a smearing reverberator, all *inside* the feedback path. Every pass is re-carved, re-pitched, given new harmonics, harmonized and smeared.
* **Exciter.** It listens to the band between its corner and 5.2 kHz, and grows that band's second and third harmonics with Chebyshev polynomials:
  * **Level-independent:** the band is first normalised by an envelope that looks 1 ms ahead, so loud and quiet passes get the same proportion of harmonics, and nothing is ever clipped.
  * **No aliasing:** the curve is third order and the band ends at 5.2 kHz, so nothing can fold back. Stray products measured 120 dB below the input.
  * **It compounds:** the new harmonics go round the loop and are excited again, so small settings already brighten noticeably (10% lifts the 2–5 kHz region from about 0.2% to 4% of the energy in Drift Nebula). Warmth eases it by up to 70%.
* **Harmonizer.** Two voices pitch-shift each pass by just intervals (a fifth is exactly 3:2, a major third 5:4) and are mixed back in, so chords build pass by pass, in tune with a web that has settled into its harmonic series. Each voice reads a short delay line through three heads a third of a window apart, each fading in and out on a sine-squared window, so the level stays steady and no head is heard jumping back. Grain sets the window: long is smooth, short is grainy and more metallic. What goes in is low-passed below the Nyquist limit divided by the highest voice's ratio, so pitched-up voices stay clean, and changing an interval glides. The filter bank removes anything pitched below 63 Hz or above 12.5 kHz on the next pass, so the stacks can't run away.
* **Eyes.** Envelope followers read the multiplier output, loop level, output level, reel level, low, middle and high spectral share, spectral centre, rate of change and regulation pressure. They habituate: each eye reports how far things are from what it has grown used to.
* **The matrix.** 16 eyes (14 of the web, ARP and TICK of the grid) × 22 destinations (generator pitches, fold, coupling, multiplication depth, tape time, bank tilt and rotation, shift, smear, feedback, reel levels and speed, warmth, wave shaper, exciter and harmonizer mix). Each pin carries a signed amount; violet pins invert.
* **Homeostasis.** Every band has its own envelope follower driving an inverted VCA. A band that rises the ceiling's worth above an even share of the active bands is held down fast, then let go slowly, so no few bands can hoard the loop and the spectrum keeps moving on. The loop as a whole has a homeostat that inhales (opens the gain slowly toward the setpoint) and exhales (pulls it back once the loop overshoots, until it has fallen by the breath depth). The breathing period isn't set anywhere. It depends on how the web responds.
* **Metabolism.** A second, much slower regulator watches the breathing itself. When breaths start keeping time like a clock, when their pace hasn't changed for the better part of an hour, or when the loop stops breathing, pressure builds over several minutes. When it's full, the metabolism shifts the setpoint, breath depth and ceiling the homeostat works with, gliding over a minute or two. If its last shift made the breathing more varied it keeps that direction. If not, it reads a new direction off what the eyes see at that moment, so its steps follow the system's own history and never cycle. With no pressure, the offsets drift slowly back home. Era stretches all of it.
* **Warmth.** The web's colour, from cold and metallic to warm:
  * **Cold (0%):** the multiplier cascade is at its harshest. Generators that aren't in exact whole-number ratios multiply into inharmonic, bell-like partials that beat against each other.
  * **Warming:** the generators settle into the harmonic series they already lie close to, a pitch move of a few cents, so their products coincide instead of beating. Tuning is complete by 60% warmth.
  * **Warm (100%):** multiplication is lighter, folding softer and the loop a little more smeared, and above 1.8 kHz the output is softened (outside the loop, so it never compounds). Up to 800 Hz the body stays.

  Warmth moves at a slower pace than glide.
* **Temper.** Keeps the colour from standing still. While the web keeps one colour, pressure builds, faster when the web is still and slower when it is busy. When it is full, the web leans the other way: warmer after a cold spell, colder after a warm one. How far it leans is read off the eyes at that moment, so some warm spells are deep and some barely there. How long the new colour holds depends on how many logic gates are open then, so the turns never keep time. A cold-leaning web turns warm first and a warm-leaning one cools first. In Drift Nebula the first warm turn comes after about six minutes, then roughly every 9 to 19 minutes the colour turns again, and over an hour and a half it was warm about 38% of the time. The Temper knob in the Homeostasis card sets how far the colour wanders; 0% holds it still. Era stretches it all.
* **Logic gates (L1–L4).** Comparators with hysteresis on any two eyes, or one eye and a fixed level, in *greater than*, *less than* or *flip* modes. They decide when reels record and, through the matrix, which reels come up in the mix.
* **Reels (R1–R4).** Tape loops of concrete material. *Self loop* reels record the system's own output while their gate is open and play it back at their own speed (including reversed). *Held tape* reels play a sound you load or capture from the microphone.

## The interface

| Area | What it's for |
| --- | --- |
| **Everywhere** | Aqua always means the grid acting on the drone. The header shows each voice's place in its walk of the chord as two rows of LEDs, with the notes. In the web, two rings inside the orbit are the voices walking the chord (the current tone lit, flashing on each step), and dashed aqua hands run from the GRID node to what it changes: the generators (chord, texture), the harmonizer, the tape (tempo, strike) and the output (slice, echo, pan). The bank shows the two slice filters, the chord's tones along its floor and the pan splits. The generator, loop and harmonizer cards each carry a live "Grid:" line. In the matrix, the ARP and TICK eyes are aqua. Value Menu orders and chord changes are marked with aqua diamonds on the chronicle. |
| **Grid** | The arpeggiator, its four lanes, its voices and MIDI, and the Value Menu. The live view shows the last eight seconds: each voice's place in the chord, the slice frequencies, the echo time and feedback, the texture value, and each band's place in the stereo field. The switch in its header disengages it. |
| **Look** | A cold, brushed-steel console: ice blue is signal (what pushes), cobalt violet is regulation (what pulls back), aqua is the grid, and chrome silver is its second voice. |
| **Helm** | The steersman's controls: Inflow, Bias (a master voltage added to every eye), Drift (global transposition), Setpoint, Coupling (matrix depth), Era and Warmth (the colour the web leans toward). Every helm move glides. The violet inner arc shows where the system actually is: on Warmth, the colour now, wherever Temper and the eyes have taken it. The output's phase portrait turns from ice to ember as the web warms. **Perturb** strikes a short burst into the loop. The regulation trace shows two minutes of loop level against the setpoint as the metabolism has moved it, with the helm's own setpoint dotted beneath. |
| **The web** | The architecture drawn as an orrery. The loop circles the homeostat; the output's phase portrait (mid vertical, side horizontal) fills its eye. Modulation arcs glow with the voltage they carry. |
| **Matrix** | Click a hole to place a pin. Drag a pin up or down to set its amount. Right-click inverts it, double-click removes it, and Alt-click places an inverting pin. Arrow keys, Enter, `+`, `-` and `I` work when it has focus. |
| **Bank** | Live band energy, with violet showing how far each band is being held down. Draw across it to set the carving curve. The dotted line is that curve as the system is currently bending it. |
| **Logbook** | Epochs (stable states the system settles into, with a short description), steering, and events. |
| **Chronicle** | A spectrogram of the whole run, with epochs marked above, and steering (violet), grid orders and chord changes (aqua diamonds), metabolism shifts (open rings) and Temper's turns (dots: ember warmer, ice colder) below. Spans of 1, 4 and 14 hours show how little of a long piece has happened yet. |
| **Snapshots** | **Snapshot** (or <kbd>S</kbd>) keeps the current architecture and helm and flags the moment on the chronicle. Click the flag, or **Recall** in the list, to return. Recall restores the rules and the helm. The system's own memory (tape, reels, filter states) carries on, so it finds its way back rather than jumping. Snapshots are kept in the browser. |
| **Undo** | Every finished edit is one step: a knob released, a pin placed, a stroke across the bank, a menu choice, an architecture loaded or recalled. Use the header arrows, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>Z</kbd> and <kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>Z</kbd>. The output level isn't part of the history. |
| **Architecture** | Every module's parameters, fourteen starting architectures (six made for the grid: Vowel Engine, Echo Geometry, Bloom Clock, Room Choreography, Biggie Size and The Web Plays) (Hearth leans warm, Cold Lattice and Iron Weather lean cold), *Derive from a name* (the same name always builds the same web), and architecture codes you can copy and paste to share an exact web. |

**Era** stretches every slow process: band release, breath, glide, habituation, gate slew, warmth and Temper. It runs from *Weather* (seconds) through *Tide* and *Season* to *Aeon* (tens of minutes). Systems like this need hours to show what they are.

Keyboard: <kbd>Space</kbd> engages or halts, <kbd>P</kbd> perturbs, <kbd>S</kbd> takes a snapshot, and <kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>Z</kbd> undoes. Knobs respond to dragging (Shift for fine), arrow keys, or the scroll wheel once focused. Double-click resets a knob to its default.

The architecture is saved in the browser's local storage. Loaded sounds are not saved.

## Levels and recording

The signal chain is gain-staged to stay clean:
* **Saturators only round off real overs.** Every saturator in the web (the cascade, the tape head, the loop) is a soft knee: exactly linear in normal use, rounding off only real overs. Drive is the one control meant to push the cascade into saturation.
* **The cascade holds a steady level.** It eases a loud cascade down and lifts a quiet one by up to 6 dB, so Drive means the same thing in every web.
* **The tape head has a level control.** It looks 1 ms ahead and eases the gain down before a peak is written.
* **A gentle leveler evens out loudness.** It works at 2:1 around the last minute's level, so a breath still swells but the piece doesn't lurch between loud and quiet.
* **A slow governor guards the output.** If peaks run hot for a while, it lowers the mix over a few seconds and lets it recover over about half a minute.
* **A look-ahead limiter holds a −1 dBTP ceiling.** It detects true (inter-sample) peaks with 4× oversampling, and the output is linear below the ceiling.

No sample can reach full scale. Every architecture peaks at or below −1 dBTP. With every control turned to its maximum at once, true peaks stay within 0.1 dB of the ceiling.

**Architecture codes** start with `ARPF1.`. Codes from Kybernetes (`KYB1.`) still load, and get the default grid.

**Record output** captures the finished signal straight from the engine: after the limiter, before the Level knob, at the engine's sample rate (48 kHz).
* **Lossless:** 24-bit PCM WAV, with no codec and no resampling. In testing, a browser recording matched the engine's own output to within one 24-bit step on every sample.
* **Self-describing:** each file is tagged with the architecture's name and code.
* **Long sessions:** very long recordings continue in a new file every 3.7 hours or so (the WAV size limit), with no gap.
* **Live readout:** the recording shows its peak level and counts any clipped samples. There shouldn't be any.

## Offline rendering and inspection

`tools/render.mjs` runs the same signal engine in Node, with no browser, and writes a 24-bit WAV file, streamed to disk so even 14-hour renders don't need the whole file in memory. At the end it reports how the system regulated itself:

* **Headroom:** how often the feedback gain sat at its ceiling, and the trim the homeostat needed.
* **Breathing:** breaths per window, the mean interval, and how much the intervals vary. Low variation means clock-like.
* **Metabolism:** each shift, why it happened and where it moved the setpoint, depth and ceiling.
* **Colour:** how warm the web ran (percentiles), how much of the time it was warm or cold, its warm spells, and each of Temper's turns.
* **Motion:** how fast pitch, tape speed, shift, level and brightness change from one second to the next, how far each generator ranges, how many abrupt moves there were, and how far the spectrum evolves over five minutes.
* **Levels:** sample and true peak of the output, and how often the limiter, output governor and tape level control had to act.
* **Clicks:** isolated sample discontinuities, each with what the engine was doing at that moment (a reel loop point, a record-head crossing, a tape lurch, the limiter, a gate). Sharp edges and peaks that are already in the generators' own waveform (from heavy fold or the wave shaper) are counted apart, as timbre. An event is put down to the generators only when their product really had a bend that sharp at that moment.

```bash
node tools/render.mjs --seconds 600 --preset "Gas Giant" --out gas-giant.wav
```

```bash
node tools/render.mjs --derive andromeda --seconds 300 --at 120:bias=0.4 --at 200:perturb --out a.wav
```

```bash
node tools/render.mjs --set loop.time=0.4 --set bank.q=14 --seconds 120 --out narrow.wav
```

```bash
node tools/render.mjs --preset "Vowel Engine" --set grid.bpm=96 --at 30:arch:grid.slice.where=loop --at 60:grid=0 --seconds 90 --out vowel.wav
```

The report ends with a line about the grid: how many steps it took and what each lane was set to. The grid's sawtooth and square voices have a sharp edge in every cycle, which is their timbre. The click detector reports those edges separately and doesn't count them as clicks.

`--pin LOW:WARM:0.6` places a matrix pin by its codes. `--inject 20` adds synthetic steps to check the click detector. `--hold 4:441.3:1.7` puts a raw sine on reel 4 whose ends don't line up, to test loop points. `--at 30:arch:loop.time=4` changes the architecture mid-run.

With the grid engaged, the engine renders at about 9× real time on one core.

## Files

```
index.html            the page
styles.css            the single dark console look
js/dsp/processor.js   the signal engine (AudioWorkletProcessor)
js/state.js           the architecture model, presets, derivation, codes
js/grid.js            the grid's model: chords, Value Menu, options, MIDI file writer
js/engine.js          AudioContext, worklet, analysers, reels, microphone, recorder
js/epochs.js          detects the system settling into and leaving stable states
js/history.js         undo and redo
js/recorder.js        lossless 24-bit WAV recording
js/main.js            wiring
js/ui/                knobs, matrix, bank, web, chronicle, regulation trace, module cards, the grid panel
tools/render.mjs      offline renderer
```
