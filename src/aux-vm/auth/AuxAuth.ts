import {
    AuthData,
    PermanentAuthTokenResult,
} from '@casual-simulation/aux-common';
import { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';

/**
 * Defines an interface for an object that is able to communicate with an authentication service.
 */
export interface AuxAuth {
    /**
     * Determines whether the user is authenticated.
     */
    isLoggedIn(): Promise<boolean>;

    /**
     * Logs the user in.
     * Returns a promise that resolves with data about the user.
     */
    login(): Promise<AuthData>;

    /**
     * Adds a listener for when a new auth token is received.
     * @param listener The listener for the token.
     */
    addTokenListener(listener: (error: string, token: AuthData) => void): void;

    /**
     * Gets a record key for the given record.
     * @param recordName The name of the record.
     */
    createPublicRecordKey(
        recordName: string
    ): Promise<CreatePublicRecordKeyResult>;
}
