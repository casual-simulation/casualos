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
import { AIController } from './AIController';

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
    let userId: string;
    let userSubscriptionTier: string;

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
        });

        it('should return a not_supported result if no generateSkybox configuration is provided', async () => {
            controller = new AIController({
                generateSkybox: null,
                chat: null,
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
});
