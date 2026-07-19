
import {Node, Expression, PrivateName} from '@babel/types';
import {parseExpression} from '@babel/parser';
import {CategoryChannel, Guild} from 'discord.js';

import {BotError, Message, Response, readFile, config, sentByAdmin} from './util.js';
import {COMMANDS, client} from './index.js';


export type ACL = 
    | {type: 'everyone'}
    | {type: 'user', id: string}
    | {type: 'role', id: string}
    | {type: 'channel', id: string}
    | {type: 'category', id: string}
    | {type: 'server', id: string}
    | {type: 'acl', acl: string}
    | {type: 'not', value: ACL}
    | {type: 'and', left: ACL, right: ACL}
    | {type: 'or', left: ACL, right: ACL};


export interface ACLData {
    acls: {[key: string]: ACL};
    commands: {[key: string]: ACL};
    // actions: {[key: string]: ACL};
    // registeredActions: string[];
}

export let aclData: ACLData = JSON.parse(await readFile('data/acls.json'));


function throwParsingError(node: Node, msg: string): never {
    let out = `Error while parsing ACL`;
    if (node.loc) {
        out += ` (at ${node.loc.start.line}:${node.loc.start.column})`;
    }
    out += `: ${msg}`;
    throw new BotError(out);
}

async function expressionToACL(node: Expression | PrivateName, guild: Guild): Promise<ACL> {
    if (node.type === 'Identifier') {
        if (node.name === 'everyone') {
            return {type: 'everyone'};
        } else if (!(node.name in aclData.acls)) {
            throwParsingError(node, `Nonexistent ACL: '${node.name}'`);
        } else {
            return {type: 'acl', acl: node.name};
        }
    } else if (node.type === 'UnaryExpression') {
        if (node.operator === '!' || node.operator === '~') {
            return {type: 'not', value: await expressionToACL(node.argument, guild)};
        } else {
            throwParsingError(node, `Bad unary operator: '${node.operator}`)
        }
    } else if (node.type === 'BinaryExpression') {
        if (node.operator === '&') {
            return {type: 'and', left: await expressionToACL(node.left, guild), right: await expressionToACL(node.right, guild)};
        } else if (node.operator === '|') {
            return {type: 'or', left: await expressionToACL(node.left, guild), right: await expressionToACL(node.right, guild)};
        } else {
            throwParsingError(node, `Bad binary operator: '${node.operator}'`);
        }
    } else if (node.type === 'CallExpression') {
        if (node.arguments.length !== 1) {
            throwParsingError(node, `Expected 1 argument for all functions`);
        }
        let arg: string;
        let argNode = node.arguments[0];
        if (argNode.type === 'StringLiteral') {
            arg = argNode.value;
        } else if (argNode.type === 'Identifier') {
            arg = argNode.name;
        } else if (argNode.type === 'NumericLiteral') {
            arg = (argNode.extra as {raw: string}).raw;
        } else {
            throwParsingError(node, `Invalid argument type (expected StringLiteral or Identifier): '${argNode.type}'`);
        }
        if (node.callee.type !== 'Identifier') {
            throwParsingError(node, `Invalid function node type (expected Identifier): '${node.callee.type}'`);
        }
        let func = node.callee.name;
        if (func === 'user') {
            if (arg.match(/^\d+$/) && arg.length > 16) {
                return {type: 'user', id: arg};
            }
            for (let [_, member] of await guild.members.fetch({query: arg, limit: 8})) {
                if (member.user.username === arg) {
                    return {type: 'user', id: member.id};
                }
            }
            throwParsingError(node, `Could not find user: '${arg}'`);
        } else if (func === 'role') {
            if (arg.match(/^\d+$/) && arg.length > 16) {
                return {type: 'role', id: arg};
            }
            for (let [_, role] of await guild.roles.fetch()) {
                if (role.name === arg) {
                    return {type: 'role', id: role.id};
                }
            }
            throwParsingError(node, `Could not find role: '${arg}'`);
        } else if (func === 'channel') {
            if (arg.match(/^\d+$/) && arg.length > 16) {
                return {type: 'channel', id: arg};
            }
            for (let [_, channel] of await guild.channels.fetch()) {
                if (channel && !(channel instanceof CategoryChannel) && channel.name === arg) {
                    return {type: 'channel', id: channel.id};
                }
            }
            throwParsingError(node, `Could not find channel: '${arg}'`);
        } else if (func === 'category') {
            if (arg.match(/^\d+$/) && arg.length > 16) {
                return {type: 'category', id: arg};
            }
            for (let [_, channel] of await guild.channels.fetch()) {
                if (channel && channel instanceof CategoryChannel && channel.name === arg) {
                    return {type: 'category', id: channel.id};
                }
            }
            throwParsingError(node, `Could not find category: '${arg}'`);
        } else if (func === 'server') {
            if (arg.match(/^\d+$/) && arg.length > 16) {
                return {type: 'server', id: arg};
            }
            for (let [_, guild] of await client.guilds.fetch()) {
                if (guild.name === arg) {
                    return {type: 'server', id: guild.id};
                }
            }
            throwParsingError(node, `Could not find server: '${arg}'`);
        } else {
            throwParsingError(node, `Nonexistent function: '${func}'`);
        }
    } else {
        throwParsingError(node, `Bad node type: '${node.type}'`);
    }
}

export async function parseACL(data: string, guild: Guild): Promise<ACL> {
    return await expressionToACL(parseExpression(data), guild);
}

export async function aclToString(acl: ACL, pretty: boolean): Promise<string> {
    if (acl.type === 'everyone') {
        return 'everyone';
    } else if (acl.type === 'user') {
        return pretty ? `<@${acl.id}>` : `user(${acl.id})`;
    } else if (acl.type === 'role') {
        return pretty ? `<@&${acl.id}>` : `user(${acl.id})`;
    } else if (acl.type === 'channel') {
        return pretty ? `<#${acl.id}>` : `channel(${acl.id})`;
    } else if (acl.type === 'category') {
        return pretty ? `<#${acl.id}>` : `category(${acl.id})`;
    } else if (acl.type === 'server') {
        return pretty ? `server('${(await client.guilds.fetch(acl.id)).name}')` : `server(${acl.id})`;
    } else if (acl.type === 'acl') {
        return acl.acl;
    } else if (acl.type === 'not') {
        return `!${aclToString(acl.value, pretty)}`;
    } else if (acl.type === 'and') {
        return `(${aclToString(acl.left, pretty)} & ${aclToString(acl.right, pretty)})`;
    } else if (acl.type === 'or') {
        return `(${aclToString(acl.left, pretty)} | ${aclToString(acl.right, pretty)})`;
    } else {
        throw new Error(`Invalid ACL type: '${(acl as any).type}'`);
    }
}

function _matchesACL(msg: Message, acl: ACL): boolean {
    if (acl.type === 'everyone') {
        return true;
    } else if (acl.type === 'user') {
        return msg.author.id === acl.id;
    } else if (acl.type === 'role') {
        if (!msg.member) {
            return false;
        }
        return msg.member.roles.cache.has(acl.id);
    } else if (acl.type === 'channel') {
        return msg.channel.id === acl.id;
    } else if (acl.type === 'category') {
        if (msg.channel.isDMBased()) {
            return false;
        }
        return msg.channel.parent?.id === acl.id;
    } else if (acl.type === 'server') {
        return msg.guild?.id === acl.id;
    } else if (acl.type === 'acl') {
        if (acl.acl in aclData.acls) {
            return _matchesACL(msg, aclData.acls[acl.acl]);
        } else {
            throw new Error(`Could not resolve ACL '${acl.acl}'`);
        }
    } else if (acl.type === 'not') {
        return !_matchesACL(msg, acl);
    } else if (acl.type === 'and') {
        return _matchesACL(msg, acl.left) && _matchesACL(msg, acl.right);
    } else if (acl.type === 'or') {
        return _matchesACL(msg, acl.left) || _matchesACL(msg, acl.right);
    } else {
        throw new Error(`Invalid ACL type: '${(acl as any).type}'`);
    }
}

export function matchesACL(msg: Message, acl: ACL | undefined): boolean {
    return Boolean(sentByAdmin(msg) || (acl && _matchesACL(msg, acl)));
}

// export function hasACLAction(msg: Message, action: string): boolean {
//     return config.admin === msg.author.id || (action in acls.actions && _matchesACL(msg, acls.actions[action]));
// }

// export function registerACLAction(action: string): void {
//     if (!acls.registeredActions.includes(action)) {
//         acls.registeredActions.push(action);
//     }
// }

function _aclIsUsed(name: string, acl: ACL): boolean {
    if (acl.type === 'acl') {
        return acl.acl === name;
    } else if (acl.type === 'not') {
        return _aclIsUsed(name, acl.value);
    } else if (acl.type === 'and' || acl.type === 'or') {
        return _aclIsUsed(name, acl.left) || _aclIsUsed(name, acl.right);
    } else {
        return false;
    }
}

export function getACLUses(name: string): string[] {
    let out: string[] = [];
    for (let [aclName, acl] of Object.entries(aclData.acls)) {
        if (_aclIsUsed(name, acl)) {
            out.push(`ACL '${aclName}'`);
        }
    }
    for (let [command, acl] of Object.entries(aclData.commands)) {
        if (_aclIsUsed(name, acl)) {
            out.push(`command '${command}'`);
        }
    }
    return out;
}


export async function cmdAcl(msg: Message, argv: string[]): Promise<Response> {
    let cmd = argv[1].toLowerCase().replaceAll(/[ _]/g, '').replaceAll('command', 'cmd');
    if (!matchesACL(msg, aclData.commands[`acl ${cmd}`])) {
        throw new BotError(`You do not have permission to run this subcommand`);
    }
    let args = argv.slice(2);
    if (cmd === 'show') {
        let name = args.join(' ');
        if (!(name in aclData.acls)) {
            throw new BotError(`ACL '${name}' does not exist`);
        }
        return aclToString(aclData.acls[name], true);
    } else if (cmd === 'get') {
        let name = args.join(' ');
        if (!(name in aclData.acls)) {
            throw new BotError(`ACL '${name}' does not exist`);
        }
        return aclToString(aclData.acls[name], false);
    } else if (cmd === 'set') {
        let name = args[0];
        let acl = await parseACL(args.slice(1).join(' '), msg.guild as Guild);
        aclData.acls[name] = acl;
        return 'ACL set!';
    } else if (cmd === 'delete') {
        let name = args.join(' ');
        if (!(name in aclData.acls)) {
            throw new BotError(`ACL '${name}' does not exist`);
        }
        let uses = getACLUses(name);
        if (uses.length === 0) {
            delete aclData.acls[name];
        } else {
            throw new BotError(`ACL '${name}' is used in these places: ${uses.join(', ')}`);
        }
    } else if (cmd === 'uses') {
        let name = args.join(' ');
        if (!(name in aclData.acls)) {
            throw new BotError(`ACL '${name}' does not exist`);
        }
        let uses = getACLUses(name);
        if (uses.length === 0) {
            return `ACL is not used`;
        } else {
            return uses.join(', ');
        }
    } else if (cmd === 'showcmd') {
        let name = args.join(' ');
        if (!(name in COMMANDS)) {
            throw new BotError(`Command '${name}' does not exist`);
        }
        if (!(name in aclData.commands)) {
            throw new BotError(`Command '${name}' is not bound to an ACL`);
        }
        return aclToString(aclData.commands[name], true);
    } else if (cmd === 'getcmd') {
        let name = args.join(' ');
        if (!(name in COMMANDS)) {
            throw new BotError(`Command '${name}' does not exist`);
        }
        if (!(name in aclData.commands)) {
            throw new BotError(`Command '${name}' is not bound to an ACL`);
        }
        return aclToString(aclData.commands[name], false);
    } else if (cmd === 'setcmd') {
        let name = args.join(' ');
        if (!(name in COMMANDS)) {
            throw new BotError(`Command '${name}' does not exist`);
        }
        let acl = await parseACL(args.slice(1).join(' '), msg.guild as Guild);
        aclData.commands[name] = acl;
    } else if (cmd === 'deletecmd') {
        let name = args.join(' ');
        if (!(name in COMMANDS)) {
            throw new BotError(`Command '${name}' does not exist`);
        }
        if (!(name in aclData.commands)) {
            throw new BotError(`Command '${name}' is not bound to an ACL`);
        }
        delete aclData.commands[name];
        return 'Command ACL deleted!';
    } else {
        throw new BotError(`Invalid subcommand: '${cmd}'`);
    }
}
