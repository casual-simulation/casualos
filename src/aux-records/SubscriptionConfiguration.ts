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
import { memoize } from 'es-toolkit';

type ZodConfigSchema = z.input<SubscriptionConfigSchema>;
type ZodConfigSchemaAssertion = HasType<
    ZodConfigSchema,
    SubscriptionConfiguration
>;

export const getWebhookFeaturesSchema = memoize(() =>
    z
        .object({
            allowed: z
                .boolean()
                .describe(
                    'Whether webhook features are granted for the subscription.'
                ),

            maxItems: z
                .int()
                .optional()
                .describe(
                    'The maximum number of webhook items that are allowed for the subscription. If not specified, then there is no limit.'
                ),

            tokenLifetimeMs: z
                .int()
                .positive()
                .optional()
                .nullable()
                .prefault(5 * 60 * 1000)
                .describe(
                    'The lifetime of session tokens that are issued to the webhook in miliseconds. Defaults to 5 minutes.'
                ),

            initTimeoutMs: z
                .int()
                .positive()
                .optional()
                .nullable()
                .prefault(5000)
                .describe(
                    'The maximum number of miliseconds that the webhook has to initialize. Defaults to 5000ms.'
                ),

            requestTimeoutMs: z
                .int()
                .positive()
                .optional()
                .nullable()
                .prefault(5000)
                .describe(
                    'The maximum number of miliseconds that the webhook has to respond to a request after being initialized. Defaults to 5000ms'
                ),

            fetchTimeoutMs: z
                .int()
                .positive()
                .optional()
                .nullable()
                .prefault(5000)
                .describe(
                    'The maximum number of miliseconds that the system will take to fetch the AUX state for the webhook. Defaults to 5000ms.'
                ),

            addStateTimeoutMs: z
                .int()
                .positive()
                .optional()
                .nullable()
                .prefault(1000)
                .describe(
                    'The maximum number of miliseconds that the system will take to add the AUX state to the webhook simulation. Defaults to 1000ms.'
                ),

            maxRunsPerPeriod: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of webhook runs allowed per subscription period. If not specified, then there is no limit.'
                ),

            maxRunsPerHour: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of webhook runs allowed per hour for the subscription. If not specified, then there is no limit.'
                ),
        })
        .optional()
        .prefault({
            allowed: false,
        })
        .describe(
            'The configuration for webhook features. Defaults to not allowed.'
        )
);

export type WebhookFeaturesSchema = ReturnType<typeof getWebhookFeaturesSchema>;

export const getCurrencyLimitsSchema = memoize(() =>
    z
        .object({})
        .catchall(
            z.object({
                maxCost: z
                    .int()
                    .positive()
                    .describe(
                        'The maximum cost that items can have in this currency.'
                    ),
                minCost: z
                    .int()
                    .positive()
                    .describe(
                        "The minimum cost that items can have in this currency. Note that this doesn't prevent free items, it only sets the minimum cost for a non-free item."
                    ),
                fee: z
                    .discriminatedUnion('type', [
                        z.object({
                            type: z.literal('percent'),
                            percent: z
                                .int()
                                .min(0)
                                .max(100)
                                .describe(
                                    'The integer percentage of the cost that should be charged as a fee. Must be between 0 and 100'
                                ),
                        }),
                        z.object({
                            type: z.literal('fixed'),
                            amount: z
                                .int()
                                .positive()
                                .describe(
                                    'The fixed amount in cents that should be charged as a fee. Must be a positive integer.'
                                ),
                        }),
                    ])
                    .optional()
                    .nullable()
                    .describe(
                        'The fee that should be charged for purchases in this currency. If omitted, then there is no fee.'
                    ),
            })
        )
        .optional()
        .prefault({
            usd: {
                maxCost: 100 * 1000, /// $1,000 US Dollars (USD)
                minCost: 50, // $0.50 US Dollars (USD)
            },
        })
        .describe(
            'The limits for each currency that can be used for purchasable items. If a currency is not specified, then it is not allowed'
        )
);

export type CurrencyLimitsSchema = ReturnType<typeof getCurrencyLimitsSchema>;

export const getStoreFeaturesSchema = memoize(() =>
    z
        .object({
            allowed: z
                .boolean()
                .describe(
                    'Whether purchasable items features are granted to the studio.'
                ),

            maxItems: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of purchasable items that can be created. If omitted, then there is no limit.'
                ),

            currencyLimits: getCurrencyLimitsSchema(),
        })
        .optional()
        .prefault({
            allowed: false,
        })
        .describe(
            'The configuration for purchasable items features for studios. Defaults to not allowed.'
        )
);

export type StoreFeaturesSchema = ReturnType<typeof getStoreFeaturesSchema>;

export const getContractFeaturesSchema = memoize(() =>
    z
        .object({
            allowed: z
                .boolean()
                .describe(
                    'Whether contract features are granted to the user/studio.'
                ),

            maxItems: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of contracts that can be created. If omitted, then there is no limit.'
                ),

            currencyLimits: getCurrencyLimitsSchema(),
        })
        .optional()
        .prefault({
            allowed: false,
        })
        .describe(
            'The configuration for contract features. Defaults to not allowed'
        )
);

export type ContractFeaturesSchema = ReturnType<
    typeof getContractFeaturesSchema
>;

export const getDataFeaturesSchema = memoize(() =>
    z.object({
        allowed: z
            .boolean()
            .describe(
                'Whether data resources are allowed for the subscription. If false, then every request to create or update a data resource will be rejected.'
            ),
        maxItems: z
            .int()
            .positive()
            .optional()
            .describe(
                'The maximum number of data resource items allowed for the subscription. If omitted, then there is no limit.'
            ),
        maxReadsPerPeriod: z
            .int()
            .positive()
            .optional()
            .describe(
                'The maximum number of data item reads allowed per subscription period. If omitted, then there is no limit.'
            ),
        maxWritesPerPeriod: z
            .int()
            .positive()
            .optional()
            .describe(
                'The maximum number of data item writes allowed per subscription period. If omitted, then there is no limit.'
            ),
        maxItemSizeInBytes: z
            .int()
            .positive()
            .nullable()
            .optional()
            .prefault(500000)
            .describe(
                'The maximum number of bytes that can be stored in a single data item. If set to null, then there is no limit. If omitted, then the limit is 500,000 bytes (500KB)'
            ),

        creditFeePerRead: z
            .int()
            .optional()
            .describe(
                'The number of credits that are charged for each read operation. If not specified, then there is no fee.'
            ),

        creditFeePerWrite: z
            .int()
            .optional()
            .describe(
                'The number of credits that are charged for each write operation. If not specified, then there is no fee.'
            ),
    })
);

export type DataFeaturesSchema = ReturnType<typeof getDataFeaturesSchema>;

export const getSubscriptionFeaturesSchema = memoize(() =>
    z.object({
        records: z
            .object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether records are allowed for the subscription. If false, then every request to create or update a record will be rejected.'
                    ),
                maxRecords: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of records allowed for the subscription.'
                    ),
            })
            .optional()
            .describe('The configuration for record features.'),
        data: getDataFeaturesSchema(),
        files: z.object({
            allowed: z
                .boolean()
                .describe(
                    'Whether file resources are allowed for the subscription. If false, then every request to create or update a file resource will be rejected.'
                ),
            maxFiles: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of files allowed for the subscription. If omitted, then there is no limit.'
                ),
            maxBytesPerFile: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of bytes per file allowed for the subscription. If omitted, then there is no limit.'
                ),
            maxBytesTotal: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of file bytes that can be stored for the subscription. If omitted, then there is no limit.'
                ),

            creditFeePerBytePerPeriod: z
                .int()
                .optional()
                .describe(
                    'The number of credits that are charged for each byte stored in files per subscription period. If not specified, then there is no fee.'
                ),

            creditFeePerFilePerPeriod: z
                .int()
                .optional()
                .describe(
                    'The number of credits that are charged for each file per subscription period. If not specified, then there is no fee.'
                ),
        }),
        events: z.object({
            allowed: z
                .boolean()
                .describe(
                    'Whether event resources are allowed for the subscription. If false, then every request to increment or count events will be rejected.'
                ),
            maxEvents: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of distinct event names that are allowed for the subscription. If omitted, then there is no limit.'
                ),
            maxUpdatesPerPeriod: z
                .int()
                .positive()
                .optional()
                .describe('Not currently implemented.'),
        }),
        policies: z.object({
            allowed: z
                .boolean()
                .describe(
                    'Whether policy resources are allowed for the subscription. If false, then every request to create or update a policy will be rejected.'
                ),
            maxPolicies: z
                .int()
                .positive()
                .optional()
                .describe('Not currently implemented.'),
        }),
        ai: z.object({
            chat: z.object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether AI chat requests are allowed for the subscription. If false, then every request to generate AI chat will be rejected.'
                    ),
                maxTokensPerPeriod: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of AI chat tokens allowed per subscription period. If omitted, then there is no limit.'
                    ),
                allowedModels: z
                    .array(z.string())
                    .optional()
                    .describe(
                        'The list of model IDs that are allowed for the subscription. If omitted, then all models are allowed.'
                    ),

                creditFeePerInputToken: z
                    .int()
                    .optional()
                    .describe(
                        'The number of credits that are charged for each input token. If not specified, then there is no fee.'
                    ),

                creditFeePerOutputToken: z
                    .int()
                    .optional()
                    .describe(
                        'The number of credits that are charged for each output token. If not specified, then there is no fee.'
                    ),
            }),
            images: z.object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether AI image requests are allowed for the subscription. If false, then every request to generate AI images will be rejected.'
                    ),
                maxSquarePixelsPerPeriod: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of square pixels (pixels squared) that are allowed to be generated per subscription period. If omitted, then there is no limit.'
                    ),

                creditFeePerSquarePixel: z
                    .int()
                    .optional()
                    .describe(
                        'The number of credits that are charged for each square pixel that is generated. If not specified, then there is no fee.'
                    ),
            }),
            skyboxes: z.object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether AI Skybox requests are allowed for the subscription. If false, then every request to generate AI skyboxes will be rejected.'
                    ),
                maxSkyboxesPerPeriod: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of skyboxes that are allowed to be generated per subscription period. If omitted, then there is no limit.'
                    ),

                creditFeePerSkybox: z
                    .int()
                    .optional()
                    .describe(
                        'The number of credits that are charged for each skybox that is generated. If not specified, then there is no fee.'
                    ),
            }),
            hume: z
                .object({
                    allowed: z
                        .boolean()
                        .describe(
                            'Whether Hume AI features are allowed for the subscription. If false, then every request to generate Hume AI will be rejected.'
                        ),
                })
                .optional()
                .prefault({
                    allowed: false,
                })
                .describe(
                    'The configuration for Hume AI features for the subscription. Defaults to not allowed if omitted.'
                ),
            sloyd: z
                .object({
                    allowed: z
                        .boolean()
                        .describe(
                            'Whether Sloyd AI features are allowed for the subscription. If false, then every request to generate Sloyd AI will be rejected.'
                        ),
                    maxModelsPerPeriod: z
                        .int()
                        .positive()
                        .optional()
                        .describe(
                            'The maximum number of models that can be generated per subscription period. If omitted, then there is no limit.'
                        ),
                })
                .optional()
                .prefault({
                    allowed: false,
                })
                .describe(
                    'The configuration for Sloyd AI features for the subscription. Defaults to not allowed if omitted.'
                ),
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
                                .int()
                                .positive()
                                .optional()
                                .describe(
                                    'The maximum number of realtime sessions that can be initiated per subscription period. If omitted, then there is no limit.'
                                ),
                            maxResponseOutputTokens: z
                                .int()
                                .positive()
                                .optional()
                                .describe(
                                    'The maximum number of output tokens that can be generated per response per session. If omitted, then there is no limit.'
                                ),
                            allowedModels: z
                                .array(z.string())
                                .optional()
                                .describe(
                                    'The list of models that are allowed to be used with the realtime API. If ommited, then all models are allowed.'
                                ),

                            creditFeePerRealtimeSession: z
                                .int()
                                .optional()
                                .describe(
                                    'The number of credits that are charged for each realtime session that is initiated. If not specified, then there is no fee.'
                                ),
                        })
                        .optional()
                        .prefault({
                            allowed: false,
                        })
                        .describe(
                            'The configuration for OpenAI realtime API features.'
                        ),
                })
                .optional()
                .prefault({})
                .describe(
                    'The configuration for Open AI-specific features for the subscription. Defaults to not allowed if omitted.'
                ),
        }),
        insts: z.object({
            allowed: z
                .boolean()
                .describe(
                    'Whether insts are allowed for the subscription. If false, then every request to create or update an inst will be rejected.'
                ),
            maxInsts: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of private insts that are allowed for the subscription. If omitted, then there is no limit.'
                ),
            maxBytesPerInst: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of bytes that can be stored in an inst. If omitted, then there is no limit.'
                ),
            maxActiveConnectionsPerInst: z
                .int()
                .positive()
                .optional()
                .describe(
                    'The maximum number of active websocket connections that an inst can have. If omitted, then there is no limit.'
                ),

            creditFeePerInstPerPeriod: z
                .int()
                .optional()
                .describe(
                    'The number of credits that are charged for each inst per subscription period. If not specified, then there is no fee.'
                ),

            creditFeePerBytePerPeriod: z
                .int()
                .optional()
                .describe(
                    'The number of credits that are charged for each byte stored in an inst per subscription period. If not specified, then there is no fee.'
                ),
        }),
        comId: z
            .object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether comId features are granted to the studio.'
                    ),
                maxStudios: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of studios that can be created in this comId. If omitted, then there is no limit.'
                    ),
                maxDomains: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of custom domains that can be used with this comId. If omitted, then there is no limit.'
                    ),
            })
            .optional()
            .prefault({
                allowed: false,
            })
            .describe(
                'The configuration for comId features for studios. Defaults to not allowed.'
            ),

        loom: z
            .object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether loom features are granted to the studio.'
                    ),
            })
            .optional()
            .prefault({
                allowed: false,
            })
            .describe(
                'The configuration for loom features for studios. Defaults to not allowed.'
            ),

        webhooks: getWebhookFeaturesSchema(),

        notifications: z
            .object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether notifications are allowed for the subscription.'
                    ),

                maxItems: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of notification items that are allowed for the subscription. If not specified, then there is no limit.'
                    ),

                maxSubscribersPerItem: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of subscribers that a notification can have in the subscription. If not specified, then there is no limit.'
                    ),

                maxSentNotificationsPerPeriod: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of notifications that can be sent per subscription period. This tracks the number of times the "sendNotification" operation was called. If not specified, then there is no limit.'
                    ),

                maxSentPushNotificationsPerPeriod: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of push notifications that can be sent per subscription period. This tracks the actual number of push notifications that were sent to users. If not specified, then there is no limit.'
                    ),

                creditFeePerNotificationSent: z
                    .int()
                    .optional()
                    .describe(
                        'The number of credits that it costs to send a notification. If not specified, then sending notifications is free.'
                    ),
                creditFeePerPushNotificationSent: z
                    .int()
                    .optional()
                    .describe(
                        'The number of credits that it costs to send a push notification. If not specified, then sending push notifications is free.'
                    ),
                creditFeePerSubscriberPerPeriod: z
                    .int()
                    .optional()
                    .describe(
                        'The number of credits that are charged for each subscriber per subscription period. If not specified, then there is no fee.'
                    ),
            })
            .optional()
            .prefault({
                allowed: false,
            })
            .describe(
                'The configuration for notification features. Defaults to not allowed.'
            ),

        packages: z
            .object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether packages are allowed for the subscription.'
                    ),

                maxItems: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of packages that are allowed for the subscription. If not specified, then there is no limit.'
                    ),

                maxPackageVersions: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of package versions that are allowed for the subscription. If not specified, then there is no limit.'
                    ),

                maxPackageVersionSizeInBytes: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of bytes that a single package version can be. If not specified, then there is no limit.'
                    ),

                maxPackageBytesTotal: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of bytes that all package versions in the subscription can be. If not specified, then there is no limit.'
                    ),
            })
            .optional()
            .prefault({
                allowed: true,
            })
            .describe(
                'The configuration for package features. Defaults to allowed.'
            ),

        search: z
            .object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether search records are allowed for the subscription.'
                    ),
                maxItems: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of search records that can be created for the subscription. If not specified, then there is no limit.'
                    ),
            })
            .optional()
            .prefault({
                allowed: true,
            })
            .describe(
                'The configuration for search records features. Defaults to allowed.'
            ),

        databases: z
            .object({
                allowed: z
                    .boolean()
                    .describe(
                        'Whether database records are allowed for the subscription.'
                    ),
                maxItems: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of database records that can be created for the subscription. If not specified, then there is no limit.'
                    ),

                maxBytesPerDatabase: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum size of the database in bytes. If not specified, then there is no limit.'
                    ),
            })
            .optional()
            .prefault({
                allowed: true,
            })
            .describe(
                'The configuration for database records features. Defaults to allowed.'
            ),

        store: getStoreFeaturesSchema(),

        contracts: getContractFeaturesSchema(),
    })
);

export type SubscriptionFeaturesSchema = ReturnType<
    typeof getSubscriptionFeaturesSchema
>;

export const getSubscriptionConfigSchema = memoize(() =>
    z.object({
        webhookSecret: z
            .string()
            .nonempty()
            .describe(
                'The Stripe Webhook secret. Used to validate that webhooks are actually coming from Stripe.'
            ),
        successUrl: z
            .string()
            .nonempty()
            .describe(
                'The URL that successful Stripe checkout sessions should be redirected to.'
            ),
        cancelUrl: z
            .string()
            .nonempty()
            .describe(
                'The URL that canceled Stripe checkout sessions should be redirected to.'
            ),
        returnUrl: z
            .string()
            .nonempty()
            .describe(
                'The URL that users should be redirected to when exiting the Stripe subscription management customer portal.'
            ),

        portalConfig: z
            .looseObject({})
            .optional()
            .nullable()
            .describe(
                'Additional options that should be passed to stripe.billingPortal.sessions.create().'
            ),
        checkoutConfig: z
            .looseObject({})
            .optional()
            .nullable()
            .describe(
                'Additional options that should be passed to stripe.checkout.sessions.create().'
            ),

        subscriptions: z
            .array(
                z.object({
                    id: z
                        .string()
                        .describe(
                            'The ID of the subscription. Can be anything, but it must be unique to each subscription and never change.'
                        ),
                    product: z
                        .string()
                        .optional()
                        .describe(
                            'The ID of the Stripe product that is being offered by this subscription. If omitted, then this subscription will be shown but not able to be purchased.'
                        ),
                    featureList: z
                        .array(z.string())
                        .describe(
                            'The list of features that should be shown for this subscription tier.'
                        ),
                    eligibleProducts: z
                        .array(z.string())
                        .optional()
                        .describe(
                            'The list of Stripe product IDs that count as eligible for this subscription. Useful if you want to change the product of this subscription, but grandfather in existing users.'
                        ),
                    defaultSubscription: z
                        .boolean()
                        .optional()
                        .describe(
                            "Whether this subscription should be granted to users if they don't already have a subscription. The first in the list of subscriptions that is marked as the default will be used. Defaults to false"
                        ),
                    purchasable: z
                        .boolean()
                        .optional()
                        .describe(
                            'Whether this subscription is purchasable and should be offered to users who do not already have a subscription. If false, then this subscription will not be shown to users unless they already have an active subscription for it. Defaults to true.'
                        ),
                    name: z
                        .string()
                        .optional()
                        .describe(
                            'The name of the subscription. Ignored if a Stripe product is specified.'
                        ),
                    description: z
                        .string()
                        .optional()
                        .describe(
                            'The description of the subscription. Ignored if a Stripe product is specified.'
                        ),
                    tier: z
                        .string()
                        .optional()
                        .describe(
                            'The tier of this subscription. Useful for grouping multiple subscriptions into the same set of features. Defaults to "beta"'
                        ),
                    userOnly: z
                        .boolean()
                        .optional()
                        .describe(
                            'Whether this subscription can only be purchased by individual users. Defaults to false.'
                        ),
                    studioOnly: z
                        .boolean()
                        .optional()
                        .describe(
                            'Whether this subscription can only be purchased by studios. Defaults to false.'
                        ),

                    creditGrant: z
                        .union([
                            z
                                .int()
                                .positive()
                                .describe(
                                    'The number of credits that should be granted to the user/studio upon purchasing (and renewal) of this subscription.'
                                ),
                            z.enum([
                                'match-invoice', // Grants credits equal to the total of the invoice that pays for the subscription.
                            ]),
                        ])
                        .optional()
                        .nullable()
                        .describe(
                            'The number of credits that should be granted to the user/studio upon purchasing (and renewal) of this subscription. Defaults to 0.'
                        ),
                })
            )
            .describe('The list of subscriptions that are in use.'),

        tiers: z
            .object({})
            .catchall(
                z
                    .object({
                        features: getSubscriptionFeaturesSchema().optional(),
                    })
                    .describe('The configuration for an individual tier.')
            )
            .optional()
            .describe(
                'The configuration for the subscription tiers. Each key should be a tier.'
            ),

        defaultFeatures: z
            .object({
                user: getSubscriptionFeaturesSchema()
                    .optional()
                    .describe(
                        'The features that are available for users who either dont have a subscription for have a subscription for a tier that is not listed in the tiers configuration. Defaults to an object that allows all features.'
                    ),
                studio: getSubscriptionFeaturesSchema()
                    .optional()
                    .describe(
                        'The features that are available for studios who either dont have a subscription for have a subscription for a tier that is not listed in the tiers configuration. Defaults to an object that allows all features.'
                    ),
                defaultPeriodLength: z
                    .object({
                        days: z.int().nonnegative().optional(),
                        months: z.int().nonnegative().optional(),
                    })
                    .optional()
                    .prefault({
                        days: 0,
                        months: 1,
                    })
                    .describe(
                        'The length of the period for users that do not have a subscription. Defaults to 1 month and 0 days.'
                    ),
                publicInsts: z
                    .object({
                        allowed: z
                            .boolean()
                            .describe(
                                'Whether public (temp) insts are allowed. If false, then every request to create or update a public inst will be rejected.'
                            ),
                        maxBytesPerInst: z
                            .int()
                            .positive()
                            .optional()
                            .describe(
                                'The maximum number of bytes that can be stored for a public inst. If omitted, then there is no limit.'
                            ),
                        maxActiveConnectionsPerInst: z
                            .int()
                            .positive()
                            .optional()
                            .describe(
                                'The maximum number of active connections that are allowed for a public inst. If omitted, then there is no limit.'
                            ),
                    })
                    .optional()
                    .describe(
                        'The feature limits for public insts (insts that do not belong to a record and will expire after a preset time). Defaults to an object that allows all features.'
                    ),
            })
            .optional(),
    })
);

export type SubscriptionConfigSchema = ReturnType<
    typeof getSubscriptionConfigSchema
>;

export function parseSubscriptionConfig(
    config: any,
    defaultConfig: SubscriptionConfiguration
): SubscriptionConfiguration {
    if (config) {
        const result = getSubscriptionConfigSchema().safeParse(config);
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

    /**
     * The number of credits that should be granted to the user/studio upon purchasing (and renewal) of this subscription.
     * Defaults to 0.
     */
    creditGrant?: number | 'match-invoice';
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
     * The configuration for policy features.
     */
    policies: z.infer<SubscriptionFeaturesSchema>['policies'];

    /**
     * The configuration for comId features.
     */
    comId?: StudioComIdFeaturesConfiguration;

    /**
     * The configuration for loom features.
     */
    loom?: StudioLoomFeaturesConfiguration;

    /**
     * The configuration for webhook features.
     */
    webhooks?: WebhooksFeaturesConfiguration;

    /**
     * The configuration for notification features.
     */
    notifications?: NotificationFeaturesConfiguration;

    /**
     * The configuration for package features.
     */
    packages?: PackageFeaturesConfiguration;

    /**
     * The configuration for search features.
     */
    search?: SearchFeaturesConfiguration;

    /**
     * The configuration for database features.
     */
    databases?: DatabasesFeaturesConfiguration;

    /**
     * The configuration for purchasable items features.
     */
    store?: PurchasableItemFeaturesConfiguration;

    /**
     * The configuration for contract features.
     */
    contracts?: ContractFeaturesConfiguration;
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

export type DataFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['data'];

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

export type AIOpenAIFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['ai']['openai'];

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

    /**
     * The number of credits that are charged for each input token.
     * If not specified, then there is no fee.
     */
    creditFeePerInputToken?: number;

    /**
     * The number of credits that are charged for each output token.
     * If not specified, then there is no fee.
     */
    creditFeePerOutputToken?: number;
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

    /**
     * The number of credits that are charged for each square pixel that is generated.
     * If not specified, then there is no fee.
     */
    creditFeePerSquarePixel?: number;
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

    /**
     * The number of credits that are charged for each skybox that is generated.
     * If not specified, then there is no fee.
     */
    creditFeePerSkybox?: number;
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

    /**
     * The maximum number of domains that can be used with this comId.
     */
    maxDomains?: number;
}

export type StudioLoomFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['loom'];

export type WebhooksFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['webhooks'];

export type NotificationFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['notifications'];

export type PackageFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['packages'];

export type SearchFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['search'];

export type DatabasesFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['databases'];

export type PurchasableItemFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['store'];

export type ContractFeaturesConfiguration =
    z.infer<SubscriptionFeaturesSchema>['contracts'];

export function allowAllFeatures(): FeaturesConfiguration {
    return getSubscriptionFeaturesSchema().parse({
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
        policies: {
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
        search: {
            allowed: true,
        },
        databases: {
            allowed: true,
        },
        contracts: {
            allowed: true,
        },
        loom: {
            allowed: true,
        },
        webhooks: {
            allowed: true,
        },
        store: {
            allowed: true,
        },
    } satisfies z.input<SubscriptionFeaturesSchema>);
}

export function allowAllDefaultFeatures(): FeaturesConfiguration {
    return getSubscriptionFeaturesSchema().parse({
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
        policies: {
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
        search: {
            allowed: true,
        },
        databases: {
            allowed: true,
        },
    } satisfies z.input<SubscriptionFeaturesSchema>);
}

export function denyAllFeatures(): FeaturesConfiguration {
    return getSubscriptionFeaturesSchema().parse({
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
        policies: {
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
        search: {
            allowed: false,
        },
        databases: {
            allowed: false,
        },
        contracts: {
            allowed: false,
        },
    } satisfies z.input<SubscriptionFeaturesSchema>);
}

/**
 * Gets the contract features that are available for the given subscription.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getContractFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number | null,
    periodEndMs?: number | null,
    nowMs: number = Date.now()
): ContractFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return (
        features.contracts ??
        getContractFeaturesSchema().parse({
            allowed: false,
        } satisfies z.input<SubscriptionFeaturesSchema>['contracts'])
    );
}

/**
 * Gets the database features that are available for the given subscription.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getDatabaseFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number | null,
    periodEndMs?: number | null,
    nowMs: number = Date.now()
): DatabasesFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return features.databases ?? { allowed: true };
}

/**
 * Gets the search features that are available for the given subscription.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getSearchFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number | null,
    periodEndMs?: number | null,
    nowMs: number = Date.now()
): SearchFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return features.search ?? { allowed: true };
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
    return (
        features.webhooks ??
        getWebhookFeaturesSchema().parse({ allowed: false })
    );
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
 * Gets the purchasableItems features that are available for the given subscription.
 * Gets the comId features that are available for the given subscription.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 */
export function getPurchasableItemsFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number,
    periodEndMs?: number,
    nowMs: number = Date.now()
): PurchasableItemFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return (
        features.store ??
        getStoreFeaturesSchema().parse({
            allowed: false,
        } satisfies z.input<SubscriptionFeaturesSchema>['store'])
    );
}

/**
 * Gets the loom features that are available for the given subscription.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 */
export function getLoomFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    periodStartMs?: number,
    periodEndMs?: number,
    nowMs: number = Date.now()
): StudioLoomFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        'studio',
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return features.loom ?? { allowed: false };
}

/**
 * Gets the Hume AI features that are allowed for the given subscription.
 * If hume ai features are not configured, then they are not allowed.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getHumeAiFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number,
    periodEndMs?: number,
    nowMs: number = Date.now()
): AIHumeFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return features.ai.hume ?? { allowed: false };
}

/**
 * Gets the Sloyd AI features that are allowed for the given subscription.
 * If sloyd ai features are not configured, then they are not allowed.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getSloydAiFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number,
    periodEndMs?: number,
    nowMs: number = Date.now()
): AISloydFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return features.ai.sloyd ?? { allowed: false };
}

/**
 * Gets the OpenAI-specific features that are allowed for the given subscription.
 * If OpenAI features are not configured, then they are not allowed.
 * @param config The configuration. If null, then all default features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 */
export function getOpenAiFeatures(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number,
    periodEndMs?: number,
    nowMs: number = Date.now()
): AIOpenAIFeaturesConfiguration {
    const features = getSubscriptionFeatures(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    return (
        features.ai.openai ?? {
            realtime: {
                allowed: false,
            },
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
    const sub = getSubscription(
        config,
        subscriptionStatus,
        subscriptionId,
        type,
        periodStartMs,
        periodEndMs,
        nowMs
    );
    if (typeof sub === 'undefined') {
        return allowAllFeatures();
    } else if (sub) {
        const tier = sub?.tier;
        const features = tier ? config?.tiers?.[tier]?.features : null;

        if (features) {
            return features;
        }
    }

    return config.defaultFeatures?.[type] ?? allowAllFeatures();
}

/**
 * Gets the subscription for the given configuration, subscription status, subscription ID, user type and period.
 *
 * If there is no subscription configuration, then undefined is returned.
 * If no subscription could be found that matches the given parameters, then null is returned.
 *
 * @param config The configuration. If null, then all  features are allowed.
 * @param subscriptionStatus The status of the subscription.
 * @param subscriptionId The ID of the subscription.
 * @param type The type of the user.
 * @param periodStartMs The start of the subscription period in unix time in miliseconds. If omitted, then the period won't be checked.
 * @param periodEndMs The end of the subscription period in unix time in miliseconds. If omitted, then the period won't be checked.
 * @param nowMs The current time in milliseconds.
 */
export function getSubscription(
    config: SubscriptionConfiguration | null,
    subscriptionStatus: string,
    subscriptionId: string,
    type: 'user' | 'studio',
    periodStartMs?: number | null,
    periodEndMs?: number | null,
    nowMs: number = Date.now()
) {
    if (!config) {
        return undefined;
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

            if (sub) {
                return sub;
            }
        }

        const sub = roleSubscriptions.find((s) => s.defaultSubscription);

        if (sub) {
            return sub;
        }
    }

    return null;
}

export function getSubscriptionTier(
    config: SubscriptionConfiguration,
    subscriptionStatus: string,
    subId: string,
    type: 'user' | 'studio'
): string | null {
    const sub = getSubscription(config, subscriptionStatus, subId, type);

    if (!sub) {
        return null;
    }

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
