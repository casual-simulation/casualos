/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Observer } from 'rxjs';
import { Observable, Subscription, merge, ReplaySubject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
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
