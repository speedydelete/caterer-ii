
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {parentPort} from 'node:worker_threads';

import {LifewebError, Pattern, PLACEHOLDER_PATTERN, MAPPattern, HistoryPattern, SuperPattern, InvestigatorPattern, TreePattern, findMinmax, identifyPeriodic, getDescription, identify, identifyConduit, INTSeparator, Separator, createPattern, parse} from '../lifeweb/lib/index.js';
import {RPFParser} from '../lifeweb/lib/editor/rpf.js';
import {Symmetry, findBasis, basisToString, SymmetryError, parseSymmetry} from '../lifeweb/lib/rule_symmetries/index.js';

import {BotError} from './base.js';
import {aliases} from './db.js';


if (!parentPort) {
    throw new Error('No parent port in worker');
}

export function deserialize(value: string): Pattern {
    if (value.startsWith('rle\n')) {
        return parse(value.slice(4), aliases);
    } else {
        let parser = new RPFParser(PLACEHOLDER_PATTERN, '/index.rpf', value.slice(4));
        return parser.pattern();
    }
}


export const TASK_FUNCTIONS: {[key: string]: (data: any) => any} = {};

export function registerWorkerTask<T extends WorkerTask['type']>(type: T, func: (data: WorkerTask<T>) => )


parentPort.on('message', async (data: Job) => {
    if (!parentPort) {
        throw new Error('No parent port');
    }
    let id = data.id;
    try {
        if (data.type === 'sim') {
            parentPort.postMessage({id, ok: true, data: await runSim(data.argv, data.value)});
        } else if (data.type === 'identify') {
            parentPort.postMessage({id, ok: true, data: identify(deserialize(data.value), data.limit)});
        } else if (data.type === 'basic_identify') {
            parentPort.postMessage({id, ok: true, data: identifyPeriodic(deserialize(data.value), data.limit)});
        } else if (data.type === 'minmax') {
            parentPort.postMessage({id, ok: true, data: findMinmax(deserialize(data.value), data.gens)})
        } else if (data.type === 'identify_conduit') {
            try {
                parentPort.postMessage({id, ok: true, data: identifyConduit(deserialize(data.value) as MAPPattern, data.minTime, data.maxTime, data.maxTime, data.sepGens, data.identifyGens)});
            } catch (error) {
                if (error instanceof Error && (error.message === 'Oscillators are not supported' || error.message === 'Spaceships are not supported' || error.message === `More than 1 start object! (If there isn't, there is a bug, please tell speedydelete)` || error.message === 'No start object!')) {
                    throw new BotError(error.message);
                } else {
                    throw error;
                }
            }
        } else if (data.type === 'basis') {
            let symmetry: Symmetry;
            try {
                symmetry = parseSymmetry(data.value);
            } catch (error) {
                if (error instanceof SymmetryError) {
                    throw new LifewebError(error.stack);
                } else {
                    throw error;
                }
            }
            let out = findBasis(symmetry);
            if (Array.isArray(out)) {
                out = basisToString(out);
            } else {
                out = out[0].toUpperCase() + out.slice(1);
            }
            parentPort.postMessage({id, ok: true, data: out});
        } else {
            throw new Error('Invalid type!');
        }
    } catch (error) {
        if (error instanceof BotError || error instanceof LifewebError || error instanceof SyntaxError) {
            parentPort.postMessage({id, ok: false, error: String(error), intentional: true, type: error.constructor.name});
        } else {
            parentPort.postMessage({id, ok: false, error: (error instanceof Error && error.stack) ? error.stack : String(error), intentional: false});
        }
    }
});
