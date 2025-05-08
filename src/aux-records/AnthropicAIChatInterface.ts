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
            let maxTokens = Math.min(request.maxTokens, 4096);

            // TODO: Support 8192 tokens for sonnet
            // See https://docs.anthropic.com/en/docs/about-claude/models
            // if (/claude-3-5-sonnet/.test(request.model)) {
            //     maxTokens = Math.min(request.maxTokens, 8192);
            // }

            const response = await this._ai.messages.create({
                max_tokens: maxTokens,
                top_p: request.topP,
                temperature: request.temperature,
                stop_sequences: request.stopWords,
                model: request.model,
                messages: request.messages.map((m) => mapMessage(m)),
            });

            return {
                choices: [
                    {
                        content: mapOutputContent(response.content),
                        role: response.role,
                    },
                ],
                totalTokens:
                    response.usage.input_tokens + response.usage.output_tokens,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            if (err instanceof Error) {
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
            let maxTokens = Math.min(request.maxTokens, 4096);

            // TODO: Support 8192 tokens for sonnet
            // See https://docs.anthropic.com/en/docs/about-claude/models
            // if (/claude-3-5-sonnet/.test(request.model)) {
            //     maxTokens = Math.min(request.maxTokens, 8192);
            // }

            const response = this._ai.messages.stream({
                max_tokens: maxTokens,
                top_p: request.topP,
                temperature: request.temperature,
                stop_sequences: request.stopWords,
                model: request.model,
                messages: request.messages.map((m) => mapMessage(m)),
            });

            for await (const chunk of response) {
                if (chunk.type === 'message_start') {
                    yield {
                        choices: [],
                        totalTokens:
                            chunk.message.usage.input_tokens +
                            chunk.message.usage.output_tokens,
                    };
                } else if (chunk.type === 'content_block_delta') {
                    if (chunk.delta.type === 'text_delta') {
                        yield {
                            choices: [
                                {
                                    content: chunk.delta.text,
                                    role: 'assistant',
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
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            if (err instanceof Error) {
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
