/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    AuthData,
    AvailablePermissions,
    RemoteCausalRepoProtocol,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-common';
import type {
    CompleteLoginSuccess,
    CompleteWebAuthnLoginSuccess,
    CreatePublicRecordKeyResult,
    GetPlayerConfigResult,
    GrantMarkerPermissionResult,
    GrantResourcePermissionResult,
    IsValidDisplayNameResult,
    IsValidEmailAddressResult,
    ValidateSessionKeyFailure,
} from '@casual-simulation/aux-records';
import type { Observable, SubscriptionLike } from 'rxjs';
import type {
    LoginHint,
    LoginStatus,
    LoginUIStatus,
    PolicyUrls,
    PrivoSignUpInfo,
} from '../auth/AuxAuth';

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
     * Gets the current login status.
     */
    currentLoginStatus: LoginStatus | null;

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
     * Gets the HTTP origin that should be used for Records API requests that are sent over WebSockets.
     * Returns null if not supported by the auth helper.
     */
    getWebsocketOrigin(): Promise<string>;

    /**
     * Gets the protocol that should be used for the Records API requests that are sent over WebSockets.
     * Returns null if not supported by the auth helper.
     */
    getWebsocketProtocol(): Promise<RemoteCausalRepoProtocol>;

    /**
     * Determines whether the user is currently authenticated.
     * Returns true if the user is logged in, false otherwise.
     */
    isAuthenticated(): Promise<boolean>;

    /**
     * Requests that the user become authenticated if they are not already.
     * @param hint The hint that should be used to determine what kind of authentication should be used.
     */
    authenticate(hint?: LoginHint): Promise<AuthData>;

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
     * Gets the connection key for the user.
     * Returns null if the user is not authenticated.
     */
    getConnectionKey(): Promise<string>;

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
     * Determines whether the given email address is valid.
     * Only supported on protocol version 9 or more.
     * @param email The email address to check.
     */
    isValidEmailAddress(email: string): Promise<IsValidEmailAddressResult>;

    /**
     * Determines whether the given display name is valid.
     * Only supported on protocol version 9 or more.
     * @param displayName The display name to check.
     * @param name The name to check.
     */
    isValidDisplayName(
        displayName: string,
        name: string
    ): Promise<IsValidDisplayNameResult>;

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
     * Specifies the email address and whether the user accepted the terms of service during the Privo sign up process.
     * Resolves with a validation result that indicates whether an error occurred and what should be shown to the user.
     * @param info The info that was collected.
     */
    providePrivoSignUpInfo(info: PrivoSignUpInfo): Promise<void>;

    /**
     * Specifies whether the user has an account or not.
     * Only supported on protocol version 9 or more.
     * @param hasAccount Whether the user has an account.
     */
    provideHasAccount(hasAccount: boolean): Promise<void>;

    /**
     * Provides the given login code to finish logging in.
     * @param code The code that should be provided.
     */
    provideCode(code: string): Promise<void>;

    /**
     * Cancels the current login if it is using the custom UI flow.
     */
    cancelLogin(): Promise<void>;

    /**
     * Gets the policy for the given record key.
     * @param recordKey The record key.
     */
    getRecordKeyPolicy(recordKey: string): Promise<PublicRecordKeyPolicy>;

    /**
     * Logs the user out.
     */
    logout(): Promise<void>;

    /**
     * Ensures that the user is logged in with a valid session.
     * If the current session is invalid, then the user will be prompted to log in again.
     */
    relogin(): Promise<void>;

    /**
     * Gets the URLs for the different policies (privacy policy, terms of service, etc.).
     */
    getPolicyUrls(): Promise<PolicyUrls>;

    /**
     * Gets the config that should be used for web clients for the given comId.
     * @param comId The comId.
     */
    getComIdWebConfig(comId: string): Promise<GetPlayerConfigResult>;

    /**
     * Attempts to grant the given permission.
     * @param recordName The name of the record that the permission is for.
     * @param permission The permission that should be granted.
     */
    grantPermission(
        recordName: string,
        permission: AvailablePermissions
    ): Promise<
        | GrantMarkerPermissionResult
        | GrantResourcePermissionResult
        | ValidateSessionKeyFailure
    >;

    /**
     * Provides the given login result to be used for the login process.
     * @param result The result that should be used.
     */
    provideLoginResult(
        result: CompleteLoginSuccess | CompleteWebAuthnLoginSuccess
    ): Promise<void>;
}
