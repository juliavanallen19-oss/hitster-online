class Player {
    constructor(name) {
        this.name = name;
        this.timeline = [];
        this.tokens = 0;
        this.stats = createPlayerStats();
    }
}

function createPlayerStats() {
    return {
        turnsPlayed: 0,
        placementAttempts: 0,
        correctPlacements: 0,
        nameGuesses: 0,
        correctNameGuesses: 0,
        tokensEarned: 0,
        tokensSpent: 0,
        cardsWon: 0,
        currentStreak: 0,
        bestStreak: 0,
        skipsUsed: 0,
        buyPlacementsUsed: 0,
        challengesStarted: 0,
        challengesWon: 0,
        challengesLost: 0,
        biggestMiss: null,
    };
}


class Game {
    constructor(playerNames, songs, mode = "original", startingPlayerIndex = 0, winTarget = 10) {

        this.mode = mode;
        this.winTarget = winTarget;

        let startingTokens = 2;
        if (mode === "chill") startingTokens = 3;
        if (mode === "pro") startingTokens = 5;
        if (mode === "expert") startingTokens = 3;
        if (mode === "cooperative") startingTokens = 3;
        if (mode === "quickfire") startingTokens = 3;

        this.players = playerNames.map(name => {
            let p = new Player(name);
            p.tokens = startingTokens;
            return p;
        });

        this.deck = shuffleDeck(songs);

        for (let player of this.players) {
            if (this.deck.length > 0) {
                let starterCard = this.deck.shift();
                player.timeline.push(starterCard);
            }
        }

        this.currentCard = null;

        this.currentPlayerIndex = startingPlayerIndex;
        this.startingPlayerIndex = startingPlayerIndex;

        this.pendingSteal = null;

        this.finalRound = false;
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }
}


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


function shuffleDeck(songs) {
    let deck = [...songs];

    for (let i = deck.length - 1; i > 0; i--) {
        let randomIndex = Math.floor(Math.random() * (i + 1));
        let temp = deck[i];
        deck[i] = deck[randomIndex];
        deck[randomIndex] = temp;
    }

    return deck;
}


function drawCard(game) {
    if (game.deck.length === 0) {
        return null;
    }

    let card = game.deck.shift();
    game.currentCard = card;
    return card;
}


function generateQRCode(spotifyUrl) {
    let container = document.getElementById("qr-container");
    container.innerHTML = "";
    new QRCode(container, {
        text: spotifyUrl,
        width: 200,
        height: 200,
    });
}


function isPlacementCorrect(timeline, newCard, position) {
    let cardYear = newCard.year;

    if (position > 0) {
        let leftCard = timeline[position - 1];
        if (cardYear < leftCard.year) return false;
    }

    if (position < timeline.length) {
        let rightCard = timeline[position];
        if (cardYear > rightCard.year) return false;
    }

    return true;
}


function insertCardIntoTimeline(player, card, position) {
    player.timeline.splice(position, 0, card);
}


function discardCard(game) {
    game.currentCard = null;
}


function checkNameGuess(card, guessedArtist, guessedTitle) {
    const fullArtist  = card.artist.toLowerCase().trim();
    const mainArtist  = fullArtist.split(' ft.')[0].trim();
    const guessArtist = guessedArtist.toLowerCase().trim();
    let artistCorrect = guessArtist === mainArtist || guessArtist === fullArtist;
    let titleCorrect  = card.title.toLowerCase().trim() === guessedTitle.toLowerCase().trim();
    return artistCorrect && titleCorrect;
}


function checkNameGuessChill(card, guessedArtist, guessedTitle) {
    const ga = guessedArtist.trim();
    const gt = guessedTitle.trim();
    const fullArtist = card.artist.toLowerCase();
    const mainArtist = fullArtist.split(' ft.')[0].trim();
    const artistCorrect = ga !== '' && (ga.toLowerCase() === mainArtist || ga.toLowerCase() === fullArtist);
    const titleCorrect  = gt !== '' && card.title.toLowerCase() === gt.toLowerCase();
    return { correct: artistCorrect || titleCorrect, artistCorrect, titleCorrect };
}


function findCorrectPosition(timeline, card) {
    let pos = 0;
    while (pos < timeline.length && timeline[pos].year <= card.year) pos++;
    return pos;
}


function earnToken(player) {
    if (player.tokens < 5) {
        player.tokens += 1;
        player.stats.tokensEarned += 1;
        return true;
    }
    return false;
}

function spendTokens(player, amount) {
    player.tokens -= amount;
    player.stats.tokensSpent += amount;
}

function refundToken(player) {
    const added = player.tokens < 5;
    if (added) {
        player.tokens += 1;
    }
    if (player.stats.tokensSpent > 0) {
        player.stats.tokensSpent -= 1;
    }
    return added;
}

function recordCardWon(player) {
    player.stats.cardsWon += 1;
    player.stats.currentStreak += 1;
    if (player.stats.currentStreak > player.stats.bestStreak) {
        player.stats.bestStreak = player.stats.currentStreak;
    }
}

function recordManualCardAward(player) {
    recordCardWon(player);
}

function recordChallengeOverrideWin(player) {
    if (player.stats.challengesLost > 0) {
        player.stats.challengesLost -= 1;
    }
    player.stats.challengesWon += 1;
    recordCardWon(player);
}

function recordPlacementAttempt(player, card, chosenPosition, correct) {
    player.stats.placementAttempts += 1;
    if (correct) {
        player.stats.correctPlacements += 1;
        return;
    }

    player.stats.currentStreak = 0;
    const correctPosition = findCorrectPosition(player.timeline, card);
    const slotDistance = Math.abs(chosenPosition - correctPosition);
    const miss = {
        title: card.title,
        artist: card.artist,
        year: card.year,
        chosenPosition,
        correctPosition,
        slotDistance,
    };
    const previous = player.stats.biggestMiss;
    if (!previous || slotDistance > previous.slotDistance) {
        player.stats.biggestMiss = miss;
    }
}


function overrideAndGrantToken(game) {
    let activePlayer = game.getCurrentPlayer();
    return earnToken(activePlayer);
}


function nextTurn(game) {
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    game.currentCard = null;
}


function checkWinCondition(game) {
    for (let player of game.players) {
        if (player.timeline.length >= game.winTarget) {
            return player;
        }
    }
    return null;
}


function endTurn(game) {
    const winner = checkWinCondition(game);

    if (!game.finalRound && winner) {
        const n = game.players.length;
        const remaining = (game.startingPlayerIndex - game.currentPlayerIndex - 1 + n) % n;
        if (remaining === 0) {
            return { won: true, winner: resolveWinners(game) };
        }
        game.finalRound = true;
        nextTurn(game);
        return { won: false, finalRoundStarted: true };
    }

    nextTurn(game);

    if (game.finalRound && game.currentPlayerIndex === game.startingPlayerIndex) {
        return { won: true, winner: resolveWinners(game) };
    }

    return { won: false };
}

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


function handleEmptyDeck(game) {
    let maxCards = 0;
    for (let player of game.players) {
        if (player.timeline.length > maxCards) {
            maxCards = player.timeline.length;
        }
    }

    let cardLeaders = game.players.filter(p => p.timeline.length === maxCards);

    if (cardLeaders.length === 1) {
        return cardLeaders;
    }

    let maxTokens = 0;
    for (let player of cardLeaders) {
        if (player.tokens > maxTokens) {
            maxTokens = player.tokens;
        }
    }

    let finalWinners = cardLeaders.filter(p => p.tokens === maxTokens);

    return finalWinners;
}


function skipCard(game) {
    let player = game.getCurrentPlayer();
    if (player.tokens < 1) return { success: false, card: null };
    spendTokens(player, 1);
    player.stats.skipsUsed += 1;
    discardCard(game);
    let nextCard = drawCard(game);
    return { success: true, card: nextCard };
}


function buyPlacement(game) {
    let player = game.getCurrentPlayer();
    if (player.tokens < 3) return { success: false, position: null };
    spendTokens(player, 3);
    player.stats.turnsPlayed += 1;
    player.stats.buyPlacementsUsed += 1;
    let card = game.currentCard;

    let position = 0;
    while (position < player.timeline.length && player.timeline[position].year <= card.year) {
        position++;
    }

    insertCardIntoTimeline(player, card, position);
    recordPlacementAttempt(player, card, position, true);
    recordCardWon(player);
    game.currentCard = null;
    return { success: true, position };
}


function initiateSteal(game, stealerIndex, stealPosition, stealNameGuess = null) {
    let stealer = game.players[stealerIndex];
    if (stealer.tokens < 1) return { success: false };
    if (game.pendingSteal !== null) return { success: false };
    spendTokens(stealer, 1);
    stealer.stats.challengesStarted += 1;
    game.pendingSteal = { stealerIndex, stealPosition, stealNameGuess };
    return { success: true, stealer };
}


function resolveTurn(game, activePosition, nameGuess) {
    let activePlayer = game.getCurrentPlayer();
    let card         = game.currentCard;
    let mode         = game.mode;

    let activeCorrect = isPlacementCorrect(activePlayer.timeline, card, activePosition);
    activePlayer.stats.turnsPlayed += 1;
    recordPlacementAttempt(activePlayer, card, activePosition, activeCorrect);

    let nameGuessCorrect = false;
    let nameGuessDetail  = null;
    let tokenEarned      = false;
    if (nameGuess) {
        activePlayer.stats.nameGuesses += 1;
        if (mode === "chill") {
            const chillResult = checkNameGuessChill(card, nameGuess.artist, nameGuess.title);
            nameGuessCorrect = chillResult.correct;
            nameGuessDetail  = chillResult;
        } else {
            nameGuessCorrect = checkNameGuess(card, nameGuess.artist, nameGuess.title);
        }
        if (nameGuessCorrect) {
            activePlayer.stats.correctNameGuesses += 1;
        }
        if (mode !== "pro" && nameGuessCorrect) {
            tokenEarned = earnToken(activePlayer);
        }
    }

    let activeKeepsCard = mode === "pro" ? (activeCorrect && nameGuessCorrect) : activeCorrect;

    let stealResult = null;

    if (game.pendingSteal !== null) {
        let { stealerIndex, stealPosition, stealNameGuess } = game.pendingSteal;
        let stealer      = game.players[stealerIndex];
        let stealCorrect = isPlacementCorrect(activePlayer.timeline, card, stealPosition);

        let stealNameCorrect = false;
        if (mode === "pro" && stealNameGuess) {
            stealNameCorrect = checkNameGuess(card, stealNameGuess.artist, stealNameGuess.title);
        }
        let stealerKeepsCard = mode === "pro" ? (stealCorrect && stealNameCorrect) : stealCorrect;

        if (activeKeepsCard) {
            insertCardIntoTimeline(activePlayer, card, activePosition);
            recordCardWon(activePlayer);
            stealer.stats.challengesLost += 1;
            stealResult = { outcome: 'active_wins', stealer };
        } else if (stealerKeepsCard) {
            if (mode === "pro") refundToken(stealer);
            let correctPos = findCorrectPosition(stealer.timeline, card);
            insertCardIntoTimeline(stealer, card, correctPos);
            stealer.stats.challengesWon += 1;
            recordCardWon(stealer);
            stealResult = { outcome: 'steal_wins', stealer, card };
        } else {
            stealer.stats.challengesLost += 1;
            stealResult = { outcome: 'both_wrong', stealer, activeCorrect, stealPositionCorrect: stealCorrect };
        }
        game.pendingSteal = null;

    } else {
        if (activeKeepsCard) {
            insertCardIntoTimeline(activePlayer, card, activePosition);
            recordCardWon(activePlayer);
        }
    }

    game.currentCard = null;
    return { activeCorrect, activeKeepsCard, nameGuessCorrect, nameGuessDetail, tokenEarned, stealResult, card };
}

function percentage(part, total) {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
}

function collectGameStats(game, winners, reason = null) {
    const winnerList = Array.isArray(winners) ? winners : [winners];
    const winnerIds = new Set(winnerList.map(player => player.name));
    const standings = [...game.players].sort(
        (a, b) => b.timeline.length - a.timeline.length || b.tokens - a.tokens || a.name.localeCompare(b.name)
    );

    const players = standings.map((player, index) => {
        const stats = player.stats;
        return {
            rank: index + 1,
            name: player.name,
            isWinner: winnerIds.has(player.name),
            finalCards: player.timeline.length,
            finalTokens: player.tokens,
            turnsPlayed: stats.turnsPlayed,
            placementAttempts: stats.placementAttempts,
            correctPlacements: stats.correctPlacements,
            placementAccuracy: percentage(stats.correctPlacements, stats.placementAttempts),
            nameGuesses: stats.nameGuesses,
            correctNameGuesses: stats.correctNameGuesses,
            nameAccuracy: percentage(stats.correctNameGuesses, stats.nameGuesses),
            tokensEarned: stats.tokensEarned,
            tokensSpent: stats.tokensSpent,
            cardsWon: stats.cardsWon,
            currentStreak: stats.currentStreak,
            bestStreak: stats.bestStreak,
            skipsUsed: stats.skipsUsed,
            buyPlacementsUsed: stats.buyPlacementsUsed,
            challengesStarted: stats.challengesStarted,
            challengesWon: stats.challengesWon,
            challengesLost: stats.challengesLost,
            biggestMiss: stats.biggestMiss,
        };
    });

    const bestBy = (field) => {
        const eligible = players.filter(player => player[field] > 0);
        if (!eligible.length) return null;
        eligible.sort((a, b) => b[field] - a[field]);
        const top = eligible[0][field];
        return eligible.filter(p => p[field] === top);
    };

    return {
        reason,
        winnerNames: winnerList.map(player => player.name).join(' & '),
        totalTurns: players.reduce((sum, player) => sum + player.turnsPlayed, 0),
        totalCardsWon: players.reduce((sum, player) => sum + player.cardsWon, 0),
        players,
        highlights: {
            bestPlacement: bestBy('placementAccuracy'),
            bestName: bestBy('nameAccuracy'),
            bestStreak: bestBy('bestStreak'),
            mostTokensEarned: bestBy('tokensEarned'),
            challengeWinner: bestBy('challengesWon'),
        },
    };
}


let game = null;

function startGame(playerNames, mode = "original", startingPlayerIndex = 0, winTarget = 10) {
    if (playerNames.length < 2) {
        alert("You need at least 2 players to start!");
        return;
    }

    game = new Game(playerNames, SONGS, mode, startingPlayerIndex, winTarget);
}
