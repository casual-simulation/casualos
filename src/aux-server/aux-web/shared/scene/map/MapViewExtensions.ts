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
import type { Vector2 } from '@casual-simulation/three';
import type { MapView } from './MapView';
import { MapViewUtils } from './MapViewUtils';
import type { GeoJSONData, GeoJSONLayerOptions } from './GeoJSONLayer';
import { GeoJSONLayer } from './GeoJSONLayer';

/**
 * Extension methods for MapView to support GeoJSON layers
 */
export class MapViewExtensions {
    private static _extensions = new WeakMap<
        MapView,
        MapViewGeoJSONExtension
    >();

    /**
     * Get or create the GeoJSON extension for a MapView
     */
    static getExtension(mapView: MapView): MapViewGeoJSONExtension {
        let extension = this._extensions.get(mapView);
        if (!extension) {
            extension = new MapViewGeoJSONExtension(mapView);
            this._extensions.set(mapView, extension);
        }
        return extension;
    }

    /**
     * Add GeoJSON layer support to a MapView instance
     */
    static extendMapView(mapView: MapView): MapView & MapViewGeoJSONMethods {
        const extension = this.getExtension(mapView);
        const extended = mapView as any;

        // Add GeoJSON methods to the MapView instance
        extended.addGeoJSONLayer = extension.addGeoJSONLayer.bind(extension);
        extended.removeGeoJSONLayer =
            extension.removeGeoJSONLayer.bind(extension);
        extended.getGeoJSONLayer = extension.getGeoJSONLayer.bind(extension);
        extended.getGeoJSONLayers = extension.getGeoJSONLayers.bind(extension);
        extended.clearGeoJSONLayers =
            extension.clearGeoJSONLayers.bind(extension);
        extended.loadGeoJSON = extension.loadGeoJSON.bind(extension);
        extended.getZoom = extension.getZoom.bind(extension);
        extended.getCenterTileX = extension.getCenterTileX.bind(extension);
        extended.getCenterTileY = extension.getCenterTileY.bind(extension);
        extended.getTileSize = extension.getTileSize.bind(extension);
        extended.getCenterCoordinates =
            extension.getCenterCoordinates.bind(extension);
        extended.projectCoordinate =
            extension.projectCoordinate.bind(extension);
        extended.unprojectCoordinate =
            extension.unprojectCoordinate.bind(extension);
        extended.updateRendererResolution =
            extension.updateRendererResolution.bind(extension);

        return extended as MapView & MapViewGeoJSONMethods;
    }
}

/**
 * Interface for GeoJSON methods added to MapView
 */
export interface MapViewGeoJSONMethods {
    addGeoJSONLayer(id: string, options?: GeoJSONLayerOptions): GeoJSONLayer;
    removeGeoJSONLayer(id: string): boolean;
    getGeoJSONLayer(id: string): GeoJSONLayer | undefined;
    getGeoJSONLayers(): Map<string, GeoJSONLayer>;
    clearGeoJSONLayers(): void;
    loadGeoJSON(
        layerId: string,
        data: GeoJSONData | string,
        options?: GeoJSONLayerOptions
    ): Promise<GeoJSONLayer>;
    getZoom(): number;
    getCenterTileX(): number;
    getCenterTileY(): number;
    getTileSize(): number;
    getCenterCoordinates(): { longitude: number; latitude: number };
    projectCoordinate(longitude: number, latitude: number): Vector2;
    unprojectCoordinate(
        x: number,
        y: number
    ): { longitude: number; latitude: number };
    updateRendererResolution(width: number, height: number): void;
}

/**
 * Internal extension class that manages GeoJSON layers for a MapView
 */
class MapViewGeoJSONExtension {
    private _mapView: MapView;
    private _geoJSONLayers: Map<string, GeoJSONLayer> = new Map();
    private _currentZoom: number = 1;
    private _centerTileX: number = 0;
    private _centerTileY: number = 0;
    private _tileSize: number = 1;
    private _centerLongitude: number = 0;
    private _centerLatitude: number = 0;

    constructor(mapView: MapView) {
        this._mapView = mapView;
        this._extractMapViewState();
    }

    /**
     * Update renderer resolution for all GeoJSON layers
     */
    updateRendererResolution(width: number, height: number): void {
        this._geoJSONLayers.forEach((layer) => {
            layer.setRendererResolution(width, height);
        });
    }

    /**
     * Extract current state from MapView using MapViewUtils
     */
    private _extractMapViewState(): void {
        try {
            this._currentZoom = MapViewUtils.getZoom(this._mapView);
            const centerTile = MapViewUtils.getCenterTile(this._mapView);
            this._centerTileX = centerTile.x;
            this._centerTileY = centerTile.y;
            this._tileSize = MapViewUtils.getTileSize(this._mapView);
            const centerCoords = MapViewUtils.getCenterCoordinates(
                this._mapView
            );
            this._centerLongitude = centerCoords.longitude;
            this._centerLatitude = centerCoords.latitude;
        } catch (error) {
            console.warn(
                'Could not extract MapView state, using defaults:',
                error
            );
        }
    }

    /**
     * Add a new GeoJSON layer
     */
    addGeoJSONLayer(
        id: string,
        options: GeoJSONLayerOptions = {}
    ): GeoJSONLayer {
        if (this._geoJSONLayers.has(id)) {
            throw new Error(`GeoJSON layer with id '${id}' already exists`);
        }

        const layer = new GeoJSONLayer(this._mapView, options);
        layer.name = `GeoJSONLayer_${id}`;

        this._geoJSONLayers.set(id, layer);
        this._mapView.add(layer);

        return layer;
    }

    /**
     * Remove a GeoJSON layer
     */
    removeGeoJSONLayer(id: string): boolean {
        const layer = this._geoJSONLayers.get(id);
        if (!layer) {
            return false;
        }

        this._mapView.remove(layer);
        layer.dispose();
        this._geoJSONLayers.delete(id);

        return true;
    }

    /**
     * Get a GeoJSON layer by ID
     */
    getGeoJSONLayer(id: string): GeoJSONLayer | undefined {
        return this._geoJSONLayers.get(id);
    }

    /**
     * Get all GeoJSON layers
     */
    getGeoJSONLayers(): Map<string, GeoJSONLayer> {
        return new Map(this._geoJSONLayers);
    }

    /**
     * Clear all GeoJSON layers
     */
    clearGeoJSONLayers(): void {
        this._geoJSONLayers.forEach((layer, id) => {
            this._mapView.remove(layer);
            layer.dispose();
        });
        this._geoJSONLayers.clear();
    }

    /**
     * Load GeoJSON data into a layer
     */
    async loadGeoJSON(
        layerId: string,
        data: GeoJSONData | string,
        options: GeoJSONLayerOptions = {}
    ): Promise<GeoJSONLayer> {
        let parsedData: GeoJSONData;

        if (typeof data === 'string') {
            try {
                // Try to parse as JSON
                parsedData = JSON.parse(data);
            } catch (error) {
                // Assume it's a URL and fetch it
                try {
                    const response = await fetch(data);
                    if (!response.ok) {
                        throw new Error(
                            `Failed to fetch GeoJSON: ${response.statusText}`
                        );
                    }
                    parsedData = await response.json();
                } catch (fetchError) {
                    throw new Error(
                        `Failed to load GeoJSON from '${data}': ${fetchError}`
                    );
                }
            }
        } else {
            parsedData = data;
        }

        // Validate GeoJSON structure
        if (!this._isValidGeoJSON(parsedData)) {
            throw new Error('Invalid GeoJSON data structure');
        }

        // Create or get existing layer
        let layer = this._geoJSONLayers.get(layerId);
        if (!layer) {
            layer = this.addGeoJSONLayer(layerId, options);
        } else {
            layer.clear();
        }

        // Load the data
        layer.setData(parsedData);

        return layer;
    }

    /**
     * Get current zoom level
     */
    getZoom(): number {
        this._extractMapViewState();
        return this._currentZoom;
    }

    /**
     * Get center tile X coordinate
     */
    getCenterTileX(): number {
        this._extractMapViewState();
        return this._centerTileX;
    }

    /**
     * Get center tile Y coordinate
     */
    getCenterTileY(): number {
        this._extractMapViewState();
        return this._centerTileY;
    }

    /**
     * Get tile size
     */
    getTileSize(): number {
        this._extractMapViewState();
        return this._tileSize;
    }

    /**
     * Get center coordinates in longitude/latitude
     */
    getCenterCoordinates(): { longitude: number; latitude: number } {
        this._extractMapViewState();
        return {
            longitude: this._centerLongitude,
            latitude: this._centerLatitude,
        };
    }

    /**
     * Project geographic coordinates to tile coordinates
     */
    projectCoordinate(longitude: number, latitude: number): Vector2 {
        return MapViewUtils.projectCoordinate(
            this._mapView,
            longitude,
            latitude
        );
    }

    /**
     * Unproject tile coordinates to geographic coordinates
     */
    unprojectCoordinate(
        x: number,
        y: number
    ): { longitude: number; latitude: number } {
        return MapViewUtils.unprojectCoordinate(this._mapView, x, y);
    }

    /**
     * Basic GeoJSON validation
     */
    private _isValidGeoJSON(data: any): data is GeoJSONData {
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
     * Update layer positions when map view changes
     */
    updateLayerPositions(): void {
        this._extractMapViewState();
    }
}

/**
 * Helper function to quickly extend a MapView with GeoJSON capabilities
 */
export function addGeoJSONSupport(
    mapView: MapView
): MapView & MapViewGeoJSONMethods {
    return MapViewExtensions.extendMapView(mapView);
}

/**
 * Type guard to check if a MapView has been extended with GeoJSON support
 */
export function hasGeoJSONSupport(
    mapView: MapView
): mapView is MapView & MapViewGeoJSONMethods {
    return 'addGeoJSONLayer' in mapView;
}
