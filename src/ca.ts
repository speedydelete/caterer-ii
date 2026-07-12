
import {EmbedBuilder} from 'discord.js';

import {RuleError, Pattern, unparseMAP, unparseMAPRuleFull, MAPPattern, MAPB0Pattern, getHashsoup, createPattern, toCatagolueRule, getBlackWhiteReversal, MAPGenPattern} from '../lifeweb/lib/index.js';
import {BotError, Message, Response, aliases, findRLE} from './util.js';


export async function cmdHashsoup(msg: Message, argv: string[]): Promise<Response> {
    let {height, width, data} = await getHashsoup(argv[2], argv[1]);
    return createPattern(argv[3] ?? 'B3/S23', aliases, height, width, data).toRLE();
}

export async function cmdApgencode(msg: Message, argv: string[]): Promise<Response> {
    let data = await findRLE(msg);
    if (!data) {
        throw new BotError('Cannot find RLE');
    }
    return data.p.toApgcode().replaceAll('_', '\\_');
}

export async function cmdCanonicalApgenode(msg: Message, argv: string[]): Promise<Response> {
    let data = await findRLE(msg);
    if (!data) {
        throw new BotError('Cannot find RLE');
    }
    if (argv[1].startsWith('c')) {
        let gens = 0;
        if (argv[2] !== undefined) {
            gens = Number(argv[2]);
            if (Number.isNaN(gens)) {
                throw new BotError('Invalid number');
            }
        }
    } else {
        return data.p.toApgcode();
    }
}

let lifePattern = createPattern('B3/S23');

export async function cmdApgdecode(msg: Message, argv: string[]): Promise<Response> {
    let code = argv[1];
    if (!code) {
        throw new BotError('Expected at least 1 argument');
    }
    let match = code.match(/x[spq]\d+_/);
    if (match) {
        code = code.slice(match[0].length);
    }
    if (!argv[2]) {
        return lifePattern.loadApgcode(code).toRLE();
    } else {
        return createPattern(argv.slice(2).join(' '), aliases).loadApgcode(code).toRLE();
    }
}

export async function cmdPopulation(msg: Message, argv: string[]): Promise<Response> {
    let data = await findRLE(msg);
    if (!data) {
        throw new BotError('Cannot find RLE!');
    }
    let p = data.p;
    msg = data.msg;
    if (p.rule.states === 2) {
        return String(p.population);
    } else {
        let counts = [];
        for (let i = 0; i < p.rule.states; i++) {
            counts.push(0);
        }
        let total = 0;
        for (let cell of p.getData()) {
            counts[cell]++;
            if (cell > 0) {
                total++;
            }
        }
        return `${total} total live cells\n${counts.map((x, i) => `${x} state ${i} cells`).join('\n')}`;
    }
}


export async function cmdToMAP(msg: Message, argv: string[]): Promise<Response> {
    let p = createPattern(argv[1], aliases);
    if (!(p instanceof MAPPattern || p instanceof MAPB0Pattern || p instanceof MAPGenPattern)) {
        throw new BotError('Rule must be in B/S notation!');
    }
    return unparseMAP(p instanceof MAPB0Pattern ? p.evenTrs.map(x => 1 - x) : p.trs, p.rule.states);
}


function getClass(p: Pattern): string {
    if ('p' in p && p.p instanceof Pattern) {
        return `${p.constructor.name}<${p.p.constructor.name}>`;
    } else if ('pattern' in p && p.pattern instanceof Pattern) {
        return `${p.constructor.name}<${p.pattern.constructor.name}>`;
    } else if ('patterns' in p && Array.isArray(p.patterns) && p.patterns.every(x => x instanceof Pattern)) {
        return `${p.constructor.name}<[${p.patterns.map(x => getClass(x)).join(', ')}]>`;
    } else {
        return p.constructor.name;
    }
}

export async function cmdRuleInfo(msg: Message, argv: string[]): Promise<Response> {
    let rule = argv.slice(1).join(' ');
    let p = createPattern(rule, aliases);
    let catagolue = toCatagolueRule(rule, aliases);
    let out = `**Class:** ${getClass(p)}\n**States:** ${p.rule.states}\n**Symmetry:** ${p.rule.symmetry}\n**Period:** ${p.rule.period}\n**Range:** ${p.rule.range}\n**Neighborhood:** ${p.rule.neighborhood.sort((a, b) => a[0] === b[0] ? (a[1] - b[1]) : a[0] - b[0]).map(x => `(${x[0]}, ${x[1]})`).join(', ')}\n`;
    try {
        out += `**Black/white reversal:** ${getBlackWhiteReversal(rule)}\n`;
    } catch (error) {
        if (!(error instanceof RuleError)) {
            throw error;
        }
    }
    out += `**Catagolue:** [${catagolue}](https://catagolue.hatsya.com/census/${catagolue})`;
    return {embeds: [(new EmbedBuilder()).setTitle(p.rule.str).setDescription(out)]};
}

export async function cmdNormalizeRule(msg: Message, argv: string[]): Promise<Response> {
    return createPattern(argv.slice(1).join(' '), aliases).rule.str;
}

export async function cmdBlackWhiteReverse(msg: Message, argv: string[]): Promise<Response> {
    return getBlackWhiteReversal(argv.slice(1).join(' '));
}

export async function cmdCheckerboardDual(msg: Message, argv: string[]): Promise<Response> {
    let p = createPattern(argv.slice(1).join(' '), aliases);
    if (!(p instanceof MAPPattern || p instanceof MAPB0Pattern)) {
        throw new BotError('Cannot take checkerboard dual of non-MAP rule!');
    }
    let trs = p instanceof MAPPattern ? p.trs : p.evenTrs.map(x => 1 - x);
    let even = new Uint8Array(512);
    let odd = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        even[i ^ 0b010101010] = trs[i];
        odd[i ^ 0b101010101] = trs[i] ^ 1;
    }
    return `Even: ${unparseMAPRuleFull(even, p.rule.states)}\nOdd: ${unparseMAPRuleFull(odd, p.rule.states)}`;
}
