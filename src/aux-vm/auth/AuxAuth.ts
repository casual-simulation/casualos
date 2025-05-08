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
} from '@casual-simulation/aux-common';
import type {
    CompleteLoginSuccess,
    CompleteWebAuthnLoginSuccess,
    CreatePublicRecordKeyResult,
    FormError,
    GetPlayerConfigResult,
    GrantMarkerPermissionResult,
    GrantResourcePermissionResult,
    IsValidDisplayNameResult,
    IsValidEmailAddressResult,
    PublicRecordKeyPolicy,
    ValidateSessionKeyFailure,
} from '@casual-simulation/aux-records';
import type {
    AddressType,
    UserLoginMetadata,
} from '@casual-simulation/aux-records/AuthStore';

/**
 * Defines an interface that represents the login state of the user.
 */
export interface LoginStatus {
    /**
     * Whether the auth services are loading.
     */
    isLoading?: boolean;

    /**
     * Whether the user is in the process of logging in.
     */
    isLoggingIn?: boolean;

    /**
     * The auth data for the user.
     */
    authData?: AuthData;
}

export type LoginUIStatus =
    | LoginUINoStatus
    | LoginUIAddressStatus
    | LoginUICheckAddressStatus
    | LoginUIShowIframe
    | LoginUIHasAccount
    | LoginUIPrivoSignUp
    | LoginUIUpdatePasswordLink
    | LoginUIHandleLoginMetadata;

export interface LoginUINoStatus {
    page: false;
}

export interface LoginUIAddressStatus {
    page: 'enter_address' | 'enter_email';

    /**
     * The page that should be linked to as the terms of service.
     */
    termsOfServiceUrl: string;

    /**
     * The page that should be linked to as the privacy policy.
     */
    privacyPolicyUrl: string;

    /**
     * The page that should be linked to as the code of conduct.
     */
    codeOfConductUrl: string;

    /**
     * The page that should be linked to as the support page.
     */
    supportUrl: string;

    /**
     * The name of the site that is being logged into.
     */
    siteName: string;

    /**
     * The errors that should be displayed.
     */
    errors: FormError[];

    /**
     * Whether SMS phone numbers are supported for login.
     */
    supportsSms?: boolean;

    /**
     * Whether WebAuthn is supported for login.
     */
    supportsWebAuthn?: boolean;
}

export interface LoginUICheckAddressStatus {
    page: 'check_address' | 'check_email';

    /**
     * The address that should be checked.
     */
    address: string;

    /**
     * The type of address that should be checked.
     */
    addressType: AddressType;

    /**
     * Whether the option to enter a code should be provided.
     */
    enterCode?: boolean;

    /**
     * The errors that should be displayed.
     */
    errors: FormError[];

    /**
     * The URL that should be linked to for support.
     */
    supportUrl: string | null;
}

export interface LoginUIShowIframe {
    page: 'show_iframe';
}

export interface LoginUIHasAccount {
    page: 'has_account';

    /**
     * The page that should be linked to as the privacy policy.
     */
    privacyPolicyUrl: string;

    /**
     * The page that should be linked to as the code of conduct.
     */
    codeOfConductUrl: string;

    /**
     * The page that should be linked to as the terms of service.
     */
    termsOfServiceUrl: string;

    /**
     * The page that should be linked to as the support page.
     */
    supportUrl: string;
}

export interface LoginUIPrivoSignUp {
    page: 'enter_privo_account_info';

    /**
     * The page that should be linked to as the terms of service.
     */
    termsOfServiceUrl: string;

    /**
     * The page that should be linked to as the privacy policy.
     */
    privacyPolicyUrl: string;

    /**
     * The page that should be linked to as the code of conduct.
     */
    codeOfConductUrl: string;

    /**
     * The page that should be linked to as the support page.
     */
    supportUrl: string;

    /**
     * The name of the site that is being logged into.
     */
    siteName: string;

    /**
     * The errors that should be displayed.
     */
    errors: FormError[];

    /**
     * The error code that ocurred.
     */
    errorCode?: string;

    /**
     * The error message that should be shown.
     */
    errorMessage?: string;
}

export interface LoginUIUpdatePasswordLink {
    page: 'show_update_password_link';

    /**
     * The link used to update the user's password.
     */
    updatePasswordUrl: string;

    /**
     * Whether a parent email was provided by the user.
     */
    providedParentEmail: boolean;
}

// export interface LoginUIRegisterWebAuthn {
//     page: 'show_register_webauthn';
//     apiEndpoint: string;
//     authenticationHeaders: Record<string, string>;
// }

/**
 * Defines an interface that gives the UI an opportunity to respond to the login metadata.
 */
export interface LoginUIHandleLoginMetadata {
    page: 'handle_login_metadata';
    /**
     * The endpoint that this metadata is for,
     */
    apiEndpoint: string;

    /**
     * The authentication headers that should be used for future requests.
     */
    authenticationHeaders: Record<string, string>;

    /**
     * The metadata that was returned from the login process.
     */
    metadata: UserLoginMetadata;

    /**
     * The method that was used to login.
     */
    method: 'code' | 'webauthn' | 'openid';
}

export interface PrivoSignUpInfo {
    /**
     * The email address that the user entered.
     */
    email: string;

    /**
     * The display name that was collected.
     */
    displayName: string;

    /**
     * Whether the user accepted the terms of service.
     * Null if the user does not need to accept the terms.
     */
    acceptedTermsOfService?: boolean;

    /**
     * The name of the user.
     */
    name: string;

    /**
     * The date of birth of the user.
     */
    dateOfBirth: Date;

    /**
     * The email address of the user's parent.
     * Null if the user is over the age of consent.
     */
    parentEmail?: string;
}

export interface OAuthRedirectRequest {
    authorizationUrl: string;
}

/**
 * The type of possible login hints.
 * - "sign in" indicates that the user should be prompted to sign in.
 * - "sign up" indicates that the user should be prompted to sign up.
 * - null indicates that the user should be asked.
 */
export type LoginHint = 'sign in' | 'sign up' | null;

export interface PolicyUrls {
    privacyPolicyUrl: string;
    termsOfServiceUrl: string;
    codeOfConductUrl: string;

    /**
     * The URL that should be used to contact support.
     */
    supportUrl: string | null;
}

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
     * @param hint The hint that should be used to determine whether to sign in or sign up. If null, then the user may be asked. Defaults to null.
     */
    login(backgroundLogin?: boolean, hint?: LoginHint): Promise<AuthData>;

    /**
     * Logs the user out.
     * Returns a promise that resolves when the user is logged out.
     * Only supported on protocol version 8 or more.
     */
    logout(): Promise<void>;

    /**
     * Ensures that the user is logged in.
     * Validates the current session and re-authenticates the user if necessary.
     * Returns a promise that resolves with data about the user.
     *
     * Only supported on protocol version 12 or more.
     */
    relogin(): Promise<AuthData>;

    /**
     * Gets a record key for the given record.
     * @param recordName The name of the record.
     * @param policy The policy that the record should have. Only supported on protocol version 5 or more.
     */
    createPublicRecordKey(
        recordName: string,
        policy?: PublicRecordKeyPolicy
    ): Promise<CreatePublicRecordKeyResult>;

    /**
     * Gets the auth token for the user.
     */
    getAuthToken(): Promise<string>;

    /**
     * Gets the protocol version that this object supports.
     */
    getProtocolVersion(): Promise<number>;

    /**
     * Requests that the account page or login page (if not authenticated) be opened in a new tab.
     * Only supported on protocol version 2 or more.
     */
    openAccountPage(): Promise<void>;

    /**
     * Gets the link to the account page.
     * Only supported on protocol version 11 or more.
     */
    getAccountPage(): Promise<string>;

    /**
     * Adds the given function as a callback for login status information.
     * Only supported on protocol version 2 or more.
     * @param callback The function that should be called when the login status changes.
     */
    addLoginStatusCallback(
        callback: (status: LoginStatus) => void
    ): Promise<void>;

    /**
     * Adds the given function as a callback for login UI status information.
     * Only supported on protocol version 2 or more.
     * @param callback The function that should be called when the login UI should change.
     */
    addLoginUICallback(
        callback: (status: LoginUIStatus) => void
    ): Promise<void>;

    /**
     * Adds the given function as a callback for OAuth redirect information.
     * Only supported on protocol version 9 or more.
     * @param callback The callback.
     */
    addOAuthRedirectCallback(
        callback: (request: OAuthRedirectRequest) => void
    ): Promise<void>;

    /**
     * Sets whether a custom user interface should be used for the login process.
     * If set to true, then there should be at least one callback registered for the login UI.
     * Only supported on protocol version 2 or more.
     * @param useCustomUI Whether a custom user interface should be used instead of the new tab login flow.
     */
    setUseCustomUI(useCustomUI: boolean): Promise<void>;

    /**
     * Specifies the email address and whether the user accepted the terms of service during the login process.
     * Resolves with a validation result that indicates whether an error occurred and what should be shown to the user.
     * Only supported on protocol version 2 or more.
     * @param email The email address that should be used to login.
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
     * Specifies the SMS phone number and whether the user accepted the terms of service during the login process.
     * Resolves with a validation result that indicates whether an error ocurred and what should be shown to the user.
     * Only supported on protocol version 3 or more.
     * @param sms The SMS phone number that should be used to login.
     * @param acceptedTermsOfService Whether the user accepted the terms of service.
     */
    provideSmsNumber(
        sms: string,
        acceptedTermsOfService: boolean
    ): Promise<void>;

    /**
     * Specifies the email address and whether the user accepted the terms of service during the Privo sign up process.
     * Resolves with a validation result that indicates whether an error occurred and what should be shown to the user.
     * Only used on protocol version 9 or more.
     * @param info The info that was collected.
     */
    providePrivoSignUpInfo(info: PrivoSignUpInfo): Promise<void>;

    /**
     * Specifies the login code that should be used to complete a login attempt.
     * Only supported on protocol version 6 or more.
     * @param code The code that should be used.
     */
    provideCode(code: string): Promise<void>;

    /**
     * Specifies whether the user has an account or not.
     * Only supported on protocol version 9 or more.
     * @param hasAccount Whether the user has an account.
     */
    provideHasAccount(hasAccount: boolean): Promise<void>;

    /**
     * Specifies when the user has completed the OAuth login process.
     */
    provideOAuthLoginComplete(): Promise<void>;

    /**
     * Cancels the in-progress login attempt.
     */
    cancelLogin(): Promise<void>;

    /**
     * Gets the HTTP Origin that the records API is hosted at for this authentication service.
     * Only supported on protocol version 4 or more.
     */
    getRecordsOrigin(): Promise<string>;

    /**
     * Gets the HTTP origin that should be used for Records API requests that are sent over WebSockets.
     * Only supported on protocol version 9 or more.
     */
    getWebsocketOrigin(): Promise<string>;

    /**
     * Gets the protocol that should be used for the Records API requests that are sent over WebSockets.
     * Only supported on protocol version 9 or more.
     */
    getWebsocketProtocol(): Promise<RemoteCausalRepoProtocol>;

    /**
     * Gets the connection key for the user.
     * Returns null if the user is not authenticated.
     *
     * Only supported on protocol version 7 or more.
     */
    getConnectionKey(): Promise<string>;

    /**
     * Gets the policy URLs.
     * Only supported on protocol version 9 or more.
     */
    getPolicyUrls(): Promise<PolicyUrls>;

    /**
     * Gets the comId web config for the given comId.
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
     * Only supported on protocol version 10 or more.
     * @param result The result that should be used.
     */
    provideLoginResult(
        result: CompleteLoginSuccess | CompleteWebAuthnLoginSuccess
    ): Promise<void>;
}
