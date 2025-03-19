import axios from 'axios';
import type {
    AIGenerateImageInterfaceRequest,
    AIGenerateImageInterfaceResponse,
    AIGeneratedImage,
    AIImageInterface,
} from './AIImageInterface';
import { handleAxiosErrors } from './Utils';
import { traced } from './tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { inject, injectable, optional } from 'inversify';
import { OpenAIApiKey } from './OpenAI';

const TRACE_NAME = 'OpenAIImageInterface';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'openai',
        'service.name': 'openai',
    },
};

export const OpenAIImageOptions = Symbol.for('OpenAIImageOptions');

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

@injectable()
export class OpenAIImageOptionsImpl implements OpenAIImageOptions {
    constructor(
        @inject(OpenAIApiKey) public apiKey: string,
        @optional() public defaultWidth?: number,
        @optional() public defaultHeight?: number
    ) {}
}

/**
 * Defines a class that implements AIImageInterface using the OpenAI API.
 */
@injectable()
export class OpenAIImageInterface implements AIImageInterface {
    private _options: OpenAIImageOptions;

    constructor(@inject(OpenAIImageOptions) options: OpenAIImageOptions) {
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
                success: true,
                images,
            };
        } catch (err) {
            if (axios.isAxiosError(err)) {
                if (err.response.status === 400) {
                    const span = trace.getActiveSpan();
                    span?.recordException(err);
                    span?.setStatus({ code: SpanStatusCode.ERROR });

                    console.error(
                        `[OpenAIChatInterface] [${request.userId}] [generateImage]: Bad request: ${err.response.data.error.message}`
                    );
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: err.response.data.error.message,
                    };
                }
            }
            handleAxiosErrors(err);
        }
    }
}
