
import {DiscordAPIError, GuildBasedChannel, Guild} from 'discord.js';

import {BotError, Message, NonPromiseValidatorResult, requiredArg, requiredRestArg, addCommand, addSuperCommand} from '../base.js';
import {client} from '../index.js';


export async function channelLinkValidator(arg: string): Promise<NonPromiseValidatorResult<GuildBasedChannel>> {
    let match = arg.match(/^https:\/\/discord\.com\/channels\/(\d+)\/(\d+)/);
    if (!match) {
        return {isError: true, name: 'channel link', reason: `invalid link`};
    }
    let serverID = match[1];
    let channelID = match[2];
    let server: Guild;
    try {
        server = await client.guilds.fetch(serverID);
    } catch (error) {
        if (error instanceof DiscordAPIError) {
            return {isError: true, name: 'channel link', reason: `server does not exist or cannot be accessed`};
        } else {
            throw error;
        }
    }
    let channel = await server.channels.fetch(channelID);
    if (channel === null) {
        return {isError: true, name: 'channel link', reason: `channel does not exist or cannot be accessed`};
    }
    return {isError: false, value: channel};
}

export async function messageLinkValidator(arg: string): Promise<NonPromiseValidatorResult<Message>> {
    let match = arg.match(/^https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
    if (!match) {
        return {isError: true, name: 'channel link', reason: `invalid link`};
    }
    let serverID = match[1];
    let channelID = match[2];
    let messageID = match[3];
    let server: Guild;
    try {
        server = await client.guilds.fetch(serverID);
    } catch (error) {
        if (error instanceof DiscordAPIError) {
            return {isError: true, name: 'message link', reason: `server does not exist or cannot be accessed`};
        } else {
            throw error;
        }
    }
    let channel = await server.channels.fetch(channelID);
    if (channel === null) {
        return {isError: true, name: 'message link', reason: `channel does not exist or cannot be accessed`};
    }
    if (!channel.isTextBased()) {
        return {isError: true, name: 'message link', reason: `channel is not text-based`};
    }
    try {
        let message = await channel.messages.fetch(messageID);
        return {isError: false, value: message};
    } catch (error) {
        if (error instanceof DiscordAPIError) {
            return {isError: true, name: 'message link', reason: `message does not exist`};
        } else {
            throw error;
        }
    }
}


addSuperCommand(
    'msg', 'other', [],
    `Send, edit, or delete a message`,
    ['send', 'edit', 'delete'],
    {
        protected: true,
    },
);

addCommand(
    'msg send', 'sub', [],
    `Send a message`,
    [
        requiredArg('channel', channelLinkValidator, `The channel to send it in`),
        requiredRestArg('text', 'string', `The text to send`),
    ],
    async args => {
        if (!args.channel.isSendable()) {
            throw new BotError(`Cannot send message in channel`);
        }
        await args.channel.send(args.text);
        return {type: 'string', value: 'Sent!'};
    },
    {
        protected: true,
        noArgParse: true,
    },
);

addCommand(
    'msg edit', 'sub', [],
    `Send a message`,
    [
        requiredArg('message', messageLinkValidator, `The message to edit`),
        requiredRestArg('text', 'string', `The text to edit it to`),
    ],
    async args => {
        if (!args.message.editable) {
            throw new BotError(`Cannot edit message in channel`);
        }
        await args.message.edit(args.text);
        return {type: 'string', value: 'Edited!'};
    },
    {
        protected: true,
        noArgParse: true,
    },
);

addCommand(
    'msg delete', 'sub', [],
    `Delete a message`,
    [
        requiredArg('message', messageLinkValidator, `The message to delete`),
    ],
    async args => {
        if (!args.message.deletable) {
            throw new BotError(`Cannot edit message in channel`);
        }
        await args.message.delete();
        return {type: 'string', value: 'Deleted!'};
    },
    {
        protected: true,
        noArgParse: true,
    },
);
