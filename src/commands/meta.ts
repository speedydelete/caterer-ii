
import {inspect} from 'node:util';

import {EmbedBuilder, Guild} from 'discord.js';
import * as lifeweb from '../../lifeweb/lib/index.js';
import * as lifewebRPF from '../../lifeweb/lib/editor/rpf.js';
import * as lifewebRuleSymmetries from '../../lifeweb/lib/rule_symmetries/index.js';

import {BotError, CommandCategory, CATEGORY_NAMES, Arg, requiredArg, requiredRestArg, optionalArg, Command, COMMANDS, COMMANDS_BY_CATEGORY, addCommand, addSuperCommand, commandValidator} from '../base.js';
import {readFile, writeFile, findRLE} from '../util.js';
import {aclData, aclValidator, aclAndExistsValidator, parseACL, aclToString, getACLUses} from '../acl.js';
import {aliases} from '../db.js';
import {client, noReplyPings} from '../index.js';


const HELP_TEMPLATE = `A cellular automata bot for the ConwayLife Lounge Discord server.

Commands:
$$$

This bot permanently stores your user ID when you use \`!noreplypings\`, and deletes it when you use \`!yesreplypings\`. So, to delete all your personal information that is stored by the bot, use \`!yesreplypings\`.

You can use Bash-style quoting and escaping in commands.

Type \`!help <command>\` for help for a specific command!`;

function formatArgUsage(arg: Arg): string {
    let out: string;
    if (arg.kind === 'required') {
        out = `<${arg.name}>`;
    } else if (arg.kind === 'required-variadic') {
        out = `${arg.name}...`;
    } else if (arg.kind === 'required-rest') {
        out = `...${arg.name}`;
    } else if (arg.kind === 'optional') {
        out = `[${arg.name}]`;
    } else if (arg.kind === 'optional-variadic') {
        out = `[${arg.name}...]`;
    } else if (arg.kind === 'optional-rest') {
        out = `[...${arg.name}]`;
    } else if (arg.kind === 'flag' || arg.kind === 'option') {
        let useAs: string[] = [];
        if (arg.name.length === 1) {
            useAs.push(`-${arg.name}`);
        } else {
            useAs.push(`--${arg.name}`);
        }
        for (let alias of arg.aliases) {
            if (alias.length === 1) {
                useAs.push(`-${alias}`);
            } else {
                useAs.push(`--${alias}`);
            }
        }
        let str = useAs.sort((x, y) => {
            if (x.length !== y.length) {
                return x.length - y.length;
            } else if (x < y) {
                return -1;
            } else if (x > y) {
                return 1;
            } else {
                return 0;
            }
        }).join('|');
        if (arg.kind === 'option') {
            if ('arg' in arg) {
                str += ` ${formatArgUsage(arg.arg)}`;
            } else {
                for (let subArg of arg.args) {
                    str += ` ${formatArgUsage(subArg)}`;
                }
            }
        }
        out = `[${str}]`;
    } else {
        throw new Error(`This error should not occur (invalid argument type: '${(arg as Arg).kind}')`);
    }
    return out;
}

addCommand(
    'help', 'meta', [],
    `Display a help message.`,
    [
        optionalArg('command', 'string', 'Command to display infomation for. If omitted or invalid, displays generic help/info message.'),
    ],
    async args => {
        if (args.command === undefined) {
            let out: string[] = [];
            for (let [category, commands] of Object.entries(COMMANDS_BY_CATEGORY) as [CommandCategory, Command[]][]) {
                if (category === 'sub' || category === 'secret') {
                    continue;
                }
                out.push(`* ${CATEGORY_NAMES[category as CommandCategory]}: ${commands.map(cmd => cmd.name).join(', ')}`);
            }
            return HELP_TEMPLATE.replace('$$$', out.join('\n'));
        } else {
            let cmdName = args.command.toLowerCase().replaceAll('_', '');
            let data = COMMANDS[cmdName];
            let title = `\`${cmdName}\` command documentation`;
            if (data.aliases.length > 0) {
                title += ` (aliases ${data.aliases.map(alias => `\`${alias}\``).join(', ')})`;
            }
            let desc: string;
            if (data.type === 'basic') {
                let usage: string[] = [];
                let argStrs: string[] = [];
                for (let [name, arg] of Object.entries(data.args)) {
                    usage.push(formatArgUsage(arg));
                    argStrs.push(`* \`${name}\`: ${arg.desc}`);
                }
                desc = `Usage: \`${usage.join(' ')}\`\n${data.desc}\nArguments:\n${argStrs.join('\n')}`;
            } else {
                desc = `${data.desc}\nSubcommands:\n${data.subCommands.map(cmd => `* \`${cmd}\``).join('\n')}`;
            }
            return {embeds: [(new EmbedBuilder()).setTitle(title).setDescription(desc)]};
        }
    },
);


const EVAL_PREFIX = '\nlet {' + Object.keys(lifeweb).join(', ') + '} = lifeweb;\nlet {' + Object.keys(lifewebRPF).join(', ') + '} = lifewebRPF;\nlet {' + Object.keys(lifewebRuleSymmetries).join(', ') + '} = lifewebRuleSymmetries;\n';

addCommand(
    'eval', 'meta', [],
    `Evaluates code (admin only).`,
    [
        requiredArg('code', 'string', 'The code to run'),
    ],
    async args => {
        if (args.msg.author.id !== '1253852708826386518') {
            throw new BotError('You are not speedydelete');
        }
        let code = args.code;
        if (!code.includes(';') && !code.includes('\n')) {
            code = 'return ' + code;
        }
        code = `return (async () => {${code}})()`;
        let out = await (new Function('client', 'msg', 'lifeweb', 'lifewebRPF', 'lifewebRuleSymmetries', 'aliases', 'findRLE', 'readFile', 'writeFile', '"use strict";' + EVAL_PREFIX + code))(client, args.msg, lifeweb, lifewebRPF, lifewebRuleSymmetries, aliases, findRLE, readFile, writeFile);
        if (typeof out === 'string') {
            return '```\n' + out + '\n```';
        } else {
            return '```ansi\n' + inspect(out, {
                colors: true,
                depth: 2,
                breakLength: 120,
            }).replaceAll('\x1b[22m', '\x1b[0m').replaceAll('\x1b[39m', '\x1b[0m') + '\n```';
        }
    },
    {
        sendTyping: true,
        noArgvParse: true,
    },
);


addCommand(
    'ping', 'meta', [],
    `Gets the latency.`,
    [],
    async args => {
        let msg = args.msg;
        let msg2 = await msg.reply({content: 'Pong!', allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}});
        msg2.edit({content: `Pong! Latency: ${Math.round(msg2.createdTimestamp - msg.createdTimestamp)} ms (Discord WebSocket: ${Math.round(client.ws.ping)} ms)`, allowedMentions: {repliedUser: !noReplyPings.includes(msg.author.id), parse: []}})
    },
);


async function saveACLs(): Promise<void> {
    await writeFile('data/acls.json', JSON.stringify(aclData));
}

addSuperCommand(
    'acl', 'meta', [],
    'Manage Access Control Lists (ACLs)',
    ['show', 'get', 'set', 'delete', 'list', 'uses', 'showcmd', 'getcmd', 'deletecmd'],
    `
ACLs are used to control access to coommands, they match properties of messages. Commands are always accessible by admins, regardless of the ACLs. By default, a command is inaccessible to non-admins.
The ACL format is alternative semantics for a subset of the ECMAScript grammar, an ACL is a ES expression.
IDs can be given as numeric snowflakes (the exact literal input is used), or as a name, wihch is lookup-ed when the comamnd is run, the names can be identifiers or string literals (though the command parser interferes with these).
Valid expression constructs:
* \`everyone\` - Matches any message
* \`user(id)\` - Matches messages sent by that specific user
* \`role(id)\` - Matches messages sent by users with that role
* \`channel(id)\` - Matches messages sent in that channel
* \`category(id)\` - Matches messages sent in a chanenl in that category
* \`server(id)\` - Matches messages sent in that server (aka guild)
* \`<id>\` - Matches the named ACL (set via !acl set) with that name (case-sensitive)
* \`!<acl>\` - Matches everything but the given expression
* \`<acl1> & <acl2>\` - Matches messages that match both ACLs
* \`<acl1> | <acl2>\` - Matches messages that match either of the ACLs
* \`<acl1> ^ <acl2>\` - Matches messages that match exactly 1 of the given ACLs
Parentheses can be used for grouping.
`,
);

addCommand(
    'acl show', 'sub', [],
    `Pretty-print an ACL.`,
    [
        requiredArg('acl', aclAndExistsValidator, 'The ACL to show'),
    ],
    async args => {
        return await aclToString(aclData.acls[args.acl], true);
    },
);

addCommand(
    'acl get', 'sub', [],
    `Print an ACL in the format used to input them.`,
    [
        requiredArg('acl', aclAndExistsValidator, 'The ACL to get'),
    ],
    async args => {
        return await aclToString(aclData.acls[args.acl], true);
    },
);

addCommand(
    'acl set', 'sub', [],
    `Set an ACL.`,
    [
        requiredArg('acl', aclValidator, 'The ACL to set'),
        requiredRestArg('value', 'string', 'The ACL expression to set it to, see help for !acl for an explanation'),
    ],
    async args => {
        let parsed = await parseACL(args.value, args.msg.guild as Guild);
        aclData.acls[args.acl] = parsed;
        await saveACLs();
        return 'ACL set!';
    }
);

addCommand(
    'acl delete', 'sub', [],
    `Delete an ACL, if it's unused.`,
    [
        requiredArg('acl', aclAndExistsValidator, 'The ACL to delete'),
    ],
    async args => {
        let acl = args.acl;
        let uses = getACLUses(acl);
        if (uses.length === 0) {
            delete aclData.acls[acl];
        } else {
            throw new BotError(`Cannot delete ACL '${acl}' because it is used in these places: ${uses.join(', ')}`);
        }
        await saveACLs();
        return 'ACL deleted!';
    },
);

addCommand(
    'acl list', 'sub', [],
    'List all the ACLs.',
    [],
    async () => {
        return Object.keys(aclData.acls).join(', ');
    },
);

addCommand(
    'acl uses', 'sub', [],
    'Show the places where an ACL is used.',
    [
        requiredArg('acl', aclAndExistsValidator, 'The ACL to check'),
    ],
    async args => {
        let uses = getACLUses(args.acl);
        if (uses.length === 0) {
            return `ACL is not used`;
        } else {
            return uses.join(', ');
        }
    },
);

addCommand(
    'acl showcmd', 'sub', [],
    `Pretty-print a command ACL.`,
    [
        requiredArg('command', commandValidator, 'The command to show the ACL for'),
    ],
    async args => {
        let cmd = args.command;
        if (!(cmd in aclData.commands)) {
            throw new BotError(`Command '${cmd}' is not bound to an ACL`);
        }
        return await aclToString(aclData.commands[cmd], true);
    },
);

addCommand(
    'acl getcmd', 'sub', [],
    `Print a command ACL in the format used to input them.`,
    [
        requiredArg('command', commandValidator, 'The command to get the ACL for'),
    ],
    async args => {
        let cmd = args.command;
        if (!(cmd in aclData.commands)) {
            throw new BotError(`Command '${cmd}' is not bound to an ACL`);
        }
        return await aclToString(aclData.acls[cmd], true);
    },
);

addCommand(
    'acl setcmd', 'sub', [],
    `Set a command ACL.`,
    [
        requiredArg('command', commandValidator, 'The command to set the ACL for'),
        requiredRestArg('value', 'string', 'The ACL expression to set it to, see help for !acl for an explanation'),
    ],
    async args => {
        let parsed = await parseACL(args.value, args.msg.guild as Guild);
        aclData.acls[args.command] = parsed;
        await saveACLs();
        return 'ACL set!';
    },
);

addCommand(
    'acl deletecmd', 'sub', [],
    `Delete a command ACL, making it unusable by everyone except for admins.`,
    [
        requiredArg('command', commandValidator, 'The command to delete the ACL for'),
    ],
    async args => {
        let cmd = args.command;
        if (!(cmd in aclData.commands)) {
            throw new BotError(`Command '${cmd}' is not bound to an ACL`);
        }
        delete aclData.commands[args.command];
        await saveACLs();
        return 'ACL deleted!';
    },
);


addCommand(
    'noreplypings', 'meta', [],
    `Disables reply pings when using commands.`,
    [],
    async args => {
        if (noReplyPings.includes(args.msg.author.id)) {
            throw new BotError(`You already have reply pings disabled!`);
        } else {
            noReplyPings.push(args.msg.author.id);
            await writeFile('data/no_reply_pings.json', JSON.stringify(noReplyPings, undefined, 4));
            return 'Pings disabled!';
        }
    },
);

addCommand(
    'yesreplypings', 'meta', [],
    `Enables reply pings when using commands.`,
    [],
    async args => {
        let index = noReplyPings.indexOf(args.msg.author.id);
        if (index === -1) {
            throw new BotError(`You already have reply pings enabled!`);
        } else {
            noReplyPings.splice(index, 1);
            await writeFile('data/no_reply_pings.json', JSON.stringify(noReplyPings, undefined, 4));
            return 'Pings enabled!';
        }
    },
);


const HELP = {

    'sim rand': {
        desc: 'Simulate a random pattern',
        args: [
            {
                name: 'size',
                optional: true,
                desc: 'The size of the pattern, such as 20x20 or 8x32 (default 16x16).',
            },
            {
                name: 'percent',
                optional: true,
                desc: 'The percentage to fill the pattern. Must start with a percent (such as 50%), can optionally be followed by  a comma then state weights, such as "50%,1-2=1,3=3" (sets states 1 and 2 to weight 1 but state 3 to weight 3). Ranges are inclusive, all states by default have weight 0.',
            },
            {
                name: 'rule',
                desc: 'The rule to simulate it in.'
            },
            {
                name: '\'time\'',
                optional: true,
                desc: 'Also show how much time it takes',
            },
            {
                name: 'parts',
                desc: 'How to run it. See !help sim.',
            },
        ],
    },

    minmax: {
        desc: 'Find the minimum and maximum rule of a pattern',
        args: [
            {
                name: 'generations',
                desc: 'Number of generations to run the pattern for.',
            },
        ],
    },

    identifyconduit: {
        desc: 'Identify a conduit (only works for B3/S23)',
        args: [
            {
                name: 'min_time',
                desc: 'Minimum number of generations before it can take it as a conduit',
            },
            {
                name: 'sep_gens',
                desc: 'Number of generations to run object separation for (default 0).',
            },
            {
                name: 'max_time',
                desc: 'Maximum time the conduit can take to work (default 512), also the maximum repeat time.',
            },
            {
                name: 'identify_gens',
                desc: 'Number of generations to identify for (default 256).',
            },
        ],
    },

    hashsoup: {
        desc: 'Get a Catagolue hashsoup',
        args: [
            {
                name: 'symmetry',
                desc: 'The symmetry to use.',
            },
            {
                name: 'seed',
                desc: 'The seed for the soup (k_whatever).',
            },
            {
                name: 'rule',
                desc: 'The rule to use.',
            },
        ],
    },

    apgencode: {
        desc: 'Get an unprefixed apgcode for any pattern. For prefixed apgcodes, use `!identify`.',
        args: [
            {
                name: '\'canonical\'',
                optional: true,
                desc: 'Whether to canonicalize the apgcode (by rotation/reflection). Can also be `canon` or `c`.',
            },
            {
                name: 'gens',
                optional: true,
                desc: 'Only valid with the canonical option. How many generations to run to find the canonicalized apgcode.',
            },
        ],
    },

    apgdecode: {
        desc: 'Decode an apgcode.',
        args: [
            {
                name: 'apgcode',
                desc: 'The apgcode to decode.',
            },
            {
                name: 'rule',
                optional: true,
                desc: 'The rule to use (default B3/S23).',
            },
        ],
    },

    population: {
        desc: 'Get the population of a pattern.',
        args: [],
        aliases: ['pop'],
    },

    inttomap: {
        desc: 'Converts an INT rule to a MAP rule.',
        args: [
            {
                name: 'rule',
                desc: 'The INT rule to convert.',
            },
        ],
    },

    ruleinfo: {
        desc: 'Gets information about a rule.',
        args: [
            {
                name: 'rule',
                desc: 'The rule to use.',
            },
        ],
    },

    normalizerule: {
        desc: 'Normalize a rulestring.',
        args: [],
    },

    blackwhitereverse: {
        desc: 'Gets the black/white reversal of a rule.',
        args: [
            {
                name: 'rule',
                desc: 'The rule to use.',
            },
        ],
        aliases: ['blackwhitereversal', 'bwreverse', 'bwreversal'],
    },

    checkerboarddual: {
        desc: 'Gets the checkerboard dual of a rule.',
        args: [
            {
                name: 'rule',
                desc: 'The rule to use.',
            },
        ],
        aliases: ['cbdual'],
    },

    sssss: {
        desc: 'Query the 5S database',
        args: [
            {
                name: 'type',
                optional: true,
                desc: 'The rulespace to use: int/intb0/ot/otb0/intgen/otgen, default int.',
            },
            {
                name: 'speed',
                desc: 'A speed, such as c/2, c/2o, c/2d, (2, 1)c/5, etc.',
            },
            {
                name: 'adjustables',
                optional: true,
                desc: `Whether to search for adjustable spaceships, can be 'yes', 'no', or 'only'.`,
            },
        ],
        aliases: ['5s'],
    },

    sssssinfo: {
        desc: 'Query the status of a specific rulespace in 5S',
        args: [
            {
                name: 'type',
                optional: true,
                desc: 'The rulespace to use: int/intb0/ot/otb0/intgen/otgen, default int.',
            },
        ],
        aliases: ['5sinfo'],
    },

    name: {
        desc: 'Find or set the name of a pattern',
        args: [
            {
                name: 'new_name',
                optional: true,
                desc: 'The new name. If provided, it will set the name. If omitted, it will just show the current name.'
            },
        ],
    },

    rename: {
        desc: 'Change the name of a pattern',
        args: [
            {
                name: 'new_name',
                desc: 'The new name.',
            },
        ],
        aliases: ['rename'],
    },

    deletename: {
        desc: 'Delete the name of a pattern',
        args: [],
    },

    simstats: {
        desc: 'Get statistics on the most popular rules used by !sim',
        args: [
            {
                name: 'page',
                optional: true,
                desc: 'The page to get data for, defaults to 0.'
            },
        ],
    },

    savesimstats: {
        desc: 'Save the !sim stats',
        args: [],
    },

    alias: {
        desc: 'Alias a rule',
        args: [
            {
                name: 'alias',
                desc: 'The new alias for the rule.',
            },
            {
                name: 'rule',
                desc: 'The rule being aliased to. Must be on a new line. Can be a file.',
            },
        ],
        aliases: ['upload'],
    },

    realias: {
        desc: 'Change an alias',
        args: [
            {
                name: 'alias',
                desc: 'The new alias for the rule.',
            },
            {
                name: 'rule',
                newline: true,
                desc: 'The rule being aliased to. Must be on a new line. Can be a file.',
            },
        ],
        aliases: ['upload'],
    },

    unalias: {
        desc: 'Remove an alias for a rule',
        args: [
            {
                name: 'alias',
                desc: 'The alias to remove.',
            },
        ],
        aliases: ['deletealias'],
    },

    lookupalias: {
        desc: 'Looks up an alias for a rule',
        args: [
            {
                name: 'alias',
                desc: 'The alias to look up.',
            },
        ],
    },

    listaliases: {
        desc: 'Lists all the aliases',
        args: [],
        aliases: ['aliases'],
    },

    wiki: {
        desc: 'Look up something on the ConwayLife.com wiki',
        args: [
            {
                name: 'page',
                desc: 'The page to look up',
            },
        ],
    },

};
