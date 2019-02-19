import { AtomId, atomId, idEquals } from "./Atom";

describe('AtomId', () => {
    it('should be equal to other IDs', () => {
        expect(idEquals(atomId(1, 1), atomId(1, 1))).toBe(true);
        expect(idEquals(atomId(1, 2), atomId(1, 2))).toBe(true);
        expect(idEquals(atomId(2, 1), atomId(2, 1))).toBe(true);
        expect(idEquals(atomId(1, 1, 1), atomId(1, 1, 1))).toBe(true);

        expect(idEquals(atomId(1, 2), atomId(1, 1))).toBe(false);
        expect(idEquals(atomId(2, 1), atomId(1, 1))).toBe(false);
        expect(idEquals(atomId(2, 2), atomId(1, 1))).toBe(false);
        expect(idEquals(atomId(1, 1, 1), atomId(1, 1))).toBe(false);
        expect(idEquals(atomId(1, 1, 1), atomId(1, 1, 2))).toBe(false);
    });
})