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
import type { Matrix4 } from '@casual-simulation/three';
import { Vector3, MathUtils as ThreeMath } from '@casual-simulation/three';

/**
 * Defines the possible coordinate systems.
 */
export enum CoordinateSystem {
    /**
     * Specifies that the coordinate system uses Z for the up axis.
     * This is what AUX uses.
     */
    Z_UP,

    /**
     * Specifies that the coordinate system uses Y for the up axis.
     * This is what the Three.js scenes use by default.
     */
    Y_UP,
}

export interface CoordinateTransformer {
    (pos: { x: number; y: number; z: number }): Matrix4;
}

/**
 * Converts the given latitude and longitude point to a cartesian point.
 * @param radius The radius of the earth.
 * @param point The 3D point representing latitude (X), longitude (Y), and altitude (Z).
 */
export function latLonToCartesian(radius: number, point: Vector3): Vector3 {
    const lat = ThreeMath.degToRad(point.x);
    const lon = ThreeMath.degToRad(point.y);
    const altitude = point.z;
    const heightfactor = radius + altitude;
    const x = heightfactor * Math.cos(lat) * Math.cos(lon);
    const y = heightfactor * Math.cos(lat) * Math.sin(lon);
    const z = heightfactor * Math.sin(lat);
    return new Vector3(x, y, z);
}

/**
 * Converts the given cartesian point to a latitude and longitude point.
 * @param radius The radius of the earth.
 * @param point The 3D point representing the cartesian coordinate.
 */
export function cartesianToLatLon(radius: number, point: Vector3): Vector3 {
    const normalized = point.clone().normalize().multiplyScalar(radius);
    const lon = Math.atan2(normalized.y, normalized.x);
    const lat = Math.asin(normalized.z / radius);
    const distanceFromRadius = point.distanceTo(normalized);
    return new Vector3(
        ThreeMath.radToDeg(lat),
        ThreeMath.radToDeg(lon),
        distanceFromRadius
    );
}
