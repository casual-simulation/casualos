import { Box3 } from "three";


/**
 * Defines an interface for objects that can be wrapped by a word bubble 3d.
 */
export interface WordBubbleElement {
    getBoundingBox(): Box3;
}