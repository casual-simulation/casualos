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
import { z } from 'zod';
import type {
    AISloydInterface,
    AISloydInterfaceCreateModelRequest,
    AISloydInterfaceCreateModelResponse,
    AISloydInterfaceEditModelRequest,
    AISloydInterfaceEditModelResponse,
    SloydModelMimeTypes,
} from './AISloydInterface';
import axios from 'axios';
import { handleAxiosErrors } from './Utils';

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
            const result = await axios.post(
                'https://api.sloyd.ai/latest/create',
                {
                    ClientId: this._clientId,
                    ClientSecret: this._clientSecret,
                    Prompt: request.prompt,
                    ModelOutputType: this._getModelOutputType(
                        request.modelMimeType
                    ),
                    ApiResponseEncoding: 'json',
                    LOD: request.levelOfDetail,
                    ThumbnailPreviewExportType:
                        request.thumbnailPreviewExportType,
                    ThumbnailPreviewSizeX: request.thumbnailPreviewSizeX,
                    ThumbnailPreviewSizeY: request.thumbnailPreviewSizeY,
                }
            );

            const schema = z.object({
                InteractionId: z.string(),
                Name: z.string(),
                ConfidenceScore: z.number(),
                ModelOutputType: z.enum(['Glb', 'Gltf']),
                ModelData: z.union([z.string(), z.array(z.number())]),
            });

            const data = schema.parse(result.data);

            return {
                success: true,
                interactionId: data.InteractionId,
                name: data.Name,
                confidenceScore: data.ConfidenceScore,
                modelMimeType: this._getModelMimeType(data.ModelOutputType),
                modelData: this._getModelData(data.ModelData),
            };
        } catch (err) {
            handleAxiosErrors(err);
        }
    }

    async editModel(
        request: AISloydInterfaceEditModelRequest
    ): Promise<AISloydInterfaceEditModelResponse> {
        try {
            const result = await axios.post(
                'https://api.sloyd.ai/latest/edit',
                {
                    ClientId: this._clientId,
                    ClientSecret: this._clientSecret,
                    InteractionId: request.interactionId,
                    Prompt: request.prompt,
                    ModelOutputType: this._getModelOutputType(
                        request.modelMimeType
                    ),
                    LOD: request.levelOfDetail,
                    ThumbnailPreviewExportType:
                        request.thumbnailPreviewExportType,
                    ThumbnailPreviewSizeX: request.thumbnailPreviewSizeX,
                    ThumbnailPreviewSizeY: request.thumbnailPreviewSizeY,
                }
            );

            const schema = z.object({
                InteractionId: z.string(),
                ModelOutputType: z.enum(['Glb', 'Gltf']),
                ModelData: z.union([z.string(), z.array(z.number())]),
            });

            const data = schema.parse(result.data);

            return {
                success: true,
                interactionId: data.InteractionId,
                modelMimeType: this._getModelMimeType(data.ModelOutputType),
                modelData: this._getModelData(data.ModelData),
            };
        } catch (err) {
            handleAxiosErrors(err);
        }
    }

    private _getModelData(data: string | number[]): string | Uint8Array {
        if (Array.isArray(data)) {
            return new Uint8Array(data);
        } else {
            return data;
        }
    }

    private _getModelOutputType(
        modelMimeType: SloydModelMimeTypes
    ): 'glb' | 'gltf' {
        return modelMimeType === 'model/gltf-binary'
            ? 'glb'
            : modelMimeType === 'model/gltf+json'
            ? 'gltf'
            : 'gltf';
    }

    private _getModelMimeType(
        modelOutputType: 'Glb' | 'Gltf'
    ): SloydModelMimeTypes {
        return modelOutputType === 'Glb'
            ? 'model/gltf-binary'
            : modelOutputType === 'Gltf'
            ? 'model/gltf+json'
            : 'model/gltf+json';
    }
}
