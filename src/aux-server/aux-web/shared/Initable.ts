import { SubscriptionLike } from 'rxjs';
import { LoadingProgressCallback } from '@casual-simulation/aux-common/LoadingProgress';

/**
 * Defines an interface for any object that can be initialized.
 */
export interface Initable extends SubscriptionLike {
    /**
     * Initializes the object.
     */
    init(loadingCallback?: LoadingProgressCallback): Promise<void>;
}
