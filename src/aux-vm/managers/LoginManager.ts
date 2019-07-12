import {
    AuthenticationMessage,
    AuthorizationMessage,
    LoginErrorReason,
    StatusUpdate,
} from '@casual-simulation/causal-trees';
import { Observable, SubscriptionLike, Subscription } from 'rxjs';
import { AuxVM } from '../vm/AuxVM';
import { filter, shareReplay, scan, startWith } from 'rxjs/operators';
import { AuxUser } from '../AuxUser';

/**
 * Defines a class that is able to help manage the login state of a simulation.
 */
export class LoginManager implements SubscriptionLike {
    private _vm: AuxVM;
    private _sub: Subscription;
    private _loginStateChanged: Observable<LoginState>;

    get loginStateChanged(): Observable<LoginState> {
        return this._loginStateChanged;
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
                        };
                    } else if (update.type === 'authorization') {
                        return {
                            ...acc,
                            authorized: update.authorized,
                        };
                    }
                    return acc;
                },
                { authenticated: false, authorized: false }
            ),
            startWith({ authenticated: false, authorized: false }),
            shareReplay(1)
        );
        this._sub = this._loginStateChanged.subscribe();
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

    authenticationError?: LoginErrorReason;
}
