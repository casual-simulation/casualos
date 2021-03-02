import { Vector2 } from '@casual-simulation/three';
import { Axial } from './Axial';
import { hexWidth } from './Hex';
import { values } from 'lodash';

/**
 * Calcualates the real position of this grid position.
 * Returns the grid-relative local position.
 * @param size The size of the hexes.
 */
export function gridPosToRealPos(pos: Axial, size: number): Vector2 {
    const halfWidth = hexWidth(size) / 2;
    return new Vector2(
        ((halfWidth * 3) / 2) * pos.q,
        halfWidth * Math.sqrt(3) * (pos.r + pos.q / 2)
    );
}

/**
 * Calculates the grid position from the given real position.
 * Returns the grid position.
 * @param pos The grid-relative local position.
 * @param size The size of the hexes.
 */
export function realPosToGridPos(pos: Vector2, size: number): Axial {
    const halfWidth = hexWidth(size) / 2;
    const point = new Axial(
        (pos.x * 2) / 3 / halfWidth,
        (-pos.x / 3 + (Math.sqrt(3) / 3) * pos.y) / halfWidth
    );

    return point.round();
}

/**
 * Calculates the manhattan distance between the two points.
 * @param first The first grid point.
 * @param second The second grid point.
 */
export function gridDistance(first: Axial, second: Axial): number {
    var x1 = first.q;
    var z1 = first.r;
    var y1 = -x1 - z1;
    var x2 = second.q;
    var z2 = second.r;
    var y2 = -x2 - z2;

    return (Math.abs(x1 - x2) + Math.abs(y1 - y2) + Math.abs(z1 - z2)) / 2;
}

/**
 * Calculates a list of hex grid positions that are contained in the given radius.
 * @param radius The radius to check.
 */
export function hexesInRadius(radius: number): Axial[] {
    radius -= 1;
    let positions: Axial[] = [];
    const zero = new Axial(0, 0);
    for (let q = -radius; q <= radius; q++) {
        for (let r = -q - radius; r <= radius - q; r++) {
            const pos = new Axial(q, r);
            if (gridDistance(zero, pos) <= radius) {
                positions.push(pos);
            }
        }
    }

    return positions;
}

/**
 * Calculates a list of hex grid positions that are in a ring at the given radius.
 * @param radius
 */
export function hexRing(radius: number): Axial[] {
    radius -= 1;
    let positions: Axial[] = [];
    const zero = new Axial(0, 0);
    for (let q = -radius; q <= radius; q++) {
        for (let r = -q - radius; r <= radius - q; r++) {
            const pos = new Axial(q, r);
            if (gridDistance(zero, pos) === radius) {
                positions.push(pos);
            }
        }
    }

    return positions;
}

/**
 * Calculates the storage key for a hex at the given grid position.
 */
export function posToKey(pos: Axial): string {
    pos = pos.round();
    return `${pos.q}:${pos.r}`;
}

/**
 * Calculates the grid position for the given storage key.
 * @param key
 */
export function keyToPos(key: string): Axial {
    const split = key.split(':');
    return new Axial(parseFloat(split[0]), parseFloat(split[1]));
}

/**
 * Defines a class that represents a 2D grid of objects
 * organized in a hexagonal pattern.
 */
export class HexGrid<T> {
    private _data: {
        [key: string]: {
            val: T;
            pos: Axial;
        };
    };

    /**
     * Gets the number of items contained in this grid.
     */
    get count() {
        return values(this._data).length;
    }

    /**
     * Gets the items contained in this grid.
     */
    get items(): T[] {
        return values(this._data).map((d) => d.val);
    }

    /**
     * Creates a new grid.
     */
    constructor() {
        this._data = {};
    }

    /**
     * Gets the data at the given grid position.
     * @param pos The position.
     */
    getDataAt(pos: Axial): T {
        const data = this._data[posToKey(pos)];
        if (data) {
            return data.val;
        } else {
            return undefined;
        }
    }

    /**
     * Sets the data at the given grid position.
     * @param pos The position.
     * @param data The data to set.
     */
    setDataAt(pos: Axial, data: T) {
        const k = posToKey(pos);
        if (typeof data === 'undefined' || data === null) {
            delete this._data[k];
        } else {
            this._data[k] = {
                val: data,
                pos: pos,
            };
        }
    }

    /**
     * Gets the array of filled positions in this grid.
     */
    positions(): Axial[] {
        const vals = values(this._data);
        return vals.map((v) => v.pos);
    }

    /**
     * Loops through all of the data in this grid and calls the given callback for each.
     * @param callback
     */
    forEach<R>(callback: (data: T, pos: Axial) => R): R {
        const vals = values(this._data);
        for (let i = 0; i < vals.length; i++) {
            const v = vals[i];
            const result = callback(v.val, v.pos);
            if (typeof result !== 'undefined') {
                return result;
            }
        }
    }
}
