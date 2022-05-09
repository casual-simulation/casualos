import { Vector3 } from './Vector3';
import { Rotation } from './Rotation';
import { Quaternion } from './Quaternion';
import { Vector2 } from './Vector2';

describe('Rotation', () => {
    describe('new()', () => {
        it('should construct an identity rotation', () => {
            const q1 = new Rotation();
            expect(q1.quaternion).toEqual(new Quaternion(0, 0, 0, 1));
        });

        it('should construct a rotation from the given quaternion', () => {
            const r1 = new Rotation({
                quaternion: new Quaternion(1, 2, 3, 4),
            });

            const r2 = new Rotation(new Quaternion(1, 2, 3, 4));

            expect(r1.quaternion).toEqual(
                new Quaternion(1, 2, 3, 4).normalize()
            );
            expect(r2.quaternion).toEqual(
                new Quaternion(1, 2, 3, 4).normalize()
            );
        });

        it('should construct a rotation that is able to rotate a vector into another vector', () => {
            const q1 = new Rotation({
                from: new Vector3(1, 0, 0),
                to: new Vector3(0, 1, 0),
            }); // 90 degree rotation about Z axis

            const q2 = new Rotation({
                axis: new Vector3(0, 0, 1),
                angle: Math.PI / 2,
            });

            expect(q1).toEqual(q2);

            const v = q1.rotateVector3(new Vector3(1, 0, 0));

            expect(v.x).toBeCloseTo(0, 5);
            expect(v.y).toBeCloseTo(1, 5);
            expect(v.z).toBeCloseTo(0, 5);
        });

        it('should construct a rotation from an axis and angle', () => {
            const q1 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Y axis

            expect(q1.quaternion.x).toBe(0);
            expect(q1.quaternion.y).toBe(0.7071067811865475);
            expect(q1.quaternion.z).toBe(0);
            expect(q1.quaternion.w).toBe(0.7071067811865476);
        });

        it('should construct a rotation from a sequence of rotations', () => {
            const r1 = new Rotation({
                axis: new Vector3(1, 0, 0),
                angle: Math.PI / 4,
            }); // 45 degree rotation around X
            const r2 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 4,
            }); // 45 degree rotation around Y
            const r3 = new Rotation({
                sequence: [r1, r2],
            });

            const v1 = r3.rotateVector3(new Vector3(0, 0, 1));
            const v2 = r2.rotateVector3(r1.rotateVector3(new Vector3(0, 0, 1)));

            expect(v1.x).toBeCloseTo(v2.x, 5);
            expect(v1.y).toBeCloseTo(v2.y, 5);
            expect(v1.z).toBeCloseTo(v2.z, 5);

            expect(v1.x).toBeCloseTo(0.5, 5);
            expect(v1.y).toBeCloseTo(-0.7071067811865475, 5);
            expect(v1.z).toBeCloseTo(0.5, 5);
        });
    });

    describe('quaternionFromAxisAndAngle()', () => {
        it('should construct a rotation quaternion from an axis and angle', () => {
            const q1 = Rotation.quaternionFromAxisAndAngle({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Y axis

            expect(q1.x).toBe(0);
            expect(q1.y).toBe(0.7071067811865475);
            expect(q1.z).toBe(0);
            expect(q1.w).toBe(0.7071067811865476);
        });
    });

    describe('quaternionFromTo()', () => {
        it('should construct a rotation quaternion from two vectors', () => {
            const q1 = Rotation.quaternionFromTo({
                from: new Vector3(1, 0, 0),
                to: new Vector3(0, 1, 0),
            }); // 90 degree rotation about Z axis

            const q2 = Rotation.quaternionFromAxisAndAngle({
                axis: new Vector3(0, 0, 1),
                angle: Math.PI / 2,
            });

            expect(q1).toEqual(q2);
        });
    });

    describe('angleBetween()', () => {
        it('should return the angle between the two quaternions in radians', () => {
            const q1 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Y axis

            const q2 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 4,
            }); // 45 degree rotation about Y axis

            expect(Rotation.angleBetween(q1, q2)).toBeCloseTo(Math.PI / 4, 5); // 45 degrees
        });

        it('should return 0 if given the same quaternion', () => {
            const q1 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Y axis

            expect(Rotation.angleBetween(q1, q1)).toBeCloseTo(0, 5); // 0 degrees
        });
    });

    describe('invert()', () => {
        it('should return a rotation that is the inverse of the given rotation', () => {
            const q1 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Y axis

            const q2 = q1.invert();
            const q3 = q1.combineWith(q2);
            const q4 = q2.combineWith(q1);

            expect(q2.quaternion).toEqual(q1.quaternion.invert());
            expect(q3.quaternion).toEqual(new Quaternion(0, 0, 0, 1));
            expect(q4.quaternion).toEqual(new Quaternion(0, 0, 0, 1));
        });
    });

    describe('interpolate()', () => {
        it('should return a rotation halfway between the two given rotations', () => {
            const q1 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Y axis

            const q2 = new Rotation({
                axis: new Vector3(1, 0, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about X axis

            const q3 = Rotation.interpolate(q1, q2, 0.5);

            expect(q3).toMatchInlineSnapshot(`
                Rotation {
                  "_q": Quaternion {
                    "w": 0.8164965809277261,
                    "x": 0.408248290463863,
                    "y": 0.408248290463863,
                    "z": 0,
                  },
                }
            `);
        });
    });

    describe('rotateVector3()', () => {
        it('should return a new point rotated by the given quaternion', () => {
            const q1 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Y axis

            const q2 = new Rotation({
                axis: new Vector3(0, 0, 1),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Z axis

            const p1 = q1.rotateVector3(new Vector3(1, 0, 0));
            expect(p1.x).toBeCloseTo(0);
            expect(p1.y).toBeCloseTo(0);
            expect(p1.z).toBeCloseTo(-1);

            const p2 = q2.rotateVector3(new Vector3(1, 0, 0));
            expect(p2.x).toBeCloseTo(0);
            expect(p2.y).toBeCloseTo(1);
            expect(p2.z).toBeCloseTo(0);
        });
    });

    describe('rotateVector2()', () => {
        it('should return a new point rotated by the given quaternion', () => {
            const q1 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Y axis

            const q2 = new Rotation({
                axis: new Vector3(0, 0, 1),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Z axis

            const p1 = q1.rotateVector2(new Vector2(1, 0));
            expect(p1.x).toBeCloseTo(0);
            expect(p1.y).toBeCloseTo(0);
            expect(p1.z).toBeCloseTo(-1);

            const p2 = q2.rotateVector2(new Vector2(1, 0));
            expect(p2.x).toBeCloseTo(0);
            expect(p2.y).toBeCloseTo(1);
            expect(p2.z).toBeCloseTo(0);
        });
    });

    describe('combineWith()', () => {
        it('should return a new rotation that is equal to q2 * q1', () => {
            const r1 = new Rotation({
                axis: new Vector3(0, 1, 0),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Y axis

            const r2 = new Rotation({
                axis: new Vector3(0, 0, 1),
                angle: Math.PI / 2,
            }); // 90 degree rotation about Z axis

            const r3 = r1.combineWith(r2);

            expect(r3.quaternion).toEqual(
                r2.quaternion.multiply(r1.quaternion)
            );
        });
    });

    describe('axisAndAngle()', () => {
        it('should return the axis and angle representatino of the rotation', () => {
            const r1 = new Rotation({
                axis: new Vector3(0, 0, 1),
                angle: Math.PI / 2,
            });

            const result1 = r1.axisAndAngle();

            expect(result1.axis.x).toBeCloseTo(0, 5);
            expect(result1.axis.y).toBeCloseTo(0, 5);
            expect(result1.axis.z).toBeCloseTo(1, 5);
            expect(result1.angle).toBeCloseTo(Math.PI / 2);
        });
    });

    describe('toString()', () => {
        it('should display the rotation in axis/angle form', () => {
            const r1 = new Rotation({
                axis: new Vector3(0, 0, 1),
                angle: Math.PI / 2,
            });

            expect(r1.toString()).toBe(
                'Rotation(axis: Vector3(0, 0, 1), angle: Math.PI * 0.5)'
            );
        });

        it('should have a special way to display identity rotations', () => {
            const r1 = new Rotation();

            expect(r1.toString()).toBe('Rotation(identity)');
        });
    });

    describe('equals()', () => {
        it('should return true if their quaternions are equal', () => {
            const r1 = new Rotation({
                axis: new Vector3(0, 0, 1),
                angle: Math.PI / 2,
            });

            const r2 = new Rotation(
                Rotation.quaternionFromAxisAndAngle({
                    axis: new Vector3(0, 0, 1),
                    angle: Math.PI / 2,
                })
            );

            const r3 = new Rotation(
                Rotation.quaternionFromAxisAndAngle({
                    axis: new Vector3(0, 1, 0),
                    angle: Math.PI / 2,
                })
            );

            expect(r1.equals(r2)).toBe(true);
            expect(r2.equals(r1)).toBe(true);
            expect(r1.equals(r3)).toBe(false);
            expect(r2.equals(r3)).toBe(false);
        });

        it('should return false if given null', () => {
            const r1 = new Rotation({
                axis: new Vector3(0, 0, 1),
                angle: Math.PI / 2,
            });

            expect(r1.equals(null)).toBe(false);
        });
    });
});
