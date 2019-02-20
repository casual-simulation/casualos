import { Subject, Observable, SubscriptionLike, never, ConnectableObservable, BehaviorSubject } from 'rxjs'
import { filter, map, first, tap, distinctUntilChanged, publish, refCount, flatMap, scan, pairwise, startWith, combineLatest } from 'rxjs/operators';
import { ChannelInfo } from '../ChannelInfo';
import { Event } from '../Event';
import { StateStore } from '../StateStore';
import { ChannelConnector, ChannelConnectionRequest, ChannelConnection, ChannelConnectionState, ChannelConnectionMode } from '../ChannelConnector';

interface EventWrapper {
    event: Event;
    isLocal: boolean;
}

/**
 * Defines an interface for objects which help setup a connection.
 */
export interface ConnectionHelper<T> {

    /**
     * Gets the connection that is being setup.
     */
    build: () => ChannelConnection<T>;

    /**
     * Sets an observable that resolves with an event whenever an event
     * is received from the server.
     */
    setServerEvents: (serverEvents: Observable<Event>) => void;

    /**
     * Sets the function that is used to emit events to the server.
     */
    setEmitToServerFunction: (emit: (event: Event) => void | Promise<void>) => void;

    /**
     * Sets the function that is used to emit events to the local store.
     */
    setEmitToStoreFunction: (emit: (event: Event) => void) => void;

    /**
     * Sets an observable that resolves with whether the server is currently reachable.
     */
    setConnectionStateObservable: (disconnected: Observable<boolean>) => void;

    /**
     * Sets the function that is used to get the current state from the server.
     */
    setGetRemoteServerStateFunction: (getServerState: () => Promise<T>) => void;
    
    /**
     * Sets the function that is used to save some state to locally
     * persistent storage. The saved state should be able to be retrieved via the
     * related getStateFunction.
     */
    setSaveStateFunction: (saveState: (key: string, state: T) => void) => void;

    /**
     * Sets the function that is used to retrieve some state from locally
     * persistent storage. If the given key exists, the function should return the value for
     * that key. Otherwise it should return undefined.
     */
    setGetStateFunction: (getState: (key: string) => T) => void;

    /**
     * The observable that is resolved a single time when 
     * the connection should be shut down.
     */
    onUnsubscribe: Observable<{}>;
}

interface PartialChannelConnectionState<T> {
    mode: string;
    promise: Promise<T>;
}

/**
 * Defines a base class for connectors.
 * This class helps create channel connections which behave correctly.
 */
export class BaseConnector implements ChannelConnector {

    connectToChannel<T>(connection_request: ChannelConnectionRequest<T>): Promise<ChannelConnection<T>> {
        throw new Error('Not implemented.');
    }

    /**
     * Creates a new channel connection which pipes events to the correct locations.
     * In particular, events emitted locally are sent to the server while events emitted from the server
     * are send locally. See emitToServer and emitFromServer.
     * @param connection_request
     */
    protected newConnection<T>(connection_request: ChannelConnectionRequest<T>): ConnectionHelper<T> {
        let subject = new Subject<EventWrapper>();
        let info = connection_request.info;
        let store = connection_request.store;
        let serverEvents: Observable<Event>;
        let connectionStates: Observable<boolean>;
        let onUnsubscribe: Subject<{}> = new Subject<{}>();
        let emitToServer: ((event: Event) => void | Promise<void>);
        let emitToStore: ((event: Event) => void);
        let saveState: ((key: string, state: T) => void);
        let getState: ((key: string) => T);
        let getServerState: (() => Promise<T>);
        let channelConnectionStates: BehaviorSubject<ChannelConnectionState<T>>;
        let reconnect: Subject<boolean> = new Subject<boolean>();
        let disconnectedSub: SubscriptionLike;
        let reconnectedSub: SubscriptionLike;
        
        // The most recent server state.
        let serverState: T = null;

        let build: () => ChannelConnection<T> = () => {
            let subs: SubscriptionLike[] = [];

            const canSave = saveState && getState;
            const localSaveKey = `${info.id}_local_state`;
            const serverSaveKey = `${info.id}_server_state`;

            const setServerState = (state: T) => {
                serverState = state;
                if (canSave) {
                    saveState(serverSaveKey, serverState);
                }
            };

            if (canSave) {
                serverState = getState(serverSaveKey);
                const localState = getState(localSaveKey);
                store.init(localState);
            }

            channelConnectionStates = new BehaviorSubject<ChannelConnectionState<T>>({
                mode: 'offline',
                lastKnownServerState: serverState
            });

            if (serverEvents) {   
                // Pipe the server events into the subject.
                subs.push(serverEvents.pipe(map(e => ({
                    event: e,
                    isLocal: false
                }))).subscribe(subject));
            }

            if (!emitToStore) {
                emitToStore = e => {
                    store.process(e);
                };
            }

            if (connectionStates) {
                if(!getServerState) {
                    throw new Error('If the connection state observable is provided then getServerState must be as well.');
                }

                // Channels go through three modes:
                // - offline: means not connected to the server.
                // - online-disconnected: means connected to server but not sending/receiving events.
                // - online: means connected to server and sending/receiving events.

                let distinct = connectionStates.pipe(
                    startWith(false),
                    distinctUntilChanged(),
                );

                const partialConnectionState = (mode: ChannelConnectionMode, state: T): PartialChannelConnectionState<T> => {
                    return {
                        mode: mode,
                        promise: <any>[state]
                    };
                };
                
                const onlineDisconnectedConnectionState = (): PartialChannelConnectionState<T> => {
                    return {
                        mode: 'online-disconnected',
                        promise: getServerState()
                    };
                };

                const connectionStatesObservable = distinct.pipe(
                    combineLatest(reconnect, (connected, reconnect) => ({connected, reconnect})),
                    scan((curr: PartialChannelConnectionState<T>, next: {connected: boolean, reconnect: boolean}, index: number) => {
                        if (!next.connected && (curr.mode === 'online' || curr.mode === 'online-disconnected')) {
                            return partialConnectionState('offline', serverState);
                        } else if(next.connected && (curr.mode === 'offline')) {
                            return onlineDisconnectedConnectionState();
                        } else if(next.reconnect && (curr.mode === 'online-disconnected')) {
                            return partialConnectionState('online', serverState);
                        }
                        return curr;
                    }, partialConnectionState('offline', serverState)),
                    flatMap(next => next.promise, (next, state) => ({ mode:next.mode, lastKnownServerState: state})),
                    tap(state => setServerState(state.lastKnownServerState)),
                    publish(),
                    refCount(),
                );
                subs.push(connectionStatesObservable.subscribe(v => channelConnectionStates.next(v), ex => console.error(ex)));
                reconnect.next(false);
            }

            subs.push(subject.pipe(
                    tap(e => {
                        emitToStore(e.event);
                        const mostRecentState = store.state();
                        if (canSave) {
                            saveState(localSaveKey, mostRecentState);
                        }
                        if (emitToServer) {
                            if (e.isLocal && channelConnectionStates.value.mode === 'online') {
                                const p = emitToServer(e.event);
                                if (p && typeof p.then === 'function') {
                                    p.then(() => {
                                        setServerState(mostRecentState);
                                    }, ex => console.error(ex));
                                } else {
                                    setServerState(mostRecentState);
                                }
                            } else if (!e.isLocal) {
                                setServerState(mostRecentState);
                            }
                        }
                    }), 
                ).subscribe());

            return <ChannelConnection<T>>{
                emit: (event) => {
                    subject.next({
                        event,
                        isLocal: true
                    });
                },
                events: subject.pipe(map(e => e.event)),
                store: connection_request.store,
                info: connection_request.info,
                connectionStates: channelConnectionStates,
                reconnect: () => {
                    if (channelConnectionStates.value.mode === 'online-disconnected') {
                        reconnect.next(true);
                        reconnect.next(false);
                    }
                },
                unsubscribe: () => {
                    if (reconnectedSub) {
                        reconnectedSub.unsubscribe();
                    }
                    if (disconnectedSub) {
                        disconnectedSub.unsubscribe();
                    }
                    subs.forEach(s => s.unsubscribe());
                    subject.complete();
                    subject.unsubscribe();
                    onUnsubscribe.next({});
                    onUnsubscribe.complete();
                },

                get state() {
                    return channelConnectionStates.value.mode;
                }
            }
        };

        let helper: ConnectionHelper<T> = {
            build: build,
            setConnectionStateObservable: (states) => {
                connectionStates = states;
            },
            setServerEvents: (events) => {
                serverEvents = events;
            },
            setEmitToServerFunction: (fn) => {
                emitToServer = fn;
            },
            setEmitToStoreFunction: (fn) => {
                emitToStore = fn;
            },
            setGetRemoteServerStateFunction: (fn) => {
                getServerState = fn;
            },
            setSaveStateFunction: (fn) => {
                saveState = fn;
            },
            setGetStateFunction: (fn) => {
                getState = fn;
            },
            onUnsubscribe: onUnsubscribe.pipe(first()),
        };

        return helper;
    }
}