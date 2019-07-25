import { ChannelManager, LoadedChannel } from './ChannelManager';
import { Observable, Observer } from 'rxjs';
import { RealtimeChannelInfo } from '@casual-simulation/causal-trees';

/**
 * Creates an observable which loads the given channel and unloads it when unsubscribed.
 * @param manager The manager.
 * @param info The info about the channel to load.
 */
export function loadChannel(
    manager: ChannelManager,
    info: RealtimeChannelInfo
): Observable<LoadedChannel> {
    return Observable.create((observer: Observer<LoadedChannel>) => {
        let channel: LoadedChannel;

        setup();

        return () => {
            if (channel) {
                channel.subscription.unsubscribe();
                channel = null;
            }
        };

        async function setup() {
            channel = await manager.loadChannel(info);
            observer.next(channel);
        }
    });
}
