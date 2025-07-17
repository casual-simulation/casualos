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
import type { Object3D, BufferGeometry } from '@casual-simulation/three';
import {
    Vector3,
    Float32BufferAttribute,
    BufferGeometry as ThreeBufferGeometry,
    PointsMaterial as ThreePointsMaterial,
    LineBasicMaterial as ThreeLineBasicMaterial,
    MeshBasicMaterial as ThreeMeshBasicMaterial,
    Points as ThreePoints,
    Line as ThreeLine,
    Mesh as ThreeMesh,
    Group as ThreeGroup,
    Shape,
    ExtrudeGeometry,
    ShapeGeometry,
} from '@casual-simulation/three';
import { MapView } from './MapView';
import { buildSRGBColor, disposeObject3D } from '../SceneUtils';
import type { Game } from '../Game';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Position, BBox } from 'geojson';
import type { GeoJSONData, GeoJSONStyle } from './GeoJSONTypes';

/**
 * Load GeoJSON data from a URL
 * @param url URL to fetch GeoJSON from
 * @returns Parsed GeoJSON data
 */
export async function fetchGeoJSON(url: string): Promise<GeoJSONData> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch GeoJSON from ${url}: ${response.statusText}`
        );
    }
    return await response.json();
}

/**
 * Parse GeoJSON from a string or URL
 * @param input GeoJSON string or URL
 * @returns Parsed GeoJSON data
 */
export async function parseGeoJSON(input: string): Promise<GeoJSONData> {
    try {
        return JSON.parse(input);
    } catch (error) {
        return await fetchGeoJSON(input);
    }
}

/**
 * Validate if data is valid GeoJSON
 * @param data Data to validate
 * @returns True if valid GeoJSON
 */
export function isValidGeoJSON(data: any): data is GeoJSONData {
    if (!data || typeof data !== 'object') {
        return false;
    }

    const validTypes = [
        'Feature',
        'FeatureCollection',
        'Point',
        'LineString',
        'Polygon',
        'MultiPoint',
        'MultiLineString',
        'MultiPolygon',
        'GeometryCollection',
    ];

    return validTypes.includes(data.type);
}

/**
 * Helper to quickly load GeoJSON into a MapView
 * @param mapView The MapView instance
 * @param data GeoJSON data, string, or URL
 * @param style Optional styling
 */
export async function loadGeoJSONIntoMapView(
    mapView: MapView,
    data: GeoJSONData | string,
    style?: GeoJSONStyle
): Promise<void> {
    if (typeof data === 'string') {
        const parsed = await parseGeoJSON(data);
        mapView.setGeoJSONData(parsed, style);
    } else {
        mapView.setGeoJSONData(data, style);
    }
}

/**
 * Create a styled GeoJSON feature
 * Convenience function for creating features with inline styles
 */
export function createStyledFeature(
    geometry: any,
    properties: Record<string, any>,
    style: GeoJSONStyle
): GeoJSONData {
    return {
        type: 'Feature',
        geometry,
        properties: {
            ...properties,
            ...style,
        },
    };
}

/**
 * Merge multiple GeoJSON datasets into a single FeatureCollection
 * @param datasets Array of GeoJSON data
 * @returns Merged FeatureCollection
 */
export function mergeGeoJSON(...datasets: GeoJSONData[]): GeoJSONData {
    const features: any[] = [];

    for (const data of datasets) {
        if (data.type === 'FeatureCollection') {
            features.push(...(data as any).features);
        } else if (data.type === 'Feature') {
            features.push(data);
        } else {
            features.push({
                type: 'Feature',
                geometry: data,
                properties: {},
            });
        }
    }

    return {
        type: 'FeatureCollection',
        features,
    };
}

/**
 * Filter GeoJSON features by property values
 * @param data GeoJSON data to filter
 * @param predicate Filter function
 * @returns Filtered GeoJSON
 */
export function filterGeoJSON(
    data: GeoJSONData,
    predicate: (feature: any) => boolean
): GeoJSONData {
    if (data.type === 'FeatureCollection') {
        const filtered = (data as any).features.filter(predicate);
        return {
            type: 'FeatureCollection',
            features: filtered,
        };
    } else if (data.type === 'Feature') {
        return predicate(data)
            ? data
            : {
                  type: 'FeatureCollection',
                  features: [],
              };
    }
    return data;
}

/**
 * Apply a style to all features in GeoJSON data
 * @param data GeoJSON data
 * @param style Style to apply
 * @returns GeoJSON with applied styles
 */
export function applyStyleToGeoJSON(
    data: GeoJSONData,
    style: GeoJSONStyle
): GeoJSONData {
    const applyToFeature = (feature: any) => ({
        ...feature,
        properties: {
            ...feature.properties,
            ...style,
        },
    });

    if (data.type === 'FeatureCollection') {
        return {
            ...(data as any),
            features: (data as any).features.map(applyToFeature),
        };
    } else if (data.type === 'Feature') {
        return applyToFeature(data);
    }
    return {
        type: 'Feature',
        geometry: data,
        properties: style,
    };
}

export interface MapViewGeoJSONOptions {
    pointColor?: string;
    pointSize?: number;
    lineColor?: string;
    lineWidth?: number;
    lineOpacity?: number;
    fillColor?: string;
    fillOpacity?: number;
    extrudeHeight?: number;
    simplifyTolerance?: number;
}

/**
 * Simplified GeoJSON helper that uses MapView's tile system for automatic clipping
 */
export class MapViewGeoJSONHelper {
    private _mapView: MapView;
    private _container: Object3D;
    private _features: Map<string, Object3D> = new Map();
    private _game: Game;
    private _tileSize: number = 1;
    private _gridSize: number = 3;

    constructor(mapView: MapView, container: Object3D, game: Game) {
        this._mapView = mapView;
        this._container = container;
        this._game = game;

        // Extract tile size and grid size from MapView
        const mapViewAny = mapView as any;
        this._tileSize = mapViewAny._tileSize || 1;
        this._gridSize = mapViewAny._gridSize || 3;
    }

    /**
     * Render GeoJSON data with automatic tile-based clipping
     */
    renderGeoJSON(geojsonData: any, options: MapViewGeoJSONOptions = {}): void {
        this.clear();

        // Parse GeoJSON
        let data: FeatureCollection;
        try {
            if (typeof geojsonData === 'string') {
                data = JSON.parse(geojsonData);
            } else {
                data = geojsonData;
            }
        } catch (err) {
            console.warn('Invalid GeoJSON data:', err);
            return;
        }

        const tileBounds = this._getVisibleTileBounds();
        if (!tileBounds) {
            console.warn('No visible tile bounds available');
            return;
        }

        const features = this._extractFeatures(data);
        const clippedFeatures = this._clipFeaturesToTiles(features, tileBounds);

        clippedFeatures.forEach((feature, index) => {
            const featureId = feature.id?.toString() || `feature_${index}`;
            const object3D = this._renderFeature(feature, options);
            if (object3D) {
                object3D.userData.feature = feature;
                object3D.userData.featureId = featureId;
                this._container.add(object3D);
                this._features.set(featureId, object3D);
            }
        });
    }

    /**
     * Get the bounds of visible tiles in geographic coordinates
     */
    private _getVisibleTileBounds(): BBox | null {
        const mapViewAny = this._mapView as any;
        const zoom = mapViewAny._zoom || 1;
        const centerTileX = mapViewAny._x || 0;
        const centerTileY = mapViewAny._y || 0;

        // Calculate the tile bounds based on grid size
        const halfGrid = Math.floor(this._gridSize / 2);
        const minTileX = centerTileX - halfGrid;
        const maxTileX = centerTileX + halfGrid;
        const minTileY = centerTileY - halfGrid;
        const maxTileY = centerTileY + halfGrid;

        const [west, north] = MapView.tileToLonLat(zoom, minTileX, minTileY);
        const [east, south] = MapView.tileToLonLat(
            zoom,
            maxTileX + 1,
            maxTileY + 1
        );

        return [west, south, east, north];
    }

    /**
     * Clip features to the visible tile bounds using Turf.js
     */
    private _clipFeaturesToTiles(
        features: Feature[],
        tileBounds: BBox
    ): Feature[] {
        const clippedFeatures: Feature[] = [];

        for (const feature of features) {
            try {
                const featureBbox = turf.bbox(feature);
                if (!this._bboxIntersects(featureBbox, tileBounds)) {
                    continue;
                }

                if (
                    feature.geometry.type === 'Point' ||
                    feature.geometry.type === 'MultiPoint'
                ) {
                    if (this._pointInBounds(feature, tileBounds)) {
                        clippedFeatures.push(feature);
                    }
                } else {
                    const clipped = turf.bboxClip(
                        feature as any,
                        tileBounds
                    ) as Feature;
                    if (clipped && this._hasValidGeometry(clipped)) {
                        clippedFeatures.push(clipped);
                    }
                }
            } catch (e) {
                console.warn('Failed to clip feature:', e);
            }
        }

        return clippedFeatures;
    }

    /**
     * Check if a point feature is within bounds
     */
    private _pointInBounds(feature: Feature, bounds: BBox): boolean {
        if (feature.geometry.type === 'Point') {
            const [lon, lat] = feature.geometry.coordinates;
            return (
                lon >= bounds[0] &&
                lon <= bounds[2] &&
                lat >= bounds[1] &&
                lat <= bounds[3]
            );
        } else if (feature.geometry.type === 'MultiPoint') {
            return feature.geometry.coordinates.some((coord) => {
                const [lon, lat] = coord;
                return (
                    lon >= bounds[0] &&
                    lon <= bounds[2] &&
                    lat >= bounds[1] &&
                    lat <= bounds[3]
                );
            });
        }
        return false;
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
     * Check if a feature has valid geometry after clipping
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
                    (line: Position[]) => line.length >= 2
                );
            case 'Polygon':
                return (
                    feature.geometry.coordinates.length > 0 &&
                    feature.geometry.coordinates[0].length >= 4
                );
            case 'MultiPolygon':
                return feature.geometry.coordinates.some(
                    (poly: Position[][]) =>
                        poly.length > 0 && poly[0].length >= 4
                );
            default:
                return true;
        }
    }

    /**
     * Extract features from various GeoJSON formats
     */
    private _extractFeatures(data: any): Feature[] {
        if (data.type === 'FeatureCollection') {
            return data.features;
        } else if (data.type === 'Feature') {
            return [data];
        } else if (data.type && data.coordinates) {
            return [
                {
                    type: 'Feature',
                    geometry: data,
                    properties: {},
                },
            ];
        }
        return [];
    }

    /**
     * Convert geographic coordinates to MapView world position
     * This now includes clipping at the rendering level
     */
    private _geoToWorld(
        lon: number,
        lat: number,
        alt: number = 0
    ): Vector3 | null {
        const mapViewAny = this._mapView as any;
        const zoom = mapViewAny._zoom || 1;
        const tileSize = mapViewAny._tileSize || 1;
        const TILE_SIZE = 256;

        const centerLon = mapViewAny._longitude || 0;
        const centerLat = mapViewAny._latitude || 0;

        const [featurePixelX, featurePixelY] = MapView.calculatePixel(
            zoom,
            lon,
            lat
        );
        const [centerPixelX, centerPixelY] = MapView.calculatePixel(
            zoom,
            centerLon,
            centerLat
        );

        const dx = featurePixelX - centerPixelX;
        const dy = featurePixelY - centerPixelY;

        const worldX = (dx / TILE_SIZE) * tileSize;
        const worldZ = (dy / TILE_SIZE) * tileSize;

        const halfGrid = (this._gridSize / 2) * tileSize;
        if (Math.abs(worldX) > halfGrid || Math.abs(worldZ) > halfGrid) {
            return null;
        }

        return new Vector3(worldX, alt, worldZ);
    }

    /**
     * Render a single feature
     */
    private _renderFeature(
        feature: Feature,
        options: MapViewGeoJSONOptions
    ): Object3D | null {
        if (!feature.geometry) return null;

        switch (feature.geometry.type) {
            case 'Point':
                return this._renderPoint(feature.geometry.coordinates, options);
            case 'LineString':
                return this._renderLineString(
                    feature.geometry.coordinates,
                    options
                );
            case 'Polygon':
                return this._renderPolygon(
                    feature.geometry.coordinates,
                    options
                );
            case 'MultiPoint':
                return this._renderMultiPoint(
                    feature.geometry.coordinates,
                    options
                );
            case 'MultiLineString':
                return this._renderMultiLineString(
                    feature.geometry.coordinates,
                    options
                );
            case 'MultiPolygon':
                return this._renderMultiPolygon(
                    feature.geometry.coordinates,
                    options
                );
            default:
                console.warn(
                    'Unsupported geometry type:',
                    feature.geometry.type
                );
                return null;
        }
    }

    /**
     * Render Point geometry
     */
    private _renderPoint(
        coordinates: Position,
        options: MapViewGeoJSONOptions
    ): Object3D | null {
        const [lng, lat, alt = 0] = coordinates;
        const worldPos = this._geoToWorld(lng, lat, alt);
        if (!worldPos) return null;

        const geometry = new ThreeBufferGeometry();
        geometry.setAttribute(
            'position',
            new Float32BufferAttribute([worldPos.x, worldPos.y, worldPos.z], 3)
        );

        const material = new ThreePointsMaterial({
            color: buildSRGBColor(options.pointColor || '#ff0000'),
            size: options.pointSize || 5,
            sizeAttenuation: false,
        });

        return new ThreePoints(geometry, material);
    }

    /**
     * Render LineString geometry with clipping
     */
    private _renderLineString(
        coordinates: Position[],
        options: MapViewGeoJSONOptions
    ): Object3D | null {
        if (coordinates.length < 2) return null;

        const positions: number[] = [];
        let hasValidPoints = false;

        coordinates.forEach((coord) => {
            const [lng, lat, alt = 0] = coord;
            const worldPos = this._geoToWorld(lng, lat, alt);
            if (worldPos) {
                positions.push(worldPos.x, worldPos.y, worldPos.z);
                hasValidPoints = true;
            }
        });

        if (!hasValidPoints || positions.length < 6) return null; // Need at least 2 points

        const geometry = new ThreeBufferGeometry();
        geometry.setAttribute(
            'position',
            new Float32BufferAttribute(positions, 3)
        );
        geometry.computeBoundingSphere();

        const material = new ThreeLineBasicMaterial({
            color: buildSRGBColor(options.lineColor || '#0000ff'),
            transparent: true,
            opacity: options.lineOpacity || 1,
        });

        const line = new ThreeLine(geometry, material);
        line.frustumCulled = true;
        return line;
    }

    /**
     * Render Polygon geometry with clipping
     */
    private _renderPolygon(
        coordinates: Position[][],
        options: MapViewGeoJSONOptions
    ): Object3D | null {
        if (!coordinates || coordinates.length === 0) return null;

        const exteriorRing = coordinates[0];
        const holes = coordinates.slice(1);

        const worldCoords: Vector3[] = [];
        exteriorRing.forEach((coord) => {
            const [lng, lat, alt = 0] = coord;
            const worldPos = this._geoToWorld(lng, lat, alt);
            if (worldPos) {
                worldCoords.push(worldPos);
            }
        });

        if (worldCoords.length < 3) return null; // Need at least 3 points for a polygon

        const shape = new Shape();
        shape.moveTo(worldCoords[0].x, worldCoords[0].z);
        for (let i = 1; i < worldCoords.length; i++) {
            shape.lineTo(worldCoords[i].x, worldCoords[i].z);
        }

        holes.forEach((hole) => {
            const holeCoords: Vector3[] = [];
            hole.forEach((coord) => {
                const [lng, lat, alt = 0] = coord;
                const worldPos = this._geoToWorld(lng, lat, alt);
                if (worldPos) {
                    holeCoords.push(worldPos);
                }
            });

            if (holeCoords.length >= 3) {
                const holePath = new Shape();
                holePath.moveTo(holeCoords[0].x, holeCoords[0].z);
                for (let i = 1; i < holeCoords.length; i++) {
                    holePath.lineTo(holeCoords[i].x, holeCoords[i].z);
                }
                shape.holes.push(holePath);
            }
        });

        let geometry: BufferGeometry;
        if (options.extrudeHeight && options.extrudeHeight > 0) {
            geometry = new ExtrudeGeometry(shape, {
                depth: options.extrudeHeight,
                bevelEnabled: false,
            });
        } else {
            geometry = new ShapeGeometry(shape);
        }

        const material = new ThreeMeshBasicMaterial({
            color: buildSRGBColor(options.fillColor || '#00ff00'),
            transparent: true,
            opacity: options.fillOpacity || 0.7,
            side: 2, // DoubleSide
        });

        return new ThreeMesh(geometry, material);
    }

    /**
     * Render MultiPoint geometry
     */
    private _renderMultiPoint(
        coordinates: Position[],
        options: MapViewGeoJSONOptions
    ): Object3D | null {
        const group = new ThreeGroup();
        let hasValidPoints = false;

        coordinates.forEach((coord) => {
            const point = this._renderPoint(coord, options);
            if (point) {
                group.add(point);
                hasValidPoints = true;
            }
        });

        return hasValidPoints ? group : null;
    }

    /**
     * Render MultiLineString geometry
     */
    private _renderMultiLineString(
        coordinates: Position[][],
        options: MapViewGeoJSONOptions
    ): Object3D | null {
        const group = new ThreeGroup();
        let hasValidLines = false;

        coordinates.forEach((lineCoords) => {
            const line = this._renderLineString(lineCoords, options);
            if (line) {
                group.add(line);
                hasValidLines = true;
            }
        });

        return hasValidLines ? group : null;
    }

    /**
     * Render MultiPolygon geometry
     */
    private _renderMultiPolygon(
        coordinates: Position[][][],
        options: MapViewGeoJSONOptions
    ): Object3D | null {
        const group = new ThreeGroup();
        let hasValidPolygons = false;

        coordinates.forEach((polygonCoords) => {
            const polygon = this._renderPolygon(polygonCoords, options);
            if (polygon) {
                group.add(polygon);
                hasValidPolygons = true;
            }
        });

        return hasValidPolygons ? group : null;
    }

    /**
     * Clear all features
     */
    clear(): void {
        this._features.forEach((object3D, id) => {
            if (object3D.parent) {
                object3D.parent.remove(object3D);
            }
            disposeObject3D(object3D);
        });
        this._features.clear();
    }

    /**
     * Check if GeoJSON data has changed
     */
    hasDataChanged(newData: any): boolean {
        try {
            const newDataStr = JSON.stringify(newData);
            const currentDataStr = JSON.stringify(
                Array.from(this._features.values())
                    .map((obj) => obj.userData.feature)
                    .filter((f) => f)
            );
            return newDataStr !== currentDataStr;
        } catch (e) {
            return true;
        }
    }
}
