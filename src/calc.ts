
import * as crypto from 'node:crypto';
import {Expression, PrivateName, SpreadElement, ArgumentPlaceholder} from '@babel/types';
import {parseExpression} from '@babel/parser';

import {BotError, Response, Message} from './util.js';


export class CalcError extends BotError {

    name: string = 'CalcError';
    [Symbol.toStringTag]: string = 'CalcError'; 

}


type Primitive = undefined | null | boolean | number | string | bigint | symbol;


const VARIABLES = new Map<string, Primitive>(Object.entries({

    'nan': NaN,
    'infinity': Infinity,

    'pi': Math.PI,
    'e': Math.E,
    'tau': 2 * Math.PI,
    'phi': (1 + Math.sqrt(5))/2,
    'gamma': 0.57721566490153286,

}));


const FUNCTIONS = new Map<string, (...args: any[]) => any>(Object.entries({

    boolean(value: any): boolean {
        return Boolean(value);
    },

    string(value: any): string {
        return String(value);
    },

    number(value: any): number {
        return Number(value);
    },

    symbol(): symbol {
        return Symbol();
    },

    abs(value: any): number | bigint {
        if (typeof value === 'bigint') {
            return value < 0n ? -value : value;
        } else {
            value = Number(value);
            return value < 0 ? -value : value;
        }
    },

    sign(value: any): number | bigint {
        if (typeof value === 'bigint') {
            if (value > 0n) {
                return 1n;
            } else if (value === 0n) {
                return 0n;
            } else {
                return -1n;
            }
        } else {
            return Math.sign(Number(value));
        }
    },

    round(value: any): number | bigint {
        return typeof value === 'bigint' ? value : Math.round(Number(value));
    },

    trunc(value: any): number | bigint {
        return typeof value === 'bigint' ? value : Math.trunc(Number(value));
    },

    floor(value: any): number | bigint {
        return typeof value === 'bigint' ? value : Math.floor(Number(value));
    },

    ceil(value: any): number | bigint {
        return typeof value === 'bigint' ? value : Math.ceil(Number(value));
    },

    pow(x: any, y: any): any {
        return x**y;
    },

    sqrt(value: any): number {
        return Math.sqrt(Number(value));
    },

    cbrt(value: any): number {
        return Math.cbrt(Number(value));
    },

    exp(value: any): number {
        return Math.exp(Number(value));
    },

    log(value: any): number {
        return Math.log(Number(value));
    },

    ln(value: any): number {
        return Math.log(Number(value));
    },

    log10(value: any): number {
        return Math.log10(Number(value));
    },

    log2(value: any): number {
        return Math.log2(Number(value));
    },

    log1p(value: any): number {
        return Math.log2(Number(value));
    },

    expm1(value: any): number {
        return Math.expm1(Number(value));
    },

    hypot(...values: any[]): number {
        return Math.hypot(...values.map(Number));
    },

    sin(value: any): number {
        return Math.sin(Number(value));
    },

    cos(value: any): number {
        return Math.cos(Number(value));
    },

    tan(value: any): number {
        return Math.tan(Number(value));
    },

    cot(value: any): number {
        return 1/Math.tan(Number(value));
    },

    sec(value: any): number {
        return 1/Math.cos(Number(value));
    },

    csc(value: any): number {
        return 1/Math.sin(Number(value));
    },

    asin(value: any): number {
        return Math.asin(Number(value));
    },

    acos(value: any): number {
        return Math.acos(Number(value));
    },

    atan(value: any): number {
        return Math.atan(Number(value));
    },

    acot(value: any): number {
        return Math.atan(1/Number(value));
    },

    asec(value: any): number {
        return Math.acos(1/Number(value));
    },

    acsc(value: any): number {
        return Math.asin(1/Number(value));
    },

    sinh(value: any): number {
        return Math.sinh(Number(value));
    },

    cosh(value: any): number {
        return Math.cosh(Number(value));
    },

    tanh(value: any): number {
        return Math.tanh(Number(value));
    },

    coth(value: any): number {
        return 1/Math.tanh(Number(value));
    },

    sech(value: any): number {
        return 1/Math.cosh(Number(value));
    },

    csch(value: any): number {
        return 1/Math.sinh(Number(value));
    },

    asinh(value: any): number {
        return Math.asinh(Number(value));
    },

    acosh(value: any): number {
        return Math.acosh(Number(value));
    },

    atanh(value: any): number {
        return Math.atanh(Number(value));
    },

    acoth(value: any): number {
        return Math.atanh(1/Number(value));
    },

    asech(value: any): number {
        return Math.acosh(1/Number(value));
    },

    acsch(value: any): number {
        return Math.asinh(1/Number(value));
    },

    atan2(y: any, x: any): number {
        return Math.atan2(Number(y), Number(x));
    },

    clz32(value: any): number {
        return Math.clz32(Number(value));
    },

    fround(value: any): number {
        return Math.fround(Number(value));
    },

    f16round(value: any): number {
        return Math.f16round(Number(value));
    },

    imul(x: any, y: any): number {
        return Math.imul(Number(x), Number(y));
    },

    random(): number {
        return Math.random();
    },

    randint(min: any, max: any): any {
        return crypto.randomInt(Number(min), Number(max));
    },

    d(amount: any): number {
        return crypto.randomInt(Number(amount));
    },

    min(...values: any[]): any {
        let out: any = Infinity;
        for (let value of values) {
            if (value < out) {
                out = value;
            }
        }
        return out;
    },

    max(...values: any[]): any {
        let out: any = -Infinity;
        for (let value of values) {
            if (value > out) {
                out = value;
            }
        }
        return out;
    },

    mean(...values: any[]): any {
        if (values.every(x => typeof x === 'bigint')) {
            let out = 0n;
            for (let value of values) {
                out += value;
            }
            return out / BigInt(values.length);
        } else {
            let out = 0;
            for (let value of values) {
                out += value;
            }
            return out / values.length;
        }
    },

    median(...values: any[]): any {
        values = values.sort();
        let index = Math.floor(values.length / 2);
        if (values.length % 2 === 1) {
            return values[index];
        } else {
            return (FUNCTIONS.get('mean') as (...args: any[]) => any)(values[index - 1], values[index]);
        }
    },

    mode(...values: any[]): any {
        if (values.length === 0) {
            throw new Error('Mode of empty list does not exist');
        }
        let counts = new Map<any, number>();
        for (let value of values) {
            let count = counts.get(value);
            if (count !== undefined) {
                counts.set(value, count + 1);
            } else {
                counts.set(value, 1);
            }
        }
        let out = undefined;
        let outCount = -Infinity;
        for (let [value, count] of counts) {
            if (count > outCount) {
                out = value;
                outCount = count;
            }
        }
        return out;
    },

}));


function runExpression(node: Expression | PrivateName | SpreadElement | ArgumentPlaceholder): Primitive {
    if (node.type === 'Identifier') {
        let value = node.name.toLowerCase();
        if (value.match(/^d([0-9.e]+|0x[0-9a-fA-F.]+|0b[01.e]+|0o[0-7.e]+|-?NaN|-?Infinity)$/)) {
            return crypto.randomInt(Number(value.slice(1)));
        } else if (value === 'undefined') {
            return undefined;
        } else {
            let out = VARIABLES.get(value);
            if (out === undefined) {
                throw new CalcError(`ReferenceError: ${node.name} is not defined`);
            } else {
                return out;
            }
        }
    } else if (node.type === 'NullLiteral') {
        return null;
    } else if (node.type === 'BooleanLiteral') {
        return node.value;
    } else if (node.type === 'StringLiteral') {
        return node.value;
    } else if (node.type === 'NumericLiteral') {
        return node.value;
    } else if (node.type === 'BigIntLiteral') {
        return node.value;
    } else if (node.type === 'UnaryExpression') {
        let op = node.operator;
        let arg = runExpression(node.argument) as any;
        if (op === '-') {
            return -arg;
        } else if (op === '+') {
            return +arg;
        } else if (op === '!') {
            return !arg;
        } else if (op === '~') {
            return ~arg;
        } else if (op === 'typeof') {
            return typeof arg;
        } else if (op === 'void') {
            return undefined;
        } else {
            throw new CalcError(`SyntaxError: Invalid unary operator: '${op}'`);
        }
    } else if (node.type === 'UpdateExpression') {
        let op = node.operator;
        let arg = runExpression(node.argument) as any;
        if (op === '++') {
            return arg++;
        } else if (op === '--') {
            return arg--;
        } else {
            throw new CalcError(`SyntaxError: Invalid update operator: '${op}'`);
        }
    } else if (node.type === 'BinaryExpression') {
        let op = node.operator;
        let left = runExpression(node.left) as any;
        let right = runExpression(node.right) as any;
        if (op === '==') {
            return left == right;
        } else if (op === '!=') {
            return left != right;
        } else if (op === '===') {
            return left === right;
        } else if (op === '!==') {
            return left !== right;
        } else if (op === '<') {
            return left < right;
        } else if (op === '<=') {
            return left <= right;
        } else if (op === '>') {
            return left > right;
        } else if (op === '>=') {
            return left >= right;
        } else if (op === '<<') {
            return left << right;
        } else if (op === '>>') {
            return left >> right;
        } else if (op === '>>>') {
            return left >>> right;
        } else if (op === '+') {
            return left + right;
        } else if (op === '-') {
            return left - right;
        } else if (op === '*') {
            return left * right;
        } else if (op === '/') {
            return left / right;
        } else if (op === '%') {
            return left % right;
        } else if (op === '**') {
            return left ** right;
        } else {
            throw new CalcError(`SyntaxError: Invalid binary operator: '${op}'`);
        }
    } else if (node.type === 'LogicalExpression') {
        let op = node.operator;
        let left = runExpression(node.left);
        if (op === '&&') {
            if (Boolean(left) === false) {
                return left;
            } else {
                return runExpression(node.right);
            }
        } else if (op === '||') {
            if (Boolean(left) === true) {
                return left;
            } else {
                return runExpression(node.right);
            }
        } else if (op === '??') {
            if (left !== undefined && left !== null) {
                return left;
            } else {
                return runExpression(node.right);
            }
        } else {
            throw new CalcError(`SyntaxError: Invalid logical operator: '${op}'`);
        }
    } else if (node.type === 'ConditionalExpression') {
        return runExpression(node.test) ? runExpression(node.consequent) : runExpression(node.alternate);
    } else if (node.type === 'CallExpression') {
        let args = node.arguments.map(runExpression);
        if (node.callee.type !== 'Identifier') {
            throw new CalcError(`SyntaxError: Invalid node type for function (expected 'Identifier'): '${node.callee.type}`);
        }
        let func = FUNCTIONS.get(node.callee.name.toLowerCase());
        if (func === undefined) {
            throw new CalcError(`ReferenceError: ${node.callee.name} is not defined`);
        }
        return func(...args);
    } else {
        throw new CalcError(`SyntaxError: Invalid node type: '${node.type}'`);
    }
}

export async function cmdCalc(msg: Message, argv: string[]): Promise<Response> {
    let str = msg.content;
    let index = str.indexOf(' ');
    if (index === -1) {
        throw new BotError(`Expected at least 1 argument`);
    }
    str = str.slice(index + 1);
    try {
        let out = runExpression(parseExpression(str));
        if (typeof out === 'string') {
            return `'${out.replaceAll(`'`, `\\'`)}'`;
        } else {
            return String(out);
        }
    } catch (error) {
        if (error instanceof Error) {
            if (error instanceof CalcError) {
                throw error;
            } else {
                throw new CalcError(`${error.name}: ${error.message}`);
            }
        } else {
            throw new CalcError(String(error));
        }
    }
}
