import { Observable, SubscriptionLike } from 'rxjs';

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
