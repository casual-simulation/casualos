import {
    AIChatInterface,
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
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
import { createTestSubConfiguration } from './TestUtils';
import {
    FeaturesConfiguration,
    SubscriptionConfiguration,
    allowAllFeatures,
} from './SubscriptionConfiguration';
import { merge } from 'lodash';

describe('AIController', () => {
    let controller: AIController;
    let chatInterface: {
        chat: jest.Mock<
            Promise<AIChatInterfaceResponse>,
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
    let userId: string;
    let userSubscriptionTier: string;
    let store: MemoryStore;

    beforeEach(() => {
        userId = 'test-user';
        userSubscriptionTier = 'test-tier';
        chatInterface = {
            chat: jest.fn(),
        };
        generateSkyboxInterface = {
            generateSkybox: jest.fn(),
            getSkybox: jest.fn(),
        };
        generateImageInterface = {
            generateImage: jest.fn(),
        };
        store = new MemoryStore({
            subscriptions: null,
        });
        controller = new AIController({
            chat: {
                interface: chatInterface,
                options: {
                    defaultModel: 'default-model',
                    allowedChatModels: ['test-model1', 'test-model2'],
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
            metrics: store,
            config: store,
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
                            stopReason: 'stop',
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
                        stopReason: 'stop',
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

        it('should use the default model if none is specified', async () => {
            chatInterface.chat.mockReturnValueOnce(
                Promise.resolve({
                    choices: [
                        {
                            role: 'user',
                            content: 'test',
                            stopReason: 'stop',
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
                        stopReason: 'stop',
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
                            stopReason: 'stop',
                        },
                    ],
                    totalTokens: 1,
                })
            );

            controller = new AIController({
                chat: {
                    interface: chatInterface,
                    options: {
                        defaultModel: 'default-model',
                        allowedChatModels: ['test-model1', 'test-model2'],
                        allowedChatSubscriptionTiers: true,
                    },
                },
                generateSkybox: null,
                images: null,
                metrics: store,
                config: store,
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
                        stopReason: 'stop',
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
                            stopReason: 'stop',
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
                        stopReason: 'stop',
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
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalTokensInCurrentPeriod: 123,
            });
        });

        describe('subscriptions', () => {
            beforeEach(async () => {
                store.subscriptionConfiguration = merge(
                    createTestSubConfiguration(),
                    {
                        subscriptions: [
                            {
                                id: 'sub1',
                                eligibleProducts: [],
                                product: '',
                                featureList: [],
                                tier: 'tier1',
                            },
                        ],
                        tiers: {
                            tier1: {
                                features: merge(allowAllFeatures(), {
                                    ai: {
                                        chat: {
                                            maxTokensPerPeriod: 100,
                                            maxTokensPerRequest: 75,
                                        },
                                    },
                                } as Partial<FeaturesConfiguration>),
                            },
                        },
                    } as Partial<SubscriptionConfiguration>
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
                                stopReason: 'stop',
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
                            stopReason: 'stop',
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
                                stopReason: 'stop',
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
                            stopReason: 'stop',
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
                                stopReason: 'stop',
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
                                stopReason: 'stop',
                            },
                        ],
                        totalTokens: 123,
                    })
                );

                store.subscriptionConfiguration = merge(
                    createTestSubConfiguration(),
                    {
                        subscriptions: [
                            {
                                id: 'sub1',
                                eligibleProducts: [],
                                product: '',
                                featureList: [],
                                tier: 'tier1',
                            },
                        ],
                        tiers: {
                            tier1: {
                                features: merge(allowAllFeatures(), {
                                    ai: {
                                        chat: {
                                            allowed: false,
                                        },
                                    },
                                } as Partial<FeaturesConfiguration>),
                            },
                        },
                    } as Partial<SubscriptionConfiguration>
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
                currentPeriodStartMs: null,
                currentPeriodEndMs: null,
                totalPixelsInCurrentPeriod: 512 * 512,
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
    });
});
