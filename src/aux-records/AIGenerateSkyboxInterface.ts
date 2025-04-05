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
import type { ServerError } from '@casual-simulation/aux-common/Errors';

/**
 * Defines an interface that is able to send and receive AI chat messages.
 */
export interface AIGenerateSkyboxInterface {
    /**
     * Sends a generate skybox request to the AI API.
     * @param request The request to send.
     */
    generateSkybox(
        request: AIGenerateSkyboxInterfaceRequest
    ): Promise<AIGenerateSkyboxInterfaceResponse>;

    /**
     * Attempts to get the skybox with the given ID.
     * @param skyboxId The ID of the skybox.
     */
    getSkybox(skyboxId: string): Promise<AIGetSkyboxInterfaceResponse>;
}

export interface AIGenerateSkyboxInterfaceRequest {
    /**
     * The prompt to use.
     */
    prompt: string;

    /**
     * The negative prompt to use.
     */
    negativePrompt?: string | null;

    /**
     * Options specific to blockade labs.
     */
    blockadeLabs?: AIGenerateSkyboxInterfaceBlockadeLabsOptions;
}

/**
 * Options specific to blockade labs.
 */
export interface AIGenerateSkyboxInterfaceBlockadeLabsOptions {
    /**
     * The pre-defined style ID for the skybox.
     */
    skyboxStyleId?: number;

    /**
     * The ID of a previously generated skybox.
     */
    remixImagineId?: number;

    /**
     * The random seed to use for generating the skybox.
     */
    seed?: number;
}

/**
 * Defines an interface that represents an generate skybox response.
 */
export type AIGenerateSkyboxInterfaceResponse =
    | AIGenerateSkyboxInterfaceResponseSuccess
    | AIGenerateSkyboxInterfaceResponseFailure;

export interface AIGenerateSkyboxInterfaceResponseSuccess {
    success: true;

    /**
     * The ID of the skybox.
     */
    skyboxId: string;
}

export interface AIGenerateSkyboxInterfaceResponseFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export type AIGetSkyboxInterfaceResponse =
    | AIGetSkyboxInterfaceResponseSuccess
    | AIGetSkyboxInterfaceResponseFailure;

export interface AIGetSkyboxInterfaceResponseSuccess {
    success: true;
    status: 'pending' | 'generated';
    fileUrl: string | null;
    thumbnailUrl: string | null;
}

export interface AIGetSkyboxInterfaceResponseFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}
