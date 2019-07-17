import { Observable, SubscriptionLike } from 'rxjs';
import { LoadingProgressCallback } from '@casual-simulation/causal-trees';
import { LoginError } from '@casual-simulation/causal-trees';

/**
 * Defines an interface for any object that can be initialized.
 */
export interface Initable extends SubscriptionLike {
    /**
     * Initializes the object.
     */
    init(): Promise<void>;

    onError: Observable<any>;
}
