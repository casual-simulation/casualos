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
    AIChatInterface,
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIChatInterfaceStreamResponse,
    AIChatMessage,
} from './AIChatInterface';
import { traced } from './tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources';

const TRACE_NAME = 'AnthropicAIChatInterface';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'anthropic',
        'service.name': 'anthropic',
    },
};

export interface AnthropicAIChatOptions {
    /**
     * The API key to use.
     */
    apiKey: string;
}

/**
 * Defines a class that implements {@link AIChatInterface} using the Anthropic Claude API.
 */
export class AnthropicAIChatInterface implements AIChatInterface {
    private _options: AnthropicAIChatOptions;
    private _ai: Anthropic;
    private _modelMaxOutputTokens = new Map<string, number>();

    constructor(options: AnthropicAIChatOptions) {
        this._options = options;
        this._ai = new Anthropic({
            apiKey: options.apiKey,
        });
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async chat(
        request: AIChatInterfaceRequest
    ): Promise<AIChatInterfaceResponse> {
        try {
            const maxTokens = await this._getMaxTokensForRequest(request);

            const response = await this._ai.messages.create({
                max_tokens: maxTokens,
                top_p: request.topP,
                temperature: request.temperature,
                stop_sequences: request.stopWords,
                model: request.model,
                messages: request.messages.map((m) => mapMessage(m)),
                ...(request.enableCaching
                    ? {
                          cache_control: {
                              type: 'ephemeral',
                          },
                      }
                    : {}),
            });

            return {
                choices: [
                    {
                        content: mapOutputContent(response.content),
                        role: response.role,
                        anthropic: response,
                    },
                ],
                totalTokens:
                    response.usage.input_tokens + response.usage.output_tokens,
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.setStatus({ code: SpanStatusCode.ERROR });

            if (err instanceof Error) {
                span?.recordException(err);
                console.error(
                    '[AnthropicAIChatInterface] Error occurred while generating content.',
                    err
                );
                return {
                    choices: [
                        {
                            role: 'system',
                            content: `Error: ${err.message}`,
                        },
                    ],
                    totalTokens: 0,
                };
            }
            throw err;
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async *chatStream(
        request: AIChatInterfaceRequest
    ): AsyncIterable<AIChatInterfaceStreamResponse> {
        try {
            const maxTokens = await this._getMaxTokensForRequest(request);

            const response = this._ai.messages.stream({
                max_tokens: maxTokens,
                top_p: request.topP,
                temperature: request.temperature,
                stop_sequences: request.stopWords,
                model: request.model,
                messages: request.messages.map((m) => mapMessage(m)),
                ...(request.enableCaching
                    ? {
                          cache_control: {
                              type: 'ephemeral',
                          },
                      }
                    : {}),
            });

            for await (const chunk of response) {
                if (chunk.type === 'message_start') {
                    yield {
                        choices: [],
                        totalTokens:
                            chunk.message.usage.input_tokens +
                            chunk.message.usage.output_tokens,
                        inputTokens: chunk.message.usage.input_tokens,
                        outputTokens: chunk.message.usage.output_tokens,
                    };
                } else if (chunk.type === 'content_block_delta') {
                    if (chunk.delta.type === 'text_delta') {
                        yield {
                            choices: [
                                {
                                    content: chunk.delta.text,
                                    role: 'assistant',
                                    anthropic: chunk,
                                },
                            ],
                            totalTokens: 0,
                        };
                    }
                }
            }

            return {
                choices: [],
                totalTokens: 0,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.setStatus({ code: SpanStatusCode.ERROR });

            if (err instanceof Error) {
                span?.recordException(err);
                console.error(
                    '[AnthropicAIChatInterface] Error occurred while generating content.',
                    err
                );
                yield {
                    choices: [
                        {
                            role: 'system',
                            content: `Error: ${err.message}`,
                        },
                    ],
                    totalTokens: 0,
                };
                return {
                    choices: [],
                    totalTokens: 0,
                };
            }
            throw err;
        }
    }

    private async _getMaxTokensForRequest(
        request: AIChatInterfaceRequest
    ): Promise<number> {
        const fallbackMaxTokens = 4096;
        const modelMaxTokens = await this._getModelMaxOutputTokens(
            request.model
        );
        const maxTokens = modelMaxTokens ?? fallbackMaxTokens;

        return Math.min(request.maxTokens ?? maxTokens, maxTokens);
    }

    private async _getModelMaxOutputTokens(
        model: string
    ): Promise<number | null> {
        const cached = this._modelMaxOutputTokens.get(model);
        if (typeof cached === 'number') {
            return cached;
        }

        try {
            console.log(
                `[AnthropicAIChatInterface] Fetching max output tokens for model (${model})...`
            );
            const modelInfo = await this._ai.models.retrieve(model);

            if (!modelInfo || typeof modelInfo.max_tokens !== 'number') {
                return null;
            }

            console.log(
                `[AnthropicAIChatInterface] Fetched max output tokens for model (${model}): ${modelInfo.max_tokens}`
            );
            this._modelMaxOutputTokens.set(model, modelInfo.max_tokens);
            return modelInfo.max_tokens;
        } catch (err) {
            console.warn(
                `[AnthropicAIChatInterface] Failed to fetch max output tokens for model (${model}).`,
                err
            );
            return null;
        }
    }
}

function mapMessage(message: AIChatMessage): Anthropic.Messages.MessageParam {
    return {
        role:
            message.role === 'user' || message.role === 'system'
                ? 'user'
                : 'assistant',
        content: mapContent(message.content),
    };
}

function mapContent(
    content: AIChatMessage['content']
): Anthropic.Messages.MessageParam['content'] {
    if (typeof content === 'string') {
        return content;
    }

    return content.map((c) => {
        if ('text' in c) {
            return {
                type: 'text',
                text: c.text,
            };
        } else if ('base64' in c) {
            return {
                type: 'image',
                source: {
                    data: c.base64,
                    media_type: c.mimeType as any,
                    type: 'base64',
                },
            };
        }

        throw new Error(
            'URL content is not supported for Anthropic Claude models'
        );
    });
}

function mapOutputContent(
    content: Message['content']
): AIChatMessage['content'] {
    if (content.length === 1 && content[0].type === 'text') {
        return content[0].text;
    }

    return content
        .map((c) => {
            if (c.type === 'text') {
                return {
                    text: c.text,
                };
            }
        })
        .filter((c) => !!c);
}
