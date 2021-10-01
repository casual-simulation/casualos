import { setForcedOffline } from '@casual-simulation/aux-common';
import { Observable, Subscription, SubscriptionLike } from 'rxjs';
import {
    distinctUntilChanged,
    scan,
    shareReplay,
    map,
    skipWhile,
} from 'rxjs/operators';
import { AuxVM } from '../vm/AuxVM';

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
