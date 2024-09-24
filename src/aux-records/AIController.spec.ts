import {
    AIChatInterface,
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIChatInterfaceStreamResponse,
} from './AIChatInterface';
import {
    AIGenerateSkyboxInterfaceResponse,
    AIGenerateSkyboxInterfaceRequest,
    AIGetSkyboxInterfaceResponse,
} from './AIGenerateSkyboxInterface';
import {
    AIGenerateImageInterfaceRequest,
    AIGenerateImageInterfaceResponse,
} from './AIImageInterface';
import { AIController } from './AIController';
import { MemoryStore } from './MemoryStore';
import {
    asyncIterable,
    asyncIterator,
    createTestControllers,
    unwindAndCaptureAsync,
} from './TestUtils';
import {
    FeaturesConfiguration,
    SubscriptionConfiguration,
    allowAllFeatures,
} from './SubscriptionConfiguration';
import { merge } from 'lodash';
import { unwind } from '../js-interpreter/InterpreterUtils';
import { AIHumeInterfaceGetAccessTokenResult } from './AIHumeInterface';
import {
    AISloydInterfaceCreateModelRequest,
    AISloydInterfaceCreateModelResponse,
    AISloydInterfaceEditModelRequest,
    AISloydInterfaceEditModelResponse,
} from './AISloydInterface';
import { PolicyController } from './PolicyController';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import { fromByteArray } from 'base64-js';
import { buildSubscriptionConfig } from './SubscriptionConfigBuilder';

console.log = jest.fn();

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
    let userId: string;
    let userSubscriptionTier: string;
    let store: MemoryStore;
    let policies: PolicyController;

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

        const services = createTestControllers(null);
        store = services.store;
        policies = services.policies;

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
                    ],
                    allowedChatSubscriptionTiers: ['test-tier'],
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
            expect(chatInterface.chat).toBeCalledWith({
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
            expect(chatInterface2.chat).toBeCalledWith({
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
            expect(chatInterface.chat).toBeCalledWith({
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
            expect(chatInterface.chat).not.toBeCalled();
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
            expect(chatInterface.chat).not.toBeCalled();
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
            expect(chatInterface.chat).not.toBeCalled();
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
            expect(chatInterface.chat).not.toBeCalled();
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
                    },
                },
                generateSkybox: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
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
            expect(chatInterface.chat).toBeCalledWith({
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
            expect(chatInterface.chat).toBeCalledWith({
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

            expect(metrics).toEqual({
                ownerId: userId,
                subscriptionStatus: null,
                subscriptionId: null,
                subscriptionType: 'user',
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalTokensInCurrentPeriod: 123,
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
                expect(chatInterface.chat).toBeCalledWith({
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
                expect(chatInterface.chat).toBeCalledWith({
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
                expect(chatInterface.chat).not.toBeCalled();

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
                expect(chatInterface.chat).not.toBeCalled();
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
            expect(chatInterface.chatStream).toBeCalledWith({
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
            expect(chatInterface2.chatStream).toBeCalledWith({
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
            expect(chatInterface.chatStream).toBeCalledWith({
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
            expect(chatInterface.chatStream).not.toBeCalled();
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
            expect(chatInterface.chatStream).not.toBeCalled();
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
            expect(chatInterface.chatStream).not.toBeCalled();
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
            expect(chatInterface.chatStream).not.toBeCalled();
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
                    },
                },
                generateSkybox: null,
                images: null,
                metrics: store,
                config: store,
                hume: null,
                sloyd: null,
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
            expect(chatInterface.chatStream).toBeCalledWith({
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
            expect(chatInterface.chatStream).toBeCalledWith({
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

            expect(metrics).toEqual({
                ownerId: userId,
                subscriptionStatus: null,
                subscriptionId: null,
                subscriptionType: 'user',
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalTokensInCurrentPeriod: 123,
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
                expect(chatInterface.chatStream).toBeCalledWith({
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
                expect(chatInterface.chatStream).toBeCalledWith({
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
                expect(chatInterface.chatStream).not.toBeCalled();

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
                expect(chatInterface.chatStream).not.toBeCalled();
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
            expect(generateSkyboxInterface.generateSkybox).toBeCalledWith({
                prompt: 'test',
            });

            const metrics = await store.getSubscriptionAiSkyboxMetrics({
                ownerId: userId,
            });

            expect(metrics).toEqual({
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
            expect(generateSkyboxInterface.generateSkybox).not.toBeCalled();
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
            expect(generateSkyboxInterface.generateSkybox).not.toBeCalled();
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
            expect(generateSkyboxInterface.generateSkybox).not.toBeCalled();
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
            expect(generateSkyboxInterface.generateSkybox).toBeCalledWith({
                prompt: 'test',
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
                expect(generateSkyboxInterface.generateSkybox).not.toBeCalled();
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
                expect(generateSkyboxInterface.generateSkybox).not.toBeCalled();
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
            expect(generateSkyboxInterface.getSkybox).toBeCalledWith(
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
            expect(generateSkyboxInterface.getSkybox).not.toBeCalled();
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
            expect(generateSkyboxInterface.getSkybox).not.toBeCalled();
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
            expect(generateSkyboxInterface.getSkybox).not.toBeCalled();
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
            expect(generateSkyboxInterface.getSkybox).toBeCalledWith(
                'test-skybox-id'
            );
        });
    });

    describe('generateImage()', () => {
        it('should return the result from the generateImage interface', async () => {
            generateImageInterface.generateImage.mockReturnValueOnce(
                Promise.resolve({
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
            expect(generateImageInterface.generateImage).toBeCalledWith({
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

            expect(metrics).toEqual({
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
                policies: null,
                policyController: policies,
                records: store,
            });

            otherInterface.generateImage.mockReturnValueOnce(
                Promise.resolve({
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
            expect(otherInterface.generateImage).toBeCalledWith({
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
            expect(generateImageInterface.generateImage).not.toBeCalled();
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
            expect(generateImageInterface.generateImage).not.toBeCalled();
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
            expect(generateImageInterface.generateImage).not.toBeCalled();
        });

        it('should work when the controller is configured to allow all subscription tiers and the user does not have a subscription', async () => {
            generateImageInterface.generateImage.mockReturnValueOnce(
                Promise.resolve({
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
            expect(generateImageInterface.generateImage).toBeCalledWith({
                prompt: 'test',
                model: 'openai',
                width: 512,
                height: 512,
                numberOfImages: 1,
                steps: 30,
                userId: 'test-user',
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
                expect(generateImageInterface.generateImage).not.toBeCalled();
            });

            it('should reject the request if it would exceed the subscription request limits', async () => {
                generateImageInterface.generateImage.mockReturnValueOnce(
                    Promise.resolve({
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
                expect(generateImageInterface.generateImage).not.toBeCalled();
            });

            it('should reject the request if it would exceed the subscription period limits', async () => {
                generateImageInterface.generateImage.mockReturnValueOnce(
                    Promise.resolve({
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
                expect(generateImageInterface.generateImage).not.toBeCalled();
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
    });
});
