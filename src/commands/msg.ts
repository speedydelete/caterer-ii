
import {BotError, requiredArg, requiredRestArg, addCommand, addSuperCommand, channelLinkValidator, messageLinkValidator} from '../base.js';


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
