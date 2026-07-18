
import {ChildProcess, spawn, execSync} from 'node:child_process';
import {Client, GatewayIntentBits, TextChannel} from 'discord.js';

import {BotError, config, sentByAdmin} from './util.js';


let client = new Client({intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
]});


let messageChannel: TextChannel;

client.once('clientReady', async () => {
    console.log('Logged in');
    let server = await client.guilds.fetch(config.wrapperInfoChannel[0]);
    messageChannel = server.channels.cache.get(config.wrapperInfoChannel[1]) as TextChannel;
    await messageChannel.send('Wrapper started!');
    await startBot();
});


let process: ChildProcess | undefined;


function getDay() {
    return Math.floor(Date.now() / 1000 / 86400);
}

let lastRestartDay = getDay();
let restartsToday = 0;

let isSupposedToBeOn = true;

async function startBot(): Promise<void> {
    if (process) {
        throw new BotError('Bot is running!');
    }
    process = spawn('/home/caterer/.nvm/versions/node/v26.5.0/bin/node', [`${import.meta.dirname}/index.js`], {stdio: 'inherit'});
    let {promise, resolve} = Promise.withResolvers<void>();
    process.on('spawn', resolve);
    process.on('exit', async () => {
        console.log('hiii 1')
        process = undefined;
        await messageChannel.send('Bot exited, restarting');
        setTimeout(async () => {
            console.log('hiii 2');
            if (!isSupposedToBeOn) {
                return;
            }
            let currentDay = getDay();
            if (lastRestartDay === currentDay) {
                restartsToday++;
            } else {
                restartsToday = 1;
            }
            if (restartsToday > config.wrapperMaxRestartsPerDay) {
                await messageChannel.send('Maximum restarts exceeded');
            }
            await startBot();
        }, 5000);
    });
    return promise;
}

async function stopBot(): Promise<void> {
    if (!process) {
        throw new BotError('Bot is not running!');
    }
    process.removeAllListeners('exit');
    let {promise, resolve} = Promise.withResolvers<void>();
    process.on('exit', () => {
        process = undefined;
        resolve();
    });
    process.kill(9);
    return promise;
}


client.on('messageCreate', async msg => {
    if (msg.author.bot || !sentByAdmin(msg) || !msg.content.startsWith('!!')) {
        return;
    }
    try {
        if (msg.content === '!!start') {
            isSupposedToBeOn = true;
            await startBot();
            await msg.reply('Started!');
        } else if (msg.content === '!!stop') {
            isSupposedToBeOn = false;
            await stopBot();
            await msg.reply('Stopped!');
        } else if (msg.content === '!!restart') {
            await stopBot();
            await startBot();
            await msg.reply('Restarted!');
        } else if (msg.content === '!!update') {
            console.log('updating');
            await msg.reply('Updating...');
            console.log('stopping');
            console.log('process:', typeof process);
            if (process) {
                await stopBot();
            }
            console.log('stopped');
            console.log('process:', typeof process);
            console.log('actually updating');
            execSync(import.meta.dirname + '/../update2.sh');
            console.log('starting');
            console.log('process:', typeof process);
            await startBot();
            console.log('started');
            console.log('process:', typeof process);
            await msg.channel.send('Update complete!');
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

client.login(config.wrapperToken);
