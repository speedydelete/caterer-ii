
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {DiscordAPIError, Message as _Message, OmitPartialGroupDMChannel} from 'discord.js';
import {Pattern, PLACEHOLDER_PATTERN, parse} from '../lifeweb/lib/index.js';
import {RPFParser} from '../lifeweb/lib/editor/rpf.js';


export class BotError extends Error {

    name: string = 'BotError';
    [Symbol.toStringTag]: string = 'BotError';

}


export interface Signal {
    number: number;
    name: string;
    desc: string;
};


const SIGNAL_LIST = [
    [0, 'no signal', 'completed successfully'],
    [1, 'SIGHUP', 'hangup'],
    [2, 'SIGINT', 'interrupt'],
    [3, 'SIGQUIT', 'quit'],
    [4, 'SIGILL', 'illegal instruction'],
    [5, 'SIGTRAP', 'trace/breakpoint trap'],
    [6, 'SIGABRT', 'aborted'],
    [7, 'SIGBUS', 'bus error'],
    [8, 'SIGFPE', 'floating point exception'],
    [9, 'SIGKILL', 'killed'],
    [10, 'SIGUSR1', 'user-defined signal 1'],
    [11, 'SIGSEGV', 'segmentation fault'],
    [12, 'SIGUSR2', 'user-defined signal 2'],
    [13, 'SIGPIPE', 'broken pipe'],
    [14, 'SIGALRM', 'alarm clock'],
    [15, 'SIGTERM', 'terminated'],
    [16, 'SIGSTKFLT', 'stack fault'],
    [17, 'SIGCHLD', 'child exited'],
    [18, 'SIGCONT', 'continued'],
    [19, 'SIGSTOP', 'stopped (signal)'],
    [20, 'SIGTSTP', 'stopped'],
    [21, 'SIGTTIN', 'stopped (tty input)'],
    [22, 'SIGTTOU', 'stopped (tty output)'],
    [23, 'SIGURG', 'urgent I/O condition'],
    [24, 'SIGXCPU', 'CPU time limit exceeded'],
    [25, 'SIGXFSZ', 'file size limit exceeded'],
    [26, 'SIGVTALRM', 'virtual timer exceeded'],
    [27, 'SIGPROF', 'profiling timer exceeded'],
    [28, 'SIGWINCH', 'window changed'],
    [29, 'SIGPOLL', 'I/O possible'],
    [30, 'SIGPWR', 'power faliure'],
    [31, 'SIGSYS', 'bad system call'],
] as const satisfies [number, 'no signal' | NodeJS.Signals, string][] as [number, string, string][];

export const SIGNALS = SIGNAL_LIST.map<Signal>(x => ({number: x[0], name: x[1], desc: x[2]}));

export function lookupSignal(value: number | string): Signal {
    for (let signal of SIGNALS) {
        if (signal.number === value || signal.name === value || signal.desc === value) {
            return signal;
        }
    }
    if (typeof value === 'number') {
        return {number: value, name: 'unknown signal', desc: 'unknown signal'};
    } else if (value.toUpperCase().startsWith('SIG')) {
        value = value.toUpperCase();
        return {number: -1, name: value, desc: 'unknown signal'};
    } else {
        return {number: -1, name: 'unknown signal', desc: value};
    }
}



export type Message = OmitPartialGroupDMChannel<_Message>;

export type Response = undefined | void | Parameters<Message['reply']>[0] | Message | [Parameters<Message['reply']>[0] | Message, string[]];

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


let basePath = join(import.meta.dirname, '..');

export async function readFile(path: string): Promise<string> {
    return (await fs.readFile(join(basePath, path))).toString();
}

export async function writeFile(path: string, data: Parameters<typeof fs.writeFile>[1]): Promise<void> {
    await fs.writeFile(join(basePath, path), data);
}


export const config: Config = Object.freeze(JSON.parse(await readFile('config.json')));

export let aliases: {[key: string]: string} = Object.assign(Object.create(null), JSON.parse(await readFile('data/aliases.json')));

export let noReplyPings: string[] = JSON.parse(await readFile('data/no_reply_pings.json'));

export let names = new Map((await readFile('data/names.txt')).split('\n').map(x => x.split(' ')).map(x => [x[0], x.slice(1).join(' ')]));

export let simStats: {[key: string]: number} = JSON.parse(await readFile('data/sim_stats.json'));


export function sentByAdmin(msg: Message): boolean {
    return config.admins.includes(msg.author.id);
}


export interface RLEData {
    p: Pattern;
    msg: Message;
    replyTo: Message;
}

export const RLE_HEADER = /\s*x\s*=\s*\d+\s*,?\s*y\s*=\s*\d+/;

export function findRLEFromText(data: string): Pattern | undefined {
    let match = RLE_HEADER.exec(data);
    if (!match) {
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
    data = data.slice(match.index);
    let index = data.indexOf('!');
    if (index === -1) {
        return;
    }
    return parse(data.slice(0, index + 1), aliases);
}

export async function findRLEFromMessage(msg: Message, replyTo: Message): Promise<RLEData | undefined> {
    let out = findRLEFromText(msg.content);
    if (out) {
        return {p: out, msg, replyTo};
    }
    if (msg.reference && msg.reference.type === 1) {
        let msg2 = await msg.fetchReference();
        let out = await findRLEFromMessage(msg2, msg);
        if (out) {
            return out;
        }
    }
    if (!msg.author.bot && msg.attachments.size > 0) {
        for (let [_, attachment] of msg.attachments) {
            let file = attachment.name;
            if (file.endsWith('.rle') || file.endsWith('.txt')) {
                let data = await (await fetch(attachment.url)).text();
                let out = findRLEFromText(data);
                if (out) {
                    return {p: out, msg, replyTo};
                }
            } else if (file.endsWith('.rpf')) {
                let data = await (await fetch(attachment.url)).text();
                let parser = new RPFParser(PLACEHOLDER_PATTERN, '/index.rpf', data);
                return {p: parser.pattern(), msg, replyTo};
            }
        }
    }
}

export async function findRLE(msg: Message): Promise<RLEData | undefined> {
    let out: RLEData | undefined;
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
            out = await findRLEFromMessage(reply, reply);
            if (out) {
                return out;
            }
        }
    }
    let msgs = await msg.channel.messages.fetch({limit: 50});
    for (let msg of msgs.values() as MapIterator<Message>) {
        let out = await findRLEFromMessage(msg, msg);
        if (out) {
            return out;
        }
    }
}
