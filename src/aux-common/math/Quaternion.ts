/**
 * Defines a class that represents a Quaternion. That is, a representation of a 3D rotation.
 *
 * Quaternions are a mathematical representation of 3D transformations and are commonly used to calculate and apply rotations to 3D points.
 * They work by defining a quaterion such that q = w + x*i + y*j + z*k, where w, x, y, and z are real numbers and i, j, and k are imaginary numbers.
 * The basics of this is that x, y, and z define a vector that represents the rotation axis, and w defines an angle around which the rotation occurs.
 * However, because i, j, and k are included we can keep x, y, and z from incorrectly interacting with each other and so avoid common pitfalls like Gimbal lock.
 *
 * One little known feature of quaternions is that they can also represent reflections and also scale.
 * This is because there are two different ways to apply a quaternion to a 3D point:
 *
 * - quaterion * point * inverse(quaterion)
 *
 * This formula rotates and scales the point quaternion. The rotation occurs around the axis specified by the quaternion X, Y, and Z values.
 * Additionally, the point will be scaled by the length of the quaternion. (i.e. sqrt( x^2 + y^2 + z^2 + w^2 ))
 * This is why quaternions that are used to represent only rotations must be normalized.
 *
 * - quaternion * point * quaternion
 *
 * This formula reflects scales the point by the quaternion. The reflection occurs across the axis specified by the quaternion X, Y, and Z values.
 * Additionally, the point will be scaled by the length of the quaternion. (i.e. sqrt( x^2 + y^2 + z^2 + w^2 ))
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
