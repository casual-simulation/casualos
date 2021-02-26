import { Box3 } from '@casual-simulation/three';

/**
 * Defines an interface for objects that can be wrapped by a word bubble 3d.
 */
export interface WordBubbleElement {
    /**
     * Bouding box that the word bubble will use to wrap itself around this element.
     */
    getBoundingBox(): Box3;

    /**
     * Should the word bubble decorator update the world bubble 3d on this frame?
     */
    shouldUpdateWorldBubbleThisFrame(): boolean;
}
