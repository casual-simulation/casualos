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
    Plane,
    DoubleSide,
} from '@casual-simulation/three';
import { LineMaterial } from '@casual-simulation/three/examples/jsm/lines/LineMaterial';
import { Line2 } from '@casual-simulation/three/examples/jsm/lines/Line2';
import { LineGeometry } from '@casual-simulation/three/examples/jsm/lines/LineGeometry';
import { MapView } from './MapView';
import { buildSRGBColor, disposeObject3D } from '../SceneUtils';

import { MapViewUtils } from './MapViewUtils';
import * as turf from '@turf/turf';
import type { Feature, BBox } from 'geojson';

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
    enableExtrusion?: boolean;
    extrusionProperty?: string;
    maxFeatures?: number;
    enableClipping?: boolean;
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
 * Enhanced GeoJSONLayer with accurate rendering and proper clipping
 */
export class GeoJSONLayer extends ThreeGroup {
    private _mapView: MapView;
    private _options: GeoJSONLayerOptions;
    private _features: Map<string, FeatureRenderInfo> = new Map();
    private _geoJsonData: GeoJSONData | null = null;
    private _allFeatures: GeoJSONFeature[] = [];

    // Geometry containers
    private _pointsContainer: ThreeGroup;
    private _linesContainer: ThreeGroup;
    private _polygonsContainer: ThreeGroup;

    // Clipping support
    private _clippingEnabled: boolean = true;

    // Renderer resolution for line rendering
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
            enableClipping: true,
            ...options,
        };

        this._clippingEnabled = this._options.enableClipping !== false;

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
        this._geoJsonData = data;
        this._allFeatures = this._extractAllFeatures(data);
        this.clear();
        this.updateRendererResolutionWhenReady();
        this.updateVisibleFeatures();
    }

    /**
     * Set renderer resolution for proper line width rendering
     */
    setRendererResolution(width: number, height: number): void {
        const finalWidth = width > 0 ? width : 1920;
        const finalHeight = height > 0 ? height : 1080;

        this._rendererResolution.set(finalWidth, finalHeight);

        // Update existing line materials
        this._linesContainer.traverse((child) => {
            if (child instanceof Line2) {
                const material = child.material as LineMaterial;
                material.resolution.set(finalWidth, finalHeight);
            }
        });
    }

    /**
     * Update the rendered features based on the current viewport
     */
    updateVisibleFeatures(): void {
        if (!this._geoJsonData) {
            return;
        }

        this.clear();

        const visibleBounds = this._getVisibleBounds();
        let featuresToRender = this._allFeatures;

        if (visibleBounds && this._clippingEnabled) {
            featuresToRender = this._allFeatures.filter((feature) => {
                return this._isFeatureVisible(feature, visibleBounds);
            });
        }

        if (
            this._options.maxFeatures &&
            featuresToRender.length > this._options.maxFeatures
        ) {
            featuresToRender = featuresToRender.slice(
                0,
                this._options.maxFeatures
            );
            console.warn(
                `GeoJSONLayer: Rendering limited to ${this._options.maxFeatures} features`
            );
        }

        // Render features
        for (const feature of featuresToRender) {
            const rendered = this._renderFeature(feature, visibleBounds);
            if (rendered) {
                const id = this._getFeatureId(feature);
                this._features.set(id, rendered);
            }
        }
    }

    /**
     * Get the visible bounds of the map in geographic coordinates
     */
    private _getVisibleBounds(): BBox | null {
        if (!this._mapView) return null;

        try {
            const bounds = MapViewUtils.getViewportBounds(this._mapView);

            const buffer = 0.01; // degrees
            return [
                bounds.west - buffer,
                bounds.south - buffer,
                bounds.east + buffer,
                bounds.north + buffer,
            ];
        } catch {
            return null;
        }
    }

    /**
     * Check if a feature is visible within the given bounds
     */
    private _isFeatureVisible(feature: GeoJSONFeature, bounds: BBox): boolean {
        if (!feature.geometry) return false;

        try {
            const featureBbox = turf.bbox(feature as Feature);
            return this._bboxIntersects(featureBbox, bounds);
        } catch {
            return true;
        }
    }

    /**
     * Check if two bounding boxes intersect
     */
    private _bboxIntersects(b1: BBox, b2: BBox): boolean {
        return !(
            (
                b1[2] < b2[0] || // b1 max X < b2 min X
                b1[0] > b2[2] || // b1 min X > b2 max X
                b1[3] < b2[1] || // b1 max Y < b2 min Y
                b1[1] > b2[3]
            ) // b1 min Y > b2 max Y
        );
    }

    /**
     * Convert GeoJSON coordinate to world position using MapView's coordinate system
     * This maintains accuracy by using the map's center as reference
     */
    private _geoToWorld(
        lon: number,
        lat: number,
        altitude: number = 0
    ): Vector3 | null {
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

        if (this._clippingEnabled) {
            const halfSize = 0.5;
            if (Math.abs(worldX) > halfSize || Math.abs(worldZ) > halfSize) {
                return null;
            }
        }

        return new Vector3(worldX, worldY, worldZ);
    }

    /**
     * Clip a single line segment using Cohen-Sutherland algorithm
     */
    private _clipLineSegment(
        start: GeoJSONCoordinate,
        end: GeoJSONCoordinate
    ): GeoJSONCoordinate[] | null {
        const [x0, y0, z0 = 0] = start;
        const [x1, y1, z1 = 0] = end;

        const bounds = this._getWorldBounds();
        if (!bounds) return null;

        const clipped = this._cohenSutherlandClip(
            x0,
            y0,
            x1,
            y1,
            bounds.minX,
            bounds.minY,
            bounds.maxX,
            bounds.maxY
        );

        if (!clipped) return null;

        const t0 = (clipped.x0 - x0) / (x1 - x0) || 0;
        const t1 = (clipped.x1 - x0) / (x1 - x0) || 1;
        const alt0 = z0 + (z1 - z0) * t0;
        const alt1 = z0 + (z1 - z0) * t1;

        return [
            [clipped.x0, clipped.y0, alt0],
            [clipped.x1, clipped.y1, alt1],
        ];
    }

    /**
     * Get world bounds for the visible map area
     */
    private _getWorldBounds(): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } | null {
        const halfSize = 0.5;

        return {
            minX: -halfSize,
            minY: -halfSize,
            maxX: halfSize,
            maxY: halfSize,
        };
    }

    /**
     * Cohen-Sutherland line clipping algorithm
     */
    private _cohenSutherlandClip(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        xmin: number,
        ymin: number,
        xmax: number,
        ymax: number
    ): { x0: number; y0: number; x1: number; y1: number } | null {
        // Compute region codes
        const INSIDE = 0; // 0000
        const LEFT = 1; // 0001
        const RIGHT = 2; // 0010
        const BOTTOM = 4; // 0100
        const TOP = 8; // 1000

        const computeCode = (x: number, y: number): number => {
            let code = INSIDE;
            if (x < xmin) code |= LEFT;
            else if (x > xmax) code |= RIGHT;
            if (y < ymin) code |= BOTTOM;
            else if (y > ymax) code |= TOP;
            return code;
        };

        let code0 = computeCode(x0, y0);
        let code1 = computeCode(x1, y1);

        while (true) {
            if (!(code0 | code1)) {
                return { x0, y0, x1, y1 };
            } else if (code0 & code1) {
                return null;
            } else {
                let x = 0,
                    y = 0;
                const codeOut = code0 ? code0 : code1;

                if (codeOut & TOP) {
                    x = x0 + ((x1 - x0) * (ymax - y0)) / (y1 - y0);
                    y = ymax;
                } else if (codeOut & BOTTOM) {
                    x = x0 + ((x1 - x0) * (ymin - y0)) / (y1 - y0);
                    y = ymin;
                } else if (codeOut & RIGHT) {
                    y = y0 + ((y1 - y0) * (xmax - x0)) / (x1 - x0);
                    x = xmax;
                } else if (codeOut & LEFT) {
                    y = y0 + ((y1 - y0) * (xmin - x0)) / (x1 - x0);
                    x = xmin;
                }

                if (codeOut === code0) {
                    x0 = x;
                    y0 = y;
                    code0 = computeCode(x0, y0);
                } else {
                    x1 = x;
                    y1 = y;
                    code1 = computeCode(x1, y1);
                }
            }
        }
    }

    /**
     * Setup listener to update features when map view changes
     */
    private _setupMapViewListener(): void {
        const mapView = this._mapView as any;
        const origSetZoom = mapView.setZoom?.bind(mapView);
        const origSetCenter = mapView.setCenter?.bind(mapView);

        if (origSetZoom && !mapView._geoJsonZoomPatched) {
            mapView.setZoom = (...args: any[]) => {
                const result = origSetZoom(...args);
                setTimeout(() => this.updateVisibleFeatures(), 50);
                return result;
            };
            mapView._geoJsonZoomPatched = true;
        }

        if (origSetCenter && !mapView._geoJsonCenterPatched) {
            mapView.setCenter = (...args: any[]) => {
                const result = origSetCenter(...args);
                setTimeout(() => this.updateVisibleFeatures(), 50);
                return result;
            };
            mapView._geoJsonCenterPatched = true;
        }
    }

    /**
     * Extract all features from GeoJSONData
     */
    private _extractAllFeatures(data: GeoJSONData): GeoJSONFeature[] {
        if (!data) return [];

        if (data.type === 'FeatureCollection') {
            return (data as GeoJSONFeatureCollection).features;
        } else if (data.type === 'Feature') {
            return [data as GeoJSONFeature];
        } else {
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
     * Render a single feature with clipping support
     */
    private _renderFeature(
        feature: GeoJSONFeature,
        visibleBounds: BBox | null
    ): FeatureRenderInfo | null {
        if (!feature.geometry) return null;

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
                break;
            case 'LineString':
                object3D = this._renderLineString(
                    feature.geometry.coordinates,
                    style
                );
                break;
            case 'Polygon':
                object3D = this._renderPolygon(
                    feature.geometry.coordinates,
                    style
                );
                break;
            case 'MultiPoint':
                object3D = this._renderMultiPoint(
                    feature.geometry.coordinates,
                    style
                );
                break;
            case 'MultiLineString':
                object3D = this._renderMultiLineString(
                    feature.geometry.coordinates,
                    style
                );
                break;
            case 'MultiPolygon':
                object3D = this._renderMultiPolygon(
                    feature.geometry.coordinates,
                    style
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
     * Render Point geometry
     */
    private _renderPoint(
        coordinates: GeoJSONCoordinate,
        style: any
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
            color: buildSRGBColor(style.pointColor),
            size: style.pointSize,
            sizeAttenuation: false,
        });

        const points = new ThreePoints(geometry, material);
        this._pointsContainer.add(points);

        return points;
    }

    /**
     * Render LineString with clipping
     */
    private _renderLineString(
        coordinates: GeoJSONCoordinate[],
        style: any
    ): Object3D | null {
        const validCoords = this._validateCoordinates(coordinates);
        if (validCoords.length < 2) return null;

        const worldBounds = this._clippingEnabled
            ? this._getWorldBounds()
            : null;
        const group = new ThreeGroup();
        let hasValidSegments = false;

        if (!worldBounds || !this._clippingEnabled) {
            const line = this._renderLineSegment(validCoords, style);
            if (line) {
                group.add(line);
                hasValidSegments = true;
            }
        } else {
            for (let i = 0; i < validCoords.length - 1; i++) {
                const start = validCoords[i];
                const end = validCoords[i + 1];

                // Convert to world coordinates
                const [lon0, lat0, alt0 = 0] = start;
                const [lon1, lat1, alt1 = 0] = end;

                const worldStart = this._geoToWorldUnbounded(lon0, lat0, alt0);
                const worldEnd = this._geoToWorldUnbounded(lon1, lat1, alt1);

                const clipped = this._cohenSutherlandClip(
                    worldStart.x,
                    worldStart.z,
                    worldEnd.x,
                    worldEnd.z,
                    worldBounds.minX,
                    worldBounds.minY,
                    worldBounds.maxX,
                    worldBounds.maxY
                );

                if (clipped) {
                    const positions = [
                        clipped.x0,
                        worldStart.y,
                        clipped.y0,
                        clipped.x1,
                        worldEnd.y,
                        clipped.y1,
                    ];

                    const line = this._createLineFromPositions(
                        positions,
                        style
                    );
                    if (line) {
                        group.add(line);
                        hasValidSegments = true;
                    }
                }
            }
        }

        if (!hasValidSegments) return null;

        this._linesContainer.add(group);
        return group;
    }

    /**
     * Create a line from world positions
     */
    private _createLineFromPositions(
        positions: number[],
        style: any
    ): Object3D | null {
        if (positions.length < 6) return null;

        const shouldUseModern =
            style.useModernLines &&
            style.lineWidth > 1 &&
            this._rendererResolution.x > 0 &&
            this._rendererResolution.y > 0;

        if (shouldUseModern) {
            const geometry = new LineGeometry();
            geometry.setPositions(positions);

            const material = new LineMaterial({
                color: buildSRGBColor(style.lineColor).getHex(),
                linewidth: style.lineWidth,
                transparent: true,
                opacity: style.lineOpacity || 1,
            });

            material.resolution.copy(this._rendererResolution);

            const line = new Line2(geometry, material);
            line.frustumCulled = false;
            return line;
        } else {
            const geometry = new ThreeBufferGeometry();
            geometry.setAttribute(
                'position',
                new Float32BufferAttribute(positions, 3)
            );
            geometry.computeBoundingSphere();

            const material = new ThreeLineBasicMaterial({
                color: buildSRGBColor(style.lineColor),
                transparent: true,
                opacity: style.lineOpacity || 1,
            });

            const line = new ThreeLine(geometry, material);
            line.frustumCulled = false;
            return line;
        }
    }

    /**
     * Render a single line segment
     */
    private _renderLineSegment(
        coordinates: GeoJSONCoordinate[],
        style: any
    ): Object3D | null {
        const positions: number[] = [];

        for (const coord of coordinates) {
            const [lng, lat, alt = 0] = coord;
            const worldPos = this._geoToWorld(lng, lat, alt);
            if (worldPos) {
                positions.push(worldPos.x, worldPos.y, worldPos.z);
            }
        }

        if (positions.length < 6) return null;

        const shouldUseModern =
            style.useModernLines &&
            style.lineWidth > 1 &&
            this._rendererResolution.x > 0 &&
            this._rendererResolution.y > 0;

        if (shouldUseModern) {
            const geometry = new LineGeometry();
            geometry.setPositions(positions);

            const material = new LineMaterial({
                color: buildSRGBColor(style.lineColor).getHex(),
                linewidth: style.lineWidth,
                transparent: true,
                opacity: style.lineOpacity || 1,
            });

            material.resolution.copy(this._rendererResolution);

            const line = new Line2(geometry, material);
            line.frustumCulled = false;
            return line;
        } else {
            const geometry = new ThreeBufferGeometry();
            geometry.setAttribute(
                'position',
                new Float32BufferAttribute(positions, 3)
            );
            geometry.computeBoundingSphere();

            const material = new ThreeLineBasicMaterial({
                color: buildSRGBColor(style.lineColor),
                transparent: true,
                opacity: style.lineOpacity || 1,
            });

            const line = new ThreeLine(geometry, material);
            line.frustumCulled = false;
            return line;
        }
    }

    /**
     * Render Polygon with clipping
     */
    private _renderPolygon(
        coordinates: GeoJSONCoordinate[][],
        style: any
    ): Object3D | null {
        if (!coordinates || coordinates.length === 0) return null;

        const exteriorRing = coordinates[0];
        const holes = coordinates.slice(1);

        const worldCoords: Vector3[] = [];
        let hasValidPoints = false;

        for (const coord of exteriorRing) {
            const [lng, lat, alt = 0] = coord;
            const worldPos = this._geoToWorld(lng, lat, alt);
            if (worldPos) {
                worldCoords.push(worldPos);
                hasValidPoints = true;
            } else if (this._clippingEnabled) {
                const unboundedPos = this._geoToWorldUnbounded(lng, lat, alt);
                worldCoords.push(unboundedPos);
            }
        }

        if (!hasValidPoints || worldCoords.length < 3) return null;

        // Create shape
        const shape = new Shape();
        shape.moveTo(worldCoords[0].x, worldCoords[0].z);
        for (let i = 1; i < worldCoords.length; i++) {
            shape.lineTo(worldCoords[i].x, worldCoords[i].z);
        }

        // Add holes
        for (const hole of holes) {
            const holeCoords: Vector3[] = [];
            for (const coord of hole) {
                const [lng, lat, alt = 0] = coord;
                const worldPos = this._clippingEnabled
                    ? this._geoToWorldUnbounded(lng, lat, alt)
                    : this._geoToWorld(lng, lat, alt);
                if (worldPos) {
                    holeCoords.push(worldPos);
                }
            }

            if (holeCoords.length >= 3) {
                const holePath = new Shape();
                holePath.moveTo(holeCoords[0].x, holeCoords[0].z);
                for (let i = 1; i < holeCoords.length; i++) {
                    holePath.lineTo(holeCoords[i].x, holeCoords[i].z);
                }
                shape.holes.push(holePath);
            }
        }

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
            side: DoubleSide,
        });

        if (this._clippingEnabled) {
            material.clippingPlanes = this._createClippingPlanes();
        }

        const mesh = new ThreeMesh(geometry, material);
        this._polygonsContainer.add(mesh);

        return mesh;
    }

    /**
     * Get world position without bounds checking (for polygon clipping)
     */
    private _geoToWorldUnbounded(
        lon: number,
        lat: number,
        altitude: number = 0
    ): Vector3 {
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

        return new Vector3(worldX, altitude, worldZ);
    }

    /**
     * Create clipping planes for the map bounds
     */
    private _createClippingPlanes(): Plane[] {
        const halfSize = 0.5;
        return [
            new Plane(new Vector3(1, 0, 0), halfSize), // Left
            new Plane(new Vector3(-1, 0, 0), halfSize), // Right
            new Plane(new Vector3(0, 0, 1), halfSize), // Top
            new Plane(new Vector3(0, 0, -1), halfSize), // Bottom
        ];
    }

    /**
     * Validate coordinates
     */
    private _validateCoordinates(
        coordinates: GeoJSONCoordinate[]
    ): GeoJSONCoordinate[] {
        const validCoords: GeoJSONCoordinate[] = [];

        for (const coord of coordinates) {
            const [lng, lat, alt = 0] = coord;

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
     * Render MultiPoint
     */
    private _renderMultiPoint(
        coordinates: GeoJSONCoordinate[],
        style: any
    ): Object3D | null {
        const group = new ThreeGroup();
        let hasValidPoints = false;

        for (const coord of coordinates) {
            const point = this._renderPoint(coord, style);
            if (point) {
                group.add(point);
                hasValidPoints = true;
            }
        }

        return hasValidPoints ? group : null;
    }

    /**
     * Render MultiLineString
     */
    private _renderMultiLineString(
        coordinates: GeoJSONCoordinate[][],
        style: any
    ): Object3D | null {
        const group = new ThreeGroup();
        let hasValidLines = false;

        for (const lineCoords of coordinates) {
            const line = this._renderLineString(lineCoords, style);
            if (line) {
                group.add(line);
                hasValidLines = true;
            }
        }

        return hasValidLines ? group : null;
    }

    /**
     * Render MultiPolygon
     */
    private _renderMultiPolygon(
        coordinates: GeoJSONCoordinate[][][],
        style: any
    ): Object3D | null {
        const group = new ThreeGroup();
        let hasValidPolygons = false;

        for (const polygonCoords of coordinates) {
            const polygon = this._renderPolygon(polygonCoords, style);
            if (polygon) {
                group.add(polygon);
                hasValidPolygons = true;
            }
        }

        return hasValidPolygons ? group : null;
    }

    /**
     * Render GeometryCollection
     */
    private _renderGeometryCollection(
        geometries: GeoJSONGeometry[],
        style: any
    ): Object3D | null {
        const group = new ThreeGroup();
        let hasValidGeometry = false;

        for (const geometry of geometries) {
            const syntheticFeature: GeoJSONFeature = {
                type: 'Feature',
                geometry: geometry,
                properties: {},
            };

            const rendered = this._renderFeature(
                syntheticFeature,
                this._getVisibleBounds()
            );
            if (rendered) {
                group.add(rendered.object3D);
                hasValidGeometry = true;
            }
        }

        return hasValidGeometry ? group : null;
    }

    /**
     * Get feature style
     */
    private _getFeatureStyle(feature: GeoJSONFeature): any {
        const style = { ...this._options.defaultStyle };

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
     * Generate unique ID for feature
     */
    private _getFeatureId(feature: GeoJSONFeature): string {
        if (feature.id !== undefined) {
            return feature.id.toString();
        }

        const coordsStr = JSON.stringify(feature.geometry.coordinates);
        let hash = 0;
        for (let i = 0; i < coordsStr.length; i++) {
            const char = coordsStr.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return `auto_${hash}`;
    }

    /**
     * Update renderer resolution when ready
     */
    updateRendererResolutionWhenReady(): void {
        const mapViewAny = this._mapView as any;
        const game = mapViewAny._game || mapViewAny.game;

        if (game) {
            const renderer = game.getRenderer();
            if (renderer) {
                const size = renderer.getSize(new Vector2());

                if (size.x > 0 && size.y > 0) {
                    this.setRendererResolution(size.x, size.y);
                    return;
                }
            }
        }

        setTimeout(() => this.updateRendererResolutionWhenReady(), 500);
    }

    /**
     * Clear all features
     */
    clear(): this {
        this._features.forEach((featureInfo) => {
            this._disposeFeature(featureInfo);
        });
        this._features.clear();

        this._clearContainer(this._pointsContainer);
        this._clearContainer(this._linesContainer);
        this._clearContainer(this._polygonsContainer);

        return this;
    }

    /**
     * Clear container
     */
    private _clearContainer(container: ThreeGroup): void {
        const objectsToRemove = [...container.children];
        objectsToRemove.forEach((child) => {
            container.remove(child);
            disposeObject3D(child);
        });
    }

    /**
     * Dispose feature
     */
    private _disposeFeature(featureInfo: FeatureRenderInfo): void {
        if (featureInfo.object3D.parent) {
            featureInfo.object3D.parent.remove(featureInfo.object3D);
        }
        disposeObject3D(featureInfo.object3D);
    }

    /**
     * Dispose entire layer
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
