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
import { MapView } from './MapView';
import { Vector2, Vector3 } from '@casual-simulation/three';

/**
 * Utility class for safely accessing MapView properties and performing coordinate transformations
 */
export class MapViewUtils {
    /**
     * Safely get the zoom level from a MapView
     */
    static getZoom(mapView: MapView): number {
        try {
            const mapViewAny = mapView as any;
            return mapViewAny._zoom || 1;
        } catch {
            return 1;
        }
    }

    /**
     * Safely get the center tile coordinates from a MapView
     */
    static getCenterTile(mapView: MapView): { x: number; y: number } {
        try {
            const mapViewAny = mapView as any;
            return {
                x: mapViewAny._x || 0,
                y: mapViewAny._y || 0,
            };
        } catch {
            return { x: 0, y: 0 };
        }
    }

    /**
     * Safely get the tile size from a MapView
     */
    static getTileSize(mapView: MapView): number {
        try {
            const mapViewAny = mapView as any;
            return mapViewAny._tileSize || 1;
        } catch {
            return 1;
        }
    }

    /**
     * Safely get the center coordinates from a MapView
     */
    static getCenterCoordinates(mapView: MapView): {
        longitude: number;
        latitude: number;
    } {
        try {
            const mapViewAny = mapView as any;
            return {
                longitude: mapViewAny._longitude || 0,
                latitude: mapViewAny._latitude || 0,
            };
        } catch {
            return { longitude: 0, latitude: 0 };
        }
    }

    /**
     * Convert geographic coordinates to world position relative to the MapView
     */
    static geoToWorld(
        mapView: MapView,
        longitude: number,
        latitude: number,
        altitude: number = 0
    ): Vector3 {
        const zoom = MapViewUtils.getZoom(mapView);
        const centerTile = MapViewUtils.getCenterTile(mapView);
        const tileSize = MapViewUtils.getTileSize(mapView);

        // Use MapView's static coordinate transformation utilities
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

        // Convert to world coordinates relative to map center
        const worldX = (tileX - centerTile.x + percentageX) * tileSize;
        const worldZ = (tileY - centerTile.y + percentageY) * tileSize;
        const worldY = altitude; // Keep altitude as Y coordinate

        return new Vector3(worldX, worldY, worldZ);
    }

    /**
     * Convert world position to geographic coordinates
     */
    static worldToGeo(
        mapView: MapView,
        worldPosition: Vector3
    ): { longitude: number; latitude: number; altitude: number } {
        const zoom = MapViewUtils.getZoom(mapView);
        const centerTile = MapViewUtils.getCenterTile(mapView);
        const tileSize = MapViewUtils.getTileSize(mapView);

        const tileX = worldPosition.x / tileSize + centerTile.x;
        const tileY = worldPosition.z / tileSize + centerTile.y;

        const [longitude, latitude] = MapView.tileToLonLat(zoom, tileX, tileY);

        return {
            longitude,
            latitude,
            altitude: worldPosition.y,
        };
    }

    /**
     * Project geographic coordinates to tile coordinates
     */
    static projectCoordinate(
        mapView: MapView,
        longitude: number,
        latitude: number
    ): Vector2 {
        const zoom = MapViewUtils.getZoom(mapView);
        const [pixelX, pixelY] = MapView.calculatePixel(
            zoom,
            longitude,
            latitude
        );
        const [tileX, tileY] = MapView.calculateTileFromPixel(pixelX, pixelY);
        return new Vector2(tileX, tileY);
    }

    /**
     * Unproject tile coordinates to geographic coordinates
     */
    static unprojectCoordinate(
        mapView: MapView,
        tileX: number,
        tileY: number
    ): { longitude: number; latitude: number } {
        const zoom = MapViewUtils.getZoom(mapView);
        const [longitude, latitude] = MapView.tileToLonLat(zoom, tileX, tileY);
        return { longitude, latitude };
    }

    /**
     * Get the current viewport bounds in geographic coordinates
     */
    static getViewportBounds(mapView: MapView): {
        west: number;
        south: number;
        east: number;
        north: number;
    } {
        const zoom = MapViewUtils.getZoom(mapView);
        const centerTile = MapViewUtils.getCenterTile(mapView);
        const tileSize = MapViewUtils.getTileSize(mapView);

        const mapViewAny = mapView as any;
        const gridSize = mapViewAny._gridSize || 3;
        const halfGrid = Math.floor(gridSize / 2);

        const minTileX = centerTile.x - halfGrid;
        const maxTileX = centerTile.x + halfGrid;
        const minTileY = centerTile.y - halfGrid;
        const maxTileY = centerTile.y + halfGrid;

        const [west, north] = MapView.tileToLonLat(zoom, minTileX, minTileY);
        const [east, south] = MapView.tileToLonLat(zoom, maxTileX, maxTileY);

        return { west, south, east, north };
    }

    /**
     * Check if a geographic coordinate is within the current viewport
     */
    static isCoordinateInViewport(
        mapView: MapView,
        longitude: number,
        latitude: number
    ): boolean {
        const bounds = MapViewUtils.getViewportBounds(mapView);

        return (
            longitude >= bounds.west &&
            longitude <= bounds.east &&
            latitude >= bounds.south &&
            latitude <= bounds.north
        );
    }

    /**
     * Calculate the distance in world units between two geographic coordinates
     */
    static calculateWorldDistance(
        mapView: MapView,
        lon1: number,
        lat1: number,
        lon2: number,
        lat2: number
    ): number {
        const pos1 = MapViewUtils.geoToWorld(mapView, lon1, lat1);
        const pos2 = MapViewUtils.geoToWorld(mapView, lon2, lat2);
        return pos1.distanceTo(pos2);
    }

    /**
     * Get all MapView properties as a snapshot object
     */
    static getMapViewSnapshot(mapView: MapView): {
        zoom: number;
        centerTile: { x: number; y: number };
        tileSize: number;
        centerCoordinates: { longitude: number; latitude: number };
        viewportBounds: {
            west: number;
            south: number;
            east: number;
            north: number;
        };
    } {
        return {
            zoom: MapViewUtils.getZoom(mapView),
            centerTile: MapViewUtils.getCenterTile(mapView),
            tileSize: MapViewUtils.getTileSize(mapView),
            centerCoordinates: MapViewUtils.getCenterCoordinates(mapView),
            viewportBounds: MapViewUtils.getViewportBounds(mapView),
        };
    }
}
