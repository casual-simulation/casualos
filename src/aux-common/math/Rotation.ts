import { Quaternion } from './Quaternion';
import { Vector2 } from './Vector2';
import { Vector3 } from './Vector3';

/**
 * Defines a class that can represent geometric rotations.
 */
export class Rotation {
    private _q: Quaternion;

    /**
     * The quaternion that this rotation uses.
     */
    get quaternion() {
        return this._q;
    }

    /**
     * Creates a new rotation using the given parameters.
     * @param rotation The information that should be used to construct the rotation.
     *
     * @example Create a rotation from an axis and angle.
     * const rotation = new Rotation({
     *     axis: new Vector3(0, 0, 1),
     *     angle: Math.PI / 2
     * }); // 90 degree rotation around Z axis
     *
     * @example Create a rotation from two vectors.
     * const rotation = new Rotation({
     *     from: new Vector3(1, 0, 0),
     *     to: new Vector3(0, 1, 0)
     * }); // Rotation that rotates (1, 0, 0) to (0, 1, 0)
     */
    constructor(
        rotation?:
            | FromToRotation
            | AxisAndAngle
            | QuaternionRotation
            | Quaternion
            | SequenceRotation
            | EulerAnglesRotation
            | LookRotation
    ) {
        if (!rotation) {
            this._q = new Quaternion(0, 0, 0, 1);
        } else if ('axis' in rotation) {
            this._q = Rotation.quaternionFromAxisAndAngle(rotation);
        } else if ('from' in rotation) {
            this._q = Rotation.quaternionFromTo(rotation);
        } else if ('quaternion' in rotation) {
            const q = rotation.quaternion;
            this._q = new Quaternion(q.x, q.y, q.z, q.w).normalize();
        } else if ('sequence' in rotation) {
            let q = new Quaternion(0, 0, 0, 1);
            for (let r of rotation.sequence) {
                q = r.quaternion.multiply(q);
            }
            this._q = q;
        } else if ('euler' in rotation) {
            // let euler = new Euler(rotation.euler.x, rotation.euler.y, rotation.euler.z, (rotation.euler.order ?? 'XYZ').toUpperCase());
            // let quat = new ThreeQuaternion().setFromEuler(euler);
            // this._q = new Quaternion(quat.x, quat.y, quat.z, quat.w);

            let q = new Quaternion(0, 0, 0, 1);
            let order = rotation.euler.order ?? 'XYZ';
            let extrinsic = rotation.euler.extrinsic ?? false;

            function combine(q: Quaternion, rotation: Quaternion) {
                if (extrinsic) {
                    return rotation.multiply(q);
                } else {
                    return q.multiply(rotation);
                }
            }

            for (let char of order) {
                if (char === 'X' || char === 'x') {
                    q = combine(
                        q,
                        Rotation.quaternionFromAxisAndAngle({
                            axis: new Vector3(1, 0, 0),
                            angle: rotation.euler.x,
                        })
                    );
                } else if (char === 'Y' || char === 'y') {
                    q = combine(
                        q,
                        Rotation.quaternionFromAxisAndAngle({
                            axis: new Vector3(0, 1, 0),
                            angle: rotation.euler.y,
                        })
                    );
                } else if (char === 'Z' || char === 'z') {
                    q = combine(
                        q,
                        Rotation.quaternionFromAxisAndAngle({
                            axis: new Vector3(0, 0, 1),
                            angle: rotation.euler.z,
                        })
                    );
                }
            }
            this._q = q;
        } else if ('direction' in rotation) {
            this._q = Rotation.quaternionLook(rotation);
        } else if (rotation instanceof Quaternion) {
            this._q = rotation.normalize();
        } else {
            this._q = new Quaternion(0, 0, 0, 1);
        }
    }

    /**
     * Constructs a new Quaternion from the given axis and angle.
     * @param axisAndAngle The object that contains the axis and angle values.
     */
    static quaternionFromAxisAndAngle(axisAndAngle: AxisAndAngle): Quaternion {
        const normalizedAxis = axisAndAngle.axis.normalize();
        const sinAngle = Math.sin(axisAndAngle.angle / 2);
        const cosAngle = Math.cos(axisAndAngle.angle / 2);
        return new Quaternion(
            normalizedAxis.x * sinAngle,
            normalizedAxis.y * sinAngle,
            normalizedAxis.z * sinAngle,
            cosAngle
        );
    }

    /**
     * Constructs a new Quaternion from the given from/to rotation.
     * This is equivalent to calculating the cross product and angle between the two vectors and constructing an axis/angle quaternion.
     * @param fromToRotation The object that contains the from and to values.
     */
    static quaternionFromTo(fromToRotation: FromToRotation): Quaternion {
        const normalizedFrom = fromToRotation.from.normalize();
        const normalizedTo = fromToRotation.to.normalize();

        const cross = normalizedFrom.cross(normalizedTo);
        const angle = Vector3.angleBetween(normalizedFrom, normalizedTo);

        return Rotation.quaternionFromAxisAndAngle({
            axis: cross,
            angle,
        });
    }

    /**
     * Constructs a new Quaternion from the given look rotation.
     * @param look The object that contains the look rotation values.
     */
    static quaternionLook(look: LookRotation): Quaternion {
        if (look.direction.squareLength() < 0.0001) {
            return new Quaternion();
        }

        const lookUpDot = look.direction.dot(look.upwards);
        if (lookUpDot > 0.9998) {
            throw new Error(
                `The up and direction vectors must not be the same when constructing a look rotation.\nThis is because vectors that are parallel don't have a valid cross product. (i.e. There are infinite vectors that are perpendicular to both)`
            );
        } else if (lookUpDot < -0.9998) {
            throw new Error(
                `The up and direction vectors must not be opposites when constructing a look rotation.\nThis is because vectors that are parallel don't have a valid cross product. (i.e. There are infinite vectors that are perpendicular to both)`
            );
        }

        // Matrix version from:
        // https://www.euclideanspace.com/maths/algebra/vectors/lookat/index.htm
        // with changed order to use Y-up coordinate system
        const y = look.direction.normalize();
        const x = y.cross(look.upwards).normalize();

        const z = x.cross(y);

        const m00 = x.x;
        const m01 = y.x;
        const m02 = z.x;
        const m10 = x.y;
        const m11 = y.y;
        const m12 = z.y;
        const m20 = x.z;
        const m21 = y.z;
        const m22 = z.z;

        // https://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/
        const qw = Math.sqrt(Math.max(0, 1 + m00 + m11 + m22)) / 2;
        let qx = copySign(
            m21 - m12,
            Math.sqrt(Math.max(0, 1 + m00 - m11 - m22)) / 2
        );
        let qy = copySign(
            m02 - m20,
            Math.sqrt(Math.max(0, 1 - m00 + m11 - m22)) / 2
        );
        let qz = copySign(
            m10 - m01,
            Math.sqrt(Math.max(0, 1 - m00 - m11 + m22)) / 2
        );

        return new Quaternion(qx, qy, qz, qw);
    }

    /**
     * Determines the angle between the two given quaternions and returns the result in radians.
     * @param first The first quaternion. Must be a quaterion that represents a rotation
     * @param second The second quaternion.
     */
    static angleBetween(first: Rotation, second: Rotation): number {
        const delta = first.quaternion.invert().multiply(second.quaternion);
        return 2 * Math.acos(delta.w);
    }

    /**
     * Constructs a new rotation that is the spherical linear interpolation between the given first and second rotations.
     * The degree that the result is interpolated is determined by the given amount parameter.
     * @param first The first rotation.
     * @param second The second rotation.
     * @param amount The amount that the resulting rotation should be interpolated between the first and second rotations. Values near 0 indicate rotations close to the first and values near 1 indicate rotations close to the second.
     */
    static interpolate(
        first: Rotation,
        second: Rotation,
        amount: number
    ): Rotation {
        const q1 = first.quaternion;
        const q2 = second.quaternion;

        const cosHalfTheta =
            q1.w * q2.w + q1.x * q2.x + q1.y * q2.y + q1.z * q2.z;

        // if angle beween is 0 then we can simply return the first rotation
        if (cosHalfTheta >= 1 || cosHalfTheta <= -1) {
            return new Rotation(new Quaternion(q1.x, q1.y, q1.z, q1.w));
        }
        const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);

        // If angle between is 180, then we can choose either axis normal to first or second.
        if (Math.abs(sinHalfTheta) <= 0.001) {
            return new Rotation(
                new Quaternion(
                    q1.x * 0.5 + q2.x * 0.5,
                    q1.y * 0.5 + q2.y * 0.5,
                    q1.z * 0.5 + q2.z * 0.5,
                    q1.w * 0.5 + q2.w * 0.5
                )
            );
        }

        const halfTheta = Math.acos(cosHalfTheta);
        const ratioA = Math.sin((1 - amount) * halfTheta) / sinHalfTheta;
        const ratioB = Math.sin(amount * halfTheta) / sinHalfTheta;

        return new Rotation(
            new Quaternion(
                q1.x * ratioA + q2.x * ratioB,
                q1.y * ratioA + q2.y * ratioB,
                q1.z * ratioA + q2.z * ratioB,
                q1.w * ratioA + q2.w * ratioB
            )
        );
    }

    /**
     * Rotates the given Vector3 by this quaternion and returns a new vector containing the result.
     * @param vector The 3D vector that should be rotated.
     *
     * @example Apply a rotation to a Vector3 object.
     * const rotation = new Rotation({
     *     axis: new Vector3(1, 0, 0),
     *     angle: Math.PI / 4
     * }); // 45 degree rotation around X axis
     *
     * const point = new Vector3(1, 2, 0);
     * const rotated = rotation.rotateVector3(point);
     * os.toast(rotated);
     */
    rotateVector3(vector: Vector3): Vector3 {
        // Multiplied out version of (q * vector * q^-1)
        const q = this.quaternion;
        return new Vector3(
            q.w * q.w * vector.x +
                2 * q.y * q.w * vector.z -
                2 * q.z * q.w * vector.y +
                q.x * q.x * vector.x +
                2 * q.y * q.x * vector.y +
                2 * q.z * q.x * vector.z -
                q.z * q.z * vector.x -
                q.y * q.y * vector.x,
            2 * q.x * q.y * vector.x +
                q.y * q.y * vector.y +
                2 * q.z * q.y * vector.z +
                2 * q.w * q.z * vector.x -
                q.z * q.z * vector.y +
                q.w * q.w * vector.y -
                2 * q.x * q.w * vector.z -
                q.x * q.x * vector.y,
            2 * q.x * q.z * vector.x +
                2 * q.y * q.z * vector.y +
                q.z * q.z * vector.z -
                2 * q.w * q.y * vector.x -
                q.y * q.y * vector.z +
                2 * q.w * q.x * vector.y -
                q.x * q.x * vector.z +
                q.w * q.w * vector.z
        );
    }

    /**
     * Rotates the given Vector2 by this quaternion and returns a new vector containing the result.
     * Note that rotations around any other axis than (0, 0, 1) or (0, 0, -1) can produce results that contain a Z component.
     * @param vector The 2D vector that should be rotated.
     *
     * @example Apply a rotation to a Vector2 object.
     * const rotation = new Rotation({
     *     axis: new Vector3(1, 0, 0),
     *     angle: Math.PI / 4
     * }); // 45 degree rotation around X axis
     *
     * const point = new Vector2(1, 2);
     * const rotated = rotation.rotateVector2(point);
     * os.toast(rotated);
     */
    rotateVector2(vector: Vector2): Vector3 {
        return this.rotateVector3(new Vector3(vector.x, vector.y));
    }

    /**
     * Combines this rotation with the other rotation and returns a new rotation that represents the combination of the two.
     * @param other The other rotation.
     *
     * @example Combine two rotations together.
     * const first = new Rotation({
     *     axis: new Vector3(1, 0, 0),
     *     angle: Math.PI / 4
     * }); // 45 degree rotation around X axis
     * const second = new Rotation({
     *     axis: new Vector3(1, 0, 0),
     *     angle: Math.PI / 4
     * }); // 45 degree rotation around X axis
     *
     * const third = first.combineWith(second); // 90 degree rotation around X
     *
     * os.toast(third);
     */
    combineWith(other: Rotation): Rotation {
        return new Rotation(other.quaternion.multiply(this.quaternion));
    }

    /**
     * Calculates the inverse rotation of this rotation and returns a new rotation with the result.
     *
     * @example Calculate the inverse of a rotation.
     * const first = new Rotation({
     *     axis: new Vector3(1, 0, 0),
     *     angle: Math.PI / 4
     * }); // 45 degree rotation around X axis
     * const inverse = first.inverse();
     *
     * const result = first.combineWith(inverse);
     *
     * os.toast(result);
     */
    invert(): Rotation {
        return new Rotation(this._q.invert());
    }

    /**
     * Gets the axis and angle that this rotation rotates around.
     */
    axisAndAngle(): AxisAndAngle {
        const halfAngle = Math.acos(this.quaternion.w);
        const sinHalfAngle = Math.sin(halfAngle);
        const x = this.quaternion.x / sinHalfAngle;
        const y = this.quaternion.y / sinHalfAngle;
        const z = this.quaternion.z / sinHalfAngle;
        const angle = halfAngle * 2;

        return {
            axis: new Vector3(x, y, z),
            angle: angle,
        };
    }

    /**
     * Determines if this rotation equals the other rotation.
     * @param other The rotation to check.
     */
    equals(other: Rotation): boolean {
        return this._q.equals(other?._q);
    }

    /**
     * Converts this rotation to a human-readable string representation.
     *
     * @example Get a string of a rotation.
     * const myRotation = new Rotation({
     *     axis: new Vector3(1, 0, 0),
     *     angle: Math.PI / 4
     * }); // 45 degree rotation around X axis
     * const rotationString = myRotation.toString();
     *
     * os.toast('My Rotation: ' + rotationString);
     */
    toString(): string {
        const { axis, angle } = this.axisAndAngle();
        const angleWithoutPi = angle / Math.PI;
        if (angle === 0) {
            return `Rotation(identity)`;
        }
        return `Rotation(axis: ${axis}, angle: Math.PI * ${angleWithoutPi})`;
    }
}

/**
 * Defines an interface that represents a from/to rotation.
 * That is, a rotation that is able to rotate a vector from the given vector direction to the given vector direction.
 */
export interface FromToRotation {
    /**
     * The direction that the rotation should rotate from.
     */
    from: Vector3;

    /**
     * The direction that the rotation should rotate to.
     */
    to: Vector3;
}

/**
 * Defines an interface that represents an Axis and Angle pair.
 */
export interface AxisAndAngle {
    /**
     * The axis about which the angle should rotate around.
     */
    axis: Vector3;

    /**
     * The number of radians that should be rotated around the axis.
     */
    angle: number;
}

/**
 * Defines an interface that represents an Euler Angles rotation.
 */
export interface EulerAnglesRotation {
    euler: {
        /**
         * The amount to rotate around the X axis.
         */
        x: number;

        /**
         * The amount to rotate around the Y axis.
         */
        y: number;

        /**
         * The amount to rotate around the Z axis.
         */
        z: number;

        /**
         * The order that the rotations should be applied in.
         * Defaults to XYZ.
         */
        order?: string;

        /**
         * Whether the euler angles are extrinsic.
         * Defaults to false.
         */
        extrinsic?: boolean;
    };
}

/**
 * Defines an interface that represents a sequence of rotations.
 */
export interface SequenceRotation {
    /**
     * The sequence of successive rotations.
     */
    sequence: Rotation[];
}

export interface QuaternionRotation {
    quaternion: { x: number; y: number; z: number; w: number };
}

/**
 * Defines an interface that represents a rotation transforms (0, 1, 0) and (0, 0, 1) to look along the given direction and upwards axes.
 */
export interface LookRotation {
    /**
     * The direction that (0, 1, 0) should be pointing along after the rotation is applied.
     */
    direction: Vector3;

    /**
     * The direction that the upward axis should be pointing along after the rotation is applied.
     * If the direction and upwards vectors are not perpendicular, then the direction will be prioritized and the angle between
     * upwards and the resulting upwards vector will be minimized.
     *
     * If direction and upwards are perpendicular, then applying the rotation to (0, 0, 1) will give the upwards vector.
     */
    upwards: Vector3;
}

/**
 * Defines a constant that contains a rotation that, when combined with a rotation, converts a rotation in AUX coordinates to THREE.js coordinates.
 */
export const AUX_ROTATION_TO_THREEJS = new Rotation({
    axis: new Vector3(1, 0, 0),
    angle: -Math.PI / 2,
});

/**
 * Copies the sign from signGiver onto signTaker and returns the result.
 * @param signGiver The number whose sign should be given to the other number.
 * @param signTaker The number whose sign should be set.
 */
export function copySign(signGiver: number, signTaker: number): number {
    if (Math.sign(signGiver) === Math.sign(signTaker)) {
        return signTaker;
    } else {
        return signTaker * -1;
    }
}
