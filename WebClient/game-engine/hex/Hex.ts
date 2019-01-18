import { Vector3, Vector2 } from "three";
import { range } from "lodash";
import { Axial } from "./Axial";

// (kal)
// Lots taken from https://www.redblobgames.com/grids/hexagons/
// and also my pet project HexMan (pacman clone with hexagons)

export const HEX_SIZE = 1;

/**
 * Calculates the position of a corner of a hex. that is flat on the top.
 * @param index The index of the corner to calculate. From 0 to 5;
 * @param center The center of the hex.
 * @param size The size of the hex.
 */
export function hexCorner(index: number, center: Vector2 = new Vector2(), size: number = HEX_SIZE): Vector2 {
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
export function hex(size: number = HEX_SIZE): Vector2[] {
    return range(0, 6).map(i => hexCorner(i, null, size));
}

/**
 * Calculates the width of a hex.
 * @param size The size of the hex.
 */
export function hexWidth(size: number = HEX_SIZE): number {
    return 2 * size;
}

/**
 * Calculates the height of a hex.
 * @param size The size of the hex.
 */
export function hexHeight(size: number = HEX_SIZE): number {
    return Math.sqrt(3) * size;
}

/**
 * Defines a class that represents a single hex.
 */
export class Hex {
    
}