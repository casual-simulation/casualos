import { Observable, SubscriptionLike } from 'rxjs';
import { LoadingProgressCallback } from '@casual-simulation/causal-trees';
import { LoginError } from '@casual-simulation/causal-trees';

export type InitError = LoginError | ExceptionError | GenericError;

export interface ExceptionError {
    type: 'exception';
    exception: Error;
}

export interface GenericError {
    type: 'generic';
    message: string;
}

/**
 * Defines an interface for any object that can be initialized.
 */
export interface Initable extends SubscriptionLike {
    /**
     * Initializes the object.
     */
    init(loadingCallback?: LoadingProgressCallback): Promise<InitError>;

    onError: Observable<any>;
}
