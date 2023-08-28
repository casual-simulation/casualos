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

    /**
     * The maximum number of tokens to allow per request.
     */
    maxTokens?: number;
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
        const result = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: request.model,
                messages: request.messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                    name: m.author,
                    function_call: m.functionCall,
                })),
                temperature: request.temperature,
                top_p: request.topP,
                presence_penalty: request.presencePenalty,
                frequency_penalty: request.frequencyPenalty,
                max_tokens: this._options.maxTokens,
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
