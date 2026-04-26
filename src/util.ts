
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {DiscordAPIError, Message as _Message, OmitPartialGroupDMChannel} from 'discord.js';
import {Pattern, parse} from '../lifeweb/lib/index.js';
import {parseRPF, RPFPattern} from '../lifeweb/lib/rpf.js';


export class BotError extends Error {}


export type Message = OmitPartialGroupDMChannel<_Message>;

export type Response = undefined | void | Parameters<Message['reply']>[0] | Message | [Parameters<Message['reply']>[0] | Message, string[]];

export interface Config {
    token: string;
    admins: string[];
    accepterers: string[];
    wrapperToken: string;
    sssssChannel: string;
    starboardChannel: string;
    starThreshold: number;
    initTime: number;
}


let basePath = join(import.meta.dirname, '..');

export async function readFile(path: string): Promise<string> {
    return (await fs.readFile(join(basePath, path))).toString();
}

export async function writeFile(path: string, data: Parameters<typeof fs.writeFile>[1]): Promise<void> {
    await fs.writeFile(join(basePath, path), data);
}


export let config: Config = JSON.parse(await readFile('config.json'));
export let aliases = JSON.parse(await readFile('data/aliases.json')) as {[key: string]: string};
export let noReplyPings = JSON.parse(await readFile('data/no_reply_pings.json')) as string[];
export let names = new Map((await readFile('data/names.txt')).split('\n').map(x => x.split(' ')).map(x => [x[0], x.slice(1).join(' ')]));
export let simStats = JSON.parse(await readFile('data/sim_stats.json')) as {[key: string]: number};


export function sentByAdmin(msg: Message): boolean {
    return config.admins.includes(msg.author.id);
}

export function sentByAccepterer(msg: Message): boolean {
    if (sentByAdmin(msg)) {
        return true;
    }
    if (msg.member && msg.member.roles.cache.find(role => config.accepterers.includes(role.id))) {
        return true;
    }
    return false;
}


export const RLE_HEADER = /\s*x\s*=\s*\d+\s*,?\s*y\s*=\s*\d+/;

export function findRLEFromText(data: string): Pattern | undefined {
    let match = RLE_HEADER.exec(data);
    if (!match) {
        let index = data.indexOf('```rpf\n');
        if (index === -1) {
            return;
        }
        data = data.slice(index + '```rpf\n'.length);
        index = data.indexOf('```');
        if (index === -1) {
            return;
        }
        data = data.slice(0, index);
        // @ts-ignore
        return new RPFPattern(parseRPF(data, '/'));
    }
    data = data.slice(match.index);
    let index = data.indexOf('!');
    if (index === -1) {
        return;
    }
    return parse(data.slice(0, index + 1), aliases);
}

export async function findRLEFromMessage(msg: Message): Promise<{msg: Message, p: Pattern} | undefined> {
    let out = findRLEFromText(msg.content);
    if (out) {
        return {msg, p: out};
    }
    if (msg.reference && msg.reference.type === 1) {
        let msg2 = await msg.fetchReference();
        let out = findRLEFromText(msg2.content);
        if (out) {
            return {msg, p: out};
        }
    }
    if (!msg.author.bot && msg.attachments.size > 0) {
        for (let [name, attachment] of msg.attachments) {
            if (name.endsWith('.rle') || name.endsWith('.txt')) {
                let data = await (await fetch(attachment.url)).text();
                let out = findRLEFromText(data);
                if (out) {
                    return {msg, p: out};
                }
            } else if (name.endsWith('.rpf')) {
                let data = await (await fetch(attachment.url)).text();
                let rpf = parseRPF(data, '/');
                // @ts-ignore
                return {msg, p: new RPFPattern(rpf)};
            }
        }
    }
}

export async function findRLE(msg: Message): Promise<{msg: Message, p: Pattern} | undefined> {
    let out: {msg: Message, p: Pattern} | undefined;
    if (msg.reference) {
        let reply: Message | undefined = undefined;
        try {
            reply = await msg.fetchReference();
        } catch (error) {
            if (!(error instanceof DiscordAPIError && error.message.includes('Could not resolve channel'))) {
                throw error;
            }
        }
        if (reply) {
            out = await findRLEFromMessage(reply);
            if (out) {
                return out;
            }
        }
    }
    let msgs = await msg.channel.messages.fetch({limit: 50});
    for (let msg of msgs) {
        if (out = await findRLEFromMessage(msg[1] as Message)) {
            return out;
        }
    }
}
