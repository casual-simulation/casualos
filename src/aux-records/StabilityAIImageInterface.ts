import { flatMap } from 'lodash';
import {
    AIGenerateImageInterfaceRequest,
    AIGenerateImageInterfaceResponse,
    AIGeneratedImage,
    AIImageInterface,
} from './AIImageInterface';
import axios from 'axios';
import { handleAxiosErrors } from './Utils';
import { traced } from './tracing/TracingDecorators';
import { z } from 'zod';

const TRACE_NAME = 'StabilityAIImageInterface';

export interface StabilityAIImageOptions {
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
 * Defines a class that implements AIImageInterface using the Stability AI API.
 */
export class StabilityAIImageInterface implements AIImageInterface {
    private _options: StabilityAIImageOptions;

    constructor(options: StabilityAIImageOptions) {
        this._options = options;
    }

    @traced(TRACE_NAME)
    async generateImage(
        request: AIGenerateImageInterfaceRequest
    ): Promise<AIGenerateImageInterfaceResponse> {
        try {
            const engine = request.model;

            if (engine === 'stable-image-ultra') {
                return await this._stableImageUltra(request);
            } else if (engine === 'stable-image-core') {
                return await this._stableImageCore(request);
            } else if (
                engine === 'sd3-large' ||
                engine === 'sd3-medium' ||
                engine === 'sd3-large-turbo'
            ) {
                return await this._sd3(request);
            }

            const height =
                request.height ?? this._options.defaultHeight ?? 1024;
            const width = request.width ?? this._options.defaultWidth ?? 1024;

            const text_prompts = [
                {
                    text: request.prompt,
                    weight: 1,
                },
            ];

            if (request.negativePrompt) {
                text_prompts.push({
                    text: request.negativePrompt,
                    weight: -1,
                });
            }

            console.log(
                `[StabilityAIImageInterface] [${request.userId}] [generateImage]: Generating image...`
            );

            const result = await axios.post(
                `https://api.stability.ai/v1/generation/${engine}/text-to-image`,
                {
                    height,
                    width,
                    text_prompts,
                    cfg_scale: request.cfgScale,
                    clip_guidance_preset: request.clipGuidancePreset,
                    sampler: request.sampler,
                    samples: request.numberOfImages,
                    seed: request.seed,
                    steps: request.steps,
                    style_preset: request.stylePreset,
                },
                {
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${this._options.apiKey}`,
                    },
                }
            );

            console.log(
                `[StabilityAIImageInterface] [${request.userId}] [generateImage]: Done!`
            );

            const images: AIGeneratedImage[] = flatMap(result.data, (a) =>
                a.map((d: any) => ({
                    base64: d.base64,
                    mimeType: 'image/png',
                    seed: d.seed,
                }))
            );

            return {
                images,
            };
        } catch (err) {
            handleAxiosErrors(err);
        }
    }

    @traced(TRACE_NAME)
    private async _stableImageUltra(
        request: AIGenerateImageInterfaceRequest
    ): Promise<AIGenerateImageInterfaceResponse> {
        const result = await axios.post(
            `https://api.stability.ai/v2beta/stable-image/generate/ultra`,
            axios.toFormData(
                {
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    aspect_ratio: getStableImageAspectRatio(
                        request.width ?? 1024,
                        request.height ?? 1024
                    ),
                    seed: request.seed,
                    output_format: 'png',
                },
                new FormData()
            ),
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${this._options.apiKey}`,
                },
            }
        );

        const schema = z.object({
            image: z.string(),
            seed: z.number(),
        });

        const data = schema.parse(result.data);

        return {
            images: [
                {
                    base64: data.image,
                    mimeType: 'image/png',
                    seed: data.seed,
                },
            ],
        };
    }

    @traced(TRACE_NAME)
    private async _stableImageCore(
        request: AIGenerateImageInterfaceRequest
    ): Promise<AIGenerateImageInterfaceResponse> {
        const result = await axios.post(
            `https://api.stability.ai/v2beta/stable-image/generate/core`,
            axios.toFormData(
                {
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    aspect_ratio: getStableImageAspectRatio(
                        request.width,
                        request.height
                    ),
                    seed: request.seed,
                    style_preset: request.stylePreset,
                    output_format: 'png',
                },
                new FormData()
            ),
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${this._options.apiKey}`,
                },
            }
        );

        const schema = z.object({
            image: z.string(),
            seed: z.number(),
        });

        const data = schema.parse(result.data);

        return {
            images: [
                {
                    base64: data.image,
                    mimeType: 'image/png',
                    seed: data.seed,
                },
            ],
        };
    }

    @traced(TRACE_NAME)
    private async _sd3(
        request: AIGenerateImageInterfaceRequest
    ): Promise<AIGenerateImageInterfaceResponse> {
        const engine = request.model;

        const result = await axios.post(
            `https://api.stability.ai/v2beta/stable-image/generate/sd3`,
            axios.toFormData(
                {
                    model: engine,
                    mode: 'text-to-image',
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    aspect_ratio: getStableImageAspectRatio(
                        request.width ?? 1024,
                        request.height ?? 1024
                    ),
                    seed: request.seed,
                    output_format: 'png',
                },
                new FormData()
            ),
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${this._options.apiKey}`,
                },
            }
        );

        const schema = z.object({
            image: z.string(),
            seed: z.number(),
        });

        const data = schema.parse(result.data);

        return {
            images: [
                {
                    base64: data.image,
                    mimeType: 'image/png',
                    seed: data.seed,
                },
            ],
        };
    }
}

/**
 * Gets the aspect ratio that is closest to the given width and height.
 * @param width The width.
 * @param height The height.
 */
export function getStableImageAspectRatio(
    width: number,
    height: number
): string {
    if (!width || !height) {
        return undefined;
    }

    const aspect = width / height;
    if (Math.abs(aspect - 1) < 0.01) {
        return '1:1';
    } else if (Math.abs(aspect - 16 / 9) < 0.1) {
        return '16:9';
    } else if (Math.abs(aspect - 2 / 3) < 0.01) {
        return '2:3';
    } else if (Math.abs(aspect - 3 / 2) < 0.01) {
        return '3:2';
    } else if (Math.abs(aspect - 4 / 5) < 0.01) {
        return '4:5';
    } else if (Math.abs(aspect - 5 / 4) < 0.01) {
        return '5:4';
    } else if (Math.abs(aspect - 21 / 9) < 0.1) {
        return '21:9';
    } else if (Math.abs(aspect - 9 / 21) < 0.1) {
        return '9:21';
    } else if (Math.abs(aspect - 9 / 16) < 0.1) {
        return '9:16';
    }

    return '1:1';
}
