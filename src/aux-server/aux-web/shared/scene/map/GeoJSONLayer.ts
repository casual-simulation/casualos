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
    Vector2,
} from '@casual-simulation/three';
import { LineMaterial } from '@casual-simulation/three/examples/jsm/lines/LineMaterial';
import { Line2 } from '@casual-simulation/three/examples/jsm/lines/Line2';
import { LineGeometry } from '@casual-simulation/three/examples/jsm/lines/LineGeometry';
import { MapView } from './MapView';
import { buildSRGBColor, disposeObject3D } from '../SceneUtils';
import type { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import {
    calculateNumericalTagValue,
    calculateStringTagValue,
} from '@casual-simulation/aux-common';
import { MapViewUtils } from './MapViewUtils';

// GeoJSON type definitions
export interface GeoJSONCoordinate extends Array<number> {
    0: number; // lon
    1: number; // lat
    2?: number; // altitude (optional)
}

export interface GeoJSONGeometry {
    type:
        | 'Point'
        | 'LineString'
        | 'Polygon'
        | 'MultiPoint'
        | 'MultiLineString'
        | 'MultiPolygon'
        | 'GeometryCollection';
    coordinates?: any;
    geometries?: GeoJSONGeometry[];
}

export interface GeoJSONFeature {
    type: 'Feature';
    geometry: GeoJSONGeometry;
    properties?: Record<string, any>;
    id?: string | number;
}

export interface GeoJSONFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

export type GeoJSONData =
    | GeoJSONFeature
    | GeoJSONFeatureCollection
    | GeoJSONGeometry;

export interface GeoJSONLayerOptions {
    /**
     * Default styling options for features
     */
    defaultStyle?: {
        pointColor?: string;
        pointSize?: number;
        lineColor?: string;
        lineWidth?: number;
        lineOpacity?: number;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeWidth?: number;
        extrudeHeight?: number;
        useModernLines?: boolean;
    };

    /**
     * Whether to enable extrusion for polygon features
     */
    enableExtrusion?: boolean;

    /**
     * Property name to use for extrusion height
     */
    extrusionProperty?: string;

    /**
     * Maximum number of features to render (for performance)
     */
    maxFeatures?: number;

    /**
     * Whether to enable spatial indexing for large datasets
     */
    enableSpatialIndex?: boolean;
}

export interface FeatureRenderInfo {
    feature: GeoJSONFeature;
    object3D: Object3D;
    geometryType: string;
    bounds?: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
}

/**
 * A layer for rendering GeoJSON data on a MapView using Three.js
 */
export class GeoJSONLayer extends ThreeGroup {
    private _mapView: MapView;
    private _options: GeoJSONLayerOptions;
    private _features: Map<string, FeatureRenderInfo> = new Map();
    private _geoJsonData: GeoJSONData | null = null;
    private _allFeatures: GeoJSONFeature[] = [];

    // Geometry containers for different types
    private _pointsContainer: ThreeGroup;
    private _linesContainer: ThreeGroup;
    private _polygonsContainer: ThreeGroup;

    // Spatial index for performance
    private _spatialIndex: FeatureRenderInfo[] = [];
    private _rendererResolution: Vector2 = new Vector2(1920, 1080);

    constructor(mapView: MapView, options: GeoJSONLayerOptions = {}) {
        super();

        this._mapView = mapView;
        this._options = {
            defaultStyle: {
                pointColor: '#ff0000',
                pointSize: 5,
                lineColor: '#0000ff',
                lineWidth: 2,
                lineOpacity: 1.0,
                fillColor: '#00ff00',
                fillOpacity: 0.7,
                strokeColor: '#000000',
                strokeWidth: 1,
                extrudeHeight: 0,
                useModernLines: true,
            },
            enableExtrusion: false,
            extrusionProperty: 'height',
            maxFeatures: 10000,
            enableSpatialIndex: true,
            ...options,
        };

        // Create containers for different geometry types
        this._pointsContainer = new ThreeGroup();
        this._linesContainer = new ThreeGroup();
        this._polygonsContainer = new ThreeGroup();

        this._pointsContainer.name = 'GeoJSON_Points';
        this._linesContainer.name = 'GeoJSON_Lines';
        this._polygonsContainer.name = 'GeoJSON_Polygons';

        this.add(this._pointsContainer);
        this.add(this._linesContainer);
        this.add(this._polygonsContainer);

        this.name = 'GeoJSONLayer';
        this._setupMapViewListener();
    }

    /**
     * Set the GeoJSON data to render
     */
    setData(data: GeoJSONData): void {
        this.clear();
        this._geoJsonData = data;
        this._allFeatures = this._extractAllFeatures(data);
        this.updateVisibleFeatures();
    }

    /**
     * Set renderer resolution for proper line width rendering
     */
    setRendererResolution(width: number, height: number): void {
        this._rendererResolution.set(width, height);

        // Update existing line materials
        this._linesContainer.traverse((child) => {
            if (child instanceof Line2) {
                const material = child.material as LineMaterial;
                material.resolution.set(width, height);
            }
        });
    }

    /**
     * Update the rendered features based on the current viewport bounds
     */
    updateVisibleFeatures(): void {
        this.clear();
        if (!this._geoJsonData) {
            return;
        }
        const bounds = this._getCurrentViewportBounds();
        let featuresToRender = this._allFeatures;
        if (bounds) {
            featuresToRender = this._allFeatures.filter((f) => {
                const info = this._getFeatureRenderInfo(f);
                if (!info || !info.bounds) return true;
                return !(
                    info.bounds.maxX < bounds.west ||
                    info.bounds.minX > bounds.east ||
                    info.bounds.maxY < bounds.south ||
                    info.bounds.minY > bounds.north
                );
            });
        }
        for (const feature of featuresToRender) {
            const rendered = this._renderFeature(feature);
            if (rendered) {
                const id = this._getFeatureId(feature);
                this._features.set(id, rendered);
                if (this._options.enableSpatialIndex) {
                    this._spatialIndex.push(rendered);
                }
            }
        }
    }

    /**
     * Set up a listener to update features when the map view changes
     */
    private _setupMapViewListener() {
        // If MapView emits events, hook here. Otherwise, monkey-patch setZoom/setCenter.
        const mapView = this._mapView as any;
        const origSetZoom = mapView.setZoom?.bind(mapView);
        const origSetCenter = mapView.setCenter?.bind(mapView);
        if (origSetZoom) {
            mapView.setZoom = (...args: any[]) => {
                const result = origSetZoom(...args);
                this.updateVisibleFeatures();
                return result;
            };
        }
        if (origSetCenter) {
            mapView.setCenter = (...args: any[]) => {
                const result = origSetCenter(...args);
                this.updateVisibleFeatures();
                return result;
            };
        }
    }

    /**
     * Extract all features from GeoJSONData
     */
    private _extractAllFeatures(data: GeoJSONData): GeoJSONFeature[] {
        if (!data) {
            return [];
        }

        if (data.type === 'FeatureCollection') {
            return (data as GeoJSONFeatureCollection).features;
        } else if (data.type === 'Feature') {
            return [data as GeoJSONFeature];
        } else {
            // Raw geometry
            return [
                {
                    type: 'Feature',
                    geometry: data as GeoJSONGeometry,
                    properties: {},
                },
            ];
        }
    }

    /**
     * Get the bounds for a feature (used for filtering)
     */
    private _getFeatureRenderInfo(
        feature: GeoJSONFeature
    ): FeatureRenderInfo | null {
        if (!feature.geometry) return null;
        let bounds:
            | { minX: number; minY: number; maxX: number; maxY: number }
            | undefined;
        switch (feature.geometry.type) {
            case 'Point':
                bounds = this._calculatePointBounds(
                    feature.geometry.coordinates
                );
                break;
            case 'LineString':
                bounds = this._calculateLineStringBounds(
                    feature.geometry.coordinates
                );
                break;
            case 'Polygon':
                bounds = this._calculatePolygonBounds(
                    feature.geometry.coordinates
                );
                break;
            case 'MultiPoint':
                bounds = this._calculateMultiPointBounds(
                    feature.geometry.coordinates
                );
                break;
            case 'MultiLineString':
                bounds = this._calculateMultiLineStringBounds(
                    feature.geometry.coordinates
                );
                break;
            case 'MultiPolygon':
                bounds = this._calculateMultiPolygonBounds(
                    feature.geometry.coordinates
                );
                break;
            default:
                bounds = undefined;
        }
        return {
            feature,
            object3D: null as any,
            geometryType: feature.geometry.type,
            bounds,
        };
    }

    /**
     * Get the current viewport bounds from the map view
     */
    private _getCurrentViewportBounds() {
        if (!this._mapView) return null;
        try {
            return MapViewUtils.getViewportBounds(this._mapView);
        } catch {
            return null;
        }
    }

    /**
     * Add a single feature to the layer
     */
    addFeature(feature: GeoJSONFeature): void {
        const rendered = this._renderFeature(feature);
        if (rendered) {
            const id = this._getFeatureId(feature);
            this._features.set(id, rendered);

            if (this._options.enableSpatialIndex) {
                this._spatialIndex.push(rendered);
            }
        }
    }

    /**
     * Remove a feature by ID
     */
    removeFeature(featureId: string): void {
        const featureInfo = this._features.get(featureId);
        if (featureInfo) {
            this._disposeFeature(featureInfo);
            this._features.delete(featureId);

            // Remove from spatial index
            const index = this._spatialIndex.indexOf(featureInfo);
            if (index >= 0) {
                this._spatialIndex.splice(index, 1);
            }
        }
    }

    /**
     * Update a feature's styling based on bot properties
     */
    updateFeatureFromBot(
        feature: GeoJSONFeature,
        bot: Bot,
        calc: BotCalculationContext
    ): void {
        const id = this._getFeatureId(feature);
        const existingFeature = this._features.get(id);

        if (existingFeature) {
            this._disposeFeature(existingFeature);
            this._features.delete(id);
        }

        // Re-render with bot styling
        const rendered = this._renderFeatureWithBot(feature, bot, calc);
        if (rendered) {
            this._features.set(id, rendered);

            if (this._options.enableSpatialIndex) {
                this._spatialIndex.push(rendered);
            }
        }
    }

    /**
     * Clear all features from the layer
     */
    clear(): this {
        this._features.forEach((featureInfo) => {
            this._disposeFeature(featureInfo);
        });
        this._features.clear();
        this._spatialIndex = [];

        this._clearContainer(this._pointsContainer);
        this._clearContainer(this._linesContainer);
        this._clearContainer(this._polygonsContainer);

        return this;
    }

    /**
     * Get features within a geographic bounding box
     */
    getFeaturesInBounds(bounds: {
        west: number;
        south: number;
        east: number;
        north: number;
    }): GeoJSONFeature[] {
        if (!this._options.enableSpatialIndex) {
            return Array.from(this._features.values()).map(
                (info) => info.feature
            );
        }

        return this._spatialIndex
            .filter((info) => {
                if (!info.bounds) return true;
                return !(
                    info.bounds.maxX < bounds.west ||
                    info.bounds.minX > bounds.east ||
                    info.bounds.maxY < bounds.south ||
                    info.bounds.minY > bounds.north
                );
            })
            .map((info) => info.feature);
    }

    /**
     * Convert GeoJSON coordinate to world position
     */
    private _geoToWorld(
        lon: number,
        lat: number,
        altitude: number = 0
    ): Vector3 {
        const mapViewAny = this._mapView as any;
        const zoom = mapViewAny._zoom || 1;
        const tileSize = mapViewAny._tileSize || 1;
        const TILE_SIZE = 256;

        // Get map center
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
        const worldY = altitude;

        return new Vector3(worldX, worldY, worldZ);
    }

    private _validateCoordinates(
        coordinates: GeoJSONCoordinate[]
    ): GeoJSONCoordinate[] {
        const validCoords: GeoJSONCoordinate[] = [];

        for (const coord of coordinates) {
            const [lng, lat, alt = 0] = coord;

            // Validate longitude and latitude ranges
            if (
                typeof lng !== 'number' ||
                typeof lat !== 'number' ||
                isNaN(lng) ||
                isNaN(lat) ||
                lng < -180 ||
                lng > 180 ||
                lat < -90 ||
                lat > 90
            ) {
                console.warn(`Invalid coordinate skipped: [${lng}, ${lat}]`);
                continue;
            }

            // Skip duplicate consecutive points
            if (validCoords.length > 0) {
                const lastCoord = validCoords[validCoords.length - 1];
                if (
                    Math.abs(lastCoord[0] - lng) < 1e-10 &&
                    Math.abs(lastCoord[1] - lat) < 1e-10
                ) {
                    continue;
                }
            }

            validCoords.push([lng, lat, alt]);
        }

        return validCoords;
    }

    /**
     * Render GeoJSON data
     */
    private _renderGeoJSON(data: GeoJSONData): void {
        if (!data) return;

        switch (data.type) {
            case 'FeatureCollection': {
                const collection = data as GeoJSONFeatureCollection;
                let featureCount = 0;
                for (const feature of collection.features) {
                    if (
                        this._options.maxFeatures &&
                        featureCount >= this._options.maxFeatures
                    ) {
                        console.warn(
                            `GeoJSONLayer: Reached maximum feature limit (${this._options.maxFeatures})`
                        );
                        break;
                    }

                    const rendered = this._renderFeature(feature);
                    if (rendered) {
                        const id = this._getFeatureId(feature);
                        this._features.set(id, rendered);

                        if (this._options.enableSpatialIndex) {
                            this._spatialIndex.push(rendered);
                        }
                        featureCount++;
                    }
                }
                break;
            }

            case 'Feature': {
                const feature = data as GeoJSONFeature;
                const rendered = this._renderFeature(feature);
                if (rendered) {
                    const id = this._getFeatureId(feature);
                    this._features.set(id, rendered);

                    if (this._options.enableSpatialIndex) {
                        this._spatialIndex.push(rendered);
                    }
                }
                break;
            }

            default: {
                // Handle raw geometry
                const geometry = data as GeoJSONGeometry;
                const syntheticFeature: GeoJSONFeature = {
                    type: 'Feature',
                    geometry: geometry,
                    properties: {},
                };
                const renderedGeom = this._renderFeature(syntheticFeature);
                if (renderedGeom) {
                    const id = this._getFeatureId(syntheticFeature);
                    this._features.set(id, renderedGeom);

                    if (this._options.enableSpatialIndex) {
                        this._spatialIndex.push(renderedGeom);
                    }
                }
                break;
            }
        }
    }

    /**
     * Render a single feature
     */
    private _renderFeature(feature: GeoJSONFeature): FeatureRenderInfo | null {
        if (!feature.geometry) {
            return null;
        }

        const style = this._getFeatureStyle(feature);
        let object3D: Object3D | null = null;
        let bounds:
            | { minX: number; minY: number; maxX: number; maxY: number }
            | undefined;

        switch (feature.geometry.type) {
            case 'Point':
                object3D = this._renderPoint(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculatePointBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'LineString':
                object3D = this._renderLineString(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculateLineStringBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'Polygon':
                object3D = this._renderPolygon(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculatePolygonBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'MultiPoint':
                object3D = this._renderMultiPoint(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculateMultiPointBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'MultiLineString':
                object3D = this._renderMultiLineString(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculateMultiLineStringBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'MultiPolygon':
                object3D = this._renderMultiPolygon(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculateMultiPolygonBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'GeometryCollection':
                object3D = this._renderGeometryCollection(
                    feature.geometry.geometries || [],
                    style
                );
                // TODO: Calculate bounds for geometry collection
                break;
        }

        if (!object3D) {
            console.error('Failed to create object3D for feature:', feature);
            return null;
        }

        return {
            feature,
            object3D,
            geometryType: feature.geometry.type,
            bounds,
        };
    }

    /**
     * Render a feature with styling from a bot
     */
    private _renderFeatureWithBot(
        feature: GeoJSONFeature,
        bot: Bot,
        calc: BotCalculationContext
    ): FeatureRenderInfo | null {
        if (!feature.geometry) return null;

        const style = this._getBotStyle(bot, calc);
        let object3D: Object3D | null = null;
        let bounds:
            | { minX: number; minY: number; maxX: number; maxY: number }
            | undefined;

        // Similar to _renderFeature but uses bot styling
        switch (feature.geometry.type) {
            case 'Point':
                object3D = this._renderPoint(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculatePointBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'LineString':
                object3D = this._renderLineString(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculateLineStringBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'Polygon':
                object3D = this._renderPolygon(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculatePolygonBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'MultiPoint':
                object3D = this._renderMultiPoint(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculateMultiPointBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'MultiLineString':
                object3D = this._renderMultiLineString(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculateMultiLineStringBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'MultiPolygon':
                object3D = this._renderMultiPolygon(
                    feature.geometry.coordinates,
                    style
                );
                bounds = this._calculateMultiPolygonBounds(
                    feature.geometry.coordinates
                );
                break;

            case 'GeometryCollection':
                object3D = this._renderGeometryCollection(
                    feature.geometry.geometries || [],
                    style
                );
                break;
        }

        if (!object3D) return null;

        return {
            feature,
            object3D,
            geometryType: feature.geometry.type,
            bounds,
        };
    }

    /**
     * Render a Point geometry
     */
    private _renderPoint(coordinates: GeoJSONCoordinate, style: any): Object3D {
        const [lng, lat, alt = 0] = coordinates;
        const worldPos = this._geoToWorld(lng, lat, alt);

        const geometry = new ThreeBufferGeometry();
        geometry.setAttribute(
            'position',
            new Float32BufferAttribute([worldPos.x, worldPos.y, worldPos.z], 3)
        );

        const material = new ThreePointsMaterial({
            color: buildSRGBColor(style.pointColor),
            size: style.pointSize,
            sizeAttenuation: false,
        });

        const points = new ThreePoints(geometry, material);
        this._pointsContainer.add(points);

        return points;
    }

    /**
     * Render a LineString geometry
     */
    private _renderLineString(
        coordinates: GeoJSONCoordinate[],
        style: any
    ): Object3D {
        // Validate coordinates first
        const validCoords = this._validateCoordinates(coordinates);

        if (validCoords.length < 2) {
            console.warn('LineString must have at least 2 valid coordinates');
            return new ThreeGroup();
        }

        // Use modern line rendering if enabled and line width > 1
        if (style.useModernLines && style.lineWidth > 1) {
            return this._renderModernLineString(validCoords, style);
        } else {
            return this._renderBasicLineString(validCoords, style);
        }
    }

    /**
     * Render LineString using modern Line2/LineMaterial for thick lines
     */
    private _renderModernLineString(
        coordinates: GeoJSONCoordinate[],
        style: any
    ): Object3D {
        const positions: number[] = [];

        coordinates.forEach((coord) => {
            const [lng, lat, alt = 0] = coord;
            const worldPos = this._geoToWorld(lng, lat, alt);
            positions.push(worldPos.x, worldPos.y, worldPos.z);
        });

        const geometry = new LineGeometry();
        geometry.setPositions(positions);

        const material = new LineMaterial({
            color: buildSRGBColor(style.lineColor).getHex(),
            linewidth: style.lineWidth,
            transparent: true,
            opacity: style.lineOpacity || 1,
        });

        // Set resolution for proper line width rendering
        material.resolution.copy(this._rendererResolution);

        const line = new Line2(geometry, material);

        // Disable frustum culling for long lines
        line.frustumCulled = false;

        this._linesContainer.add(line);
        return line;
    }

    /**
     * Render LineString using basic Line/LineBasicMaterial for thin lines
     */
    private _renderBasicLineString(
        coordinates: GeoJSONCoordinate[],
        style: any
    ): Object3D {
        const positions: number[] = [];

        coordinates.forEach((coord) => {
            const [lng, lat, alt = 0] = coord;
            const worldPos = this._geoToWorld(lng, lat, alt);
            positions.push(worldPos.x, worldPos.y, worldPos.z);
        });

        const geometry = new ThreeBufferGeometry();
        geometry.setAttribute(
            'position',
            new Float32BufferAttribute(positions, 3)
        );

        // Compute bounding sphere for proper frustum culling
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();

        const material = new ThreeLineBasicMaterial({
            color: buildSRGBColor(style.lineColor),
            transparent: true,
            opacity: style.lineOpacity || 1,
        });

        const line = new ThreeLine(geometry, material);

        // Disable frustum culling for long lines that might span large areas
        line.frustumCulled = false;

        this._linesContainer.add(line);
        return line;
    }

    /**
     * Render a Polygon geometry
     */
    private _renderPolygon(
        coordinates: GeoJSONCoordinate[][],
        style: any
    ): Object3D {
        if (!coordinates || coordinates.length === 0) return new ThreeGroup();

        const exteriorRing = coordinates[0];
        const holes = coordinates.slice(1);

        // Convert to world coordinates
        const worldCoords = exteriorRing.map((coord) => {
            const [lng, lat, alt = 0] = coord;
            return this._geoToWorld(lng, lat, alt);
        });

        // Create shape for extrusion/fill
        const shape = new Shape();
        if (worldCoords.length > 0) {
            shape.moveTo(worldCoords[0].x, worldCoords[0].z); // Use X,Z for horizontal plane
            for (let i = 1; i < worldCoords.length; i++) {
                shape.lineTo(worldCoords[i].x, worldCoords[i].z);
            }
        }

        // Add holes
        holes.forEach((hole) => {
            const holeCoords = hole.map((coord) => {
                const [lng, lat, alt = 0] = coord;
                return this._geoToWorld(lng, lat, alt);
            });

            const holePath = new Shape();
            if (holeCoords.length > 0) {
                holePath.moveTo(holeCoords[0].x, holeCoords[0].z);
                for (let i = 1; i < holeCoords.length; i++) {
                    holePath.lineTo(holeCoords[i].x, holeCoords[i].z);
                }
            }
            shape.holes.push(holePath);
        });

        let geometry: BufferGeometry;

        if (this._options.enableExtrusion && style.extrudeHeight > 0) {
            geometry = new ExtrudeGeometry(shape, {
                depth: style.extrudeHeight,
                bevelEnabled: false,
            });
        } else {
            geometry = new ShapeGeometry(shape);
        }

        const material = new ThreeMeshBasicMaterial({
            color: buildSRGBColor(style.fillColor),
            transparent: style.fillOpacity < 1,
            opacity: style.fillOpacity,
            side: 2, // DoubleSide
        });

        const mesh = new ThreeMesh(geometry, material);
        this._polygonsContainer.add(mesh);

        return mesh;
    }

    /**
     * Render MultiPoint geometry
     */
    private _renderMultiPoint(
        coordinates: GeoJSONCoordinate[],
        style: any
    ): Object3D {
        const group = new ThreeGroup();

        coordinates.forEach((coord) => {
            const point = this._renderPoint(coord, style);
            group.add(point);
        });

        return group;
    }

    /**
     * Render MultiLineString geometry
     */
    private _renderMultiLineString(
        coordinates: GeoJSONCoordinate[][],
        style: any
    ): Object3D {
        const group = new ThreeGroup();

        coordinates.forEach((lineCoords) => {
            const line = this._renderLineString(lineCoords, style);
            group.add(line);
        });

        return group;
    }

    /**
     * Render MultiPolygon geometry
     */
    private _renderMultiPolygon(
        coordinates: GeoJSONCoordinate[][][],
        style: any
    ): Object3D {
        const group = new ThreeGroup();

        coordinates.forEach((polygonCoords) => {
            const polygon = this._renderPolygon(polygonCoords, style);
            group.add(polygon);
        });

        return group;
    }

    /**
     * Render GeometryCollection
     */
    private _renderGeometryCollection(
        geometries: GeoJSONGeometry[],
        style: any
    ): Object3D {
        const group = new ThreeGroup();

        geometries.forEach((geometry) => {
            const syntheticFeature: GeoJSONFeature = {
                type: 'Feature',
                geometry: geometry,
                properties: {},
            };

            const rendered = this._renderFeature(syntheticFeature);
            if (rendered) {
                group.add(rendered.object3D);
            }
        });

        return group;
    }

    /**
     * Get styling for a feature
     */
    private _getFeatureStyle(feature: GeoJSONFeature): any {
        const style = { ...this._options.defaultStyle };

        // Override with feature properties if they exist
        if (feature.properties) {
            if (feature.properties.pointColor)
                style.pointColor = feature.properties.pointColor;
            if (feature.properties.pointSize)
                style.pointSize = feature.properties.pointSize;
            if (feature.properties.lineColor)
                style.lineColor = feature.properties.lineColor;
            if (feature.properties.lineWidth)
                style.lineWidth = feature.properties.lineWidth;
            if (feature.properties.lineOpacity)
                style.lineOpacity = feature.properties.lineOpacity;
            if (feature.properties.fillColor)
                style.fillColor = feature.properties.fillColor;
            if (feature.properties.fillOpacity)
                style.fillOpacity = feature.properties.fillOpacity;
            if (feature.properties.strokeColor)
                style.strokeColor = feature.properties.strokeColor;
            if (feature.properties.strokeWidth)
                style.strokeWidth = feature.properties.strokeWidth;

            // Handle extrusion height
            if (
                this._options.extrusionProperty &&
                feature.properties[this._options.extrusionProperty]
            ) {
                style.extrudeHeight =
                    feature.properties[this._options.extrusionProperty];
            }
        }

        return style;
    }

    /**
     * Get styling from bot tags
     */
    private _getBotStyle(bot: Bot, calc: BotCalculationContext): any {
        return {
            pointColor: calculateStringTagValue(
                calc,
                bot,
                'geoPointColor',
                this._options.defaultStyle!.pointColor!
            ),
            pointSize: calculateNumericalTagValue(
                calc,
                bot,
                'geoPointSize',
                this._options.defaultStyle!.pointSize!
            ),
            lineColor: calculateStringTagValue(
                calc,
                bot,
                'geoLineColor',
                this._options.defaultStyle!.lineColor!
            ),
            lineWidth: calculateNumericalTagValue(
                calc,
                bot,
                'geoLineWidth',
                this._options.defaultStyle!.lineWidth!
            ),
            lineOpacity: calculateNumericalTagValue(
                calc,
                bot,
                'geoLineOpacity',
                this._options.defaultStyle!.lineOpacity!
            ),
            useModernLines: this._options.defaultStyle!.useModernLines!,
            fillColor: calculateStringTagValue(
                calc,
                bot,
                'geoFillColor',
                this._options.defaultStyle!.fillColor!
            ),
            fillOpacity: calculateNumericalTagValue(
                calc,
                bot,
                'geoFillOpacity',
                this._options.defaultStyle!.fillOpacity!
            ),
            strokeColor: calculateStringTagValue(
                calc,
                bot,
                'geoStrokeColor',
                this._options.defaultStyle!.strokeColor!
            ),
            strokeWidth: calculateNumericalTagValue(
                calc,
                bot,
                'geoStrokeWidth',
                this._options.defaultStyle!.strokeWidth!
            ),
            extrudeHeight: calculateNumericalTagValue(
                calc,
                bot,
                'geoExtrudeHeight',
                this._options.defaultStyle!.extrudeHeight!
            ),
        };
    }

    /**
     * Generate a unique ID for a feature
     */
    private _getFeatureId(feature: GeoJSONFeature): string {
        if (feature.id !== undefined) {
            return feature.id.toString();
        }

        // Generate ID from geometry coordinates hash (simple implementation)
        const coordsStr = JSON.stringify(feature.geometry.coordinates);
        let hash = 0;
        for (let i = 0; i < coordsStr.length; i++) {
            const char = coordsStr.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `auto_${hash}`;
    }

    /**
     * Calculate bounds for spatial indexing
     */
    private _calculatePointBounds(coordinates: GeoJSONCoordinate): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } {
        const [lng, lat] = coordinates;
        return { minX: lng, minY: lat, maxX: lng, maxY: lat };
    }

    private _calculateLineStringBounds(coordinates: GeoJSONCoordinate[]): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        coordinates.forEach((coord) => {
            const [lng, lat] = coord;
            minX = Math.min(minX, lng);
            minY = Math.min(minY, lat);
            maxX = Math.max(maxX, lng);
            maxY = Math.max(maxY, lat);
        });

        return { minX, minY, maxX, maxY };
    }

    private _calculatePolygonBounds(coordinates: GeoJSONCoordinate[][]): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        coordinates.forEach((ring) => {
            ring.forEach((coord) => {
                const [lng, lat] = coord;
                minX = Math.min(minX, lng);
                minY = Math.min(minY, lat);
                maxX = Math.max(maxX, lng);
                maxY = Math.max(maxY, lat);
            });
        });

        return { minX, minY, maxX, maxY };
    }

    private _calculateMultiPointBounds(coordinates: GeoJSONCoordinate[]): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        coordinates.forEach((coord) => {
            const [lng, lat] = coord;
            minX = Math.min(minX, lng);
            minY = Math.min(minY, lat);
            maxX = Math.max(maxX, lng);
            maxY = Math.max(maxY, lat);
        });

        return { minX, minY, maxX, maxY };
    }

    private _calculateMultiLineStringBounds(
        coordinates: GeoJSONCoordinate[][]
    ): { minX: number; minY: number; maxX: number; maxY: number } {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        coordinates.forEach((lineCoords) => {
            lineCoords.forEach((coord) => {
                const [lng, lat] = coord;
                minX = Math.min(minX, lng);
                minY = Math.min(minY, lat);
                maxX = Math.max(maxX, lng);
                maxY = Math.max(maxY, lat);
            });
        });

        return { minX, minY, maxX, maxY };
    }

    private _calculateMultiPolygonBounds(
        coordinates: GeoJSONCoordinate[][][]
    ): { minX: number; minY: number; maxX: number; maxY: number } {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        coordinates.forEach((polygonCoords) => {
            polygonCoords.forEach((ring) => {
                ring.forEach((coord) => {
                    const [lng, lat] = coord;
                    minX = Math.min(minX, lng);
                    minY = Math.min(minY, lat);
                    maxX = Math.max(maxX, lng);
                    maxY = Math.max(maxY, lat);
                });
            });
        });

        return { minX, minY, maxX, maxY };
    }

    /**
     * Clear a container and dispose of its objects
     */
    private _clearContainer(container: ThreeGroup): void {
        const objectsToRemove = [...container.children];
        objectsToRemove.forEach((child) => {
            container.remove(child);
            disposeObject3D(child);
        });
    }

    /**
     * Dispose of a feature and its resources
     */
    private _disposeFeature(featureInfo: FeatureRenderInfo): void {
        if (featureInfo.object3D.parent) {
            featureInfo.object3D.parent.remove(featureInfo.object3D);
        }

        disposeObject3D(featureInfo.object3D);
    }

    /**
     * Dispose of the entire layer
     */
    dispose(): void {
        this.clear();

        this.remove(this._pointsContainer);
        this.remove(this._linesContainer);
        this.remove(this._polygonsContainer);

        disposeObject3D(this._pointsContainer);
        disposeObject3D(this._linesContainer);
        disposeObject3D(this._polygonsContainer);
    }
}
