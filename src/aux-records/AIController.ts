import {
    InvalidSubscriptionTierError,
    NotAuthorizedError,
    NotLoggedInError,
    NotSubscribedError,
    NotSupportedError,
    ServerError,
    SubscriptionLimitReached,
} from '@casual-simulation/aux-common/Errors';
import {
    AIChatInterface,
    AIChatInterfaceStreamResponse,
    AIChatMessage,
    AIChatStreamMessage,
} from './AIChatInterface';
import {
    AIGenerateSkyboxInterface,
    AIGenerateSkyboxInterfaceBlockadeLabsOptions,
} from './AIGenerateSkyboxInterface';
import { AIGeneratedImage, AIImageInterface } from './AIImageInterface';
import { MetricsStore } from './MetricsStore';
import { ConfigurationStore } from './ConfigurationStore';
import {
    getHumeAiFeatures,
    getSubscriptionFeatures,
} from './SubscriptionConfiguration';
import { PolicyStore } from './PolicyStore';
import {
    AIHumeInterface,
    AIHumeInterfaceGetAccessTokenFailure,
} from './AIHumeInterface';

export interface AIConfiguration {
    chat: AIChatConfiguration | null;
    generateSkybox: AIGenerateSkyboxConfiguration | null;
    images: AIGenerateImageConfiguration | null;
    hume: AIHumeConfiguration | null;
    metrics: MetricsStore;
    config: ConfigurationStore;
    policies: PolicyStore | null;
}

export interface AIChatConfiguration {
    interfaces: AIChatProviders;
    options: AIChatOptions;
}

export interface AIChatOptions {
    /**
     * The model that should be used when none is specified in a request.
     */
    defaultModel: string;

    /**
     * The provider for the default model.
     */
    defaultModelProvider: string;

    /**
     * The list of allowed models that are allowed to be used for chat.
     */
    allowedChatModels: AllowedAIChatModel[];

    /**
     * The list of subscription tiers that are allowed to be used for chat.
     *
     * - `true` indicates that all users are allowed, regardless of their subscription tier or if they are even subscribed.
     * - An array of strings indicates that only users with the given subscription tiers are allowed.
     */
    allowedChatSubscriptionTiers: true | string[];
}

export interface AllowedAIChatModel {
    /**
     * The provider for the model.
     */
    provider: string;

    /**
     * The name of the model.
     */
    model: string;
}

export interface AIGenerateSkyboxConfiguration {
    interface: AIGenerateSkyboxInterface;
    options: AIGenerateSkyboxConfigurationOptions;
}

export interface AIGenerateSkyboxConfigurationOptions {
    /**
     * The list of subscription tiers that are allowed to be used for generate skybox.
     *
     * - `true` indicates that all users are allowed, regardless of their subscription tier or if they are even subscribed.
     * - An array of strings indicates that only users with the given subscription tiers are allowed.
     */
    allowedSubscriptionTiers: true | string[];
}

export interface AIGenerateImageConfiguration {
    interfaces: {
        [provider: string]: AIImageInterface;
    };
    options: AIGenerateImageConfigurationOptions;
}

export interface AIGenerateImageConfigurationOptions {
    /**
     * The model that should be used when none is specified in a request.
     */
    defaultModel: string;

    /**
     * The width that should be used for images that don't specify a width.
     */
    defaultWidth: number;

    /**
     * The height that should be used for images that don't specify a height.
     */
    defaultHeight: number;

    /**
     * The maximum width that can be requested.
     */
    maxWidth: number;

    /**
     * The maximum height that can be requested.
     */
    maxHeight: number;

    /**
     * The maximum number of diffusion steps that can be requested.
     */
    maxSteps: number;

    /**
     * The maximum number of images that can be requested.
     */
    maxImages: number;

    /**
     * The list of models grouped by their respective providers.
     */
    allowedModels: {
        [provider: string]: string[];
    };

    /**
     * The list of subscription tiers that are allowed to be used for generate image.
     *
     * - `true` indicates that all users are allowed, regardless of their subscription tier or if they are even subscribed.
     * - An array of strings indicates that only users with the given subscription tiers are allowed.
     */
    allowedSubscriptionTiers: true | string[];
}

export interface AIImageProviders {
    [provider: string]: AIImageInterface;
}

export interface AIChatProviders {
    [provider: string]: AIChatInterface;
}

export interface AIHumeConfiguration {
    /**
     * The interface that should be used for Hume.
     */
    interface: AIHumeInterface;
}

/**
 * Defines a class that is able to handle AI requests.
 */
export class AIController {
    private _chatProviders: AIChatProviders | null;
    private _chatOptions: AIChatOptions;

    private _generateSkybox: AIGenerateSkyboxInterface | null;

    /**
     * A map of model names to their providers
     */
    private _allowedChatModels: Map<string, string>;
    private _allowedChatSubscriptionTiers: true | Set<string>;

    private _allowedGenerateSkyboxSubscriptionTiers: true | Set<string>;

    private _imageProviders: AIImageProviders;
    private _allowedImageModels: Map<string, string>;
    private _allowedImageSubscriptionTiers: true | Set<string>;
    private _humeInterface: AIHumeInterface | null;
    private _imageOptions: AIGenerateImageConfigurationOptions;
    private _metrics: MetricsStore;
    private _config: ConfigurationStore;
    private _policies: PolicyStore;

    constructor(configuration: AIConfiguration) {
        if (configuration.chat) {
            const chat = configuration.chat;
            const options = chat.options;
            this._chatProviders = chat.interfaces;
            this._chatOptions = options;
            this._allowedChatModels = new Map(
                options.allowedChatModels.map((m) =>
                    typeof m === 'string'
                        ? [m, options.defaultModel]
                        : [m.model, m.provider]
                )
            );
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

        if (configuration.images) {
            this._imageProviders = configuration.images.interfaces;
            const options = configuration.images.options;
            this._imageOptions = options;
            this._allowedImageSubscriptionTiers =
                typeof options.allowedSubscriptionTiers === 'boolean'
                    ? options.allowedSubscriptionTiers
                    : new Set(options.allowedSubscriptionTiers);

            this._allowedImageModels = new Map();
            for (let provider in options.allowedModels) {
                for (let model of options.allowedModels[provider]) {
                    this._allowedImageModels.set(model, provider);
                }
            }
        }
        this._humeInterface = configuration.hume?.interface;
        this._metrics = configuration.metrics;
        this._config = configuration.config;
        this._policies = configuration.policies;
    }

    async chat(request: AIChatRequest): Promise<AIChatResponse> {
        try {
            if (!this._chatProviders) {
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

            const model = request.model ?? this._chatOptions.defaultModel;
            const provider =
                this._allowedChatModels.get(request.model) ??
                this._chatOptions.defaultModelProvider;
            const chat = this._chatProviders[provider];

            if (!chat) {
                console.error(
                    '[AIController] No chat provider found for model:',
                    model
                );
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'The given model is not supported.',
                };
            } else {
                console.log(
                    '[AIController] Using chat provider:',
                    provider,
                    'for model:',
                    model
                );
            }

            const metrics = await this._metrics.getSubscriptionAiChatMetrics({
                ownerId: request.userId,
            });
            const config = await this._config.getSubscriptionConfiguration();
            const allowedFeatures = getSubscriptionFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                'user'
            );

            if (!allowedFeatures.ai.chat.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit AI Chat features.',
                };
            }

            let maxTokens: number = undefined;
            if (allowedFeatures.ai.chat.maxTokensPerPeriod) {
                maxTokens =
                    allowedFeatures.ai.chat.maxTokensPerPeriod -
                    metrics.totalTokensInCurrentPeriod;
            }

            if (maxTokens <= 0) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: `The user has reached their limit for the current subscription period.`,
                };
            }

            if (allowedFeatures.ai.chat.maxTokensPerRequest) {
                if (maxTokens) {
                    maxTokens = Math.min(
                        maxTokens,
                        allowedFeatures.ai.chat.maxTokensPerRequest
                    );
                } else {
                    maxTokens = allowedFeatures.ai.chat.maxTokensPerRequest;
                }
            }

            if (this._policies) {
                const privacyFeatures =
                    await this._policies.getUserPrivacyFeatures(request.userId);

                if (!privacyFeatures.allowAI) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'AI Access is not allowed',
                    };
                }
            }

            const result = await chat.chat({
                messages: request.messages,
                model: model,
                temperature: request.temperature,
                topP: request.topP,
                frequencyPenalty: request.frequencyPenalty,
                presencePenalty: request.presencePenalty,
                stopWords: request.stopWords,
                userId: request.userId,
                maxTokens,
            });

            if (result.totalTokens > 0) {
                await this._metrics.recordChatMetrics({
                    userId: request.userId,
                    createdAtMs: Date.now(),
                    tokens: result.totalTokens,
                });
            }

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

    async *chatStream(
        request: AIChatRequest
    ): AsyncGenerator<
        Pick<AIChatInterfaceStreamResponse, 'choices'>,
        AIChatStreamResponse
    > {
        try {
            if (!this._chatProviders) {
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

            const model = request.model ?? this._chatOptions.defaultModel;
            const provider =
                this._allowedChatModels.get(request.model) ??
                this._chatOptions.defaultModelProvider;
            const chat = this._chatProviders[provider];

            if (!chat) {
                console.error(
                    '[AIController] No chat provider found for model:',
                    model
                );
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'The given model is not supported.',
                };
            } else if (!chat.chatStream) {
                console.error(
                    '[AIController] Chat provider does not support chatStream for model:',
                    model
                );
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'The given model does not support streaming.',
                };
            } else {
                console.log(
                    '[AIController] Using chat provider:',
                    provider,
                    'for model:',
                    model
                );
            }

            const metrics = await this._metrics.getSubscriptionAiChatMetrics({
                ownerId: request.userId,
            });
            const config = await this._config.getSubscriptionConfiguration();
            const allowedFeatures = getSubscriptionFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                'user'
            );

            if (!allowedFeatures.ai.chat.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit AI Chat features.',
                };
            }

            let maxTokens: number = undefined;
            if (allowedFeatures.ai.chat.maxTokensPerPeriod) {
                maxTokens =
                    allowedFeatures.ai.chat.maxTokensPerPeriod -
                    metrics.totalTokensInCurrentPeriod;
            }

            if (maxTokens <= 0) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: `The user has reached their limit for the current subscription period.`,
                };
            }

            if (allowedFeatures.ai.chat.maxTokensPerRequest) {
                if (maxTokens) {
                    maxTokens = Math.min(
                        maxTokens,
                        allowedFeatures.ai.chat.maxTokensPerRequest
                    );
                } else {
                    maxTokens = allowedFeatures.ai.chat.maxTokensPerRequest;
                }
            }

            if (this._policies) {
                const privacyFeatures =
                    await this._policies.getUserPrivacyFeatures(request.userId);

                if (!privacyFeatures.allowAI) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'AI Access is not allowed',
                    };
                }
            }

            const result = chat.chatStream({
                messages: request.messages,
                model: model,
                temperature: request.temperature,
                topP: request.topP,
                frequencyPenalty: request.frequencyPenalty,
                presencePenalty: request.presencePenalty,
                stopWords: request.stopWords,
                userId: request.userId,
                maxTokens,
            });

            for await (let chunk of result) {
                if (chunk.totalTokens > 0) {
                    await this._metrics.recordChatMetrics({
                        userId: request.userId,
                        createdAtMs: Date.now(),
                        tokens: chunk.totalTokens,
                    });
                }

                yield {
                    choices: chunk.choices,
                };
            }

            return {
                success: true,
            };
        } catch (err) {
            console.error(
                '[AIController] Error handling chat stream request:',
                err
            );
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

            const metrics = await this._metrics.getSubscriptionAiSkyboxMetrics({
                ownerId: request.userId,
            });
            const config = await this._config.getSubscriptionConfiguration();
            const allowedFeatures = getSubscriptionFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                'user'
            );

            if (!allowedFeatures.ai.skyboxes.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit AI Skybox features.',
                };
            }

            if (
                allowedFeatures.ai.skyboxes.maxSkyboxesPerPeriod > 0 &&
                metrics.totalSkyboxesInCurrentPeriod + 1 >
                    allowedFeatures.ai.skyboxes.maxSkyboxesPerPeriod
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: `The user has reached their limit for the current subscription period.`,
                };
            }

            const result = await this._generateSkybox.generateSkybox({
                prompt: request.prompt,
                negativePrompt: request.negativePrompt,
                blockadeLabs: request.blockadeLabs,
            });

            if (result.success === true) {
                await this._metrics.recordSkyboxMetrics({
                    userId: request.userId,
                    createdAtMs: Date.now(),
                    skyboxes: 1,
                });

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

    async generateImage(
        request: AIGenerateImageRequest
    ): Promise<AIGenerateImageResponse> {
        try {
            if (!this._imageProviders) {
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
                    this._allowedImageSubscriptionTiers
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
                                ._allowedImageSubscriptionTiers as Set<string>),
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
                                ._allowedImageSubscriptionTiers as Set<string>),
                        ],
                        currentSubscriptionTier: request.userSubscriptionTier,
                    };
                }
            }

            const model = request.model ?? this._imageOptions.defaultModel;

            if (!this._allowedImageModels.has(model)) {
                return {
                    success: false,
                    errorCode: 'invalid_model',
                    errorMessage: `The given model is not allowed for images.`,
                };
            }
            const providerId = this._allowedImageModels.get(model);
            const provider = this._imageProviders[providerId];

            if (!provider) {
                return {
                    success: false,
                    errorCode: 'invalid_model',
                    errorMessage: `The given model is not allowed for images.`,
                };
            }

            const width = Math.min(
                request.width ?? this._imageOptions.defaultWidth,
                this._imageOptions.maxWidth
            );
            const height = Math.min(
                request.height ?? this._imageOptions.defaultHeight,
                this._imageOptions.maxHeight
            );
            const numberOfImages = Math.min(
                request.numberOfImages ?? 1,
                this._imageOptions.maxImages
            );

            const totalPixels = Math.max(width, height) * numberOfImages;

            const metrics = await this._metrics.getSubscriptionAiImageMetrics({
                ownerId: request.userId,
            });
            const config = await this._config.getSubscriptionConfiguration();
            const allowedFeatures = getSubscriptionFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                'user'
            );

            if (!allowedFeatures.ai.images.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit AI Image features.',
                };
            }

            if (
                allowedFeatures.ai.images.maxSquarePixelsPerRequest > 0 &&
                totalPixels >
                    allowedFeatures.ai.images.maxSquarePixelsPerRequest
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: `The request exceeds allowed subscription limits.`,
                };
            }

            if (
                allowedFeatures.ai.images.maxSquarePixelsPerPeriod > 0 &&
                totalPixels + metrics.totalSquarePixelsInCurrentPeriod >
                    allowedFeatures.ai.images.maxSquarePixelsPerPeriod
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: `The user has reached their limit for the current subscription period.`,
                };
            }

            const result = await provider.generateImage({
                model,
                prompt: request.prompt,
                negativePrompt: request.negativePrompt,
                width: width,
                height: height,
                numberOfImages: numberOfImages,
                seed: request.seed,
                steps: Math.min(
                    request.steps ?? 30,
                    this._imageOptions.maxSteps
                ),
                cfgScale: request.cfgScale,
                sampler: request.sampler,
                clipGuidancePreset: request.clipGuidancePreset,
                stylePreset: request.stylePreset,
                userId: request.userId,
            });

            await this._metrics.recordImageMetrics({
                userId: request.userId,
                createdAtMs: Date.now(),
                squarePixels: totalPixels,
            });

            return {
                success: true,
                images: result.images,
            };
        } catch (err) {
            console.error(
                '[AIController] Error handling generate image request:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async getHumeAccessToken(
        request: AIHumeGetAccessTokenRequest
    ): Promise<AIHumeGetAccessTokenResult> {
        try {
            if (!this._humeInterface) {
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
                        'The user must be logged in. Please provide a sessionKey.',
                };
            }

            const metrics = await this._metrics.getSubscriptionAiChatMetrics({
                ownerId: request.userId,
            });
            const config = await this._config.getSubscriptionConfiguration();
            const features = getHumeAiFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                'user'
            );

            if (!features.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit Hume AI features.',
                };
            }

            const result = await this._humeInterface.getAccessToken();

            if (result.success) {
                return {
                    success: true,
                    accessToken: result.accessToken,
                    expiresIn: result.expiresIn,
                    issuedAt: result.issuedAt,
                    tokenType: result.tokenType,
                };
            } else {
                return result;
            }
        } catch (err) {
            console.error(
                '[AIController] Error handling get hume access token request:',
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
        | SubscriptionLimitReached
        | NotAuthorizedError
        | 'invalid_model';
    errorMessage: string;

    allowedSubscriptionTiers?: string[];
    currentSubscriptionTier?: string;
}

export type AIChatStreamResponse = AIChatStreamSuccess | AIChatFailure;

export interface AIChatStreamSuccess {
    success: true;
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
        | NotSupportedError
        | SubscriptionLimitReached
        | NotAuthorizedError;
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

export interface AIGenerateImageRequest {
    /**
     * The ID of the user that is making the request.
     */
    userId: string;

    /**
     * The subscription tier of the user.
     * Should be null if the user is not logged in or if they do not have a subscription.
     */
    userSubscriptionTier: string;

    /**
     * The description of what the generated image(s) should look like.
     */
    prompt: string;

    /**
     * The description of what the generated image(s) should not look like.
     */
    negativePrompt?: string;

    /**
     * The model that should be used to generate the image(s).
     */
    model?: string;

    /**
     * The desired width of the image(s) in pixels.
     */
    width?: number;

    /**
     * The desired height of the image(s) in pixels.
     */
    height?: number;

    /**
     * The number of images that should be generated.
     */
    numberOfImages?: number;

    /**
     * The random noise seed that should be used.
     */
    seed?: number;

    /**
     * The number of diffusion steps to run.
     */
    steps?: number;

    /**
     * How strictly the diffusion process adheres to the prompt text.
     * Higher values keep the image closer to the prompt.
     */
    cfgScale?: number;

    /**
     * The sampler to use for the diffusion process.
     */
    sampler?: string;

    /**
     * The clip guidance preset.
     */
    clipGuidancePreset?: string;

    /**
     * The style preset that should be used to guide the image model torwards a specific style.
     */
    stylePreset?: string;
}

export type AIGenerateImageResponse =
    | AIGenerateImageSuccess
    | AIGenerateImageFailure;

export interface AIGenerateImageSuccess {
    success: true;

    /**
     * The list of images that were generated.
     */
    images: AIGeneratedImage[];
}

export interface AIGenerateImageFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSubscribedError
        | InvalidSubscriptionTierError
        | NotSupportedError
        | SubscriptionLimitReached
        | NotAuthorizedError
        | 'invalid_model';
    errorMessage: string;

    allowedSubscriptionTiers?: string[];
    currentSubscriptionTier?: string;
}

export interface AIHumeGetAccessTokenRequest {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;
}

export type AIHumeGetAccessTokenResult =
    | AIHumeGetAccessTokenSuccess
    | AIHumeGetAccessTokenFailure;

export interface AIHumeGetAccessTokenSuccess {
    success: true;
    /**
     * The access token that was generated.
     */
    accessToken: string;
    /**
     * The number of seconds that the access token is valid for.
     */
    expiresIn: number;

    /**
     * The unix time in seconds that the token was issued at.
     */
    issuedAt: number;

    /**
     * The type of the token. Always "Bearer" for now.
     */
    tokenType: 'Bearer';
}

export interface AIHumeGetAccessTokenFailure {
    success: false;

    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSubscribedError
        | InvalidSubscriptionTierError
        | NotSupportedError
        | SubscriptionLimitReached
        | NotAuthorizedError
        | AIHumeInterfaceGetAccessTokenFailure['errorCode'];
    errorMessage: string;
}
