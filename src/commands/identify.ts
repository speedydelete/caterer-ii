

function embedIdentified(original: Pattern, type: PatternType | Identified, isOutput?: boolean): EmbedBuilder[] {
    let out = '';
    if (type.period > 0) {
        out += `**Period:** ${type.period}\n`;
    }
    if (type.disp && (type.disp[0] !== 0 || type.disp[1] !== 0)) {
        out += `**Displacement:** (${type.disp[0]}, ${type.disp[1]})\n`;
    }
    if (type.stabilizedAt > 0) {
        out += `**Stabilizes at:** ${type.stabilizedAt}\n`;
    }
    if (type.power !== undefined) {
        out += `**Power:** ${type.power}\n`;
    }
    let pops: number[];
    if (type.period > 0) {
        pops = type.pops.slice(0, type.stabilizedAt + type.period);
    } else {
        pops = type.pops;
    }
    let minPop = Math.min(...pops);
    let avgPop = pops.reduce((x, y) => x + y, 0) / pops.length;
    let maxPop = Math.max(...pops);
    out += `**Populations:** ${minPop} | ${Math.round(avgPop * 100) / 100} | ${maxPop}\n`;
    if ('minmax' in type && type.minmax) {
        out += `**Min:** ${type.minmax[0]}\n`;
        out += `**Max:** ${type.minmax[1]}\n`;
    }
    if ('symmetry' in type) {
        out += `**Symmetry:** ${type.symmetry.replaceAll('*', '\\*')} (${ALTERNATE_SYMMETRIES[type.symmetry].replaceAll('\\', '\\\\').replaceAll('_', '\\_')})\n`;
    }
    if (type.period > 1) {
        if ('heat' in type && type.heat !== undefined) {
            out += `**Heat:** ${Math.round(type.heat * 1000) / 1000}\n`;
        }
        if ('temperature' in type && type.temperature !== undefined) {
            out += `**Temperature:** ${Math.round(type.temperature * 1000) / 1000}\n`;
        }
        if ('volatility' in type && type.volatility !== undefined) {
            out += `**Volatility:** ${Math.round(type.volatility * 1000) / 1000}\n`;
        }
        if ('strictVolatility' in type && type.strictVolatility !== undefined) {
            out += `**Strict volatility:** ${Math.round(type.strictVolatility * 1000) / 1000}\n`;
        }
    }
    type.phases[0] = original;
    type.phases[type.stabilizedAt] = original.copy().run(type.stabilizedAt);
    let apgcode = getApgcode(type);
    if (apgcode !== 'PATHOLOGICAL') {
        out += '[';
        if (apgcode.length > 1280) {
            apgcode = 'ov_' + apgcode.slice(1, apgcode.indexOf('_'));
        }
        if (apgcode.length > 31) {
            out += apgcode.slice(0, 14) + '...' + apgcode.slice(-14);
        } else {
            out += apgcode;
        }
        out += '](https://catagolue.hatsya.com/object/' + apgcode + '/' + toCatagolueRule(type.phases[0].rule.str) + ')';
    }
    let title = 'desc' in type ? type.desc : getDescription(type);
    let name: string | undefined = undefined;
    if (apgcode.startsWith('x') || apgcode.startsWith('y')) {
        name = names.get(apgcode);
    } else {
        name = names.get(type.phases[0].toCanonicalApgcode(1, 'x'));
    }
    if (name !== undefined) {
        title = name + ' (' + title + ')';
    }
    if (isOutput) {
        title = 'Output: ' + title;
    }
    let embeds = [(new EmbedBuilder()).setTitle(title).setDescription(out)];
    if ('output' in type && type.output) {
        for (let embed of embedIdentified(Object.assign(original.clearedCopy(), type.output.phases[0]), type.output, true)) {
            embeds.push(embed);
        }
    }
    return embeds;
}

export async function cmdIdentify(msg: Message, argv: string[]): Promise<Response> {
    await msg.channel.sendTyping();
    let noTimeout = false;
    if (argv[1] === 'notimeout') {
        if (sentByAdmin(msg)) {
            noTimeout = true;
            argv = argv.slice(1);
        } else {
            throw new BotError(`You must be an admin to use notimeout!`);
        }
    }
    let limit = 1024;
    if (argv[1]) {
        let parsed = Number(argv[1]);
        if (Number.isNaN(parsed)) {
            throw new BotError(`Invalid number: '${argv[1]}'`);
        }
        limit = parsed;
    }
    let data = await findRLE(msg);
    let out = await runWorkerJob('identify', {value: serialize(data.p), limit}, noTimeout);
    return {embeds: embedIdentified(data.p, out)};
}

export async function cmdBasicIdentify(msg: Message, argv: string[]): Promise<Response> {
    await msg.channel.sendTyping();
    let noTimeout = false;
    if (argv[1] === 'notimeout') {
        if (sentByAdmin(msg)) {
            noTimeout = true;
            argv = argv.slice(1);
        } else {
            throw new BotError(`You must be an admin to use notimeout!`);
        }
    }
    let limit = 1024;
    if (argv[1]) {
        let parsed = Number(argv[1]);
        if (!Number.isNaN(parsed)) {
            limit = parsed;
        }
    }
    let data = await findRLE(msg);
    let out = await runWorkerJob('basic_identify', {value: serialize(data.p), limit}, noTimeout);
    return {embeds: embedIdentified(data.p, out)};
}

export async function cmdMinmax(msg: Message, argv: string[]): Promise<Response> {
    await msg.channel.sendTyping();
    let noTimeout = false;
    if (argv[1] === 'notimeout') {
        if (sentByAdmin(msg)) {
            noTimeout = true;
            argv = argv.slice(1);
        } else {
            throw new BotError(`You must be an admin to use notimeout!`);
        }
    }
    let gens = Number(argv[1]);
    if (Number.isNaN(gens)) {
        throw new BotError('Argument 1 is not a valid number');
    }
    let data = await findRLE(msg);
    let out = await runWorkerJob('minmax', {value: serialize(data.p), gens}, noTimeout);
    return `Min: ${out[0]}\nMax: ${out[1]}`;
}

export async function cmdIdentifyConduit(msg: Message, argv: string[]): Promise<Response> {
    await msg.channel.sendTyping();
    let noTimeout = false;
    if (argv[1] === 'notimeout') {
        if (sentByAdmin(msg)) {
            noTimeout = true;
            argv = argv.slice(1);
        } else {
            throw new BotError(`You must be an admin to use notimeout!`);
        }
    }
    let minTime = argv[1] ? parseInt(argv[1]) : 0;
    let sepGens = argv[2] ? parseInt(argv[2]) : 0;
    let maxTime = argv[3] ? parseInt(argv[3]) : 512;
    let identifyGens = argv[4] ? parseInt(argv[4]) : 256;
    let p = (await findRLE(msg)).p;
    if (p.rule.str.includes('History') || p.rule.str.includes('Super')) {
        p.setData(p.height, p.width, p.getData().map(x => x % 2));
    }
    let data = await runWorkerJob('identify_conduit', {value: serialize(p), minTime, maxTime, maxRT: maxTime, sepGens, identifyGens}, noTimeout);
    if (data === false) {
        throw new BotError(`Not a conduit!`);
    }
    let title = getConduitName(data, true).replaceAll('_', '\\_').replaceAll('*', '\\*');
    let out: string[] = [];
    let inputTimeStr = data.inputTime ? ` at generation ${data.inputTime}` : '';
    if (data.input in CONDUIT_OBJECTS) {
        let name = CONDUIT_OBJECTS[data.input][0];
        name = name[0].toUpperCase() + name.slice(1);
        out.push(`**Input:** ${name}${inputTimeStr}`);
    } else {
        out.push(`**Input:** ${data.input}${inputTimeStr}`);
    }
    for (let obj of data.output) {
        let suffix = `at generation ${obj.time} and position (${obj.x}, ${obj.y})`;
        if (obj.objTime !== 0) {
            suffix = `(after ${obj.objTime} generation${obj.objTime === 1 ? '' : 's'}) ` + suffix;
        }
        if (obj.obj in CONDUIT_OBJECTS) {
            let name = CONDUIT_OBJECTS[obj.obj][0];
            name = name[0].toUpperCase() + name.slice(1);
            out.push(`**Output:** ${name} ${suffix}`);
        } else {
            out.push(`**Output:** ${obj.obj} ${suffix}`);
        }
    }
    for (let glider of data.gliders) {
        out.push(`**Output:** ${glider.dir} glider lane ${glider.lane} timing ${glider.timing}`);
    }
    for (let obj of data.otherOutputs) {
        out.push(`**Output:** ${obj.code} (${obj.x}, ${obj.y})`);
    }
    if (data.repeatTime !== undefined) {
        out.push(`**Repeat time:** ${data.repeatTime}`);
        if (data.overclock) {
            if (data.overclock.length === 0) {
                out.push('**No overclock**');
            } else {
                out.push(`**Overclock:** ${toRanges(data.overclock)}`);
            }
        }
    }
    return {embeds: [(new EmbedBuilder()).setTitle(title).setDescription(out.join('\n'))]};
}
