import {
    LoginErrorReason,
    StatusUpdate,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import { Observable, SubscriptionLike, Subscription } from 'rxjs';
import { AuxVM } from '../vm/AuxVM';
import {
    shareReplay,
    scan,
    startWith,
    map,
    distinctUntilChanged,
} from 'rxjs/operators';
import { AuxUser } from '../AuxUser';
import isEqual from 'lodash/isEqual';

/**
 * Defines a class that is able to help manage the login state of a simulation.
 */
export class LoginManager implements SubscriptionLike {
    private _vm: AuxVM;
    private _sub: Subscription;
    private _loginStateChanged: Observable<LoginState>;
    private _userChanged: Observable<AuxUser>;
    private _deviceChanged: Observable<DeviceInfo>;

    get loginStateChanged(): Observable<LoginState> {
        return this._loginStateChanged;
    }

    get userChanged(): Observable<AuxUser> {
        return this._userChanged;
    }

    get deviceChanged(): Observable<DeviceInfo> {
        return this._deviceChanged;
    }

    /**
     * Sets the grant that the user should use.
     * @param grant The grant.
     */
    setGrant(grant: string): Promise<void> {
        return this._vm.setGrant(grant);
    }

    setUser(user: AuxUser): Promise<void> {
        return this._vm.setUser(user);
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
                            user: update.user,
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
                            authorizationError: update.reason,
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
        this._userChanged = this._loginStateChanged.pipe(
            map(state => state.user || null),
            distinctUntilChanged(isEqual),
            shareReplay(1)
        );

        this._deviceChanged = this._loginStateChanged.pipe(
            map(state => state.info || null),
            distinctUntilChanged()
        );
        this._sub = this._loginStateChanged.subscribe();
        this._sub.add(this._userChanged.subscribe());
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

    user?: AuxUser;
    info?: DeviceInfo;
    authenticationError?: LoginErrorReason;
    authorizationError?: LoginErrorReason;
}
