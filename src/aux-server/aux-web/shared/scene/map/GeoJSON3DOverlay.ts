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
    Group,
    BufferGeometry,
    LineBasicMaterial,
    Line,
    SphereGeometry,
    MeshBasicMaterial,
    Mesh,
    DoubleSide,
    Shape,
    ExtrudeGeometry,
    ShapeGeometry,
} from '@casual-simulation/three';
import type { Box2, Box3, Vector3 } from '@casual-simulation/three';
import type { AllGeoJSON } from '@turf/turf';
import { MapOverlay } from './MapOverlay';
import { GeoJSONRenderer, type GeoJSONStyle } from './GeoJSONRenderer';

export class GeoJSON3DOverlay extends MapOverlay {
    private _geojson: AllGeoJSON;
    private _style: GeoJSONStyle;
    private _defaultStyle: GeoJSONStyle = {
        pointColor: 0xff0000,
        pointSize: 0.01,
        lineColor: 0x0000ff,
        lineWidth: 2,
        lineOpacity: 1.0,
        polygonColor: 0x00ff00,
        polygonOpacity: 0.7,
        strokeColor: 0x000000,
        strokeWidth: 1,
        extrudeHeight: 0,
        altitudeScale: 0.00001,
    };
    private _geometryGroup: Group;

    constructor(
        dimensions: Box2 | Box3,
        longitude: number,
        latitude: number,
        zoom: number,
        geojson: AllGeoJSON,
        style?: GeoJSONStyle
    ) {
        super(dimensions, 256, longitude, latitude, zoom);

        this._geojson = geojson;
        this._style = { ...this._defaultStyle, ...style };
        this._geometryGroup = new Group();
        this._geometryGroup.position.y = 0.001;
        this.add(this._geometryGroup);

        // Remove the plane mesh since we're using 3D geometries
        if (this._plane) {
            this.remove(this._plane);
            this._plane.geometry.dispose();
            if (Array.isArray(this._plane.material)) {
                this._plane.material.forEach((m) => m.dispose());
            } else {
                this._plane.material.dispose();
            }
            this._plane = null;
        }
    }

    /**
     * Convert geographic coordinates to 3D world coordinates
     */
    private _geoTo3D(lon: number, lat: number, alt: number = 0): Vector3 {
        return GeoJSONRenderer.geoTo3D(
            lon,
            lat,
            alt,
            this._longitude,
            this._latitude,
            this._zoom,
            this._tileSize,
            this._style.altitudeScale || this._defaultStyle.altitudeScale
        );
    }

    /**
     * Create a 3D point mesh
     */
    private _createPoint(coordinates: number[], properties?: any): Mesh {
        const [lon, lat, alt = 0] = coordinates;
        const position = this._geoTo3D(lon, lat, alt);

        const geometry = new SphereGeometry(
            this._style.pointSize || this._defaultStyle.pointSize,
            16,
            16
        );

        const material = new MeshBasicMaterial({
            color:
                properties?.pointColor ||
                this._style.pointColor ||
                this._defaultStyle.pointColor,
            opacity: properties?.pointOpacity || 1.0,
            transparent: properties?.pointOpacity < 1.0,
        });

        const mesh = new Mesh(geometry, material);
        mesh.position.copy(position);

        return mesh;
    }

    /**
     * Create a 3D line
     */
    private _createLineString(coordinates: number[][], properties?: any): Line {
        const points: Vector3[] = [];

        for (const coord of coordinates) {
            const [lon, lat, alt = 0] = coord;
            points.push(this._geoTo3D(lon, lat, alt));
        }

        const geometry = new BufferGeometry().setFromPoints(points);

        const material = new LineBasicMaterial({
            color:
                properties?.lineColor ||
                properties?.style?.color ||
                this._style.lineColor ||
                this._defaultStyle.lineColor,
            opacity:
                properties?.lineOpacity ||
                this._style.lineOpacity ||
                this._defaultStyle.lineOpacity,
            transparent:
                (properties?.lineOpacity ||
                    this._style.lineOpacity ||
                    this._defaultStyle.lineOpacity) < 1.0,
            linewidth:
                properties?.lineWidth ||
                this._style.lineWidth ||
                this._defaultStyle.lineWidth,
        });

        const line = new Line(geometry, material);
        return line;
    }

    /**
     * Create a 3D polygon
     */
    private _createPolygon(
        coordinates: number[][][],
        properties?: any
    ): Mesh | Group {
        const group = new Group();

        // Process exterior ring (first ring)
        const exteriorRing = coordinates[0];
        const shape = new Shape();

        // Convert to 2D shape points (we'll handle height separately)
        let firstPoint: Vector3 | null = null;
        let avgAltitude = 0;
        let altitudeCount = 0;

        for (let i = 0; i < exteriorRing.length; i++) {
            const [lon, lat, alt = 0] = exteriorRing[i];
            const point3D = this._geoTo3D(lon, lat, 0); // Use 0 altitude for shape

            if (i === 0) {
                shape.moveTo(point3D.x, point3D.z);
                firstPoint = point3D;
            } else {
                shape.lineTo(point3D.x, point3D.z);
            }

            if (alt !== 0) {
                avgAltitude += alt;
                altitudeCount++;
            }
        }

        // Calculate average altitude for the polygon
        const baseAltitude =
            altitudeCount > 0 ? avgAltitude / altitudeCount : 0;
        const worldAltitude =
            baseAltitude *
            (this._style.altitudeScale || this._defaultStyle.altitudeScale);

        // Handle holes (interior rings)
        for (let i = 1; i < coordinates.length; i++) {
            const hole = new Shape();
            const holeRing = coordinates[i];

            for (let j = 0; j < holeRing.length; j++) {
                const [lon, lat] = holeRing[j];
                const point3D = this._geoTo3D(lon, lat, 0);

                if (j === 0) {
                    hole.moveTo(point3D.x, point3D.z);
                } else {
                    hole.lineTo(point3D.x, point3D.z);
                }
            }

            shape.holes.push(hole);
        }

        // Create geometry - either extruded or flat
        const extrudeHeight =
            properties?.extrudeHeight ||
            properties?.style?.extrudeHeight ||
            this._style.extrudeHeight ||
            0;
        const worldExtrudeHeight =
            extrudeHeight *
            (this._style.altitudeScale || this._defaultStyle.altitudeScale);

        let geometry: BufferGeometry;
        if (worldExtrudeHeight > 0) {
            geometry = new ExtrudeGeometry(shape, {
                depth: worldExtrudeHeight,
                bevelEnabled: false,
            });
            // Rotate extruded geometry to stand up
            geometry.rotateX(-Math.PI / 2);
        } else {
            geometry = new ShapeGeometry(shape);
            // Rotate flat geometry to lie on XZ plane
            geometry.rotateX(-Math.PI / 2);
        }

        const material = new MeshBasicMaterial({
            color:
                properties?.fillColor ||
                properties?.style?.fillColor ||
                this._style.polygonColor ||
                this._defaultStyle.polygonColor,
            opacity:
                properties?.fillOpacity ||
                properties?.style?.fillOpacity ||
                this._style.polygonOpacity ||
                this._defaultStyle.polygonOpacity,
            transparent: true,
            side: DoubleSide,
        });

        const mesh = new Mesh(geometry, material);
        mesh.position.y = worldAltitude;
        group.add(mesh);

        // Add stroke if needed
        if (this._style.strokeWidth && this._style.strokeWidth > 0) {
            const strokeLine = this._createLineString(exteriorRing, {
                lineColor: this._style.strokeColor,
                lineWidth: this._style.strokeWidth,
            });
            strokeLine.position.y = worldAltitude + 0.0001; // Slightly above polygon
            group.add(strokeLine);
        }

        return group;
    }

    /**
     * Render the GeoJSON as 3D objects
     */
    render(): void {
        // Clear existing geometries
        this._geometryGroup.clear();
        this._geometryGroup.traverse((child) => {
            if (child instanceof Mesh || child instanceof Line) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach((m) => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        // Process GeoJSON using the utility
        if (!this._geojson) return;

        try {
            GeoJSONRenderer.processGeoJSON(this._geojson, {
                onPoint: (coords, props) => {
                    const point = this._createPoint(coords, props);
                    if (point) this._geometryGroup.add(point);
                },
                onLineString: (coords, props) => {
                    const line = this._createLineString(coords, props);
                    if (line) this._geometryGroup.add(line);
                },
                onPolygon: (coords, props) => {
                    const polygon = this._createPolygon(coords, props);
                    if (polygon) this._geometryGroup.add(polygon);
                },
            });
        } catch (error) {
            console.error('[GeoJSON3DOverlay] Error rendering GeoJSON:', error);
        }
    }

    /**
     * Update the center position
     */
    updateCenter(zoom: number, longitude: number, latitude: number): void {
        if (
            this._zoom === zoom &&
            this._longitude === longitude &&
            this._latitude === latitude
        ) {
            return;
        }

        this._zoom = zoom;
        this._longitude = longitude;
        this._latitude = latitude;

        this.render();
    }

    /**
     * Update the GeoJSON data
     */
    setGeoJSON(geojson: AllGeoJSON): void {
        this._geojson = geojson;
        this.render();
    }

    /**
     * Update the style
     */
    setStyle(style: GeoJSONStyle): void {
        this._style = { ...this._style, ...style };
        this.render();
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this._geometryGroup.traverse((child) => {
            if (child instanceof Mesh || child instanceof Line) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach((m) => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        this._geometryGroup.clear();
        this.remove(this._geometryGroup);
        this.removeFromParent();
    }
}
