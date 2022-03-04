import { AuthData } from '@casual-simulation/aux-common';
import { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';

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
    | LoginUIEmailStatus
    | LoginUICheckEmailStatus
    | LoginUICheckSmsStatus;

export interface LoginUINoStatus {
    page: false;
}

export interface LoginUIEmailStatus {
    page: 'enter_email';

    /**
     * The page that should be linked to as the terms of service.
     */
    termsOfServiceUrl: string;

    /**
     * The name of the site that is being logged into.
     */
    siteName: string;

    showAcceptTermsOfServiceError?: boolean;
    showEnterEmailError?: boolean;
    showInvalidEmailError?: boolean;
    showEnterSmsError?: boolean;
    showInvalidSmsError?: boolean;
    errorCode?: string;
    errorMessage?: string;

    /**
     * Whether SMS phone numbers are supported for login.
     */
    supportsSms?: boolean;
}

export interface LoginUICheckEmailStatus {
    page: 'check_email';
}

export interface LoginUICheckSmsStatus {
    page: 'check_sms';
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
     * Specifies the SMS phone number and whether the user accepted the terms of service during the login process.
     * Resolves with a validation result that indicates whether an error ocurred and what should be shown to the user.
     * Only supported on protocol version 3 or more.
     * @param sms The SMS phone number that should be used to login.
     * @param acceptedTermsOfService Whether the user accepted the terms of service.
     */
    provideSmsNumber(sms: string, acceptedTermsOfService: boolean): Promise<void>;

    /**
     * Cancels the in-progress login attempt.
     */
    cancelLogin(): Promise<void>;
}
