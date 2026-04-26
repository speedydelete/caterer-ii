
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {parentPort} from 'node:worker_threads';
import {RuleError, Pattern, CoordPattern, MAPPattern, DataHistoryPattern, CoordHistoryPattern, DataSuperPattern, CoordSuperPattern, InvestigatorPattern, TreePattern, findMinmax, findType, getDescription, identify, createPattern, parse} from '../lifeweb/lib/index.js';
import {createPartial, checkConduit, catalystsAreFine} from '../lifeweb/lib/catask.js';
import {BotError, aliases} from './util.js';


const HISTORY_COLORS: [number, number, number][] = [
    [0, 255, 0],
    [0, 0, 128],
    [216, 255, 216],
    [255, 0, 0],
    [255, 255, 0],
    [96, 96, 96],
];

const SUPER_COLORS: [number, number, number][] = [
    [0, 255, 0],
    [0, 0, 160],
    [255, 216, 255],
    [255, 0, 0],
    [255, 255, 0],
    [96, 96, 96],
    [255, 105, 180],
    [128, 0, 128],
    [0, 191, 255],
    [0, 64, 128],
    [64, 224, 208],
    [0, 128, 64],
    [255, 255, 255],
    [255, 99, 71],
    [250, 128, 114],
    [219, 112, 147],
    [255, 165, 0],
    [245, 222, 179],
    [0, 255, 255],
    [192, 192, 192],
    [192, 255, 128],
    [255, 182, 193],
    [0, 255, 127],
    [0, 0, 0],
    [255, 0, 127],
];

const INVESTIGATOR_COLORS: [number, number, number][] = [
    [0, 236, 91],
    [0, 192, 255],
    [255, 0, 0],
    [255, 255, 255],
    [75, 75, 75],
    [233, 41, 255],
    [64, 0, 128],
    [255, 230, 0],
    [150, 128, 0],
    [130, 200, 0],
    [120, 40, 0],
    [255, 140, 0],
    [140, 70, 0],
    [0, 0, 255],
    [192, 192, 192],
    [128, 128, 128],
    [255, 112, 140],
    [249, 237, 249],
    [0, 152, 127],
    [0, 73, 59],
];


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
    if (!bb) {
        out = p.copy();
    } else if (p instanceof CoordPattern) {
        out = p.copyPart(bb[0], bb[1], bb[2], bb[3]);
    } else {
        let x = bb[0] - p.xOffset;
        let y = bb[1] - p.yOffset;
        out = p.copyPart(Math.max(x, 0), Math.max(y, 0), bb[3], bb[2]);
    }
    if (origin) {
        out.xOffset -= origin[0];
        out.yOffset -= origin[1];
    }
    return {p: out, time};
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
                    p.run(step);
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
        } else if (part[0] === 'wait') {
            if (typeof part[1] !== 'number') {
                throw new BotError(`Invalid part: Expected argument of type number for "wait", got type ${typeof part[1]}: ${part.join(' ')}`);
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
            p.run(part[1]);
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
                p.runGeneration();
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
            let type = findType(p, 120000, true);
            data.text = getDescription(type);
            for (let i = 0; i < type.stabilizedAt + type.period - (type.disp && type.disp[0] === 0 && type.disp[1] === 0 ? 1 : 0); i++) {
                p.runGeneration();
                frames.push(getFrame(p, data));
            }
            if (typeof part[0] === 'string' && part[0].match(/^x[0-9]+$/)) {
                let amount = Number(part[0].slice(1));
                if (type.period > 0) {
                    for (let i = 0; i < (amount - 1) * type.period; i++) {
                        p.runGeneration();
                        frames.push(getFrame(p, data));
                    }
                }
                part = part.slice(1);
            }
        } else if (part[0] === 'setrule') {
            if (typeof part[1] === 'number') {
                throw new BotError(`Invalid part: Expected argument of type string for "setrule", got type ${typeof part[1]}: ${part.join(' ')}`);
            }
            let q = createPattern(part[1], aliases, p.height, p.width, p.getData());
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
                value = value[1];
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

function parseSim(argv: string[], rle: string): SimData {
    let p = parse(rle, aliases).shrinkToFit();
    let parts: (string | number)[][] = [];
    let currentPart: (string | number)[] = [];
    for (let arg of argv.slice(1)) {
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
        if (p instanceof CoordPattern) {
            let data = p.getMinMaxCoords();
            if (data.minX < minX) {
                minX = data.minX;
            }
            if (data.maxX > maxX) {
                maxX = data.maxX;
            }
            if (data.minY < minY) {
                minY = data.minY;
            }
            if (data.maxY > maxY) {
                maxY = data.maxY;
            }
        } else {
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
    }
    minX--;
    maxX++;
    minY--;
    maxY++;
    let width = maxX - minX;
    let height = maxY - minY;
    if (p instanceof CoordPattern) {
        width++;
        height++;
    }
    let defaultTime = Math.ceil(Math.min(1, Math.max(1/50, 4 / frames.length)) * 100);
    return {frames: frames.map(({p, time}) => ({p, time: Math.max(time ?? defaultTime, 2)})), gifSize, minX, minY, width, height, useAdvancedColors: data.useAdvancedColors, customColors: data.customColors, text: data.text};
}

async function runSim(argv: string[], rle: string): Promise<[number, string | undefined]> {
    let startTime = performance.now();
    let {frames, gifSize, minX, minY, width, height, useAdvancedColors, customColors, text} = parseSim(argv, rle);
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
        if (clsP instanceof DataHistoryPattern || clsP instanceof CoordHistoryPattern || clsP instanceof DataSuperPattern || clsP instanceof CoordSuperPattern || clsP instanceof InvestigatorPattern) {
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
        if (customColors[value]) {
            let [r, g, b] = customColors[value];
            gct[i++] = r;
            gct[i++] = g;
            gct[i++] = b;
        } else if (value >= p.rule.states) {
            gct[i++] = gct[0];
            gct[i++] = gct[1];
            gct[i++] = gct[2];
        } else if (p.rule.states === 2) {
            gct[i++] = 0xff;
            gct[i++] = 0xff;
            gct[i++] = 0xff;
        } else if (clsP instanceof TreePattern && clsP.atRule.colors && clsP.atRule.colors[value]) {
            let [r, g, b] = clsP.atRule.colors[value];
            gct[i++] = r;
            gct[i++] = g;
            gct[i++] = b;
        } else if (clsP instanceof DataHistoryPattern || clsP instanceof CoordHistoryPattern) {
            let [r, g, b] = HISTORY_COLORS[value - 1];
            gct[i++] = r;
            gct[i++] = g;
            gct[i++] = b;
        } else if (clsP instanceof DataSuperPattern || clsP instanceof CoordSuperPattern) {
            let [r, g, b] = SUPER_COLORS[value - 1];
            gct[i++] = r;
            gct[i++] = g;
            gct[i++] = b;
        } else if (clsP instanceof InvestigatorPattern) {
            let [r, g, b] = INVESTIGATOR_COLORS[value - 1];
            gct[i++] = r;
            gct[i++] = g;
            gct[i++] = b;
        } else {
            gct[i++] = 0xff;
            gct[i++] = 0xff - Math.max(0, Math.ceil((value - 1) / (p.rule.states - 2) * 256) - 1);
            gct[i++] = 0;
        }
    }
    gifData.push(gct);
    gifData.push(new Uint8Array([0x21, 0xff, 0x0b, 0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00]));
    let history = new Uint8Array(width * height);
    for (let {p, time} of frames) {
        let startX: number;
        let startY: number;
        if (p instanceof CoordPattern) {
            let data = p.getMinMaxCoords();
            startX = data.minX - minX;
            startY = data.minY - minY;
        } else {
            startX = p.xOffset - minX;
            startY = p.yOffset - minY;
        }
        startX += xOffset;
        startY += yOffset;
        let pHeight = p.height;
        let pWidth = p.width;
        let endX = startX + pWidth;
        let endY = startY + pHeight;
        let pData = p.getData();
        let index = 0;
        gifData.push(new Uint8Array([0x21, 0xf9, 0x04, 0x00, time & 255, (time >> 8) & 255, 0xff, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, width & 255, (width >> 8) & 255, height & 255, (height >> 8) & 255, 0x00, bitWidth]));
        let datas: number[][] = [];
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
                if (data.length > (1 << 24)) {
                    datas.push(data);
                    data = [];
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
        datas.push(data);
        let outs: Uint8Array[] = [];
        let out: number[] = [];
        let accumulator = 0;
        let bitCount = 0;
        for (let data of datas) {
            for (let value of data) {
                accumulator |= value << bitCount;
                bitCount += codeSize;
                while (bitCount >= 8) {
                    out.push(accumulator & 0xff);
                    accumulator >>= 8;
                    bitCount -= 8;
                    if (out.length > (1 << 24)) {
                        outs.push(new Uint8Array(out));
                    }
                }
            }
        }
        if (bitCount > 0) {
            out.push(accumulator & 0xff);
        }
        outs.push(new Uint8Array(out));
        for (let out of outs) {
            let i = 0;
            while (i < out.length) {
                let length = Math.min(255, out.length - i);
                gifData.push(new Uint8Array([length, ...out.slice(i, i + length)]));
                i += length;
            }
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
    await fs.writeFile('sim_base.gif', out);
    let scale = Math.ceil(gifSize / Math.min(width, height));
    gifSize = Math.min(width, height) * scale;
    execSync(`gifsicle --resize-${width < height ? 'width' : 'height'} ${gifSize} -O3 sim_base.gif > sim.gif`);
    return [parseTime, text];
}


if (!parentPort) {
    throw new Error('No parent port');
}

type Job = 
        | {id: number, type: 'sim', argv: string[], rle: string}
        | {id: number, type: 'identify' | 'basic_identify', rle: string, limit: number}
        | {id: number, type: 'minmax', rle: string, gens: number}
        | {id: number, type: 'identify_conduit', rle: string, maxTime: number, sepGens: number};

parentPort.on('message', async (data: Job) => {
    if (!parentPort) {
        throw new Error('No parent port');
    }
    let id = data.id;
    try {
        if (data.type === 'sim') {
            parentPort.postMessage({id, ok: true, data: await runSim(data.argv, data.rle)});
        } else if (data.type === 'identify') {
            parentPort.postMessage({id, ok: true, data: identify(parse(data.rle, aliases), data.limit)});
        } else if (data.type === 'basic_identify') {
            parentPort.postMessage({id, ok: true, data: findType(parse(data.rle, aliases), data.limit)});
        } else if (data.type === 'minmax') {
            parentPort.postMessage({id, ok: true, data: findMinmax(parse(data.rle, aliases), data.gens)})
        } else if (data.type === 'identify_conduit') {
            try {
                let [partial, start] = createPartial(parse(data.rle, aliases) as MAPPattern);
                let p = partial.p;
                for (let i = 0; i < data.maxTime; i++) {
                    if (catalystsAreFine(p, partial.cats) === 'restored') {
                        let value = checkConduit(partial, data.sepGens, start);
                        if (value) {
                            parentPort.postMessage({id, ok: true, data: value});
                            return;
                        }
                    }
                    partial.prevPs.push(p.copy());
                    p.runGeneration();
                }
                parentPort.postMessage({id, ok: true, data: false});
            } catch (error) {
                if (error instanceof Error && (error.message === 'Oscillators are not supported' || error.message === 'Spaceships are not supported' || error.message === `More than 1 start object! (If there isn't, there is a bug, please tell speedydelete)` || error.message === 'No start object!')) {
                    throw new BotError(error.message);
                } else {
                    throw error;
                }
            }
        } else {
            throw new Error('Invalid type!');
        }
    } catch (error) {
        if (error instanceof BotError || error instanceof RuleError) {
            parentPort.postMessage({id, ok: false, error: error.message, intentional: true, type: error.constructor.name});
        } else {
            parentPort.postMessage({id, ok: false, error: (error instanceof Error && error.stack) ? error.stack : String(error), intentional: false});
        }
    }
});

process.setUncaughtExceptionCaptureCallback(async error => {
    await fs.appendFile('/home/opc/worker_logs.txt', error.stack + '\n\n');
    process.exit(1);
})
