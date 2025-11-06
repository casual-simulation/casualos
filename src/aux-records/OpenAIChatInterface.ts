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
import { handleAxiosErrors } from './Utils';
import type {
    AIChatInterface,
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIChatInterfaceStreamResponse,
    AIChatMessage,
    AIChatMessageRole,
    AIFunctionCall,
} from './AIChatInterface';
import axios from 'axios';
import OpenAI from 'openai';
import { traced } from './tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

const TRACE_NAME = 'OpenAIChatInterface';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'openai',
        'service.name': 'openai',
    },
};

export interface OpenAIChatOptions {
    /**
     * The API key to use.
     */
    apiKey: string;

    /**
     * The HTTP base URL to use for the OpenAI API.
     * Defaults to "https://api.openai.com/v1/"
     */
    baseUrl?: string;

    /**
     * The name of this interface to use for logging;
     */
    name?: string;

    /**
     * The additional properties that should be included in requests.
     */
    additionalProperties?: Record<string, any>;
}

/**
 * Defines a class that implements {@link AIChatInterface} using the OpenAI API.
 */
export class OpenAIChatInterface implements AIChatInterface {
    private _options: OpenAIChatOptions;
    private _client: OpenAI;
    private _additionalProperties: Record<string, any>;

    private get _baseUrl() {
        return this._options.baseUrl ?? 'https://api.openai.com/v1/';
    }

    private get _name() {
        return this._options.name ?? 'OpenAIChatInterface';
    }

    constructor(options: OpenAIChatOptions) {
        this._options = options;
        this._client = new OpenAI({
            apiKey: options.apiKey,
            baseURL: this._options.baseUrl ?? undefined,
        });
        this._additionalProperties = options.additionalProperties ?? {};
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async chat(
        request: AIChatInterfaceRequest
    ): Promise<AIChatInterfaceResponse> {
        try {
            if (this._options.name) {
                const span = trace.getActiveSpan();
                if (span) {
                    span.setAttribute(
                        'chat.interface.name',
                        this._options.name
                    );
                }
            }

            const result = await axios.post(
                `${this._baseUrl}chat/completions`,
                {
                    ...this._additionalProperties,
                    model: request.model,
                    messages: request.messages.map((m) => ({
                        role: m.role,
                        content:
                            typeof m.content === 'string'
                                ? m.content
                                : m.content.map((c) =>
                                      'text' in c
                                          ? {
                                                type: 'text',
                                                text: c.text,
                                            }
                                          : 'url' in c
                                          ? {
                                                type: 'image_url',
                                                image_url: {
                                                    url: c.url,
                                                },
                                            }
                                          : {
                                                type: 'image_url',
                                                image_url: {
                                                    url: `data:${
                                                        c.mimeType ||
                                                        'image/png'
                                                    };base64,${c.base64}`,
                                                },
                                            }
                                  ),
                        name: m.author,
                        function_call: m.functionCall,
                    })),
                    temperature: request.temperature,
                    top_p: request.topP,
                    presence_penalty: request.presencePenalty,
                    frequency_penalty: request.frequencyPenalty,
                    stop: request.stopWords,
                    user: request.userId,
                    max_tokens: request.maxTokens,
                    max_completion_tokens: request.maxCompletionTokens,
                    reasoning_effort: request.reasoningEffort,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this._options.apiKey}`,
                    },
                }
            );

            console.log(
                `[${this._name}] [${request.userId}] [chat]: Total tokens: ${result.data.usage.total_tokens}`
            );
            console.log(
                `[${this._name}] [${request.userId}] [chat]: Usage:`,
                result.data.usage
            );

            let choices: AIChatMessage[] = result.data.choices.map(
                (c: ChatChoice) => ({
                    role: c.message.role,
                    content: c.message.content,
                    author: c.message.name,
                    functionCall: c.message.function_call,
                    finishReason: c.finishReason,
                })
            );

            return {
                choices: choices,
                totalTokens: result.data.usage?.total_tokens ?? 0,
            };
        } catch (err) {
            if (axios.isAxiosError(err)) {
                if (err.response.status === 400) {
                    const span = trace.getActiveSpan();
                    span?.recordException(err);
                    span?.setStatus({ code: SpanStatusCode.ERROR });

                    console.error(
                        `[${this._name}] [${request.userId}] [chat]: Bad request: ${err.response.data.error.message}`
                    );
                    return {
                        choices: [
                            {
                                role: 'system',
                                content: `Error: ${err.response.data.error.message}`,
                            },
                        ],
                        totalTokens: 0,
                    };
                }
            }
            handleAxiosErrors(err);
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async *chatStream(
        request: AIChatInterfaceRequest
    ): AsyncIterable<AIChatInterfaceStreamResponse> {
        if (this._options.name) {
            const span = trace.getActiveSpan();
            if (span) {
                span.setAttribute('chat.interface.name', this._options.name);
            }
        }

        const res = await this._client.chat.completions.create({
            ...this._additionalProperties,
            model: request.model,
            messages: request.messages.map((m) => ({
                role: m.role,
                content:
                    typeof m.content === 'string'
                        ? m.content
                        : m.content.map((c) =>
                              'text' in c
                                  ? ({
                                        type: 'text',
                                        text: c.text,
                                    } as const)
                                  : 'url' in c
                                  ? ({
                                        type: 'image_url',
                                        image_url: {
                                            url: c.url,
                                        },
                                    } as const)
                                  : ({
                                        type: 'image_url',
                                        image_url: {
                                            url: `data:${
                                                c.mimeType || 'image/png'
                                            };base64,${c.base64}`,
                                        },
                                    } as const)
                          ),
                name: m.author,
                function: m.functionCall,
            })) as any[],
            temperature: request.temperature,
            top_p: request.topP,
            presence_penalty: request.presencePenalty,
            frequency_penalty: request.frequencyPenalty,
            stop: request.stopWords,
            user: request.userId,
            max_tokens: request.maxTokens,
            max_completion_tokens: request.maxCompletionTokens,
            reasoning_effort: request.reasoningEffort,
            stream: true,
            stream_options: {
                include_usage: true,
            },
        });

        for await (const chunk of res) {
            yield {
                choices: chunk.choices.map((c) => ({
                    content: c.delta.content,
                    role: c.delta.role as AIChatMessageRole,
                    finishReason: c.finish_reason,
                    functionCall: c.delta
                        .function_call as unknown as AIFunctionCall,
                })),
                totalTokens: chunk.usage?.total_tokens ?? 0,
            };
        }
    }
}

interface ChatChoice {
    finishReason: string;
    message: {
        role: string;
        content: string;
        name: string;
        function_call: any;
    };
}
