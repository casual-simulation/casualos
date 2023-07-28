/**
 * Defines an interface that is able to generate images from text prompts.
 */
export interface AIImageInterface {
    /**
     * Requests that the AI generate an image from the given request.
     * @param request The request.
     */
    generateImage(
        request: AIGenerateImageInterfaceRequest
    ): Promise<AIGenerateImageInterfaceResponse>;
}

export interface AIGenerateImageInterfaceRequest {
    /**
     * The model that should be used to generate the image(s).
     */
    model: string;

    /**
     * The description of the desired image.
     */
    prompt: string;

    /**
     * The description of what the image should not be.
     */
    negativePrompt?: string;

    /**
     * The width of the output image(s) in pixels.
     */
    width?: number;

    /**
     * The height of the output image(s) in pixels.
     */
    height?: number;

    /**
     * The number of images that should be generated.
     */
    numberOfImages?: number;

    /**
     * The random noise seed that should be used.
     */
    seed?: number;

    /**
     * The number of diffusion steps to run.
     */
    steps?: number;

    /**
     * How strictly the diffusion process adhers to the prompt text.
     * Higher values keep the image closer to the prompt.
     */
    cfgScale?: number;

    /**
     * The sampler to use for the diffusion process.
     */
    sampler?: string;

    /**
     * The clip guidance preset.
     */
    clipGuidancePreset?: string;

    /**
     * The style preset that should be used to guide the image model torwards a specific style.
     */
    stylePreset?: string;

    /**
     * The ID of the user that is making the request.
     */
    userId?: string;
}

export interface AIGenerateImageInterfaceResponse {
    /**
     * The list of images that were generated.
     */
    images: AIGeneratedImage[];
}

export interface AIGeneratedImage {
    /**
     * The base64 encoded image.
     */
    base64: string;

    /**
     * The seed of the generated image.
     */
    seed?: number;
}
