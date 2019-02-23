import { RealtimeChannel } from '@yeti-cgi/aux-common/channels-core/RealtimeChannel';
import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';

interface ChannelSub {
    sub: SubscriptionLike;
    channel: RealtimeChannel<any>;
}

export class RealtimeChannelServer {
    private _subs: {
        [id: string]: ChannelSub
    };
    private _channels: RealtimeChannel<any>[];

    constructor() {
        this._subs = {};
        this._channels = [];
    }

    /**
     * Determines if the client with the given ID has a channel in this server.
     * @param id The client ID.
     */
    exists(id: string): boolean {
        return !!this._subs[id];
    }

    /**
     * Adds the given channel to this server.
     * @param id The ID of the channel's related client.
     * @param channel The channel to add.
     */
    add(id: string, channel: RealtimeChannel<any>) {
        this._subs[id] = this._setup(channel);
    }

    /**
     * Removes the given channel from the server.
     * @param id The ID of the channel's related client.
     */
    remove(id: string) {
        this._teardown(this._subs[id]);
        delete this._subs[id];
    }

    private _setup(channel: RealtimeChannel<any>): ChannelSub {
        this._channels.push(channel);
        return {
            channel,
            sub: channel.events.pipe(
                tap(e => {
                    this._channels.forEach(c => {
                        if (c !== channel) {
                            c.emit(e);
                        }
                    });
                })
            ).subscribe()
        };
    }

    private _teardown(sub: ChannelSub) {
        if (sub) {
            const index = this._channels.indexOf(sub.channel);
            if (index >= 0) {
                this._channels.splice(index, 1);
            }
            sub.sub.unsubscribe();
        }
    }
}