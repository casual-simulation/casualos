import { versionsEqual, weaveVersion } from "./WeaveVersion";

describe('WeaveVersion', () => {
    describe('versionsEqual()', () => {
        it('should return false when one is null but not the other', () => {

            expect(versionsEqual(null, weaveVersion('', {}))).toBe(false);
            expect(versionsEqual(weaveVersion('', {}), null)).toBe(false);
        });

        it('should return true when both have the same hash', () => {
            expect(versionsEqual(
                weaveVersion('abcdefghijklmnopqrstuvwxyz1234567890', {}), 
                weaveVersion('abcdefghijklmnopqrstuvwxyz1234567890', {}))).toBe(true);
        });
    });
});