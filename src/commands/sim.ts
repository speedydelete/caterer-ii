
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';

import {Pattern, TreePattern, HistoryPattern, SuperPattern, InvestigatorPattern, TorusPattern, identifyPeriodic, getDescription, INTSeparator, Separator, createPattern} from '../../lifeweb/lib/index.js';

import {BotError, resolvePath, readFile, writeFile, aliases, requiredArg, optionalArg, optionalVariadicArg, flagArg, patternArg, addCommand, createEmbed} from '../base.js';
import {deserialize, registerWorkerTask} from '../worker.js';
import {serialize, runWorkerTask} from '../worker_manager.js';


const HISTORY_COLORS: [number, number, number][] = [[0, 255, 0], [0, 0, 128], [216, 255, 216], [255, 0, 0], [255, 255, 0], [96, 96, 96]];

const SUPER_COLORS: [number, number, number][] = [[0, 255, 0], [0, 0, 160], [255, 216, 255], [255, 0, 0], [255, 255, 0], [96, 96, 96], [255, 105, 180], [128, 0, 128], [0, 191, 255], [0, 64, 128], [64, 224, 208], [0, 128, 64], [255, 255, 255], [255, 99, 71], [250, 128, 114], [219, 112, 147], [255, 165, 0], [245, 222, 179], [0, 255, 255], [192, 192, 192], [192, 255, 128], [255, 182, 193], [0, 255, 127], 
[0, 0, 0], [255, 0, 127]];

const INVESTIGATOR_COLORS: [number, number, number][] = [[0, 236, 91], [0, 192, 255], [255, 0, 0], [255, 255, 255], [75, 75, 75], [233, 41, 255], [64, 0, 128], [255, 230, 0], [150, 128, 0], [130, 200, 0], [120, 40, 0], [255, 140, 0], [140, 70, 0], [0, 0, 255], [192, 192, 192], [128, 128, 128], [255, 112, 140], [249, 237, 249], [0, 152, 127], [0, 73, 59]];

const SEPARATOR_COLORS: [number, number, number][] = [[0, 255, 0], [0, 0, 255], [255, 0, 0], [255, 37, 179], [255, 225, 120], [0, 255, 255], [0, 127, 255], [255, 202, 240], [0, 112, 7], [135, 60, 0], [15, 0, 82], [15, 255, 157], [127, 0, 67], [217, 255, 0], [0, 157, 210], [150, 172, 142], [142, 44, 202], [255, 142, 0], [255, 120, 127], [135, 97, 165], [127, 120, 0], [150, 210, 82], [255, 0, 255], [255, 150, 255], [0, 52, 7], [157, 105, 97], [0, 179, 135], [255, 195, 165], [179, 232, 255], [255, 0, 112], [187, 255, 187], [67, 7, 0], [187, 7, 30], [0, 112, 105], [255, 217, 0], [0, 187, 0], [0, 52, 105], [0, 75, 255], [150, 22, 135], [210, 142, 67], [44, 0, 37], [217, 97, 157], [75, 60, 0], [165, 179, 255], [142, 142, 165], [0, 52, 172], [255, 255, 232], [255, 112, 67], [165, 22, 255], [165, 120, 247], [89, 120, 60], [150, 255, 67], [0, 179, 82], [0, 179, 187], [179, 179, 22], [172, 187, 105], [240, 89, 240], [44, 112, 187], [165, 60, 60], [240, 255, 105], [22, 97, 127], [105, 60, 89], [0, 0, 165], [82, 255, 202], [157, 135, 82], [0, 255, 105], [210, 157, 0], [142, 225, 202], [232, 150, 165], [0, 22, 0], [89, 15, 89], [0, 7, 30], [97, 97, 75], [89, 7, 135], [195, 37, 89], [210, 150, 217], [210, 187, 187], [97, 142, 0], [195, 97, 0], [255, 0, 67], [247, 247, 179], [210, 120, 89], [97, 165, 82], [60, 60, 142], [0, 120, 75], [150, 255, 150], [0, 165, 255], [195, 0, 120], [67, 217, 255], [187, 97, 187], [165, 112, 142], [157, 210, 0], [135, 135, 232], [0, 0, 52], [255, 89, 0], [105, 60, 37], [217, 247, 142], [112, 0, 0], [82, 105, 255], [142, 97, 7], [75, 7, 217], [225, 187, 120], [37, 15, 7], [195, 0, 172], [135, 179, 187], [89, 89, 127], [22, 67, 52], [30, 150, 0], [172, 75, 105], [127, 75, 179], [255, 240, 255], [150, 67, 127], [255, 105, 202], [127, 195, 142], [210, 67, 255], [37, 82, 0], [195, 195, 232], [97, 225, 89], [255, 82, 150], [135, 202, 255], [172, 52, 0], [247, 82, 82], [97, 127, 127], [112, 37, 52], [210, 217, 0], [82, 165, 142], [187, 165, 60], [89, 217, 142], [112, 97, 105], [60, 52, 30], [255, 7, 217], [179, 75, 202], [112, 142, 195], [210, 30, 0], [210, 195, 157], [157, 142, 127], [195, 225, 179], [255, 187, 89], [255, 150, 210], [135, 82, 255], [22, 142, 165], [0, 0, 120], [37, 217, 195], [52, 44, 75], [195, 217, 210], [30, 89, 195], [195, 255, 97], [255, 150, 97], [135, 247, 255], [157, 97, 52], [195, 142, 112], [157, 217, 127], [67, 60, 210], [82, 89, 0], [52, 30, 89], [89, 127, 97], [60, 75, 30], [202, 82, 60], [210, 0, 67], [202, 150, 255], [195, 157, 195], [67, 232, 37], [105, 179, 7], [240, 202, 60], [255, 157, 142], [120, 142, 52], [135, 0, 44], [255, 0, 142], [0, 150, 82], [82, 0, 44], [142, 0, 157], [195, 105, 255], [89, 60, 60], [255, 127, 165], [195, 105, 105], [255, 82, 120], [255, 172, 0], [0, 52, 75], [247, 150, 60], [202, 60, 165], [202, 210, 89], [187, 142, 150], [0, 82, 89], [187, 15, 202], [150, 15, 105], [105, 97, 44], [60, 30, 0], [187, 120, 0], [217, 187, 247], [255, 195, 202], [255, 179, 120], [150, 172, 52], [255, 247, 0], [89, 37, 127], [22, 89, 142], [210, 255, 232], [97, 37, 0], [187, 97, 44], [37, 89, 52], [112, 210, 105], [82, 75, 135], [60, 30, 44], [105, 210, 7], [97, 89, 210], [157, 142, 202], [89, 150, 97], [89, 179, 210], [255, 60, 52], [112, 67, 7], [210, 75, 89], [82, 150, 255], [127, 97, 67], [150, 255, 210], [89, 7, 165], [210, 120, 240], [135, 157, 97], [89, 97, 179], [217, 82, 7], [37, 30, 127], [195, 112, 172], [157, 7, 217], [75, 112, 0], [120, 255, 0], [89, 135, 165], [255, 127, 105], [255, 240, 75], [187, 217, 67], [179, 255, 15], [157, 112, 210], [44, 112, 44], [135, 82, 225], [255, 127, 44], [112, 60, 127], [165, 127, 7], [172, 22, 52], [142, 82, 97], [179, 172, 112], [142, 179, 0], [52, 0, 15], [0, 75, 150], [142, 67, 44], [255, 225, 172], [89, 172, 60], [195, 225, 150], [255, 217, 202], [247, 112, 232], [75, 89, 89], [7, 232, 112], [179, 52, 112], [75, 30, 75], [112, 15, 255], [165, 255, 120], [225, 225, 135], [105, 0, 195], [172, 135, 60]];


interface Frame<T extends boolean = boolean> {
    p: Pattern;
    time: T extends true ? number : number | undefined;
}

interface SimData {
    frames: Frame<true>[];
    gifSize: number;
    minX: number;
    minY: number;
    width: number;
    height: number;
    useAdvancedColors: boolean;
    customColors: {[key: number]: [number, number, number]};
    text?: string;
}

interface PartRunnerData {
    partCount: number;
    gifSize: number;
    time: number | undefined;
    text: string | undefined;
    useAdvancedColors: boolean;
    customColors: {[key: number]: [number, number, number]};
    bb: [number, number, number, number] | undefined;
    origin: [number, number];
}

function getFrame(p: Pattern, {time, bb, origin}: PartRunnerData): Frame {
    let out: Pattern;
    if (bb && !(p instanceof INTSeparator || p instanceof Separator)) {
        let x = bb[0] - p.xOffset;
        let y = bb[1] - p.yOffset;
        out = p.copyPart(Math.max(x, 0), Math.max(y, 0), bb[3], bb[2]);
    } else {
        out = p.copy();
    }
    if (origin) {
        out.xOffset -= origin[0];
        out.yOffset -= origin[1];
    }
    return {p: out, time};
}

function runGeneration(p: Pattern): void {
    if (p instanceof Separator || p instanceof INTSeparator) {
        if (p.generation % 2 === 0) {
            p.runGeneration();
        } else {
            p.resolveKnots();
            p.generation++;
        }
    } else {
        p.runGeneration();
    }
    p.shrinkToFit();
}

function runPart(part: (string | number)[], frames: Frame[], p: Pattern, data: PartRunnerData): void {
    while (part.length > 0) {
        if (typeof part[0] === 'number') {
            if (part[1] === 'fps') {
                data.time = Math.ceil(100 / part[0]);
                part = part.slice(2);
            } else {
                let step = 1;
                let remove = 1;
                if (typeof part[1] === 'number') {
                    step = part[1];
                    remove = 2;
                }
                if (data.partCount === 1) {
                    part[0] = part[0] - 1;
                    if (part[0] === 0) {
                        continue;
                    }
                }
                for (let i = 0; i < Math.ceil(part[0] / step); i++) {
                    for (let j = 0; j < step; j++) {
                        runGeneration(p);
                    }
                    frames.push(getFrame(p, data));
                }
                part = part.slice(remove);
            }
        } else if (part[0] === 'size') {
            if (typeof part[1] !== 'number') {
                throw new BotError(`Invalid part: Expected argument of type number for "size", got type ${typeof part[1]}: ${part.join(' ')}`);
            }
            data.gifSize = part[1];
            part = part.slice(2);
        } else if (part[0] === 'wait' || part[0] === 'pause') {
            if (typeof part[1] !== 'number') {
                throw new BotError(`Invalid part: Expected argument of type number for "${part[0]}", got type ${typeof part[1]}: ${part.join(' ')}`);
            }
            let frame = getFrame(p, data);
            frame.time = part[1] * 100;
            frames.push(frame);
            part = part.slice(2);
        } else if (part[0] === 'jump') {
            if (typeof part[1] !== 'number') {
                throw new BotError(`Invalid part: Expected argument of type number for "jump", got type ${typeof part[1]}: ${part.join(' ')}`);
            }
            if (frames.length === 1) {
                frames = [];
            }
            for (let j = 0; j < part[1]; j++) {
                runGeneration(p);
            }
            part = part.slice(2);
        } else if (part[0] === 'stable') {
            part = part.slice(1);
            let security = 16;
            if (typeof part[0] === 'number') {
                security = part[0];
                part = part.slice(1);
            }
            let pops: number[] = [];
            for (let i = 0; i < 120000; i++) {
                runGeneration(p);
                frames.push(getFrame(p, data));
                let pop = p.population;
                if (pop === 0) {
                    break;
                }
                let found = false;
                for (let period = 1; period < Math.floor(i / security); period++) {
                    found = true;
                    for (let j = 1; j < security; j++) {
                        if (pop !== pops[pops.length - period * j]) {
                            found = false;
                            break;
                        }
                    }
                    if (found) {
                        break;
                    }
                }
                if (found) {
                    break;
                }
                for (let period = 1; period < Math.floor(i / security); period++) {
                    let diff = pop - pops[pops.length - period];
                    found = true;
                    for (let j = 1; j < security; j++) {
                        if (diff !== pops[pops.length - period * j] - pops[pops.length - period * (j + 1)]) {
                            found = false;
                            break;
                        }
                    }
                    if (found) {
                        break;
                    }
                }
                if (found) {
                    break;
                }
                pops.push(pop);
            }
        } else if (part[0] === 'identify') {
            part = part.slice(1);
            let type = identifyPeriodic(p, 120000, true);
            data.text = getDescription(type);
            for (let i = 0; i < type.stabilizedAt + type.period - (type.disp && type.disp[0] === 0 && type.disp[1] === 0 ? 1 : 0); i++) {
                runGeneration(p);
                frames.push(getFrame(p, data));
            }
            if (typeof part[0] === 'string' && part[0].match(/^x[0-9]+$/)) {
                let amount = Number(part[0].slice(1));
                if (type.period > 0) {
                    for (let i = 0; i < (amount - 1) * type.period; i++) {
                        runGeneration(p);
                        frames.push(getFrame(p, data));
                    }
                }
                part = part.slice(1);
            }
        } else if (part[0] === 'setrule') {
            if (typeof part[1] === 'number') {
                throw new BotError(`Invalid part: Expected argument of type string for "setrule", got type ${typeof part[1]}: ${part.join(' ')}`);
            }
            let q = createPattern(part[1], aliases);
            q.setData(p.height, p.width, p.getData());
            q.xOffset = p.xOffset;
            q.yOffset = p.yOffset;
            q.generation = p.generation;
            p = q;
            part = part.slice(2);
        } else if (part[0] === 'text') {
            if (typeof part[1] === 'number') {
                throw new BotError(`Invalid part: Expected argument of type string for "text", got type ${typeof part[1]}: ${part.join(' ')}`);
            }
            data.text = part[1];
            part = part.slice(2);
        } else if (part[0] === 'color') {
            if (typeof part[1] !== 'number') {
                throw new BotError(`Invalid part: Expected argument 1 to be of type number for "color", got type ${typeof part[1]}: ${part.join(' ')}`);
            }
            let value = String(part[2]);
            if (value.startsWith('#')) {
                value = value.slice(1);
            }
            let color: [number, number, number];
            if (value.length === 3) {
                color = [parseInt(value[0], 16) * 17, parseInt(value[1], 16) * 17, parseInt(value[2], 16) * 17];
            } else if (value.length === 6) {
                color = [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
            } else {
                throw new BotError(`Invalid color: '${value}'`);
            }
            data.customColors[part[1]] = color;
            part = part.slice(3);
        } else if (part[0] === 'useadvancedcolors') {
            data.useAdvancedColors = true;
            part = part.slice(1);
        } else if (part[0] === 'bb') {
            if (typeof part[1] !== 'number' || typeof part[2] !== 'number' || typeof part[3] !== 'number' || typeof part[4] !== 'number') {
                throw new BotError(`Invalid part: Expected 4 arguments of type number for "bb": ${part.join(' ')}`);
            }
            data.bb = [part[1], part[2], part[3], part[4]];
            part = part.slice(5);
        } else if (part[0] === 'movebb') {
            if (typeof part[1] !== 'number' || typeof part[2] !== 'number') {
                throw new BotError(`Invalid part: Expected 2 arguments of type number for "movebb": ${part.join(' ')}`);
            }
            if (!data.bb) {
                throw new BotError(`Cannot use "movebb" before using "bb"!`);
            }
            data.bb[0] += part[1];
            data.bb[1] += part[2];
            part = part.slice(2);
        } else if (part[0] === 'resizebb') {
            if (typeof part[1] !== 'number' || typeof part[2] !== 'number') {
                throw new BotError(`Invalid part: Expected 2 arguments of type number for "resizebb": ${part.join(' ')}`);
            }
            if (!data.bb) {
                throw new BotError(`Cannot use "resizebb" before using "bb"!`);
            }
            data.bb[2] = part[1];
            data.bb[3] = part[2];
            part = part.slice(2);
        } else if (part[0] === 'origin') {
            if (typeof part[1] !== 'number' || typeof part[2] !== 'number') {
                throw new BotError(`Invalid part: Expected 2 arguments of type number for "origin": ${part.join(' ')}`);
            }
            data.origin = [part[1], part[2]];
            part = part.slice(3);
        } else if (part[0] === 'moveorigin') {
            if (typeof part[1] !== 'number' || typeof part[2] !== 'number') {
                throw new BotError(`Invalid part: Expected 2 arguments of type number for "moveorigin": ${part.join(' ')}`);
            }
            data.origin = [part[1], part[2]];
            part = part.slice(3);
        } else if (part[0].endsWith('x') && part[1] === 'faster') {
            if (data.time === undefined) {
                throw new BotError(`Must use \`fps\` before using \`faster\`!`);
            }
            data.time /= Number(part[0].slice(0, -1));
            if (Number.isNaN(data.time)) {
                throw new BotError(`Invalid part: Invalid number: ${part.join(' ')}`);
            }
            part = part.slice(2);
        } else if (part[0] === 'removefirst') {
            frames.shift();
            part = part.slice(1);
        } else {
            throw new BotError(`Invalid part: Unrecognized command: ${part.join(' ')}`);
        }
    }
}

function runParts(parts: (string | number)[][], frames: Frame[], p: Pattern, data: PartRunnerData): void {
    if (parts.some(x => x[0] === 'repeat' || x[0] === 'endrepeat')) {
        let level = 0;
        let times = 0;
        let current: (string | number)[][] = [];
        for (let part of parts) {
            if (part[0] === 'repeat') {
                if (level === 0) {
                    if (typeof part[1] !== 'number') {
                        throw new BotError(`Invalid part: Expected argument of type number for "repeat", got type ${typeof part[1]}: ${part.join(' ')}`);
                    }
                    times = part[1];
                } else {
                    current.push(part);
                }
                level++;
            } else if (part[0] === 'endrepeat') {
                level--;
                if (level === 0) {
                    if (times === 0) {
                        throw new Error('Times is 0 (this is a bug!)');
                    }
                    for (let i = 0; i < times; i++) {
                        runParts(current, frames, p, data);
                    }
                    times = 0;
                } else if (level < 0) {
                    throw new BotError(`Unmatched endrepeat`);
                } else {
                    current.push(part);
                }
            } else {
                if (level === 0) {
                    runPart(part, frames, p, data);
                } else {
                    current.push(part);
                }
            }
        }
        if (level > 0) {
            throw new BotError(`Unmatched repeat`);
        }
    } else {
        for (let part of parts) {
            runPart(part, frames, p, data);
        }
    }
}

function parseSim(pattern: string, argv: string[]): SimData {
    let p = deserialize(pattern).shrinkToFit();
    let parts: (string | number)[][] = [];
    let currentPart: (string | number)[] = [];
    for (let arg of argv) {
        arg = arg.replaceAll('`', '');
        if (arg === '>' || arg === '\n') {
            parts.push(currentPart);
            currentPart = [];
        } else if (arg === '') {
            continue;
        } else {
            if (arg.match(/^([0-9.-]+|-?Infinity|-?NaN)$/)) {
                currentPart.push(Number(arg));
            } else if (arg === 'repeat') {
                parts.push(currentPart);
                currentPart = [arg];
            } else if (arg === 'endrepeat') {
                parts.push(currentPart, [arg]);
                currentPart = [];
            } else {
                currentPart.push(arg);
            }
            if (currentPart.length === 2 && currentPart[0] === 'repeat') {
                parts.push(currentPart);
                currentPart = [];
            }
        }
    }
    if (currentPart.length > 0) {
        parts.push(currentPart);
    }
    let time: number | undefined = undefined;
    if (parts[0] && parts[0][1] === 'fps' && typeof parts[0][0] === 'number') {
        time = Math.ceil(100 / parts[0][0]);
    }
    let frames: Frame[] = [{p: p.copy(), time}];
    let gifSize = 200;
    let data: PartRunnerData = {
        partCount: parts.length,
        gifSize: 200,
        time,
        text: undefined,
        useAdvancedColors: false,
        customColors: {},
        bb: undefined,
        origin: [0, 0],
    };
    runParts(parts, frames, p, data);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let {p} of frames) {
        if (p.xOffset < minX) {
            minX = p.xOffset;
        }
        if (p.xOffset + p.width > maxX) {
            maxX = p.xOffset + p.width;
        }
        if (p.yOffset < minY) {
            minY = p.yOffset;
        }
        if (p.yOffset + p.height > maxY) {
            maxY = p.yOffset + p.height;
        }
    }
    minX = Math.floor(minX - 1);
    maxX = Math.floor(maxX + 1);
    minY = Math.floor(minY - 1);
    maxY = Math.floor(maxY + 1);
    let width = maxX - minX;
    let height = maxY - minY;
    let defaultTime = Math.ceil(Math.min(1, Math.max(1/50, 4 / frames.length)) * 100);
    return {frames: frames.map(({p, time}) => ({p, time: Math.max(time ?? defaultTime, 2)})), gifSize, minX, minY, width, height, useAdvancedColors: data.useAdvancedColors, customColors: data.customColors, text: data.text};
}

const SIM_BASE_PATH = resolvePath('sim_base.gif');

async function runSim(input: {pattern: string, argv: string[], outFilePath: string}): Promise<{parseTime: number, text?: string}> {
    let startTime = performance.now();
    let {frames, gifSize, minX, minY, width, height, useAdvancedColors, customColors, text} = parseSim(input.pattern, input.argv);
    let parseTime = performance.now() - startTime;
    let xOffset = 0;
    let yOffset = 0;
    if (minX < 0) {
        xOffset = -minX;
        minX = 0;
    }
    if (minY < 0) {
        yOffset = -minY;
        minY = 0;
    }
    let p = frames[0].p;
    let colorCount = Math.max(p.rule.states, ...Object.keys(customColors).map(x => Number(x)));
    if (p instanceof Separator || p instanceof INTSeparator) {
        colorCount = 256;
    }
    let bitWidth = Math.max(2, Math.ceil(Math.log2(colorCount)));
    let colors = 2**bitWidth;
    let clearCode = 1 << bitWidth;
    let endCode = (1 << bitWidth) + 1;
    let codeSize = bitWidth + 1;
    let gifData: Uint8Array[] = [new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, width & 255, (width >> 8) & 255, height & 255, (height >> 8) & 255, 0xf0 | (bitWidth - 1), 0x00, 0x00])];
    let gct = new Uint8Array(colors * 3);
    let i = 0;
    if (customColors[0]) {
        let [r, g, b] = customColors[0];
        gct[i++] = r;
        gct[i++] = g;
        gct[i++] = b;
    } else {
        gct[i++] = 0x36;
        gct[i++] = 0x39;
        gct[i++] = 0x3e;
    }
    let clsP = p;
    for (let i = 0; i < 10; i++) {
        if (clsP instanceof HistoryPattern || clsP instanceof SuperPattern || clsP instanceof InvestigatorPattern || clsP instanceof Separator || clsP instanceof INTSeparator) {
            break;
        } else if ('pattern' in clsP && clsP.pattern && typeof clsP.pattern === 'object' && clsP.pattern.constructor.name.includes('Pattern')) {
            clsP = clsP.pattern as Pattern;
        } else if ('p' in clsP && clsP.p && typeof clsP.p === 'object' && clsP.p.constructor.name.includes('Pattern')) {
            clsP = clsP.p as Pattern;
        } else {
            break;
        }
    }
    for (let value = 1; value < colors; value++) {
        let r: number;
        let g: number;
        let b: number;
        if (customColors[value]) {
            [r, g, b] = customColors[value];
        } else if (clsP instanceof Separator || clsP instanceof INTSeparator) {
            [r, g, b] = SEPARATOR_COLORS[value - 1];
        } else if (value >= p.rule.states) {
            [r, g, b] = gct;
        } else if (p.rule.states === 2) {
            r = 0xff;
            g = 0xff;
            b = 0xff;
        } else if (clsP instanceof TreePattern && clsP.atRule.colors && clsP.atRule.colors[value]) {
            [r, g, b] = clsP.atRule.colors[value];
        } else if (clsP instanceof HistoryPattern) {
            [r, g, b] = HISTORY_COLORS[value - 1];
        } else if (clsP instanceof SuperPattern) {
            [r, g, b] = SUPER_COLORS[value - 1];
        } else if (clsP instanceof InvestigatorPattern) {
            [r, g, b] = INVESTIGATOR_COLORS[value - 1];
        } else {
            r = 0xff;
            g = 0xff - Math.max(0, Math.ceil((value - 1) / (p.rule.states - 2) * 256) - 1);
            b = 0;
        }
        gct[i++] = r;
        gct[i++] = g;
        gct[i++] = b;
    }
    gifData.push(gct);
    gifData.push(new Uint8Array([0x21, 0xff, 0x0b, 0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00]));
    let history = new Uint8Array(width * height);
    for (let {p, time} of frames) {
        let startX = Math.floor(p.xOffset - minX + xOffset);
        let startY = Math.floor(p.yOffset - minY + yOffset);
        let pHeight = Math.floor(p.height);
        let pWidth = Math.floor(p.width);
        let endX = startX + pWidth;
        let endY = startY + pHeight;
        let pData: Uint8Array | Uint32Array;
        if (p instanceof Separator || p instanceof INTSeparator) {
            pData = p.groups;
        } else {
            pData = p.getData();
        }
        let index = 0;
        gifData.push(new Uint8Array([0x21, 0xf9, 0x04, 0x00, time & 255, (time >> 8) & 255, 0xff, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, width & 255, (width >> 8) & 255, height & 255, (height >> 8) & 255, 0x00]));
        let data: number[] = [];
        for (let y = 0; y < startY; y++) {
            for (let x = 0; x < width; x++) {
                data.push(clearCode, 0);
            }
        }
        for (let y = startY; y < endY; y++) {
            for (let x = 0; x < startX; x++) {
                data.push(clearCode, 0);
            }
            for (let x = startX; x < endX; x++) {
                let value = pData[index++];
                data.push(clearCode);
                if (useAdvancedColors) {
                    let i = y * width + x;
                    if (p.rule.states === 2) {
                        if (value === 0) {
                            if (history[i] === 0 || history[i] > 128) {
                                history[i] = 2;
                            } else if (history[i] < 128) {
                                history[i]++;
                            }
                            let state = history[i];
                            if (!(state in customColors) && 128 in customColors) {
                                data.push(128);
                            } else {
                                data.push(state);
                            }
                        } else {
                            if (history[i] < 129) {
                                history[i] = 129;
                            } else if (history[i] < 255) {
                                history[i]++;
                            }
                            let state = history[i];
                            if (!(state in customColors) && 255 in customColors) {
                                data.push(255);
                            } else {
                                data.push(state);
                            }
                        }
                    } else if (value === 0) {
                        if (history[i] === 0) {
                            history[i] = p.rule.states;
                        } else if (history[i] < 255) {
                            history[i]++;
                        }
                        let state = history[i];
                        if (!(state in customColors) && 255 in customColors) {
                            data.push(255);
                        } else {
                            data.push(state);
                        }
                    } else {
                        history[i] = 0;
                        data.push(value);
                    }
                } else {
                    data.push(value);
                }
            }
            for (let x = endX; x < width; x++) {
                data.push(clearCode, 0);
            }
        }
        for (let y = endY; y < height; y++) {
            for (let x = 0; x < width; x++) {
                data.push(clearCode, 0);
            }
        }
        data.push(endCode);
        let out: number[] = [];
        let accumulator = 0;
        let bitCount = 0;
        for (let value of data) {
            accumulator |= value << bitCount;
            bitCount += codeSize;
            while (bitCount >= 8) {
                out.push(accumulator & 0xff);
                accumulator >>= 8;
                bitCount -= 8;
            }
        }
        if (bitCount > 0) {
            out.push(accumulator & 0xff);
        }
        gifData.push(new Uint8Array([bitWidth]));
        let i = 0;
        while (i < out.length) {
            let length = Math.min(255, out.length - i);
            gifData.push(new Uint8Array([length, ...out.slice(i, i + length)]));
            i += length;
        }
        gifData.push(new Uint8Array([0x00]));
    }
    gifData.push(new Uint8Array([0x3b]));
    let length = 0;
    for (let array of gifData) {
        length += array.length;
    }
    let out = new Uint8Array(length);
    let offset = 0;
    for (let array of gifData) {
        out.set(array, offset);
        offset += array.length;
    }
    await fs.writeFile(SIM_BASE_PATH, out);
    let scale = Math.ceil(gifSize / Math.min(width, height));
    gifSize = Math.min(width, height) * scale;
    execSync(`gifsicle --resize-${width < height ? 'width' : 'height'} ${gifSize} -O3 '${SIM_BASE_PATH}' > '${input.outFilePath}'`);
    return {parseTime, text};
}


declare module '../worker_manager.js' {
    export interface WorkerTaskTypes {
        sim: [{pattern: string, argv: string[], outFilePath: string}, {parseTime: number, text?: string}];
    }
}

registerWorkerTask('sim', runSim);


export let simStats: {[key: string]: number} = JSON.parse(await readFile('data/sim_stats.json'));

async function runSimCommand(p: Pattern, argv: string[], showTime?: boolean): Promise<string | undefined> {
    p.shrinkToFit();
    let startTime = performance.now();
    let {parseTime, text} = await runWorkerTask('sim', {pattern: serialize(p), argv, outFilePath: 'sim.gif'});
    let rule = p.rule.str;
    if (rule in simStats) {
        simStats[rule]++;
    } else {
        simStats[rule] = 1;
    }
    await writeFile('data/sim_stats.json', JSON.stringify(simStats, undefined, 4));
    let out: string | undefined = undefined;
    if (showTime) {
        let total = Math.round(performance.now() - startTime) / 1000;
        let parse = Math.round(parseTime) / 1000;
        out = `Took ${total} seconds (${parse} to parse)`;
        if (text) {
            out += '\n' + text;
        }
    } else if (text) {
        out = text;
    }
    return out;
}

addCommand(
    'sim', 'sim', [],
    'Simulate a pattern and output a GIF.',
    [
        patternArg('pattern'),
        optionalVariadicArg('parts', 'string', 'Specifies how to simulate (see https://discord.com/channels/357922255553953794/404518331605975040/1489678824932380774 for documentation).'),
        flagArg('time', [], 'Shows how much time it took.'),
    ],
    async args => {
        try {
            let argv = args.parts ?? [];
            if (argv[0] === 'rand') {
                throw new BotError(`Use !simrand, not !sim rand`);
            }
            let content = await runSimCommand(args.pattern.p, argv, args.time);
            let replyTo = args.pattern.msgInChannel;
            return {
                type: 'already-sent',
                value: await replyTo.reply({
                    content,
                    files: ['sim.gif'],
                    allowedMentions: {repliedUser: false},
                }),
                deleters: [replyTo.author.id],
            };
        } finally {
            try {
                await fs.rm('sim_base.gif');
            } catch {}
            try {
                await fs.rm('sim.gif');
            } catch {}
        }
    },
    {
        sendTyping: true,
    },
);


function parseRandFill(p: Pattern, fill: string): number[] {
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
        start = Math.max(start, 0);
        end = Math.min(end, p.rule.states);
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

addCommand(
    'simrandom', 'sim', ['simrand'],
    'Simulate a random pattern and output a GIF.',
    [
        requiredArg('rule', 'string', 'The rule to use.'),
        optionalArg('size', {name: 'wxh', value: /^\d+x\d+$/}, 'The size of the pattern, such as 20x20 or 8x32 (default 16x16).', '16x16'),
        optionalArg('fill', {name: 'percent', value: /%$/}, 'The percentage to fill the pattern (default 50%). Must start with a percent (such as 50%), can optionally be followed by  a comma then state weights, such as "50%,1-2=1,3=3" (sets states 1 and 2 to weight 1 but state 3 to weight 3). Ranges are inclusive, all states by default have weight 0.', '50%'),
        optionalVariadicArg('parts', 'string', 'Specifies how to simulate (see https://discord.com/channels/357922255553953794/404518331605975040/1489678824932380774 for documentation).'),
        flagArg('time', [], 'Shows how much time it took.'),
    ],
    async args => {
        try {
            let argv = args.parts ?? [];
            let [height, width] = args.size.split('x').map(Number);
            let p = createPattern(args.rule, aliases);
            let weights = parseRandFill(p, args.fill);
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
            let content = await runSimCommand(args.pattern.p, argv, args.time);
            return {
                type: 'message-spec',
                value: {content, files: ['sim.gif']},
            };
        } finally {
            try {
                await fs.rm('sim_base.gif');
            } catch {}
            try {
                await fs.rm('sim.gif');
            } catch {}
        }
    },
    {
        sendTyping: true,
    },
);


addCommand(
    'simstats', 'sim', [],
    'Get statistics on the most popular rules simulated.',
    [
        requiredArg('page', 'number', 'The page to get data for, defaults to 1.'),
    ],
    async args => {
        let page = args.page;
        let realPage = page - 1;
        let data = Object.entries(simStats).sort((x, y) => y[1] - x[1]);
        let maxPage = Math.floor(data.length / 10) + 1;
        if (realPage * 10 > data.length) {
            throw new BotError(`Page does not exist (highest page is ${maxPage})`);
        }
        let pageData = data.slice(realPage * 10, (realPage + 1) * 10);
        let title = `Most popular rules (page ${page} of ${maxPage})`;
        let out = pageData.map(x => x[0] + ': ' + x[1]).join('\n');
        return {
            type: 'message-spec',
            value: {embeds: [createEmbed(title, out)]},
        };
    },
);
