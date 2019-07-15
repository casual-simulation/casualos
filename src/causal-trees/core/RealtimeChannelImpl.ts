import { StatusUpdate } from './StatusUpdate';
import {
    Observable,
    Subject,
    SubscriptionLike,
    Subscription,
    BehaviorSubject,
} from 'rxjs';
import { RealtimeChannelConnection } from './RealtimeChannelConnection';
import { RealtimeChannel } from './RealtimeChannel';
import { User } from './User';
import { combineLatest, tap, skip } from 'rxjs/operators';

/**
 * Defines a class that represents an active connection to a channel.
 * Manages the login state for the channel.
 */
export class RealtimeChannelImpl implements RealtimeChannel, SubscriptionLike {
    private _connection: RealtimeChannelConnection;
    private _user: BehaviorSubject<User>;
    private _grants: BehaviorSubject<string>;
    private _status: Subject<StatusUpdate>;
    private _sub: Subscription;

    get connection() {
        return this._connection;
    }

    /**
     * The observable list of status updates from this channel.
     */
    get statusUpdated(): Observable<StatusUpdate> {
        return this._status;
    }

    get user() {
        return this._user.value;
    }

    constructor(connection: RealtimeChannelConnection, user?: User) {
        this._connection = connection;
        this._user = new BehaviorSubject<User>(user);
        this._grants = new BehaviorSubject<string>(null);
        this._status = new Subject<StatusUpdate>();
        this._sub = new Subscription();
    }

    connect() {
        this._sub.add(
            this._connection.connectionStateChanged
                .pipe(
                    combineLatest(
                        this.user ? this._user : this._user.pipe(skip(1)),
                        this._grants
                    ),
                    tap(([state, user, grant]) => {
                        this._connectionStateChanged(state, user, grant);
                    })
                )
                .subscribe()
        );
        this._sub.add(this._connection);
        this._connection.connect();
    }

    setGrant(grant: string) {
        this._grants.next(grant);
    }

    setUser(user: User) {
        this._user.next(user);
    }

    private async _connectionStateChanged(
        state: boolean,
        user: User,
        grant: string
    ) {
        this._status.next({
            type: 'connection',
            connected: state,
        });

        if (!state || !user) {
            this._status.next({
                type: 'authorization',
                authorized: false,
            });
            this._status.next({
                type: 'authentication',
                authenticated: false,
            });
            return;
        }

        if (!(await this._authenticate(user, grant))) {
            return;
        }

        if (!(await this._authorize())) {
            return;
        }
    }

    private async _authenticate(user: User, grant: string) {
        console.log('[RealtimeChannelImpl] Authenticating...');
        const loginResponse = await this._connection.login({
            ...user,
            grant,
        });

        if (!loginResponse.success) {
            if (loginResponse.error.type === 'not_authenticated') {
                this._status.next({
                    type: 'authentication',
                    authenticated: false,
                    reason: loginResponse.error.reason,
                });
            }
            return false;
        } else {
            console.log('[RealtimeChannelImpl] Authenticated!');
            this._status.next({
                type: 'authentication',
                authenticated: true,
                user: user,
                info: loginResponse.value,
            });
            return true;
        }
    }

    private async _authorize() {
        console.log('[RealtimeChannelImpl] Joining Channel...');
        const joinResponse = await this._connection.joinChannel();

        if (!joinResponse.success) {
            if (joinResponse.error.type === 'not_authorized') {
                this._status.next({
                    type: 'authorization',
                    authorized: false,
                    reason: joinResponse.error.reason,
                });
            }
            return false;
        } else {
            console.log('[RealtimeChannelImpl] Joined!');
            this._status.next({
                type: 'authorization',
                authorized: true,
            });
            return true;
        }
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}
