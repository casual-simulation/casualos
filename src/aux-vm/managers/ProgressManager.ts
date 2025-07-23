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
import type { HideLoadingScreenAction } from '@casual-simulation/aux-common';
import {
    asyncResult,
    hasValue,
    LOAD_PORTALS,
    type ProgressMessage,
} from '@casual-simulation/aux-common';
import type { AuxVM } from '../vm/AuxVM';
import type { SubscriptionLike, Subscription, Observable } from 'rxjs';
import { BehaviorSubject, merge } from 'rxjs';
import {
    tap,
    takeWhile,
    map,
    filter,
    first,
    mergeMap,
    skipWhile,
    take,
} from 'rxjs/operators';

/**
 * Defines a class that can manage the current loading progress state of a simulation.
 */
export class ProgressManager implements SubscriptionLike {
    private _progress: BehaviorSubject<ProgressMessage>;
    private _vm: AuxVM;
    private _onPortalLoaded: Observable<string>;
    private _sub: Subscription;

    get updates(): Observable<ProgressMessage> {
        return this._progress;
    }

    constructor(vm: AuxVM, onPortalLoaded: Observable<string>) {
        this._vm = vm;
        this._onPortalLoaded = onPortalLoaded;

        this._progress = new BehaviorSubject<ProgressMessage>({
            type: 'progress',
            progress: 0,
            message: 'Starting...',
        });

        // loading is only done when a portal is opened
        const vmProgress: Observable<ProgressMessage> =
            this._vm.connectionStateChanged.pipe(
                takeWhile((m) => m.type !== 'init'),
                filter(
                    (m) =>
                        m.type === 'progress' ||
                        m.type === 'authorization' ||
                        m.type === 'authentication'
                ),
                map((m) => {
                    if (m.type === 'progress') {
                        return {
                            ...m,
                            done: false,
                        };
                    } else if (m.type === 'authorization') {
                        if (!m.authorized) {
                            return {
                                type: 'progress',
                                progress: 1,
                                message: 'You are not authorized.',
                                error: true,
                            } as ProgressMessage;
                        }
                    } else if (m.type === 'authentication') {
                        if (!m.authenticated) {
                            return {
                                type: 'progress',
                                progress: 1,
                                message: 'You are not authenticated.',
                                done: true,
                            } as ProgressMessage;
                        }
                    }
                    return null;
                }),
                filter((m) => !!m),
                tap({
                    error: (err) => console.error(err),
                })
            );

        const portalProgress: Observable<ProgressMessage> =
            this._onPortalLoaded.pipe(
                first((b) => LOAD_PORTALS.includes(b)),
                map(() => ({
                    type: 'progress',
                    message: 'Done.',
                    progress: 1,
                    done: true,
                }))
            );

        const hideProgress: Observable<ProgressMessage> =
            this._vm.localEvents.pipe(
                mergeMap((e) => e),
                skipWhile((e) => e.type !== 'hide_loading_screen'),
                take(1),
                tap((e: HideLoadingScreenAction) => {
                    if (hasValue(e.taskId)) {
                        this._vm.sendEvents([asyncResult(e.taskId, null)]);
                    }
                }),
                map(() => ({
                    type: 'progress',
                    message: 'Done.',
                    progress: 1,
                    done: true,
                }))
            );

        const allProgress = merge(
            vmProgress,
            portalProgress,
            hideProgress
        ).pipe(takeWhile((m) => !m.done && !m.error, true));

        this._sub = allProgress.subscribe(this._progress);
    }

    unsubscribe() {
        this._sub.unsubscribe();
    }

    get closed() {
        return this._sub.closed;
    }
}
