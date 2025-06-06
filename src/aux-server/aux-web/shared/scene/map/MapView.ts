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
import { Object3D, Vector3 } from '@casual-simulation/three';
import { Box3 } from '@casual-simulation/three';

const TILE_SIZE = 256;

export class MapView extends Object3D {
    private _tileSize: number;
    private _gridSize: number;
    private _zoom: number;
    private _x: number;
    private _y: number;
    private _longitude: number;
    private _latitude: number;

    private _provider: MapProvider;
    private _heightProvider: MapProvider | null = null;

    private _tiles: MapTile[][] = [];
    private _clippingBox: Box3 = new Box3(
        new Vector3(-0.5, -0.5, -0.5),
        new Vector3(0.5, 0.5, 0.5)
    );

    get heightProvider() {
        return this._heightProvider;
    }

    setZoom(zoom: number) {
        this._zoom = zoom;
        this.setCenter(zoom, this._longitude, this._latitude);
    }

    setProvider(provider: MapProvider) {
        this._provider = provider;
        this._tiles.forEach((array) => {
            array.forEach((tile) => {
                tile.setProvider(provider);
            });
        });
    }

    /**
     * Calculates the pixel coordinates of the given zoom, longitude and latitude.
     * Pixel coordinates are able to be used to determine where inside a tile a particular geographic point is.
     * See https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system for more information.
     */
    static calculatePixel(
        zoom: number,
        longitude: number,
        latitude: number
    ): [number, number] {
        const sinLatitude = Math.sin((latitude * Math.PI) / 180);
        const powZoom = Math.pow(2, zoom);
        const mapSize = powZoom * TILE_SIZE;
        const pixelX = ((longitude + 180) / 360) * mapSize + 0.5;
        const pixelY =
            (0.5 -
                Math.log((1 + sinLatitude) / (1 - sinLatitude)) /
                    (4 * Math.PI)) *
                mapSize +
            0.5;

        return [pixelX, pixelY];
    }

    /**
     * Calculates the tileX and tileY from the given pixel coordinates.
     * @param pixelX The x coordinate of the pixel.
     * @param pixelY The y coordinate of the pixel.
     * @param tileSize The size of the tile. Default is 256.
     */
    static calculateTileFromPixel(
        pixelX: number,
        pixelY: number,
        tileSize: number = TILE_SIZE
    ): [number, number] {
        const tileX = Math.floor(pixelX / tileSize);
        const tileY = Math.floor(pixelY / tileSize);

        return [tileX, tileY];
    }

    /**
     * Calculates the percentage of the tile that the given pixel coordinates are at.
     * For example, if the pixel is in the center of the tile, then the percentage is 0.5, 0.5.
     * @param pixelX The x coordinate of the pixel.
     * @param pixelY The y coordinate of the pixel.
     * @returns
     */
    static calculateTilePercentage(
        pixelX: number,
        pixelY: number
    ): [number, number] {
        const percentageX = (pixelX % TILE_SIZE) / TILE_SIZE;
        const percentageY = (pixelY % TILE_SIZE) / TILE_SIZE;

        return [percentageX, percentageY];
    }

    /**
     * Calculates the tileX and tileY from the given zoom, longitude and latitude.
     */
    static calculateOffset(
        zoom: number,
        longitude: number,
        latitude: number
    ): [number, number, number] {
        const [pixelX, pixelY] = MapView.calculatePixel(
            zoom,
            longitude,
            latitude
        );
        const [tileX, tileY] = MapView.calculateTileFromPixel(pixelX, pixelY);

        return [zoom, tileX, tileY];
    }

    /**
     * Sets the center of the map view.
     * @param zoom The zoom level of the map.
     * @param longitude The longitude of the center of the map.
     * @param latitude The latitude of the center of the map.
     */
    setCenter(zoom: number, longitude: number, latitude: number) {
        this._zoom = zoom;
        this._longitude = longitude;
        this._latitude = latitude;
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
        this._x = tileX;
        this._y = tileY;

        const centerOffsetX = 0.5 - percentageX;
        const centerOffsetY = 0.5 - percentageY;

        const tileBox = new Box3();

        const halfGridSize = Math.floor(this._gridSize / 2);
        for (let x = -halfGridSize; x <= halfGridSize; x++) {
            for (let y = -halfGridSize; y <= halfGridSize; y++) {
                const tile = this._tiles[x + halfGridSize][y + halfGridSize];

                const relativeX = tileX + x;
                const relativeY = tileY + y;

                tile.position.set(
                    x * this._tileSize + centerOffsetX,
                    0,
                    y * this._tileSize + centerOffsetY
                );
                tile.updateMatrixWorld(true);
                const halfTileSize = this._tileSize * 0.5;
                tileBox.set(
                    new Vector3(
                        -halfTileSize + tile.position.x,
                        0,
                        -halfTileSize + tile.position.z
                    ),
                    new Vector3(
                        halfTileSize + tile.position.x,
                        0,
                        halfTileSize + tile.position.z
                    )
                );

                const visible = tileBox.intersectsBox(this._clippingBox);

                if (visible) {
                    tile.visible = true;
                    tile.setTile(zoom, relativeX, relativeY);

                    let yClip = 1;
                    let yAnchor = 0;

                    if (tile.position.z > 0) {
                        // if tile is above the clipping box, then the tile needs to be clipped along
                        // the clipping box's top y axis
                        // and anchored to the bottom of the tile
                        yClip = this._clippingBox.max.z - tileBox.min.z;
                        yAnchor = -0.5;
                    } else if (tile.position.z < 0) {
                        // if tile is above the clipping box, then the tile needs to be clipped along
                        // the clipping box's bottom y axis
                        // and anchored to the top of the tile
                        yClip = tileBox.max.z - this._clippingBox.min.z;
                        yAnchor = 0.5;
                    }

                    let xClip = 1;
                    let xAnchor = 0;
                    if (tile.position.x > 0) {
                        // if tile is to the right of the clipping box, then the tile needs to be clipped along
                        // the clipping box's rightmost x axis
                        // and anchored to the left of the tile
                        xClip = this._clippingBox.max.x - tileBox.min.x;
                        xAnchor = -0.5;
                        // tile.visible = true;
                    } else if (tile.position.x < 0) {
                        // if tile is to the left of the clipping box, then the tile needs to be clipped along
                        // the clipping box's leftmost x axis
                        // and anchored to the right of the tile
                        xClip = tileBox.max.x - this._clippingBox.min.x;
                        xAnchor = 0.5;
                    }

                    tile.setClip(
                        xClip,
                        yClip,
                        new Vector3(xAnchor, 0, yAnchor)
                    );
                } else {
                    tile.visible = false;
                }
            }
        }
    }

    /**
     * Sets the height provider that should be used for the map tiles.
     * If null, then no height information will be used.
     * @param provider The provider to use for height map information.
     */
    setHeightProvider(provider: MapProvider | null) {
        this._heightProvider = provider;
        for (let row of this._tiles) {
            for (let tile of row) {
                tile.setHeightProvider(provider);
            }
        }
    }

    /**
     * Sets the offset that should be used to move the height of the tiles.
     * @param offset
     */
    setHeightOffset(offset: number) {
        for (let row of this._tiles) {
            for (let tile of row) {
                if (tile.visible) {
                    tile.setHeightOffset(offset);
                }
            }
        }
    }

    constructor(
        provider: MapProvider,
        heightProvider: MapProvider | null = null,
        tileSize: number = 1,
        gridSize: number = 3
    ) {
        super();
        this._provider = provider;
        this._heightProvider = heightProvider;
        this._tileSize = tileSize;
        this._gridSize = gridSize;

        this._createGrid();
    }

    /**
     * Converts tile coordinates to longitude and latitude
     * @param zoom Zoom level
     * @param tileX Tile X coordinate
     * @param tileY Tile Y coordinate
     * @returns [longitude, latitude]
     */
    static tileToLonLat(
        zoom: number,
        tileX: number,
        tileY: number
    ): [number, number] {
        // Calculate the northwest corner of the tile
        const n = Math.pow(2, zoom);
        const lon = (tileX / n) * 360 - 180;
        const lat =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n))) * 180) /
            Math.PI;

        // Return the center of the tile (add half a tile in each direction)
        return [
            lon + 360 / n / 2,
            lat -
                (lat -
                    (Math.atan(
                        Math.sinh(Math.PI * (1 - (2 * (tileY + 1)) / n))
                    ) *
                        180) /
                        Math.PI) /
                    2,
        ];
    }

    dispose() {
        for (let row of this._tiles) {
            for (let tile of row) {
                tile.dispose();
                this.remove(tile);
            }
        }
        this._tiles = [];
    }

    private _createGrid() {
        const halfGridSize = Math.floor(this._gridSize / 2);
        for (let x = -halfGridSize; x <= halfGridSize; x++) {
            const tileX = x + halfGridSize;
            this._tiles[tileX] = new Array(this._gridSize);
            for (let y = -halfGridSize; y <= halfGridSize; y++) {
                const tileY = y + halfGridSize;

                const tile = this._createTile();
                tile.position.set(x * this._tileSize, 0, y * this._tileSize);
                tile.updateMatrixWorld(true);
                this._tiles[tileX][tileY] = tile;
            }
        }
    }

    private _createTile(): MapTile {
        const tile = new MapTile(this._provider, this._heightProvider);
        tile.scale.setScalar(this._tileSize);
        this.add(tile);
        return tile;
    }
}
