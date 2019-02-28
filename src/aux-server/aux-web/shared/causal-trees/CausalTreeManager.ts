import CausalTreeWorker from 'CausalTree.worker';
import { SubscriptionLike } from 'rxjs';

/**
 * Defines a class that is able to help manage interactions with causal trees.
 */
export class CausalTreeManager implements SubscriptionLike {
    closed: boolean;
    private _worker: CausalTreeWorker;

    constructor() {
        this._worker = new CausalTreeWorker();
        this._worker.onmessage = (msg) => this._onMessage(msg);
        this._worker.onerror = (err) => this._onError(err);
        this.closed = false;
    }

    getAuxTree(id: string): Promise<void> {
        
    }

    unsubscribe(): void {
        if (!this.closed) {
            this._worker.terminate();
            this.closed = true;
        }
    }

    private _onMessage(msg: MessageEvent) {

    }

    private _onError(err: ErrorEvent) {

    }
}