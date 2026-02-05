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
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIChatInterfaceStreamResponse,
} from './AIChatInterface';
import type {
    AIGenerateSkyboxInterfaceResponse,
    AIGenerateSkyboxInterfaceRequest,
    AIGetSkyboxInterfaceResponse,
} from './AIGenerateSkyboxInterface';
import type {
    AIGenerateImageInterfaceRequest,
    AIGenerateImageInterfaceResponse,
} from './AIImageInterface';
import { AIController } from './AIController';
import type { MemoryStore } from './MemoryStore';
import {
    asyncIterable,
    checkAccounts,
    createTestControllers,
    unwindAndCaptureAsync,
} from './TestUtils';

import type { AIHumeInterfaceGetAccessTokenResult } from './AIHumeInterface';
import type {
    AISloydInterfaceCreateModelRequest,
    AISloydInterfaceCreateModelResponse,
    AISloydInterfaceEditModelRequest,
    AISloydInterfaceEditModelResponse,
} from './AISloydInterface';
import type { PolicyController } from './PolicyController';
import {
    failure,
    PUBLIC_READ_MARKER,
    success,
    unwrap,
} from '@casual-simulation/aux-common';
import { fromByteArray } from 'base64-js';
import { buildSubscriptionConfig } from './SubscriptionConfigBuilder';
import type { AIOpenAIRealtimeInterface } from './AIOpenAIRealtimeInterface';
import type { FinancialController, FinancialInterface } from './financial';
import {
    ACCOUNT_IDS,
    CurrencyCodes,
    LEDGERS,
    TransferCodes,
} from './financial';
import type { Account } from 'tigerbeetle-node';

console.log = jest.fn();
console.warn = jest.fn();

describe('AIController', () => {
    let controller: AIController;
    let chatInterface: {
        chat: jest.Mock<
            Promise<AIChatInterfaceResponse>,
            [AIChatInterfaceRequest]
        >;
        chatStream: jest.Mock<
            AsyncIterable<AIChatInterfaceStreamResponse>,
            [AIChatInterfaceRequest]
        >;
    };
    let chatInterface2: {
        chat: jest.Mock<
            Promise<AIChatInterfaceResponse>,
            [AIChatInterfaceRequest]
        >;
        chatStream: jest.Mock<
            AsyncIterable<AIChatInterfaceStreamResponse>,
            [AIChatInterfaceRequest]
        >;
    };
    let generateSkyboxInterface: {
        generateSkybox: jest.Mock<
            Promise<AIGenerateSkyboxInterfaceResponse>,
            [AIGenerateSkyboxInterfaceRequest]
        >;
        getSkybox: jest.Mock<Promise<AIGetSkyboxInterfaceResponse>, [string]>;
    };
    let generateImageInterface: {
        generateImage: jest.Mock<
            Promise<AIGenerateImageInterfaceResponse>,
            [AIGenerateImageInterfaceRequest]
        >;
    };
    let humeInterface: {
        getAccessToken: jest.Mock<
            Promise<AIHumeInterfaceGetAccessTokenResult>,
            []
        >;
    };
    let sloydInterface: {
        createModel: jest.Mock<
            Promise<AISloydInterfaceCreateModelResponse>,
            [AISloydInterfaceCreateModelRequest]
        >;
        editModel: jest.Mock<
            Promise<AISloydInterfaceEditModelResponse>,
            [AISloydInterfaceEditModelRequest]
        >;
    };
    let realtimeInterface: jest.Mocked<AIOpenAIRealtimeInterface>;
    let userId: string;
    let userSubscriptionTier: string;
    let store: MemoryStore;
    let policies: PolicyController;
    let financial: FinancialController;
    let financialInterface: FinancialInterface;

    beforeEach(() => {
        userId = 'test-user';
        userSubscriptionTier = 'test-tier';
        chatInterface = {
            chat: jest.fn(),
            chatStream: jest.fn(),
        };
        chatInterface2 = {
            chat: jest.fn(),
            chatStream: jest.fn(),
        };
        generateSkyboxInterface = {
            generateSkybox: jest.fn(),
            getSkybox: jest.fn(),
        };
        generateImageInterface = {
            generateImage: jest.fn(),
        };
        humeInterface = {
            getAccessToken: jest.fn(),
        };
        sloydInterface = {
            createModel: jest.fn(),
            editModel: jest.fn(),
        };
        realtimeInterface = {
            createRealtimeSessionToken: jest.fn(),
        };

        const services = createTestControllers(null);
        store = services.store;
        policies = services.policies;
        financial = services.financialController;
        financialInterface = services.financialInterface;

        controller = new AIController({
            chat: {
                interfaces: {
                    provider1: chatInterface,
                    provider2: chatInterface2,
                },
                options: {
                    defaultModel: 'default-model',
                    defaultModelProvider: 'provider1',
                    allowedChatModels: [
                        {
                            provider: 'provider1',
                            model: 'test-model1',
                        },
                        {
                            provider: 'provider1',
                            model: 'test-model2',
                        },
                        {
                            provider: 'provider2',
                            model: 'test-model3',
                        },
                        {
                            provider: 'provider1',
                            model: 'test-model-token-ratio',
                        },
                    ],
                    allowedChatSubscriptionTiers: ['test-tier'],
                    tokenModifierRatio: { 'test-model-token-ratio': 2.0 },
                },
            },
            generateSkybox: {
                interface: generateSkyboxInterface,
                options: {
                    allowedSubscriptionTiers: ['test-tier'],
                },
            },
            images: {
                interfaces: {
                    openai: generateImageInterface,
                },
                options: {
                    defaultModel: 'openai',
                    defaultWidth: 512,
                    defaultHeight: 512,
                    maxWidth: 1024,
                    maxHeight: 1024,
                    maxSteps: 50,
                    maxImages: 3,
                    allowedModels: {
                        openai: ['openai'],
                        stabilityai: ['stable-diffusion-xl-1024-v1-0'],
                    },
                    allowedSubscriptionTiers: ['test-tier'],
                },
            },
            hume: {
                interface: humeInterface,
                config: {
                    apiKey: 'apiKey',
                    secretKey: 'secretKey',
                },
            },
            sloyd: {
                interface: sloydInterface,
            },
            openai: {
                realtime: {
                    interface: realtimeInterface,
                },
            },
            metrics: store,
            config: store,
            policies: null,
            policyController: policies,
            records: store,
        });
    });

    describe('chat()', () => {
        it('should return the result from the chat interface', async () => {
            chatInterface.chat.mockReturnValueOnce(
                Promise.resolve({
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                    totalTokens: 1,
                })
            );

            const result = await controller.chat({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: true,
                choices: [
                    {
                        role: 'user',
                        content: 'test',
                        finishReason: 'stop',
                    },
                ],
            });
            expect(chatInterface.chat).toHaveBeenCalledWith({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });
        });

        it('should support using another provider based on the chosen model', async () => {
            chatInterface2.chat.mockReturnValueOnce(
                Promise.resolve({
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                    totalTokens: 1,
                })
            );

            const result = await controller.chat({
                model: 'test-model3',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: true,
                choices: [
                    {
                        role: 'user',
                        content: 'test',
                        finishReason: 'stop',
                    },
                ],
            });
            expect(chatInterface2.chat).toHaveBeenCalledWith({
                model: 'test-model3',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });
        });

        it('should use the default model if none is specified', async () => {
            chatInterface.chat.mockReturnValueOnce(
                Promise.resolve({
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                    totalTokens: 1,
                })
            );

            const result = await controller.chat({
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: true,
                choices: [
                    {
                        role: 'user',
                        content: 'test',
                        finishReason: 'stop',
                    },
                ],
            });
            expect(chatInterface.chat).toHaveBeenCalledWith({
                model: 'default-model',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });
        });

        it('should return an invalid_model result if the given model is not allowed', async () => {
            const result = await controller.chat({
                model: 'wrong-model',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_model',
                errorMessage: 'The given model is not allowed for chats.',
            });
            expect(chatInterface.chat).not.toHaveBeenCalled();
        });

        it('should return an not_logged_in result if the given a null userId', async () => {
            const result = await controller.chat({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: null as any,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in. Please provide a sessionKey or a recordKey.',
            });
            expect(chatInterface.chat).not.toHaveBeenCalled();
        });

        it('should return an not_subscribed result if the given a null userSubscriptionTier', async () => {
            const result = await controller.chat({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_subscribed',
                errorMessage:
                    'The user must be subscribed in order to use this operation.',
                allowedSubscriptionTiers: ['test-tier'],
            });
            expect(chatInterface.chat).not.toHaveBeenCalled();
        });

        it('should return an invalid_subscription_tier result if the given a subscription tier that is not allowed', async () => {
            const result = await controller.chat({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier: 'wrong-tier',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_subscription_tier',
                errorMessage:
                    'This operation is not available to the user at their current subscription tier.',
                currentSubscriptionTier: 'wrong-tier',
                allowedSubscriptionTiers: ['test-tier'],
            });
            expect(chatInterface.chat).not.toHaveBeenCalled();
        });

        it('should work when the controller is configured to allow all subscription tiers and the user does not have a subscription', async () => {
            chatInterface.chat.mockReturnValueOnce(
                Promise.resolve({
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                    totalTokens: 1,
                })
            );

            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                    },
                    options: {
                        defaultModel: 'default-model',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: true,
                        tokenModifierRatio: { default: 1.0 },
                    },
                },
                generateSkybox: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                openai: null,
                policies: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.chat({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: true,
                choices: [
                    {
                        role: 'user',
                        content: 'test',
                        finishReason: 'stop',
                    },
                ],
            });
            expect(chatInterface.chat).toHaveBeenCalledWith({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });
        });

        it('should return a not_supported result if no chat configuration is provided', async () => {
            controller = new AIController({
                chat: null,
                generateSkybox: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                policies: null,
                openai: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.chat({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });

        it('should track metrics for chat operations', async () => {
            chatInterface.chat.mockReturnValueOnce(
                Promise.resolve({
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                    totalTokens: 123,
                })
            );

            const result = await controller.chat({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: true,
                choices: [
                    {
                        role: 'user',
                        content: 'test',
                        finishReason: 'stop',
                    },
                ],
            });
            expect(chatInterface.chat).toHaveBeenCalledWith({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });

            const metrics = await store.getSubscriptionAiChatMetrics({
                ownerId: userId,
            });

            expect(metrics).toMatchObject({
                ownerId: userId,
                subscriptionStatus: null,
                subscriptionId: null,
                subscriptionType: 'user',
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalTokensInCurrentPeriod: 123,
            });
        });

        it('should use the configured token ratio', async () => {
            chatInterface.chat.mockReturnValueOnce(
                Promise.resolve({
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                    totalTokens: 123,
                })
            );

            const result = await controller.chat({
                model: 'test-model-token-ratio',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: true,
                choices: [
                    {
                        role: 'user',
                        content: 'test',
                        finishReason: 'stop',
                    },
                ],
            });
            expect(chatInterface.chat).toHaveBeenCalledWith({
                model: 'test-model-token-ratio',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });

            const metrics = await store.getSubscriptionAiChatMetrics({
                ownerId: userId,
            });

            expect(metrics).toMatchObject({
                ownerId: userId,
                subscriptionStatus: null,
                subscriptionId: null,
                subscriptionType: 'user',
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalTokensInCurrentPeriod: 246,
            });
        });

        describe('subscriptions', () => {
            beforeEach(async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: true,
                                    maxTokensPerPeriod: 100,
                                    maxTokensPerRequest: 75,
                                })
                        )
                );

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });
            });

            it('should return success when allowedModels is not specified', async () => {
                chatInterface.chat.mockReturnValueOnce(
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 1,
                    })
                );

                const result = await controller.chat({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                });

                expect(result).toEqual({
                    success: true,
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                });
                expect(chatInterface.chat).toHaveBeenCalled();
            });

            it('should return not_authorized when allowedModels does not include the model', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: true,
                                    allowedModels: [
                                        'test-model1',
                                        'test-model2',
                                    ],
                                })
                        )
                );

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                const result = await controller.chat({
                    model: 'test-model3',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit the given model for AI Chat features.',
                });
                expect(chatInterface.chat).not.toHaveBeenCalled();
            });

            it('should return success when allowedModels includes the model', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: true,
                                    allowedModels: [
                                        'test-model1',
                                        'test-model2',
                                    ],
                                })
                        )
                );

                chatInterface.chat.mockReturnValueOnce(
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 1,
                    })
                );

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                const result = await controller.chat({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                });

                expect(result).toEqual({
                    success: true,
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                });
                expect(chatInterface.chat).toHaveBeenCalled();
            });

            it('should specify the maximum number of tokens allowed based on how many tokens the subscription has left in the period', async () => {
                chatInterface.chat.mockReturnValueOnce(
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 25,
                    })
                );

                await store.recordChatMetrics({
                    userId: userId,
                    createdAtMs: Date.now(),
                    tokens: 50,
                });

                const result = await controller.chat({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                });

                expect(result).toEqual({
                    success: true,
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                });
                expect(chatInterface.chat).toHaveBeenCalledWith({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId: 'test-user',
                    maxTokens: 50,
                });

                const metrics = await store.getSubscriptionAiChatMetrics({
                    ownerId: userId,
                });

                expect(metrics).toEqual({
                    ownerId: userId,
                    subscriptionStatus: 'active',
                    subscriptionId: 'sub1',
                    subscriptionType: 'user',
                    totalTokensInCurrentPeriod: 75,
                });
            });

            it('should specify the maximum number of tokens allowed based on the maximum number of tokens per request', async () => {
                chatInterface.chat.mockReturnValueOnce(
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 25,
                    })
                );

                await store.recordChatMetrics({
                    userId: userId,
                    createdAtMs: Date.now(),
                    tokens: 10,
                });

                const result = await controller.chat({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                });

                expect(result).toEqual({
                    success: true,
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                });
                expect(chatInterface.chat).toHaveBeenCalledWith({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId: 'test-user',
                    maxTokens: 75,
                });

                const metrics = await store.getSubscriptionAiChatMetrics({
                    ownerId: userId,
                });

                expect(metrics).toEqual({
                    ownerId: userId,
                    subscriptionStatus: 'active',
                    subscriptionId: 'sub1',
                    subscriptionType: 'user',
                    totalTokensInCurrentPeriod: 35,
                });
            });

            it('should deny the request if the user has run out of available tokens in the period', async () => {
                chatInterface.chat.mockReturnValueOnce(
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 123,
                    })
                );

                await store.recordChatMetrics({
                    userId: userId,
                    createdAtMs: Date.now(),
                    tokens: 100,
                });

                const result = await controller.chat({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The user has reached their limit for the current subscription period.',
                });
                expect(chatInterface.chat).not.toHaveBeenCalled();

                const metrics = await store.getSubscriptionAiChatMetrics({
                    ownerId: userId,
                });

                expect(metrics).toEqual({
                    ownerId: userId,
                    subscriptionStatus: 'active',
                    subscriptionId: 'sub1',
                    subscriptionType: 'user',
                    totalTokensInCurrentPeriod: 100,
                });
            });

            it('should deny the request if the feature is not allowed', async () => {
                chatInterface.chat.mockReturnValueOnce(
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 123,
                    })
                );

                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: false,
                                })
                        )
                );

                const result = await controller.chat({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit AI Chat features.',
                });
                expect(chatInterface.chat).not.toHaveBeenCalled();
            });

            describe('billing', () => {
                let account1: Account;

                beforeEach(async () => {
                    // @ts-expect-error private access
                    controller._financial = financial;

                    unwrap(await financial.init());

                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIChat({
                                        allowed: true,
                                        maxTokensPerPeriod: 100,
                                        maxTokensPerRequest: 75,
                                        creditFeePerInputToken: 10,
                                        creditFeePerOutputToken: 15,
                                    })
                            )
                    );

                    account1 = unwrap(
                        await financial.getOrCreateFinancialAccount({
                            userId: userId,
                            ledger: LEDGERS.credits,
                        })
                    ).account;

                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account1.id,
                                    amount: 10000n,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );
                });

                it('should charge the user for total tokens used in the chat', async () => {
                    chatInterface.chat.mockImplementationOnce(async () => {
                        await checkAccounts(financialInterface, [
                            {
                                id: account1.id,
                                credits_posted: 10000n,
                                credits_pending: 0n,
                                debits_posted: 0n,

                                // Should charge for 100 input and output tokens
                                debits_pending: 2500n,
                            },
                        ]);

                        return Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 1,
                        });
                    });

                    const result = await controller.chat({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    });

                    expect(result).toEqual({
                        success: true,
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should charge at the output token rate
                            debits_posted: 15n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chat).toHaveBeenCalled();
                });

                it('should charge the user for input tokens and output tokens separately', async () => {
                    chatInterface.chat.mockImplementationOnce(async () => {
                        await checkAccounts(financialInterface, [
                            {
                                id: account1.id,
                                credits_posted: 10000n,
                                credits_pending: 0n,
                                debits_posted: 0n,

                                debits_pending: 2500n,
                            },
                        ]);

                        return Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 15,
                            inputTokens: 5,
                            outputTokens: 10,
                        });
                    });

                    const result = await controller.chat({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    });

                    expect(result).toEqual({
                        success: true,
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // 10 * 5 input tokens + 15 * 10 output tokens
                            debits_posted: 200n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chat).toHaveBeenCalled();
                });

                it('should be able to only charge for input tokens', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIChat({
                                        allowed: true,
                                        maxTokensPerPeriod: 100,
                                        maxTokensPerRequest: 75,
                                        creditFeePerInputToken: 10,
                                    })
                            )
                    );

                    chatInterface.chat.mockImplementationOnce(async () => {
                        await checkAccounts(financialInterface, [
                            {
                                id: account1.id,
                                credits_posted: 10000n,
                                credits_pending: 0n,
                                debits_posted: 0n,
                                debits_pending: 1000n,
                            },
                        ]);

                        return Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 15,
                            inputTokens: 5,
                            outputTokens: 10,
                        });
                    });

                    const result = await controller.chat({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    });

                    expect(result).toEqual({
                        success: true,
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // 10 * 5 input tokens
                            debits_posted: 50n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chat).toHaveBeenCalled();
                });

                it('should be able to only charge for output tokens', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIChat({
                                        allowed: true,
                                        maxTokensPerPeriod: 100,
                                        maxTokensPerRequest: 75,
                                        creditFeePerOutputToken: 15,
                                    })
                            )
                    );

                    chatInterface.chat.mockImplementationOnce(async () => {
                        await checkAccounts(financialInterface, [
                            {
                                id: account1.id,
                                credits_posted: 10000n,
                                credits_pending: 0n,
                                debits_posted: 0n,
                                debits_pending: 1500n,
                            },
                        ]);

                        return Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 15,
                            inputTokens: 5,
                            outputTokens: 10,
                        });
                    });

                    const result = await controller.chat({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    });

                    expect(result).toEqual({
                        success: true,
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // 15 * 10 output tokens
                            debits_posted: 150n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chat).toHaveBeenCalled();
                });

                it('should use the specified pre charge amount', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIChat({
                                        allowed: true,
                                        maxTokensPerPeriod: 100,
                                        maxTokensPerRequest: 75,
                                        creditFeePerOutputToken: 15,
                                        creditFeePerInputToken: 10,
                                        preChargeInputTokens: 1,
                                        preChargeOutputTokens: 1,
                                    })
                            )
                    );

                    chatInterface.chat.mockImplementationOnce(async () => {
                        await checkAccounts(financialInterface, [
                            {
                                id: account1.id,
                                credits_posted: 10000n,
                                credits_pending: 0n,
                                debits_posted: 0n,
                                debits_pending: 25n,
                            },
                        ]);

                        return Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 15,
                            inputTokens: 5,
                            outputTokens: 10,
                        });
                    });

                    const result = await controller.chat({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    });

                    expect(result).toEqual({
                        success: true,
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            debits_posted: 200n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chat).toHaveBeenCalled();
                });
            });
        });

        it('should return a not_authorized result if the user privacy features do not allow AI access', async () => {
            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                    },
                    options: {
                        defaultModel: 'default-model',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: ['test-tier'],
                        tokenModifierRatio: { default: 1.0 },
                    },
                },
                generateSkybox: {
                    interface: generateSkyboxInterface,
                    options: {
                        allowedSubscriptionTiers: ['test-tier'],
                    },
                },
                images: {
                    interfaces: {
                        openai: generateImageInterface,
                    },
                    options: {
                        defaultModel: 'openai',
                        defaultWidth: 512,
                        defaultHeight: 512,
                        maxWidth: 1024,
                        maxHeight: 1024,
                        maxSteps: 50,
                        maxImages: 3,
                        allowedModels: {
                            openai: ['openai'],
                            stabilityai: ['stable-diffusion-xl-1024-v1-0'],
                        },
                        allowedSubscriptionTiers: ['test-tier'],
                    },
                },
                hume: {
                    interface: humeInterface,
                    config: {
                        apiKey: 'apiKey',
                        secretKey: 'secretKey',
                    },
                },
                openai: null,
                sloyd: null,
                metrics: store,
                config: store,
                policies: store,
                policyController: policies,
                records: store,
            });

            chatInterface.chat.mockReturnValueOnce(
                Promise.resolve({
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            finishReason: 'stop',
                        },
                    ],
                    totalTokens: 1,
                })
            );

            // const user = await store.findUser(userId);
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                privacyFeatures: {
                    allowAI: false,
                    allowPublicData: true,
                    allowPublicInsts: true,
                    publishData: true,
                },
            });

            const result = await controller.chat({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'AI Access is not allowed',
            });
            expect(chatInterface.chat).not.toHaveBeenCalled();
        });
    });

    describe('chatStream()', () => {
        it('should return the result from the chat interface', async () => {
            chatInterface.chatStream.mockReturnValueOnce(
                asyncIterable<AIChatInterfaceStreamResponse>([
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 1,
                    }),
                ])
            );

            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                })
            );

            expect(result).toEqual({
                result: {
                    success: true,
                },
                states: [
                    {
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    },
                ],
            });
            expect(chatInterface.chatStream).toHaveBeenCalledWith({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });
        });

        it('should support using another provider based on the chosen model', async () => {
            chatInterface2.chatStream.mockReturnValueOnce(
                asyncIterable<AIChatInterfaceStreamResponse>([
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 1,
                    }),
                ])
            );

            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model3',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                })
            );

            expect(result).toEqual({
                result: {
                    success: true,
                },
                states: [
                    {
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    },
                ],
            });
            expect(chatInterface2.chatStream).toHaveBeenCalledWith({
                model: 'test-model3',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });
        });

        it('should use the default model if none is specified', async () => {
            chatInterface.chatStream.mockReturnValueOnce(
                asyncIterable<AIChatInterfaceStreamResponse>([
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 1,
                    }),
                ])
            );

            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                })
            );

            expect(result).toEqual({
                result: {
                    success: true,
                },
                states: [
                    {
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    },
                ],
            });
            expect(chatInterface.chatStream).toHaveBeenCalledWith({
                model: 'default-model',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });
        });

        it('should return an invalid_model result if the given model is not allowed', async () => {
            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'wrong-model',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                })
            );

            expect(result).toEqual({
                result: {
                    success: false,
                    errorCode: 'invalid_model',
                    errorMessage: 'The given model is not allowed for chats.',
                },
                states: [],
            });
            expect(chatInterface.chatStream).not.toHaveBeenCalled();
        });

        it('should return an not_logged_in result if the given a null userId', async () => {
            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId: null as any,
                    userSubscriptionTier,
                })
            );

            expect(result).toEqual({
                result: {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                },
                states: [],
            });
            expect(chatInterface.chatStream).not.toHaveBeenCalled();
        });

        it('should return an not_subscribed result if the given a null userSubscriptionTier', async () => {
            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier: null as any,
                })
            );

            expect(result).toEqual({
                result: {
                    success: false,
                    errorCode: 'not_subscribed',
                    errorMessage:
                        'The user must be subscribed in order to use this operation.',
                    allowedSubscriptionTiers: ['test-tier'],
                },
                states: [],
            });
            expect(chatInterface.chatStream).not.toHaveBeenCalled();
        });

        it('should return an invalid_subscription_tier result if the given a subscription tier that is not allowed', async () => {
            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier: 'wrong-tier',
                })
            );

            expect(result).toEqual({
                result: {
                    success: false,
                    errorCode: 'invalid_subscription_tier',
                    errorMessage:
                        'This operation is not available to the user at their current subscription tier.',
                    currentSubscriptionTier: 'wrong-tier',
                    allowedSubscriptionTiers: ['test-tier'],
                },
                states: [],
            });
            expect(chatInterface.chatStream).not.toHaveBeenCalled();
        });

        it('should work when the controller is configured to allow all subscription tiers and the user does not have a subscription', async () => {
            chatInterface.chatStream.mockReturnValueOnce(
                asyncIterable<AIChatInterfaceStreamResponse>([
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 1,
                    }),
                ])
            );

            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                    },
                    options: {
                        defaultModel: 'default-model',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: true,
                        tokenModifierRatio: { default: 1.0 },
                    },
                },
                generateSkybox: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                openai: null,
                policies: null,
                policyController: policies,
                records: store,
            });

            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier: null as any,
                })
            );

            expect(result).toEqual({
                result: {
                    success: true,
                },
                states: [
                    {
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    },
                ],
            });
            expect(chatInterface.chatStream).toHaveBeenCalledWith({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });
        });

        it('should return a not_supported result if no chat configuration is provided', async () => {
            controller = new AIController({
                chat: null,
                generateSkybox: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                openai: null,
                policies: null,
                policyController: policies,
                records: store,
            });

            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier: null as any,
                })
            );

            expect(result).toEqual({
                result: {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                },
                states: [],
            });
        });

        it('should track metrics for chat operations', async () => {
            chatInterface.chatStream.mockReturnValueOnce(
                asyncIterable<AIChatInterfaceStreamResponse>([
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 123,
                    }),
                ])
            );

            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                })
            );

            expect(result).toEqual({
                result: {
                    success: true,
                },
                states: [
                    {
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    },
                ],
            });
            expect(chatInterface.chatStream).toHaveBeenCalledWith({
                model: 'test-model1',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });

            const metrics = await store.getSubscriptionAiChatMetrics({
                ownerId: userId,
            });

            expect(metrics).toMatchObject({
                ownerId: userId,
                subscriptionStatus: null,
                subscriptionId: null,
                subscriptionType: 'user',
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalTokensInCurrentPeriod: 123,
            });
        });

        it('should use configure token ratio', async () => {
            chatInterface.chatStream.mockReturnValueOnce(
                asyncIterable<AIChatInterfaceStreamResponse>([
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 123,
                    }),
                ])
            );

            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model-token-ratio',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                })
            );

            expect(result).toEqual({
                result: {
                    success: true,
                },
                states: [
                    {
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                    },
                ],
            });
            expect(chatInterface.chatStream).toHaveBeenCalledWith({
                model: 'test-model-token-ratio',
                messages: [
                    {
                        role: 'user',
                        content: 'test',
                    },
                ],
                temperature: 0.5,
                userId: 'test-user',
            });

            const metrics = await store.getSubscriptionAiChatMetrics({
                ownerId: userId,
            });

            expect(metrics).toMatchObject({
                ownerId: userId,
                subscriptionStatus: null,
                subscriptionId: null,
                subscriptionType: 'user',
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalTokensInCurrentPeriod: 246,
            });
        });

        describe('subscriptions', () => {
            beforeEach(async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: true,
                                    maxTokensPerPeriod: 100,
                                    maxTokensPerRequest: 75,
                                })
                        )
                );

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });
            });

            it('should return not_authorized error when allowedModels does not include the model', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: true,
                                    allowedModels: [
                                        'test-model1',
                                        'test-model2',
                                    ],
                                })
                        )
                );
                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                chatInterface2.chatStream.mockReturnValueOnce(
                    asyncIterable<AIChatInterfaceStreamResponse>([
                        Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 1,
                        }),
                    ])
                );

                const result = await unwindAndCaptureAsync(
                    controller.chatStream({
                        model: 'test-model3',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    })
                );

                expect(result).toEqual({
                    result: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'The subscription does not permit the given model for AI Chat features.',
                    },
                    states: [],
                });
                expect(chatInterface.chatStream).not.toHaveBeenCalled();
            });

            it('should return success when allowedModels includes the model', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: true,
                                    allowedModels: [
                                        'test-model1',
                                        'test-model2',
                                    ],
                                })
                        )
                );

                chatInterface.chatStream.mockReturnValueOnce(
                    asyncIterable<AIChatInterfaceStreamResponse>([
                        Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 1,
                        }),
                    ])
                );

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                const result = await unwindAndCaptureAsync(
                    controller.chatStream({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    })
                );

                expect(result).toEqual({
                    result: {
                        success: true,
                    },
                    states: [
                        {
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                        },
                    ],
                });
                expect(chatInterface.chatStream).toHaveBeenCalled();
            });

            it('should specify the maximum number of tokens allowed based on how many tokens the subscription has left in the period', async () => {
                chatInterface.chatStream.mockReturnValueOnce(
                    asyncIterable<AIChatInterfaceStreamResponse>([
                        Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 25,
                        }),
                    ])
                );

                await store.recordChatMetrics({
                    userId: userId,
                    createdAtMs: Date.now(),
                    tokens: 50,
                });

                const result = await unwindAndCaptureAsync(
                    controller.chatStream({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    })
                );

                expect(result).toEqual({
                    result: {
                        success: true,
                    },
                    states: [
                        {
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                        },
                    ],
                });
                expect(chatInterface.chatStream).toHaveBeenCalledWith({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId: 'test-user',
                    maxTokens: 50,
                });

                const metrics = await store.getSubscriptionAiChatMetrics({
                    ownerId: userId,
                });

                expect(metrics).toEqual({
                    ownerId: userId,
                    subscriptionStatus: 'active',
                    subscriptionId: 'sub1',
                    subscriptionType: 'user',
                    totalTokensInCurrentPeriod: 75,
                });
            });

            it('should specify the maximum number of tokens allowed based on the maximum number of tokens per request', async () => {
                chatInterface.chatStream.mockReturnValueOnce(
                    asyncIterable<AIChatInterfaceStreamResponse>([
                        Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 25,
                        }),
                    ])
                );

                await store.recordChatMetrics({
                    userId: userId,
                    createdAtMs: Date.now(),
                    tokens: 10,
                });

                const result = await unwindAndCaptureAsync(
                    controller.chatStream({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    })
                );

                expect(result).toEqual({
                    result: {
                        success: true,
                    },
                    states: [
                        {
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                        },
                    ],
                });
                expect(chatInterface.chatStream).toHaveBeenCalledWith({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId: 'test-user',
                    maxTokens: 75,
                });

                const metrics = await store.getSubscriptionAiChatMetrics({
                    ownerId: userId,
                });

                expect(metrics).toEqual({
                    ownerId: userId,
                    subscriptionStatus: 'active',
                    subscriptionId: 'sub1',
                    subscriptionType: 'user',
                    totalTokensInCurrentPeriod: 35,
                });
            });

            it('should deny the request if the user has run out of available tokens in the period', async () => {
                chatInterface.chatStream.mockReturnValueOnce(
                    asyncIterable<AIChatInterfaceStreamResponse>([
                        Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 123,
                        }),
                    ])
                );

                await store.recordChatMetrics({
                    userId: userId,
                    createdAtMs: Date.now(),
                    tokens: 100,
                });

                const result = await unwindAndCaptureAsync(
                    controller.chatStream({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    })
                );

                expect(result).toEqual({
                    result: {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The user has reached their limit for the current subscription period.',
                    },
                    states: [],
                });
                expect(chatInterface.chatStream).not.toHaveBeenCalled();

                const metrics = await store.getSubscriptionAiChatMetrics({
                    ownerId: userId,
                });

                expect(metrics).toEqual({
                    ownerId: userId,
                    subscriptionStatus: 'active',
                    subscriptionId: 'sub1',
                    subscriptionType: 'user',
                    totalTokensInCurrentPeriod: 100,
                });
            });

            it('should deny the request if the feature is not allowed', async () => {
                chatInterface.chatStream.mockReturnValueOnce(
                    asyncIterable<AIChatInterfaceStreamResponse>([
                        Promise.resolve({
                            choices: [
                                {
                                    role: 'user',
                                    content: 'test',
                                    finishReason: 'stop',
                                },
                            ],
                            totalTokens: 123,
                        }),
                    ])
                );

                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: false,
                                })
                        )
                );

                const result = await unwindAndCaptureAsync(
                    controller.chatStream({
                        model: 'test-model1',
                        messages: [
                            {
                                role: 'user',
                                content: 'test',
                            },
                        ],
                        temperature: 0.5,
                        userId,
                        userSubscriptionTier,
                    })
                );

                expect(result).toEqual({
                    result: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'The subscription does not permit AI Chat features.',
                    },
                    states: [],
                });
                expect(chatInterface.chatStream).not.toHaveBeenCalled();
            });

            describe('billing', () => {
                let account1: Account;

                beforeEach(async () => {
                    // @ts-expect-error private access
                    controller._financial = financial;

                    unwrap(await financial.init());

                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIChat({
                                        allowed: true,
                                        maxTokensPerPeriod: 100,
                                        maxTokensPerRequest: 75,
                                        creditFeePerInputToken: 10,
                                        creditFeePerOutputToken: 15,
                                    })
                            )
                    );

                    account1 = unwrap(
                        await financial.getOrCreateFinancialAccount({
                            userId: userId,
                            ledger: LEDGERS.credits,
                        })
                    ).account;

                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account1.id,
                                    amount: 10000n,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );
                });

                it('should charge the user for total tokens used in the chat', async () => {
                    chatInterface.chatStream.mockImplementationOnce(
                        async function* () {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,

                                    // Should charge for 100 input and output tokens
                                    debits_pending: 2500n,
                                },
                            ]);

                            yield {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                                totalTokens: 1,
                            };
                        }
                    );

                    const result = await unwindAndCaptureAsync(
                        controller.chatStream({
                            model: 'test-model1',
                            messages: [
                                {
                                    role: 'user',
                                    content: 'test',
                                },
                            ],
                            temperature: 0.5,
                            userId,
                            userSubscriptionTier,
                        })
                    );

                    expect(result).toEqual({
                        result: {
                            success: true,
                        },
                        states: [
                            {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should charge at the output token rate
                            debits_posted: 15n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chatStream).toHaveBeenCalled();
                });

                it('should charge the user for input tokens and output tokens separately', async () => {
                    chatInterface.chatStream.mockImplementationOnce(
                        async function* () {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,

                                    debits_pending: 2500n,
                                },
                            ]);

                            yield {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                                totalTokens: 15,
                                inputTokens: 5,
                                outputTokens: 10,
                            };
                        }
                    );

                    const result = await unwindAndCaptureAsync(
                        controller.chatStream({
                            model: 'test-model1',
                            messages: [
                                {
                                    role: 'user',
                                    content: 'test',
                                },
                            ],
                            temperature: 0.5,
                            userId,
                            userSubscriptionTier,
                        })
                    );

                    expect(result).toEqual({
                        result: {
                            success: true,
                        },
                        states: [
                            {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // 10 * 5 input tokens + 15 * 10 output tokens
                            debits_posted: 200n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chatStream).toHaveBeenCalled();
                });

                it('should be able to only charge for input tokens', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIChat({
                                        allowed: true,
                                        maxTokensPerPeriod: 100,
                                        maxTokensPerRequest: 75,
                                        creditFeePerInputToken: 10,
                                    })
                            )
                    );

                    chatInterface.chatStream.mockImplementationOnce(
                        async function* () {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 1000n,
                                },
                            ]);

                            yield {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                                totalTokens: 15,
                                inputTokens: 5,
                                outputTokens: 10,
                            };
                        }
                    );

                    const result = await unwindAndCaptureAsync(
                        controller.chatStream({
                            model: 'test-model1',
                            messages: [
                                {
                                    role: 'user',
                                    content: 'test',
                                },
                            ],
                            temperature: 0.5,
                            userId,
                            userSubscriptionTier,
                        })
                    );

                    expect(result).toEqual({
                        result: {
                            success: true,
                        },
                        states: [
                            {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // 10 * 5 input tokens
                            debits_posted: 50n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chatStream).toHaveBeenCalled();
                });

                it('should be able to only charge for output tokens', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIChat({
                                        allowed: true,
                                        maxTokensPerPeriod: 100,
                                        maxTokensPerRequest: 75,
                                        creditFeePerOutputToken: 15,
                                    })
                            )
                    );

                    chatInterface.chatStream.mockImplementationOnce(
                        async function* () {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 1500n,
                                },
                            ]);

                            yield {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                                totalTokens: 15,
                                inputTokens: 5,
                                outputTokens: 10,
                            };
                        }
                    );

                    const result = await unwindAndCaptureAsync(
                        controller.chatStream({
                            model: 'test-model1',
                            messages: [
                                {
                                    role: 'user',
                                    content: 'test',
                                },
                            ],
                            temperature: 0.5,
                            userId,
                            userSubscriptionTier,
                        })
                    );

                    expect(result).toEqual({
                        result: {
                            success: true,
                        },
                        states: [
                            {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // 15 * 10 output tokens
                            debits_posted: 150n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chatStream).toHaveBeenCalled();
                });

                it('should use the specified pre charge amount', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIChat({
                                        allowed: true,
                                        maxTokensPerPeriod: 100,
                                        maxTokensPerRequest: 75,
                                        creditFeePerOutputToken: 15,
                                        creditFeePerInputToken: 10,
                                        preChargeInputTokens: 1,
                                        preChargeOutputTokens: 1,
                                    })
                            )
                    );

                    chatInterface.chatStream.mockImplementationOnce(
                        async function* () {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 25n,
                                },
                            ]);

                            yield {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                                totalTokens: 15,
                                inputTokens: 5,
                                outputTokens: 10,
                            };
                        }
                    );

                    const result = await unwindAndCaptureAsync(
                        controller.chatStream({
                            model: 'test-model1',
                            messages: [
                                {
                                    role: 'user',
                                    content: 'test',
                                },
                            ],
                            temperature: 0.5,
                            userId,
                            userSubscriptionTier,
                        })
                    );

                    expect(result).toEqual({
                        result: {
                            success: true,
                        },
                        states: [
                            {
                                choices: [
                                    {
                                        role: 'user',
                                        content: 'test',
                                        finishReason: 'stop',
                                    },
                                ],
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            debits_posted: 200n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(chatInterface.chatStream).toHaveBeenCalled();
                });
            });
        });

        it('should return a not_authorized result if the user privacy features do not allow AI access', async () => {
            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                    },
                    options: {
                        defaultModel: 'default-model',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: ['test-tier'],
                        tokenModifierRatio: { default: 1.0 },
                    },
                },
                generateSkybox: {
                    interface: generateSkyboxInterface,
                    options: {
                        allowedSubscriptionTiers: ['test-tier'],
                    },
                },
                images: {
                    interfaces: {
                        openai: generateImageInterface,
                    },
                    options: {
                        defaultModel: 'openai',
                        defaultWidth: 512,
                        defaultHeight: 512,
                        maxWidth: 1024,
                        maxHeight: 1024,
                        maxSteps: 50,
                        maxImages: 3,
                        allowedModels: {
                            openai: ['openai'],
                            stabilityai: ['stable-diffusion-xl-1024-v1-0'],
                        },
                        allowedSubscriptionTiers: ['test-tier'],
                    },
                },
                hume: {
                    interface: humeInterface,
                    config: {
                        apiKey: 'apiKey',
                        secretKey: 'secretKey',
                    },
                },
                sloyd: null,
                openai: null,
                metrics: store,
                config: store,
                policies: store,
                policyController: policies,
                records: store,
            });

            chatInterface.chatStream.mockReturnValueOnce(
                asyncIterable<AIChatInterfaceStreamResponse>([
                    Promise.resolve({
                        choices: [
                            {
                                role: 'user',
                                content: 'test',
                                finishReason: 'stop',
                            },
                        ],
                        totalTokens: 1,
                    }),
                ])
            );

            // const user = await store.findUser(userId);
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                privacyFeatures: {
                    allowAI: false,
                    allowPublicData: true,
                    allowPublicInsts: true,
                    publishData: true,
                },
            });

            const result = await unwindAndCaptureAsync(
                controller.chatStream({
                    model: 'test-model1',
                    messages: [
                        {
                            role: 'user',
                            content: 'test',
                        },
                    ],
                    temperature: 0.5,
                    userId,
                    userSubscriptionTier,
                })
            );

            expect(result).toEqual({
                result: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'AI Access is not allowed',
                },
                states: [],
            });
            expect(chatInterface.chatStream).not.toHaveBeenCalled();
        });
    });

    describe('listChatModels()', () => {
        it('should return the list of allowed chat models', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier(userSubscriptionTier)
                            .withAllDefaultFeatures()
                            .withAI()
                            .withAIChat({
                                allowed: true,
                            })
                    )
            );
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await controller.listChatModels({
                userId,
                userSubscriptionTier,
                userRole: 'none',
            });

            expect(result).toEqual(
                success([
                    {
                        name: 'test-model1',
                        provider: 'provider1',
                        isDefault: false,
                    },
                    {
                        name: 'test-model2',
                        provider: 'provider1',
                        isDefault: false,
                    },
                    {
                        name: 'test-model3',
                        provider: 'provider2',
                        isDefault: false,
                    },
                    {
                        name: 'test-model-token-ratio',
                        provider: 'provider1',
                        isDefault: false,
                    },
                ])
            );
        });

        it('should mark the default model', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier(userSubscriptionTier)
                            .withAllDefaultFeatures()
                            .withAI()
                            .withAIChat({
                                allowed: true,
                            })
                    )
            );
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                        provider2: chatInterface2,
                    },
                    options: {
                        defaultModel: 'test-model1',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: [userSubscriptionTier],
                        tokenModifierRatio: {},
                    },
                },
                generateSkybox: null,
                images: null,
                hume: null,
                sloyd: null,
                openai: null,
                metrics: store,
                config: store,
                policies: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.listChatModels({
                userId,
                userSubscriptionTier,
                userRole: 'none',
            });

            expect(result).toEqual(
                success([
                    {
                        name: 'test-model1',
                        provider: 'provider1',
                        isDefault: true,
                    },
                    {
                        name: 'test-model2',
                        provider: 'provider1',
                        isDefault: false,
                    },
                ])
            );
        });

        it('should filter models based on subscription features', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier(userSubscriptionTier)
                            .withAllDefaultFeatures()
                            .withAI()
                            .withAIChat({
                                allowed: true,
                                allowedModels: ['test-model1', 'test-model2'],
                            })
                    )
            );
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await controller.listChatModels({
                userId,
                userSubscriptionTier,
                userRole: 'none',
            });

            expect(result).toEqual(
                success([
                    {
                        name: 'test-model1',
                        provider: 'provider1',
                        isDefault: false,
                    },
                    {
                        name: 'test-model2',
                        provider: 'provider1',
                        isDefault: false,
                    },
                ])
            );
        });

        it('should return all models if the user is a superUser', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config
                        .addSubscription('sub1', (sub) =>
                            sub
                                .withTier(userSubscriptionTier)
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: true,
                                    allowedModels: [
                                        'test-model1',
                                        'test-model2',
                                    ],
                                })
                        )
                        .withUserDefaultFeatures((features) =>
                            features.withAIChat({
                                allowed: false,
                            })
                        )
            );
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                subscriptionId: null,
                subscriptionStatus: null,
                role: 'superUser',
            });

            const result = await controller.listChatModels({
                userId,
                userSubscriptionTier,
                userRole: 'superUser',
            });

            expect(result).toEqual(
                success([
                    {
                        name: 'test-model1',
                        provider: 'provider1',
                        isDefault: false,
                    },
                    {
                        name: 'test-model2',
                        provider: 'provider1',
                        isDefault: false,
                    },
                    {
                        name: 'test-model3',
                        provider: 'provider2',
                        isDefault: false,
                    },
                    {
                        name: 'test-model-token-ratio',
                        provider: 'provider1',
                        isDefault: false,
                    },
                ])
            );
        });

        it('should return not_logged_in if no userId is provided', async () => {
            const result = await controller.listChatModels({
                userId: null,
                userSubscriptionTier,
                userRole: 'none',
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_logged_in',
                    errorMessage: 'The user is not logged in.',
                })
            );
        });

        it('should return subscription_limit_reached if the user has no subscription', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config
                        .addSubscription('sub1', (sub) =>
                            sub
                                .withTier(userSubscriptionTier)
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIChat({
                                    allowed: true,
                                    allowedModels: [
                                        'test-model1',
                                        'test-model2',
                                    ],
                                })
                        )
                        .withUserDefaultFeatures((features) =>
                            features.withAIChat({
                                allowed: false,
                            })
                        )
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: null,
                subscriptionStatus: null,
                subscriptionInfoId: null,
                subscriptionPeriodEndMs: null,
                subscriptionPeriodStartMs: null,
            });

            const result = await controller.listChatModels({
                userId,
                userSubscriptionTier,
                userRole: 'none',
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The subscription does not permit AI Chat features.',
                })
            );
        });

        it('should return subscription_limit_reached if the user subscription tier is not allowed', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('other-tier')
                            .withAllDefaultFeatures()
                            .withAI()
                            .withAIChat({
                                allowed: true,
                            })
                    )
            );
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await controller.listChatModels({
                userId,
                userSubscriptionTier: 'other-tier',
                userRole: 'none',
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'invalid_subscription_tier',
                    errorMessage:
                        'This operation is not available to the user at their current subscription tier.',
                    allowedSubscriptionTiers: ['test-tier'],
                    currentSubscriptionTier: 'other-tier',
                })
            );
        });

        it('should return not_supported if no chat configuration is provided', async () => {
            controller = new AIController({
                chat: null,
                generateSkybox: null,
                images: null,
                hume: null,
                sloyd: null,
                openai: null,
                metrics: store,
                config: store,
                policies: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.listChatModels({
                userId,
                userSubscriptionTier,
                userRole: 'none',
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                })
            );
        });
    });

    describe('generateSkybox()', () => {
        it('should return the result from the generateSkybox interface', async () => {
            generateSkyboxInterface.generateSkybox.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    skyboxId: 'test-skybox-id',
                })
            );

            const result = await controller.generateSkybox({
                prompt: 'test',
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: true,
                skyboxId: 'test-skybox-id',
            });
            expect(generateSkyboxInterface.generateSkybox).toHaveBeenCalledWith(
                {
                    prompt: 'test',
                }
            );

            const metrics = await store.getSubscriptionAiSkyboxMetrics({
                ownerId: userId,
            });

            expect(metrics).toMatchObject({
                ownerId: userId,
                subscriptionStatus: null,
                subscriptionId: null,
                subscriptionType: 'user',
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalSkyboxesInCurrentPeriod: 1,
            });
        });

        it('should return a not_supported result if no generateSkybox configuration is provided', async () => {
            controller = new AIController({
                generateSkybox: null,
                chat: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                policies: null,
                openai: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.generateSkybox({
                prompt: 'test',
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });

        it('should return a not_logged_in result if the given a null userId', async () => {
            const result = await controller.generateSkybox({
                prompt: 'test',
                userId: null as any,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in. Please provide a sessionKey or a recordKey.',
            });
            expect(
                generateSkyboxInterface.generateSkybox
            ).not.toHaveBeenCalled();
        });

        it('should return a not_subscribed result if the given a null userSubscriptionTier', async () => {
            const result = await controller.generateSkybox({
                prompt: 'test',
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_subscribed',
                errorMessage:
                    'The user must be subscribed in order to use this operation.',
                allowedSubscriptionTiers: ['test-tier'],
            });
            expect(
                generateSkyboxInterface.generateSkybox
            ).not.toHaveBeenCalled();
        });

        it('should return an invalid_subscription_tier result if the given a subscription tier that is not allowed', async () => {
            const result = await controller.generateSkybox({
                prompt: 'test',
                userId,
                userSubscriptionTier: 'wrong-tier',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_subscription_tier',
                errorMessage:
                    'This operation is not available to the user at their current subscription tier.',
                currentSubscriptionTier: 'wrong-tier',
                allowedSubscriptionTiers: ['test-tier'],
            });
            expect(
                generateSkyboxInterface.generateSkybox
            ).not.toHaveBeenCalled();
        });

        it('should work when the controller is configured to allow all subscription tiers and the user does not have a subscription', async () => {
            generateSkyboxInterface.generateSkybox.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    skyboxId: 'test-skybox-id',
                })
            );

            controller = new AIController({
                chat: null,
                generateSkybox: {
                    interface: generateSkyboxInterface,
                    options: {
                        allowedSubscriptionTiers: true,
                    },
                },
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                policies: null,
                openai: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.generateSkybox({
                prompt: 'test',
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: true,
                skyboxId: 'test-skybox-id',
            });
            expect(generateSkyboxInterface.generateSkybox).toHaveBeenCalledWith(
                {
                    prompt: 'test',
                }
            );
        });

        it('should return a not_authorized result if the user privacy features do not allow AI access', async () => {
            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                    },
                    options: {
                        defaultModel: 'default-model',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: ['test-tier'],
                        tokenModifierRatio: { default: 1.0 },
                    },
                },
                generateSkybox: {
                    interface: generateSkyboxInterface,
                    options: {
                        allowedSubscriptionTiers: true,
                    },
                },
                images: {
                    interfaces: {
                        openai: generateImageInterface,
                    },
                    options: {
                        defaultModel: 'openai',
                        defaultWidth: 512,
                        defaultHeight: 512,
                        maxWidth: 1024,
                        maxHeight: 1024,
                        maxSteps: 50,
                        maxImages: 3,
                        allowedModels: {
                            openai: ['openai'],
                            stabilityai: ['stable-diffusion-xl-1024-v1-0'],
                        },
                        allowedSubscriptionTiers: ['test-tier'],
                    },
                },
                hume: {
                    interface: humeInterface,
                    config: {
                        apiKey: 'apiKey',
                        secretKey: 'secretKey',
                    },
                },
                sloyd: null,
                openai: null,
                metrics: store,
                config: store,
                policies: store,
                policyController: policies,
                records: store,
            });

            generateSkyboxInterface.generateSkybox.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    skyboxId: 'test-skybox-id',
                })
            );

            // const user = await store.findUser(userId);
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                privacyFeatures: {
                    allowAI: false,
                    allowPublicData: true,
                    allowPublicInsts: true,
                    publishData: true,
                },
            });

            const result = await controller.generateSkybox({
                prompt: 'test',
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'AI Access is not allowed',
            });
            expect(
                generateSkyboxInterface.generateSkybox
            ).not.toHaveBeenCalled();
        });

        describe('subscriptions', () => {
            beforeEach(async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAISkyboxes({
                                    allowed: true,
                                    maxSkyboxesPerPeriod: 4,
                                })
                        )
                );

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });
            });

            it('should reject the request if the feature is not allowed', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAISkyboxes({
                                    allowed: false,
                                })
                        )
                );

                generateSkyboxInterface.generateSkybox.mockReturnValueOnce(
                    Promise.resolve({
                        success: true,
                        skyboxId: 'test-skybox-id',
                    })
                );

                const result = await controller.generateSkybox({
                    prompt: 'test',
                    userId,
                    userSubscriptionTier,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit AI Skybox features.',
                });
                expect(
                    generateSkyboxInterface.generateSkybox
                ).not.toHaveBeenCalled();
            });

            it('should reject the request if it would exceed the subscription period limits', async () => {
                generateSkyboxInterface.generateSkybox.mockReturnValueOnce(
                    Promise.resolve({
                        success: true,
                        skyboxId: 'test-skybox-id',
                    })
                );

                await store.recordSkyboxMetrics({
                    createdAtMs: Date.now(),
                    skyboxes: 10,
                    userId: userId,
                });

                const result = await controller.generateSkybox({
                    prompt: 'test',
                    userId,
                    userSubscriptionTier,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The user has reached their limit for the current subscription period.',
                });
                expect(
                    generateSkyboxInterface.generateSkybox
                ).not.toHaveBeenCalled();
            });

            describe('billing', () => {
                let account1: Account;

                beforeEach(async () => {
                    // @ts-expect-error private access
                    controller._financial = financial;

                    unwrap(await financial.init());

                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAISkyboxes({
                                        allowed: true,
                                        maxSkyboxesPerPeriod: 4,
                                        creditFeePerSkybox: 100,
                                    })
                            )
                    );

                    account1 = unwrap(
                        await financial.getOrCreateFinancialAccount({
                            userId: userId,
                            ledger: LEDGERS.credits,
                        })
                    ).account;

                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account1.id,
                                    amount: 10000n,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );
                });

                it('should charge the user for generating a skybox', async () => {
                    generateSkyboxInterface.generateSkybox.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,

                                    // Should charge for creditFeePerSkybox
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                skyboxId: 'test-skybox-id',
                            });
                        }
                    );

                    const result = await controller.generateSkybox({
                        prompt: 'test',
                        userId,
                        userSubscriptionTier,
                    });

                    expect(result).toEqual({
                        success: true,
                        skyboxId: 'test-skybox-id',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should charge the full fee
                            debits_posted: 100n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        generateSkyboxInterface.generateSkybox
                    ).toHaveBeenCalled();
                });

                it('should void the pending transfer if skybox generation fails', async () => {
                    generateSkyboxInterface.generateSkybox.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: false,
                                errorCode: 'server_error',
                                errorMessage: 'Skybox generation failed',
                            });
                        }
                    );

                    const result = await controller.generateSkybox({
                        prompt: 'test',
                        userId,
                        userSubscriptionTier,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'Skybox generation failed',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should void the pending transfer
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        generateSkyboxInterface.generateSkybox
                    ).toHaveBeenCalled();
                });

                it('should not create a pending transfer if creditFeePerSkybox is not configured', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAISkyboxes({
                                        allowed: true,
                                        maxSkyboxesPerPeriod: 4,
                                    })
                            )
                    );

                    generateSkyboxInterface.generateSkybox.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 0n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                skyboxId: 'test-skybox-id',
                            });
                        }
                    );

                    const result = await controller.generateSkybox({
                        prompt: 'test',
                        userId,
                        userSubscriptionTier,
                    });

                    expect(result).toEqual({
                        success: true,
                        skyboxId: 'test-skybox-id',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        generateSkyboxInterface.generateSkybox
                    ).toHaveBeenCalled();
                });

                it('should deny the request if the user does not have enough credits', async () => {
                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId: account1.id,
                                    creditAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    amount: 9950n,
                                    code: TransferCodes.admin_debit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );

                    const result = await controller.generateSkybox({
                        prompt: 'test',
                        userId,
                        userSubscriptionTier,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'insufficient_funds',
                        errorMessage: 'Insufficient funds to cover usage.',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 9950n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        generateSkyboxInterface.generateSkybox
                    ).not.toHaveBeenCalled();
                });
            });
        });
    });

    describe('getSkybox()', () => {
        it('should return the result from the generateSkybox interface', async () => {
            generateSkyboxInterface.getSkybox.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    status: 'generated',
                    fileUrl: 'test-file-url',
                    thumbnailUrl: 'test-thumbnail-url',
                })
            );

            const result = await controller.getSkybox({
                skyboxId: 'test-skybox-id',
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: true,
                status: 'generated',
                fileUrl: 'test-file-url',
                thumbnailUrl: 'test-thumbnail-url',
            });
            expect(generateSkyboxInterface.getSkybox).toHaveBeenCalledWith(
                'test-skybox-id'
            );
        });

        it('should return a not_supported result if no generateSkybox configuration is provided', async () => {
            controller = new AIController({
                generateSkybox: null,
                chat: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                policies: null,
                openai: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.getSkybox({
                skyboxId: 'test-skybox-id',
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });

        it('should return a not_logged_in result if the given a null userId', async () => {
            const result = await controller.getSkybox({
                skyboxId: 'test-skybox-id',
                userId: null as any,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in. Please provide a sessionKey or a recordKey.',
            });
            expect(generateSkyboxInterface.getSkybox).not.toHaveBeenCalled();
        });

        it('should return a not_subscribed result if the given a null userSubscriptionTier', async () => {
            const result = await controller.getSkybox({
                skyboxId: 'test-skybox-id',
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_subscribed',
                errorMessage:
                    'The user must be subscribed in order to use this operation.',
                allowedSubscriptionTiers: ['test-tier'],
            });
            expect(generateSkyboxInterface.getSkybox).not.toHaveBeenCalled();
        });

        it('should return an invalid_subscription_tier result if the given a subscription tier that is not allowed', async () => {
            const result = await controller.getSkybox({
                skyboxId: 'test-skybox-id',
                userId,
                userSubscriptionTier: 'wrong-tier',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_subscription_tier',
                errorMessage:
                    'This operation is not available to the user at their current subscription tier.',
                currentSubscriptionTier: 'wrong-tier',
                allowedSubscriptionTiers: ['test-tier'],
            });
            expect(generateSkyboxInterface.getSkybox).not.toHaveBeenCalled();
        });

        it('should work when the controller is configured to allow all subscription tiers and the user does not have a subscription', async () => {
            generateSkyboxInterface.getSkybox.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    status: 'generated',
                    fileUrl: 'test-file-url',
                    thumbnailUrl: 'test-thumbnail-url',
                })
            );

            controller = new AIController({
                chat: null,
                generateSkybox: {
                    interface: generateSkyboxInterface,
                    options: {
                        allowedSubscriptionTiers: true,
                    },
                },
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                policies: null,
                openai: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.getSkybox({
                skyboxId: 'test-skybox-id',
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: true,
                status: 'generated',
                fileUrl: 'test-file-url',
                thumbnailUrl: 'test-thumbnail-url',
            });
            expect(generateSkyboxInterface.getSkybox).toHaveBeenCalledWith(
                'test-skybox-id'
            );
        });

        it('should return a not_authorized result if the user privacy features do not allow AI access', async () => {
            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                    },
                    options: {
                        defaultModel: 'default-model',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: ['test-tier'],
                        tokenModifierRatio: { default: 1.0 },
                    },
                },
                generateSkybox: {
                    interface: generateSkyboxInterface,
                    options: {
                        allowedSubscriptionTiers: true,
                    },
                },
                images: {
                    interfaces: {
                        openai: generateImageInterface,
                    },
                    options: {
                        defaultModel: 'openai',
                        defaultWidth: 512,
                        defaultHeight: 512,
                        maxWidth: 1024,
                        maxHeight: 1024,
                        maxSteps: 50,
                        maxImages: 3,
                        allowedModels: {
                            openai: ['openai'],
                            stabilityai: ['stable-diffusion-xl-1024-v1-0'],
                        },
                        allowedSubscriptionTiers: ['test-tier'],
                    },
                },
                hume: {
                    interface: humeInterface,
                    config: {
                        apiKey: 'apiKey',
                        secretKey: 'secretKey',
                    },
                },
                sloyd: null,
                openai: null,
                metrics: store,
                config: store,
                policies: store,
                policyController: policies,
                records: store,
            });

            generateSkyboxInterface.getSkybox.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    status: 'generated',
                    fileUrl: 'test-file-url',
                    thumbnailUrl: 'test-thumbnail-url',
                })
            );

            // const user = await store.findUser(userId);
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                privacyFeatures: {
                    allowAI: false,
                    allowPublicData: true,
                    allowPublicInsts: true,
                    publishData: true,
                },
            });

            const result = await controller.getSkybox({
                skyboxId: 'skybox-id',
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'AI Access is not allowed',
            });
            expect(generateSkyboxInterface.getSkybox).not.toHaveBeenCalled();
        });
    });

    describe('generateImage()', () => {
        it('should return the result from the generateImage interface', async () => {
            generateImageInterface.generateImage.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    images: [
                        {
                            base64: 'base64',
                            seed: 123,
                            mimeType: 'image/png',
                        },
                    ],
                })
            );

            const result = await controller.generateImage({
                prompt: 'test',
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: true,
                images: [
                    {
                        base64: 'base64',
                        seed: 123,
                        mimeType: 'image/png',
                    },
                ],
            });
            expect(generateImageInterface.generateImage).toHaveBeenCalledWith({
                prompt: 'test',
                model: 'openai',
                width: 512,
                height: 512,
                numberOfImages: 1,
                steps: 30,
                userId: 'test-user',
            });

            const metrics = await store.getSubscriptionAiImageMetrics({
                ownerId: userId,
            });

            expect(metrics).toMatchObject({
                ownerId: userId,
                subscriptionStatus: null,
                subscriptionId: null,
                subscriptionType: 'user',
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalSquarePixelsInCurrentPeriod: 512,
            });
        });

        it('should use the provider associated with the given model type', async () => {
            let otherInterface: {
                generateImage: jest.Mock<
                    Promise<AIGenerateImageInterfaceResponse>,
                    [AIGenerateImageInterfaceRequest]
                >;
            } = {
                generateImage: jest.fn(),
            };

            controller = new AIController({
                chat: null,
                generateSkybox: null,
                images: {
                    interfaces: {
                        openai: generateImageInterface,
                        other: otherInterface,
                    },
                    options: {
                        defaultModel: 'openai',
                        defaultWidth: 512,
                        defaultHeight: 512,
                        maxWidth: 1024,
                        maxHeight: 1024,
                        maxSteps: 50,
                        maxImages: 3,
                        allowedModels: {
                            openai: ['openai'],
                            other: ['otherModel'],
                        },
                        allowedSubscriptionTiers: ['test-tier'],
                    },
                },
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                openai: null,
                policies: null,
                policyController: policies,
                records: store,
            });

            otherInterface.generateImage.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    images: [
                        {
                            base64: 'base64',
                            seed: 123,
                            mimeType: 'image/png',
                        },
                    ],
                })
            );

            const result = await controller.generateImage({
                model: 'otherModel',
                prompt: 'test',
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: true,
                images: [
                    {
                        base64: 'base64',
                        seed: 123,
                        mimeType: 'image/png',
                    },
                ],
            });
            expect(otherInterface.generateImage).toHaveBeenCalledWith({
                prompt: 'test',
                model: 'otherModel',
                width: 512,
                height: 512,
                numberOfImages: 1,
                steps: 30,
                userId: 'test-user',
            });
        });

        it('should return a not_supported result if no images configuration is provided', async () => {
            controller = new AIController({
                generateSkybox: null,
                chat: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                openai: null,
                policies: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.generateImage({
                prompt: 'prompt',
                userId,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });

        it('should return a not_logged_in result if the given a null userId', async () => {
            const result = await controller.generateImage({
                prompt: 'test',
                userId: null as any,
                userSubscriptionTier,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in. Please provide a sessionKey or a recordKey.',
            });
            expect(generateImageInterface.generateImage).not.toHaveBeenCalled();
        });

        it('should return a not_subscribed result if the given a null userSubscriptionTier', async () => {
            const result = await controller.generateImage({
                prompt: 'test',
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_subscribed',
                errorMessage:
                    'The user must be subscribed in order to use this operation.',
                allowedSubscriptionTiers: ['test-tier'],
            });
            expect(generateImageInterface.generateImage).not.toHaveBeenCalled();
        });

        it('should return an invalid_subscription_tier result if the given a subscription tier that is not allowed', async () => {
            const result = await controller.generateImage({
                prompt: 'test',
                userId,
                userSubscriptionTier: 'wrong-tier',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_subscription_tier',
                errorMessage:
                    'This operation is not available to the user at their current subscription tier.',
                currentSubscriptionTier: 'wrong-tier',
                allowedSubscriptionTiers: ['test-tier'],
            });
            expect(generateImageInterface.generateImage).not.toHaveBeenCalled();
        });

        it('should work when the controller is configured to allow all subscription tiers and the user does not have a subscription', async () => {
            generateImageInterface.generateImage.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    images: [
                        {
                            base64: 'base64',
                            seed: 123,
                            mimeType: 'image/png',
                        },
                    ],
                })
            );

            controller = new AIController({
                chat: null,
                generateSkybox: null,
                images: {
                    interfaces: {
                        openai: generateImageInterface,
                    },
                    options: {
                        defaultModel: 'openai',
                        defaultWidth: 512,
                        defaultHeight: 512,
                        maxWidth: 1024,
                        maxHeight: 1024,
                        maxSteps: 50,
                        maxImages: 3,
                        allowedModels: {
                            openai: ['openai'],
                        },
                        allowedSubscriptionTiers: true,
                    },
                },
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                openai: null,
                policies: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.generateImage({
                prompt: 'test',
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: true,
                images: [
                    {
                        base64: 'base64',
                        seed: 123,
                        mimeType: 'image/png',
                    },
                ],
            });
            expect(generateImageInterface.generateImage).toHaveBeenCalledWith({
                prompt: 'test',
                model: 'openai',
                width: 512,
                height: 512,
                numberOfImages: 1,
                steps: 30,
                userId: 'test-user',
            });
        });

        it('should return a not_authorized result if the user privacy features do not allow AI access', async () => {
            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                    },
                    options: {
                        defaultModel: 'default-model',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: ['test-tier'],
                        tokenModifierRatio: { default: 1.0 },
                    },
                },
                generateSkybox: {
                    interface: generateSkyboxInterface,
                    options: {
                        allowedSubscriptionTiers: true,
                    },
                },
                images: {
                    interfaces: {
                        openai: generateImageInterface,
                    },
                    options: {
                        defaultModel: 'openai',
                        defaultWidth: 512,
                        defaultHeight: 512,
                        maxWidth: 1024,
                        maxHeight: 1024,
                        maxSteps: 50,
                        maxImages: 3,
                        allowedModels: {
                            openai: ['openai'],
                            stabilityai: ['stable-diffusion-xl-1024-v1-0'],
                        },
                        allowedSubscriptionTiers: true,
                    },
                },
                hume: {
                    interface: humeInterface,
                    config: {
                        apiKey: 'apiKey',
                        secretKey: 'secretKey',
                    },
                },
                sloyd: null,
                openai: null,
                metrics: store,
                config: store,
                policies: store,
                policyController: policies,
                records: store,
            });

            generateImageInterface.generateImage.mockReturnValueOnce(
                Promise.resolve({
                    success: true,
                    images: [
                        {
                            base64: 'base64',
                            seed: 123,
                            mimeType: 'image/png',
                        },
                    ],
                })
            );

            // const user = await store.findUser(userId);
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                privacyFeatures: {
                    allowAI: false,
                    allowPublicData: true,
                    allowPublicInsts: true,
                    publishData: true,
                },
            });

            const result = await controller.generateImage({
                model: 'openai',
                prompt: 'test',
                userId,
                userSubscriptionTier: null as any,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'AI Access is not allowed',
            });
            expect(generateImageInterface.generateImage).not.toHaveBeenCalled();
        });

        describe('subscriptions', () => {
            beforeEach(async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIImages({
                                    allowed: true,
                                    maxSquarePixelsPerRequest: 512,
                                    maxSquarePixelsPerPeriod: 2048,
                                })
                        )
                );

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });
            });

            it('should reject the request if the feature is not allowed', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIImages({
                                    allowed: false,
                                })
                        )
                );

                generateImageInterface.generateImage.mockReturnValueOnce(
                    Promise.resolve({
                        success: true,
                        images: [
                            {
                                base64: 'base64',
                                seed: 123,
                                mimeType: 'image/png',
                            },
                        ],
                    })
                );

                const result = await controller.generateImage({
                    prompt: 'test',
                    userId,
                    userSubscriptionTier,
                    width: 512,
                    height: 512,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit AI Image features.',
                });
                expect(
                    generateImageInterface.generateImage
                ).not.toHaveBeenCalled();
            });

            it('should reject the request if it would exceed the subscription request limits', async () => {
                generateImageInterface.generateImage.mockReturnValueOnce(
                    Promise.resolve({
                        success: true,
                        images: [
                            {
                                base64: 'base64',
                                seed: 123,
                                mimeType: 'image/png',
                            },
                        ],
                    })
                );

                const result = await controller.generateImage({
                    prompt: 'test',
                    userId,
                    userSubscriptionTier,
                    width: 1024,
                    height: 1024,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The request exceeds allowed subscription limits.',
                });
                expect(
                    generateImageInterface.generateImage
                ).not.toHaveBeenCalled();
            });

            it('should reject the request if it would exceed the subscription period limits', async () => {
                generateImageInterface.generateImage.mockReturnValueOnce(
                    Promise.resolve({
                        success: true,
                        images: [
                            {
                                base64: 'base64',
                                seed: 123,
                                mimeType: 'image/png',
                            },
                        ],
                    })
                );

                await store.recordImageMetrics({
                    userId: userId,
                    createdAtMs: Date.now(),
                    squarePixels: 2048,
                });

                const result = await controller.generateImage({
                    prompt: 'test',
                    userId,
                    userSubscriptionTier,
                    width: 512,
                    height: 512,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The user has reached their limit for the current subscription period.',
                });
                expect(
                    generateImageInterface.generateImage
                ).not.toHaveBeenCalled();
            });

            describe('billing', () => {
                let account1: Account;

                beforeEach(async () => {
                    // @ts-expect-error private access
                    controller._financial = financial;

                    unwrap(await financial.init());

                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIImages({
                                        allowed: true,
                                        maxSquarePixelsPerRequest: 512,
                                        maxSquarePixelsPerPeriod: 2048,
                                        creditFeePerSquarePixel: 1,
                                    })
                            )
                    );

                    account1 = unwrap(
                        await financial.getOrCreateFinancialAccount({
                            userId: userId,
                            ledger: LEDGERS.credits,
                        })
                    ).account;

                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account1.id,
                                    amount: 10000n,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );
                });

                it('should charge the user for generating an image', async () => {
                    generateImageInterface.generateImage.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,

                                    // Should charge for 512 pixels * 1 = 512 credits
                                    debits_pending: 512n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                images: [
                                    {
                                        base64: 'base64',
                                        seed: 123,
                                        mimeType: 'image/png',
                                    },
                                ],
                            });
                        }
                    );

                    const result = await controller.generateImage({
                        prompt: 'test',
                        userId,
                        userSubscriptionTier,
                        width: 512,
                        height: 512,
                    });

                    expect(result).toEqual({
                        success: true,
                        images: [
                            {
                                base64: 'base64',
                                seed: 123,
                                mimeType: 'image/png',
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should charge the full fee
                            debits_posted: 512n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        generateImageInterface.generateImage
                    ).toHaveBeenCalled();
                });

                it('should charge based on total square pixels (max(width, height) * numberOfImages)', async () => {
                    generateImageInterface.generateImage.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,

                                    // Should charge for 256 * 2 images * 1 = 512 credits
                                    debits_pending: 512n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                images: [
                                    {
                                        base64: 'base64',
                                        seed: 123,
                                        mimeType: 'image/png',
                                    },
                                    {
                                        base64: 'base64',
                                        seed: 456,
                                        mimeType: 'image/png',
                                    },
                                ],
                            });
                        }
                    );

                    const result = await controller.generateImage({
                        prompt: 'test',
                        userId,
                        userSubscriptionTier,
                        width: 256,
                        height: 256,
                        numberOfImages: 2,
                    });

                    expect(result).toEqual({
                        success: true,
                        images: [
                            {
                                base64: 'base64',
                                seed: 123,
                                mimeType: 'image/png',
                            },
                            {
                                base64: 'base64',
                                seed: 456,
                                mimeType: 'image/png',
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 512n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        generateImageInterface.generateImage
                    ).toHaveBeenCalled();
                });

                it('should void the pending transfer if image generation fails', async () => {
                    generateImageInterface.generateImage.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 512n,
                                },
                            ]);

                            return Promise.resolve({
                                success: false,
                                errorCode: 'server_error',
                                errorMessage: 'Image generation failed',
                            });
                        }
                    );

                    const result = await controller.generateImage({
                        prompt: 'test',
                        userId,
                        userSubscriptionTier,
                        width: 512,
                        height: 512,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'Image generation failed',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should void the pending transfer
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        generateImageInterface.generateImage
                    ).toHaveBeenCalled();
                });

                it('should not create a pending transfer if creditFeePerSquarePixel is not configured', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIImages({
                                        allowed: true,
                                        maxSquarePixelsPerRequest: 512,
                                        maxSquarePixelsPerPeriod: 2048,
                                    })
                            )
                    );

                    generateImageInterface.generateImage.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 0n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                images: [
                                    {
                                        base64: 'base64',
                                        seed: 123,
                                        mimeType: 'image/png',
                                    },
                                ],
                            });
                        }
                    );

                    const result = await controller.generateImage({
                        prompt: 'test',
                        userId,
                        userSubscriptionTier,
                        width: 512,
                        height: 512,
                    });

                    expect(result).toEqual({
                        success: true,
                        images: [
                            {
                                base64: 'base64',
                                seed: 123,
                                mimeType: 'image/png',
                            },
                        ],
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        generateImageInterface.generateImage
                    ).toHaveBeenCalled();
                });

                it('should deny the request if the user does not have enough credits', async () => {
                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId: account1.id,
                                    creditAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    amount: 9950n,
                                    code: TransferCodes.admin_debit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );

                    const result = await controller.generateImage({
                        prompt: 'test',
                        userId,
                        userSubscriptionTier,
                        width: 512,
                        height: 512,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'insufficient_funds',
                        errorMessage: 'Insufficient funds to cover usage.',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 9950n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        generateImageInterface.generateImage
                    ).not.toHaveBeenCalled();
                });
            });
        });
    });

    describe('getHumeAccessToken()', () => {
        beforeEach(() => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features.withAllDefaultFeatures().withAI().withAIHume()
                    )
            );
        });

        it('should return the result from the hume interface', async () => {
            humeInterface.getAccessToken.mockResolvedValueOnce({
                success: true,
                accessToken: 'token',
                expiresIn: 3600,
                issuedAt: 1234567890,
                tokenType: 'Bearer',
            });

            const result = await controller.getHumeAccessToken({
                userId,
            });

            expect(result).toEqual({
                success: true,
                accessToken: 'token',
                expiresIn: 3600,
                issuedAt: 1234567890,
                tokenType: 'Bearer',
            });
        });

        it('should return errors that the hume interface returns', async () => {
            humeInterface.getAccessToken.mockResolvedValueOnce({
                success: false,
                errorCode: 'hume_api_error',
                errorMessage: 'Hume API Error',
            });

            const result = await controller.getHumeAccessToken({
                userId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'hume_api_error',
                errorMessage: 'Hume API Error',
            });
        });

        it('should return not_supported if hume isnt implemented', async () => {
            controller = new AIController({
                chat: null,
                generateSkybox: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                policies: null,
                openai: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.getHumeAccessToken({
                userId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });

        it('should return not_logged_in if the user isnt logged in', async () => {
            const result = await controller.getHumeAccessToken({
                userId: null,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in. Please provide a sessionKey.',
            });
        });

        it('should return not_authorized if the user isnt allowed to use hume', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features.withAllDefaultFeatures().withAI().withAIHume({
                            allowed: false,
                        })
                    )
            );

            const result = await controller.getHumeAccessToken({
                userId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'The subscription does not permit Hume AI features.',
            });
        });

        it('should return a not_authorized result if the user privacy features do not allow AI access', async () => {
            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                    },
                    options: {
                        defaultModel: 'default-model',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: ['test-tier'],
                        tokenModifierRatio: { default: 1.0 },
                    },
                },
                generateSkybox: {
                    interface: generateSkyboxInterface,
                    options: {
                        allowedSubscriptionTiers: true,
                    },
                },
                images: {
                    interfaces: {
                        openai: generateImageInterface,
                    },
                    options: {
                        defaultModel: 'openai',
                        defaultWidth: 512,
                        defaultHeight: 512,
                        maxWidth: 1024,
                        maxHeight: 1024,
                        maxSteps: 50,
                        maxImages: 3,
                        allowedModels: {
                            openai: ['openai'],
                            stabilityai: ['stable-diffusion-xl-1024-v1-0'],
                        },
                        allowedSubscriptionTiers: true,
                    },
                },
                hume: {
                    interface: humeInterface,
                    config: {
                        apiKey: 'apiKey',
                        secretKey: 'secretKey',
                    },
                },
                openai: null,
                sloyd: null,
                metrics: store,
                config: store,
                policies: store,
                policyController: policies,
                records: store,
            });

            humeInterface.getAccessToken.mockResolvedValueOnce({
                success: true,
                accessToken: 'token',
                expiresIn: 3600,
                issuedAt: 1234567890,
                tokenType: 'Bearer',
            });

            // const user = await store.findUser(userId);
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                privacyFeatures: {
                    allowAI: false,
                    allowPublicData: true,
                    allowPublicInsts: true,
                    publishData: true,
                },
            });

            const result = await controller.getHumeAccessToken({
                userId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'AI Access is not allowed',
            });
            expect(humeInterface.getAccessToken).not.toHaveBeenCalled();
        });

        describe('subscriptions', () => {
            beforeEach(async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.withUserDefaultFeatures((features) =>
                            features
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAIHume({
                                    allowed: true,
                                })
                        )
                );

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });
            });

            describe('billing', () => {
                let account1: Account;

                beforeEach(async () => {
                    // @ts-expect-error private access
                    controller._financial = financial;

                    unwrap(await financial.init());

                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.withUserDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume({
                                        allowed: true,
                                        creditFeePerToken: 100n,
                                    })
                            )
                    );

                    account1 = unwrap(
                        await financial.getOrCreateFinancialAccount({
                            userId: userId,
                            ledger: LEDGERS.credits,
                        })
                    ).account;

                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account1.id,
                                    amount: 10000n,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );
                });

                it('should charge the user for getting a Hume access token', async () => {
                    humeInterface.getAccessToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,

                                    // Should charge for creditFeePerToken
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                accessToken: 'token',
                                expiresIn: 3600,
                                issuedAt: 1234567890,
                                tokenType: 'Bearer',
                            });
                        }
                    );

                    const result = await controller.getHumeAccessToken({
                        userId,
                    });

                    expect(result).toEqual({
                        success: true,
                        accessToken: 'token',
                        expiresIn: 3600,
                        issuedAt: 1234567890,
                        tokenType: 'Bearer',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should charge the full fee
                            debits_posted: 100n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(humeInterface.getAccessToken).toHaveBeenCalled();
                });

                it('should void the pending transfer if token generation fails', async () => {
                    humeInterface.getAccessToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: false,
                                errorCode: 'hume_api_error',
                                errorMessage: 'Hume API Error',
                            });
                        }
                    );

                    const result = await controller.getHumeAccessToken({
                        userId,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'hume_api_error',
                        errorMessage: 'Hume API Error',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should void the pending transfer
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(humeInterface.getAccessToken).toHaveBeenCalled();
                });

                it('should not create a pending transfer if creditFeePerToken is not configured', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.withUserDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume({
                                        allowed: true,
                                    })
                            )
                    );

                    humeInterface.getAccessToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 0n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                accessToken: 'token',
                                expiresIn: 3600,
                                issuedAt: 1234567890,
                                tokenType: 'Bearer',
                            });
                        }
                    );

                    const result = await controller.getHumeAccessToken({
                        userId,
                    });

                    expect(result).toEqual({
                        success: true,
                        accessToken: 'token',
                        expiresIn: 3600,
                        issuedAt: 1234567890,
                        tokenType: 'Bearer',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(humeInterface.getAccessToken).toHaveBeenCalled();
                });

                it('should deny the request if the user does not have enough credits', async () => {
                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId: account1.id,
                                    creditAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    amount: 9950n,
                                    code: TransferCodes.admin_debit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );

                    const result = await controller.getHumeAccessToken({
                        userId,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'insufficient_funds',
                        errorMessage: 'Insufficient funds to cover usage.',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 9950n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(humeInterface.getAccessToken).not.toHaveBeenCalled();
                });
            });
        });

        describe('studio features', () => {
            const studioId = 'studioId';

            beforeEach(async () => {
                controller = new AIController({
                    chat: null,
                    generateSkybox: null,
                    images: null,
                    metrics: store,
                    config: store,
                    hume: {
                        interface: humeInterface,
                        config: null,
                    },
                    sloyd: null,
                    openai: null,
                    policies: null,
                    policyController: policies,
                    records: store,
                });

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.createStudioForUser(
                    {
                        id: studioId,
                        displayName: 'myStudio',
                        subscriptionId: 'sub1',
                        subscriptionStatus: 'active',
                    },
                    userId
                );

                await store.updateStudioHumeConfig(studioId, {
                    apiKey: 'apiKey',
                    secretKey: 'secretKey',
                });
            });

            it('should return not_authorized if the studio doesnt have hume features', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config
                            .withUserDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume()
                            )
                            .withStudioDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume({
                                        allowed: false,
                                    })
                            )
                );

                const result = await controller.getHumeAccessToken({
                    userId,
                    recordName: studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit Hume AI features.',
                });
            });

            it('should return invalid_request when the studio doesnt have a hume configuration', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config
                            .withUserDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume({
                                        allowed: false,
                                    })
                            )
                            .withStudioDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume()
                            )
                );

                await store.updateStudioHumeConfig(studioId, null);

                const result = await controller.getHumeAccessToken({
                    userId,
                    recordName: studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        'The studio does not have a Hume configuration.',
                });
            });

            it('should use the studios hume configuration', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config
                            .withUserDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume({
                                        allowed: false,
                                    })
                            )
                            .withStudioDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume()
                            )
                );

                humeInterface.getAccessToken.mockResolvedValueOnce({
                    success: true,
                    accessToken: 'token',
                    expiresIn: 3600,
                    issuedAt: 1234567890,
                    tokenType: 'Bearer',
                });

                await store.updateStudioHumeConfig(studioId, {
                    apiKey: 'studioApiKey',
                    secretKey: 'studioSecretKey',
                });

                const result = await controller.getHumeAccessToken({
                    userId,
                    recordName: studioId,
                });

                expect(result).toEqual({
                    success: true,
                    accessToken: 'token',
                    expiresIn: 3600,
                    issuedAt: 1234567890,
                    tokenType: 'Bearer',
                });
                expect(humeInterface.getAccessToken).toHaveBeenCalledWith({
                    apiKey: 'studioApiKey',
                    secretKey: 'studioSecretKey',
                });
            });

            it('should use global configuration if the studio doesnt have a configuration', async () => {
                controller = new AIController({
                    chat: null,
                    generateSkybox: null,
                    images: null,
                    metrics: store,
                    config: store,
                    hume: {
                        interface: humeInterface,
                        config: {
                            apiKey: 'globalApiKey',
                            secretKey: 'globalSecretKey',
                        },
                    },
                    sloyd: null,
                    openai: null,
                    policies: null,
                    policyController: policies,
                    records: store,
                });

                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config
                            .withUserDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume({
                                        allowed: false,
                                    })
                            )
                            .withStudioDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withAI()
                                    .withAIHume()
                            )
                );

                humeInterface.getAccessToken.mockResolvedValueOnce({
                    success: true,
                    accessToken: 'token',
                    expiresIn: 3600,
                    issuedAt: 1234567890,
                    tokenType: 'Bearer',
                });

                await store.updateStudioHumeConfig(studioId, null);

                const result = await controller.getHumeAccessToken({
                    userId,
                    recordName: studioId,
                });

                expect(result).toEqual({
                    success: true,
                    accessToken: 'token',
                    expiresIn: 3600,
                    issuedAt: 1234567890,
                    tokenType: 'Bearer',
                });
                expect(humeInterface.getAccessToken).toHaveBeenCalledWith({
                    apiKey: 'globalApiKey',
                    secretKey: 'globalSecretKey',
                });
            });

            describe('billing', () => {
                let account1: Account;

                beforeEach(async () => {
                    // @ts-expect-error private access
                    controller._financial = financial;

                    unwrap(await financial.init());

                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config
                                .withUserDefaultFeatures((features) =>
                                    features
                                        .withAllDefaultFeatures()
                                        .withAI()
                                        .withAIHume({
                                            allowed: false,
                                        })
                                )
                                .addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withAI()
                                        .withAIHume({
                                            allowed: true,
                                            creditFeePerToken: 100n,
                                        })
                                )
                    );

                    account1 = unwrap(
                        await financial.getOrCreateFinancialAccount({
                            studioId: studioId,
                            ledger: LEDGERS.credits,
                        })
                    ).account;

                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account1.id,
                                    amount: 10000n,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );
                });

                it('should charge the studio for getting a Hume access token', async () => {
                    humeInterface.getAccessToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,

                                    // Should charge for creditFeePerToken
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                accessToken: 'token',
                                expiresIn: 3600,
                                issuedAt: 1234567890,
                                tokenType: 'Bearer',
                            });
                        }
                    );

                    const result = await controller.getHumeAccessToken({
                        userId,
                        recordName: studioId,
                    });

                    expect(result).toEqual({
                        success: true,
                        accessToken: 'token',
                        expiresIn: 3600,
                        issuedAt: 1234567890,
                        tokenType: 'Bearer',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should charge the full fee
                            debits_posted: 100n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(humeInterface.getAccessToken).toHaveBeenCalled();
                });

                it('should void the pending transfer if token generation fails', async () => {
                    humeInterface.getAccessToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: false,
                                errorCode: 'hume_api_error',
                                errorMessage: 'Hume API Error',
                            });
                        }
                    );

                    const result = await controller.getHumeAccessToken({
                        userId,
                        recordName: studioId,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'hume_api_error',
                        errorMessage: 'Hume API Error',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should void the pending transfer
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(humeInterface.getAccessToken).toHaveBeenCalled();
                });

                it('should not create a pending transfer if creditFeePerToken is not configured', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config
                                .withUserDefaultFeatures((features) =>
                                    features
                                        .withAllDefaultFeatures()
                                        .withAI()
                                        .withAIHume({
                                            allowed: false,
                                        })
                                )
                                .addSubscription('sub1', (sub) =>
                                    sub
                                        .withTier('tier1')
                                        .withAllDefaultFeatures()
                                        .withAI()
                                        .withAIHume({
                                            allowed: true,
                                        })
                                )
                    );

                    humeInterface.getAccessToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 0n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                accessToken: 'token',
                                expiresIn: 3600,
                                issuedAt: 1234567890,
                                tokenType: 'Bearer',
                            });
                        }
                    );

                    const result = await controller.getHumeAccessToken({
                        userId,
                        recordName: studioId,
                    });

                    expect(result).toEqual({
                        success: true,
                        accessToken: 'token',
                        expiresIn: 3600,
                        issuedAt: 1234567890,
                        tokenType: 'Bearer',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(humeInterface.getAccessToken).toHaveBeenCalled();
                });

                it('should deny the request if the studio does not have enough credits', async () => {
                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId: account1.id,
                                    creditAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    amount: 9950n,
                                    code: TransferCodes.admin_debit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );

                    const result = await controller.getHumeAccessToken({
                        userId,
                        recordName: studioId,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'insufficient_funds',
                        errorMessage: 'Insufficient funds to cover usage.',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 9950n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(humeInterface.getAccessToken).not.toHaveBeenCalled();
                });
            });
        });
    });

    describe('sloydGenerateModel()', () => {
        const studioId = 'studioId';
        const otherUserId = 'otherUserId';
        beforeEach(async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config
                        .withUserDefaultFeatures((features) =>
                            features
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAISloyd()
                        )
                        .addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAI()
                                .withAISloyd()
                        )
            );

            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.createStudioForUser(
                {
                    id: studioId,
                    displayName: 'studio',
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                },
                userId
            );

            await store.saveUser({
                id: otherUserId,
                email: 'other@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudioAssignment({
                studioId: studioId,
                userId: otherUserId,
                isPrimaryContact: false,
                role: 'member',
            });
        });

        it('should call the sloyd interface', async () => {
            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
                name: 'model name',
            });

            const result = await controller.sloydGenerateModel({
                userId,
                recordName: userId,
                outputMimeType: 'model/gltf+json',
                prompt: 'test',
                levelOfDetail: 1,
            });

            expect(result).toEqual({
                success: true,
                modelId: 'modelId',
                mimeType: 'model/gltf+json',
                confidence: 0.5,
                name: 'model name',
                modelData: 'json',
            });

            expect(store.aiSloydMetrics).toEqual([
                {
                    modelId: 'modelId',
                    mimeType: 'model/gltf+json',
                    confidence: 0.5,
                    userId: userId,
                    createdAtMs: expect.any(Number),
                    name: 'model name',
                    modelData: 'json',
                    modelsCreated: 1,
                },
            ]);
        });

        it('should support binary results', async () => {
            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                modelMimeType: 'model/gltf-binary',
                modelData: new Uint8Array([123, 255, 0, 37]),
                name: 'model name',
            });

            const result = await controller.sloydGenerateModel({
                userId,
                recordName: userId,
                outputMimeType: 'model/gltf-binary',
                prompt: 'test',
                levelOfDetail: 1,
            });

            expect(result).toEqual({
                success: true,
                modelId: 'modelId',
                mimeType: 'model/gltf-binary',
                confidence: 0.5,
                name: 'model name',
                modelData: fromByteArray(new Uint8Array([123, 255, 0, 37])),
            });

            expect(store.aiSloydMetrics).toEqual([
                {
                    modelId: 'modelId',
                    mimeType: 'model/gltf-binary',
                    confidence: 0.5,
                    userId: userId,
                    createdAtMs: expect.any(Number),
                    name: 'model name',
                    modelData: fromByteArray(new Uint8Array([123, 255, 0, 37])),
                    modelsCreated: 1,
                },
            ]);
        });

        it('should call the sloyd edit interface if given a previous model ID', async () => {
            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
                name: 'model name',
            });
            sloydInterface.editModel.mockResolvedValueOnce({
                success: true,
                interactionId: 'modelId',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
            });

            const result = await controller.sloydGenerateModel({
                userId,
                recordName: userId,
                outputMimeType: 'model/gltf+json',
                prompt: 'test',
                levelOfDetail: 1,
                baseModelId: 'baseModelId',
            });

            expect(result).toEqual({
                success: true,
                modelId: 'modelId',
                mimeType: 'model/gltf+json',
                modelData: 'json',
            });

            expect(store.aiSloydMetrics).toEqual([
                {
                    modelId: 'modelId',
                    mimeType: 'model/gltf+json',
                    userId: userId,
                    createdAtMs: expect.any(Number),
                    modelData: 'json',
                    baseModelId: 'baseModelId',
                    modelsCreated: 1,
                },
            ]);

            expect(sloydInterface.editModel).toHaveBeenCalledWith({
                interactionId: 'baseModelId',
                levelOfDetail: 1,
                prompt: 'test',
                modelMimeType: 'model/gltf+json',
            });
        });

        it('should return not_authorized if the user doesnt have access to sloyd features', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features.withAllDefaultFeatures().withAI().withAISloyd({
                            allowed: false,
                        })
                    )
            );

            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                name: 'model name',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
            });

            const result = await controller.sloydGenerateModel({
                userId,
                recordName: userId,
                outputMimeType: 'model/gltf+json',
                prompt: 'test',
                levelOfDetail: 1,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'The subscription does not permit Sloyd AI features.',
            });

            expect(store.aiSloydMetrics).toEqual([]);
        });

        it('should return subscription_limit_reached if the user has too many model requests', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features.withAllDefaultFeatures().withAI().withAISloyd({
                            allowed: true,
                            maxModelsPerPeriod: 1,
                        })
                    )
            );

            store.aiSloydMetrics.push({
                modelId: 'modelId2',
                mimeType: 'model/gltf+json',
                confidence: 0.5,
                userId: userId,
                createdAtMs: Date.now(),
                name: 'model name',
                modelData: 'json',
                modelsCreated: 1,
            });

            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                name: 'model name',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
            });

            const result = await controller.sloydGenerateModel({
                userId,
                recordName: userId,
                outputMimeType: 'model/gltf+json',
                prompt: 'test',
                levelOfDetail: 1,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The request exceeds allowed subscription limits.',
            });

            expect(sloydInterface.createModel).not.toHaveBeenCalled();
            // expect(store.aiSloydMetrics).toEqual([]);
        });

        it('should return not_logged_in if the user is not logged in', async () => {
            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                name: 'model name',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
            });

            const result = await controller.sloydGenerateModel({
                userId: null,
                recordName: userId,
                prompt: 'test',
                outputMimeType: 'model/gltf+json',
                levelOfDetail: 1,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in. Please provide a sessionKey.',
            });

            expect(store.aiSloydMetrics).toEqual([]);
        });

        it('should be able to use the studio for the given record', async () => {
            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                name: 'model name',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
            });

            const result = await controller.sloydGenerateModel({
                userId,
                recordName: studioId,
                outputMimeType: 'model/gltf+json',
                prompt: 'test',
                levelOfDetail: 1,
            });

            expect(result).toEqual({
                success: true,
                modelId: 'modelId',
                mimeType: 'model/gltf+json',
                confidence: 0.5,
                name: 'model name',
                modelData: 'json',
            });

            expect(store.aiSloydMetrics).toEqual([
                {
                    modelId: 'modelId',
                    mimeType: 'model/gltf+json',
                    confidence: 0.5,
                    studioId,
                    createdAtMs: expect.any(Number),
                    name: 'model name',
                    modelData: 'json',
                    modelsCreated: 1,
                },
            ]);
        });

        it('should allow users given access to ai.sloyd resources to create models', async () => {
            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                name: 'model name',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
            });

            const permissionResult = await policies.grantMarkerPermission({
                recordKeyOrRecordName: studioId,
                userId: userId,
                marker: PUBLIC_READ_MARKER,
                permission: {
                    resourceKind: 'ai.sloyd',
                    action: 'create',
                    expireTimeMs: null,
                    options: {},
                    subjectType: 'user',
                    subjectId: otherUserId,
                    marker: PUBLIC_READ_MARKER,
                },
            });

            expect(permissionResult).toMatchObject({
                success: true,
            });

            const result = await controller.sloydGenerateModel({
                userId: otherUserId,
                recordName: studioId,
                outputMimeType: 'model/gltf+json',
                prompt: 'test',
                levelOfDetail: 1,
            });

            expect(result).toEqual({
                success: true,
                modelId: 'modelId',
                mimeType: 'model/gltf+json',
                confidence: 0.5,
                name: 'model name',
                modelData: 'json',
            });

            expect(store.aiSloydMetrics).toEqual([
                {
                    modelId: 'modelId',
                    mimeType: 'model/gltf+json',
                    confidence: 0.5,
                    studioId: studioId,
                    createdAtMs: expect.any(Number),
                    name: 'model name',
                    modelData: 'json',
                    modelsCreated: 1,
                },
            ]);
        });

        it('should return not_authorized if the user is not authorized to access the ai.sloyd resource', async () => {
            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                name: 'model name',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
            });

            const result = await controller.sloydGenerateModel({
                userId: otherUserId,
                recordName: studioId,
                outputMimeType: 'model/gltf+json',
                prompt: 'test',
                levelOfDetail: 1,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    resourceKind: 'ai.sloyd',
                    action: 'create',
                    recordName: studioId,
                    subjectId: otherUserId,
                    subjectType: 'user',
                },
            });

            expect(store.aiSloydMetrics).toEqual([]);
        });

        it('should return errors that the sloyd interface returns', async () => {
            sloydInterface.createModel.mockResolvedValueOnce({
                success: false,
                errorCode: 'server_error',
                errorMessage: 'Server Error',
            });

            const result = await controller.sloydGenerateModel({
                userId,
                recordName: userId,
                outputMimeType: 'model/gltf+json',
                prompt: 'test',
                levelOfDetail: 1,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'server_error',
                errorMessage: 'Server Error',
            });

            expect(store.aiSloydMetrics).toEqual([]);
        });

        it('should return a not_authorized result if the user privacy features do not allow AI access', async () => {
            controller = new AIController({
                chat: {
                    interfaces: {
                        provider1: chatInterface,
                    },
                    options: {
                        defaultModel: 'default-model',
                        defaultModelProvider: 'provider1',
                        allowedChatModels: [
                            {
                                provider: 'provider1',
                                model: 'test-model1',
                            },
                            {
                                provider: 'provider1',
                                model: 'test-model2',
                            },
                        ],
                        allowedChatSubscriptionTiers: ['test-tier'],
                        tokenModifierRatio: { default: 1.0 },
                    },
                },
                generateSkybox: {
                    interface: generateSkyboxInterface,
                    options: {
                        allowedSubscriptionTiers: true,
                    },
                },
                images: {
                    interfaces: {
                        openai: generateImageInterface,
                    },
                    options: {
                        defaultModel: 'openai',
                        defaultWidth: 512,
                        defaultHeight: 512,
                        maxWidth: 1024,
                        maxHeight: 1024,
                        maxSteps: 50,
                        maxImages: 3,
                        allowedModels: {
                            openai: ['openai'],
                            stabilityai: ['stable-diffusion-xl-1024-v1-0'],
                        },
                        allowedSubscriptionTiers: true,
                    },
                },
                hume: {
                    interface: humeInterface,
                    config: {
                        apiKey: 'apiKey',
                        secretKey: 'secretKey',
                    },
                },
                sloyd: {
                    interface: sloydInterface,
                },
                openai: null,
                metrics: store,
                config: store,
                policies: store,
                policyController: policies,
                records: store,
            });

            sloydInterface.createModel.mockResolvedValueOnce({
                success: true,
                confidenceScore: 0.5,
                interactionId: 'modelId',
                modelMimeType: 'model/gltf+json',
                modelData: 'json',
                name: 'model name',
            });

            // const user = await store.findUser(userId);
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                privacyFeatures: {
                    allowAI: false,
                    allowPublicData: true,
                    allowPublicInsts: true,
                    publishData: true,
                },
            });

            const result = await controller.sloydGenerateModel({
                recordName: userId,
                outputMimeType: 'model/gltf+json',
                prompt: 'test',
                userId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'AI Access is not allowed',
            });
            expect(sloydInterface.createModel).not.toHaveBeenCalled();
        });
    });

    describe('createOpenAIRealtimeSessionToken()', () => {
        beforeEach(() => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features
                            .withAllDefaultFeatures()
                            .withAI()
                            .withAIOpenAI()
                    )
            );
        });

        it('should return not_supported if openai realtime isnt implemented', async () => {
            controller = new AIController({
                chat: null,
                generateSkybox: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
                policies: null,
                openai: null,
                policyController: policies,
                records: store,
            });

            const result = await controller.createOpenAIRealtimeSessionToken({
                userId,
                recordName: userId,
                request: {
                    model: 'test-model',
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
            expect(
                realtimeInterface.createRealtimeSessionToken
            ).not.toHaveBeenCalled();
        });

        it('should return the result from the realtime interface', async () => {
            realtimeInterface.createRealtimeSessionToken.mockResolvedValueOnce({
                success: true,
                sessionId: 'sessionId',
                clientSecret: {
                    value: 'secret',
                    expiresAt: 999,
                },
            });

            const result = await controller.createOpenAIRealtimeSessionToken({
                userId,
                recordName: userId,
                request: {
                    model: 'test-model',
                },
            });

            expect(result).toEqual({
                success: true,
                sessionId: 'sessionId',
                clientSecret: {
                    value: 'secret',
                    expiresAt: 999,
                },
            });

            expect(
                realtimeInterface.createRealtimeSessionToken
            ).toHaveBeenCalledWith({
                model: 'test-model',
            });

            expect(store.aiOpenAIRealtimeMetrics).toEqual([
                {
                    userId: userId,
                    createdAtMs: expect.any(Number),
                    sessionId: expect.any(String),
                    request: {
                        model: 'test-model',
                    },
                },
            ]);
        });

        it('should return not_authorized if the user doesnt have access to openai realtime features', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features
                            .withAllDefaultFeatures()
                            .withAI()
                            .withAIOpenAI({
                                realtime: {
                                    allowed: false,
                                },
                            })
                    )
            );

            realtimeInterface.createRealtimeSessionToken.mockResolvedValueOnce({
                success: true,
                sessionId: 'sessionId',
                clientSecret: {
                    value: 'secret',
                    expiresAt: 999,
                },
            });

            const result = await controller.createOpenAIRealtimeSessionToken({
                userId,
                recordName: userId,
                request: {
                    model: 'test-model',
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'The subscription does not permit OpenAI Realtime features.',
            });

            expect(
                realtimeInterface.createRealtimeSessionToken
            ).not.toHaveBeenCalled();
        });

        it('should return subscription_limit_reached if the user has too many session requests', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features
                            .withAllDefaultFeatures()
                            .withAI()
                            .withAIOpenAI({
                                realtime: {
                                    allowed: true,
                                    maxSessionsPerPeriod: 1,
                                },
                            })
                    )
            );

            realtimeInterface.createRealtimeSessionToken.mockResolvedValueOnce({
                success: true,
                sessionId: 'sessionId',
                clientSecret: {
                    value: 'secret',
                    expiresAt: 999,
                },
            });

            await store.recordOpenAIRealtimeMetrics({
                userId,
                sessionId: 'sessionId',
                createdAtMs: Date.now(),
                request: {
                    model: 'test-model',
                },
            });

            const result = await controller.createOpenAIRealtimeSessionToken({
                userId,
                recordName: userId,
                request: {
                    model: 'test-model2',
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The request exceeds allowed subscription limits.',
            });

            expect(
                realtimeInterface.createRealtimeSessionToken
            ).not.toHaveBeenCalled();
        });

        it('should return subscription_limit_reached if the user requests a model that they dont have access to', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features
                            .withAllDefaultFeatures()
                            .withAI()
                            .withAIOpenAI({
                                realtime: {
                                    allowed: true,
                                    allowedModels: ['test-model'],
                                },
                            })
                    )
            );

            realtimeInterface.createRealtimeSessionToken.mockResolvedValueOnce({
                success: true,
                sessionId: 'sessionId',
                clientSecret: {
                    value: 'secret',
                    expiresAt: 999,
                },
            });

            const result = await controller.createOpenAIRealtimeSessionToken({
                userId,
                recordName: userId,
                request: {
                    model: 'wrong-model',
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    "The subscription doesn't support the given model.",
            });

            expect(
                realtimeInterface.createRealtimeSessionToken
            ).not.toHaveBeenCalled();
        });

        describe('studio features', () => {
            const studioId = 'studioId';

            beforeEach(async () => {
                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.createStudioForUser(
                    {
                        id: studioId,
                        displayName: 'myStudio',
                        subscriptionId: 'sub1',
                        subscriptionStatus: 'active',
                    },
                    userId
                );

                await store.updateStudioHumeConfig(studioId, {
                    apiKey: 'apiKey',
                    secretKey: 'secretKey',
                });
            });

            it('should be able to make requests for a studio', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub.withAIOpenAI({
                                realtime: {
                                    allowed: true,
                                },
                            })
                        )
                );

                realtimeInterface.createRealtimeSessionToken.mockResolvedValueOnce(
                    {
                        success: true,
                        sessionId: 'sessionId',
                        clientSecret: {
                            value: 'secret',
                            expiresAt: 999,
                        },
                    }
                );

                const result =
                    await controller.createOpenAIRealtimeSessionToken({
                        userId,
                        recordName: studioId,
                        request: {
                            model: 'test-model',
                        },
                    });

                expect(result).toEqual({
                    success: true,
                    sessionId: 'sessionId',
                    clientSecret: {
                        value: 'secret',
                        expiresAt: 999,
                    },
                });

                expect(
                    realtimeInterface.createRealtimeSessionToken
                ).toHaveBeenCalledWith({
                    model: 'test-model',
                });

                expect(store.aiOpenAIRealtimeMetrics).toEqual([
                    {
                        studioId,
                        createdAtMs: expect.any(Number),
                        sessionId: 'sessionId',
                        request: {
                            model: 'test-model',
                        },
                    },
                ]);
            });

            it('should return not_authorized if the studio doesnt have access to openai realtime features', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.withStudioDefaultFeatures((features) =>
                            features.withAllDefaultFeatures().withAIOpenAI({
                                realtime: {
                                    allowed: false,
                                },
                            })
                        )
                );

                realtimeInterface.createRealtimeSessionToken.mockResolvedValueOnce(
                    {
                        success: true,
                        sessionId: 'sessionId',
                        clientSecret: {
                            value: 'secret',
                            expiresAt: 999,
                        },
                    }
                );

                const result =
                    await controller.createOpenAIRealtimeSessionToken({
                        userId,
                        recordName: studioId,
                        request: {
                            model: 'test-model',
                        },
                    });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit OpenAI Realtime features.',
                });

                expect(
                    realtimeInterface.createRealtimeSessionToken
                ).not.toHaveBeenCalled();
            });

            describe('billing', () => {
                let account1: Account;

                beforeEach(async () => {
                    // @ts-expect-error private access
                    controller._financial = financial;

                    unwrap(await financial.init());

                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAIOpenAI({
                                        realtime: {
                                            allowed: true,
                                            maxSessionsPerPeriod: 4,
                                            creditFeePerRealtimeSession: 100,
                                        },
                                    })
                            )
                    );

                    account1 = unwrap(
                        await financial.getOrCreateFinancialAccount({
                            studioId: studioId,
                            ledger: LEDGERS.credits,
                        })
                    ).account;

                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account1.id,
                                    amount: 10000n,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );
                });

                it('should charge the studio for creating a realtime session token', async () => {
                    realtimeInterface.createRealtimeSessionToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,

                                    // Should charge for creditFeePerRealtimeSession
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                sessionId: 'sessionId',
                                clientSecret: {
                                    value: 'secret',
                                    expiresAt: 999,
                                },
                            });
                        }
                    );

                    const result =
                        await controller.createOpenAIRealtimeSessionToken({
                            userId,
                            recordName: studioId,
                            request: {
                                model: 'test-model',
                            },
                        });

                    expect(result).toEqual({
                        success: true,
                        sessionId: 'sessionId',
                        clientSecret: {
                            value: 'secret',
                            expiresAt: 999,
                        },
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should charge the full fee
                            debits_posted: 100n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        realtimeInterface.createRealtimeSessionToken
                    ).toHaveBeenCalled();
                });

                it('should void the pending transfer if session token creation fails', async () => {
                    realtimeInterface.createRealtimeSessionToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: false,
                                errorCode: 'server_error',
                                errorMessage: 'Session token creation failed',
                            });
                        }
                    );

                    const result =
                        await controller.createOpenAIRealtimeSessionToken({
                            userId,
                            recordName: studioId,
                            request: {
                                model: 'test-model',
                            },
                        });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'Session token creation failed',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should void the pending transfer
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        realtimeInterface.createRealtimeSessionToken
                    ).toHaveBeenCalled();
                });

                it('should not create a pending transfer if creditFeePerRealtimeSession is not configured', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAIOpenAI({
                                        realtime: {
                                            allowed: true,
                                            maxSessionsPerPeriod: 4,
                                        },
                                    })
                            )
                    );

                    realtimeInterface.createRealtimeSessionToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 0n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                sessionId: 'sessionId',
                                clientSecret: {
                                    value: 'secret',
                                    expiresAt: 999,
                                },
                            });
                        }
                    );

                    const result =
                        await controller.createOpenAIRealtimeSessionToken({
                            userId,
                            recordName: studioId,
                            request: {
                                model: 'test-model',
                            },
                        });

                    expect(result).toEqual({
                        success: true,
                        sessionId: 'sessionId',
                        clientSecret: {
                            value: 'secret',
                            expiresAt: 999,
                        },
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        realtimeInterface.createRealtimeSessionToken
                    ).toHaveBeenCalled();
                });

                it('should deny the request if the studio does not have enough credits', async () => {
                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId: account1.id,
                                    creditAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    amount: 9950n,
                                    code: TransferCodes.admin_debit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );

                    const result =
                        await controller.createOpenAIRealtimeSessionToken({
                            userId,
                            recordName: studioId,
                            request: {
                                model: 'test-model',
                            },
                        });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'insufficient_funds',
                        errorMessage: 'Insufficient funds to cover usage.',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 9950n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        realtimeInterface.createRealtimeSessionToken
                    ).not.toHaveBeenCalled();
                });
            });
        });

        describe('subscriptions', () => {
            beforeEach(async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAIOpenAI({
                                    realtime: {
                                        allowed: true,
                                        maxSessionsPerPeriod: 4,
                                    },
                                })
                        )
                );

                await store.saveUser({
                    id: userId,
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });
            });

            it('should reject the request if the feature is not allowed', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withAIOpenAI({
                                    realtime: {
                                        allowed: false,
                                    },
                                })
                        )
                );

                realtimeInterface.createRealtimeSessionToken.mockResolvedValueOnce(
                    {
                        success: true,
                        sessionId: 'sessionId',
                        clientSecret: {
                            value: 'secret',
                            expiresAt: 999,
                        },
                    }
                );

                const result =
                    await controller.createOpenAIRealtimeSessionToken({
                        userId,
                        recordName: userId,
                        request: {
                            model: 'test-model',
                        },
                    });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit OpenAI Realtime features.',
                });
                expect(
                    realtimeInterface.createRealtimeSessionToken
                ).not.toHaveBeenCalled();
            });

            it('should reject the request if it would exceed the subscription period limits', async () => {
                realtimeInterface.createRealtimeSessionToken.mockResolvedValueOnce(
                    {
                        success: true,
                        sessionId: 'sessionId',
                        clientSecret: {
                            value: 'secret',
                            expiresAt: 999,
                        },
                    }
                );

                await store.recordOpenAIRealtimeMetrics({
                    createdAtMs: Date.now(),
                    userId: userId,
                    sessionId: 'sessionId1',
                    request: {
                        model: 'test-model',
                    },
                });
                await store.recordOpenAIRealtimeMetrics({
                    createdAtMs: Date.now(),
                    userId: userId,
                    sessionId: 'sessionId2',
                    request: {
                        model: 'test-model',
                    },
                });
                await store.recordOpenAIRealtimeMetrics({
                    createdAtMs: Date.now(),
                    userId: userId,
                    sessionId: 'sessionId3',
                    request: {
                        model: 'test-model',
                    },
                });
                await store.recordOpenAIRealtimeMetrics({
                    createdAtMs: Date.now(),
                    userId: userId,
                    sessionId: 'sessionId4',
                    request: {
                        model: 'test-model',
                    },
                });

                const result =
                    await controller.createOpenAIRealtimeSessionToken({
                        userId,
                        recordName: userId,
                        request: {
                            model: 'test-model',
                        },
                    });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The request exceeds allowed subscription limits.',
                });
                expect(
                    realtimeInterface.createRealtimeSessionToken
                ).not.toHaveBeenCalled();
            });

            describe('billing', () => {
                let account1: Account;

                beforeEach(async () => {
                    // @ts-expect-error private access
                    controller._financial = financial;

                    unwrap(await financial.init());

                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAIOpenAI({
                                        realtime: {
                                            allowed: true,
                                            maxSessionsPerPeriod: 4,
                                            creditFeePerRealtimeSession: 100,
                                        },
                                    })
                            )
                    );

                    account1 = unwrap(
                        await financial.getOrCreateFinancialAccount({
                            userId: userId,
                            ledger: LEDGERS.credits,
                        })
                    ).account;

                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account1.id,
                                    amount: 10000n,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );
                });

                it('should charge the user for creating a realtime session token', async () => {
                    realtimeInterface.createRealtimeSessionToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,

                                    // Should charge for creditFeePerRealtimeSession
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                sessionId: 'sessionId',
                                clientSecret: {
                                    value: 'secret',
                                    expiresAt: 999,
                                },
                            });
                        }
                    );

                    const result =
                        await controller.createOpenAIRealtimeSessionToken({
                            userId,
                            recordName: userId,
                            request: {
                                model: 'test-model',
                            },
                        });

                    expect(result).toEqual({
                        success: true,
                        sessionId: 'sessionId',
                        clientSecret: {
                            value: 'secret',
                            expiresAt: 999,
                        },
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should charge the full fee
                            debits_posted: 100n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        realtimeInterface.createRealtimeSessionToken
                    ).toHaveBeenCalled();
                });

                it('should void the pending transfer if session token creation fails', async () => {
                    realtimeInterface.createRealtimeSessionToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 100n,
                                },
                            ]);

                            return Promise.resolve({
                                success: false,
                                errorCode: 'server_error',
                                errorMessage: 'Session token creation failed',
                            });
                        }
                    );

                    const result =
                        await controller.createOpenAIRealtimeSessionToken({
                            userId,
                            recordName: userId,
                            request: {
                                model: 'test-model',
                            },
                        });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'Session token creation failed',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,

                            // Should void the pending transfer
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        realtimeInterface.createRealtimeSessionToken
                    ).toHaveBeenCalled();
                });

                it('should not create a pending transfer if creditFeePerRealtimeSession is not configured', async () => {
                    store.subscriptionConfiguration = buildSubscriptionConfig(
                        (config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub
                                    .withTier('tier1')
                                    .withAllDefaultFeatures()
                                    .withAIOpenAI({
                                        realtime: {
                                            allowed: true,
                                            maxSessionsPerPeriod: 4,
                                        },
                                    })
                            )
                    );

                    realtimeInterface.createRealtimeSessionToken.mockImplementationOnce(
                        async () => {
                            await checkAccounts(financialInterface, [
                                {
                                    id: account1.id,
                                    credits_posted: 10000n,
                                    credits_pending: 0n,
                                    debits_posted: 0n,
                                    debits_pending: 0n,
                                },
                            ]);

                            return Promise.resolve({
                                success: true,
                                sessionId: 'sessionId',
                                clientSecret: {
                                    value: 'secret',
                                    expiresAt: 999,
                                },
                            });
                        }
                    );

                    const result =
                        await controller.createOpenAIRealtimeSessionToken({
                            userId,
                            recordName: userId,
                            request: {
                                model: 'test-model',
                            },
                        });

                    expect(result).toEqual({
                        success: true,
                        sessionId: 'sessionId',
                        clientSecret: {
                            value: 'secret',
                            expiresAt: 999,
                        },
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        realtimeInterface.createRealtimeSessionToken
                    ).toHaveBeenCalled();
                });

                it('should deny the request if the user does not have enough credits', async () => {
                    unwrap(
                        await financial.internalTransaction({
                            transfers: [
                                {
                                    debitAccountId: account1.id,
                                    creditAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    amount: 9950n,
                                    code: TransferCodes.admin_debit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );

                    const result =
                        await controller.createOpenAIRealtimeSessionToken({
                            userId,
                            recordName: userId,
                            request: {
                                model: 'test-model',
                            },
                        });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'insufficient_funds',
                        errorMessage: 'Insufficient funds to cover usage.',
                    });

                    await checkAccounts(financialInterface, [
                        {
                            id: account1.id,
                            credits_posted: 10000n,
                            credits_pending: 0n,
                            debits_posted: 9950n,
                            debits_pending: 0n,
                        },
                    ]);
                    expect(
                        realtimeInterface.createRealtimeSessionToken
                    ).not.toHaveBeenCalled();
                });
            });
        });
    });
});
