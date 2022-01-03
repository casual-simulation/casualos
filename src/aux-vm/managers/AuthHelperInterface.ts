import { AuthData } from '@casual-simulation/aux-common';
import { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';
import { SubscriptionLike } from 'rxjs';

/**
 * Defines an interface for objects that are able to keep track of the user's authentication state.
 */
export interface AuthHelperInterface extends SubscriptionLike {
    /**
     * Determines whether the user is currently authenticated.
     * Returns true if the user is logged in, false otherwise.
     */
    isAuthenticated(): Promise<boolean>;

    /**
     * Requests that the user become authenticated if they are not already.
     */
    authenticate(): Promise<AuthData>;

    /**
     * Gets the auth token for the user.
     */
    getAuthToken(): Promise<string>;

    /**
     * Requests that an access key for a public record be created.
     * @param recordName The name of the record that the key should be created for.
     */
    createPublicRecordKey(
        recordName: string
    ): Promise<CreatePublicRecordKeyResult>;
}
