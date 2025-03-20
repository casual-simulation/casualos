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
import { setForcedOffline } from '@casual-simulation/aux-common';
import type { Observable, Subscription, SubscriptionLike } from 'rxjs';
import {
    distinctUntilChanged,
    scan,
    shareReplay,
    map,
    skipWhile,
} from 'rxjs/operators';
import type { AuxVM } from '../vm/AuxVM';

/**
 * Defines a class that manages the connection status to the inst.
 */
export class ConnectionManager implements SubscriptionLike {
    private _vm: AuxVM;
    private _forcedOffline: boolean;
    private _connectionStateChanged: Observable<boolean>;
    private _syncStateChanged: Observable<boolean>;
    private _sub: Subscription;

    get forcedOffline(): boolean {
        return this._forcedOffline;
    }

    get connectionStateChanged(): Observable<boolean> {
        return this._connectionStateChanged;
    }

    get syncStateChanged(): Observable<boolean> {
        return this._syncStateChanged;
    }

    async toggleForceOffline() {
        this._forcedOffline = !this._forcedOffline;
        await this._vm.sendEvents([setForcedOffline(this._forcedOffline)]);
    }

    constructor(vm: AuxVM) {
        this._vm = vm;
        this._forcedOffline = false;
        this._connectionStateChanged = this._vm.connectionStateChanged.pipe(
            scan(
                (acc, curr) =>
                    curr.type === 'connection' ? curr.connected : acc,
                false
            ),
            distinctUntilChanged(),
            shareReplay(1)
        );
        this._syncStateChanged = this._vm.connectionStateChanged.pipe(
            scan(
                (acc, curr) => {
                    if (curr.type === 'sync') {
                        return {
                            ...acc,
                            synced: curr.synced,
                        };
                    } else if (curr.type === 'init') {
                        return {
                            ...acc,
                            init: true,
                        };
                    }
                    return acc;
                },
                { synced: false, init: false }
            ),
            skipWhile((a) => !a.init),
            map((a) => a.synced),
            distinctUntilChanged(),
            shareReplay(1)
        );
        this._sub = this._connectionStateChanged.subscribe();
        this._sub.add(this._syncStateChanged.subscribe());
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}
