// =============================================================
// HITSTER ONLINE — ui.js
// This file connects the user interface (HTML) to the game logic (game.js).
// =============================================================

console.log("ui.js loaded successfully");


// =============================================================
// TASK 4.6 — Update token counter display
// Called after any action that changes a player's token count.
// =============================================================

function updateTokenDisplay(game) {
    document.getElementById('active-player-token-count').textContent =
        game.getCurrentPlayer().tokens;

    const rows = document.querySelectorAll('.player-token-count');
    rows.forEach((el, i) => {
        if (game.players[i]) el.textContent = game.players[i].tokens;
    });
}


// =============================================================
// TASK 4.1 — Skip button
// Fully wired: spends 1 token, draws next card, updates QR + display.
// =============================================================

document.getElementById('skip-btn').addEventListener('click', () => {
    if (!game) return;
    let result = skipCard(game);
    if (result.success) {
        updateTokenDisplay(game);
        if (result.card) {
            generateQRCode(result.card.spotify_url);
        } else {
            alert('Deck is empty!');
        }
    } else {
        alert('Not enough tokens to skip! You need at least 1.');
    }
});


// =============================================================
// TASKS 4.2 + 4.3 — Steal button (stub)
// Full implementation in Phase 5 (needs player-selection UI).
// =============================================================

document.getElementById('steal-btn').addEventListener('click', () => {
    if (!game) return;
    console.log('Steal button clicked — will be wired in Phase 5');
});


// =============================================================
// TASK 4.4 — Buy placement button (stub)
// Full implementation in Phase 5 (needs position-picker UI).
// =============================================================

document.getElementById('buy-btn').addEventListener('click', () => {
    if (!game) return;
    console.log('Buy placement button clicked — will be wired in Phase 5');
});
