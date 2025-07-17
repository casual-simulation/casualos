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
import type { BBox, Position } from 'geojson';

/**
 * Shared utilities for GeoJSON processing in MapView/MapTile
 */
export class GeoJSONUtils {
    /**
     * Calculate the Mercator scale factor for a given latitude
     * This is used to correct for map distortion at different latitudes
     */
    static getMercatorScaleFactor(latitude: number): number {
        return Math.cos((latitude * Math.PI) / 180);
    }

    /**
     * Convert longitude/latitude to Web Mercator tile coordinates
     */
    static lonLatToTileCoords(
        lon: number,
        lat: number,
        zoom: number
    ): { x: number; y: number } {
        const n = Math.pow(2, zoom);
        const x = ((lon + 180) / 360) * n;
        const y =
            ((1 -
                Math.log(
                    Math.tan((lat * Math.PI) / 180) +
                        1 / Math.cos((lat * Math.PI) / 180)
                ) /
                    Math.PI) /
                2) *
            n;
        return { x, y };
    }

    /**
     * Convert tile coordinates back to longitude/latitude
     */
    static tileCoordsToLonLat(
        x: number,
        y: number,
        zoom: number
    ): { lon: number; lat: number } {
        const n = Math.pow(2, zoom);
        const lon = (x / n) * 360 - 180;
        const lat =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
        return { lon, lat };
    }

    /**
     * Calculate the pixel size in meters at a given zoom and latitude
     */
    static getMetersPerPixel(zoom: number, latitude: number): number {
        const earthCircumference = 40075016.686; // meters
        const tileSize = 256; // pixels
        const metersPerTile =
            (earthCircumference * Math.cos((latitude * Math.PI) / 180)) /
            Math.pow(2, zoom);
        return metersPerTile / tileSize;
    }

    /**
     * Simplify a LineString or Polygon for rendering at lower zoom levels
     * This helps with performance by reducing the number of points
     */
    static simplifyCoordinates(
        coordinates: Position[],
        tolerance: number = 0.0001
    ): Position[] {
        if (coordinates.length <= 2) {
            return coordinates;
        }

        const simplified: Position[] = [coordinates[0]];
        let lastIndex = 0;

        for (let i = 1; i < coordinates.length - 1; i++) {
            const current = coordinates[i];
            const last = coordinates[lastIndex];
            const distance = Math.sqrt(
                Math.pow(current[0] - last[0], 2) +
                    Math.pow(current[1] - last[1], 2)
            );

            if (distance > tolerance) {
                simplified.push(current);
                lastIndex = i;
            }
        }

        simplified.push(coordinates[coordinates.length - 1]);
        return simplified;
    }

    /**
     * Calculate appropriate simplification tolerance based on zoom level
     */
    static getSimplificationTolerance(zoom: number): number {
        // Higher zoom = more detail, lower tolerance
        // Lower zoom = less detail, higher tolerance
        const baseTolerance = 0.01;
        return baseTolerance / Math.pow(2, zoom - 1);
    }

    /**
     * Check if a bounding box is visible at the current zoom level
     * Some features might be too small to see at low zoom levels
     */
    static isFeatureVisibleAtZoom(
        bbox: BBox,
        zoom: number,
        minPixelSize: number = 1
    ): boolean {
        const [west, south, east, north] = bbox;

        const topLeft = GeoJSONUtils.lonLatToTileCoords(west, north, zoom);
        const bottomRight = GeoJSONUtils.lonLatToTileCoords(east, south, zoom);

        const widthInPixels = Math.abs(bottomRight.x - topLeft.x) * 256;
        const heightInPixels = Math.abs(bottomRight.y - topLeft.y) * 256;

        return widthInPixels >= minPixelSize || heightInPixels >= minPixelSize;
    }

    /**
     * Generate a unique color for a feature based on its properties
     * Useful for automatic styling when no color is specified
     */
    static generateFeatureColor(feature: any): string {
        let hash = 0;
        const str = JSON.stringify(feature.properties || feature.id || feature);

        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash = hash & hash;
        }

        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 50%)`;
    }

    /**
     * Calculate the centroid of a polygon or line
     * Useful for label placement
     */
    static calculateCentroid(coordinates: Position[][]): Position {
        let totalX = 0;
        let totalY = 0;
        let count = 0;

        const ring = coordinates[0];

        for (const coord of ring) {
            totalX += coord[0];
            totalY += coord[1];
            count++;
        }

        return [totalX / count, totalY / count];
    }

    /**
     * Determine optimal rendering method based on feature type and zoom
     */
    static getRenderingHints(
        geometryType: string,
        zoom: number
    ): {
        useSimplification: boolean;
        simplificationTolerance: number;
        minPixelSize: number;
        useLabels: boolean;
    } {
        const hints = {
            useSimplification: false,
            simplificationTolerance: 0,
            minPixelSize: 1,
            useLabels: false,
        };

        if (
            (geometryType === 'LineString' ||
                geometryType === 'MultiLineString' ||
                geometryType === 'Polygon' ||
                geometryType === 'MultiPolygon') &&
            zoom < 10
        ) {
            hints.useSimplification = true;
            hints.simplificationTolerance =
                GeoJSONUtils.getSimplificationTolerance(zoom);
        }

        if (geometryType === 'Point' || geometryType === 'MultiPoint') {
            hints.minPixelSize = zoom < 5 ? 3 : 1;
        }

        hints.useLabels = zoom >= 12;

        return hints;
    }

    /**
     * Calculate tile coverage for a bounding box
     * Returns the tile coordinates that need to be checked for a feature
     */
    static getTileCoverage(
        bbox: BBox,
        zoom: number
    ): Array<{ x: number; y: number }> {
        const [west, south, east, north] = bbox;

        const topLeft = GeoJSONUtils.lonLatToTileCoords(west, north, zoom);
        const bottomRight = GeoJSONUtils.lonLatToTileCoords(east, south, zoom);

        const tiles: Array<{ x: number; y: number }> = [];

        const minX = Math.floor(topLeft.x);
        const maxX = Math.floor(bottomRight.x);
        const minY = Math.floor(topLeft.y);
        const maxY = Math.floor(bottomRight.y);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                tiles.push({ x, y });
            }
        }

        return tiles;
    }
}
