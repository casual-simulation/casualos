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
import { Object3D } from '@casual-simulation/three';
import { HexGrid, hexesInRadius } from './HexGrid';
import { HexMesh } from './HexMesh';
import type { Axial } from './Axial';
import { disposeMesh } from '../SceneUtils';

/**
 * Defines a mesh that represents a HexGrid containing a bunch of HexMesh meshes.
 */
export class HexGridMesh extends Object3D {
    private _grid: HexGrid<HexMesh>;
    private _radius: number;
    private _defaultHeight: number;
    private _size: number;

    /**
     * Creates a new hex grid mesh that starts with the given radius
     * of hexes filled in.
     * @param radius The radius to fill.
     * @param defaultHeight The default hex height.
     */
    constructor(
        radius: number,
        defaultHeight: number,
        size: number,
        grid: HexGrid<HexMesh> = new HexGrid()
    ) {
        super();
        this._grid = grid;
        this._radius = radius;
        this._size = size;
        this._defaultHeight = defaultHeight;
    }

    /**
     * Gets the size of the individual hexes.
     */
    get hexSize() {
        return this._size;
    }

    /**
     * Gets the hexes stored in this mesh.
     */
    get hexes(): HexMesh[] {
        return this._grid.items;
    }

    /**
     * Gets the hex at the given position.
     * If none exists, then undefined is returned.
     * @param pos The grid position.
     */
    getAt(pos: Axial) {
        return this._grid.getDataAt(pos);
    }

    /**
     * Adds a new hex at the given position.
     * @param pos The position to add the hex at.
     */
    addAt(pos: Axial) {
        const existing = this._grid.getDataAt(pos);
        if (!existing) {
            const hex = new HexMesh(pos, this._size, this._defaultHeight);
            this._grid.setDataAt(pos, hex);
            this.add(hex);
            return hex;
        }
        return existing;
    }

    /**
     * Removes the hex at the given grid position.
     * @param pos The grid position of the hex to remove.
     */
    removeAt(pos: Axial) {
        const hex = this._grid.getDataAt(pos);
        if (hex) {
            this._grid.setDataAt(pos, null);
            this.remove(hex);
        }
    }

    dispose() {
        this.hexes.forEach((h) => {
            disposeMesh(h);
        });
    }

    private _fillHexesInRadius() {
        const hexPositions = hexesInRadius(this._radius);
        hexPositions.forEach((p) => {
            this.addAt(p);
        });
    }

    static createFilledInHexGrid(
        radius: number,
        defaultHeight: number,
        size: number
    ) {
        const grid = new HexGridMesh(radius, defaultHeight, size);
        grid._fillHexesInRadius();
        return grid;
    }
}
