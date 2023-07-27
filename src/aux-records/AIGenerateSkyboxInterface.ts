import { ServerError } from './Errors';

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
     * The URL of the file that was generated.
     */
    fileUrl: string;

    /**
     * The URL of the thumbnail for the file.
     */
    thumbnailUrl?: string;
}

export interface AIGenerateSkyboxInterfaceResponseFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}
