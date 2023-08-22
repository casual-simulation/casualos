import {
    AuthController,
    INVALID_KEY_ERROR_MESSAGE,
    ValidateSessionKeyFailure,
} from './AuthController';
import {
    AuthInvoice,
    AuthSession,
    AuthStore,
    AuthUser,
    UpdateSubscriptionPeriodRequest,
} from './AuthStore';
import {
    STRIPE_EVENT_INVOICE_PAID_SCHEMA,
    StripeCheckoutResponse,
    StripeEvent,
    StripeInterface,
    StripeInvoice,
} from './StripeInterface';
import { ServerError } from './Errors';
import { isActiveSubscription, JsonParseResult, tryParseJson } from './Utils';
import { SubscriptionConfiguration } from './SubscriptionConfiguration';
import { ListedStudioAssignment, RecordsStore, Studio } from './RecordsStore';
import { ConfigurationStore } from './ConfigurationStore';
import { v4 as uuid } from 'uuid';

/**
 * Defines a class that is able to handle subscriptions.
 */
export class SubscriptionController {
    private _stripe: StripeInterface;
    private _auth: AuthController;
    private _authStore: AuthStore;
    private _recordsStore: RecordsStore;
    private _config: ConfigurationStore;

    constructor(
        stripe: StripeInterface,
        auth: AuthController,
        authStore: AuthStore,
        recordsStore: RecordsStore,
        config: ConfigurationStore
    ) {
        this._stripe = stripe;
        this._auth = auth;
        this._authStore = authStore;
        this._recordsStore = recordsStore;
        this._config = config;
    }

    private async _getConfig() {
        return await this._config.getSubscriptionConfiguration();
    }

    /**
     * Gets the status of the given user's scription.
     * @param request
     */
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
                    if (keyResult.userId !== request.userId) {
                        console.log(
                            '[SubscriptionController] [getSubscriptionStatus] Request User ID doesnt match session key User ID!'
                        );
                        return {
                            success: false,
                            errorCode: 'invalid_key',
                            errorMessage: INVALID_KEY_ERROR_MESSAGE,
                        };
                    }

                    const user = await this._authStore.findUser(
                        keyResult.userId
                    );
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

                    if (assignments.length <= 0) {
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
                    userId: keyResult.userId,
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
                            return sub.eligibleProducts.some(
                                (p) => p === item.price.product.id
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
                userId: keyResult.userId,
                studioId: request.studioId,
                publishableKey: this._stripe.publishableKey,
                subscriptions,
                purchasableSubscriptions,
            };
        } catch (err) {
            console.log(
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
        ).map(async (s) => ({
            sub: s,
            info: await this._stripe.getProductAndPriceInfo(s.product),
        }));
        const productInfo = await Promise.all(promises);

        return productInfo
            .filter((i) => !!i.info)
            .map((i) => ({
                id: i.sub.id,
                name: i.info.name,
                description: i.info.description,
                featureList: i.sub.featureList,
                prices: [
                    {
                        id: 'default',
                        currency: i.info.default_price.currency,
                        cost: i.info.default_price.unit_amount,
                        interval: i.info.default_price.recurring.interval,
                        intervalLength:
                            i.info.default_price.recurring.interval_count,
                    },
                ],
            }));
    }

    /**
     * Creates a link that the user can be redirected to in order to manage their subscription.
     * Returns a link that the user can be redirected to to initiate a purchase of the subscription.
     */
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

                const hasManagableProduct = config.subscriptions.some((sub) =>
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

        if (!sub) {
            sub = purchasableSubscriptions.find((s) => s.defaultSubscription);
            if (sub) {
                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Using default subscription.`
                );
            }
        }

        if (!sub) {
            sub = purchasableSubscriptions[0];
            console.log(
                `[SubscriptionController] [createManageSubscriptionLink] Using first subscription.`
            );
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

    /**
     * Handles the webhook from Stripe for updating the internal database.
     */
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

                const items = subscription.items.data as Array<any>;

                let item: any;
                let sub: SubscriptionConfiguration['subscriptions'][0];
                items_loop: for (let i of items) {
                    for (let s of config.subscriptions) {
                        if (
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

                console.log(
                    `[SubscriptionController] [handleStripeWebhook] Customer ID: ${customerId}. Subscription status: ${status}. Tier: ${tier}. Is Active: ${active}.`
                );
                let user = await this._authStore.findUserByStripeCustomerId(
                    customerId
                );
                let studio: Studio;

                if (user) {
                    await this._authStore.updateSubscriptionInfo({
                        userId: user.id,
                        subscriptionStatus: status,
                        subscriptionId: sub.id,
                        stripeSubscriptionId,
                        stripeCustomerId: customerId,
                        currentPeriodEndMs: null,
                        currentPeriodStartMs: null,
                    });
                } else {
                    console.log(
                        `[SubscriptionController] [handleStripeWebhook] No user found for Customer ID (${customerId})`
                    );

                    studio =
                        await this._recordsStore.getStudioByStripeCustomerId(
                            customerId
                        );

                    if (studio) {
                        await this._authStore.updateSubscriptionInfo({
                            studioId: studio.id,
                            subscriptionStatus: status,
                            subscriptionId: sub.id,
                            stripeSubscriptionId,
                            stripeCustomerId: customerId,
                            currentPeriodEndMs: null,
                            currentPeriodStartMs: null,
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

                const invoice = parseResult.data.data.object;
                const stripeSubscriptionId = invoice.subscription;
                const subscription = await this._stripe.getSubscriptionById(
                    stripeSubscriptionId
                );
                const status = subscription.status;
                const customerId = invoice.customer;
                const lineItems = invoice.lines.data;
                const periodStartMs = subscription.current_period_start * 1000;
                const periodEndMs = subscription.current_period_end * 1000;
                const { sub, item } = findMatchingSubscription(lineItems);

                const authInvoice: UpdateSubscriptionPeriodRequest['invoice'] =
                    {
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
            }

            return {
                success: true,
            };
        } catch (err) {
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
}

/**
 * Attempts to parse the given JSON into a valid SubscriptionConfiguration object.
 * @param config The JSON to parse.
 */
export function tryParseSubscriptionConfig(
    config: string
): SubscriptionConfiguration | null {
    let subscriptionParseResult: JsonParseResult = tryParseJson(config);
    let subscriptionConfig: SubscriptionConfiguration;

    if (subscriptionParseResult.success && subscriptionParseResult.value) {
        subscriptionConfig = subscriptionParseResult.value;
        if (
            typeof subscriptionConfig !== 'object' ||
            typeof subscriptionConfig.cancelUrl !== 'string' ||
            typeof subscriptionConfig.returnUrl !== 'string' ||
            typeof subscriptionConfig.successUrl !== 'string' ||
            typeof subscriptionConfig.subscriptions !== 'object' ||
            !Array.isArray(subscriptionConfig.subscriptions) ||
            subscriptionConfig.subscriptions.some(
                (s) => !isValidSubscription(s)
            )
        ) {
            subscriptionConfig = null;
        }
    }

    return subscriptionConfig;
}

function isValidSubscription(
    sub: SubscriptionConfiguration['subscriptions'][0]
) {
    return (
        sub &&
        typeof sub.id === 'string' &&
        Array.isArray(sub.featureList) &&
        Array.isArray(sub.eligibleProducts) &&
        typeof sub.product === 'string' &&
        typeof sub.defaultSubscription === 'boolean'
    );
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
