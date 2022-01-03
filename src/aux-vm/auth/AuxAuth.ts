import { AuthData } from '@casual-simulation/aux-common';
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
     * @param backgroundLogin Whether to only try to log in in the background. This will prevent any UI from popping up to log the user in but may not be able to login the user completely. Defaults to false.
     */
    login(backgroundLogin?: boolean): Promise<AuthData>;

    /**
     * Gets a record key for the given record.
     * @param recordName The name of the record.
     */
    createPublicRecordKey(
        recordName: string
    ): Promise<CreatePublicRecordKeyResult>;

    /**
     * Gets the auth token for the user.
     */
    getAuthToken(): Promise<string>;
}
