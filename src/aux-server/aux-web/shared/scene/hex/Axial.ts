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
