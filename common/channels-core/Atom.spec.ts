import { AtomId } from "./Atom";

describe('AtomId', () => {
    it('should be equal to other IDs', () => {
        expect(new AtomId(1, 1).equals(new AtomId(1, 1))).toBe(true);
        expect(new AtomId(1, 2).equals(new AtomId(1, 2))).toBe(true);
        expect(new AtomId(2, 1).equals(new AtomId(2, 1))).toBe(true);
        expect(new AtomId(1, 1, 1).equals(new AtomId(1, 1, 1))).toBe(true);

        expect(new AtomId(1, 2).equals(new AtomId(1, 1))).toBe(false);
        expect(new AtomId(2, 1).equals(new AtomId(1, 1))).toBe(false);
        expect(new AtomId(2, 2).equals(new AtomId(1, 1))).toBe(false);
        expect(new AtomId(1, 1, 1).equals(new AtomId(1, 1))).toBe(false);
        expect(new AtomId(1, 1, 1).equals(new AtomId(1, 1, 2))).toBe(false);
    });
})