import { flatMap } from 'lodash';
import {
    AIGenerateImageInterfaceRequest,
    AIGenerateImageInterfaceResponse,
    AIGeneratedImage,
    AIImageInterface,
} from './AIImageInterface';
import axios from 'axios';

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

    async generateImage(
        request: AIGenerateImageInterfaceRequest
    ): Promise<AIGenerateImageInterfaceResponse> {
        const engine = request.model;
        const height = request.height ?? this._options.defaultHeight ?? 1024;
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
                seed: d.seed,
            }))
        );

        return {
            images,
        };
    }
}
