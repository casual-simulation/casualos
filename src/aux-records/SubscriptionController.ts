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
    AuthController,
    ValidateSessionKeyFailure,
} from './AuthController';
import { INVALID_KEY_ERROR_MESSAGE } from './AuthController';
import type {
    AuthStore,
    AuthUser,
    UpdateSubscriptionPeriodRequest,
} from './AuthStore';
import type {
    StripeAccount,
    StripeCheckoutRequest,
    StripeCreateAccountLinkRequest,
    StripeEvent,
    StripeEventAccountUpdated,
    StripeEventCheckoutSession,
    StripeInterface,
    StripeInvoice,
} from './StripeInterface';
import {
    STRIPE_EVENT_ACCOUNT_UPDATED_SCHEMA,
    STRIPE_EVENT_CHECKOUT_SESSION_SCHEMA,
    STRIPE_EVENT_INVOICE_PAID_SCHEMA,
} from './StripeInterface';
import type {
    NotAuthorizedError,
    NotLoggedInError,
    ServerError,
} from '@casual-simulation/aux-common/Errors';
import { isActiveSubscription } from './Utils';
import type { SubscriptionConfiguration } from './SubscriptionConfiguration';
import {
    getContractFeatures,
    getPurchasableItemsFeatures,
} from './SubscriptionConfiguration';
import type {
    ListedStudioAssignment,
    RecordsStore,
    Studio,
} from './RecordsStore';
import type {
    StripeAccountStatus,
    StripeRequirementsStatus,
} from './StripeInterface';
import type { ConfigurationStore } from './ConfigurationStore';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type {
    UserRole,
    DenialReason,
    Result,
    SimpleError,
} from '@casual-simulation/aux-common';
import {
    failure,
    isFailure,
    isSuperUserRole,
    logError,
    success,
    wrap,
} from '@casual-simulation/aux-common';

const TRACE_NAME = 'SubscriptionController';
import {
    ADMIN_ROLE_NAME,
    fromBase64String,
    toBase64String,
} from '@casual-simulation/aux-common';
import type { PurchasableItemRecordsStore } from './purchasable-items/PurchasableItemRecordsStore';
import { v4 as uuid } from 'uuid';
import type {
    AuthorizeSubjectFailure,
    ConstructAuthorizationContextFailure,
    PolicyController,
} from './PolicyController';
import type { PolicyStore } from './PolicyStore';
import { hashHighEntropyPasswordWithSalt } from '@casual-simulation/crypto';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import type { FinancialController, InternalTransfer } from './financial';
import {
    ACCOUNT_IDS,
    CurrencyCodes,
    LEDGERS,
    TransferCodes,
    TransferFlags,
} from './financial';
import type { ContractRecordsStore } from './contracts/ContractRecordsStore';

/**
 * The number of bytes that the access key secret should be.
 */
export const ACCESS_KEY_SECRET_BYTE_LENGTH = 16; // 128-bit

/**
 * The number of bytes that the access key ID should be.
 */
export const ACCESS_KEY_ID_BYTE_LENGTH = 16; // 128-bit

/**
 * Defines a class that is able to handle subscriptions.
 */
export class SubscriptionController {
    private _stripe: StripeInterface;
    private _auth: AuthController;
    private _authStore: AuthStore;
    private _recordsStore: RecordsStore;
    private _config: ConfigurationStore;
    private _policies: PolicyController;
    private _policyStore: PolicyStore;
    private _purchasableItems: PurchasableItemRecordsStore;
    private _financialController: FinancialController;
    private _contractRecords: ContractRecordsStore;

    constructor(
        stripe: StripeInterface,
        auth: AuthController,
        authStore: AuthStore,
        recordsStore: RecordsStore,
        config: ConfigurationStore,
        policies: PolicyController,
        policyStore: PolicyStore,
        purchasableItems: PurchasableItemRecordsStore,
        financialController: FinancialController,
        contractRecords: ContractRecordsStore
    ) {
        this._stripe = stripe;
        this._auth = auth;
        this._authStore = authStore;
        this._recordsStore = recordsStore;
        this._config = config;
        this._policies = policies;
        this._policyStore = policyStore;
        this._purchasableItems = purchasableItems;
        this._financialController = financialController;
        this._contractRecords = contractRecords;
    }

    private async _getConfig() {
        return await this._config.getSubscriptionConfiguration();
    }

    /**
     * Gets the status of the given user's scription.
     * @param request
     */
    @traced(TRACE_NAME)
    async getSubscriptionStatus(
        request: GetSubscriptionStatusRequest
    ): Promise<GetSubscriptionStatusResult> {
        if (!this._stripe) {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This method is not supported.',
            };
        }

        try {
            if (request.userId && request.studioId) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given request is invalid. It must not specify both a user ID and a studio ID.',
                };
            }
            if (request.userId) {
                if (
                    typeof request.userId !== 'string' ||
                    request.userId === ''
                ) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_user_id',
                        errorMessage:
                            'The given user ID is invalid. It must be a correctly formatted string.',
                    };
                }
            } else if (request.studioId) {
                if (
                    typeof request.studioId !== 'string' ||
                    request.studioId === ''
                ) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_studio_id',
                        errorMessage:
                            'The given studio ID is invalid. It must be a correctly formatted string.',
                    };
                }
            } else {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given request is invalid. It must have a valid user ID or studio ID.',
                };
            }

            const keyResult = await this._auth.validateSessionKey(
                request.sessionKey
            );

            let customerId: string;
            let role: 'user' | 'studio';
            if (keyResult.success === false) {
                return keyResult;
            } else {
                if (request.userId) {
                    if (
                        !isSuperUserRole(keyResult.role) &&
                        keyResult.userId !== request.userId
                    ) {
                        console.log(
                            '[SubscriptionController] [getSubscriptionStatus] Request User ID doesnt match session key User ID!'
                        );
                        return {
                            success: false,
                            errorCode: 'invalid_key',
                            errorMessage: INVALID_KEY_ERROR_MESSAGE,
                        };
                    }

                    const user = await this._authStore.findUser(request.userId);
                    customerId = user.stripeCustomerId;
                    role = 'user';
                } else if (request.studioId) {
                    const assignments =
                        await this._recordsStore.listStudioAssignments(
                            request.studioId,
                            {
                                userId: keyResult.userId,
                                role: 'admin',
                            }
                        );

                    if (
                        !isSuperUserRole(keyResult.role) &&
                        assignments.length <= 0
                    ) {
                        console.log(
                            '[SubscriptionController] [getSubscriptionStatus] Request user does not have access to studio!'
                        );
                        return {
                            success: false,
                            errorCode: 'invalid_key',
                            errorMessage: INVALID_KEY_ERROR_MESSAGE,
                        };
                    }

                    const studio = await this._recordsStore.getStudioById(
                        request.studioId
                    );
                    customerId = studio.stripeCustomerId;
                    role = 'studio';
                }
            }

            // const user = await this._authStore.findUser(keyResult.userId);
            // let customerId = user.stripeCustomerId;

            if (!customerId) {
                const config = await this._getConfig();
                return {
                    success: true,
                    userId: request.userId ?? keyResult.userId,
                    studioId: request.studioId,
                    publishableKey: this._stripe.publishableKey,
                    subscriptions: [],
                    purchasableSubscriptions:
                        await this._getPurchasableSubscriptions(role, config),
                };
            }

            const listResult =
                await this._stripe.listActiveSubscriptionsForCustomer(
                    customerId
                );

            const config = await this._getConfig();
            const subscriptions: SubscriptionStatus[] =
                listResult.subscriptions.map((s) => {
                    const item = s.items[0];
                    const subscriptionInfo = config.subscriptions.find(
                        (sub) => {
                            return (
                                sub.eligibleProducts &&
                                sub.eligibleProducts.some(
                                    (p) => p === item.price.product.id
                                )
                            );
                        }
                    );

                    const featureList = subscriptionInfo?.featureList;

                    return {
                        active: s.status === 'active',
                        statusCode: s.status,
                        startDate: s.start_date,
                        cancelDate: s.cancel_at,
                        canceledDate: s.canceled_at,
                        endedDate: s.ended_at,
                        currentPeriodEnd: s.current_period_end,
                        currentPeriodStart: s.current_period_start,
                        renewalInterval: item.price.interval,
                        intervalLength: item.price.interval_count,
                        intervalCost: item.price.unit_amount,
                        currency: item.price.currency,
                        productName: item.price.product.name,
                        featureList,
                    };
                });

            const purchasableSubscriptions =
                subscriptions.length > 0
                    ? []
                    : await this._getPurchasableSubscriptions(role, config);

            return {
                success: true,
                userId: request.userId ?? keyResult.userId,
                studioId: request.studioId,
                publishableKey: this._stripe.publishableKey,
                subscriptions,
                purchasableSubscriptions,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[SubscriptionController] An error occurred while getting subscription status:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to update the subscription for the given user.
     * @param request The request to update the subscription.
     */
    @traced(TRACE_NAME)
    async updateSubscription(
        request: UpdateSubscriptionRequest
    ): Promise<UpdateSubscriptionResult> {
        try {
            if (!request.currentUserId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'You must be logged in to update a subscription.',
                };
            }

            if (!isSuperUserRole(request.currentUserRole)) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                };
            }

            if (!request.userId && !request.studioId) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        'The given request is invalid. It must have a user ID or studio ID.',
                };
            }

            if (request.userId) {
                console.log(
                    `[SubscriptionController] [updateSubscription currentUserId: ${request.currentUserId}, userId: ${request.userId}, subscriptionId: ${request.subscriptionId}, subscriptionStatus: ${request.subscriptionStatus}] Updating subscription.`
                );

                const user = await this._authStore.findUser(request.userId);

                if (!user) {
                    return {
                        success: false,
                        errorCode: 'user_not_found',
                        errorMessage: 'The user could not be found.',
                    };
                }

                if (
                    user.subscriptionInfoId &&
                    isActiveSubscription(
                        user.subscriptionStatus,
                        user.subscriptionPeriodStartMs,
                        user.subscriptionPeriodEndMs
                    )
                ) {
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'The user already has an active stripe subscription. Currently, this operation only supports updating the subscription of a user who does not have an active stripe subscription.',
                    };
                }

                await this._authStore.updateSubscriptionInfo({
                    userId: user.id,
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionId
                        ? request.subscriptionStatus
                        : null,
                    currentPeriodStartMs: request.subscriptionId
                        ? request.subscriptionPeriodStartMs
                        : null,
                    currentPeriodEndMs: request.subscriptionId
                        ? request.subscriptionPeriodEndMs
                        : null,
                    stripeCustomerId: null,
                    stripeSubscriptionId: null,
                });

                return {
                    success: true,
                };
            } else {
                console.log(
                    `[SubscriptionController] [updateSubscription currentUserId: ${request.currentUserId}, studioId: ${request.studioId}, subscriptionId: ${request.subscriptionId}, subscriptionStatus: ${request.subscriptionStatus}] Updating subscription.`
                );

                const studio = await this._recordsStore.getStudioById(
                    request.studioId
                );

                if (!studio) {
                    return {
                        success: false,
                        errorCode: 'studio_not_found',
                        errorMessage: 'The studio could not be found.',
                    };
                }

                if (
                    studio.subscriptionInfoId &&
                    isActiveSubscription(
                        studio.subscriptionStatus,
                        studio.subscriptionPeriodStartMs,
                        studio.subscriptionPeriodEndMs
                    )
                ) {
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'The studio already has an active stripe subscription. Currently, this operation only supports updating the subscription of a studio which does not have an active stripe subscription.',
                    };
                }

                await this._authStore.updateSubscriptionInfo({
                    studioId: studio.id,
                    subscriptionId: request.subscriptionId,
                    subscriptionStatus: request.subscriptionId
                        ? request.subscriptionStatus
                        : null,
                    currentPeriodStartMs: request.subscriptionId
                        ? request.subscriptionPeriodStartMs
                        : null,
                    currentPeriodEndMs: request.subscriptionId
                        ? request.subscriptionPeriodEndMs
                        : null,
                    stripeCustomerId: null,
                    stripeSubscriptionId: null,
                });

                return {
                    success: true,
                };
            }
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[SubscriptionController] An error occurred while updating a subscription:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    private _getPurchasableSubscriptionsForRole(
        role: 'user' | 'studio',
        config: SubscriptionConfiguration
    ) {
        return config.subscriptions.filter((s) => {
            const isPurchasable = s.purchasable ?? true;
            const isUserOnly = s.userOnly ?? false;
            const isStudioOnly = s.studioOnly ?? false;
            const matchesRole =
                (isUserOnly && role === 'user') ||
                (isStudioOnly && role === 'studio') ||
                (!isUserOnly && !isStudioOnly);
            return isPurchasable && matchesRole;
        });
    }

    private async _getPurchasableSubscriptions(
        role: 'user' | 'studio',
        config: SubscriptionConfiguration
    ): Promise<PurchasableSubscription[]> {
        const promises = this._getPurchasableSubscriptionsForRole(
            role,
            config
        ).map(async (s) => {
            if (s.product) {
                return {
                    sub: s,
                    info: await this._stripe.getProductAndPriceInfo(s.product),
                };
            } else {
                return {
                    sub: s,
                    info: {
                        description: s.description,
                        name: s.name,
                        default_price: null,
                        id: null,
                    },
                };
            }
        });
        const productInfo = await Promise.all(promises);

        return productInfo
            .filter((i) => !!i.info)
            .map((i) => {
                let prices: PurchasableSubscription['prices'] = [];
                if (i.info.default_price) {
                    prices.push({
                        id: 'default',
                        currency: i.info.default_price.currency,
                        cost: i.info.default_price.unit_amount,
                        interval: i.info.default_price.recurring.interval,
                        intervalLength:
                            i.info.default_price.recurring.interval_count,
                    });
                }
                let result: PurchasableSubscription = {
                    id: i.sub.id,
                    name: i.info.name,
                    description: i.info.description,
                    featureList: i.sub.featureList,
                    prices,
                };

                if ('defaultSubscription' in i.sub) {
                    result.defaultSubscription = i.sub.defaultSubscription;
                }

                return result;
            });
    }

    /**
     * Creates a link that the user can be redirected to in order to manage their subscription.
     * Returns a link that the user can be redirected to to initiate a purchase of the subscription.
     */
    @traced(TRACE_NAME)
    async createManageSubscriptionLink(
        request: CreateManageSubscriptionRequest
    ): Promise<CreateManageSubscriptionResult> {
        if (!this._stripe) {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This method is not supported.',
            };
        }

        try {
            if (request.userId && request.studioId) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given request is invalid. It must not specify both a user ID and a studio ID.',
                };
            }

            if (request.userId) {
                if (
                    typeof request.userId !== 'string' ||
                    request.userId === ''
                ) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_user_id',
                        errorMessage:
                            'The given user ID is invalid. It must be a correctly formatted string.',
                    };
                }
            } else if (request.studioId) {
                if (
                    typeof request.studioId !== 'string' ||
                    request.studioId === ''
                ) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_studio_id',
                        errorMessage:
                            'The given studio ID is invalid. It must be a correctly formatted string.',
                    };
                }
            } else {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given request is invalid. It must have a valid user ID or studio ID.',
                };
            }

            if (
                !!request.subscriptionId &&
                typeof request.subscriptionId !== 'string'
            ) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given Subscription ID is invalid. If provided, it must be a correctly formatted string.',
                };
            }

            if (
                !!request.expectedPrice &&
                typeof request.expectedPrice !== 'object'
            ) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given Price ID is invalid. If provided, it must be an object.',
                };
            }

            const keyResult = await this._auth.validateSessionKey(
                request.sessionKey
            );

            let customerId: string;
            let customerName: string;
            let customerEmail: string;
            let customerPhone: string;
            let role: 'user' | 'studio';
            let user: AuthUser;
            let studio: Studio;
            let customerMetadata: any = {};
            let metadata: any = {};
            if (keyResult.success === false) {
                return keyResult;
            } else if (request.userId) {
                if (keyResult.userId !== request.userId) {
                    console.log(
                        '[SubscriptionController] [createManageSubscriptionLink] Request User ID doesnt match session key User ID!'
                    );
                    return {
                        success: false,
                        errorCode: 'invalid_key',
                        errorMessage: INVALID_KEY_ERROR_MESSAGE,
                    };
                }

                user = await this._authStore.findUser(keyResult.userId);
                customerId = user.stripeCustomerId;
                customerName = user.name;
                customerEmail = user.email;
                customerPhone = user.phoneNumber;
                metadata.userId = user.id;
                customerMetadata.role = 'user';
                customerMetadata.userId = user.id;
                role = 'user';

                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Creating a checkout/management session for User (${keyResult.userId}).`
                );
            } else if (request.studioId) {
                const assignments =
                    await this._recordsStore.listStudioAssignments(
                        request.studioId,
                        {
                            role: 'admin',
                        }
                    );

                const userAssignment = assignments.find(
                    (a) => a.userId === keyResult.userId
                );

                if (!userAssignment) {
                    console.log(
                        '[SubscriptionController] [getSubscriptionStatus] Request user does not have access to studio!'
                    );
                    return {
                        success: false,
                        errorCode: 'invalid_key',
                        errorMessage: INVALID_KEY_ERROR_MESSAGE,
                    };
                }
                studio = await this._recordsStore.getStudioById(
                    request.studioId
                );
                customerId = studio.stripeCustomerId;
                customerName = studio.displayName;
                customerMetadata.role = 'studio';
                customerMetadata.studioId = studio.id;
                metadata.studioId = studio.id;

                let primaryAssignment: ListedStudioAssignment;

                if (userAssignment.isPrimaryContact) {
                    primaryAssignment = userAssignment;
                } else {
                    primaryAssignment = assignments.find(
                        (a) => a.isPrimaryContact
                    );
                }

                if (primaryAssignment) {
                    customerEmail = primaryAssignment.user.email;
                    customerPhone = primaryAssignment.user.phoneNumber;
                    metadata.contactUserId = keyResult.userId;
                    customerMetadata.contactUserId = keyResult.userId;
                }

                role = 'studio';

                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Creating a checkout/management session for Studio (userId: ${keyResult.userId}, studioId: ${studio.id}).`
                );
            } else {
                throw new Error('Should not reach this point');
            }

            metadata.subjectId = keyResult.userId;

            const config = await this._getConfig();
            if (!customerId) {
                if (config.subscriptions.length <= 0) {
                    return {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage: 'New subscriptions are not supported.',
                    };
                }

                console.log(
                    '[SubscriptionController] [createManageSubscriptionLink] No Stripe Customer ID. Creating New Customer and Checkout Session in Stripe.'
                );
                const result = await this._stripe.createCustomer({
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    metadata: customerMetadata,
                });

                customerId = result.id;

                if (user) {
                    user.stripeCustomerId = customerId;
                    console.log(
                        `[SubscriptionController] [createManageSubscriptionLink] Saving Stripe Customer ID (${customerId}) to User Record (${user.id}).`
                    );
                    await this._authStore.saveUser({
                        ...user,
                    });
                } else if (studio) {
                    studio.stripeCustomerId = customerId;

                    console.log(
                        `[SubscriptionController] [createManageSubscriptionLink] Saving Stripe Customer ID (${customerId}) to Studio Record (${studio.id}).`
                    );
                    await this._recordsStore.updateStudio({
                        ...studio,
                    });
                }

                return await this._createCheckoutSession(
                    request,
                    customerId,
                    metadata,
                    role,
                    user,
                    studio
                );
            }

            console.log(
                `[SubscriptionController] [createManageSubscriptionLink] Has Stripe Customer ID (${customerId}). Checking active subscriptions for customer.`
            );
            const subs = await this._stripe.listActiveSubscriptionsForCustomer(
                customerId
            );

            const hasSubscription = subs.subscriptions.some((s) => {
                const isManagable =
                    s.status === 'active' ||
                    s.status === 'trialing' ||
                    s.status === 'paused' ||
                    s.status === 'incomplete' ||
                    s.status === 'past_due' ||
                    s.status === 'unpaid';

                if (!isManagable) {
                    return false;
                }

                const hasManagableProduct = config.subscriptions.some(
                    (sub) =>
                        sub.eligibleProducts &&
                        sub.eligibleProducts.some((p) =>
                            s.items.some((i) => i.price.product.id === p)
                        )
                );

                return hasManagableProduct;
            });

            if (hasSubscription) {
                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Customer has a managable subscription. Creating a portal session.`
                );
                const session = await this._stripe.createPortalSession({
                    ...(config.portalConfig ?? {}),
                    customer: customerId,
                    return_url: returnRoute(config.returnUrl, user, studio),
                });

                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Portal session success!`
                );

                return {
                    success: true,
                    url: session.url,
                };
            }

            console.log(
                `[SubscriptionController] [createManageSubscriptionLink] Customer does not have a managable subscription. Creating a checkout session.`
            );
            return await this._createCheckoutSession(
                request,
                customerId,
                metadata,
                role,
                user,
                studio
            );
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[SubscriptionController] An error occurred while creating a manage subscription link:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Creates a link that the user can be redirected to in order to manage their store account.
     * @param request The request to create the manage store account link.
     * @returns
     */
    async createManageStoreAccountLink(
        request: CreateManageStoreAccountLinkRequest
    ): Promise<ManageAccountLinkResult> {
        if (!this._stripe) {
            return failure({
                errorCode: 'not_supported',
                errorMessage: 'This method is not supported.',
            });
        }

        let studio = await this._recordsStore.getStudioById(request.studioId);

        if (!studio) {
            return failure({
                errorCode: 'studio_not_found',
                errorMessage: 'The given studio was not found.',
            });
        }

        const assignments = await this._recordsStore.listStudioAssignments(
            studio.id,
            {
                userId: request.userId,
                role: ADMIN_ROLE_NAME,
            }
        );

        if (assignments.length <= 0) {
            return failure({
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
            });
        }

        const config = await this._config.getSubscriptionConfiguration();
        const features = getPurchasableItemsFeatures(
            config,
            studio.subscriptionStatus,
            studio.subscriptionId,
            'studio',
            studio.subscriptionPeriodStartMs,
            studio.subscriptionPeriodEndMs
        );

        if (!features.allowed) {
            return failure({
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
            });
        }

        let type: StripeCreateAccountLinkRequest['type'] = 'account_update';
        if (!studio.stripeAccountId) {
            console.log(
                '[SubscriptionController] [createManageStoreAccountLink] Studio does not have a stripe account. Creating one.'
            );
            type = 'account_onboarding';
            const account = await this._stripe.createAccount({
                controller: {
                    fees: {
                        payer: 'account',
                    },
                    losses: {
                        payments: 'stripe',
                    },
                    requirement_collection: 'stripe',
                    stripe_dashboard: {
                        type: 'full',
                    },
                },
                metadata: {
                    studioId: studio.id,
                },
            });

            console.log(
                '[SubscriptionController] [createManageStoreAccountLink] Created account:',
                account.id
            );

            studio = {
                ...studio,
                stripeAccountId: account.id,
                stripeAccountStatus: getAccountStatus(account),
                stripeAccountRequirementsStatus:
                    getAccountRequirementsStatus(account),
            };
            await this._recordsStore.updateStudio(studio);
        }

        if (studio.stripeAccountRequirementsStatus === 'incomplete') {
            type = 'account_onboarding';
        }

        const session = await this._stripe.createAccountLink({
            account: studio.stripeAccountId,
            refresh_url: config.returnUrl,
            return_url: config.returnUrl,
            type,
        });

        return success({
            url: session.url,
        });
    }

    /**
     * Creates a link that the user can be redirected to in order to manage their stripe XP account.
     * @param request The request to create the manage xp account link.
     */
    async createManageXpAccountLink(
        request: CreateManageXpAccountLinkRequest
    ): Promise<ManageAccountLinkResult> {
        if (!this._stripe || !this._financialController) {
            return failure({
                errorCode: 'not_supported',
                errorMessage: 'This method is not supported.',
            });
        }

        let user = await this._authStore.findUser(request.userId);

        if (!user) {
            console.log(
                '[SubscriptionController] [createManageXpAccountLink] User not found.'
            );
            return failure({
                errorCode: 'user_not_found',
                errorMessage: 'The user was not found.',
            });
        }

        let updatedUser = false;

        const config = await this._config.getSubscriptionConfiguration();
        const account =
            await this._financialController.getOrCreateFinancialAccount({
                userId: user.id,
                ledger: LEDGERS.usd,
            });
        if (isFailure(account)) {
            logError(
                account.error,
                `[SubscriptionController] [createManageXpAccountLink] Failed to get USD financial account for user: ${user.id}`
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: 'Failed to get financial account.',
            });
        }

        let type: StripeCreateAccountLinkRequest['type'] = 'account_update';
        if (!user.stripeAccountId) {
            console.log(
                '[SubscriptionController] [createManageXpAccountLink] User does not have a stripe account. Creating one.'
            );
            type = 'account_onboarding';
            const account = await this._stripe.createAccount({
                controller: {
                    fees: {
                        payer: 'application',
                    },
                    losses: {
                        payments: 'application',
                    },
                    requirement_collection: 'stripe',
                    stripe_dashboard: {
                        type: 'express',
                    },
                },
                metadata: {
                    userId: user.id,
                },
            });

            console.log(
                '[SubscriptionController] [createManageXpAccountLink] Created account:',
                account.id
            );

            user = {
                ...user,
                stripeAccountId: account.id,
                stripeAccountStatus: getAccountStatus(account),
                stripeAccountRequirementsStatus:
                    getAccountRequirementsStatus(account),
            };
            updatedUser = true;
        }

        if (updatedUser) {
            await this._authStore.saveUser(user);
        }

        if (user.stripeAccountRequirementsStatus === 'incomplete') {
            type = 'account_onboarding';
        }

        const session = await this._stripe.createAccountLink({
            account: user.stripeAccountId,
            refresh_url: config.returnUrl,
            return_url: config.returnUrl,
            type,
        });

        return success({
            url: session.url,
        });
    }

    @traced(TRACE_NAME)
    private async _createCheckoutSession(
        request: CreateManageSubscriptionRequest,
        customerId: string,
        metadata: any,
        role: 'user' | 'studio',
        user: AuthUser,
        studio: Studio
    ): Promise<CreateManageSubscriptionResult> {
        const config = await this._getConfig();
        const purchasableSubscriptions =
            this._getPurchasableSubscriptionsForRole(role, config);

        let sub: SubscriptionConfiguration['subscriptions'][0];
        if (request.subscriptionId) {
            sub = purchasableSubscriptions.find(
                (s) => s.id === request.subscriptionId
            );
            if (sub) {
                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Using specified subscription (${request.subscriptionId}).`
                );
            }
        }

        if (!sub || !sub.product || sub.purchasable === false) {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'The given subscription is not purchasable.',
            };
        }

        const productInfo = await this._stripe.getProductAndPriceInfo(
            sub.product
        );

        if (request.expectedPrice) {
            if (
                request.expectedPrice.currency !==
                    productInfo.default_price.currency ||
                request.expectedPrice.cost !==
                    productInfo.default_price.unit_amount ||
                request.expectedPrice.interval !==
                    productInfo.default_price.recurring.interval ||
                request.expectedPrice.intervalLength !==
                    productInfo.default_price.recurring.interval_count
            ) {
                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Expected price does not match actual price.`
                );
                return {
                    success: false,
                    errorCode: 'price_does_not_match',
                    errorMessage:
                        'The expected price does not match the actual price.',
                };
            }
        }

        console.log(
            `[SubscriptionController] [createManageSubscriptionLink] Creating Checkout Session.`
        );

        const session = await this._stripe.createCheckoutSession({
            ...(config.checkoutConfig ?? {}),
            customer: customerId,
            success_url: returnRoute(config.successUrl, user, studio),
            cancel_url: returnRoute(config.cancelUrl, user, studio),
            line_items: [
                {
                    price: productInfo.default_price.id,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            metadata: metadata,
        });

        console.log(
            `[SubscriptionController] [createManageSubscriptionLink] Checkout Session Success!`
        );

        return {
            success: true,
            url: session.url,
        };
    }

    async createPurchaseItemLink(
        request: CreatePurchaseItemLinkRequest
    ): Promise<CreatePurchaseItemLinkResult> {
        try {
            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.item.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            const item = await this._purchasableItems.getItemByAddress(
                request.item.recordName,
                request.item.address
            );

            if (!item) {
                return {
                    success: false,
                    errorCode: 'item_not_found',
                    errorMessage: 'The item could not be found.',
                };
            }

            if (
                item.currency !== request.item.currency ||
                item.cost !== request.item.expectedCost
            ) {
                return {
                    success: false,
                    errorCode: 'price_does_not_match',
                    errorMessage:
                        'The expected price does not match the actual price of the item.',
                };
            }

            const recordName = context.context.recordName;
            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        resourceKind: 'purchasableItem',
                        resourceId: item.address,
                        markers: item.markers,
                        action: 'purchase',
                        instances: request.instances,
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            const metrics = await this._purchasableItems.getSubscriptionMetrics(
                {
                    ownerId: context.context.recordOwnerId,
                    studioId: context.context.recordStudioId,
                }
            );
            const config = await this._getConfig();
            const features = getPurchasableItemsFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                'studio',
                metrics.currentPeriodStartMs,
                metrics.currentPeriodEndMs
            );

            if (!features.allowed) {
                console.log(
                    `[SubscriptionController] [createPurchaseItemLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} subscriptionStatus: ${metrics.subscriptionStatus}] Store features not allowed.`
                );
                return {
                    success: false,
                    errorCode: 'store_disabled',
                    errorMessage:
                        'The store you are trying to purchase from is disabled.',
                };
            }

            if (!metrics.stripeAccountId || !metrics.stripeAccountStatus) {
                console.log(
                    `[SubscriptionController] [createPurchaseItemLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} subscriptionStatus: ${metrics.subscriptionStatus} stripeAccountId: ${metrics.stripeAccountId} stripeAccountStatus: ${metrics.stripeAccountStatus}] Store has no stripe account.`
                );
                return {
                    success: false,
                    errorCode: 'store_disabled',
                    errorMessage:
                        'The store you are trying to purchase from is disabled.',
                };
            }

            if (metrics.stripeAccountStatus !== 'active') {
                console.log(
                    `[SubscriptionController] [createPurchaseItemLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} subscriptionStatus: ${metrics.subscriptionStatus} stripeAccountId: ${metrics.stripeAccountId} stripeAccountStatus: ${metrics.stripeAccountStatus}] Store stripe account is not active.`
                );
                return {
                    success: false,
                    errorCode: 'store_disabled',
                    errorMessage:
                        'The store you are trying to purchase from is disabled.',
                };
            }

            const limits = features.currencyLimits[item.currency];

            if (!limits) {
                console.log(
                    `[SubscriptionController] [createPurchaseItemLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} currency: ${request.item.currency}] Currency not supported.`
                );
                return {
                    success: false,
                    errorCode: 'currency_not_supported',
                    errorMessage: 'The currency is not supported.',
                };
            }

            if (
                item.cost !== 0 &&
                (item.cost < limits.minCost || item.cost > limits.maxCost)
            ) {
                console.log(
                    `[SubscriptionController] [createPurchaseItemLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} currency: ${request.item.currency} minCost: ${limits.minCost} maxCost: ${limits.maxCost} cost: ${item.cost}] Cost not valid.`
                );
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The item you are trying to purchase has a price that is not allowed.',
                };
            }

            let applicationFee = 0;
            if (item.cost !== 0 && limits.fee) {
                if (limits.fee.type === 'percent') {
                    // calculate percent when fee is between 1 - 100
                    applicationFee = Math.ceil(
                        item.cost * (limits.fee.percent / 100)
                    );
                } else {
                    if (limits.fee.amount > item.cost) {
                        console.warn(
                            `[SubscriptionController] [createPurchaseItemLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} currency: ${request.item.currency} fee: ${limits.fee.amount} cost: ${item.cost}] Fee greater than cost.`
                        );
                        return {
                            success: false,
                            errorCode: 'server_error',
                            errorMessage:
                                'The application fee is greater than the cost of the item.',
                        };
                    }
                    applicationFee = limits.fee.amount;
                }
            }

            let customerEmail: string = null;
            if (request.userId) {
                const user = await this._authStore.findUser(request.userId);

                if (!user) {
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'The user could not be found.',
                    };
                }

                const roles = await this._policyStore.listRolesForUser(
                    recordName,
                    user.id
                );
                const hasRole = roles.some(
                    (r) =>
                        r.role === item.roleName &&
                        (!r.expireTimeMs || r.expireTimeMs > Date.now())
                );

                if (hasRole) {
                    return {
                        success: false,
                        errorCode: 'item_already_purchased',
                        errorMessage:
                            'You already have the role that the item would grant.',
                    };
                }

                customerEmail = user.email ?? null;
            }

            const sessionId = uuid();

            console.log(
                `[SubscriptionController] [createPurchaseItemLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} sessionId: ${sessionId} currency: ${request.item.currency} cost: ${item.cost} applicationFee: ${applicationFee}] Creating checkout session.`
            );
            const session = await this._stripe.createCheckoutSession({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: item.currency,
                            unit_amount: item.cost,
                            product_data: {
                                name: item.name,
                                description: item.description,
                                images: item.imageUrls,
                                metadata: {
                                    recordName: recordName,
                                    address: item.address,
                                },
                                tax_code: item.taxCode ?? undefined,
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: fulfillmentRoute(config.returnUrl, sessionId),
                cancel_url: request.returnUrl,
                client_reference_id: sessionId,
                customer_email: customerEmail,
                metadata: {
                    userId: request.userId,
                    checkoutSessionId: sessionId,
                },
                payment_intent_data: {
                    application_fee_amount: applicationFee,
                },
                connect: {
                    stripeAccount: metrics.stripeAccountId,
                },
            });

            await this._authStore.updateCheckoutSessionInfo({
                id: sessionId,
                stripeCheckoutSessionId: session.id,
                invoice: session.invoice
                    ? {
                          currency: session.invoice.currency,
                          paid: session.invoice.paid,
                          description: session.invoice.description,
                          status: session.invoice.status,
                          stripeInvoiceId: session.invoice.id,
                          stripeHostedInvoiceUrl:
                              session.invoice.hosted_invoice_url,
                          stripeInvoicePdfUrl: session.invoice.invoice_pdf,
                          tax: session.invoice.tax,
                          total: session.invoice.total,
                          subtotal: session.invoice.subtotal,
                      }
                    : null,
                userId: request.userId,
                status: session.status,
                paymentStatus: session.payment_status,
                paid:
                    session.payment_status === 'paid' ||
                    session.payment_status === 'no_payment_required',
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'role',
                        recordName: recordName,
                        purchasableItemAddress: item.address,
                        role: item.roleName,
                        roleGrantTimeMs: item.roleGrantTimeMs,
                    },
                ],
            });

            return {
                success: true,
                url: session.url,
                sessionId: sessionId,
            };
        } catch (err) {
            console.error(
                '[SubscriptionController] An error occurred while creating a purchase item link:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async purchaseContract(
        request: PurchaseContractRequest
    ): Promise<PurchaseContractResult> {
        try {
            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.contract.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return failure(context);
            }

            const item = await this._contractRecords.getItemByAddress(
                request.contract.recordName,
                request.contract.address
            );

            if (!item) {
                return failure({
                    errorCode: 'item_not_found',
                    errorMessage: 'The item could not be found.',
                });
            }

            if (item.status !== 'pending') {
                return failure({
                    errorCode: 'item_already_purchased',
                    errorMessage: 'The contract has already been purchased.',
                });
            }

            // TODO: Pull this from the contract.
            const currency = 'usd';
            if (currency !== request.contract.currency) {
                return failure({
                    errorCode: 'price_does_not_match',
                    errorMessage:
                        'The expected price does not match the actual price of the contract.',
                });
            }

            const contractAccount =
                await this._financialController.getOrCreateFinancialAccount({
                    contractId: item.id,
                    ledger: LEDGERS.usd,
                });

            if (isFailure(contractAccount)) {
                logError(
                    contractAccount.error,
                    `[SubscriptionController] [createPurchaseContractLink] Failed to get USD financial account for contract: ${item.id}`
                );
                return failure({
                    success: false,
                    errorCode: 'server_error',
                    errorMessage:
                        'Failed to get a financial account for the contract.',
                });
            }

            const recordName = context.context.recordName;
            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        resourceKind: 'contract',
                        resourceId: item.address,
                        markers: item.markers,
                        action: 'purchase',
                        instances: request.instances,
                    }
                );

            if (authorization.success === false) {
                return failure(authorization);
            }

            const metrics = await this._contractRecords.getSubscriptionMetrics({
                ownerId: context.context.recordOwnerId,
                studioId: context.context.recordStudioId,
            });
            const config = await this._getConfig();
            const features = getContractFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                metrics.subscriptionType,
                metrics.currentPeriodStartMs,
                metrics.currentPeriodEndMs
            );

            if (!features.allowed) {
                console.log(
                    `[SubscriptionController] [createPurchaseContractLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} subscriptionStatus: ${metrics.subscriptionStatus}] Store features not allowed.`
                );
                return failure({
                    errorCode: 'store_disabled',
                    errorMessage:
                        "The account you are trying to purchase the contract for doesn't have access to contracting features.",
                });
            }

            // TODO: Validate that the holding user has setup stripe and is active.

            // if (!metrics.stripeAccountId || !metrics.stripeAccountStatus) {
            //     console.log(
            //         `[SubscriptionController] [createPurchaseContractLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} subscriptionStatus: ${metrics.subscriptionStatus} stripeAccountId: ${metrics.stripeAccountId} stripeAccountStatus: ${metrics.stripeAccountStatus}] Store has no stripe account.`
            //     );
            //     return {
            //         success: false,
            //         errorCode: 'store_disabled',
            //         errorMessage:
            //             'The store you are trying to purchase from is disabled.',
            //     };
            // }

            // if (metrics.stripeAccountStatus !== 'active') {
            //     console.log(
            //         `[SubscriptionController] [createPurchaseContractLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} subscriptionStatus: ${metrics.subscriptionStatus} stripeAccountId: ${metrics.stripeAccountId} stripeAccountStatus: ${metrics.stripeAccountStatus}] Store stripe account is not active.`
            //     );
            //     return {
            //         success: false,
            //         errorCode: 'store_disabled',
            //         errorMessage:
            //             'The store you are trying to purchase from is disabled.',
            //     };
            // }

            const limits = features.currencyLimits[currency];

            if (!limits) {
                console.log(
                    `[SubscriptionController] [createPurchaseContractLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} currency: ${request.contract.currency}] Currency not supported.`
                );
                return failure({
                    errorCode: 'currency_not_supported',
                    errorMessage: 'The currency is not supported.',
                });
            }

            if (
                item.initialValue !== 0 &&
                (item.initialValue < limits.minCost ||
                    item.initialValue > limits.maxCost)
            ) {
                console.log(
                    `[SubscriptionController] [createPurchaseContractLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} currency: ${request.contract.currency} minCost: ${limits.minCost} maxCost: ${limits.maxCost} initialValue: ${item.initialValue}] Cost not valid.`
                );
                return failure({
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The contract you are trying to purchase has a price that is not allowed.',
                });
            }

            let applicationFee = 0;
            if (item.initialValue !== 0 && limits.fee) {
                if (limits.fee.type === 'percent') {
                    // calculate percent when fee is between 1 - 100
                    applicationFee = Math.ceil(
                        item.initialValue * (limits.fee.percent / 100)
                    );
                } else {
                    // if (limits.fee.amount > item.initialValue) {
                    //     console.warn(
                    //         `[SubscriptionController] [createPurchaseContractLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} currency: ${request.contract.currency} fee: ${limits.fee.amount} initialValue: ${item.initialValue}] Fee greater than cost.`
                    //     );
                    //     return {
                    //         success: false,
                    //         errorCode: 'server_error',
                    //         errorMessage:
                    //             'The application fee is greater than the cost of the item.',
                    //     };
                    // }
                    applicationFee = limits.fee.amount;
                }
            }

            const totalCost = item.initialValue + applicationFee;

            if (totalCost !== request.contract.expectedCost) {
                return failure({
                    errorCode: 'price_does_not_match',
                    errorMessage:
                        'The expected price does not match the actual price of the contract.',
                });
            }

            let customerEmail: string = null;
            if (request.userId) {
                const user = await this._authStore.findUser(request.userId);

                if (!user) {
                    return failure({
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'The user could not be found.',
                    });
                }

                // const roles = await this._policyStore.listRolesForUser(
                //     recordName,
                //     user.id
                // );
                // const hasRole = roles.some(
                //     (r) =>
                //         r.role === item.roleName &&
                //         (!r.expireTimeMs || r.expireTimeMs > Date.now())
                // );

                // if (hasRole) {
                //     return {
                //         success: false,
                //         errorCode: 'item_already_purchased',
                //         errorMessage:
                //             'You already have the role that the item would grant.',
                //     };
                // }

                customerEmail = user.email ?? null;
            }

            const sessionId = uuid();

            console.log(
                `[SubscriptionController] [createPurchaseContractLink studioId: ${metrics.studioId} subscriptionId: ${metrics.subscriptionId} sessionId: ${sessionId} currency: ${request.contract.currency} initialValue: ${item.initialValue} applicationFee: ${applicationFee}] Creating checkout session.`
            );
            const transfers: InternalTransfer[] = [
                {
                    amount: item.initialValue,
                    code: TransferCodes.contract_payment,
                    creditAccountId: contractAccount.value.id,
                    debitAccountId: ACCOUNT_IDS.assets_stripe,
                    currency: CurrencyCodes.usd,
                    pending: true,
                },
            ];
            const lineItems: StripeCheckoutRequest['line_items'] = [
                {
                    price_data: {
                        currency: currency,
                        unit_amount: item.initialValue,
                        product_data: {
                            name: 'Contract',
                            description: item.description,
                            images: [],
                            metadata: {
                                resourceKind: 'contract',
                                recordName: recordName,
                                address: item.address,
                            },
                            // tax_code: item.taxCode ?? undefined,
                        },
                    },
                    quantity: 1,
                },
            ];

            if (applicationFee > 0) {
                transfers.push({
                    amount: applicationFee,
                    code: TransferCodes.xp_platform_fee,
                    debitAccountId: ACCOUNT_IDS.assets_stripe,
                    creditAccountId: ACCOUNT_IDS.revenue_xp_platform_fees,
                    currency: CurrencyCodes.usd,
                    pending: true,
                });
                lineItems.push({
                    price_data: {
                        currency,
                        unit_amount: applicationFee,
                        product_data: {
                            name: 'Application Fee',
                            description: item.description,
                            images: [],
                            metadata: {
                                fee: true,
                                resourceKind: 'contract',
                                recordName: recordName,
                                address: item.address,
                            },
                        },
                    },
                    quantity: 1,
                });
            }

            const transferResult =
                await this._financialController.internalTransaction({
                    transfers,
                });

            if (isFailure(transferResult)) {
                logError(
                    transferResult.error,
                    `[SubscriptionController] [createPurchaseContractLink] Failed to create internal transfer for contract: ${item.id}`
                );
                // TODO: Map out better error codes
                return failure({
                    errorCode: 'server_error',
                    errorMessage:
                        'Failed to create internal transfer for contract.',
                });
            }

            const sessionResult = await wrap(() =>
                this._stripe.createCheckoutSession({
                    mode: 'payment',
                    line_items: lineItems,
                    success_url: fulfillmentRoute(config.returnUrl, sessionId),
                    cancel_url: request.returnUrl,
                    client_reference_id: sessionId,
                    customer_email: customerEmail,
                    metadata: {
                        userId: request.userId,
                        checkoutSessionId: sessionId,
                        transactionId: transferResult.value.transactionId,
                    },
                    payment_intent_data: {
                        // application_fee_amount: applicationFee,
                        transfer_group: item.id,
                    },
                    // connect: {
                    //     stripeAccount: metrics.,
                    // },
                })
            );

            if (isFailure(sessionResult)) {
                logError(
                    sessionResult.error,
                    `[SubscriptionController] [createPurchaseContractLink] Failed to create checkout session for contract: ${item.id}`
                );

                const result =
                    await this._financialController.completePendingTransfers({
                        transfers: transferResult.value.transferIds,
                        flags: TransferFlags.void_pending_transfer,
                        transactionId: transferResult.value.transactionId,
                    });

                if (isFailure(result)) {
                    logError(
                        result.error,
                        `[SubscriptionController] [createPurchaseContractLink] Failed to void pending transfers for contract: ${item.id}`
                    );
                }

                return failure({
                    errorCode: 'server_error',
                    errorMessage:
                        'Failed to create checkout session for contract.',
                });
            }

            const session = sessionResult.value;

            await this._authStore.updateCheckoutSessionInfo({
                id: sessionId,
                stripeCheckoutSessionId: session.id,
                invoice: session.invoice
                    ? {
                          currency: session.invoice.currency,
                          paid: session.invoice.paid,
                          description: session.invoice.description,
                          status: session.invoice.status,
                          stripeInvoiceId: session.invoice.id,
                          stripeHostedInvoiceUrl:
                              session.invoice.hosted_invoice_url,
                          stripeInvoicePdfUrl: session.invoice.invoice_pdf,
                          tax: session.invoice.tax,
                          total: session.invoice.total,
                          subtotal: session.invoice.subtotal,
                      }
                    : null,
                userId: request.userId,
                status: session.status,
                paymentStatus: session.payment_status,
                paid:
                    session.payment_status === 'paid' ||
                    session.payment_status === 'no_payment_required',
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'contract',
                        recordName: recordName,
                        contractAddress: item.address,
                        contractId: item.id,
                        value: item.initialValue,
                    },
                ],
                transactionId: transferResult.value.transactionId,
                pendingTransferIds: transferResult.value.transferIds,
            });

            return success({
                url: session.url,
                sessionId: sessionId,
            });
        } catch (err) {
            console.error(
                '[SubscriptionController] An error occurred while creating a purchase item link:',
                err
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            });
        }
    }

    async fulfillCheckoutSession(
        request: FulfillCheckoutSessionRequest
    ): Promise<FulfillCheckoutSessionResult> {
        try {
            const session = await this._authStore.getCheckoutSessionById(
                request.sessionId
            );

            if (!session) {
                return {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'The checkout session does not exist.',
                };
            }

            if (!!session.userId && session.userId !== request.userId) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to accept fulfillment of this checkout session.',
                };
            }

            if (session.stripeStatus === 'expired') {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The checkout session has expired.',
                };
            } else if (session.stripeStatus === 'open') {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        'The checkout session has not been completed.',
                };
            } else if (session.stripePaymentStatus === 'unpaid') {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The checkout session has not been paid for.',
                };
            } else if (session.fulfilledAtMs > 0) {
                return {
                    success: true,
                };
            }
            console.log(
                `[SubscriptionController] [fulfillCheckoutSession sessionId: ${session.id} userId: ${session.userId}] Fulfilling checkout session.`
            );

            if (request.activation === 'now') {
                if (!request.userId) {
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'Guests cannot accept immediate fulfillment of a checkout session.',
                    };
                }

                console.log(
                    `[SubscriptionController] [fulfillCheckoutSession sessionId: ${session.id} userId: ${session.userId}] Activating checkout session.`
                );

                // grant user access to the items
                for (let item of session.items) {
                    if (item.type === 'role') {
                        const result =
                            await this._policyStore.assignSubjectRole(
                                item.recordName,
                                session.userId,
                                'user',
                                {
                                    role: item.role,
                                    expireTimeMs: item.roleGrantTimeMs
                                        ? Date.now() + item.roleGrantTimeMs
                                        : null,
                                }
                            );

                        if (result.success === false) {
                            console.error(
                                `[SubscriptionController] [fulfillCheckoutSession sessionId: ${session.id} userId: ${session.userId}] Unable to grant role to user:`,
                                result
                            );
                            return {
                                success: false,
                                errorCode: 'server_error',
                                errorMessage: 'A server error occurred.',
                            };
                        }

                        await this._authStore.savePurchasedItem({
                            id: uuid(),
                            activatedTimeMs: Date.now(),
                            recordName: item.recordName,
                            purchasableItemAddress: item.purchasableItemAddress,
                            roleName: item.role,
                            roleGrantTimeMs: item.roleGrantTimeMs,
                            userId: session.userId,
                            activationKeyId: null,
                            checkoutSessionId: session.id,
                        });
                    } else {
                        console.warn(
                            `[SubscriptionController] [fulfillCheckoutSession sessionId: ${session.id} userId: ${session.userId}] Unknown item type: ${item.type}`
                        );
                    }
                }

                await this._authStore.markCheckoutSessionFulfilled(
                    session.id,
                    Date.now()
                );

                return {
                    success: true,
                };
            } else {
                console.log(
                    `[SubscriptionController] [fulfillCheckoutSession sessionId: ${session.id} userId: ${session.userId}] Deferring activation for checkout session.`
                );

                const secret = fromByteArray(
                    randomBytes(ACCESS_KEY_SECRET_BYTE_LENGTH)
                );
                const keyId = fromByteArray(
                    randomBytes(ACCESS_KEY_SECRET_BYTE_LENGTH)
                );
                const hash = hashHighEntropyPasswordWithSalt(secret, keyId);

                await this._authStore.createActivationKey({
                    id: keyId,
                    secretHash: hash,
                });

                const key = formatV1ActivationKey(keyId, secret);

                // grant user access to the items
                for (let item of session.items) {
                    if (item.type === 'role') {
                        await this._authStore.savePurchasedItem({
                            id: uuid(),
                            activatedTimeMs: null,
                            recordName: item.recordName,
                            purchasableItemAddress: item.purchasableItemAddress,
                            roleName: item.role,
                            roleGrantTimeMs: item.roleGrantTimeMs,
                            userId: null,
                            activationKeyId: keyId,
                            checkoutSessionId: session.id,
                        });
                    } else {
                        console.warn(
                            `[SubscriptionController] [fulfillCheckoutSession sessionId: ${session.id} userId: ${session.userId}] Unknown item type: ${item.type}`
                        );
                    }
                }

                await this._authStore.markCheckoutSessionFulfilled(
                    session.id,
                    Date.now()
                );
                const config = await this._getConfig();

                return {
                    success: true,
                    activationKey: key,
                    activationUrl: activationRoute(config.returnUrl, key),
                };
            }
        } catch (err) {
            console.error(
                '[SubscriptionController] An error occurred while fulfilling a checkout session:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async claimActivationKey(
        request: ClaimActivationKeyRequest
    ): Promise<ClaimActivationKeyResult> {
        try {
            if (!request.userId && request.target === 'self') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'You need to be logged in to use target = self.',
                };
            }

            const key = parseActivationKey(request.activationKey);

            if (!key) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The activation key is invalid.',
                };
            }

            const [keyId, secret] = key;

            const activationKey = await this._authStore.getActivationKeyById(
                keyId
            );

            if (!activationKey) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The activation key is invalid.',
                };
            }

            const hash = hashHighEntropyPasswordWithSalt(secret, keyId);

            if (activationKey.secretHash !== hash) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The activation key is invalid.',
                };
            }

            let userId: string;
            let sessionKey: string;
            let connectionKey: string;
            let expireTimeMs: number;
            if (request.target === 'self') {
                userId = request.userId;
            } else if (request.target === 'guest') {
                console.log(
                    '[SubscriptionController] [claimActivationKey] Creating user for guest activation key.'
                );

                const accountResult = await this._auth.createAccount({
                    userRole: 'superUser',
                    ipAddress: request.ipAddress,
                });

                if (accountResult.success === false) {
                    console.error(
                        `[SubscriptionController] [claimActivationKey keyId: ${keyId}] Unable to create user for guest activation key:`,
                        accountResult
                    );
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                    };
                }

                userId = accountResult.userId;
                sessionKey = accountResult.sessionKey;
                connectionKey = accountResult.connectionKey;
                expireTimeMs = accountResult.expireTimeMs;
            }

            console.log(
                `[SubscriptionController] [claimActivationKey keyId: ${keyId} userId: ${request.userId}] Claiming activation key.`
            );
            if (!userId) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The activation key is invalid.',
                };
            }

            const items =
                await this._authStore.listPurchasedItemsByActivationKeyId(
                    keyId
                );

            for (let item of items) {
                if (item.activatedTimeMs || item.userId) {
                    continue;
                }

                const result = await this._policyStore.assignSubjectRole(
                    item.recordName,
                    userId,
                    'user',
                    {
                        role: item.roleName,
                        expireTimeMs: item.roleGrantTimeMs
                            ? Date.now() + item.roleGrantTimeMs
                            : null,
                    }
                );

                if (result.success === false) {
                    console.error(
                        `[SubscriptionController] [claimActivationKey keyId: ${keyId} userId: ${userId}] Unable to grant role to user:`,
                        result
                    );
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                    };
                }

                await this._authStore.savePurchasedItem({
                    ...item,
                    activatedTimeMs: Date.now(),
                    userId,
                });
            }

            return {
                success: true,
                userId,
                sessionKey,
                connectionKey,
                expireTimeMs,
            };
        } catch (err) {
            console.error(
                '[SubscriptionController] An error occurred while claiming an activation key:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Handles the webhook from Stripe for updating the internal database.
     */
    @traced(TRACE_NAME)
    async handleStripeWebhook(
        request: HandleStripeWebhookRequest
    ): Promise<HandleStripeWebhookResponse> {
        if (!this._stripe) {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This method is not supported.',
            };
        }

        try {
            if (
                typeof request.requestBody !== 'string' ||
                request.requestBody === ''
            ) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The request was not valid.',
                };
            }

            if (
                typeof request.signature !== 'string' ||
                request.signature === ''
            ) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The request was not valid.',
                };
            }

            const config = await this._getConfig();

            const body = request.requestBody;
            const signature = request.signature;
            let event: StripeEvent;
            try {
                event = this._stripe.constructWebhookEvent(
                    body,
                    signature,
                    config.webhookSecret
                );
            } catch (err) {
                console.log(
                    `[SubscriptionController] [handleStripeWebhook] Unable to construct webhook event:`,
                    err
                );
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The request was not valid.',
                };
            }

            console.log(
                `[SubscriptionController] [handleStripeWebhook] Got event: ${event.type}`
            );
            if (
                event.type === 'customer.subscription.created' ||
                event.type === 'customer.subscription.deleted' ||
                event.type === 'customer.subscription.updated'
            ) {
                const subscription = event.data.object;
                return await this._handleStripeSubscriptionEvent(
                    config,
                    event,
                    subscription
                );
            } else if (event.type === 'invoice.paid') {
                const parseResult =
                    STRIPE_EVENT_INVOICE_PAID_SCHEMA.safeParse(event);

                if (parseResult.success === false) {
                    console.error(
                        `[SubscriptionController] [handleStripeWebhook] Unable to parse stripe event!`,
                        parseResult.error
                    );
                    return {
                        success: true,
                    };
                }

                return await this._handleStripeInvoicePaidEvent(
                    config,
                    event,
                    parseResult.data.data.object
                );
            } else if (event.type === 'account.updated') {
                const parseResult =
                    STRIPE_EVENT_ACCOUNT_UPDATED_SCHEMA.safeParse(event);

                if (parseResult.success === false) {
                    console.error(
                        `[SubscriptionController] [handleStripeWebhook] Unable to parse stripe event!`,
                        parseResult.error
                    );
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'The request was not able to be parsed.',
                    };
                }

                return await this._handleStripeAccountUpdatedEvent(
                    config,
                    parseResult.data
                );
            } else if (
                event.type === 'checkout.session.completed' ||
                event.type === 'checkout.session.expired' ||
                event.type === 'checkout.session.async_payment_failed' ||
                event.type === 'checkout.session.async_payment_succeeded'
            ) {
                const parseResult =
                    STRIPE_EVENT_CHECKOUT_SESSION_SCHEMA.safeParse(event);

                if (parseResult.success === false) {
                    console.error(
                        `[SubscriptionController] [handleStripeWebhook] Unable to parse stripe event!`,
                        parseResult.error
                    );
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'The request was not able to be parsed.',
                    };
                }

                return await this._handleStripeCheckoutSessionEvent(
                    config,
                    event,
                    parseResult.data
                );
            }

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span.recordException(err);

            console.error(
                '[SubscriptionController] An error occurred while handling a stripe webhook:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    private async _handleStripeCheckoutSessionEvent(
        config: SubscriptionConfiguration,
        event: StripeEvent,
        sessionEvent: StripeEventCheckoutSession
    ): Promise<HandleStripeWebhookResponse> {
        const stripeSession = sessionEvent.data.object;
        const sessionId = stripeSession.client_reference_id;

        if (!sessionId) {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] No client_reference_id found in the event.`
            );
            return {
                success: true,
            };
        }

        const session = await this._authStore.getCheckoutSessionById(sessionId);

        if (!session) {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] Could not find session with ID (${sessionId}).`
            );
            return {
                success: false,
                errorCode: 'invalid_request',
                errorMessage: 'The session could not be found.',
            };
        }

        if (session.stripeCheckoutSessionId !== stripeSession.id) {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] Stripe checkout session ID (${stripeSession.id}) does not match stored ID (${session.stripeCheckoutSessionId}).`
            );
            return {
                success: false,
                errorCode: 'invalid_request',
                errorMessage:
                    'The session ID does not match the expected session ID.',
            };
        }

        console.log(
            `[SubscriptionController] [handleStripeWebhook] [sessionId: ${sessionId} stripeCheckoutSessionId: ${stripeSession.id} status: ${stripeSession.status} paymentStatus: ${stripeSession.payment_status}] Checkout session updated for session ID.`
        );
        const paid =
            stripeSession.payment_status === 'no_payment_required' ||
            stripeSession.payment_status === 'paid';
        await this._authStore.updateCheckoutSessionInfo({
            ...session,
            paid,
            paymentStatus: stripeSession.payment_status,
            status: stripeSession.status,
            invoice: null,
        });

        if (event.type === 'checkout.session.expired') {
            if (session.pendingTransferIds) {
                console.log(
                    `[SubscriptionController] [handleStripeWebhook] [sessionId: ${sessionId} stripeCheckoutSessionId: ${
                        stripeSession.id
                    } transferIds: [${session.pendingTransferIds.join(
                        ','
                    )}]] Voiding pending transfers.`
                );
                const result =
                    await this._financialController.completePendingTransfers({
                        transfers: session.pendingTransferIds,
                        transactionId: session.transactionId,
                        flags: TransferFlags.void_pending_transfer,
                    });

                if (isFailure(result)) {
                    logError(
                        result.error,
                        `[SubscriptionController] [handleStripeWebhook] Failed to void pending transfers for session ID: ${sessionId}`
                    );
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage:
                            'Failed to void pending transfers for session ID.',
                    };
                }
            }
        }

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    private async _handleStripeAccountUpdatedEvent(
        config: SubscriptionConfiguration,
        event: StripeEventAccountUpdated
    ): Promise<HandleStripeWebhookResponse> {
        const accountId = event.data.object.id;
        const account = await this._stripe.getAccountById(accountId);
        let studio = await this._recordsStore.getStudioByStripeAccountId(
            accountId
        );

        if (studio) {
            return await this._handleStudioStripeAccountUpdatedEvent(
                account,
                studio
            );
        }

        const user = await this._authStore.findUserByStripeAccountId(accountId);

        if (user) {
            return await this._handleUserStripeAccountUpdatedEvent(
                account,
                user
            );
        }

        console.warn(
            `[SubscriptionController] [handleStripeWebhook] No user or studio found for account ID (${accountId}).`
        );

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    private async _handleStudioStripeAccountUpdatedEvent(
        account: StripeAccount,
        studio: Studio
    ): Promise<HandleStripeWebhookResponse> {
        if (!studio) {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] No studio found for account ID (${account.id}).`
            );
            return {
                success: true,
            };
        }

        const newStatus = getAccountStatus(account);
        const newRequirementsStatus = getAccountRequirementsStatus(account);

        if (
            studio.stripeAccountStatus !== newStatus ||
            studio.stripeAccountRequirementsStatus !== newRequirementsStatus
        ) {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] Updating studio (${studio.id}) account status to ${newStatus} and requirements status to ${newRequirementsStatus}.`
            );
            studio = {
                ...studio,
                stripeAccountStatus: newStatus,
                stripeAccountRequirementsStatus: newRequirementsStatus,
            };

            await this._recordsStore.updateStudio(studio);
        }

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    private async _handleUserStripeAccountUpdatedEvent(
        account: StripeAccount,
        user: AuthUser
    ): Promise<HandleStripeWebhookResponse> {
        if (!user) {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] No user found for account ID (${account.id}).`
            );
            return {
                success: true,
            };
        }

        const newStatus = getAccountStatus(account);
        const newRequirementsStatus = getAccountRequirementsStatus(account);

        if (
            user.stripeAccountStatus !== newStatus ||
            user.stripeAccountRequirementsStatus !== newRequirementsStatus
        ) {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] Updating user (${user.id}) account status to ${newStatus} and requirements status to ${newRequirementsStatus}.`
            );
            user = {
                ...user,
                stripeAccountStatus: newStatus,
                stripeAccountRequirementsStatus: newRequirementsStatus,
            };

            await this._authStore.saveUser(user);
        }

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    private async _handleStripeInvoicePaidEvent(
        config: SubscriptionConfiguration,
        event: StripeEvent,
        invoice: StripeInvoice
    ): Promise<HandleStripeWebhookResponse> {
        const stripeSubscriptionId = invoice.subscription;

        if (stripeSubscriptionId) {
            const subscription = await this._stripe.getSubscriptionById(
                stripeSubscriptionId
            );
            const status = subscription.status;
            const customerId = invoice.customer;
            const lineItems = invoice.lines.data;
            const periodStartMs = subscription.current_period_start * 1000;
            const periodEndMs = subscription.current_period_end * 1000;
            const { sub, item } = findMatchingSubscription(lineItems);

            const authInvoice: UpdateSubscriptionPeriodRequest['invoice'] = {
                currency: invoice.currency,
                description: invoice.description,
                paid: invoice.paid,
                status: invoice.status,
                tax: invoice.tax,
                total: invoice.total,
                subtotal: invoice.subtotal,
                stripeInvoiceId: invoice.id,
                stripeHostedInvoiceUrl: invoice.hosted_invoice_url,
                stripeInvoicePdfUrl: invoice.invoice_pdf,
            };

            console.log(
                `[SubscriptionController] [handleStripeWebhook] New invoice paid for customer ID (${customerId}). Subscription ID: ${subscription.id}. Period start: ${periodStartMs}. Period end: ${periodEndMs}.`
            );

            const user = await this._authStore.findUserByStripeCustomerId(
                customerId
            );

            if (user) {
                console.log(
                    `[SubscriptionController] [handleStripeWebhook] Found user (${user.id}) with customer ID (${customerId}).`
                );

                await this._authStore.updateSubscriptionPeriod({
                    userId: user.id,
                    subscriptionStatus: status,
                    subscriptionId: sub.id,
                    stripeSubscriptionId,
                    stripeCustomerId: customerId,
                    currentPeriodEndMs: periodEndMs,
                    currentPeriodStartMs: periodStartMs,
                    invoice: authInvoice,
                });
            } else {
                console.log(
                    `[SubscriptionController] [handleStripeWebhook] No user found for customer ID (${customerId}).`
                );

                const studio =
                    await this._recordsStore.getStudioByStripeCustomerId(
                        customerId
                    );

                if (studio) {
                    await this._authStore.updateSubscriptionPeriod({
                        studioId: studio.id,
                        subscriptionStatus: status,
                        subscriptionId: sub.id,
                        stripeSubscriptionId,
                        stripeCustomerId: customerId,
                        currentPeriodEndMs: periodEndMs,
                        currentPeriodStartMs: periodStartMs,
                        invoice: authInvoice,
                    });
                } else {
                    console.log(
                        `[SubscriptionController] [handleStripeWebhook] No studio found for customer ID (${customerId}).`
                    );
                }
            }

            function findMatchingSubscription(
                lineItems: StripeInvoice['lines']['data']
            ) {
                let item: any;
                let sub: SubscriptionConfiguration['subscriptions'][0];
                items_loop: for (let i of lineItems) {
                    for (let s of config.subscriptions) {
                        if (
                            s.eligibleProducts &&
                            s.eligibleProducts.some(
                                (p) => p === i.price.product
                            )
                        ) {
                            sub = s;
                            item = i;
                            break items_loop;
                        }
                    }
                }

                return { item, sub };
            }
        } else {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] No subscription ID found in invoice.`
            );

            const authInvoice = await this._authStore.getInvoiceByStripeId(
                invoice.id
            );
            if (!authInvoice) {
                console.log(
                    `[SubscriptionController] [handleStripeWebhook] No invoice found for stripe ID (${invoice.id}).`
                );
                return {
                    success: true,
                };
            }

            await this._authStore.saveInvoice({
                ...authInvoice,
                currency: invoice.currency,
                description: invoice.description,
                paid: invoice.paid,
                status: invoice.status,
                tax: invoice.tax,
                total: invoice.total,
                subtotal: invoice.subtotal,
            });
        }

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    private async _handleStripeSubscriptionEvent(
        config: SubscriptionConfiguration,
        event: StripeEvent,
        subscription: Record<string, any>
    ): Promise<HandleStripeWebhookResponse> {
        const items = subscription.items.data as Array<any>;

        let item: any;
        let sub: SubscriptionConfiguration['subscriptions'][0];
        items_loop: for (let i of items) {
            for (let s of config.subscriptions) {
                if (
                    s.eligibleProducts &&
                    s.eligibleProducts.some((p) => p === i.price.product)
                ) {
                    sub = s;
                    item = i;
                    break items_loop;
                }
            }
        }

        if (!item || !sub) {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] No item in the subscription matches an eligible product in the config.`
            );
            return {
                success: true,
            };
        }

        console.log(
            `[SubscriptionController] [handleStripeWebhook] Subscription (${sub.id}) found!`
        );

        const status = subscription.status;
        const active = isActiveSubscription(status);
        const tier = sub.tier ?? 'beta';
        const customerId = subscription.customer;
        const stripeSubscriptionId = subscription.id;
        const periodStartMs = subscription.current_period_start * 1000;
        const periodEndMs = subscription.current_period_end * 1000;

        console.log(
            `[SubscriptionController] [handleStripeWebhook] Customer ID: ${customerId}. Subscription status: ${status}. Tier: ${tier}. Is Active: ${active}.`
        );
        let user = await this._authStore.findUserByStripeCustomerId(customerId);
        let studio: Studio;

        if (user) {
            await this._authStore.updateSubscriptionInfo({
                userId: user.id,
                subscriptionStatus: status,
                subscriptionId: sub.id,
                stripeSubscriptionId,
                stripeCustomerId: customerId,
                currentPeriodEndMs: periodEndMs,
                currentPeriodStartMs: periodStartMs,
            });
        } else {
            console.log(
                `[SubscriptionController] [handleStripeWebhook] No user found for Customer ID (${customerId})`
            );

            studio = await this._recordsStore.getStudioByStripeCustomerId(
                customerId
            );

            if (studio) {
                await this._authStore.updateSubscriptionInfo({
                    studioId: studio.id,
                    subscriptionStatus: status,
                    subscriptionId: sub.id,
                    stripeSubscriptionId,
                    stripeCustomerId: customerId,
                    currentPeriodEndMs: periodEndMs,
                    currentPeriodStartMs: periodStartMs,
                });
            } else {
                console.log(
                    `[SubscriptionController] [handleStripeWebhook] No studio found for Customer ID (${customerId})`
                );
            }
        }

        return {
            success: true,
        };
    }
}

/**
 * Gets the account status for the given stripe account.
 * @param account The account that the status should be retrieved for.
 */
export function getAccountStatus(account: StripeAccount): StripeAccountStatus {
    const disabledReason = account?.requirements?.disabled_reason;
    if (
        disabledReason === 'under_review' ||
        disabledReason === 'requirements.pending_verification'
    ) {
        return 'pending';
    } else if (
        disabledReason === 'rejected.fraud' ||
        disabledReason === 'rejected.incomplete_verification' ||
        disabledReason === 'rejected.listed' ||
        disabledReason === 'rejected.other' ||
        disabledReason === 'rejected.terms_of_service'
    ) {
        return 'rejected';
    } else if (disabledReason) {
        return 'disabled';
    } else if (account.charges_enabled) {
        return 'active';
    }

    return 'pending';
}

/**
 * Gets the requirements status for the given stripe account.
 * @param account The account.
 */
export function getAccountRequirementsStatus(
    account: StripeAccount
): StripeRequirementsStatus {
    const requirements = account?.requirements;
    if (!requirements) {
        return 'incomplete';
    }

    if (
        requirements.currently_due?.length > 0 ||
        requirements.past_due?.length > 0
    ) {
        return 'incomplete';
    }

    return 'complete';
}

function returnRoute(basePath: string, user: AuthUser, studio: Studio) {
    if (user) {
        return basePath;
    } else {
        return studiosRoute(basePath, studio.id, studio.displayName);
    }
}

function studiosRoute(basePath: string, studioId: string, studioName: string) {
    return new URL(
        `/studios/${encodeURIComponent(studioId)}/${encodeURIComponent(
            studioName
        )}`,
        basePath
    ).href;
}

function fulfillmentRoute(basePath: string, sessionId: string) {
    return new URL(`/store/fulfillment/${sessionId}`, basePath).href;
}

function activationRoute(basePath: string, key: string) {
    const url = new URL(`/store/activate`, basePath);
    url.searchParams.set('key', key);
    return url.href;
}

/**
 * Formats a V1 access key.
 * @param itemId The ID of the purchased item.
 * @param secret The secret that should be used to access the purchased item.
 */
export function formatV1ActivationKey(itemId: string, secret: string): string {
    return `vAK1.${toBase64String(itemId)}.${toBase64String(secret)}`;
}

/**
 * Parses the given access key.
 * Returns null if the access key is invalid.
 * @param key The key to parse.
 */
export function parseActivationKey(
    key: string
): [keyId: string, secret: string] {
    if (!key) {
        return null;
    }

    if (!key.startsWith('vAK1.')) {
        return null;
    }

    const withoutVersion = key.slice('vAK1.'.length);
    let periodAfterId = withoutVersion.indexOf('.');
    if (periodAfterId < 0) {
        return null;
    }

    const idBase64 = withoutVersion.slice(0, periodAfterId);
    const secretBase64 = withoutVersion.slice(periodAfterId + 1);

    if (idBase64.length <= 0 || secretBase64.length <= 0) {
        return null;
    }

    try {
        const name = fromBase64String(idBase64);
        const secret = fromBase64String(secretBase64);

        return [name, secret];
    } catch (err) {
        return null;
    }
}

/**
 * Defines a request for managing a user's subscription.
 */
export interface CreateManageSubscriptionRequest {
    /**
     * The session key that should be used to validate the request.
     */
    sessionKey: string;

    /**
     * The User ID that the management session should be created for.
     */
    userId?: string;

    /**
     * The ID of the studio that the management session should be created for.
     */
    studioId?: string;

    /**
     * The subscription that was selected for purcahse by the user.
     */
    subscriptionId?: string;

    /**
     * The price that the user expects to pay.
     */
    expectedPrice?: {
        currency: string;
        cost: number;
        interval: 'month' | 'year' | 'week' | 'day';
        intervalLength: number;
    };
}

export type CreateManageSubscriptionResult =
    | CreateManageSubscriptionSuccess
    | CreateManageSubscriptionFailure;

export interface CreateManageSubscriptionSuccess {
    success: true;

    /**
     * The URL that the user should be redirected to.
     */
    url: string;
}

export interface CreateManageSubscriptionFailure {
    success: false;

    /**
     * The error code.
     */
    errorCode:
        | ServerError
        | ValidateSessionKeyFailure['errorCode']
        | 'unacceptable_user_id'
        | 'unacceptable_studio_id'
        | 'unacceptable_request'
        | 'price_does_not_match'
        | 'not_supported';

    /**
     * The error message.
     */
    errorMessage: string;
}

export interface GetSubscriptionStatusRequest {
    /**
     * The session key that should be used to validate the request.
     */
    sessionKey: string;

    /**
     * The ID of the user whose subscription status should be retrieved.
     */
    userId?: string;

    /**
     * The ID of the studio whose subscrition status should be retrieved.
     */
    studioId?: string;
}

export type GetSubscriptionStatusResult =
    | GetSubscriptionStatusSuccess
    | GetSubscriptionStatusFailure;

export interface GetSubscriptionStatusSuccess {
    success: true;

    /**
     * The ID of the user.
     */
    userId?: string;

    /**
     * The ID of the studio.
     */
    studioId?: string;

    /**
     * The publishable stripe API key.
     */
    publishableKey: string;

    /**
     * The list of subscriptions that the user has.
     */
    subscriptions: SubscriptionStatus[];

    /**
     * The list of subscriptions that the user can purchase.
     */
    purchasableSubscriptions: PurchasableSubscription[];
}

export interface SubscriptionStatus {
    /**
     * Whether the user has an active subscription.
     */
    active: boolean;

    /**
     * The status code for the subscription.
     *
     * Possible values are `incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `canceled`, or `unpaid`.
     * For collection_method=charge_automatically a subscription moves into incomplete if the initial payment attempt fails. A subscription in this state can only have metadata and default_source updated. Once the first invoice is paid, the subscription moves into an active state. If the first invoice is not paid within 23 hours, the subscription transitions to incomplete_expired. This is a terminal state, the open invoice will be voided and no further invoices will be generated.
     *
     * A subscription that is currently in a trial period is trialing and moves to active when the trial period is over.
     *
     * If subscription collection_method=charge_automatically it becomes past_due when payment to renew it fails and canceled or unpaid (depending on your subscriptions settings) when Stripe has exhausted all payment retry attempts.
     *
     * If subscription collection_method=send_invoice it becomes past_due when its invoice is not paid by the due date, and canceled or unpaid if it is still not paid by an additional deadline after that. Note that when a subscription has a status of unpaid, no subsequent invoices will be attempted (invoices will be created, but then immediately automatically closed). After receiving updated payment information from a customer, you may choose to reopen and pay their closed invoices.
     */
    statusCode:
        | 'active'
        | 'canceled'
        | 'ended'
        | 'past_due'
        | 'unpaid'
        | 'incomplete'
        | 'incomplete_expired'
        | 'trialing'
        | 'paused';

    /**
     * The name of the product.
     */
    productName: string;

    /**
     * The Unix time in seconds that the subscription was started at.
     */
    startDate: number;

    /**
     * The Unix time in seconds that the subscription ended at.
     */
    endedDate: number | null;

    /**
     * The Unix time in seconds when the subscription will be canceled.
     */
    cancelDate: number | null;

    /**
     * The Unix time in seconds when the subscription was canceled.
     */
    canceledDate: number | null;

    /**
     * The Unix time in seconds of the start of the current period that the subscription has been invoiced for.
     */
    currentPeriodStart: number | null;

    /**
     * The Unix time in seconds of the end of the current period that the subscription has been invoiced for.
     */
    currentPeriodEnd: number | null;

    /**
     * How frequently the subscription renews.
     */
    renewalInterval: 'month' | 'year' | 'week' | 'day';

    /**
     * The number of months/years/weeks/days that the interval lasts for.
     */
    intervalLength: number;

    /**
     * The price charged per interval.
     */
    intervalCost: number;

    /**
     * The currency that was used.
     */
    currency: string;

    /**
     * The feature list for the subscription.
     */
    featureList?: string[];
}

export interface PurchasableSubscription {
    /**
     * The ID of the subscription tier.
     */
    id: string;

    /**
     * The name of the product.
     */
    name: string;

    /**
     * The description of the product.
     */
    description: string;

    /**
     * The list of features included in the product.
     */
    featureList: string[];

    /**
     * The list of prices that the subscription can be purchased at.
     */
    prices: {
        /**
         * The ID of the price.
         */
        id: string;

        /**
         * How frequently the subscription will renew when this price is purchased.
         */
        interval: 'month' | 'year' | 'week' | 'day';

        /**
         * The number of months/years/weeks/days that the interval lasts for.
         */
        intervalLength: number;

        /**
         * The currency that this price is listed in.
         */
        currency: string;

        /**
         * The cost of this price.
         */
        cost: number;
    }[];

    /**
     * Whether the subscription is the default subscription.
     */
    defaultSubscription?: boolean;
}

export interface GetSubscriptionStatusFailure {
    success: false;

    /**
     * The error code.
     */
    errorCode:
        | ServerError
        | ValidateSessionKeyFailure['errorCode']
        | 'unacceptable_user_id'
        | 'unacceptable_studio_id'
        | 'unacceptable_request'
        | 'not_supported';

    /**
     * The error message.
     */
    errorMessage: string;
}

export interface HandleStripeWebhookRequest {
    /**
     * The raw request body.
     */
    requestBody: string;

    /**
     * The signature that was included with the request.
     */
    signature: string;
}

export type HandleStripeWebhookResponse =
    | HandleStripeWebhookSuccess
    | HandleStripeWebhookFailure;

export interface HandleStripeWebhookSuccess {
    success: true;
}

export interface HandleStripeWebhookFailure {
    success: false;
    errorCode: ServerError | 'invalid_request' | 'not_supported';
    errorMessage: string;
}

export interface UpdateSubscriptionRequest {
    /**
     * The role of the user that is currently logged in.
     */
    currentUserRole: UserRole | undefined | null;

    /**
     * The ID of the user that is currently logged in.
     */
    currentUserId: string;

    /**
     * The ID of the user whose subscription should be updated.
     */
    userId?: string;

    /**
     * The ID of the studio whose subscription should be updated.
     */
    studioId?: string;

    /**
     * The ID of the subscription that the user should have.
     * If null, then the subscription will be removed from the user.
     */
    subscriptionId: string | null;

    /**
     * The status of the subscription.
     */
    subscriptionStatus: SubscriptionStatus['statusCode'] | null;

    /**
     * The unix time in miliseconds that the subscription period starts.
     * If null, then the subscription does not have a start date. This means that the subscription has already started.
     */
    subscriptionPeriodStartMs: number | null;

    /**
     * The unix time in miliseconds that the subscription period ends.
     * If null, then the subscription does not have an end date. This means that the subscription will never end.
     */
    subscriptionPeriodEndMs: number | null;
}

export type UpdateSubscriptionResult =
    | UpdateSubscriptionSuccess
    | UpdateSubscriptionFailure;

export interface UpdateSubscriptionSuccess {
    success: true;
}

export interface UpdateSubscriptionFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | 'user_not_found'
        | 'studio_not_found'
        | 'invalid_request';
    errorMessage: string;
}

export interface CreateManageStoreAccountLinkRequest {
    /**
     * The ID of the studio that the link should be created for.
     */
    studioId: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;
}

export interface CreateManageXpAccountLinkRequest {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;
}

export type ManageAccountLinkResult = Result<
    {
        /**
         * The URL that the user can visit to manage their account.
         */
        url: string;
    },
    SimpleError
>;

// export type CreateManageStoreAccountLinkResult =
//     | CreateManageStoreAccountLinkSuccess
//     | CreateManageStoreAccountLinkFailure;

// export interface CreateManageStoreAccountLinkSuccess {
//     success: true;
//     /**
//      * The URl that the user can visit to manage their account.
//      */
//     url: string;
// }

// export interface CreateManageStoreAccountLinkFailure {
//     success: false;
//     errorCode:
//         | ServerError
//         | 'invalid_request'
//         | 'not_supported'
//         | NotLoggedInError
//         | NotAuthorizedError
//         | 'studio_not_found';
//     errorMessage: string;
// }

export interface CreatePurchaseItemLinkRequest {
    /**
     * The ID of the user that is currently logged in.
     * Null if the user is not logged in.
     */
    userId: string | null;

    /**
     * The instances that the request is being made from.
     */
    instances: string[];

    /**
     * The item that is being purchased.
     */
    item: {
        /**
         * The name of the record that the item is stored in.
         */
        recordName: string;

        /**
         * The address of the item.
         */
        address: string;

        /**
         * The expected cost of the item.
         */
        expectedCost: number;

        /**
         * The currency that the cost is in.
         */
        currency: string;
    };

    /**
     * The URL that the user should be redirected to if the purchase is canceled.
     */
    returnUrl: string;

    /**
     * The URL that the user should be redirected to if the purchase is unsuccessful.
     */
    successUrl: string;
}

export type PurchaseContractResult = Result<
    {
        /**
         * The URL that the user should be directed to to complete the purchase.
         */
        url?: string;

        /**
         * The ID of the checkout session.
         */
        sessionId: string;
    },
    SimpleError
>;

export type CreatePurchaseItemLinkResult =
    | CreatePurchaseItemLinkSuccess
    | CreatePurchaseItemLinkFailure;

export interface CreatePurchaseItemLinkSuccess {
    success: true;

    /**
     * The URL that the user should be redirected to.
     */
    url: string;

    /**
     * The ID of the checkout session.
     */
    sessionId: string;
}

export interface CreatePurchaseItemLinkFailure {
    success: false;
    errorCode:
        | ServerError
        | 'invalid_request'
        | 'not_supported'
        | 'item_not_found'
        | 'price_does_not_match'
        | 'store_disabled'
        | 'currency_not_supported'
        | 'subscription_limit_reached'
        | 'item_already_purchased'
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];
    errorMessage: string;
    reason?: DenialReason;
}

export interface PurchaseContractRequest {
    /**
     * The ID of the user that is currently logged in.
     * Null if the user is not logged in.
     */
    userId: string | null;

    /**
     * The instances that the request is being made from.
     */
    instances: string[];

    /**
     * The contract that is being purchased.
     */
    contract: {
        /**
         * The name of the record that the contract is stored in.
         */
        recordName: string;

        /**
         * The address of the contract.
         */
        address: string;

        /**
         * The expected cost of the contract.
         */
        expectedCost: number;

        /**
         * The currency that the cost is in.
         */
        currency: string;
    };

    /**
     * The URL that the user should be redirected to if the purchase is canceled.
     */
    returnUrl: string;

    /**
     * The URL that the user should be redirected to if the purchase is unsuccessful.
     */
    successUrl: string;
}

export interface FulfillCheckoutSessionRequest {
    /**
     * The ID of the session that should be fulfilled.
     */
    sessionId: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string | null;

    /**
     * How the session should be fulfilled.
     * - `now` indicates that the items should be granted to the user and activated imediately.
     *    Only valid if the user is logged in.
     * - `later` indicates that an access key should be granted for the user to activate later.
     */
    activation: 'now' | 'later';
}

export type FulfillCheckoutSessionResult =
    | FulfillCheckoutSessionSuccess
    | FulfillCheckoutSessionFailure;

export interface FulfillCheckoutSessionSuccess {
    success: true;

    /**
     * The activation key that the user can use to activate the items later.
     */
    activationKey?: string;

    /**
     * The URL that the user can visit to activate the items.
     */
    activationUrl?: string;
}

export interface FulfillCheckoutSessionFailure {
    success: false;
    errorCode:
        | ServerError
        | 'invalid_request'
        | 'not_supported'
        | 'not_authorized'
        | 'not_found';
    errorMessage: string;
}

export interface ClaimActivationKeyRequest {
    /**
     * The key that should be claimed.
     */
    activationKey: string;

    /**
     * The target of the activation key.
     *
     * - `guest` indicates that the key should be claimed for a guest user.
     * - `self` indicates that the key should be claimed for the user that is currently logged in.
     */
    target: 'guest' | 'self';

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string | null;

    /**
     * The IP Address that the request is coming from.
     */
    ipAddress: string;
}

export type ClaimActivationKeyResult =
    | ClaimActivationKeySuccess
    | ClaimActivationKeyFailure;

export interface ClaimActivationKeySuccess {
    success: true;

    /**
     * The ID of the user that the key was claimed for.
     */
    userId: string;

    /**
     * The session key that was granted to the new user.
     */
    sessionKey?: string;

    /**
     * The connection key that was granted to the new user.
     */
    connectionKey?: string;

    /**
     * The time that the session key will expire.
     */
    expireTimeMs?: number;
}

export interface ClaimActivationKeyFailure {
    success: false;
    errorCode:
        | ServerError
        | 'invalid_request'
        | 'not_supported'
        | 'not_authorized'
        | 'not_found'
        | 'not_logged_in';
    errorMessage: string;
}
