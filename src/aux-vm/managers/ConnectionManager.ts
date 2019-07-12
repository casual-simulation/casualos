import { setForcedOffline } from '@casual-simulation/aux-common';
import { Observable, Subscription, SubscriptionLike } from 'rxjs';
import { scan, shareReplay } from 'rxjs/operators';
import { AuxVM } from '../vm/AuxVM';

/**
 * Defines a class that manages the connection status to the server.
 */
export class ConnectionManager implements SubscriptionLike {
    private _vm: AuxVM;
    private _forcedOffline: boolean;
    private _connectionStateChanged: Observable<boolean>;
    private _sub: Subscription;

    get forcedOffline(): boolean {
        return this._forcedOffline;
    }

    get connectionStateChanged(): Observable<boolean> {
        return this._connectionStateChanged;
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
            shareReplay(1)
        );
        this._sub = this._connectionStateChanged.subscribe();
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}
