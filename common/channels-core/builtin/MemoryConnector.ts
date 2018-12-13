
import { ChannelConnector, ChannelConnection, ChannelConnectionRequest } from '../ChannelConnector';
import { IChannel } from '../Channel';
import { Subject } from 'rxjs';
import { Event } from '../Event';
import { BaseConnector, ConnectionHelper } from './BaseConnector';

interface ChannelList {
    [key: string]: ChannelConnection<any>;
}

/**
 * Defines a channel connector which is able to pipe events through memory to other channels.
 * Sometimes useful for servers.
 */
export class MemoryConnector extends BaseConnector {

    private _channels: ChannelList;

    constructor() {
        super();
        this._channels = {};
    }

    connectToChannel<T>(connection_request: ChannelConnectionRequest<T>): Promise<ChannelConnection<T>> {
        if(this._channels[connection_request.info.id]) {
            return Promise.resolve(this._channels[connection_request.info.id]);
        } else {
            return this._createNewConnection(connection_request);
        }
    }

    protected async _createNewConnection<T>(connection_request: ChannelConnectionRequest<T>): Promise<ChannelConnection<T>> {
        let helper = this.newConnection(connection_request);
        await this._initConnection(connection_request, helper);
        let connection = helper.build();
        this._channels[connection_request.info.id] = connection;
        return connection;
    }

    protected async _initConnection<T>(request: ChannelConnectionRequest<T>, helper: ConnectionHelper<T>): Promise<void> {
    }

}