
import {MessageOptions, SendHandle} from 'node:child_process';
import {Message as _Message, OmitPartialGroupDMChannel} from 'discord.js';

import {sendMessage} from './ipc_and_error_setup.js';
import {readFile} from './util.js';


export class BotError extends Error {

    name: string = 'BotError';
    [Symbol.toStringTag]: string = 'BotError';

}


export type Message = OmitPartialGroupDMChannel<_Message>;

export type Response = undefined | void | Parameters<Message['reply']>[0] | Message | [Parameters<Message['reply']>[0] | Message, string[]];


export type CommandCategory = 'sub' | 'secret' | 'meta' | 'sim' | 'identify' | 'patterns' | 'rules' | '5s' | 'stats' | 'aliases' | 'names' | 'other';

export const CATEGORY_NAMES: {[K in CommandCategory]: string} = {
    'sub': 'Subcommands',
    'secret': 'Secret',
    'meta': 'Meta',
    'sim': 'Simulation',
    'identify': 'Identification',
    'patterns': 'Patterns',
    'rules': 'Rules',
    '5s': '5S',
    'stats': 'Statistics',
    'aliases': 'Aliases',
    'names': 'Names',
    'other': 'Other',
};


export type Validator = (arg: string) => string | {name: string, reason?: string};

export type SingleArgTypeValue = 'string' | 'number' | 'boolean' | Validator | {name: string, value: (string | number | boolean)[] | RegExp};
export type ArgTypeValue = SingleArgTypeValue | SingleArgTypeValue[];

export type SingleOptionTypeValue = [string, SingleArgTypeValue];
export type OptionTypeValue = SingleOptionTypeValue | SingleOptionTypeValue[];

export type PosArgType<Name extends string = string> =
    {name: Name, desc: string} & (
        // required
        | {type: 'required', value: ArgTypeValue}
        // required, eats everything after it
        | {type: 'variadic', value: SingleArgTypeValue}
        // required, eats everything after it and combines it
        | {type: 'rest', value: SingleArgTypeValue}
        // optional
        | {type: 'optional', value: ArgTypeValue}
        // optional, eats everything after it
        | {type: 'optional-variadic', value: SingleArgTypeValue}
        // optional, eats everything after it and combines it
        | {type: 'optional-rest', value: SingleArgTypeValue}
    )
;

export type OptionArgType<Name extends string = string> = 
    {name: Name, desc: string, aliases: string[]} & (
        // boolean
        | {type: 'flag'}
        // has arguments
        | {type: 'option', value: OptionTypeValue}
        // eats everything up to the next flag, cannot be empty
        | {type: 'variadic-option', value: SingleOptionTypeValue}
        // eats everything up to the next flag and combines it, cannot be empty
        | {type: 'rest-option', value: SingleOptionTypeValue}
    )
;

export type ArgType<Name extends string = string> = PosArgType<Name> | OptionArgType<Name>;

export function requiredArg<Name extends string, Value extends ArgTypeValue>(name: Name, value: Value, desc: string): {name: Name, desc: string, type: 'required', value: Value} {
    return {name, desc, type: 'required', value};
}

export function variadicArg<Name extends string, Value extends SingleArgTypeValue>(name: Name, value: Value, desc: string): {name: Name, desc: string, type: 'variadic', value: Value} {
    return {name, desc, type: 'variadic', value};
}

export function restArg<Name extends string, Value extends SingleArgTypeValue>(name: Name, value: Value, desc: string): {name: Name, desc: string, type: 'rest', value: Value} {
    return {name, desc, type: 'rest', value};
}

export function optionalArg<Name extends string, Value extends ArgTypeValue>(name: Name, value: Value, desc: string): {name: Name, desc: string, type: 'optional', value: Value} {
    return {name, desc, type: 'optional', value};
}

export function optionalVariadicArg<Name extends string, Value extends SingleArgTypeValue>(name: Name, value: Value, desc: string): {name: Name, desc: string, type: 'variadic', value: Value} {
    return {name, desc, type: 'variadic', value};
}

export function optionalRestArg<Name extends string, Value extends SingleArgTypeValue>(name: Name, value: Value, desc: string): {name: Name, desc: string, type: 'rest', value: Value} {
    return {name, desc, type: 'rest', value};
}

export function flagArg<Name extends string>(name: Name, aliases: string[], desc: string): {name: Name, desc: string, aliases: string[]} {
    return {name, desc, aliases};
}

export function optionArg<Name extends string, Value extends OptionTypeValue>(name: Name, value: Value, aliases: string[], desc: string): {name: Name, desc: string, aliases: string[], type: 'option', value: Value} {
    return {name, desc, aliases, type: 'option', value};
}

export function variadicOptionArg<Name extends string, Value extends SingleOptionTypeValue>(name: Name, value: Value, aliases: string[], desc: string): {name: Name, desc: string, aliases: string[], type: 'variadic-option', value: Value} {
    return {name, desc, aliases, type: 'variadic-option', value};
}

export function restOptionArg<Name extends string, Value extends SingleOptionTypeValue>(name: Name, value: Value, aliases: string[], desc: string): {name: Name, desc: string, aliases: string[], type: 'rest-option', value: Value} {
    return {name, desc, aliases, type: 'rest-option', value};
}


export type ValueOfSingleArgTypeValue<T extends SingleArgTypeValue | SingleOptionTypeValue> =
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends 'boolean' ? boolean :
    T extends ((arg: string) => true | string) ? string :
    T extends {options: Set<infer U>} ? U :
    T extends {options: RegExp} ? string :
    T extends [string, infer U extends SingleArgTypeValue] ? ValueOfSingleArgTypeValue<U> :
    never
;

export type ValueOfArgTypeValue<T extends ArgTypeValue | OptionTypeValue> = 
    T extends SingleArgTypeValue ? ValueOfSingleArgTypeValue<T> :
    T extends infer U extends SingleArgTypeValue[] ? {[K in keyof U]: K extends string | symbol ? U[K] : ValueOfSingleArgTypeValue<U[K]>} :
    T extends [string, infer U extends SingleArgTypeValue] ? ValueOfSingleArgTypeValue<U> :
    T extends infer U extends SingleOptionTypeValue[] ? {[K in keyof U]: K extends string | symbol ? U[K] : ValueOfSingleArgTypeValue<U[K][1]>} :
    never
;

export type ValueOfArgType<T extends ArgType> =
    T extends {type: 'normal', value: infer U extends ArgTypeValue} ? ValueOfArgTypeValue<U> :
    T extends {type: 'variadic', value: infer U extends SingleArgTypeValue} ? ValueOfSingleArgTypeValue<U>[] :
    T extends {type: 'rest', value: infer U extends SingleArgTypeValue} ? ValueOfSingleArgTypeValue<U> :
    T extends {type: 'optional', value: infer U extends ArgTypeValue} ? ValueOfArgTypeValue<U> | undefined :
    T extends {type: 'optional-variadic', value: infer U extends SingleArgTypeValue} ? ValueOfSingleArgTypeValue<U>[] | undefined :
    T extends {type: 'optional-rest', value: infer U extends SingleArgTypeValue} ? ValueOfSingleArgTypeValue<U> | undefined :
    T extends {type: 'flag'} ? boolean | undefined :
    T extends {type: 'option', value: infer U extends OptionTypeValue} ? ValueOfArgTypeValue<U> | undefined :
    T extends {type: 'variadic-option', value: infer U extends SingleOptionTypeValue} ? ValueOfArgTypeValue<U>[] | undefined :
    T extends {type: 'rest-option', value: infer U extends SingleOptionTypeValue} ? ValueOfArgTypeValue<U> | undefined :
    never
;

type KebabToCamel<T extends string> = T extends `${infer U}-${infer V}` ? `${U}${Capitalize<KebabToCamel<V>>}` : T;

export type CommandFunc<T extends ArgType[] = ArgType[]> = (args: {[K in (number & keyof T) as KebabToCamel<T[K]['name']>]: ValueOfArgType<T[K]>} & {msg: Message, argv: string[], rawArgs: string}) => Promise<Response>;

export interface BasicCommand<T extends ArgType[] = ArgType[]> {
    type: 'basic';
    name: string;
    category: CommandCategory;
    aliases: string[];
    desc: string;
    args: T;
    posArgs: PosArgType[];
    optionArgs: OptionArgType[];
    requiredCount: number;
    func: CommandFunc<T>;
    sendTyping: boolean;
    extraHelp?: string;
}

export interface SuperCommand {
    type: 'super';
    name: string;
    category: string;
    aliases: string[];
    desc: string;
    subCommands: string[];
    extraHelp?: string;
}

export type Command = BasicCommand | SuperCommand;

export const COMMANDS: {[key: string]: Command} = Object.create(null);
export const COMMANDS_BY_CATEGORY: {[key: string]: Command[]} = Object.create(null);

export function addCommand<T extends ArgType[]>(name: string, category: CommandCategory, aliases: string[], desc: string, args: T, func: CommandFunc<T>, sendTyping: boolean = false, extraHelp?: string): void {
    // compile argument data and sanity check the argument names
    let posArgs: PosArgType[] = [];
    let optionArgs: OptionArgType[] = [];
    let requiredCount = 0;
    let foundArgNames = new Set<string>();
    for (let arg of args) {
        if (foundArgNames.has(arg.name)) {
            throw new Error(`Duplicate argument name '${arg.name}' detected in command '${name}'`);
        }
        foundArgNames.add(arg.name);
        if (!('aliases' in arg)) {
            posArgs.push(arg);
            if (arg.type === 'required' || arg.type === 'variadic' || arg.type === 'rest') {
                requiredCount++;
            }
        } else {
            optionArgs.push(arg);
            for (let alias of arg.aliases) {
                if (foundArgNames.has(alias)) {
                    throw new Error(`Duplicate argument name '${alias}' detected in command '${name}'`);
                }
                foundArgNames.add(alias);
            }
        }
    }
    for (let arg of foundArgNames) {
        if (arg.startsWith('no-') || arg.startsWith('yes-')) {
            throw new Error(`Confusing argument name '${arg}' detected in command '${name}'`);
        }
    }
    let command: BasicCommand = {
        type: 'basic',
        name,
        category,
        aliases,
        desc,
        args,
        posArgs,
        optionArgs,
        requiredCount,
        // typescript wtf
        func: func as any,
        sendTyping,
        extraHelp: extraHelp ? extraHelp.trim() : undefined,
    };
    if (name in COMMANDS) {
        throw new Error(`Command '${name}' is already used`);
    }
    COMMANDS[name] = command;
    for (let alias of aliases) {
        if (alias in COMMANDS) {
            throw new Error(`Alias '${alias}' is already used`);
        }
        COMMANDS[alias] = command;
    }
    if (category in COMMANDS_BY_CATEGORY) {
        COMMANDS_BY_CATEGORY[name].push(command);
    } else {
        COMMANDS_BY_CATEGORY[name] = [command];
    }
}

export function addSuperCommand(name: string, category: CommandCategory, aliases: string[], desc: string, subCommands: string[], extraHelp?: string) {
    let command: SuperCommand = {
        type: 'super',
        name,
        category,
        aliases,
        desc,
        subCommands,
        extraHelp: extraHelp ? extraHelp.trim() : undefined,
    };
    COMMANDS[name] = command;
    for (let alias of aliases) {
        COMMANDS[alias] = command;
    }
    if (category in COMMANDS_BY_CATEGORY) {
        COMMANDS_BY_CATEGORY[name].push(command);
    } else {
        COMMANDS_BY_CATEGORY[name] = [command];
    }
}


export class ArgumentError extends BotError {

    name: string = 'ArgumentError';
    [Symbol.toStringTag]: string = 'ArgumentError';

}

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

function parseArgv(data: string): [arg: string, isFlag: boolean][] {
    let out: [arg: string, isFlag: boolean][] = [];
    let currentArg = '';
    let currentIsFlag = false;
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
        } else if ((char === ' ' || char === '\n') && quoteMode === 'none') {
            out.push([currentArg, currentIsFlag]);
            currentArg = '';
        } else {
            if (char === '-' && currentArg.length === 0) {
                currentIsFlag = true;
            }
            currentArg += char;
        }
    }
    if (currentArg.length > 0) {
        out.push([currentArg, currentIsFlag]);
    }
    return out;
}

function validate<T extends SingleArgTypeValue>(value: string, arg: ArgType, type: T): string | number | boolean {
    if (type === 'string') {
        return value;
    } else if (type === 'number') {
        let out = Number(value);
        if (Number.isNaN(out) && value !== 'NaN') {
            throw new ArgumentError(`Invalid value '${value}' for argument ${arg.name} (expected number)`);
        }
        return out;
    } else if (type === 'boolean') {
        if (value === 'true') {
            return true;
        } else if (value === 'false') {
            return false;
        } else {
            throw new ArgumentError(`Invalid value '${value}' for argument ${arg.name} (expected boolean)`);
        }
    } else if (typeof type === 'function') {
        let result = type(value);
        if (typeof result === 'string') {
            return result;
        } else {
            let msg = `Invalid value '${value}' for argument ${arg.name}`;
            if (result.reason !== undefined) {
                msg += ` (expected ${result.name}, ${result.reason})`;
            } else {
                msg += ` (expected ${result.name})`;
            }
            throw new BotError(msg);
        }
    } else {
        if (Array.isArray(type.value)) {
            for (let option of type.value) {
                if (typeof option === 'string') {
                    if (value === option) {
                        return value;
                    }
                } else if (typeof option === 'number') {
                    if (Number.isNaN(option)) {
                        if (value === 'NaN') {
                            return NaN;
                        }
                    } else {
                        if (Number(value) === option) {
                            return option;
                        }
                    }
                } else {
                    if (String(option) === value) {
                        return option;
                    }
                }
            }
        } else {
            if (value.match(type.value)) {
                return value;
            }
        }
        throw new ArgumentError(`Invalid value for ${arg.name} argument: '${value}' (expected ${type.name})`);
    }
}

function _internalRunTextCommand(msg: Message, cmd: Command, rawArgs: string, argv: [string, boolean][], nestLevel: number): Promise<Response> {
    if (cmd.type === 'super') {
        let subCmd = cmd.name + ' ' + argv[nestLevel][0].toLowerCase().replaceAll('_', '');
        if (!(subCmd in COMMANDS)) {
            throw new BotError(`Nonexistent subcommand: '${cmd.name} ${argv[nestLevel]}'`);
        }
        return _internalRunTextCommand(msg, COMMANDS[subCmd], rawArgs, argv, nestLevel + 1);
    }
    let args = {msg, argv: argv.map(x => x[0]), rawArgs} as Parameters<CommandFunc>[0];
    let posArgPos = 0;
    let foundRequiredCount = 0;
    for (let pos = 0; pos < argv.length; pos++) {
        let [value, isFlag] = argv[pos];
        if (!isFlag) {
            // parse positional arguments
            if (posArgPos > cmd.posArgs.length) {
                throw new BotError(`Too many positional arguments provided`);
            }
            let arg = cmd.posArgs[posArgPos];
            posArgPos++;
            if (arg.type === 'variadic' || arg.type === 'rest' || arg.type === 'optional-variadic' || arg.type === 'optional-rest') {
                let found: string[] = [];
                for (; pos < argv.length; pos++) {
                    if (argv[pos][1]) {
                        break;
                    }
                    found.push(argv[pos][0]);
                }
                // enforce that they have to have something
                if ((arg.type === 'variadic' || arg.type === 'rest') && found.length === 0) {
                    throw new BotError(`Empty value provided for required argument ${arg.name}`);
                }
                if (arg.type === 'variadic' || arg.type === 'optional-variadic') {
                    args[arg.name] = found.map(value => validate(value, arg, arg.value));
                } else {
                    args[arg.name] = validate(found.join(' '), arg, arg.value);
                }
                continue;
            }
            try {
                let type = arg.value;
                if (Array.isArray(type)) {
                    let found = argv.slice(pos, pos + type.length);
                    if (found.length !== type.length || found.some(x => x[1])) {
                        let got = 0;
                        for (let value of found) {
                            if (value[1]) {
                                break;
                            }
                            got++;
                        }
                        throw new BotError(`Not enough values provided for argument '${arg.name}' (expected ${type.length}, got ${got})`);
                    }
                    args[arg.name] = found.map((value, i) => validate(value[0], arg, type[i]));
                    pos += type.length - 1;
                } else {
                    args[arg.name] = validate(argv[pos + 1][0], arg, type);
                }
            } catch (error) {
                if (error instanceof ArgumentError && arg.type === 'optional') {
                    continue;
                } else {
                    throw error;
                }
            }
        } else if (value === '-' || value === '--') {
            // git-style shortcut, can also be used to stop variadic args
            continue;
        } else {
            // parse options
            let option: string;
            let hasTwoDashes = value.startsWith('--');
            if (hasTwoDashes) {
                option = value.slice(2);
            } else {
                option = value.slice(1);
            }
            // handle --no-x and --yes-x options
            let mustBeFlag = false;
            let flagValue = true;
            if (option.startsWith('no-')) {
                mustBeFlag = true;
                flagValue = false;
                option = option.slice(3);
            } else if (option.startsWith('yes-')) {
                mustBeFlag = true;
                option = option.slice(4);
            }
            // the case where you provide multiple flags
            // this parser does not support passing options to multiflag specs
            // because i think it is too confusing
            if (!hasTwoDashes && option.length > 1) {
                let flagLetters = new Set(value.slice(1));
                for (let arg of cmd.optionArgs) {
                    if (arg.type !== 'flag') {
                        continue;
                    }
                    let foundFlag: string | undefined = undefined;
                    if (flagLetters.has(arg.name)) {
                        foundFlag = arg.name;
                    } else {
                        for (let alias of arg.aliases) {
                            if (flagLetters.has(alias)) {
                                foundFlag = alias;
                            }
                        }
                    }
                    if (foundFlag !== undefined) {
                        args[arg.name] = flagValue ? false : true;
                        flagLetters.delete(foundFlag);
                    }
                }
            }
            let foundArg: ArgType | undefined = undefined;
            for (let arg of cmd.optionArgs) {
                if (arg.name === option || arg.aliases.includes(option)) {
                    foundArg = arg;
                    break;
                }
            }
            if (!foundArg) {
                throw new BotError(`Nonexistent option: '${option}'`);
            }
            let arg = foundArg;
            if (arg.type === 'flag') {
                args[arg.name] = flagValue;
            } else if (mustBeFlag) {
                throw new BotError(`Option ${option} is not a flag but was provided as '${value}'`);
            } else if (arg.type === 'variadic-option' || arg.type === 'rest-option') {
                let found: string[] = [];
                for (; pos < argv.length; pos++) {
                    if (argv[pos][1]) {
                        break;
                    }
                    found.push(argv[pos][0]);
                }
                if (arg.type === 'variadic-option') {
                    args[arg.name] = found.map(value => validate(value, arg, arg.value[1]));
                } else {
                    args[arg.name] = validate(found.join(' '), arg, arg.value[1]);
                }
            } else {
                pos++;
                let type = arg.value;
                if (type.length === 0 || Array.isArray(type[0])) {
                    let found = argv.slice(pos, pos + type.length);
                    if (found.length !== type.length || found.some(x => x[1])) {
                        let got = 0;
                        for (let value of found) {
                            if (value[1]) {
                                break;
                            }
                            got++;
                        }
                        throw new BotError(`Not enough values provided for argument '${arg.name}' (expected ${type.length}, got ${got})`);
                    }
                    args[arg.name] = found.map((value, i) => validate(value[0], arg, (type as SingleOptionTypeValue[])[i][1]));
                    pos += type.length - 1;
                } else {
                    args[arg.name] = validate(argv[pos + 1][0], arg, (type as SingleOptionTypeValue)[1]);
                    pos++;
                }
            }
        }
    }
    // check for missing required positional arguments
    if (foundRequiredCount < cmd.requiredCount) {
        let count = 0;
        for (let arg of cmd.posArgs) {
            if (arg.type === 'required' || arg.type === 'optional' || arg.type === 'rest') {
                if (count === foundRequiredCount) {
                    throw new BotError(`No value provided for required argument ${arg.name}`);
                }
                count++;
            }
        }
    }
    return cmd.func(args);
}

export function internalRunTextCommand(msg: Message, rawArgs: string): Promise<Response> | undefined {
    let argv = parseArgv(rawArgs);
    let cmd = argv[0][0].toLowerCase().replaceAll('_', '');
    if (!(cmd in COMMANDS)) {
        return;
    }
    return _internalRunTextCommand(msg, COMMANDS[cmd], rawArgs, argv, 1);
}


export function commandValidator(cmd: string): string | {name: string, reason?: string} {
    cmd = cmd.toLowerCase().replaceAll('_', '');
    if (cmd.startsWith('!')) {
        cmd = cmd.slice(1);
    } else if (cmd.startsWith('ca.')) {
        cmd = cmd.slice(3);
    }
    if (!(cmd in COMMANDS)) {
        return {name: 'command'};
    }
    return cmd;
}


export interface Config {
    readonly admins: string[];
    readonly token: string;
    readonly wrapperToken: string;
    readonly wrapperInfoChannel: [string, string];
    readonly wrapperMaxRestartsPerDay: number;
    readonly antiFreeze: {
        readonly sendInterval: number;
        readonly checkInterval: number;
        readonly timeoutInterval: number;
    };
    readonly initTime: number;
    readonly serverNames: {[key: string]: string};
    readonly starboards: {[key: string]: {
        readonly server: string;
        readonly channel: string;
        readonly threshold: number;
        readonly negativeThreshold?: number;
        readonly allowSelf: boolean;
        readonly startTime: number;
        readonly emojis: {[key: string]: number};
        readonly boardLowEmoji: string;
        readonly boardEmojis: [number, string][];
    }};
    readonly starboardServers: {[key: string]: string};
    readonly sssssChannel: string;
}

export const config: Config = Object.freeze(JSON.parse(await readFile('config.json')));


// ethylene glycol

setInterval(async () => {
    await sendMessage({type: 'heartbeat'});
}, config.antiFreeze.sendInterval * 1000);
