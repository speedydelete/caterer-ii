
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {isMainThread} from 'node:worker_threads';

import {Message as _Message, OmitPartialGroupDMChannel} from 'discord.js';

import {IS_WRAPPER, sendMessageToWrapper} from './ipc_and_error_setup.js';


export const IS_WORKER = Boolean(!isMainThread);

export const IS_TESTING = Boolean(process.argv.includes('testing=true'));


export class BotError extends Error {

    name: string = 'BotError';
    [Symbol.toStringTag]: string = 'BotError';

}


export type Message = OmitPartialGroupDMChannel<_Message>;


export const BASE_PATH = join(import.meta.dirname, '..');

export function resolvePath(path: string): string {
    return join(BASE_PATH, path);
}

export async function readFile(path: string): Promise<string> {
    return (await fs.readFile(resolvePath(path))).toString();
}

export async function writeFile(path: string, data: Parameters<typeof fs.writeFile>[1]): Promise<void> {
    await fs.writeFile(resolvePath(path), data);
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


if (process.send && !IS_WRAPPER) {

    // ethylene glycol

    setInterval(async () => {
        await sendMessageToWrapper({type: 'heartbeat'});
    }, config.antiFreeze.sendInterval * 1000);

    // signal catching logic
    // this isn't in ipc_and_error_setup.ts because there could be an error in the signal list setup code

    for (let signal of SIGNALS) {
        if (signal.isError) {
            let message = `${signal.desc[0].toUpperCase()}${signal.desc.slice(1)} (${signal.name}, signal ${signal.number})`;
            process.on(signal.name, () => {
                sendMessageToWrapper({type: 'system-error', message});
            });
        }
    }

}
