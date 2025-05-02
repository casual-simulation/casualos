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
import type { MapProvider } from 'geo-three';
import { MapTile } from './MapTile';
import { Object3D } from 'three';

const TILE_SIZE = 256;

export class MapView extends Object3D {
    private tileSize: number;
    private gridSize: number;

    private _provider: MapProvider;

    private _tiles: MapTile[][] = [];

    static calculateOffset(zoom: number, x: number, y: number): [number, number, number] {
        const sinLatitude = Math.sin(y * Math.PI / 180);
        const powZoom = Math.pow(2, zoom);
        const mapSize = powZoom * TILE_SIZE;
        const pixelX = ((x + 180) / 360) * mapSize + 0.5;
        const pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * mapSize + 0.5;

        const tileX = Math.floor(pixelX / TILE_SIZE);
        const tileY = Math.floor(pixelY / TILE_SIZE);

        console.log(`Tile coordinates: (${tileX}, ${tileY})`);
        return [zoom, tileX, tileY];
    }

    setCenter(zoom: number, longitude: number, latitude: number) {
        const [offsetZoom, offsetLongitude, offsetLatitude] = MapView.calculateOffset(zoom, longitude, latitude);

        // 00 01 02
        // 10 11 12
        // 20 21 22
        
        // -1-1 -10 -11
        // 0-1 00 01
        // 1-1 10 11

        const halfGridSize = Math.floor(this.gridSize / 2);
        for (let x = -halfGridSize; x <= halfGridSize; x++) {
            for (let y = -halfGridSize; y <= halfGridSize; y++) {
                const tile = this._tiles[x + halfGridSize][y + halfGridSize];
                tile.setTile(offsetZoom, offsetLatitude + y, offsetLongitude + x);
            }
        }
    }

    constructor(provider: MapProvider, tileSize: number = 1, gridSize: number = 3) {
        super();
        this._provider = provider;
        this.tileSize = tileSize;
        this.gridSize = gridSize;

        this._createGrid();
    }

    private _createGrid() {

        for (let x = 0; x < 3; x++) {
            this._tiles[x] = [];
            for (let y = 0; y < 3; y++) {
                const tile = this._createTile();
                tile.position.set(x * this.tileSize, 0, y * this.tileSize);
                this.add(tile);
                this._tiles[x][y] = tile;
            }
        }
    }

    private _createTile(): MapTile {
        const tile = new MapTile(this._provider);
        tile.scale.setScalar(this.tileSize);
        this.add(tile);
        return tile;
    }
}