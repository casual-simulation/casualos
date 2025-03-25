import type {
    StatusUpdate,
    ConnectionInfo,
    WebsocketErrorCode,
    WebsocketErrorInfo,
} from '@casual-simulation/aux-common';
import type { Observable, SubscriptionLike, Subscription } from 'rxjs';
import type { AuxVM } from '../vm/AuxVM';
import {
    shareReplay,
    scan,
    startWith,
    map,
    distinctUntilChanged,
} from 'rxjs/operators';
import { isEqual } from 'lodash';

/**
 * Defines a class that is able to help manage the login state of a simulation.
 */
export class LoginManager implements SubscriptionLike {
    private _vm: AuxVM;
    private _sub: Subscription;
    private _loginStateChanged: Observable<LoginState>;
    private _deviceChanged: Observable<ConnectionInfo>;

    get loginStateChanged(): Observable<LoginState> {
        return this._loginStateChanged;
    }

    get deviceChanged(): Observable<ConnectionInfo> {
        return this._deviceChanged;
    }

    constructor(vm: AuxVM) {
        this._vm = vm;

        this._loginStateChanged = this._vm.connectionStateChanged.pipe(
            scan(
                (acc: LoginState, update: StatusUpdate) => {
                    if (update.type === 'authentication') {
                        return {
                            ...acc,
                            authenticated: update.authenticated,
                            authenticationError: update.reason,
                            info: update.info,
                            authorized: <boolean>null,
                        };
                    } else if (
                        update.type === 'authorization' &&
                        acc.authorized !== update.authorized
                    ) {
                        return {
                            ...acc,
                            authorized: update.authorized,
                            error: update.error,
                        };
                    }
                    return acc;
                },
                { authenticated: false, authorized: <boolean>null }
            ),
            startWith({ authenticated: false, authorized: <boolean>null }),
            distinctUntilChanged(),
            shareReplay(1)
        );

        this._deviceChanged = this._loginStateChanged.pipe(
            map((state) => state.info || null),
            distinctUntilChanged()
        );
        this._sub = this._loginStateChanged.subscribe();
        this._sub.add(this._deviceChanged.subscribe());
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}

export interface LoginState {
    authenticated: boolean;
    authorized: boolean;
    info?: ConnectionInfo;
    error?: WebsocketErrorInfo;
    authenticationError?: WebsocketErrorCode;
}
