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
