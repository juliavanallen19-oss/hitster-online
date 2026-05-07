// =============================================================
// HITSTER ONLINE — ui.js
// Connects the HTML interface to the game logic in game.js.
// =============================================================

// --- UI state ---
let selectedPosition = null; // which slot the active player clicked on their timeline
let lastPlayedCard   = null; // the card that was most recently played (needed for reveal)

// --- Shorthand helper ---
function el(id) { return document.getElementById(id); }


// =============================================================
// SCREEN MANAGEMENT (tasks 5.9, 5.6)
// Only the screen with class 'active' is visible (see style.css).
// =============================================================

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    el(id).classList.add('active');
}


// =============================================================
// FEEDBACK MESSAGE BAR (task 5.7)
// Shows a short message and auto-hides it after 3 seconds.
// =============================================================

let messageTimer = null;

function showMessage(text) {
    const bar = el('message-bar');
    bar.textContent = text;
    bar.classList.remove('hidden');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => bar.classList.add('hidden'), 3000);
}


// =============================================================
// SETUP SCREEN (tasks 5.1, 5.2, 5.3, 5.9)
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

// Keep the "who goes first?" dropdown in sync with the name inputs
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
    showScreen('game-screen');  // task 5.9
    beginTurn();
}


// =============================================================
// GAME BOARD RENDERING
// =============================================================

function renderPlayerHeader() {
    const player = game.getCurrentPlayer();
    el('active-player-name').textContent        = player.name;
    el('active-player-token-count').textContent = player.tokens;
}

// Returns the CSS class for a card based on its decade
function decadeClass(year) {
    if (year < 1970) return 'decade-60s';
    if (year < 1980) return 'decade-70s';
    if (year < 1990) return 'decade-80s';
    if (year < 2000) return 'decade-90s';
    if (year < 2010) return 'decade-00s';
    if (year < 2020) return 'decade-10s';
    return 'decade-20s';
}

// Renders the active player's timeline with clickable slots between each card
function renderTimeline() {
    const player    = game.getCurrentPlayer();
    const container = el('timeline-container');
    container.innerHTML = '';

    for (let i = 0; i <= player.timeline.length; i++) {
        // Slot (clickable gap where new card can go)
        const slot         = document.createElement('div');
        slot.className     = 'timeline-slot' + (i === selectedPosition ? ' selected' : '');
        slot.dataset.position = i;
        slot.addEventListener('click', () => onSlotClick(i));
        container.appendChild(slot);

        // Card to the right of this slot (if it exists)
        if (i < player.timeline.length) {
            const card   = player.timeline[i];
            const cardEl = document.createElement('div');
            cardEl.className = `timeline-card ${decadeClass(card.year)}`;
            cardEl.innerHTML = `
                <span class="card-year">${card.year}</span>
                <span class="card-title">${card.title}</span>
            `;
            container.appendChild(cardEl);
        }
    }
}

// Renders the all-players panel (names, tokens, card count)
function renderAllPlayers() {
    const list = el('players-list');
    list.innerHTML = '';
    game.players.forEach((player, i) => {
        const isActive   = i === game.currentPlayerIndex;
        const row        = document.createElement('div');
        row.className    = 'player-row' + (isActive ? ' active-turn' : '');
        row.innerHTML    = `
            <span class="player-row-name">${player.name}${isActive ? ' 🎵' : ''}</span>
            <span class="player-row-tokens"><span class="player-token-count">${player.tokens}</span> tokens</span>
            <span class="player-row-cards">${player.timeline.length} cards</span>
        `;
        list.appendChild(row);
    });
}

// Fills the #song-info area with the given card's details and shows it
function showSongInfo(card) {
    el('song-title').textContent  = card.title;
    el('song-artist').textContent = card.artist;
    el('song-year').textContent   = card.year;
    el('song-info').classList.remove('hidden');
}

// Task 4.6 — re-reads all token counts and updates every counter on screen
function updateTokenDisplay(game) {
    el('active-player-token-count').textContent = game.getCurrentPlayer().tokens;
    document.querySelectorAll('.player-token-count').forEach((span, i) => {
        if (game.players[i]) span.textContent = game.players[i].tokens;
    });
}


// =============================================================
// BUTTON STATES (tasks 5.4, 5.5)
// Greyed-out buttons are still clickable so we can show messages.
// =============================================================

function updateButtonStates() {
    const player = game.getCurrentPlayer();
    const hasSlot = selectedPosition !== null;

    setButtonEnabled(el('place-btn'),  hasSlot);
    setButtonEnabled(el('steal-btn'),  hasSlot);
    setButtonEnabled(el('skip-btn'),   player.tokens >= 1);
    setButtonEnabled(el('buy-btn'),    player.tokens >= 3);
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
    lastPlayedCard   = null;

    // Reset card area to its default state
    el('name-guess-form').classList.add('hidden');
    el('reveal-btn').classList.add('hidden');
    el('song-info').classList.add('hidden');
    el('next-turn-btn').classList.add('hidden');
    el('message-bar').classList.add('hidden');
    el('steal-panel').classList.add('hidden');
    el('guess-artist').value = '';
    el('guess-title').value  = '';

    // Show all action buttons
    el('place-btn').classList.remove('hidden');
    el('skip-btn').classList.remove('hidden');
    el('steal-btn').classList.remove('hidden');
    el('buy-btn').classList.remove('hidden');

    // Draw a card if none is in play
    if (!game.currentCard) {
        const card = drawCard(game);
        if (!card) {
            const winners = handleEmptyDeck(game);
            showWinScreen(winners);
            return;
        }
    }

    generateQRCode(game.currentCard.spotify_url);
    renderPlayerHeader();
    renderTimeline();
    renderAllPlayers();
    updateButtonStates();
}

// Called when the player clicks a slot in their timeline
function onSlotClick(position) {
    selectedPosition = position;
    renderTimeline();      // re-renders with the selected slot highlighted
    updateButtonStates();  // enables Place here and HITSTER! steal
}


// =============================================================
// WIN SCREEN (tasks 5.6, 5.11)
// =============================================================

function showWinScreen(winners) {
    // winners is either a single Player or an array (tiebreaker)
    const list  = Array.isArray(winners) ? winners : [winners];
    const names = list.map(p => p.name).join(' & ');
    el('winner-name').textContent = names;
    showScreen('win-screen');
}


// =============================================================
// HITSTER! STEAL PANEL
// Renders a two-step form: pick the stealing player, then pick a slot
// on their own timeline. Calls stealAttempt() on confirm.
// =============================================================

function renderStealPanel() {
    const panel      = el('steal-panel');
    const nonActive  = game.players
        .map((p, i) => ({ player: p, index: i }))
        .filter(({ index }) => index !== game.currentPlayerIndex);

    let html = '<p class="steal-label">Who wants to steal?</p>';
    nonActive.forEach(({ player, index }) => {
        html += `<button class="secondary-btn steal-player-btn" data-player-index="${index}">
                   ${player.name} — ${player.tokens} token${player.tokens !== 1 ? 's' : ''}
                 </button>`;
    });
    html += '<div id="steal-slots" class="steal-slots hidden"></div>';
    html += '<button id="cancel-steal-btn" class="secondary-btn">Cancel</button>';
    panel.innerHTML = html;

    panel.querySelectorAll('.steal-player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerIndex = parseInt(btn.dataset.playerIndex);
            if (game.players[playerIndex].tokens < 1) {
                showMessage(`${game.players[playerIndex].name} doesn't have enough tokens to steal.`);
                return;
            }
            renderStealSlots(playerIndex);
        });
    });

    el('cancel-steal-btn').addEventListener('click', () => {
        el('steal-panel').classList.add('hidden');
    });
}

function renderStealSlots(playerIndex) {
    const stealer   = game.players[playerIndex];
    const slotsDiv  = el('steal-slots');
    slotsDiv.classList.remove('hidden');

    let html = `<p class="steal-label">${stealer.name}, pick a position on your timeline:</p>
                <div class="steal-slot-buttons">`;

    for (let i = 0; i <= stealer.timeline.length; i++) {
        let label;
        if (stealer.timeline.length === 0) {
            label = 'Only position (empty timeline)';
        } else if (i === 0) {
            label = `Before ${stealer.timeline[0].year}`;
        } else if (i === stealer.timeline.length) {
            label = `After ${stealer.timeline[i - 1].year}`;
        } else {
            label = `Between ${stealer.timeline[i - 1].year} and ${stealer.timeline[i].year}`;
        }
        html += `<button class="secondary-btn steal-slot-btn"
                         data-position="${i}"
                         data-player="${playerIndex}">${label}</button>`;
    }
    html += '</div>';
    slotsDiv.innerHTML = html;

    slotsDiv.querySelectorAll('.steal-slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            resolveSteal(parseInt(btn.dataset.player), parseInt(btn.dataset.position));
        });
    });
}

function resolveSteal(stealerIndex, position) {
    const result = stealAttempt(game, stealerIndex, position);
    el('steal-panel').classList.add('hidden');
    updateTokenDisplay(game);
    renderAllPlayers();

    if (result.stealCorrect) {
        lastPlayedCard = result.card;
        showMessage(`${result.stealer.name} stole the card! 🎉`);
        showSongInfo(lastPlayedCard);
        el('place-btn').classList.add('hidden');
        el('skip-btn').classList.add('hidden');
        el('steal-btn').classList.add('hidden');
        el('buy-btn').classList.add('hidden');
        el('next-turn-btn').classList.remove('hidden');
    } else {
        showMessage(`Steal failed — ${result.stealer.name} loses a token. ${game.getCurrentPlayer().name} keeps their turn.`);
        updateButtonStates();
    }
}


// =============================================================
// EVENT LISTENERS
// =============================================================

// --- Place here ---
el('place-btn').addEventListener('click', () => {
    if (selectedPosition === null) {
        showMessage('First place your card on your timeline. Then hit this button again.');
        return;
    }
    lastPlayedCard = game.currentCard;
    const result   = placeCard(game, selectedPosition);
    renderTimeline();

    el('place-btn').classList.add('hidden');
    el('skip-btn').classList.add('hidden');
    el('steal-btn').classList.add('hidden');
    el('buy-btn').classList.add('hidden');

    if (result.placementCorrect) {
        el('name-guess-form').classList.remove('hidden');
    }
    el('reveal-btn').classList.remove('hidden');
});

// --- Reveal ---
el('reveal-btn').addEventListener('click', () => {
    showSongInfo(lastPlayedCard);
    el('reveal-btn').classList.add('hidden');
    el('next-turn-btn').classList.remove('hidden');
});

// --- Submit name guess ---
el('submit-guess-btn').addEventListener('click', () => {
    const artist = el('guess-artist').value.trim();
    const title  = el('guess-title').value.trim();
    if (!artist || !title) {
        showMessage('Enter both artist name and song title to guess.');
        return;
    }
    const result = attemptNameGuess(game, artist, title);
    if (result.nameGuessCorrect) {
        showMessage('Correct! You earned a token. 🎵');
    } else {
        showMessage('Not quite — but good try!');
    }
    updateTokenDisplay(game);
    renderAllPlayers();
    el('name-guess-form').classList.add('hidden');
});

// --- Next turn ---
el('next-turn-btn').addEventListener('click', () => {
    const result = endTurn(game);
    if (result.won) {
        showWinScreen(result.winner);  // tasks 5.6, 5.11
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
        updateTokenDisplay(game);
        renderAllPlayers();
        selectedPosition = null;
        if (result.card) {
            generateQRCode(result.card.spotify_url);
            renderTimeline();
            updateButtonStates();
        } else {
            showWinScreen(handleEmptyDeck(game));
        }
    }
});

// --- HITSTER! steal ---
el('steal-btn').addEventListener('click', () => {
    if (selectedPosition === null) {
        showMessage('First place your card on your timeline. Then hit this button again.');
        return;
    }
    renderStealPanel();
    el('steal-panel').classList.remove('hidden');
});

// --- Buy placement (task 5.8: auto-reveal after buy) ---
el('buy-btn').addEventListener('click', () => {
    if (game.getCurrentPlayer().tokens < 3) {
        showMessage("You don't have enough tokens. Gain them first to use this feature.");
        return;
    }
    lastPlayedCard = game.currentCard;
    const result   = buyPlacement(game);
    if (result.success) {
        updateTokenDisplay(game);
        renderTimeline();
        renderAllPlayers();
        showSongInfo(lastPlayedCard);  // task 5.8: auto-reveal
        el('place-btn').classList.add('hidden');
        el('skip-btn').classList.add('hidden');
        el('steal-btn').classList.add('hidden');
        el('buy-btn').classList.add('hidden');
        el('next-turn-btn').classList.remove('hidden');
    }
});

// --- Play Again (task 5.10) ---
el('play-again-btn').addEventListener('click', () => {
    game             = null;
    selectedPosition = null;
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
    showScreen('setup-screen');  // task 5.10
});


// =============================================================
// INITIALISE SETUP SCREEN ON PAGE LOAD
// =============================================================
initSetupScreen();
