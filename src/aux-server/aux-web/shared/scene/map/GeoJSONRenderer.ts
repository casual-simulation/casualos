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
import { destination, point } from '@turf/turf';
import type { AllGeoJSON, Units } from '@turf/turf';
import type { Feature, Geometry, LineString, Point, Polygon } from 'geojson';
import { MercatorMath } from './MercatorMath';
import { shortUuid } from '@casual-simulation/aux-common';

/**
 * Renderer Class:
 * GeoJSONRenderer
 * * Used by the Bot shape.
 *
 * experiment api extension for drawing.
 * localEvent in Decorators and Sim3D
 * asyncResult, asyncError for communicating back to the api.
 */

/** Longitude in decimal degrees. */
type longitude = number;
/** Latitude in decimal degrees. */
type latitude = number;
/** Altitude in meters above or below WGS84 reference ellipsoid. */
type altitude = number;

/**
 * {v} distance in {u} units.
 */
interface Distance {
    u: Units;
    v: number;
}

/**
 * Represents a position in 2D or 3D space.
 * @link https://datatracker.ietf.org/doc/html/rfc7946#section-4
 */
type PointPosition<a extends boolean = false> = a extends true
    ? [longitude, latitude, altitude]
    : [longitude, latitude];

/**
 * Represents a pixel position in the world.
 * This is a 2D coordinate system where the origin (0, 0) is typically the top-left corner of the canvas.
 * The x-coordinate increases to the right, and the y-coordinate increases downwards.
 */
type WorldPixel = [number, number];

export interface GeoJSONStyle {
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
}

interface GeometryRelativeSize {
    scale: number;
    ref: 'width' | 'height';
}

interface GeometryStaticSize {
    // TODO: Refine
    amount: number;
    unit: Units;
}

interface BaseGeometryAttributes {
    /** Whether or not the size of the drawn Geometry is relative to the view scale or static to X units*/
    sizeType?: 'static' | 'relative';
    /** The size value for the geometry */
    size?: GeometryRelativeSize | GeometryStaticSize;
}

interface LineStringAttributes extends BaseGeometryAttributes {
    lineWidth?: number;
    strokeStyle?: string;
}

interface PointAttributes extends BaseGeometryAttributes {
    fillStyle?: string;
}

interface PolygonAttributes extends BaseGeometryAttributes {
    fillStyle?: string;
    strokeStyle?: string;
}

type GeometryAttributes<B extends Geometry> = B extends LineString
    ? LineStringAttributes
    : B extends Point
    ? PointAttributes
    : B extends Polygon
    ? PolygonAttributes
    : never;

export class GeoJSONRenderer {
    canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // Style configuration
    private _style: GeoJSONStyle;
    private _defaultStyle: GeoJSONStyle = {
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
    };

    // Cache for coordinate transformations
    private _transformCache: Map<string, [number, number]> = new Map();
    private _cacheGeneration: number = 0;

    // Store the world unit tile size separately from canvas size
    private _worldTileSize: number;

    private get viewCenter(): WorldPixel {
        return MercatorMath.calculatePixel(
            this._viewZoom,
            this._longitude,
            this._latitude,
            256
        );
    }

    constructor(
        private _viewZoom: number,
        private _longitude: number,
        private _latitude: number,
        private _tileSize: number,
        initialStyle?: GeoJSONStyle
    ) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = `geojson-canvas-${Date.now()}-${shortUuid()}`;

        this.canvas.width = _tileSize;
        this.canvas.height = _tileSize;
        this._worldTileSize = 1;

        const context = this.canvas.getContext('2d', {
            alpha: true,
            willReadFrequently: false,
        });

        if (!context) {
            throw new Error('Failed to create 2D context');
        }

        this.ctx = context;

        // Configure context for better rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Set default style
        this._style = {
            ...this._defaultStyle,
            ...initialStyle,
        };
    }

    /**
     * Set the style configuration for rendering
     */
    setStyle(style: GeoJSONStyle): void {
        this._style = { ...this._style, ...style };
    }

    /**
     * Get current style
     */
    getStyle(): GeoJSONStyle {
        return { ...this._style };
    }

    /**
     * Set canvas size for better resolution
     */
    setCanvasSize(width: number, height: number): void {
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;

            // Re-configure context after resize
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';

            // Clear transform cache as canvas size changed
            this._invalidateCache();
        }
    }

    /**
     * Update renderer resolution based on the game renderer size
     */
    updateRendererResolution(
        rendererWidth: number,
        rendererHeight: number
    ): void {
        const finalWidth = rendererWidth > 0 ? rendererWidth : 1920;
        const finalHeight = rendererHeight > 0 ? rendererHeight : 1080;

        this.setCanvasSize(finalWidth, finalHeight);
    }

    /**
     * Configure renderer from GeoJSON properties
     * Extracts style information from feature properties
     */
    configureFromGeoJSON(geoJSON: AllGeoJSON): void {
        // Extract style from the first feature if it's a FeatureCollection
        let styleProperties: Record<string, any> = {};

        if (
            geoJSON.type === 'FeatureCollection' &&
            geoJSON.features.length > 0
        ) {
            // Look for style properties in features
            for (const feature of geoJSON.features) {
                if (feature.properties && feature.properties.style) {
                    styleProperties = {
                        ...styleProperties,
                        ...feature.properties.style,
                    };
                }
            }
        } else if (geoJSON.type === 'Feature' && geoJSON.properties?.style) {
            styleProperties = geoJSON.properties.style;
        }

        // Apply style properties if found
        if (Object.keys(styleProperties).length > 0) {
            const newStyle: GeoJSONStyle = {};

            // Map style properties
            if (styleProperties.pointColor)
                newStyle.pointColor = styleProperties.pointColor;
            if (styleProperties.pointSize)
                newStyle.pointSize = styleProperties.pointSize;
            if (styleProperties.lineColor)
                newStyle.lineColor = styleProperties.lineColor;
            if (styleProperties.lineWidth)
                newStyle.lineWidth = styleProperties.lineWidth;
            if (styleProperties.lineOpacity)
                newStyle.lineOpacity = styleProperties.lineOpacity;
            if (styleProperties.fillColor)
                newStyle.fillColor = styleProperties.fillColor;
            if (styleProperties.fillOpacity)
                newStyle.fillOpacity = styleProperties.fillOpacity;
            if (styleProperties.strokeColor)
                newStyle.strokeColor = styleProperties.strokeColor;
            if (styleProperties.strokeWidth)
                newStyle.strokeWidth = styleProperties.strokeWidth;
            if (styleProperties.extrudeHeight)
                newStyle.extrudeHeight = styleProperties.extrudeHeight;

            this.setStyle(newStyle);
        }
    }

    setZoom(zoom: number) {
        if (this._viewZoom !== zoom) {
            this._viewZoom = zoom;
            this._invalidateCache();
        }
    }

    setCenter(
        longitude: number,
        latitude: number,
        zoom: number = this._viewZoom
    ): void {
        const changed =
            this._longitude !== longitude ||
            this._latitude !== latitude ||
            this._viewZoom !== zoom;

        if (!changed) {
            return;
        }
        this._longitude = longitude;
        this._latitude = latitude;
        this._viewZoom = zoom;
        this._invalidateCache();

        // Log the geographic bounds for debugging
        const bounds = this.getGeographicBounds();
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Converts latitude and longitude to world pixel coordinates.
     */
    latLonToWorldPixel(
        lat: number,
        lon: number,
        zoom: number = this._viewZoom
    ): WorldPixel {
        return MercatorMath.calculatePixel(zoom, lon, lat, 256);
    }

    /**
     * Convert geographic coordinates to canvas pixel coordinates
     */
    coordToViewPixel(coordinates: PointPosition): [number, number] {
        if (!this.canvas) {
            console.error(
                '[GeoJSONRenderer.coordToViewPixel] Canvas is not available'
            );
            throw new Error(
                'GeoJSONRenderer.coordToViewPixel: Canvas is not available'
            );
        }

        const cacheKey = `${coordinates[0]},${coordinates[1]},${this._viewZoom},${this._longitude},${this._latitude}`;
        const cached = this._transformCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const [featureLon, featureLat] = coordinates;

        try {
            // Calculate world pixel coordinates for both the feature and the map center
            const [featureWorldPixelX, featureWorldPixelY] =
                MercatorMath.calculatePixel(
                    this._viewZoom,
                    featureLon,
                    featureLat,
                    256
                );

            const [centerWorldPixelX, centerWorldPixelY] =
                MercatorMath.calculatePixel(
                    this._viewZoom,
                    this._longitude,
                    this._latitude,
                    256
                );

            // Calculate the offset from the map center in world pixels
            const deltaWorldPixelX = featureWorldPixelX - centerWorldPixelX;
            const deltaWorldPixelY = featureWorldPixelY - centerWorldPixelY;

            // Scale the world pixel delta to canvas coordinates
            // The canvas represents one world tile unit (this._worldTileSize)
            // At zoom level, one tile is 256 world pixels
            const WORLD_TILE_PIXELS = 256;
            const scaleX = this.canvas.width / WORLD_TILE_PIXELS;
            const scaleY = this.canvas.height / WORLD_TILE_PIXELS;

            // Convert to canvas coordinates with proper scaling
            const canvasX = this.canvas.width / 2 + deltaWorldPixelX * scaleX;
            const canvasY = this.canvas.height / 2 + deltaWorldPixelY * scaleY;

            const result: [number, number] = [canvasX, canvasY];

            // Cache the result
            this._transformCache.set(cacheKey, result);

            return result;
        } catch (error) {
            console.error(
                '[GeoJSONRenderer.coordToViewPixel] Error during coordinate transformation:',
                error
            );
            throw error;
        }
    }

    /**
     * Invalidate the coordinate transformation cache
     */
    private _invalidateCache(): void {
        this._transformCache.clear();
        this._cacheGeneration++;
        console.log('[GeoJSONRenderer] Cache invalidated');
    }

    _drawRoutine(draw: (ctx: CanvasRenderingContext2D) => void) {
        if (!this.ctx) throw new Error('Canvas context is not available');
        this.ctx.save();
        this.ctx.beginPath();
        draw(this.ctx);
        this.ctx.closePath();
        this.ctx.restore();
    }

    drawRectangle(
        coordinates: PointPosition,
        shape: {
            width: Distance;
            height: Distance;
            center?: boolean;
            attributes?: Record<string, any>;
        } = {
            width: { u: 'kilometers', v: 50 },
            height: { u: 'kilometers', v: 50 },
            center: true,
        }
    ) {
        const coords = point(coordinates);
        let w = shape.width.v;
        let h = shape.height.v;
        let l, t, r, b;
        if (shape.center) {
            w = w / 2;
            h = h / 2;
            l = destination(coords, w, -90, { units: shape.width.u }).geometry
                .coordinates[0];
            t = destination(coords, h, 0, { units: shape.height.u }).geometry
                .coordinates[1];
        } else {
            l = coordinates[0];
            t = coordinates[1];
        }
        r = destination(coords, w, 90, { units: shape.width.u }).geometry
            .coordinates[0];
        b = destination(coords, h, 180, { units: shape.height.u }).geometry
            .coordinates[1];
        let [tl, br] = [
            this.coordToViewPixel([l, t]),
            this.coordToViewPixel([r, b]),
        ];
        const width = br[0] - tl[0];
        const height = br[1] - tl[1];
        this._drawRoutine((ctx) => {
            ctx.rect(tl[0], tl[1], width, height);
            if (shape?.attributes?.stroke) ctx.stroke();
            ctx.fillStyle =
                shape?.attributes?.fillStyle ?? 'rgba(255,255,255,0.1)';
            ctx.fill();
        });
    }

    drawPoint(coordinates: number[], attr?: PointAttributes) {
        // Debug 3D info
        if (coordinates.length === 3) {
            console.log('[GeoJSONRenderer.3D] Drawing 3D Point:', {
                lon: coordinates[0],
                lat: coordinates[1],
                altitude: coordinates[2],
                attributes: attr,
                viewPixel: this.coordToViewPixel(
                    coordinates.slice(0, 2) as PointPosition
                ),
            });
        }

        // Accept both 2D and 3D coordinates
        if (coordinates.length < 2 || coordinates.length > 3) {
            throw new Error('Invalid coordinates for PointPosition');
        }

        // Use only the first two coordinates (lon, lat) for 2D rendering
        const [x, y] = this.coordToViewPixel(
            coordinates.slice(0, 2) as PointPosition
        );

        // The altitude (if present) could be used for visual effects
        const altitude = coordinates.length === 3 ? coordinates[2] : 0;

        // Check if point is within canvas bounds
        if (x < 0 || x > this.canvas.width || y < 0 || y > this.canvas.height) {
            console.log('[GeoJSONRenderer.3D] Point outside canvas bounds:', {
                x,
                y,
                canvasSize: { w: this.canvas.width, h: this.canvas.height },
            });
            return;
        }
        this._drawRoutine((ctx) => {
            // Scale radius based on altitude if extrudeHeight is set
            const baseRadius = attr?.size
                ? 5
                : (this._style.pointSize || 5) / 2;
            let radius = baseRadius;

            // If there's an extrude height, we could visualize it
            const extrudeHeight = this._style.extrudeHeight || 0;
            if (extrudeHeight > 0 && altitude > 0) {
                // Scale radius based on altitude
                radius = baseRadius * (1 + altitude / 10000); // Adjust scale factor as needed
                console.log(
                    '[GeoJSONRenderer.3D] Scaled point radius by altitude:',
                    { baseRadius, scaledRadius: radius, altitude }
                );
            }

            const fillStyle =
                attr?.fillStyle ??
                this._style.pointColor ??
                'rgba(183, 147, 255, 0.75)';

            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = fillStyle;
            ctx.fill();
            ctx.stroke();
        });
    }

    drawLineString(
        coordinates: Array<[number, number] | [number, number, number]>,
        attr?: LineStringAttributes
    ) {
        if (coordinates.length < 2) {
            console.log(
                '[GeoJSONRenderer] Not enough coordinates for LineString'
            );
            return;
        }

        // Debug 3D line info
        const altitudes = coordinates
            .filter((coord) => coord.length === 3)
            .map((coord) => coord[2]);

        if (altitudes.length > 0) {
            console.log('[GeoJSONRenderer.3D] Drawing 3D LineString:', {
                pointCount: coordinates.length,
                altitudeRange: {
                    min: Math.min(...altitudes),
                    max: Math.max(...altitudes),
                    points: altitudes,
                },
                attributes: attr,
            });
        }

        coordinates = [...coordinates];
        this._drawRoutine((ctx) => {
            ctx.lineWidth = attr?.lineWidth ?? this._style.lineWidth ?? 2;
            ctx.strokeStyle =
                attr?.strokeStyle ?? this._style.lineColor ?? 'red';
            ctx.globalAlpha = this._style.lineOpacity ?? 1.0;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Handle 2D or 3D coordinates
            const firstCoord = coordinates[0].slice(0, 2) as PointPosition;
            ctx.moveTo(...this.coordToViewPixel(firstCoord));

            // For 3D lines, we could vary the line width or color based on altitude
            for (let i = 1; i < coordinates.length; i++) {
                const coord = coordinates[i].slice(0, 2) as PointPosition;

                // If 3D, we could modify appearance based on altitude change
                if (
                    coordinates[i].length === 3 &&
                    coordinates[i - 1].length === 3
                ) {
                    const altChange = coordinates[i][2] - coordinates[i - 1][2];
                    if (Math.abs(altChange) > 1000) {
                        // Significant altitude change
                        console.log(
                            `[GeoJSONRenderer.3D] Altitude change at segment ${i}:`,
                            altChange
                        );
                    }
                }

                ctx.lineTo(...this.coordToViewPixel(coord));
            }
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        });
    }

    drawPolygon(
        coordinates: Array<Array<[number, number] | [number, number, number]>>,
        attr?: PolygonAttributes
    ) {
        if (coordinates.length === 0) {
            console.log('[GeoJSONRenderer] No coordinates for polygon');
            return;
        }

        const [base, ...holes] = coordinates;
        console.log(
            '[GeoJSONRenderer] Exterior ring has',
            base.length,
            'points'
        );
        console.log('[GeoJSONRenderer] Polygon has', holes.length, 'holes');

        this._drawRoutine((ctx) => {
            ctx.beginPath();

            // Draw exterior ring
            if (base.length >= 3) {
                const firstPoint = this.coordToViewPixel(
                    base[0].slice(0, 2) as PointPosition
                );
                console.log(
                    '[GeoJSONRenderer] First polygon point pixel:',
                    firstPoint
                );

                ctx.moveTo(...firstPoint);
                for (let i = 1; i < base.length; i++) {
                    ctx.lineTo(
                        ...this.coordToViewPixel(
                            base[i].slice(0, 2) as PointPosition
                        )
                    );
                }
                ctx.closePath();
            }

            // Draw holes
            for (const hole of holes) {
                if (hole.length >= 3) {
                    ctx.moveTo(
                        ...this.coordToViewPixel(
                            hole[0].slice(0, 2) as PointPosition
                        )
                    );
                    for (let i = 1; i < hole.length; i++) {
                        ctx.lineTo(
                            ...this.coordToViewPixel(
                                hole[i].slice(0, 2) as PointPosition
                            )
                        );
                    }
                    ctx.closePath();
                }
            }

            // Fill and stroke with style
            if (this._style.fillOpacity! > 0) {
                ctx.fillStyle =
                    attr?.fillStyle ??
                    this._style.fillColor ??
                    'rgba(255,255,255,0.1)';
                ctx.globalAlpha = this._style.fillOpacity ?? 0.7;
                console.log('[GeoJSONRenderer] Filling polygon with:', {
                    fillStyle: ctx.fillStyle,
                    globalAlpha: ctx.globalAlpha,
                });
                ctx.fill('evenodd');
                ctx.globalAlpha = 1.0;
            }

            // Stroke with style
            if (attr?.strokeStyle || this._style.strokeWidth! > 0) {
                ctx.strokeStyle =
                    attr?.strokeStyle ?? this._style.strokeColor ?? '#000000';
                ctx.lineWidth = this._style.strokeWidth ?? 1;
                ctx.stroke();
            }
        });
    }

    drawGeometry<G extends Geometry>(
        geometry: G,
        geometryAttributes: GeometryAttributes<G> | Record<string, any>
    ) {
        // Debug geometry type and 3D status
        if ('coordinates' in geometry) {
            this._debug3DCoordinates(
                geometry.type,
                geometry.coordinates,
                geometryAttributes
            );
        } else if ('geometries' in geometry) {
            this._debug3DCoordinates(
                geometry.type,
                geometry.geometries,
                geometryAttributes
            );
        }

        // Merge with style properties from feature properties
        const mergedAttributes = this._mergeWithStyle(geometryAttributes);

        // Draw the geometry based on its type
        switch (geometry.type) {
            case 'Point':
                this.drawPoint(
                    geometry.coordinates,
                    mergedAttributes as PointAttributes
                );
                break;
            case 'LineString':
                this.drawLineString(
                    geometry.coordinates as Array<
                        [number, number] | [number, number, number]
                    >,
                    mergedAttributes as LineStringAttributes
                );
                break;
            case 'Polygon':
                this.drawPolygon(
                    geometry.coordinates as Array<
                        Array<[number, number] | [number, number, number]>
                    >,
                    mergedAttributes as PolygonAttributes
                );
                break;
            case 'MultiLineString':
                for (const line of geometry.coordinates) {
                    this.drawLineString(
                        line as Array<[number, number]>,
                        mergedAttributes
                    );
                }
                break;
            case 'MultiPoint':
                for (const point of geometry.coordinates) {
                    this.drawPoint(point, mergedAttributes);
                }
                break;
            case 'MultiPolygon':
                for (const polygon of geometry.coordinates) {
                    this.drawPolygon(
                        polygon as Array<Array<[number, number]>>,
                        mergedAttributes
                    );
                }
                break;
            case 'GeometryCollection':
                for (const part of geometry.geometries) {
                    this.drawGeometry(part, mergedAttributes);
                }
                break;
            default:
                console.warn(`Unsupported geometry type`);
        }
    }

    /**
     * Merge feature properties with default style
     */
    private _mergeWithStyle(
        properties: Record<string, any>
    ): Record<string, any> {
        const merged: Record<string, any> = { ...properties };

        // Map style properties to attribute names
        if (properties.pointColor && !merged.fillStyle) {
            merged.fillStyle = properties.pointColor;
        }
        if (properties.lineColor && !merged.strokeStyle) {
            merged.strokeStyle = properties.lineColor;
        }
        if (properties.lineWidth && !merged.lineWidth) {
            merged.lineWidth = properties.lineWidth;
        }
        if (properties.fillColor && !merged.fillStyle) {
            merged.fillStyle = properties.fillColor;
        }

        return merged;
    }

    drawFeature(feature: Feature) {
        if (!feature || feature.type !== 'Feature') {
            throw new Error('Invalid feature data');
        }
        this.drawGeometry(feature.geometry, feature.properties || {});
    }

    drawGeoJSON(geoJSON: AllGeoJSON) {
        console.log('[GeoJSONRenderer] drawGeoJSON called with:', geoJSON);

        if (!geoJSON || !geoJSON.type) {
            console.error('[GeoJSONRenderer] Invalid GeoJSON data');
            throw new Error('Invalid GeoJSON data');
        }

        // Save context state
        this.ctx.save();

        console.log('[GeoJSONRenderer] Canvas size:', {
            width: this.canvas.width,
            height: this.canvas.height,
        });

        console.log('[GeoJSONRenderer] View center:', this.viewCenter);
        console.log('[GeoJSONRenderer] Current style:', this._style);

        let featureCount = 0;
        let geometryCount = 0;

        try {
            // Configure from GeoJSON properties
            this.configureFromGeoJSON(geoJSON);

            if (geoJSON.type == 'FeatureCollection') {
                if (!geoJSON?.features?.length) {
                    return;
                }
                geoJSON.features.forEach((feature, index) => {
                    this.drawFeature(feature);
                    featureCount++;
                });
            } else if (geoJSON.type === 'Feature') {
                this.drawFeature(geoJSON);
                featureCount = 1;
            } else if (geoJSON.type === 'GeometryCollection') {
                if (!geoJSON?.geometries?.length) {
                    return;
                }
                geoJSON.geometries.forEach((geometry) => {
                    this.drawGeometry(geometry, {});
                    geometryCount++;
                });
            } else {
                this.drawGeometry(geoJSON, {});
                geometryCount = 1;
            }
        } finally {
            // Restore context state
            this.ctx.restore();
        }
    }

    /**
     * Get canvas bounds in geographic coordinates
     */
    getGeographicBounds(): {
        minLon: number;
        minLat: number;
        maxLon: number;
        maxLat: number;
    } {
        // Calculate how many degrees the canvas covers at the current zoom level
        const worldPixelWidth = 256 * Math.pow(2, this._viewZoom);
        const degreesPerPixel = 360 / worldPixelWidth;

        // Calculate the geographic span of the canvas
        const canvasWidthInDegrees = this.canvas.width * degreesPerPixel;
        const canvasHeightInDegrees = this.canvas.height * degreesPerPixel;

        // Calculate bounds centered on the current position
        const minLon = this._longitude - canvasWidthInDegrees / 2;
        const maxLon = this._longitude + canvasWidthInDegrees / 2;

        // For latitude, we need to account for Mercator projection distortion
        // Convert center latitude to world pixels, add/subtract canvas height, then convert back
        const centerWorldPixelY = MercatorMath.calculatePixel(
            this._viewZoom,
            this._longitude,
            this._latitude,
            256
        )[1];

        const minWorldPixelY = centerWorldPixelY - this.canvas.height / 2;
        const maxWorldPixelY = centerWorldPixelY + this.canvas.height / 2;

        const maxLat = MercatorMath.yToLatitude(
            minWorldPixelY,
            this._viewZoom,
            256
        );
        const minLat = MercatorMath.yToLatitude(
            maxWorldPixelY,
            this._viewZoom,
            256
        );

        return { minLon, minLat, maxLon, maxLat };
    }

    dispose() {
        // Clear cache
        this._transformCache.clear();

        // Clear canvas
        this.clearCanvas();

        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        this.ctx = null;
    }

    private _debug3DCoordinates(
        type: string,
        coordinates: any,
        properties?: any
    ): void {
        const has3D = this._checkHas3D(coordinates);
        console.log(`[GeoJSONRenderer.3D] ${type}:`, {
            has3D,
            coordinates: coordinates,
            properties: properties || {},
            extrudeHeight:
                properties?.style?.extrudeHeight ||
                properties?.extrudeHeight ||
                0,
        });
    }

    private _checkHas3D(coords: any): boolean {
        if (Array.isArray(coords)) {
            if (coords.length === 3 && typeof coords[0] === 'number') {
                return true;
            }
            return coords.some((c) => this._checkHas3D(c));
        }
        return false;
    }
}
