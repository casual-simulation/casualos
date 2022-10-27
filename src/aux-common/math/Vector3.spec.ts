import { Vector2 } from './Vector2';
import { Vector3 } from './Vector3';

describe('Vector3', () => {
    it('should contain X, Y, and Z values', () => {
        const v = new Vector3(1, 2, 3);
        expect(v.x).toBe(1);
        expect(v.y).toBe(2);
        expect(v.z).toBe(3);
    });

    it('should default to (0, 0, 0)', () => {
        const v = new Vector3();
        expect(v.x).toBe(0);
        expect(v.y).toBe(0);
        expect(v.z).toBe(0);
    });

    describe('xy', () => {
        it('should return a Vector2 containing the X and Y values', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = v1.xy;

            expect(v2).toBeInstanceOf(Vector2);
            expect(v2.x).toBe(1);
            expect(v2.y).toBe(2);
        });
    });

    describe('xz', () => {
        it('should return a Vector2 containing the X and Z values', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = v1.xz;

            expect(v2).toBeInstanceOf(Vector2);
            expect(v2.x).toBe(1);
            expect(v2.y).toBe(3);
        });
    });

    describe('yz', () => {
        it('should return a Vector2 containing the Y and Z values', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = v1.yz;

            expect(v2).toBeInstanceOf(Vector2);
            expect(v2.x).toBe(2);
            expect(v2.y).toBe(3);
        });
    });

    describe('add()', () => {
        it('should add the given vectors together and return a new vector', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = new Vector3(4, 5, 6);

            const v3 = v1.add(v2);

            expect(v3.x).toBe(5);
            expect(v3.y).toBe(7);
            expect(v3.z).toBe(9);
        });

        it('should propagate infinity', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = new Vector3(Infinity, 5, 6);

            const v3 = v1.add(v2);

            expect(v3.x).toBe(Infinity);
            expect(v3.y).toBe(7);
            expect(v3.z).toBe(9);
        });
    });

    describe('subtract()', () => {
        it('should subtract the given vectors together and return a new vector', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = new Vector3(4, 5, 6);

            const v3 = v1.subtract(v2);

            expect(v3.x).toBe(-3);
            expect(v3.y).toBe(-3);
            expect(v3.z).toBe(-3);
        });
    });

    describe('multiplyScalar()', () => {
        it('should multiply each component by the given value', () => {
            const v1 = new Vector3(2, 3, 4);
            const v2 = v1.multiplyScalar(5);

            expect(v2.x).toBe(10);
            expect(v2.y).toBe(15);
            expect(v2.z).toBe(20);
        });
    });

    describe('multiply()', () => {
        it('should multiply vector components together', () => {
            const v1 = new Vector3(2, 3, 4);
            const v2 = new Vector3(5, 7, 11);
            const v3 = v1.multiply(v2);

            expect(v3.x).toBe(10);
            expect(v3.y).toBe(21);
            expect(v3.z).toBe(44);
        });
    });

    describe('normalize()', () => {
        it('should return the vector divided by the length', () => {
            const v1 = new Vector3(2, 2, 2).normalize();

            expect(v1.length()).toBeCloseTo(1, 5);
        });

        it('should handle non-uniform vectors', () => {
            const v1 = new Vector3(2, 5, 7).normalize();

            expect(v1.length()).toBeCloseTo(1, 5);
        });

        it('should return the same vector if the length is already 1', () => {
            const v1 = new Vector3(1, 0, 0);
            expect(v1.normalize()).toBe(v1);
        });
    });

    describe('dot()', () => {
        it('should return 1 if the vectors are normalized and point the same direction', () => {
            const v1 = new Vector3(1, 1, 1).normalize();
            const v2 = new Vector3(1, 1, 1).normalize();
            const v3 = v1.dot(v2);

            expect(v3).toBeCloseTo(1, 5);
        });

        it('should return -1 if the vectors are normalized and point opposite directions', () => {
            const v1 = new Vector3(1, 1, 1).normalize();
            const v2 = new Vector3(-1, -1, -1).normalize();
            const v3 = v1.dot(v2);

            expect(v3).toBeCloseTo(-1, 5);
        });

        it('should return 0 if the vectors are normalized and perpendicular along the XY plane', () => {
            const v1 = new Vector3(1, 0, 0).normalize();
            const v2 = new Vector3(0, 1, 0).normalize();
            const v3 = v1.dot(v2);

            expect(v3).toBeCloseTo(0, 5);
        });

        it('should return 0 if the vectors are normalized and perpendicular along the XZ plane', () => {
            const v1 = new Vector3(1, 0, 0).normalize();
            const v2 = new Vector3(0, 0, 1).normalize();
            const v3 = v1.dot(v2);

            expect(v3).toBeCloseTo(0, 5);
        });

        it('should return 0 if the vectors are normalized and perpendicular along the YZ plane', () => {
            const v1 = new Vector3(0, 1, 0).normalize();
            const v2 = new Vector3(0, 0, 1).normalize();
            const v3 = v1.dot(v2);

            expect(v3).toBeCloseTo(0, 5);
        });
    });

    describe('cross()', () => {
        it('should calculate the XY cross product', () => {
            const v1 = new Vector3(1, 0, 0);
            const v2 = new Vector3(0, 1, 0);

            const v3 = v1.cross(v2);
            const v4 = v2.cross(v1);
            const v5 = v1.cross(v1);
            const v6 = v1.cross(new Vector3(0, 0, 0));

            expect(v3).toEqual(new Vector3(0, 0, 1));
            expect(v4).toEqual(new Vector3(0, 0, -1));
            expect(v5).toEqual(new Vector3(0, 0, 0));
            expect(v6).toEqual(new Vector3(0, 0, 0));
        });

        it('should calculate the XZ cross product', () => {
            const v1 = new Vector3(1, 0, 0);
            const v2 = new Vector3(0, 0, 1);

            const v3 = v1.cross(v2);
            const v4 = v2.cross(v1);
            const v5 = v1.cross(v1);
            const v6 = v1.cross(new Vector3(0, 0, 0));

            expect(v3).toEqual(new Vector3(0, -1, 0));
            expect(v4).toEqual(new Vector3(0, 1, 0));
            expect(v5).toEqual(new Vector3(0, 0, 0));
            expect(v6).toEqual(new Vector3(0, 0, 0));
        });

        it('should calculate the YZ cross product', () => {
            const v1 = new Vector3(0, 1, 0);
            const v2 = new Vector3(0, 0, 1);

            const v3 = v1.cross(v2);
            const v4 = v2.cross(v1);
            const v5 = v1.cross(v1);
            const v6 = v1.cross(new Vector3(0, 0, 0));

            expect(v3).toEqual(new Vector3(1, 0, 0));
            expect(v4).toEqual(new Vector3(-1, 0, 0));
            expect(v5).toEqual(new Vector3(0, 0, 0));
            expect(v6).toEqual(new Vector3(0, 0, 0));
        });
    });

    describe('negate()', () => {
        it('should return the negated vector', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = v1.negate();

            expect(v2.x).toBe(-1);
            expect(v2.y).toBe(-2);
            expect(v2.z).toBe(-3);

            expect(v2).not.toBe(v1);
        });
    });

    describe('angleBetween()', () => {
        it('should return the angle between the two vectors in radians', () => {
            const v1 = new Vector3(0, 1, 0);
            const v2 = new Vector3(0, 0, 1);

            const angle = Vector3.angleBetween(v1, v2);
            expect(angle).toBeCloseTo(Math.PI / 2, 5); // 90 degrees
        });

        it('should return the angle between the two non-normalized vectors in radians', () => {
            const v1 = new Vector3(1, 1, 1).multiplyScalar(5);
            const v2 = new Vector3(-1, -1, -1).multiplyScalar(7);

            const angle = Vector3.angleBetween(v1, v2);
            expect(angle).toBeCloseTo(Math.PI, 5); // 180 degrees
        });
    });

    describe('distanceBetween()', () => {
        it('should return 0 when the vectors are equal', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = new Vector3(1, 2, 3);

            expect(Vector3.distanceBetween(v1, v2)).toBe(0);
        });

        it('should return the distance between the given vectors', () => {
            const v1 = new Vector3(0, 1, 1);
            const v2 = new Vector3(1, 0, 1);

            expect(Vector3.distanceBetween(v1, v2)).toBe(Math.sqrt(2));
        });
    });

    describe('length()', () => {
        it('should return 0 when the vector is (0, 0)', () => {
            const v = new Vector3(0, 0, 0);

            expect(v.length()).toBe(0);
        });

        it('should return the length of the vector', () => {
            const v = new Vector3(2, 2, 2);

            expect(v.length()).toBe(Math.sqrt(12));
        });

        const nanCases = [
            [NaN, 2, 2],
            [2, NaN, 2],
            [NaN, NaN, 2],
            [NaN, NaN, NaN],
        ];

        it.each(nanCases)('should return NaN when (%s, %s, %s)', (x, y, z) => {
            const v = new Vector3(x, y, z);
            expect(v.length()).toBe(NaN);
        });

        const infinityCases = [
            [Infinity, 2, 2],
            [2, Infinity, 2],
            [Infinity, Infinity, 2],
            [-Infinity, 2, 2],
            [2, -Infinity, 2],
            [-Infinity, -Infinity, 2],
            [Infinity, Infinity, Infinity],
            [-Infinity, -Infinity, -Infinity],
        ];

        it.each(infinityCases)(
            'should return Infinity when (%s, %s, %s)',
            (x, y, z) => {
                const v = new Vector3(x, y, z);
                expect(v.length()).toBe(Infinity);
            }
        );
    });

    describe('squareLength()', () => {
        it('should return 0 when the vector is (0, 0, 0)', () => {
            const v = new Vector3(0, 0, 0);

            expect(v.squareLength()).toBe(0);
        });

        it('should return the length^2 of the vector', () => {
            const v = new Vector3(2, 2, 2);

            expect(v.squareLength()).toBe(12);
        });

        const nanCases = [
            [NaN, 2, 2],
            [2, NaN, 2],
            [NaN, NaN, 2],
            [NaN, NaN, NaN],
        ];

        it.each(nanCases)('should return NaN when (%s, %s, %s)', (x, y, z) => {
            const v = new Vector3(x, y, z);
            expect(v.squareLength()).toBe(NaN);
        });

        const infinityCases = [
            [Infinity, 2, 2],
            [2, Infinity, 2],
            [Infinity, Infinity, 2],
            [-Infinity, 2, 2],
            [2, -Infinity, 2],
            [-Infinity, -Infinity, 2],
            [Infinity, Infinity, Infinity],
            [-Infinity, -Infinity, -Infinity],
        ];

        it.each(infinityCases)(
            'should return Infinity when (%s, %s, %s)',
            (x, y, z) => {
                const v = new Vector3(x, y, z);
                expect(v.squareLength()).toBe(Infinity);
            }
        );
    });

    describe('toString()', () => {
        it('should return a nicely formatted string', () => {
            expect(new Vector3(1, 2, 3).toString()).toBe('Vector3(1, 2, 3)');
        });

        it('should use scientific notation', () => {
            expect(new Vector3(0.000000000001, 2.1234567, 3).toString()).toBe(
                'Vector3(1e-12, 2.1234567, 3)'
            );
        });
    });

    describe('equals()', () => {
        it('should return true when the values are equal', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = new Vector3(1, 2, 3);

            expect(v1.equals(v2)).toBe(true);
        });

        it('should return false when the values have different X values', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = new Vector3(0, 2, 3);

            expect(v1.equals(v2)).toBe(false);
        });

        it('should return false when the values have different Y values', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = new Vector3(1, 5, 3);

            expect(v1.equals(v2)).toBe(false);
        });

        it('should return false when the values have different Z values', () => {
            const v1 = new Vector3(1, 2, 3);
            const v2 = new Vector3(1, 2, 4);

            expect(v1.equals(v2)).toBe(false);
        });
    });

    describe('createNormalized()', () => {
        it('should return the vector divided by the length', () => {
            const v1 = Vector3.createNormalized(2, 2, 2);

            expect(v1.length()).toBeCloseTo(1, 5);
        });

        it('should handle non-uniform vectors', () => {
            const v1 = Vector3.createNormalized(2, 5, 2);

            expect(v1.length()).toBeCloseTo(1, 5);
        });

        it('should equal creating a vector and then normalizing it', () => {
            const v1 = Vector3.createNormalized(2, 5, 2);
            const v2 = new Vector3(2, 5, 2).normalize();

            expect(v1).toEqual(v2);
        });
    });

    describe('interpolatePosition()', () => {
        it('should return a vector that is between the two given vectors', () => {
            const v1 = new Vector3(-1, -1, -1);
            const v2 = new Vector3(1, 1, 1);

            const v3 = Vector3.interpolatePosition(v1, v2, 0.2);
            const v4 = Vector3.interpolatePosition(v1, v2, 0.5);
            const v5 = Vector3.interpolatePosition(v1, v2, 0.7);
            const v6 = Vector3.interpolatePosition(v1, v2, 1);
            const v7 = Vector3.interpolatePosition(v1, v2, 0);
            const v8 = Vector3.interpolatePosition(v1, v2, -0.5);
            const v9 = Vector3.interpolatePosition(v1, v2, 1.5);

            expect(v3).toEqual(new Vector3(-0.6, -0.6, -0.6));
            expect(v4).toEqual(new Vector3(0, 0, 0));
            expect(v5.x).toBeCloseTo(0.4, 5);
            expect(v5.y).toBeCloseTo(0.4, 5);
            expect(v5.z).toBeCloseTo(0.4, 5);
            expect(v6).toEqual(new Vector3(1, 1, 1));
            expect(v7).toEqual(new Vector3(-1, -1, -1));
            expect(v8).toEqual(new Vector3(-2, -2, -2));
            expect(v9).toEqual(new Vector3(2, 2, 2));
        });
    });

    describe('interpolateDirection()', () => {
        it('should return a vector that is between the two given vectors', () => {
            const v1 = new Vector3(-1, -1, -1);
            const v2 = new Vector3(1, 1, 1);

            const v3 = Vector3.interpolateDirection(v1, v2, 0.2);
            const v4 = Vector3.interpolateDirection(v1, v2, 0.5);
            const v5 = Vector3.interpolateDirection(v1, v2, 0.7);
            const v6 = Vector3.interpolateDirection(v1, v2, 1);
            const v7 = Vector3.interpolateDirection(v1, v2, 0);
            const v8 = Vector3.interpolateDirection(v1, v2, -0.5);
            const v9 = Vector3.interpolateDirection(v1, v2, 1.5);

            expect(v3).toEqual(new Vector3(-0.6, -0.6, -0.6).normalize());
            expect(v4).toEqual(new Vector3(0, 0, 0).normalize());
            expect(v5).toMatchInlineSnapshot(`
                Vector3 {
                  "x": 0.5773502691896258,
                  "y": 0.5773502691896258,
                  "z": 0.5773502691896258,
                }
            `);
            expect(v6).toEqual(new Vector3(1, 1, 1).normalize());
            expect(v7).toEqual(new Vector3(-1, -1, -1).normalize());
            expect(v8).toEqual(new Vector3(-2, -2, -2).normalize());
            expect(v9).toEqual(new Vector3(2, 2, 2).normalize());
        });
    });
});
