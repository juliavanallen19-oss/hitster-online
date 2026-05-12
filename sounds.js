// =============================================================
// HITSTER ONLINE — sounds.js
// All game sound effects, synthesised with the Web Audio API.
// No audio files needed — every sound is generated in the browser
// from mathematical waveforms (oscillators) and volume curves.
// =============================================================

let _ctx = null;

// Returns a shared AudioContext, creating it on first call.
// Browsers suspend audio until the first user gesture, so we also
// resume the context here if it was auto-suspended.
function audioCtx() {
    if (!_ctx) {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
}


// =============================================================
// LOW-LEVEL HELPERS
// =============================================================

// Play a single note.
// freq     — pitch in Hz  (e.g. 523 = middle C5)
// type     — wave shape   ('sine' = smooth/mellow, 'triangle' = slightly brighter)
// gain     — peak volume  (0–1; keep below 0.35 to avoid clipping)
// duration — how long the note rings in seconds
// delay    — seconds from now before the note starts (for scheduling arpeggios)
function note(freq, type, gain, duration, delay = 0) {
    const ac  = audioCtx();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);

    // Quick attack (10 ms), then exponential decay to silence
    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, ac.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration);

    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.05);
}

// Play a pitch sweep — the frequency glides from startFreq to endFreq.
// Great for whooshes, bwomps, and swishes.
function sweep(startFreq, endFreq, type, gain, duration, delay = 0) {
    const ac  = audioCtx();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ac.currentTime + delay);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ac.currentTime + delay + duration);

    g.gain.setValueAtTime(gain, ac.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration);

    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.05);
}


// =============================================================
// GAME SOUND EFFECTS
// =============================================================

// Card flip — a quick upward whoosh as the card rotates
function soundCardFlip() {
    sweep(300, 1000, 'sine', 0.14, 0.25);
}

// Card lands on the timeline — the flying clone arrives with a soft click
function soundCardLand() {
    note(700, 'sine', 0.16, 0.08);
}

// Correct placement — bright ascending arpeggio (C5 → E5 → G5)
function soundCorrectPlacement() {
    note(523, 'sine', 0.28, 0.18, 0.00);   // C5
    note(659, 'sine', 0.26, 0.18, 0.13);   // E5
    note(784, 'sine', 0.24, 0.28, 0.26);   // G5 (held slightly longer)
}

// Bonus token earned for correct artist + title guess — a sparkly flourish
// on top of the correct-placement arpeggio (call ~350 ms after soundCorrectPlacement)
function soundTokenEarned() {
    note(988,  'sine', 0.16, 0.12, 0.00);  // B5
    note(1319, 'sine', 0.13, 0.18, 0.10);  // E6
}

// Wrong placement — a low descending "bwomp"
function soundWrongPlacement() {
    sweep(280, 65, 'sine', 0.28, 0.45);
}

// Skip card — a light downward swish
function soundSkipCard() {
    sweep(700, 280, 'sine', 0.11, 0.20);
}

// Buy placement — three quick ascending coin-pings (one per token spent feeling)
function soundBuyPlacement() {
    note(880,  'sine', 0.20, 0.12, 0.00);
    note(1100, 'sine', 0.18, 0.12, 0.10);
    note(1320, 'sine', 0.16, 0.16, 0.20);
}

// HITSTER! steal wins — a cheeky heist flourish:
// starts with a low boom, then runs up a triangle-wave arpeggio
function soundStealWins() {
    sweep(120, 55, 'sine',     0.22, 0.20, 0.00);   // low boom
    note(262,  'triangle',     0.18, 0.12, 0.15);   // C4
    note(392,  'triangle',     0.18, 0.12, 0.25);   // G4
    note(523,  'triangle',     0.20, 0.14, 0.35);   // C5
    note(659,  'triangle',     0.22, 0.22, 0.44);   // E5
    note(784,  'triangle',     0.20, 0.30, 0.54);   // G5 — held to finish
}

// Token cap — a gentle "blocked" sound: a dull thud + short descending note
// Plays when a player would have earned a token but is already at 5
function soundTokenCapped() {
    sweep(220, 140, 'sine', 0.18, 0.25);     // brief descending fall
    note(110,  'sine', 0.14, 0.20, 0.10);    // dull low thud underneath
}

// Win screen fanfare — triumphant ascending arpeggio with a sustained chord
function soundWin() {
    note(523,  'sine', 0.26, 0.20, 0.00);   // C5
    note(659,  'sine', 0.24, 0.20, 0.16);   // E5
    note(784,  'sine', 0.24, 0.20, 0.32);   // G5
    note(1047, 'sine', 0.28, 0.70, 0.48);   // C6 — held long
    // Harmony underneath the held top note
    note(392,  'sine', 0.16, 0.65, 0.48);   // G4
    note(523,  'sine', 0.14, 0.65, 0.48);   // C5
}
