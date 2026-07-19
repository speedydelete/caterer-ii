
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {EmbedBuilder} from 'discord.js';

import {RuleError, Pattern, TorusPattern, PatternType, Identified, getApgcode, getDescription, ALTERNATE_SYMMETRIES, toCatagolueRule, Conduit, CONDUIT_OBJECTS, toRanges, getConduitName, createPattern} from '../lifeweb/lib/index.js';
import {RPFPattern} from '../lifeweb/lib/editor/rpf.js';
import {BotError, Message, Response, writeFile, config, names, aliases, simStats, sentByAdmin, findRLE} from './util.js';
import type {Job} from './worker.js';


type WorkerResult = {id: number, ok: true} & (
    | {type: 'sim', data: [number, string | undefined]}
    | {type: 'identify', data: Identified}
    | {type: 'basic_identify', data: PatternType}
) | {id: number, ok: false, error: string, intentional: boolean, type: string};

interface JobData {
    resolve: (data: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
}

let worker: Worker;

let workerAlive = false;

let jobs = new Map<number, JobData>();
let nextID = 0;

function workerOnMessage(msg: WorkerResult): void {
    let job = jobs.get(msg.id);
    if (!job) {
        return;
    }
    if (msg.ok) {
        job.resolve(msg.data);
    } else {
        if (msg.intentional) {
            if (msg.type === 'BotError') {
                job.reject(new BotError(msg.error));
            } else {
                job.reject(new RuleError(msg.error));
            }
        } else {
            job.reject(msg.error);
        }
    }
    clearTimeout(job.timeout);
    jobs.delete(msg.id);
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
    for (let [id, job] of jobs) {
        clearTimeout(job.timeout);
        jobs.delete(id);
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
    let msg = `Worker exited with code ` + code + '!';
    console.log(msg + ', restarting worker');
    workerHandleFatal(new Error(msg));
}

function createWorkerJob(type: 'sim', data: {argv: string[], value: string}, noTimeout?: boolean): Promise<[number, string | undefined] | null>;
function createWorkerJob(type: 'identify', data: {value: string, limit: number}, noTimeout?: boolean): Promise<Identified | null>;
function createWorkerJob(type: 'basic_identify', data: {value: string, limit: number}, noTimeout?: boolean): Promise<PatternType | null>;
function createWorkerJob(type: 'minmax', data: {value: string, gens: number}, noTimeout?: boolean): Promise<[string, string] | null>;
function createWorkerJob(type: 'identify_conduit', data: {value: string, minTime: number, maxTime: number, maxRT: number, sepGens: number, identifyGens: number}, noTimeout?: boolean): Promise<false | Conduit | null>;
function createWorkerJob(type: 'sim' | 'identify' | 'basic_identify' | 'minmax' | 'identify_conduit', data: any, noTimeout?: boolean): Promise<any> {
    return new Promise((resolve, reject) => {
        let id = nextID++;
        let timeout = setTimeout(() => {
            if (!noTimeout) {
                jobs.delete(id);
                resolve(null);
                restartWorker();
            }
        }, 30000);
        jobs.set(id, {resolve, reject, timeout});
        worker.postMessage({id, type, ...data} satisfies Job);
    });
}


let simCounter = 0;

function serialize(value: Pattern): string {
    if (value instanceof RPFPattern) {
        return 'rpf\n' + value.toRPFFile().toString();
    } else {
        return 'rle\n' + value.toRLE();
    }
}

function parseFill(fill: string, p: Pattern): number[] {
    let originalFill = fill;
    fill = fill.replaceAll('', '');
    let weightSpec = '';
    let index = fill.indexOf(',');
    if (index !== -1) {
        weightSpec = fill.slice(index + 1);
        fill = fill.slice(0, index);
    }
    if (!fill.endsWith('%')) {
        throw new BotError(`Invalid fill (expected %): '${originalFill}'`);
    }
    let fillPercent = Number(fill.slice(0, -1)) / 100;
    if (Number.isNaN(fillPercent)) {
        throw new BotError(`Invalid fill (percentage is not a number): '${originalFill}'`);
    }
    let weights: number[] = [0];
    for (let i = 1; i < p.rule.states; i++) {
        // for the empty specifier, make them all 1
        weights.push(weightSpec === '' ? 1 : 0);
    }
    for (let specifier of weightSpec.split(',')) {
        if (specifier === '') {
            continue;
        }
        let data = specifier.split('=');
        if (data.length !== 2) {
            throw new BotError(`Invalid weight specifier (expected exactly 1 equals sign): '${specifier}'`);
        }
        let states = data[0];
        let start: number;
        let end: number;
        if (states.includes('-')) {
            let range = states.split('-');
            if (range.length !== 2) {
                throw new BotError(`Invalid weight specifier (expected 0 or 1 dashes): '${specifier}'`);
            }
            start = Number(range[0]);
            if (Number.isNaN(start)) {
                throw new BotError(`Invalid weight specifier (range start is not a number): '${specifier}'`);
            }
            end = Number(range[1]);
            if (Number.isNaN(end)) {
                throw new BotError(`Invalid weight specifier (range end is not a number): '${specifier}'`);
            }
        } else {
            start = Number(states);
            if (Number.isNaN(start)) {
                throw new BotError(`Invalid weight specifier (state is not a number): '${specifier}'`);
            }
            end = start;
        }
        let weight = Number(data[1]);
        for (let i = start; i <= end; i++) {
            weights[i] = weight;
        }
    }
    let weightDiv = weights.reduce((x, y) => x + y) / fillPercent;
    let out: number[] = [1 - fillPercent];
    let total = 1 - fillPercent;
    for (let i = 1; i < p.rule.states; i++) {
        total += weights[i] / weightDiv;
        out.push(total);
    }
    return out;
}

export async function cmdSim(msg: Message, argv: string[]): Promise<Response> {
    let startTime = performance.now();
    await msg.channel.sendTyping();
    let noTimeout = false;
    if (argv[1] === 'notimeout') {
        if (!sentByAdmin(msg)) {
            noTimeout = true;
            argv = argv.slice(1);
        } else {
            throw new BotError(`You must be an admin to use notimeout!`);
        }
    }
    let p: Pattern;
    let replyTo: Message;
    if (argv[1] === 'rand') {
        let height = 16;
        let width = 16;
        if (!argv[2]) {
            throw new BotError('No arguments provided for rand!');
        }
        if (argv[2].match(/^\d+x\d+$/)) {
            let data = argv[2].split('x');
            width = Number(data[0]);
            height = Number(data[1]);
            argv = argv.slice(1);
        }
        let fill = '50%';
        if (!argv[2]) {
            throw new BotError('No arguments provided for rand!');
        }
        if (argv[2].includes('%')) {
            fill = argv[2];
            argv = argv.slice(1);
        }
        let rule = argv[2];
        if (rule === undefined) {
            throw new BotError('No rule provided for rand!');
        }
        argv = argv.slice(2);
        p = createPattern(rule, aliases);
        let weights = parseFill(fill, p);
        if (p instanceof TorusPattern && (p.height < height || p.width < width)) {
            height = p.height;
            width = p.width;
        }
        let size = height * width;
        let data = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            let value = Math.random();
            for (let state = 0; state < weights.length; state++) {
                if (value < weights[state]) {
                    data[i] = state;
                    break;
                }
            }
        }
        p.setData(height, width, data);
        replyTo = msg;
    } else {
        let data = await findRLE(msg);
        if (!data) {
            throw new BotError('Cannot find RLE');
        }
        p = data.p;
        replyTo = data.msg;
    }
    let outputTime = false;
    if (argv[1] === 'time') {
        outputTime = true;
        argv = argv.slice(1);
    }
    p.shrinkToFit();
    try {
        let data = await createWorkerJob('sim', {argv, value: serialize(p)}, noTimeout);
        if (!data) {
            return 'Error: Timed out!';
        }
        let [parseTime, desc] = data;
        let rule = p.rule.str;
        if (rule in simStats) {
            simStats[rule]++;
        } else {
            simStats[rule] = 1;
        }
        simCounter++;
        if (simCounter === 4) {
            simCounter = 0;
            await writeFile('data/sim_stats.json', JSON.stringify(simStats, undefined, 4));
        }
        let content: string | undefined = undefined;
        if (outputTime) {
            let total = Math.round(performance.now() - startTime) / 1000;
            let parse = Math.round(parseTime) / 1000;
            content = `Took ${total} seconds (${parse} to parse)`;
            if (desc) {
                content += '\n' + desc;
            }
        } else if (desc) {
            content = desc;
        }
        let out = [await replyTo.reply({
            content,
            files: ['sim.gif'],
            allowedMentions: {repliedUser: false},
        }), [replyTo.author.id]] as [Message, [string]];
        return out;
    } finally {
        try {
            await fs.rm('sim_base.gif');
        } catch {}
        try {
            await fs.rm('sim.gif');
        } catch {}
    }
}


function embedIdentified(original: Pattern, type: PatternType | Identified, isOutput?: boolean): EmbedBuilder[] {
    let out = '';
    if (type.period > 0) {
        out += `**Period:** ${type.period}\n`;
    }
    if (type.disp && (type.disp[0] !== 0 || type.disp[1] !== 0)) {
        out += `**Displacement:** (${type.disp[0]}, ${type.disp[1]})\n`;
    }
    if (type.stabilizedAt > 0) {
        out += `**Stabilizes at:** ${type.stabilizedAt}\n`;
    }
    if (type.power !== undefined) {
        out += `**Power:** ${type.power}\n`;
    }
    let pops: number[];
    if (type.period > 0) {
        pops = type.pops.slice(0, type.stabilizedAt + type.period);
    } else {
        pops = type.pops;
    }
    let minPop = Math.min(...pops);
    let avgPop = pops.reduce((x, y) => x + y, 0) / pops.length;
    let maxPop = Math.max(...pops);
    out += `**Populations:** ${minPop} | ${Math.round(avgPop * 100) / 100} | ${maxPop}\n`;
    if ('minmax' in type && type.minmax) {
        out += `**Min:** ${type.minmax[0]}\n`;
        out += `**Max:** ${type.minmax[1]}\n`;
    }
    if ('symmetry' in type) {
        out += `**Symmetry:** ${type.symmetry.replaceAll('*', '\\*')} (${ALTERNATE_SYMMETRIES[type.symmetry].replaceAll('\\', '\\\\').replaceAll('_', '\\_')})\n`;
    }
    if (type.period > 1) {
        if ('heat' in type && type.heat !== undefined) {
            out += `**Heat:** ${Math.round(type.heat * 1000) / 1000}\n`;
        }
        if ('temperature' in type && type.temperature !== undefined) {
            out += `**Temperature:** ${Math.round(type.temperature * 1000) / 1000}\n`;
        }
        if ('volatility' in type && type.volatility !== undefined) {
            out += `**Volatility:** ${Math.round(type.volatility * 1000) / 1000}\n`;
        }
        if ('strictVolatility' in type && type.strictVolatility !== undefined) {
            out += `**Strict volatility:** ${Math.round(type.strictVolatility * 1000) / 1000}\n`;
        }
    }
    type.phases[0] = original;
    type.phases[type.stabilizedAt] = original.copy().run(type.stabilizedAt);
    let apgcode = getApgcode(type);
    if (apgcode !== 'PATHOLOGICAL') {
        out += '[';
        if (apgcode.length > 1280) {
            apgcode = 'ov_' + apgcode.slice(1, apgcode.indexOf('_'));
        }
        if (apgcode.length > 31) {
            out += apgcode.slice(0, 14) + '...' + apgcode.slice(-14);
        } else {
            out += apgcode;
        }
        out += '](https://catagolue.hatsya.com/object/' + apgcode + '/' + toCatagolueRule(type.phases[0].rule.str) + ')';
    }
    let title = 'desc' in type ? type.desc : getDescription(type);
    let name: string | undefined = undefined;
    if (apgcode.startsWith('x') || apgcode.startsWith('y')) {
        name = names.get(apgcode);
    } else {
        name = names.get(type.phases[0].toCanonicalApgcode(1, 'x'));
    }
    if (name !== undefined) {
        title = name + ' (' + title + ')';
    }
    if (isOutput) {
        title = 'Output: ' + title;
    }
    let embeds = [(new EmbedBuilder()).setTitle(title).setDescription(out)];
    if ('output' in type && type.output) {
        embeds.push(...embedIdentified(Object.assign(original.clearedCopy(), type.output.phases[0]), type.output, true));
    }
    return embeds;
}

export async function cmdIdentify(msg: Message, argv: string[]): Promise<Response> {
    await msg.channel.sendTyping();
    let noTimeout = false;
    if (argv[1] === 'notimeout') {
        if (!sentByAdmin(msg)) {
            noTimeout = true;
            argv = argv.slice(1);
        } else {
            throw new BotError(`You must be an admin to use notimeout!`);
        }
    }
    let limit = 1024;
    if (argv[1]) {
        let parsed = Number(argv[1]);
        if (Number.isNaN(parsed)) {
            throw new BotError(`Invalid number: '${argv[1]}'`);
        }
        limit = parsed;
    }
    let data = await findRLE(msg);
    if (!data) {
        throw new BotError('Cannot find RLE');
    }
    let out = await createWorkerJob('identify', {value: serialize(data.p), limit}, noTimeout);
    if (!out) {
        throw new BotError('Timed out!');
    }
    return {embeds: embedIdentified(data.p, out)};
}

export async function cmdBasicIdentify(msg: Message, argv: string[]): Promise<Response> {
    await msg.channel.sendTyping();
    let noTimeout = false;
    if (argv[1] === 'notimeout') {
        if (!sentByAdmin(msg)) {
            noTimeout = true;
            argv = argv.slice(1);
        } else {
            throw new BotError(`You must be an admin to use notimeout!`);
        }
    }
    let limit = 1024;
    if (argv[1]) {
        let parsed = Number(argv[1]);
        if (!Number.isNaN(parsed)) {
            limit = parsed;
        }
    }
    let data = await findRLE(msg);
    if (!data) {
        throw new BotError('Cannot find RLE');
    }
    let out = await createWorkerJob('basic_identify', {value: serialize(data.p), limit}, noTimeout);
    if (!out) {
        throw new BotError('Timed out!');
    }
    return {embeds: embedIdentified(data.p, out)};
}

export async function cmdMinmax(msg: Message, argv: string[]): Promise<Response> {
    await msg.channel.sendTyping();
    let noTimeout = false;
    if (argv[1] === 'notimeout') {
        if (!sentByAdmin(msg)) {
            noTimeout = true;
            argv = argv.slice(1);
        } else {
            throw new BotError(`You must be an admin to use notimeout!`);
        }
    }
    let gens = Number(argv[1]);
    if (Number.isNaN(gens)) {
        throw new BotError('Argument 1 is not a valid number');
    }
    let data = await findRLE(msg);
    if (!data) {
        throw new BotError('Cannot find RLE');
    }
    let out = await createWorkerJob('minmax', {value: serialize(data.p), gens}, noTimeout);
    if (!out) {
        throw new BotError('Timed out!');
    }
    return `Min: ${out[0]}\nMax: ${out[1]}`;
}

export async function cmdIdentifyConduit(msg: Message, argv: string[]): Promise<Response> {
    await msg.channel.sendTyping();
    let noTimeout = false;
    if (argv[1] === 'notimeout') {
        if (!sentByAdmin(msg)) {
            noTimeout = true;
            argv = argv.slice(1);
        } else {
            throw new BotError(`You must be an admin to use notimeout!`);
        }
    }
    let minTime = argv[1] ? parseInt(argv[1]) : 0;
    let sepGens = argv[2] ? parseInt(argv[2]) : 0;
    let maxTime = argv[3] ? parseInt(argv[3]) : 512;
    let identifyGens = argv[4] ? parseInt(argv[4]) : 256;
    let rleData = await findRLE(msg);
    if (!rleData) {
        throw new BotError('Cannot find RLE');
    }
    let p = rleData.p;
    if (p.rule.str.includes('History') || p.rule.str.includes('Super')) {
        p.setData(p.height, p.width, p.getData().map(x => x % 2));
    }
    let data = await createWorkerJob('identify_conduit', {value: serialize(p), minTime, maxTime, maxRT: maxTime, sepGens, identifyGens}, noTimeout);
    if (data === null) {
        throw new BotError('Timed out!');
    }
    if (data === false) {
        return 'Error: Not a conduit!';
    }
    let title = getConduitName(data, true).replaceAll('_', '\\_').replaceAll('*', '\\*');
    let out: string[] = [];
    let inputTimeStr = data.inputTime ? ` at generation ${data.inputTime}` : '';
    if (data.input in CONDUIT_OBJECTS) {
        let name = CONDUIT_OBJECTS[data.input][0];
        name = name[0].toUpperCase() + name.slice(1);
        out.push(`**Input:** ${name}${inputTimeStr}`);
    } else {
        out.push(`**Input:** ${data.input}${inputTimeStr}`);
    }
    for (let obj of data.output) {
        let suffix = `at generation ${obj.time} and position (${obj.x}, ${obj.y})`;
        if (obj.objTime !== 0) {
            suffix = `(after ${obj.objTime} generation${obj.objTime === 1 ? '' : 's'}) ` + suffix;
        }
        if (obj.obj in CONDUIT_OBJECTS) {
            let name = CONDUIT_OBJECTS[obj.obj][0];
            name = name[0].toUpperCase() + name.slice(1);
            out.push(`**Output:** ${name} ${suffix}`);
        } else {
            out.push(`**Output:** ${obj.obj} ${suffix}`);
        }
    }
    for (let glider of data.gliders) {
        out.push(`**Output:** ${glider.dir} glider lane ${glider.lane} timing ${glider.timing}`);
    }
    for (let obj of data.otherOutputs) {
        out.push(`**Output:** ${obj.code} (${obj.x}, ${obj.y})`);
    }
    if (data.repeatTime !== undefined) {
        out.push(`**Repeat time:** ${data.repeatTime}`);
        if (data.overclock) {
            if (data.overclock.length === 0) {
                out.push('**No overclock**');
            } else {
                out.push(`**Overclock:** ${toRanges(data.overclock)}`);
            }
        }
    }
    return {embeds: [(new EmbedBuilder()).setTitle(title).setDescription(out.join('\n'))]};
}
