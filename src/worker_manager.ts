
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';

import {LifewebError, Pattern, PLACEHOLDER_PATTERN, parse} from '../lifeweb/lib/index.js';
import {RPFParser, RPFPattern} from '../lifeweb/lib/editor/rpf.js';

import {ME, BotError, aliases} from './base.js';


// this interface is augmented to define new worker tasks!
// format: [input, output]
// for example:
// declare module '../worker.js' {
//     export interface WorkerTaskTypes {
//         sim: [{rle: string, args: string[]}, undefined];
//         identiify: [{rle: string, limit: number, acceptStabilized: boolean, checkLinear: boolean}]
//     }
// }
type _WorkerTaskTypesTypeGuard = {[key: string]: [unknown, unknown]};
export interface WorkerTaskTypes extends _WorkerTaskTypesTypeGuard {}

export type WorkerTaskType = keyof WorkerTaskTypes & string;

export type BotToWorkerMessage<T extends WorkerTaskType = WorkerTaskType> = {id: number, type: T, data: WorkerTaskTypes[T][0]};

export type WorkerToBotMessage<T extends WorkerTaskType = WorkerTaskType> = 
    {id: number} & (
        | {ok: true, data: WorkerTaskTypes[T][0]}
        | {ok: false, intentional: boolean, error: unknown}
    )
;

let worker: Worker;
let workerAlive = false;

interface TaskData {
    resolve: (data: WorkerTaskTypes[string][0]) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
}

let tasks = new Map<number, TaskData>();
let nextTaskID = 0;

function workerOnMessage(msg: WorkerToBotMessage): void {
    let task = tasks.get(msg.id);
    if (!task) {
        return;
    }
    if (msg.ok) {
        task.resolve(msg.data);
    } else {
        if (msg.intentional) {
            let error = new LifewebError();
            if (msg.error instanceof Error) {
                error.message = msg.error.message;
                error.name = msg.error.name;
                error[Symbol.toStringTag] = msg.error.name;
                if (msg.error.stack !== undefined) {
                    error.stack = msg.error.stack;
                }
            } else {
                error.name = 'Error';
                error.message = String(msg.error);
            }
            task.reject(error);
        } else {
            task.reject(msg.error);
        }
    }
    clearTimeout(task.timeout);
    tasks.delete(msg.id);
}

let restarting = false;

function restartWorker() {
    if (restarting) {
        return;
    }
    restarting = true;
    if (workerAlive) {
        try {
            worker.terminate();
        } catch {}
    }
    worker = new Worker(join(import.meta.dirname, 'worker.js'));
    worker.on('message', workerOnMessage);
    worker.on('error', workerOnError);
    worker.on('exit', workerOnExit);
    restarting = false;
    workerAlive = true;
}

if (ME === 'bot') {
    restartWorker();
}

function workerHandleFatal(error: Error): void {
    let rejects: ((reason: any) => void)[] = [];
    for (let [id, job] of tasks) {
        clearTimeout(job.timeout);
        tasks.delete(id);
        rejects.push(job.reject);
    }
    for (let reject of rejects) {
        reject(error);
    }
    restartWorker();
}

function workerOnError(error: Error): void {
    console.log(error);
    workerHandleFatal(error);
}

function workerOnExit(code: number): void {
    workerAlive = false;
    let msg = `Worker exited with code ${code}`;
    console.log(`${msg}, restarting worker`);
    workerHandleFatal(new BotError(`${msg}!`));
}


export function serialize(value: Pattern): string {
    if (value instanceof RPFPattern) {
        return 'rpf\n' + value.toString();
    } else {
        return 'rle\n' + value.toRLE();
    }
}

export function deserialize(value: string): Pattern {
    if (value.startsWith('rle\n')) {
        return parse(value.slice(4), aliases);
    } else {
        let parser = new RPFParser(PLACEHOLDER_PATTERN, '/index.rpf', value.slice(4));
        return parser.pattern();
    }
}


export function runWorkerTask<T extends WorkerTaskType>(type: T, data: WorkerTaskTypes[T][0]): Promise<WorkerTaskTypes[T][1]> {
    if (ME !== 'bot') {
        throw new Error(`runWorkerTask called inside ${ME}`);
    }
    let {promise, resolve, reject} = Promise.withResolvers<WorkerTaskTypes[T][1]>();
    let id = nextTaskID++;
    let timeout = setTimeout(() => {
        tasks.delete(id);
        reject(new BotError('Timed out!'));
        restartWorker();
    }, 30000);
    tasks.set(id, {resolve, reject, timeout});
    worker.postMessage({id, type, data});
    return promise;
}
