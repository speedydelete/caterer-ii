
import {inspect} from 'node:util';

import {Guild} from 'discord.js';
import {Pattern} from '../../lifeweb/lib/index.js';
import * as lifeweb from '../../lifeweb/lib/index.js';
import * as lifewebRPF from '../../lifeweb/lib/editor/rpf.js';
import * as lifewebRuleSymmetries from '../../lifeweb/lib/rule_symmetries/index.js';

import {BotError, readFile, writeFile, aliases, CommandCategory, CATEGORY_NAMES, PatternArg, Arg, requiredArg, requiredRestArg, optionalArg, Command, COMMANDS, COMMANDS_BY_CATEGORY, addCommand, addSuperCommand, findPatternInChannel, commandValidator, createEmbed} from '../base.js';
import {aclData, saveACLs, aclValidator, aclAndExistsValidator, parseACL, aclToString, getACLUses} from '../acl.js';
import {client} from '../index.js';


const HELP_TEMPLATE = `A cellular automata bot for the ConwayLife Lounge Discord server.

Commands:
$$$

You can use Bash-style quoting, escaping, and pipes in commands.

Type \`!help <command>\` for help for a specific command!`;

function formatArgUsage(arg: Exclude<Arg, PatternArg>): string {
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
        optionalArg('command', 'string', 'A command to display infomation for. If omitted, displays generic help/info message.'),
    ],
    async args => {
        if (args.command === undefined) {
            let out: string[] = [];
            for (let [category, name] of Object.entries(CATEGORY_NAMES)) {
                if (category === 'sub' || category === 'secret') {
                    continue;
                }
                out.push(`* ${name}: ${COMMANDS_BY_CATEGORY[category].map(cmd => `\`${cmd.name}\``).join(', ')}`);
            }
            return {type: 'string', value: HELP_TEMPLATE.replace('$$$', out.join('\n'))};
        } else {
            let cmdName = args.command.toLowerCase().replaceAll('_', '');
            if (!(cmdName in COMMANDS)) {
                throw new BotError(`Command '${cmdName}' does not exist`);
            }
            let cmd = COMMANDS[cmdName];
            let title = `\`${cmdName}\` command documentation`;
            if (cmd.aliases.length > 0) {
                title += ` (aliases ${cmd.aliases.map(alias => `\`${alias}\``).join(', ')})`;
            }
            let desc: string;
            if (cmd.type === 'basic') {
                let usage: string[] = [`${cmd.name}`];
                let argStrs: string[] = [];
                for (let arg of cmd.args) {
                    if (arg.kind === 'pattern') {
                        continue;
                    }
                    usage.push(formatArgUsage(arg));
                    argStrs.push(`* \`${arg.name}\`: ${arg.desc}`);
                }
                desc = `Usage: \`${usage.join(' ')}\`\n${cmd.desc}`;
                if (argStrs.length > 0) {
                    desc += `\nArguments:\n${argStrs.join('\n')}`;
                }
                if (cmd.patternArg) {
                    desc += `\nThis command finds a pattern posted farther up to use, if it cannot find one it will fail.`;
                }
            } else {
                desc = `${cmd.desc}\nSubcommands:\n${cmd.subCommands.map(subCmd => `* \`${cmd.name} ${subCmd}\``).join('\n')}`;
            }
            if (cmd.extraHelp) {
                desc += `\n${cmd.extraHelp}`;
            }
            return {type: 'message-spec', value: {embeds: [createEmbed(title, desc)]}};
        }
    },
);


const EVAL_PREFIX = '\nlet {' + Object.keys(lifeweb).join(', ') + '} = lifeweb;\nlet {' + Object.keys(lifewebRPF).join(', ') + '} = lifewebRPF;\nlet {' + Object.keys(lifewebRuleSymmetries).join(', ') + '} = lifewebRuleSymmetries;\n';

addCommand(
    'eval', 'meta', [],
    `Evaluates code (admin only).`,
    [
        requiredRestArg('code', 'string', 'The code to run.'),
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
        let out = await (new Function('client', 'msg', 'lifeweb', 'lifewebRPF', 'lifewebRuleSymmetries', 'aliases', 'readFile', 'writeFile', 'getPattern', '"use strict";' + EVAL_PREFIX + code))(client, args.msg, lifeweb, lifewebRPF, lifewebRuleSymmetries, aliases, readFile, writeFile, async (): Promise<Pattern> => {
            let out = await findPatternInChannel(args.msg);
            if (!out) {
                throw new BotError(`Cannot find pattern!`);
            }
            return out.p;
        });
        if (typeof out === 'string') {
            return {type: 'string', value: '```\n' + out + '\n```'};
        } else {
            return {type: 'string', value: '```ansi\n' + inspect(out, {
                colors: true,
                depth: 2,
                breakLength: 120,
            }).replaceAll('\x1b[22m', '\x1b[0m').replaceAll('\x1b[39m', '\x1b[0m') + '\n```'};
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
        let msg2 = await msg.reply({content: 'Pong!', allowedMentions: {repliedUser: true, parse: []}});
        msg2.edit({content: `Pong! Latency: ${Math.round(msg2.createdTimestamp - msg.createdTimestamp)} ms (Discord WebSocket: ${Math.round(client.ws.ping)} ms)`, allowedMentions: {repliedUser: true, parse: []}});
    },
);


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
        requiredArg('acl', aclAndExistsValidator, 'The ACL to show.'),
    ],
    async args => {
        return {type: 'string', value: await aclToString(client, aclData.acls[args.acl], true)};
    },
);

addCommand(
    'acl get', 'sub', [],
    `Print an ACL in the format used to input them.`,
    [
        requiredArg('acl', aclAndExistsValidator, 'The ACL to get.'),
    ],
    async args => {
        return {type: 'string', value: await aclToString(client, aclData.acls[args.acl], true)};
    },
);

addCommand(
    'acl set', 'sub', [],
    `Set an ACL.`,
    [
        requiredArg('acl', aclValidator, 'The ACL to set.'),
        requiredRestArg('value', 'string', 'The ACL expression to set it to, see help for !acl for an explanation.'),
    ],
    async args => {
        let parsed = await parseACL(args.value, args.msg.guild as Guild);
        aclData.acls[args.acl] = parsed;
        await saveACLs();
        return {type: 'string', value: 'ACL set!'};
    }
);

addCommand(
    'acl delete', 'sub', [],
    `Delete an ACL, if it's unused.`,
    [
        requiredArg('acl', aclAndExistsValidator, 'The ACL to delete.'),
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
        return {type: 'string', value: 'ACL deleted!'};
    },
);

addCommand(
    'acl list', 'sub', [],
    'List all the ACLs.',
    [],
    async () => {
        return {type: 'string', value: Object.keys(aclData.acls).join(', ')};
    },
);

addCommand(
    'acl uses', 'sub', [],
    'Show the places where an ACL is used.',
    [
        requiredArg('acl', aclAndExistsValidator, 'The ACL to check.'),
    ],
    async args => {
        let uses = getACLUses(args.acl);
        if (uses.length === 0) {
            return {type: 'string', value: `ACL is not used`};
        } else {
            return {type: 'string', value: uses.join(', ')};
        }
    },
);

addCommand(
    'acl showcmd', 'sub', [],
    `Pretty-print a command ACL.`,
    [
        requiredArg('command', commandValidator, 'The command to show the ACL for.'),
    ],
    async args => {
        let cmd = args.command;
        if (!(cmd in aclData.commands)) {
            throw new BotError(`Command '${cmd}' is not bound to an ACL`);
        }
        return {type: 'string', value: await aclToString(client, aclData.commands[cmd], true)};
    },
);

addCommand(
    'acl getcmd', 'sub', [],
    `Print a command ACL in the format used to input them.`,
    [
        requiredArg('command', commandValidator, 'The command to get the ACL for.'),
    ],
    async args => {
        let cmd = args.command;
        if (!(cmd in aclData.commands)) {
            throw new BotError(`Command '${cmd}' is not bound to an ACL`);
        }
        return {type: 'string', value: await aclToString(client, aclData.acls[cmd], true)};
    },
);

addCommand(
    'acl setcmd', 'sub', [],
    `Set a command ACL.`,
    [
        requiredArg('command', commandValidator, 'The command to set the ACL for.'),
        requiredRestArg('value', 'string', 'The ACL expression to set it to, see help for !acl for an explanation.'),
    ],
    async args => {
        let parsed = await parseACL(args.value, args.msg.guild as Guild);
        aclData.acls[args.command] = parsed;
        await saveACLs();
        return {type: 'string', value: 'Command ACL set!'};
    },
);

addCommand(
    'acl deletecmd', 'sub', [],
    `Delete a command ACL, making it unusable by everyone except for admins.`,
    [
        requiredArg('command', commandValidator, 'The command to delete the ACL for.'),
    ],
    async args => {
        let cmd = args.command;
        if (!(cmd in aclData.commands)) {
            throw new BotError(`Command '${cmd}' is not bound to an ACL`);
        }
        delete aclData.commands[args.command];
        await saveACLs();
        return {type: 'string', value: 'Command ACL deleted!'};
    },
);
