/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { Vector2 } from '@casual-simulation/three';
import { range } from 'es-toolkit/compat';

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
