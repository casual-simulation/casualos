import { Subject, Observable, SubscriptionLike } from 'rxjs'
import { filter, map, first, tap } from 'rxjs/operators';
import { ChannelInfo } from '../Channel';
import { Event } from '../Event';
import { StateStore } from '../StateStore';
import { ChannelConnector, ChannelConnectionRequest, ChannelConnection } from '../ChannelConnector';

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
    setEmitToServerFunction: (emit: (event: Event) => void) => void;

    /**
     * Sets the function that is used to emit events to the local store.
     */
    setEmitToStoreFunction: (emit: (event: Event) => void) => void;
    
    /**
     * The observable that is resolved a single time when 
     * the connection should be shut down.
     */
    onUnsubscribe: Observable<{}>;
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
        let onUnsubscribe: Subject<{}> = new Subject<{}>();
        let emitToServer: ((event: Event) => void);
        let emitToStore: ((event: Event) => void);

        let build: () => ChannelConnection<T> = () => {
            let subs: SubscriptionLike[] = [];
            if (serverEvents) {   
                // Pipe the server events into the subject.
                subs.push(serverEvents.pipe(map(e => ({
                    event: e,
                    isLocal: false
                }))).subscribe(subject));
            }

            if (emitToServer != null) {
                subs.push(subject.pipe(
                     filter(e => e.isLocal),
                     map(e => e.event),
                     tap(e => emitToServer(e))
                ).subscribe());
            }

            if (!emitToStore) {
                emitToStore = e => {
                    store.process(e);
                };
            }
            
            subs.push(subject.pipe(
                    map(e => e.event),
                    tap(emitToStore)
                ).subscribe());

            return {
                emit: (event) => {
                    subject.next({
                        event,
                        isLocal: true
                    });
                },
                events: subject.pipe(map(e => e.event)),
                store: connection_request.store,
                info: connection_request.info,
                unsubscribe: () => {
                    subs.forEach(s => s.unsubscribe());
                    subject.complete();
                    subject.unsubscribe();
                    onUnsubscribe.next({});
                    onUnsubscribe.complete();
                }
            }
        };

        let helper: ConnectionHelper<T> = {
            build: build,
            setServerEvents: (events) => {
                serverEvents = events;
            },
            setEmitToServerFunction: (fn) => {
                emitToServer = fn;
            },
            setEmitToStoreFunction: (fn) => {
                emitToStore = fn;
            },
            onUnsubscribe: onUnsubscribe.pipe(first())
        };

        return helper;
    }
}