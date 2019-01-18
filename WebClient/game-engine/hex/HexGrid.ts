import { Vector2 } from "three";
import { Axial } from "./Axial";
import { hexWidth } from "./Hex";
import { keys, values } from "lodash";


/**
 * Calcualates the real position of this grid position.
 * Returns the grid-relative local position.
 * @param size The size of the hexes.
 */
export function gridPosToRealPos(pos: Axial, size: number = 1): Vector2 {
    const halfWidth = hexWidth(size) / 2;
    return new Vector2(
        halfWidth * 3 / 2 * pos.q,
        halfWidth * Math.sqrt(3) * (pos.r + pos.q / 2)
    );
}

/**
 * Calculates the grid position from the given real position.
 * Returns the grid position.
 * @param pos The grid-relative local position.
 * @param size The size of the hexes.
 */
export function realPosToGridPos(pos: Vector2, size: number = 1): Axial {
    const halfWidth = hexWidth(size) / 2;
    const point = new Axial(
        pos.x * 2 / 3 / halfWidth,
        (-pos.x / 3 + Math.sqrt(3) / 3 * pos.y) / halfWidth
    );

    return point.round();
}

/**
 * Calculates the storage key for a hex at the given grid position.
 */
export function posToKey(pos: Axial): string {
    pos = pos.round();
    return `${pos.q}:${pos.r}`;
}

/**
 * Defines a class that represents a 2D grid of objects 
 * organized in a hexagonal pattern.
 */
export class HexGrid<T> {
    private _data: {
        [key: string]: {
            val: T,
            pos: Axial
        }
    };
    private _radius: number;

    /**
     * Gets the radius of this grid.
     */
    get radius() {
        return this._radius;
    }

    /**
     * Creates a new grid.
     * @param radius The radius of the grid.
     */
    constructor(radius: number) {
        this._data = {};
        this._radius = radius;
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
                pos: pos
            };
        }
    }

    /**
     * Gets the array of filled positions in this grid.
     */
    positions(): Axial[] {
        const vals = values(this._data);
        return vals.map(v => v.pos);
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