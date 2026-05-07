// =============================================================
// HITSTER ONLINE — ui.js
// Connects the HTML interface to the game logic in game.js.
// =============================================================

// --- UI state ---
let selectedPosition = null; // slot the active player clicked (index into timeline gaps)
let activePosition   = null; // confirmed after Place Here is clicked (used in resolveRound)
let lastPlayedCard   = null; // stored for reveal display

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
// =============================================================

let messageTimer = null;

function showMessage(text) {
    const bar = el('message-bar');
    bar.textContent = text;
    bar.classList.remove('hidden');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => bar.classList.add('hidden'), 3500);
}


// =============================================================
// SETUP SCREEN
// =============================================================

function initSetupScreen() {
    el('add-player-btn').addEventListener('click', addPlayerInput);
    el('player-inputs').addEventListener('input', updateStartingPlayerDropdown);
    el('start-game-btn').addEventListener('click', onStartGame);
    updateStartingPlayerDropdown();
}

function addPlayerInput() {
    const rows = document.querySelectorAll('.player-input-row');
    if (rows.length >= 6) {
        showMessage('Maximum 6 players reached.');
        return;
    }
    const row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML = `<input type="text" class="player-name-input" placeholder="Player ${rows.length + 1} name" maxlength="20">`;
    el('player-inputs').appendChild(row);
    updateStartingPlayerDropdown();
}

function updateStartingPlayerDropdown() {
    const inputs  = document.querySelectorAll('.player-name-input');
    const select  = el('starting-player-select');
    const current = select.value;
    select.innerHTML = '';
    inputs.forEach((input, i) => {
        const opt       = document.createElement('option');
        opt.value       = i;
        opt.textContent = input.value.trim() || `Player ${i + 1}`;
        select.appendChild(opt);
    });
    if (current && current < inputs.length) select.value = current;
}

function onStartGame() {
    const inputs = document.querySelectorAll('.player-name-input');
    const names  = Array.from(inputs).map(i => i.value.trim()).filter(n => n.length > 0);
    if (names.length < 2) {
        showMessage('Please enter at least 2 player names.');
        return;
    }
    const startingIndex = parseInt(el('starting-player-select').value) || 0;
    const mode          = el('mode-select').value;
    startGame(names, mode, startingIndex);
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
function renderTimelineInto(container, timeline, pendingPos, stealPos, interactive) {
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
            slot.innerHTML = `🎵<br>${game.players[game.pendingSteal ? game.pendingSteal.stealerIndex : 0].name}`;
        } else {
            slot.className = 'timeline-slot' + (i === selectedPosition ? ' selected' : '');
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
            cardEl.className = `timeline-card ${decadeClass(card.year)}`;
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
            <span class="player-row-name">${player.name}${isActive ? ' 🎵' : ''}</span>
            <span class="player-row-tokens"><span class="player-token-count">${player.tokens}</span> tokens</span>
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
    setButtonEnabled(el('place-btn'),  hasSlot && !placed);
    setButtonEnabled(el('steal-btn'),  placed && game.pendingSteal === null);
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
    selectedPosition = null;
    activePosition   = null;
    lastPlayedCard   = null;

    // Reset all panels
    el('name-guess-form').classList.add('hidden');
    el('song-info').classList.add('hidden');
    el('next-turn-btn').classList.add('hidden');
    el('message-bar').classList.add('hidden');
    el('steal-panel').classList.add('hidden');
    el('stealer-timeline-section').classList.add('hidden');
    el('guess-artist').value = '';
    el('guess-title').value  = '';

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
            showWinScreen(handleEmptyDeck(game));
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

// Player clicks a slot in the timeline
function onSlotClick(position) {
    if (activePosition !== null) return; // already placed — steal slots handled separately
    selectedPosition = position;
    renderTimeline();
    updateButtonStates();
}


// =============================================================
// WIN SCREEN
// =============================================================

function showWinScreen(winners) {
    const list  = Array.isArray(winners) ? winners : [winners];
    const names = list.map(p => p.name).join(' & ');
    el('winner-name').textContent = names;
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
        .filter(({ index }) => index !== game.currentPlayerIndex);

    let html = '<p class="steal-label">Who wants to challenge? (costs 1 🎵 token)</p>';
    nonActive.forEach(({ player, index }) => {
        const canSteal = player.tokens >= 1;
        html += `<button class="secondary-btn steal-player-btn${canSteal ? '' : ' btn-disabled'}"
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

    // Build slot list — same slots as active player's timeline, but skip the active player's chosen slot
    let html = `<p class="steal-label">${stealer.name}: pick a DIFFERENT position on ${game.getCurrentPlayer().name}'s timeline</p>
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
        el('steal-panel').classList.add('hidden');
        game.pendingSteal = null;
        renderTimeline();
        updateButtonStates();
    });
}

function confirmSteal(stealerIndex, stealPosition) {
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
    showMessage(`${result.stealer.name} has placed their token! Click "Submit & reveal" when ready.`);
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

    // Hide after 2.5 seconds, then proceed to next turn
    setTimeout(() => {
        section.classList.add('hidden');
        const turnResult = endTurn(game);
        if (turnResult.won) {
            showWinScreen(turnResult.winner);
        } else {
            beginTurn();
        }
    }, 2500);
}


// =============================================================
// EVENT LISTENERS
// =============================================================

// --- Place Here ---
el('place-btn').addEventListener('click', () => {
    if (selectedPosition === null) {
        showMessage('First tap a slot in your timeline, then hit "Place here".');
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
    if (activePosition === null) {
        showMessage('The active player must place their card first.');
        return;
    }
    if (game.pendingSteal !== null) {
        showMessage('Only one steal per turn is allowed.');
        return;
    }
    renderStealPanel();
    el('steal-panel').classList.remove('hidden');
});

// --- Submit & reveal ---
el('submit-btn').addEventListener('click', () => {
    const artist = el('guess-artist').value.trim();
    const title  = el('guess-title').value.trim();

    // Name guess is optional — only pass it if the player filled in at least one field
    const nameGuess = (artist || title) ? { artist, title } : null;
    if (nameGuess && (!artist || !title)) {
        showMessage('Fill in BOTH artist name and song title, or leave both empty to skip the guess.');
        return;
    }

    const result = resolveRound(game, activePosition, nameGuess);
    lastPlayedCard = result.card;

    // Show the revealed card info
    showSongInfo(lastPlayedCard);
    el('name-guess-form').classList.add('hidden');
    el('steal-btn').classList.add('hidden');
    el('steal-panel').classList.add('hidden');

    // Show feedback
    if (result.nameGuessCorrect) {
        showMessage('Correct artist & title! Bonus token earned. 🎵');
    } else if (nameGuess) {
        showMessage('Not quite on the name — better luck next time!');
    }

    updateTokenDisplay();
    renderTimeline();
    renderAllPlayers();

    // Handle steal outcome
    if (result.stealResult) {
        const { outcome, stealer } = result.stealResult;

        if (outcome === 'steal_wins') {
            // Stealer gets the card — show their timeline briefly, then next turn
            showStealerTimelineReveal(stealer, result.card);
            return; // showStealerTimelineReveal handles endTurn + beginTurn
        } else if (outcome === 'both_wrong') {
            showMessage(`Both positions were wrong — card discarded. ${stealer.name} loses their token.`);
        } else {
            showMessage(`${game.getCurrentPlayer().name} was right! ${stealer.name}'s token is lost.`);
        }
    } else if (!result.activeCorrect) {
        showMessage('Wrong position — card discarded. Better luck next turn!');
    } else {
        showMessage('Correct placement! ✅');
    }

    el('next-turn-btn').classList.remove('hidden');
});

// --- Next turn ---
el('next-turn-btn').addEventListener('click', () => {
    const result = endTurn(game);
    if (result.won) {
        showWinScreen(result.winner);
    } else {
        beginTurn();
    }
});

// --- Skip card ---
el('skip-btn').addEventListener('click', () => {
    if (game.getCurrentPlayer().tokens < 1) {
        showMessage("You don't have enough tokens. Gain them first to use this feature.");
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
        } else {
            showWinScreen(handleEmptyDeck(game));
        }
    }
});

// --- Buy placement ---
el('buy-btn').addEventListener('click', () => {
    if (game.getCurrentPlayer().tokens < 3) {
        showMessage("You don't have enough tokens. Gain them first to use this feature.");
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
        showMessage('Card automatically placed at the correct position! ✅');
    }
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
        </div>
        <div class="player-input-row">
            <input type="text" class="player-name-input" placeholder="Player 2 name" maxlength="20">
        </div>
    `;
    updateStartingPlayerDropdown();
    showScreen('setup-screen');
});


// =============================================================
// INITIALISE ON PAGE LOAD
// =============================================================
initSetupScreen();
