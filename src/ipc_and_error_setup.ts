
// this is in a separate file so the ESM system will run it first because it has no dependancies
// this ensures that it will almost always give a reason for why the bot had an uncaught error
// see real_base.ts for signal catching logic


export const IS_WRAPPER = Boolean(process.argv.includes('wrapper=true'));


export type BotToWrapperMessage = 
    | {type: 'heartbeat'}
    | {type: 'js-error', data: string | {name: string, message: string, stack?: string}}
    | {type: 'system-error', message: string}
;

export async function sendMessageToWrapper(message: BotToWrapperMessage): Promise<void> {
    if (process.send && !IS_WRAPPER) {
        let {promise, resolve} = Promise.withResolvers<void>();
        process.send(message, () => resolve());
        return promise;
    }
}


async function onError(error: unknown): Promise<void> {
    if (error instanceof Error) {
        await sendMessageToWrapper({type: 'js-error', data: {name: error.name, message: error.message, stack: error.stack}});
    } else {
        await sendMessageToWrapper({type: 'js-error', data: String(error)});
    }
    process.exit(1);
}

if (process.send && !IS_WRAPPER) {
    process.on('uncaughtException', onError);
    process.on('unhandledRejection', onError);
}
