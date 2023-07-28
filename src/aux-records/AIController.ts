import {
    InvalidSubscriptionTierError,
    NotLoggedInError,
    NotSubscribedError,
    NotSupportedError,
    ServerError,
} from './Errors';
import { AIChatInterface, AIChatMessage } from './AIChatInterface';
import {
    AIGenerateSkyboxInterface,
    AIGenerateSkyboxInterfaceBlockadeLabsOptions,
} from './AIGenerateSkyboxInterface';

export interface AIConfiguration {
    chat: AIChatConfiguration | null;
    generateSkybox: AIGenerateSkyboxConfiguration | null;
}

export interface AIChatConfiguration {
    interface: AIChatInterface;
    options: AIChatOptions;
}

export interface AIChatOptions {
    /**
     * The model that should be used when none is specified in a request.
     */
    defaultModel: string;

    /**
     * The list of allowed models that are allowed to be used for chat.
     */
    allowedChatModels: string[];

    /**
     * The list of subscription tiers that are allowed to be used for chat.
     *
     * - `true` indicates that all users are allowed, regardless of their subscription tier or if they are even subscribed.
     * - An array of strings indicates that only users with the given subscription tiers are allowed.
     */
    allowedChatSubscriptionTiers: true | string[];
}

export interface AIGenerateSkyboxConfiguration {
    interface: AIGenerateSkyboxInterface;
    options: AIGenerateSkyboxOptions;
}

export interface AIGenerateSkyboxOptions {
    /**
     * The list of subscription tiers that are allowed to be used for generate skybox.
     *
     * - `true` indicates that all users are allowed, regardless of their subscription tier or if they are even subscribed.
     * - An array of strings indicates that only users with the given subscription tiers are allowed.
     */
    allowedSubscriptionTiers: true | string[];
}

/**
 * Defines a class that is able to handle AI requests.
 */
export class AIController {
    private _chat: AIChatInterface | null;
    private _chatOptions: AIChatOptions;

    private _generateSkybox: AIGenerateSkyboxInterface | null;

    private _allowedChatModels: Set<string>;
    private _allowedChatSubscriptionTiers: true | Set<string>;

    private _allowedGenerateSkyboxSubscriptionTiers: true | Set<string>;

    constructor(configuration: AIConfiguration) {
        if (configuration.chat) {
            const chat = configuration.chat;
            const options = chat.options;
            this._chat = chat.interface;
            this._chatOptions = options;
            this._allowedChatModels = new Set(options.allowedChatModels);
            this._allowedChatSubscriptionTiers =
                typeof options.allowedChatSubscriptionTiers === 'boolean'
                    ? options.allowedChatSubscriptionTiers
                    : new Set(options.allowedChatSubscriptionTiers);
        }

        if (configuration.generateSkybox) {
            this._generateSkybox = configuration.generateSkybox.interface;
            const options = configuration.generateSkybox.options;
            this._allowedGenerateSkyboxSubscriptionTiers =
                typeof options.allowedSubscriptionTiers === 'boolean'
                    ? options.allowedSubscriptionTiers
                    : new Set(options.allowedSubscriptionTiers);
        }
    }

    async chat(request: AIChatRequest): Promise<AIChatResponse> {
        try {
            if (!this._chat) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }
            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                };
            }

            if (
                !this._matchesSubscriptionTiers(
                    request.userSubscriptionTier,
                    this._allowedChatSubscriptionTiers
                )
            ) {
                if (!request.userSubscriptionTier) {
                    return {
                        success: false,
                        errorCode: 'not_subscribed',
                        errorMessage:
                            'The user must be subscribed in order to use this operation.',
                        allowedSubscriptionTiers: [
                            ...(this
                                ._allowedChatSubscriptionTiers as Set<string>),
                        ],
                    };
                } else {
                    return {
                        success: false,
                        errorCode: 'invalid_subscription_tier',
                        errorMessage:
                            'This operation is not available to the user at their current subscription tier.',
                        allowedSubscriptionTiers: [
                            ...(this
                                ._allowedChatSubscriptionTiers as Set<string>),
                        ],
                        currentSubscriptionTier: request.userSubscriptionTier,
                    };
                }
            }

            if (
                !!request.model &&
                !this._allowedChatModels.has(request.model)
            ) {
                return {
                    success: false,
                    errorCode: 'invalid_model',
                    errorMessage: `The given model is not allowed for chats.`,
                };
            }

            const result = await this._chat.chat({
                messages: request.messages,
                model: request.model ?? this._chatOptions.defaultModel,
                temperature: request.temperature,
                topP: request.topP,
                frequencyPenalty: request.frequencyPenalty,
                presencePenalty: request.presencePenalty,
                stopWords: request.stopWords,
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

    async generateSkybox(
        request: AIGenerateSkyboxRequest
    ): Promise<AIGenerateSkyboxResponse> {
        try {
            if (!this._generateSkybox) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                };
            }

            if (
                !this._matchesSubscriptionTiers(
                    request.userSubscriptionTier,
                    this._allowedGenerateSkyboxSubscriptionTiers
                )
            ) {
                if (!request.userSubscriptionTier) {
                    return {
                        success: false,
                        errorCode: 'not_subscribed',
                        errorMessage:
                            'The user must be subscribed in order to use this operation.',
                        allowedSubscriptionTiers: [
                            ...(this
                                ._allowedGenerateSkyboxSubscriptionTiers as Set<string>),
                        ],
                    };
                } else {
                    return {
                        success: false,
                        errorCode: 'invalid_subscription_tier',
                        errorMessage:
                            'This operation is not available to the user at their current subscription tier.',
                        allowedSubscriptionTiers: [
                            ...(this
                                ._allowedGenerateSkyboxSubscriptionTiers as Set<string>),
                        ],
                        currentSubscriptionTier: request.userSubscriptionTier,
                    };
                }
            }

            const result = await this._generateSkybox.generateSkybox({
                prompt: request.prompt,
                negativePrompt: request.negativePrompt,
                blockadeLabs: request.blockadeLabs,
            });

            if (result.success === true) {
                return {
                    success: true,
                    skyboxId: result.skyboxId,
                };
            } else {
                return result;
            }
        } catch (err) {
            console.error(
                '[AIController] Error handling generate skybox request:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async getSkybox(request: AIGetSkyboxRequest): Promise<AIGetSkyboxResponse> {
        try {
            if (!this._generateSkybox) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                };
            }

            if (
                !this._matchesSubscriptionTiers(
                    request.userSubscriptionTier,
                    this._allowedGenerateSkyboxSubscriptionTiers
                )
            ) {
                if (!request.userSubscriptionTier) {
                    return {
                        success: false,
                        errorCode: 'not_subscribed',
                        errorMessage:
                            'The user must be subscribed in order to use this operation.',
                        allowedSubscriptionTiers: [
                            ...(this
                                ._allowedGenerateSkyboxSubscriptionTiers as Set<string>),
                        ],
                    };
                } else {
                    return {
                        success: false,
                        errorCode: 'invalid_subscription_tier',
                        errorMessage:
                            'This operation is not available to the user at their current subscription tier.',
                        allowedSubscriptionTiers: [
                            ...(this
                                ._allowedGenerateSkyboxSubscriptionTiers as Set<string>),
                        ],
                        currentSubscriptionTier: request.userSubscriptionTier,
                    };
                }
            }

            const result = await this._generateSkybox.getSkybox(
                request.skyboxId
            );

            if (result.success === true) {
                return {
                    success: true,
                    status: result.status,
                    fileUrl: result.fileUrl,
                    thumbnailUrl: result.thumbnailUrl,
                };
            } else {
                return result;
            }
        } catch (err) {
            console.error(
                '[AIController] Error handling get skybox request:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    private _matchesSubscriptionTiers(
        tier: string,
        allowedTiers: true | Set<string>
    ): boolean {
        return allowedTiers === true || allowedTiers.has(tier);
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
    model?: string;

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

    /**
     * The nucleus sampling probability.
     */
    topP?: number;

    /**
     * The presence penalty.
     *
     * Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
     */
    presencePenalty?: number;

    /**
     * The frequency penalty.
     *
     * Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
     */
    frequencyPenalty?: number;

    /**
     * The list of stop words that should be used.
     *
     * If the AI generates a sequence of tokens that match one of the given words, then it will stop generating tokens.
     */
    stopWords?: string[];
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
        | NotSupportedError
        | 'invalid_model';
    errorMessage: string;

    allowedSubscriptionTiers?: string[];
    currentSubscriptionTier?: string;
}

export interface AIGenerateSkyboxRequest {
    /**
     * The prompt that should be used to generate the skybox.
     */
    prompt: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The subscription tier of the user.
     * Should be null if the user is not logged in or if they do not have a subscription.
     */
    userSubscriptionTier: string;

    /**
     * The negative prompt for the skybox.
     */
    negativePrompt?: string;

    /**
     * Options specific to blockade labs.
     */
    blockadeLabs?: AIGenerateSkyboxInterfaceBlockadeLabsOptions;
}

export type AIGenerateSkyboxResponse =
    | AIGenerateSkyboxSuccess
    | AIGenerateSkyboxFailure;

export interface AIGenerateSkyboxSuccess {
    success: true;
    skyboxId: string;
}

export interface AIGenerateSkyboxFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSubscribedError
        | InvalidSubscriptionTierError
        | NotSupportedError;
    errorMessage: string;

    allowedSubscriptionTiers?: string[];
    currentSubscriptionTier?: string;
}

export interface AIGetSkyboxRequest {
    /**
     * The ID of the skybox.
     */
    skyboxId: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The subscription tier of the user.
     * Should be null if the user is not logged in or if they do not have a subscription.
     */
    userSubscriptionTier: string;
}

export type AIGetSkyboxResponse = AIGetSkyboxSuccess | AIGetSkyboxFailure;

export interface AIGetSkyboxSuccess {
    success: true;
    status: 'pending' | 'generated';
    fileUrl?: string;
    thumbnailUrl?: string;
}

export interface AIGetSkyboxFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSubscribedError
        | InvalidSubscriptionTierError
        | NotSupportedError;
    errorMessage: string;

    allowedSubscriptionTiers?: string[];
    currentSubscriptionTier?: string;
}
