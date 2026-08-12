
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

export type SingleArgType = 'string' | 'number' | 'boolean' | Validator | {name: string, value: (string | number | boolean)[] | RegExp};
export type ArgType = SingleArgType | SingleArgType[];

export type BaseArg<Name extends string = string> = {name: Name, desc: string};

export type RequiredArg<Name extends string = string, Type extends ArgType = ArgType> = BaseArg<Name> & {kind: 'required', type: Type};
export type RequiredVariadicArg<Name extends string = string, Type extends SingleArgType = SingleArgType> = BaseArg<Name> & {kind: 'required-variadic', type: Type};
export type RequiredRestArg<Name extends string = string, Type extends SingleArgType = SingleArgType> = BaseArg<Name> & {kind: 'required-rest', type: Type};
export type OptionalArg<Name extends string = string, Type extends ArgType = ArgType, HasDefault extends boolean = boolean> = BaseArg<Name> & {kind: 'optional', type: Type} & (boolean extends HasDefault ? {default?: ValueOfArgType<Type>} : (HasDefault extends true ? {default: ValueOfArgType<Type>} : {}));
export type OptionalVariadicArg<Name extends string = string, Type extends SingleArgType = SingleArgType, HasDefault extends boolean = boolean> = BaseArg<Name> & {kind: 'optional-variadic', type: Type} & (boolean extends HasDefault ? {default?: ValueOfArgType<Type>[]} : (HasDefault extends true ? {default: ValueOfArgType<Type>[]} : {}));
export type OptionalRestArg<Name extends string = string, Type extends SingleArgType = SingleArgType, HasDefault extends boolean = boolean> = BaseArg<Name> & {kind: 'optional-rest', type: Type, default?: ValueOfArgType<Type>} & (boolean extends HasDefault ? {default?: ValueOfArgType<Type>} : (HasDefault extends true ? {default: ValueOfArgType<Type>} : {}));
export type PosArg<Name extends string = string> = RequiredArg<Name> | RequiredVariadicArg<Name> | RequiredRestArg<Name> | OptionalArg<Name> | OptionalVariadicArg<Name> | OptionalRestArg<Name>;

export type Flag<Name extends string = string> = BaseArg<Name> & {aliases: string[], kind: 'flag', default?: boolean};
export type Option<Name extends string = string, Args extends PosArg | PosArg[] = PosArg | PosArg[], HasDefault extends boolean = boolean> = BaseArg<Name> & {aliases: string[], kind: 'option', default?: (boolean extends HasDefault ? {default?: Args extends PosArg ? ValueOfArg<Args> : (Args extends infer U extends PosArg[] ? {[K in keyof U]: K extends number | `${number}` ? ValueOfArg<U[K]> : U[K]} : never)} : (HasDefault extends true ? {default: Args extends PosArg ? ValueOfArg<Args> : (Args extends infer U extends PosArg[] ? {[K in keyof U]: K extends number | `${number}` ? ValueOfArg<U[K]> : U[K]} : never)} : {}))} & (Args extends PosArg[] ? {args: Args} : {arg: Args});
export type OptionArg<Name extends string = string> = Flag<Name> | Option<Name>;

export type Arg<Name extends string = string> = PosArg<Name> | OptionArg<Name>;
export type ArgKind = Arg['kind'];


export type ValueOfSingleArgType<T extends SingleArgType> =
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends 'boolean' ? boolean :
    T extends ((arg: string) => true | string) ? string :
    T extends {options: Set<infer U>} ? U :
    T extends {options: RegExp} ? string :
    never
;

export type ValueOfArgType<T extends ArgType> = 
    T extends SingleArgType ? ValueOfSingleArgType<T> :
    T extends infer U extends SingleArgType[] ? {[K in keyof U]: K extends string | symbol ? U[K] : ValueOfSingleArgType<U[K]>} :
    never
;

export type ValueOfArg<T extends Arg> =
    T extends RequiredArg<string, infer U> ? ValueOfArgType<U> :
    T extends RequiredVariadicArg<string, infer U> ? ValueOfSingleArgType<U>[] :
    T extends RequiredRestArg<string, infer U> ? ValueOfSingleArgType<U> :
    T extends OptionalArg<string, infer U> ? (T extends OptionalArg<string, U, true> ? ValueOfArgType<U> : ValueOfArgType<U> | undefined) :
    T extends OptionalVariadicArg<string, infer U> ? (T extends OptionalVariadicArg<string, U, true> ? ValueOfArgType<U>[] : ValueOfArgType<U>[] | undefined) :
    T extends OptionalRestArg<string, infer U> ? (T extends OptionalVariadicArg<string, U, true> ? ValueOfArgType<U> : ValueOfArgType<U> | undefined) :
    T extends Flag ? boolean | undefined :
    T extends Option<string, infer U extends PosArg, true> ? ValueOfArg<U> :
    T extends Option<string, infer U extends PosArg[], true> ? {[K in keyof U]: K extends number | `${number}` ? ValueOfArg<U[K]> : U[K]} :
    T extends Option<string, infer U extends PosArg, false> ? ValueOfArg<U> | undefined :
    T extends Option<string, infer U extends PosArg[], false> ? {[K in keyof U]: K extends number | `${number}` ? ValueOfArg<U[K]> : U[K]} | undefined :
    never
;

type X = ValueOfArg<OptionalArg<string, 'number', true>>;


export function requiredArg<Name extends string, Type extends ArgType>(name: Name, type: Type, desc: string): RequiredArg<Name, Type> {
    return {name, desc, kind: 'required', type};
}

export function requiredVariadicArg<Name extends string, Type extends SingleArgType>(name: Name, type: Type, desc: string): RequiredVariadicArg<Name, Type> {
    return {name, desc, kind: 'required-variadic', type};
}

export function requiredRestArg<Name extends string, Type extends SingleArgType>(name: Name, type: Type, desc: string): RequiredRestArg<Name, Type> {
    return {name, desc, kind: 'required-rest', type};
}

export function optionalArg<Name extends string, Type extends ArgType>(name: Name, type: Type, desc: string): OptionalArg<Name, Type, false>
export function optionalArg<Name extends string, Type extends ArgType>(name: Name, type: Type, desc: string, defaultValue: ValueOfArgType<Type>): OptionalArg<Name, Type, true>;
export function optionalArg<Name extends string, Type extends ArgType>(name: Name, type: Type, desc: string, defaultValue?: ValueOfArgType<Type>): OptionalArg<Name, Type> {
    return {name, desc, kind: 'optional', type, default: defaultValue};
}

export function optionalVariadicArg<Name extends string, Type extends SingleArgType>(name: Name, type: Type, desc: string, defaultValue?: ValueOfArgType<Type>[]): OptionalVariadicArg<Name, Type> {
    return {name, desc, kind: 'optional-variadic', type, default: defaultValue};
}

export function optionalRestArg<Name extends string, Type extends SingleArgType>(name: Name, type: Type, desc: string, defaultValue?: ValueOfArgType<Type>): OptionalRestArg<Name, Type> {
    return {name, desc, kind: 'optional-rest', type, default: defaultValue};
}

export function flagArg<Name extends string>(name: Name, aliases: string[], desc: string, defaultValue?: boolean): Flag<Name> {
    return {name, desc, aliases, kind: 'flag', default: defaultValue};
}

export function optionArg<Name extends string, Args extends PosArg | PosArg[]>(name: Name, aliases: string[], args: Args, desc: string): Option<Name, Args> {
    if (Array.isArray(args)) {
        return {name, desc, aliases, kind: 'option', args} as any;
    } else {
        return {name, desc, aliases, kind: 'option', arg: args} as any;
    }
}


type KebabToCamel<T extends string> = T extends `${infer U}-${infer V}` ? `${U}${Capitalize<KebabToCamel<V>>}` : T;

export type ParsedArgs<T extends Arg[] = Arg[]> = {[A in T[number] as KebabToCamel<A['name']>]: ValueOfArg<A>};


export type CommandFunc<T extends Arg[] = Arg[]> = (args: ParsedArgs<T> & {msg: Message, argv: string[], rawArgs: string}) => Promise<Response>;

export interface BasicCommand<T extends Arg[] = Arg[]> {
    type: 'basic';
    name: string;
    category: CommandCategory;
    aliases: string[];
    desc: string;
    args: T;
    posArgs: PosArg[];
    optionArgs: OptionArg[];
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

export function addCommand<T extends Arg[]>(name: string, category: CommandCategory, aliases: string[], desc: string, args: T, func: CommandFunc<T>, sendTyping: boolean = false, extraHelp?: string): void {
    // compile argument data and sanity check the argument names
    let posArgs: PosArg[] = [];
    let optionArgs: OptionArg[] = [];
    let foundArgNames = new Set<string>();
    for (let arg of args) {
        if (foundArgNames.has(arg.name)) {
            throw new Error(`Duplicate argument name '${arg.name}' detected in command '${name}'`);
        }
        foundArgNames.add(arg.name);
        if (!('aliases' in arg)) {
            posArgs.push(arg);
        } else {
            optionArgs.push(arg);
            for (let alias of arg.aliases) {
                if (foundArgNames.has(alias)) {
                    throw new Error(`Duplicate argument name '${alias}' detected in command '${name}'`);
                }
                foundArgNames.add(alias);
            }
            if (arg.kind === 'option' && 'args' in arg) {
                let foundSubArgNames = new Set<string>();
                for (let subArg of arg.args) {
                    if (foundSubArgNames.has(subArg.name)) {
                        throw new Error(`Duplicate argument name '${subArg.name}' detected in command '${name}' (in option '${arg.name}')`);
                    }
                    foundSubArgNames.add(subArg.name);
                }
            }
        }
    }
    for (let arg of foundArgNames) {
        if (arg.startsWith('no-') || arg.startsWith('yes-')) {
            throw new Error(`Confusing argument name '${arg}' detected in command '${name}'`);
        }
    }
    let command: BasicCommand<T> = {
        type: 'basic',
        name,
        category,
        aliases,
        desc,
        args,
        posArgs,
        optionArgs,
        func,
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

type Argv = [value: string, isFlag: boolean][];

function parseArgv(data: string): Argv {
    let out: Argv = [];
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

function kebabToCamel(str: string): string {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '-') {
            if (i === str.length - 1) {
                continue;
            }
            i++;
            out += str[i].toUpperCase();
        } else {
            out += str[i];
        }
    }
    return out;
}

function validate<T extends SingleArgType>(value: string, arg: Arg, type: T): string | number | boolean {
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

function parsePosArgs(out: ParsedArgs, posArgs: PosArg[], argv: Argv, pos: number, posArgsPos: number): {pos: number, posArgsPos: number} {
    for (; pos < argv.length; pos++) {
        if (argv[pos][1]) {
            return {pos, posArgsPos};
        }
        if (posArgsPos > posArgs.length) {
            throw new BotError(`Too many positional arguments provided`);
        }
        let arg = posArgs[posArgsPos];
        posArgsPos++;
        if (arg.kind === 'required-variadic' || arg.kind === 'required-rest' || arg.kind === 'optional-variadic' || arg.kind === 'optional-rest') {
            let found: string[] = [];
            for (; pos < argv.length; pos++) {
                if (argv[pos][1]) {
                    break;
                }
                found.push(argv[pos][0]);
            }
            // enforce that they have to have something
            if ((arg.kind === 'required-variadic' || arg.kind === 'required-rest') && found.length === 0) {
                throw new BotError(`Empty value provided for required argument ${arg.name}`);
            }
            if (arg.kind === 'required-variadic' || arg.kind === 'optional-variadic') {
                out[kebabToCamel(arg.name)] = found.map(value => validate(value, arg, arg.type));
            } else {
                out[kebabToCamel(arg.name)] = validate(found.join(' '), arg, arg.type);
            }
        }
        try {
            let type = arg.type;
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
                out[kebabToCamel(arg.name)] = found.map((value, i) => validate(value[0], arg, type[i]));
                pos += type.length - 1;
            } else {
                out[kebabToCamel(arg.name)] = validate(argv[pos][0], arg, type);
            }
        } catch (error) {
            if (error instanceof ArgumentError && arg.kind === 'optional') {
                continue;
            } else {
                throw error;
            }
        }
    }
    return {pos, posArgsPos};
}

// add in the default values for the optional args
// and check that all required argments are there
function afterPosArgsParsed(out: ParsedArgs, posArgs: PosArg[]): void {
    for (let arg of posArgs) {
        let name = kebabToCamel(arg.name);
        if (!(name in out)) {
            if (arg.kind === 'required' || arg.kind === 'required-variadic' || arg.kind === 'required-rest') {
                throw new BotError(`No value provided for required argument ${arg.name}`);
            } else if ('default' in arg) {
                out[name] = arg.default;
            }
        }
    }
}

// the case where you provide multiple flags
// this parser does not support passing options to multiflag specs
// because i think it is too confusing
function parseMultiFlagArg(out: ParsedArgs, cmd: BasicCommand, value: string, flagValue: boolean): void {
    let flagLetters = new Set(value.slice(1));
    for (let arg of cmd.optionArgs) {
        if (arg.kind !== 'flag') {
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
            out[kebabToCamel(arg.name)] = flagValue ? false : true;
            flagLetters.delete(foundFlag);
        }
    }
}

function parseOptionArg(out: ParsedArgs, cmd: BasicCommand, argv: Argv, pos: number, option: string, rawOption: string, mustBeFlag: boolean, flagValue: boolean): number {
    let foundArg: OptionArg | undefined = undefined;
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
    if (arg.kind === 'flag') {
        out[kebabToCamel(arg.name)] = flagValue;
    } else if (mustBeFlag) {
        throw new BotError(`Option ${option} is not a flag but was provided as '${rawOption}'`);
    } else {
        pos++;
        let result: ParsedArgs<PosArg[]> = {};
        let argArgs = 'arg' in arg ? [arg.arg] : arg.args;
        let data = parsePosArgs(result, argArgs, argv, pos, 0);
        pos = data.pos;
        if ('arg' in arg) {
            out[kebabToCamel(arg.name)] = result[arg.arg.name];
        } else {
            let value: ValueOfArg<Option & {args: PosArg[]}> = [];
            for (let subArg of arg.args) {
                // typescript wtf
                value.push(result[subArg.name] as any);
            }
            out[kebabToCamel(arg.name)] = value;
        }
        afterPosArgsParsed(out, argArgs);
    }
    return pos;
}

function parseArgs(out: ParsedArgs, cmd: BasicCommand, argv: Argv): void {
    let posArgsPos = 0;
    for (let pos = 0; pos < argv.length; pos++) {
        let [value, isFlag] = argv[pos];
        if (!isFlag) {
            let data = parsePosArgs(out, cmd.posArgs, argv, pos, posArgsPos);
            pos = data.pos - 1;
            posArgsPos = data.posArgsPos;
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
            if (!hasTwoDashes && option.length > 1) {
                parseMultiFlagArg(out, cmd, value, flagValue);
                continue;
            }
            pos = parseOptionArg(out, cmd, argv, pos, option, value, mustBeFlag, flagValue) - 1;
        }
    }
    afterPosArgsParsed(out, cmd.posArgs);
    // add default values for the options
    for (let arg of cmd.optionArgs) {
        let name = kebabToCamel(arg.name);
        if (!(name in out) && 'default' in arg) {
            // typescript being crazy...
            out[name] = arg.default as any;
        }
    }
}

function _internalRunTextCommand(msg: Message, cmd: Command, rawArgs: string, argv: Argv, nestLevel: number): Promise<Response> {
    if (cmd.type === 'super') {
        let subCmd = cmd.name + ' ' + argv[nestLevel][0].toLowerCase().replaceAll('_', '');
        if (!(subCmd in COMMANDS)) {
            throw new BotError(`Nonexistent subcommand: '${cmd.name} ${argv[nestLevel]}'`);
        }
        return _internalRunTextCommand(msg, COMMANDS[subCmd], rawArgs, argv, nestLevel + 1);
    }
    let args: ParsedArgs = {};
    parseArgs(args, cmd, argv);
    return cmd.func(Object.assign(args, {msg, argv: argv.map(x => x[0]), rawArgs}));
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
