/**
 * Defines a class that represents a 2D point in space.
 */
export class Vector2 {
    /**
     * The X value of this vector.
     */
    x: number;

    /**
     * The Y value of this vector.
     */
    y: number;

    /**
     * Constructs a new 2D vector with the given X and Y values.
     * @param x The X value of the vector.
     * @param y The Y value of the vector.
     */
    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    /**
     * Creates a 2D vector with the given X and Y values that is normalized immediately upon creation.
     * @param x The X value of the vector.
     * @param y The Y value of the vector.
     */
    static createNormalized(x: number, y: number) {
        const length = Math.sqrt(x * x + y * y);
        return new Vector2(x / length, y / length);
    }

    /**
     * Calculates the angle between the two given vectors and returns the result in radians.
     * @param first The first vector.
     * @param second The second vector.
     */
    static angleBetween(first: Vector2, second: Vector2): number {
        const dot = first.dot(second);
        const l1 = first.length();
        const l2 = second.length();
        return Math.acos(dot / (l1 * l2));
    }

    /**
     * Calculates the distance between the two given vectors and returns the result.
     * @param first The first vector.
     * @param second The second vector.
     */
    static distanceBetween(first: Vector2, second: Vector2): number {
        const direction = second.subtract(first);
        return direction.length();
    }

    /**
     * Adds this vector with the other vector and returns the result.
     * @param other The other vector to add with this vector.
     */
    add(other: Vector2): Vector2 {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    /**
     * Subtracts the other vector from this vector and returns the result.
     * @param other The other vector that should be subtracted from this vector.
     */
    subtract(other: Vector2): Vector2 {
        return new Vector2(this.x - other.x, this.y - other.y);
    }

    /**
     * Multiplies each component of this vector by the given value and returns the result.
     * @param scale The scale that should be applied to this vector.
     */
    multiplyScalar(scale: number): Vector2 {
        return new Vector2(this.x * scale, this.y * scale);
    }

    /**
     * Multiplies this vector by the given other vector and returns the result.
     * @param other The other vector to multiply with this vector.
     */
    multiply(other: Vector2): Vector2 {
        return new Vector2(this.x * other.x, this.y * other.y);
    }

    /**
     * Calculates the dot product of this vector compared to the given other vector.
     * Returns a number that is positive if the vectors point in the same direction,
     * negative if they point in opposite directions, and zero if they are perpendicular.
     * For normalized vectors, this value is clamped to 1 and -1.
     * @param other The other vector to calculate the dot product with.
     */
    dot(other: Vector2): number {
        return this.x * other.x + this.y * other.y;
    }

    /**
     * Calculates the length of this vector and returns the result.
     */
    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Calculates the square length of this vector and returns the result.
     * This is equivalent to length^2, but it is faster to calculate than length because it doesn't require
     * calculating a square root.
     */
    squareLength(): number {
        return this.x * this.x + this.y * this.y;
    }

    /**
     * Calculates the normalized version of this vector and returns it.
     * A normalized vector is a vector whose length equals 1.
     *
     * Normalizing a vector preserves its directionality while making the length (i.e. scale) of it 1.
     */
    normalize(): Vector2 {
        const length = this.length();
        return new Vector2(this.x / length, this.y / length);
    }

    toString(): string {
        return `Vector2(${this.x}, ${this.y})`;
    }

    /**
     * Determines if this vector equals the other vector.
     * @param other The other vector.
     */
    equals(other: Vector2): boolean {
        return this.x === other.x && this.y === other.y;
    }
}
