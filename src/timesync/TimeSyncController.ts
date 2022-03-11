import { TimeSyncConnection } from './TimeSyncConnection';
import { SubscriptionLike, Subscription, Subject, Observable } from 'rxjs';
import { TimeSync } from './TimeSync';

/**
 * The number of miliseconds between sync queries when the controller is trying to sync quickly.
 */
export const INTERVAL_BETWEEN_EARLY_QUERIES = 1000;

/**
 * The number of miliseconds between sync queries when the controller has had a fair opportinity to sync.
 */
export const INTERVAL_BETWEEN_SYNCED_QUERIES = 30000;

/**
 * Defines a class that can automatically produce time sync estimates based on the server time when given a connnection to the server.
 */
export class TimeSyncController implements SubscriptionLike {
    private _connection: TimeSyncConnection;
    private _initialized: boolean = false;
    private _sub: Subscription;
    private _sync: TimeSync;
    private _syncUpdated: Subject<void>;
    private _interval: number | any;

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
        this._scheduleQuery();

        this._sub.add(() => {
            clearTimeout(this._interval);
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
        this._scheduleQuery();
    }

    private _scheduleQuery() {
        if (this._sync.numTotalSamples >= 15) {
            this._interval = setTimeout(() => {
                this._query();
            }, INTERVAL_BETWEEN_SYNCED_QUERIES);
        } else {
            this._interval = setTimeout(() => {
                this._query();
            }, INTERVAL_BETWEEN_EARLY_QUERIES);
        }
    }
}
