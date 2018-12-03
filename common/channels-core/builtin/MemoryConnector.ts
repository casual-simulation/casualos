
import { ChannelConnector, ChannelConnection, ChannelConnectionRequest } from '../ChannelConnector';
import { IChannel } from '../Channel';
import { Subject } from 'rxjs';
import { Event } from '../Event';
import { BaseConnector } from './BaseConnector';

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

        let connection: ChannelConnection<T>;
        if(this._channels[connection_request.info.id]) {
            connection = this._channels[connection_request.info.id];
        } else {
            let helper = this.newConnection(connection_request);
            connection = helper.build();
            this._channels[connection_request.info.id] = connection;
        }

        return Promise.resolve<ChannelConnection<T>>(connection);
    }

}