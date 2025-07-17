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
import type { Feature, FeatureCollection, Geometry } from 'geojson';

/**
 * GeoJSON coordinate array
 */
export interface GeoJSONCoordinate extends Array<number> {
    0: number; // lon
    1: number; // lat
    2?: number; // alt
}

/**
 * GeoJSON feature with typed geometry
 */
export interface GeoJSONFeature {
    type: 'Feature';
    geometry: any;
    properties?: Record<string, any>;
    id?: string | number;
}

/**
 * Styling options for GeoJSON features
 */
export interface GeoJSONStyle {
    // Point styling
    pointColor?: string;
    pointSize?: number;

    // Line styling
    lineColor?: string;
    lineWidth?: number;
    lineOpacity?: number;

    // Polygon styling
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeWidth?: number;

    // 3D extrusion
    extrudeHeight?: number;
}

/**
 * Union type for all valid GeoJSON data inputs
 */
export type GeoJSONData = Feature | FeatureCollection | Geometry;

/**
 * Options for GeoJSON rendering
 */
export interface GeoJSONRenderOptions {
    /**
     * Default style to apply to features
     */
    defaultStyle?: GeoJSONStyle;

    /**
     * Whether to simplify geometries at low zoom levels
     */
    enableSimplification?: boolean;

    /**
     * Minimum zoom level to show features
     */
    minZoom?: number;

    /**
     * Maximum zoom level to show features
     */
    maxZoom?: number;

    /**
     * Whether to enable 3D extrusion for polygons
     */
    enableExtrusion?: boolean;

    /**
     * Property name to use for extrusion height
     */
    extrusionProperty?: string;
}
