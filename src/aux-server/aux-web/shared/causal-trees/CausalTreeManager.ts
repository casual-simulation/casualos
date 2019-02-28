import io from 'socket.io-client';
import CausalTreeWorker from 'CausalTree.worker';
import { WorkerEvent, ValueCalculated } from './WorkerEvents';
import { SubscriptionLike, Subject, Observable } from 'rxjs';
import { first, map, filter, tap } from 'rxjs/operators';
import { AtomOp, RealtimeChannelInfo, PrecalculatedOp, RealtimeCausalTree, CausalTree, RealtimeChannel, WeaveReference, CausalTreeFactory, CausalTreeStore } from '@yeti-cgi/aux-common/causal-trees';
import { SocketIOConnection } from './SocketIOConnection';
import { auxCausalTreeFactory } from '@yeti-cgi/aux-common';
import { BrowserCausalTreeStore } from './BrowserCausalTreeStore';

/**
 * Defines a class that is able to help manage interactions with causal trees.
 */
export class CausalTreeManager implements SubscriptionLike {
    closed: boolean;
    private _worker: CausalTreeWorker;
    private _trees: TreeMap;
    private _events: Subject<MessageEvent>;
    private _socket: typeof io.Socket;
    private _factory: CausalTreeFactory;
    private _store: CausalTreeStore;

    /**
     * Creates a new Causal Tree Manager.
     * @param socket The socket.io connection that should be used.
     */
    constructor(socket: typeof io.Socket) {
        this._socket = socket;
        this._trees = {};
        this._factory = auxCausalTreeFactory();
        this._store = new BrowserCausalTreeStore();
        this._events = new Subject<MessageEvent>();
        this._worker = new CausalTreeWorker();
        this._worker.onmessage = (msg) => this._onMessage(msg);
        this._worker.onerror = (err) => this._onError(err);
        this.closed = false;
    }

    /**
     * Initializes the Causal Tree Manager.
     */
    async init(): Promise<void> {
        await this._store.init();
    }

    /**
     * Gets a realtime tree for the given channel info.
     * @param info The info that identifies the tree that should be retrieved or created.
     */
    async getTree<TTree extends CausalTree<AtomOp, any>>(info: RealtimeChannelInfo): Promise<RealtimeCausalTree<TTree>> {
        let realtime = <RealtimeCausalTree<TTree>>this._trees[info.id];
        if (!realtime) {
            let connection = new SocketIOConnection(this._socket);
            let channel = new RealtimeChannel<WeaveReference<AtomOp>>(info, connection);
            realtime = new RealtimeCausalTree<TTree>(this._factory, this._store, channel);
            this._trees[info.id] = realtime;
        }
        
        return realtime;
    }

    /**
     * Calculates the value for the given tree asynchronously.
     * This means it won't block the main thread and so won't cause the UI to stutter.
     * @param tree The tree.
     */
    async calculateTreeValue<T>(tree: RealtimeCausalTree<CausalTree<AtomOp, T>>): Promise<T> {
        const result = await this._request<ValueCalculated>({
            type: 'calculate',
            id: tree.id,
            treeType: tree.channel.info.type,
            weave: tree.tree.weave.atoms
        });

        return result.value;
    }

    unsubscribe(): void {
        if (!this.closed) {
            this._worker.terminate();
            this._events.unsubscribe();
            this.closed = true;
        }
    }

    private _onMessage(msg: MessageEvent) {
        this._events.next(msg);
    }

    private _onError(err: ErrorEvent) {
        this._events.error(err);
    }

    private _request<T>(event: WorkerEvent): Promise<T> {
        this._worker.postMessage(event);

        return this._events.pipe(
            first(m => m.data.type === event.type),
            map(m => <T>m.data)
        ).toPromise();
    }
}

interface TreeMap {
    [key: string]: RealtimeCausalTree<CausalTree<AtomOp, any>>;
}