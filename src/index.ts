
import {DiscordAPIError, GatewayIntentBits, MessageReplyOptions, Message as _Message, TextChannel, Partials, Client} from 'discord.js';
import {LifewebError} from '../lifeweb/lib/index.js';

import {IS_TESTING, BotError, Message, readFile, internalRunTextCommand, config} from './base.js';

import './commands/meta.js';
import './commands/sim.js';
import './commands/identify.js';
import './commands/patterns.js';
import './commands/rules.js';
import './commands/5s.js';
import './commands/aliases.js';
import './commands/wiki.js';
import {CalcError} from './commands/calc.js';
import './commands/secret.js';

import {starboardChannels} from './other/starboard.js';
import {check5S} from './other/notifier.js';


let previousMsgs: [string, Message][] = [];
let deleters: [string, string][] = [];
let runningCommands = new Set<string>();

async function runCommand(msg: Message): Promise<void> {
    if (msg.author.bot || msg.createdTimestamp < config.initTime || runningCommands.has(msg.id)) {
        return;
    }
    let data = msg.content;
    if (IS_TESTING) {
        if (data.startsWith('$')) {
            data = data.slice(1);
        } else {
            return;
        }
    } else {
        if (data.startsWith('!')) {
            data = data.slice(1);
        } else if (data.startsWith('ca.')) {
            data = data.slice(3);
        } else {
            return;
        }
    }
    let cmd: string;
    let index = data.indexOf(' ');
    let index2 = data.indexOf('\n');
    if (index === -1 || (index2 !== -1 && index2 < index)) {
        index = index2;
    }
    if (index === -1) {
        cmd = data;
        data = '';
    } else {
        cmd = data.slice(0, index);
        data = data.slice(index + 1);
    }
    runningCommands.add(msg.id);
    try {
        let value = await internalRunTextCommand(msg, data);
        if (value) {
            let out: Message;
            let newDeleters: string[] = [msg.author.id];
            if (value.deleters) {
                for (let deleter of value.deleters) {
                    newDeleters.push(deleter);
                }
            }
            if (value.type === 'already-sent') {
                out = value.value;
            } else {
                let data: MessageReplyOptions = {allowedMentions: {repliedUser: true, parse: []}};
                if (value.type === 'message-spec') {
                    Object.assign(data, value.value);
                } else if (value.type === 'string' || value.type === 'number' || value.type === 'boolean') {
                    data.content = String(value.value);
                } else if (value.type === 'pattern') {
                    data.content = value.value.toRLE();
                } else {
                    throw new Error(`This error should not occur (invalid response type: '${(value as {type: 'string'}).type}')`);
                }
                out = await msg.reply(data);
            }
            previousMsgs.push([msg.id, out]);
            if (previousMsgs.length > 4096) {
                previousMsgs.shift();
            }
            for (let id of newDeleters) {
                deleters.push([id, out.id]);
            }
            if (deleters.length > 65536) {
                deleters.shift();
            }
        }
    } catch (error) {
        if (error instanceof BotError || error instanceof LifewebError || error instanceof SyntaxError) {
            let content: string;
            if (error instanceof CalcError || error.message.startsWith('SymmetryError: ')) {
                content = error.message;
            } else {
                content = `${error.name}: ${error.message}`;
            }
            previousMsgs.push([msg.id, await msg.reply({content, allowedMentions: {repliedUser: true, parse: []}})]);
        } else if (error instanceof Error && (error.message === `ENOENT: no such file or directory, stat '/home/caterer/caterer-ii/sim.gif'` || error.message === `ENOENT: no such file or directory, stat '/home/caterer/caterer-ii/sim_base.gif'`)) {
            previousMsgs.push([msg.id, await msg.reply({content: `${error.name}: ${error.message} (try running the command again!)`, allowedMentions: {repliedUser: true, parse: []}})]);
        } else if ((error instanceof DiscordAPIError && error.message.match(/Must be (2|4)000 or fewer in length/)) || (error instanceof Error && error.message === 'Received one or more errors' && typeof error.stack === 'string' && error.stack.toLowerCase().includes('sapphire'))) {
            previousMsgs.push([msg.id, await msg.reply({content: 'Error: Message too long!', allowedMentions: {repliedUser: true, parse: []}})]);
        } else {
            let str: string;
            if (error && typeof error === 'object' && 'stack' in error) {
                str = String(error.stack);
                if (str.length > 1900) {
                    str = str.slice(0, 1900) + '... (truncated)';
                }
            } else {
                str = String(error);
            }
            console.log(str);
            let content = '```' + str + '```';
            if (msg.author.id !== '1253852708826386518') {
                content = '<@1253852708826386518>\n' + content;
            }
            previousMsgs.push([msg.id, await msg.reply({content, allowedMentions: {repliedUser: true, parse: ['users']}})]);
        }
    } finally {
        runningCommands.delete(msg.id);
    }
}


export let client = new Client({
    intents: [
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User,
        Partials.ThreadMember,
    ],
}) as Client<true>;

let sssssChannel: TextChannel;

client.once('clientReady', async () => {
    console.log('Logged in');
});

client.on('messageCreate', runCommand);

client.on('messageUpdate', async (old, msg) => {
    try {
        let index = previousMsgs.findLastIndex(x => x[0] === old.id);
        if (index > -1) {
            let msg = previousMsgs[index][1];
            try {
                let msg2 = await msg.channel.messages.fetch(msg.id);
                if (msg2) {
                    msg2.delete();
                }
            } catch {}
            previousMsgs = previousMsgs.splice(index, 1);
        }
        runCommand(msg);
    } catch (error) {
        let str: string;
        if (error && typeof error === 'object' && 'stack' in error) {
            str = String(error.stack);
            if (str.length > 1900) {
                str = str.slice(0, 1900) + '... (truncated)';
            }
        } else {
            str = String(error);
        }
        console.log(str);
        let content = '```' + str + '```';
        if (msg.author.id !== '1253852708826386518') {
            content = '<@1253852708826386518>\n' + content;
        }
        await msg.reply({content, allowedMentions: {repliedUser: true, parse: ['users']}});
    }
});

client.on('messageReactionAdd', async data => {
    if (!(data.emoji.name === '❌' || data.emoji.name === '🗑️')) {
        return;
    }
    if (data.partial) {
        data = await data.fetch();
    }
    let msg = data.message;
    if (msg.partial) {
        msg = await msg.fetch();
    }
    if (!msg.author || (msg.author.id !== client.user?.id) || !msg.deletable) {
        return;
    }
    for (let admin of config.admins) {
        if (data.users.cache.has(admin)) {
            msg.delete();
            return;
        }
    }
    if (msg.channel.id in starboardChannels) {
        return;
    }
    if (msg.author?.id === client.user?.id && msg.reference) {
        let id = (await data.message.fetchReference()).author.id;
        let users = await data.users.fetch();
        if (users.find(x => x.id === id)) {
            msg.delete();
            return;
        }
        for (let [userId, msgId] of deleters) {
            if (msgId === msg.id && users.find(x => x.id === userId)) {
                msg.delete();
                return;
            }
        }
    }
    return;
});


if (config.sssssChannel !== undefined) {
    client.once('ready', async () => {
        let sssssChannel = await client.channels.fetch(config.sssssChannel) as TextChannel;
        setInterval(async () => {
            try {
                await check5S(sssssChannel);
            } catch (error) {
                let str: string;
                if (error && typeof error === 'object' && 'stack' in error) {
                    str = String(error.stack);
                    if (str.length > 1900) {
                        str = str.slice(0, 1900) + '... (truncated)';
                    }
                } else {
                    str = String(error);
                }
                await sssssChannel.send('<@1253852708826386518>\n```' + str + '```');
            }
        }, 300000);
    });
}


client.login(config.token);
