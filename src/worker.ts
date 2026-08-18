
import {MessagePort, parentPort} from 'node:worker_threads';

import {LifewebError} from '../lifeweb/lib/index.js';

import {BotError} from './base.js';
import {WorkerTaskTypes, WorkerTaskType, BotToWorkerMessage, WorkerToBotMessage} from './worker_manager.js';

export {deserialize} from './worker_manager.js';


export let workerTaskFunctions: {[key: string]: (data: any) => WorkerTaskTypes[string][1]} = Object.create(null);

export function registerWorkerTask<T extends WorkerTaskType>(type: T, func: (data: WorkerTaskTypes[T][0]) => (WorkerTaskTypes[T][1] | Promise<WorkerTaskTypes[T][1]>)): void {
    if (import.meta.main) {
        workerTaskFunctions[type] = Object.create(null);
    }
}

// register everything
await import('./index.js');


function sendMessage(msg: WorkerToBotMessage): void {
    (parentPort as MessagePort).postMessage(msg);
}

async function onMessage(data: BotToWorkerMessage): Promise<void> {
  let id = data.id;
    try {
        if (!(data.type in workerTaskFunctions)) {
            throw new Error(`Worker task type '${data.type}' does not have a registered function`);
        }
        let out = await workerTaskFunctions[data.type](data.data);
        sendMessage({id, ok: true, data: out});
    } catch (error) {
        let intentional = error instanceof BotError || error instanceof LifewebError || error instanceof SyntaxError;
        sendMessage({id, ok: false, intentional, error});
    }
}

if (import.meta.main) {
    if (!parentPort) {
        throw new Error('Worker is not being run as worker');
    }
    parentPort.on('message', onMessage);
}
