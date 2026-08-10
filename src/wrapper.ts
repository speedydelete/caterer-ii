
import {ChildProcess, spawn, execSync} from 'node:child_process';
import {Client, GatewayIntentBits, TextChannel} from 'discord.js';

import {BotError, lookupSignal, Message, config, sentByAdmin} from './util.js';


let client = new Client({intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
]});

let messageChannel: TextChannel;

async function log(message: string): Promise<void> {
    console.log(message);
    await messageChannel.send(message);
}


let caterer: ChildProcess | undefined;


function getDay() {
    return Math.floor(Date.now() / 1000 / 86400);
}

let lastRestartDay = getDay();
let restartsToday = 0;

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

async function startBot(): Promise<void> {
    if (caterer) {
        throw new BotError('Bot is running!');
    }
    caterer = spawn('/home/caterer/.nvm/versions/node/v26.2.0/bin/node', [`${import.meta.dirname}/index.js`], {stdio: ['inherit', 'inherit', 'inherit', 'ipc']});
    lastHeartbeat = Date.now();
    // listen for heartbeats
    caterer.on('message', msg => {
        if (msg === 'heartbeat') {
            lastHeartbeat = Date.now();
        }
    });
    // start ethylene glycol monitor
    clearAntiFreeze();
    antiFreezeInterval = setInterval(async () => {
        if (caterer && (Date.now() - lastHeartbeat > config.antiFreeze.timeoutInterval * 1000)) {
            log('Hang detected, restarting');
            antiFreezeKilled = true;
            caterer.kill('SIGKILL');
        }
    }, config.antiFreeze.checkInterval * 1000);
    let {promise, resolve} = Promise.withResolvers<void>();
    caterer.on('spawn', () => {
        log('Bot started!');
        resolve();
    });
    caterer.on('exit', async (code, signal) => {
        caterer = undefined;
        clearAntiFreeze();
        if (antiFreezeKilled) {
            antiFreezeKilled = false;
        } else {
            log(`Bot exited with code ${code} ${signal === null ? '' : `(${lookupSignal(signal).desc}) `}, restarting`);
        }
        setTimeout(async () => {
            if (!isSupposedToBeOn) {
                return;
            }
            let currentDay = getDay();
            if (lastRestartDay === currentDay) {
                restartsToday++;
            } else {
                restartsToday = 1;
                lastRestartDay = currentDay;
            }
            if (restartsToday > config.wrapperMaxRestartsPerDay) {
                log('Maximum restarts exceeded for today');
            }
            await startBot();
        }, 5000);
    });
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
        await startBot();
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
        await startBot();
        return 'Restarted!';
    },

    async 'update'(msg: Message): Promise<Response> {
        await msg.reply('Updating...');
        execSync(import.meta.dirname + '/../update');
        if (caterer) {
            isSupposedToBeOn = false;
            await stopBot();
        }
        await startBot();
        isSupposedToBeOn = true;
        await msg.channel.send('Update complete!');
    },

});


client.on('messageCreate', async msg => {
    if (msg.author.bot || !sentByAdmin(msg) || !msg.content.startsWith('!!')) {
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
    let server = await client.guilds.fetch(config.wrapperInfoChannel[0]);
    messageChannel = server.channels.cache.get(config.wrapperInfoChannel[1]) as TextChannel;
    log('Wrapper started!');
    await startBot();
});

client.login(config.wrapperToken);
