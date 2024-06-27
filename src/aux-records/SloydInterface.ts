import { z } from 'zod';
import {
    AISloydInterface,
    AISloydInterfaceCreateModelRequest,
    AISloydInterfaceCreateModelResponse,
    AISloydInterfaceEditModelRequest,
    AISloydInterfaceEditModelResponse,
} from './AISloydInterface';
import axios from 'axios';
import { handleAxiosErrors } from 'Utils';

export interface SloydOptions {
    clientId: string;
    clientSecret: string;
}

export class SloydInterface implements AISloydInterface {
    private _clientId: string;
    private _clientSecret: string;

    constructor(options: SloydOptions) {
        this._clientId = options.clientId;
        this._clientSecret = options.clientSecret;
    }

    async createModel(
        request: AISloydInterfaceCreateModelRequest
    ): Promise<AISloydInterfaceCreateModelResponse> {
        try {
            const result = await axios.post('https://api.sloyd.ai/create', {
                ClientId: this._clientId,
                ClientSecret: this._clientSecret,
                Prompt: request.prompt,
                ModelOutputType:
                    request.modelOutputType === 'binary-glb'
                        ? 1
                        : request.modelOutputType === 'json-gltf'
                        ? 4
                        : 4,
                LOD: request.levelOfDetail,
                ThumbnailPreviewExportType: request.thumbnailPreviewExportType,
                ThumbnailPreviewSizeX: request.thumbnailPreviewSizeX,
                ThumbnailPreviewSizeY: request.thumbnailPreviewSizeY,
            });

            const schema = z.object({
                InteractionId: z.string(),
                Name: z.string(),
                ConfidenceScore: z.number(),
                ModelOutputType: z.number(),
                Binary: z.array(z.number()).optional().nullable(),
                GLTFJson: z.object({}).passthrough().optional().nullable(),
            });

            const data = schema.parse(result.data);

            return {
                success: true,
                interactionId: data.InteractionId,
                name: data.Name,
                confidenceScore: data.ConfidenceScore,
                modelOutputType:
                    data.ModelOutputType === 1
                        ? 'binary-glb'
                        : data.ModelOutputType === 4
                        ? 'json-gltf'
                        : 'json-gltf',
                binary: data.Binary,
                gltfJson: data.GLTFJson
                    ? JSON.stringify(data.GLTFJson)
                    : undefined,
            };
        } catch (err) {
            handleAxiosErrors(err);
        }
    }

    async editModel(
        request: AISloydInterfaceEditModelRequest
    ): Promise<AISloydInterfaceEditModelResponse> {
        try {
            const result = await axios.post('https://api.sloyd.ai/edit', {
                ClientId: this._clientId,
                ClientSecret: this._clientSecret,
                InteractionId: request.interactionId,
                Prompt: request.prompt,
                ModelOutputType:
                    request.modelOutputType === 'binary-glb'
                        ? 1
                        : request.modelOutputType === 'json-gltf'
                        ? 4
                        : 4,
                LOD: request.levelOfDetail,
                ThumbnailPreviewExportType: request.thumbnailPreviewExportType,
                ThumbnailPreviewSizeX: request.thumbnailPreviewSizeX,
                ThumbnailPreviewSizeY: request.thumbnailPreviewSizeY,
            });

            const schema = z.object({
                InteractionId: z.string(),
                ModelOutputType: z.number(),
                Binary: z.array(z.number()).optional().nullable(),
                GLTFJson: z.object({}).passthrough().optional().nullable(),
            });

            const data = schema.parse(result.data);

            return {
                success: true,
                interactionId: data.InteractionId,
                modelOutputType:
                    data.ModelOutputType === 1
                        ? 'binary-glb'
                        : data.ModelOutputType === 4
                        ? 'json-gltf'
                        : 'json-gltf',
                binary: data.Binary,
                gltfJson: data.GLTFJson
                    ? JSON.stringify(data.GLTFJson)
                    : undefined,
            };
        } catch (err) {
            handleAxiosErrors(err);
        }
    }
}
