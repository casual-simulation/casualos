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
import type { ProgressMessage } from '@casual-simulation/aux-common';
import type { AuxVM } from '../vm/AuxVM';
import type { SubscriptionLike, Subscription, Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { tap, takeWhile } from 'rxjs/operators';

/**
 * Defines a class that can manage the current loading progress state of a simulation.
 */
export class ProgressManager implements SubscriptionLike {
    private _progress: BehaviorSubject<ProgressMessage>;
    private _vm: AuxVM;
    private _sub: Subscription;

    get updates(): Observable<ProgressMessage> {
        return this._progress;
    }

    constructor(vm: AuxVM) {
        this._vm = vm;

        this._progress = new BehaviorSubject<ProgressMessage>({
            type: 'progress',
            progress: 0,
            message: 'Starting...',
        });
        this._sub = this._vm.connectionStateChanged
            .pipe(
                takeWhile((m) => m.type !== 'init'),
                tap((message) => {
                    if (message.type === 'progress') {
                        this._progress.next(message);
                    } else if (message.type === 'authorization') {
                        if (message.authorized === false) {
                            this._progress.next({
                                type: 'progress',
                                progress: 1,
                                message: 'You are not authorized.',
                                error: true,
                            });
                        }
                    } else if (message.type === 'authentication') {
                        if (message.authenticated === false) {
                            this._progress.next({
                                type: 'progress',
                                progress: 1,
                                message: 'You are not authenticated.',
                                done: true,
                            });
                        }
                    }
                })
            )
            .subscribe({
                error: (err) => console.error(err),
                complete: () => {
                    this._progress.next({
                        type: 'progress',
                        message: 'Done.',
                        progress: 1,
                        done: true,
                    });
                },
            });
    }

    unsubscribe() {
        this._sub.unsubscribe();
    }

    get closed() {
        return this._sub.closed;
    }
}
