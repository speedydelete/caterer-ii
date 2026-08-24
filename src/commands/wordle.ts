
import {readFile} from '../real_base.js';


interface GameInfo {
    chars: string;
    length: number;
    guesses: Set<string>;
    answers: Set<string>;
}

async function loadWordList(path: string): Promise<Set<string>> {
    let text = (await readFile(path)).toString();
    let out = new Set<string>();
    for (let word of text.split('\n')) {
        if (word.length > 0) {
            out.add(word);
        }
    }
    return out;
}

const DEFAULT: GameInfo = {
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    length: 5,
    guesses: await loadWordList('data/wordle_guesses.txt'),
    answers: await loadWordList('data/wordle_answers.txt'),
};


// slower:

// 5 fields, each field is 2 bits long
// 0 = gray, 1 = yellow, 2 = green

// function getPattern(info: GameInfo, guess: string, target: string): number {
//     let pattern = 0;
//     let counts = new Map<string, number>();
//     for (let i = 0; i < info.length; i++) {
//         if (guess[i] === target[i]) {
//             pattern += 2 * (1 << (i * 2));
//         } else {
//             counts.set(target[i], (counts.get(target[i]) ?? 0) + 1);
//         }
//     }
//     for (let i = 0; i < info.length; i++) {
//         if (guess[i] !== target[i]) {
//             let char = guess[i];
//             let value = counts.get(char) ?? 0;
//             if (value > 0) {
//                 pattern += 1 * (1 << (i * 2));
//                 counts.set(char, value - 1);
//             }
//         }
//     }
//     return pattern;
// }

// function updateKnown(info: GameInfo, guess: string, answer: string, data: Set<string>): Set<string> {
//     let out = new Set<string>();
//     let target = getPattern(info, guess, answer);
//     for (let word of data) {
//         if (target === getPattern(info, guess, word)) {
//             out.add(word);
//         }
//     }
//     return out;
// }


// faster:

function countChar(str: string, char: string): number {
    let out = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === char) {
            out++;
        }
    }
    return out;
}

function updateKnown(info: GameInfo, guess: string, answer: string, data: Set<string>): Set<string> {
    let greens: [number, string][] = [];
    let grays = new Set<string>();
    let possibleYellows: number[] = [];
    for (let i = 0; i < info.length; i++) {
        let char = guess[i];
        if (char === answer[i]) {
            greens.push([i, char]);
        } else if (answer.includes(char)) {
            possibleYellows.push(i);
        } else {
            grays.add(char);
        }
    }
    let yellows: [number, string][] = [];
    if (possibleYellows.length > 0) {
        let groups: {[key: string]: number[]} = {};
        for (let i of possibleYellows) {
            let char = guess[i];
            if (char in groups) {
                groups[char].push(i);
            } else {
                groups[char] = [i];
            }
        }
        for (let char in groups) {
            let positions = groups[char];
            if (positions.length === 1) {
                // one yellow, it can't be a green
                // or it would not have been added to possibleYellows
                yellows.push([positions[0], char]);
            } else {
                // multiple yellows of the same letter are rare
                // so this code shouldn't require the creation of
                // lists earlier in the code specifically for it
                let yellowCount = countChar(answer, char);
                for (let i = 0; i < info.length; i++) {
                    if (guess[i] === answer[i]) {
                        yellowCount--;
                    }
                }
                if (yellowCount > positions.length) {
                    yellowCount = positions.length;
                }
                for (let i = 0; i < yellowCount; i++) {
                    yellows.push([positions[i], char]);
                }
            }
        }
    }
    let out = new Set<string>();
    outer:
    for (let word of data) {
        for (let [pos, letter] of greens) {
            if (word[pos] !== letter) {
                continue outer;
            }
        }
        for (let letter of grays) {
            if (word.includes(letter)) {
                continue outer;
            }
        }
        for (let [pos, letter] of yellows) {
            if (word[pos] === letter) {
                continue outer;
            }
        }
        out.add(word);
    }
    return out;
}

// information theory based (not optimal!)
function scoreGuess(info: GameInfo, possible: Set<string>, guess: string): number {
    let out = 0;
    for (let answer of info.answers) {
        out += updateKnown(info, guess, answer, possible).size;
        // let target = getPattern(info, guess, answer);
        // for (let word of info.guesses) {
        //     if (target === getPattern(info, guess, word)) {
        //         out++;
        //     }
        // }
    }
    return out / info.answers.size;
}

function orderGuesses(info: GameInfo, possible: Set<string>): [string, number][] {
    let out: [string, number][] = [];
    for (let guess of info.guesses) {
        out.push([guess, scoreGuess(info, possible, guess)]);
    }
    return out.sort((x, y) => x[1] - y[1]);
}


// rank start words
let info = DEFAULT;
let out: [string, number][] = [];
console.log('Running');
let guesses = Array.from(info.guesses);
for (let i = 0; i < guesses.length; i++) {
    if (i % 10 === 0 && i > 0) {
        out = out.sort((x, y) => x[1] - y[1]);
        console.log(`Checked ${i} guesses: current: ${guesses[i]}, best: ${out[0][0]} (${out[0][1].toFixed(3)}), worst: ${out[out.length - 1][0]} (${out[out.length - 1][1].toFixed(3)})`);
    }
    let guess = guesses[i];
    out.push([guess, scoreGuess(info, DEFAULT.answers, guess)]);
}
console.log('Results:');
console.log(out.sort((x, y) => x[1] - y[1]).map(x => `${x[0]} (${x[1].toFixed(3)})`).join('\n'));
