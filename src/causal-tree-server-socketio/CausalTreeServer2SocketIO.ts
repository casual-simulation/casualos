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
    scan,
    share,
    endWith,
    skipWhile,
    take,
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
        const conn = connections(this._socketServer);
        const newSocketActors = conn.pipe(map(socketActor));
        const removedSocketActors = newSocketActors.pipe(
            flatMap(a => disconnect(a.socket).pipe(map(_ => a)))
        );

        const newActors = newSocketActors;
        const removedActors = removedSocketActors;

        const actorEvents = merge(
            newActors.pipe(map(add)),
            removedActors.pipe(map(remove))
        );

        const allActors = actorEvents.pipe(
            scan(intoMap(a => a.id), new Map<string, SocketActor>()),
            share()
        );

        const allJoins = newActors.pipe(
            flatMap(a => a.join, (actor, branch) => [actor, branch] as const)
        );

        const allLeaves = allJoins.pipe(
            flatMap(([actor, branch]) =>
                actor.messages(branch).pipe(
                    skipWhile(m => m.type !== 'leave'),
                    map(m => [actor, branch] as const),
                    take(1)
                )
            )
        );

        const branchEvents = merge(
            allJoins.pipe(map(add)),
            allLeaves.pipe(map(remove))
        );

        const allBranches = branchEvents.pipe(
            scan(
                intoMap(([a, b]) => b),
                new Map<string, [SocketActor, string]>()
            )
        );

        const allMessages = allJoins.pipe(
            flatMap(([actor, branch]) =>
                actor.messages(branch).pipe(takeWhile(m => m.type !== 'leave'))
            )
        );

        // const allBranches = newActors.pipe(
        //     flatMap(a => a.join.pipe(
        //         map(add),
        //         endWith(remove(a)),
        //     )),
        // )

        const o = newActors.pipe(
            // For each new actor,
            // get the branches that it is joining
            flatMap(a =>
                a.join.pipe(
                    // For each branch to join,
                    // get the messages from that branch
                    flatMap(branch =>
                        a.messages(branch).pipe(
                            // Take messages until a leave event happens
                            takeWhile(m => m.type !== 'leave')
                        )
                    ),

                    // Take branches until the actor disconnects
                    takeUntil(a.disconnect)
                )
            )
        );

        // const o = allActors.pipe(
        //     flatMap(a => a.join.pipe(
        //         flatMap(branch =>
        //             a.messages(branch)
        //         ),

        //         tap(m => {

        //         }),

        //         takeWhile(m => m.type !== 'leave'),
        //     )
        // ));
        // const observable = connections(this._socketServer).pipe(
        //     flatMap(socket =>
        //         // For each socket connection,
        //         // listen for join_branch requests
        //         .pipe(
        //             flatMap(branch =>
        //                 // For each branch request, load the branch
        //                 // from the store.
        //                 loadBranchFromStore(
        //                     this._branches,
        //                     this._store,
        //                     branch
        //                 ).pipe(
        //                     switchMap(repo =>
        //                         // When we get a repo,
        //                         // listen for incoming atoms.
        //                         merge(

        //                         )
        //                     ),

        //                     // When we get a leave_branch request,
        //                     // cancel the subscription.
        //                     takeWhile(e => e.type !== 'leave_branch'),

        //                     tap(e => {
        //                         if (e.type === 'incoming_atom') {
        //                             // Add atom
        //                         } else if (e.type === 'incoming_event') {
        //                             // issue remote event
        //                         }
        //                     })
        //                 )
        //             )
        //         )
        //     )
        // );
    }
}

type ServerConnection = DeviceConnection<DeviceExtras>;

interface DeviceExtras {
    socket: Socket;
}

type Messages = IncomingAtom | IncomingEvent | LeaveEvent;

interface IncomingAtom {
    type: 'atom';
    atom: Atom<any>;
}

interface IncomingEvent {
    type: 'event';
    event: RemoteAction;
}

interface LeaveEvent {
    type: 'leave';
}

interface Actor {
    id: string;
    join: Observable<string>;
    disconnect: Observable<any>;
    messages: (branch: string) => Observable<Messages>;
}

interface SocketActor extends Actor {
    socket: Socket;
}

const socketActor: (socket: Socket) => SocketActor = (socket: Socket) => ({
    id: socket.id,
    join: joinBranchRequests(socket),
    disconnect: disconnect(socket),
    messages: branch =>
        merge(
            incomingAtoms(socket, branch),
            incomingEvents(socket, branch),
            leaveBranch(socket, branch)
        ),
    socket,
});

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
            type: 'leave' as const,
            branch: branch,
        }))
    );

const connections = (server: Server) =>
    fromEventPattern<Socket>(h => server.on('connection', h));

const disconnect = (socket: Socket) =>
    fromEventPattern(
        h => socket.on('disconnect', h),
        h => socket.off('disconnect', h)
    );

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
    type: 'atom' as const,
    atom: atom,
});

const outgoingAtom = (atom: Atom<any>) => ({
    type: 'outgoing_atom' as const,
    atom: atom,
});

const incomingEvent = (event: RemoteAction) => ({
    type: 'event' as const,
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

function add<T>(item: T): AddToList<T> {
    return {
        type: 'add',
        item,
    };
}

function remove<T>(item: T): RemoveFromList<T> {
    return {
        type: 'remove',
        item,
    };
}

type ListMessage<T> = AddToList<T> | RemoveFromList<T>;

interface AddToList<T> {
    type: 'add';
    item: T;
}

interface RemoveFromList<T> {
    type: 'remove';
    item: T;
}

function intoList<R, T extends ListMessage<R>>(
    list: R[],
    message: T,
    index: number
): R[] {
    if (message.type === 'add') {
        return [...list, message.item];
    } else {
        const index = list.indexOf(message.item);
        if (index >= 0) {
            const newList = list.slice();
            return newList.splice(index, 1);
        }
        return list;
    }
}

function intoMap<RKey, R, T extends ListMessage<R>>(keyFunc: (val: R) => RKey) {
    return (map: Map<RKey, R>, message: T, index: number) =>
        intoMapFull(keyFunc, map, message, index);
}

function intoMapFull<RKey, R, T extends ListMessage<R>>(
    keyFunc: (val: R) => RKey,
    map: Map<RKey, R>,
    message: T,
    index: number
): Map<RKey, R> {
    const key = keyFunc(message.item);
    if (message.type === 'add') {
        map.set(key, message.item);
    } else {
        map.delete(key);
    }
    return map;
}
