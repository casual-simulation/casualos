import { MathUtils } from 'three';
import { Quaternion } from './Quaternion';
import { Vector2 } from './Vector2';
import { Vector3 } from './Vector3';

describe('Quaternion', () => {
    it('should default to (0, 0, 0, 1)', () => {
        const q = new Quaternion();
        expect(q.x).toBe(0);
        expect(q.y).toBe(0);
        expect(q.z).toBe(0);
        expect(q.w).toBe(1);
    });

    it('should contain x, y, z, and w values', () => {
        const q = new Quaternion(1, 2, 3, 4);
        expect(q.x).toBe(1);
        expect(q.y).toBe(2);
        expect(q.z).toBe(3);
        expect(q.w).toBe(4);
    });

    describe('toString()', () => {
        it('should return a nicely formatted string', () => {
            const q = new Quaternion(1, 2, 3, 4);

            expect(q.toString()).toBe('Quaternion(1, 2, 3, 4)');
        });
    });

    describe('equals()', () => {
        it('should return false if given null', () => {
            const q1 = new Quaternion();

            expect(q1.equals(null)).toBe(false);
        });

        it('should return true if the quaternions are equal', () => {
            const q1 = new Quaternion(1, 2, 3, 4);
            const q2 = new Quaternion(1, 2, 3, 4);

            expect(q1.equals(q2)).toBe(true);
        });

        it('should return false if the quaternions differ in X', () => {
            const q1 = new Quaternion(1, 2, 3, 4);
            const q2 = new Quaternion(9, 2, 3, 4);

            expect(q1.equals(q2)).toBe(false);
        });

        it('should return false if the quaternions differ in Y', () => {
            const q1 = new Quaternion(1, 2, 3, 4);
            const q2 = new Quaternion(1, 9, 3, 4);

            expect(q1.equals(q2)).toBe(false);
        });

        it('should return false if the quaternions differ in Z', () => {
            const q1 = new Quaternion(1, 2, 3, 4);
            const q2 = new Quaternion(1, 2, 9, 4);

            expect(q1.equals(q2)).toBe(false);
        });

        it('should return false if the quaternions differ in W', () => {
            const q1 = new Quaternion(1, 2, 3, 4);
            const q2 = new Quaternion(1, 2, 3, 9);

            expect(q1.equals(q2)).toBe(false);
        });
    });

    describe('multiply()', () => {
        it('should multiply the quaternions together', () => {
            const q1 = new Quaternion(1, 2, 3, 4);
            const q2 = new Quaternion(5, 6, 7, 8);

            const q3 = q1.multiply(q2);

            expect(q3.x).toBe(24);
            expect(q3.y).toBe(48);
            expect(q3.z).toBe(48);
            expect(q3.w).toBe(-6);
        });
    });

    describe('invert()', () => {
        it('should return the conjugate of the quaternion', () => {
            const q1 = new Quaternion(1, 2, 3, 4);

            const q2 = q1.invert();
            expect(q2.x).toBe(-1);
            expect(q2.y).toBe(-2);
            expect(q2.z).toBe(-3);
            expect(q2.w).toBe(4);
        });
    });

    describe('length()', () => {
        it('should return length of the quaternion', () => {
            const q = new Quaternion(1, 3, 7, 11);
            expect(q.length()).toBe(Math.sqrt(1 * 1 + 3 * 3 + 7 * 7 + 11 * 11));
        });
    });

    describe('squareLength()', () => {
        it('should return length of the quaternion without the square root', () => {
            const q = new Quaternion(1, 3, 7, 11);
            expect(q.squareLength()).toBe(1 * 1 + 3 * 3 + 7 * 7 + 11 * 11);
        });
    });

    describe('normalize()', () => {
        it('should return a normalized copy of the quaternion', () => {
            const q1 = new Quaternion(1, 2, 3, 4);

            const q2 = q1.normalize();
            expect(q2.length()).toBeCloseTo(1, 5);
        });
    });
});
