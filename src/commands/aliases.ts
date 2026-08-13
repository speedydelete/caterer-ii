
import {RuleError, createPattern} from '../../lifeweb/lib/index.js';

import {BotError, readFile, writeFile, requiredRestArg, addCommand} from '../base.js';


export let aliases: {[key: string]: string} = Object.assign(Object.create(null), JSON.parse(await readFile('data/aliases.json')));

export async function saveAliases(): Promise<void> {
    await writeFile('data/aliases.json', JSON.stringify(aliases, undefined, 4));
}


addCommand(
    'alias', 'aliases', [],
    'Create an alias from a rule to another rule.\nSyntax:\n```\n!alias <alias to set>\n<rule to alias to>',
    [],
    async args => {
        let msg = args.msg;
        let data = msg.content.slice(msg.content.indexOf(' ') + 1).split('\n');
        let alias = data[0].toLowerCase().trim();
        if (alias === '') {
            throw new BotError('No alias provided!');
        }
        let isValidRule = true;
        try {
            createPattern(alias);
        } catch (error) {
            if (error instanceof RuleError) {
                isValidRule = false;
            } else {
                throw error;
            }
        }
        if (isValidRule) {
            throw new BotError('Did not add alias because it is a valid rule');
        }
        let rule = data.slice(1).join('\n');
        if (rule === '') {
            if (msg.attachments.size > 0) {
                let attachment = msg.attachments.first();
                if (attachment) {
                    rule = await (await fetch(attachment.url)).text();
                }
            }
            if (rule === '') {
                throw new BotError('Cannot alias to an empty rule.\n\nThe proper syntax is:\n```\n!alias <alias>\n<rule>\n```');
            }
        }
        if (alias in aliases) {
            throw new BotError('Alias is already used');
        }
        aliases[alias] = rule;
        await saveAliases();
        return {type: 'string', value: 'Alias set!'};
    }
);

addCommand(
    'realias', 'aliases', [],
    'Change an alias from a rule to another rule.\nSyntax:\n```\n!realias <alias to change>\n<rule to alias to>',
    [],
    async args => {
        let msg = args.msg;
        let data = msg.content.slice(msg.content.indexOf(' ') + 1).split('\n');
        let alias = data[0].toLowerCase().trim();
        if (alias === '') {
            throw new BotError('No alias provided!');
        }
        let isValidRule = true;
        try {
            createPattern(alias);
        } catch (error) {
            if (error instanceof RuleError) {
                isValidRule = false;
            } else {
                throw error;
            }
        }
        if (isValidRule) {
            throw new BotError('Did not add alias because it is a valid rule');
        }
        let rule = data.slice(1).join('\n');
        if (rule === '') {
            if (msg.attachments.size > 0) {
                let attachment = msg.attachments.first();
                if (attachment) {
                    rule = await (await fetch(attachment.url)).text();
                }
            }
            if (rule === '') {
                throw new BotError('Cannot alias to an empty rule.\n\nThe proper syntax is:\n```\n!alias <alias>\n<rule>\n```');
            }
        }
        if (!(alias in aliases)) {
            throw new BotError('Alias is not used');
        }
        aliases[alias] = rule;
        await saveAliases();
        return {type: 'string', value: 'Alias changed!'};
    }
);

addCommand(
    'deletealias', 'aliases', ['unalias'],
    'Delete an aliased rule.',
    [
        requiredRestArg('alias', 'string', 'The alias to delete.'),
    ],
    async args => {
        let alias = args.alias;
        if (!(alias in aliases)) {
            throw new BotError(`Alias does not exist`);
        }
        delete aliases[alias];
        await saveAliases();
        return {type: 'string', value: 'Alias deleted!'};
    },
);

addCommand(
    'lookupalias', 'aliases', [],
    'Look up what an aliased rule is.',
    [
        requiredRestArg('alias', 'string', 'The alias to look up.'),
    ],
    async args => {
        let alias = args.alias;
        if (!(alias in aliases)) {
            throw new BotError(`Alias does not exist`);
        }
        let out: string[] = [alias];
        let key = alias.toLowerCase();
        while (!(key in aliases)) {
            alias = aliases[key];
            key = alias.toLowerCase();
            try {
                createPattern(alias);
            } catch (error) {
                if (error instanceof RuleError) {
                    if (out.includes(alias)) {
                        out.push(alias + ' (recursion)')
                        break;
                    } else {
                        out.push(alias);
                        continue;
                    }
                } else {
                    throw error;
                }
            }
            out.push(alias);
            break;
        }
        return {type: 'string', value: out.map(x => '```\n' + x + '```').join('')};
    },
);

addCommand(
    'listaliases', 'aliases', ['aliases'],
    'List all the aliases.',
    [],
    async () => {
        return {type: 'string', value: Object.keys(aliases).join('\n')};
    },
);
