
import {EmbedBuilder} from 'discord.js';

import {Pattern, Minmax, findMinmax, PatternType, identifyPeriodic, getApgcode, getDescription, ALTERNATE_SYMMETRIES, Identified, identify, toCatagolueRule} from '../../lifeweb/lib/index.js';

import {requiredArg, optionalArg, flagArg, addCommand, createEmbed, patternArg} from '../base.js';
import {deserialize, registerWorkerTask} from '../worker.js';
import {serialize, runWorkerTask} from '../worker_manager.js';
// import {names} from './names.js';


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
        out += `**Min:** ${type.minmax.min}\n`;
        out += `**Max:** ${type.minmax.max}\n`;
        out += `**Versatility:** 2^${type.minmax.versatility} rules\n`;
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
    // let name: string | undefined = undefined;
    // if (apgcode.startsWith('x') || apgcode.startsWith('y')) {
    //     name = names.get(apgcode);
    // } else {
    //     name = names.get(type.phases[0].toCanonicalApgcode(1, 'x'));
    // }
    // if (name !== undefined) {
    //     title = name + ' (' + title + ')';
    // }
    if (isOutput) {
        title = 'Output: ' + title;
    }
    let embeds = [createEmbed(title, out)];
    if ('output' in type && type.output) {
        for (let embed of embedIdentified(Object.assign(original.clearedCopy(), type.output.phases[0]), type.output, true)) {
            embeds.push(embed);
        }
    }
    return embeds;
}


declare module '../worker_manager.js' {
    export interface WorkerTaskTypes {
        identify: [{pattern: string, limit: number, checkLinear: boolean, acceptStabilized: boolean}, Identified];
        basicIdentify: [{pattern: string, limit: number, checkLinear: boolean, acceptStabilized: boolean}, PatternType];
        minmax: [{pattern: string, gens: number, ot?: boolean}, Minmax];
    }
}

registerWorkerTask('identify', data => identify(deserialize(data.pattern), data.limit, data.acceptStabilized, data.checkLinear));
registerWorkerTask('basicIdentify', data => identifyPeriodic(deserialize(data.pattern), data.limit, data.acceptStabilized, data.checkLinear));
registerWorkerTask('minmax', data => findMinmax(deserialize(data.pattern), data.gens, undefined, undefined, data.ot));

addCommand(
    'identify', 'identify', [],
    'Identify a pattern.',
    [
        patternArg('pattern'),
        optionalArg('limit', 'number', 'Number of generations to run the identifier for (default 4096).', 4096),
        flagArg('only-periodic', ['p'], 'Whether to only accept periodic patterns (and not linear growth)'),
        flagArg('only-real', ['r'], 'Whether to not accept patterns that stabilize into others'),
    ],
    async args => {
        let p = args.pattern.p;
        let out = await runWorkerTask('identify', {
            pattern: serialize(p),
            limit: args.limit,
            checkLinear: !args.onlyPeriodic,
            acceptStabilized: !args.onlyReal,
        });
        return {type: 'message-spec', value: {embeds: embedIdentified(p, out)}};
    },
    {
        sendTyping: true,
    },
);

addCommand(
    'basicidentify', 'identify', [],
    'Identify a pattern, but provide less information (can be faster).',
    [
        patternArg('pattern'),
        optionalArg('limit', 'number', 'Number of generations to run the identifier for (default 4096).', 4096),
        flagArg('only-periodic', ['p'], 'Whether to only accept periodic patterns (and not linear growth)'),
        flagArg('only-real', ['r'], 'Whether to not accept patterns that stabilize into others'),
    ],
    async args => {
        let p = args.pattern.p;
        let out = await runWorkerTask('basicIdentify', {
            pattern: serialize(p),
            limit: args.limit,
            checkLinear: !args.onlyPeriodic,
            acceptStabilized: !args.onlyReal,
        });
        return {type: 'message-spec', value: {embeds: embedIdentified(p, out)}};
    },
    {
        sendTyping: true,
    },
);

addCommand(
    'minmax', 'identify', [],
    'Find the minimum and maximum rule of a pattern.',
    [
        patternArg('pattern'),
        requiredArg('gens', 'number', 'Number of generations to run the pattern for.'),
    ],
    async args => {
        let out = await runWorkerTask('minmax', {
            pattern: serialize(args.pattern.p),
            gens: args.gens,
        });
        return {type: 'string', value: `Min: ${out.min}\nMax: ${out.max}\n2^${out.versatility} rules`};
    },
    {
        sendTyping: true,
    },
);
