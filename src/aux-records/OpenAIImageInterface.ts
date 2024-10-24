import {
    AIChatInterface,
    AIChatInterfaceRequest,
    AIChatInterfaceResponse,
    AIChatMessage,
} from './AIChatInterface';
import axios from 'axios';
import {
    AIGenerateImageInterfaceRequest,
    AIGenerateImageInterfaceResponse,
    AIGeneratedImage,
    AIImageInterface,
} from './AIImageInterface';
import { handleAxiosErrors } from './Utils';
import { traced } from './tracing/TracingDecorators';
import { SpanKind, SpanOptions } from '@opentelemetry/api';

const TRACE_NAME = 'OpenAIImageInterface';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'openai',
        'service.name': 'openai',
    },
};

export interface OpenAIImageOptions {
    /**
     * The API key to use.
     */
    apiKey: string;

    /**
     * The width that should be used for images that don't specify a width.
     */
    defaultWidth?: number;

    /**
     * The height that should be used for images that don't specify a height.
     */
    defaultHeight?: number;
}

/**
 * Defines a class that implements AIImageInterface using the OpenAI API.
 */
export class OpenAIImageInterface implements AIImageInterface {
    private _options: OpenAIImageOptions;

    constructor(options: OpenAIImageOptions) {
        this._options = options;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async generateImage(
        request: AIGenerateImageInterfaceRequest
    ): Promise<AIGenerateImageInterfaceResponse> {
        try {
            const size = `${
                request.width ?? this._options.defaultWidth ?? 1024
            }x${request.height ?? this._options.defaultHeight ?? 1024}`;

            console.log(
                `[OpenAIImageInterface] [${request.userId}] [generateImage]: Generating image...`
            );

            const result = await axios.post(
                'https://api.openai.com/v1/images/generations',
                {
                    model: request.model,
                    prompt: request.prompt,
                    n: request.numberOfImages ?? 1,
                    size,
                    response_format: 'b64_json',
                    user: request.userId,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this._options.apiKey}`,
                    },
                }
            );

            console.log(
                `[OpenAIImageInterface] [${request.userId}] [generateImage]: Done!`
            );

            const images: AIGeneratedImage[] = result.data.data.map(
                (d: any) => ({
                    base64: d.b64_json,
                    mimeType: 'image/png',
                })
            );

            return {
                images,
            };
        } catch (err) {
            handleAxiosErrors(err);
        }
    }
}
