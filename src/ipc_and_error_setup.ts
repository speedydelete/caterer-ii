
// this is in a separate file so the ESM system will run it first because it has no dependancies
// this ensures that it will almost always give a reason for why the bot had an uncaught error
// see util.ts for signal catching logic


export type CatererIPCMessage = 
    | {type: 'heartbeat'}
    | {type: 'js-error', data: string | {name: string, message: string, stack?: string}}
    | {type: 'system-error', message: string}
;

export async function sendMessage(message: CatererIPCMessage): Promise<void> {
    if (process.send) {
        let {promise, resolve} = Promise.withResolvers<void>();
        process.send(message, () => resolve());
        return promise;
    }
}


async function onError(error: unknown): Promise<void> {
    if (error instanceof Error) {
        await sendMessage({type: 'js-error', data: {name: error.name, message: error.message, stack: error.stack}});
    } else {
        await sendMessage({type: 'js-error', data: String(error)});
    }
}

process.on('uncaughtException', onError);
process.on('unhandledRejection', onError);
