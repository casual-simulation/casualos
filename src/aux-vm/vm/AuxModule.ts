import { AuxChannel } from './AuxChannel';
import { Subscription } from 'rxjs';

/**
 * Defines an interface for objects which are able to extend a AuxChannel with custom logic.
 */
export interface AuxModule {
    /**
     * Sets up the services/dependencies that the module needs
     * to perform its duties. Returns a subscription that, when unsubscribed, will dispose of extra resources.
     * @param channel The channel that the module should be setup on.
     */
    setup(channel: AuxChannel): Promise<Subscription>;
}
