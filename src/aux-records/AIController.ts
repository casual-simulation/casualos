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
    InvalidSubscriptionTierError,
    NotAuthorizedError,
    NotLoggedInError,
    NotSubscribedError,
    NotSupportedError,
    ServerError,
    SubscriptionLimitReached,
} from '@casual-simulation/aux-common/Errors';
import type {
    AIChatInterface,
    AIChatInterfaceStreamResponse,
    AIChatMessage,
} from './AIChatInterface';
import type {
    AIGenerateSkyboxInterface,
    AIGenerateSkyboxInterfaceBlockadeLabsOptions,
} from './AIGenerateSkyboxInterface';
import type { AIGeneratedImage, AIImageInterface } from './AIImageInterface';
import type { MetricsStore, SubscriptionFilter } from './MetricsStore';
import type { ConfigurationStore } from './ConfigurationStore';
import {
    getHumeAiFeatures,
    getOpenAiFeatures,
    getSloydAiFeatures,
    getSubscriptionFeatures,
} from './SubscriptionConfiguration';
import type { PolicyStore } from './PolicyStore';
import type { AIHumeInterface } from './AIHumeInterface';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type {
    AISloydInterface,
    AISloydInterfaceCreateModelFailure,
    AISloydInterfaceCreateModelSuccess,
} from './AISloydInterface';
import { fromByteArray } from 'base64-js';
import type {
    AuthorizeSubjectFailure,
    PolicyController,
} from './PolicyController';
import type { Failure, UserRole } from '@casual-simulation/aux-common';
import {
    failure,
    genericResult,
    isFailure,
    isSuperUserRole,
    logError,
    success,
    wrap,
    type DenialReason,
    type KnownErrorCodes,
    type Result,
    type SimpleError,
} from '@casual-simulation/aux-common';
import type { HumeConfig, RecordsStore } from './RecordsStore';
import type {
    AIOpenAIRealtimeInterface,
    CreateRealtimeSessionTokenRequest,
} from './AIOpenAIRealtimeInterface';
import {
    billForUsage,
    type FinancialController,
} from './financial/FinancialController';
import { TransferCodes } from './financial/FinancialInterface';

const TRACE_NAME = 'AIController';

export interface AIConfiguration {
    chat: AIChatConfiguration | null;
    generateSkybox: AIGenerateSkyboxConfiguration | null;
    images: AIGenerateImageConfiguration | null;
    hume: AIHumeConfiguration | null;
    sloyd: AISloydConfiguration | null;
    metrics: MetricsStore;
    config: ConfigurationStore;
    policies: PolicyStore | null;
    policyController: PolicyController | null;
    records: RecordsStore | null;
    openai: {
        realtime: AIOpenAIRealtimeConfiguration;
    } | null;
    financial?: FinancialController | null;
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

    /**
     * A mapping of token modifiers and their respective numerical ratios.
     *
     * - The keys represent different token modifier names, while the values are the numeric ratios associated with each modifier.
     */
    tokenModifierRatio: Record<string, number>;
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

    /**
     * The hume configuration that was included in the server config.
     * If null, then users are not able to use hume and studios need the hume feature.
     */
    config: HumeConfig | null;
}

export interface AISloydConfiguration {
    /**
     * The interface that should be used for sloyd.ai.
     */
    interface: AISloydInterface;
}

export interface AIOpenAIRealtimeConfiguration {
    /**
     * The interface that should be used for OpenAI realtime sessions.
     */
    interface: AIOpenAIRealtimeInterface;
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
    private _humeConfig: HumeConfig | null;
    private _sloydInterface: AISloydInterface | null;
    private _openAIRealtimeInterface: AIOpenAIRealtimeInterface | null;
    private _imageOptions: AIGenerateImageConfigurationOptions;
    private _metrics: MetricsStore;
    private _config: ConfigurationStore;
    private _policyStore: PolicyStore;
    private _policies: PolicyController;
    private _recordsStore: RecordsStore;
    private _financial: FinancialController | null;

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
        this._policies = configuration.policyController;
        this._humeInterface = configuration.hume?.interface;
        this._humeConfig = configuration.hume?.config;
        this._sloydInterface = configuration.sloyd?.interface;
        this._openAIRealtimeInterface =
            configuration.openai?.realtime?.interface;
        this._metrics = configuration.metrics;
        this._config = configuration.config;
        this._policyStore = configuration.policies;
        this._recordsStore = configuration.records;
        this._financial = configuration.financial;
    }

    @traced(TRACE_NAME)
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

            if (this._policyStore) {
                const privacyFeatures =
                    await this._policyStore.getUserPrivacyFeatures(
                        request.userId
                    );

                if (!privacyFeatures.allowAI) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'AI Access is not allowed',
                    };
                }
            }

            if (allowedFeatures.ai.chat.allowedModels) {
                const allowedModels = allowedFeatures.ai.chat.allowedModels;
                if (!allowedModels.includes(model)) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'The subscription does not permit the given model for AI Chat features.',
                    };
                }
            }

            const creditFeePerInputToken =
                allowedFeatures.ai.chat.creditFeePerInputToken ?? null;
            const creditFeePerOutputToken =
                allowedFeatures.ai.chat.creditFeePerOutputToken ?? null;
            const preChargeInputTokens = BigInt(
                this._calculateTokenCost(
                    allowedFeatures.ai.chat.preChargeInputTokens ?? 100,
                    model
                )
            );
            const preChargeOutputTokens = BigInt(
                this._calculateTokenCost(
                    allowedFeatures.ai.chat.preChargeOutputTokens ?? 100,
                    model
                )
            );
            const initialAmount =
                creditFeePerInputToken || creditFeePerOutputToken
                    ? preChargeInputTokens * (creditFeePerInputToken ?? 0n) +
                      preChargeOutputTokens * (creditFeePerOutputToken ?? 0n)
                    : null;

            const billing = await billForUsage(this._financial, {
                userId: request.userId,
                transferCode: TransferCodes.records_usage_fee,
            });

            const initialResult = await billing.next(
                success({
                    initialCost: initialAmount,
                })
            );

            if (isFailure(initialResult.value)) {
                return genericResult(initialResult.value);
            }

            const chatResult = await wrap(
                async () =>
                    await chat.chat({
                        messages: request.messages,
                        model: model,
                        temperature: request.temperature,
                        topP: request.topP,
                        frequencyPenalty: request.frequencyPenalty,
                        presencePenalty: request.presencePenalty,
                        stopWords: request.stopWords,
                        userId: request.userId,
                        maxTokens,
                    })
            );

            if (isFailure(chatResult)) {
                console.error(
                    '[AIController] Chat request failed:',
                    chatResult
                );

                // Need to pass failure to billing to ensure that it cancels pending transfers
                const errorResult = await billing.next(
                    failure({
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                    })
                );

                return genericResult(errorResult.value as Failure<SimpleError>);
            }

            const cost = this._calculateChatBillingCost(
                chatResult.value,
                creditFeePerInputToken,
                creditFeePerOutputToken,
                model
            );

            if (chatResult.value.totalTokens > 0) {
                const adjustedTotalTokens = this._calculateTokenCost(
                    chatResult.value.totalTokens,
                    model
                );

                await this._metrics.recordChatMetrics({
                    userId: request.userId,
                    createdAtMs: Date.now(),
                    tokens: adjustedTotalTokens,
                });
            }

            const finalResult = await billing.next(
                success({
                    cost,
                })
            );

            if (isFailure(finalResult.value)) {
                return genericResult(finalResult.value);
            }

            return {
                success: true,
                choices: chatResult.value.choices,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error('[AIController] Error handling chat request:', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Calculates the final billing cost for a chat request given the token usage.
     */
    private _calculateChatBillingCost(
        chatResult: {
            inputTokens?: number | null;
            outputTokens?: number | null;
            totalTokens: number | null;
        },
        creditFeePerInputToken: bigint,
        creditFeePerOutputToken: bigint,
        model: string
    ) {
        let cost = 0n;

        if (chatResult.inputTokens > 0 && creditFeePerInputToken) {
            const adjustedInputTokens = this._calculateTokenCost(
                chatResult.inputTokens,
                model
            );
            cost += BigInt(adjustedInputTokens) * creditFeePerInputToken;
        }

        if (chatResult.outputTokens > 0 && creditFeePerOutputToken) {
            const adjustedOutputTokens = this._calculateTokenCost(
                chatResult.outputTokens,
                model
            );
            cost += BigInt(adjustedOutputTokens) * creditFeePerOutputToken;
        }

        if (
            !chatResult.inputTokens &&
            !chatResult.outputTokens &&
            chatResult.totalTokens > 0
        ) {
            // Fallback in case the interface doesn't provide input/output token breakdown
            const adjustedTokens = this._calculateTokenCost(
                chatResult.totalTokens,
                model
            );
            cost =
                BigInt(adjustedTokens) *
                (creditFeePerOutputToken ?? creditFeePerInputToken ?? 0n);
        }
        return cost;
    }

    private _calculateTokenCost(tokens: number, model: string) {
        const tokenModifierRatio = this._chatOptions.tokenModifierRatio;
        const modifier = tokenModifierRatio[model] ?? 1;
        const adjustedTokens = modifier * tokens;
        return adjustedTokens;
    }

    @traced(TRACE_NAME)
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

            if (allowedFeatures.ai.chat.allowedModels) {
                const allowedModels = allowedFeatures.ai.chat.allowedModels;
                if (!allowedModels.includes(model)) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'The subscription does not permit the given model for AI Chat features.',
                    };
                }
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

            if (this._policyStore) {
                const privacyFeatures =
                    await this._policyStore.getUserPrivacyFeatures(
                        request.userId
                    );

                if (!privacyFeatures.allowAI) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'AI Access is not allowed',
                    };
                }
            }

            const creditFeePerInputToken =
                allowedFeatures.ai.chat.creditFeePerInputToken ?? null;
            const creditFeePerOutputToken =
                allowedFeatures.ai.chat.creditFeePerOutputToken ?? null;
            const preChargeInputTokens = BigInt(
                this._calculateTokenCost(
                    allowedFeatures.ai.chat.preChargeInputTokens ?? 100,
                    model
                )
            );
            const preChargeOutputTokens = BigInt(
                this._calculateTokenCost(
                    allowedFeatures.ai.chat.preChargeOutputTokens ?? 100,
                    model
                )
            );
            const initialAmount =
                creditFeePerInputToken || creditFeePerOutputToken
                    ? preChargeInputTokens * (creditFeePerInputToken ?? 0n) +
                      preChargeOutputTokens * (creditFeePerOutputToken ?? 0n)
                    : null;

            const billing = await billForUsage(this._financial, {
                userId: request.userId,
                transferCode: TransferCodes.records_usage_fee,
            });

            const initialResult = await billing.next(
                success({
                    initialCost: initialAmount,
                })
            );

            if (isFailure(initialResult.value)) {
                return genericResult(initialResult.value);
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

            let totalTokens = 0;
            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            for await (let chunk of result) {
                totalTokens += chunk.totalTokens;
                totalInputTokens += chunk.inputTokens;
                totalOutputTokens += chunk.outputTokens;
                if (chunk.totalTokens > 0) {
                    const adjustedTokens = this._calculateTokenCost(
                        chunk.totalTokens,
                        model
                    );
                    await this._metrics.recordChatMetrics({
                        userId: request.userId,
                        createdAtMs: Date.now(),
                        tokens: adjustedTokens,
                    });
                }

                yield {
                    choices: chunk.choices,
                };
            }

            const cost = this._calculateChatBillingCost(
                {
                    totalTokens,
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                },
                creditFeePerInputToken,
                creditFeePerOutputToken,
                model
            );

            const finalResult = await billing.next(
                success({
                    cost,
                })
            );

            if (isFailure(finalResult.value)) {
                return genericResult(finalResult.value);
            }

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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

    @traced(TRACE_NAME)
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

            if (this._policyStore) {
                const privacyFeatures =
                    await this._policyStore.getUserPrivacyFeatures(
                        request.userId
                    );

                if (!privacyFeatures.allowAI) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'AI Access is not allowed',
                    };
                }
            }

            const creditFeePerSkybox =
                allowedFeatures.ai.skyboxes.creditFeePerSkybox ?? null;
            const amount = creditFeePerSkybox
                ? BigInt(creditFeePerSkybox)
                : null;

            const billing = await billForUsage(this._financial, {
                userId: request.userId,
                transferCode: TransferCodes.records_usage_fee,
            });

            const initialResult = await billing.next(
                success({
                    initialCost: amount,
                })
            );

            if (isFailure(initialResult.value)) {
                return genericResult(initialResult.value);
            }

            const result = await wrap(
                async () =>
                    await this._generateSkybox.generateSkybox({
                        prompt: request.prompt,
                        negativePrompt: request.negativePrompt,
                        blockadeLabs: request.blockadeLabs,
                    })
            );

            if (isFailure(result)) {
                logError(
                    result.error,
                    '[AIController] Skybox generation error:'
                );

                // Need to pass failure to billing to ensure that it cancels pending transfers
                await billing.next(
                    failure({
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                    })
                );

                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'A server error occurred.',
                };
            }

            if (result.value.success === true) {
                await this._metrics.recordSkyboxMetrics({
                    userId: request.userId,
                    createdAtMs: Date.now(),
                    skyboxes: 1,
                });

                const finalResult = await billing.next(
                    success({
                        cost: amount,
                    })
                );

                if (isFailure(finalResult.value)) {
                    return genericResult(finalResult.value);
                }

                return {
                    success: true,
                    skyboxId: result.value.skyboxId,
                };
            } else {
                // Pass the skybox generation error to billing
                await billing.next(failure(result.value));

                // Return the original skybox error, not the billing error
                return result.value;
            }
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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

    @traced(TRACE_NAME)
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

            if (this._policyStore) {
                const privacyFeatures =
                    await this._policyStore.getUserPrivacyFeatures(
                        request.userId
                    );

                if (!privacyFeatures.allowAI) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'AI Access is not allowed',
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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

    @traced(TRACE_NAME)
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

            const totalSquarePixels = Math.max(width, height) * numberOfImages;

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
                totalSquarePixels >
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
                totalSquarePixels + metrics.totalSquarePixelsInCurrentPeriod >
                    allowedFeatures.ai.images.maxSquarePixelsPerPeriod
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: `The user has reached their limit for the current subscription period.`,
                };
            }

            if (this._policyStore) {
                const privacyFeatures =
                    await this._policyStore.getUserPrivacyFeatures(
                        request.userId
                    );

                if (!privacyFeatures.allowAI) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'AI Access is not allowed',
                    };
                }
            }

            const creditFeePerSquarePixel =
                allowedFeatures.ai.images.creditFeePerSquarePixel ?? null;
            const amount = creditFeePerSquarePixel
                ? BigInt(Math.ceil(totalSquarePixels * creditFeePerSquarePixel))
                : null;

            const billing = await billForUsage(this._financial, {
                userId: request.userId,
                transferCode: TransferCodes.records_usage_fee,
            });

            const initialResult = await billing.next(
                success({
                    initialCost: amount,
                })
            );

            if (isFailure(initialResult.value)) {
                return genericResult(initialResult.value);
            }

            const result = await wrap(
                async () =>
                    await provider.generateImage({
                        model: model,
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
                    })
            );

            if (isFailure(result)) {
                logError(result.error, `[AIController] Generate image error:`);

                // Need to pass failure to billing to ensure that it cancels pending transfers
                await billing.next(
                    failure({
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                    })
                );

                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'A server error occurred.',
                };
            }

            if (result.value.success === false) {
                // Pass the image generation error to billing
                await billing.next(failure(result.value));

                return result.value;
            }

            await this._metrics.recordImageMetrics({
                userId: request.userId,
                createdAtMs: Date.now(),
                squarePixels: totalSquarePixels,
            });

            const finalResult = await billing.next(
                success({
                    cost: amount,
                })
            );

            if (isFailure(finalResult.value)) {
                return genericResult(finalResult.value);
            }

            return {
                success: true,
                images: result.value.images,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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

    @traced(TRACE_NAME)
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

            const recordName = request.recordName ?? request.userId;

            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            const authResult =
                await this._policies.authorizeSubjectUsingContext(
                    context.context,
                    {
                        resourceKind: 'ai.hume',
                        action: 'create',
                        markers: null,
                        subjectId: request.userId,
                        subjectType: 'user',
                    }
                );

            if (authResult.success === false) {
                return authResult;
            }

            let metricsFilter: SubscriptionFilter = {};
            if (context.context.recordStudioId) {
                metricsFilter.studioId = context.context.recordStudioId;
            } else {
                metricsFilter.ownerId = context.context.recordOwnerId;
            }
            const metrics = await this._metrics.getSubscriptionRecordMetrics(
                metricsFilter
            );
            const config = await this._config.getSubscriptionConfiguration();
            const features = getHumeAiFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                context.context.recordStudioId ? 'studio' : 'user'
            );

            if (!features.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit Hume AI features.',
                };
            }

            let humeConfig: HumeConfig;
            if (context.context.recordStudioId) {
                humeConfig = await this._recordsStore.getStudioHumeConfig(
                    context.context.recordStudioId
                );
            }
            humeConfig ??= this._humeConfig;

            if (!humeConfig) {
                if (context.context.recordStudioId) {
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage:
                            'The studio does not have a Hume configuration.',
                    };
                }

                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit Hume AI features.',
                };
            }

            if (this._policyStore) {
                const privacyFeatures =
                    await this._policyStore.getUserPrivacyFeatures(
                        request.userId
                    );

                if (!privacyFeatures.allowAI) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'AI Access is not allowed',
                    };
                }
            }

            const fee = features.creditFeePerAccessToken;

            const billing = await billForUsage(this._financial, {
                userId: context.context.recordOwnerId,
                studioId: context.context.recordStudioId,
                transferCode: TransferCodes.records_usage_fee,
            });

            const initialResult = await billing.next(
                success({
                    initialCost: fee,
                })
            );

            if (isFailure(initialResult.value)) {
                return genericResult(initialResult.value);
            }

            const result = await this._humeInterface.getAccessToken({
                apiKey: humeConfig.apiKey,
                secretKey: humeConfig.secretKey,
            });

            if (result.success === true) {
                const costResult = await billing.next(
                    success({
                        cost: fee,
                    })
                );

                if (isFailure(costResult.value)) {
                    return genericResult(costResult.value);
                }

                return {
                    success: true,
                    accessToken: result.accessToken,
                    expiresIn: result.expiresIn,
                    issuedAt: result.issuedAt,
                    tokenType: result.tokenType,
                };
            } else {
                const cancelResult = await billing.next(failure(result));
                if (isFailure(cancelResult.value)) {
                    return genericResult(cancelResult.value);
                }

                return result;
            }
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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

    @traced(TRACE_NAME)
    async sloydGenerateModel(
        request: AISloydGenerateModelRequest
    ): Promise<AISloydGenerateModelResponse> {
        try {
            if (!this._sloydInterface) {
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

            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            const authResult =
                await this._policies.authorizeSubjectUsingContext(
                    context.context,
                    {
                        resourceKind: 'ai.sloyd',
                        action: 'create',
                        markers: null,
                        subjectId: request.userId,
                        subjectType: 'user',
                    }
                );

            if (authResult.success === false) {
                return authResult;
            }

            let metricsFilter: SubscriptionFilter = {};
            if (context.context.recordStudioId) {
                metricsFilter.studioId = context.context.recordStudioId;
            } else {
                metricsFilter.ownerId = context.context.recordOwnerId;
            }

            const metrics = await this._metrics.getSubscriptionAiSloydMetrics(
                metricsFilter
            );
            const config = await this._config.getSubscriptionConfiguration();
            const features = getSloydAiFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                context.context.recordStudioId ? 'studio' : 'user'
            );

            if (!features.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit Sloyd AI features.',
                };
            }

            console.log(
                `[AIController] [sloydGenerateModel] [maxModelsPerPeriod: ${features.maxModelsPerPeriod} totalModelsInCurrentPeriod: ${metrics.totalModelsInCurrentPeriod}]`
            );

            if (
                typeof features.maxModelsPerPeriod === 'number' &&
                metrics.totalModelsInCurrentPeriod >=
                    features.maxModelsPerPeriod
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: `The request exceeds allowed subscription limits.`,
                };
            }

            if (this._policyStore) {
                const privacyFeatures =
                    await this._policyStore.getUserPrivacyFeatures(
                        request.userId
                    );

                if (!privacyFeatures.allowAI) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: 'AI Access is not allowed',
                    };
                }
            }

            const result = await (request.baseModelId
                ? this._sloydInterface.editModel({
                      prompt: request.prompt,
                      modelMimeType: request.outputMimeType,
                      levelOfDetail: request.levelOfDetail,
                      thumbnailPreviewExportType: request.thumbnail?.type,
                      thumbnailPreviewSizeX: request.thumbnail?.width,
                      thumbnailPreviewSizeY: request.thumbnail?.height,
                      interactionId: request.baseModelId,
                  })
                : this._sloydInterface.createModel({
                      prompt: request.prompt,
                      modelMimeType: request.outputMimeType,
                      levelOfDetail: request.levelOfDetail,
                      thumbnailPreviewExportType: request.thumbnail?.type,
                      thumbnailPreviewSizeX: request.thumbnail?.width,
                      thumbnailPreviewSizeY: request.thumbnail?.height,
                  }));

            if (result.success === false) {
                return result;
            }

            const response: AISloydGenerateModelSuccess = {
                success: true,
                modelId: result.interactionId,
                mimeType: request.outputMimeType,
                modelData:
                    typeof result.modelData === 'string'
                        ? result.modelData
                        : fromByteArray(result.modelData),
                thumbnailBase64: result.previewImage,
            };

            if ('name' in result && typeof result.name === 'string') {
                response.name = (
                    result as AISloydInterfaceCreateModelSuccess
                ).name;
                response.confidence = (
                    result as AISloydInterfaceCreateModelSuccess
                ).confidenceScore;
            }

            await this._metrics.recordSloydMetrics({
                userId: context.context.recordOwnerId ?? undefined,
                studioId: context.context.recordStudioId ?? undefined,
                modelId: response.modelId,
                confidence: response.confidence,
                mimeType: response.mimeType,
                modelData: response.modelData,
                name: response.name,
                thumbnailBase64: response.thumbnailBase64,
                createdAtMs: Date.now(),
                baseModelId: request.baseModelId,
                modelsCreated: 1,
            });

            return response;
        } catch (err) {
            console.error(
                '[AIController] Error handling sloyd create model request:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async createOpenAIRealtimeSessionToken(
        request: AICreateOpenAIRealtimeSessionTokenRequest
    ): Promise<AICreateOpenAIRealtimeSessionTokenResult> {
        try {
            if (!this._openAIRealtimeInterface) {
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

            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            const authResult =
                await this._policies.authorizeSubjectUsingContext(
                    context.context,
                    {
                        resourceKind: 'ai.openai.realtime',
                        action: 'create',
                        markers: null,
                        subjectId: request.userId,
                        subjectType: 'user',
                    }
                );

            if (authResult.success === false) {
                return authResult;
            }

            let metricsFilter: SubscriptionFilter = {};
            if (context.context.recordStudioId) {
                metricsFilter.studioId = context.context.recordStudioId;
            } else {
                metricsFilter.ownerId = context.context.recordOwnerId;
            }

            const metrics =
                await this._metrics.getSubscriptionAiOpenAIRealtimeMetrics(
                    metricsFilter
                );
            const config = await this._config.getSubscriptionConfiguration();
            const features = getOpenAiFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                context.context.recordStudioId ? 'studio' : 'user'
            );

            if (!features.realtime.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit OpenAI Realtime features.',
                };
            }

            if (
                typeof features.realtime.maxSessionsPerPeriod === 'number' &&
                metrics.totalSessionsInCurrentPeriod >=
                    features.realtime.maxSessionsPerPeriod
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: `The request exceeds allowed subscription limits.`,
                };
            }

            if (
                typeof features.realtime.allowedModels !== 'undefined' &&
                !features.realtime.allowedModels.includes(request.request.model)
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        "The subscription doesn't support the given model.",
                };
            }

            const creditFeePerRealtimeSession =
                features.realtime.creditFeePerRealtimeSession ?? null;
            const amount = creditFeePerRealtimeSession
                ? BigInt(creditFeePerRealtimeSession)
                : null;

            const billing = await billForUsage(this._financial, {
                userId: context.context.recordOwnerId ?? undefined,
                studioId: context.context.recordStudioId ?? undefined,
                transferCode: TransferCodes.records_usage_fee,
            });

            const initialResult = await billing.next(
                success({
                    initialCost: amount,
                })
            );

            if (isFailure(initialResult.value)) {
                return genericResult(initialResult.value);
            }

            const tokenRequest: CreateRealtimeSessionTokenRequest = {
                ...request.request,
                maxResponseOutputTokens:
                    features.realtime.maxResponseOutputTokens ??
                    request.request.maxResponseOutputTokens ??
                    undefined,
            };

            const result = await wrap(
                async () =>
                    await this._openAIRealtimeInterface.createRealtimeSessionToken(
                        tokenRequest
                    )
            );

            if (isFailure(result)) {
                console.error(
                    '[AIController] Create OpenAI Realtime session token request failed:',
                    result
                );

                // Need to pass failure to billing to ensure that it cancels pending transfers
                await billing.next(
                    failure({
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                    })
                );

                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'A server error occurred.',
                };
            }

            if (result.value.success === false) {
                // Pass the token creation error to billing
                await billing.next(failure(result.value));

                return result.value;
            }

            await this._metrics.recordOpenAIRealtimeMetrics({
                userId: context.context.recordOwnerId ?? undefined,
                studioId: context.context.recordStudioId ?? undefined,
                sessionId: result.value.sessionId,
                createdAtMs: Date.now(),
                request: tokenRequest,
            });

            const finalResult = await billing.next(
                success({
                    cost: amount,
                })
            );

            if (isFailure(finalResult.value)) {
                return genericResult(finalResult.value);
            }

            return {
                success: true,
                sessionId: result.value.sessionId,
                clientSecret: result.value.clientSecret,
            };
        } catch (err) {
            console.error(
                '[AIController] Error handling createOpenAIRealtimeSessionToken request:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async listChatModels(
        request: ListChatModelsRequest
    ): Promise<Result<ListedChatModel[], SimpleError>> {
        try {
            if (!this._chatProviders) {
                return failure({
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                });
            }

            if (!request.userId) {
                return failure({
                    errorCode: 'not_logged_in',
                    errorMessage: 'The user is not logged in.',
                });
            }

            let allowedModels;
            if (!isSuperUserRole(request.userRole)) {
                if (
                    this._allowedChatSubscriptionTiers !== true &&
                    !this._matchesSubscriptionTiers(
                        request.userSubscriptionTier,
                        this._allowedChatSubscriptionTiers
                    )
                ) {
                    if (!request.userSubscriptionTier) {
                        return failure({
                            errorCode: 'not_subscribed',
                            errorMessage:
                                'The user must be subscribed in order to use this operation.',
                            allowedSubscriptionTiers: [
                                ...(this
                                    ._allowedChatSubscriptionTiers as Set<string>),
                            ],
                        });
                    } else {
                        return failure({
                            errorCode: 'invalid_subscription_tier',
                            errorMessage:
                                'This operation is not available to the user at their current subscription tier.',
                            allowedSubscriptionTiers: [
                                ...(this
                                    ._allowedChatSubscriptionTiers as Set<string>),
                            ],
                            currentSubscriptionTier:
                                request.userSubscriptionTier,
                        });
                    }
                }

                const metrics =
                    await this._metrics.getSubscriptionAiChatMetrics({
                        ownerId: request.userId,
                    });
                const config =
                    await this._config.getSubscriptionConfiguration();
                const allowedFeatures = getSubscriptionFeatures(
                    config,
                    metrics.subscriptionStatus,
                    metrics.subscriptionId,
                    'user'
                );

                if (!allowedFeatures.ai.chat.allowed) {
                    return failure({
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The subscription does not permit AI Chat features.',
                    });
                }

                if (this._policyStore) {
                    const privacyFeatures =
                        await this._policyStore.getUserPrivacyFeatures(
                            request.userId
                        );

                    if (!privacyFeatures.allowAI) {
                        return failure({
                            errorCode: 'not_authorized',
                            errorMessage: 'AI Access is not allowed',
                        });
                    }
                }

                allowedModels = allowedFeatures.ai.chat.allowedModels ?? [
                    ...this._allowedChatModels.keys(),
                ];
            } else {
                allowedModels = [...this._allowedChatModels.keys()];
            }

            const models: ListedChatModel[] = [];
            for (const model of allowedModels) {
                const provider = this._allowedChatModels.get(model);
                if (provider) {
                    models.push({
                        name: model,
                        provider: provider,
                        isDefault:
                            model === this._chatOptions.defaultModel &&
                            provider === this._chatOptions.defaultModelProvider,
                    });
                }
            }

            return success(models);
        } catch (err) {
            console.error(
                '[AIController] Error handling listChatModels request:',
                err
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            });
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

    /**
     * The maximum number of tokens that should be generated.
     */
    totalTokens?: number;
}

export type AIChatResponse = AIChatSuccess | AIChatFailure;

export interface AIChatSuccess {
    success: true;
    choices: AIChatMessage[];
}

export interface AIChatFailure {
    success: false;
    errorCode: KnownErrorCodes;
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
    errorCode: KnownErrorCodes;
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
        | NotSupportedError
        | NotAuthorizedError;
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
    errorCode: KnownErrorCodes;
    errorMessage: string;

    allowedSubscriptionTiers?: string[];
    currentSubscriptionTier?: string;
}

export interface AIHumeGetAccessTokenRequest {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The name of the record that the request is for.
     * If omitted, then the userId will be used for the record name.
     */
    recordName?: string;
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

    errorCode: KnownErrorCodes;
    errorMessage: string;
}

export interface AISloydGenerateModelRequest {
    /**
     * The ID of the user that is logged in.
     */
    userId: string;

    /**
     * The name of the record that the request is for.
     */
    recordName: string;

    /**
     * The prompt that should be used to create the model.
     */
    prompt: string;

    /**
     * The MIME type that should be output.
     * - `model/gltf+json` indicates that the output should be a glTF file.
     * - `model/gltf-binary` indicates that the output should be a glb file.
     */
    outputMimeType: 'model/gltf+json' | 'model/gltf-binary';

    /**
     * The level of detail of the model that should be created.
     * Higher values indicate higher levels of detail.
     * Should be between 0.01 and 1.
     * Defaults to 0.5.
     */
    levelOfDetail?: number;

    /**
     * The ID of the model that the new model should be based on.
     */
    baseModelId?: string | null;

    /**
     * Options for generating a thumbnail for the model.
     * If not provided, no thumbnail will be generated.
     */
    thumbnail?: {
        /**
         * The mime type of the thumbnail.
         */
        type: 'image/png';

        /**
         * The desired width of the thumbnail in pixels.
         */
        width: number;

        /**
         * The desired height of the thumbnail in pixels.
         */
        height: number;
    };
}

/**
 * The response to a request to generate a model using the Sloyd AI interface.
 *
 * @dochash types/ai
 * @docname AISloydGenerateModelResponse
 */
export type AISloydGenerateModelResponse =
    | AISloydGenerateModelSuccess
    | AISloydGenerateModelFailure;

/**
 * A successful response to a request to generate a model using the Sloyd AI interface.
 *
 * @dochash types/ai
 * @docname AISloydGenerateModelSuccess
 */
export interface AISloydGenerateModelSuccess {
    success: true;

    /**
     * The ID of the model that was created.
     */
    modelId: string;

    /**
     * The name of the model.
     */
    name?: string;

    /**
     * The confidence of the AI in the created model.
     */
    confidence?: number;

    /**
     * The MIME type of the model.
     */
    mimeType: 'model/gltf+json' | 'model/gltf-binary';

    /**
     * The data for the model.
     * If the mimeType is "model/gltf+json", then this will be a JSON string.
     * If the mimeType is "model/gltf-binary", then this will be a base64 encoded string.
     */
    modelData: string;

    /**
     * The base64 encoded thumbnail of the model.
     */
    thumbnailBase64?: string;
}

/**
 * A failed response to a request to generate a model using the Sloyd AI interface.
 *
 * @dochash types/ai
 * @docname AISloydGenerateModelFailure
 */
export interface AISloydGenerateModelFailure {
    success: false;

    /**
     * The error code.
     */
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSubscribedError
        | InvalidSubscriptionTierError
        | NotSupportedError
        | SubscriptionLimitReached
        | NotAuthorizedError
        | AuthorizeSubjectFailure['errorCode']
        | AISloydInterfaceCreateModelFailure['errorCode'];

    /**
     * The error message.
     */
    errorMessage: string;

    /**
     * The reason why the request was denied.
     */
    reason?: DenialReason;
}

export interface AICreateOpenAIRealtimeSessionTokenRequest {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The name of the record that the request is for.
     */
    recordName: string;

    /**
     * The request for the realtime session.
     */
    request: CreateRealtimeSessionTokenRequest;
}

/**
 * The response to a request to create a realtime session token using the OpenAI interface.
 * @dochash types/ai
 * @docname AICreateOpenAIRealtimeSessionTokenResult
 */
export type AICreateOpenAIRealtimeSessionTokenResult =
    | AICreateOpenAIRealtimeSessionTokenSuccess
    | AICreateOpenAIRealtimeSessionTokenFailure;

/**
 * A successful response to a request to create a realtime session token using the OpenAI interface.
 * @dochash types/ai
 * @docname AICreateOpenAIRealtimeSessionTokenSuccess
 */
export interface AICreateOpenAIRealtimeSessionTokenSuccess {
    success: true;
    sessionId: string;
    clientSecret: {
        value: string;
        expiresAt: number;
    };
}

/**
 * A unsuccessful response to a request to create a realtime session token using the OpenAI interface.
 * @dochash types/ai
 * @docname AICreateOpenAIRealtimeSessionTokenFailure
 */
export interface AICreateOpenAIRealtimeSessionTokenFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

/**
 * Defines a request to list available chat models.
 */
export interface ListChatModelsRequest {
    /**
     * The ID of the currently logged in user.
     */
    userId: string;

    /**
     * The role of the user.
     */
    userRole: UserRole;

    /**
     * The tier of the user's subscription.
     * Null if the user doesn't have a subscription.
     */
    userSubscriptionTier: string | null;
}

/**
 * Defines a listed chat model.
 *
 * @dochash types/ai
 * @docname ListedChatModel
 */
export interface ListedChatModel {
    /**
     * The name of the model.
     */
    name: string;

    /**
     * The provider of the model.
     */
    provider: string;

    /**
     * Whether this is the default model.
     */
    isDefault?: boolean;
}
