
import {Message as _Message, Guild, TextBasedChannel} from 'discord.js';

import {BotError, Message, addCommand, config} from '../base.js';
import {client} from '../index.js';


addCommand(
    'pig', 'secret', [],
    `React with a pig, if used as a reply, will react to the replied message.`,
    [],
    async args => {
        let msg = args.msg;
        if (msg.reference) {
            await (await msg.fetchReference()).react('🐷');
        } else {
            await msg.react('🐷');
        }
    },
);


addCommand(
    'da2a', 'secret', [],
    `See https://discord.com/channels/268882317391429632/1446065612227874847 for context.`,
    [],
    async args => {
        let msg = args.msg;
        let out: Message | undefined = undefined;
        if (msg.reference) {
            let ref = await msg.fetchReference();
            if (ref.type === 0) {
                out = await ref.reply({content: `Don't ask to ask, you should beg to ask! Many users on mathcord are important people with busy lives and you are inconveniencing them by asking a question. As such you should grovel and beg for the privilege of doing so.`, allowedMentions: {repliedUser: false}});
            }
        }
        if (!out) {
            out = await msg.channel.send(`Don't ask to ask, you should beg to ask! Many users on mathcord are important people with busy lives and you are inconveniencing them by asking a question. As such you should grovel and beg for the privilege of doing so.`);
        }
        return {type: 'already-sent', value: out};
    },
);


function getChannel(msg: Message, args: string[]): [TextBasedChannel & {guild: Guild}, string[]] {
    let guildName = args[0];
    if (guildName === 'here') {
        return [msg.channel as TextBasedChannel & {guild: Guild}, args.slice(1)];
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
            return [channel, args.slice(2)];
        }
    }
    throw new BotError(`Nonexistent channel: '${channelName}'`);
}

addCommand(
    'say', 'secret', [],
    `Send a message.`,
    [],
    async args => {
        let msg = args.msg;
        let argv = args.argv.slice(1);
        let deleteAfter = argv[0] === '-iq';
        if (deleteAfter) {
            argv = argv.slice(1);
        }
        if (msg.reference && msg.reference.type === 0) {
            let replyTo = await msg.fetchReference();
            await replyTo.reply(argv.join(' '));
        } else {
            let [channel, toSend] = getChannel(msg, argv);
            if (channel.isSendable()) {
                await channel.send(toSend.join(' '));
            } else {
                throw new BotError(`Cannot send in channel`);
            }
        }
        if (deleteAfter && msg.deletable) {
            await msg.delete();
        }
    },
    {
        noArgParse: true,
    },
);

addCommand(
    'edit', 'secret', [],
    `Edit a message.`,
    [],
    async args => {
        let msg = args.msg;
        let argv = args.argv.slice(1);
        let deleteAfter = argv[0] === '-iq';
        if (deleteAfter) {
            argv = argv.slice(1);
        }
        if (msg.reference) {
            (await msg.fetchReference()).edit(argv.join(' '));
        } else {
            let [channel, args] = getChannel(msg, argv);
            let toEdit = await channel.messages.fetch(args[0]);
            toEdit.edit(args.slice(1).join(' '));
        }
        if (deleteAfter && msg.deletable) {
            await msg.delete();
        }
    },
    {
        noArgParse: true,
    },
);

addCommand(
    'react', 'secret', [],
    `React to a message and unreact after 30 seconds, so you can react to it before it unreacts for NQN!`,
    [],
    async args => {
        let msg = args.msg;
        let argv = args.argv.slice(1);
        let deleteAfter = argv[0] === '-iq';
        if (deleteAfter) {
            argv = argv.slice(1);
        }
        let toReact: Message;
        let emoji: string;
        if (msg.reference) {
            toReact = await msg.fetchReference();
            emoji = argv[0];
        } else {
            let [channel, args] = getChannel(msg, argv);
            toReact = await channel.messages.fetch(args[0]) as Message;
            emoji = args.slice(1).join(' ');
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
    {
        noArgParse: true,
    },
);


addCommand(
    'users', 'secret', [],
    `Display information about the number of users of the bot.`,
    [],
    async () => {
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
        return {type: 'string', value: out};
    },
);
