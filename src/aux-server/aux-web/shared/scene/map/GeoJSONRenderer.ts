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

export class GeoJSONRenderer {
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
        attr?: LineStringAttributes
    ) {
        coordinates = [...coordinates];
        this._drawRoutine((ctx) => {
            ctx.lineWidth = attr?.lineWidth ?? 2;
            ctx.strokeStyle = attr?.strokeStyle ?? 'red';
            ctx.moveTo(...this.coordToViewPixel(coordinates[0]));
            for (let i = 1; i < coordinates.length; i++) {
                ctx.lineTo(...this.coordToViewPixel(coordinates[i]));
            }
            ctx.stroke();
        });
    }

    drawPolygon(
        coordinates: Array<Array<[number, number]>>,
        attr?: PolygonAttributes
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
        });
    }

    drawGeometry<G extends Geometry>(
        geometry: G,
        geometryAttributes: GeometryAttributes<G>
    ) {
        // Draw the geometry based on its type
        switch (geometry.type) {
            case 'Point':
                this.drawPoint(
                    geometry.coordinates,
                    geometryAttributes as PointAttributes
                );
                break;
            case 'LineString':
                this.drawLineString(
                    geometry.coordinates as Array<[number, number]>,
                    geometryAttributes as LineStringAttributes
                );
                break;
            case 'Polygon':
                this.drawPolygon(
                    geometry.coordinates as Array<Array<[number, number]>>,
                    geometryAttributes as PolygonAttributes
                );
                break;
            case 'MultiLineString':
                for (const line of geometry.coordinates) {
                    this.drawLineString(
                        line as Array<[number, number]>,
                        geometryAttributes
                    );
                }
                break;
            case 'MultiPoint':
                for (const point of geometry.coordinates) {
                    this.drawPoint(point, geometryAttributes);
                }
                break;
            case 'MultiPolygon':
                for (const polygon of geometry.coordinates) {
                    this.drawPolygon(
                        polygon as Array<Array<[number, number]>>,
                        geometryAttributes
                    );
                }
                break;
            case 'GeometryCollection':
                for (const part of geometry.geometries) {
                    this.drawGeometry(part, geometryAttributes);
                }
                break;
            default:
                console.warn(`Unsupported geometry type`);
        }
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
        if (geoJSON.type == 'FeatureCollection') {
            if (!geoJSON?.features?.length) return;
            geoJSON.features.forEach((feature) => {
                this.drawFeature(feature);
            });
        } else if (geoJSON.type === 'Feature') {
            this.drawFeature(geoJSON);
        } else if (geoJSON.type === 'GeometryCollection') {
            if (!geoJSON?.geometries?.length) return;
            geoJSON.geometries.forEach((geometry) => {
                this.drawGeometry(geometry, {});
            });
        } else {
            this.drawGeometry(geoJSON, {});
        }
    }

    dispose() {
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        this.ctx = null;
    }
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
}

type GeometryAttributes<B extends Geometry> = B extends LineString
    ? LineStringAttributes
    : B extends Point
    ? PointAttributes
    : B extends Polygon
    ? PolygonAttributes
    : never;

// latLonToWorldPixel(
//     lat: number,
//     lon: number,
//     zoom: number = this.viewZoom
// ): [number, number] {
//     const size = this.tileSize * 2 ** zoom;
//     const x = ((lon + 180) / 360) * size;
//     const sinLat = Math.sin((lat * Math.PI) / 180);
//     const y =
//         (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
//         size;
//     return [x, y];
// }

/** * @link https://datatracker.ietf.org/doc/html/rfc7946#section-1.4 */
// type GeometryType =
//     | 'Point'
//     | 'MultiPoint'
//     | 'LineString'
//     | 'MultiLineString'
//     | 'Polygon'
//     | 'MultiPolygon'
//     | 'GeometryCollection';

/** * @link https://datatracker.ietf.org/doc/html/rfc7946#section-1.4 */
// type GeoJSONType = 'FeatureCollection' | 'Feature' | GeometryType;

/** * @link https://datatracker.ietf.org/doc/html/rfc7946#section-5 */
// type BoundingBox = number[];

// type LineStringPosition = PointPosition[];
// type PolygonPosition = LineStringPosition[];

// type GeometryObject<T extends GeometryType> = {
//     type: T;
//     coordinates: T extends 'Point'
//         ? PointPosition
//         : T extends 'LineString' | 'MultiPoint'
//         ? LineStringPosition
//         : T extends 'Polygon' | 'MultiLineString'
//         ? PolygonPosition
//         : T extends 'MultiPolygon'
//         ? PolygonPosition[]
//         : never;
// };

// interface Feature {
//     type: 'Feature';
//     geometry: GeometryObject<GeometryType>;
//     bBox?: BoundingBox;
//     properties: Record<string, any>;
// }

// /** * @link https://datatracker.ietf.org/doc/html/rfc7946#section-3 */
// type GeoJSONObject<T extends GeoJSONType> = T extends 'FeatureCollection'
//     ? {
//           type: 'FeatureCollection';
//           features: Feature[];
//       }
//     : T extends 'Feature'
//     ? Feature
//     : GeometryObject<Exclude<T, 'FeatureCollection' | 'Feature'>>;
