
import {inspect} from 'node:util';
import {Client, GatewayIntentBits, DiscordAPIError, Message as _Message, MessageReplyOptions, Guild, TextChannel, TextBasedChannel, Partials} from 'discord.js';
import * as lifeweb from '../lifeweb/lib/index.js';
import * as lifewebRPF from '../lifeweb/lib/editor/rpf.js';

import {BotError, Response, Message, readFile, writeFile, config, aliases, noReplyPings, findRLE} from './util.js';
import {aclData, matchesACL, cmdAcl} from './acl.js';
import {cmdHelp} from './help.js';
import {cmdSim, cmdIdentify, cmdBasicIdentify, cmdMinmax, cmdIdentifyConduit} from './core.js';
import {cmdHashsoup, cmdApgencode, cmdApgdecode, cmdPopulation, cmdToMAP, cmdRuleInfo, cmdNormalizeRule, cmdBlackWhiteReverse, cmdCheckerboardDual} from './ca.js';
import {cmdSssss, cmdSssssInfo, cmdDyk, cmdName, cmdRename, cmdDeleteName, cmdSimStats, cmdSaveSimStats, cmdAlias, cmdRealias, cmdUnalias, cmdLookupAlias, cmdListAliases} from './db.js';
import {cmdWiki} from './wiki.js';
import {check5S} from './notifier.js';
import {starboardChannels, cmdStarboardPrevent} from './starboard.js';


const EVAL_PREFIX = '\nlet {' + Object.keys(lifeweb).join(', ') + '} = lifeweb;\nlet {' + Object.keys(lifewebRPF).join(', ') + '} = lifewebRPF;\n';


function getChannel(msg: Message, args: string[]): [TextBasedChannel & {guild: Guild}, string] {
    let guildName = args[0];
    if (guildName === 'here') {
        return [msg.channel as TextBasedChannel & {guild: Guild}, args.slice(1).join(' ')];
    }
    if (!(guildName in config.serverNames)) {
        throw new BotError(`Invalid server: '${guildName}'`);
    }
    let guild = client.guilds.cache.get(config.serverNames[guildName]);
    if (!guild) {
        throw new BotError(`Invalid server: '${guildName}'`);
    }
    let channelName = args[1];
    for (let channel of guild.channels.cache.values()) {
        if (channel.name === channelName && channel.isTextBased()) {
            return [channel, args.slice(2).join(' ')];
        }
    }
    throw new BotError(`Nonexistent channel: '${channelName}'`);
}


export const COMMANDS: {[key: string]: string | ((msg: Message, argv: string[]) => Promise<Response>)} = Object.assign(Object.create(null), {

    help: cmdHelp,
    about: 'help',
    info: 'help',

    async eval(msg: Message, argv: string[]): Promise<Response> {
        if (msg.author.id === '1253852708826386518') {
            await msg.channel.sendTyping();
            let index = msg.content.indexOf(' ');
            let index2 = msg.content.indexOf('\n');
            if (index === -1 || (index2 !== -1 && index2 < index)) {
                index = index2;
            }
            if (index === -1) {
                throw new BotError(`No separating whitespace detected`);
            }
            let code = msg.content.slice(index + 1);
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
        } else {
            throw new Error('ACL is probably misconfigured for !eval');
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

    async say(msg: Message, argv: string[]): Promise<Response> {
        let deleteAfter = argv[1] === '-iq';
        if (deleteAfter) {
            argv = argv.slice(1);
        }
        if (msg.reference && msg.reference.type === 0) {
            let reply = await msg.fetchReference();
            await reply.reply(argv.slice(1).join(' '));
        } else {
            let [channel, args] = getChannel(msg, argv.slice(1));
            if (channel.isSendable()) {
                await channel.send(args);
            } else {
                throw new BotError(`Cannot send in channel`);
            }
        }
        if (deleteAfter && msg.deletable) {
            await msg.delete();
        }
    },

    async edit(msg: Message, argv: string[]): Promise<Response> {
        let deleteAfter = argv[1] === '-iq';
        if (deleteAfter) {
            argv = argv.slice(1);
        }
        if (msg.reference) {
            (await msg.fetchReference()).edit(argv.slice(1).join(' '));
        } else {
            let [channel, toSend] = getChannel(msg, argv.slice(1));
            let toEdit = await channel.messages.fetch(argv[3]);
            toEdit.edit(toSend);
        }
        if (deleteAfter && msg.deletable) {
            await msg.delete();
        }
    },

    async react(msg: Message, argv: string[]): Promise<Response> {
        let deleteAfter = argv[1] === '-iq';
        if (deleteAfter) {
            argv = argv.slice(1);
        }
        let toReact: Message;
        let emoji: string;
        if (msg.reference) {
            toReact = await msg.fetchReference();
            emoji = argv[1];
        } else {
            let [channel, msgId] = getChannel(msg, argv.slice(1));
            toReact = await channel.messages.fetch(msgId) as Message;
            emoji = argv[4];
        }
        let out: string;
        let match: RegExpMatchArray | null;
        if (match = emoji.match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/)) {
            out = match[3];
        } else if (match = emoji.match(/^:?([a-zA-Z0-9_]+):?$/)) {
            let name = match[1];
            let resolved = client.emojis.cache.find(e => e.name === name);
            if (resolved) {
                out = resolved.id;
            } else {
                throw new BotError(`Cannot find emoji: '${emoji}'`);
            }
        } else {
            out = emoji;
        }
        await toReact.react(out);
        setTimeout(async () => {
            let reaction = toReact.reactions.cache.get(out);
            if (reaction) {
                try {
                    await reaction.users.remove(client.user.id)
                } catch {}
            }
        }, 30000);
        if (deleteAfter && msg.deletable) {
           await msg.delete();
        }
    },

    async users(): Promise<Response> {
        let servers: [string, number][] = [];
        for (let [_, partialGuild] of await client.guilds.fetch()) {
            let guild = await partialGuild.fetch();
            servers.push([guild.name, guild.memberCount]);
        }
        servers = servers.sort((x, y) => y[1] - x[1]);
        let total = servers.map(x => x[1]).reduce((x, y) => x + y);
        let out = `No more than ${total} users across ${servers.length} servers:\n`;
        for (let [name, users] of servers) {
            out += `* ${name}: ${users} users\n`;
        }
        return out;
    },

    'acl': cmdAcl,
    'acl show': () => {throw new Error('hi');},
    'acl get': () => {throw new Error('hi');},
    'acl set': () => {throw new Error('hi');},
    'acl delete': () => {throw new Error('hi');},
    'acl list': () => {throw new Error('hi');},
    'acl uses': () => {throw new Error('hi');},
    'acl showcmd': () => {throw new Error('hi');},
    'acl getcmd': () => {throw new Error('hi');},
    'acl deletecmd': () => {throw new Error('hi');},

    'sim': cmdSim,

    'identify': cmdIdentify,
    'basicidentify': cmdBasicIdentify,
    'minmax': cmdMinmax,
    'identifyconduit': cmdIdentifyConduit,

    'hashsoup': cmdHashsoup,
    'apgencode': cmdApgencode,
    'apgdecode': cmdApgdecode,
    'population': cmdPopulation,
    'pop': 'population',

    'tomap': cmdToMAP,

    'ruleinfo': cmdRuleInfo,
    'normalizerule': cmdNormalizeRule,
    'blackwhitereverse': cmdBlackWhiteReverse,
    'blackwhitereversal': 'blackwhitereverse',
    'bwreverse': 'blackwhitereverse',
    'bwreversal': 'blackwhitereverse',
    'checkerboarddual': cmdCheckerboardDual,
    'cbdual': 'checkerboarddual',

    'sssss': cmdSssss,
    '5s': 'sssss',
    'sssssinfo': cmdSssssInfo,
    '5sinfo': 'sssssinfo',

    'dyk': cmdDyk,

    'name': cmdName,
    'rename': cmdRename,
    'deletename': cmdDeleteName,

    'simstats': cmdSimStats,
    'savesimstats': cmdSaveSimStats,

    'alias': cmdAlias,
    'upload': 'alias',
    'realias': cmdRealias,
    'reupload': 'realias',
    'unalias': cmdUnalias,
    'deletealias': cmdUnalias,
    'lookupalias': cmdLookupAlias,
    'listaliases': cmdListAliases,
    'aliases': 'listaliases',

    'wiki': cmdWiki,

    'starboardprevent': cmdStarboardPrevent,

});


let previousMsgs: [string, Message][] = [];
let deleters: [string, string][] = [];
let runningCommands = new Set<string>();

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
    cmd = cmd.toLowerCase().replaceAll('_', '');
    // if (Reflect.has(COMMANDS, cmd)) {
    if (cmd in COMMANDS) {
        let resolvedCommandFunc = COMMANDS[cmd];
        let resolvedCommandName = cmd;
        while (typeof resolvedCommandFunc === 'string') {
            resolvedCommandName = resolvedCommandFunc;
            resolvedCommandFunc = COMMANDS[resolvedCommandFunc];
            if (resolvedCommandFunc === undefined) {
                await msg.channel.send(`<@1253852708826386518> nonexistent alias detected for command '${cmd}'`);
                return;
            }
        }
        if (!matchesACL(msg, aclData.commands[resolvedCommandName])) {
            previousMsgs.push([msg.id, await msg.reply({content: 'Error: You do not have permission to run this command', allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}})]);
            return;
        }
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
            let value = await resolvedCommandFunc(msg, argv);
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
            if (error instanceof BotError || error instanceof lifeweb.LifewebError || error instanceof SyntaxError) {
                previousMsgs.push([msg.id, await msg.reply({content: `${error.name}: ` + error.message, allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}})]);
            } else if (error instanceof Error && (error.message === 'Worker exited with code 1!' || error.message === `ENOENT: no such file or directory, stat '/home/caterer/caterer-ii/sim.gif'` || error.message === `ENOENT: no such file or directory, stat '/home/caterer/caterer-ii/sim_base.gif'`)) {
                previousMsgs.push([msg.id, await msg.reply({content: `${error.name}: ${error.message} (try running the command again!)`, allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}})]);
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
