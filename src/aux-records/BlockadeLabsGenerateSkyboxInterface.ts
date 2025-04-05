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
import { handleAxiosErrors } from './Utils';
import type {
    AIGenerateSkyboxInterface,
    AIGenerateSkyboxInterfaceRequest,
    AIGenerateSkyboxInterfaceResponse,
    AIGetSkyboxInterfaceResponse,
} from './AIGenerateSkyboxInterface';
import axios from 'axios';
import { traced } from './tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

const TRACE_NAME = 'BlockadeLabsGenerateSkyboxInterface';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'blockadelabs',
        'service.name': 'blockadelabs',
    },
};

/**
 * Implements the AI generate skybox interface for Blockade Labs (https://www.blockadelabs.com/).
 */
export class BlockadeLabsGenerateSkyboxInterface
    implements AIGenerateSkyboxInterface
{
    private _options: BlockadeLabsGenerateSkyboxInterfaceOptions;

    constructor(options: BlockadeLabsGenerateSkyboxInterfaceOptions) {
        this._options = options;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async generateSkybox(
        request: AIGenerateSkyboxInterfaceRequest
    ): Promise<AIGenerateSkyboxInterfaceResponse> {
        try {
            const params = new URLSearchParams({
                api_key: this._options.apiKey,
                prompt: request.prompt,
            });

            if (request.negativePrompt) {
                params.set('negative_text', request.negativePrompt);
            }

            if (request.blockadeLabs) {
                if ('seed' in request.blockadeLabs) {
                    params.set('seed', String(request.blockadeLabs.seed));
                }
                if ('skyboxStyleId' in request.blockadeLabs) {
                    params.set(
                        'skybox_style_id',
                        String(request.blockadeLabs.skyboxStyleId)
                    );
                }
                if ('remixImagineId' in request.blockadeLabs) {
                    params.set(
                        'skybox_style_id',
                        String(request.blockadeLabs.remixImagineId)
                    );
                }
            }

            console.log(
                `[BlockadeLabsGenerateSkyboxInterface] [generateSkybox]: Generating skybox...`
            );
            const response = await axios.post(
                'https://backend.blockadelabs.com/api/v1/skybox',
                params,
                {}
            );

            const id: number = response.data.id;
            console.log(
                `[BlockadeLabsGenerateSkyboxInterface] [generateSkybox] [${id}]: ID recieved.`
            );
            return {
                success: true,
                skyboxId: String(id),
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });
            handleAxiosErrors(err);
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getSkybox(skyboxId: string): Promise<AIGetSkyboxInterfaceResponse> {
        try {
            console.log(
                `[BlockadeLabsGenerateSkyboxInterface] [getSkybox]: Getting skybox status...`
            );
            const id: number = parseInt(skyboxId);
            const status = await this._downloadStatus(id);

            console.log(
                `[BlockadeLabsGenerateSkyboxInterface] [getSkybox] [${id}]: Status recieved:`,
                status
            );
            return {
                success: true,
                status: isFinished(status) ? 'generated' : 'pending',
                fileUrl: status.file_url,
                thumbnailUrl: status.thumb_url,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });
            handleAxiosErrors(err);
        }
    }

    private async _downloadStatus(
        id: number
    ): Promise<BlockadeLabsSkyboxStatus> {
        const response = await axios.get(
            `https://backend.blockadelabs.com/api/v1/imagine/requests/${id}`,
            {
                headers: {
                    'x-api-key': this._options.apiKey,
                },
            }
        );
        return response.data.request;
    }
}

export interface BlockadeLabsGenerateSkyboxInterfaceOptions {
    apiKey: string;
}

interface BlockadeLabsSkyboxStatus {
    status:
        | 'pending'
        | 'dispatched'
        | 'processing'
        | 'complete'
        | 'abort'
        | 'error';
    id: number;
    file_url: string;
    thumb_url: string;
    error_message: string;
}

function isFinished(status: BlockadeLabsSkyboxStatus): boolean {
    return (
        status.status === 'complete' ||
        status.status === 'abort' ||
        status.status === 'error'
    );
}

function isError(status: BlockadeLabsSkyboxStatus): boolean {
    return status.status === 'error' || status.status === 'abort';
}
