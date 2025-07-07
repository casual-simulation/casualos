import { sortInsts } from './PlayerUtils';

describe('sortInsts()', () => {
    it('should work with a single inst', () => {
        const result = sortInsts('test', 'other');
        expect(result).toBe('test');
    });

    it('should work with an array of one item', () => {
        const result = sortInsts(['test'], 'other');
        expect(result).toEqual(['test']);
    });

    it('should sort the inst matching the current one first', () => {
        const result = sortInsts(['test', 'other', 'third'], 'other');
        expect(result).toEqual(['other', 'test', 'third']);
    });

    it('should preserve the order of a list that is already sorted', () => {
        const result = sortInsts(['test', 'other', 'third'], 'test');
        expect(result).toEqual(['test', 'other', 'third']);
    });
});
