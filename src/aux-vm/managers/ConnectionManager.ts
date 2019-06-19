import { setForcedOffline } from '@casual-simulation/aux-common';
import { AuxVM } from '../vm';
import { Observable } from 'rxjs';

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
        return this._vm.connectionStateChanged;
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
