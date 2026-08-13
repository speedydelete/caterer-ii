
import {AttachmentBuilder} from 'discord.js';
import {LifewebError, Pattern, unparseMAP, unparseMAPRuleFull, MAPPattern, MAPB0Pattern, MAPGenPattern, createPattern, toCatagolueRule, getBlackWhiteReversal} from '../../lifeweb/lib/index.js';
import {basisToString, findBasis, parseSymmetry} from '../../lifeweb/lib/rule_symmetries/index.js';

import {BotError, requiredRestArg, addCommand, createEmbed} from '../base.js';
import {aliases} from './aliases.js';


addCommand(
    'tomap', 'rules', [],
    'Converts a rule to MAP notation if possible.',
    [
        requiredRestArg('rule', 'string', 'The rule to convert.'),
    ],
    async args => {
        let p = createPattern(args.rule, aliases);
        if (!(p instanceof MAPPattern || p instanceof MAPB0Pattern || p instanceof MAPGenPattern)) {
            throw new BotError(`Cannot convert rule to MAP`);
        }
        return {type: 'string', value: unparseMAP(p instanceof MAPB0Pattern ? p.evenTrs.map(x => 1 - x) : p.trs, p.rule.states)};
    },
    {
        noArgvParse: true,
    },
);


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

addCommand(
    'ruleinfo', 'rules', [],
    `Gets information about a rule.`,
    [
        requiredRestArg('rule', 'string', 'The rule to use.'),
    ],
    async args => {
        let rule = args.rule;
        let p = createPattern(rule, aliases);
        let catagolue = toCatagolueRule(rule, aliases);
        let out = `**Class:** ${getClass(p)}\n**States:** ${p.rule.states}\n**Symmetry:** ${p.rule.symmetry}\n**Period:** ${p.rule.period}\n**Range:** ${p.rule.range}\n**Neighborhood:** ${p.rule.neighborhood.sort((a, b) => a[0] === b[0] ? (a[1] - b[1]) : a[0] - b[0]).map(x => `(${x[0]}, ${x[1]})`).join(', ')}\n`;
        try {
            out += `**Black/white reversal:** ${getBlackWhiteReversal(rule)}\n`;
        } catch (error) {
            if (!(error instanceof LifewebError && error.message.toLowerCase().includes('black/white reversal'))) {
                throw error;
            }
        }
        out += `**Catagolue:** [${catagolue}](https://catagolue.hatsya.com/census/${catagolue})`;
        return {type: 'message-spec', value: {embeds: [createEmbed(p.rule.str, out)]}};
    },
    {
        noArgvParse: true,
    },
);


addCommand(
    'normalizerule', 'rules', [],
    `Normalizes a rule.`,
    [
        requiredRestArg('rule', 'string', 'The rule to use.'),
    ],
    async args => {
        return {type: 'string', value: createPattern(args.rule, aliases).rule.str};
    },
    {
        noArgvParse: true,
    },
);

addCommand(
    'blackwhitereverse', 'rules', ['bwreverse', 'blackwhitereversal', 'bwreversal'],
    `Normalizes a rule.`,
    [
        requiredRestArg('rule', 'string', 'The rule to use.'),
    ],
    async args => {
        return {type: 'string', value: getBlackWhiteReversal(args.rule)};
    },
    {
        noArgvParse: true,
    },
);

addCommand(
    'checkerboarddual', 'rules', ['cbdual'],
    `Normalizes a rule.`,
    [
        requiredRestArg('rule', 'string', 'The rule to use.'),
    ],
    async args => {
        let p = createPattern(args.rule, aliases);
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
        return {type: 'string', value: `Even: ${unparseMAPRuleFull(even, p.rule.states)}\nOdd: ${unparseMAPRuleFull(odd, p.rule.states)}`};
    },
    {
        noArgvParse: true,
    },
);


addCommand(
    'basis', 'rules', [],
    `Finds the basis of a rule symmetry.`,
    [
        requiredRestArg('symmetry', 'string', 'The symmetry to use.'),
    ],
    async args => {
        let basis = findBasis(parseSymmetry(args.symmetry));
        let out: string;
        if (typeof basis === 'string') {
            out = basis[0].toUpperCase() + basis.slice(1);
        } else {
            out = basisToString(basis);
        }
        if (out.length < 2000) {
            return {type: 'string', value: out};
        } else {
            return {type: 'message-spec', value: {files: [new AttachmentBuilder(Buffer.from(out, 'utf-8'), {name: 'basis.txt'})]}};
        }
    },
    {
        sendTyping: true,
        noArgvParse: true,
    },
);
