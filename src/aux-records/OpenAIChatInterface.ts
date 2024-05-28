import { handleAxiosErrors } from './Utils';
import {
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

export interface OpenAIChatOptions {
    /**
     * The API key to use.
     */
    apiKey: string;
}

/**
 * Defines a class that implements {@link AIChatInterface} using the OpenAI API.
 */
export class OpenAIChatInterface implements AIChatInterface {
    private _options: OpenAIChatOptions;
    private _client: OpenAI;

    constructor(options: OpenAIChatOptions) {
        this._options = options;
        this._client = new OpenAI({
            apiKey: options.apiKey,
        });
    }

    async chat(
        request: AIChatInterfaceRequest
    ): Promise<AIChatInterfaceResponse> {
        try {
            const result = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
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
                },
                {
                    headers: {
                        Authorization: `Bearer ${this._options.apiKey}`,
                    },
                }
            );

            console.log(
                `[OpenAIChatInterface] [${request.userId}] [chat]: Total tokens: ${result.data.usage.total_tokens}`
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
                totalTokens: result.data.usage.total_tokens,
            };
        } catch (err) {
            if (axios.isAxiosError(err)) {
                if (err.response.status === 400) {
                    console.error(
                        `[OpenAIChatInterface] [${request.userId}] [chat]: Bad request: ${err.response.data.error.message}`
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

    async *chatStream(
        request: AIChatInterfaceRequest
    ): AsyncIterable<AIChatInterfaceStreamResponse> {
        const res = await this._client.chat.completions.create({
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
