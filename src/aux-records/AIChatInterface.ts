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
import { z } from 'zod';

/**
 * Defines an interface that is able to send and receive AI chat messages.
 */
export interface AIChatInterface {
    /**
     * Sends a chat request to the AI API.
     * @param request The request to send.
     */
    chat(request: AIChatInterfaceRequest): Promise<AIChatInterfaceResponse>;

    /**
     * Sends a chat request to the AI API and returns an async iterable that can be used to stream the responses.
     * @param request The request to send.
     */
    chatStream(
        request: AIChatInterfaceRequest
    ): AsyncIterable<AIChatInterfaceStreamResponse>;
}

/**
 * Defines an interface that represents an AI chat request.
 */
export interface AIChatInterfaceRequest {
    /**
     * The model that should be used.
     */
    model: string;

    /**
     * The messages that should be sent to the AI.
     */
    messages: AIChatMessage[];

    /**
     * The temperature of the request.
     */
    temperature: number;

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
     * The maximum number of tokens that should be generated by the model.
     */
    maxTokens?: number;

    /**
     * The ID of the user that is making the request.
     */
    userId: string;
}

/**
 * Defines an interface that represents an AI chat response.
 */
export interface AIChatInterfaceResponse {
    /**
     * The messages that the AI responded with.
     */
    choices: AIChatMessage[];

    /**
     * The total number of tokens that were used.
     */
    totalTokens: number;
}

export interface AIChatInterfaceStreamResponse {
    /**
     * The messages that the AI responded with.
     */
    choices: AIChatStreamMessage[];

    /**
     * The total number of tokens that were used.
     */
    totalTokens: number;
}

export interface AIChatStreamMessage {
    /**
     * The role of the message.
     *
     * - `system` means that the message was generated by the system. Useful for telling the AI how to behave while.
     * - `user` means that the message was generated by the user.
     * - `assistant` means that the message was generated by the AI assistant.
     * - `function` means that the message contains the results of a function call.
     */
    role: AIChatMessageRole;

    /**
     * The content of the message.
     */
    content: string | null;

    /**
     * The reason why the message was finished.
     */
    finishReason?: string;

    /**
     * @hidden
     */
    functionCall?: AIFunctionCall;
}

/**
 * The role of a chat message.
 *
 * - `system` means that the message was generated by the system. Useful for telling the AI how to behave while.
 * - `user` means that the message was generated by the user.
 * - `assistant` means that the message was generated by the AI assistant.
 * - `function` means that the message contains the results of a function call.
 *
 * @dochash types/ai
 * @docname AIChatMessageRole
 */
export type AIChatMessageRole = 'system' | 'user' | 'assistant' | 'function';

/**
 * Defines an interface that represents a single chat message in a conversation with an AI.
 *
 * @dochash types/ai
 * @docname AIChatMessage
 */
export interface AIChatMessage {
    /**
     * The role of the message.
     *
     * - `system` means that the message was generated by the system. Useful for telling the AI how to behave while.
     * - `user` means that the message was generated by the user.
     * - `assistant` means that the message was generated by the AI assistant.
     * - `function` means that the message contains the results of a function call.
     */
    role: AIChatMessageRole;

    /**
     * The contents of the message.
     * This can be a string, an array of objects which represent the contents of the message.
     */
    content: string | AIChatContent[];

    /**
     * The name of the author of the message.
     *
     * This is required if the role is `function`.
     */
    author?: string;

    /**
     * The reason why the message was finished.
     */
    finishReason?: string;

    /**
     * @hidden
     */
    functionCall?: AIFunctionCall;
}

/**
 * Defines an interface that represents the contents of an AI chat message.
 *
 * @dochash types/ai
 * @docname AIChatContent
 */
export type AIChatContent = AITextContent | AIDataContent | AIUrlContent;

/**
 * Defines an interface that represents text that is passed to an AI chat model.
 *
 * @dochash types/ai
 * @docname AITextContent
 */
export interface AITextContent {
    /**
     * The text of the content.
     */
    text: string;
}

/**
 * Defines an interface that represents data that is passed to an AI chat model.
 * This data can be used to represent images, videos, or other types of binary data that the model supports.
 * Some models do not support this type of content.
 *
 * @dochash types/ai
 * @docname AIDataContent
 */
export interface AIDataContent {
    /**
     * The base 64 encoded data of the content.
     */
    base64: string;

    /**
     * The MIME type of the content.
     */
    mimeType: string;
}

/**
 * Defines an interface that represents a URL that is passed to an AI chat model.
 * This data can be used to represent images, videos, or other types of data that the model supports fetching.
 * Some models do not support this type of content.
 *
 * @dochash types/ai
 * @docname AIUrlContent
 */
export interface AIUrlContent {
    /**
     * The URL that the content is available at.
     */
    url: string;
}

/**
 * Defines a schema that represents an AI chat message.
 */
export const AI_CHAT_MESSAGE_SCHEMA = z.object({
    role: z.union([
        z.literal('system'),
        z.literal('user'),
        z.literal('assistant'),
        z.literal('function'),
    ]),
    content: z.union([
        z.string().nonempty(),
        z.array(
            z.union([
                z.object({
                    text: z.string().nonempty(),
                }),
                z.object({
                    base64: z.string().nonempty(),
                    mimeType: z.string().nonempty(),
                }),
                z.object({
                    url: z.string().url().nonempty(),
                }),
            ])
        ),
    ]),
    author: z.string().nonempty().optional(),
});
type ZodAIChatMessage = z.infer<typeof AI_CHAT_MESSAGE_SCHEMA>;
type ZodAIChatMessageAssertion = HasType<ZodAIChatMessage, AIChatMessage>;

/**
 * Defines an interface that represents an AI function call.
 */
export interface AIFunctionCall {
    name: string;

    /**
     * The arguments that should be passed to the function.
     */
    arguments: {
        [key: string]: any;
    };
}

type HasType<T, Q extends T> = Q;
