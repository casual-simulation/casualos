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
     *
     * @example Create a new Vector2 object with the position (2, 3).
     * let myVector = new Vector2(2, 3);
     *
     * os.toast(`X: ${myVector.x}, Y: ${myVector.y}`);
     */
    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    /**
     * Creates a 2D vector with the given X and Y values that is normalized immediately upon creation.
     * @param x The X value of the vector.
     * @param y The Y value of the vector.
     *
     * @example Create a normalized vector
     * const vector = Vector2.createNormalized(1, 2);
     */
    static createNormalized(x: number, y: number) {
        const length = Math.sqrt(x * x + y * y);
        return new Vector2(x / length, y / length);
    }

    /**
     * Calculates the angle between the two given vectors and returns the result in radians.
     * @param first The first vector that should be used for comparision.
     * @param second The second vector that should be used for comparision.
     *
     * @example Find the angle between two vectors.
     * const first = new Vector2(
     *     Math.cos(Math.PI / 3),
     *     Math.sin(Math.PI / 3)
     * ); // 60 degrees
     * const second = new Vector2(
     *     Math.cos(Math.PI / 2),
     *     Math.sin(Math.PI / 2)
     * ); // 90 degrees
     *
     * const angle = Vector2.angleBetween(first, second);
     * os.toast(angle);
     */
    static angleBetween(first: Vector2, second: Vector2): number {
        const dot = first.dot(second);
        const l1 = first.length();
        const l2 = second.length();
        return Math.acos(dot / (l1 * l2));
    }

    /**
     * Calculates the distance between the two given vectors and returns the result.
     * @param first The first vector that should be used for comparision.
     * @param second The second vector that should be used for comparision.
     *
     * @example Find the distance between two vectors.
     * const first = new Vector2(5, 10);
     * const second = new Vector2(9, 2);
     * const distance = Vector2.distanceBetween(first, second);
     *
     * os.toast(`Distance: ${distance}`);
     */
    static distanceBetween(first: Vector2, second: Vector2): number {
        const direction = second.subtract(first);
        return direction.length();
    }

    /**
     * Constructs a new vector that is the linear interpolation between the given start and end positions.
     * The degree that the result is interpolated is determined by the given amount parameter.
     * @param start The start position.
     * @param finish The end position.
     * @param amount The amount that the resulting position should be interpolated between the start and end positions.  Values near 0 indicate rotations close to the first and values near 1 indicate rotations close to the second.
     *
     * @example Find the position that is halfway between two vectors.
     * const start = new Vector2(5, 10);
     * const finish = new Vector2(9, 2);
     * const halfway = Vector2.interpolatePosition(start, finish, 0.5);
     *
     * os.toast(halfway);
     *
     * @example Find the position that is 1/4 between two vectors.
     * const start = new Vector2(5, 10);
     * const finish = new Vector2(9, 2);
     * const halfway = Vector2.interpolatePosition(start, finish, 0.25);
     *
     * os.toast(halfway);
     */
    static interpolatePosition(
        start: Vector2,
        finish: Vector2,
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
     *
     * @example Find the direction that points halfway between the two vectors.
     * const start = new Vector2(5, 10);
     * const finish = new Vector2(9, 2);
     * const halfway = Vector2.interpolatePosition(start, finish, 0.5);
     *
     * os.toast(halfway);
     */
    static interpolateDirection(
        start: Vector2,
        finish: Vector2,
        amount: number
    ) {
        return Vector2.interpolatePosition(start, finish, amount).normalize();
    }

    /**
     * Adds this vector with the other vector and returns the result.
     * @param other The other vector to add with this vector.
     *
     * @example Add two vectors together.
     * const first = new Vector2(1, 2);
     * const second = new Vector2(3, 4);
     * const added = first.add(second);
     *
     * os.toast(added); // Prints (4, 6)
     */
    add(other: Vector2): Vector2 {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    /**
     * Subtracts the other vector from this vector and returns the result.
     * @param other The other vector that should be subtracted from this vector.
     *
     * @example Subtract two vectors.
     * const first = new Vector2(1, 2);
     * const second = new Vector2(3, 4);
     * const subtracted = first.subtract(second);
     * os.toast(subtracted);
     *
     * @example Find the direction from one vector to another.
     * const first = new Vector2(1, 2);
     * const second = new Vector2(3, 4);
     *
     * const directionFromFirstToSecond = second.subtract(first);
     * const directionFromSecondToFirst = first.subtract(second);
     *
     * os.toast(`first -> second = ${directionFromFirstToSecond}; second -> first = ${directionFromSecondToFirst}`);
     */
    subtract(other: Vector2): Vector2 {
        return new Vector2(this.x - other.x, this.y - other.y);
    }

    /**
     * Multiplies each component of this vector by the given value and returns the result.
     * @param scale The scale that should be applied to this vector.
     *
     * @example Scale a vector by 10.
     * const myVector = new Vector2(1, 1);
     * const scaled = myVector.multiplyScalar(10);
     * os.toast(scaled); // Prints (10, 10)
     */
    multiplyScalar(scale: number): Vector2 {
        return new Vector2(this.x * scale, this.y * scale);
    }

    /**
     * Multiplies this vector by the given other vector and returns the result.
     * @param other The other vector to multiply with this vector.
     *
     * @example Multiply two vectors together.
     * const first = new Vector2(1, 2);
     * const second = new Vector2(3, 4);
     * const multiplied = first.multiply(second);
     *
     * os.toast(multiplied); // Prints (3, 8)
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
     *
     * @example Determine how two vectors are pointing towards/away from the same direction.
     * const first = new Vector2(1, 2);
     * const second = new Vector2(3, 4);
     *
     * const dot = first.dot(second);
     * if (dot < 0) {
     *     os.toast("Vectors are pointing away from each other!");
     * } else if (dot === 0) {
     *     os.toast("Vectors 90 degrees away from each other!");
     * } else {
     *     sos.toast("Vectors are pointing towards from each other!");
     * }
     */
    dot(other: Vector2): number {
        return this.x * other.x + this.y * other.y;
    }

    /**
     * Calculates the length of this vector and returns the result.
     *
     * @example Get the length of the vector.
     * const myVector = new Vector2(1, 2);
     * const length = myVector.length();
     *
     * os.toast(`Vector is ${length} units long`);
     */
    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Calculates the square length of this vector and returns the result.
     * This is equivalent to length^2, but it is faster to calculate than length because it doesn't require
     * calculating a square root.
     *
     * @example Get the square length of the vector.
     * const myVector = new Vector2(1, 2);
     * const length = myVector.squareLength();
     *
     * os.toast(`Vector is ${length}^2 units long`);
     */
    squareLength(): number {
        return this.x * this.x + this.y * this.y;
    }

    /**
     * Calculates the normalized version of this vector and returns it.
     * A normalized vector is a vector whose length equals 1.
     *
     * Normalizing a vector preserves its directionality while making the length (i.e. scale) of it 1.
     *
     * @example Normalize a vector.
     * const myVector = new Vector2(1, 2);
     * const normalized = myVector.normalize();
     *
     * os.toast(`Vector: ${myVector}, Normalized: ${normalized}`);
     */
    normalize(): Vector2 {
        const length = this.length();
        return new Vector2(this.x / length, this.y / length);
    }

    /**
     * Converts this vector to a human-readable string representation.
     *
     * @example Get a string of a vector.
     * const myVector = new Vector2(1, 2);
     * const vectorString = myVector.toString();
     *
     * os.toast('My Vector: ' + vectorString);
     */
    toString(): string {
        return `Vector2(${this.x}, ${this.y})`;
    }

    /**
     * Determines if this vector equals the other vector.
     * @param other The other vector.
     *
     * @example Determine if two vectors represent the same value.
     * const first = new Vector2(1, 2);
     * const second = new Vector2(3, 4);
     * const third = new Vector2(1, 2);
     *
     * os.toast(`first == second: ${first.equals(second)}; first == third: ${first.equals(third)}`)
     */
    equals(other: Vector2): boolean {
        return this.x === other.x && this.y === other.y;
    }
}
