import { setForcedOffline } from '@casual-simulation/aux-common';
import { Observable } from 'rxjs';
import { scan } from 'rxjs/operators';
import { AuxVM } from '../vm/AuxVM';

/**
 * Defines a class that manages the connection status to the server.
 */
export class ConnectionManager {
    private _vm: AuxVM;
    private _forcedOffline: boolean;

    get forcedOffline(): boolean {
        return this._forcedOffline;
    }

    get connectionStateChanged(): Observable<boolean> {
        return this._vm.connectionStateChanged.pipe(
            scan(
                (acc, curr) =>
                    curr.type === 'connection' ? curr.connected : acc,
                false
            )
        );
    }

    async toggleForceOffline() {
        this._forcedOffline = !this._forcedOffline;
        await this._vm.sendEvents([setForcedOffline(this._forcedOffline)]);
    }

    constructor(vm: AuxVM) {
        this._vm = vm;
        this._forcedOffline = false;
    }
}
