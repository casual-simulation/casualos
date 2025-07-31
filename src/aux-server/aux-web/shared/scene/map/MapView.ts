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
import { Object3D, Vector3, Vector2, Box2 } from '@casual-simulation/three';
import { Box3 } from '@casual-simulation/three';
import type { MapOverlay } from './MapOverlay';
import { GeoJSONMapOverlay } from './MapOverlay';
import type { AllGeoJSON } from '@turf/turf';
import { GeoJSON3DOverlay } from './GeoJSON3DOverlay';

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

    private _overlays: Map<string, MapOverlay> = new Map();
    private _geoJSONOverlay: GeoJSONMapOverlay | null = null;
    private _geoJSON3DOverlay: GeoJSON3DOverlay | null = null;

    get heightProvider() {
        return this._heightProvider;
    }

    get zoom() {
        return this._zoom;
    }

    get longitude() {
        return this._longitude;
    }

    get latitude() {
        return this._latitude;
    }

    setZoom(zoom: number) {
        this._zoom = zoom;
        this.setCenter(zoom, this._longitude, this._latitude);
        this._updateOverlays();
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
     * Adds an overlay to the map
     */
    addOverlay(id: string, overlay: MapOverlay): void {
        this._overlays.set(id, overlay);
        this.add(overlay);

        // Update overlay position
        overlay.updateCenter(this._zoom, this._longitude, this._latitude);
    }

    /**
     * Removes an overlay from the map
     */
    removeOverlay(id: string): MapOverlay | null {
        const overlay = this._overlays.get(id);
        if (overlay) {
            this.remove(overlay);
            this._overlays.delete(id);
            return overlay;
        }
        return null;
    }

    /**
     * Gets an overlay by id
     */
    getOverlay(id: string): MapOverlay | undefined {
        return this._overlays.get(id);
    }

    /**
     * Updates the GeoJSON overlay
     */
    updateGeoJSONOverlay(
        geoJSON: AllGeoJSON | null,
        rendererWidth?: number,
        rendererHeight?: number,
        use3D: boolean = false
    ): void {
        if (!geoJSON) {
            // Remove existing overlays
            if (this._geoJSONOverlay) {
                this.removeOverlay('geojson');
                this._geoJSONOverlay = null;
            }
            if (this._geoJSON3DOverlay) {
                this.removeOverlay('geojson3d');
                this._geoJSON3DOverlay = null;
            }
            return;
        }

        // Determine if we should use 3D rendering
        const shouldUse3D =
            use3D ||
            this._hasAltitudeData(geoJSON) ||
            this._hasExtrudeData(geoJSON);

        if (shouldUse3D) {
            this._update3DGeoJSONOverlay(geoJSON);
            // Remove 2D overlay if it exists
            if (this._geoJSONOverlay) {
                this.removeOverlay('geojson');
                this._geoJSONOverlay = null;
            }
        } else {
            this._update2DGeoJSONOverlay(
                geoJSON,
                rendererWidth,
                rendererHeight
            );
            // Remove 3D overlay if it exists
            if (this._geoJSON3DOverlay) {
                this.removeOverlay('geojson3d');
                this._geoJSON3DOverlay = null;
            }
        }
    }

    /**
     * Updates the 2D GeoJSON overlay (existing implementation)
     */
    private _update2DGeoJSONOverlay(
        geoJSON: AllGeoJSON,
        rendererWidth?: number,
        rendererHeight?: number
    ): void {
        // Calculate dimensions for the overlay
        const dimensions = new Box2(
            new Vector2(-0.5, -0.5),
            new Vector2(0.5, 0.5)
        );

        // Create or update overlay
        if (!this._geoJSONOverlay) {
            const canvasPixelSize = 512;

            this._geoJSONOverlay = new GeoJSONMapOverlay(
                dimensions,
                canvasPixelSize,
                this._longitude,
                this._latitude,
                this._zoom,
                geoJSON
            );

            this.addOverlay('geojson', this._geoJSONOverlay);
        } else {
            // Update existing overlay
            const renderer = (this._geoJSONOverlay as any)._renderer;
            if (renderer) {
                // Clear the renderer cache
                renderer._transformCache.clear();
                renderer._cacheGeneration++;
            }

            // Update overlay data
            this._geoJSONOverlay['_geojson'] = geoJSON;
            this._geoJSONOverlay.updateCenter(
                this._zoom,
                this._longitude,
                this._latitude
            );
        }

        // Update renderer resolution if provided
        if (rendererWidth && rendererHeight && this._geoJSONOverlay) {
            const renderer = (this._geoJSONOverlay as any)._renderer;
            if (renderer && renderer.updateRendererResolution) {
                renderer.updateRendererResolution(
                    rendererWidth,
                    rendererHeight
                );
            }
        }

        // Render the overlay
        this._geoJSONOverlay.render();

        // Force texture update
        const overlayAny = this._geoJSONOverlay as any;
        if (overlayAny._overlayTexture) {
            overlayAny._overlayTexture.needsUpdate = true;
        }
        if (overlayAny._material) {
            overlayAny._material.needsUpdate = true;
        }
    }

    /**
     * Updates the 3D GeoJSON overlay
     */
    private _update3DGeoJSONOverlay(geoJSON: AllGeoJSON): void {
        // Calculate dimensions for the overlay
        const dimensions = new Box2(
            new Vector2(-0.5, -0.5),
            new Vector2(0.5, 0.5)
        );

        // Extract style information from GeoJSON
        const style = this._extractStyleFromGeoJSON(geoJSON);

        // Create or update 3D overlay
        if (!this._geoJSON3DOverlay) {
            this._geoJSON3DOverlay = new GeoJSON3DOverlay(
                dimensions,
                this._longitude,
                this._latitude,
                this._zoom,
                geoJSON,
                style
            );

            this.addOverlay('geojson3d', this._geoJSON3DOverlay);
        } else {
            // Update existing overlay
            this._geoJSON3DOverlay.setGeoJSON(geoJSON);
            this._geoJSON3DOverlay.setStyle(style);
            this._geoJSON3DOverlay.updateCenter(
                this._zoom,
                this._longitude,
                this._latitude
            );
        }

        // Render the overlay
        this._geoJSON3DOverlay.render();
    }

    /**
     * Check if GeoJSON contains altitude data
     */
    private _hasAltitudeData(geoJSON: AllGeoJSON): boolean {
        const checkCoordinates = (coords: any): boolean => {
            if (Array.isArray(coords)) {
                if (coords.length === 3 && typeof coords[0] === 'number') {
                    return true;
                }
                return coords.some((c) => checkCoordinates(c));
            }
            return false;
        };

        const checkGeometry = (geometry: any): boolean => {
            if (geometry.coordinates) {
                return checkCoordinates(geometry.coordinates);
            }
            if (geometry.geometries) {
                return geometry.geometries.some((g: any) => checkGeometry(g));
            }
            return false;
        };

        if (geoJSON.type === 'FeatureCollection') {
            return geoJSON.features.some((feature) =>
                checkGeometry(feature.geometry)
            );
        } else if (geoJSON.type === 'Feature') {
            return checkGeometry(geoJSON.geometry);
        } else {
            return checkGeometry(geoJSON);
        }
    }

    /**
     * Check if GeoJSON contains extrude height data
     */
    private _hasExtrudeData(geoJSON: AllGeoJSON): boolean {
        const checkProperties = (properties: any): boolean => {
            if (!properties) return false;

            return !!(
                properties.extrudeHeight ||
                properties.style?.extrudeHeight ||
                properties.height ||
                properties.style?.height
            );
        };

        if (geoJSON.type === 'FeatureCollection') {
            return geoJSON.features.some((feature) =>
                checkProperties(feature.properties)
            );
        } else if (geoJSON.type === 'Feature') {
            return checkProperties(geoJSON.properties);
        }

        return false;
    }

    /**
     * Extract style information from GeoJSON properties
     */
    private _extractStyleFromGeoJSON(geoJSON: AllGeoJSON): any {
        const style: any = {};

        const extractFromFeature = (feature: any) => {
            if (feature.properties) {
                const props = feature.properties;

                // Direct style properties
                if (props.pointColor) style.pointColor = props.pointColor;
                if (props.pointSize) style.pointSize = props.pointSize;
                if (props.lineColor) style.lineColor = props.lineColor;
                if (props.lineWidth) style.lineWidth = props.lineWidth;
                if (props.lineOpacity) style.lineOpacity = props.lineOpacity;
                if (props.fillColor) style.polygonColor = props.fillColor;
                if (props.fillOpacity) style.polygonOpacity = props.fillOpacity;
                if (props.strokeColor) style.strokeColor = props.strokeColor;
                if (props.strokeWidth) style.strokeWidth = props.strokeWidth;
                if (props.extrudeHeight)
                    style.extrudeHeight = props.extrudeHeight;

                // Style object
                if (props.style) {
                    const s = props.style;
                    if (s.pointColor) style.pointColor = s.pointColor;
                    if (s.pointSize) style.pointSize = s.pointSize;
                    if (s.lineColor) style.lineColor = s.lineColor;
                    if (s.lineWidth) style.lineWidth = s.lineWidth;
                    if (s.lineOpacity) style.lineOpacity = s.lineOpacity;
                    if (s.fillColor) style.polygonColor = s.fillColor;
                    if (s.fillOpacity) style.polygonOpacity = s.fillOpacity;
                    if (s.strokeColor) style.strokeColor = s.strokeColor;
                    if (s.strokeWidth) style.strokeWidth = s.strokeWidth;
                    if (s.extrudeHeight) style.extrudeHeight = s.extrudeHeight;
                    if (s.height) style.extrudeHeight = s.height;
                }
            }
        };

        if (geoJSON.type === 'FeatureCollection') {
            geoJSON.features.forEach(extractFromFeature);
        } else if (geoJSON.type === 'Feature') {
            extractFromFeature(geoJSON);
        }

        return style;
    }

    /**
     * Updates all overlays when map position changes
     */
    private _updateOverlays(): void {
        this._overlays.forEach((overlay, id) => {
            overlay.updateCenter(this._zoom, this._longitude, this._latitude);
            overlay.render();
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
        const previousZoom = this._zoom;
        const previousLon = this._longitude;
        const previousLat = this._latitude;

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

        // Update overlays if position changed
        if (
            previousZoom !== zoom ||
            previousLon !== longitude ||
            previousLat !== latitude
        ) {
            this._updateOverlays();
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
        this._overlays.forEach((overlay, id) => {
            overlay.dispose();
        });
        this._overlays.clear();
        this._geoJSONOverlay = null;
        this._geoJSON3DOverlay = null;

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
