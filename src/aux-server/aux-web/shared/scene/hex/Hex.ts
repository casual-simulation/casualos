import { Vector2 } from 'three';
import { range } from 'lodash';

// (kal)
// Lots taken from https://www.redblobgames.com/grids/hexagons/
// and also my pet project HexMan (pacman clone with hexagons)

/**
 * Calculates the position of a corner of a hex. that is flat on the top.
 * @param index The index of the corner to calculate. From 0 to 5;
 * @param center The center of the hex.
 * @param size The size of the hex.
 */
export function hexCorner(
    index: number,
    center: Vector2 = new Vector2(),
    size: number
): Vector2 {
    const angleDeg = 60 * index;
    const angleRad = (Math.PI / 180) * angleDeg;
    return new Vector2(
        center.x + size * Math.cos(angleRad),
        center.y + size * Math.sin(angleRad)
    );
}

/**
 * Calculates the vertex positions for a flat-topped hex.
 */
export function hex(size: number): Vector2[] {
    const idx = range(0, 6);
    return idx.map((i) => hexCorner(i, undefined, size));
}

/**
 * Calculates the width of a hex.
 * @param size The size of the hex.
 */
export function hexWidth(size: number): number {
    return 2 * size;
}

/**
 * Calculates the height of a hex.
 * @param size The size of the hex.
 */
export function hexHeight(size: number): number {
    return Math.sqrt(3) * size;
}

/**
 * Defines a class that represents a single hex.
 */
export class Hex {}
