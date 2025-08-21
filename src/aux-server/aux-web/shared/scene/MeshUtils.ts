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
import { LineSegments } from './LineSegments';

export function createCubeStroke() {
    const lines = new LineSegments(createCubeStrokeLines());
    return lines;
}

function createCubeStrokeLines(): number[] {
    let verticies: number[][] = [
        [-0.5, -0.5, -0.5], // left  bottom back  - 0
        [0.5, -0.5, -0.5], // right bottom back  - 1
        [-0.5, 0.5, -0.5], // left  top    back  - 2
        [0.5, 0.5, -0.5], // right top    back  - 3
        [-0.5, -0.5, 0.5], // left  bottom front - 4
        [0.5, -0.5, 0.5], // right bottom front - 5
        [-0.5, 0.5, 0.5], // left  top    front - 6
        [0.5, 0.5, 0.5], // right top    front - 7
    ];

    const indicies = [
        0, 1, 0, 2, 0, 4, 4, 5, 4, 6, 5, 7, 5, 1, 1, 3, 2, 3, 2, 6, 3, 7, 6, 7,
    ];
    const lines: number[] = indicies.flatMap((i) => verticies[i]);
    return lines;
}
