import { StatusUpdate } from './StatusUpdate';
import { Observable, SubscriptionLike } from 'rxjs';
import { RealtimeChannelConnection } from './RealtimeChannelConnection';

/**
 * Defines an interface for channels that are able to maintain a consistent connection state.
 */
export interface RealtimeChannel extends SubscriptionLike {
    connection: RealtimeChannelConnection;
    statusUpdated: Observable<StatusUpdate>;
    connect(): void;
}
