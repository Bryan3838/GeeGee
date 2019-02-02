const Discord = { RichEmbed } = require('discord.js');
const client = new Discord.Client();
const config = require('../settings/config.json');

const Filter = require('bad-words'),
filter = new Filter({ placeHolder: 'x'});

const urlRegex = require('url-regex');

client.on('ready', () => {
    console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`);
    client.user.setActivity(`Serving ${client.guilds.size} servers`);
});

var lobbies = new Discord.Collection();
var games = new Discord.Collection();
var activity = new Discord.Collection();

const numbers = {
    0: "0⃣",
    1: "1⃣",
    2: "2⃣",
    3: "3⃣",
    4: "4⃣",
    5: "5⃣",
    6: "6⃣",
    7: "7⃣",
    8: "8⃣",
    9: "9⃣",
	10: "🔟"
}

client.on('message', async message => {
    if (message.author.bot) return;
    if (message.channel.type !== 'dm') return; //do normal channel stuff

    let args = message.content.trim().replace(/ +/g, ' ').split(' ');
    let command = args.shift().slice(config.prefix.length).toLowerCase();

    if (activity.has(message.author.id) && !message.content.startsWith(config.prefix)) {
        let status = activity.get(message.author.id).status;
        if (status === 'in_lobby') {
            let lobby = activity.get(message.author.id).game_id;
            let filtered = filter.clean(message.content);
            if(urlRegex({ strict: false }).test(message.content) || message.attachments.size > 0) return;
            let embed = new RichEmbed()
                .setAuthor(message.author.username, message.author.avatarURL)
                .setColor(config.color.light_blue)
                .setDescription(filtered)
            return global_lobby_chat({ embed }, message.author.id, lobby);
        } else if (status === 'in_game') {
            let game = await games.get(activity.get(message.author.id).game_id);
            let filtered = filter.clean(message.content);
            if(urlRegex({ strict: false }).test(message.content) || message.attachments.size > 0) return;
            let embed = new RichEmbed()
                .setAuthor(message.author.username, message.author.avatarURL)
                .setColor(config.color.light_blue)
                .setDescription(filtered)
            return global_game_chat({ embed }, message.author.id, game);
        }
    }

    if (!message.content.startsWith(config.prefix)) return;

    if (command === 'coup') {
        if (activity.has(message.author.id)) {
            let status = activity.get(message.author.id).status;
            if (status === 'in_lobby') {
                return message.channel.send('You are currently in a lobby.');
            } else if (status === 'in_game') {
                return message.channel.send('You are currently in a game.');
            } else if (status === 'menu') {
                return message.channel.send('You are currently in the menu.');
            }
        }
        await set_activity(message.author.id, 'menu', null);

        let embed = new RichEmbed()
            .setTitle('Welcome to Coup!')
            .setColor(config.color.discord_gray)
            .setDescription(`Would you like to join or create a lobby?\n${numbers[1]} Join\n${numbers[2]} Create`)
            .attachFile('./images/Coup.jpg')
            .setThumbnail('attachment://Coup.jpg')
        await message.channel.send({ embed }).then( async result_message => {
            let emojis = [numbers[1], numbers[2],  "❌"];

            let reaction = await await_reaction(result_message, message.author.id, emojis, 60000);

            result_message.delete();

            if (!reaction) {
                await set_activity(message.author.id, null, null);
                return message.channel.send('Your session has been timed out.');
            }

            if (reaction === emojis[0]) {
                let embed = new RichEmbed()
                    .setTitle('Join Lobby')
                    .setColor(config.color.discord_gray)
                    .setDescription('Do you have a lobby ID?\n1⃣\Join with lobby ID.\n2⃣ Join random public lobby.')
                message.channel.send({ embed }).then( async result_message => {
                    let emojis = [numbers[1], numbers[2], "❌"];
                    let reaction = await await_reaction(result_message, message.author.id, emojis, 60000);
                    
                    result_message.delete();

                    if (!reaction) {
                        await set_activity(message.author.id, null, null);
                        return message.channel.send('Your session has been timed out.').then( result_message => delete_message(result_message, 15000));
                    }

                    if (reaction === emojis[0]) {
                        embed = new RichEmbed()
                            .setTitle('Enter ID')
                            .setColor(config.color.discord_gray)
                            .setDescription('Please enter the lobby ID below.')
                        message.channel.send({ embed }).then( async result_message => {

                            let id = {
                                string: null,
                                status: null
                            }
                            for (let i = 0; i < 3; i++) {
                                id.string = await await_message(message.channel, message.author.id, 60000);

                                if (!id.string) {
                                    id.status = 1;
                                    break;
                                }

                                if (!lobbies.has(id.string)) {
                                    message.channel.send('That id does not exist.').then( result_message => delete_message(result_message, 15000));
                                    id.status = 2;
                                } else {
                                    id.status = 0;
                                    break;
                                }
                            }

                            result_message.delete();
                            if (id.status === 1) {
                                await set_activity(message.author.id, null, null);
                                return message.channel.send('Your session has been timed out.').then( result_message => delete_message(result_message, 15000));
                            } else if (id.status === 2) {
                                await set_activity(message.author.id, null, null);
                                return message.channel.send('You have entered the wrong id 3 times in a row, please restart the command menu.').then( result_message => delete_message(result_message, 15000));
                            }

                            let lobby = id.string;
                            let players = lobbies.get(lobby).players;
                            if (players.length === 6) return message.channel.send('Lobby is full, please find another lobby.');

                            await join_lobby(lobby, message.author);
                            await set_activity(message.author.id, 'in_lobby', lobby);

                            embed = new RichEmbed()
                                .setAuthor(`${message.author.username} has joined the lobby.`, message.author.avatarURL)
                                .setColor(config.color.lime)
                            global_lobby_chat({ embed }, null, lobby);

                            let block = '';
                            for (let player of players) {
                                block += `+${player.username} ${player.party_leader ? '(Party Leader)' : ''}\n`;
                            }
                            embed = new RichEmbed()
                                .setAuthor('Players')
                                .setColor(config.color.discord_gray)
                                .setDescription(block)
                                .setFooter(`${lobbies.get(lobby).public ? 'Public' : 'Private'} Lobby || ID: ${lobby}`)
                            global_lobby_chat({ embed }, null, lobby);
                        })
                    } else if (reaction === emojis[1]) {
                        let embed = new RichEmbed()
                            .setTitle('Joining Lobby...')
                            .setColor(config.color.discord_gray)
                            .setDescription('Please wait while I find you an open lobby.')
                        message.channel.send({ embed }).then( async result_message => {
                            let lobby = false;
                            lobbies.forEach( (value, key) => {
                                if (value.public && value.players.length !== 6) {
                                    lobby = key;
                                }
                            })
                            
                            if (!lobby) {
                                lobby = await create_lobby('public');
                                let embed = new RichEmbed()
                                    .setTitle('Public Lobby Created')
                                    .setColor(config.color.discord_gray)
                                    .setDescription(`To invite friends, share this lobby ID: \`${lobby}\``)
                                    .setTimestamp()
                                message.channel.send({ embed }).then( result_message => delete_message(result_message, 15000));
                                message.channel.send('Could not find any open lobbies.').then( result_message => delete_message(result_message, 15000));
                            }

                            result_message.delete();

                            await join_lobby(lobby, message.author);
                            if (lobbies.get(lobby).players.length === 1) {
                                await give_party_leader(lobby, message.author.id);
                            }
                            await set_activity(message.author.id, 'in_lobby', lobby);
                            
                            embed = new RichEmbed()
                                .setAuthor(`${message.author.username} has joined the lobby.`, message.author.avatarURL)
                                .setColor(config.color.lime)
                            global_lobby_chat({ embed }, null, lobby);

                            let players = lobbies.get(lobby).players;
                            let block = '';
                            for (let player of players) {
                                block += `+${player.username} ${player.party_leader ? '(Party Leader)' : ''}\n`;
                            }
                            embed = new RichEmbed()
                                .setAuthor('Players')
                                .setColor(config.color.discord_gray)
                                .setDescription(block)
                                .setFooter(`${lobbies.get(lobby).public ? 'Public' : 'Private'} Lobby || ID: ${lobby}`)
                            global_lobby_chat({ embed }, null, lobby);
                        })
                    } else if (reaction === emojis[2]) {
                        await set_activity(message.author.id, null, null);
                        return message.channel.send('Closed menu.').then( result_message => { delete_message(result_message, 5000) });
                    }
                })
            } else if (reaction === numbers[2]) {
                let embed = new RichEmbed()
                    .setTitle('Create Lobby')
                    .setColor(config.color.discord_gray)
                    .setDescription('Would you like to create a public or private lobby?\n1⃣  Public\n2⃣ Private')
                message.channel.send({ embed }).then( async result_message => {
                    let emojis = [numbers[1], numbers[2],, "❌"];
                    let reaction = await await_reaction(result_message, message.author.id, emojis, 60000);

                    result_message.delete();

                    if (!reaction) {
                        await set_activity(message.author.id, null, null);
                        return message.channel.send('Your session has been timed out.').then( result_message => delete_message(result_message, 15000));
                    }

                    let public = true;
                    if (reaction === emojis[2]) {
                        public = false;
                    } else if (reaction === "❌") {
                        await set_activity(message.author.id, null, null);
                        return message.channel.send('Closed menu.').then( result_message => { delete_message(result_message, 5000) });
                    }

                    let embed = new RichEmbed()
                        .setTitle('Creating Lobby...')
                        .setColor(config.color.discord_gray)
                        .setDescription('Please wait while I create your lobby.')
                    message.channel.send({ embed }).then( async result_message => {
                        let lobby = await create_lobby(`${public ? 'public' : 'private'}`);
                        await join_lobby(lobby, message.author);
                        await give_party_leader(lobby, message.author.id);
                        await set_activity(message.author.id, 'in_lobby', lobby);

                        let embed = new RichEmbed()
                            .setTitle(`${public ? 'Public' : 'Private' } Lobby Created`)
                            .setColor(config.color.discord_gray)
                            .setDescription(`To invite friends, share this lobby ID: \`${lobby}\``)
                            .setTimestamp()
                        result_message.edit({ embed }).then( result_message => delete_message(result_message, 15000));

                        embed = new RichEmbed()
                            .setAuthor(`${message.author.username} has joined the lobby.`, message.author.avatarURL)
                            .setColor(config.color.lime)
                        global_lobby_chat({ embed }, null, lobby);

                        let players = lobbies.get(lobby).players;
                        let block = '';
                        for (let player of players) {
                            block += `+${player.username} ${player.party_leader ? '(Party Leader)' : ''}\n`;
                        }
                        embed = new RichEmbed()
                            .setAuthor('Players')
                            .setColor(config.color.discord_gray)
                            .setDescription(block)
                            .setFooter(`${lobbies.get(lobby).public ? 'Public' : 'Private'} Lobby || ID: ${lobby}`)
                        global_lobby_chat({ embed }, null, lobby);
                    });
                });
            } else if (reaction === emojis[2]) {
                await set_activity(message.author.id, null, null);
                return message.channel.send('Closed menu.').then( result_message => { delete_message(result_message, 5000) });
            }
            
        });
    } else if (command === 'leave') {
        if (!activity.has(message.author.id)) {
            return message.channel.send('You are currently not in a lobby.');
        }

        let status = activity.get(message.author.id).status;
        if (status === 'menu') {
            return message.channel.send('To exit the command menu, click the red `X` (❌).');
        } else if (status === 'in_lobby') {
            let lobby = activity.get(message.author.id).game_id;
            let players = lobbies.get(lobby).players;
            await message.channel.send(`Leaving lobby...`).then( async result_message => {
                await leave_lobby(lobby, message.author);
                let party_leader = null;
                
                for (let player of players) {
                    if (player.party_leader) party_leader = player.discord_id;
                    break;
                }
                
                if (!party_leader && players.length > 0) {
                    let index = Math.floor(Math.random() * players.length);
                    await give_party_leader(lobby, players[index].discord_id);
                }
                await set_activity(message.author.id, null, null);
                result_message.edit(`Left lobby ${lobby}.`).then( result_message => delete_message(result_message, 15000));
            })

            if (players.length < 1) {
                return await delete_lobby(lobby);
            }
            
            let embed = new RichEmbed()
                .setAuthor(`${message.author.username} has left the lobby.`, message.author.avatarURL)
                .setColor(config.color.red)
            global_lobby_chat({ embed }, null, lobby);

            let block = '';
            for (let player of players) {
                block += `+${player.username} ${player.party_leader ? '(Party Leader)' : ''}\n`;
            }
            embed = new RichEmbed()
                .setAuthor('Players')
                .setColor(config.color.discord_gray)
                .setDescription(block)
                .setFooter(`${lobbies.get(lobby).public ? 'Public' : 'Private'} Lobby || ID: ${lobby}`)
            global_lobby_chat({ embed }, null, lobby);

        } else if (status === 'in_game') {
            
        }
    } else if (command === 'start') {
        if (!activity.has(message.author.id) || activity.get(message.author.id).status !== 'in_lobby') return message.channel.send('You are currently not in a lobby.');

        let lobby = activity.get(message.author.id).game_id;
        let party_leader = null;
        let players = lobbies.get(lobby).players;
        players.forEach(player => {
            if (player.party_leader && player.discord_id === message.author.id) party_leader = player.discord_id;
        });

        if (!party_leader) return message.channel.send('You are not a party leader.');
        if (players.length < 2) return message.channel.send('A minimum of 2 players is required to start the game.');
        
        global_lobby_chat('Starting...', null, lobby);
        await players.forEach( async player => {
            await set_activity(player.discord_id, 'in_game', lobby);
        })

        let game = lobby;
        await create_game(game);
        games.get(game).players[0].stats.turn = true;
        await games.get(game).players.forEach( async game_player => {
            await set_activity(game_player.discord_id, 'in_game', game);
            game_player.stats.end_turn = true;
        })
        await delete_lobby(game);
    } else if (command === 'test') {
        console.log(activity)
    }
});

//setTimeout( () => {test();}, 2000);
async function test() {
    await lobbies.set('12345', {
        timestamp: Date.now(),
        players: [
        {
            discord_id: '211384818137563137',
            username: 'Bryån',
            party_leader: true
        },
        {
            discord_id: '519049511381893141',
            username: 'lolhi',
            party_leader: false
        }],
        public: true
    })
    await set_activity('211384818137563137', 'in_game', '12345');
    await set_activity('519049511381893141', 'in_game', '12345');
    await create_game('12345');
    games.get('12345').players[0].stats.turn = true;
    await delete_lobby('12345');

    await games.get('12345').players.forEach( async game_player => {
        game_player.stats.end_turn = true;
    })

    games.forEach(game => {
        console.log(game)
        game.players.forEach(player => {
            console.log(player)
        })
    })
}

client.setInterval( () => {
    games.forEach( async game => {
        let next = true;
        let players = await game.players;
        players.forEach( game_player => {
            if (!game_player.stats.end_turn) return next = false;
        })

        if (!next) return;
        
        //send all messages and await reaction/action
        let game_player_up = await game.players[game.turns % game.players.length];
        let discord_player_up = await client.users.get(game_player_up.discord_id);
        
        game_player_up.stats.turn = true;

        await players.forEach( async game_player => {
            game_player.stats.end_turn = false;
            if (!game_player.stats.turn) {
                let discord_player = await client.users.get(game_player.discord_id);
                let embed = new RichEmbed()
                    .setAuthor(`${discord_player_up.username}'s turn.`, discord_player_up.avatarURL)
                    .setColor(config.color.discord_gray)
                    .addField('Stats', `Your cards: ${player_roles(game_player)}\nYour coins: ${game_player.stats.coins}`)
                await discord_player.send({ embed });
            }
        })
        
        embed = new RichEmbed()
            .setAuthor('It is your turn. What would you like to do?', discord_player_up.avatarURL)
            .setColor(config.color.discord_gray)
            .setDescription(`${numbers[1]}Income - Take 1 coin.\n${numbers[2]}Foreign Aid - Take 2 coins.\n${numbers[3]}Tax - Take 3 coins.\n${numbers[4]}Exchange - Exchange cards with deck.\n${numbers[5]}Steal - Take 2 coins from another player.\n${game_player_up.stats.coins >= 3 ? `${numbers[6]}Assassinate - Pay 3 coins, kill 1 player's card.` : ''}\n${game_player_up.stats.coins >= 7 ? `${numbers[7]}Coup - Pay 7 coins, kill 1 player's card.` : ''}`)
            .addField('Your Stats', `Your cards: ${player_roles(game_player_up)}\nYour coins: ${game_player_up.stats.coins}`)
        await client.users.get(discord_player_up.id).send({ embed }).then( async result_message => {
            let emojis = ["❌", numbers[1], numbers[2], numbers[3], numbers[4], numbers[5]];

            if (game_player_up.stats.coins >= 3) {
                emojis.push(numbers[6]);
            }

            if (game_player_up.stats.coins >= 3) {
                emojis.push(numbers[7]);
            }

            let reaction = await await_reaction(result_message, discord_player_up.id, emojis, 300000);

            if (!reaction) {
                //timeout but assume for now that there is none
            }
            if (reaction === emojis[0]) {
                let embed = new RichEmbed()
                    .setAuthor(`${discord_player_up.username} does nothing.`, discord_player_up.avatarURL)
                    .setColor(config.color.gold)
                await global_game_chat({ embed }, null, game);
                game_player_up.stats.turn = false;
                players.forEach( game_player => {
                    game_player.stats.end_turn = true;
                })
                game.turns++;
            } else if (reaction === emojis[1]) {
                let embed = new RichEmbed()
                    .setAuthor(`${discord_player_up.username} is taking income.`, discord_player_up.avatarURL)
                    .setColor(config.color.gold)
                await global_game_chat({ embed }, null, game);
                game_player_up.stats.coins += 1;
                game_player_up.stats.turn = false;
                players.forEach( game_player => {
                    game_player.stats.end_turn = true;
                })
                game.turns++;
            } else if (reaction === emojis[2]) {
                let embed = new RichEmbed()
                    .setAuthor(`${discord_player_up.username} is attempting to take foreign aid...`, discord_player_up.avatarURL)
                    .setColor(config.color.gold)
                await global_game_chat({ embed }, null, game);
                let messages = [];
                
                await players.forEach( async game_player => {
                    if (!game_player.stats.turn) {
                        let discord_player = await client.users.get(game_player.discord_id);
                        let embed = new RichEmbed()
                            .setAuthor(`Would you like to block ${discord_player_up.username} as DUKE?`, discord_player.avatarURL)
                            .setColor(config.color.discord_gray)
                            .setDescription(`Your cards: ${player_roles(game_player)}\nYour coins: ${game_player.stats.coins}`)
                        await discord_player.send({ embed }).then( async result_message => {
                            messages.push(result_message);
                            let emojis = ["👍", "👎"];

                            let reaction = await await_reaction(result_message, discord_player.id, emojis, 300000);

                            if (!reaction) {
                                
                            }

                            if (reaction === emojis[0]) {
                                let embed = new RichEmbed()
                                    .setAuthor(`${game_player.username} blocks ${game_player_up.username}'s attempt at foreign aid.`)
                                    .setColor(config.color.gold)
                                await global_game_chat({ embed }, null, game);
                                await delete_messages(messages);
                                players.forEach( game_player => {
                                    if (!game_player.stats.turn) game_player.stats.end_turn = true;
                                })
                                
                                embed = new RichEmbed()
                                    .setAuthor('Would you like to challenge?')
                                    .setColor(config.color.discord_gray)
                                    .setDescription(`Your cards: ${player_roles(game_player_up)}\nYour coins: ${game_player_up.stats.coins}`)
                                await discord_player_up.send({ embed }).then( async result_message => {
                                    let emojis = ["👍", "👎"];

                                    let reaction = await await_reaction(result_message, discord_player_up.id, emojis, 300000);

                                    if (!reaction) {
                                        
                                    }

                                    if (reaction === emojis[0]) {
                                        let round = await challenge(game_player_up, game_player, 'Duke', game).winner;
                                        await discard(round.loser.game, game);

                                        if (round.winner.game.discord_id === game_player_up.discord_id) {
                                            game_player_up.stats.coins+=2;
                                        }
                                    } else if (reaction === emojis[1]) {
                                        await global_game_chat(`${game_player_up.username} does not challenge!`, null, game);
                                    }
                                    
                                    game_player_up.stats.end_turn = true;
                                    game_player_up.stats.turn = false;
                                    game.turns++;
                                })
                            } else if (reaction === emojis[1]) {
                                game_player.stats.end_turn = true;
                                result_message.delete();
                                let voted = 0;
                                players.forEach( game_player => {
                                    if (!game_player.stats.end_turn) voted++;
                                })
                                
                                if (voted === players.length - 1) {
                                    game_player_up.stats.coins+=2;
                                    game_player_up.stats.end_turn = true;
                                    game_player_up.stats.turn = false;
                                    game.turns++;
                                    await global_game_chat('Nobody blocks.', null, game);
                                }
                            }
                        })
                    }
                })       
            } else if (reaction === emojis[3]) {
                let embed = new RichEmbed()
                    .setAuthor(`${discord_player_up.username} is attempting to tax as DUKE...`, discord_player_up.avatarURL)
                    .setColor(config.color.gold)
                await global_game_chat({ embed }, null, game);
                let messages = [];

                players.forEach( async game_player => {
                    let discord_player = client.users.get(game_player.discord_id);
                    if (!game_player.stats.turn) {
                        let embed = new RichEmbed()
                            .setAuthor('Would you like to challenge?')
                            .setColor(config.color.discord_gray)
                            .setDescription(`Your cards: ${player_roles(game_player)}\nYour coins: ${game_player.stats.coins}`)
                        await discord_player.send({ embed }).then( async result_message => {
                            messages.push(result_message);

                            let emojis = ["👍", "👎"];

                            let reaction = await await_reaction(result_message, discord_player.id, emojis, 300000);

                            if (!reaction) {
                                
                            }

                            if (reaction === emojis[0]) {
                                await delete_messages(messages);
                                await players.forEach( async game_player => {
                                    if (!game_player.stats.turn) game_player.stats.end_turn = true;
                                })

                                let round = await challenge(game_player, game_player_up,'Duke', game);
                                await discard(round.loser.game, game);

                                if (round.winner.game.discord_id === game_player_up.discord_id) {
                                    await switch_roles(round.winner.game, 'Duke', game);

                                    game_player_up.stats.coins+=3;
                                }
                                
                                game_player_up.stats.end_turn = true;
                                game_player_up.stats.turn = false;
                                game.turns++;    
                            } else if (reaction === emojis[1]) {
                                game_player.stats.end_turn = true;
                                result_message.delete();
                                let voted = 0;
                                players.forEach( game_player => {
                                    if (!game_player.stats.end_turn) voted++;
                                })
                                
                                if (voted === players.length - 1) {
                                    game_player_up.stats.coins+=3;
                                    game_player_up.stats.end_turn = true;
                                    game_player_up.stats.turn = false;
                                    game.turns++;
                                    await global_game_chat('Nobody challenges.', null, game);
                                }
                            }
                        })
                    }
                })
            } else if (reaction === emojis[4]) {
                let embed = new RichEmbed()
                    .setAuthor(`${discord_player_up.username} is attempting to exchange as AMBASSADOR...`, discord_player_up.avatarURL)
                    .setColor(config.color.gold)
                await global_game_chat({ embed }, null, game);
                let messages = [];

                players.forEach( async game_player => {
                    let discord_player = client.users.get(game_player.discord_id);
                    if (!game_player.stats.turn) {
                        let embed = new RichEmbed()
                            .setAuthor('Would you like to challenge?')
                            .setColor(config.color.discord_gray)
                            .setDescription(`Your cards: ${player_roles(game_player)}\nYour coins: ${game_player.stats.coins}`)
                        await discord_player.send({ embed }).then( async result_message => {
                            messages.push(result_message);

                            let emojis = ["👍", "👎"];

                            let reaction = await await_reaction(result_message, discord_player.id, emojis, 300000);

                            if (!reaction) {
                                
                            }

                            if (reaction === emojis[0]) {
                                await delete_messages(messages);
                                await players.forEach( async game_player => {
                                    if (!game_player.stats.turn) game_player.stats.end_turn = true;
                                })

                                let round = await challenge(game_player, game_player_up, 'Ambassador', game);
                                await discard(round.loser.game, game);

                                if (round.winner.game.discord_id === game_player_up.discord_id) {
                                    await switch_ambassador(game_player_up, game_player_up.stats.roles.length, game);
                                    await delete_messages(messages);
                                }
                                
                                game_player_up.stats.end_turn = true;
                                game_player_up.stats.turn = false;
                                game.turns++;    
                            } else if (reaction === emojis[1]) {
                                game_player.stats.end_turn = true;
                                result_message.delete();
                                let voted = 0;
                                players.forEach( game_player => {
                                    if (game_player.stats.end_turn) voted++;
                                })
                                
                                if (voted === players.length - 1) {
                                    await switch_ambassador(game_player_up, game_player_up.stats.roles.length, game);
                                    await delete_messages(messages);

                                    game_player_up.stats.end_turn = true;
                                    game_player_up.stats.turn = false;
                                    game.turns++;
                                }
                            }
                        })
                    }
                })
            } else if (reaction === emojis[5]) {
                let embed = new RichEmbed()
                    .setAuthor(`${discord_player_up.username} is attempting to steal as CAPTAIN...`, discord_player_up.avatarURL)
                    .setColor(config.color.gold)
                await global_game_chat({ embed }, null, game);
                let messages = [];

                players.forEach( async game_player => {
                    let discord_player = client.users.get(game_player.discord_id);
                    if (!game_player.stats.turn) {
                        let embed = new RichEmbed()
                            .setAuthor('Would you like to challenge?')
                            .setColor(config.color.discord_gray)
                            .setDescription(`Your cards: ${player_roles(game_player)}\nYour coins: ${game_player.stats.coins}`)
                        await discord_player.send({ embed }).then( async result_message => {
                            messages.push(result_message);

                            let emojis = ["👍", "👎"];

                            let reaction = await await_reaction(result_message, discord_player.id, emojis, 300000);

                            if (!reaction) {
                                
                            }

                            if (reaction === emojis[0]) {

                            } else if (reaction === emojis[1]) {
                                game_player.stats.end_turn = true;
                                result_message.delete();
                                let voted = 0;
                                players.forEach( game_player => {
                                    if (game_player.stats.end_turn) voted++;
                                })
                                
                                if (voted === players.length - 1) {
                                    //steal

                                    game_player_up.stats.end_turn = true;
                                    game_player_up.stats.turn = false;
                                    game.turns++;
                                }
                            }
                        })
                    }
                })
            } else if (reaction === emojis[6]) {
                
            } else if (reaction === emojis[7]) {
                let embed = new RichEmbed()
                    .setAuthor(`${discord_player_up.username} is going to coup...`, discord_player_up.avatarURL)
                    .setColor(config.color.gold)
                await global_game_chat({ embed }, null, game);
                let messages = [];

                let text = '';
                let i = 0;
                players.forEach( async player => {
                    if (player.discord_id !== game_player_up.discord_id) {
                        i++;
                        text += `${number[i - 1]}${player.username}`
                    }
                })

                embed = new RichEmbed()
                    .setAuthor('Who would you like to coup?', discord_player_up.avatarURL)
                    .setDescription(text)
                await discord_player_up.send({ embed }).then( async result_message => {
                    let emojis = [];
                    for (let i = 0; i < players.length - 1; i++) {
                        emojis.push(numbers[i + 1]);
                    }

                    let reaction = await await_reaction(result_message, discord_player_up.id, emojis, 300000);

                    if (!reaction) {

                    }

                    let index = null;
                    if (reaction === emojis[0]) {
                        index = 0;
                    } else if (reaction === emojis[1]) {
                        index = 1;
                    } else if (reaction === emojis[2]) {
                        index = 2;
                    } else if (reaction === emojis[3]) {
                        index = 3;
                    } else if (reaction === emojis[4]) {
                        index = 4;
                    } else if (reaction === emojis[5]) {
                        index = 5;
                    }

                    players[index];
                })
            }

            result_message.delete();
        })
    })
}, 1000);

function delete_message(message, time) {
    setTimeout(function() { message.delete(); }, time);  
}

async function delete_messages(messages) {
    await messages.forEach( async message => {
        await message.delete();
    })
}

async function challenge(game_challenger, game_opponent, role, game) {
    let discord_challenger = await client.users.get(game_challenger.discord_id);
    let discord_opponent = await client.users.get(game_opponent.discord_id);

    await global_game_chat(`${discord_challenger.username} challenges!`, null, game);
    let winner = null;
    let loser = null;
    if (game_opponent.stats.roles.includes(role)) {
        winner = {
            game: game_opponent,
            discord: await discord_opponent
        }
        loser = {
            game: game_challenger,
            discord: await discord_challenger
        };
    } else {
        winner = {
            game: game_challenger,
            discord: await discord_challenger
        }
        loser = {
            game: game_opponent,
            discord: await discord_opponent
        };
    }

    await global_game_chat(`${loser.discord.username} loses the challenge!`, null, game);

    let round = {
        winner: winner,
        loser: loser
    }
    return round
}

async function discard(game_player, game) {
    let roles = game_player.stats.roles;

    if (roles.length === 1) {
        return //lose game
    }

    let discord_player = await client.users.get(game_player.discord_id);
    let embed = new RichEmbed()
        .setAuthor(`Waiting for ${game_player.username} to discard a card...`, discord_player.avatarURL)
        .setColor(config.color.discord_gray)
    let messages = await global_game_chat({ embed }, game_player.discord_id, game);

    embed = new RichEmbed()
        .setAuthor('Choose a card to discard.')
        .setColor(config.color.gold)
        .setDescription(`${numbers[1]}${roles[0]}\n${numbers[2]}${roles[1]}`)
    await discord_player.send({ embed }).then( async result_message => {
        let emojis = [numbers[1], numbers[2]];

        let reaction = await await_reaction(result_message, game_player.discord_id, emojis, 300000);

        if (!reaction) {

        }

        await delete_messages(messages);
        result_message.delete();

        let index = null;
        if (reaction === emojis[0]) {
            index = 0;
        } else if (reaction === emojis[1]) {
            index = 1;
        }

        let discard = await roles[index];
        game.revealed[discard]++;
        
        for (let i = 0; i < roles.length; i++) {
            if (roles[i] === discard) {
                roles.splice(i, 1);
                break;
            } 
        }
        await global_game_chat(`${game_player.username} has discarded the ${discard} card.`, null, game);
    });
}

async function switch_ambassador(game_player, amount, game) {
    let embed = new RichEmbed()
        .setAuthor(`Waiting for ${game_player_up.username} to switch cards...`, discord_player_up.avatarURL)
        .setColor(config.color.discord_gray)
    let messages = await global_game_chat({ embed }, game_player_up.discord_id, game);

    let roles = [];

    await game_player.stats.roles.forEach( async role => {
        await roles.push(role);
    })
    game_player.stats.roles = [];

    await pick_roles(game.role_pool).forEach( async role => {
        await roles.push(role);
    })

    times = amount;
    for (let i = 0; i < amount; i++) {
        let discord_player = client.users.get(game_player.discord_id);
        let text = '';
        for (let i = 0; i < roles.length; i++) {
            text += `${numbers[i + 1]}${roles[i]}\n`
        }
        let embed = new RichEmbed()
            .setAuthor(`Select ${times} card${times > 1 ? 's' : ''} to switch.`)
            .setColor(config.color.discord_gray)
            .setDescription(text)
        await discord_player.send({ embed }).then( async result_message => {
            times--;
            let emojis = [];

            for (let i = 0; i < roles.length; i++) {
                emojis.push(numbers[i + 1]);
            }

            let reaction = await await_reaction(result_message, discord_player.id, emojis, 300000);

            if (!reaction) {

            }

            result_message.delete();

            let index = null;
            if (reaction === emojis[0]) {
                index = 0;
            } else if (reaction === emojis[1]) {
                index = 1;
            } else if (reaction === emojis[2]) {
                index = 2;
            } else if (reaction === emojis[3]) {
                index = 3;
            }

            game_player.stats.roles.push(roles[index]);
            roles.splice(index, 1);
        })
    }
    await delete_messages(messages);
}

async function switch_roles(game_player, discard, game) {
    let discord_player = client.users.get(game_player.discord_id);
    let embed = new RichEmbed()
        .setAuthor(`Waiting for ${game_player.username} to switch cards...`, discord_player.avatarURL)
        .setColor(config.color.discord_gray)
    let messages = await global_game_chat({ embed }, game_player.discord_id, game);

    let roles = [];

    game_player.stats.roles.splice(game_player.stats.roles.indexOf(discard), 1);
    let pick = await pick_roles(game.role_pool);
    await pick.forEach( async role => {
        await roles.push(role);
    })

    let text = '';
    for (let i = 0; i < roles.length; i++) {
        text += `${numbers[i + 1]}${roles[i]}\n`
    }
    embed = new RichEmbed()
        .setAuthor(`Select 1 card to switch.`)
        .setColor(config.color.discord_gray)
        .setDescription(text)
    await discord_player.send({ embed }).then( async result_message => {
        let emojis = [];
        for (let i = 0; i < roles.length; i++) {
            emojis.push(numbers[i + 1]);
        }

        let reaction = await await_reaction(result_message, discord_player.id, emojis, 300000);

        if (!reaction) {

        }

        result_message.delete();

        let index = null;
        if (reaction === emojis[0]) {
            index = 0;
        } else if (reaction === emojis[1]) {
            index = 1;
        } else if (reaction === emojis[2]) {
            index = 2;
        } else if (reaction === emojis[3]) {
            index = 3;
        }

        game_player.stats.roles.push(roles[index]);
        roles.splice(index, 1);
    })
    await delete_messages(messages);
}

function set_activity(discord_id, status, lobby) {
    if (!status) return activity.delete(discord_id);
    // Status: menu, in_lobby, in_game
    if (!activity.has(discord_id)) {
        activity.set(discord_id, {
            status: null,
            game_id: null
        });
    }

    activity.get(discord_id).status = status;
    activity.get(discord_id).game_id = lobby;
}

function create_game(lobby) {
    let game = lobby;
    games.set(game, {
        game_id: game,
        timestamp: Date.now(),
        players: [],
        role_pool: {
            Ambassador: 3,
            Assassin: 3,
            Captain: 3,
            Contessa: 3,
            Duke: 3
        },
        revealed: {
            Ambassador: 0,
            Assassin: 0,
            Captain: 0,
            Contessa: 0,
            Duke: 0
        },
        turns: 0
    });

    let players = lobbies.get(lobby).players;
    players.forEach(player => {
        initialize_player(game, player);
    })

    console.log(`GAME: Game ${game} created. (${players.length} players)`);
}

function initialize_player(game, player) {
    games.get(game).players.push({
        discord_id: player.discord_id,
        username: player.username,
        party_leader: player.party_leader,
        stats: {
            roles: pick_roles(games.get(game).role_pool),
            coins: 2,
            turn: false,
            end_turn: false
        }
    });
}

function player_roles(player) {
    let roles = '';
    player.stats.roles.forEach(role => {
        roles += `\`${role}\` `;
    })
    return roles;
}

function pick_roles(role_pool) {
    let picked = [];
    for (let i = 0; i < 2; i++) {
        let index = Math.floor(Math.random() * Object.keys(role_pool).length);
        let role = Object.keys(role_pool)[index];
        while(role_pool[role] === 0) {
            index = Math.floor(Math.random() * Object.keys(role_pool).length);
            role = Object.keys(role_pool)[index];
        }
        role_pool[role]--;
        picked.push(role);
    }
    return picked;
}

function create_lobby(type) {
    let lobby = create_id(5);
    let public = null;
    if (type === 'public') {
        public = true;
    } else {
        public = false;
    }
    lobbies.set(lobby, {
        timestamp: Date.now(),
        players: [],
        public: public
    });

    console.log(`LOBBY: ${public ? 'Public' : 'Private'} lobby - ${lobby} created.`);
    return lobby;
}

function delete_lobby(lobby) {
    let public = lobbies.get(lobby).public;
    lobbies.delete(lobby);
    
    console.log(`LOBBY: ${public ? 'Public' : 'Private'} lobby - ${lobby} deleted.`);
}

function join_lobby(lobby, discord_user) {
    lobbies.get(lobby).players.push({
        discord_id: discord_user.id,
        username: discord_user.username,
        party_leader: false
    })
}

function leave_lobby(lobby, discord_user) {
    let players = lobbies.get(lobby).players;
    for (let i = 0; i < players.length; i++) {
        if (players[i].discord_id === discord_user.id) {
            lobbies.get(lobby).players.splice(i, 1);
            break;
        }
    }
}

function give_party_leader(lobby, discord_id) {
    let players = lobbies.get(lobby).players;
    for (let player of players) {
        if (player.discord_id === discord_id) {
            player.party_leader = true;
            break;
        }
    }
}

function global_lobby_chat(message, ignore_discord_id, lobby) {
    let players = lobbies.get(lobby).players;
    for(let player of players) {
        if (player.discord_id !== ignore_discord_id) {
            client.users.get(player.discord_id).send(message);
        }
    }
}

async function global_game_chat(message, ignore_discord_id, game) {
    let players = await game.players;
    let messages = [];
    for(let game_player of players) {
        if (game_player.discord_id !== ignore_discord_id) {
            let discord_player = await client.users.get(game_player.discord_id);
            await discord_player.send(message).then( async result_message => {
                await messages.push(result_message);
            })
        }
    }
    return messages;
}

function create_id(length) {
    let id = generate_id(length);
    while(!available_id(id, lobbies)) {
        id = generate_id(length);
    }
    return id;
}

function available_id(id, list) {
    if (list.has(id)) return false;
    return true;
}

function generate_id(length) {
    let id = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        id += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return id;
}

async function await_reaction(message, user_id, emojis, timeout) {
    for (let i = 0; i < emojis.length; i++) {
        setTimeout( function() {
            message.react(emojis[i]).catch(err => {})
        }, i*1000);
    }

    let filter = (reaction, user) => {
        return emojis.includes(reaction.emoji.name) && user.id === user_id;
    }

    let response = await message.awaitReactions(filter, { max: 1, time: timeout });

    if (!response.first()) return false;
    return response.first().emoji.name;
}

async function await_message(channel, user_id, timeout) {
    let filter = message => {
        return message.author.id == user_id;
    }

    let response = await channel.awaitMessages(filter, { max: 1, time: timeout });
    if (!response.first()) return false;
    return response.first().content;
}

client.login(config.token);