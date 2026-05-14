// =============================================================
// HITSTER ONLINE — ui.js
// Connects the HTML interface to the game logic in game.js.
// =============================================================

// --- UI state ---
let selectedPosition      = null; // slot the active player clicked (index into timeline gaps)
let activePosition        = null; // confirmed after Place Here is clicked (used in resolveTurn)
let lastPlayedCard        = null; // stored for reveal display
let justWonCard           = null; // card that was just added to a timeline (gets glow animation)
let stealModeStealerIndex = null; // when set, timeline slot clicks are steal position choices
let stealerForOverride    = null; // stealer Player object held for the steal-override-btn click
let finishConfirmTimer    = null; // temporary second-click confirmation for finishing early

// --- Shorthand helper ---
function el(id) { return document.getElementById(id); }

function createEl(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function createButton(text, className, onClick) {
    const btn = createEl('button', className, text);
    btn.type = 'button';
    btn.addEventListener('click', onClick);
    return btn;
}

function createPlayerInputRow(index) {
    const row = createEl('div', 'player-input-row');
    const input = createEl('input', 'player-name-input');
    input.type = 'text';
    input.placeholder = `Player ${index} name`;
    input.maxLength = 20;
    const btn = createEl('button', 'delete-player-btn', '×');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Remove player');
    row.append(input, btn);
    return row;
}


// =============================================================
// SCREEN MANAGEMENT
// =============================================================

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    el(id).classList.add('active');
}


// =============================================================
// FEEDBACK MESSAGE BAR
// persistent = true  → stays until beginTurn() clears it
// persistent = false → auto-hides after 3.5 s
// =============================================================

let messageTimer = null;

function activeMessageBar() {
    const setupBar = el('setup-message-bar');
    if (setupBar && el('setup-screen').classList.contains('active')) {
        return setupBar;
    }
    return el('message-bar');
}

function hideMessageBars() {
    clearTimeout(messageTimer);
    ['setup-message-bar', 'message-bar'].forEach(id => {
        const bar = el(id);
        if (bar) bar.classList.add('hidden');
    });
}

function showMessage(text, persistent = false) {
    const bar = activeMessageBar();
    hideMessageBars();
    bar.textContent = text;
    bar.classList.remove('hidden');
    if (!persistent) {
        messageTimer = setTimeout(() => bar.classList.add('hidden'), 3500);
    }
}


// =============================================================
// SETUP SCREEN
// =============================================================

function initSetupScreen() {
    el('add-player-btn').addEventListener('click', addPlayerInput);
    el('player-inputs').addEventListener('input', updateStartingPlayerDropdown);
    // Delete buttons use event delegation so dynamic rows are covered too
    el('player-inputs').addEventListener('click', onDeletePlayer);
    el('start-game-btn').addEventListener('click', onStartGame);

    // Validate the goal input as soon as focus leaves it
    el('win-target-input').addEventListener('blur', validateWinTarget);
    // Also re-validate on every keystroke after the first blur (touched flag)
    el('win-target-input').addEventListener('input', () => {
        if (el('win-target-input').dataset.touched) validateWinTarget();
    });

    // Mode card buttons — clicking one activates it and updates the hidden select
    document.querySelectorAll('.mode-card').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-card').forEach(b => b.classList.remove('mode-card--active'));
            btn.classList.add('mode-card--active');
            el('mode-select').value = btn.dataset.mode;
        });
    });

    updateDeleteButtons();
    updateAddPlayerButton();
    updateStartingPlayerDropdown();
}

// Shows/hides the "Add player" button based on current count
function updateAddPlayerButton() {
    const rows = document.querySelectorAll('.player-input-row');
    el('add-player-btn').classList.toggle('hidden', rows.length >= 6);
}

// Reassigns every row's placeholder to "Player 1 name", "Player 2 name", … sequentially
function renumberPlayerInputs() {
    document.querySelectorAll('.player-input-row').forEach((row, i) => {
        const input = row.querySelector('.player-name-input');
        if (input) input.placeholder = `Player ${i + 1} name`;
    });
}

function addPlayerInput() {
    const rows = document.querySelectorAll('.player-input-row');
    if (rows.length >= 6) return; // button is hidden anyway, but guard just in case
    el('player-inputs').appendChild(createPlayerInputRow(rows.length + 1));
    updateDeleteButtons();
    updateAddPlayerButton();
    renumberPlayerInputs();
    updateStartingPlayerDropdown();
}

// Handles a click on any × delete button inside #player-inputs
function onDeletePlayer(e) {
    if (!e.target.classList.contains('delete-player-btn')) return;
    const rows = document.querySelectorAll('.player-input-row');
    if (rows.length <= 2) return;
    e.target.closest('.player-input-row').remove();
    updateDeleteButtons();
    updateAddPlayerButton();
    renumberPlayerInputs(); // re-sequence after deletion so numbering stays gapless
    updateStartingPlayerDropdown();
}

// Disables delete buttons when only 2 rows remain (can't go below minimum)
function updateDeleteButtons() {
    const rows = document.querySelectorAll('.player-input-row');
    rows.forEach(row => {
        const btn = row.querySelector('.delete-player-btn');
        if (btn) btn.disabled = rows.length <= 2;
    });
}

// "Who goes first?" dropdown — only shows players who have typed a name (fix #2)
function updateStartingPlayerDropdown() {
    const inputs  = document.querySelectorAll('.player-name-input:not(#win-target-input)');
    const select  = el('starting-player-select');
    const current = select.value;
    select.innerHTML = '';
    inputs.forEach(input => {
        const name = input.value.trim();
        if (!name) return; // skip empty rows
        const opt       = document.createElement('option');
        opt.value       = name; // store name, not index
        opt.textContent = name;
        select.appendChild(opt);
    });
    if (current) select.value = current; // restore previous selection if still present
}

function validateWinTarget() {
    const input    = el('win-target-input');
    const errorEl  = el('win-target-error');
    input.dataset.touched = 'true';
    const val = parseInt(input.value.trim(), 10);
    const invalid = !input.value.trim() || isNaN(val) || val < 2 || val > 20;
    errorEl.classList.toggle('hidden', !invalid);
    return !invalid;
}

function onStartGame() {
    const inputs = document.querySelectorAll('.player-name-input:not(#win-target-input)');
    const names  = Array.from(inputs).map(i => i.value.trim()).filter(n => n.length > 0);
    if (names.length < 2) {
        showMessage('Please enter at least 2 player names.', true);
        return;
    }
    const normalizedNames = names.map(n => n.toLocaleLowerCase());
    if (new Set(normalizedNames).size !== names.length) {
        showMessage('Please use unique player names so turns and steals are clear.', true);
        return;
    }

    if (!validateWinTarget()) {
        el('win-target-input').focus();
        return;
    }
    const winTarget = parseInt(el('win-target-input').value.trim(), 10);

    const startingName  = el('starting-player-select').value;
    const startingIndex = names.indexOf(startingName);
    const mode          = el('mode-select').value;
    startGame(names, mode, startingIndex >= 0 ? startingIndex : 0, winTarget);
    showScreen('game-screen');
    beginTurn();
}


// =============================================================
// RENDERING HELPERS
// =============================================================

function renderPlayerHeader() {
    const player = game.getCurrentPlayer();
    el('active-player-name').textContent        = player.name;
    el('active-player-token-count').textContent = player.tokens;
    el('timeline-label').textContent            = `${player.name}'s timeline`;
    el('deck-count').textContent                = game.deck.length;
}

function decadeClass(year) {
    if (year < 1970) return 'decade-60s';
    if (year < 1980) return 'decade-70s';
    if (year < 1990) return 'decade-80s';
    if (year < 2000) return 'decade-90s';
    if (year < 2010) return 'decade-00s';
    if (year < 2020) return 'decade-10s';
    return 'decade-20s';
}

// Renders a timeline into a given container element.
// pendingPos:  if not null, shows a face-down card at that slot index.
// stealPos:    if not null, shows a steal token marker at that slot index.
// interactive: if true, slots are clickable (used for active player's timeline).
// chosenPos:   slot index to keep highlighted (orange) after reveal on wrong placement
// stealerName: when set, steal marker uses this name (for post-reveal display after pendingSteal is cleared)
function renderTimelineInto(container, timeline, pendingPos, stealPos, interactive, chosenPos = null, stealerName = null) {
    container.innerHTML = '';

    for (let i = 0; i <= timeline.length; i++) {

        // ---- Slot ----
        const slot = document.createElement('div');

        if (i === pendingPos) {
            slot.className = `timeline-card timeline-card--facedown ${i === selectedPosition ? 'selected' : ''}`;
        } else if (i === stealPos) {
            slot.className = 'steal-token-marker';
            const name = stealerName ?? (game.pendingSteal ? game.players[game.pendingSteal.stealerIndex].name : '?');
            slot.append(document.createTextNode('✪'), document.createElement('br'), document.createTextNode(name));
        } else if (interactive) {
            slot.className = 'timeline-slot' + (i === selectedPosition ? ' selected' : '');
        } else {
            slot.className = 'timeline-slot-static' + (i === chosenPos ? ' timeline-slot-chosen' : '');
        }

        if (interactive) {
            slot.dataset.position = i;
            slot.addEventListener('click', () => onSlotClick(i));
        }
        container.appendChild(slot);

        // ---- Card to the right of this slot ----
        if (i < timeline.length) {
            const card   = timeline[i];
            const cardEl = document.createElement('div');

            const isJustWon = card === justWonCard;
            if (isJustWon) {
                // Invisible placeholder while fly animation plays; flyCardToTimeline switches it to --won
                cardEl.className = `timeline-card ${decadeClass(card.year)} timeline-card--won-pending`;
                cardEl.dataset.justWon = 'true';
            } else {
                cardEl.className = `timeline-card ${decadeClass(card.year)}`;
            }

            cardEl.append(
                createEl('span', 'card-year', String(card.year)),
                createEl('span', 'card-artist', card.artist),
                createEl('span', 'card-title', card.title)
            );
            container.appendChild(cardEl);
        }
    }
}

function renderTimeline() {
    const player   = game.getCurrentPlayer();
    const stealPos = game.pendingSteal ? game.pendingSteal.stealPosition : null;
    renderTimelineInto(el('timeline-container'), player.timeline, activePosition, stealPos, true);
}

function renderAllPlayers() {
    const list = el('players-list');
    list.innerHTML = '';
    game.players.forEach((player, i) => {
        const isActive = i === game.currentPlayerIndex;
        const pill = createEl('div', 'player-pill' + (isActive ? ' player-pill--active' : ''));

        pill.appendChild(createEl('span', 'player-pill-name', player.name));

        const tokens = createEl('span', 'player-pill-stat');
        tokens.title = 'Tokens';
        tokens.append(
            createEl('span', 'player-token-icon', '✪'),
            createEl('span', 'player-token-count', String(player.tokens))
        );
        pill.appendChild(tokens);

        const cards = createEl('span', 'player-pill-stat');
        cards.title = 'Cards on timeline';
        cards.append(
            createEl('span', 'player-pill-card-icon', '🎴'),
            document.createTextNode(String(player.timeline.length))
        );
        pill.appendChild(cards);

        list.appendChild(pill);
    });
}

// Fills in the flip card back with the song's info (year / artist / title)
function showSongInfo(card) {
    el('reveal-year').textContent   = card.year;
    el('reveal-artist').textContent = card.artist;
    el('reveal-title').textContent  = card.title;
    document.querySelector('.flip-card-back')?.setAttribute('aria-hidden', 'false');
}

function hideSongInfo() {
    el('reveal-year').textContent   = '—';
    el('reveal-artist').textContent = '—';
    el('reveal-title').textContent  = '—';
    document.querySelector('.flip-card-back')?.setAttribute('aria-hidden', 'true');
}

function updateTokenDisplay() {
    el('active-player-token-count').textContent = game.getCurrentPlayer().tokens;
    document.querySelectorAll('.player-token-count').forEach((span, i) => {
        if (game.players[i]) span.textContent = game.players[i].tokens;
    });
}

// Resolves after `ms` milliseconds — used to sequence animations with await
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Creates a fixed-position clone of the flip card and smoothly flies it to the
// [data-just-won] card inside the given container. After landing, removes the clone
// and triggers the gold glow animation on the real card.
async function flyCardToTimeline(containerId) {
    const wonEl = document.querySelector(`#${containerId} [data-just-won]`);
    if (!wonEl) return;

    const src = el('flip-card').getBoundingClientRect();
    const dst = wonEl.getBoundingClientRect();

    const clone = document.createElement('div');
    clone.style.cssText = `
        position: fixed;
        left: ${src.left}px; top: ${src.top}px;
        width: ${src.width}px; height: ${src.height}px;
        background: #1a1a22;
        border: 2px solid #ffae3d;
        border-radius: 12px;
        z-index: 9999;
        pointer-events: none;
        transition: left 0.5s cubic-bezier(0.4,0,0.2,1),
                    top 0.5s cubic-bezier(0.4,0,0.2,1),
                    width 0.5s cubic-bezier(0.4,0,0.2,1),
                    height 0.5s cubic-bezier(0.4,0,0.2,1),
                    border-radius 0.5s ease;
    `;
    document.body.appendChild(clone);

    // Force a reflow so the browser registers the starting position before animating
    clone.getBoundingClientRect();

    clone.style.left         = `${dst.left}px`;
    clone.style.top          = `${dst.top}px`;
    clone.style.width        = `${dst.width}px`;
    clone.style.height       = `${dst.height}px`;
    clone.style.borderRadius = '8px';

    await sleep(550);
    soundCardLand(); // soft click as the clone arrives
    clone.remove();

    // Reveal the real card and trigger the glow animation
    wonEl.removeAttribute('data-just-won');
    wonEl.classList.remove('timeline-card--won-pending');
    wonEl.classList.add('timeline-card--won');
}

// Shows a result message inside the song card area (not the bottom message bar)
function showRevealMessage(text, type = 'info') {
    const msgEl = el('reveal-message');
    msgEl.textContent = text;
    msgEl.className   = `reveal-message reveal-message--${type}`;
    msgEl.classList.remove('hidden');
}


// =============================================================
// BUTTON STATES
// =============================================================

function updateButtonStates() {
    const player  = game.getCurrentPlayer();
    const hasSlot = selectedPosition !== null;
    const placed  = activePosition !== null; // Place Here already clicked

    // Before Place Here: only Skip and Buy are relevant
    // After Place Here: only Steal is relevant (others hidden)
    const anyoneCanSteal = game.players.some((p, i) => i !== game.currentPlayerIndex && p.tokens >= 1);
    setButtonEnabled(el('place-btn'),  hasSlot && !placed);
    setButtonEnabled(el('steal-btn'),  placed && game.pendingSteal === null && anyoneCanSteal);
    setButtonEnabled(el('skip-btn'),   !placed && player.tokens >= 1);
    setButtonEnabled(el('buy-btn'),    !placed && player.tokens >= 3);

    updatePhasePrompt({ hasSlot, placed });
}

// Sets the big "what should I do now?" text above the timeline based on phase.
function updatePhasePrompt({ hasSlot, placed }) {
    const promptEl = el('phase-prompt');
    if (!promptEl) return;
    // If a steal is in progress / steal panel is open, defer to its own UI
    if (!el('steal-panel').classList.contains('hidden')) {
        promptEl.textContent = '🎯 Anyone want to challenge this placement?';
        return;
    }
    if (!el('next-turn-btn').classList.contains('hidden')) {
        const isShowWinners = el('next-turn-btn').textContent.trim() === 'Show Winners';
        promptEl.textContent = isShowWinners
            ? '🏆 Round complete. Continue to see who wins!'
            : '✨ Turn complete. Continue to the next turn.';
        return;
    }
    if (placed) {
        promptEl.textContent = '🎵 Submit to reveal the year — or let opponents steal first.';
        return;
    }
    if (hasSlot) {
        promptEl.textContent = '✅ Slot selected. Tap "Place card here" to commit.';
        return;
    }
    promptEl.textContent = '🎧 Scan the QR with your phone, then tap a slot where you think the song belongs.';
}

function setButtonEnabled(btn, enabled) {
    btn.dataset.inactive = String(!enabled);
    if (enabled) {
        btn.classList.remove('btn-disabled');
    } else {
        btn.classList.add('btn-disabled');
    }
}

// Spawns a ✪ token in the center of the screen, spins it, flies it to the
// token badge in the header, then plays a coin-landing sound and bumps the badge.
async function animateTokenEarned() {
    const token = document.createElement('div');
    token.className = 'token-fly';
    token.textContent = '✪';
    document.body.appendChild(token);

    token.style.left      = `${window.innerWidth  / 2}px`;
    token.style.top       = `${window.innerHeight * 0.50}px`;
    token.style.animation = 'token-spawn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards';

    await sleep(530);

    const badge = el('active-player-tokens');
    const r     = badge.getBoundingClientRect();
    token.style.transition = 'left 0.55s cubic-bezier(0.4,0,0.2,1), top 0.55s cubic-bezier(0.4,0,0.2,1), transform 0.55s ease, opacity 0.1s ease 0.47s';
    token.style.left       = `${r.left + r.width  / 2}px`;
    token.style.top        = `${r.top  + r.height / 2}px`;
    token.style.transform  = 'translate(-50%,-50%) scale(0.15) rotate(720deg)';

    await sleep(570);

    soundCoinLands();
    token.style.opacity = '0';

    badge.classList.remove('token-badge--bump');
    void badge.offsetWidth;
    badge.classList.add('token-badge--bump');
    badge.addEventListener('animationend', () => badge.classList.remove('token-badge--bump'), { once: true });

    setTimeout(() => token.remove(), 200);
}

function resetFinishButton() {
    clearTimeout(finishConfirmTimer);
    const btn = el('finish-game-btn');
    btn.classList.remove('finish-game-btn--confirm');
    btn.textContent = 'Finish game';
}

// Sets the label and any persistent message on the next-turn button depending on
// whether the win target has been hit and how many players remain in the final round.
function updateNextTurnButton() {
    const btn = el('next-turn-btn');
    const winner = checkWinCondition(game);
    const n = game.players.length;

    if (!game.finalRound && winner) {
        const remaining = (game.startingPlayerIndex - game.currentPlayerIndex - 1 + n) % n;
        if (remaining === 0) {
            btn.textContent = 'Show Winners';
        } else {
            showMessage(
                `🏆 ${winner.name} reached ${game.winTarget} cards! ${remaining} more player${remaining > 1 ? 's' : ''} still get a turn.`,
                true
            );
            btn.textContent = remaining === 1 ? 'Final Turn →' : 'Continue to next turn →';
        }
    } else if (game.finalRound) {
        const lastPlayerIdx = (game.startingPlayerIndex - 1 + n) % n;
        const nextIdx = (game.currentPlayerIndex + 1) % n;
        if (nextIdx === game.startingPlayerIndex) {
            btn.textContent = 'Show Winners';
        } else if (nextIdx === lastPlayerIdx) {
            btn.textContent = 'Final Turn →';
        } else {
            btn.textContent = 'Continue to next turn →';
        }
    } else {
        btn.textContent = 'Continue to next turn →';
    }
}


// =============================================================
// TURN FLOW
// =============================================================

function beginTurn() {
    selectedPosition      = null;
    activePosition        = null;
    lastPlayedCard        = null;
    justWonCard           = null;
    stealModeStealerIndex = null;
    el('timeline-container').classList.remove('steal-mode');
    resetFinishButton();
    if (game && game.finalRound) {
        showMessage('🏁 Final Round — everyone gets one more turn!', true);
    }

    // Reset the flip card instantly (no transition) so it snaps back to QR side
    const inner = el('flip-card-inner');
    inner.style.transition = 'none';
    inner.classList.remove('flipped');
    requestAnimationFrame(() => { inner.style.transition = ''; });
    hideSongInfo();

    // Reset all panels — name-guess form is always visible (no toggle), so just clear & enable it
    el('name-guess-area').classList.add('hidden');
    el('name-guess-form').classList.remove('hidden');
    el('name-guess-form').classList.remove('name-guess-form--required');
    el('name-guess-toggle-btn').classList.add('hidden'); // legacy toggle is never shown
    el('reveal-message').classList.add('hidden');
    el('next-turn-btn').classList.add('hidden');
    hideMessageBars();
    el('steal-panel').classList.add('hidden');
    el('stealer-timeline-section').classList.add('hidden');
    el('override-btn').classList.add('hidden');
    el('steal-override-btn').classList.add('hidden');
    stealerForOverride = null;
    el('scan-hint').classList.remove('hidden');
    el('guess-artist').value    = '';
    el('guess-title').value     = '';
    el('guess-artist').disabled = false;
    el('guess-title').disabled  = false;
    el('guess-artist').classList.remove('hidden');
    el('guess-title').classList.remove('hidden');

    // Update mode badge in header
    const modeBadge = el('mode-badge');
    if (modeBadge) {
        const modeLabels = { original: '🎵 Original', chill: '😎 Chill', pro: '🔥 PRO' };
        modeBadge.textContent = modeLabels[game.mode] || game.mode;
    }

    // Mode-specific name-guess hint text
    const isPro   = game.mode === "pro";
    const isChill = game.mode === "chill";
    const hintEl  = document.getElementById('name-guess-hint');

    if (isPro) {
        // PRO: form is REQUIRED to keep the card (visual emphasis via .name-guess-form--required)
        el('name-guess-form').classList.add('name-guess-form--required');
        if (hintEl) hintEl.textContent = '🔥 PRO: name BOTH the title and artist or lose the card';
    } else if (isChill) {
        if (hintEl) hintEl.textContent = '😎 Name the title OR artist for a bonus ✪';
    } else {
        if (hintEl) hintEl.textContent = '🎵 Name both the title and artist for a bonus ✪';
    }

    // Show action buttons; submit only appears after Place here
    el('place-btn').classList.remove('hidden');
    el('skip-btn').classList.remove('hidden');
    el('steal-btn').classList.remove('hidden');
    el('buy-btn').classList.remove('hidden');
    el('submit-btn').classList.add('hidden');
    el('next-turn-btn').classList.add('hidden');

    // Name guess area visible from the very start of every turn
    el('name-guess-area').classList.remove('hidden');

    // Reset Spotify preview — hide embed, show the play button again
    el('spotify-preview-container').classList.add('hidden');
    el('spotify-preview-container').innerHTML = '';
    el('preview-btn').classList.remove('hidden');

    // Draw a card if none is in play
    if (!game.currentCard) {
        const card = drawCard(game);
        if (!card) {
            showWinScreen(handleEmptyDeck(game), 'deck-empty');
            return;
        }
    }

    lastPlayedCard = game.currentCard;

    generateQRCode(game.currentCard.spotify_url);
    renderPlayerHeader();
    renderTimeline();
    renderAllPlayers();
    updateButtonStates();
}

// Player clicks a slot in the timeline.
// In steal mode the click selects the steal position; otherwise it selects a placement slot.
function onSlotClick(position) {
    if (stealModeStealerIndex !== null) {
        if (position === activePosition) {
            showMessage("That slot is already taken by the active player — pick a different one.", true);
            return;
        }
        confirmSteal(stealModeStealerIndex, position);
        return;
    }
    if (activePosition !== null) return; // already placed
    selectedPosition = position;
    hideMessageBars(); // clear any previous hint when a new slot is chosen
    renderTimeline();
    updateButtonStates();
}


// =============================================================
// WIN SCREEN
// reason: 'goal'           → someone reached the target card count
//         'deck-empty'     → deck ran out naturally
//         'finished-early' → player clicked "Finish game"
//         null             → no note shown
// =============================================================

function showWinScreen(winners, reason = null) {
    soundWin();
    const list = Array.isArray(winners) ? winners : [winners];

    // Context note above the headline
    const noteEl = el('win-deck-note');
    if (reason === 'deck-empty') {
        noteEl.textContent = 'The song deck is empty';
        noteEl.classList.remove('hidden');
    } else if (reason === 'finished-early') {
        noteEl.textContent = 'The game has been finished';
        noteEl.classList.remove('hidden');
    } else if (reason === 'goal') {
        noteEl.textContent = 'Goal achieved.';
        noteEl.classList.remove('hidden');
    } else {
        noteEl.classList.add('hidden');
    }

    // Headline + winner names
    el('win-headline').textContent  = list.length > 1 ? 'We have a winning team!' : 'We have a winner!';
    el('winner-name').textContent   = list.map(p => p.name).join(' & ');

    // Stats line under the winner name(s)
    const cardCount = list[0].timeline.length;
    let statsText = `${cardCount} card${cardCount !== 1 ? 's' : ''} · `;
    if (list.length === 1) {
        statsText += `${list[0].tokens} token${list[0].tokens !== 1 ? 's' : ''} remaining`;
    } else {
        statsText += list.map(p => `${p.name}: ${p.tokens} ✪`).join(' · ');
    }
    el('winner-stats').textContent = statsText;

    // Full ranking — sorted by cards (desc), then tokens (desc) as tiebreaker
    const sorted = [...game.players].sort(
        (a, b) => b.timeline.length - a.timeline.length || b.tokens - a.tokens
    );
    const rankEl = el('win-ranking');
    rankEl.innerHTML = '';
    rankEl.appendChild(createEl('h3', 'win-ranking-title', 'Final standings'));

    let rank = 1;
    sorted.forEach((player, i) => {
        if (i > 0) {
            const prev = sorted[i - 1];
            if (prev.timeline.length !== player.timeline.length || prev.tokens !== player.tokens) {
                rank = i + 1;
            }
        }
        const isWinner = list.some(w => w === player);
        const row = document.createElement('div');
        row.className = 'win-rank-row' + (isWinner ? ' win-rank-row--winner' : '');
        const cardText = `${player.timeline.length} card${player.timeline.length !== 1 ? 's' : ''} · ${player.tokens} ✪`;
        row.append(
            createEl('span', 'win-rank-pos', isWinner ? '🏆' : `#${rank}`),
            createEl('span', 'win-rank-name', player.name),
            createEl('span', 'win-rank-stats', cardText)
        );
        rankEl.appendChild(row);
    });

    showScreen('win-screen');
}


// =============================================================
// STEAL PANEL (challenger version)
// After Place Here, non-active players can challenge by picking
// a different slot on the active player's timeline.
// =============================================================

function renderStealPanel() {
    const panel     = el('steal-panel');
    const nonActive = game.players
        .map((p, i) => ({ player: p, index: i }))
        .filter(({ player, index }) => index !== game.currentPlayerIndex && player.tokens >= 1);

    panel.innerHTML = '';
    panel.appendChild(createEl('p', 'steal-label', 'Who wants to challenge? (costs 1 ✪ token)'));
    nonActive.forEach(({ player, index }) => {
        const label = `${player.name} — ${player.tokens} token${player.tokens !== 1 ? 's' : ''}`;
        const btn = createButton(label, 'secondary-btn steal-player-btn', () => {
            if (game.players[index].tokens < 1) {
                showMessage(`${game.players[index].name} doesn't have enough tokens to steal.`);
                return;
            }
            renderStealSlots(index);
        });
        btn.dataset.playerIndex = index;
        panel.appendChild(btn);
    });

    const cancel = createButton('Cancel', 'secondary-btn', () => {
        el('steal-panel').classList.add('hidden');
    });
    cancel.id = 'cancel-steal-btn';
    panel.appendChild(cancel);
}

function renderStealSlots(stealerIndex) {
    const panel    = el('steal-panel');
    const stealer  = game.players[stealerIndex];
    const timeline = game.getCurrentPlayer().timeline;
    const isPro    = game.mode === "pro";

    // Activate steal mode: timeline slots now call confirmSteal instead of onSlotClick
    stealModeStealerIndex = stealerIndex;
    el('timeline-container').classList.add('steal-mode');
    renderTimeline(); // re-render so the timeline reflects steal mode visually

    panel.innerHTML = '';
    panel.appendChild(createEl('p', 'steal-label', `${stealer.name}: tap a slot directly on the timeline above, or pick from the list below`));
    const slotButtons = createEl('div', 'steal-slot-buttons');

    for (let i = 0; i <= timeline.length; i++) {
        if (i === activePosition) continue; // skip the slot the active player already chose

        let label;
        if (timeline.length === 0) {
            label = 'Only available position';
        } else if (i === 0) {
            label = `Before ${timeline[0].year}`;
        } else if (i === timeline.length) {
            label = `After ${timeline[timeline.length - 1].year}`;
        } else {
            label = `Between ${timeline[i - 1].year} and ${timeline[i].year}`;
        }

        const pos = i;
        const btn = createButton(label, 'secondary-btn steal-slot-btn', () => {
            confirmSteal(stealerIndex, pos);
        });
        btn.dataset.position = pos;
        btn.dataset.stealer = stealerIndex;
        slotButtons.appendChild(btn);
    }
    panel.appendChild(slotButtons);

    // PRO mode: stealer must also name artist + title
    if (isPro) {
        const guess = createEl('div', 'steal-name-guess');
        guess.appendChild(createEl('p', 'steal-name-guess-label', `🔥 PRO: ${stealer.name} must also name artist & title to win the steal`));
        const titleInput = createEl('input', 'player-name-input');
        titleInput.type = 'text';
        titleInput.id = 'steal-guess-title';
        titleInput.placeholder = 'Song title';
        titleInput.maxLength = 60;
        const artistInput = createEl('input', 'player-name-input');
        artistInput.type = 'text';
        artistInput.id = 'steal-guess-artist';
        artistInput.placeholder = 'Artist name';
        artistInput.maxLength = 60;
        guess.append(titleInput, artistInput);
        panel.appendChild(guess);
    }

    const cancel = createButton('Cancel', 'secondary-btn', () => {
        stealModeStealerIndex = null;
        el('timeline-container').classList.remove('steal-mode');
        el('steal-panel').classList.add('hidden');
        game.pendingSteal = null;
        renderTimeline();
        updateButtonStates();
    });
    cancel.id = 'cancel-steal-btn';
    panel.appendChild(cancel);
}

function confirmSteal(stealerIndex, stealPosition) {
    // PRO: collect the stealer's name guess before locking in
    let stealNameGuess = null;
    if (game.mode === "pro") {
        const stealTitle  = el('steal-guess-title')?.value.trim()  ?? '';
        const stealArtist = el('steal-guess-artist')?.value.trim() ?? '';
        if (!stealTitle || !stealArtist) {
            showMessage('PRO mode: fill in BOTH artist name and song title before confirming the steal.', true);
            return;
        }
        stealNameGuess = { artist: stealArtist, title: stealTitle };
    }

    stealModeStealerIndex = null;
    el('timeline-container').classList.remove('steal-mode');
    const result = initiateSteal(game, stealerIndex, stealPosition, stealNameGuess);
    if (!result.success) {
        showMessage('Could not register steal — try again.');
        return;
    }
    el('steal-panel').classList.add('hidden');
    updateTokenDisplay();
    renderAllPlayers();
    renderTimeline(); // re-render with token marker visible
    updateButtonStates(); // disable steal button (one per turn)
    showMessage(`${result.stealer.name} has placed their token! Click "Submit & reveal" when ready.`, true);
}


// =============================================================
// EVENT LISTENERS
// =============================================================

// --- Spotify preview ---
el('preview-btn').addEventListener('click', () => {
    const url = game?.currentCard?.spotify_url;
    if (!url) return;
    const trackId = url.split('/track/')[1]?.split('?')[0];
    if (!trackId) return;

    el('preview-btn').classList.add('hidden');
    const container = el('spotify-preview-container');
    container.innerHTML = `<iframe
        src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0&autoplay=1"
        width="100%"
        height="80"
        frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"></iframe>`;
    container.classList.remove('hidden');
});

// --- Name guess toggle ---
el('name-guess-toggle-btn').addEventListener('click', () => {
    const form = el('name-guess-form');
    const btn  = el('name-guess-toggle-btn');
    const open = form.classList.toggle('hidden');
    // open is true when we just ADDED 'hidden' (i.e. collapsed)
    btn.textContent = open
        ? (game?.mode === 'chill' ? '😎 Name artist OR title for a bonus token ✪' : '🎵 Name song & artist for a bonus token ✪')
        : '▲ Hide';
});

// --- Place Here ---
el('place-btn').addEventListener('click', () => {
    if (selectedPosition === null) {
        showMessage('First tap a slot in your timeline, then hit "Place here".', true);
        return;
    }
    if (el('place-btn').classList.contains('btn-disabled')) return;

    activePosition = selectedPosition;
    renderTimeline(); // shows face-down card at activePosition

    // Hide place/skip/buy — they're no longer relevant this turn
    el('place-btn').classList.add('hidden');
    el('skip-btn').classList.add('hidden');
    el('buy-btn').classList.add('hidden');

    // Show steal button and submit (name guess area already visible from turn start)
    el('steal-btn').classList.remove('hidden');
    el('submit-btn').classList.remove('hidden');
    updateButtonStates();
});

// --- HITSTER! steal ---
el('steal-btn').addEventListener('click', () => {
    const anyoneCanSteal = game.players.some((p, i) => i !== game.currentPlayerIndex && p.tokens >= 1);
    if (!anyoneCanSteal) {
        showMessage('No player has enough tokens to steal.', true);
        return;
    }
    if (activePosition === null) {
        showMessage('The active player must place their card first.', true);
        return;
    }
    if (game.pendingSteal !== null) {
        showMessage('Only one steal per turn is allowed.', true);
        return;
    }
    renderStealPanel();
    el('steal-panel').classList.remove('hidden');
    updatePhasePrompt({ hasSlot: selectedPosition !== null, placed: activePosition !== null });
});

// --- Submit & reveal ---
el('submit-btn').addEventListener('click', async () => {
    hideMessageBars();
    const artist  = el('guess-artist').value.trim();
    const title   = el('guess-title').value.trim();
    const isPro   = game.mode === "pro";
    const isChill = game.mode === "chill";

    // PRO: name guess is mandatory
    if (isPro && (!artist || !title)) {
        showMessage('PRO mode: you must fill in BOTH artist name and song title before revealing.', true);
        return;
    }

    // Original only: partial entry (one field but not the other) is an error
    // Chill allows one field alone; PRO is already handled above
    if (!isPro && !isChill && ((artist && !title) || (!artist && title))) {
        el('name-guess-form').classList.remove('hidden');
        el('name-guess-toggle-btn').textContent = '▲ Hide';
        showMessage('Fill in BOTH song title and artist name, or leave both empty to skip the guess.');
        return;
    }

    // Chill accepts one field alone as a valid guess; others need both or neither
    const nameGuess = isChill ? ((artist || title) ? { artist, title } : null)
                              : ((artist && title) ? { artist, title } : null);

    // Save state before resolveTurn clears pendingSteal and currentCard
    const resolvedPosition = activePosition;
    const savedSteal = game.pendingSteal ? {
        position:    game.pendingSteal.stealPosition,
        stealerName: game.players[game.pendingSteal.stealerIndex].name
    } : null;

    const result      = resolveTurn(game, activePosition, nameGuess);
    lastPlayedCard    = result.card;
    activePosition    = null;
    const ng          = result.nameGuessCorrect;
    const ngAttempted = nameGuess !== null;

    // Determine which card was won (must be set before rendering so --won-pending is applied)
    // activeKeepsCard (not activeCorrect) decides whether the active player actually keeps it
    if (result.stealResult?.outcome === 'steal_wins') {
        justWonCard = result.card;
    } else if (result.activeKeepsCard) {
        justWonCard = result.card;
    } else {
        justWonCard = null;
    }

    // Populate the flip card back with the revealed song info
    showSongInfo(lastPlayedCard);

    // Flip the card (QR → song info); hide inputs and scan hint
    el('flip-card-inner').classList.add('flipped');
    soundCardFlip();
    el('scan-hint').classList.add('hidden');
    el('preview-btn').classList.add('hidden');
    el('spotify-preview-container').classList.add('hidden');
    el('steal-btn').classList.add('hidden');
    el('steal-panel').classList.add('hidden');
    el('submit-btn').classList.add('hidden');

    // Wrong guess — keep inputs visible so players can check what they typed
    // Correct or unattempted — hide the whole area as before
    if (ngAttempted && !ng) {
        el('guess-artist').disabled = true;
        el('guess-title').disabled  = true;
        if (isChill) {
            // Only keep the field(s) that actually had something in them
            if (!artist) el('guess-artist').classList.add('hidden');
            if (!title)  el('guess-title').classList.add('hidden');
        }
        const hintEl = document.getElementById('name-guess-hint');
        if (hintEl) hintEl.classList.add('hidden'); // hide the prompt; just show the typed values
    } else {
        el('name-guess-area').classList.add('hidden');
    }

    updateTokenDisplay();

    // Token cap: name was correct but player was already at 5 tokens — flash the badge
    if (ngAttempted && ng && !result.tokenEarned) {
        const tokenSpan = el('active-player-token-count');
        tokenSpan.classList.remove('token-count--capped');
        void tokenSpan.offsetWidth; // force reflow so the animation restarts cleanly
        tokenSpan.classList.add('token-count--capped');
        soundTokenCapped();
        tokenSpan.addEventListener('animationend', () => tokenSpan.classList.remove('token-count--capped'), { once: true });
    }

    // Render active player's timeline (with --won-pending placeholder if they won)
    // chosenHighlight: mark the chosen slot when position was WRONG (so the player can see the mistake)
    const chosenHighlight = result.activeCorrect ? null : resolvedPosition;
    const keepSteal       = savedSteal && result.stealResult?.outcome !== 'steal_wins';

    // When a card was inserted at resolvedPosition, every slot at or after that index shifts right by 1.
    // activeKeepsCard drives this — a card is only inserted when the active player keeps it.
    let stealPosToShow = null;
    if (keepSteal) {
        const shift = result.activeKeepsCard && savedSteal.position >= resolvedPosition ? 1 : 0;
        stealPosToShow = savedSteal.position + shift;
    }

    renderTimelineInto(
        el('timeline-container'),
        game.getCurrentPlayer().timeline,
        null,
        stealPosToShow,
        false,
        chosenHighlight,
        keepSteal ? savedSteal.stealerName : null
    );
    renderAllPlayers();

    // Wait for the flip animation to finish before doing anything else
    await sleep(700);

    // Build the outcome message from the two independent results:
    // (1) what happened to the card, (2) whether the name guess was correct
    const sName = result.stealResult?.stealer.name ?? null;

    // Per-field name-guess feedback string — used in all outcome messages below.
    // Chill: names exactly which field(s) were right/wrong.
    // Original/PRO: generic correct/wrong.
    // Token-cap: appends a note when correct but already at max.
    let nameGuessFeedback = '';
    if (ngAttempted) {
        if (isChill && result.nameGuessDetail) {
            const d = result.nameGuessDetail;
            const parts = [];
            if (artist) parts.push(d.artistCorrect ? 'artist correct' : 'artist wrong');
            if (title)  parts.push(d.titleCorrect  ? 'song title correct' : 'song title wrong');
            if (parts.length === 2 && d.artistCorrect && d.titleCorrect) {
                nameGuessFeedback = 'both correct';
            } else if (parts.length === 2 && !d.artistCorrect && !d.titleCorrect) {
                nameGuessFeedback = 'both wrong';
            } else {
                nameGuessFeedback = parts.join(' · ');
            }
            if (ng) nameGuessFeedback += result.tokenEarned ? ' ✪' : ' (already at max tokens)';
        } else if (ng) {
            nameGuessFeedback = result.tokenEarned ? 'artist & title correct ✪' : 'artist & title correct (already at max tokens)';
        } else {
            nameGuessFeedback = 'artist & title not quite';
        }
        // Capitalise the first character so it reads as a proper sentence start
        if (nameGuessFeedback) {
            nameGuessFeedback = nameGuessFeedback[0].toUpperCase() + nameGuessFeedback.slice(1);
        }
    }

    // Handle each outcome
    if (result.stealResult?.outcome === 'steal_wins') {
        const stealer = result.stealResult.stealer;
        renderTimelineInto(el('stealer-timeline-container'), stealer.timeline, null, null, false);
        el('stealer-timeline-label').textContent = `🎉 ${stealer.name} steals the card!`;
        el('stealer-timeline-section').classList.remove('hidden');

        soundStealWins();
        if (result.tokenEarned || isPro) setTimeout(animateTokenEarned, 900);
        await flyCardToTimeline('stealer-timeline-container');
        await sleep(1800);

        if (isPro) {
            showRevealMessage(`🎉 ${sName} stole the card! Artist & title correct — token returned! ✪`, 'success');
        } else if (ngAttempted) {
            showRevealMessage(`🎉 ${sName} stole the card! ${nameGuessFeedback}`, ng ? 'success' : 'error');
        } else {
            showRevealMessage(`🎉 ${sName} stole the card!`, 'error');
        }

    } else if (result.activeKeepsCard) {
        await flyCardToTimeline('timeline-container');
        soundCorrectPlacement();
        if (result.tokenEarned) setTimeout(animateTokenEarned, 350);
        await sleep(1800);

        if (sName) {
            if (isPro) {
                showRevealMessage(`Right placement & artist/title ✅  ${sName}'s challenge failed — token lost.`, 'success');
            } else if (ngAttempted) {
                showRevealMessage(`Right placement ✅  ${nameGuessFeedback}. ${sName}'s steal failed — token lost.`, 'success');
            } else {
                showRevealMessage(`${game.getCurrentPlayer().name} was right! ✅  ${sName}'s steal failed — token lost.`, 'success');
            }
        } else if (isPro) {
            showRevealMessage('Correct! ✅  Placement and artist & title both right!', 'success');
        } else if (ngAttempted) {
            showRevealMessage(`Correct placement! ✅  ${nameGuessFeedback}`, 'success');
        } else {
            showRevealMessage('Correct placement! ✅', 'success');
        }

    } else if (result.stealResult?.outcome === 'both_wrong') {
        soundWrongPlacement();
        if (result.tokenEarned) setTimeout(animateTokenEarned, 500);
        if (isPro && result.activeCorrect) {
            showRevealMessage(`Right position, but artist & title incorrect — card discarded. ${sName}'s challenge also failed — token lost.`, 'error');
        } else if (isPro) {
            showRevealMessage(`Wrong position — card discarded. ${sName}'s challenge also failed — token lost.`, 'error');
        } else if (ngAttempted) {
            showRevealMessage(`Wrong position — card discarded. ${nameGuessFeedback}. ${sName}'s steal also failed — token lost.`, 'error');
        } else {
            showRevealMessage(`Wrong position — card discarded. ${sName}'s steal also failed — token lost. Better luck next turn!`, 'error');
        }

    } else {
        // No steal, active player failed
        soundWrongPlacement();
        if (result.tokenEarned) setTimeout(animateTokenEarned, 500);
        if (isPro && result.activeCorrect) {
            showRevealMessage('Right position, but artist & title incorrect — card discarded.', 'error');
        } else if (ngAttempted && ng) {
            // Position wrong but name was correct — build a "token granted" note
            let tokenNote;
            if (isChill && result.nameGuessDetail) {
                const d = result.nameGuessDetail;
                const field = (d.artistCorrect && d.titleCorrect) ? 'Song title & artist'
                            : d.artistCorrect ? 'Artist' : 'Song title';
                tokenNote = result.tokenEarned ? `${field} correct — token granted ✪`
                                               : `${field} correct — already at max tokens`;
            } else {
                tokenNote = result.tokenEarned ? 'Artist & title correct — token granted ✪'
                                               : 'Artist & title correct — already at max tokens';
            }
            showRevealMessage(`Wrong position — card discarded. Better luck next turn! ${tokenNote}.`, 'error');
        } else if (ngAttempted) {
            showRevealMessage(`Wrong position — card discarded. ${nameGuessFeedback}. Better luck next turn!`, 'error');
        } else {
            showRevealMessage('Wrong position — card discarded. Better luck next turn!', 'error');
        }
    }

    // Override button logic — differs by mode
    if (isPro) {
        // PRO: override appears when the active player had the RIGHT POSITION but wrong name
        if (result.activeCorrect && !result.activeKeepsCard && result.stealResult?.outcome !== 'steal_wins') {
            el('override-btn').classList.remove('hidden');
        }
    } else {
        // Original/Chill: override appears when a name guess was tried but wrong
        if (ngAttempted && !ng) {
            // Label reflects exactly what was typed (Chill: per-field; Original: generic)
            if (isChill) {
                if (artist && title) {
                    el('override-btn').textContent = '✏️ Actually, the artist &/or title were correct';
                } else if (artist) {
                    el('override-btn').textContent = '✏️ Actually, the artist was correct';
                } else {
                    el('override-btn').textContent = '✏️ Actually, the song title was correct';
                }
            } else {
                el('override-btn').textContent = '✏️ Override: artist & title were actually correct';
            }
            el('override-btn').classList.remove('hidden');
        }
    }

    // Steal override: stealer had the correct position but wrong name (PRO only in practice)
    if (result.stealResult?.outcome === 'both_wrong' && result.stealResult?.stealPositionCorrect) {
        stealerForOverride = result.stealResult.stealer;
        el('steal-override-btn').classList.remove('hidden');
    }

    el('next-turn-btn').classList.remove('hidden');
    updateNextTurnButton();
    // Reflect the new "turn complete" phase in the prompt
    updatePhasePrompt({ hasSlot: selectedPosition !== null, placed: activePosition !== null });
});

// --- Override: group decides the name guess was actually correct ---
el('override-btn').addEventListener('click', async () => {
    el('steal-override-btn').classList.add('hidden'); // only one override can apply
    stealerForOverride = null;

    el('name-guess-area').classList.add('hidden'); // no longer needed for review

    if (game.mode === "pro") {
        // PRO: the position was right, so the card is awarded (no extra token — that's the rule)
        const player = game.getCurrentPlayer();
        const pos    = findCorrectPosition(player.timeline, lastPlayedCard);
        justWonCard  = lastPlayedCard;
        insertCardIntoTimeline(player, lastPlayedCard, pos);
        renderTimelineInto(el('timeline-container'), player.timeline, null, null, false);
        el('override-btn').classList.add('hidden');

        await flyCardToTimeline('timeline-container');
        soundCorrectPlacement();
        await sleep(1800);

        showRevealMessage('Override accepted — card won! ✅', 'success');
        updateTokenDisplay();
        renderAllPlayers();

        updateNextTurnButton();
    } else {
        // Original/Chill: just grant the bonus token for the correct guess
        overrideAndGrantToken(game);
        updateTokenDisplay();
        renderAllPlayers();
        el('override-btn').classList.add('hidden');
        animateTokenEarned();
        showRevealMessage('Override accepted — bonus token awarded! ✪', 'success');
    }
});

// --- Steal override: stealer had right position but wrong name (PRO) ---
el('steal-override-btn').addEventListener('click', async () => {
    if (!stealerForOverride) return;
    const stealer = stealerForOverride;
    el('override-btn').classList.add('hidden'); // only one override can apply
    el('steal-override-btn').classList.add('hidden');
    stealerForOverride = null;

    el('name-guess-area').classList.add('hidden'); // no longer needed for review
    earnToken(stealer); // return the token they paid to initiate the steal
    const pos   = findCorrectPosition(stealer.timeline, lastPlayedCard);
    justWonCard = lastPlayedCard;
    insertCardIntoTimeline(stealer, lastPlayedCard, pos);

    el('stealer-timeline-label').textContent = `${stealer.name}'s timeline`;
    renderTimelineInto(el('stealer-timeline-container'), stealer.timeline, null, null, false);
    el('stealer-timeline-section').classList.remove('hidden');

    updateTokenDisplay();
    renderAllPlayers();
    animateTokenEarned();

    await flyCardToTimeline('stealer-timeline-container');
    soundCorrectPlacement();
    await sleep(1800);

    showRevealMessage(`Override accepted — ${stealer.name} wins the card! Token returned. ✅`, 'success');

    updateNextTurnButton();
});

// --- Next turn ---
el('next-turn-btn').addEventListener('click', () => {
    const result = endTurn(game);
    if (result.won) {
        showWinScreen(result.winner, 'goal');
    } else {
        beginTurn();
    }
});

// --- Skip card ---
el('skip-btn').addEventListener('click', () => {
    if (game.getCurrentPlayer().tokens < 1) {
        showMessage("You don't have enough tokens. Gain them first to use this feature.", true);
        return;
    }
    const result = skipCard(game);
    if (result.success) {
        lastPlayedCard   = result.card;
        selectedPosition = null;
        activePosition   = null;
        hideSongInfo();
        soundSkipCard();
        if (result.card) {
            generateQRCode(result.card.spotify_url);
            el('spotify-preview-container').classList.add('hidden');
            el('spotify-preview-container').innerHTML = '';
            el('preview-btn').classList.remove('hidden');
            renderPlayerHeader();
            renderTimeline();
            renderAllPlayers();
            updateButtonStates();
            showMessage('Skipped! New card ready — scan the QR code again to hear your next song.', true);
        } else {
            showWinScreen(handleEmptyDeck(game), 'deck-empty');
        }
    }
});

// --- Buy placement ---
el('buy-btn').addEventListener('click', async () => {
    if (game.getCurrentPlayer().tokens < 3) {
        showMessage("You don't have enough tokens. Gain them first to use this feature.", true);
        return;
    }
    const card = game.currentCard;
    justWonCard = card; // set before buyPlacement clears currentCard
    const result = buyPlacement(game);
    if (result.success) {
        updateTokenDisplay();
        renderAllPlayers();
        // Render timeline with the newly placed card as a --won-pending placeholder
        renderTimelineInto(el('timeline-container'), game.getCurrentPlayer().timeline, null, null, false);

        showSongInfo(card);
        soundBuyPlacement(); // three coin-pings for spending 3 tokens
        el('flip-card-inner').classList.add('flipped');
        soundCardFlip();
        el('scan-hint').classList.add('hidden');
        el('preview-btn').classList.add('hidden');
        el('spotify-preview-container').classList.add('hidden');
        el('place-btn').classList.add('hidden');
        el('skip-btn').classList.add('hidden');
        el('steal-btn').classList.add('hidden');
        el('buy-btn').classList.add('hidden');

        await sleep(700);
        await flyCardToTimeline('timeline-container');
        soundCorrectPlacement(); // arpeggio as the glow fires
        await sleep(1800); // wait for the 1.5s glow to finish, then a short buffer before the message

        showRevealMessage('Card automatically placed at the correct position! ✅', 'success');
        el('next-turn-btn').classList.remove('hidden');
        updatePhasePrompt({ hasSlot: selectedPosition !== null, placed: activePosition !== null });
    }
});

// --- Finish game early ---
el('finish-game-btn').addEventListener('click', () => {
    if (!game) return;
    const btn = el('finish-game-btn');
    if (!btn.classList.contains('finish-game-btn--confirm')) {
        btn.classList.add('finish-game-btn--confirm');
        btn.textContent = 'Click again to finish';
        clearTimeout(finishConfirmTimer);
        finishConfirmTimer = setTimeout(resetFinishButton, 3500);
        return;
    }
    resetFinishButton();
    showWinScreen(handleEmptyDeck(game), 'finished-early');
});

// --- Play Again ---
el('play-again-btn').addEventListener('click', () => {
    game             = null;
    selectedPosition = null;
    activePosition   = null;
    lastPlayedCard   = null;
    justWonCard      = null;
    stealModeStealerIndex = null;
    stealerForOverride    = null;
    resetFinishButton();
    hideSongInfo();
    hideMessageBars();
    el('player-inputs').innerHTML = '';
    el('player-inputs').append(createPlayerInputRow(1), createPlayerInputRow(2));
    el('win-target-input').value = '10';
    delete el('win-target-input').dataset.touched;
    el('win-target-error').classList.add('hidden');
    el('mode-select').value = 'original';
    document.querySelectorAll('.mode-card').forEach(btn => {
        btn.classList.toggle('mode-card--active', btn.dataset.mode === 'original');
    });
    updateDeleteButtons();
    updateAddPlayerButton();
    updateStartingPlayerDropdown();
    showScreen('setup-screen');
});


// =============================================================
// INITIALISE ON PAGE LOAD
// =============================================================
initSetupScreen();
