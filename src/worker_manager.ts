
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {Worker} from 'node:worker_threads';

import {AttachmentBuilder, EmbedBuilder} from 'discord.js';
import {LifewebError, Pattern, TorusPattern, PatternType, Identified, getApgcode, getDescription, ALTERNATE_SYMMETRIES, toCatagolueRule, Conduit, CONDUIT_OBJECTS, toRanges, getConduitName, createPattern} from '../lifeweb/lib/index.js';
import {RPFPattern} from '../lifeweb/lib/editor/rpf.js';

import {BotError, Message, Response} from './base.js';


// this interface is augmented to define new worker tasks!
// format: [input, output]
// for example:
// declare module '../worker.js' {
//     export interface WorkerTaskTypes {
//         sim: [{rle: string, args: string[]}, undefined];
//         identiify: [{rle: string, limit: number, acceptStabilized: boolean, checkLinear: boolean}]
//     }
// }
export interface WorkerTaskTypes {}

export type WorkerTaskType = keyof WorkerTaskTypes;

type WorkerResult<T extends WorkerTaskType = WorkerTaskType> = 
    {id: number, type: T} & (
        | {ok: true, data: WorkerTaskTypes[T][0]}
        | {ok: false, intentional: boolean, error: unknown}
    )
;

let worker: Worker;
let workerAlive = false;

interface TaskData {
    resolve: (data: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
}

let tasks = new Map<number, TaskData>();
let nextTaskID = 0;

function workerOnMessage(msg: WorkerResult): void {
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

restartWorker();

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

function runWorkerJob(type: 'sim', data: {argv: string[], value: string}, noTimeout?: boolean): Promise<[number, string | undefined]>;
function runWorkerJob(type: 'identify', data: {value: string, limit: number}, noTimeout?: boolean): Promise<Identified>;
function runWorkerJob(type: 'basic_identify', data: {value: string, limit: number}, noTimeout?: boolean): Promise<PatternType>;
function runWorkerJob(type: 'minmax', data: {value: string, gens: number}, noTimeout?: boolean): Promise<[string, string]>;
function runWorkerJob(type: 'identify_conduit', data: {value: string, minTime: number, maxTime: number, maxRT: number, sepGens: number, identifyGens: number}, noTimeout?: boolean): Promise<false | Conduit>;
function runWorkerJob(type: 'basis', data: {value: string}, noTimeout?: boolean): Promise<string>;
function runWorkerJob(type: 'sim' | 'identify' | 'basic_identify' | 'minmax' | 'identify_conduit' | 'basis', data: any, noTimeout?: boolean): Promise<any> {
    return new Promise((resolve, reject) => {
        let id = nextTaskID++;
        let timeout = setTimeout(() => {
            if (!noTimeout) {
                jobs.delete(id);
                reject(new BotError('Timed out!'));
                restartWorker();
            }
        }, 30000);
        jobs.set(id, {resolve, reject, timeout});
        worker.postMessage({id, type, ...data} satisfies Job);
    });
}
