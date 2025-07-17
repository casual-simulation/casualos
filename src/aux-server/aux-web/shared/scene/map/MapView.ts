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
import { Object3D, Vector3, Vector2 } from '@casual-simulation/three';
import { Box3 } from '@casual-simulation/three';
import type { Feature, FeatureCollection, BBox, Geometry } from 'geojson';
import * as turf from '@turf/turf';
import type { GeoJSONFeature, GeoJSONStyle, GeoJSONData } from './GeoJSONTypes';

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

    // GeoJSON data management
    private _geoJsonData: GeoJSONData | null = null;
    private _geoJsonFeatures: GeoJSONFeature[] = [];
    private _geoJsonStyle: GeoJSONStyle = {
        pointColor: '#ff0000',
        pointSize: 5,
        lineColor: '#0000ff',
        lineWidth: 2,
        lineOpacity: 1.0,
        fillColor: '#00ff00',
        fillOpacity: 0.7,
        strokeColor: '#000000',
        strokeWidth: 1,
    };

    private _featureIndex: Map<string, GeoJSONFeature[]> = new Map();
    private _geoJsonLayers: Map<
        string,
        { data: GeoJSONData; style: GeoJSONStyle }
    > = new Map();
    private _rendererResolution: Vector2 = new Vector2(1920, 1080);

    get heightProvider() {
        return this._heightProvider;
    }

    get zoom(): number {
        return this._zoom;
    }

    get centerTileX(): number {
        return this._x;
    }

    get centerTileY(): number {
        return this._y;
    }

    get tileSize(): number {
        return this._tileSize;
    }

    get centerCoordinates(): { longitude: number; latitude: number } {
        return {
            longitude: this._longitude,
            latitude: this._latitude,
        };
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
     * Set GeoJSON data to be rendered on the map
     */
    setGeoJSONData(data: GeoJSONData | null, style?: GeoJSONStyle) {
        this._geoJsonData = data;

        if (style) {
            this._geoJsonStyle = { ...this._geoJsonStyle, ...style };
        }

        this._geoJsonFeatures = this._extractFeatures(data);
        this._buildFeatureIndex();
        this._distributeFeaturesToTiles();
    }

    /**
     * Update GeoJSON styling
     */
    setGeoJSONStyle(style: GeoJSONStyle) {
        this._geoJsonStyle = { ...this._geoJsonStyle, ...style };
        this._distributeFeaturesToTiles();
    }

    /**
     * Add a GeoJSON layer with a specific ID
     * Supports multiple named layers
     */
    addGeoJSONLayer(id: string, data: GeoJSONData, style?: GeoJSONStyle) {
        const layerStyle = { ...this._geoJsonStyle, ...style };
        this._geoJsonLayers.set(id, { data, style: layerStyle });
        this._rebuildAllLayers();
    }

    /**
     * Remove a GeoJSON layer by ID
     */
    removeGeoJSONLayer(id: string): boolean {
        const existed = this._geoJsonLayers.delete(id);
        if (existed) {
            this._rebuildAllLayers();
        }
        return existed;
    }

    /**
     * Get a GeoJSON layer by ID
     */
    getGeoJSONLayer(
        id: string
    ): { data: GeoJSONData; style: GeoJSONStyle } | undefined {
        return this._geoJsonLayers.get(id);
    }

    /**
     * Clear all GeoJSON layers
     */
    clearGeoJSONLayers() {
        this._geoJsonLayers.clear();
        this._geoJsonFeatures = [];
        this._distributeFeaturesToTiles();
    }

    /**
     * Load GeoJSON from a URL or parse from string
     */
    async loadGeoJSON(
        data: GeoJSONData | string,
        style?: GeoJSONStyle
    ): Promise<void> {
        let parsedData: GeoJSONData;

        if (typeof data === 'string') {
            try {
                parsedData = JSON.parse(data);
            } catch (error) {
                const response = await fetch(data);
                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch GeoJSON: ${response.statusText}`
                    );
                }
                parsedData = await response.json();
            }
        } else {
            parsedData = data;
        }

        this.setGeoJSONData(parsedData, style);
    }

    /**
     * Update renderer resolution for proper line width rendering
     */
    updateRendererResolution(width: number, height: number) {
        this._rendererResolution.set(width, height);

        this._tiles.forEach((row) => {
            row.forEach((tile) => {
                tile.setRendererResolution(width, height);
            });
        });
    }

    /**
     * Project geographic coordinates to world space
     */
    projectCoordinate(longitude: number, latitude: number): Vector2 {
        const [pixelX, pixelY] = MapView.calculatePixel(
            this._zoom,
            longitude,
            latitude
        );
        const [centerPixelX, centerPixelY] = MapView.calculatePixel(
            this._zoom,
            this._longitude,
            this._latitude
        );

        // Calculate offset from center in pixels
        const offsetX = pixelX - centerPixelX;
        const offsetY = pixelY - centerPixelY;

        // Convert to world units
        const worldX = (offsetX / TILE_SIZE) * this._tileSize;
        const worldY = (offsetY / TILE_SIZE) * this._tileSize;

        return new Vector2(worldX, -worldY);
    }

    /**
     * Unproject world space coordinates to geographic coordinates
     */
    unprojectCoordinate(
        x: number,
        y: number
    ): { longitude: number; latitude: number } {
        // Convert from world units to pixels
        const pixelOffsetX = (x / this._tileSize) * TILE_SIZE;
        const pixelOffsetY = (-y / this._tileSize) * TILE_SIZE;

        // Get center pixel coordinates
        const [centerPixelX, centerPixelY] = MapView.calculatePixel(
            this._zoom,
            this._longitude,
            this._latitude
        );

        // Calculate absolute pixel position
        const pixelX = centerPixelX + pixelOffsetX;
        const pixelY = centerPixelY + pixelOffsetY;

        // Convert pixels to lon/lat
        const n = Math.pow(2, this._zoom);
        const longitude = (pixelX / TILE_SIZE / n) * 360 - 180;
        const lat_rad = Math.atan(
            Math.sinh(Math.PI * (1 - (2 * pixelY) / TILE_SIZE / n))
        );
        const latitude = (lat_rad * 180) / Math.PI;

        return { longitude, latitude };
    }

    /**
     * Rebuild all layers (used when adding/removing named layers)
     */
    private _rebuildAllLayers() {
        const allFeatures: GeoJSONFeature[] = [];

        this._geoJsonLayers.forEach(({ data, style }) => {
            const features = this._extractFeatures(data);
            features.forEach((feature) => {
                if (!feature.properties) feature.properties = {};
                Object.assign(feature.properties, style);
            });
            allFeatures.push(...features);
        });

        if (this._geoJsonData) {
            allFeatures.push(...this._geoJsonFeatures);
        }

        this._geoJsonFeatures = allFeatures;
        this._buildFeatureIndex();
        this._distributeFeaturesToTiles();
    }

    /**
     * Extract features from GeoJSON data
     */
    private _extractFeatures(data: GeoJSONData | null): GeoJSONFeature[] {
        if (!data) return [];

        if ('type' in data) {
            if (data.type === 'FeatureCollection') {
                return (data as FeatureCollection).features as GeoJSONFeature[];
            } else if (data.type === 'Feature') {
                return [data as GeoJSONFeature];
            } else {
                return [
                    {
                        type: 'Feature',
                        geometry: data as Geometry,
                        properties: {},
                    },
                ];
            }
        }

        return [];
    }

    /**
     * Build spatial index for features
     */
    private _buildFeatureIndex() {
        this._featureIndex.clear();

        for (const feature of this._geoJsonFeatures) {
            const key = 'all'; // Simplified for now
            if (!this._featureIndex.has(key)) {
                this._featureIndex.set(key, []);
            }
            this._featureIndex.get(key)!.push(feature);
        }
    }

    /**
     * Get features that intersect with a bounding box
     */
    private _getFeaturesInBounds(bounds: BBox): GeoJSONFeature[] {
        // For now, return all features and let each tile clip them
        return this._geoJsonFeatures.filter((feature) => {
            if (!feature.geometry) return false;

            try {
                const featureBbox = turf.bbox(feature as Feature);
                return this._bboxIntersects(featureBbox, bounds);
            } catch (e) {
                return true;
            }
        });
    }

    /**
     * Check if two bounding boxes intersect
     */
    private _bboxIntersects(b1: BBox, b2: BBox): boolean {
        return !(
            b1[2] < b2[0] ||
            b1[0] > b2[2] ||
            b1[3] < b2[1] ||
            b1[1] > b2[3]
        );
    }

    /**
     * Clip features to tile bounds
     */
    private _clipFeaturesToBounds(
        features: GeoJSONFeature[],
        bounds: BBox
    ): GeoJSONFeature[] {
        const clipped: GeoJSONFeature[] = [];

        for (const feature of features) {
            if (!feature.geometry) continue;

            try {
                const geomType = feature.geometry.type;

                if (geomType === 'Point') {
                    const [lon, lat] = feature.geometry.coordinates;
                    if (
                        lon >= bounds[0] &&
                        lon <= bounds[2] &&
                        lat >= bounds[1] &&
                        lat <= bounds[3]
                    ) {
                        clipped.push(feature);
                    }
                } else if (geomType === 'MultiPoint') {
                    const pointsInBounds = feature.geometry.coordinates.filter(
                        (coord: number[]) => {
                            const [lon, lat] = coord;
                            return (
                                lon >= bounds[0] &&
                                lon <= bounds[2] &&
                                lat >= bounds[1] &&
                                lat <= bounds[3]
                            );
                        }
                    );

                    if (pointsInBounds.length > 0) {
                        clipped.push({
                            ...feature,
                            geometry: {
                                type: 'MultiPoint',
                                coordinates: pointsInBounds,
                            },
                        });
                    }
                } else if (
                    geomType === 'LineString' ||
                    geomType === 'MultiLineString' ||
                    geomType === 'Polygon' ||
                    geomType === 'MultiPolygon'
                ) {
                    const clippedFeature = turf.bboxClip(
                        feature as Feature<typeof geomType, any>,
                        bounds
                    );
                    if (
                        clippedFeature &&
                        clippedFeature.geometry &&
                        this._hasValidGeometry(clippedFeature)
                    ) {
                        clipped.push(clippedFeature as GeoJSONFeature);
                    }
                }
            } catch (e) {
                console.warn('Feature clipping failed:', e);
                clipped.push(feature);
            }
        }

        return clipped;
    }

    /**
     * Check if geometry is valid after clipping
     */
    private _hasValidGeometry(feature: Feature): boolean {
        if (!feature.geometry) return false;

        switch (feature.geometry.type) {
            case 'Point':
            case 'MultiPoint':
                return true;
            case 'LineString':
                return feature.geometry.coordinates.length >= 2;
            case 'MultiLineString':
                return feature.geometry.coordinates.some(
                    (line) => line.length >= 2
                );
            case 'Polygon':
                return (
                    feature.geometry.coordinates.length > 0 &&
                    feature.geometry.coordinates[0].length >= 4
                );
            case 'MultiPolygon':
                return feature.geometry.coordinates.some(
                    (poly) => poly.length > 0 && poly[0].length >= 4
                );
            default:
                return true;
        }
    }

    /**
     * Distribute features to visible tiles
     */
    private _distributeFeaturesToTiles() {
        if (!this._geoJsonFeatures.length) {
            this._tiles.forEach((row) => {
                row.forEach((tile) => {
                    tile.setFeatures([], this._geoJsonStyle);
                });
            });
            return;
        }

        const halfGridSize = Math.floor(this._gridSize / 2);

        for (let x = -halfGridSize; x <= halfGridSize; x++) {
            for (let y = -halfGridSize; y <= halfGridSize; y++) {
                const tile = this._tiles[x + halfGridSize][y + halfGridSize];

                if (tile.visible) {
                    const tileX = this._x + x;
                    const tileY = this._y + y;

                    const tileBounds = this._calculateTileBounds(
                        this._zoom,
                        tileX,
                        tileY
                    );
                    const candidateFeatures =
                        this._getFeaturesInBounds(tileBounds);
                    const clippedFeatures = this._clipFeaturesToBounds(
                        candidateFeatures,
                        tileBounds
                    );

                    tile.setFeatures(clippedFeatures, this._geoJsonStyle);
                } else {
                    tile.setFeatures([], this._geoJsonStyle);
                }
            }
        }
    }

    /**
     * Calculate geographic bounds for a tile
     */
    private _calculateTileBounds(zoom: number, x: number, y: number): BBox {
        const n = Math.pow(2, zoom);

        const west = (x / n) * 360 - 180;
        const east = ((x + 1) / n) * 360 - 180;
        const north =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
        const south =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) /
            Math.PI;

        return [west, south, east, north];
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

                    // Ensure tile has current renderer resolution
                    tile.setRendererResolution(
                        this._rendererResolution.x,
                        this._rendererResolution.y
                    );

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

        this._distributeFeaturesToTiles();
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
        this._geoJsonData = null;
        this._geoJsonFeatures = [];
        this._featureIndex.clear();
        this._geoJsonLayers.clear();
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
        tile.setRendererResolution(
            this._rendererResolution.x,
            this._rendererResolution.y
        );
        this.add(tile);
        return tile;
    }
}
