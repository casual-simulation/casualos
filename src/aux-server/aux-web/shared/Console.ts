import { Observable, Subscription, Observer, merge } from 'rxjs';
import { share } from 'rxjs/operators';

/**
 * Defines the set of possible console message types.
 */
export type ConsoleMessages =
    | ConsoleLogMessage
    | ConsoleWarnMessage
    | ConsoleErrorMessage;

/**
 * Defines an interface for a console log message.
 */
export interface ConsoleLogMessage extends ConsoleMessage {
    type: 'log';
}

/**
 * Defines an interface for a console log message.
 */
export interface ConsoleWarnMessage extends ConsoleMessage {
    type: 'warn';
}

/**
 * Defines an interface for a console error message.
 */
export interface ConsoleErrorMessage extends ConsoleMessage {
    type: 'error';
}

/**
 * Defines an interface for a console message.
 */
export interface ConsoleMessage {
    messages: any[];
    stack: string;
}

/**
 * The observable list of console messages.
 */
export const messages = merge(
    createMessagesObservable('log'),
    createMessagesObservable('warn'),
    createMessagesObservable('error')
).pipe(share());

function createMessagesObservable(
    type: ConsoleMessages['type']
): Observable<ConsoleMessages> {
    return Observable.create((observer: Observer<ConsoleMessages>) => {
        let prev = console[type];
        console[type] = function() {
            observer.next(<any>{
                type: type,
                messages: [...arguments],
                stack: new Error().stack,
            });
            return prev.apply(this, arguments);
        };

        return new Subscription(() => {
            console[type] = prev;
        });
    });
}
