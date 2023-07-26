import {
    InvalidSubscriptionTierError,
    NotLoggedInError,
    NotSubscribedError,
    ServerError,
} from './Errors';
import { AIChatInterface, AIChatMessage } from './AIChatInterface';

export interface AIOptions {
    /**
     * The list of allowed models that are allowed to be used for chat.
     */
    allowedChatModels: string[];

    /**
     * The list of subscription tiers that are allowed to be used for chat.
     */
    allowedChatSubscriptionTiers: true | string[];
}

/**
 * Defines a class that is able to handle AI requests.
 */
export class AIController {
    private _chat: AIChatInterface;
    private _options: AIOptions;

    private _allowedChatModels: Set<string>;
    private _allowedChatSubscriptionTiers: true | Set<string>;

    constructor(chat: AIChatInterface, options: AIOptions) {
        this._chat = chat;
        this._options = options;
        this._allowedChatModels = new Set(options.allowedChatModels);
        this._allowedChatSubscriptionTiers =
            typeof options.allowedChatSubscriptionTiers === 'boolean'
                ? options.allowedChatSubscriptionTiers
                : new Set(options.allowedChatSubscriptionTiers);
    }

    async chat(request: AIChatRequest): Promise<AIChatResponse> {
        try {
            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                };
            }

            if (
                this._allowedChatSubscriptionTiers !== true &&
                !this._allowedChatSubscriptionTiers.has(
                    request.userSubscriptionTier
                )
            ) {
                if (!request.userSubscriptionTier) {
                    return {
                        success: false,
                        errorCode: 'not_subscribed',
                        errorMessage:
                            'The user must be subscribed in order to use this operation.',
                        allowedSubscriptionTiers: [
                            ...this._allowedChatSubscriptionTiers,
                        ],
                    };
                } else {
                    return {
                        success: false,
                        errorCode: 'invalid_subscription_tier',
                        errorMessage:
                            'This operation is not available to the user at their current subscription tier.',
                        allowedSubscriptionTiers: [
                            ...this._allowedChatSubscriptionTiers,
                        ],
                        currentSubscriptionTier: request.userSubscriptionTier,
                    };
                }
            }

            if (!this._allowedChatModels.has(request.model)) {
                return {
                    success: false,
                    errorCode: 'invalid_model',
                    errorMessage: `The given model is not allowed for chats.`,
                };
            }

            const result = await this._chat.chat({
                messages: request.messages,
                model: request.model,
                temperature: request.temperature,
                userId: request.userId,
            });

            return {
                success: true,
                choices: result.choices,
            };
        } catch (err) {
            console.error('[AIController] Error handling chat request:', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}

/**
 * Defines an AI Chat request.
 */
export interface AIChatRequest {
    /**
     * The messages to include in the request.
     */
    messages: AIChatMessage[];

    /**
     * The model that should be used.
     */
    model: string;

    /**
     * The ID of the currently logged in user.
     */
    userId: string;

    /**
     * The subscription tier of the user.
     * Should be null if the user is not logged in or if they do not have a subscription.
     */
    userSubscriptionTier: string;

    /**
     * The temperature of the request.
     */
    temperature?: number;
}

export type AIChatResponse = AIChatSuccess | AIChatFailure;

export interface AIChatSuccess {
    success: true;
    choices: AIChatMessage[];
}

export interface AIChatFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSubscribedError
        | InvalidSubscriptionTierError
        | 'invalid_model';
    errorMessage: string;

    allowedSubscriptionTiers?: string[];
    currentSubscriptionTier?: string;
}
