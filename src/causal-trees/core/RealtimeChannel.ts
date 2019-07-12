import { StatusUpdate } from './StatusUpdate';
import { Observable, SubscriptionLike } from 'rxjs';
import { RealtimeChannelConnection } from './RealtimeChannelConnection';
import { User } from './User';

/**
 * Defines an interface for channels that are able to maintain a consistent connection state.
 */
export interface RealtimeChannel extends SubscriptionLike {
    connection: RealtimeChannelConnection;
    statusUpdated: Observable<StatusUpdate>;

    user: User;

    connect(): void;

    /**
     * Sets the user that should be used.
     * @param user The user.
     */
    setUser(user: User): void;
}
