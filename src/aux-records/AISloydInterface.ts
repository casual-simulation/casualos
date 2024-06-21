import { ServerError } from '@casual-simulation/aux-common';

export interface AISloydInterface {
    /**
     * Attempts to create a new model in Sloyd.
     * @param request The request to create the model.
     */
    createModel(
        request: AISloydInterfaceCreateModelRequest
    ): Promise<AISloydInterfaceCreateModelResponse>;

    /**
     * Attempts to edit a model in Sloyd.
     * @param request The request to edit the model.
     */
    editModel(
        request: AISloydInterfaceEditModelRequest
    ): Promise<AISloydInterfaceEditModelResponse>;
}

/**
 * The request to create a model in Sloyd.
 */
export interface AISloydInterfaceCreateModelRequest {
    /**
     * The prompt to use for the model.
     */
    prompt: string;

    /**
     * The type of model to create.
     */
    modelOutputType: 'binary-glb' | 'json-gltf';

    /**
     * The level of detail to use for the model.
     * This is a number between 0.01 and 1.
     * Defaults to 0.5.
     */
    levelOfDetail?: number;

    /**
     * The type of thumbnail preview to create for the model.
     * If not provided, no thumbnail preview will be created.
     */
    thumbnailPreviewExportType?: 'image/png';

    /**
     * The width of the thumbnail preview to create.
     */
    thumbnailPreviewSizeX?: number;

    /**
     * The height of the thumbnail preview to create.
     */
    thumbnailPreviewSizeY?: number;
}

export type AISloydInterfaceCreateModelResponse =
    | AISloydInterfaceCreateModelSuccess
    | AISloydInterfaceCreateModelFailure;

export interface AISloydInterfaceCreateModelSuccess {
    success: true;

    /**
     * A reference to the generated model.
     */
    interactionId: string;

    /**
     * A basic name for the object.
     */
    name: string;

    /**
     * The binary data of the model.
     * Only provided if the modelOutputType is 'binary-glb'.
     */
    binary?: number[];

    /**
     * The GLTF JSON data.
     * Only provided if the modelOutputType is 'json-gltf'.
     */
    gltfJson?: string;

    /**
     * A score indicating how confident the AI is that the returned object matches the text prompt.
     * See [Using Confidence Score](https://doc.clickup.com/20484704/p/h/kh4k0-8035/ed114594b2af381).
     */
    confidenceScore: number;

    /**
     * The type of model to create.
     */
    modelOutputType: 'binary-glb' | 'json-gltf';

    /**
     * The base64 encoded thumbnail preview image.
     */
    previewImage?: string;
}

export interface AISloydInterfaceCreateModelFailure {
    success: false;

    /**
     * The error code for the failure.
     */
    errorCode: ServerError;

    /**
     * The error message for the failure.
     */
    errorMessage: string;
}

/**
 * The request to edit a model in Sloyd.
 */
export interface AISloydInterfaceEditModelRequest {
    /**
     * The interaction ID of the model to edit.
     */
    interactionId: string;

    /**
     * The prompt to use for the model.
     */
    prompt: string;

    /**
     * The type of model to create.
     */
    modelOutputType: 'binary-glb' | 'json-gltf';

    /**
     * The level of detail to use for the model.
     * This is a number between 0.01 and 1.
     * Defaults to 0.5.
     */
    levelOfDetail?: number;

    /**
     * The type of thumbnail preview to create for the model.
     * If not provided, no thumbnail preview will be created.
     */
    thumbnailPreviewExportType?: 'image/png';

    /**
     * The width of the thumbnail preview to create.
     */
    thumbnailPreviewSizeX?: number;

    /**
     * The height of the thumbnail preview to create.
     */
    thumbnailPreviewSizeY?: number;
}

export type AISloydInterfaceEditModelResponse =
    | AISloydInterfaceEditModelSuccess
    | AISloydInterfaceEditModelFailure;

export interface AISloydInterfaceEditModelSuccess {
    success: true;

    /**
     * A reference to the generated model.
     */
    interactionId: string;

    /**
     * The binary data of the model.
     * Only provided if the modelOutputType is 'binary-glb'.
     */
    binary?: number[];

    /**
     * The GLTF JSON data.
     * Only provided if the modelOutputType is 'json-gltf'.
     */
    gltfJson?: string;

    /**
     * The type of model to create.
     */
    modelOutputType: 'binary-glb' | 'json-gltf';

    /**
     * The base64 encoded thumbnail preview image.
     */
    previewImage?: string;
}

export interface AISloydInterfaceEditModelFailure {
    success: false;

    /**
     * The error code for the failure.
     */
    errorCode: ServerError;

    /**
     * The error message for the failure.
     */
    errorMessage: string;
}
