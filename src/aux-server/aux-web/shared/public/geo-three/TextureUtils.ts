// Copied from https://github.com/tentone/geo-three/blob/0ae6f86c634b62bc3aa5c946bca94fa05466065c/source/utils/TextureUtils.ts

import { LinearFilter, RGBAFormat, Texture } from 'three';
import { CanvasUtils } from './CanvasUtils';

/**
 * Utils for texture creation and manipulation.
 */
export class TextureUtils {
    /**
      * Create a new texture filled with a CSS style.
      * 
      * Can be color, gradient or pattern. Supports all options supported in the fillStyle of the canvas API.
      * 
      * @param color - Style to apply to the texture surface.
      * @param width - Width of the canvas in pixels.
      * @param height - Height of the canvas in pixels.
      */
    public static createFillTexture(color: (string | CanvasGradient | CanvasPattern) = '#000000', width: number = 1, height: number = 1): Texture {
        const canvas = CanvasUtils.createOffscreenCanvas(width, height);

        const context: CanvasRenderingContext2D = canvas.getContext('2d') as CanvasRenderingContext2D;
        context.fillStyle = color;
        context.fillRect(0, 0, width, height);

        const texture = new Texture(canvas as any);
        texture.format = RGBAFormat;
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;

        return texture;
    }
}