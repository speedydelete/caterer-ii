
import {BotError, readFile, writeFile} from '../base.js';


interface GameInfo {
    chars: string;
    length: number;
    guesses: Set<string>;
    answers: Set<string>;
    startRatings: [string, number][];
    bookStarts: Set<string>;
    rareLetters: Set<string>;
}

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

const DEFAULT: GameInfo = {
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    length: 5,
    guesses: await loadWordList('data/wordle_guesses.txt'),
    answers: await loadWordList('data/wordle_answers.txt'),
    startRatings: [],
    bookStarts: new Set(['SALET', 'QAJAQ', 'CRANE', atob('UEVOSVM='), 'SLATE', 'ADIEU', 'AUDIO', 'OUIJA', 'STARE', 'RAISE', 'ARISE']),
    rareLetters: new Set('KWVZXQJ'),
};


// algorithm 1:

// 5 fields, each field is 2 bits long
const GRAY = 0;
const YELLOW = 1;
const GREEN = 2;

// function formatPattern(info: GameInfo, pattern: number): string {
//     return Array.from(pattern.toString(4).padStart(5, '0')).reverse().join('');
// }

let getPatternCounts = new Uint8Array(256);
function getPattern(info: GameInfo, guess: string, target: string): number {
    let counts = getPatternCounts;
    counts.fill(0);
    // for (let char of info.chars) {
    //     counts[char.charCodeAt(0)] = 0;
    // }
    for (let i = 0; i < info.length; i++) {
        counts[i] = 0;
    }
    let pattern = 0;
    for (let i = 0; i < info.length; i++) {
        if (guess[i] === target[i]) {
            pattern |= GREEN * (1 << (i * 2));
            // console.log('green', i, formatPattern(info, pattern));
        } else {
            counts[target[i].charCodeAt(0)]++;
        }
    }
    for (let i = 0; i < info.length; i++) {
        let char = guess[i];
        if (char !== target[i]) {
            let value = counts[char.charCodeAt(0)];
            if (value > 0) {
                pattern |= YELLOW * (1 << (i * 2));
                counts[char.charCodeAt(0)] = value - 1;
                // console.log('yellow', i, formatPattern(info, pattern));
            }
        }
    }
    return pattern;
}

function updateKnown(info: GameInfo, guess: string, answer: string, data: Set<string>): Set<string> {
    let out = new Set<string>();
    let target = getPattern(info, guess, answer);
    for (let word of data) {
        if (target === getPattern(info, guess, word)) {
            out.add(word);
        }
    }
    return out;
}

// information theory based (not optimal!)

function scoreGuess(info: GameInfo, possible: Set<string>, guess: string): number {
    let out = 0;
    for (let answer of possible) {
        let target = getPattern(info, guess, answer);
        for (let word of possible) {
            if (target === getPattern(info, guess, word)) {
                out++;
            }
        }
    }
    return out / possible.size;
}

function getAllGuesses(info: GameInfo, possible: Set<string>): [string, number][] {
    let out: [string, number][] = [];
    for (let guess of info.guesses) {
        out.push([guess, scoreGuess(info, possible, guess)]);
    }
    return out.sort((x, y) => x[1] - y[1]);
}


// rank start words

// let info = DEFAULT;
// let out: [string, number][] = [];
// console.log('Running');
// let guesses = Array.from(info.guesses);
// let start = performance.now();
// for (let i = 0; i < guesses.length; i++) {
//     if (i % 10 === 0 && i > 0) {
//         out = out.sort((x, y) => x[1] - y[1]);
//         await writeFile('starts.json', JSON.stringify(out));
//         console.log(`Checked ${i} guesses: next: ${guesses[i]}, best: ${out[0][0]} (${out[0][1].toFixed(3)}), worst: ${out[out.length - 1][0]} (${out[out.length - 1][1].toFixed(3)}), ${((i / ((performance.now() - start) / 1000))).toFixed(3)} checks/second`);
//     }
//     let guess = guesses[i];
//     out.push([guess, scoreGuess(info, DEFAULT.answers, guess)]);
// }
// out = out.sort((x, y) => x[1] - y[1]);
// await writeFile('starts.json', JSON.stringify(out));
// console.log('Results:');
// console.log(out.map(x => `${x[0]} (${x[1].toFixed(3)})`).join('\n'));


function rateGame(info: GameInfo, guesses: string[], answer: string): string {
    let totalSkill = 0;
    let totalLuck = 0;
    let totalCountingGuesses = 0;
    let perWord: string[] = [];
    let possible = info.answers;
    for (let i = 0; i < guesses.length; i++) {
        let guess = guesses[i];
        let nextPossible = updateKnown(info, guess, answer, possible);
        let data = i === 0 ? info.startRatings.slice() : getAllGuesses(info, possible);
        data = data.sort((x, y) => y[1] - x[1]);
        let bestScore = data[data.length - 1][1];
        let skill = data.findIndex(x => guess === x[0]);
        if (skill === -1) {
            throw new BotError(`Failed to calculate skill for guess ${i}`);
        }
        let guessScore = data[skill][1];
        if (bestScore === guessScore) {
            skill = 100;
        } else {
            skill = skill * 100 / data.length;
        }
        // calculate luck: find the distribution of next guesses
        // and rank it by its position in there
        let distr: number[] = [];
        for (let answer of possible) {
            let target = getPattern(info, guess, answer);
            let value = 0;
            for (let word of possible) {
                if (target === getPattern(info, guess, word)) {
                    value++;
                }
            }
            distr.push(value);
        }
        distr = distr.sort((x, y) => y - x);
        let luck = distr.findIndex(x => x === nextPossible.size);
        if (luck === -1) {
            throw new BotError(`Failed to calculate luck for guess ${i}`);
        }
        if (distr[distr.length - 1] === distr[luck]) {
            luck = 100;
        } else {
            luck = luck * 100 / data.length;
        }
        if (i > 0) {
            totalSkill += skill;
            totalLuck += luck;
            totalCountingGuesses++;
        }
        let emoji: string;
        if (guess === answer) {
            emoji = '<:winner:1541545248935907418>';
        }
        if (i === 0 && info.bookStarts.has(guess)) {
            emoji = '<:book:1541544540962295818>';
        } else if (skill === 100) {
            emoji = '<:best:1541544471345504326>';
            for (let letter of info.rareLetters) {
                if (!answer.includes(letter) && guess.includes(letter)) {
                    emoji = '<:brilliant:1541544576249110649>';
                    break;
                }
            }
        } else if (skill > 90) {
            emoji = '<:excellent:1541545113413492877>';
            for (let letter of info.rareLetters) {
                if (!answer.includes(letter) && guess.includes(letter)) {
                    emoji = '<:great:1541543749379952690>';
                    break;
                }
            }
        } else if (skill > 70) {
            emoji = '<:good:1541545006823641192>';
        } else if (skill > 50) {
            emoji = '<:inaccuracy:1541543842233327727>'
        } else if (skill > 30) {
            emoji = '<:mistake:1541544273999167488>';
        } else {
            emoji = '<:blunder:1541544504182571108>';
        }
        perWord.push(`${emoji} \`${guess}\` - ${skill} skill, ${luck} luck, score: ${guessScore}, best score: ${bestScore}, ranking: ${data.slice(3).join('/')}/.../${data[data.length - 1]}`);
    }
    return `Overall: ${Math.round(totalSkill / totalCountingGuesses)} skill, ${Math.round(totalLuck / totalCountingGuesses)}\n${perWord.join('\n')} luck`;
}
