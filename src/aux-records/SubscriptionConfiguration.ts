import { z } from 'zod';
import { isActiveSubscription } from './Utils';

export const subscriptionFeaturesSchema = z.object({
    records: z
        .object({
            allowed: z
                .boolean()
                .describe(
                    'Whether records are allowed for the subscription. If false, then every request to create or update a record will be rejected.'
                ),
            maxRecords: z
                .number()
                .describe(
                    'The maximum number of records allowed for the subscription.'
                )
                .int()
                .positive()
                .optional(),
        })
        .describe('The configuration for record features.')
        .optional(),
    data: z.object({
        allowed: z
            .boolean()
            .describe(
                'Whether data resources are allowed for the subscription. If false, then every request to create or update a data resource will be rejected.'
            ),
        maxItems: z
            .number({})
            .describe(
                'The maximum number of data resource items allowed for the subscription. If omitted, then there is no limit.'
            )
            .int()
            .positive()
            .optional(),
        maxReadsPerPeriod: z
            .number()
            .describe(
                'The maximum number of data item reads allowed per subscription period. If omitted, then there is no limit.'
            )
            .int()
            .positive()
            .optional(),
        maxWritesPerPeriod: z
            .number()
            .describe(
                'The maximum number of data item writes allowed per subscription period. If omitted, then there is no limit.'
            )
            .int()
            .positive()
            .optional(),
        maxItemSizeInBytes: z
            .number()
            .describe(
                'The maximum number of bytes that can be stored in a single data item. If set to null, then there is no limit. If omitted, then the limit is 500,000 bytes (500KB)'
            )
            .int()
            .positive()
            .nullable()
            .optional()
            .default(500000),
    }),
    files: z.object({
        allowed: z
            .boolean()
            .describe(
                'Whether file resources are allowed for the subscription. If false, then every request to create or update a file resource will be rejected.'
            ),
        maxFiles: z
            .number()
            .describe(
                'The maximum number of files allowed for the subscription. If omitted, then there is no limit.'
            )
            .int()
            .positive()
            .optional(),
        maxBytesPerFile: z
            .number()
            .describe(
                'The maximum number of bytes per file allowed for the subscription. If omitted, then there is no limit.'
            )
            .int()
            .positive()
            .optional(),
        maxBytesTotal: z
            .number()
            .describe(
                'The maximum number of file bytes that can be stored for the subscription. If omitted, then there is no limit.'
            )
            .int()
            .positive()
            .optional(),
    }),
    events: z.object({
        allowed: z
            .boolean()
            .describe(
                'Whether event resources are allowed for the subscription. If false, then every request to increment or count events will be rejected.'
            ),
        maxEvents: z
            .number()
            .describe(
                'The maximum number of distinct event names that are allowed for the subscription. If omitted, then there is no limit.'
            )
            .int()
            .positive()
            .optional(),
        maxUpdatesPerPeriod: z
            .number()
            .describe('Not currently implemented.')
            .int()
            .positive()
            .optional(),
    }),
    policies: z.object({
        allowed: z
            .boolean()
            .describe(
                'Whether policy resources are allowed for the subscription. If false, then every request to create or update a policy will be rejected.'
            ),
        maxPolicies: z
            .number()
            .describe('Not currently implemented.')
            .int()
            .positive()
            .optional(),
    }),
    ai: z.object({
        chat: z.object({
            allowed: z
                .boolean()
                .describe(
                    'Whether AI chat requests are allowed for the subscription. If false, then every request to generate AI chat will be rejected.'
                ),
            maxTokensPerPeriod: z
                .number()
                .describe(
                    'The maximum number of AI chat tokens allowed per subscription period. If omitted, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),
        }),
        images: z.object({
            allowed: z
                .boolean()
                .describe(
                    'Whether AI image requests are allowed for the subscription. If false, then every request to generate AI images will be rejected.'
                ),
            maxSquarePixelsPerPeriod: z
                .number()
                .describe(
                    'The maximum number of square pixels (pixels squared) that are allowed to be generated per subscription period. If omitted, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),
        }),
        skyboxes: z.object({
            allowed: z
                .boolean()
                .describe(
                    'Whether AI Skybox requests are allowed for the subscription. If false, then every request to generate AI skyboxes will be rejected.'
                ),
            maxSkyboxesPerPeriod: z
                .number()
                .describe(
                    'The maximum number of skyboxes that are allowed to be generated per subscription period. If omitted, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),
        }),
    }),
    insts: z
        .object({
            allowed: z
                .boolean()
                .describe(
                    'Whether insts are allowed for the subscription. If false, then every request to create or update an inst will be rejected.'
                ),
            maxInsts: z
                .number()
                .describe(
                    'The maximum number of private insts that are allowed for the subscription. If omitted, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),
            maxBytesPerInst: z
                .number()
                .describe(
                    'The maximum number of bytes that can be stored in an inst. If omitted, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),
            maxActiveConnectionsPerInst: z
                .number()
                .describe(
                    'The maximum number of active websocket connections that an inst can have. If omitted, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),
        })
        .optional(),
});

export const subscriptionConfigSchema = z.object({
    webhookSecret: z
        .string()
        .describe(
            'The Stripe Webhook secret. Used to validate that webhooks are actually coming from Stripe.'
        )
        .nonempty(),
    successUrl: z
        .string()
        .describe(
            'The URL that successful Stripe checkout sessions should be redirected to.'
        )
        .nonempty(),
    cancelUrl: z
        .string()
        .describe(
            'The URL that canceled Stripe checkout sessions should be redirected to.'
        )
        .nonempty(),
    returnUrl: z
        .string()
        .describe(
            'The URL that users should be redirected to when exiting the Stripe subscription management customer portal.'
        )
        .nonempty(),

    portalConfig: z
        .object({})
        .describe(
            'Additional options that should be passed to stripe.billingPortal.sessions.create().'
        )
        .passthrough()
        .optional()
        .nullable(),
    checkoutConfig: z
        .object({})
        .describe(
            'Additional options that should be passed to stripe.checkout.sessions.create().'
        )
        .passthrough()
        .optional()
        .nullable(),

    subscriptions: z
        .array(
            z.object({
                id: z
                    .string()
                    .describe(
                        'The ID of the subscription. Can be anything, but it must be unique to each subscription and never change.'
                    )
                    .nonempty(),
                product: z
                    .string()
                    .describe(
                        'The ID of the Stripe product that is being offered by this subscription. If omitted, then this subscription will be shown but not able to be purchased.'
                    )
                    .nonempty()
                    .optional(),
                featureList: z
                    .array(z.string().nonempty())
                    .describe(
                        'The list of features that should be shown for this subscription tier.'
                    ),
                eligibleProducts: z
                    .array(z.string().nonempty())
                    .describe(
                        'The list of Stripe product IDs that count as eligible for this subscription. Useful if you want to change the product of this subscription, but grandfather in existing users.'
                    )
                    .optional(),
                defaultSubscription: z
                    .boolean()
                    .describe(
                        "Whether this subscription should be granted to users if they don't already have a subscription. The first in the list of subscriptions that is marked as the default will be used. Defaults to false"
                    )
                    .optional(),
                purchasable: z
                    .boolean()
                    .describe(
                        'Whether this subscription is purchasable and should be offered to users who do not already have a subscription. If false, then this subscription will not be shown to users unless they already have an active subscription for it. Defaults to true.'
                    )
                    .optional(),
                name: z
                    .string()
                    .describe(
                        'The name of the subscription. Ignored if a Stripe product is specified.'
                    )
                    .nonempty()
                    .optional(),
                description: z
                    .string()
                    .describe(
                        'The description of the subscription. Ignored if a Stripe product is specified.'
                    )
                    .nonempty()
                    .optional(),
                tier: z
                    .string()
                    .describe(
                        'The tier of this subscription. Useful for grouping multiple subscriptions into the same set of features. Defaults to "beta"'
                    )
                    .nonempty()
                    .optional(),
                userOnly: z
                    .boolean()
                    .describe(
                        'Whether this subscription can only be purchased by individual users. Defaults to false.'
                    )
                    .optional(),
                studioOnly: z
                    .boolean()
                    .describe(
                        'Whether this subscription can only be purchased by studios. Defaults to false.'
                    )
                    .optional(),
            })
        )
        .describe('The list of subscriptions that are in use.'),

    tiers: z
        .object({})
        .describe(
            'The configuration for the subscription tiers. Each key should be a tier.'
        )
        .catchall(
            z
                .object({
                    features: subscriptionFeaturesSchema.optional(),
                })
                .describe('The configuration for an individual tier.')
        )
        .optional(),

    defaultFeatures: z
        .object({
            user: subscriptionFeaturesSchema
                .describe(
                    'The features that are available for users who either dont have a subscription for have a subscription for a tier that is not listed in the tiers configuration. Defaults to an object that allows all features.'
                )
                .optional(),
            studio: subscriptionFeaturesSchema
                .describe(
                    'The features that are available for studios who either dont have a subscription for have a subscription for a tier that is not listed in the tiers configuration. Defaults to an object that allows all features.'
                )
                .optional(),
            defaultPeriodLength: z
                .object({
                    days: z.number().int().nonnegative().optional(),
                    months: z.number().int().nonnegative().optional(),
                })
                .describe(
                    'The length of the period for users that do not have a subscription. Defaults to 1 month and 0 days.'
                )
                .optional()
                .default({
                    days: 0,
                    months: 1,
                }),
            publicInsts: z
                .object({
                    allowed: z
                        .boolean()
                        .describe(
                            'Whether public (temp) insts are allowed. If false, then every request to create or update a public inst will be rejected.'
                        ),
                    maxBytesPerInst: z
                        .number()
                        .describe(
                            'The maximum number of bytes that can be stored for a public inst. If omitted, then there is no limit.'
                        )
                        .int()
                        .positive()
                        .optional(),
                    maxActiveConnectionsPerInst: z
                        .number()
                        .describe(
                            'The maximum number of active connections that are allowed for a public inst. If omitted, then there is no limit.'
                        )
                        .int()
                        .positive()
                        .optional(),
                })
                .describe(
                    'The feature limits for public insts (insts that do not belong to a record and will expire after a preset time). Defaults to an object that allows all features.'
                )
                .optional(),
        })
        .optional(),
});
type ZodConfigSchema = z.infer<typeof subscriptionConfigSchema>;
type ZodConfigSchemaAssertion = HasType<
    ZodConfigSchema,
    SubscriptionConfiguration
>;

export function parseSubscriptionConfig(
    config: any,
    defaultConfig: SubscriptionConfiguration
): SubscriptionConfiguration {
    if (config) {
        const result = subscriptionConfigSchema.safeParse(config);
        if (result.success) {
            return result.data as SubscriptionConfiguration;
        } else {
            console.error(
                '[SubscriptionConfiguration] Invalid subscription config',
                result
            );
        }
    }
    return defaultConfig;
}

export interface SubscriptionConfiguration {
    /**
     * The information that should be used for subscriptions.
     */
    subscriptions: APISubscription[];

    /**
     * The configuration that should be passed to https://stripe.com/docs/api/checkout/sessions when creating a checkout session.
     */
    checkoutConfig?: any;

    /**
     * The configuration that should be passed to https://stripe.com/docs/api/customer_portal when creating a portal session.
     */
    portalConfig?: any;

    /**
     * The webhook secret that should be used for validating webhooks.
     */
    webhookSecret: string;

    /**
     * The URL that the user should be sent to upon successfully purchasing a subscription.
     */
    successUrl: string;

    /**
     * The URL that the user should be sent to upon cancelling a subscription purchase.
     */
    cancelUrl: string;

    /**
     * The URL that the user should be returned to after managing their subscriptions.
     */
    returnUrl: string;

    /**
     * The object that contains configurations for each subscription tier.
     */
    tiers: TiersConfiguration;

    /**
     * The features that should be used when a tier does not have a features configuration.
     */
    defaultFeatures: DefaultFeaturesConfiguration;
}

export interface APISubscription {
    /**
     * The ID of the subscription.
     * Only used for the API.
     */
    id: string;

    /**
     * The ID of the product that needs to be purchased for the subscription.
     * If omitted, then this subscription will be shown but not able to be purchased.
     */
    product?: string;

    /**
     * The list of features that should be shown for this subscription tier.
     */
    featureList: string[];

    /**
     * The list of products that are eligible for this subscription tier.
     */
    eligibleProducts?: string[];

    /**
     * Whether this subscription should be the default.
     */
    defaultSubscription?: boolean;

    /**
     * The name of the subscription.
     * Ignored if a Stripe product is specified.
     */
    name?: string;

    /**
     * The description of the subscription.
     * Ignored if a Stripe product is specified.
     */
    description?: string;

    /**
     * Whether the subscription should be offered for purchase.
     * Defaults to true.
     */
    purchasable?: boolean;

    /**
     * Whether the subscription is only purchasable by users.
     */
    userOnly?: boolean;

    /**
     * Whether the subscription is only purchasable by studios.
     */
    studioOnly?: boolean;

    /**
     * The tier that the subscription represents.
     * Defaults to "beta".
     */
    tier?: string;
}

export interface TiersConfiguration {
    [tier: string]: TierConfiguration;
}

/**
 * Defines an interface that contains the configuration for a tier.
 */
export interface TierConfiguration {
    /**
     * The configuration for the features for subscriptions on this tier.
     */
    features?: FeaturesConfiguration;
}

export interface DefaultFeaturesConfiguration {
    /**
     * The default features for users.
     */
    user: FeaturesConfiguration;

    /**
     * The default features for studios.
     */
    studio: FeaturesConfiguration;

    /**
     * The default period length.
     * Only used for users that do not have an active subscription.
     */
    defaultPeriodLength?: {
        /**
         * The number of days in the period.
         * Defaults to 0.
         */
        days?: number;

        /**
         * The number of months in the period.
         * Defaults to 0.
         */
        months?: number;
    };

    /**
     * The configuration for temporary insts.
     */
    publicInsts?: {
        /**
         * Whether they are allowed to be created.
         */
        allowed: boolean;

        /**
         * The maximum number of bytes that each inst can store.
         */
        maxBytesPerInst?: number;

        /**
         * The maximum number of active connections that each inst can have.
         */
        maxActiveConnectionsPerInst?: number;
    };
}

/**
 * Defines an interface that contains the configuration for features.
 */
export interface FeaturesConfiguration {
    records?: RecordFeaturesConfiguration;

    /**
     * The configuration for data features.
     */
    data: DataFeaturesConfiguration;

    /**
     * The configuration for file features.
     */
    files: FileFeaturesConfiguration;

    /**
     * The configuration for event features.
     */
    events: EventFeaturesConfiguration;

    /**
     * The configuration for AI features.
     */
    ai: AIFeaturesConfiguration;

    /**
     * The configuration for inst features.
     */
    insts: InstsFeaturesConfiguration;
}

export interface RecordFeaturesConfiguration {
    /**
     * Whether creating and managing records is allowed.
     */
    allowed: boolean;

    /**
     * The maximum number of records that are allowed.
     * If not specified, then there is no limit.
     */
    maxRecords?: number;
}

export interface DataFeaturesConfiguration {
    /**
     * Whether data resources should be allowed.
     */
    allowed: boolean;

    /**
     * The maximum number of items that are allowed.
     * If not specified, then there is no limit.
     */
    maxItems?: number;

    /**
     * The maximum number of item reads that are allowed per subscription period.
     * If not specified, then there is no limit.
     */
    maxReadsPerPeriod?: number;

    /**
     * The maximum number of item writes that are allowed per period.
     * If not specified, then there is no limit.
     */
    maxWritesPerPeriod?: number;

    /**
     * The maximum number of bytes that can be stored in a single data item.
     * If not specified, then the limit is 500,000 bytes (500KB).
     * If set to null, then there is no limit.
     */
    maxItemSizeInBytes?: number;
}

export interface FileFeaturesConfiguration {
    /**
     * Whether file resources are allowed.
     */
    allowed: boolean;

    /**
     * The maximum number of files that are allowed.
     * If not specified, then there is no limit.
     */
    maxFiles?: number;

    /**
     * The maximum number of bytes that are allowed per file.
     * If not specified, then there is no limit.
     */
    maxBytesPerFile?: number;

    /**
     * The maximum number of bytes that are allowed to be stored.
     * If not specified, then there is no limit.
     */
    maxBytesTotal?: number;
}

export interface EventFeaturesConfiguration {
    /**
     * Whether event resources are allowed.
     */
    allowed: boolean;
}

export interface AIFeaturesConfiguration {
    /**
     * The configuration for AI chat features.
     */
    chat: AIChatFeaturesConfiguration;

    /**
     * The configuration for AI image features.
     */
    images: AIImageFeaturesConfiguration;

    /**
     * The configuration for AI skybox features.
     */
    skyboxes: AISkyboxFeaturesConfiguration;
}

export interface AIChatFeaturesConfiguration {
    /**
     * Whether AI chat features are allowed.
     */
    allowed: boolean;

    /**
     * The maximum number of tokens that are allowed to be processed per request.
     * If not specified, then there is no limit.
     */
    maxTokensPerRequest?: number;

    /**
     * The maximum number of tokens that are allowed to be processed per subscription period.
     * If not specified, then there is no limit.
     */
    maxTokensPerPeriod?: number;
}

export interface AIImageFeaturesConfiguration {
    /**
     * Whether AI image features are allowed.
     */
    allowed: boolean;

    /**
     * The maximum number of square pixels that are allowed to be generated per request.
     * If not specified, then there is no limit.
     *
     * total pixels = (square pixels) ^ 2
     */
    maxSquarePixelsPerRequest?: number;

    /**
     * The maximum number of pixels that are allowed to be generated per subscription period.
     * If not specified, then there is no limit.
     *
     * total pixels = (square pixels) ^ 2
     */
    maxSquarePixelsPerPeriod?: number;
}

export interface AISkyboxFeaturesConfiguration {
    /**
     * Whether AI skybox features are allowed.
     */
    allowed: boolean;

    /**
     * The maximum number of skyboxes that are allowed to be generated per subscription period.
     * If not specified, then there is no limit.
     */
    maxSkyboxesPerPeriod?: number;
}

export interface InstsFeaturesConfiguration {
    /**
     * Whether inst features are allowed.
     */
    allowed: boolean;

    /**
     * The maximum number of insts that a subscription can have.
     */
    maxInsts?: number;

    /**
     * The maximum number of bytes that an inst can store.
     */
    maxBytesPerInst?: number;

    /**
     * The maximum number of concurrent connections allowed per inst.
     */
    maxActiveConnectionsPerInst?: number;
}

export function allowAllFeatures(): FeaturesConfiguration {
    return {
        records: {
            allowed: true,
        },
        ai: {
            chat: {
                allowed: true,
            },
            images: {
                allowed: true,
            },
            skyboxes: {
                allowed: true,
            },
        },
        data: {
            allowed: true,
        },
        events: {
            allowed: true,
        },
        files: {
            allowed: true,
        },
        insts: {
            allowed: true,
        },
    };
}

/**
 * Gets the features that are available for the given subscription.
 * Useful for determining which features a user/studio should have access to based on the ID of their subscription.
 * @param config The configuration. If null, then all  features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getSubscriptionFeatures(
    config: SubscriptionConfiguration,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio'
): FeaturesConfiguration {
    if (!config) {
        return allowAllFeatures();
    }
    if (config.tiers) {
        const roleSubscriptions = config.subscriptions.filter((s) =>
            subscriptionMatchesRole(s, type)
        );
        if (isActiveSubscription(subscriptionStatus)) {
            const sub = roleSubscriptions.find((s) => s.id === subscriptionId);
            const tier = sub?.tier;
            const features = tier ? config.tiers[tier]?.features : null;

            if (features) {
                return features;
            }
        } else {
            const sub = roleSubscriptions.find((s) => s.defaultSubscription);
            const tier = sub?.tier;
            const features = tier ? config.tiers[tier]?.features : null;

            if (features) {
                return features;
            }
        }
    }

    return config.defaultFeatures?.[type] ?? allowAllFeatures();
}

export function getSubscriptionTier(
    config: SubscriptionConfiguration,
    subscriptionStatus: string,
    subId: string
): string | null {
    if (!config) {
        return null;
    }

    if (!isActiveSubscription(subscriptionStatus)) {
        return null;
    }

    const sub = config.subscriptions.find((s) => s.id === subId);
    return sub?.tier ?? null;
}

/**
 * Determines if the subscription is allowed to be used for the given role.
 * @param subscription The subscription.
 * @param role The role.
 */
export function subscriptionMatchesRole(
    subscription: APISubscription,
    role: 'user' | 'studio'
) {
    const isUserOnly = subscription.userOnly ?? false;
    const isStudioOnly = subscription.studioOnly ?? false;
    const matchesRole =
        (isUserOnly && role === 'user') ||
        (isStudioOnly && role === 'studio') ||
        (!isUserOnly && !isStudioOnly);
    return matchesRole;
}

type HasType<T, Q extends T> = Q;
