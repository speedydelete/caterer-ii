
import {Message as _Message} from 'discord.js';

import {BotError, Message, addCommand} from '../base.js';
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
        if (!msg.reference) {
            throw new Error(`!react must be used as a reply`);
        }
        if (argv.length > 1) {
            throw new Error(`Too many arguments provided to !react`);
        }
        let toReact = await msg.fetchReference();
        let emoji = argv[0];
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
