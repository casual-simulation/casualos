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
import type { Feature, Geometry } from 'geojson';
import { MercatorMath } from './MercatorMath';
import { shortUuid } from '@casual-simulation/aux-common';
import { Vector3, Vector2, Box2 } from '@casual-simulation/three';
import { MapView } from './MapView';
import { GeoJSONMapOverlay } from './MapOverlay';
import { GeoJSON3DOverlay } from './GeoJSON3DOverlay';

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
    pointColor?: string | number;
    pointSize?: number;
    lineColor?: string | number;
    lineWidth?: number;
    lineOpacity?: number;
    polygonColor?: string | number;
    fillColor?: string | number;
    polygonOpacity?: number;
    fillOpacity?: number;
    strokeColor?: string | number;
    strokeWidth?: number;
    extrudeHeight?: number;
    height?: number;
    altitudeScale?: number;
}

interface GeometryRelativeSize {
    scale: number;
    ref: 'width' | 'height';
}

interface GeometryStaticSize {
    amount: number;
    unit: Units;
}

/** Dynamic allowlist to keep up to date with new styling properties on CanvasRenderingContext2D */
type CRC2DAllowlist<
    K extends keyof CanvasRenderingContext2D = keyof CanvasRenderingContext2D
> = K extends string | number
    ? CanvasRenderingContext2D[K] extends string
        ? K
        : never
    : never;

/** Canvas Rendering Context 2D Attributes */
type CRC2DAttributes = Pick<CanvasRenderingContext2D, CRC2DAllowlist>;

interface GeometryAttributes extends CRC2DAttributes {
    sizeType?: 'static' | 'relative';
    size?: GeometryRelativeSize | GeometryStaticSize;
}

const ctxAllowList: Set<string> = new Set([
    'font',
    'textAlign',
    'textBaseline',
    'direction',
    'fontKerning',
    'fontStretch',
    'fontVariantCaps',
    'letterSpacing',
    'textRendering',
    'wordSpacing',
    'globalCompositeOperation',
    'filter',
    'imageSmoothingQuality',
    'strokeStyle',
    'fillStyle',
    'shadowColor',
    'lineCap',
    'lineJoin',
    'shadowOffsetX',
    'shadowOffsetY',
    'shadowBlur',
    'lineWidth',
    'miterLimit',
    'lineDashOffset',
    'lang',
]);

/**
 * GeoJSONRenderer: Central utility for GeoJSON rendering and processing
 * Handles both 2D canvas rendering and provides utilities for 3D rendering
 */
export class GeoJSONRenderer {
    // Static utilities for GeoJSON analysis and processing

    /**
     * Extract style information from GeoJSON properties
     */
    static extractStyleFromGeoJSON(geoJSON: AllGeoJSON): GeoJSONStyle {
        const style: GeoJSONStyle = {};

        const extractFromFeature = (feature: any) => {
            if (feature.properties) {
                const props = feature.properties;

                // Direct style properties
                if (props.pointColor) style.pointColor = props.pointColor;
                if (props.pointSize) style.pointSize = props.pointSize;
                if (props.lineColor) style.lineColor = props.lineColor;
                if (props.lineWidth) style.lineWidth = props.lineWidth;
                if (props.lineOpacity) style.lineOpacity = props.lineOpacity;
                if (props.fillColor) style.fillColor = props.fillColor;
                if (props.fillOpacity) style.fillOpacity = props.fillOpacity;
                if (props.strokeColor) style.strokeColor = props.strokeColor;
                if (props.strokeWidth) style.strokeWidth = props.strokeWidth;
                if (props.extrudeHeight)
                    style.extrudeHeight = props.extrudeHeight;

                // Also map polygon-specific properties
                if (props.fillColor) style.polygonColor = props.fillColor;
                if (props.fillOpacity) style.polygonOpacity = props.fillOpacity;

                // Style object
                if (props.style) {
                    const s = props.style;
                    if (s.pointColor) style.pointColor = s.pointColor;
                    if (s.pointSize) style.pointSize = s.pointSize;
                    if (s.lineColor) style.lineColor = s.lineColor;
                    if (s.lineWidth) style.lineWidth = s.lineWidth;
                    if (s.lineOpacity) style.lineOpacity = s.lineOpacity;
                    if (s.fillColor) {
                        style.fillColor = s.fillColor;
                        style.polygonColor = s.fillColor;
                    }
                    if (s.fillOpacity) {
                        style.fillOpacity = s.fillOpacity;
                        style.polygonOpacity = s.fillOpacity;
                    }
                    if (s.strokeColor) style.strokeColor = s.strokeColor;
                    if (s.strokeWidth) style.strokeWidth = s.strokeWidth;
                    if (s.extrudeHeight) style.extrudeHeight = s.extrudeHeight;
                    if (s.height) style.height = s.height;
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
     * Check if GeoJSON contains altitude data
     */
    static hasAltitudeData(geoJSON: AllGeoJSON): boolean {
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
    static hasExtrudeData(geoJSON: AllGeoJSON): boolean {
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
     * Determine if GeoJSON should use 3D rendering
     */
    static shouldUse3D(geoJSON: AllGeoJSON): boolean {
        return this.hasAltitudeData(geoJSON) || this.hasExtrudeData(geoJSON);
    }

    /**
     * Convert geographic coordinates to 3D world coordinates
     */
    static geoTo3D(
        lon: number,
        lat: number,
        alt: number = 0,
        centerLon: number,
        centerLat: number,
        zoom: number,
        tileSize: number = 256,
        altitudeScale: number = 0.00001
    ): Vector3 {
        // Calculate pixel coordinates
        const [pixelX, pixelY] = MapView.calculatePixel(zoom, lon, lat);

        // Get center pixel coordinates
        const [centerPixelX, centerPixelY] = MapView.calculatePixel(
            zoom,
            centerLon,
            centerLat
        );

        // Calculate offset from center in pixels
        const deltaPixelX = pixelX - centerPixelX;
        const deltaPixelY = pixelY - centerPixelY;

        // Convert to world coordinates
        const worldX = deltaPixelX / tileSize;
        const worldZ = deltaPixelY / tileSize;
        const worldY = alt * altitudeScale;

        return new Vector3(worldX, worldY, worldZ);
    }

    /**
     * Process GeoJSON geometry recursively
     */
    static processGeometry(
        geometry: Geometry,
        callback: {
            onPoint?: (coords: number[], properties?: any) => void;
            onLineString?: (coords: number[][], properties?: any) => void;
            onPolygon?: (coords: number[][][], properties?: any) => void;
        },
        properties?: any
    ): void {
        if (!geometry) return;

        switch (geometry.type) {
            case 'Point':
                callback.onPoint?.(geometry.coordinates, properties);
                break;

            case 'LineString':
                callback.onLineString?.(geometry.coordinates, properties);
                break;

            case 'Polygon':
                callback.onPolygon?.(geometry.coordinates, properties);
                break;

            case 'MultiPoint':
                for (const point of geometry.coordinates) {
                    callback.onPoint?.(point, properties);
                }
                break;

            case 'MultiLineString':
                for (const line of geometry.coordinates) {
                    callback.onLineString?.(line, properties);
                }
                break;

            case 'MultiPolygon':
                for (const polygon of geometry.coordinates) {
                    callback.onPolygon?.(polygon, properties);
                }
                break;

            case 'GeometryCollection':
                for (const geom of geometry.geometries) {
                    this.processGeometry(geom, callback, properties);
                }
                break;

            default:
                console.warn(
                    `Unsupported geometry type: ${(geometry as any).type}`
                );
        }
    }

    /**
     * Process all features in a GeoJSON
     */
    static processGeoJSON(
        geoJSON: AllGeoJSON,
        callback: {
            onPoint?: (coords: number[], properties?: any) => void;
            onLineString?: (coords: number[][], properties?: any) => void;
            onPolygon?: (coords: number[][][], properties?: any) => void;
        }
    ): void {
        if (!geoJSON) return;

        if (geoJSON.type === 'FeatureCollection') {
            for (const feature of geoJSON.features) {
                this.processGeometry(
                    feature.geometry,
                    callback,
                    feature.properties
                );
            }
        } else if (geoJSON.type === 'Feature') {
            this.processGeometry(
                geoJSON.geometry,
                callback,
                geoJSON.properties
            );
        } else if ('type' in geoJSON && 'coordinates' in geoJSON) {
            this.processGeometry(geoJSON as Geometry, callback);
        }
    }

    /**
     * Create a GeoJSON overlay (2D or 3D based on data)
     */
    /**
     * Create a GeoJSON overlay (2D or 3D based on data)
     */
    static createOverlay(
        geoJSON: AllGeoJSON,
        longitude: number,
        latitude: number,
        zoom: number,
        canvasSize: number = 512
    ): any {
        const dimensions = new Box2(
            new Vector2(-0.5, -0.5),
            new Vector2(0.5, 0.5)
        );
        const style = this.extractStyleFromGeoJSON(geoJSON);
        const use3D = this.shouldUse3D(geoJSON);

        if (use3D) {
            return new GeoJSON3DOverlay(
                dimensions,
                longitude,
                latitude,
                zoom,
                geoJSON,
                style
            );
        } else {
            return new GeoJSONMapOverlay(
                dimensions,
                canvasSize,
                longitude,
                latitude,
                zoom,
                geoJSON
            );
        }
    }
}

/**
 * Canvas-based 2D renderer for GeoJSON
 */
export class GeoJSONCanvasRenderer extends GeoJSONRenderer {
    canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private get viewCenter(): WorldPixel {
        return MercatorMath.calculatePixel(
            this._viewZoom,
            this._longitude,
            this._latitude,
            this._tileSize
        );
    }

    constructor(
        private _viewZoom: number,
        private _longitude: number,
        private _latitude: number,
        private _tileSize: number
    ) {
        super();
        this.canvas = document.createElement('canvas');
        this.canvas.id = `geojson-canvas-${Date.now()}-${shortUuid()}`;
        this.canvas.height = this.canvas.width = _tileSize;
        this.ctx = this.canvas.getContext('2d');
    }

    setZoom(zoom: number) {
        this._viewZoom = zoom;
    }

    setCenter(
        longitude: number,
        latitude: number,
        zoom: number = this._viewZoom
    ) {
        if (
            this._longitude === longitude &&
            this._latitude === latitude &&
            this._viewZoom === zoom
        )
            return;
        this._longitude = longitude;
        this._latitude = latitude;
        this._viewZoom = zoom;
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
        return MercatorMath.calculatePixel(zoom, lon, lat, this._tileSize);
    }

    coordToViewPixel(coordinates: PointPosition): [number, number] {
        if (!this.canvas) throw new Error('Canvas is not available');
        const worldPixel = this.latLonToWorldPixel(
            coordinates[1],
            coordinates[0]
        );
        const [x, y] = this.viewCenter;
        return [
            worldPixel[0] - (x - this.canvas.width / 2),
            worldPixel[1] - (y - this.canvas.height / 2),
        ];
    }

    private _applyAttributes(attributes: Partial<GeometryAttributes>) {
        if (!attributes) return;
        for (const [attr, val] of Object.entries(attributes)) {
            if (!ctxAllowList.has(attr)) continue;
            if (!val) continue;
            (this.ctx as any)[attr] = val;
        }
    }

    private _drawRoutine(
        draw: (ctx: CanvasRenderingContext2D) => void,
        attributes?: Partial<GeometryAttributes>
    ) {
        if (!this.ctx) throw new Error('Canvas context is not available');
        this.ctx.save();
        this._applyAttributes(attributes);
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

    drawPoint(coordinates: number[], attr?: Partial<GeometryAttributes>) {
        if (coordinates.length !== 2) {
            throw new Error('Invalid coordinates for PointPosition');
        }
        const [x, y] = this.coordToViewPixel(coordinates as PointPosition);
        this._drawRoutine((ctx) => {
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = attr?.fillStyle ?? 'rgba(183, 147, 255, 0.75)';
            ctx.fill();
            ctx.stroke();
        });
    }

    drawLineString(
        coordinates: Array<[number, number]>,
        attr?: Partial<GeometryAttributes>
    ) {
        coordinates = [...coordinates];
        this._drawRoutine((ctx) => {
            ctx.moveTo(...this.coordToViewPixel(coordinates[0]));
            for (let i = 1; i < coordinates.length; i++) {
                ctx.lineTo(...this.coordToViewPixel(coordinates[i]));
            }
            ctx.stroke();
        }, attr);
    }

    drawPolygon(
        coordinates: Array<Array<[number, number]>>,
        attr?: Partial<GeometryAttributes>
    ) {
        const [base, ...holes] = coordinates;
        this._drawRoutine((ctx) => {
            ctx.beginPath();
            ctx.moveTo(...this.coordToViewPixel(base[0]));
            for (let i = 1; i < base.length; i++) {
                ctx.lineTo(...this.coordToViewPixel(base[i]));
            }
            ctx.closePath();
            for (const hole of holes) {
                ctx.moveTo(...this.coordToViewPixel(hole[0]));
                for (let i = 1; i < hole.length; i++) {
                    ctx.lineTo(...this.coordToViewPixel(hole[i]));
                }
                ctx.closePath();
            }
            ctx.fill('evenodd');
        }, attr);
    }

    drawGeometry<G extends Geometry>(
        geometry: G,
        geometryAttributes: Partial<GeometryAttributes>
    ) {
        GeoJSONRenderer.processGeometry(
            geometry,
            {
                onPoint: (coords) => this.drawPoint(coords, geometryAttributes),
                onLineString: (coords) =>
                    this.drawLineString(
                        coords as Array<[number, number]>,
                        geometryAttributes
                    ),
                onPolygon: (coords) =>
                    this.drawPolygon(
                        coords as Array<Array<[number, number]>>,
                        geometryAttributes
                    ),
            },
            geometryAttributes
        );
    }

    drawFeature(feature: Feature) {
        if (!feature || feature.type !== 'Feature') {
            throw new Error('Invalid feature data');
        }
        this.drawGeometry(feature.geometry, feature.properties);
    }

    drawGeoJSON(geoJSON: AllGeoJSON) {
        if (!geoJSON || !geoJSON.type) {
            throw new Error('Invalid GeoJSON data');
        }

        GeoJSONRenderer.processGeoJSON(geoJSON, {
            onPoint: (coords, props) => this.drawPoint(coords, props),
            onLineString: (coords, props) =>
                this.drawLineString(coords as Array<[number, number]>, props),
            onPolygon: (coords, props) =>
                this.drawPolygon(
                    coords as Array<Array<[number, number]>>,
                    props
                ),
        });
    }

    dispose() {
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        this.ctx = null;
    }
}
