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

        const response = await axios.post(
            'https://www.blockadelabs.com/api/v1/skybox',
            params,
            {}
        );

        const id: number = response.data.id;
        for (let i = 0; i < 3; i++) {
            const seconds = i === 0 ? 1 : i === 1 ? 2 : 10;

            await wait(seconds);
            const status = await this._downloadStatus(id);

            if (isFinished(status)) {
                if (isError(status)) {
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: status.error_message,
                    };
                } else {
                    return {
                        success: true,
                        fileUrl: status.file_url,
                        thumbnailUrl: status.thumb_url,
                    };
                }
            }
        }

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
            `https://backend.blockadelabs.com/api/v1/imagine/requests/${id}`
        );
        return response.data;
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
