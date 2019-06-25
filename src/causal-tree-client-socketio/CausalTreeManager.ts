import io from 'socket.io-client';
import { SubscriptionLike, Subject, Observable } from 'rxjs';
import {
    AtomOp,
    RealtimeChannelInfo,
    PrecalculatedOp,
    RealtimeCausalTree,
    CausalTree,
    RealtimeChannel,
    CausalTreeFactory,
    CausalTreeStore,
    Atom,
    CausalTreeOptions,
    RealtimeCausalTreeOptions,
} from '@casual-simulation/causal-trees';
import { SocketIOConnection } from './SocketIOConnection';
import { BrowserCausalTreeStore } from '@casual-simulation/causal-tree-store-browser';
import { AtomValidator } from '@casual-simulation/causal-trees';
import { SigningCryptoImpl } from '@casual-simulation/crypto';
import { BrowserSigningCryptoImpl } from '@casual-simulation/crypto-browser';

/**
 * Defines a class that is able to help manage interactions with causal trees.
 */
export class CausalTreeManager implements SubscriptionLike {
    closed: boolean;
    // private _worker: Worker;
    private _trees: TreeMap;
    private _events: Subject<MessageEvent>;
    private _socket: typeof io.Socket;
    private _factory: CausalTreeFactory;
    private _store: CausalTreeStore;
    private _initialized: boolean;
    private _crypto: SigningCryptoImpl;

    get factory(): CausalTreeFactory {
        return this._factory;
    }

    /**
     * Creates a new Causal Tree Manager.
     * @param socket The socket.io connection that should be used.
     * @param factory The factory to use for new causal trees.
     */
    constructor(
        socket: typeof io.Socket,
        factory: CausalTreeFactory,
        store?: CausalTreeStore
    ) {
        this._socket = socket;
        this._trees = {};
        this._initialized = false;
        this._factory = factory;
        this._store = store || new BrowserCausalTreeStore();
        this._events = new Subject<MessageEvent>();
        this._crypto = new BrowserSigningCryptoImpl('ECDSA-SHA256-NISTP256');
        this.closed = false;
    }

    /**
     * Initializes the Causal Tree Manager.
     */
    async init(): Promise<void> {
        if (this._initialized) {
            return;
        }
        this._initialized = true;
        await this._store.init();
    }

    /**
     * Gets a realtime tree for the given channel info.
     * The returned tree needs to be initialized.
     * @param info The info that identifies the tree that should be retrieved or created.
     * @param options The options that should be used for the tree.
     */
    async getTree<TTree extends CausalTree<AtomOp, any, any>>(
        info: RealtimeChannelInfo,
        options: RealtimeCausalTreeOptions = {}
    ): Promise<RealtimeCausalTree<TTree>> {
        let realtime = <RealtimeCausalTree<TTree>>this._trees[info.id];
        if (!realtime) {
            let connection = new SocketIOConnection(this._socket);
            let channel = new RealtimeChannel<Atom<AtomOp>[]>(info, connection);
            let validator = new AtomValidator(this._crypto);
            realtime = new RealtimeCausalTree<TTree>(
                this._factory,
                this._store,
                channel,
                {
                    validator: validator,
                    storeAtoms: true,
                    ...options,
                }
            );
            this._trees[info.id] = realtime;
        }

        return realtime;
    }

    /**
     * Forks the given realtime causal tree into a new channel.
     * The new channel will contain the exact same tree as the one given but will be served over the given ID.
     * @param tree The tree to fork.
     * @param newId The ID of the channel that should be used for the fork.
     */
    async forkTree<TTree extends CausalTree<AtomOp, any, any>>(
        realtime: RealtimeCausalTree<TTree>,
        newId: string
    ): Promise<RealtimeCausalTree<TTree>> {
        let oldTree = <RealtimeCausalTree<TTree>>this._trees[newId];
        if (oldTree) {
            throw new Error('The given channel ID already exists.');
        }

        const info: RealtimeChannelInfo = {
            type: realtime.channel.info.type,
            id: newId,
            bare: true,
        };

        let newTree = await realtime.tree.fork();
        // await this._store.put(newId, realtime.tree.export());

        let connection = new SocketIOConnection(this._socket);
        let channel = new RealtimeChannel<Atom<AtomOp>[]>(info, connection);
        let newRealtime = new RealtimeCausalTree<TTree>(
            this._factory,
            this._store,
            channel,
            {
                tree: newTree,
            }
        );
        // newRealtime.storeArchivedAtoms = true;
        this._trees[info.id] = newRealtime;

        await newRealtime.init();
        await newRealtime.waitForUpdateFromServer();

        return newRealtime;
    }

    unsubscribe(): void {
        if (!this.closed) {
            // this._worker.terminate();
            this._events.unsubscribe();
            this.closed = true;
        }
    }
}

interface TreeMap {
    [key: string]: RealtimeCausalTree<CausalTree<AtomOp, any, any>>;
}
