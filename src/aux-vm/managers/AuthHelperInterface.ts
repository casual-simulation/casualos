import { AuthData } from '@casual-simulation/aux-common';
import {
    CreatePublicRecordKeyResult,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-records';
import { Observable, SubscriptionLike } from 'rxjs';
import { LoginStatus, LoginUIStatus } from '../auth/AuxAuth';

/**
 * Defines an interface for objects that are able to keep track of the user's authentication state.
 */
export interface AuthHelperInterface extends SubscriptionLike {
    /**
     * The HTTP Origin that this helper interface loaded.
     */
    origin: string;

    /**
     * Gets whether this inst supports authentication.
     */
    supportsAuthentication: boolean;

    /**
     * Gets an observable that resolves whenever a login status is available.
     */
    loginStatus: Observable<LoginStatus>;

    /**
     * Gets an observable that resolves whenever the login UI should be updated.
     */
    loginUIStatus: Observable<LoginUIStatus>;

    /**
     * Gets the HTTP origin that should be queried for Records API requests.
     */
    getRecordsOrigin(): Promise<string>;

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
     * Requests that the user become authenticated entirely in the background.
     * This will not show any UI to the user but may also mean that the user will not be able to be authenticated.
     */
    authenticateInBackground(): Promise<AuthData>;

    /**
     * Gets the auth token for the user.
     */
    getAuthToken(): Promise<string>;

    /**
     * Requests that an access key for a public record be created.
     * @param recordName The name of the record that the key should be created for.
     */
    createPublicRecordKey(
        recordName: string,
        policy: PublicRecordKeyPolicy
    ): Promise<CreatePublicRecordKeyResult>;

    /**
     * Opens the user account page or the login page in a new tab.
     */
    openAccountPage(): Promise<void>;

    /**
     * Sets whether a custom login UI should be used.
     * @param useCustomUI Whether the custom login UI should be used.
     */
    setUseCustomUI(useCustomUI: boolean): Promise<void>;

    /**
     * Provides the given email address and whether the user accepted the terms of service for the login flow.
     * @param email The email address that the user provided.
     * @param acceptedTermsOfService Whether the user accepted the terms of service.
     */
    provideEmailAddress(
        email: string,
        acceptedTermsOfService: boolean
    ): Promise<void>;

    /**
     * Provides the given email address and whether the user accepted the terms of service for the login flow.
     * @param sms The email address that the user provided.
     * @param acceptedTermsOfService Whether the user accepted the terms of service.
     */
    provideSmsNumber(
        sms: string,
        acceptedTermsOfService: boolean
    ): Promise<void>;

    /**
     * Cancels the current login if it is using the custom UI flow.
     */
    cancelLogin(): Promise<void>;

    /**
     * Gets the policy for the given record key.
     * @param recordKey The record key.
     */
    getRecordKeyPolicy(recordKey: string): Promise<PublicRecordKeyPolicy>;
}
