import { GoogleGenerativeAI, InputContent } from '@google/generative-ai';
import {
    AIChatInterface,
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIChatMessage,
} from './AIChatInterface';

export interface GeminiAIChatOptions {
    /**
     * The API key to use.
     */
    apiKey: string;
}

/**
 * Defines a class that implements {@link AIChatInterface} using the Gemini API.
 */
export class GeminiAIChatInterface implements AIChatInterface {
    private _options: GeminiAIChatOptions;
    private _genAI: GoogleGenerativeAI;

    constructor(options: GeminiAIChatOptions) {
        this._options = options;
        this._genAI = new GoogleGenerativeAI(options.apiKey);
    }

    async chat(
        request: AIChatInterfaceRequest
    ): Promise<AIChatInterfaceResponse> {
        const model = this._genAI.getGenerativeModel({ model: request.model });

        const messages = request.messages.map((m) => mapMessage(m));

        const historyMessages = messages.slice(0, request.messages.length - 1);

        const chat = model.startChat({
            history: historyMessages,
            generationConfig: {
                maxOutputTokens: request.maxTokens,
                topP: request.topP,
                temperature: request.temperature,
                stopSequences: request.stopWords,
            },
        });

        const result = await chat.sendMessage(
            messages[request.messages.length - 1].parts
        );

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
    }
}

function mapMessage(message: AIChatMessage): InputContent {
    return {
        role:
            message.role === 'user' || message.role === 'system'
                ? 'user'
                : 'model',
        parts:
            typeof message.content === 'string'
                ? message.content
                : mapParts(message.content),
    };
}

function mapParts(content: AIChatMessage['content']): InputContent['parts'] {
    return typeof content === 'string'
        ? content
        : content.map((c) => {
              if ('text' in c) {
                  return c.text;
              } else if ('base64' in c) {
                  return {
                      inlineData: {
                          data: c.base64,
                          mimeType: c.mimeType,
                      },
                  };
              }

              throw new Error(
                  'URL content is not supported for Google Gemini models'
              );
          });
}
