import {
    AIGenerateSkyboxInterface,
    AIGenerateSkyboxInterfaceRequest,
    AIGenerateSkyboxInterfaceResponse,
} from './AIGenerateSkyboxInterface';
import axios from 'axios';

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

    async generateSkybox(
        request: AIGenerateSkyboxInterfaceRequest
    ): Promise<AIGenerateSkyboxInterfaceResponse> {
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
        for (let i = 0; i < 4; i++) {
            const seconds = i === 0 ? 10 : i === 1 ? 20 : i === 2 ? 40 : 60;

            console.log(
                `[BlockadeLabsGenerateSkyboxInterface] [generateSkybox] [${id}]: Waiting ${seconds} seconds...`
            );
            await wait(seconds);
            const status = await this._downloadStatus(id);

            console.log(
                `[BlockadeLabsGenerateSkyboxInterface] [generateSkybox] [${id}]: Status: ${status.status}`
            );
            if (isFinished(status)) {
                if (isError(status)) {
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: status.error_message,
                    };
                } else {
                    console.log(
                        `[BlockadeLabsGenerateSkyboxInterface] [generateSkybox] [${id}]: Skybox Generated.`
                    );
                    return {
                        success: true,
                        fileUrl: status.file_url,
                        thumbnailUrl: status.thumb_url,
                    };
                }
            }
        }

        console.error(
            `[BlockadeLabsGenerateSkyboxInterface] [generateSkybox] [${id}] Timed out.`
        );

        return {
            success: false,
            errorCode: 'server_error',
            errorMessage: 'The request timed out.',
        };
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

function wait(seconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, seconds * 1000);
    });
}
