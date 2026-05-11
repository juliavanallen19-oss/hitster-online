// =============================================================
// HITSTER ONLINE — ui.js
// Connects the HTML interface to the game logic in game.js.
// =============================================================

// --- UI state ---
let selectedPosition     = null; // slot the active player clicked (index into timeline gaps)
let activePosition       = null; // confirmed after Place Here is clicked (used in resolveRound)
let lastPlayedCard       = null; // stored for reveal display
let justWonCard          = null; // card that was just added to a timeline (gets glow animation)
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
// pendingPos: if not null, shows a face-down card at that slot index.
// stealPos:   if not null, shows a steal token marker at that slot index.
// interactive: if true, slots are clickable (used for active player's timeline).
// chosenPos:   slot index to keep highlighted (orange) after reveal on wrong placement
// stealerName: when set, steal marker uses this name (for post-reveal display after pendingSteal is cleared)
function renderTimelineInto(container, timeline, pendingPos, stealPos, interactive, chosenPos = null, stealerName = null) {
    container.innerHTML = '';

    for (let i = 0; i <= timeline.length; i++) {

        // ---- Slot ----
        const slot = document.createElement('div');

        // Face-down card sits in the slot itself — replace the slot visually
        if (i === pendingPos) {
            slot.className = `timeline-card timeline-card--facedown ${i === selectedPosition ? 'selected' : ''}`;
        } else if (i === stealPos) {
            // Steal token marker
            slot.className = 'steal-token-marker';
            slot.innerHTML = `✪<br>${stealerName ?? (game.pendingSteal ? game.players[game.pendingSteal.stealerIndex].name : '?')}`;
        } else if (interactive) {
            // Interactive slots: hoverable, clickable, highlight when selected
            slot.className = 'timeline-slot' + (i === selectedPosition ? ' selected' : '');
        } else {
            // Non-interactive slots: thin grey divider, no hover effects
            // Exception: chosenPos keeps the orange highlight to show a wrong placement
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
            // Add glow class if this is the card that was just won this turn
            const wonClass = (card === justWonCard) ? ' timeline-card--won' : '';
            cardEl.className = `timeline-card ${decadeClass(card.year)}${wonClass}`;
            cardEl.innerHTML = `<span class="card-year">${card.year}</span>
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

function showSongInfo(card) {
    el('song-title').textContent  = card.title;
    el('song-artist').textContent = card.artist;
    el('song-year').textContent   = card.year;
    el('song-info').classList.remove('hidden');
}

function updateTokenDisplay() {
    el('active-player-token-count').textContent = game.getCurrentPlayer().tokens;
    document.querySelectorAll('.player-token-count').forEach((span, i) => {
        if (game.players[i]) span.textContent = game.players[i].tokens;
    });
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

    // Reset all panels
    el('name-guess-form').classList.add('hidden');
    el('song-info').classList.add('hidden');
    el('next-turn-btn').classList.add('hidden');
    el('message-bar').classList.add('hidden');
    el('steal-panel').classList.add('hidden');
    el('stealer-timeline-section').classList.add('hidden');
    el('override-btn').classList.add('hidden');
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
        // Multiple co-winners — show each person's token count
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
        // Only increment rank when this player genuinely scored lower than the one above
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

    // Build slot list — same slots as active player's timeline, but skip the active player's chosen slot
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
// STEAL WIN VISUAL
// Briefly shows the stealer's timeline with the newly won card,
// then transitions to the next player's turn.
// =============================================================

function showStealerTimelineReveal(stealer, card) {
    const section = el('stealer-timeline-section');
    el('stealer-timeline-label').textContent = `🎉 ${stealer.name} steals the card!`;
    renderTimelineInto(el('stealer-timeline-container'), stealer.timeline, null, null, false);
    section.classList.remove('hidden');
    // Stay visible until the group is ready — next-turn-btn handles endTurn + beginTurn
    el('next-turn-btn').classList.remove('hidden');
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
el('submit-btn').addEventListener('click', () => {
    el('message-bar').classList.add('hidden'); // dismiss any previous message (e.g. "token placed")
    const artist = el('guess-artist').value.trim();
    const title  = el('guess-title').value.trim();

    // Name guess is optional — only pass it if the player filled in at least one field
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

    justWonCard    = result.activeCorrect ? result.card : null;
    activePosition = null; // clear so renderTimeline() no longer shows the ? face-down card

    // Show the revealed card info
    showSongInfo(lastPlayedCard);
    el('steal-btn').classList.add('hidden');
    el('steal-panel').classList.add('hidden');

    // If the player typed a guess, keep the form visible (read-only) so they can
    // compare what they typed against the revealed answer.
    // If no guess was attempted, just hide the form.
    if (nameGuess) {
        el('guess-artist').disabled = true;
        el('guess-title').disabled  = true;
        el('submit-btn').classList.add('hidden');
    } else {
        el('name-guess-form').classList.add('hidden');
    }

    updateTokenDisplay();
    // Render non-interactive; wrong placement keeps orange slot visible; wrong steal keeps steal marker
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

    // Handle steal outcome first (steal_wins returns early)
    if (result.stealResult) {
        const { outcome, stealer } = result.stealResult;

        if (outcome === 'steal_wins') {
            justWonCard = result.card; // override — card went to stealer's timeline, glow it there
            showStealerTimelineReveal(stealer, result.card);
            return; // showStealerTimelineReveal handles endTurn + beginTurn
        } else if (outcome === 'both_wrong') {
            showMessage(`Both positions were wrong — card discarded. ${stealer.name} loses their token.`, true);
        } else {
            // Active player's placement was correct, steal failed
            if (result.nameGuessCorrect) {
                showMessage(`Right placement ✅ Bonus token for artist & title! ✪ ${stealer.name}'s steal failed.`, true);
            } else if (nameGuess) {
                showMessage(`Right placement ✅ But artist & title not quite — good try! ${stealer.name}'s steal failed.`, true);
            } else {
                showMessage(`${game.getCurrentPlayer().name} was right! ✅ ${stealer.name}'s steal failed.`, true);
            }
        }
    } else if (!result.activeCorrect) {
        showMessage('Wrong position — card discarded. Better luck next turn!', true);
    } else {
        // No steal, placement correct
        if (result.nameGuessCorrect) {
            showMessage('Correct placement! ✅ Bonus token for artist & title! ✪', true);
        } else if (nameGuess) {
            showMessage('Right placement ✅ But artist & title not quite — good try!', true);
        } else {
            showMessage('Correct placement! ✅', true);
        }
    }

    // Show override button if a name guess was attempted but the automatic check said wrong
    // (lets the group correct a typo or a "close enough" answer)
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
    showMessage('Override accepted — bonus token awarded! ✪', true);
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
el('buy-btn').addEventListener('click', () => {
    if (game.getCurrentPlayer().tokens < 3) {
        showMessage("You don't have enough tokens. Gain them first to use this feature.", true);
        return;
    }
    const card = game.currentCard;
    const result = buyPlacement(game);
    if (result.success) {
        updateTokenDisplay();
        renderTimeline();
        renderAllPlayers();
        showSongInfo(card);
        el('place-btn').classList.add('hidden');
        el('skip-btn').classList.add('hidden');
        el('steal-btn').classList.add('hidden');
        el('buy-btn').classList.add('hidden');
        el('next-turn-btn').classList.remove('hidden');
        showMessage('Card automatically placed at the correct position! ✅', true);
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
