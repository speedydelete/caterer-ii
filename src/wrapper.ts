
import {ChildProcess, spawn, execSync} from 'node:child_process';

import {Client, GatewayIntentBits, TextChannel} from 'discord.js';

import {BotToWrapperMessage} from './ipc_and_error_setup.js';
import {IS_TESTING, BotError, Message, exists, readFile, writeFile, config, sentByAdmin, lookupSignal} from './real_base.js';


let client = new Client({intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
]});

let messageChannel: TextChannel;

async function log(message: string): Promise<void> {
    console.log(message.replaceAll(' (<@1253852708826386518>)', '').replaceAll('```', ''));
    await messageChannel.send(message);
}


let caterer: ChildProcess | undefined;


function getNow(): number {
    return Date.now() / 1000;
}

function getHour(): number {
    return Math.floor(getNow() / 3600);
}

function getDay(): number {
    return Math.floor(getNow() / 86400);
}

let lastRestartHour = getHour();
let restartsInLastHour = 1;

async function saveCounter(): Promise<void> {
    await writeFile('counter.txt', lastRestartHour + '\n' + restartsInLastHour + '\n');
}

if (exists('counter.txt')) {
    let data = await readFile('counter.txt');
    let match = data.match(/^(\d+)\n(\d+)\n$/);
    if (match) {
        let hour = Number(match[0]);
        let restarts = Number(match[1]);
        console.log(hour, getHour(), hour === getHour());
        if (hour === getHour()) {
            restartsInLastHour = restarts + 1;
            await saveCounter();
        }
    }
} else {
    await saveCounter();
}

let isSupposedToBeOn = true;

let antiFreezeInterval: NodeJS.Timeout | undefined;
let lastHeartbeat = 0;
let antiFreezeKilled = false;

function clearAntiFreeze() {
    if (antiFreezeInterval) {
        clearInterval(antiFreezeInterval);
        antiFreezeInterval = undefined;
    }
}

function onMessage(msg: BotToWrapperMessage): void {
    if (msg.type === 'heartbeat') {
        lastHeartbeat = getNow();
    } else if (msg.type === 'js-error' || msg.type === 'system-error') {
        if (msg.type === 'js-error') {
            let data = msg.data;
            let out = 'JS error caught (<@1253852708826386518>)\n```';
            if (typeof data === 'string') {
                out += msg.data;
            } else {
                if (data.stack === undefined) {
                    out += `${data.name}: ${data.message}`;
                } else {
                    out += data.stack;
                }
            }
            out += '```';
            log(out);
        } else if (msg.type === 'system-error') {
            log('System error detected (<@1253852708826386518>)\n```' + msg.message + '```');
            if (caterer) {
                caterer.kill('SIGKILL');
            }
        }
    }
}

async function startBot(manual: boolean = false): Promise<void> {
    if (caterer) {
        throw new BotError('Bot is running!');
    }
    let args = [`${import.meta.dirname}/index.js`];
    if (IS_TESTING) {
        args.push('testing=true');
    }
    caterer = spawn('/home/caterer/.nvm/versions/node/v26.2.0/bin/node', args, {stdio: ['inherit', 'inherit', 'inherit', 'ipc']});
    let {promise, resolve} = Promise.withResolvers<void>();
    caterer.on('spawn', () => {
        if (manual) {
            console.log('Bot started!');
        } else {
            log('Bot started!');
        }
        resolve();
    });
    caterer.on('exit', async (code, signal) => {
        caterer = undefined;
        clearAntiFreeze();
        if (antiFreezeKilled) {
            antiFreezeKilled = false;
        } else {
            log(`Bot exited with code ${code}${signal === null ? '' : ` (${lookupSignal(signal).desc}) `}, restarting`);
        }
        setTimeout(async () => {
            if (!isSupposedToBeOn) {
                return;
            }
            let currentHour = getHour();
            if (lastRestartHour === currentHour) {
                restartsInLastHour++;
            } else {
                lastRestartHour = currentHour;
                restartsInLastHour = 1;
            }
            await saveCounter();
            if (restartsInLastHour > config.wrapper.maxRestartsPerHour) {
                log('Maximum automatic restarts exceeded for this hour, not restarting');
                isSupposedToBeOn = false;
                let interval = setInterval(async () => {
                    if (getHour() !== currentHour) {
                        clearInterval(interval);
                        isSupposedToBeOn = true;
                        await startBot();
                    }
                }, 60000);
                return;
            }
            await startBot();
        }, 5000);
    });
    caterer.on('message', onMessage);
    // start ethylene glycol monitor
    lastHeartbeat = getNow();
    clearAntiFreeze();
    antiFreezeInterval = setInterval(async () => {
        if (caterer && (getNow() - lastHeartbeat > config.antiFreeze.timeoutInterval)) {
            log('Hang detected, restarting');
            antiFreezeKilled = true;
            caterer.kill('SIGKILL');
        }
    }, config.antiFreeze.checkInterval * 1000);
    return promise;
}

async function stopBot(): Promise<void> {
    if (!caterer) {
        throw new BotError('Bot is not running!');
    }
    clearAntiFreeze();
    caterer.removeAllListeners('exit');
    let {promise, resolve} = Promise.withResolvers<void>();
    caterer.on('exit', () => {
        caterer = undefined;
        resolve();
    });
    caterer.kill(9);
    return promise;
}


type Response = string | undefined | void;

const COMMANDS: {[key: string]: (msg: Message) => Promise<Response>} = Object.assign(Object.create(null), {

    async 'start'(): Promise<Response> {
        isSupposedToBeOn = true;
        await startBot(true);
        return 'Started!';
    },

    async 'stop'(): Promise<Response> {
        if (!caterer && isSupposedToBeOn) {
            isSupposedToBeOn = false;
            return 'Stopped!';
        } else {
            isSupposedToBeOn = false;
            await stopBot();
        }
        return 'Stopped!';
    },

    async 'restart'(): Promise<Response> {
        await stopBot();
        await startBot(true);
        return 'Restarted!';
    },

    async 'update'(msg: Message): Promise<Response> {
        await msg.reply('Updating...');
        execSync(import.meta.dirname + '/../update');
        if (caterer) {
            isSupposedToBeOn = false;
            await stopBot();
        }
        await startBot(true);
        isSupposedToBeOn = true;
        await msg.channel.send('Update complete!');
    },

    async 'getcounter'(): Promise<Response> {
        return `Current hour: ${getHour()}\nLast hour: ${lastRestartHour}\nRestarts in last hour: ${restartsInLastHour}`;
    },

    async 'resetcounter'(): Promise<Response> {
        restartsInLastHour = 0;
        await saveCounter();
        return 'Counter reset!';
    },

});


client.on('messageCreate', async msg => {
    if (msg.author.bot || !msg.inGuild() || !sentByAdmin(msg) || !msg.content.startsWith(IS_TESTING ? '$$' : '!!')) {
        return;
    }
    try {
        let command = msg.content.slice(2);
        if (!(command in COMMANDS)) {
            return;
        }
        let resp = await COMMANDS[command](msg);
        if (resp !== undefined) {
            await msg.reply(resp);
        }
    } catch (error) {
        let str: string;
        if (error && typeof error === 'object' && 'stack' in error) {
            str = String(error.stack);
        } else {
            str = String(error);
        }
        await msg.reply('```' + str + '```');
    }
});

client.once('clientReady', async () => {
    console.log('Logged in');
    let server = await client.guilds.fetch(config.wrapper.logsChannelServerID);
    messageChannel = server.channels.cache.get(config.wrapper.logsChannelID) as TextChannel;
    log('Wrapper started!');
    await startBot();
});

client.login(config.wrapper.token);

// restart every 24 hours
let prevDay = getDay();
setInterval(async () => {
    let day = getDay();
    if (day !== prevDay) {
        await stopBot();
        process.exit(0);
    }
}, 60000);
