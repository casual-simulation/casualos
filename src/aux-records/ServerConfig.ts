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
import { subscriptionConfigSchema } from './SubscriptionConfiguration';
import { z } from 'zod';

/**
 * The schema for the S3 configuration.
 */
const s3Schema = z.object({
    region: z
        .string()
        .describe(
            'The region of the file records and websocket message buckets.'
        )
        .nonempty(),
    filesBucket: z
        .string()
        .describe(
            'The name of the bucket that file records should be placed in.'
        )
        .nonempty(),
    defaultFilesBucket: z
        .string()
        .describe(
            'The name of the bucket that file records were originally placed in. This is used for backwards compatibility for file records that were uploaded before changing the filesBucket was supported. If not specified, then filesBucket is used.'
        )
        .nonempty()
        .optional(),
    filesStorageClass: z
        .string()
        .describe(
            'The S3 File Storage Class that should be used for file records.'
        )
        .nonempty(),

    publicFilesUrl: z
        .string()
        .describe(
            'The URL that public files should be accessed at. If specified, then public file records will point to this URL instead of the default S3 URL. If not specified, then the default S3 URL will be used. ' +
                'Useful for adding CDN support for public files. Private file records are unaffected by this setting. ' +
                'File Record URLs will be formatted as: "{publicFilesUrl}/{recordName}/{filename}".'
        )
        .nonempty()
        .optional(),

    messagesBucket: z
        .string()
        .describe(
            'The name of the bucket that large websocket messages should be placed in.'
        )
        .nonempty()
        .optional(),

    options: z
        .object({
            endpoint: z
                .string()
                .describe('The endpoint of the S3 API.')
                .nonempty()
                .optional(),
            s3ForcePathStyle: z
                .boolean()
                .describe(
                    'Wether to force the S3 client to use the path style API. Defaults to false.'
                )
                .optional(),
        })
        .describe('Options for the S3 client.'),

    host: z
        .string()
        .describe(
            'The S3 host that should be used for file record storage. If omitted, then the default S3 host will be used.'
        )
        .nonempty()
        .optional(),
});

const minioSchema = z.object({
    endpoint: z
        .string()
        .describe('The hostname or IP Address of the Minio server.')
        .min(1),

    port: z
        .number()
        .describe(
            'The port that the Minio server is running on. Defaults to 80 for non-SSL, and 443 for SSL.'
        )
        .int()
        .positive()
        .optional(),

    useSSL: z
        .boolean()
        .describe(
            'Whether to use SSL when connecting to the Minio server. Defaults to true.'
        )
        .optional()
        .default(true),

    accessKey: z
        .string()
        .describe(
            'The access key that should be used to connect to the Minio server.'
        )
        .min(1),

    secretKey: z
        .string()
        .describe(
            'The secret key that should be used to connect to the Minio server.'
        )
        .min(1),

    region: z
        .string()
        .describe(
            'The region of the file records and websocket message buckets.'
        )
        .min(1)
        .optional()
        .default('us-east-1'),

    filesBucket: z
        .string()
        .describe(
            'The name of the bucket that file records should be placed in.'
        )
        .min(1),

    defaultFilesBucket: z
        .string()
        .describe(
            'The name of the bucket that file records were originally placed in. This is used for backwards compatibility for file records that were uploaded before changing the filesBucket was supported. If not specified, then filesBucket is used.'
        )
        .min(1)
        .optional(),

    publicFilesUrl: z
        .string()
        .describe(
            'The URL that public files should be accessed at. If specified, then public file records will point to this URL instead of the default S3 URL. If not specified, then the default URL will be used. ' +
                'Useful for adding CDN support for public files. Private file records are unaffected by this setting. ' +
                'File Record URLs will be formatted as: "{publicFilesUrl}/{recordName}/{filename}".'
        )
        .nonempty()
        .optional(),

    messagesBucket: z
        .string()
        .describe(
            'The name of the bucket that large websocket messages should be placed in.'
        )
        .min(1)
        .optional(),
});

const livekitSchema = z.object({
    apiKey: z
        .string()
        .describe('The API Key for Livekit.')
        .nonempty()
        .nullable(),
    secretKey: z
        .string()
        .describe('The secret key for Livekit.')
        .nonempty()
        .nullable(),
    endpoint: z
        .string()
        .describe('The URL that the Livekit server is publicly available at.')
        .nonempty()
        .nullable(),
});

const textItSchema = z.object({
    apiKey: z
        .string()
        .describe('The API Key for TextIt.')
        .nonempty()
        .nullable(),
    flowId: z
        .string()
        .describe(
            'The ID of the flow that should be triggered for sending login codes.'
        )
        .nonempty()
        .nullable(),
});

const sesContentSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('template'),
        templateArn: z
            .string()
            .describe('The ARN of the SES email template that should be used.')
            .nonempty(),
    }),
    z.object({
        type: z.literal('plain'),
        subject: z.string().describe('The subject of the email.').nonempty(),
        body: z
            .string()
            .describe(
                'The body of the email. Use double curly-braces {{variable}} to insert variables.'
            )
            .nonempty(),
    }),
]);

const sesSchema = z.object({
    fromAddress: z
        .string()
        .describe('The email address that SES messages should be sent from.')
        .nonempty(),
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
        .describe(
            'The Redis connection URL that should be used. If omitted, then host, port, and password must be provided.'
        )
        .nonempty()
        .optional(),
    host: z
        .string()
        .describe(
            'The host that the redis client should connect to. Ignored if url is provided.'
        )
        .nonempty()
        .optional(),
    port: z
        .number()
        .describe(
            'The port that the redis client should connect to. Ignored if url is provided.'
        )
        .optional(),
    password: z
        .string()
        .describe(
            'The password that the redis client should use. Ignored if url is provided.'
        )
        .nonempty()
        .optional(),
    tls: z
        .boolean()
        .describe(
            'Whether to use TLS for connecting to the Redis server. Ignored if url is provided.'
        )
        .optional(),
});

export type RedisServerOptions = z.infer<typeof redisServerSchema>;

const redisSchema = z.object({
    url: z
        .string()
        .describe(
            'The Redis connection URL that should be used. If omitted, then host, port, and password must be provided.'
        )
        .nonempty()
        .optional(),
    host: z
        .string()
        .describe(
            'The host that the redis client should connect to. Ignored if url is provided.'
        )
        .nonempty()
        .optional(),
    port: z
        .number()
        .describe(
            'The port that the redis client should connect to. Ignored if url is provided.'
        )
        .optional(),
    password: z
        .string()
        .describe(
            'The password that the redis client should use. Ignored if url is provided.'
        )
        .nonempty()
        .optional(),
    tls: z
        .boolean()
        .describe(
            'Whether to use TLS for connecting to the Redis server. Ignored if url is provided.'
        )
        .optional(),

    servers: z
        .object({
            instData: redisServerSchema
                .describe(
                    'The Redis server that should be used for storage of temporary inst data. If omitted, then the default server will be used.'
                )
                .optional(),
            websocketConnections: redisServerSchema
                .describe(
                    'The Redis server that should be used for storage of websocket connections. If omitted, then the default server will be used.'
                )
                .optional(),
            caches: redisServerSchema
                .describe(
                    'The Redis server that should be used for the caches. If omitted, then the default server will be used.'
                )
                .optional(),
            rateLimit: redisServerSchema
                .describe(
                    'The Redis server that should be used for rate limits. If omitted, then the default server will be used.'
                )
                .optional(),
            pubSub: redisServerSchema
                .describe(
                    'The Redis server that should be used for pubsub. If omitted, then the default server will be used.'
                )
                .optional(),
        })
        .describe(
            'The Redis servers that should be used for specific categories of data. If omitted, then the default server will be used.'
        )
        .default({}),

    rateLimitPrefix: z
        .string()
        .describe(
            'The namespace that rate limit counters are stored under. If omitted, then redis rate limiting is not possible.'
        )
        .nonempty()
        .optional(),

    websocketRateLimitPrefix: z
        .string()
        .describe(
            'The namespace that websocket rate limit counters are stored under. If omitted, then the rateLimitPrefix is used.'
        )
        .nonempty()
        .optional(),

    websocketConnectionNamespace: z
        .string()
        .describe(
            'The namespace that websocket connections are stored under. If omitted, then redis inst records are not possible.'
        )
        .optional(),
    instRecordsStoreNamespace: z
        .string()
        .describe(
            'The namespace that inst records are stored under. If omitted, then redis inst records are not possible.'
        )
        .optional(),
    publicInstRecordsLifetimeSeconds: z
        .number()
        .describe(
            'The lifetime of public inst records in seconds. If null, then public inst records never expire. Defaults to 1 day in seconds (86,400)'
        )
        .positive()
        .nullable()
        .optional()
        .default(60 * 60 * 24),
    publicInstRecordsLifetimeExpireMode: expireModeSchema
        .describe(
            'The Redis expire mode that should be used for public inst records. Defaults to NX. If null, then the expiration will update every time the inst data is updated. Only supported on Redis 7+. If set to something not null on Redis 6, then errors will occur.'
        )
        .optional()
        .default('NX'),

    tempInstRecordsStoreNamespace: z
        .string()
        .describe(
            'The namespace that temporary inst records are stored under (e.g. tempShared space). If omitted, then redis inst records are not possible.'
        )
        .optional(),
    tempInstRecordsLifetimeSeconds: z
        .number()
        .describe(
            'The lifetime of temporary inst records data in seconds (e.g. tempShared space). Intended to clean up temporary branches that have not been changed for some amount of time. If null, then temporary inst branches never expire. Defaults to 24 hours.'
        )
        .positive()
        .nullable()
        .optional()
        .default(60 * 60 * 24),
    tempInstRecordsLifetimeExpireMode: expireModeSchema
        .describe(
            'The Redis expire mode that should be used for temporary inst branches (e.g. tempShared space). Defaults to null. If null, then the expiration will not have a mode. Only supported on Redis 7+. If set to something not null on Redis 6, then errors will occur.'
        )
        .optional()
        .default(null),

    // The number of seconds that authorizations for repo/add_updates permissions (inst.read and inst.updateData) are cached for.
    // Because repo/add_updates is a very common permission, we periodically cache permissions to avoid hitting the database too often.
    // 5 minutes by default
    connectionAuthorizationCacheSeconds: z
        .number()
        .describe(
            `The number of seconds that authorizations for repo/add_updates permissions (inst.read and inst.updateData) are cached for.
Because repo/add_updates is a very common permission, we periodically cache permissions to avoid hitting the database too often. Defaults to 5 minutes.`
        )
        .positive()
        .default(300),

    cacheNamespace: z
        .string()
        .describe(
            'The namespace for cached items. (policies & configuration) Defaults to "/cache". Set to null to disable caching of policies and configuration.'
        )
        .nonempty()
        .nullable()
        .optional()
        .default('/cache'),

    connectionExpireSeconds: z
        .number()
        .describe(
            'The maximum lifetime of websocket connections in seconds. Intended to clean up any keys under websocketConnectionNamespace that have not been changed after an amount of time. It is recomended to set this longer than the maximum websocket connection length. Defaults to 3 hours. Set to null to disable.'
        )
        .positive()
        .optional()
        .nullable()
        .default(60 * 60 * 3),
    connectionExpireMode: expireModeSchema
        .describe(
            'The Redis expire mode that should be used for connections. Defaults to null. If null, then the expiration will not have a mode. Only supported on Redis 7+. If set to something not null on Redis 6, then errors will occur.'
        )
        .optional()
        .default(null),

    pubSubNamespace: z
        .string()
        .describe(
            'The namespace that should be used for pubsub subscriptions. Defaults to "pubsub". If set to null, then pubsub is disabled.'
        )
        .nullable()
        .optional()
        .default('pubsub'),
});

const rateLimitSchema = z.object({
    maxHits: z
        .number()
        .describe(
            'The maximum number of hits allowed from a single IP Address within the window.'
        )
        .positive(),
    windowMs: z
        .number()
        .describe('The size of the window in miliseconds.')
        .positive(),
});

const stripeSchema = z.object({
    secretKey: z
        .string()
        .describe('The Stripe secret key that should be used.')
        .nonempty(),
    publishableKey: z
        .string()
        .describe('The Stripe publishable key that should be used.')
        .nonempty(),
    testClock: z
        .string()
        .describe('The stripe test clock that should be used.')
        .nonempty()
        .optional(),
});

const mongodbSchema = z.object({
    url: z
        .string()
        .describe('The MongoDB URL that should be used to connect to MongoDB.')
        .nonempty(),
    useNewUrlParser: z
        .boolean()
        .describe('Whether to use the new URL parser. Defaults to false.')
        .optional()
        .default(false),
    database: z
        .string()
        .describe('The database that should be used.')
        .nonempty(),
    fileUploadUrl: z
        .string()
        .describe('The URL that files records need to be uploaded to.')
        .nonempty()
        .optional(),
});

const prismaSchema = z.object({
    options: z
        .object({})
        .describe(
            'Generic options that should be passed to the Prisma client constructor.'
        )
        .passthrough()
        .optional(),

    policiesCacheSeconds: z
        .number()
        .describe(
            'The number of seconds that policies are cached for. Defaults to 60 seconds. Set to null to disable caching of policies.'
        )
        .positive()
        .nullable()
        .optional()
        .default(60),
    configurationCacheSeconds: z
        .number()
        .describe(
            'The number of seconds that configuration items are cached for. Defaults to 60 seconds. Set to null to disable caching of configuration items.'
        )
        .positive()
        .nullable()
        .optional()
        .default(60 * 60 * 24), // 24 hours in seconds,
});

const openAiSchema = z.object({
    apiKey: z
        .string()
        .describe('The OpenAI API Key that should be used.')
        .nonempty(),
});

const googleAiSchema = z.object({
    apiKey: z
        .string()
        .describe('The Google AI API Key that should be used.')
        .nonempty(),
});

const anthropicAiSchema = z.object({
    apiKey: z
        .string()
        .describe('The Anthropic AI API Key that should be used.')
        .min(1),
});

const blockadeLabsSchema = z.object({
    apiKey: z
        .string()
        .describe('The Blockade Labs API Key that should be used.')
        .nonempty(),
});

const stabilityAiSchema = z.object({
    apiKey: z
        .string()
        .describe('The StabilityAI API Key that should be used.')
        .nonempty(),
});

const humeAiSchema = z.object({
    apiKey: z
        .string()
        .describe('The Hume AI API Key that should be used.')
        .min(1),
    secretKey: z
        .string()
        .describe('The Hume AI Secret Key that should be used.')
        .min(1),
});

const sloydAiSchema = z.object({
    clientId: z.string().describe('The client ID for the Sloyd AI API.').min(1),

    clientSecret: z
        .string()
        .describe('The client secret for the Sloyd AI API.')
        .min(1),
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
                .describe(
                    'The model that should be used for Chat AI requests when one is not specified.'
                )
                .nonempty(),
            allowedModels: z
                .array(
                    z.union([
                        z.string().nonempty(),
                        z.object({
                            provider: z
                                .enum(['openai', 'google', 'anthropic'])
                                .optional(),
                            model: z.string().nonempty(),
                        }),
                        z.object({
                            provider: z
                                .literal('custom-openai-completions')
                                .describe(
                                    'Defines that the provider points to a custom implementation of the OpenAI Completions API'
                                ),
                            name: z
                                .string()
                                .describe(
                                    'The name that should be used for this provider'
                                )
                                .nonempty()
                                .default('custom-openai-completions'),
                            apiKey: z
                                .string()
                                .describe(
                                    'The API key that should be used to communicate with the custom API.'
                                )
                                .nonempty(),
                            baseUrl: z
                                .string()
                                .describe(
                                    'The endpoint that should be used to communicate with the custom API. (e.g. "https://api.openai.com/v1/" for OpenAIs API)'
                                )
                                .nonempty(),
                            models: z
                                .array(z.string().nonempty())
                                .describe(
                                    'The list of models that should be mapped to this provider'
                                ),
                            additionalProperties: z
                                .object({})
                                .passthrough()
                                .describe(
                                    'The additional properties that should be included in requests.'
                                )
                                .optional(),
                        }),
                    ])
                )
                .describe(
                    'The list of models that are allowed to be used for Chat AI requets.'
                ),
            allowedSubscriptionTiers: z
                .union([z.literal(true), z.array(z.string().nonempty())])
                .describe(
                    'The subscription tiers that are allowed to use Chat AI. If true, then all tiers are allowed.'
                ),
            tokenModifierRatio: z
                .record(z.string(), z.number().positive())
                .describe(
                    'Custom token modifier ratio per model. The key is the model name and the value is the cost multiplier.'
                )
                .optional()
                .default({}),
        })
        .describe('Options for Chat AI. If omitted, then chat AI is disabled.')
        .optional(),
    generateSkybox: z
        .object({
            provider: z
                .literal('blockadeLabs')
                .describe(
                    'The provider that should be used for Skybox Generation AI requests.'
                ),
            allowedSubscriptionTiers: z
                .union([z.literal(true), z.array(z.string().nonempty())])
                .describe(
                    'The subscription tiers that are allowed to use Skybox AI. If true, then all tiers are allowed.'
                ),
        })
        .describe(
            'Options for Skybox Generation AI. If omitted, then Skybox AI is disabled.'
        )
        .optional(),
    images: z
        .object({
            defaultModel: z
                .string()
                .describe(
                    'The model that should be used for Image AI requests when one is not specified.'
                )
                .nonempty(),
            defaultWidth: z
                .number()
                .describe('The default width of generated images.')
                .int()
                .positive(),
            defaultHeight: z
                .number()
                .describe('The default height of generated images.')
                .int()
                .positive(),
            maxWidth: z
                .number()
                .describe(
                    'The maximum width of generated images. If omitted, then the max width is controlled by the model.'
                )
                .int()
                .positive()
                .optional(),
            maxHeight: z
                .number()
                .describe(
                    'The maximum height of generated images. If omitted, then the max height is controlled by the model.'
                )
                .int()
                .positive()
                .optional(),
            maxSteps: z
                .number()
                .describe(
                    'The maximum number of steps that can be used to generate an image. If omitted, then the max steps is controlled by the model.'
                )
                .int()
                .positive()
                .optional(),
            maxImages: z
                .number()
                .describe(
                    'The maximum number of images that can be generated in a single request. If omitted, then the max images is controlled by the model.'
                )
                .int()
                .positive()
                .optional(),
            allowedModels: z
                .object({
                    openai: z
                        .array(z.string().nonempty())
                        .describe(
                            'The list of OpenAI DALL-E models that are allowed to be used. If omitted, then no OpenAI models are allowed.'
                        )
                        .optional(),
                    stabilityai: z
                        .array(z.string().nonempty())
                        .describe(
                            'The list of StabilityAI models that are allowed to be used. If omitted, then no StabilityAI models are allowed.'
                        )
                        .optional(),
                })
                .describe(
                    'The models that are allowed to be used from each provider.'
                ),
            allowedSubscriptionTiers: z
                .union([z.literal(true), z.array(z.string().nonempty())])
                .describe(
                    'The subscription tiers that are allowed to use Image AI. If true, then all tiers are allowed.'
                ),
            tokenModifierRatio: z
                .record(z.string(), z.number().positive())
                .describe(
                    'Custom token modifier ratio per model. The key is the model name and the value is the cost multiplier.'
                )
                .optional(),
        })
        .describe(
            'Options for Image AI. If omitted, then Image AI is disabled.'
        )
        .optional(),
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
                    .describe('The human-readable name of the relying party.')
                    .nonempty(),
                id: z
                    .string()
                    .describe(
                        'The ID of the relying party. Should be the domain of the relying party. Note that this does not mean that it has to be unique. Instead, it just needs to match the domain that the passkeys can be used on.'
                    )
                    .nonempty(),
                origin: z
                    .string()
                    .describe('The HTTP origin of the relying party.')
                    .nonempty(),
            })
        )
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
                .describe(
                    'The URL that traces should be sent to. Only required for otlp exporters.'
                )
                .optional(),
            headers: z
                .record(z.string())
                .describe(
                    'The headers that should be sent with the traces. Only required for otlp exporters.'
                )
                .optional(),
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
                .describe(
                    'The URL that metrics should be sent to. Only required for otlp exporters.'
                )
                .optional(),
            headers: z
                .record(z.string())
                .describe(
                    'The headers that should be sent with the metrics. Only required for otlp exporters.'
                )
                .optional(),
        })
        .describe('Options for configuring metrics.'),

    instrumentation: z
        .object({
            auto: z
                .record(z.object({}).passthrough())
                .describe(
                    'Options for auto-instrumentation. If omitted, then auto-instrumentation will be enabled with default settings. If set to null, then auto-instrumentation will be disabled.'
                )
                .optional()
                .nullable(),

            prisma: z
                .object({})
                .describe(
                    'Options for Prisma instrumentation. If omitted, then Prisma instrumentation will be enabled with default settings. If set to null, then prisma instrumentation will be disabled.'
                )
                .passthrough()
                .optional()
                .nullable(),

            redis: z
                .object({})
                .describe(
                    'Options for Redis instrumentation. If omitted, then Redis instrumentation will be enabled with default settings. If set to null, then redis instrumentation will be disabled.'
                )
                .passthrough()
                .optional()
                .nullable(),
        })
        .describe('Options for instrumentation')
        .optional()
        .default({}),

    resource: z
        .record(z.string())
        .describe(
            'The resource that should be used. See https://opentelemetry.io/docs/specs/semconv/resource/ for more information.'
        )
        .optional()
        .default({}),
});

const rekognitionSchema = z.object({
    moderation: z.object({
        files: z.object({
            job: z
                .object({
                    accountId: z
                        .string()
                        .describe(
                            'The AWS Account ID that should be used to run the job.'
                        )
                        .min(1),

                    sourceBucket: z
                        .string()
                        .describe(
                            'The bucket that should be scanned when a job is started.'
                        )
                        .min(1),

                    reportBucket: z
                        .string()
                        .describe(
                            'The bucket that job reports should be placed in.'
                        )
                        .min(1),

                    priority: z
                        .number()
                        .describe(
                            'The priority of jobs that are created. Higher numbers are higher priority. Defaults to 10.'
                        )
                        .int()
                        .optional()
                        .default(10),

                    roleArn: z
                        .string()
                        .describe(
                            'The ARN of the role that should be used to run the job.'
                        )
                        .min(1),

                    lambdaFunctionArn: z
                        .string()
                        .describe(
                            'The ARN of the lambda function that should be invoked to process the files.'
                        )
                        .min(1),

                    tags: z
                        .array(
                            z.object({
                                key: z.string().min(1),
                                value: z.string().min(1),
                            })
                        )
                        .describe('The tags that should be placed on the job.')
                        .optional(),
                })
                .describe('The options specific to starting batch jobs.')
                .optional(),

            scan: z
                .object({
                    projectVersionArn: z
                        .string()
                        .describe(
                            'The ARN of the custom moderation model that should be used. If omitted, then the default model is used.'
                        )
                        .min(1)
                        .optional(),
                })
                .describe('The options specific to scanning files.')
                .optional(),
        }),
    }),
});

const webhooksSchema = z.object({
    environment: z.discriminatedUnion('type', [
        z.object({
            type: z.literal('deno'),
            scriptPath: z
                .string()
                .describe('The path to the Deno script that should be run.')
                .min(1),
            denoPath: z
                .string()
                .describe(
                    'The path to the Deno executable that should be used.'
                )
                .min(1)
                .optional()
                .nullable(),
            debugLogs: z
                .boolean()
                .describe(
                    'Whether to enable debug logs for the Deno environment. This will log all Deno output to the console.'
                )
                .default(false),
        }),
        z.object({
            type: z.literal('node'),
        }),
        z.object({
            type: z.literal('lambda'),
            functionName: z
                .string()
                .describe(
                    'The name or ARN of the lambda function that should be called to process a webhook. If omitted, then the lambda function name will be taken from the WEBHOOK_LAMBDA_FUNCTION_NAME envrionment variable.'
                )
                .min(1)
                .optional()
                .nullable(),
        }),
    ]),
});

export const serverConfigSchema = z.object({
    s3: s3Schema
        .describe(
            'S3 Configuration Options. If omitted, then S3 cannot be used for file storage.'
        )
        .optional(),

    rekognition: rekognitionSchema
        .describe(
            'AWS Rekognition configuration options. If omitted, then AWS Rekognition cannot be used for moderation/classification.'
        )
        .optional(),

    minio: minioSchema
        .describe(
            'Minio Configuration Options. If omitted, then Minio cannot be used for file storage.'
        )
        .optional(),

    apiGateway: apiGatewaySchema
        .describe(
            'AWS API Gateway configuration options. If omitted, then inst records cannot be used on AWS Lambda.'
        )
        .optional(),
    mongodb: mongodbSchema
        .describe(
            'MongoDB configuration options. If omitted, then MongoDB cannot be used.'
        )
        .optional(),
    prisma: prismaSchema
        .describe(
            'Prisma configuration options. If omitted, then Prisma (CockroachDB) cannot be used.'
        )
        .optional(),
    livekit: livekitSchema
        .describe(
            'Livekit configuration options. If omitted, then Livekit features will be disabled.'
        )
        .optional(),
    textIt: textItSchema
        .describe(
            'TextIt configuration options. If omitted, then SMS login will be disabled.'
        )
        .optional(),
    ses: sesSchema
        .describe(
            'AWS SES configuration options. If omitted, then sending login codes via SES is not possible.'
        )
        .optional(),
    redis: redisSchema
        .describe(
            'Redis configuration options. If omitted, then using Redis is not possible.'
        )
        .optional(),
    rateLimit: rateLimitSchema
        .describe(
            'Rate limit options. If omitted, then rate limiting will be disabled.'
        )
        .optional(),
    websocketRateLimit: rateLimitSchema
        .describe(
            'Rate limit options for websockets. If omitted, then the rateLimit options will be used for websockets.'
        )
        .optional(),
    openai: openAiSchema
        .describe(
            'OpenAI options. If omitted, then it will not be possible to use GPT or DALL-E.'
        )
        .optional(),
    blockadeLabs: blockadeLabsSchema
        .describe(
            'Blockade Labs options. If omitted, then it will not be possible to generate skyboxes.'
        )
        .optional(),
    stabilityai: stabilityAiSchema
        .describe(
            'Stability AI options. If omitted, then it will not be possible to use Stable Diffusion.'
        )
        .optional(),
    googleai: googleAiSchema
        .describe(
            'Google AI options. If omitted, then it will not be possible to use Google AI (i.e. Gemini)'
        )
        .optional(),
    anthropicai: anthropicAiSchema
        .describe(
            'Anthropic AI options. If omitted, then it will not be possible to use Anthropic AI (i.e. Claude).'
        )
        .optional(),
    humeai: humeAiSchema
        .describe(
            'Hume AI options. If omitted, then it will not be possible to use Hume AI.'
        )
        .optional(),

    sloydai: sloydAiSchema
        .describe(
            'Sloyd AI options. If omitted, then it will not be possible to use Sloyd AI.'
        )
        .optional(),

    ai: aiSchema
        .describe(
            'AI configuration options. If omitted, then all AI features will be disabled.'
        )
        .optional(),
    ws: wsSchema
        .describe(
            'WebSocket Server configuration options. If omitted, then inst records cannot be used in standalone deployments.'
        )
        .optional(),

    privo: privoSchema
        .describe(
            'Privo configuration options. If omitted, then Privo features will be disabled.'
        )
        .optional(),

    webauthn: webauthnSchema
        .describe(
            'WebAuthn configuration options. If omitted, then WebAuthn features will be disabled.'
        )
        .optional(),

    telemetry: telemetrySchema
        .describe(
            'Options for configuring telemetry. If omitted, then telemetry will not be enabled.'
        )
        .optional(),

    subscriptions: subscriptionConfigSchema
        .describe(
            'The default subscription configuration. If omitted, then subscription features will be disabled.'
        )
        .optional(),
    stripe: stripeSchema
        .describe(
            'Stripe options. If omitted, then Stripe features will be disabled.'
        )
        .optional(),
    notifications: notificationsSchema
        .describe(
            'System notification configuration options. Used to send messages for various events like user inst reports and com ID requests. If omitted, then server notifications will be disabled.'
        )
        .optional(),
    moderation: moderationSchema
        .describe(
            'Moderation configuration options. If omitted, then moderation features will be disabled unless overridden in the database.'
        )
        .optional(),

    webhooks: webhooksSchema
        .describe(
            'Webhook configuration options. If omitted, then webhook features will be disabled.'
        )
        .optional(),

    webPush: z
        .object({
            vapidSubject: z
                .string()
                .describe(
                    'The subject that should be used for sending web push notifications. You can generate VAPID keys using https://www.npmjs.com/package/web-push'
                )
                .min(1),
            vapidPublicKey: z
                .string()
                .describe(
                    'The public key that should be used for sending web push notifications. You can generate VAPID keys using https://www.npmjs.com/package/web-push'
                )
                .min(1),
            vapidPrivateKey: z
                .string()
                .describe(
                    'The private key that should be used for sending web push notifications. You can generate VAPID keys using https://www.npmjs.com/package/web-push'
                )
                .min(1),
        })
        .describe(
            'Web Push configuration options. If omitted, then web push notifications will be disabled.'
        )
        .optional(),

    meta: z
        .object({
            apiOrigin: z
                .string()
                .describe('The HTTP origin that the API is available at.'),
            websocketOrigin: z
                .string()
                .describe(
                    'The HTTP origin that the Websocket API is available at.'
                )
                .optional()
                .nullable(),
            websocketProtocol: z
                .enum(['websocket', 'apiary-aws'])
                .describe(
                    'The protocol that should be used to connect to the websocket origin.'
                )
                .optional()
                .nullable(),
        })
        .describe(
            'The metadata about the server deployment. If omitted, then the server will not be able to provide information about itself. This would result in records features not being supported in webhook handlers.'
        )
        .optional(),
});

export type S3Config = z.infer<typeof s3Schema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
