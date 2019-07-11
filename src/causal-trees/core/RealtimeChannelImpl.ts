import { StatusUpdate } from './StatusUpdate';
import { Observable, Subject, SubscriptionLike, Subscription } from 'rxjs';
import { RealtimeChannelConnection } from './RealtimeChannelConnection';
import { RealtimeChannel } from './RealtimeChannel';

/**
 * Defines a class that represents an active connection to a channel.
 * Manages the login state for the channel.
 */
export class RealtimeChannelImpl implements RealtimeChannel, SubscriptionLike {
    private _connection: RealtimeChannelConnection;
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

    constructor(connection: RealtimeChannelConnection) {
        this._connection = connection;
        this._status = new Subject<StatusUpdate>();
        this._sub = new Subscription();
    }

    connect() {
        this._sub.add(
            this._connection.connectionStateChanged.subscribe(state =>
                this._connectionStateChanged(state)
            )
        );
    }

    private async _connectionStateChanged(state: boolean) {
        this._status.next({
            type: 'connection',
            connected: state,
        });

        if (!state) {
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

        if (!(await this._authenticate())) {
            return;
        }

        if (!(await this._authorize())) {
            return;
        }
    }

    private async _authenticate() {
        const loginResponse = await this._connection.login();

        if (!loginResponse.success) {
            return false;
        } else {
            this._status.next({
                type: 'authentication',
                authenticated: true,
            });
            return true;
        }
    }

    private async _authorize() {
        const joinResponse = await this._connection.joinChannel();

        if (!joinResponse.success) {
            return false;
        } else {
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
