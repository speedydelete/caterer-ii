
import {execSync} from 'node:child_process';
import {BotError, resolvePath, readFile, requiredVariadicArg, addCommand} from '../base.js';


const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

async function loadWordList(path: string): Promise<Set<string>> {
    let text = (await readFile(path)).toString();
    let out = new Set<string>();
    for (let word of text.split('\n')) {
        if (word.length > 0) {
            out.add(word);
        }
    }
    return new Set(Array.from(out).sort());
}

const GUESSES = await loadWordList('data/wordle/nyt_guesses.txt');
const SOLUTIONS = await loadWordList('data/wordle/nyt_guesses.txt');

const EMOJIS: {[key: string]: string} = {
    ':book:': '<:book:1541544540962295818>',
    ':best:': '<:best:1541544471345504326>',
    ':brilliant:': '<:brilliant:1541544576249110649>',
    ':great:': '<:great:1541543749379952690>',
    ':excellent:': '<:excellent:1541545113413492877>',
    ':good:': '<:good:1541545006823641192>',
    ':inaccuracy:': '<:inaccuracy:1541543842233327727>',
    ':mistake:': '<:mistake:1541544273999167488>',
    ':blunder:': '<:blunder:1541544504182571108>',
    ':winner:': '<:winner:1541545248935907418>',
    ':miss:': '<:miss:1542273676899262504>',
};


addCommand(
    'ratewordle', 'other', [],
    'Rates a game of Wordle like chess.com would.',
    [
        requiredVariadicArg('words', 'string', 'The words to submit, last one should be the answer (if you didn\'t get it, put it at the end anyway)'),
    ],
    async args => {
        let words = args.words.map(word => word.toLowerCase());
        for (let word of words) {
            if (!Array.from(word).every(letter => LETTERS.includes(letter))) {
                throw new BotError(`Invalid word (contains invalid characters): '${word}'`);
            }
            if (word.length !== 5) {
                throw new BotError(`Invalid word (must be 5 letters long): '${word}'`);
            }
            if (!GUESSES.has(word)) {
                throw new BotError(`Invalid word (does not exist): '${word}'`);
            }
        }
        let guesses: string[] = [];
        let solution: string;
        if (words.length > 7) {
            throw new BotError(`More than 7 words provided`);
        } else if (words.length === 7) {
            guesses = words.slice(0, 6);
            solution = words[6];
        } else {
            guesses = words;
            solution = words[words.length - 1];
        }
        if (!SOLUTIONS.has(solution)) {
            throw new BotError(`Invalid solution (not real): '${solution}'`);
        }
        let out = execSync(`${resolvePath('wordle')} ${resolvePath('data/wordle/nyt_guesses.txt')} ${resolvePath('data/wordle/nyt_solutions.txt')} ${resolvePath('data/wordle/nyt_first_guesses.txt')} ${solution} ${guesses.join(' ')}`).toString();
        for (let [before, after] of Object.entries(EMOJIS)) {
            out = out.replaceAll(before, after);
        }
        return {type: 'string', value: out};
    },
);
