import { TimeSyncConnection } from './TimeSyncConnection';
import { SubscriptionLike, Subscription, Subject, Observable } from 'rxjs';
import { TimeSync } from './TimeSync';

/**
 * The number of miliseconds between sync queries.
 */
export const INTERVAL_BETWEEN_QUERIES = 1000;

/**
 * Defines a class that can automatically produce time sync estimates based on the server time when given a connnection to the server.
 */
export class TimeSyncController implements SubscriptionLike {
    private _connection: TimeSyncConnection;
    private _initialized: boolean = false;
    private _sub: Subscription;
    private _sync: TimeSync;
    private _syncUpdated: Subject<void>;

    get initialized() {
        return this._initialized;
    }

    get sync() {
        return this._sync;
    }

    get closed() {
        return this._sub.closed;
    }

    get syncUpdated(): Observable<void> {
        return this._syncUpdated;
    }

    constructor(connection: TimeSyncConnection) {
        this._connection = connection;
        this._sync = new TimeSync();
        this._sub = new Subscription();
        this._sub.add(connection);
        this._syncUpdated = new Subject();
    }

    init() {
        this._initialized = true;
        const interval = setInterval(() => {
            this._query();
        }, INTERVAL_BETWEEN_QUERIES);

        this._sub.add(() => {
            clearInterval(interval);
        });
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    private async _query() {
        const sample = await this._connection.sampleServerTime();
        if (this.closed) {
            return;
        }
        this._sync.addSample(sample);
        this._syncUpdated.next();
    }
}
