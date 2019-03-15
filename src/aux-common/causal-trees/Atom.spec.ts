import { AtomId, atomId, idEquals, atomIdToString } from "./Atom";

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

    describe('atomIdToString()', () => {
        it('should include the timestamp, site, and priority', () => {
            expect(atomIdToString(atomId(1, 1))).toBe('1@1:0');
            expect(atomIdToString(atomId(1, 1, 110))).toBe('1@1:110');
            expect(atomIdToString(atomId(2, 3))).toBe('2@3:0');
        });
    });
});

