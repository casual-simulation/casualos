import { normalizeAngle } from './TweenCameraToOperation';

describe('normalizeAngle()', () => {
    const cases = [
        [Math.PI / 2, Math.PI / 2],
        [0, 0],
        [Math.PI * 2, Math.PI * 2],
        [-1, Math.PI * 2 - 1],
        [7, 7 - Math.PI * 2],
        [Math.PI * 6 + 1, 1],
    ];

    it.each(cases)('should normalize %s', (given: number, expected: number) => {
        expect(normalizeAngle(given)).toEqual(expected);
    });
});
