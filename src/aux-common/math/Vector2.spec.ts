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
});
