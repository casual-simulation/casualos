import {
    Observable,
    Subscription,
    Observer,
    merge,
    Subject,
    ReplaySubject,
} from 'rxjs';
import { share } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';

const externalMessages = new ReplaySubject<ConsoleMessages>(1000);

/**
 * The observable list of console messages.
 */
export const messages = merge(
    createMessagesObservable('log'),
    createMessagesObservable('warn'),
    createMessagesObservable('error'),
    externalMessages
).pipe(share());

/**
 * Records the given console message.
 * @param message
 */
export function recordMessage(message: ConsoleMessages) {
    externalMessages.next(message);
}

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
                source: 'app',
            });
            return prev.apply(this, arguments);
        };

        return new Subscription(() => {
            console[type] = prev;
        });
    });
}
