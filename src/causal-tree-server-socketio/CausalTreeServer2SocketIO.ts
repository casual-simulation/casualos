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
    withLatestFrom,
    groupBy,
} from 'rxjs/operators';
import mergeObj from 'lodash/merge';

// onConnection
// - onJoin()
//   - onAtom()
//     - broadcast
//

// device connected
// device disconnected
// join branch
// leave branch
// add atom to branch

export function processConnections(
    connections: Observable<Actor>,
    disconnections: Observable<Actor>
): Observable<ConnectionMessages> {
    return merge(
        connections.pipe(
            map(
                actor =>
                    <ActorConnected>{
                        type: 'actor_connected',
                        actor,
                    }
            )
        ),
        disconnections.pipe(
            map(
                actor =>
                    <ActorDisconnected>{
                        type: 'actor_disconnected',
                        actor,
                    }
            )
        )
    );
}

export function processBranches(
    actor: Actor,
    joins: Observable<string>,
    leaves: Observable<string>
): Observable<BranchMessages> {
    return merge(
        joins.pipe(
            map(
                branch =>
                    <JoinBranch>{
                        type: 'join_branch',
                        actor,
                        branch,
                    }
            )
        ),
        leaves.pipe(
            map(
                branch =>
                    <LeaveBranch>{
                        type: 'leave_branch',
                        actor,
                        branch,
                    }
            )
        )
    );
}

export type BranchesObservableFactory = (actor: Actor) => BranchesObservables;

export interface BranchesObservables {
    join: Observable<string>;
    leave: Observable<string>;
}

interface BranchesObservablesWithActor extends BranchesObservables {
    actor: Actor;
}

export function processActorBranches(
    connections: Observable<Actor>,
    disconnections: Observable<Actor>,
    factory: BranchesObservableFactory
): Observable<ConnectionMessages | BranchMessages> {
    const conn = processConnections(connections, disconnections).pipe(share());
    const branches = conn.pipe(
        groupBy(m => m.actor.id),
        flatMap(messagesById =>
            messagesById.pipe(
                calculateBranchObservables(factory),
                flatMap(observables =>
                    processBranches(
                        observables.actor,
                        observables.join,
                        observables.leave
                    )
                )
            )
        )
    );

    return merge(conn, branches);
}

function calculateBranchObservables(factory: BranchesObservableFactory) {
    return scan(
        (v, m: ConnectionMessages) => {
            if (v) {
                return v;
            }
            return {
                ...factory(m.actor),
                actor: m.actor,
            };
        },
        null as BranchesObservablesWithActor
    );
}

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
        // const conn = connections(this._socketServer);
        // const newSocketActors = conn.pipe(map(socketActor));
        // const removedSocketActors = newSocketActors.pipe(
        //     flatMap(a => disconnect(a.socket).pipe(map(_ => a)))
        // );
        // const newActors = newSocketActors;
        // const removedActors = removedSocketActors;
        // const actorEvents = merge(
        //     newActors.pipe(map(a => (<DeviceConnected>{
        //         type: 'device_connected',
        //         actor: a
        //     }))),
        //     removedActors.pipe(map(a => (<DeviceDisconnected>{
        //         type: "device_disconnected",
        //         actor: a
        //     })))
        // );
        // const joinEvents = newActors.pipe(
        //     flatMap(actor => actor.join.pipe(
        //         map(branch => (<JoinBranch>{
        //             type: 'join_branch',
        //             branch: branch,
        //             actor: actor
        //         })),
        //     )));
        // const leaveEvents = newActors.pipe(
        //     flatMap(actor => actor.leave.pipe(
        //         map(branch => (<LeaveBranch>{
        //             type: 'leave_branch',
        //             branch: branch,
        //             actor: actor
        //         }))
        //     ))
        // );
        // const branchMessages = joinEvents.pipe(
        //     flatMap(join => join.actor.messages(join.branch))
        // );
        // const allMessages = merge(
        //     actorEvents,
        //     joinEvents,
        //     leaveEvents,
        // );
        // const state = allMessages.pipe(
        //     scan(reducer, {
        //         actors: {}
        //     })
        // );
        // const branchEffects = branchMessages.pipe(
        //     withLatestFrom(state),
        //     map(([message, state]) => {
        //         if (message.type === 'atom') {
        //             return sendAtomToBranch(message.atom, message.branch);
        //         } else if (message.type === 'event') {
        //             // TODO:
        //         }
        //     })
        // );
        // const allBranches = newActors.pipe(
        //     flatMap(a => a.join.pipe(
        //         map(add),
        //         endWith(remove(a)),
        //     )),
        // )
        // const o = newActors.pipe(
        //     // For each new actor,
        //     // get the branches that it is joining
        //     flatMap(a =>
        //         a.join.pipe(
        //             // For each branch to join,
        //             // get the messages from that branch
        //             flatMap(branch =>
        //                 a.messages(branch).pipe(
        //                     // Take messages until a leave event happens
        //                     takeWhile(m => m.type !== 'leave')
        //                 )
        //             ),
        //             // Take branches until the actor disconnects
        //             takeUntil(a.disconnect)
        //         )
        //     )
        // );
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

// function reducer(state: ServerState, message: Messages): ServerState {
//     if (message.type === 'device_connected') {
//         return {
//             ...state,
//             [message.actor.id]: {
//                 branches: new Set()
//             }
//         };
//     } else if (message.type === 'device_disconnected') {
//         let { [message.actor.id]: actor, ...others } = state.actors;
//         return {
//             ...state,
//             actors: others
//         };
//     } else if (message.type === 'join_branch') {
//         let actor = state.actors[message.actor.id];

//         let branches = new Set([...actor.branches.values()]);
//         branches.add(message.branch);

//         return {
//             ...state,
//             actors: {
//                 ...state.actors,
//                 [message.actor.id]: {
//                     ...state.actors[message.actor.id],
//                     branches: branches
//                 }
//             }
//         };
//     } else if (message.type === 'leave_branch') {
//         let actor = state.actors[message.actor.id];

//         let branches = new Set([...actor.branches.values()]);
//         branches.delete(message.branch);

//         return {
//             ...state,
//             actors: {
//                 ...state.actors,
//                 [message.actor.id]: {
//                     ...state.actors[message.actor.id],
//                     branches: branches
//                 }
//             }
//         };
//     }

//     return state;
// }

interface ServerState {
    actors: {
        [actorId: string]: {
            branches: Set<string>;
        };
    };
}

type ServerConnection = DeviceConnection<DeviceExtras>;

interface DeviceExtras {
    socket: Socket;
}

type Messages = ConnectionMessages | JoinBranch | LeaveBranch;

export type BranchMessages = JoinBranch | LeaveBranch;

export type ConnectionMessages = ActorConnected | ActorDisconnected;

type BranchMessages = IncomingAtom | IncomingEvent;

type Effects = SendAtomToBranch;

interface SendAtomToBranch {
    type: 'send_atom_to_branch';
    branch: string;
    atom: Atom<any>;
}

export interface ActorConnected {
    type: 'actor_connected';
    actor: Actor;
}

export interface ActorDisconnected {
    type: 'actor_disconnected';
    actor: Actor;
}

interface JoinBranch {
    type: 'join_branch';
    branch: string;
    actor: Actor;
}

interface LeaveBranch {
    type: 'leave_branch';
    actor: Actor;
    branch: string;
}

interface IncomingAtom {
    type: 'atom';
    branch: string;
    actor: Actor;
    atom: Atom<any>;
}

interface IncomingEvent {
    type: 'event';
    branch: string;
    actor: Actor;
    event: RemoteAction;
}

export interface Actor {
    id: string;
    // join: Observable<string>;
    // leave: Observable<string>;
    // disconnect: Observable<any>;
    // messages: (branch: string) => Observable<BranchMessages>;
}

interface SocketActor extends Actor {
    socket: Socket;
}

const sendAtomToBranch = (atom: Atom<any>, branch: string) =>
    ({
        type: 'send_atom_to_branch',
        atom: atom,
        branch: branch,
    } as SendAtomToBranch);

// const socketActor: (socket: Socket) => SocketActor = (socket: Socket) => ({
//     id: socket.id,
//     join: joinBranchRequests(socket),
//     leave: leaveBranchRequests(socket),
//     disconnect: disconnect(socket),
//     messages: branch =>
//         merge(
//             incomingAtoms(socket, branch),
//             incomingEvents(socket, branch),
//         ),
//     socket,
// });

// connections
// join_branch
// (incoming_atom/outgoing_atom)/(incoming_event/outgoing_event)

const incomingAtoms = (socket: Socket, branch: string) =>
    socketAtoms(socket, branch).pipe(map(incomingAtom));
const incomingEvents = (socket: Socket, branch: string) =>
    socketEvents(socket, branch).pipe(map(incomingEvent));

const connections = (server: Server) =>
    fromEventPattern<Socket>(h => server.on('connection', h));

const disconnect = (socket: Socket) =>
    fromEventPattern(
        h => socket.on('disconnect', h),
        h => socket.off('disconnect', h)
    );

const joinBranchRequests = (socket: Socket) =>
    socketEvent<string>(socket, 'join_branch');
const leaveBranchRequests = (socket: Socket) =>
    socketEvent<string>(socket, `leave_branch`);

const socketAtoms = (socket: Socket, branch: string) =>
    socketEvent<Atom<any>>(socket, `atom_${branch}`);
const socketEvents = (socket: Socket, branch: string) =>
    socketEvent<RemoteAction>(socket, `event_${branch}`);

// const localAtoms = () => empty();
// const localEvents = () => empty();

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
