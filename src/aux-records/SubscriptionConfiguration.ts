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
import { z } from 'zod';
import { isActiveSubscription } from './Utils';

export const webhookFeaturesSchema = z
    .object({
        allowed: z
            .boolean()
            .describe(
                'Whether webhook features are granted for the subscription.'
            ),

        maxItems: z
            .number()
            .describe(
                'The maximum number of webhook items that are allowed for the subscription. If not specified, then there is no limit.'
            )
            .int()
            .optional(),

        tokenLifetimeMs: z
            .number()
            .describe(
                'The lifetime of session tokens that are issued to the webhook in miliseconds. Defaults to 5 minutes.'
            )
            .int()
            .positive()
            .optional()
            .nullable()
            .default(5 * 60 * 1000),

        initTimeoutMs: z
            .number()
            .describe(
                'The maximum number of miliseconds that the webhook has to initialize. Defaults to 5000ms.'
            )
            .int()
            .positive()
            .optional()
            .nullable()
            .default(5000),

        requestTimeoutMs: z
            .number()
            .describe(
                'The maximum number of miliseconds that the webhook has to respond to a request after being initialized. Defaults to 5000ms'
            )
            .int()
            .positive()
            .optional()
            .nullable()
            .default(5000),

        fetchTimeoutMs: z
            .number()
            .describe(
                'The maximum number of miliseconds that the system will take to fetch the AUX state for the webhook. Defaults to 5000ms.'
            )
            .int()
            .positive()
            .optional()
            .nullable()
            .default(5000),

        addStateTimeoutMs: z
            .number()
            .describe(
                'The maximum number of miliseconds that the system will take to add the AUX state to the webhook simulation. Defaults to 1000ms.'
            )
            .int()
            .positive()
            .optional()
            .nullable()
            .default(1000),

        maxRunsPerPeriod: z
            .number()
            .describe(
                'The maximum number of webhook runs allowed per subscription period. If not specified, then there is no limit.'
            )
            .int()
            .positive()
            .optional(),

        maxRunsPerHour: z
            .number()
            .describe(
                'The maximum number of webhook runs allowed per hour for the subscription. If not specified, then there is no limit.'
            )
            .int()
            .positive()
            .optional(),
    })
    .describe(
        'The configuration for webhook features. Defaults to not allowed.'
    )
    .optional()
    .default({
        allowed: false,
    });

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
            allowedModels: z
                .array(z.string())
                .describe(
                    'The list of model IDs that are allowed for the subscription. If omitted, then all models are allowed.'
                )
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
        hume: z
            .object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether Hume AI features are allowed for the subscription. If false, then every request to generate Hume AI will be rejected.'
                    ),
            })
            .describe(
                'The configuration for Hume AI features for the subscription. Defaults to not allowed if omitted.'
            )
            .optional()
            .default({
                allowed: false,
            }),
        sloyd: z
            .object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether Sloyd AI features are allowed for the subscription. If false, then every request to generate Sloyd AI will be rejected.'
                    ),
                maxModelsPerPeriod: z
                    .number()
                    .describe(
                        'The maximum number of models that can be generated per subscription period. If omitted, then there is no limit.'
                    )
                    .positive()
                    .int()
                    .optional(),
            })
            .describe(
                'The configuration for Sloyd AI features for the subscription. Defaults to not allowed if omitted.'
            )
            .optional()
            .default({
                allowed: false,
            }),
        openai: z
            .object({
                realtime: z
                    .object({
                        allowed: z
                            .boolean()
                            .describe(
                                'Whether OpenAI realtime API features are allowed.'
                            ),
                        maxSessionsPerPeriod: z
                            .number()
                            .describe(
                                'The maximum number of realtime sessions that can be initiated per subscription period. If omitted, then there is no limit.'
                            )
                            .int()
                            .positive()
                            .optional(),
                        maxResponseOutputTokens: z
                            .number()
                            .describe(
                                'The maximum number of output tokens that can be generated per response per session. If omitted, then there is no limit.'
                            )
                            .int()
                            .positive()
                            .optional(),
                        allowedModels: z
                            .array(z.string())
                            .describe(
                                'The list of models that are allowed to be used with the realtime API. If ommited, then all models are allowed.'
                            )
                            .optional(),
                    })
                    .describe(
                        'The configuration for OpenAI realtime API features.'
                    )
                    .optional()
                    .default({
                        allowed: false,
                    }),
            })
            .describe(
                'The configuration for Open AI-specific features for the subscription. Defaults to not allowed if omitted.'
            )
            .optional()
            .default({}),
    }),
    insts: z.object({
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
    }),
    comId: z
        .object({
            allowed: z
                .boolean()
                .describe('Whether comId features are granted to the studio.'),
            // allowCustomComId: z
            //     .boolean()
            //     .describe(
            //         'Whether the studio is allowed to set their own comId. If false, then the user will be able to request changes to their comId, but they will not automatically apply.'
            //     ),
            maxStudios: z
                .number()
                .describe(
                    'The maximum number of studios that can be created in this comId. If omitted, then there is no limit.'
                )
                .positive()
                .int()
                .optional(),
        })
        .describe(
            'The configuration for comId features for studios. Defaults to not allowed.'
        )
        .optional()
        .default({
            allowed: false,
            // allowCustomComId: false,
        }),
    loom: z
        .object({
            allowed: z
                .boolean()
                .describe('Whether loom features are granted to the studio.'),
        })
        .describe(
            'The configuration for loom features for studios. Defaults to not allowed.'
        )
        .optional()
        .default({
            allowed: false,
        }),

    webhooks: webhookFeaturesSchema,

    notifications: z
        .object({
            allowed: z
                .boolean()
                .describe(
                    'Whether notifications are allowed for the subscription.'
                ),

            maxItems: z
                .number()
                .describe(
                    'The maximum number of notification items that are allowed for the subscription. If not specified, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),

            maxSubscribersPerItem: z
                .number()
                .describe(
                    'The maximum number of subscribers that a notification can have in the subscription. If not specified, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),

            maxSentNotificationsPerPeriod: z
                .number()
                .describe(
                    'The maximum number of notifications that can be sent per subscription period. This tracks the number of times the "sendNotification" operation was called. If not specified, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),

            maxSentPushNotificationsPerPeriod: z
                .number()
                .describe(
                    'The maximum number of push notifications that can be sent per subscription period. This tracks the actual number of push notifications that were sent to users. If not specified, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),
        })
        .describe(
            'The configuration for notification features. Defaults to not allowed.'
        )
        .optional()
        .default({
            allowed: false,
        }),

    packages: z
        .object({
            allowed: z
                .boolean()
                .describe('Whether packages are allowed for the subscription.'),

            maxItems: z
                .number()
                .describe(
                    'The maximum number of packages that are allowed for the subscription. If not specified, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),

            maxPackageVersions: z
                .number()
                .describe(
                    'The maximum number of package versions that are allowed for the subscription. If not specified, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),

            maxPackageVersionSizeInBytes: z
                .number()
                .describe(
                    'The maximum number of bytes that a single package version can be. If not specified, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),

            maxPackageBytesTotal: z
                .number()
                .describe(
                    'The maximum number of bytes that all package versions in the subscription can be. If not specified, then there is no limit.'
                )
                .int()
                .positive()
                .optional(),
        })
        .describe(
            'The configuration for package features. Defaults to allowed.'
        )
        .optional()
        .default({
            allowed: true,
        }),

    store: z
        .object({
            allowed: z.boolean().describe('Whether purchasable items features are granted to the studio.'),

            maxItems: z
                .number()
                .describe(
                    'The maximum number of purchasable items that can be created. If omitted, then there is no limit.'
                )
                .positive()
                .int()
                .optional(),

            currencyLimits: z.object({})
                .catchall(z.object({
                    maxCost: z.number()
                        .describe('The maximum cost that items can have in this currency.')
                        .positive()
                        .int(),
                    minCost: z.number()
                        .describe('The minimum cost that items can have in this currency. Note that this doesn\'t prevent free items, it only sets the minimum cost for a non-free item.')
                        .positive()
                        .int(),
                    fee: z.discriminatedUnion('type', [
                        z.object({
                            type: z.literal('percent'),
                            percent: z.number()
                                .describe('The integer percentage of the cost that should be charged as a fee. Must be between 0 and 100')
                                .int()
                                .min(0)
                                .max(100),
                        }),
                        z.object({
                            type: z.literal('fixed'),
                            amount: z.number()
                                .describe('The fixed amount in cents that should be charged as a fee. Must be a positive integer.')
                                .int()
                                .positive(),
                        })
                    ])
                    .describe('The fee that should be charged for purchases in this currency. If omitted, then there is no fee.')
                    .optional()
                    .nullable()
                }))
                .describe('The limits for each currency that can be used for purchasable items. If a currency is not specified, then it is not allowed')
                .optional()
                .default({
                    usd: {
                        maxCost: 100 * 1000, /// $1,000 US Dollars (USD)
                        minCost: 50, // $0.50 US Dollars (USD)
                    },
                })
        })
        .describe(
            'The configuration for purchasable items features for studios. Defaults to not allowed.'
        )
        .optional()
        .default({
            allowed: false
        }),
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
    publicInsts?: PublicInstsConfiguration;
}

export interface PublicInstsConfiguration {
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

    /**
     * The configuration for comId features.
     */
    comId?: StudioComIdFeaturesConfiguration;
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

    /**
     * The configuration for Hume AI features.
     */
    hume?: AIHumeFeaturesConfiguration;

    /**
     * The configuration for Sloyd AI features.
     */
    sloyd?: AISloydFeaturesConfiguration;

    /**
     * The configuration for OpenAI-specific features.
     */
    openai?: AIOpenAIFeaturesConfiguration;
}

export type AIOpenAIFeaturesConfiguration = z.infer<
    typeof subscriptionFeaturesSchema
>['ai']['openai'];

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

    /**
     * The list of model IDs that are allowed for the subscription.
     * If omitted, then all models are allowed.
     */
    allowedModels?: string[];
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

export interface AIHumeFeaturesConfiguration {
    /**
     * Whether Hume AI features are allowed.
     */
    allowed: boolean;
}

export interface AISloydFeaturesConfiguration {
    /**
     * The Sloyd AI features are allowed.
     */
    allowed: boolean;

    /**
     * The maximum number of models that can be generated per subscription period.
     * If not specified, then there is no limit.
     */
    maxModelsPerPeriod?: number;
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

export interface StudioComIdFeaturesConfiguration {
    /**
     * Whether comId features are granted to the studio.
     */
    allowed: boolean;

    // TODO:
    // /**
    //  * Whether the studio is allowed to set their own comId.
    //  * If false, then the user will be able to request changes to their comId, but they will not automatically apply.
    //  */
    // allowCustomComId: boolean;

    /**
     * The maximum number of studios that are allowed to be created in this comId.
     * If not specified, then there is no limit.
     */
    maxStudios?: number;
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
            hume: {
                allowed: true,
            },
            sloyd: {
                allowed: true,
            },
            openai: {
                realtime: {
                    allowed: true,
                },
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
        notifications: {
            allowed: true,
        },
        packages: {
            allowed: true,
        },
    };
}

export function denyAllFeatures(): FeaturesConfiguration {
    return {
        records: {
            allowed: false,
        },
        ai: {
            chat: {
                allowed: false,
            },
            images: {
                allowed: false,
            },
            skyboxes: {
                allowed: false,
            },
            hume: {
                allowed: false,
            },
            sloyd: {
                allowed: false,
            },
            openai: {
                realtime: {
                    allowed: false,
                },
            },
        },
        data: {
            allowed: false,
        },
        events: {
            allowed: false,
        },
        files: {
            allowed: false,
        },
        insts: {
            allowed: false,
        },
        notifications: {
            allowed: false,
        },
        packages: {
            allowed: false,
        },
    };
}

/**
 * Gets the package features that are available for the given subscription.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getPackageFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number | null,
    periodEndMs?: number | null,
    nowMs: number = Date.now()
): PackageFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return features.packages ?? { allowed: true };
}

/**
 * Gets the notification features that are available for the given subscription.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getNotificationFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number,
    periodEndMs?: number,
    nowMs: number = Date.now()
): NotificationFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return features.notifications ?? { allowed: false };
}

/**
 * Gets the webhook features that are available for the given subscription.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getWebhookFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number,
    periodEndMs?: number,
    nowMs: number = Date.now()
): WebhooksFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return features.webhooks ?? webhookFeaturesSchema.parse({ allowed: false });
}

/**
 * Gets the comId features that are available for the given subscription.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 */
export function getComIdFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    periodStartMs?: number,
    periodEndMs?: number,
    nowMs: number = Date.now()
): StudioComIdFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        'studio',
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return (
        features.comId ?? {
            allowed: false,
            // allowCustomComId: false,
        }
    );
}

/**
 * Gets the features that are available for the given subscription.
 * Useful for determining which features a user/studio should have access to based on the ID of their subscription.
 * @param config The configuration. If null, then all  features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 * @param periodStartMs The start of the subscription period in unix time in miliseconds. If omitted, then the period won't be checked.
 * @param periodEndMs The end of the subscription period in unix time in miliseconds. If omitted, then the period won't be checked.
 * @param nowMs The current time in milliseconds.
 */
export function getSubscriptionFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number | null,
    periodEndMs?: number | null,
    nowMs: number = Date.now()
): FeaturesConfiguration {
    if (!config) {
        return allowAllFeatures();
    }
    if (config.tiers) {
        const roleSubscriptions = config.subscriptions.filter((s) =>
            subscriptionMatchesRole(s, type)
        );
        if (
            isActiveSubscription(
                subscriptionStatus,
                periodStartMs,
                periodEndMs,
                nowMs
            )
        ) {
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
