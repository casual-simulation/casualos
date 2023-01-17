import {
    Vector3,
    MathUtils as ThreeMath,
    Matrix4,
} from '@casual-simulation/three';

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
