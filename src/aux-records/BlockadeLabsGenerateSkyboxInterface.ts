import { handleAxiosErrors } from './Utils';
import {
    AIGenerateSkyboxInterface,
    AIGenerateSkyboxInterfaceRequest,
    AIGenerateSkyboxInterfaceResponse,
    AIGetSkyboxInterfaceResponse,
} from './AIGenerateSkyboxInterface';
import axios from 'axios';
import { traced } from './tracing/TracingDecorators';
import { trace } from '@opentelemetry/api';

const TRACE_NAME = 'BlockadeLabsGenerateSkyboxInterface';

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

    @traced(TRACE_NAME)
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
            handleAxiosErrors(err);
        }
    }

    @traced(TRACE_NAME)
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
