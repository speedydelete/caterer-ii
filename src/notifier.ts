
import {TextChannel} from 'discord.js';
import {parseSpeed} from '../lifeweb/lib/index.js';
import {Type, TYPE_NAMES, shipIsOptimal} from '../sssss/lib/index.js';


const LIMIT = 1997;

function splitMessages(...data: (string | string[])[]): string[] {
    let out: string[] = [];
    let current = '';
    for (let value of data) {
        let prev = current;
        if (typeof value === 'string') {
            current += value;
            if (current.length > LIMIT) {
                out.push(prev);
                current = value;
            }
        } else {
            for (let i = 0; i < value.length; i++) {
                let prev = current;
                let part = value[i];
                if (i !== value.length - 1) {
                    part += ', ';
                }
                current += part;
                if (current.length > LIMIT) {
                    out.push(prev);
                    current = part;
                }
            }
        }
    }
    if (current.length > 0) {
        out.push(current);
    }
    return out;
}

function formatNewShips(category: 'speed' | 'period', type: Type, data: [string, number][]): string[] {
    let out: string[] = [];
    for (let [speed, cells] of data) {
        let {dx, dy, period} = parseSpeed(speed);
        if (shipIsOptimal(type, {pop: cells, dx, dy, period, rle: '', rule: ''})) {
            out.push(`**${speed} (${cells} cell${cells === 1 ? '' : 's'})**`);
        } else {
            out.push(`${speed} (${cells} cell${cells === 1 ? '' : 's'})`);
        }
    }
    return splitMessages(`${data.length === 1 ? 'New' : data.length + ' new'} ${category}${data.length === 1 ? '' : 's'} in ${TYPE_NAMES[type]}: `, out);
}

function formatImprovedShips(category: 'speed' | 'period', type: Type, data: [string, number, number][]): string[] {
    let out: string[] = [];
    for (let [speed, newCells, oldCells] of data) {
        let {dx, dy, period} = parseSpeed(speed);
        if (shipIsOptimal(type, {pop: newCells, dx, dy, period, rle: '', rule: ''})) {
            out.push(`**${speed} (${oldCells} to ${newCells} cell${newCells === 1 ? '' : 's'})**`);
        } else {
            out.push(`${speed} (${oldCells} to ${newCells} cell${newCells === 1 ? '' : 's'})`);
        }
    }
    return splitMessages(`${data.length === 1 ? 'Improved' : data.length + ' improved'} ${category}${data.length === 1 ? '' : 's'} in ${TYPE_NAMES[type]}: `, out);
}


type ShipGroup = {newSpeeds: [string, number][], newPeriods: [string, number][], improvedSpeeds: [string, number, number][], improvedPeriods: [string, number, number][]};

export async function check5S(channel: TextChannel): Promise<void> {
    let resp = await fetch('https://speedydelete.com/5s/api/getnewships');
    if (!resp.ok) {
        await channel.send(`<@1253852708826386518> ${resp.status} ${resp.statusText} while fetching new ships`);
        return;
    }
    let data = await resp.json() as {newSpeeds: [Type, string, number][], improvedSpeeds: [Type, string, number, number][], newPeriods: [Type, string, number][], improvedPeriods: [Type, string, number, number][]};
    if (data.newSpeeds.length === 0 && data.improvedSpeeds.length === 0 && data.newPeriods.length === 0 && data.improvedPeriods.length === 0) {
        return;
    }
    let groups: {[K in Type]?: ShipGroup} = {};
    for (let key of ['newSpeeds', 'improvedSpeeds', 'newPeriods', 'improvedPeriods'] as const) {
        for (let ship of data[key]) {
            let data: ShipGroup;
            if (ship[0] in groups) {
                data = groups[ship[0]] as ShipGroup;
            } else {
                data = {newSpeeds: [], newPeriods: [], improvedSpeeds: [], improvedPeriods: []};
                groups[ship[0]] = data;
            }
            // @ts-ignore
            data[key].push(ship.slice(1));
        }
    }
    let msgs: string[] = [];
    for (let _key of Object.keys(groups).sort()) {
        let key = _key as Type;
        let data = groups[key] as ShipGroup;
        if (data.newSpeeds.length > 0) {
            msgs.push(...formatNewShips('speed', key, data.newSpeeds));
        }
        if (data.newPeriods.length > 0) {
            msgs.push(...formatNewShips('period', key, data.newPeriods));
        }
        if (data.improvedSpeeds.length > 0) {
            msgs.push(...formatImprovedShips('speed', key, data.improvedSpeeds));
        }
        if (data.improvedPeriods.length > 0) {
            msgs.push(...formatImprovedShips('period', key, data.improvedPeriods));
        }
    }
    for (let msg of msgs) {
        await channel.send(msg);
    }
}
