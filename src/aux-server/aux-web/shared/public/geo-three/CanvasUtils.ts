// Copied from https://github.com/tentone/geo-three/blob/0ae6f86c634b62bc3aa5c946bca94fa05466065c/source/utils/CanvasUtils.ts
/**
 * Contains utils to handle canvas element manipulation and common canvas operations.
 */
export class CanvasUtils {
    /**
     * Create a offscreen canvas, used to draw content that will not be displayed using DOM.
     * 
     * If OffscreenCanvas object is no available creates a regular DOM canvas object instead.
     * 
     * @param width - Width of the canvas in pixels.
     * @param height - Height of the canvas in pixels.
     */
    public static createOffscreenCanvas(width: number, height: number): (HTMLCanvasElement | OffscreenCanvas) {
        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(width, height);
        }
        else {
            let canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            return canvas;
        }
    }
}