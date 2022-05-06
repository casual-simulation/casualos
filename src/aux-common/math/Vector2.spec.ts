import { Vector2 } from './Vector2';

describe('Vector2', () => {
    it('should contain X and Y values', () => {
        const v = new Vector2(1, 2);
        expect(v.x).toBe(1);
        expect(v.y).toBe(2);
    });

    it('should default to (0, 0)', () => {
        const v = new Vector2();
        expect(v.x).toBe(0);
        expect(v.y).toBe(0);
    });

    describe('add()', () => {
        it('should add the given vectors together and return a new vector', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(3, 4);

            const v3 = v1.add(v2);

            expect(v3.x).toBe(4);
            expect(v3.y).toBe(6);
        });

        it('should propagate infinity', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(Infinity, 4);

            const v3 = v1.add(v2);

            expect(v3.x).toBe(Infinity);
            expect(v3.y).toBe(6);
        });
    });

    describe('subtract()', () => {
        it('should subtract the given vectors together and return a new vector', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(3, 4);

            const v3 = v1.subtract(v2);

            expect(v3.x).toBe(-2);
            expect(v3.y).toBe(-2);
        });
    });

    describe('multiplyScalar()', () => {
        it('should multiply each component by the given value', () => {
            const v1 = new Vector2(2, 3);
            const v2 = v1.multiplyScalar(5);

            expect(v2.x).toBe(10);
            expect(v2.y).toBe(15);
        });
    });

    describe('multiply()', () => {
        it('should multiply vector components together', () => {
            const v1 = new Vector2(2, 3);
            const v2 = new Vector2(5, 7);
            const v3 = v1.multiply(v2);

            expect(v3.x).toBe(10);
            expect(v3.y).toBe(21);
        });
    });

    describe('normalize()', () => {
        it('should return the vector divided by the length', () => {
            const v1 = new Vector2(2, 2).normalize();

            expect(v1.length()).toBeCloseTo(1, 5);
        });

        it('should handle non-uniform vectors', () => {
            const v1 = new Vector2(2, 5).normalize();

            expect(v1.length()).toBeCloseTo(1, 5);
        });
    });

    describe('dot()', () => {
        it('should return 1 if the vectors are normalized and point the same direction', () => {
            const v1 = new Vector2(1, 1).normalize();
            const v2 = new Vector2(1, 1).normalize();
            const v3 = v1.dot(v2);

            expect(v3).toBeCloseTo(1, 5);
        });

        it('should return -1 if the vectors are normalized and point opposite directions', () => {
            const v1 = new Vector2(1, 1).normalize();
            const v2 = new Vector2(-1, -1).normalize();
            const v3 = v1.dot(v2);

            expect(v3).toBeCloseTo(-1, 5);
        });

        it('should return 0 if the vectors are normalized and perpendicular', () => {
            const v1 = new Vector2(1, 1).normalize();
            const v2 = new Vector2(1, -1).normalize();
            const v3 = v1.dot(v2);

            expect(v3).toBe(0);
        });
    });

    describe('angle()', () => {
        it('should return the angle between the two vectors in radians', () => {
            const v1 = new Vector2(
                Math.cos(Math.PI / 3),
                Math.sin(Math.PI / 3)
            ); // 60 degrees
            const v2 = new Vector2(
                Math.cos(Math.PI / 2),
                Math.sin(Math.PI / 2)
            ); // 90 degrees

            const angle = Vector2.angleBetween(v1, v2);
            expect(angle).toBeCloseTo(Math.PI / 6, 5); // 30 degrees
        });

        it('should work with non-normalized vectors', () => {
            const v1 = new Vector2(
                Math.cos(Math.PI / 3),
                Math.sin(Math.PI / 3)
            ).multiplyScalar(5); // 60 degrees
            const v2 = new Vector2(
                Math.cos(Math.PI / 2),
                Math.sin(Math.PI / 2)
            ).multiplyScalar(7); // 90 degrees

            const angle = Vector2.angleBetween(v1, v2);
            expect(angle).toBeCloseTo(Math.PI / 6, 5); // 30 degrees
        });
    });

    describe('distanceBetween()', () => {
        it('should return 0 when the vectors are equal', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(1, 2);

            expect(Vector2.distanceBetween(v1, v2)).toBe(0);
        });

        it('should return the distance between the given vectors', () => {
            const v1 = new Vector2(0, 1);
            const v2 = new Vector2(1, 0);

            expect(Vector2.distanceBetween(v1, v2)).toBe(Math.sqrt(2));
        });
    });

    describe('length()', () => {
        it('should return 0 when the vector is (0, 0)', () => {
            const v = new Vector2(0, 0);

            expect(v.length()).toBe(0);
        });

        it('should return the length of the vector', () => {
            const v = new Vector2(2, 2);

            expect(v.length()).toBe(Math.sqrt(8));
        });

        const nanCases = [
            [NaN, 2],
            [2, NaN],
            [NaN, NaN],
        ];

        it.each(nanCases)('should return NaN when (%s, %s)', (x, y) => {
            const v = new Vector2(x, y);
            expect(v.length()).toBe(NaN);
        });

        const infinityCases = [
            [Infinity, 2],
            [2, Infinity],
            [Infinity, Infinity],
            [-Infinity, 2],
            [2, -Infinity],
            [-Infinity, -Infinity],
        ];

        it.each(infinityCases)(
            'should return Infinity when (%s, %s)',
            (x, y) => {
                const v = new Vector2(x, y);
                expect(v.length()).toBe(Infinity);
            }
        );
    });

    describe('squareLength()', () => {
        it('should return 0 when the vector is (0, 0)', () => {
            const v = new Vector2(0, 0);

            expect(v.squareLength()).toBe(0);
        });

        it('should return the length^2 of the vector', () => {
            const v = new Vector2(2, 2);

            expect(v.squareLength()).toBe(8);
        });

        const nanCases = [
            [NaN, 2],
            [2, NaN],
            [NaN, NaN],
        ];

        it.each(nanCases)('should return NaN when (%s, %s)', (x, y) => {
            const v = new Vector2(x, y);
            expect(v.squareLength()).toBe(NaN);
        });

        const infinityCases = [
            [Infinity, 2],
            [2, Infinity],
            [Infinity, Infinity],
            [-Infinity, 2],
            [2, -Infinity],
            [-Infinity, -Infinity],
        ];

        it.each(infinityCases)(
            'should return Infinity when (%s, %s)',
            (x, y) => {
                const v = new Vector2(x, y);
                expect(v.squareLength()).toBe(Infinity);
            }
        );
    });

    describe('toString()', () => {
        it('should return a nicely formatted string', () => {
            expect(new Vector2(1, 2).toString()).toBe('Vector2(1, 2)');
        });

        it('should use scientific notation', () => {
            expect(new Vector2(0.000000000001, 2.1234567).toString()).toBe(
                'Vector2(1e-12, 2.1234567)'
            );
        });
    });

    describe('equals()', () => {
        it('should return true when the values are equal', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(1, 2);

            expect(v1.equals(v2)).toBe(true);
        });

        it('should return false when the values have different X values', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(0, 2);

            expect(v1.equals(v2)).toBe(false);
        });

        it('should return false when the values have different Y values', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(1, 5);

            expect(v1.equals(v2)).toBe(false);
        });
    });

    describe('createNormalized()', () => {
        it('should return the vector divided by the length', () => {
            const v1 = Vector2.createNormalized(2, 2);

            expect(v1.length()).toBeCloseTo(1, 5);
        });

        it('should handle non-uniform vectors', () => {
            const v1 = Vector2.createNormalized(2, 5);

            expect(v1.length()).toBeCloseTo(1, 5);
        });
    });
});
