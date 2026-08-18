
import {DiscordAPIError, Message as _Message, PartialMessage, MessageReaction, PartialMessageReaction, TextChannel} from 'discord.js';

import {ME, Message, readFile, writeFile, config, findPatternInText} from '../base.js';
import {client} from '../index.js';


interface StarboardData {
    data: Map<string, [string, string]>;
    forbidden: Set<string>;
}

let starboardData: {[key: string]: StarboardData} = {};

type StarboardFile = {[key: string]: {data: [string, [string, string]][], forbidden: string[]}};

let starboardFileData = JSON.parse(await readFile('data/starboard.json')) as StarboardFile;
for (let [key, value] of Object.entries(starboardFileData)) {
    starboardData[key] = {
        data: new Map(value.data),
        forbidden: new Set(value.forbidden),
    };
}

async function saveStarboard(): Promise<void> {
    let out: StarboardFile = {};
    for (let [key, value] of Object.entries(starboardData)) {
        out[key] = {
            data: Array.from(value.data.entries()),
            forbidden: Array.from(value.forbidden),
        };
    }
    await writeFile('data/starboard.json', JSON.stringify(out));
}

let added = false;
for (let serverID of Object.keys(config.starboards)) {
    if (!(serverID in starboardData)) {
        added = true;
        starboardData[serverID] = {
            data: new Map(),
            forbidden: new Set(),
        };
    }
}
if (added) {
    await saveStarboard();
}

export let starboardChannels: {[key: string]: TextChannel} = {};
let starReactions = new Set<string>();

async function loadStarboard(): Promise<void> {
    for (let [serverID, data] of Object.entries(config.starboards)) {
        starboardChannels[serverID] = await (await client.guilds.fetch(serverID)).channels.fetch(data.channel) as TextChannel;
        for (let emoji of Object.keys(data.emojis)) {
            starReactions.add(emoji);
        }
    }
}


async function getReactions(msg: _Message, emojis: {[key: string]: number}, out: {[key: string]: Set<string>}): Promise<void> {
    for (let emoji in emojis) {
        let react = msg.reactions.cache.get(emoji);
        if (!react) {
            let react2 = msg.reactions.resolve(emoji);
            if (react2) {
                react = react2;
            }
        }
        if (react) {
            if (!(emoji in out)) {
                out[emoji] = new Set();
            }
            for (let user of await react.users.fetch()) {
                out[emoji].add(user[1].id);
            }
            for (let user of await react.users.fetch({type: 1})) {
                out[emoji].add(user[1].id);
            }
        }
    }
}

async function deleteStarboardEntry(msg: _Message | PartialMessage, entry: [string, string]): Promise<void> {
    if (!msg.guildId) {
        return;
    }
    let data = starboardData[msg.guildId];
    if (!data) {
        return;
    }
    data.data.delete(msg.id);
    for (let id of entry) {
        try {
            await starboardChannels[msg.guildId].messages.delete(id);
        } catch (error) {
            if (error instanceof DiscordAPIError) {
                console.error(error);
            } else {
                throw error;
            }
        }
    }
    await saveStarboard();
}

async function _updateStarboard(_msg: _Message | PartialMessage): Promise<void> {
    if (_msg.partial) {
        _msg = await _msg.fetch();
    }
    if (_msg.system || _msg.poll || _msg.activity|| !_msg.inGuild()) {
        return;
    }
    let msg: Message = _msg;
    // seriously
    if (msg.channelId === config.sssssChannel && msg.content.includes('<@1253852708826386518>')) {
        return;
    }
    let serverID = msg.guildId;
    let board = config.starboards[serverID];
    if (!board) {
        return;
    }
    let boardData = starboardData[serverID];
    if (!boardData) {
        return;
    }
    if (!boardData || boardData.forbidden.has(msg.id)) {
        return;
    }
    while (msg.reference && msg.reference.type === 1 && msg.channelId !== board.channel) {
        let msg2 = await msg.fetchReference();
        if (!msg2 || !msg2.inGuild() || msg2.guildId !== serverID) {
            break;
        }
        msg = msg2;
    }
    if (!msg.inGuild() || msg.createdTimestamp < board.startTime || msg.createdTimestamp < config.initTime || msg.system || msg.flags.has('Ephemeral')) {
        return;
    }
    let channel = starboardChannels[serverID];
    let reacts: {[key: string]: Set<string>} = {};
    if (msg.channel.id === board.channel) {
        if (msg.author.id !== client.user?.id) {
            return;
        } else if (msg.reference) {
            msg = await msg.fetchReference();
            if (!msg.inGuild()) {
                return;
            }
            await getReactions(msg, board.emojis, reacts);
        } else {
            let match = msg.content.match(/\/(\d+)\/(\d+)\)$/);
            if (!match || !msg.guild) {
                return;
            }
            let channelID = match[0];
            let messageID = match[1];
            let msg2Channel = await msg.guild.channels.fetch(match[0]);
            if (!msg2Channel || !msg2Channel.isTextBased()) {
                return;
            }
            let msg2 = await msg2Channel.messages.fetch('');
        }
    }
    await getReactions(msg, board.emojis, reacts);
    let senderId: string;
    if (msg.author) {
        senderId = msg.author.id;
    } else {
        return;
    }
    let entry = boardData.data.get(msg.id);
    if (entry) {
        for (let id of entry) {
            try {
                getReactions(await channel.messages.fetch(id), board.emojis, reacts);
            } catch (error) {
                if (error instanceof DiscordAPIError) {
                    console.error(error);
                } else {
                    throw error;
                }
            }
        }
    }
    if (msg.author?.id === client.user.id && msg.attachments.size === 1) {
        let msg2 = await msg.fetchReference();
        senderId = msg2.author.id;
    }
    let userReacts: {[key: string]: string} = {};
    for (let emoji in reacts) {
        for (let user of Array.from(reacts[emoji])) {
            if (!board.allowSelf && user === senderId) {
                continue;
            } else if (user === '237844886030778368') {
                continue;
            } else if (user in userReacts) {
                let oldScore = board.emojis[userReacts[user]];
                let newScore = board.emojis[emoji];
                if (Math.abs(newScore) > Math.abs(oldScore)) {
                    userReacts[user] = emoji;
                } else if (Math.abs(newScore) === Math.abs(oldScore) && newScore > oldScore) {
                    userReacts[user] = emoji;
                } else {
                    continue;
                }
            } else {
                userReacts[user] = emoji;
            }
        }
    }
    let count = 0;
    for (let emoji of Object.values(userReacts)) {
        count += board.emojis[emoji];
    }
    // let log = `Reactions:`;
    // for (let [emoji, users] of Object.entries(reacts)) {
    //     log += `\n    ${client.emojis.cache.get(emoji)?.name}: ${Array.from(users).map(x => client.users.cache.get(x)?.username).join(', ')}`;
    // }
    // log += `\nResolved reactions:`;
    // for (let [user, emoji] of Object.entries(userReacts)) {
    //     log += `\n    ${client.users.cache.get(user)?.username} reacted with :${client.emojis.cache.get(emoji)?.name}:`;
    // }
    // log += `\nTotal count: ${count}`;
    // console.log(log.split('\n').reverse().join('\n'));
    if (count >= board.threshold || (board.negativeThreshold !== undefined && count <= board.negativeThreshold)) {
        let text = board.boardLowEmoji;
        for (let [threshold, emoji] of board.boardEmojis) {
            if (count >= threshold) {
                text = emoji;
            }
        }
        let countStr = count.toFixed(3);
        let index = countStr.indexOf('.');
        if (index !== -1) {
            let end = countStr.slice(index + 1);
            while (end.endsWith('0')) {
                end = end.slice(0, -1);
            }
            countStr = countStr.slice(0, index + 1) + end;
            if (countStr.endsWith('.')) {
                countStr = countStr.slice(0, -1);
            }
        }
        text += ` **${countStr}** `;
        if (msg.author?.id === client.user.id && msg.attachments.size === 1) {
            let msg2 = await msg.fetchReference();
            let data = findPatternInText(msg2.content);
            if (data) {
                text += `Pattern by <@${msg2.author.id}> in \`${data.rule.str}\``;
            } else {
                text += `Pattern by <@${msg2.author.id}>`;
            }
        } else {
            text += `<@${msg.author?.id}>`;
        }
        text += ` (https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id})`;
        if (entry) {
            try {
                (await channel.messages.fetch(entry[0])).edit({content: text, allowedMentions: {parse: []}});
                await saveStarboard();
                return;
            } catch (error) {
                if (error instanceof DiscordAPIError) {
                    console.error(error);
                } else {
                    throw error;
                }
            }
        }
        let msg0 = await channel.send({content: text, allowedMentions: {parse: []}});
        let msg1 = await msg.forward(channel);
        boardData.data.set(msg.id, [msg0.id, msg1.id]);
        await saveStarboard();
    } else if (entry) {
        await deleteStarboardEntry(msg, entry);
        await saveStarboard();
    }
}

let updatingStarboardFor = new Set<string>();

async function updateStarboard(data: MessageReaction | PartialMessageReaction): Promise<void> {
    let currentID: string | undefined;
    try {
        if (data.partial) {
            data = await data.fetch();
        }
        if ((data.emoji.name && !starReactions.has(data.emoji.name)) && (data.emoji.id && !starReactions.has(data.emoji.id))) {
            return;
        }
        let msg = data.message;
        if (updatingStarboardFor.has(msg.id)) {
            setTimeout(() => updateStarboard(data), 2000);
        }
        updatingStarboardFor.add(msg.id);
        currentID = msg.id;
        await _updateStarboard(msg);
        updatingStarboardFor.delete(msg.id);
    } catch (error) {
        if (currentID !== undefined) {
            updatingStarboardFor.delete(currentID);
        }
    }
}


let interval = setInterval(async () => {
    if (ME === 'bot' && client.isReady()) {
        clearInterval(interval);
        loadStarboard();
        client.on('messageReactionAdd', updateStarboard);
        client.on('messageReactionRemove', updateStarboard);
        client.on('messageReactionRemoveAll', async msg => {
            if (msg.inGuild()) {
                let boardData = starboardData[msg.guildId];
                if (!boardData) {
                    return;
                }
                let entry = boardData.data.get(msg.id);
                if (entry) {
                    await deleteStarboardEntry(msg, entry);
                    await saveStarboard();
                }
            }
        });
        client.on('messageDelete', async msg => {
            if (msg.inGuild()) {
                let boardData = starboardData[msg.guildId];
                if (!boardData) {
                    return;
                }
                let entry = boardData.data.get(msg.id);
                if (entry) {
                    boardData.forbidden.add(msg.id);
                    await deleteStarboardEntry(msg, entry);
                    await saveStarboard();
                }
            }
        });
    }
}, 1000);


// export async function cmdStarboardPrevent(msg: Message, argv: string[]): Promise<Response> {
//     if (!msg.reference) {
//         throw new BotError('!starboardprevent must be used when replying to a message');
//     }
//     let msg2 = await msg.fetchReference();
//     if (msg2.guildId && msg2.guildId in config.starboardServers) {
//         let boardName = config.starboardServers[msg2.guildId];
//         let entry = starboard[boardName].data.get(msg2.id);
//         starboard[boardName].forbidden.add(msg2.id);
//         if (entry) {
//             await deleteStarboardEntry(boardName, msg2, entry);
//         }
//         await saveStarboard();
//     } else {
//         throw new BotError('!starboardprevent must be used in servers witih starboards');
//     }
//     return 'Prevented!';
// }
