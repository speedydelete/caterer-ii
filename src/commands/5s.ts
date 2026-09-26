
import {LifewebError, parseSpeed, parse} from '../../lifeweb/lib/index.js';
import {Rulespace, RULESPACES, RULESPACE_NAMES, isRulespace} from '../../sssss/lib/index.js';

import {BotError, ValidatorResult, requiredArg, requiredRestArg, optionalArg, optionArg, addCommand} from '../base.js';


function rulespaceValidator(arg: string): ValidatorResult<Rulespace> {
    arg = arg.toLowerCase();
    if (!isRulespace(arg)) {
        return {isError: true, name: 'rulespace', reason: `not one of ${RULESPACES.join('/')} (case insensitive)`};
    }
    return {isError: false, value: arg};
}

function speedValidator(arg: string): ValidatorResult<{dx: number, dy: number, period: number}> {
    try {
        return {isError: false, value: parseSpeed(arg)};
    } catch (error) {
        if (error instanceof LifewebError) {
            let match = error.message.match(/\((.*)\)$/);
            if (!match) {
                throw error;
            }
            return {isError: true, name: 'speed', reason: match[1]};
        } else {
            throw error;
        }
    }
}


addCommand(
    '5s', '5s', ['sssss'],
    'Query the [5S](<https://conwaylife.com/forums/viewtopic.php?t=2892>) database.',
    [
        optionalArg('rulespace', rulespaceValidator, `The rulespace to use, one of ${RULESPACES.join('/')} (case insensitive, default 'int')`, 'int'),
        requiredRestArg('speed', speedValidator, 'The speed to look up.'),
        optionArg('adjustables', ['a'], requiredArg('value', {name: 'yes, no, or only', value: ['yes', 'no', 'only']}, 'why are you seeing this message 😭'), `Whether to include adjustable spaceships (default 'yes'), allowed values are 'yes', 'no', and 'only' (which means only adjustable spaceships).).`),
    ],
    async args => {
        let space = args.rulespace;
        let {dx, dy, period} = args.speed;
        let resp = await fetch(`https://speedydelete.com/5s/api/get?rulespace=${space}&dx=${dx}&dy=${dy}&period=${period}&adjustables=${args.adjustables ?? 'yes'}`);
        if (!resp.ok) {
            throw new BotError(`Server returned ${resp.status} ${resp.statusText}`);
        }
        if (args.willBePiped) {
            return {type: 'pattern', value: parse(await resp.text())};
        } else {
            return {type: 'string', value: await resp.text()};
        }
    },
    {
        sendTyping: true,
    },
);


addCommand(
    '5sinfo', '5s', ['sssssinfo'],
    'Get information about the status of a [5S](<https://conwaylife.com/forums/viewtopic.php?t=2892>) rulespace.',
    [
        optionalArg('rulespace', rulespaceValidator, `The rulespace to use, one of ${RULESPACES.join('/')} (case insensitive, default 'int')`, 'int'),
    ],
    async args => {
        let space = args.rulespace;
        let resp = await fetch(`https://speedydelete.com/5s/api/getcounts?rulespace=${space}`);
        if (resp.ok) {
            return {type: 'string', value: (await resp.text()).replaceAll('This rulespace', `The ${RULESPACE_NAMES[space]} rulespace`)};
        } else {
            throw new BotError(`Server returned ${resp.status} ${resp.statusText}`);
        }
    },
    {
        sendTyping: true,
    },
);
