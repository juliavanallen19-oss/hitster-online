const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('game.js', 'utf8') + `
globalThis.Player = Player;
globalThis.Game = Game;
globalThis.resolveTurn = resolveTurn;
globalThis.initiateSteal = initiateSteal;
globalThis.buyPlacement = buyPlacement;
globalThis.skipCard = skipCard;
globalThis.collectGameStats = collectGameStats;
`;

const context = { console, Math };
vm.createContext(context);
vm.runInContext(source, context);

const songs = [
    { title: 'Old', artist: 'A', year: 1970, spotify_url: '#' },
    { title: 'New', artist: 'B', year: 2000, spotify_url: '#' },
    { title: 'Target', artist: 'C', year: 1990, spotify_url: '#' },
    { title: 'Skip One', artist: 'D', year: 1985, spotify_url: '#' },
    { title: 'Skip Two', artist: 'E', year: 1995, spotify_url: '#' },
];

function makeGame() {
    const game = new context.Game(['Ada', 'Grace'], songs, 'original', 0, 3);
    game.players[0].timeline = [songs[0], songs[1]];
    game.players[1].timeline = [songs[0], songs[1]];
    game.players[0].tokens = 2;
    game.players[1].tokens = 2;
    game.currentCard = songs[2];
    game.deck = [songs[3], songs[4]];
    return game;
}

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (err) {
        console.error(`not ok - ${name}`);
        throw err;
    }
}

test('collectGameStats summarizes placement accuracy, name accuracy, streaks, and tokens', () => {
    const game = makeGame();

    context.resolveTurn(game, 1, { artist: 'C', title: 'Target' });

    const summary = context.collectGameStats(game, [game.players[0]], 'goal');
    const ada = summary.players.find(player => player.name === 'Ada');

    assert.equal(summary.totalTurns, 1);
    assert.equal(summary.winnerNames, 'Ada');
    assert.equal(ada.turnsPlayed, 1);
    assert.equal(ada.placementAccuracy, 100);
    assert.equal(ada.nameAccuracy, 100);
    assert.equal(ada.bestStreak, 1);
    assert.equal(ada.tokensEarned, 1);
    assert.equal(ada.cardsWon, 1);
    assert.equal(summary.highlights.bestPlacement.name, 'Ada');
});

test('collectGameStats includes token spending and challenge results', () => {
    const game = makeGame();

    context.skipCard(game);
    context.initiateSteal(game, 1, 1);
    context.resolveTurn(game, 0, null);

    const summary = context.collectGameStats(game, [game.players[1]], 'finished-early');
    const ada = summary.players.find(player => player.name === 'Ada');
    const grace = summary.players.find(player => player.name === 'Grace');

    assert.equal(summary.reason, 'finished-early');
    assert.equal(ada.tokensSpent, 1);
    assert.equal(ada.skipsUsed, 1);
    assert.equal(ada.placementAccuracy, 0);
    assert.equal(ada.biggestMiss.slotDistance, 1);
    assert.equal(grace.tokensSpent, 1);
    assert.equal(grace.challengesStarted, 1);
    assert.equal(grace.challengesWon, 1);
    assert.equal(grace.cardsWon, 1);
    assert.equal(summary.highlights.challengeWinner.name, 'Grace');
});

test('buyPlacement records an automatic card win and token spend', () => {
    const game = makeGame();
    game.players[0].tokens = 3;

    context.buyPlacement(game);

    const summary = context.collectGameStats(game, [game.players[0]], 'goal');
    const ada = summary.players.find(player => player.name === 'Ada');

    assert.equal(ada.turnsPlayed, 1);
    assert.equal(ada.cardsWon, 1);
    assert.equal(ada.buyPlacementsUsed, 1);
    assert.equal(ada.tokensSpent, 3);
    assert.equal(ada.placementAccuracy, 100);
});

test('successful PRO challenge refunds the challenge token in recap spending', () => {
    const game = makeGame();
    game.mode = 'pro';
    game.players[1].tokens = 3;

    context.initiateSteal(game, 1, 1, { artist: 'C', title: 'Target' });
    context.resolveTurn(game, 0, { artist: 'Wrong', title: 'Wrong' });

    const summary = context.collectGameStats(game, [game.players[1]], 'goal');
    const grace = summary.players.find(player => player.name === 'Grace');

    assert.equal(grace.challengesWon, 1);
    assert.equal(grace.tokensSpent, 0);
    assert.equal(grace.finalTokens, 3);
});
