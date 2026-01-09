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
import { moderationSchema } from './ModerationConfiguration';
import { notificationsSchema } from './SystemNotificationMessenger';
import { privoSchema } from './PrivoConfiguration';
import { getSubscriptionConfigSchema } from './SubscriptionConfiguration';
import { z } from 'zod';
import { WEB_CONFIG_SCHEMA } from '@casual-simulation/aux-common';
import { WEB_MANIFEST_SCHEMA } from '@casual-simulation/aux-common/common/WebManifest';

let serverConfigSchema: ServerConfigSchema;

function constructServerConfigSchema() {
    /**
     * The schema for the S3 configuration.
     */
    const s3Schema = z.object({
        region: z
            .string()
            .nonempty()
            .describe(
                'The region of the file records and websocket message buckets.'
            ),
        filesBucket: z
            .string()
            .nonempty()
            .describe(
                'The name of the bucket that file records should be placed in.'
            ),
        defaultFilesBucket: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The name of the bucket that file records were originally placed in. This is used for backwards compatibility for file records that were uploaded before changing the filesBucket was supported. If not specified, then filesBucket is used.'
            ),
        filesStorageClass: z
            .string()
            .nonempty()
            .describe(
                'The S3 File Storage Class that should be used for file records.'
            ),

        publicFilesUrl: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The URL that public files should be accessed at. If specified, then public file records will point to this URL instead of the default S3 URL. If not specified, then the default S3 URL will be used. ' +
                    'Useful for adding CDN support for public files. Private file records are unaffected by this setting. ' +
                    'File Record URLs will be formatted as: "{publicFilesUrl}/{recordName}/{filename}".'
            ),

        messagesBucket: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The name of the bucket that large websocket messages should be placed in.'
            ),

        options: z
            .object({
                endpoint: z
                    .string()
                    .nonempty()
                    .optional()
                    .describe('The endpoint of the S3 API.'),
                s3ForcePathStyle: z
                    .boolean()
                    .optional()
                    .describe(
                        'Wether to force the S3 client to use the path style API. Defaults to false.'
                    ),
            })
            .describe('Options for the S3 client.'),

        host: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The S3 host that should be used for file record storage. If omitted, then the default S3 host will be used.'
            ),
    });

    const minioSchema = z.object({
        endpoint: z
            .string()
            .min(1)
            .describe('The hostname or IP Address of the Minio server.'),

        port: z
            .int()
            .positive()
            .optional()
            .describe(
                'The port that the Minio server is running on. Defaults to 80 for non-SSL, and 443 for SSL.'
            ),

        useSSL: z
            .boolean()
            .optional()
            .prefault(true)
            .describe(
                'Whether to use SSL when connecting to the Minio server. Defaults to true.'
            ),

        accessKey: z
            .string()
            .min(1)
            .describe(
                'The access key that should be used to connect to the Minio server.'
            ),

        secretKey: z
            .string()
            .min(1)
            .describe(
                'The secret key that should be used to connect to the Minio server.'
            ),

        region: z
            .string()
            .min(1)
            .optional()
            .prefault('us-east-1')
            .describe(
                'The region of the file records and websocket message buckets.'
            ),

        filesBucket: z
            .string()
            .min(1)
            .describe(
                'The name of the bucket that file records should be placed in.'
            ),

        defaultFilesBucket: z
            .string()
            .min(1)
            .optional()
            .describe(
                'The name of the bucket that file records were originally placed in. This is used for backwards compatibility for file records that were uploaded before changing the filesBucket was supported. If not specified, then filesBucket is used.'
            ),

        publicFilesUrl: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The URL that public files should be accessed at. If specified, then public file records will point to this URL instead of the default S3 URL. If not specified, then the default URL will be used. ' +
                    'Useful for adding CDN support for public files. Private file records are unaffected by this setting. ' +
                    'File Record URLs will be formatted as: "{publicFilesUrl}/{recordName}/{filename}".'
            ),

        messagesBucket: z
            .string()
            .min(1)
            .optional()
            .describe(
                'The name of the bucket that large websocket messages should be placed in.'
            ),
    });

    const typesenseSchema = z.object({
        nodes: z
            .array(
                z.object({
                    host: z
                        .string()
                        .min(1)
                        .describe('The host of the Typesense node.'),
                    port: z.int().min(1).optional(),
                    protocol: z.enum(['http', 'https']).optional(),
                })
            )
            .min(1),
        apiKey: z.string().min(1).describe('The API Key for Typesense.'),
        connectionTimeoutSeconds: z.number(),
    });

    const livekitSchema = z.object({
        apiKey: z
            .string()
            .nonempty()
            .nullable()
            .describe('The API Key for Livekit.'),
        secretKey: z
            .string()
            .nonempty()
            .nullable()
            .describe('The secret key for Livekit.'),
        endpoint: z
            .string()
            .nonempty()
            .nullable()
            .describe(
                'The URL that the Livekit server is publicly available at.'
            ),
    });

    const textItSchema = z.object({
        apiKey: z
            .string()
            .nonempty()
            .nullable()
            .describe('The API Key for TextIt.'),
        flowId: z
            .string()
            .nonempty()
            .nullable()
            .describe(
                'The ID of the flow that should be triggered for sending login codes.'
            ),
    });

    const sesContentSchema = z.discriminatedUnion('type', [
        z.object({
            type: z.literal('template'),
            templateArn: z
                .string()
                .nonempty()
                .describe(
                    'The ARN of the SES email template that should be used.'
                ),
        }),
        z.object({
            type: z.literal('plain'),
            subject: z
                .string()
                .nonempty()
                .describe('The subject of the email.'),
            body: z
                .string()
                .nonempty()
                .describe(
                    'The body of the email. Use double curly-braces {{variable}} to insert variables.'
                ),
        }),
    ]);

    const sesSchema = z.object({
        fromAddress: z
            .string()
            .nonempty()
            .describe(
                'The email address that SES messages should be sent from.'
            ),
        content: sesContentSchema.describe(
            'The content that should be sent in login codes in emails.'
        ),
    });

    const expireModeSchema = z.union([
        z.literal('NX').describe('The Redis NX expire mode.'),
        z.literal('XX').describe('The Redis XX expire mode.'),
        z.literal('GT').describe('The Redis GT expire mode.'),
        z.literal('LT').describe('The Redis LT expire mode.'),
        z.null().describe('The expiration will be updated every time.'),
    ]);

    const redisServerSchema = z.object({
        url: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The Redis connection URL that should be used. If omitted, then host, port, and password must be provided.'
            ),
        host: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The host that the redis client should connect to. Ignored if url is provided.'
            ),
        port: z
            .number()
            .optional()
            .describe(
                'The port that the redis client should connect to. Ignored if url is provided.'
            ),
        password: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The password that the redis client should use. Ignored if url is provided.'
            ),
        tls: z
            .boolean()
            .optional()
            .describe(
                'Whether to use TLS for connecting to the Redis server. Ignored if url is provided.'
            ),
    });

    const redisSchema = z.object({
        url: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The Redis connection URL that should be used. If omitted, then host, port, and password must be provided.'
            ),
        host: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The host that the redis client should connect to. Ignored if url is provided.'
            ),
        port: z
            .number()
            .optional()
            .describe(
                'The port that the redis client should connect to. Ignored if url is provided.'
            ),
        password: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The password that the redis client should use. Ignored if url is provided.'
            ),
        tls: z
            .boolean()
            .optional()
            .describe(
                'Whether to use TLS for connecting to the Redis server. Ignored if url is provided.'
            ),

        servers: z
            .object({
                instData: redisServerSchema
                    .optional()
                    .describe(
                        'The Redis server that should be used for storage of temporary inst data. If omitted, then the default server will be used.'
                    ),
                websocketConnections: redisServerSchema
                    .optional()
                    .describe(
                        'The Redis server that should be used for storage of websocket connections. If omitted, then the default server will be used.'
                    ),
                caches: redisServerSchema
                    .optional()
                    .describe(
                        'The Redis server that should be used for the caches. If omitted, then the default server will be used.'
                    ),
                rateLimit: redisServerSchema
                    .optional()
                    .describe(
                        'The Redis server that should be used for rate limits. If omitted, then the default server will be used.'
                    ),
                pubSub: redisServerSchema
                    .optional()
                    .describe(
                        'The Redis server that should be used for pubsub. If omitted, then the default server will be used.'
                    ),
                bullmq: redisServerSchema
                    .optional()
                    .describe(
                        'The Redis server that should be used for BullMQ. If omitted, then the default server will be used.'
                    ),
            })
            .prefault({})
            .describe(
                'The Redis servers that should be used for specific categories of data. If omitted, then the default server will be used.'
            ),

        rateLimitPrefix: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The namespace that rate limit counters are stored under. If omitted, then redis rate limiting is not possible.'
            ),

        websocketRateLimitPrefix: z
            .string()
            .nonempty()
            .optional()
            .describe(
                'The namespace that websocket rate limit counters are stored under. If omitted, then the rateLimitPrefix is used.'
            ),

        websocketConnectionNamespace: z
            .string()
            .optional()
            .describe(
                'The namespace that websocket connections are stored under. If omitted, then redis inst records are not possible.'
            ),
        instRecordsStoreNamespace: z
            .string()
            .optional()
            .describe(
                'The namespace that inst records are stored under. If omitted, then redis inst records are not possible.'
            ),
        publicInstRecordsLifetimeSeconds: z
            .number()
            .positive()
            .nullable()
            .optional()
            .prefault(60 * 60 * 24)
            .describe(
                'The lifetime of public inst records in seconds. If null, then public inst records never expire. Defaults to 1 day in seconds (86,400)'
            ),
        publicInstRecordsLifetimeExpireMode: expireModeSchema
            .optional()
            .prefault('NX')
            .describe(
                'The Redis expire mode that should be used for public inst records. Defaults to NX. If null, then the expiration will update every time the inst data is updated. Only supported on Redis 7+. If set to something not null on Redis 6, then errors will occur.'
            ),

        tempInstRecordsStoreNamespace: z
            .string()
            .optional()
            .describe(
                'The namespace that temporary inst records are stored under (e.g. tempShared space). If omitted, then redis inst records are not possible.'
            ),
        tempInstRecordsLifetimeSeconds: z
            .number()
            .positive()
            .nullable()
            .optional()
            .prefault(60 * 60 * 24)
            .describe(
                'The lifetime of temporary inst records data in seconds (e.g. tempShared space). Intended to clean up temporary branches that have not been changed for some amount of time. If null, then temporary inst branches never expire. Defaults to 24 hours.'
            ),
        tempInstRecordsLifetimeExpireMode: expireModeSchema
            .optional()
            .prefault(null)
            .describe(
                'The Redis expire mode that should be used for temporary inst branches (e.g. tempShared space). Defaults to null. If null, then the expiration will not have a mode. Only supported on Redis 7+. If set to something not null on Redis 6, then errors will occur.'
            ),

        // The number of seconds that authorizations for repo/add_updates permissions (inst.read and inst.updateData) are cached for.
        // Because repo/add_updates is a very common permission, we periodically cache permissions to avoid hitting the database too often.
        // 5 minutes by default
        connectionAuthorizationCacheSeconds: z
            .number()
            .positive()
            .prefault(300)
            .describe(
                `The number of seconds that authorizations for repo/add_updates permissions (inst.read and inst.updateData) are cached for.
Because repo/add_updates is a very common permission, we periodically cache permissions to avoid hitting the database too often. Defaults to 5 minutes.`
            ),

        cacheNamespace: z
            .string()
            .nonempty()
            .nullable()
            .optional()
            .prefault('/cache')
            .describe(
                'The namespace for cached items. (policies & configuration) Defaults to "/cache". Set to null to disable caching of policies and configuration.'
            ),

        connectionExpireSeconds: z
            .number()
            .positive()
            .optional()
            .nullable()
            .prefault(60 * 60 * 3)
            .describe(
                'The maximum lifetime of websocket connections in seconds. Intended to clean up any keys under websocketConnectionNamespace that have not been changed after an amount of time. It is recomended to set this longer than the maximum websocket connection length. Defaults to 3 hours. Set to null to disable.'
            ),

        connectionExpireMode: expireModeSchema
            .optional()
            .prefault(null)
            .describe(
                'The Redis expire mode that should be used for connections. Defaults to null. If null, then the expiration will not have a mode. Only supported on Redis 7+. If set to something not null on Redis 6, then errors will occur.'
            ),

        pubSubNamespace: z
            .string()
            .nullable()
            .optional()
            .prefault('pubsub')
            .describe(
                'The namespace that should be used for pubsub subscriptions. Defaults to "pubsub". If set to null, then pubsub is disabled.'
            ),
    });

    const rateLimitSchema = z.object({
        maxHits: z
            .number()
            .positive()
            .describe(
                'The maximum number of hits allowed from a single IP Address within the window.'
            ),
        windowMs: z
            .number()
            .positive()
            .describe('The size of the window in miliseconds.'),
    });

    const stripeSchema = z.object({
        secretKey: z
            .string()
            .nonempty()
            .describe('The Stripe secret key that should be used.'),
        publishableKey: z
            .string()
            .nonempty()
            .describe('The Stripe publishable key that should be used.'),
        testClock: z
            .string()
            .nonempty()
            .optional()
            .describe('The stripe test clock that should be used.'),
    });

    const mongodbSchema = z.object({
        url: z
            .string()
            .nonempty()
            .describe(
                'The MongoDB URL that should be used to connect to MongoDB.'
            ),
        useNewUrlParser: z
            .boolean()
            .optional()
            .prefault(false)
            .describe('Whether to use the new URL parser. Defaults to false.'),
        database: z
            .string()
            .nonempty()
            .describe('The database that should be used.'),
        fileUploadUrl: z
            .string()
            .nonempty()
            .optional()
            .describe('The URL that files records need to be uploaded to.'),
    });

    const prismaSchema = z.object({
        options: z
            .looseObject({})
            .optional()
            .describe(
                'Generic options that should be passed to the Prisma client constructor.'
            ),

        db: z
            .enum(['cockroachdb', 'sqlite'])
            .prefault('cockroachdb')
            .describe(
                'The database type to use with Prisma. Defaults to "cockroachdb".'
            ),

        policiesCacheSeconds: z
            .number()
            .positive()
            .nullable()
            .optional()
            .prefault(60)
            .describe(
                'The number of seconds that policies are cached for. Defaults to 60 seconds. Set to null to disable caching of policies.'
            ),
        configurationCacheSeconds: z
            .number()
            .positive()
            .nullable()
            .optional()
            .prefault(60 * 60 * 24) // 24 hours in seconds,
            .describe(
                'The number of seconds that configuration items are cached for. Defaults to 60 seconds. Set to null to disable caching of configuration items.'
            ),
    });

    const openAiSchema = z.object({
        apiKey: z
            .string()
            .nonempty()
            .describe('The OpenAI API Key that should be used.'),
    });

    const googleAiSchema = z.object({
        apiKey: z
            .string()
            .nonempty()
            .describe('The Google AI API Key that should be used.'),
    });

    const anthropicAiSchema = z.object({
        apiKey: z
            .string()
            .min(1)
            .describe('The Anthropic AI API Key that should be used.'),
    });

    const blockadeLabsSchema = z.object({
        apiKey: z
            .string()
            .nonempty()
            .describe('The Blockade Labs API Key that should be used.'),
    });

    const stabilityAiSchema = z.object({
        apiKey: z
            .string()
            .nonempty()
            .describe('The StabilityAI API Key that should be used.'),
    });

    const humeAiSchema = z.object({
        apiKey: z
            .string()
            .min(1)
            .describe('The Hume AI API Key that should be used.'),
        secretKey: z
            .string()
            .min(1)
            .describe('The Hume AI Secret Key that should be used.'),
    });

    const sloydAiSchema = z.object({
        clientId: z
            .string()
            .min(1)
            .describe('The client ID for the Sloyd AI API.'),

        clientSecret: z
            .string()
            .min(1)
            .describe('The client secret for the Sloyd AI API.'),
    });

    const aiSchema = z.object({
        chat: z
            .object({
                provider: z
                    .string()
                    .describe(
                        'The provider that should be used by default for Chat AI request models that dont have an associated provider. If you want to point to a custom provider, then use the name for the provider.'
                    ),
                defaultModel: z
                    .string()
                    .nonempty()
                    .describe(
                        'The model that should be used for Chat AI requests when one is not specified.'
                    ),
                allowedModels: z
                    .array(
                        z.union([
                            z.string(),
                            z.object({
                                provider: z
                                    .enum(['openai', 'google', 'anthropic'])
                                    .optional(),
                                model: z.string(),
                            }),
                            z.object({
                                provider: z
                                    .literal('custom-openai-completions')
                                    .describe(
                                        'Defines that the provider points to a custom implementation of the OpenAI Completions API'
                                    ),
                                name: z
                                    .string()
                                    .prefault('custom-openai-completions')
                                    .describe(
                                        'The name that should be used for this provider'
                                    ),
                                apiKey: z
                                    .string()
                                    .describe(
                                        'The API key that should be used to communicate with the custom API.'
                                    ),
                                baseUrl: z
                                    .string()
                                    .describe(
                                        'The endpoint that should be used to communicate with the custom API. (e.g. "https://api.openai.com/v1/" for OpenAIs API)'
                                    ),
                                models: z
                                    .array(z.string())
                                    .describe(
                                        'The list of models that should be mapped to this provider'
                                    ),
                                additionalProperties: z
                                    .looseObject({})
                                    .optional()
                                    .describe(
                                        'The additional properties that should be included in requests.'
                                    ),
                            }),
                        ])
                    )
                    .min(1)
                    .describe(
                        'The list of models that are allowed to be used for Chat AI requets.'
                    ),
                allowedSubscriptionTiers: z
                    .union([z.literal(true), z.array(z.string())])
                    .describe(
                        'The subscription tiers that are allowed to use Chat AI. If true, then all tiers are allowed.'
                    ),
                tokenModifierRatio: z
                    .record(z.string(), z.number().positive())
                    .optional()
                    .prefault({})
                    .describe(
                        'Custom token modifier ratio per model. The key is the model name and the value is the cost multiplier.'
                    ),
            })
            .optional()
            .describe(
                'Options for Chat AI. If omitted, then chat AI is disabled.'
            ),
        generateSkybox: z
            .object({
                provider: z
                    .literal('blockadeLabs')
                    .describe(
                        'The provider that should be used for Skybox Generation AI requests.'
                    ),
                allowedSubscriptionTiers: z
                    .union([z.literal(true), z.array(z.string())])
                    .describe(
                        'The subscription tiers that are allowed to use Skybox AI. If true, then all tiers are allowed.'
                    ),
            })
            .optional()
            .describe(
                'Options for Skybox Generation AI. If omitted, then Skybox AI is disabled.'
            ),
        images: z
            .object({
                defaultModel: z
                    .string()
                    .nonempty()
                    .describe(
                        'The model that should be used for Image AI requests when one is not specified.'
                    ),
                defaultWidth: z
                    .int()
                    .positive()
                    .describe('The default width of generated images.'),
                defaultHeight: z
                    .int()
                    .positive()
                    .describe('The default height of generated images.'),
                maxWidth: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum width of generated images. If omitted, then the max width is controlled by the model.'
                    ),
                maxHeight: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum height of generated images. If omitted, then the max height is controlled by the model.'
                    ),
                maxSteps: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of steps that can be used to generate an image. If omitted, then the max steps is controlled by the model.'
                    ),
                maxImages: z
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'The maximum number of images that can be generated in a single request. If omitted, then the max images is controlled by the model.'
                    ),
                allowedModels: z
                    .object({
                        openai: z
                            .array(z.string())
                            .optional()
                            .describe(
                                'The list of OpenAI DALL-E models that are allowed to be used. If omitted, then no OpenAI models are allowed.'
                            ),
                        stabilityai: z
                            .array(z.string())
                            .optional()
                            .describe(
                                'The list of StabilityAI models that are allowed to be used. If omitted, then no StabilityAI models are allowed.'
                            ),
                    })
                    .describe(
                        'The models that are allowed to be used from each provider.'
                    ),
                allowedSubscriptionTiers: z
                    .union([z.literal(true), z.array(z.string())])
                    .describe(
                        'The subscription tiers that are allowed to use Image AI. If true, then all tiers are allowed.'
                    ),
                tokenModifierRatio: z
                    .record(z.string(), z.number().positive())
                    .optional()
                    .describe(
                        'Custom token modifier ratio per model. The key is the model name and the value is the cost multiplier.'
                    ),
            })
            .optional()
            .describe(
                'Options for Image AI. If omitted, then Image AI is disabled.'
            ),
    });

    const apiGatewaySchema = z.object({
        endpoint: z
            .string()
            .describe(
                'The API Gateway endpoint that should be used for sending messages to connected clients.'
            ),
    });

    const wsSchema = z.object({});

    const webauthnSchema = z.object({
        relyingParties: z
            .array(
                z.object({
                    name: z
                        .string()
                        .describe(
                            'The human-readable name of the relying party.'
                        ),
                    id: z
                        .string()
                        .describe(
                            'The ID of the relying party. Should be the domain of the relying party. Note that this does not mean that it has to be unique. Instead, it just needs to match the domain that the passkeys can be used on.'
                        ),
                    origin: z
                        .string()
                        .describe('The HTTP origin of the relying party.'),
                })
            )
            .min(1)
            .describe('The relying parties that should be supported.'),
    });

    const telemetrySchema = z.object({
        tracing: z
            .object({
                exporter: z
                    .enum(['none', 'console', 'otlp'])
                    .describe(
                        'The type of exporter that should be used for traces.'
                    ),
                url: z
                    .string()
                    .optional()
                    .describe(
                        'The URL that traces should be sent to. Only required for otlp exporters.'
                    ),
                headers: z
                    .record(z.string(), z.string())
                    .optional()
                    .describe(
                        'The headers that should be sent with the traces. Only required for otlp exporters.'
                    ),
            })
            .describe('Options for configuring tracing.'),

        metrics: z
            .object({
                exporter: z
                    .enum(['none', 'console', 'otlp'])
                    .describe(
                        'The type of exporter that should be used for metrics.'
                    ),
                url: z
                    .string()
                    .optional()
                    .describe(
                        'The URL that metrics should be sent to. Only required for otlp exporters.'
                    ),
                headers: z
                    .record(z.string(), z.string())
                    .optional()
                    .describe(
                        'The headers that should be sent with the metrics. Only required for otlp exporters.'
                    ),
            })
            .describe('Options for configuring metrics.'),

        instrumentation: z
            .object({
                auto: z
                    .record(z.string(), z.looseObject({}))
                    .optional()
                    .nullable()
                    .describe(
                        'Options for auto-instrumentation. If omitted, then auto-instrumentation will be enabled with default settings. If set to null, then auto-instrumentation will be disabled.'
                    ),

                prisma: z
                    .looseObject({})
                    .optional()
                    .nullable()
                    .describe(
                        'Options for Prisma instrumentation. If omitted, then Prisma instrumentation will be enabled with default settings. If set to null, then prisma instrumentation will be disabled.'
                    ),

                redis: z
                    .looseObject({})
                    .optional()
                    .nullable()
                    .describe(
                        'Options for Redis instrumentation. If omitted, then Redis instrumentation will be enabled with default settings. If set to null, then redis instrumentation will be disabled.'
                    ),
            })
            .optional()
            .prefault({})
            .describe('Options for instrumentation'),

        resource: z
            .record(z.string(), z.string())
            .optional()
            .prefault({})
            .describe(
                'The resource that should be used. See https://opentelemetry.io/docs/specs/semconv/resource/ for more information.'
            ),
    });

    const tigerBeetleSchema = z
        .object({
            clusterId: z.coerce
                .bigint()
                .min(0n, 'The cluster ID must be a non-negative integer.')
                .describe('The cluster ID.'),
            replicaAddresses: z
                .array(
                    z
                        .string()
                        .min(1)
                        .describe(
                            'An address (or port if local) to a replica of a cluster.'
                        )
                )
                .min(1, 'At least one replica address is required.')
                .describe("The addresses of the provided cluster's replicas."),
        })
        .describe(
            'The financial interface that should be used. If omitted, then financial features provided by said interface will be disabled.'
        );

    const rekognitionSchema = z.object({
        moderation: z.object({
            files: z.object({
                job: z
                    .object({
                        accountId: z
                            .string()
                            .min(1)
                            .describe(
                                'The AWS Account ID that should be used to run the job.'
                            ),

                        sourceBucket: z
                            .string()
                            .min(1)
                            .describe(
                                'The bucket that should be scanned when a job is started.'
                            ),

                        reportBucket: z
                            .string()
                            .min(1)
                            .describe(
                                'The bucket that job reports should be placed in.'
                            ),

                        priority: z
                            .int()
                            .optional()
                            .prefault(10)
                            .describe(
                                'The priority of jobs that are created. Higher numbers are higher priority. Defaults to 10.'
                            ),

                        roleArn: z
                            .string()
                            .min(1)
                            .describe(
                                'The ARN of the role that should be used to run the job.'
                            ),

                        lambdaFunctionArn: z
                            .string()
                            .min(1)
                            .describe(
                                'The ARN of the lambda function that should be invoked to process the files.'
                            ),

                        tags: z
                            .array(
                                z.object({
                                    key: z.string().min(1),
                                    value: z.string().min(1),
                                })
                            )
                            .optional()
                            .describe(
                                'The tags that should be placed on the job.'
                            ),
                    })
                    .optional()
                    .describe('The options specific to starting batch jobs.'),

                scan: z
                    .object({
                        projectVersionArn: z
                            .string()
                            .min(1)
                            .optional()
                            .describe(
                                'The ARN of the custom moderation model that should be used. If omitted, then the default model is used.'
                            ),
                    })
                    .optional()
                    .describe('The options specific to scanning files.'),
            }),
        }),
    });

    const webhooksSchema = z.object({
        environment: z.discriminatedUnion('type', [
            z.object({
                type: z.literal('deno'),
                scriptPath: z
                    .string()
                    .min(1)
                    .describe(
                        'The path to the Deno script that should be run.'
                    ),
                denoPath: z
                    .string()
                    .min(1)
                    .optional()
                    .nullable()
                    .describe(
                        'The path to the Deno executable that should be used.'
                    ),
                debugLogs: z
                    .boolean()
                    .prefault(false)
                    .describe(
                        'Whether to enable debug logs for the Deno environment. This will log all Deno output to the console.'
                    ),
            }),
            z.object({
                type: z.literal('node'),
            }),
            z.object({
                type: z.literal('lambda'),
                functionName: z
                    .string()
                    .min(1)
                    .optional()
                    .nullable()
                    .describe(
                        'The name or ARN of the lambda function that should be called to process a webhook. If omitted, then the lambda function name will be taken from the WEBHOOK_LAMBDA_FUNCTION_NAME envrionment variable.'
                    ),
            }),
        ]),
    });

    const snsSchema = z.object({
        type: z.literal('sns'),
        topicArn: z
            .string()
            .min(1)
            .describe('The ARN of the SNS topic that should be used.'),
    });

    const bullmqSchema = z.object({
        type: z.literal('bullmq'),

        process: z
            .boolean()
            .prefault(true)
            .describe(
                'Whether to process jobs from BullMQ on this node. Defaults to true.'
            ),

        queue: z
            .boolean()
            .prefault(true)
            .describe(
                'Whether to allow this node to enqueue jobs in BullMQ. Defaults to true.'
            ),

        queueName: z
            .string()
            .min(1)
            .describe('The name of the BullMQ queue that should be used.'),
    });

    const backgroundJobSchema = z.discriminatedUnion('type', [
        snsSchema,
        bullmqSchema,
    ]);

    const tursoDatabaseProviderSchema = z.object({
        type: z.literal('turso'),
        organization: z.string().describe('The Turso organization name.'),
        token: z
            .string()
            .describe(
                'The API Token that should be used to access the Turso Platform API.'
            ),
        group: z
            .string()
            .describe(
                'The Turso group name that databases should be placed in.'
            ),
    });

    const sqliteDatabaseProviderSchema = z.object({
        type: z.literal('sqlite'),

        folderPath: z
            .string()
            .min(1)
            .describe('The folder where the SQLite database files are stored.'),

        encryptionKey: z
            .string()
            .min(10)
            .optional()
            .describe(
                'The encryption key that should be used for the SQLite databases. If omitted, then the databases will not be encrypted.'
            ),
    });

    const databasesProviderSchema = z.discriminatedUnion('type', [
        tursoDatabaseProviderSchema,
        sqliteDatabaseProviderSchema,
    ]);

    const serverConfigSchema = z.object({
        s3: s3Schema
            .optional()
            .describe(
                'S3 Configuration Options. If omitted, then S3 cannot be used for file storage.'
            ),

        rekognition: rekognitionSchema
            .optional()
            .describe(
                'AWS Rekognition configuration options. If omitted, then AWS Rekognition cannot be used for moderation/classification.'
            ),

        minio: minioSchema
            .optional()
            .describe(
                'Minio Configuration Options. If omitted, then Minio cannot be used for file storage.'
            ),

        typesense: typesenseSchema
            .optional()
            .describe(
                'Typesense configuration options. If omitted, then Typesense cannot be used for search.'
            ),

        apiGateway: apiGatewaySchema
            .optional()
            .describe(
                'AWS API Gateway configuration options. If omitted, then inst records cannot be used on AWS Lambda.'
            ),
        mongodb: mongodbSchema
            .optional()
            .describe(
                'MongoDB configuration options. If omitted, then MongoDB cannot be used.'
            ),
        prisma: prismaSchema
            .optional()
            .describe(
                'Prisma configuration options. If omitted, then Prisma (CockroachDB) cannot be used.'
            ),
        livekit: livekitSchema
            .optional()
            .describe(
                'Livekit configuration options. If omitted, then Livekit features will be disabled.'
            ),
        textIt: textItSchema
            .optional()
            .describe(
                'TextIt configuration options. If omitted, then SMS login will be disabled.'
            ),
        ses: sesSchema
            .optional()
            .describe(
                'AWS SES configuration options. If omitted, then sending login codes via SES is not possible.'
            ),
        redis: redisSchema
            .optional()
            .describe(
                'Redis configuration options. If omitted, then using Redis is not possible.'
            ),
        rateLimit: rateLimitSchema
            .optional()
            .describe(
                'Rate limit options. If omitted, then rate limiting will be disabled.'
            ),
        websocketRateLimit: rateLimitSchema
            .optional()
            .describe(
                'Rate limit options for websockets. If omitted, then the rateLimit options will be used for websockets.'
            ),
        openai: openAiSchema
            .optional()
            .describe(
                'OpenAI options. If omitted, then it will not be possible to use GPT or DALL-E.'
            ),
        blockadeLabs: blockadeLabsSchema
            .optional()
            .describe(
                'Blockade Labs options. If omitted, then it will not be possible to generate skyboxes.'
            ),
        stabilityai: stabilityAiSchema
            .optional()
            .describe(
                'Stability AI options. If omitted, then it will not be possible to use Stable Diffusion.'
            ),
        googleai: googleAiSchema
            .optional()
            .describe(
                'Google AI options. If omitted, then it will not be possible to use Google AI (i.e. Gemini)'
            ),
        anthropicai: anthropicAiSchema
            .optional()
            .describe(
                'Anthropic AI options. If omitted, then it will not be possible to use Anthropic AI (i.e. Claude).'
            ),
        humeai: humeAiSchema
            .optional()
            .describe(
                'Hume AI options. If omitted, then it will not be possible to use Hume AI.'
            ),

        sloydai: sloydAiSchema
            .optional()
            .describe(
                'Sloyd AI options. If omitted, then it will not be possible to use Sloyd AI.'
            ),

        ai: aiSchema
            .optional()
            .describe(
                'AI configuration options. If omitted, then all AI features will be disabled.'
            ),
        ws: wsSchema
            .optional()
            .describe(
                'WebSocket Server configuration options. If omitted, then inst records cannot be used in standalone deployments.'
            ),

        privo: privoSchema
            .optional()
            .describe(
                'Privo configuration options. If omitted, then Privo features will be disabled.'
            ),

        webauthn: webauthnSchema
            .optional()
            .describe(
                'WebAuthn configuration options. If omitted, then WebAuthn features will be disabled.'
            ),

        telemetry: telemetrySchema
            .optional()
            .describe(
                'Options for configuring telemetry. If omitted, then telemetry will not be enabled.'
            ),

        tigerBeetle: tigerBeetleSchema
            .optional()
            .describe(
                'Financial Interface configuration options for tigerbeetle. If omitted, then tigerbeetle will be disabled.'
            ),

        subscriptions: getSubscriptionConfigSchema()
            .optional()
            .describe(
                'The default subscription configuration. If omitted, then subscription features will be disabled.'
            ),
        stripe: stripeSchema
            .optional()
            .describe(
                'Stripe options. If omitted, then Stripe features will be disabled.'
            ),
        notifications: notificationsSchema
            .optional()
            .describe(
                'System notification configuration options. Used to send messages for various events like user inst reports and com ID requests. If omitted, then server notifications will be disabled.'
            ),
        moderation: moderationSchema
            .optional()
            .describe(
                'Moderation configuration options. If omitted, then moderation features will be disabled unless overridden in the database.'
            ),

        webhooks: webhooksSchema
            .optional()
            .describe(
                'Webhook configuration options. If omitted, then webhook features will be disabled.'
            ),

        webPush: z
            .object({
                vapidSubject: z
                    .string()
                    .min(1)
                    .describe(
                        'The subject that should be used for sending web push notifications. You can generate VAPID keys using https://www.npmjs.com/package/web-push'
                    ),
                vapidPublicKey: z
                    .string()
                    .min(1)
                    .describe(
                        'The public key that should be used for sending web push notifications. You can generate VAPID keys using https://www.npmjs.com/package/web-push'
                    ),
                vapidPrivateKey: z
                    .string()
                    .min(1)
                    .describe(
                        'The private key that should be used for sending web push notifications. You can generate VAPID keys using https://www.npmjs.com/package/web-push'
                    ),
            })
            .optional()
            .describe(
                'Web Push configuration options. If omitted, then web push notifications will be disabled.'
            ),

        meta: z
            .object({
                apiOrigin: z
                    .string()
                    .describe('The HTTP origin that the API is available at.'),
                websocketOrigin: z
                    .string()
                    .optional()
                    .nullable()
                    .describe(
                        'The HTTP origin that the Websocket API is available at.'
                    ),
                websocketProtocol: z
                    .enum(['websocket', 'apiary-aws'])
                    .optional()
                    .nullable()
                    .describe(
                        'The protocol that should be used to connect to the websocket origin.'
                    ),
            })
            .optional()
            .describe(
                'The metadata about the server deployment. If omitted, then the server will not be able to provide information about itself. This would result in records features not being supported in webhook handlers.'
            ),

        jobs: z
            .object({
                search: backgroundJobSchema
                    .optional()
                    .describe(
                        'Configuration options for search background jobs. If omitted, then search background jobs will not be supported.'
                    ),
            })
            .optional()
            .describe(
                'Configuration options for background jobs. If omitted, then background jobs will not be supported.'
            ),

        databases: z
            .object({
                provider: databasesProviderSchema.describe(
                    'The options for the database provider that should be used.'
                ),
            })
            .optional()
            .describe(
                'Configuration options for database records. If omitted, then database records will be disabled.'
            ),

        server: z
            .object({
                enabled: z
                    .boolean()
                    .prefault(true)
                    .describe('Whether serving CasualOS should be enabled.'),

                tls: z
                    .object({
                        key: z
                            .string()
                            .describe('The TLS private key(s) in PEM format.'),
                        cert: z
                            .string()
                            .describe(
                                'The TLS certificate chains in PEM format.'
                            ),
                    })
                    .optional()
                    .describe(
                        'The TLS configuration for the CasualOS app. If not provided, then TLS will not be used.'
                    ),

                proxy: z
                    .object({
                        trust: z
                            .string()
                            .optional()
                            .describe(
                                'The IP Address range of proxies that should be trusted.'
                            ),
                    })
                    .optional()
                    .describe('The proxy configuration for the CasualOS app.'),

                debug: z
                    .boolean()
                    .prefault(false)
                    .describe(
                        'Whether to enable debug logging for the CasualOS app.'
                    ),

                frontendPort: z
                    .number()
                    .prefault(3000)
                    .describe(
                        'The port that the CasualOS app frontend should listen on.'
                    ),

                backendPort: z
                    .number()
                    .prefault(3002)
                    .describe(
                        'The port that the CasualOS app backend API should listen on.'
                    ),

                webConfig: WEB_CONFIG_SCHEMA.prefault({
                    causalRepoConnectionProtocol: 'websocket',
                    collaborativeRepoLocalPersistence: true,
                    staticRepoLocalPersistence: true,
                    sharedPartitionsVersion: 'v2',
                    vmOrigin: null,
                    authOrigin: null,
                    recordsOrigin: null,
                    disableCollaboration: null,
                    ab1BootstrapURL: null,
                    arcGisApiKey: null,
                    jitsiAppName:
                        'vpaas-magic-cookie-332b53bd630448a18fcb3be9740f2caf',
                    what3WordsApiKey: null,
                    playerMode: 'player',
                    requirePrivoLogin: false,
                    allowedBiosOptions: null,
                    defaultBiosOption: null,
                    automaticBiosOption: null,
                }).describe('The web configuration for the CasualOS frontend.'),

                playerWebManifest: WEB_MANIFEST_SCHEMA.optional()
                    .nullable()
                    .describe(
                        'The PWA web manifest that should be served by CasualOS. If omitted or null, then none will be used.'
                    ),

                drives: z
                    .object({
                        dirs: z
                            .array(z.string())
                            .describe(
                                'The list of extra directories that should be served by the CasualOS app on the /drives path.'
                            ),

                        path: z
                            .string()
                            .prefault('/drives')
                            .describe(
                                'The base path that drives should be served from.'
                            ),
                    })
                    .optional(),
            })
            .prefault({
                enabled: false,
            })
            .describe(
                'The configuration for the CasualOS server. Defaults to disabled.'
            ),
    });

    return serverConfigSchema;
}

/**
 * Gets the server config schema.
 */
export function getServerConfigSchema() {
    serverConfigSchema ??= constructServerConfigSchema();
    return serverConfigSchema;
}

export type ServerConfigSchema = ReturnType<typeof constructServerConfigSchema>;
export type ServerConfig = z.infer<
    ReturnType<typeof constructServerConfigSchema>
>;
export type RedisServerOptions = ServerConfig['redis']['servers']['instData'];
export type S3Config = ServerConfig['s3'];
