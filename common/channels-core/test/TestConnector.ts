import { ChannelConnector, ChannelConnectionRequest, ChannelConnection } from '../ChannelConnector';
import { Subject, Observable } from 'rxjs';
import { Event } from '../Event';
import { BaseConnector } from '../builtin/BaseConnector';

export class TestConnector extends BaseConnector {

    private _events: Subject<any>;
    private _emitted: Subject<Event>;
    private _initial_state: any;

    constructor(initialState: any, events: Subject<any>) {
        super();
        this._events = events;
        this._initial_state = initialState;
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
            resolve(helper.build());
        });
    }
}