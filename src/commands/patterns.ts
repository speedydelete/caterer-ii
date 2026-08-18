
import {getHashsoup, createPattern} from '../../lifeweb/lib/index.js';

import {aliases, requiredArg, optionalArg, optionalRestArg, patternArg, optionArg, addCommand} from '../base.js';


addCommand(
    'population', 'patterns', ['pop'],
    'Get the population of a pattern (for multistate rules, returns a more detailed list)',
    [
        patternArg('pattern'),
    ],
    async args => {
        let p = args.pattern.p;
        if (p.rule.states < 3) {
            return {type: 'number', value: p.population};
        }
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
        return {type: 'string', value: `${total} total live cells\n${counts.map((x, i) => `${x} state ${i} cells`).join('\n')}`};
    },
)


addCommand(
    'apgencode', 'patterns', [],
    'Get an unprefixed apgcode for any pattern. For prefixed apgcodes, use `!identify`.',
    [
        patternArg('pattern'),
        optionArg('canonical', ['c'], optionalArg('gens', 'number', 'The number of generations to run it for (default 0).', 0), 'Whether to canonicalize it.'),
    ],
    async args => {
        let p = args.pattern.p.shrinkToFit();
        let out: string;
        if (args.canonical) {
            out = p.toCanonicalApgcode(args.canonical);
        } else {
            out = p.toApgcode();
        }
        out = out.replaceAll('_', '\\_');
        return {type: 'string', value: out};
    },
);

const APGCODE_PATTERN_TYPES: {[key: string]: string} = {
    's': 'still life',
    'p': 'oscillator',
    'q': 'spaceship',
    'g': 'gun',
};

// null prototype because it is checked for using the in operator
const APGCODE_POWER_MEANINGS: {[key: string]: string} = Object.assign(Object.create(null), {
    'PATHOLOGICAL': 'less than 0.15',
    'zz_REPLICATOR': 'less than 0.65',
    'zz_LINEAR': 'less than 1.1',
    'zz_EXPLOSIVE': 'less than 1.9',
    'zz_QUADRATIC': 'greater than or equal to 1.9',
});

const APGCODE_NON_OBJECT_MEANINGS: {[key: string]: string} = {
    'methuselah': 'Methuselah that stabilizes in $$$ generations',
    'messless': 'Diehard that stabilizes in $$$ generations',
    'megasized': 'Pattern with a final population of $$$',
};

addCommand(
    'apgdecode', 'patterns', [],
    'Decode a (possibly unprefixed) apgcode, returning a meaning and/or RLE.',
    [
        requiredArg('apgcode', 'string', 'The apgcode to decode.'),
        optionalRestArg('rule', 'string', 'The rule to decode it in (default B3/S23)', 'B3/S23'),
    ],
    async args => {
        let code = args.apgcode;
        let text: string | undefined;
        let isPattern: boolean;
        let match: RegExpMatchArray | null;
        if (match = code.match(/^x([spqg])(\d+)_/)) {
            text = `Period-${match[2]} ${APGCODE_PATTERN_TYPES[match[1]]}`;
            isPattern = true;
            code = code.slice(match[0].length);
        } else if (match = code.match(/^yl(\d+)_(\d+)_(\d+)_([0-9a-f]+)$/)) {
            text = `Linear growth\nPeriod of the population sequence: ${match[1]}\nSubperiod of the population sequence (often the period of the debris): ${match[2]}\nPopulation of the debris: ${match[3]}\n[MD5](<https://en.wikipedia.org/wiki/MD5>) hash of some complicated stuff, see [the code](<https://gitlab.com/apgoucher/apgmera/-/blob/master/includes/detection.h>) for more detailS: ${match[4]}`;
            isPattern = false;
        } else if (match = code.match(/^ov_[spq](\d+)$/)) {
            text = `Oversized period-${match[2]} ${APGCODE_PATTERN_TYPES[match[1]]}`;
            isPattern = false;
        } else if (code in APGCODE_POWER_MEANINGS) {
            text = `Apparently aperiodic object where, if you take the power law regression (f(x) = a*x^p), the power is ${APGCODE_POWER_MEANINGS[code]}`;
            isPattern = false;
        } else if (match = code.match(/^(methuselah|messless|megasized)_(\d+)([hk])$/)) {
            let start = Number(match[2]);
            let end: number;
            if (match[3] === 'h') {
                start *= 100;
                end = start + 99;
            } else {
                start *= 1000;
                end = start + 999;
            }
            let rangeStr = `${start}-${end} (inclusive)`;
            text = APGCODE_NON_OBJECT_MEANINGS[match[1]].replace('$$$', rangeStr);
            isPattern = false;
        } else {
            text = undefined;
            isPattern = true;
        }
        if (isPattern) {
            let p = createPattern(args.rule, aliases).loadApgcode(code).shrinkToFit();
            if (text === undefined) {
                return {type: 'pattern', value: p};
            } else {
                return {type: 'string', value: `${text}\n\n${p.toRLE()}`};
            }
        } else if (text !== undefined) {
            return {type: 'string', value: text};
        } else {
            throw new Error(`This error should not occur (text is undefined and isPattern is false)`);
        }
    },
);

addCommand(
    'justapgdecode', 'patterns', [],
    'Decode an unprefixed apgcode.',
    [
        requiredArg('apgcode', 'string', 'The apgcode to decode.'),
        optionalRestArg('rule', 'string', 'The rule to decode it in (default B3/S23)', 'B3/S23'),
    ],
    async args => {
        return {type: 'pattern', value: createPattern(args.rule).loadApgcode(args.apgcode).shrinkToFit()};
    },
);


addCommand(
    'hashsoup', 'patterns', [],
    'Get a Catagolue hashsoup.',
    [
        requiredArg('symmetry', 'string', 'The symmetry to use.'),
        requiredArg('seed', 'string', 'The seed to use (like k_something).'),
        optionalArg('rule', 'string', 'The rule to use (default B3/S23).', 'B3/S23'),
    ],
    async args => {
        let {height, width, data} = await getHashsoup(args.seed, args.symmetry);
        let out = createPattern(args.rule, aliases, height, width, data);
        return {type: 'pattern', value: out};
    }
);
