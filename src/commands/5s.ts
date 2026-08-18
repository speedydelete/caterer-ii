
import {LifewebError, parseSpeed, parse} from '../../lifeweb/lib/index.js';
import {Type, TYPE_NAMES} from '../../sssss/lib/index.js';

import {BotError, requiredArg, requiredRestArg, optionalArg, optionArg, addCommand} from '../base.js';


let rulespaces = Object.keys(TYPE_NAMES);

function rulespaceValidator(arg: string): Type | {name: string, reason?: string} {
    arg = arg.toLowerCase();
    if (!rulespaces.includes(arg)) {
        return {name: 'rulespace', reason: `not one of ${rulespaces.join('/')} (case insensitive)`};
    }
    return arg as Type;
}

function speedValidator(arg: string): {dx: number, dy: number, period: number} | {name: string, reason?: string} {
    try {
        return parseSpeed(arg);
    } catch (error) {
        if (error instanceof LifewebError) {
            let match = error.message.match(/\((.*)\)$/);
            if (!match) {
                throw error;
            }
            return {name: 'speed', reason: match[1]};
        } else {
            throw error;
        }
    }
}


addCommand(
    '5s', '5s', ['sssss'],
    'Query the [5S](<https://conwaylife.com/forums/viewtopic.php?t=2892>) database.',
    [
        optionalArg('rulespace', rulespaceValidator, `The rulespace to use, one of ${rulespaces.join('/')} (case insensitive, default 'int')`, 'int'),
        requiredRestArg('speed', speedValidator, 'The speed to look up.'),
        optionArg('adjustables', ['a'], requiredArg('value', {name: 'yes, no, or only', value: ['yes', 'no', 'only']}, 'why are you seeing this message 😭'), `Whether to include adjustable spaceships (default 'yes'), allowed values are 'yes', 'no', and 'only' (which means only adjustable spaceships).).`),
    ],
    async args => {
        let type = args.rulespace as Type;
        let {dx, dy, period} = args.speed;
        let resp = await fetch(`https://speedydelete.com/5s/api/get?type=${type}&dx=${dx}&dy=${dy}&period=${period}&adjustables=${args.adjustables ?? 'yes'}`);
        if (!resp.ok) {
            throw new BotError(`Server returned ${resp.status} ${resp.statusText}`);
        }
        // the second one allows for more generality with pipes
        // but loses the #C at the start that the server returns
        // return {type: 'string', value: await resp.text()};
        return {type: 'pattern', value: parse(await resp.text())};
    },
    {
        sendTyping: true,
    },
);


addCommand(
    '5sinfo', '5s', ['sssssinfo'],
    'Get information about the status of a [5S](<https://conwaylife.com/forums/viewtopic.php?t=2892>) rulespace.',
    [
        optionalArg('rulespace', rulespaceValidator, `The rulespace to use, one of ${rulespaces.join('/')} (case insensitive, default 'int')`, 'int'),
    ],
    async args => {
        let type = args.rulespace.toLowerCase();
        if (!rulespaces.includes(type)) {
            throw new BotError(`Invalid rulespace: '${type}' (expected one of ${rulespaces.join('/')}, case insensitive)`);
        }
        let resp = await fetch(`https://speedydelete.com/5s/api/getcounts?type=${type}`);
        if (resp.ok) {
            return {type: 'string', value: (await resp.text()).replaceAll('This rulespace', `The ${TYPE_NAMES[type as Type]} rulespace`)};
        } else {
            throw new BotError(`Server returned ${resp.status} ${resp.statusText}`);
        }
    },
    {
        sendTyping: true,
    },
);
