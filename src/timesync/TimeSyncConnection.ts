import { TimeSample } from './TimeSync';
import { SubscriptionLike } from 'rxjs';

/**
 * Defines an interface for objects that can gather time sync samples from a server.
 */
 export interface TimeSyncConnection extends SubscriptionLike {
    /**
     * Queries the server time and returns a promise that contains the time sample.
     */
    sampleServerTime(): Promise<TimeSample>;
}