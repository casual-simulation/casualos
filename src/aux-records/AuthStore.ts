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
import type { PrivacyFeatures, UserRole } from '@casual-simulation/aux-common';
import type { RegexRule } from './Utils';
import type { ServerError } from '@casual-simulation/aux-common/Errors';
import type {
    AuthenticatorTransportFuture,
    CredentialDeviceType,
} from '@simplewebauthn/types';
import type {
    StripeAccountStatus,
    StripeRequirementsStatus,
} from './StripeInterface';

/**
 * Defines an interface that represents an auth store.
 */
export interface AuthStore {
    /**
     * Adds or updates the given user.
     * @param user The user that should be saved.
     */
    saveUser(user: AuthUser): Promise<void>;

    /**
     * Attempts to save the given user as a new user.
     * @param user The user that should be saved.
     */
    saveNewUser(user: AuthUser): Promise<SaveNewUserResult>;

    /**
     * Finds the user with the given ID.
     * @param userId The ID of the user.
     */
    findUser(userId: string): Promise<AuthUser | null>;

    /**
     * Finds the user that represents the given address.
     * @param address The address.
     * @param addressType The type of the address.
     */
    findUserByAddress(
        address: string,
        addressType: AddressType
    ): Promise<AuthUser | null>;

    /**
     * Finds the user that is associated with the given Stripe Customer ID.
     * @param customerId The ID of the customer.
     */
    findUserByStripeCustomerId(customerId: string): Promise<AuthUser | null>;

    /**
     * Finds the user that is associated with the given Stripe Account ID.
     * @param accountId The ID of the account.
     */
    findUserByStripeAccountId(accountId: string): Promise<AuthUser | null>;

    /**
     * Finds the user that is associated with the given Privo Service ID.
     * @param serviceId
     */
    findUserByPrivoServiceId(serviceId: string): Promise<AuthUser | null>;

    /**
     * Finds a login request for the given user and request ID.
     * @param userId The ID of the user.
     * @param requestId The ID of the request.
     */
    findLoginRequest(
        userId: string,
        requestId: string
    ): Promise<AuthLoginRequest | null>;

    /**
     * Finds the login request for the given request ID.
     * @param requestId The ID of the Open ID login request.
     */
    findOpenIDLoginRequest(
        requestId: string
    ): Promise<AuthOpenIDLoginRequest | null>;

    /**
     * Finds the login request for the given state.
     * @param state The state that the request contains.
     */
    findOpenIDLoginRequestByState(
        state: string
    ): Promise<AuthOpenIDLoginRequest | null>;

    /**
     * Finds the WebAuthn login request with the given request ID.
     * @param requestId The ID of the request.
     */
    findWebAuthnLoginRequest(
        requestId: string
    ): Promise<AuthWebAuthnLoginRequest | null>;

    /**
     * Finds a login session for the given user and session ID.
     * @param userId The ID of the user.
     * @param sessionId The ID of the session.
     */
    findSession(userId: string, sessionId: string): Promise<AuthSession | null>;

    /**
     * Saves the given login request.
     * @param request The request that should be saved.
     */
    saveLoginRequest(request: AuthLoginRequest): Promise<AuthLoginRequest>;

    /**
     * Saves the given login request.
     * @param request The request that should be saved.
     */
    saveOpenIDLoginRequest(
        request: AuthOpenIDLoginRequest
    ): Promise<AuthOpenIDLoginRequest>;

    /**
     * Saves the given WebAuthn login request.
     * @param request The request that should be saved.
     */
    saveWebAuthnLoginRequest(
        request: AuthWebAuthnLoginRequest
    ): Promise<AuthWebAuthnLoginRequest>;

    /**
     * Marks the login request as completed.
     * @param userId The ID oof the user.
     * @param requestId The ID of the request.
     * @param completedTimeMs The time that the request was completed.
     */
    markLoginRequestComplete(
        userId: string,
        requestId: string,
        completedTimeMs: number
    ): Promise<void>;

    /**
     * Marks the login request as completed.
     * @param requestId The ID of the request.
     * @param completedTimeMs The time that the request was completed.
     */
    markOpenIDLoginRequestComplete(
        requestId: string,
        completedTimeMs: number
    ): Promise<void>;

    /**
     * Marks the login request as completed.
     * @param requestId The ID of the request.
     * @param userId The ID of the user that completed the request.
     * @param completedTimeMs The time that the request was completed.
     */
    markWebAuthnLoginRequestComplete(
        requestId: string,
        userId: string,
        completedTimeMs: number
    ): Promise<void>;

    /**
     * Saves the given authorization code for the given login request.
     * @param requestId The ID of the request.
     * @param authorizationCode The authorization code that should be saved.
     * @param authorizationTimeMs The time of the authorization.
     */
    saveOpenIDLoginRequestAuthorizationCode(
        requestId: string,
        authorizationCode: string,
        authorizationTimeMs: number
    ): Promise<void>;

    /**
     * Increments the attempt count for the given login request.
     * @param userId The ID of the user.
     * @param requestId The ID of the login request.
     */
    incrementLoginRequestAttemptCount(
        userId: string,
        requestId: string
    ): Promise<void>;

    /**
     * Saves the given login session.
     * @param session The session that should be saved.
     */
    saveSession(session: AuthSession): Promise<void>;

    /**
     * Marks the given session as replaced by the new session and saves the new session.
     * @param session The session that was replaced.
     * @param newSession The new session.
     * @param revokeTimeMs The time that the old session is to be revoked at. (Usually now)
     */
    replaceSession(
        session: AuthSession,
        newSession: AuthSession,
        revokeTimeMs: number
    ): Promise<void>;

    /**
     * Lists the sessions that belong to the given user.
     * @param userId The ID of the user.
     * @param expireTimeMs The expiration time that the list should start after.
     */
    listSessions(
        userId: string,
        expireTimeMs: number | null
    ): Promise<ListSessionsDataResult>;

    /**
     * Sets the time that all sessions are revoked on the specified user.
     * @param userId The ID of the user that all sessions should be revoked for.
     * @param allSessionRevokeTimeMs The unix time that should be recorded.
     */
    setRevokeAllSessionsTimeForUser(
        userId: string,
        allSessionRevokeTimeMs: number
    ): Promise<void>;

    /**
     * Sets the ID of the login request that is allowed to be completed for the given user.
     * At any particular moment, only one login request is allowed to be completed by a user.
     * This is used to help mitigate distributed brute force attacks. (i.e. attacks that try generating a lot of login requests and guessing the codes)
     * @param userId The ID of the user.
     * @param requestId The ID of the login request.
     */
    setCurrentLoginRequest(userId: string, requestId: string): Promise<void>;

    /**
     * Sets the current WebAuthn challenge that the user is trying to complete.
     * At any particular moment, only one WebAuthn challenge is allowed to be completed by a user.
     * @param userId The ID of the user.
     * @param challenge The challenge.
     */
    setCurrentWebAuthnChallenge(
        userId: string,
        challenge: string
    ): Promise<void>;

    /**
     * Gets the list of email rules.
     */
    listEmailRules(): Promise<RegexRule[]>;

    /**
     * Gets the list of SMS rules.
     */
    listSmsRules(): Promise<RegexRule[]>;

    /**
     * Creates or updates the given subscription.
     * @param subscription The subscription to save.
     */
    saveSubscription(subscription: AuthSubscription): Promise<void>;

    /**
     * Gets the subscription with the given ID.
     * @param id The ID of the subscription.
     */
    getSubscriptionById(id: string): Promise<AuthSubscription | null>;

    /**
     * Gets the subscription with the given stripe subscription ID.
     * @param id The ID of the stripe subscription.
     */
    getSubscriptionByStripeSubscriptionId(
        id: string
    ): Promise<AuthSubscription | null>;

    /**
     * Creates or updates the given subscription period.
     * @param period The subscription period.
     */
    saveSubscriptionPeriod(period: AuthSubscriptionPeriod): Promise<void>;

    /**
     * Gets the subscription period with the given ID.
     * @param id The ID of the subscription period.
     */
    getSubscriptionPeriodById(
        id: string
    ): Promise<AuthSubscriptionPeriod | null>;

    /**
     * Gets the subscription periods that belong to the given subscription.
     * @param subscriptionId The ID of the subscription.
     */
    listSubscriptionPeriodsBySubscriptionId(
        subscriptionId: string
    ): Promise<AuthSubscriptionPeriod[]>;

    /**
     * Creates or updates the given invoice.
     * @param invoice The invoice that should be saved.
     */
    saveInvoice(invoice: AuthInvoice): Promise<void>;

    /**
     * Gets the invoice with the given ID.
     * @param id The ID of the invoice.
     */
    getInvoiceById(id: string): Promise<AuthInvoice | null>;

    /**
     * Gets the invoice with the given stripe ID.
     * @param id The ID of the invoice.
     */
    getInvoiceByStripeId(id: string): Promise<AuthInvoice | null>;

    /**
     * Updates the subscription info for a user/studio.
     *
     * This will create/update a subscription object, update the info on the user/studio and subscription, and optionally update the period of the subscription.
     * @param request The request.
     */
    updateSubscriptionInfo(
        request: UpdateSubscriptionInfoRequest
    ): Promise<void>;

    /**
     * Updates the subscription period for a user/studio.
     *
     * This will update the period of the subscription, and optionally create subscription objects for the user/studio if neccesary.
     * @param request The request.
     */
    updateSubscriptionPeriod(
        request: UpdateSubscriptionPeriodRequest
    ): Promise<void>;

    /**
     * Updates the info for a checkout session.
     * @param request The
     */
    updateCheckoutSessionInfo(
        request: UpdateCheckoutSessionRequest
    ): Promise<void>;

    /**
     * Marks the checkout session with the given ID as fulfilled.
     * @param sessionId The ID of the checkout session.
     * @param fulfilledAtMs The unix time in miliseconds that the session was fulfilled at.
     */
    markCheckoutSessionFulfilled(
        sessionId: string,
        fulfilledAtMs: number
    ): Promise<void>;

    /**
     * Gets the checkout session with the given ID.
     * Returns null if the session could not be found.
     * @param id The ID of the checkout session.
     */
    getCheckoutSessionById(id: string): Promise<AuthCheckoutSession | null>;

    /**
     * Gets the list of authenticators for the given user.
     * @param userId The ID of the user.
     */
    listUserAuthenticators(
        userId: string
    ): Promise<AuthListedUserAuthenticator[]>;

    /**
     * Finds the authenticator with the given credentialId. Includes the user that the authenticator is for.
     * Returns an object with null properties if the authenticator could not be found.
     * @param credentialId The ID of the credential that the authenticator should represent.
     */
    findUserAuthenticatorByCredentialId(
        credentialId: string
    ): Promise<AuthUserAuthenticatorWithUser | null>;

    /**
     * Finds the metadata for the given user ID.
     * If the user does not exist, then null is returned.
     * @param userId The ID of the user.
     */
    findUserLoginMetadata(userId: string): Promise<UserLoginMetadata | null>;

    /**
     * Saves the given authenticator.
     * @param authenticator The authenticator that should be saved.
     */
    saveUserAuthenticator(authenticator: AuthUserAuthenticator): Promise<void>;

    /**
     * Saves the counter for the given authenticator.
     * @param id The ID of the authenticator.
     * @param newCounter The counter that should be saved.
     */
    saveUserAuthenticatorCounter(id: string, newCounter: number): Promise<void>;

    /**
     * Deletes the authenticator with the given ID.
     * Returns the number of items that were deleted.
     * @param userId The ID of the user whose authenticator should be deleted.
     * @param authenticatorId The ID of the authenticator that should be deleted.
     */
    deleteUserAuthenticator(
        userId: string,
        authenticatorId: string
    ): Promise<number>;

    /**
     * Creates or updates the given purchased item.
     * @param item The item.
     */
    savePurchasedItem(item: PurchasedItem): Promise<void>;

    /**
     * Gets the list of purchased items that are associated with the given activation key.
     * @param keyId The ID of the key.
     */
    listPurchasedItemsByActivationKeyId(
        keyId: string
    ): Promise<PurchasedItem[]>;

    /**
     * Creates the given activation key.
     * @param key The key.
     */
    createActivationKey(key: ActivationKey): Promise<void>;

    /**
     * Gets the activation key with the given ID.
     * Returns null if the key could not be found.
     * @param keyId The ID of the key.
     */
    getActivationKeyById(keyId: string): Promise<ActivationKey | null>;
}

export type AddressType = 'email' | 'phone';

export interface AuthUser {
    /**
     * The ID of the user.
     */
    id: string;

    /**
     * The name of the user.
     */
    name?: string | null;

    /**
     * The email address of the user.
     * Possible to use for login.
     */
    email: string | null;

    /**
     * The SMS phone number of the user.
     * Possible to use for login.
     */
    phoneNumber: string | null;

    avatarUrl?: string | null;
    avatarPortraitUrl?: string | null;

    /**
     * The ID of the stripe customer that is associated with this user.
     */
    stripeCustomerId?: string | null;

    /**
     * The current status of the user's subscription.
     */
    subscriptionStatus?: string | null;

    /**
     * The ID of the purchasable subscription that the user has.
     * Note that this is the ID of the subscription in the config, not the ID of the stripe subscription.
     */
    subscriptionId?: string;

    /**
     * The ID of the subscription that this user record references.
     */
    subscriptionInfoId?: string;

    /**
     * The unix time in miliseconds that the user's current subscription period started at.
     */
    subscriptionPeriodStartMs?: number | null;

    /**
     * The unix time in miliseconds that the user's current subscription period ends at.
     */
    subscriptionPeriodEndMs?: number | null;

    /**
     * The last Unix time that all the sessions were revoked at.
     */
    allSessionRevokeTimeMs: number | null | undefined;

    /**
     * The ID of the current login request.
     * At any particular moment, only one login request is allowed to be completed by a user.
     * This is used to help mitigate distributed brute force attacks. (i.e. attacks that try generating a lot of login requests and guessing the codes)
     */
    currentLoginRequestId: string | null | undefined;

    /**
     * The current WebAuthn challenge that the user is trying to complete.
     */
    currentWebAuthnChallenge?: string | null | undefined;

    /**
     * The Unix time in miliseconds that the user was banned.
     * If set to any positive number, then the user should be considered banned and unable to perform any operations.
     * Null/undefined if the user is not banned and allowed access into the system.
     */
    banTimeMs?: number | null | undefined;

    /**
     * The reason for the ban.
     */
    banReason?: 'terms_of_service_violation' | null | undefined;

    /**
     * The Privo Service ID that this user is associated with.
     */
    privoServiceId?: string;

    /**
     * The Privo Service ID of the parent of this user.
     */
    privoParentServiceId?: string;

    /**
     * The URL that the user or user's parent can visit to grant consent for the user to use the system.
     */
    privoConsentUrl?: string;

    /**
     * The privacy-related features that the user has access to.
     * If null or omitted, then the user has access to all features.
     */
    privacyFeatures?: PrivacyFeatures | null;

    /**
     * The role that the user has been assigned in the system.
     */
    role?: UserRole;

    /**
     * The rate at which the user is requesting payment (null if not yet specified)
     */
    requestedRate?: number | null;

    /**
     * The user's connected stripe account ID.
     */
    stripeAccountId?: string | null;

    /**
     * The user's connected stripe account requirements status.
     */
    stripeAccountRequirementsStatus?: StripeRequirementsStatus | null;

    /**
     * The user's connected stripe account status.
     */
    stripeAccountStatus?: StripeAccountStatus | null;
}

export interface AuthUserAuthenticator {
    /**
     * The ID of the authenticator.
     */
    id: string;

    /**
     * The ID of the user that this authenticator is for.
     */
    userId: string;

    /**
     * The ID of the credential that this authenticator is for.
     */
    credentialId: string;

    /**
     * The public key of the credential.
     */
    credentialPublicKey: Uint8Array;

    /**
     * The counter for the credential.
     */
    counter: number;

    /**
     * The device type of the credential.
     */
    credentialDeviceType: CredentialDeviceType;

    /**
     * The AAGUID of the authenticator that the credential uses.
     */
    aaguid: string;

    /**
     * The user agent of the browser that registered the authenticator.
     * Null if the authenticator was not registered by a user agent.
     */
    registeringUserAgent: string | null;

    /**
     * Whether the credential is backed up.
     */
    credentialBackedUp: boolean;
    transports?: AuthenticatorTransportFuture[];

    /**
     * The unix time in miliseconds that the authenticator was created at.
     */
    createdAtMs: number;
}

export interface AuthListedUserAuthenticator {
    /**
     * The ID of the authenticator.
     */
    id: string;

    /**
     * The ID of the user that this authenticator is for.
     */
    userId: string;

    /**
     * The ID of the credential that this authenticator is for.
     */
    credentialId: string;

    /**
     * The counter for the credential.
     */
    counter: number;

    /**
     * The device type of the credential.
     */
    credentialDeviceType: CredentialDeviceType;

    /**
     * The AAGUID of the authenticator that the credential uses.
     */
    aaguid: string;

    /**
     * The user agent of the browser that registered the authenticator.
     * Null if the authenticator was not registered by a user agent.
     */
    registeringUserAgent: string | null;

    /**
     * Whether the credential is backed up.
     */
    credentialBackedUp: boolean;
    transports?: AuthenticatorTransportFuture[];

    /**
     * The unix time in miliseconds that the authenticator was created at.
     */
    createdAtMs: number;
}

export interface AuthUserAuthenticatorWithUser {
    authenticator: AuthUserAuthenticator;
    user: AuthUser;
}

/**
 * Defines an interface that represents the data a login request contains.
 */
export interface AuthLoginRequest {
    /**
     * The ID of the user that the login request is for.
     */
    userId: string;

    /**
     * The ID of the request.
     */
    requestId: string;

    /**
     * The hash that the request should match.
     */
    secretHash: string;

    /**
     * The unix timestamp in miliseconds that the request was made at.
     */
    requestTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the request will expire at.
     */
    expireTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the request was completed at.
     * If null, then the request has not been completed.
     */
    completedTimeMs: number | null;

    /**
     * The number of attempts made to complete the request.
     */
    attemptCount: number;

    /**
     * The address that the request is for.
     */
    address: string;

    /**
     * The type of address that the request is for.
     */
    addressType: AddressType;

    /**
     * The IP Address that the request came from.
     */
    ipAddress: string;

    // /**
    //  * The code that the Open ID authorization response should match.
    //  * If null, then Open ID was not used for the login request.
    //  */
    // oidCodeVerifier?: string | null;

    // /**
    //  * The code challenge method that the Open ID authorization response should match.
    //  * If null, then Open ID was not used for the login request.
    //  */
    // oidCodeMethod?: string | null;

    // /**
    //  * The name of the provider that was used for the Open ID login.
    //  * If null, then Open ID was not used for the login request.
    //  */
    // oidProvider?: string | null;

    // /**
    //  * The URL that was used as the redirect URL in the Open ID authorization code flow.
    //  * If null, then Open ID was not used for the login request.
    //  */
    // oidRedirectUrl?: string | null;
}

export interface AuthWebAuthnLoginRequest {
    /**
     * The ID of the request.
     */
    requestId: string;

    /**
     * The unix timestamp in miliseconds that the request was made at.
     */
    requestTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the request will expire at.
     */
    expireTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the request was completed at.
     * If null, then the request has not been completed.
     */
    completedTimeMs: number | null;

    /**
     * The challenge that the request should match.
     */
    challenge: string;

    /**
     * The IP Address that the request came from.
     */
    ipAddress: string;

    /**
     * The ID of the user that the request was completed for.
     * Null if the request has not been completed.
     */
    userId: string | null;
}

/**
 * Defines an interface that represents a login session for the user.
 */
export interface AuthSession {
    /**
     * The ID of the user that the session is for.
     */
    userId: string;

    /**
     * The ID of the session.
     */
    sessionId: string;

    /**
     * The hash of the token that provides access to this session.
     */
    secretHash: string;

    /**
     * The secret of the token that provides connection access to this session.
     */
    connectionSecret: string;

    /**
     * The unix timestamp in miliseconds that the session was granted at.
     */
    grantedTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the session will expire at.
     * If null, then the session does not expire.
     */
    expireTimeMs: number | null;

    /**
     * The unix timestamp in miliseconds that the session was revoked at.
     * If null, then the session has not been revoked.
     */
    revokeTimeMs: number | null;

    /**
     * The ID of the login request that was used to obtain this session.
     */
    requestId: string | null;

    /**
     * The ID of the OpenID login request that aws used to obtain this session.
     */
    oidRequestId?: string | null;

    /**
     * The ID of the WebAuthn login request that was used to obtain this session.
     */
    webauthnRequestId?: string | null;

    /**
     * The ID of the previous session that was used to obtain this session.
     */
    previousSessionId: string | null;

    /**
     * The ID of the next session that replaced this session.
     */
    nextSessionId: string | null;

    /**
     * The IP Address that the session was granted to.
     */
    ipAddress: string;

    /**
     * The name of the Open ID provider that was used to obtain this session.
     * If null, then Open ID was not used for the session.
     */
    oidProvider?: string | null;

    /**
     * The access token that was granted to the session by the Open ID provider.
     * If null, then Open ID was not used for the session.
     */
    oidAccessToken?: string | null;

    /**
     * The type of the access token that was granted to the session by the Open ID provider.
     * If null, then Open ID was not used for the session.
     */
    oidTokenType?: string | null;

    /**
     * The ID token that was granted to the session by the Open ID provider.
     * If null, then Open ID was not used for the session.
     */
    oidIdToken?: string | null;

    /**
     * The refresh token that was granted to the session by the Open ID provider.
     * If null, then Open ID was not used for the session.
     */
    oidRefreshToken?: string | null;

    /**
     * The Open ID scope that was granted to the session.
     * If null, then Open ID was not used for the session.
     */
    oidScope?: string | null;

    /**
     * The unix timestamp in seconds that the oidAccessToken expires at.
     * If null, then Open ID was not used for the session.
     */
    oidExpiresAtMs?: number | null;

    /**
     * Whether the session is able to be revoked by the user.
     * Setting this to false will prevent the user from revoking the session.
     * Additionally, users will not be able to replace the session either.
     * If false, then the session cannot be revoked by the user.
     * If true, then the session can be revoked by the user.
     * Default is true.
     */
    revocable?: boolean;
}

/**
 * Defines an interface that represents a login request for an Open ID login.
 */
export interface AuthOpenIDLoginRequest {
    /**
     * The ID of the request.
     */
    requestId: string;

    /**
     * The state generated for the request.
     */
    state: string;

    /**
     * The name of the provider that was used for the Open ID login.
     */
    provider: string;

    /**
     * The code that the Open ID authorization response should match.
     */
    codeVerifier: string;

    /**
     * The code challenge method that the Open ID authorization response should match.
     */
    codeMethod: string;

    /**
     * The URL that was used as the authorization URL in the Open ID authorization code flow.
     */
    authorizationUrl: string;

    /**
     * The URL that was used as the redirect URL in the Open ID authorization code flow.
     */
    redirectUrl: string;

    /**
     * The scope that was requested.
     */
    scope: string;

    /**
     * The unix timestamp in miliseconds that the request was made at.
     */
    requestTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the request will expire at.
     */
    expireTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the request was completed at.
     * If null, then the request has not been completed.
     */
    completedTimeMs: number | null;

    /**
     * The unix timestamp that the authorization code was registered for the login request.
     * Null/undefined if the request has not been authorized yet.
     */
    authorizationTimeMs?: number | null;

    /**
     * The authorization code that was recieved for the request.
     */
    authorizationCode?: string;

    /**
     * The IP Address that the request came from.
     */
    ipAddress: string;
}

export interface AuthSubscription {
    id: string;
    stripeSubscriptionId: string;
    userId: string;
    studioId: string;

    /**
     * The ID of the stripe customer that is associated with this subscription.
     */
    stripeCustomerId: string | null;

    /**
     * The current status of the subscription.
     */
    subscriptionStatus: string | null;

    /**
     * The ID of the purchasable subscription that the user has.
     * Note that this is the ID of the subscription in the config, not the ID of the stripe subscription.
     */
    subscriptionId: string;

    /**
     * The unix time in miliseconds that the current subscription period started at.
     */
    currentPeriodStartMs: number | null;

    /**
     * The unix time in miliseconds that the current subscription period ends at.
     */
    currentPeriodEndMs: number | null;
}

export interface AuthSubscriptionPeriod {
    id: string;

    /**
     * The ID of the subscription that this period is for.
     */
    subscriptionId: string;

    /**
     * The ID of the invoice for this period.
     */
    invoiceId: string;

    /**
     * The unix time in miliseconds that the subscription period started at.
     */
    periodStartMs: number;

    /**
     * The unix time in miliseconds that the subscription period ends at.
     */
    periodEndMs: number;
}

export interface AuthInvoice {
    id: string;

    /**
     * The ID of the stripe invoice that is associated with this invoice.
     */
    stripeInvoiceId: string;

    /**
     * The ID of the subscription that this invoice is for.
     * Null if no subscription is associated with this invoice.
     */
    subscriptionId: string | null;

    /**
     * The ID of the checkout session that this invoice is for.
     * Null if no checkout session is associated with this invoice.
     */
    checkoutSessionId: string | null;

    /**
     * The ID of the subscription period that this invoice is for.
     * Null if no subscription period is associated with this invoice.
     */
    periodId: string | null;

    /**
     * The description of the invoice.
     */
    description: string;

    /**
     * The status of the invoice.
     */
    status: string;

    /**
     * Whether the invoice is paid.
     */
    paid: boolean;

    /**
     * The three-letter ISO code for the currency that the invoice is in.
     */
    currency: string;

    /**
     * The amount of the invoice in the smallest unit of the currency.
     */
    total: number;

    /**
     * The subtotal of the invoice.
     */
    subtotal: number;

    /**
     * The amount of tax collected.
     */
    tax: number;

    /**
     * The URL of the stripe hosted invoice.
     * Users can use this to pay and see the invoice.
     */
    stripeHostedInvoiceUrl: string;

    /**
     * The URL of the stripe hosted invoice PDF.
     */
    stripeInvoicePdfUrl: string;
}

export type SaveNewUserResult = SaveNewUserSuccess | SaveNewUserFailure;

export interface SaveNewUserSuccess {
    success: true;
}

export interface SaveNewUserFailure {
    success: false;
    errorCode: 'user_already_exists' | ServerError;
    errorMessage: string;
}

export type ListSessionsDataResult =
    | ListSessionsDataSuccess
    | ListSessionsDataFailure;

export interface ListSessionsDataSuccess {
    success: true;
    sessions: AuthSession[];
}

export interface ListSessionsDataFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export interface UpdateSubscriptionInfoRequest {
    /**
     * The ID of the user that the subscription info should be updated for.
     */
    userId?: string;

    /**
     * The ID of the studio that the subscription info should be updated for.
     */
    studioId?: string;

    /**
     * The current status of the subscription.
     */
    subscriptionStatus: string;

    /**
     * The ID of the purchasable subscription that the user has.
     */
    subscriptionId: string;

    /**
     * The ID of the subscription in Stripe's database.
     * If null, then the subscription is not associated with a stripe subscription.
     */
    stripeSubscriptionId: string | null;

    /**
     * The ID of the stripe customer.
     * If null, then the subscription is not associated with a stripe customer.
     * Note that if the user already has a customer ID, and null is provided, then the customer ID will not be updated.
     */
    stripeCustomerId: string | null;

    /**
     * The unix time in miliseconds that the current subscription period started at.
     */
    currentPeriodStartMs: number;

    /**
     * The unix time in miliseconds that the current subscription period ends at.
     */
    currentPeriodEndMs: number;
}

export interface UpdateSubscriptionPeriodRequest {
    /**
     * The ID of the user that the subscription info should be updated for.
     */
    userId?: string;

    /**
     * The ID of the studio that the subscription info should be updated for.
     */
    studioId?: string;

    /**
     * The current status of the subscription.
     */
    subscriptionStatus: string;

    /**
     * The ID of the purchasable subscription that the user has.
     */
    subscriptionId: string;

    /**
     * The ID of the subscription in Stripe's database.
     */
    stripeSubscriptionId: string;

    /**
     * The ID of the stripe customer.
     */
    stripeCustomerId: string;

    /**
     * The unix time in miliseconds that the current subscription period started at.
     */
    currentPeriodStartMs: number;

    /**
     * The unix time in miliseconds that the current subscription period ends at.
     */
    currentPeriodEndMs: number;

    /**
     * The invoice that should be created.
     */
    invoice: Omit<
        AuthInvoice,
        'id' | 'subscriptionId' | 'periodId' | 'checkoutSessionId'
    >;
}

/**
 * Defines metadata that is included after a user successfully logs in.
 */
export interface UserLoginMetadata {
    /**
     * Whether the user has a registered user authenticator (passkey).
     * Should be used as a hint to the client to prompt the user to register a passkey.
     * If null or undefined, then the user does not have a passkey.
     */
    hasUserAuthenticator: boolean;

    /**
     * The list of active user authenticator credential IDs that the user has registered.
     * Can be used by the client to determine if this device has already registered a user authenticator.
     * If empty, then the user does not have any user authenticators.
     */
    userAuthenticatorCredentialIds: string[];

    /**
     * Whether the user has a registered push subscription.
     * Should be used as a hint to the client to prompt the user to register a push subscription for their device.
     * If null or undefined, then the user does not have a push subscription.
     */
    hasPushSubscription: boolean;

    /**
     * The list of active push subscription IDs that the user has registered.
     * Can be used by the client to determine if this device has already registered a push subscription.
     * Each ID is a UUIDv5 of the endpoint of the push subscription and the subscription ID namespace.
     * If the user has a push subscription, but the list doesn't contain the current push subscription, then the device should re-register the push subscription.
     * If empty, then the user does not have any push subscriptions.
     */
    pushSubscriptionIds: string[];
}

/**
 * Defines an interface that represents a checkout session for a purchasable item.
 */
export interface AuthCheckoutSession {
    /**
     * The ID of the session.
     */
    id: string;

    /**
     * Whether the checkout session has been paid for or not.
     */
    paid: boolean;

    /**
     * The items that are in the checkout session.
     */
    items: AuthCheckoutSessionItem[];

    /**
     * The unix time in miliseconds that the checkout session has been fulfilled at by
     * granting the user access to their items.
     */
    fulfilledAtMs: number | null;

    /**
     * The status of the checkout session.
     */
    stripeStatus: CheckoutSessionStatus;

    /**
     * The payment status of the checkout session.
     */
    stripePaymentStatus: CheckoutSessionPaymentStatus;

    /**
     * The ID of the stripe checkout session that is associated with this session.
     */
    stripeCheckoutSessionId: string;

    /**
     * The ID of the user that the checkout session is for.
     */
    userId: string | null;

    /**
     * The ID of the invoice that the session has.
     * Null if no invoice was created for the checkout session.
     */
    invoiceId: string | null;

    /**
     * The transaction ID that should be associated with the checkout session.
     */
    transactionId?: string | null;

    /**
     * The transfers that should be posted/voided for the checkout session.
     */
    pendingTransferIds?: string[] | null;
}

export type AuthCheckoutSessionItem =
    | AuthCheckoutSessionRoleItem
    | AuthCheckoutSessionContractItem;

export interface AuthCheckoutSessionRoleItem {
    /**
     * The type of the item.
     */
    type: 'role';

    /**
     * The name of the record that the role is being purchased in.
     */
    recordName: string;

    /**
     * The address of the purchasable item.
     */
    purchasableItemAddress: string;

    /**
     * The role that is being purchased.
     */
    role: string;

    /**
     * The number of miliseconds that the role is being purchased for.
     */
    roleGrantTimeMs: number | null;
}

export interface AuthCheckoutSessionContractItem {
    type: 'contract';

    /**
     * The name of the record that the contract is being purchased in.
     */
    recordName: string;

    /**
     * The address of the contract.
     */
    contractAddress: string;

    /**
     * The ID of the contract that is being purchased.
     */
    contractId: string;

    /**
     * The value of the contract being purchased.
     */
    value: number;
}

/**
 * The status of the stripe checkout session.
 */
export type CheckoutSessionStatus = 'open' | 'expired' | 'complete';

/**
 * The payment status of the checkout session.
 */
export type CheckoutSessionPaymentStatus =
    | 'no_payment_required'
    | 'paid'
    | 'unpaid';

/**
 * Defines an interface that represents an item that has been purchased.
 */
export interface PurchasedItem {
    /**
     * The ID of the item.
     */
    id: string;

    /**
     * The name of the record that the item was purchased from.
     */
    recordName: string;

    /**
     * The address of the purchasable item.
     */
    purchasableItemAddress: string;

    /**
     * The ID of the user that purchased the item.
     * Null if the purchase wasn't associated with a user (purchased by a guest or purchased as an access key).
     */
    userId: string | null;

    /**
     * The ID of the checkout session that the item was purchased through.
     * Null if the purchase wasn't associated with a checkout session.
     */
    checkoutSessionId: string | null;

    /**
     * The name of the role that is granted by the purchasable item.
     */
    roleName: string;

    /**
     * The number of miliseconds that the role is granted for.
     * If null, then the role is granted indefinitely.
     */
    roleGrantTimeMs: number | null;

    /**
     * The unix timestamp in miliseconds when the item was activated.
     * Null if the item has not been activated.
     */
    activatedTimeMs: number | null;

    /**
     * The ID of the activation key that was used to activate the item.
     * Null if the item is associated with a user.
     */
    activationKeyId: string | null;
}

/**
 * Defines an interface for a key that can be used to activate a purchased item.
 */
export interface ActivationKey {
    /**
     * The ID of the activation key.
     */
    id: string;

    /**
     * The hash of the secret for the key.
     */
    secretHash: string;
}

export interface UpdateCheckoutSessionRequest {
    /**
     * The ID of the session.
     */
    id: string;

    /**
     * The status of the checkout session.
     */
    status: CheckoutSessionStatus;

    /**
     * The payment status of the checkout session.
     */
    paymentStatus: CheckoutSessionPaymentStatus;

    /**
     * Whether the checkout session has been paid for or not.
     */
    paid: boolean;

    /**
     * The items in the session.
     */
    items: AuthCheckoutSessionItem[];

    /**
     * The ID of the stripe checkout session that is associated with this session.
     */
    stripeCheckoutSessionId: string;

    /**
     * The ID of the user that the checkout session is for.
     */
    userId: string | null;

    /**
     * The unix time in miliseconds that the checkout session was fulfilled at.
     */
    fulfilledAtMs: number | null;

    /**
     * The invoice that should be created/updated.
     * If null, then the invoice will not be created/updated.
     */
    invoice: Omit<
        AuthInvoice,
        'id' | 'subscriptionId' | 'periodId' | 'checkoutSessionId'
    > | null;

    /**
     * The transaction ID that should be associated with the checkout session.
     */
    transactionId?: string | null;

    /**
     * The transfers that should be posted/voided for the checkout session.
     */
    pendingTransferIds?: string[] | null;
}
