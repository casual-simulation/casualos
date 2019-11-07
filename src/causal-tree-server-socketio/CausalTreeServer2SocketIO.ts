import { DeviceInfo, RemoteAction } from '@casual-simulation/causal-trees';
import { Socket, Server } from 'socket.io';
import { DeviceManager } from '@casual-simulation/causal-tree-server/DeviceManager';
import { DeviceManagerImpl } from '@casual-simulation/causal-tree-server/DeviceManagerImpl';
import { DeviceConnection } from '@casual-simulation/causal-tree-server';
import {
    CausalRepoStore,
    CausalRepo,
    CausalRepoBranch,
    Atom,
} from '@casual-simulation/causal-trees/core2';
import { fromEventPattern, Observable, merge, Observer } from 'rxjs';
import {
    flatMap,
    map,
    takeUntil,
    startWith,
    shareReplay,
    tap,
    switchMap,
    takeWhile,
} from 'rxjs/operators';
import { empty } from '@hapi/joi';

// onConnection
// - onJoin()
//   - onAtom()
//     - broadcast
//

// connections
// join
// atom/leave

//

/**
 * Defines a class that is able to serve
 */
export class CausalTreeServer2SocketIO {
    private _socketServer: Server;
    private _deviceManager: DeviceManager;
    private _store: CausalRepoStore;

    private _branches: Map<string, Observable<CausalRepo>>;

    constructor(socketServer: Server, store: CausalRepoStore) {
        this._socketServer = socketServer;
        this._store = store;
        this._deviceManager = new DeviceManagerImpl();
    }

    init() {
        this._setupServer();
    }

    private _setupServer() {
        const observable = connections(this._socketServer).pipe(
            flatMap(socket =>
                // For each socket connection,
                // listen for join_branch requests
                joinBranchRequests(socket).pipe(
                    flatMap(branch =>
                        // For each branch request, load the branch
                        // from the store.
                        loadBranchFromStore(
                            this._branches,
                            this._store,
                            branch
                        ).pipe(
                            switchMap(repo =>
                                // When we get a repo,
                                // listen for incoming atoms.
                                merge(
                                    incomingAtoms(socket, branch),
                                    incomingEvents(socket, branch),
                                    leaveBranch(socket, branch)
                                )
                            ),

                            // When we get a leave_branch request,
                            // cancel the subscription.
                            takeWhile(e => e.type !== 'leave_branch'),

                            tap(e => {
                                if (e.type === 'incoming_atom') {
                                    // Add atom
                                } else if (e.type === 'incoming_event') {
                                    // issue remote event
                                }
                            })
                        )
                    )
                )
            )
        );
    }
}

type ServerConnection = DeviceConnection<DeviceExtras>;

interface DeviceExtras {
    socket: Socket;
}

// connections
// join_branch
// (incoming_atom/outgoing_atom)/(incoming_event/outgoing_event)

const incomingAtoms = (socket: Socket, branch: string) =>
    socketAtoms(socket, branch).pipe(map(incomingAtom));
const incomingEvents = (socket: Socket, branch: string) =>
    socketEvents(socket, branch).pipe(map(incomingEvent));
const leaveBranch = (socket: Socket, branch: string) =>
    leaveBranchRequests(socket, branch).pipe(
        map(_ => ({
            type: 'leave_branch' as const,
            branch: branch,
        }))
    );

const connections = (server: Server) =>
    fromEventPattern<Socket>(h => server.on('connection', h));
const joinBranchRequests = (socket: Socket) =>
    socketEvent<string>(socket, 'join_branch');
const leaveBranchRequests = (socket: Socket, branch: string) =>
    socketEvent<any>(socket, `leave_${branch}`);

const socketAtoms = (socket: Socket, branch: string) =>
    socketEvent<Atom<any>>(socket, `atom_${branch}`);
const socketEvents = (socket: Socket, branch: string) =>
    socketEvent<RemoteAction>(socket, `event_${branch}`);

const localAtoms = () => empty();
const localEvents = () => empty();

const incomingAtom = (atom: Atom<any>) => ({
    type: 'incoming_atom' as const,
    atom: atom,
});

const outgoingAtom = (atom: Atom<any>) => ({
    type: 'outgoing_atom' as const,
    atom: atom,
});

const incomingEvent = (event: RemoteAction) => ({
    type: 'incoming_event' as const,
    event: event,
});

const outgoingEvent = (event: RemoteAction) => ({
    type: 'outgoing_event' as const,
    event: event,
});

function socketEvent<T>(socket: Socket, event: string) {
    return fromEventPattern<T>(
        h => socket.on(event, h),
        h => socket.off(event, h)
    );
}

// function

function loadBranchFromStore(
    map: Map<string, Observable<CausalRepo>>,
    store: CausalRepoStore,
    branch: string
) {
    let repo = map.get(branch);
    if (!repo) {
        repo = loadSharedBranch(store, branch);
        map.set(branch, repo);
    }

    return repo;
}

function loadSharedBranch(store: CausalRepoStore, branch: string) {
    return loadBranch(store, branch).pipe(shareReplay(1));
}

function loadBranch(store: CausalRepoStore, branch: string) {
    return Observable.create((o: Observer<CausalRepo>) => {
        let repo: CausalRepo = new CausalRepo(store);

        repo.checkout(branch).then(() => {
            o.next(repo);
        });
    });
}

interface IncomingAtom {
    type: 'incoming_atom';
    atom: Atom<any>;
}

interface OutgoingAtom {
    type: 'outgoing_atom';
    atom: Atom<any>;
}
