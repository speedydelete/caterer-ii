
import * as lifeweb from '../lifeweb/lib/index.js';
import * as lifewebRPF from '../lifeweb/lib/rpf.js';
import {inspect} from 'node:util';
import {Client, GatewayIntentBits, DiscordAPIError, Message as _Message, MessageReaction, PartialMessageReaction, MessageReplyOptions, TextChannel, Partials} from 'discord.js';
import {BotError, Response, Message, readFile, writeFile, config, sentByAdmin, aliases, noReplyPings, findRLEFromText, findRLE} from './util.js';
import {cmdHelp} from './help.js';
import {cmdSim, cmdIdentify, cmdBasicIdentify, cmdMinmax, cmdIdentifyConduit} from './core.js';
import {cmdHashsoup, cmdApgencode, cmdApgdecode, cmdPopulation, cmdMAPToINT, cmdMAPToHexINT, cmdINTToMAP, cmdRuleInfo, cmdNormalizeRule, cmdBlackWhiteReverse, cmdCheckerboardDual} from './ca.js';
import {cmdSssss, cmdSssssInfo, cmdDyk, cmdName, cmdRename, cmdDeleteName, cmdSimStats, cmdSaveSimStats, cmdAlias, cmdUnalias, cmdLookupAlias, cmdListAliases} from './db.js';
import {cmdWiki} from './wiki.js';
import {check5S} from './notifier.js';


const EVAL_PREFIX = '\nlet {' + Object.keys(lifeweb).join(', ') + '} = lifeweb;\nlet {' + Object.keys(lifewebRPF).join(', ') + '} = lifewebRPF;\n';


const COMMANDS: {[key: string]: (msg: Message, argv: string[]) => Promise<Response>} = {

    help: cmdHelp,
    about: cmdHelp,
    info: cmdHelp,

    async eval(msg: Message, argv: string[]): Promise<Response> {
        if (sentByAdmin(msg)) {
            await msg.channel.sendTyping();
            let index = msg.content.indexOf(' ');
            let index2 = msg.content.indexOf('\n');
            if (index === -1 || index2 < index) {
                index = index2;
            }
            if (index === -1) {
                throw new BotError(`No separating whitespace detected`);
            }
            let code = msg.content.slice(index + 1);
            throw new Error(code);
            if (!code.includes(';') && !code.includes('\n')) {
                code = 'return ' + code;
            }
            code = `return (async () => {${code}})()`;
            let out = await (new Function('client', 'msg', 'lifeweb', 'lifewebRPF', 'aliases', 'findRLE', 'readFile', 'writeFile', '"use strict";' + EVAL_PREFIX + code))(client, msg, lifeweb, lifewebRPF, aliases, findRLE, readFile, writeFile);
            if (typeof out === 'string') {
                return '```\n' + out + '\n```';
            } else {
                return '```ansi\n' + inspect(out, {
                    colors: true,
                    depth: 2,
                    breakLength: 120,
                }).replaceAll('\x1b[22m', '\x1b[0m').replaceAll('\x1b[39m', '\x1b[0m') + '\n```';
            }
        }
    },

    async ping(msg: Message, argv: string[]): Promise<Response> {
        let msg2 = await msg.reply({content: 'Pong!', allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}});
        msg2.edit({content: `Pong! Latency: ${Math.round(msg2.createdTimestamp - msg.createdTimestamp)} ms (Discord WebSocket: ${Math.round(client.ws.ping)} ms)`, allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}})
    },

    async pig(msg: Message, argv: string[]): Promise<Response> {
        if (msg.reference) {
            await (await msg.fetchReference()).react('🐷');
        } else {
            await msg.react('🐷');
        }
    },

    async noreplypings(msg: Message, argv: string[]): Promise<Response> {
        if (noReplyPings.includes(msg.author.id)) {
            throw new BotError(`You already have reply pings disabled!`);
        } else {
            noReplyPings.push(msg.author.id);
            await writeFile('data/no_reply_pings.json', JSON.stringify(noReplyPings, undefined, 4));
            return 'Pings disabled!';
        }
    },

    async yesreplypings(msg: Message, argv: string[]): Promise<Response> {
        let index = noReplyPings.indexOf(msg.author.id);
        if (index === -1) {
            throw new BotError(`You already have reply pings enabled!`);
        } else {
            noReplyPings.splice(index, 1);
            await writeFile('data/no_reply_pings.json', JSON.stringify(noReplyPings, undefined, 4));
            return 'Pings enabled!';
        }
    },

    async da2a(msg: Message, argv: string[]): Promise<Response> {
        if (msg.reference) {
            let ref = await msg.fetchReference();
            if (ref.type === 0) {
                ref.reply({content: `Don't ask to ask, you should beg to ask! Many users on mathcord are important people with busy lives and you are inconveniencing them by asking a question. As such you should grovel and beg for the privilege of doing so.`, allowedMentions: {repliedUser: false}});
            }
        } else {
            msg.channel.send(`Don't ask to ask, you should beg to ask! Many users on mathcord are important people with busy lives and you are inconveniencing them by asking a question. As such you should grovel and beg for the privilege of doing so.`);
        }
    },

    'sim': cmdSim,

    'identify': cmdIdentify,
    'basic_identify': cmdBasicIdentify,
    'basicidentify': cmdBasicIdentify,
    'minmax': cmdMinmax,
    'identify_conduit': cmdIdentifyConduit,
    'identifyconduit': cmdIdentifyConduit,

    'hashsoup': cmdHashsoup,
    'apgencode': cmdApgencode,
    'apgdecode': cmdApgdecode,
    'population': cmdPopulation,
    'pop': cmdPopulation,
    
    'map_to_int': cmdMAPToINT,
    'maptoint': cmdMAPToINT,
    'map_to_hex_int': cmdMAPToHexINT,
    'maptohexint': cmdMAPToHexINT,
    'int_to_map': cmdINTToMAP,
    'inttomap': cmdINTToMAP,

    'rule_info': cmdRuleInfo,
    'ruleinfo': cmdRuleInfo,
    'normalize_rule': cmdNormalizeRule,
    'normalizerule': cmdNormalizeRule,
    'black_white_reverse': cmdBlackWhiteReverse,
    'black_white_reversal': cmdBlackWhiteReverse,
    'blackwhitereverse': cmdBlackWhiteReverse,
    'blackwhitereversal': cmdBlackWhiteReverse,
    'bwreverse': cmdBlackWhiteReverse,
    'bwreversal': cmdBlackWhiteReverse,
    'checkerboard_dual': cmdCheckerboardDual,
    'checkerboarddual': cmdCheckerboardDual,
    'cb_dual': cmdCheckerboardDual,
    'cbdual': cmdCheckerboardDual,

    'sssss': cmdSssss,
    '5s': cmdSssss,
    'sssssinfo': cmdSssssInfo,
    '5s_info': cmdSssssInfo,
    '5sinfo': cmdSssssInfo,

    'dyk': cmdDyk,

    'name': cmdName,
    'rename': cmdRename,
    'delete_name': cmdDeleteName,
    'deletename': cmdDeleteName,

    'sim_stats': cmdSimStats,
    'simstats': cmdSimStats,
    'save_sim_stats': cmdSaveSimStats,
    'savesimstats': cmdSaveSimStats,

    'alias': cmdAlias,
    'upload': cmdAlias,
    'unalias': cmdUnalias,
    'delete_alias': cmdUnalias,
    'deletealias': cmdUnalias,
    'lookup_alias': cmdLookupAlias,
    'lookupalias': cmdLookupAlias,
    'list_aliases': cmdListAliases,
    'listaliases': cmdListAliases,
    'aliases': cmdListAliases,

    'wiki': cmdWiki,

};


let previousMsgs: [string, Message][] = [];
let deleters: [string, string][] = [];
let runningCommands = new Set<string>();

const INTENTIONAL_ERRORS: string[] = ['Pattern too big for torus!'];

const ESCAPES: {[key: string]: string} = {
    'a': '\x07',
    'b': '\x08',
    'e': '\x1b',
    'f': '\f',
    'n': '\n',
    'r': '\r',
    't': '\t',
    'v': '\v',
};

const MULTILINE_CMDS: string[] = ['sim'];

async function runCommand(msg: Message): Promise<void> {
    if (msg.author.bot || msg.createdTimestamp < config.initTime || runningCommands.has(msg.id)) {
        return;
    }
    let data = msg.content;
    if (data.startsWith('!')) {
        data = data.slice(1);
    } else if (data.startsWith('ca.')) {
        data = data.slice(3);
    } else {
        return;
    }
    let cmd: string;
    let index = data.indexOf(' ');
    let index2 = data.indexOf('\n');
    if (index === -1 || index2 < index) {
        index = index2;
    }
    if (index === -1) {
        cmd = data;
        data = '';
    } else {
        cmd = data.slice(0, index);
        data = data.slice(index + 1);
    }
    cmd = cmd.toLowerCase();
    if (cmd in COMMANDS) {
        runningCommands.add(msg.id);
        let argv: string[] = [cmd];
        let currentArg = '';
        let quoteMode: 'none' | 'single' | 'double' = 'none';
        for (let i = 0; i < data.length; i++) {
            let char = data[i];
            if (char === '\\' && quoteMode !== 'single') {
                if (i === data.length - 1) {
                    currentArg += char;
                    continue;
                }
                char = data[i++];
                if (char in ESCAPES) {
                    currentArg += ESCAPES[char];
                } else if (char === 'x') {
                    currentArg += String.fromCharCode(parseInt(data.slice(i + 1, i + 3), 16));
                    i += 2;
                } else if (char === 'u') {
                    currentArg += String.fromCharCode(parseInt(data.slice(i + 1, i + 5), 16));
                    i += 4;
                } else if (char === 'U') {
                    currentArg += String.fromCharCode(parseInt(data.slice(i + 1, i + 6), 16));
                    i += 5;
                } else if ('0123456789'.includes(char)) {
                    currentArg += String.fromCharCode(parseInt(data.slice(i, i + 3), 8));
                    i += 2;
                } else {
                    currentArg += char;
                }
            } else if (char === "'") {
                if (quoteMode === 'none') {
                    quoteMode = 'single';
                } else if (quoteMode === 'single') {
                    quoteMode = 'none';
                } else {
                    currentArg += char;
                }
            } else if (char === '"') {
                if (quoteMode === 'none') {
                    quoteMode = 'double';
                } else if (quoteMode === 'single') {
                    currentArg += char;
                } else {
                    quoteMode = 'none';
                }
            } else if (char === '\n' && MULTILINE_CMDS.includes(cmd)) {
                argv.push(currentArg, '\n');
                currentArg = '';
            } else if ((char === ' ' || char === '\n') && quoteMode === 'none') {
                argv.push(currentArg);
                currentArg = '';
            } else {
                currentArg += char;
            }
        }
        if (currentArg.length > 0) {
            argv.push(currentArg);
        }
        try {
            let value = await COMMANDS[cmd](msg, argv);
            if (value) {
                let out: Message;
                let newDeleters: string[] = [msg.author.id];
                if (Array.isArray(value)) {
                    newDeleters.push(...value[1]);
                    value = value[0];
                }
                if (typeof value === 'string') {
                    out = await msg.reply({content: value, allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}});
                } else if (value instanceof _Message) {
                    out = value;
                } else {
                    (value as MessageReplyOptions).allowedMentions = {repliedUser: !noReplyPings.includes(msg.author.id), parse: []};
                    out = await msg.reply(value);
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
            if (error instanceof BotError || error instanceof lifeweb.RuleError || error instanceof lifewebRPF.RPFError || (error instanceof Error && (INTENTIONAL_ERRORS.includes(error.message) || error.message.startsWith('Invalid symmetry: ')))) {
                previousMsgs.push([msg.id, await msg.reply({content: 'Error: ' + error.message, allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}})]);
            } else if (error instanceof Error && error.message === 'Worker exited with code 1!') {
                previousMsgs.push([msg.id, await msg.reply({content: `Error: ${error.message} (try running the command again!)`, allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}})]);
            } else if (error instanceof DiscordAPIError && error.message.match(/Must be (2|4)000 or fewer in length/)) {
                previousMsgs.push([msg.id, await msg.reply({content: 'Error: Message too long!', allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}})]);
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
                previousMsgs.push([msg.id, await msg.reply({content, allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: ['users']}})]);
            }
        } finally {
            runningCommands.delete(msg.id);
        }
    }
}


let client = new Client({
    intents: [
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
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
});

let starboardChannel: TextChannel;
let sssssChannel: TextChannel;

client.once('clientReady', async () => {
    console.log('Logged in');
    starboardChannel = await client.channels.fetch(config.starboardChannel) as TextChannel;
    sssssChannel = await client.channels.fetch(config.sssssChannel) as TextChannel;
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
        await msg.reply({content, allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: ['users']}});
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
    if (msg.channel.id === config.starboardChannel) {
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


let starboard: Map<string, [string, string]> = new Map(JSON.parse(await readFile('data/starboard.json')));

async function getStarReactions(msg: _Message): Promise<string[]> {
    let react = msg.reactions.cache.get('⭐');
    if (!react) {
        let react2 = msg.reactions.resolve('⭐');
        if (react2) {
            react = react2;
        }
    }
    if (react) {
        return (await react.users.fetch()).map(x => x.id);
    } else {
        return [];
    }
}

async function updateStarboard(data: MessageReaction | PartialMessageReaction): Promise<void> {
    if (data.emoji.name !== '⭐') {
        return;
    }
    if (data.partial) {
        data = await data.fetch();
    }
    if (data.count === null) {
        return;
    }
    let msg = data.message;
    if (msg.createdTimestamp < config.initTime || !(msg.guildId === '357922255553953794' || msg.guildId === '1417233330679844937')) {
        return;
    }
    let users = (await data.users.fetch()).map(x => x.id);
    if (msg.channel.id === config.starboardChannel) {
        if (msg.reference) {
            msg = await msg.fetchReference();
            users.push(...(await getStarReactions(msg)));
        } else {
            msg = Array.from((await msg.channel.messages.fetch({limit: 1, after: msg.id})).values())[0];
            if (msg.reference) {
                msg = await msg.fetchReference();
                users.push(...(await getStarReactions(msg)));
            } else {
                return;
            }
        }
    }
    let senderId: string;
    if (msg.author) {
        senderId = msg.author.id;
    } else {
        return;
    }
    let entry = starboard.get(msg.id);
    if (entry) {
        users.push(...(await getStarReactions(await starboardChannel.messages.fetch(entry[0]))));
        users.push(...(await getStarReactions(await starboardChannel.messages.fetch(entry[1]))));
    }
    let users2 = Array.from(new Set(users)).filter(x => x !== senderId);
    if (msg.author?.id === data.client.user.id && msg.attachments.size === 1) {
        let msg2 = await msg.fetchReference();
        users2 = users2.filter(x => x !== msg2.author.id);
    }
    let count = users2.length;
    if (count >= config.starThreshold) {
        let text: string;
        if (count < Math.floor(config.starThreshold * 2)) {
            text = '⭐';
        } else if (count < Math.floor(config.starThreshold * 3)) {
            text = '🌟';
        } else if (count < Math.floor(config.starThreshold * 4)) {
            text = '💫';
        } else {
            text = '✨';
        }
        text += ` **${count}** `;
        if (msg.author?.id === data.client.user.id && msg.attachments.size === 1) {
            let msg2 = await msg.fetchReference();
            let data = findRLEFromText(msg2.content);
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
            (await starboardChannel.messages.fetch(entry[0])).edit({content: text, allowedMentions: {parse: []}});
        } else {
            let msg0 = await starboardChannel.send({content: text, allowedMentions: {parse: []}});
            let msg1 = await msg.forward(starboardChannel);
            starboard.set(msg.id, [msg0.id, msg1.id]);
            await writeFile('data/starboard.json', JSON.stringify(Array.from(starboard.entries())));
        }
    } else if (entry) {
        starboard.delete(msg.id);
        await starboardChannel.messages.delete(entry[0]);
        await starboardChannel.messages.delete(entry[1]);
    }
}

client.on('messageReactionAdd', updateStarboard);
client.on('messageReactionRemove', updateStarboard);
client.on('messageReactionRemoveAll', async msg => {
    let entry = starboard.get(msg.id);
    if (entry) {
        starboard.delete(msg.id);
        await starboardChannel.messages.delete(entry[0]);
        await starboardChannel.messages.delete(entry[1]);
    }
});


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


client.login(config.token);
