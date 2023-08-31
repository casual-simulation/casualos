import { z } from 'zod';
import { isActiveSubscription } from './Utils';

export const subscriptionFeaturesSchema = z.object({
    records: z
        .object({
            allowed: z.boolean(),
            maxRecords: z.number().int().positive().optional(),
        })
        .optional(),
    data: z.object({
        allowed: z.boolean(),
        maxItems: z.number({}).int().positive().optional(),
        maxReadsPerPeriod: z.number().int().positive().optional(),
        maxWritesPerPeriod: z.number().int().positive().optional(),
    }),
    files: z.object({
        allowed: z.boolean(),
        maxFiles: z.number().int().positive().optional(),
        maxBytesPerFile: z.number().int().positive().optional(),
        maxBytesTotal: z.number().int().positive().optional(),
    }),
    events: z.object({
        allowed: z.boolean(),
        maxEvents: z.number().int().positive().optional(),
        maxUpdatesPerPeriod: z.number().int().positive().optional(),
    }),
    policies: z.object({
        allowed: z.boolean(),
        maxPolicies: z.number().int().positive().optional(),
    }),
    ai: z.object({
        chat: z.object({
            allowed: z.boolean(),
            maxTokensPerPeriod: z.number().int().positive().optional(),
        }),
        images: z.object({
            allowed: z.boolean(),
            maxSquarePixelsPerPeriod: z.number().int().positive().optional(),
        }),
        skyboxes: z.object({
            allowed: z.boolean(),
            maxSquarePixelsPerPeriod: z.number().int().positive().optional(),
        }),
    }),
});

export const subscriptionConfigSchema = z.object({
    webhookSecret: z.string().nonempty(),
    successUrl: z.string().nonempty(),
    cancelUrl: z.string().nonempty(),
    returnUrl: z.string().nonempty(),

    portalConfig: z.object({}).passthrough().optional().nullable(),
    checkoutConfig: z.object({}).passthrough().optional().nullable(),

    subscriptions: z.array(
        z.object({
            id: z.string().nonempty(),
            product: z.string().nonempty(),
            featureList: z.array(z.string().nonempty()),
            eligibleProducts: z.array(z.string().nonempty()),
            defaultSubscription: z.boolean().optional(),
            purchasable: z.boolean().optional(),
            tier: z.string().nonempty().optional(),
            userOnly: z.boolean().optional(),
            studioOnly: z.boolean().optional(),
        })
    ),

    tiers: z
        .object({})
        .catchall(
            z.object({
                features: subscriptionFeaturesSchema.optional(),
            })
        )
        .optional(),

    defaultFeatures: z
        .object({
            user: subscriptionFeaturesSchema.optional(),
            studio: subscriptionFeaturesSchema.optional(),
            defaultPeriodLength: z
                .object({
                    days: z.number().int().positive().optional(),
                    months: z.number().int().positive().optional(),
                })
                .default({
                    days: 0,
                    months: 1,
                }),
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
     */
    product: string;

    /**
     * The list of features that should be shown for this subscription tier.
     */
    featureList: string[];

    /**
     * The list of products that are eligible for this subscription tier.
     */
    eligibleProducts: string[];

    /**
     * Whether this subscription should be the default.
     */
    defaultSubscription?: boolean;

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
    };
}

export function getSubscriptionFeatures(
    config: SubscriptionConfiguration,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio'
): FeaturesConfiguration {
    if (!config) {
        return allowAllFeatures();
    }
    if (isActiveSubscription(subscriptionStatus)) {
        const sub = config.subscriptions.find((s) => s.id === subscriptionId);
        const tier = sub?.tier;
        const features = tier ? config.tiers[tier]?.features : null;

        if (features) {
            return features;
        }
    }

    return config.defaultFeatures?.[type] ?? allowAllFeatures();
}

type HasType<T, Q extends T> = Q;
