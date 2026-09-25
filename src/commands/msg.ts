
import {BotError, resolvePath, readFile, requiredVariadicArg, addCommand, flagArg} from '../base.js';


addCommand(
    'msg', 'other', [],
    `Send, edit, or delete a message`,
    [],
    async args => {

    },
    {
        protected: true,
    },
);
