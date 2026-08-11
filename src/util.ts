
import * as fs from 'node:fs/promises';
import {join} from 'node:path';

import {DiscordAPIError, Message as _Message} from 'discord.js';
import {Pattern, PLACEHOLDER_PATTERN, parse} from '../lifeweb/lib/index.js';
import {RPFParser} from '../lifeweb/lib/editor/rpf.js';

import {sendMessage} from './ipc_and_error_setup.js';
import {BotError, Message, config} from './base.js';
import {aliases} from './db.js';


export const BASE_PATH = join(import.meta.dirname, '..');

export async function readFile(path: string): Promise<string> {
    return (await fs.readFile(join(BASE_PATH, path))).toString();
}

export async function writeFile(path: string, data: Parameters<typeof fs.writeFile>[1]): Promise<void> {
    await fs.writeFile(join(BASE_PATH, path), data);
}


export function sentByAdmin(msg: Message): boolean {
    return config.admins.includes(msg.author.id);
}


export interface Signal {
    number: number;
    name: string;
    desc: string;
    isError?: boolean;
};

const SIGNAL_LIST = [
    [0, 'no signal', 'completed successfully'],
    [1, 'SIGHUP', 'hangup'],
    [2, 'SIGINT', 'interrupt'],
    [3, 'SIGQUIT', 'quit'],
    [4, 'SIGILL', 'illegal instruction', true],
    [5, 'SIGTRAP', 'trace/breakpoint trap', true],
    [6, 'SIGABRT', 'aborted', true],
    [7, 'SIGBUS', 'bus error', true],
    [8, 'SIGFPE', 'floating point exception', true],
    [9, 'SIGKILL', 'killed'],
    [10, 'SIGUSR1', 'user-defined signal 1'],
    [11, 'SIGSEGV', 'segmentation fault', true],
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
    [31, 'SIGSYS', 'bad system call', true],
] as const satisfies ([number, 'no signal' | NodeJS.Signals, string] | [number, 'no signal' | NodeJS.Signals, string, true])[] as ([number, string, string] | [number, string, string, boolean])[];

export const SIGNALS = SIGNAL_LIST.map<Signal>(value => {
    let out: Signal = {number: value[0], name: value[1], desc: value[2]};
    if (value.length === 4 && value[3]) {
        out.isError = true;
    }
    return out;
});

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

export async function findRLE(msg: Message): Promise<RLEData> {
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
    throw new BotError(`Cannot find RLE!`);
}


// signal catching logic
// this isn't in ipc_and_error_setup.ts because there could be an error in the signal list setup code

for (let signal of SIGNALS) {
    if (signal.isError) {
        let message = `${signal.desc[0].toUpperCase()}${signal.desc.slice(1)} (${signal.name}, signal ${signal.number})`;
        process.on(signal.name, () => {
            sendMessage({type: 'system-error', message});
        });
    }
}
