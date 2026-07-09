
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
    await messageChannel.send('Wrapper started');
});


let process: ChildProcess | undefined;


function getDay() {
    return Math.floor(Date.now() / 1000 / 86400);
}

let lastRestartDay = getDay();
let restartsToday = 0;

async function startBot(): Promise<void> {
    if (process) {
        throw new BotError('Bot is running!');
    }
    process = spawn(`node ${import.meta.dirname}/index.js`);
    let {promise, resolve} = Promise.withResolvers<void>();
    process.on('spawn', resolve);
    process.on('exit', async () => {
        await messageChannel.send('Bot exited, restarting');
        setTimeout(async () => {
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
            await startBot();
            await msg.reply('Started!');
        } else if (msg.content === '!!stop') {
            await stopBot();
            await msg.reply('Stopped!');
        } else if (msg.content === '!!restart') {
            await stopBot();
            await startBot();
            await msg.reply('Restarted!');
        } else if (msg.content === '!!update') {
            await msg.reply('Updating...');
            await stopBot();
            execSync(import.meta.dirname + '/../update2.sh');
            await startBot();
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
