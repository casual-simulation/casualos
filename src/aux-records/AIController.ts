import { ServerError } from './Errors';
import { AIChatInterface, AIChatMessage } from './AIChatInterface';

export interface AIOptions {
    /**
     * The list of allowed models that are allowed to be used for chat.
     */
    allowedChatModels: string[];
}

/**
 * Defines a class that is able to handle AI requests.
 */
export class AIController {
    private _chat: AIChatInterface;
    private _options: AIOptions;

    constructor(chat: AIChatInterface, options: AIOptions) {
        this._chat = chat;
        this._options = options;
    }

    async chat(request: AIChatRequest): Promise<AIChatResponse> {
        try {
            if (!this._options.allowedChatModels.includes(request.model)) {
                return {
                    success: false,
                    errorCode: 'invalid_model',
                    errorMessage: `The given model is not allowed for chats.`,
                };
            }

            const result = await this._chat.chat({
                messages: request.messages,
                model: request.model,
                temperature: request.temperature,
                userId: request.userId,
            });

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
    model: string;

    /**
     * The ID of the currently logged in user.
     */
    userId: string;

    /**
     * The temperature of the request.
     */
    temperature?: number;
}

export type AIChatResponse = AIChatSuccess | AIChatFailure;

export interface AIChatSuccess {
    success: true;
    choices: AIChatMessage[];
}

export interface AIChatFailure {
    success: false;
    errorCode: ServerError | 'invalid_model';
    errorMessage: string;
}
