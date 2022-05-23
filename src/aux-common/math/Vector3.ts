import { clamp } from '../utils';
import { Vector2 } from './Vector2';

/**
 * Defines a class that represents a 3D point in space.
 */
export class Vector3 {
    /**
     * The X value of this vector.
     */
    x: number;

    /**
     * The Y value of this vector.
     */
    y: number;

    /**
     * The Z value of this vector.
     */
    z: number;

    /**
     * Gets a new Vector2 that contains this vector's X and Y components.
     */
    get xy() {
        return new Vector2(this.x, this.y);
    }

    /**
     * Gets a new Vector2 that contains this vector's X and Z components.
     */
    get xz() {
        return new Vector2(this.x, this.z);
    }

    /**
     * Gets a new Vector2 that contains this vector's Y and Z components.
     */
    get yz() {
        return new Vector2(this.y, this.z);
    }

    /**
     * Constructs a new 3D vector with the given X and Y values.
     * @param x The X value of the vector.
     * @param y The Y value of the vector.
     * @param z The Z value of the vector.
     */
    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
        Object.freeze(this);
    }

    /**
     * Creates a 3D vector with the given X and Y values that is normalized immediately upon creation.
     * @param x The X value of the vector.
     * @param y The Y value of the vector.
     * @param z The Z value of the vector.
     */
    static createNormalized(x: number, y: number, z: number) {
        const length = Math.sqrt(x * x + y * y + z * z);
        return new Vector3(x / length, y / length, z / length);
    }

    /**
     * Calculates the angle between the two given vectors and returns the result in radians.
     * @param first The first vector that should be used for comparision.
     * @param second The second vector that should be used for comparision.
     */
    static angleBetween(first: Vector3, second: Vector3): number {
        const dot = first.dot(second);
        const l1 = first.length();
        const l2 = second.length();
        const cos = dot / (l1 * l2);
        if (cos <= 1 && cos >= -1) {
            return Math.acos(cos);
        } else {
            // Sometimes the dot product ends up outside the 1 <-> -1 range and we need to clamp it.
            return Math.acos(clamp(cos, -1, 1));
        }
    }

    /**
     * Calculates the distance between the two given vectors and returns the result.
     * @param first The first vector that should be used for comparision.
     * @param second The second vector that should be used for comparision.
     */
    static distanceBetween(first: Vector3, second: Vector3): number {
        const direction = second.subtract(first);
        return direction.length();
    }

    /**
     * Constructs a new vector that is the linear interpolation between the given start and end positions.
     * The degree that the result is interpolated is determined by the given amount parameter.
     * @param start The start position.
     * @param finish The end position.
     * @param amount The amount that the resulting position should be interpolated between the start and end positions.  Values near 0 indicate rotations close to the first and values near 1 indicate rotations close to the second.
     */
    static interpolatePosition(
        start: Vector3,
        finish: Vector3,
        amount: number
    ) {
        const dir = finish.subtract(start);
        const lerp = dir.multiplyScalar(amount);
        return start.add(lerp);
    }

    /**
     * Constructs a new vector that is the directional linear interpolation between the given start and end positions.
     * The degree that the result is interpolated is determined by the given amount parameter.
     *
     * This function works similarly to interpolatePosition(), except the result is always a normalized vector.
     *
     * @param start The start position.
     * @param finish The end position.
     * @param amount The amount that the resulting position should be interpolated between the start and end positions.  Values near 0 indicate rotations close to the first and values near 1 indicate rotations close to the second.
     */
    static interpolateDirection(
        start: Vector3,
        finish: Vector3,
        amount: number
    ) {
        return Vector3.interpolatePosition(start, finish, amount).normalize();
    }

    /**
     * Adds this vector with the other vector and returns the result.
     * @param other The other vector to add with this vector.
     */
    add(other: Vector3): Vector3 {
        return new Vector3(
            this.x + other.x,
            this.y + other.y,
            this.z + other.z
        );
    }

    /**
     * Subtracts the other vector from this vector and returns the result.
     * @param other The other vector that should be subtracted from this vector.
     */
    subtract(other: Vector3): Vector3 {
        return new Vector3(
            this.x - other.x,
            this.y - other.y,
            this.z - other.z
        );
    }

    /**
     * Multiplies each component of this vector by the given value and returns the result.
     * @param scale The scale that should be applied to this vector.
     */
    multiplyScalar(scale: number): Vector3 {
        return new Vector3(this.x * scale, this.y * scale, this.z * scale);
    }

    /**
     * Multiplies this vector by the given other vector and returns the result.
     * @param other The other vector to multiply with this vector.
     */
    multiply(other: Vector3): Vector3 {
        return new Vector3(
            this.x * other.x,
            this.y * other.y,
            this.z * other.z
        );
    }

    /**
     * Calculates the dot product of this vector compared to the given other vector.
     * Returns a number that is positive if the vectors point in the same direction,
     * negative if they point in opposite directions, and zero if they are perpendicular.
     * For normalized vectors, this value is clamped to 1 and -1.
     * @param other The other vector to calculate the dot product with.
     */
    dot(other: Vector3): number {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    /**
     * Calculates the cross product of this vector with the given other vector.
     * Returns a new vector that is perpendicular to both vectors.
     * Note that the order of the vectors greatly matters. For example, (1, 0, 0).cross(0, 1, 0) === (0, 0, 1) but (0, 1, 0).cross(1, 0, 0) === (0, 0, -1).
     * @param other The other vector to calculate the cross product with.
     */
    cross(other: Vector3): Vector3 {
        return new Vector3(
            this.y * other.z - other.y * this.z,
            this.z * other.x - other.z * this.x,
            this.x * other.y - other.x * this.y
        );
    }

    /**
     * Calculates the length of this vector and returns the result.
     */
    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * Calculates the square length of this vector and returns the result.
     * This is equivalent to length^2, but it is faster to calculate than length because it doesn't require
     * calculating a square root.
     */
    squareLength(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    /**
     * Calculates the normalized version of this vector and returns it.
     * A normalized vector is a vector whose length equals 1.
     */
    normalize(): Vector3 {
        const length = this.length();
        if (length === 1) {
            return this;
        }
        return new Vector3(this.x / length, this.y / length, this.z / length);
    }

    /**
     * Negates each component of this vector and returns a new vector that contains the result.
     */
    negate(): Vector3 {
        return new Vector3(-this.x, -this.y, -this.z);
    }

    toString(): string {
        return `Vector3(${this.x}, ${this.y}, ${this.z})`;
    }

    /**
     * Determines if this vector equals the other vector.
     * @param other The other value to compare to.
     */
    equals(other: Vector3): boolean {
        return this.x === other.x && this.y === other.y && this.z === other.z;
    }
}

/**
 * A 3D vector that contains (0, 0, 0).
 */
export const ZERO = new Vector3();

/**
 * A 3D vector that contains (1, 1, 1).
 */
export const ONE = new Vector3(1, 1, 1);

/**
 * A 3D vector that contains (0, 1, 0).
 */
export const FORWARD = new Vector3(0, 1, 0);

/**
 * A 3D vector that contains (0, -1, 0).
 */
export const BACK = new Vector3(0, -1, 0);

/**
 * A 3D vector that contains (1, 0, 0).
 */
export const RIGHT = new Vector3(1, 0, 0);

/**
 * A 3D vector that contains (-1, 0, 0).
 */
export const LEFT = new Vector3(-1, 0, 0);

/**
 * A 3D vector that contains (0, 0, 1).
 */
export const UP = new Vector3(0, 0, 1);

/**
 * A 3D vector that contains (0, 0, -1).
 */
export const DOWN = new Vector3(0, 0, -1);
