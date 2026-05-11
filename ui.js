// =============================================================
// HITSTER ONLINE — ui.js
// Connects the HTML interface to the game logic in game.js.
// =============================================================

// --- UI state ---
let selectedPosition      = null; // slot the active player clicked (index into timeline gaps)
let activePosition        = null; // confirmed after Place Here is clicked (used in resolveRound)
let lastPlayedCard        = null; // stored for reveal display
let justWonCard           = null; // card that was just added to a timeline (gets glow animation)
let stealModeStealerIndex = null; // when set, timeline slot clicks are steal position choices

// --- Shorthand helper ---
function el(id) { return document.getElementById(id); }


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

function showMessage(text, persistent = false) {
    const bar = el('message-bar');
    bar.textContent = text;
    bar.classList.remove('hidden');
    clearTimeout(messageTimer);
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
    const row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML = `<input type="text" class="player-name-input" placeholder="Player ${rows.length + 1} name" maxlength="20">
                     <button type="button" class="delete-player-btn" aria-label="Remove player">×</button>`;
    el('player-inputs').appendChild(row);
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
    const inputs  = document.querySelectorAll('.player-name-input');
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

function onStartGame() {
    const inputs = document.querySelectorAll('.player-name-input');
    const names  = Array.from(inputs).map(i => i.value.trim()).filter(n => n.length > 0);
    if (names.length < 2) {
        showMessage('Please enter at least 2 player names.');
        return;
    }
    const startingName  = el('starting-player-select').value;
    const startingIndex = names.indexOf(startingName);
    const mode          = el('mode-select').value;
    startGame(names, mode, startingIndex >= 0 ? startingIndex : 0);
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
            slot.innerHTML = `✪<br>${stealerName ?? (game.pendingSteal ? game.players[game.pendingSteal.stealerIndex].name : '?')}`;
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

            cardEl.innerHTML = `<span class="card-year">${card.year}</span>
                                <span class="card-artist">${card.artist}</span>
                                <span class="card-title">${card.title}</span>`;
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
        const row      = document.createElement('div');
        row.className  = 'player-row' + (isActive ? ' active-turn' : '');
        row.innerHTML  = `
            <span class="player-row-name">${isActive ? '<span class="now-playing-icon">▶</span>' : ''}${player.name}</span>
            <span class="player-row-tokens"><span class="player-token-icon">✪</span> <span class="player-token-count">${player.tokens}</span></span>
            <span class="player-row-cards">${player.timeline.length} cards</span>
        `;
        list.appendChild(row);
    });
}

// Fills in the flip card back with the song's info (year / artist / title)
function showSongInfo(card) {
    el('reveal-year').textContent   = card.year;
    el('reveal-artist').textContent = card.artist;
    el('reveal-title').textContent  = card.title;
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
}

function setButtonEnabled(btn, enabled) {
    if (enabled) {
        btn.classList.remove('btn-disabled');
    } else {
        btn.classList.add('btn-disabled');
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

    // Reset the flip card instantly (no transition) so it snaps back to QR side
    const inner = el('flip-card-inner');
    inner.style.transition = 'none';
    inner.classList.remove('flipped');
    requestAnimationFrame(() => { inner.style.transition = ''; });

    // Reset all panels
    el('name-guess-form').classList.add('hidden');
    el('reveal-message').classList.add('hidden');
    el('next-turn-btn').classList.add('hidden');
    el('message-bar').classList.add('hidden');
    el('steal-panel').classList.add('hidden');
    el('stealer-timeline-section').classList.add('hidden');
    el('override-btn').classList.add('hidden');
    el('scan-hint').classList.remove('hidden');
    el('guess-artist').value    = '';
    el('guess-title').value     = '';
    el('guess-artist').disabled = false;
    el('guess-title').disabled  = false;
    el('submit-btn').classList.remove('hidden');

    // Show action buttons
    el('place-btn').classList.remove('hidden');
    el('skip-btn').classList.remove('hidden');
    el('steal-btn').classList.remove('hidden');
    el('buy-btn').classList.remove('hidden');
    el('next-turn-btn').classList.add('hidden');

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
    el('message-bar').classList.add('hidden'); // clear any previous hint when a new slot is chosen
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
    rankEl.innerHTML = '<h3 class="win-ranking-title">Final standings</h3>';

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
        row.innerHTML = `
            <span class="win-rank-pos">${isWinner ? '🏆' : '#' + rank}</span>
            <span class="win-rank-name">${player.name}</span>
            <span class="win-rank-stats">${player.timeline.length} card${player.timeline.length !== 1 ? 's' : ''} · ${player.tokens} ✪</span>
        `;
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

    let html = '<p class="steal-label">Who wants to challenge? (costs 1 ✪ token)</p>';
    nonActive.forEach(({ player, index }) => {
        html += `<button class="secondary-btn steal-player-btn"
                         data-player-index="${index}">
                   ${player.name} — ${player.tokens} token${player.tokens !== 1 ? 's' : ''}
                 </button>`;
    });
    html += '<button id="cancel-steal-btn" class="secondary-btn">Cancel</button>';
    panel.innerHTML = html;

    panel.querySelectorAll('.steal-player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.playerIndex);
            if (game.players[idx].tokens < 1) {
                showMessage(`${game.players[idx].name} doesn't have enough tokens to steal.`);
                return;
            }
            renderStealSlots(idx);
        });
    });

    el('cancel-steal-btn').addEventListener('click', () => {
        el('steal-panel').classList.add('hidden');
    });
}

function renderStealSlots(stealerIndex) {
    const panel    = el('steal-panel');
    const stealer  = game.players[stealerIndex];
    const timeline = game.getCurrentPlayer().timeline;

    // Activate steal mode: timeline slots now call confirmSteal instead of onSlotClick
    stealModeStealerIndex = stealerIndex;
    el('timeline-container').classList.add('steal-mode');
    renderTimeline(); // re-render so the timeline reflects steal mode visually

    let html = `<p class="steal-label">${stealer.name}: tap a slot directly on the timeline above, or pick from the list below</p>
                <div class="steal-slot-buttons">`;

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

        html += `<button class="secondary-btn steal-slot-btn"
                         data-position="${i}"
                         data-stealer="${stealerIndex}">${label}</button>`;
    }
    html += '</div><button id="cancel-steal-btn" class="secondary-btn">Cancel</button>';
    panel.innerHTML = html;

    panel.querySelectorAll('.steal-slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const pos    = parseInt(btn.dataset.position);
            const steIdx = parseInt(btn.dataset.stealer);
            confirmSteal(steIdx, pos);
        });
    });

    el('cancel-steal-btn').addEventListener('click', () => {
        stealModeStealerIndex = null;
        el('timeline-container').classList.remove('steal-mode');
        el('steal-panel').classList.add('hidden');
        game.pendingSteal = null;
        renderTimeline();
        updateButtonStates();
    });
}

function confirmSteal(stealerIndex, stealPosition) {
    stealModeStealerIndex = null;
    el('timeline-container').classList.remove('steal-mode');
    const result = initiateSteal(game, stealerIndex, stealPosition);
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

    // Show steal button + name guess form + submit
    el('steal-btn').classList.remove('hidden');
    el('name-guess-form').classList.remove('hidden');
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
});

// --- Submit & reveal ---
el('submit-btn').addEventListener('click', async () => {
    el('message-bar').classList.add('hidden');
    const artist = el('guess-artist').value.trim();
    const title  = el('guess-title').value.trim();

    const nameGuess = (artist || title) ? { artist, title } : null;
    if (nameGuess && (!artist || !title)) {
        showMessage('Fill in BOTH artist name and song title, or leave both empty to skip the guess.');
        return;
    }

    // Save state before resolveRound clears pendingSteal and currentCard
    const resolvedPosition = activePosition;
    const savedSteal = game.pendingSteal ? {
        position:    game.pendingSteal.stealPosition,
        stealerName: game.players[game.pendingSteal.stealerIndex].name
    } : null;

    const result = resolveRound(game, activePosition, nameGuess);
    lastPlayedCard = result.card;
    activePosition = null;

    // Determine which card was won (must be set before rendering so --won-pending is applied)
    if (result.stealResult?.outcome === 'steal_wins') {
        justWonCard = result.card;
    } else if (result.activeCorrect) {
        justWonCard = result.card;
    } else {
        justWonCard = null;
    }

    // Populate the flip card back with the revealed song info
    showSongInfo(lastPlayedCard);

    // Flip the card (QR → song info); hide the scan hint since the QR is no longer visible
    el('flip-card-inner').classList.add('flipped');
    el('scan-hint').classList.add('hidden');
    el('steal-btn').classList.add('hidden');
    el('steal-panel').classList.add('hidden');

    if (nameGuess) {
        el('guess-artist').disabled = true;
        el('guess-title').disabled  = true;
        el('submit-btn').classList.add('hidden');
    } else {
        el('name-guess-form').classList.add('hidden');
    }

    updateTokenDisplay();

    // Render active player's timeline (with --won-pending placeholder if they won)
    const chosenHighlight = result.activeCorrect ? null : resolvedPosition;
    const keepSteal       = savedSteal && result.stealResult?.outcome !== 'steal_wins';
    renderTimelineInto(
        el('timeline-container'),
        game.getCurrentPlayer().timeline,
        null,
        keepSteal ? savedSteal.position    : null,
        false,
        chosenHighlight,
        keepSteal ? savedSteal.stealerName : null
    );
    renderAllPlayers();

    // Wait for the flip animation to finish before doing anything else
    await sleep(700);

    // Handle each outcome
    if (result.stealResult?.outcome === 'steal_wins') {
        const stealer = result.stealResult.stealer;
        // Render stealer's timeline (justWonCard is set, so card gets --won-pending)
        renderTimelineInto(el('stealer-timeline-container'), stealer.timeline, null, null, false);
        el('stealer-timeline-label').textContent = `🎉 ${stealer.name} steals the card!`;
        el('stealer-timeline-section').classList.remove('hidden');

        await flyCardToTimeline('stealer-timeline-container');
        await sleep(1000); // let the glow settle before showing the message
        showRevealMessage(`🎉 ${stealer.name} stole the card! Their token was returned.`, 'success');

    } else if (result.activeCorrect) {
        await flyCardToTimeline('timeline-container');
        await sleep(1000); // let the glow settle before showing the message

        if (result.stealResult) {
            const sName = result.stealResult.stealer.name;
            if (result.nameGuessCorrect) {
                showRevealMessage(`Right placement ✅  Bonus token! ✪  ${sName}'s steal failed.`, 'success');
            } else if (nameGuess) {
                showRevealMessage(`Right placement ✅  Artist & title not quite.  ${sName}'s steal failed.`, 'success');
            } else {
                showRevealMessage(`${game.getCurrentPlayer().name} was right! ✅  ${sName}'s steal failed.`, 'success');
            }
        } else if (result.nameGuessCorrect) {
            showRevealMessage('Correct placement! ✅  Bonus token for artist & title! ✪', 'success');
        } else if (nameGuess) {
            showRevealMessage('Correct placement! ✅  Artist & title not quite — good try!', 'success');
        } else {
            showRevealMessage('Correct placement! ✅', 'success');
        }

    } else if (result.stealResult?.outcome === 'both_wrong') {
        const sName = result.stealResult.stealer.name;
        showRevealMessage(`Both positions were wrong — card discarded. ${sName} loses their token.`, 'error');
    } else {
        showRevealMessage('Wrong position — card discarded. Better luck next turn!', 'error');
    }

    // Show override button if a name guess was attempted but the automatic check said wrong
    if (nameGuess && !result.nameGuessCorrect && result.activeCorrect) {
        el('override-btn').classList.remove('hidden');
    }

    el('next-turn-btn').classList.remove('hidden');
});

// --- Override: group decides the name guess was actually correct ---
el('override-btn').addEventListener('click', () => {
    overrideAndGrantToken(game);
    updateTokenDisplay();
    renderAllPlayers();
    el('override-btn').classList.add('hidden');
    showRevealMessage('Override accepted — bonus token awarded! ✪', 'success');
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
        updateTokenDisplay();
        renderAllPlayers();
        if (result.card) {
            generateQRCode(result.card.spotify_url);
            renderTimeline();
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
        el('flip-card-inner').classList.add('flipped');
        el('scan-hint').classList.add('hidden');
        el('place-btn').classList.add('hidden');
        el('skip-btn').classList.add('hidden');
        el('steal-btn').classList.add('hidden');
        el('buy-btn').classList.add('hidden');

        await sleep(700);
        await flyCardToTimeline('timeline-container');
        await sleep(1000); // let the glow settle before showing the message

        showRevealMessage('Card automatically placed at the correct position! ✅', 'success');
        el('next-turn-btn').classList.remove('hidden');
    }
});

// --- Finish game early ---
el('finish-game-btn').addEventListener('click', () => {
    if (!game) return;
    showWinScreen(handleEmptyDeck(game), 'finished-early');
});

// --- Play Again ---
el('play-again-btn').addEventListener('click', () => {
    game             = null;
    selectedPosition = null;
    activePosition   = null;
    lastPlayedCard   = null;
    el('player-inputs').innerHTML = `
        <div class="player-input-row">
            <input type="text" class="player-name-input" placeholder="Player 1 name" maxlength="20">
            <button type="button" class="delete-player-btn" aria-label="Remove player">×</button>
        </div>
        <div class="player-input-row">
            <input type="text" class="player-name-input" placeholder="Player 2 name" maxlength="20">
            <button type="button" class="delete-player-btn" aria-label="Remove player">×</button>
        </div>
    `;
    updateDeleteButtons();
    updateStartingPlayerDropdown();
    showScreen('setup-screen');
});


// =============================================================
// INITIALISE ON PAGE LOAD
// =============================================================
initSetupScreen();
