import { RegexRule } from './Utils';
import { ServerError } from '@casual-simulation/aux-common/Errors';

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
     * Finds a login request for the given user and request ID.
     * @param userId The ID of the user.
     * @param requestId The ID of the request.
     */
    findLoginRequest(
        userId: string,
        requestId: string
    ): Promise<AuthLoginRequest | null>;

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
}

export type AddressType = 'email' | 'phone';

export interface AuthUser {
    id: string;
    name?: string | null;
    email: string | null;
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
     * The Unix time in miliseconds that the user was banned.
     * If set to any positive number, then the user should be considered banned and unable to perform any operations.
     * Null/undefined if the user is not banned and allowed access into the system.
     */
    banTimeMs?: number | null | undefined;

    /**
     * The reason for the ban.
     */
    banReason?: 'terms_of_service_violation' | null | undefined;
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
     */
    expireTimeMs: number;

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
     */
    subscriptionId: string;

    /**
     * The ID of the subscription period that this invoice is for.
     */
    periodId: string;

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
    invoice: Omit<AuthInvoice, 'id' | 'subscriptionId' | 'periodId'>;
}
