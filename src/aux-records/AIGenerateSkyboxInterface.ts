import { ServerError } from '@casual-simulation/aux-common/Errors';

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
