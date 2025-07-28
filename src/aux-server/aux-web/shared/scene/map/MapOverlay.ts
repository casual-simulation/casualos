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

import {
    Object3D,
    MeshBasicMaterial,
    DoubleSide,
    PlaneGeometry,
    Mesh,
    CanvasTexture,
} from '@casual-simulation/three';
import type { Box2, Box3, Texture } from '@casual-simulation/three';
import type { AllGeoJSON } from '@turf/turf';
import { GeoJSONRenderer } from './GeoJSONRenderer';

// Convert to interface, This abrstaction extends as 2D.

export abstract class MapOverlay extends Object3D {
    /* The height of the overlay in world units. */
    protected _overlayHeight: number;
    /* The width of the overlay in world units. */
    protected _overlayWidth: number;
    /* The texture to use for the overlay. */
    protected _overlayTexture: Texture | null = null;
    /* The plane that represents the overlay as a mesh in the scene. */
    protected _plane: Mesh | null = null;

    protected get _material(): THREE.MeshBasicMaterial {
        return this._plane.material as THREE.MeshBasicMaterial;
    }

    constructor(
        dimensions: Box2 | Box3,
        /* The size of the tiles in texture pixels. */
        protected _tileSize: number,
        /* The longitude of the center of the overlay in degrees. */
        protected _longitude: number,
        /* The latitude of the center of the overlay in degrees. */
        protected _latitude: number,
        /* The zoom level of the overlay. */
        protected _zoom: number = 0
    ) {
        super();
        const height = (this._overlayHeight =
            dimensions.max.y - dimensions.min.y);
        const width = (this._overlayWidth =
            dimensions.max.x - dimensions.min.x);

        this._plane = new Mesh(
            new PlaneGeometry(width, height, 1, 1),
            new MeshBasicMaterial({
                transparent: true,
                side: DoubleSide,
                depthTest: true,
                depthWrite: false,
            })
        );

        // Position the plane to match the map plane orientation
        this._plane.rotation.x = -Math.PI / 2;

        // Slightly above the map to avoid z-fighting
        this._plane.position.y = 0.001;

        this.add(this._plane);
    }

    setTexture(texture: Texture) {
        this._overlayTexture = texture;
        this._material.map = texture;
        this._material.side = DoubleSide;
        this._material.needsUpdate = true;
    }

    /**
     * Updates the zoom & coordinates of the overlay.
     * @param zoom
     * @param longitude
     * @param latitude
     */
    abstract updateCenter(
        zoom: number,
        longitude: number,
        latitude: number
    ): void;

    /**
     * Renders the overlay.
     * This method should be implemented by subclasses to provide specific rendering logic.
     */
    abstract render(): void;

    /**
     * Disposes of the overlay and cleans up resources.
     * This method should be implemented by subclasses to provide specific disposal logic.
     */
    abstract dispose(): void;
}

export class GeoJSONMapOverlay extends MapOverlay {
    private _renderer: GeoJSONRenderer;
    private _canvasSize: number;

    constructor(
        dimensions: Box2 | Box3,
        canvasSize: number,
        longitude: number,
        latitude: number,
        zoom: number,
        private _geojson: AllGeoJSON
    ) {
        super(dimensions, 1, longitude, latitude, zoom);

        this._canvasSize = canvasSize;

        this._renderer = new GeoJSONRenderer(
            zoom,
            longitude,
            latitude,
            canvasSize
        );

        console.log('[GeoJSONMapOverlay] Created renderer, canvas size:', {
            width: this._renderer.canvas.width,
            height: this._renderer.canvas.height,
        });

        const texture = new CanvasTexture(this._renderer.canvas);

        this.setTexture(texture);
    }

    updateCenter(zoom: number, longitude: number, latitude: number): void {
        console.log('[GeoJSONMapOverlay] updateCenter called:', {
            oldZoom: this._zoom,
            newZoom: zoom,
            oldLon: this._longitude,
            newLon: longitude,
            oldLat: this._latitude,
            newLat: latitude,
        });

        if (
            this._zoom == zoom &&
            this._longitude === longitude &&
            this._latitude === latitude
        ) {
            console.log(
                '[GeoJSONMapOverlay] No change in position, skipping update'
            );
            return;
        }

        this._zoom = zoom;
        this._longitude = longitude;
        this._latitude = latitude;
        this._renderer.setCenter(longitude, latitude, zoom);
        this.render();
    }

    render(): void {
        this._renderer.clearCanvas();
        this._renderer.drawGeoJSON(this._geojson);
        this._material.needsUpdate = true;
        this._overlayTexture.needsUpdate = true;

        // Canvas content check for debugging
        const ctx = this._renderer.canvas.getContext('2d');
        const imageData = ctx?.getImageData(0, 0, 100, 100);
        let hasContent = false;
        if (imageData) {
            for (let i = 3; i < imageData.data.length; i += 4) {
                if (imageData.data[i] > 0) {
                    hasContent = true;
                    break;
                }
            }
        }
    }

    dispose(): void {
        this._renderer.dispose();
        if (this._plane) {
            this._plane.geometry.dispose();
            if (Array.isArray(this._plane.material))
                this._plane.material.forEach((m) => m.dispose());
            else if (this._plane.material) this._plane.material.dispose();
            this._plane.removeFromParent();
            this._plane = null;
        }
        if (this._overlayTexture) {
            this._overlayTexture.dispose();
            this._overlayTexture = null;
        }
        this.removeFromParent();
    }
}
