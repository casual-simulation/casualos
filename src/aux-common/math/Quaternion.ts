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

export class Quaternion {
    /**
     * The X value of the quaternion.
     */
    x: number;

    /**
     * The Y value of the quaternion.
     */
    y: number;

    /**
     * The Z value of the quaternion.
     */
    z: number;

    /**
     * The W value of the quaternion.
     */
    w: number;

    /**
     * Creates a new Quaternion with the given values.
     * @param x The X value.
     * @param y The Y value.
     * @param z The Z value.
     * @param w The W value.
     */
    constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        Object.freeze(this);
    }

    /**
     * Multiplies this quaternion by the other quaternion and returns the result.
     * In quaternion math, multiplication can be used to combine quaternions together,
     * however unlike regular multiplication quaternion multiplication is order dependent.
     *
     * Which frame of reference you want to use depends on which order you use.
     * For example, q2.multiply(q1) starts with the identity, applies q1 to it, and then applies q2 to that.
     * Whereas, q1.multiply(q2) starts with the identity, applies q2 to it, and then applies q1 to that.
     *
     * @param other The other quaternion.
     */
    multiply(other: Quaternion): Quaternion {
        // Taken from https://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/arithmetic/index.htm
        const x =
            this.x * other.w +
            this.w * other.x +
            this.y * other.z -
            this.z * other.y;
        const y =
            this.w * other.y -
            this.x * other.z +
            this.y * other.w +
            this.z * other.x;
        const z =
            this.w * other.z +
            this.x * other.y -
            this.y * other.x +
            this.z * other.w;
        const w =
            this.w * other.w -
            this.x * other.x -
            this.y * other.y -
            this.z * other.z;
        return new Quaternion(x, y, z, w);
    }

    /**
     * Calculates the conjugate of this quaternion and returns the result.
     * The conjugate (or inverse) of a quaternion is similar to negating a number.
     * When you multiply a quaternion by its conjugate, the result is the identity quaternion.
     */
    invert(): Quaternion {
        return new Quaternion(-this.x, -this.y, -this.z, this.w);
    }

    /**
     * Gets the length of this vector. That is, the pathagorean theorem applied to X, Y, Z, and W.
     */
    length(): number {
        return Math.sqrt(
            this.x * this.x +
                this.y * this.y +
                this.z * this.z +
                this.w * this.w
        );
    }

    /**
     * Calculates the square length of this quaternion and returns the result.
     * This is equivalent to length^2, but it is faster to calculate than length because it doesn't require
     * calculating a square root.
     */
    squareLength(): number {
        return (
            this.x * this.x +
            this.y * this.y +
            this.z * this.z +
            this.w * this.w
        );
    }

    /**
     * Calculates the normalized version of this quaternion and returns it.
     * A normalized quaternion is a quaternion whose length equals 1.
     *
     * Normalizing a quaternion preserves its rotation/reflection while making the length (i.e. scale) of it 1.
     */
    normalize(): Quaternion {
        const length = this.length();
        return new Quaternion(
            this.x / length,
            this.y / length,
            this.z / length,
            this.w / length
        );
    }

    toString(): string {
        return `Quaternion(${this.x}, ${this.y}, ${this.z}, ${this.w})`;
    }

    /**
     * Determines if this quaternion equals the other quaternion.
     * @param other The other quaternion to apply.
     */
    equals(other: Quaternion): boolean {
        if (!other) {
            return false;
        }

        return (
            this.x === other.x &&
            this.y === other.y &&
            this.z === other.z &&
            this.w === other.w
        );
    }
}

/**
 * The identity quaternion.
 */
export const IDENTITY = new Quaternion(0, 0, 0, 1);
