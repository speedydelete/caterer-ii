
import {execSync} from 'node:child_process';
import {BotError, resolvePath, requiredVariadicArg, addCommand} from '../base.js';

addCommand(
    'ratewordle', 'other', [],
    'Rates a game of Wordle like chess.com would',
    [
        requiredVariadicArg('words', 'string', 'The words to submit, last one should be the answer (if you didn\'t get it, put it at the end anyway'),
    ],
    async args => {
        let words = args.words.map(word => word.toUpperCase());
        let guesses: string[] = [];
        let answer: string;
        if (words.length > 7) {
            throw new BotError(`More than 7 words provided`);
        } else if (words.length === 7) {
            guesses = words.slice(0, 6);
            answer = words[6];
        } else {
            guesses = words;
            answer = words[words.length - 1];
        }
        let out = await execSync(resolvePath('wordle'), resolvePath('data/wordle_'));
        return {type: 'string', value: rateGame(DEFAULT, guesses, answer)};
    },
);
