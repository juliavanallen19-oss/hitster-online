let _ctx = null;

function audioCtx() {
    if (!_ctx) {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
}

function note(freq, type, gain, duration, delay = 0) {
    const ac  = audioCtx();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);

    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, ac.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration);

    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.05);
}

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

function soundCardFlip() {
    sweep(300, 1000, 'sine', 0.14, 0.25);
}

function soundCardLand() {
    note(700, 'sine', 0.16, 0.08);
}

function soundCorrectPlacement() {
    note(523, 'sine', 0.28, 0.18, 0.00);
    note(659, 'sine', 0.26, 0.18, 0.13);
    note(784, 'sine', 0.24, 0.28, 0.26);
}

function soundTokenEarned() {
    note(988,  'sine', 0.16, 0.12, 0.00);
    note(1319, 'sine', 0.13, 0.18, 0.10);
}

function soundWrongPlacement() {
    sweep(280, 65, 'sine', 0.28, 0.45);
}

function soundSkipCard() {
    sweep(700, 280, 'sine', 0.11, 0.20);
}

function soundBuyPlacement() {
    note(880,  'sine', 0.20, 0.12, 0.00);
    note(1100, 'sine', 0.18, 0.12, 0.10);
    note(1320, 'sine', 0.16, 0.16, 0.20);
}

function soundStealWins() {
    sweep(120, 55, 'sine',     0.22, 0.20, 0.00);
    note(262,  'triangle',     0.18, 0.12, 0.15);
    note(392,  'triangle',     0.18, 0.12, 0.25);
    note(523,  'triangle',     0.20, 0.14, 0.35);
    note(659,  'triangle',     0.22, 0.22, 0.44);
    note(784,  'triangle',     0.20, 0.30, 0.54);
}

function soundTokenCapped() {
    sweep(220, 140, 'sine', 0.18, 0.25);
    note(110,  'sine', 0.14, 0.20, 0.10);
}

function soundCoinLands() {
    note(3500, 'triangle', 0.18, 0.03, 0.00);
    note(2800, 'sine',     0.22, 0.06, 0.00);
    note(2100, 'sine',     0.16, 0.14, 0.02);
    note(3100, 'sine',     0.07, 0.10, 0.03);
    note(1650, 'sine',     0.13, 0.24, 0.04);
    note(1100, 'sine',     0.09, 0.44, 0.10);
}

function soundWin() {
    note(523,  'sine', 0.26, 0.20, 0.00);
    note(659,  'sine', 0.24, 0.20, 0.16);
    note(784,  'sine', 0.24, 0.20, 0.32);
    note(1047, 'sine', 0.28, 0.70, 0.48);
    note(392,  'sine', 0.16, 0.65, 0.48);
    note(523,  'sine', 0.14, 0.65, 0.48);
}
