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
import type { Vector2 } from '@casual-simulation/three';

/**
 * Defines a class that contains axial coordinates.
 */
export class Axial {
    /**
     * The Q part of the coordinate.
     */
    private _q: number;

    /**
     * The R part of the coordinate.
     */
    private _r: number;

    /**
     * Gets the Q part of the coordinate.
     */
    get q() {
        return this._q;
    }

    /**
     * Gets the R part of the coordinate.
     */
    get r() {
        return this._r;
    }

    constructor(q: number = 0, r: number = 0) {
        this._q = q;
        this._r = r;
    }

    /**
     * Rounds this axial coordinate position to the nearest logical hex position
     * and returns the result.
     * @param pos The position to round.
     */
    round(): Axial {
        // basically converts the axial coordinate to cube coordinates, rounds,
        // and then converts back.

        let x = this._q;
        let z = this._r;
        let y = -x - z;
        let rx = Math.round(x);
        let ry = Math.round(y);
        let rz = Math.round(z);

        let xDiff = Math.abs(rx - x);
        let yDiff = Math.abs(ry - y);
        let zDiff = Math.abs(rz - z);

        if (xDiff > yDiff && xDiff > zDiff) {
            rx = -ry - rz;
        } else if (yDiff > zDiff) {
            ry = -rx - rz;
        } else {
            rz = -rx - ry;
        }

        return new Axial(rx, rz);
    }

    /**
     * Creates a new axial coordinate from the given vector 2 coordinate.
     * @param vec The vector.
     */
    static fromVector(vec: Vector2): Axial {
        return new Axial(vec.x, vec.y);
    }
}
