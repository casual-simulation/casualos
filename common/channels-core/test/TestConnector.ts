import { ChannelConnector, ChannelConnectionRequest, ChannelConnection } from '../ChannelConnector';
import { Subject, Observable } from 'rxjs';
import { Event } from '../Event';
import { BaseConnector } from '../builtin/BaseConnector';

export class TestConnector extends BaseConnector {

    private _events: Subject<any>;
    private _eventsToServer: Subject<any>;
    private _connection: Subject<boolean>;
    private _emitted: Subject<Event>;
    private _getSeverState: () => Promise<any>;
    private _initial_state: any;

    emitToServerPromise: Promise<void>;

    constructor(initialState: any, events: Subject<any>, connection?: Subject<boolean>, eventsToServer?: Subject<any>, getServerState?: () => Promise<any>) {
        super();
        this._events = events;
        this._initial_state = initialState;
        this._connection = connection;
        this._eventsToServer = eventsToServer;
        this._getSeverState = getServerState;
        this._emitted = new Subject<Event>();
    }

    emitted(): Subject<Event> {
        return this._emitted;
    }

    connectToChannel<T>(connection_request: ChannelConnectionRequest<T>): Promise<ChannelConnection<T>> {
        return new Promise<ChannelConnection<T>>((resolve, reject) => {
            connection_request.store.init(this._initial_state);
            let helper = this.newConnection(connection_request);
            helper.setServerEvents(this._events);
            helper.setConnectionStateObservable(this._connection);
            if (this._eventsToServer) {
                helper.setEmitToServerFunction(e => {
                    this._eventsToServer.next(e);
                    return this.emitToServerPromise;
                });
            }
            if (this._getSeverState) {
                helper.setGetServerStateFunction(this._getSeverState);
            }
            resolve(helper.build());
        });
    }
}