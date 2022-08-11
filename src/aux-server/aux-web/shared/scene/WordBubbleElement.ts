import { Vector2 } from '@casual-simulation/three';

/**
 * Defines an interface for objects that can be wrapped by a word bubble 3d.
 */
export interface WordBubbleElement {
    /**
     * Gets the width and height size that the element is.
     */
    getSize(): Vector2;

    /**
     * Should the word bubble decorator update the world bubble 3d on this frame?
     */
    shouldUpdateWorldBubbleThisFrame(): boolean;
}
