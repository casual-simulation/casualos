import { StatusUpdate } from '@casual-simulation/causal-trees';
import { AuxUser } from '../AuxUser';
import { Observable, Subject, Subscription, SubscriptionLike } from 'rxjs';

/**
 * Defines a class that helps manage status updates from multiple sources.
 */
export class StatusHelper implements SubscriptionLike {
    private _sentConnection: boolean = false;
    private _connection = new Map<number, boolean>();
    private _sentSync: boolean = false;
    private _sync = new Map<number, boolean>();
    private _sentInit: boolean = false;
    private _init = new Map<number, boolean>();
    private _progress = new Map<number, number>();
    private _updates = new Subject<StatusUpdate>();
    private _sub: Subscription;

    /**
     * The user that should be included in authenticated results
     * if one is not included.
     */
    defaultUser: AuxUser;

    get updates(): Observable<StatusUpdate> {
        return this._updates;
    }

    constructor(observables: Observable<StatusUpdate>[]) {
        this._sub = new Subscription();

        for (let i = 0; i < observables.length; i++) {
            const observable = observables[i];

            this._progress.set(i, 0);
            this._sync.set(i, false);
            this._connection.set(i, false);
            this._init.set(i, false);
            this._sub.add(
                observable.subscribe((update) => this._process(update, i))
            );
        }
    }

    private _process(update: StatusUpdate, channelId: number) {
        if (update.type === 'progress') {
            if (update.done) {
                this._progress.set(channelId, Infinity);
            } else {
                this._progress.set(channelId, update.progress);
            }

            this._updates.next({
                ...update,
                type: 'progress',
                done: this._progressDone(),
                progress: this._progressPercent(),
            });
        } else if (update.type === 'sync') {
            const wasSynced = this._synced();
            this._sync.set(channelId, update.synced);
            const nowSynced = this._synced();

            if (wasSynced !== nowSynced || !this._sentSync) {
                this._sentSync = true;
                this._updates.next({
                    type: 'sync',
                    synced: nowSynced,
                });
            }
        } else if (update.type === 'connection') {
            const wasConnected = this._connected();
            this._connection.set(channelId, update.connected);
            const nowConnected = this._connected();

            if (wasConnected !== nowConnected || !this._sentConnection) {
                this._sentConnection = true;
                this._updates.next({
                    type: 'connection',
                    connected: nowConnected,
                });
            }
        } else if (update.type === 'init') {
            this._init.set(channelId, true);

            if (this._initalized()) {
                if (!this._sentInit) {
                    this._sentInit = true;
                    this._updates.next({
                        type: 'init',
                    });
                }
            }
        } else if (update.type === 'authentication') {
            if (channelId === 0) {
                let result = { ...update };
                if (!result.user && this.defaultUser) {
                    result.user = this.defaultUser;
                }
                this._updates.next(result);
            }
        } else if (update.type === 'authorization') {
            if (channelId === 0) {
                this._updates.next(update);
            }
        } else {
            this._updates.next(update);
        }
    }

    private _progressDone() {
        for (let [id, progress] of this._progress) {
            if (progress !== Infinity) {
                return false;
            }
        }
        return true;
    }

    private _progressPercent() {
        let total = 0;
        for (let [id, progress] of this._progress) {
            if (progress === Infinity) {
                total += 1;
            } else {
                total += progress;
            }
        }

        return total / this._progress.size;
    }

    private _synced() {
        for (let [id, sync] of this._sync) {
            if (!sync) {
                return false;
            }
        }

        return true;
    }

    private _connected() {
        for (let [id, connected] of this._connection) {
            if (!connected) {
                return false;
            }
        }

        return true;
    }

    private _initalized() {
        for (let [id, init] of this._init) {
            if (!init) {
                return false;
            }
        }

        return true;
    }

    unsubscribe(): void {
        return this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}
