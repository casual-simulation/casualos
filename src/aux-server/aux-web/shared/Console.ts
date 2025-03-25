import type { Observer } from 'rxjs';
import { Observable, Subscription, merge, Subject, ReplaySubject } from 'rxjs';
import { share, shareReplay } from 'rxjs/operators';
import type { ConsoleMessages } from '@casual-simulation/aux-common';

const externalMessages = new ReplaySubject<ConsoleMessages>(1000);

/**
 * The observable list of console messages.
 */
export const messages = merge(
    createMessagesObservable('log'),
    createMessagesObservable('warn'),
    createMessagesObservable('error'),
    externalMessages
).pipe(shareReplay(100));

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
    return new Observable((observer: Observer<ConsoleMessages>) => {
        let prev = console[type];
        console[type] = function () {
            observer.next(<any>{
                type: type,
                // eslint-disable-next-line prefer-rest-params
                messages: [...arguments],
                stack: new Error().stack,
                source: 'app',
            });
            // eslint-disable-next-line prefer-rest-params
            return prev.apply(this, arguments);
        };

        return new Subscription(() => {
            console[type] = prev;
        });
    });
}
