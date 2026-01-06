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
import { getSchemaMetadata } from '@casual-simulation/aux-common';
import { serverConfigSchema } from './ServerConfig';

describe('serverConfigSchema', () => {
    it('should be able to parse a PublicOS-style config', () => {
        const config: any = {
            redis: {
                host: 'redis-host.example.com',
                port: 11123,
                tls: false,
                password: 'redis-password',
                rateLimitPrefix: '/rate-limit',
                websocketConnectionNamespace: '/connections',
                instRecordsStoreNamespace: '/insts',
                tempInstRecordsStoreNamespace: '/tempInsts',
                cacheNamespace: '/cache',
                publicInstRecordsLifetimeExpireMode: null,
            },
            prisma: {
                options: {
                    datasources: {
                        db: {
                            url: 'postgresql://cocroach-host:26257/database?sslmode=verify-full',
                        },
                    },
                },
            },
            stripe: {
                secretKey: 'stripe-secret-key',
                publishableKey: 'stripe-publishable-key',
            },
            humeai: {
                apiKey: 'hume-api-key',
                secretKey: 'hume-secret-key',
            },
            anthropicai: {
                apiKey: 'anthropic-api-key',
            },
            blockadeLabs: {
                apiKey: 'blockadeLabs-api-key',
            },
            stabilityai: {
                apiKey: 'stabilityai-api-key',
            },
            sloydai: {
                clientId: 'slodai-client-id',
                clientSecret: 'sloydai-client-secret',
            },
            ai: {
                chat: {
                    provider: 'anthropic',
                    defaultModel: 'claude-3-5-sonnet-20240620',
                    allowedModels: ['claude-3-5-sonnet-20240620'],
                    allowedSubscriptionTiers: true,
                },
                generateSkybox: {
                    provider: 'blockadeLabs',
                    allowedSubscriptionTiers: true,
                },
                images: {
                    defaultModel: 'stable-diffusion-xl-1024-v1-0',
                    defaultWidth: 512,
                    defaultHeight: 512,
                    maxWidth: 1024,
                    maxHeight: 1024,
                    maxSteps: 50,
                    maxImages: 3,
                    allowedModels: {
                        stabilityai: [
                            'stable-diffusion-xl-1024-v1-0',
                            'stable-diffusion-v1-6',
                            'stable-image-ultra',
                            'stable-image-core',
                            'sd3-medium',
                            'sd3-large',
                            'sd3-large-turbo',
                        ],
                    },
                    allowedSubscriptionTiers: true,
                },
            },
            privo: {
                gatewayEndpoint: 'https://api-gw-svc.privo.com',
                publicEndpoint: 'https://privohub.privo.com',
                clientId: 'privo-client-id',
                clientSecret: 'privo-client-secret',
                redirectUri: 'https://example.com/oauth/redirect',
                roleIds: {
                    child: 'ab1Child',
                    parent: 'ab1Parent',
                    adult: 'ab1Adult',
                },
                featureIds: {
                    childPrivoSSO: 'ab1Account',
                    adultPrivoSSO: 'ab1AdultAccount',
                    joinAndCollaborate: 'joinCollaborate',
                    publishProjects: 'publishProjects',
                    projectDevelopment: 'projectDev',
                    buildAIEggs: 'ab1buildai',
                },
            },
            subscriptions: {
                subscriptions: [],
                defaultFeatures: {
                    user: {
                        insts: {
                            allowed: true,
                            maxInsts: 1024,
                            maxBytesPerInst: 25000000,
                            maxActiveConnectionsPerInst: 8,
                        },
                        records: {
                            allowed: true,
                            maxRecords: 30,
                        },
                        data: {
                            allowed: true,
                            maxItems: 10000,
                            maxReadsPerPeriod: 100000,
                            maxWritesPerPeriod: 100000,
                        },
                        files: {
                            allowed: true,
                            maxFiles: 10000,
                            maxBytesPerFile: 128000000,
                            maxBytesTotal: 1000000000,
                        },
                        events: {
                            allowed: true,
                            maxEvents: 100,
                            maxUpdatesPerPeriod: 10000,
                        },
                        policies: {
                            allowed: true,
                            maxPolicies: 32,
                        },
                        ai: {
                            chat: {
                                allowed: true,
                                maxTokensPerPeriod: 250000,
                            },
                            images: {
                                allowed: true,
                                maxSquarePixelsPerPeriod: 102400,
                            },
                            skyboxes: {
                                allowed: true,
                                maxSkyboxesPerPeriod: 100,
                            },
                            hume: {
                                allowed: true,
                            },
                            sloyd: {
                                allowed: true,
                            },
                        },
                    },
                    studio: {
                        insts: {
                            allowed: false,
                        },
                        records: {
                            allowed: false,
                        },
                        data: {
                            allowed: false,
                        },
                        files: {
                            allowed: false,
                        },
                        events: {
                            allowed: false,
                        },
                        policies: {
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
                        },
                    },
                    defaultPeriodLength: {
                        months: 1,
                    },
                },
                webhookSecret: 'we-dont-need-this-now',
                successUrl: 'https://example.com/',
                cancelUrl: 'https://example.com/',
                returnUrl: 'https://example.com/',
            },
            rateLimit: {
                maxHits: 5000,
                windowMs: 60000,
            },
            notifications: {
                slack: {
                    webhookUrl: 'https://slack.webhook.example.com',
                },
                telegram: {
                    chatId: 1,
                    token: 'telegram-token',
                },
            },
            moderation: {
                allowUnauthenticatedReports: false,
            },
            telemetry: {
                tracing: {
                    exporter: 'otlp',
                    url: 'https://traces.oltp.example.com',
                    headers: {
                        Authorization: 'Basic Token',
                    },
                },
                metrics: {
                    exporter: 'otlp',
                    url: 'https://metrics.oltp.example.com',
                    headers: {
                        Authorization: 'Basic Token',
                    },
                },
                resource: {
                    'service.name': 'casualos',
                },
            },
        };

        const result = serverConfigSchema.safeParse(config);

        expect(result).toEqual({
            success: true,
            data: expect.any(Object),
        });
        expect(result).toMatchSnapshot();
    });

    it('should be able to parse a BrandPlayer-style config', () => {
        const config: any = {
            redis: {
                host: 'redis-host.example.com',
                port: 11123,
                tls: false,
                password: 'redis-password',
                rateLimitPrefix: '/rate-limit',
                websocketConnectionNamespace: '/connections',
                instRecordsStoreNamespace: '/insts',
                tempInstRecordsStoreNamespace: '/tempInsts',
                cacheNamespace: '/cache',
            },
            prisma: {
                configurationCacheSeconds: 86400,
                options: {
                    datasources: {
                        db: {
                            url: 'postgresql://cocroach-host:26257/database?sslmode=verify-full',
                        },
                    },
                },
            },
            livekit: {
                endpoint: 'wss://webrtc.example.com:443',
                apiKey: 'api-key',
                secretKey: 'secret-key',
            },
            webauthn: {
                relyingParties: [
                    {
                        id: 'auth.example.com',
                        name: 'Auth CasualOS',
                        origin: 'https://auth.example.com',
                    },
                    {
                        id: 'example.com',
                        name: 'CasualOS',
                        origin: 'https://example.com',
                    },
                ],
            },
            stripe: {
                secretKey: 'stripe-secret-key',
                publishableKey: 'stripe-publishable-key',
            },
            humeai: {
                apiKey: 'hume-api-key',
                secretKey: 'hume-secret-key',
            },
            openai: {
                apiKey: 'openai-api-key',
            },
            googleai: {
                apiKey: 'google-api-key',
            },
            anthropicai: {
                apiKey: 'anthropic-api-key',
            },
            blockadeLabs: {
                apiKey: 'blockadeLabs-api-key',
            },
            stabilityai: {
                apiKey: 'stabilityai-api-key',
            },
            sloydai: {
                clientId: 'slodai-client-id',
                clientSecret: 'sloydai-client-secret',
            },
            ai: {
                chat: {
                    provider: 'openai',
                    defaultModel: 'gpt-3.5-turbo',
                    allowedModels: [
                        'o1-preview',
                        'o1-mini',
                        'gpt-3.5-turbo',
                        'gpt-4',
                        'gpt-4o',
                        'gpt-4-1106-preview',
                        'gpt-4-vision-preview',
                        {
                            provider: 'google',
                            model: 'gemini-pro',
                        },
                        {
                            provider: 'google',
                            model: 'gemini-1.5-pro',
                        },
                        {
                            provider: 'anthropic',
                            model: 'claude-3-5-sonnet-20240620',
                        },
                        {
                            provider: 'anthropic',
                            model: 'claude-3-5-sonnet-20241022',
                        },
                        {
                            provider: 'anthropic',
                            model: 'claude-3-5-sonnet-latest',
                        },
                    ],
                    allowedSubscriptionTiers: true,
                },
                generateSkybox: {
                    provider: 'blockadeLabs',
                    allowedSubscriptionTiers: true,
                },
                images: {
                    defaultModel: 'dall-e-2',
                    defaultWidth: 512,
                    defaultHeight: 512,
                    maxWidth: 1024,
                    maxHeight: 1024,
                    maxSteps: 50,
                    maxImages: 3,
                    allowedModels: {
                        openai: ['dall-e-2', 'dall-e-3'],
                        stabilityai: [
                            'stable-diffusion-xl-1024-v1-0',
                            'stable-diffusion-v1-6',
                            'stable-image-ultra',
                            'stable-image-core',
                            'sd3-medium',
                            'sd3-large',
                            'sd3-large-turbo',
                        ],
                    },
                    allowedSubscriptionTiers: true,
                },
            },
            ses: {
                content: {
                    type: 'plain',
                    subject: 'casualos login code',
                    body: 'Your casualos login code is: {{code}}',
                },
                fromAddress: 'casualos-noreply@example.com',
            },
            subscriptions: {
                subscriptions: [
                    {
                        id: 'default-6dcf-42b3-89a0-e6594278a53d',
                        featureList: [
                            'Save Progress',
                            'Experience Personalization',
                        ],
                        name: 'Free Play',
                        description:
                            'Play Personalized 3D Experiences from your Favorite Brands for FREE',
                        defaultSubscription: true,
                        tier: 'FreePlay',
                        userOnly: true,
                    },
                    {
                        id: 'MediumImpactMaker-6dcf-42b3-89a0-e6594278a53d',
                        featureList: [
                            'Save Progress',
                            'Enhanced Experience Personalization',
                        ],
                        name: 'Medium Impact Maker',
                        description:
                            'Play Personalized 3D Experiences from your Favorite Brands for FREE',
                        defaultSubscription: false,
                        purchasable: false,
                        tier: 'MediumImpactMaker',
                        userOnly: true,
                    },
                    {
                        id: 'LargeImpactMaker-6dcf-42b3-89a0-e6594278a53d',
                        featureList: [
                            'Save Progress',
                            'Enhanced Experience Personalization',
                        ],
                        name: 'Large Impact Maker',
                        description:
                            'Play Personalized 3D Experiences from your Favorite Brands for FREE',
                        defaultSubscription: false,
                        purchasable: false,
                        tier: 'LargeImpactMaker',
                        userOnly: true,
                    },
                    {
                        tier: 'PremiumPlay',
                        id: 'f4850284-f962-4fe6-a1e9-eacaf39a67e7',
                        product: 'prod_OrbyQz0UFHLQQO',
                        eligibleProducts: ['prod_OrbyQz0UFHLQQO'],
                        featureList: [
                            'Save Progress',
                            'Enhanced Experience Personalization',
                        ],
                        defaultSubscription: false,
                        purchasable: false,
                        userOnly: true,
                        studioOnly: false,
                    },
                    {
                        tier: 'PremiumBuildPlay',
                        id: 'ad6df9e1-9137-413a-9914-db81261ffec1',
                        product: 'prod_OrXGgxeKpv94BF',
                        eligibleProducts: ['prod_OrXGgxeKpv94BF'],
                        featureList: [
                            'All Play Features',
                            'Maker Bots',
                            'Core Play Patterns',
                            'Play Pattern Publishing',
                        ],
                        defaultSubscription: false,
                        purchasable: true,
                        userOnly: true,
                        studioOnly: false,
                    },
                    {
                        tier: 'SmallTier',
                        id: '204a5697-2351-49c1-af5d-7d6e49461b7a',
                        product: 'prod_Orrnj0pqlTj02P',
                        eligibleProducts: ['prod_Orrnj0pqlTj02P'],
                        featureList: [
                            'Small Data Limits',
                            'Multiple Collaborators',
                            'Experience Hosting',
                            'Advanced Play Patterns',
                        ],
                        defaultSubscription: false,
                        purchasable: true,
                        userOnly: false,
                        studioOnly: true,
                    },
                    {
                        tier: 'MediumTier',
                        id: 'a5faca0a-26d7-4fbf-986a-7dddf41c5dbd',
                        product: 'prod_Orro9s8Gqqey9Y',
                        eligibleProducts: ['prod_Orro9s8Gqqey9Y'],
                        featureList: [
                            'Medium Data Limits',
                            'Multiple Collaborators',
                            'Experience Hosting',
                            'Experimental Play Patterns',
                        ],
                        defaultSubscription: false,
                        purchasable: true,
                        userOnly: false,
                        studioOnly: true,
                    },
                    {
                        tier: 'LargeTier',
                        id: '651e7640-b7e3-4ef2-9590-517f5cfb377f',
                        product: 'prod_Orrqb0wFsDfUwg',
                        eligibleProducts: ['prod_Orrqb0wFsDfUwg'],
                        featureList: [
                            'Larger Data Limits',
                            'Multiple Collaborators',
                            'Experience Hosting',
                            'Experimental Play Patterns',
                        ],
                        defaultSubscription: false,
                        purchasable: true,
                        userOnly: false,
                        studioOnly: true,
                    },
                    {
                        tier: 'XLTier',
                        id: '45e2d2dc-4f3a-42dd-b509-e2bb9463be96',
                        product: 'prod_OrrsITJLnxo7Po',
                        eligibleProducts: ['prod_OrrsITJLnxo7Po'],
                        featureList: [
                            'Largest Data Limits',
                            'Multiple Collaborators',
                            'Experience Hosting',
                            'Exclusive Play Patterns',
                        ],
                        defaultSubscription: false,
                        purchasable: false,
                        userOnly: false,
                        studioOnly: true,
                    },
                    {
                        tier: 'PublicRecords',
                        id: 'public-3954-4356-ba6d-36ef243d1062',
                        product: 'prod_pubrecnotinstripe',
                        eligibleProducts: ['prod_prod_pubrecnotinstripe'],
                        featureList: [
                            'Public Records',
                            'Used by ABPro',
                            'Internal Use Only',
                        ],
                        defaultSubscription: false,
                        purchasable: false,
                        userOnly: true,
                        studioOnly: false,
                    },
                ],
                tiers: {
                    FreePlay: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 8,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30,
                            },
                            data: {
                                allowed: true,
                                maxItems: 10000,
                                maxReadsPerPeriod: 100000,
                                maxWritesPerPeriod: 100000,
                            },
                            files: {
                                allowed: false,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 100,
                                maxUpdatesPerPeriod: 10000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 32,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 250000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 102400,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 100,
                                },
                            },
                        },
                    },
                    MediumImpactMaker: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 10240,
                                maxBytesPerInst: 50000000,
                                maxActiveConnectionsPerInst: 16,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 1500,
                            },
                            data: {
                                allowed: true,
                                maxItems: 100000,
                                maxReadsPerPeriod: 1000000,
                                maxWritesPerPeriod: 1000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 50000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 2500000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 1000,
                                maxUpdatesPerPeriod: 100000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 320,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 2500000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 1024000,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 1000,
                                },
                                hume: {
                                    allowed: true,
                                },
                                sloyd: {
                                    allowed: true,
                                    maxModelsPerPeriod: 1000,
                                },
                            },
                        },
                    },
                    LargeImpactMaker: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 102400,
                                maxBytesPerInst: 50000000,
                                maxActiveConnectionsPerInst: 32,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30000,
                            },
                            data: {
                                allowed: true,
                                maxItems: 1000000,
                                maxReadsPerPeriod: 10000000,
                                maxWritesPerPeriod: 10000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 5000000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 25000000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 10000,
                                maxUpdatesPerPeriod: 1000000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 3200,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 25000000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 10240000,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 10000,
                                },
                                hume: {
                                    allowed: true,
                                },
                                sloyd: {
                                    allowed: true,
                                    maxModelsPerPeriod: 10000,
                                },
                            },
                        },
                    },
                    PremiumPlay: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 8,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30,
                            },
                            data: {
                                allowed: true,
                                maxItems: 10000,
                                maxReadsPerPeriod: 100000,
                                maxWritesPerPeriod: 100000,
                            },
                            files: {
                                allowed: false,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 100,
                                maxUpdatesPerPeriod: 10000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 32,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 250000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 102400,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 100,
                                },
                            },
                        },
                    },
                    PremiumBuildPlay: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 8,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30,
                            },
                            data: {
                                allowed: true,
                                maxItems: 10000,
                                maxReadsPerPeriod: 100000,
                                maxWritesPerPeriod: 100000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 1000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 50000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 100,
                                maxUpdatesPerPeriod: 10000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 32,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 250000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 102400,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 100,
                                },
                                hume: {
                                    allowed: true,
                                },
                                sloyd: {
                                    allowed: true,
                                    maxModelsPerPeriod: 100,
                                },
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 1,
                                maxRunsPerHour: 100,
                            },
                        },
                    },
                    SmallTier: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 8,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30,
                            },
                            data: {
                                allowed: true,
                                maxItems: 10000,
                                maxReadsPerPeriod: 100000,
                                maxWritesPerPeriod: 100000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 1000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 50000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 100,
                                maxUpdatesPerPeriod: 10000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 32,
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
                                    allowed: true,
                                },
                            },
                            loom: {
                                allowed: true,
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 5,
                                maxRunsPerHour: 100,
                            },
                            notifications: {
                                allowed: true,
                                maxItems: 100,
                                maxSubscribersPerItem: 50,
                                maxSentNotificationsPerPeriod: 1000,
                                maxSentPushNotificationsPerPeriod: 500,
                            },
                        },
                    },
                    MediumTier: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 16,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 150,
                            },
                            data: {
                                allowed: true,
                                maxItems: 50000,
                                maxReadsPerPeriod: 500000,
                                maxWritesPerPeriod: 500000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 5000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 250000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 500,
                                maxUpdatesPerPeriod: 50000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 160,
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
                                    allowed: true,
                                },
                            },
                            loom: {
                                allowed: true,
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 15,
                                maxRunsPerHour: 200,
                            },
                            notifications: {
                                allowed: true,
                                maxItems: 1000,
                                maxSubscribersPerItem: 500,
                                maxSentNotificationsPerPeriod: 10000,
                                maxSentPushNotificationsPerPeriod: 5000,
                            },
                        },
                    },
                    LargeTier: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 32,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 300,
                            },
                            data: {
                                allowed: true,
                                maxItems: 100000,
                                maxReadsPerPeriod: 1000000,
                                maxWritesPerPeriod: 1000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 10000,
                                maxBytesPerFile: 200000000,
                                maxBytesTotal: 500000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 1000,
                                maxUpdatesPerPeriod: 100000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 320,
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
                                    allowed: true,
                                },
                            },
                            comId: {
                                allowed: true,
                            },
                            loom: {
                                allowed: true,
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 50,
                                maxRunsPerHour: 1000,
                            },
                            notifications: {
                                allowed: true,
                                maxItems: 10000,
                                maxSubscribersPerItem: 5000,
                                maxSentNotificationsPerPeriod: 100000,
                                maxSentPushNotificationsPerPeriod: 50000,
                            },
                        },
                    },
                    XLTier: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 32,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 3000,
                            },
                            data: {
                                allowed: true,
                                maxItems: 1000000,
                                maxReadsPerPeriod: 10000000,
                                maxWritesPerPeriod: 10000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 100000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 5000000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 10000,
                                maxUpdatesPerPeriod: 1000000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 3200,
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
                                    allowed: true,
                                },
                            },
                            loom: {
                                allowed: true,
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 50,
                                maxRunsPerHour: 1500,
                            },
                        },
                    },
                    PublicRecords: {
                        features: {
                            insts: {
                                allowed: false,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 1000000000,
                            },
                            data: {
                                allowed: true,
                                maxItems: 1000000000,
                                maxReadsPerPeriod: 10000000000,
                                maxWritesPerPeriod: 10000000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 1000000000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 5000000000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 1000000000,
                                maxUpdatesPerPeriod: 1000000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 3200,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 250000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 102400,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 100,
                                },
                                sloyd: {
                                    allowed: true,
                                },
                            },
                            loom: {
                                allowed: true,
                            },
                        },
                    },
                },
                defaultFeatures: {
                    user: {
                        insts: {
                            allowed: false,
                        },
                        records: {
                            allowed: false,
                        },
                        data: {
                            allowed: false,
                        },
                        files: {
                            allowed: false,
                        },
                        events: {
                            allowed: false,
                        },
                        policies: {
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
                        },
                    },
                    studio: {
                        insts: {
                            allowed: false,
                        },
                        records: {
                            allowed: false,
                        },
                        data: {
                            allowed: false,
                        },
                        files: {
                            allowed: false,
                        },
                        events: {
                            allowed: false,
                        },
                        policies: {
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
                        },
                    },
                    defaultPeriodLength: {
                        months: 1,
                    },
                },
                checkoutConfig: {
                    allow_promotion_codes: true,
                },
                webhookSecret: 'we-dont-need-this-now',
                successUrl: 'https://example.com/',
                cancelUrl: 'https://example.com/',
                returnUrl: 'https://example.com/',
            },
            rateLimit: {
                maxHits: 5000,
                windowMs: 60000,
            },
            notifications: {
                slack: {
                    webhookUrl: 'https://slack.webhook.example.com',
                },
                telegram: {
                    chatId: 1,
                    token: 'telegram-token',
                },
            },
            moderation: {
                allowUnauthenticatedReports: true,
            },
            telemetry: {
                tracing: {
                    exporter: 'otlp',
                    url: 'https://traces.oltp.example.com',
                    headers: {
                        Authorization: 'Basic Token',
                    },
                },
                metrics: {
                    exporter: 'otlp',
                    url: 'https://metrics.oltp.example.com',
                    headers: {
                        Authorization: 'Basic Token',
                    },
                },
                resource: {
                    'service.name': 'casualos',
                },
            },
            webhooks: {
                environment: {
                    type: 'lambda',
                },
            },
            meta: {
                apiOrigin: 'https://api.example.com',
            },
            webPush: {
                vapidSubject: 'mailto:no-reply@example.com',
                vapidPublicKey: 'public-key',
                vapidPrivateKey: 'private-key',
            },
        };

        const result = serverConfigSchema.safeParse(config);

        expect(result.success).toBe(true);
        expect(result).toMatchSnapshot();
    });

    it('should be able to support custom AI chat providers', () => {
        const config: any = {
            redis: {
                host: 'redis-host.example.com',
                port: 11123,
                tls: false,
                password: 'redis-password',
                rateLimitPrefix: '/rate-limit',
                websocketConnectionNamespace: '/connections',
                instRecordsStoreNamespace: '/insts',
                tempInstRecordsStoreNamespace: '/tempInsts',
                cacheNamespace: '/cache',
            },
            prisma: {
                configurationCacheSeconds: 86400,
                options: {
                    datasources: {
                        db: {
                            url: 'postgresql://cocroach-host:26257/database?sslmode=verify-full',
                        },
                    },
                },
            },
            livekit: {
                endpoint: 'wss://webrtc.example.com:443',
                apiKey: 'api-key',
                secretKey: 'secret-key',
            },
            webauthn: {
                relyingParties: [
                    {
                        id: 'auth.example.com',
                        name: 'Auth CasualOS',
                        origin: 'https://auth.example.com',
                    },
                    {
                        id: 'example.com',
                        name: 'CasualOS',
                        origin: 'https://example.com',
                    },
                ],
            },
            stripe: {
                secretKey: 'stripe-secret-key',
                publishableKey: 'stripe-publishable-key',
            },
            humeai: {
                apiKey: 'hume-api-key',
                secretKey: 'hume-secret-key',
            },
            openai: {
                apiKey: 'openai-api-key',
            },
            googleai: {
                apiKey: 'google-api-key',
            },
            anthropicai: {
                apiKey: 'anthropic-api-key',
            },
            blockadeLabs: {
                apiKey: 'blockadeLabs-api-key',
            },
            stabilityai: {
                apiKey: 'stabilityai-api-key',
            },
            sloydai: {
                clientId: 'slodai-client-id',
                clientSecret: 'sloydai-client-secret',
            },
            ai: {
                chat: {
                    provider: 'openai',
                    defaultModel: 'gpt-3.5-turbo',
                    allowedModels: [
                        'o1-preview',
                        'o1-mini',
                        'gpt-3.5-turbo',
                        'gpt-4',
                        'gpt-4o',
                        'gpt-4-1106-preview',
                        'gpt-4-vision-preview',
                        {
                            provider: 'google',
                            model: 'gemini-pro',
                        },
                        {
                            provider: 'google',
                            model: 'gemini-1.5-pro',
                        },
                        {
                            provider: 'anthropic',
                            model: 'claude-3-5-sonnet-20240620',
                        },
                        {
                            provider: 'anthropic',
                            model: 'claude-3-5-sonnet-20241022',
                        },
                        {
                            provider: 'anthropic',
                            model: 'claude-3-5-sonnet-latest',
                        },
                        {
                            provider: 'custom-openai-completions',
                            name: 'example',
                            apiKey: 'test',
                            baseUrl: 'https://api.example.com/v1/',
                            models: ['custom-model-1', 'custom-model-2'],
                        },
                    ],
                    allowedSubscriptionTiers: true,
                },
                generateSkybox: {
                    provider: 'blockadeLabs',
                    allowedSubscriptionTiers: true,
                },
                images: {
                    defaultModel: 'dall-e-2',
                    defaultWidth: 512,
                    defaultHeight: 512,
                    maxWidth: 1024,
                    maxHeight: 1024,
                    maxSteps: 50,
                    maxImages: 3,
                    allowedModels: {
                        openai: ['dall-e-2', 'dall-e-3'],
                        stabilityai: [
                            'stable-diffusion-xl-1024-v1-0',
                            'stable-diffusion-v1-6',
                            'stable-image-ultra',
                            'stable-image-core',
                            'sd3-medium',
                            'sd3-large',
                            'sd3-large-turbo',
                        ],
                    },
                    allowedSubscriptionTiers: true,
                },
            },
            ses: {
                content: {
                    type: 'plain',
                    subject: 'casualos login code',
                    body: 'Your casualos login code is: {{code}}',
                },
                fromAddress: 'casualos-noreply@example.com',
            },
            subscriptions: {
                subscriptions: [
                    {
                        id: 'default-6dcf-42b3-89a0-e6594278a53d',
                        featureList: [
                            'Save Progress',
                            'Experience Personalization',
                        ],
                        name: 'Free Play',
                        description:
                            'Play Personalized 3D Experiences from your Favorite Brands for FREE',
                        defaultSubscription: true,
                        tier: 'FreePlay',
                        userOnly: true,
                    },
                    {
                        id: 'MediumImpactMaker-6dcf-42b3-89a0-e6594278a53d',
                        featureList: [
                            'Save Progress',
                            'Enhanced Experience Personalization',
                        ],
                        name: 'Medium Impact Maker',
                        description:
                            'Play Personalized 3D Experiences from your Favorite Brands for FREE',
                        defaultSubscription: false,
                        purchasable: false,
                        tier: 'MediumImpactMaker',
                        userOnly: true,
                    },
                    {
                        id: 'LargeImpactMaker-6dcf-42b3-89a0-e6594278a53d',
                        featureList: [
                            'Save Progress',
                            'Enhanced Experience Personalization',
                        ],
                        name: 'Large Impact Maker',
                        description:
                            'Play Personalized 3D Experiences from your Favorite Brands for FREE',
                        defaultSubscription: false,
                        purchasable: false,
                        tier: 'LargeImpactMaker',
                        userOnly: true,
                    },
                    {
                        tier: 'PremiumPlay',
                        id: 'f4850284-f962-4fe6-a1e9-eacaf39a67e7',
                        product: 'prod_OrbyQz0UFHLQQO',
                        eligibleProducts: ['prod_OrbyQz0UFHLQQO'],
                        featureList: [
                            'Save Progress',
                            'Enhanced Experience Personalization',
                        ],
                        defaultSubscription: false,
                        purchasable: false,
                        userOnly: true,
                        studioOnly: false,
                    },
                    {
                        tier: 'PremiumBuildPlay',
                        id: 'ad6df9e1-9137-413a-9914-db81261ffec1',
                        product: 'prod_OrXGgxeKpv94BF',
                        eligibleProducts: ['prod_OrXGgxeKpv94BF'],
                        featureList: [
                            'All Play Features',
                            'Maker Bots',
                            'Core Play Patterns',
                            'Play Pattern Publishing',
                        ],
                        defaultSubscription: false,
                        purchasable: true,
                        userOnly: true,
                        studioOnly: false,
                    },
                    {
                        tier: 'SmallTier',
                        id: '204a5697-2351-49c1-af5d-7d6e49461b7a',
                        product: 'prod_Orrnj0pqlTj02P',
                        eligibleProducts: ['prod_Orrnj0pqlTj02P'],
                        featureList: [
                            'Small Data Limits',
                            'Multiple Collaborators',
                            'Experience Hosting',
                            'Advanced Play Patterns',
                        ],
                        defaultSubscription: false,
                        purchasable: true,
                        userOnly: false,
                        studioOnly: true,
                    },
                    {
                        tier: 'MediumTier',
                        id: 'a5faca0a-26d7-4fbf-986a-7dddf41c5dbd',
                        product: 'prod_Orro9s8Gqqey9Y',
                        eligibleProducts: ['prod_Orro9s8Gqqey9Y'],
                        featureList: [
                            'Medium Data Limits',
                            'Multiple Collaborators',
                            'Experience Hosting',
                            'Experimental Play Patterns',
                        ],
                        defaultSubscription: false,
                        purchasable: true,
                        userOnly: false,
                        studioOnly: true,
                    },
                    {
                        tier: 'LargeTier',
                        id: '651e7640-b7e3-4ef2-9590-517f5cfb377f',
                        product: 'prod_Orrqb0wFsDfUwg',
                        eligibleProducts: ['prod_Orrqb0wFsDfUwg'],
                        featureList: [
                            'Larger Data Limits',
                            'Multiple Collaborators',
                            'Experience Hosting',
                            'Experimental Play Patterns',
                        ],
                        defaultSubscription: false,
                        purchasable: true,
                        userOnly: false,
                        studioOnly: true,
                    },
                    {
                        tier: 'XLTier',
                        id: '45e2d2dc-4f3a-42dd-b509-e2bb9463be96',
                        product: 'prod_OrrsITJLnxo7Po',
                        eligibleProducts: ['prod_OrrsITJLnxo7Po'],
                        featureList: [
                            'Largest Data Limits',
                            'Multiple Collaborators',
                            'Experience Hosting',
                            'Exclusive Play Patterns',
                        ],
                        defaultSubscription: false,
                        purchasable: false,
                        userOnly: false,
                        studioOnly: true,
                    },
                    {
                        tier: 'PublicRecords',
                        id: 'public-3954-4356-ba6d-36ef243d1062',
                        product: 'prod_pubrecnotinstripe',
                        eligibleProducts: ['prod_prod_pubrecnotinstripe'],
                        featureList: [
                            'Public Records',
                            'Used by ABPro',
                            'Internal Use Only',
                        ],
                        defaultSubscription: false,
                        purchasable: false,
                        userOnly: true,
                        studioOnly: false,
                    },
                ],
                tiers: {
                    FreePlay: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 8,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30,
                            },
                            data: {
                                allowed: true,
                                maxItems: 10000,
                                maxReadsPerPeriod: 100000,
                                maxWritesPerPeriod: 100000,
                            },
                            files: {
                                allowed: false,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 100,
                                maxUpdatesPerPeriod: 10000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 32,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 250000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 102400,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 100,
                                },
                            },
                        },
                    },
                    MediumImpactMaker: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 10240,
                                maxBytesPerInst: 50000000,
                                maxActiveConnectionsPerInst: 16,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 1500,
                            },
                            data: {
                                allowed: true,
                                maxItems: 100000,
                                maxReadsPerPeriod: 1000000,
                                maxWritesPerPeriod: 1000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 50000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 2500000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 1000,
                                maxUpdatesPerPeriod: 100000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 320,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 2500000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 1024000,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 1000,
                                },
                                hume: {
                                    allowed: true,
                                },
                                sloyd: {
                                    allowed: true,
                                    maxModelsPerPeriod: 1000,
                                },
                            },
                        },
                    },
                    LargeImpactMaker: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 102400,
                                maxBytesPerInst: 50000000,
                                maxActiveConnectionsPerInst: 32,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30000,
                            },
                            data: {
                                allowed: true,
                                maxItems: 1000000,
                                maxReadsPerPeriod: 10000000,
                                maxWritesPerPeriod: 10000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 5000000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 25000000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 10000,
                                maxUpdatesPerPeriod: 1000000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 3200,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 25000000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 10240000,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 10000,
                                },
                                hume: {
                                    allowed: true,
                                },
                                sloyd: {
                                    allowed: true,
                                    maxModelsPerPeriod: 10000,
                                },
                            },
                        },
                    },
                    PremiumPlay: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 8,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30,
                            },
                            data: {
                                allowed: true,
                                maxItems: 10000,
                                maxReadsPerPeriod: 100000,
                                maxWritesPerPeriod: 100000,
                            },
                            files: {
                                allowed: false,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 100,
                                maxUpdatesPerPeriod: 10000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 32,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 250000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 102400,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 100,
                                },
                            },
                        },
                    },
                    PremiumBuildPlay: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 8,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30,
                            },
                            data: {
                                allowed: true,
                                maxItems: 10000,
                                maxReadsPerPeriod: 100000,
                                maxWritesPerPeriod: 100000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 1000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 50000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 100,
                                maxUpdatesPerPeriod: 10000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 32,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 250000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 102400,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 100,
                                },
                                hume: {
                                    allowed: true,
                                },
                                sloyd: {
                                    allowed: true,
                                    maxModelsPerPeriod: 100,
                                },
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 1,
                                maxRunsPerHour: 100,
                            },
                        },
                    },
                    SmallTier: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 8,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 30,
                            },
                            data: {
                                allowed: true,
                                maxItems: 10000,
                                maxReadsPerPeriod: 100000,
                                maxWritesPerPeriod: 100000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 1000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 50000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 100,
                                maxUpdatesPerPeriod: 10000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 32,
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
                                    allowed: true,
                                },
                            },
                            loom: {
                                allowed: true,
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 5,
                                maxRunsPerHour: 100,
                            },
                            notifications: {
                                allowed: true,
                                maxItems: 100,
                                maxSubscribersPerItem: 50,
                                maxSentNotificationsPerPeriod: 1000,
                                maxSentPushNotificationsPerPeriod: 500,
                            },
                        },
                    },
                    MediumTier: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 16,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 150,
                            },
                            data: {
                                allowed: true,
                                maxItems: 50000,
                                maxReadsPerPeriod: 500000,
                                maxWritesPerPeriod: 500000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 5000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 250000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 500,
                                maxUpdatesPerPeriod: 50000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 160,
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
                                    allowed: true,
                                },
                            },
                            loom: {
                                allowed: true,
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 15,
                                maxRunsPerHour: 200,
                            },
                            notifications: {
                                allowed: true,
                                maxItems: 1000,
                                maxSubscribersPerItem: 500,
                                maxSentNotificationsPerPeriod: 10000,
                                maxSentPushNotificationsPerPeriod: 5000,
                            },
                        },
                    },
                    LargeTier: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 32,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 300,
                            },
                            data: {
                                allowed: true,
                                maxItems: 100000,
                                maxReadsPerPeriod: 1000000,
                                maxWritesPerPeriod: 1000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 10000,
                                maxBytesPerFile: 200000000,
                                maxBytesTotal: 500000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 1000,
                                maxUpdatesPerPeriod: 100000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 320,
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
                                    allowed: true,
                                },
                            },
                            comId: {
                                allowed: true,
                            },
                            loom: {
                                allowed: true,
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 50,
                                maxRunsPerHour: 1000,
                            },
                            notifications: {
                                allowed: true,
                                maxItems: 10000,
                                maxSubscribersPerItem: 5000,
                                maxSentNotificationsPerPeriod: 100000,
                                maxSentPushNotificationsPerPeriod: 50000,
                            },
                        },
                    },
                    XLTier: {
                        features: {
                            insts: {
                                allowed: true,
                                maxInsts: 1024,
                                maxBytesPerInst: 25000000,
                                maxActiveConnectionsPerInst: 32,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 3000,
                            },
                            data: {
                                allowed: true,
                                maxItems: 1000000,
                                maxReadsPerPeriod: 10000000,
                                maxWritesPerPeriod: 10000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 100000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 5000000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 10000,
                                maxUpdatesPerPeriod: 1000000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 3200,
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
                                    allowed: true,
                                },
                            },
                            loom: {
                                allowed: true,
                            },
                            webhooks: {
                                allowed: true,
                                initTimeoutMs: 100000,
                                maxItems: 50,
                                maxRunsPerHour: 1500,
                            },
                        },
                    },
                    PublicRecords: {
                        features: {
                            insts: {
                                allowed: false,
                            },
                            records: {
                                allowed: true,
                                maxRecords: 1000000000,
                            },
                            data: {
                                allowed: true,
                                maxItems: 1000000000,
                                maxReadsPerPeriod: 10000000000,
                                maxWritesPerPeriod: 10000000000,
                            },
                            files: {
                                allowed: true,
                                maxFiles: 1000000000,
                                maxBytesPerFile: 50000000,
                                maxBytesTotal: 5000000000000000,
                            },
                            events: {
                                allowed: true,
                                maxEvents: 1000000000,
                                maxUpdatesPerPeriod: 1000000,
                            },
                            policies: {
                                allowed: true,
                                maxPolicies: 3200,
                            },
                            ai: {
                                chat: {
                                    allowed: true,
                                    maxTokensPerPeriod: 250000,
                                },
                                images: {
                                    allowed: true,
                                    maxSquarePixelsPerPeriod: 102400,
                                },
                                skyboxes: {
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 100,
                                },
                                sloyd: {
                                    allowed: true,
                                },
                            },
                            loom: {
                                allowed: true,
                            },
                        },
                    },
                },
                defaultFeatures: {
                    user: {
                        insts: {
                            allowed: false,
                        },
                        records: {
                            allowed: false,
                        },
                        data: {
                            allowed: false,
                        },
                        files: {
                            allowed: false,
                        },
                        events: {
                            allowed: false,
                        },
                        policies: {
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
                        },
                    },
                    studio: {
                        insts: {
                            allowed: false,
                        },
                        records: {
                            allowed: false,
                        },
                        data: {
                            allowed: false,
                        },
                        files: {
                            allowed: false,
                        },
                        events: {
                            allowed: false,
                        },
                        policies: {
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
                        },
                    },
                    defaultPeriodLength: {
                        months: 1,
                    },
                },
                checkoutConfig: {
                    allow_promotion_codes: true,
                },
                webhookSecret: 'we-dont-need-this-now',
                successUrl: 'https://example.com/',
                cancelUrl: 'https://example.com/',
                returnUrl: 'https://example.com/',
            },
            rateLimit: {
                maxHits: 5000,
                windowMs: 60000,
            },
            notifications: {
                slack: {
                    webhookUrl: 'https://slack.webhook.example.com',
                },
                telegram: {
                    chatId: 1,
                    token: 'telegram-token',
                },
            },
            moderation: {
                allowUnauthenticatedReports: true,
            },
            telemetry: {
                tracing: {
                    exporter: 'otlp',
                    url: 'https://traces.oltp.example.com',
                    headers: {
                        Authorization: 'Basic Token',
                    },
                },
                metrics: {
                    exporter: 'otlp',
                    url: 'https://metrics.oltp.example.com',
                    headers: {
                        Authorization: 'Basic Token',
                    },
                },
                resource: {
                    'service.name': 'casualos',
                },
            },
            webhooks: {
                environment: {
                    type: 'lambda',
                },
            },
            meta: {
                apiOrigin: 'https://api.example.com',
            },
            webPush: {
                vapidSubject: 'mailto:no-reply@example.com',
                vapidPublicKey: 'public-key',
                vapidPrivateKey: 'private-key',
            },
        };

        const result = serverConfigSchema.safeParse(config);

        expect(result.success).toBe(true);
        expect(result).toMatchSnapshot();
    });

    it('should be able to generate schema metadata', () => {
        const meta = getSchemaMetadata(serverConfigSchema);
        expect(meta).toBeTruthy();
    });
});
