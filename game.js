// =============================================================
// HITSTER ONLINE — game.js
// This file contains ALL the game logic.
// It has NO visuals — that's what index.html and style.css are for.
// Think of this file as the "brain" of the game.
// =============================================================


// =============================================================
// TASK 3.1 — Player class
// A Player is a blueprint for each person playing the game.
// Each player has: a name, a timeline (their cards in order), and tokens.
// =============================================================

class Player {
    // __init__ in Python = constructor() in JavaScript — same idea.
    // This runs when we create a new Player object.
    constructor(name) {
        this.name = name;           // The player's name (e.g. "Julia")
        this.timeline = [];         // Starts empty — cards get added as they win them
        this.tokens = 0;            // Will be set by the Game based on mode
    }
}


// =============================================================
// TASK 3.2 — Game class
// The Game holds everything: the list of players, the song deck,
// and which player's turn it is right now.
// =============================================================

class Game {
    // playerNames  — array like ["Julia", "Ana", "Pedro"]
    // songs        — full list of songs (loaded from songs.json later)
    // mode         — "original", "pro", "expert", or "cooperative"
    // startingPlayerIndex — which player goes first (0 = first in list)
    constructor(playerNames, songs, mode = "original", startingPlayerIndex = 0, winTarget = 10) {

        this.mode = mode;
        this.winTarget = winTarget;

        // --- Set starting tokens based on mode (CHANGE #1) ---
        // Original = 2 tokens (so players can steal from turn 1)
        // Pro = 5, Expert = 3, Cooperative = 3 (shared, but stored per-player for now)
        let startingTokens = 2; // default for Original mode
        if (mode === "chill") startingTokens = 3;
        if (mode === "pro") startingTokens = 5;
        if (mode === "expert") startingTokens = 3;
        if (mode === "cooperative") startingTokens = 3;
        if (mode === "quickfire") startingTokens = 3;

        // Create a Player object for each name, with the right starting tokens
        this.players = playerNames.map(name => {
            let p = new Player(name);
            p.tokens = startingTokens;
            return p;
        });

        // Shuffle the songs and store the result as the deck
        this.deck = shuffleDeck(songs);

        // --- CHANGE #4: Deal one starter card to each player ---
        // In real Hitster, every player begins with one card on their
        // timeline as a reference point. We do the same here.
        for (let player of this.players) {
            if (this.deck.length > 0) {
                let starterCard = this.deck.shift();
                player.timeline.push(starterCard);
            }
        }

        // The card currently being placed (none until first turn starts)
        this.currentCard = null;

        // Whose turn it is, set by the players in setup
        this.currentPlayerIndex = startingPlayerIndex;
        this.startingPlayerIndex = startingPlayerIndex;

        // Pending steal attempt for the current turn (null if no steal)
        this.pendingSteal = null;

        // Final round: becomes true once the win target is first reached.
        // Remaining players in the current round each get one more turn.
        this.finalRound = false;
    }

    // Helper to get the Player object whose turn it is right now
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }
}


// =============================================================
// PLACEHOLDER SONGS (Task 2.7)
// Used so we can test Phase 3 BEFORE the real songs.json is ready.
// Will be replaced by loading from songs.json once that's ready (task 2.8).
// =============================================================

const PLACEHOLDER_SONGS = [
    { title: "Bohemian Rhapsody",       artist: "Queen",            year: 1975, spotify_url: "https://open.spotify.com/track/3z8h0TU7ReDPLIbEnYhWZb" },
    { title: "Billie Jean",             artist: "Michael Jackson",  year: 1983, spotify_url: "https://open.spotify.com/track/5ChkMS8OtdzJeqyybCc9R5" },
    { title: "Shape of You",            artist: "Ed Sheeran",       year: 2017, spotify_url: "https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3" },
    { title: "Rolling in the Deep",     artist: "Adele",            year: 2010, spotify_url: "https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh" },
    { title: "Smells Like Teen Spirit", artist: "Nirvana",          year: 1991, spotify_url: "https://open.spotify.com/track/5ghIJDpPoe3CfHMGu71E6T" },
    { title: "Baby One More Time",      artist: "Britney Spears",   year: 1998, spotify_url: "https://open.spotify.com/track/3MjUtNVVq3C8Fn0MP3zhXa" },
    { title: "Blinding Lights",         artist: "The Weeknd",       year: 2019, spotify_url: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b" },
    { title: "Like a Prayer",           artist: "Madonna",          year: 1989, spotify_url: "https://open.spotify.com/track/1z3ugFmUKoCzGsI6HrOpQM" },
    { title: "Mr. Brightside",          artist: "The Killers",      year: 2003, spotify_url: "https://open.spotify.com/track/003vvx7Niy0yvhvHt4a14Y" },
    { title: "Bad Guy",                 artist: "Billie Eilish",    year: 2019, spotify_url: "https://open.spotify.com/track/2Fxmhks0bxGSBdJ92vM42m" },
];


// =============================================================
// TASK 3.3 — Shuffle the deck (Fisher-Yates algorithm)
// Returns the songs in a random order.
// =============================================================

function shuffleDeck(songs) {
    // Make a copy so we don't change the original list
    // (`...` is the "spread operator" — it creates a fresh independent array)
    let deck = [...songs];

    // Walk from the last card to the first.
    // Swap each card with a random earlier card.
    // After one pass, every card is in a random position.
    for (let i = deck.length - 1; i > 0; i--) {
        let randomIndex = Math.floor(Math.random() * (i + 1));
        let temp = deck[i];
        deck[i] = deck[randomIndex];
        deck[randomIndex] = temp;
    }

    return deck;
}


// =============================================================
// TASK 3.4 — Draw the next card from the deck
// Removes the top card so it can never be drawn again.
// Returns null if the deck is empty.
// =============================================================

function drawCard(game) {
    if (game.deck.length === 0) {
        return null; // Deck is empty (Task 3.15 handles this)
    }

    // .shift() REMOVES and returns the first item.
    // The deck permanently shrinks by 1 — no song ever repeats.
    let card = game.deck.shift();
    game.currentCard = card;
    return card;
}


// =============================================================
// TASK 3.5 — Generate QR code from Spotify URL
// Uses the qrcode.js library (loaded via <script> tag in index.html).
// Requires an HTML element with id="qr-container" to exist.
// (Reminder: build that element in Phase 1!)
// =============================================================

function generateQRCode(spotifyUrl) {
    let container = document.getElementById("qr-container");
    container.innerHTML = ""; // Clear previous QR code
    new QRCode(container, {
        text: spotifyUrl,
        width: 200,
        height: 200,
    });
}


// =============================================================
// TASK 3.6 — Check if a card is placed in the correct position
//
// Timeline is sorted oldest → newest (left to right).
// Same-year cards can go in any order (handled by < and > being strict).
// =============================================================

function isPlacementCorrect(timeline, newCard, position) {
    let cardYear = newCard.year;

    // Check the card to the LEFT (if any)
    if (position > 0) {
        let leftCard = timeline[position - 1];
        if (cardYear < leftCard.year) return false; // Too old for this spot
    }

    // Check the card to the RIGHT (if any)
    if (position < timeline.length) {
        let rightCard = timeline[position];
        if (cardYear > rightCard.year) return false; // Too recent for this spot
    }

    return true;
}


// =============================================================
// TASK 3.7 — Insert a card into the player's timeline
// Only call this AFTER isPlacementCorrect() returns true.
// =============================================================

function insertCardIntoTimeline(player, card, position) {
    player.timeline.splice(position, 0, card);
}


// =============================================================
// TASK 3.8 — Discard a card (wrong placement)
// =============================================================

function discardCard(game) {
    game.currentCard = null;
}


// =============================================================
// TASK 3.9 — Check artist + song name guess (case-insensitive)
// Returns true only if BOTH artist AND title are correct.
// =============================================================

function checkNameGuess(card, guessedArtist, guessedTitle) {
    // Accept the main artist alone (before " ft.") or the full artist string
    const fullArtist  = card.artist.toLowerCase().trim();
    const mainArtist  = fullArtist.split(' ft.')[0].trim();
    const guessArtist = guessedArtist.toLowerCase().trim();
    let artistCorrect = guessArtist === mainArtist || guessArtist === fullArtist;
    let titleCorrect  = card.title.toLowerCase().trim() === guessedTitle.toLowerCase().trim();
    return artistCorrect && titleCorrect;
}


// =============================================================
// CHILL MODE — relaxed name-guess check: either field alone is enough
// =============================================================

function checkNameGuessChill(card, guessedArtist, guessedTitle) {
    // An empty field counts as "not attempted", not as a wrong answer
    const ga = guessedArtist.trim();
    const gt = guessedTitle.trim();
    // Accept the main artist alone (before " ft.") or the full artist string
    const fullArtist = card.artist.toLowerCase();
    const mainArtist = fullArtist.split(' ft.')[0].trim();
    const artistCorrect = ga !== '' && (ga.toLowerCase() === mainArtist || ga.toLowerCase() === fullArtist);
    const titleCorrect  = gt !== '' && card.title.toLowerCase() === gt.toLowerCase();
    // Returns an object so the UI can tell the player exactly which field was right
    return { correct: artistCorrect || titleCorrect, artistCorrect, titleCorrect };
}


// =============================================================
// Helper — find the correct chronological position for a card
// in a given timeline (same logic as buyPlacement).
// =============================================================

function findCorrectPosition(timeline, card) {
    let pos = 0;
    while (pos < timeline.length && timeline[pos].year <= card.year) pos++;
    return pos;
}


// =============================================================
// TASK 3.10 — Earn a token (capped at 5)
// =============================================================

function earnToken(player) {
    if (player.tokens < 5) {
        player.tokens += 1;
        return true;  // token was actually added
    }
    return false;     // already at cap — token was NOT added
}


// =============================================================
// TASK 3.11 — "Mark as correct anyway" override
// Any non-active player can grant the active player a token
// even if their typed answer was technically wrong (typo, etc.).
// =============================================================

function overrideAndGrantToken(game) {
    let activePlayer = game.getCurrentPlayer();
    earnToken(activePlayer);
}


// =============================================================
// TASK 3.12 — Advance to the next player's turn
// The % (modulo) operator wraps from last player back to first.
// Example with 3 players: 0 → 1 → 2 → 0 → 1 → 2 → ...
// =============================================================

function nextTurn(game) {
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    game.currentCard = null;
}


// =============================================================
// TASK 3.13 — Check if someone has won (10 cards in timeline)
// Returns the winning Player, or null if nobody has won yet.
// =============================================================

function checkWinCondition(game) {
    for (let player of game.players) {
        if (player.timeline.length >= game.winTarget) {
            return player;
        }
    }
    return null;
}


// =============================================================
// TASK 3.14 — Turn flow
//
// In the real game, the order is:
//   1. Player listens to the song (QR code already shown)
//   2. Player chooses a position on their timeline
//   3. (Optional) Player attempts to name artist + title for a bonus token
//   4. Reveal whether the placement is correct
//   5. If applicable, reveal wether name artist + title are correct for a bonus token
//   6. Move to next player
//
// The UI resolves placement, name guesses, and challenges together in resolveTurn().
// =============================================================

// End the turn. Always called at the end.
// Handles the final round: when the win target is first hit, the remaining
// players in the current round each get one more turn before the game ends.
function endTurn(game) {
    const winner = checkWinCondition(game);

    if (!game.finalRound && winner) {
        const n = game.players.length;
        const remaining = (game.startingPlayerIndex - game.currentPlayerIndex - 1 + n) % n;
        if (remaining === 0) {
            // This player was last in the round — game ends immediately
            return { won: true, winner: resolveWinners(game) };
        }
        // Others still need to play — start the final round
        game.finalRound = true;
        nextTurn(game);
        return { won: false, finalRoundStarted: true };
    }

    nextTurn(game);

    if (game.finalRound && game.currentPlayerIndex === game.startingPlayerIndex) {
        // Everyone has played — pick the winner
        return { won: true, winner: resolveWinners(game) };
    }

    return { won: false };
}

// Picks the winner(s) at the end of the final round.
// Among players who reached the win target: most cards wins; ties broken by tokens.
function resolveWinners(game) {
    const qualifiers = game.players.filter(p => p.timeline.length >= game.winTarget);
    if (qualifiers.length === 0) return handleEmptyDeck(game);
    const maxCards = Math.max(...qualifiers.map(p => p.timeline.length));
    const leaders = qualifiers.filter(p => p.timeline.length === maxCards);
    if (leaders.length === 1) return leaders[0];
    const maxTokens = Math.max(...leaders.map(p => p.tokens));
    const tokenLeaders = leaders.filter(p => p.tokens === maxTokens);
    return tokenLeaders.length === 1 ? tokenLeaders[0] : tokenLeaders;
}


// =============================================================
// TASK 3.15 — Handle empty deck
//
// Tiebreaker rules:
//   1. Most cards in timeline wins.
//   2. If tied on cards → most tokens wins.
//   3. If still tied → all tied players share the win.
//
// Returns an array of winner(s).
// =============================================================

function handleEmptyDeck(game) {
    // Step 1: find the highest card count
    let maxCards = 0;
    for (let player of game.players) {
        if (player.timeline.length > maxCards) {
            maxCards = player.timeline.length;
        }
    }

    // Step 2: keep only players who have that highest count
    let cardLeaders = game.players.filter(p => p.timeline.length === maxCards);

    // Step 3: if only one — they win outright
    if (cardLeaders.length === 1) {
        return cardLeaders;
    }

    // Step 4: tied on cards — break tie by tokens
    let maxTokens = 0;
    for (let player of cardLeaders) {
        if (player.tokens > maxTokens) {
            maxTokens = player.tokens;
        }
    }

    let finalWinners = cardLeaders.filter(p => p.tokens === maxTokens);

    // If still tied, all tied players share the win
    return finalWinners;
}


// =============================================================
// TASK 4.1 — Skip card (costs 1 token)
// Discards the current card and draws the next one from the deck.
// =============================================================

function skipCard(game) {
    let player = game.getCurrentPlayer();
    if (player.tokens < 1) return { success: false, card: null };
    player.tokens -= 1;
    discardCard(game);
    let nextCard = drawCard(game);
    return { success: true, card: nextCard };
}


// =============================================================
// TASK 4.4 — Buy a placement (costs 3 tokens)
// The game automatically finds the correct chronological position
// and inserts the card there. No manual placement or year check needed.
// =============================================================

function buyPlacement(game) {
    let player = game.getCurrentPlayer();
    if (player.tokens < 3) return { success: false, position: null };
    player.tokens -= 3;
    let card = game.currentCard;

    // Walk the timeline left to right to find where the card's year fits.
    // Insert just before the first card that is newer than this one.
    let position = 0;
    while (position < player.timeline.length && player.timeline[position].year <= card.year) {
        position++;
    }

    insertCardIntoTimeline(player, card, position);
    game.currentCard = null;
    return { success: true, position };
}


// =============================================================
// HITSTER! steal — challenger version
// A non-active player pays 1 token to challenge the active player
// by picking a DIFFERENT slot on the active player's own timeline.
// Resolution happens later in resolveTurn().
// Only one steal attempt allowed per turn.
// =============================================================

function initiateSteal(game, stealerIndex, stealPosition, stealNameGuess = null) {
    let stealer = game.players[stealerIndex];
    if (stealer.tokens < 1) return { success: false };
    if (game.pendingSteal !== null) return { success: false }; // already one steal this turn
    stealer.tokens -= 1;
    game.pendingSteal = { stealerIndex, stealPosition, stealNameGuess };
    return { success: true, stealer };
}


// =============================================================
// resolveTurn — called when the active player clicks Submit
//
// Evaluates the active placement, any steal, and the name guess
// all at once (since Submit triggers the reveal).
//
// activePosition — where the active player placed the card
// nameGuess      — { artist, title } or null if skipped
//
// Returns a full result object for the UI to display.
// =============================================================

function resolveTurn(game, activePosition, nameGuess) {
    let activePlayer = game.getCurrentPlayer();
    let card         = game.currentCard;
    let mode         = game.mode;

    // Did the active player place the card in the right position?
    let activeCorrect = isPlacementCorrect(activePlayer.timeline, card, activePosition);

    // Name guess — evaluated regardless of placement correctness (fix for original rules)
    let nameGuessCorrect = false;
    let nameGuessDetail  = null;   // { artistCorrect, titleCorrect } — Chill mode only
    let tokenEarned      = false;  // true only when a token was actually added (not capped)
    if (nameGuess) {
        if (mode === "chill") {
            const chillResult = checkNameGuessChill(card, nameGuess.artist, nameGuess.title);
            nameGuessCorrect = chillResult.correct;
            nameGuessDetail  = chillResult;
        } else {
            nameGuessCorrect = checkNameGuess(card, nameGuess.artist, nameGuess.title);
        }
        // Original & Chill: correct name = bonus token (not in PRO — naming is mandatory there)
        if (mode !== "pro" && nameGuessCorrect) {
            tokenEarned = earnToken(activePlayer);
        }
    }

    // Does the active player actually keep the card?
    // Original/Chill: position correct is enough.
    // PRO: position AND name must both be correct.
    let activeKeepsCard = mode === "pro" ? (activeCorrect && nameGuessCorrect) : activeCorrect;

    let stealResult = null;

    if (game.pendingSteal !== null) {
        let { stealerIndex, stealPosition, stealNameGuess } = game.pendingSteal;
        let stealer      = game.players[stealerIndex];
        let stealCorrect = isPlacementCorrect(activePlayer.timeline, card, stealPosition);

        // PRO: stealer must also name correctly; Original/Chill: position alone is enough
        let stealNameCorrect = false;
        if (mode === "pro" && stealNameGuess) {
            stealNameCorrect = checkNameGuess(card, stealNameGuess.artist, stealNameGuess.title);
        }
        let stealerKeepsCard = mode === "pro" ? (stealCorrect && stealNameCorrect) : stealCorrect;

        if (activeKeepsCard) {
            // Active player wins — their card, their win
            insertCardIntoTimeline(activePlayer, card, activePosition);
            stealResult = { outcome: 'active_wins', stealer };
        } else if (stealerKeepsCard) {
            // Stealer wins — card auto-placed on the stealer's own timeline
            // PRO: token returned to stealer (earning-a-steal is the reward itself)
            if (mode === "pro") stealer.tokens += 1;
            let correctPos = findCorrectPosition(stealer.timeline, card);
            insertCardIntoTimeline(stealer, card, correctPos);
            stealResult = { outcome: 'steal_wins', stealer, card };
        } else {
            // Both fail — card discarded, stealer already lost their token
            stealResult = { outcome: 'both_wrong', stealer, activeCorrect, stealPositionCorrect: stealCorrect };
        }
        game.pendingSteal = null;

    } else {
        // No steal — normal flow
        if (activeKeepsCard) {
            insertCardIntoTimeline(activePlayer, card, activePosition);
        }
    }

    game.currentCard = null;
    return { activeCorrect, activeKeepsCard, nameGuessCorrect, nameGuessDetail, tokenEarned, stealResult, card };
}


// =============================================================
// START THE GAME — called by the UI when the player clicks "Start"
// =============================================================

let game = null; // Global — holds the active game

function startGame(playerNames, mode = "original", startingPlayerIndex = 0, winTarget = 10) {
    if (playerNames.length < 2) {
        alert("You need at least 2 players to start!");
        return;
    }

    game = new Game(playerNames, SONGS, mode, startingPlayerIndex, winTarget);
    // ui.js beginTurn() draws the first card and generates the QR code
}
