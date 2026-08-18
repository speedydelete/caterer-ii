
import {DiscordAPIError, ColorResolvable, EmbedBuilder, MessageReferenceType, MessageCreateOptions, Message as _Message} from 'discord.js';
import {Pattern, PLACEHOLDER_PATTERN, parse} from '../lifeweb/lib/index.js';
import {RPFPattern, RPFParser} from '../lifeweb/lib/editor/rpf.js';

import {ME, BotError, Message, readFile, writeFile} from './real_base.js';
import {aclData, matchesACL} from './acl.js';

export * from './ipc_and_error_setup.js';
export * from './real_base.js';


export let aliases: {[key: string]: string} = Object.assign(Object.create(null), JSON.parse(await readFile('data/aliases.json')));

export async function saveAliases(): Promise<void> {
    await writeFile('data/aliases.json', JSON.stringify(aliases, undefined, 4));
}


export interface PatternArgData {
    p: Pattern;
    msg: Message;
    msgInChannel: Message;
}

export const RLE_HEADER = /\s*x\s*=\s*\d+\s*,?\s*y\s*=\s*\d+/;

export function findRLEInText(data: string): Pattern | undefined {
    let match = data.match(RLE_HEADER);
    if (!match) {
        return;
    }
    data = data.slice(match.index);
    let index = data.indexOf('!');
    if (index === -1) {
        return;
    }
    return parse(data.slice(0, index + 1), aliases);
}

export function findRPFInText(data: string): RPFPattern | undefined {
    let index = data.indexOf('```rpf\n');
    if (index === -1) {
        return;
    }
    data = data.slice(index + '```rpf\n'.length);
    index = data.indexOf('```');
    if (index === -1) {
        return;
    }
    data = data.slice(0, index);
    let parser = new RPFParser(PLACEHOLDER_PATTERN, '/index.rpf', data);
    return parser.pattern();
}

export function findPatternInText(data: string): Pattern | undefined {
    let out = findRLEInText(data);
    if (out) {
        return out;
    } else {
        return findRPFInText(data);
    }
}

export async function findPatternInMessage(msg: Message, msgInChannel: Message): Promise<PatternArgData | undefined> {
    let out = findPatternInText(msg.content);
    if (out) {
        return {p: out, msg, msgInChannel};
    }
    if (msg.reference && msg.reference.type === MessageReferenceType.Forward) {
        let msg2 = await msg.fetchReference();
        let out = await findPatternInMessage(msg2, msg);
        if (out) {
            return out;
        }
    }
    if (!msg.author.bot && msg.attachments.size > 0) {
        for (let [_, attachment] of msg.attachments) {
            let file = attachment.name;
            let index = file.lastIndexOf('.');
            if (index === -1) {
                continue;
            }
            let ext = file.slice(index);
            if (ext === '.rle' || ext === '.txt') {
                let data = await (await fetch(attachment.url)).text();
                let out = findRLEInText(data);
                if (out) {
                    return {p: out, msg, msgInChannel};
                }
            } else if (ext === '.rpf') {
                let data = await (await fetch(attachment.url)).text();
                let parser = new RPFParser(PLACEHOLDER_PATTERN, '/index.rpf', data);
                return {p: parser.pattern(), msg, msgInChannel};
            }
        }
    }
}

export async function findPatternInChannel(msg: Message): Promise<PatternArgData | undefined> {
    let out: PatternArgData | undefined;
    if (msg.reference) {
        let reply: Message | undefined = undefined;
        try {
            reply = await msg.fetchReference();
        } catch (error) {
            if (!(error instanceof DiscordAPIError && error.message.includes('Could not resolve channel'))) {
                throw error;
            }
        }
        if (reply) {
            out = await findPatternInMessage(reply, reply);
            if (out) {
                return out;
            }
        }
    }
    let msgs = await msg.channel.messages.fetch({limit: 50});
    for (let msg of msgs.values() as MapIterator<Message>) {
        let out = await findPatternInMessage(msg, msg);
        if (out) {
            return out;
        }
    }
}


export type CommandCategory = 'sub' | 'secret' | 'meta' | 'sim' | 'identify' | 'patterns' | 'rules' | '5s' | 'aliases' | 'other';

export const CATEGORY_NAMES: {[K in CommandCategory]: string} = {
    'sub': 'Subcommands',
    'secret': 'Secret',
    'meta': 'Meta',
    'sim': 'Simulation',
    'identify': 'Identification',
    'patterns': 'Patterns',
    'rules': 'Rules',
    '5s': '5S',
    'aliases': 'Aliases',
    'other': 'Other',
};


export type Validator<T = any> = (arg: string) => T | {isError: true, name: string, reason?: string};

export type SingleArgType = 
    | 'string'
    | 'number'
    | 'boolean'
    | Validator
    | {name: string, value: (string | number | boolean)[] | RegExp}
;

export type ArgType = SingleArgType | SingleArgType[];

export type BaseArg<Name extends string = string> = {name: Name, desc: string};

export type RequiredArg<Name extends string = string, Type extends ArgType = ArgType> = BaseArg<Name> & {kind: 'required', type: Type};
export type RequiredVariadicArg<Name extends string = string, Type extends SingleArgType = SingleArgType> = BaseArg<Name> & {kind: 'required-variadic', type: Type};
export type RequiredRestArg<Name extends string = string, Type extends SingleArgType = SingleArgType> = BaseArg<Name> & {kind: 'required-rest', type: Type};
export type OptionalArg<Name extends string = string, Type extends ArgType = ArgType, HasDefault extends boolean = boolean> = BaseArg<Name> & {kind: 'optional', type: Type} & (boolean extends HasDefault ? {default?: ValueOfArgType<Type>} : (HasDefault extends true ? {default: ValueOfArgType<Type>} : {}));
export type OptionalVariadicArg<Name extends string = string, Type extends SingleArgType = SingleArgType, HasDefault extends boolean = boolean> = BaseArg<Name> & {kind: 'optional-variadic', type: Type} & (boolean extends HasDefault ? {default?: ValueOfArgType<Type>[]} : (HasDefault extends true ? {default: ValueOfArgType<Type>[]} : {}));
export type OptionalRestArg<Name extends string = string, Type extends SingleArgType = SingleArgType, HasDefault extends boolean = boolean> = BaseArg<Name> & {kind: 'optional-rest', type: Type} & (boolean extends HasDefault ? {default?: ValueOfArgType<Type>} : (HasDefault extends true ? {default: ValueOfArgType<Type>} : {}));
export type PosArg<Name extends string = string> = RequiredArg<Name> | RequiredVariadicArg<Name> | RequiredRestArg<Name> | OptionalArg<Name> | OptionalVariadicArg<Name> | OptionalRestArg<Name>;

export type Flag<Name extends string = string> = BaseArg<Name> & {aliases: string[], kind: 'flag', default?: boolean};
export type Option<Name extends string = string, Args extends PosArg | PosArg[] = PosArg | PosArg[], HasDefault extends boolean = boolean> = BaseArg<Name> & {aliases: string[], kind: 'option', default?: (boolean extends HasDefault ? {default?: Args extends PosArg ? ValueOfArg<Args> : (Args extends infer U extends PosArg[] ? {[K in keyof U]: K extends number | `${number}` ? ValueOfArg<U[K]> : U[K]} : never)} : (HasDefault extends true ? {default: Args extends PosArg ? ValueOfArg<Args> : (Args extends infer U extends PosArg[] ? {[K in keyof U]: K extends number | `${number}` ? ValueOfArg<U[K]> : U[K]} : never)} : {}))} & (Args extends PosArg[] ? {args: Args} : {arg: Args});
export type OptionArg<Name extends string = string> = Flag<Name> | Option<Name>;

export type PatternArg<Name extends string = string> = {name: Name, kind: 'pattern'};

export type Arg<Name extends string = string> = PosArg<Name> | OptionArg<Name> | PatternArg<Name>;
export type ArgKind = Arg['kind'];


export type ValueOfSingleArgType<T extends SingleArgType> =
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends 'boolean' ? boolean :
    T extends Validator<infer U> ? U :
    T extends {name: string, value: (infer U)[]} ? U :
    T extends {name: string, value: RegExp} ? string :
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
    T extends OptionalRestArg<string, infer U> ? (T extends OptionalRestArg<string, U, true> ? ValueOfArgType<U> : ValueOfArgType<U> | undefined) :
    T extends Flag ? boolean | undefined :
    T extends Option<string, infer U extends PosArg, true> ? ValueOfArg<U> :
    T extends Option<string, infer U extends PosArg[], true> ? {[K in keyof U]: K extends number | `${number}` ? ValueOfArg<U[K]> : U[K]} :
    T extends Option<string, infer U extends PosArg, false> ? ValueOfArg<U> | undefined :
    T extends Option<string, infer U extends PosArg[], false> ? {[K in keyof U]: K extends number | `${number}` ? ValueOfArg<U[K]> : U[K]} | undefined :
    T extends PatternArg ? PatternArgData :
    never
;


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

export function optionalVariadicArg<Name extends string, Type extends SingleArgType>(name: Name, type: Type, desc: string): OptionalVariadicArg<Name, Type, false>
export function optionalVariadicArg<Name extends string, Type extends SingleArgType>(name: Name, type: Type, desc: string, defaultValue: ValueOfArgType<Type>[]): OptionalVariadicArg<Name, Type, true>;
export function optionalVariadicArg<Name extends string, Type extends SingleArgType>(name: Name, type: Type, desc: string, defaultValue?: ValueOfArgType<Type>[]): OptionalVariadicArg<Name, Type> {
    return {name, desc, kind: 'optional-variadic', type, default: defaultValue};
}

export function optionalRestArg<Name extends string, Type extends SingleArgType>(name: Name, type: Type, desc: string): OptionalRestArg<Name, Type, false>
export function optionalRestArg<Name extends string, Type extends SingleArgType>(name: Name, type: Type, desc: string, defaultValue: ValueOfArgType<Type>): OptionalRestArg<Name, Type, true>;
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

export function patternArg<Name extends string>(name: Name): PatternArg<Name> {
    return {name, kind: 'pattern'};
}


type KebabToCamel<T extends string> = T extends `${infer U}-${infer V}` ? `${U}${Capitalize<KebabToCamel<V>>}` : T;

export type ParsedArgs<T extends Arg[] = Arg[]> = {[A in T[number] as KebabToCamel<A['name']>]: ValueOfArg<A>};


export type Response = undefined | void | ((
    | {type: 'already-sent', value: Message}
    | {type: 'message-spec', value: MessageCreateOptions}
    | {type: 'string', value: string}
    | {type: 'number', value: number}
    | {type: 'boolean', value: boolean}
    | {type: 'pattern', value: Pattern}
) & {deleters?: string[]});


export type CommandFunc<T extends Arg[] = Arg[]> = (args: ParsedArgs<T> & {msg: Message, argv: string[], rawArgs: string, isInsidePipe: boolean}) => Promise<Response>;

export interface BasicCommand<T extends Arg[] = Arg[]> {
    type: 'basic';
    name: string;
    category: CommandCategory;
    aliases: string[];
    desc: string;
    args: T;
    posArgs: PosArg[];
    optionArgs: OptionArg[];
    patternArg?: PatternArg;
    func: CommandFunc<T>;
    sendTyping?: boolean;
    extraHelp?: string;
    noArgvParse?: boolean;
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

export function addCommand<T extends Arg[]>(name: string, category: CommandCategory, aliases: string[], desc: string, args: T, func: CommandFunc<T>, otherOptions: Partial<Pick<BasicCommand, 'sendTyping' | 'extraHelp' | 'noArgvParse'>> = {}): void {
    if (ME !== 'bot') {
        return;
    }
    // compile argument data and sanity check the argument names
    let posArgs: PosArg[] = [];
    let optionArgs: OptionArg[] = [];
    let patternArg: PatternArg | undefined = undefined;
    let foundArgNames = new Set<string>();
    for (let arg of args) {
        if (foundArgNames.has(arg.name)) {
            throw new Error(`Duplicate argument name '${arg.name}' detected in command '${name}'`);
        }
        foundArgNames.add(arg.name);
        if (arg.kind === 'pattern') {
            if (patternArg !== undefined) {
                throw new Error(`More than 1 pattern argument provided in command '${name}'`);
            }
            patternArg = arg;
        } else if (!('aliases' in arg)) {
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
    if (otherOptions.extraHelp !== undefined) {
        otherOptions.extraHelp = otherOptions.extraHelp.trim();
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
        patternArg,
        func,
        ...otherOptions,
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
        COMMANDS_BY_CATEGORY[category].push(command);
    } else {
        COMMANDS_BY_CATEGORY[category] = [command];
    }
}

export function addSuperCommand(name: string, category: CommandCategory, aliases: string[], desc: string, subCommands: string[], extraHelp?: string) {
    if (ME !== 'bot') {
        return;
    }
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
        COMMANDS_BY_CATEGORY[category].push(command);
    } else {
        COMMANDS_BY_CATEGORY[category] = [command];
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

function parseArgv(data: string, noArgvParse?: boolean): Argv {
    if (noArgvParse) {
        return data.split(' ').map(x => [x, false]);
    }
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
            throw new ArgumentError(`Invalid value '${value}' for argument '${arg.name}' (expected number)`);
        }
        return out;
    } else if (type === 'boolean') {
        if (value === 'true') {
            return true;
        } else if (value === 'false') {
            return false;
        } else {
            throw new ArgumentError(`Invalid value '${value}' for argument '${arg.name}' (expected boolean)`);
        }
    } else if (typeof type === 'function') {
        let result = type(value);
        if (result && typeof result === 'object' && result.isError) {
            let msg = `Invalid value '${value}' for argument ${arg.name}`;
            if (result.reason !== undefined) {
                msg += ` (expected ${result.name}, ${result.reason})`;
            } else {
                msg += ` (expected ${result.name})`;
            }
            throw new ArgumentError(msg);
        }
        return result;
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
        throw new ArgumentError(`Invalid value for argument '${arg.name}': '${value}' (expected ${type.name})`);
    }
}

function parsePosArgs(out: ParsedArgs, posArgs: PosArg[], argv: Argv, pos: number, posArgsPos: number): {pos: number, posArgsPos: number} {
    for (; pos < argv.length; pos++) {
        if (argv[pos][1]) {
            return {pos, posArgsPos};
        }
        if (posArgsPos >= posArgs.length) {
            throw new ArgumentError(`Too many positional arguments provided`);
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
                throw new ArgumentError(`Empty value provided for required argument '${arg.name}'`);
            }
            if (arg.kind === 'required-variadic' || arg.kind === 'optional-variadic') {
                out[kebabToCamel(arg.name)] = found.map(value => validate(value, arg, arg.type));
            } else {
                out[kebabToCamel(arg.name)] = validate(found.join(' '), arg, arg.type);
            }
            continue;
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
                    throw new ArgumentError(`Not enough values provided for argument '${arg.name}' (expected ${type.length}, got ${got})`);
                }
                out[kebabToCamel(arg.name)] = found.map((value, i) => validate(value[0], arg, type[i]));
                pos += type.length - 1;
            } else {
                out[kebabToCamel(arg.name)] = validate(argv[pos][0], arg, type);
            }
        } catch (error) {
            if (error instanceof ArgumentError && arg.kind === 'optional') {
                pos--;
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
                throw new ArgumentError(`No value provided for required argument '${arg.name}'`);
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
        throw new ArgumentError(`Nonexistent option: '${option}'`);
    }
    let arg = foundArg;
    if (arg.kind === 'flag') {
        out[kebabToCamel(arg.name)] = flagValue;
    } else if (mustBeFlag) {
        throw new ArgumentError(`Option '${option}' is not a flag but was provided as '${rawOption}'`);
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

async function parseArgs(out: ParsedArgs, cmd: BasicCommand, msg: Message, argv: Argv, nestLevel: number, useThisPattern?: Pattern): Promise<void> {
    if (!cmd.patternArg) {
        if (useThisPattern) {
            for (let arg of parseArgv(useThisPattern.toRLE(), cmd.noArgvParse)) {
                argv.push(arg);
            }
        }
    }
    let posArgsPos = 0;
    for (let pos = nestLevel + 1; pos < argv.length; pos++) {
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
    // add the pattern arg
    if (cmd.patternArg) {
        if (useThisPattern) {
            out[cmd.patternArg.name] = {p: useThisPattern, msg, msgInChannel: msg};
        } else {
            let data = await findPatternInChannel(msg);
            if (data === undefined) {
                throw new ArgumentError(`Cannot find pattern!`);
            }
            out[cmd.patternArg.name] = data;
        }
    }
}

async function _internalRunTextCommand(msg: Message, cmd: Command, rawArgs: string, argv: Argv, nestLevel: number, isInsidePipe: boolean, useThisPattern?: Pattern): Promise<Response> {
    if (!matchesACL(msg, aclData.commands[cmd.name])) {
        return {type: 'string', value: 'Error: You do not have permission to run this command'};
    }
    if (cmd.type === 'super') {
        if (argv[nestLevel + 1] === undefined) {
            throw new ArgumentError(`No subcommand provided for supercommand '${cmd.name}'`);
        }
        let rawSubCmd = cmd.name + ' ' + argv[nestLevel + 1][0];
        let subCmd = rawSubCmd.toLowerCase().replaceAll('_', '');
        if (!(subCmd in COMMANDS)) {
            throw new ArgumentError(`Nonexistent subcommand: '${rawSubCmd}'`);
        }
        return await _internalRunTextCommand(msg, COMMANDS[subCmd], rawArgs, argv, nestLevel + 1, isInsidePipe, useThisPattern);
    }
    if (cmd.noArgvParse) {
        argv = parseArgv(rawArgs, true);
    }
    let args: ParsedArgs = {};
    await parseArgs(args, cmd, msg, argv, nestLevel, useThisPattern);
    if (cmd.sendTyping) {
        try {
            await msg.channel.sendTyping();
        } catch {}
    }
    return await cmd.func(Object.assign(args, {msg, argv: argv.map(x => x[0]), rawArgs, isInsidePipe}));
}

const STUPID_COMMAND_TEMPLATES: {[key: string]: string} = {
    'no': 'This is NOT a $$$ server. Please do NOT discuss $$$ here.',
    'yes': 'This IS a $$$ server. Please DO discuss $$$ here.',
    'maybe': 'This MIGHT BE a $$$ server. Please MAYBE discuss $$$ here.',
    'gno': 'This is GNOT a $$$ server. Please do GNOT discuss $$$ here.',
};

function tryStupidCommand(cmd: string): Response {
    let match = cmd.match(/^(no|yes|maybe|gno)((?:no|yes|maybe|gno)*math)$/);
    if (!match) {
        return; 
    }
    let template = STUPID_COMMAND_TEMPLATES[match[1]];
    let replace = match[2] === 'math' ? 'mathematics' : `!${match[2]}`;
    let out = template.replaceAll('$$$', replace);
    return {type: 'string', value: out};
}

async function runPipe(msg: Message, rawArgs: string): Promise<Response> {
    let parsedPipe: string[] = [];
    for (let value of rawArgs.split(/[ \n]\|[ \n]/)) {
        parsedPipe.push(value);
    }
    let prevResp: Response;
    let extraArgv: Argv = [];
    let pattern: Pattern | undefined = undefined;
    let deleters: string[] = [];
    for (let i = 0; i < parsedPipe.length; i++) {
        let rawArgs = parsedPipe[i];
        let argv = parseArgv(rawArgs);
        let value: Response;
        let cmd = argv[0][0].toLowerCase().replaceAll('_', '');
        if (!(cmd in COMMANDS)) {
            let stupid = tryStupidCommand(cmd);
            if (stupid === undefined) {
                return;
            } else {
                value = stupid;
            }
        } else {
            for (let arg of extraArgv) {
                argv.push(arg);
                rawArgs += ' ' + arg[0];
            }
            value = await _internalRunTextCommand(msg, COMMANDS[cmd], rawArgs, argv, 0, i !== parsedPipe.length - 1, pattern);
        }
        pattern = undefined;
        if (value && value.deleters) {
            deleters.push(...value.deleters);
        }
        type Response = undefined | void | ((
            | {type: 'already-sent', value: Message}
            | {type: 'message-spec', value: MessageCreateOptions}
            | {type: 'string', value: string}
            | {type: 'number', value: number}
            | {type: 'boolean', value: boolean}
            | {type: 'pattern', value: Pattern}
        ) & {deleters?: string[]});
        if (value === undefined) {
            extraArgv = [];
        } else if (value.type === 'already-sent' || value.type === 'message-spec') {
            extraArgv = [];
        } else if (value.type === 'string') {
            extraArgv = parseArgv(value.value);
        } else if (value.type === 'number') {
            extraArgv = parseArgv(String(value.value));
        } else if (value.type === 'boolean') {
            extraArgv = parseArgv(String(value.value));
        } else if (value.type === 'pattern') {
            extraArgv = [];
            pattern = value.value;
        } else {
            throw new Error(`This error should not occur (invalid response type: '${(value as {type: 'string'}).type}')`);
        }
        prevResp = value;
    }
    return prevResp;
}

export async function internalRunTextCommand(msg: Message, rawArgs: string): Promise<Response> {
    let argv = parseArgv(rawArgs);
    // pipes!
    if (argv.some(x => x[0] === '|')) {
        return await runPipe(msg, rawArgs);
    }
    let cmd = argv[0][0].toLowerCase().replaceAll('_', '');
    if (!(cmd in COMMANDS)) {
        return tryStupidCommand(cmd);
    }
    return await _internalRunTextCommand(msg, COMMANDS[cmd], rawArgs, argv, 0, false);
}


export function commandValidator(cmd: string): ReturnType<Validator<string>> {
    cmd = cmd.toLowerCase().replaceAll('_', '');
    if (cmd.startsWith('!') || cmd.startsWith('$')) {
        cmd = cmd.slice(1);
    } else if (cmd.startsWith('ca.')) {
        cmd = cmd.slice(3);
    }
    if (!(cmd in COMMANDS)) {
        return {isError: true, name: 'command', reason: 'does not exist'};
    }
    return cmd;
}


export function createEmbed(title: string, desc: string, color: ColorResolvable = '#ff9fe2'): EmbedBuilder {
    let out = (new EmbedBuilder()).setTitle(title).setDescription(desc);
    if (color) {
        out.setColor(color);
    }
    return out;
}
