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
    Content,
    Part,
    TextPart,
    InlineDataPart,
} from '@google/generative-ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

const TRACE_NAME = 'GoogleAIChatInterface';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'google',
        'service.name': 'google',
    },
};

export interface GoogleAIChatOptions {
    /**
     * The API key to use.
     */
    apiKey: string;
}

/**
 * Defines a class that implements {@link AIChatInterface} using the Google Gemini API.
 */
export class GoogleAIChatInterface implements AIChatInterface {
    private _options: GoogleAIChatOptions;
    private _genAI: GoogleGenerativeAI;

    constructor(options: GoogleAIChatOptions) {
        this._options = options;
        this._genAI = new GoogleGenerativeAI(options.apiKey);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async chat(
        request: AIChatInterfaceRequest
    ): Promise<AIChatInterfaceResponse> {
        try {
            const model = this._genAI.getGenerativeModel({
                model: request.model,
            });

            const messages = request.messages.map((m) => mapMessage(m));

            const historyMessages = messages.slice(0, messages.length - 1);
            const lastMessage = messages[messages.length - 1];
            if (historyMessages.length > 0) {
                if (
                    lastMessage.role !== 'user' ||
                    historyMessages[historyMessages.length - 1].role !== 'model'
                ) {
                    return {
                        choices: [
                            {
                                role: 'system',
                                content:
                                    'When using Google Gemini, the last message must be from the user and the second to last message (if provided) must be from the model.',
                            },
                        ],
                        totalTokens: 0,
                    };
                }
            }

            if (lastMessage.role !== 'user') {
                return {
                    choices: [
                        {
                            role: 'system',
                            content:
                                'When using Google Gemini, the last message must be from the user.',
                        },
                    ],
                    totalTokens: 0,
                };
            }

            const chat = model.startChat({
                history: historyMessages,
                generationConfig: {
                    maxOutputTokens: request.maxCompletionTokens || request.maxTokens,
                    topP: request.topP,
                    temperature: request.temperature,
                    stopSequences: request.stopWords,
                },
            });

            const result = await chat.sendMessage(lastMessage.parts);

            const response = result.response;

            const chatContents = await chat.getHistory();
            const tokens = await model.countTokens({
                contents: chatContents,
            });

            return {
                choices: [
                    {
                        role: 'assistant',
                        content: response.text(),
                    },
                ],
                totalTokens: tokens.totalTokens,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            if (err instanceof Error) {
                console.error(
                    '[GoogleAIChatInterface] Error occurred while generating content.',
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
            const model = this._genAI.getGenerativeModel({
                model: request.model,
            });

            const messages = request.messages.map((m) => mapMessage(m));

            const historyMessages = messages.slice(0, messages.length - 1);
            const lastMessage = messages[messages.length - 1];
            if (historyMessages.length > 0) {
                if (
                    lastMessage.role !== 'user' ||
                    historyMessages[historyMessages.length - 1].role !== 'model'
                ) {
                    return {
                        choices: [
                            {
                                role: 'system',
                                content:
                                    'When using Google Gemini, the last message must be from the user and the second to last message (if provided) must be from the model.',
                            },
                        ],
                        totalTokens: 0,
                    };
                }
            }

            if (lastMessage.role !== 'user') {
                return {
                    choices: [
                        {
                            role: 'system',
                            content:
                                'When using Google Gemini, the last message must be from the user.',
                        },
                    ],
                    totalTokens: 0,
                };
            }

            const chat = model.startChat({
                history: historyMessages,
                generationConfig: {
                    maxOutputTokens: request.maxCompletionTokens || request.maxTokens,
                    topP: request.topP,
                    temperature: request.temperature,
                    stopSequences: request.stopWords,
                },
            });

            const result = await chat.sendMessageStream(lastMessage.parts);

            for await (const chunk of result.stream) {
                yield {
                    choices: [
                        {
                            role: 'assistant',
                            content: chunk.text(),
                        },
                    ],
                    totalTokens: 0,
                };
            }

            const chatContents = await chat.getHistory();
            const tokens = await model.countTokens({
                contents: chatContents,
            });

            return {
                choices: [],
                totalTokens: tokens.totalTokens,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            if (err instanceof Error) {
                console.error(
                    '[GoogleAIChatInterface] Error occurred while generating content.',
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

function mapMessage(message: AIChatMessage): Content {
    return {
        role:
            message.role === 'user' || message.role === 'system'
                ? 'user'
                : 'model',
        parts: mapParts(message.content),
    };
}

function mapParts(content: AIChatMessage['content']): Part[] {
    if (typeof content === 'string') {
        return [{ text: content } as TextPart];
    }

    return content.map((c) => {
        if ('text' in c) {
            return { text: c.text };
        } else if ('base64' in c) {
            return {
                inlineData: {
                    data: c.base64,
                    mimeType: c.mimeType,
                },
            } as InlineDataPart;
        }

        throw new Error(
            'URL content is not supported for Google Gemini models'
        );
    });
}
