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
import { Object3D, Vector3 } from 'three';
import { Box3 } from '@casual-simulation/three';

const TILE_SIZE = 256;

export class MapView extends Object3D {
    private tileSize: number;
    private gridSize: number;

    private _provider: MapProvider;

    private _tiles: MapTile[][] = [];
    private _clippingBox: Box3 = new Box3(
        new Vector3(-0.5, -0.5, -0.5),
        new Vector3(0.5, 0.5, 0.5)
    );

    static calculatePixel(
        zoom: number,
        x: number,
        y: number
    ): [number, number] {
        const sinLatitude = Math.sin((y * Math.PI) / 180);
        const powZoom = Math.pow(2, zoom);
        const mapSize = powZoom * TILE_SIZE;
        const pixelX = ((x + 180) / 360) * mapSize + 0.5;
        const pixelY =
            (0.5 -
                Math.log((1 + sinLatitude) / (1 - sinLatitude)) /
                    (4 * Math.PI)) *
                mapSize +
            0.5;

        return [pixelX, pixelY];
    }

    static calculateTileFromPixel(
        pixelX: number,
        pixelY: number
    ): [number, number] {
        const tileX = Math.floor(pixelX / TILE_SIZE);
        const tileY = Math.floor(pixelY / TILE_SIZE);

        console.log(`Tile coordinates: (${tileX}, ${tileY})`);
        return [tileX, tileY];
    }

    static calculateTilePercentage(
        pixelX: number,
        pixelY: number
    ): [number, number] {
        const percentageX = (pixelX % TILE_SIZE) / TILE_SIZE;
        const percentageY = (pixelY % TILE_SIZE) / TILE_SIZE;

        console.log(`Tile percent: (${percentageX}, ${percentageY})`);
        return [percentageX, percentageY];
    }

    static calculateOffset(
        zoom: number,
        x: number,
        y: number
    ): [number, number, number] {
        const [pixelX, pixelY] = MapView.calculatePixel(zoom, x, y);
        const [tileX, tileY] = MapView.calculateTileFromPixel(pixelX, pixelY);

        console.log(`Tile coordinates: (${tileX}, ${tileY})`);
        return [zoom, tileX, tileY];
    }

    setCenter(zoom: number, longitude: number, latitude: number) {
        const [pixelX, pixelY] = MapView.calculatePixel(
            zoom,
            longitude,
            latitude
        );
        const [tileX, tileY] = MapView.calculateTileFromPixel(pixelX, pixelY);
        const [percentageX, percentageY] = MapView.calculateTilePercentage(
            pixelX,
            pixelY
        );

        const centerOffsetX = 0.5 - percentageX;
        const centerOffsetY = 0.5 - percentageY;

        console.log('Setting center tile to:', zoom, tileX, tileY);

        const tileBox = new Box3();

        const halfGridSize = Math.floor(this.gridSize / 2);
        for (let x = -halfGridSize; x <= halfGridSize; x++) {
            for (let y = -halfGridSize; y <= halfGridSize; y++) {
                const tile = this._tiles[x + halfGridSize][y + halfGridSize];

                const relativeX = tileX + x;
                const relativeY = tileY + y;
                console.log(
                    `Setting ${x + halfGridSize}x${y + halfGridSize} tile to:`,
                    zoom,
                    relativeX,
                    relativeY
                );

                tile.position.set(
                    x * this.tileSize + centerOffsetX,
                    0,
                    y * this.tileSize + centerOffsetY
                );
                tile.updateMatrixWorld(true);
                tileBox.setFromObject(tile);

                const visible = tileBox.intersectsBox(this._clippingBox);

                if (visible) {
                    tile.visible = true;
                    tile.setTile(zoom, relativeX, relativeY);
                } else {
                    tile.visible = false;
                }
            }
        }
    }

    constructor(
        provider: MapProvider,
        tileSize: number = 1,
        gridSize: number = 3
    ) {
        super();
        this._provider = provider;
        this.tileSize = tileSize;
        this.gridSize = gridSize;

        this._createGrid();
    }

    private _createGrid() {
        const halfGridSize = Math.floor(this.gridSize / 2);
        for (let x = -halfGridSize; x <= halfGridSize; x++) {
            const tileX = x + halfGridSize;
            this._tiles[tileX] = new Array(this.gridSize);
            for (let y = -halfGridSize; y <= halfGridSize; y++) {
                const tileY = y + halfGridSize;

                const tile = this._createTile();
                tile.position.set(x * this.tileSize, 0, y * this.tileSize);
                console.log(
                    `Tile ${x}x${y} position: ${tile.position.x}, ${tile.position.y}, ${tile.position.z}`
                );
                tile.updateMatrixWorld(true);
                this._tiles[tileX][tileY] = tile;

                // const tileX = offsetLongitude + x;
                // const tileY = offsetLatitude + y;
                // console.log(`Setting ${x + halfGridSize}x${y + halfGridSize} tile to:`, offsetZoom, tileX, tileY);
                // tile.setTile(offsetZoom, tileX, tileY);
            }
        }

        // for (let x = 0; x < 3; x++) {
        //     this._tiles[x] = [];
        //     for (let y = 0; y < 3; y++) {
        //         const tile = this._createTile();
        //         tile.position.set(x * this.tileSize, 0, y * this.tileSize);
        //         console.log(`Tile ${x}x${y} position: ${tile.position.x}, ${tile.position.y}, ${tile.position.z}`);
        //         tile.updateMatrixWorld(true);
        //         this._tiles[x][y] = tile;
        //     }
        // }
    }

    private _createTile(): MapTile {
        const tile = new MapTile(this._provider);
        tile.scale.setScalar(this.tileSize);
        this.add(tile);
        return tile;
    }
}
