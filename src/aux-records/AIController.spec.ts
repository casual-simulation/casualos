import {
    AIChatInterface,
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
} from './AIChatInterface';
import { AIController } from './AIController';

describe('AIController', () => {
    let controller: AIController;
    let chatInterface: {
        chat: jest.Mock<
            Promise<AIChatInterfaceResponse>,
            [AIChatInterfaceRequest]
        >;
    };
    let userId: string;
    let userSubscriptionTier: string;

    beforeEach(() => {
        userId = 'test-user';
        userSubscriptionTier = 'test-tier';
        chatInterface = {
            chat: jest.fn(),
        };
        controller = new AIController(chatInterface, {
            allowedChatModels: ['test-model1', 'test-model2'],
            allowedChatSubscriptionTiers: ['test-tier'],
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

            controller = new AIController(chatInterface, {
                allowedChatModels: ['test-model1', 'test-model2'],
                allowedChatSubscriptionTiers: true,
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
    });
});
