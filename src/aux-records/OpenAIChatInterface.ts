import { handleAxiosErrors } from './Utils';
import {
    AIChatInterface,
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIChatMessage,
} from './AIChatInterface';
import axios from 'axios';

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

    constructor(options: OpenAIChatOptions) {
        this._options = options;
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
