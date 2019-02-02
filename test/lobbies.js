const Discord = require('discord.js');

const lobbies = new Discord.Collection();
const games = new Discord.Collection();

lobbies.set('12345', {
    players: [],
    public: true
})

lobbies.get('12345').players.push({
    discord_id: '123123',
    username: 'bryan',
    party_leader: true
})

lobbies.get('12345').players.push({
    discord_id: '321321',
    username: 'tran',
    party_leader: false
})

function create_game(lobby) {
    let game = lobby;
    games.set(game, {
        time_started: Date.now(),
        players: [],
        role_pool: {
            ambassador: 3,
            assassin: 3,
            captain: 3,
            contessa: 3,
            duke: 3
        },
        revealed: {
            ambassador: 0,
            assassin: 0,
            captain: 0,
            contessa: 0,
            duke: 0
        },
        turns: 0
    });

    let players = lobbies.get(lobby).players;
    for (let player of players) {
        initialize_player(game, player);
    }
}

function initialize_player(game, player) {
    games.get(game).players.push({
        discord_id: player.discord_id,
        username: player.username,
        party_leader: player.party_leader,
        stats: {
            roles: pick_roles(games.get('12345').role_pool),
            coins: 2,
            alive: true,
            win: false
        }
    });
}

function pick_roles(role_pool) {
    let picked = [];
    for (let i = 0; i < 2; i++) {
        let index = Math.floor(Math.random() * Object.keys(role_pool).length);
        let role = Object.keys(role_pool)[index];
        role_pool[role]--;
        picked.push(role);
    }
    return picked;
}

create_game('12345');
console.log(games.get('12345'));
console.log(games.get('12345').players[0].stats)