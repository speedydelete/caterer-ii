
import * as crypto from 'node:crypto';
import {Expression, PrivateName, SpreadElement, ArgumentPlaceholder} from '@babel/types';
import {parseExpression} from '@babel/parser';

import {BotError, Response, Message} from './util.js';


export class CalcError extends BotError {

    name: string = 'CalcError';
    [Symbol.toStringTag]: string = 'CalcError'; 

}


type Primitive = undefined | null | boolean | number | string | bigint | symbol;


const VARIABLES: {[key: string]: Primitive} = {

    'undefined': undefined,

    'pi': Math.PI,
    'e': Math.E,

};


const FUNCTIONS: {[key: string]: (...args: any[]) => any} = {

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

    d(amount: number): number {
        return crypto.randomInt(amount);
    },

    abs(value: any): any {
        return value < 0 ? -value : value;
    },

};


function runExpression(node: Expression | PrivateName | SpreadElement | ArgumentPlaceholder): Primitive {
    if (node.type === 'Identifier') {
        let value = node.name.toLowerCase();
        if (value.match(/^d([0-9.e]+|0x[0-9a-fA-F.]+|0b[01.e]+|0o[0-7.e]+|-?NaN|-?Infinity)$/)) {
            return crypto.randomInt(Number(value.slice(1)));
        } else if (value in VARIABLES) {
            return VARIABLES[value];
        } else {
            throw new CalcError(`ReferenceError: ${node.name} is not defined`);
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
        let func = node.callee.name.toLowerCase();
        if (!(func in FUNCTIONS)) {
            throw new CalcError(`ReferenceError: ${node.callee.name} is not defined`);
        }
        return FUNCTIONS[func](...args);
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
        return String(runExpression(parseExpression(argv.slice(1).join(' '))));
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
