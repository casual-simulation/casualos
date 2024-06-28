import {
    GoogleGenerativeAI,
    Content,
    Part,
    TextPart,
    InlineDataPart,
} from '@google/generative-ai';
import {
    AIChatInterface,
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIChatInterfaceStreamResponse,
    AIChatMessage,
} from './AIChatInterface';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';

const TRACE_NAME = 'GoogleAIChatInterface';

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

    @traced(TRACE_NAME)
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
                    maxOutputTokens: request.maxTokens,
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

    @traced(TRACE_NAME)
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
                    maxOutputTokens: request.maxTokens,
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
