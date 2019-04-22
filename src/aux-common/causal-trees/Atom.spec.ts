import {
    AtomId,
    atomId,
    idEquals,
    atomIdToString,
    atom,
    atomMatchesChecksum,
} from './Atom';

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

    describe('atomMatchesChecksum()', () => {
        it('should return true for an atom that was just created', () => {
            const a1 = atom(atomId(1, 1), null, { type: 0 });
            expect(atomMatchesChecksum(a1)).toBe(true);

            const a2 = atom(atomId(1, 1), atomId(1, 2), { type: 0 });
            expect(atomMatchesChecksum(a2)).toBe(true);

            const a3 = atom(atomId(1, 1), atomId(1, 2), { type: 10 });
            expect(atomMatchesChecksum(a3)).toBe(true);
        });

        it('should return false when the ID doesnt match', () => {
            const a1 = atom(atomId(1, 1), null, { type: 0 });
            const a2 = atom(atomId(1, 2), null, { type: 0 });
            a2.checksum = a1.checksum;
            expect(atomMatchesChecksum(a2)).toBe(false);
        });

        it('should return false when the cause ID doesnt match', () => {
            const a1 = atom(atomId(1, 2), atomId(1, 1), { type: 0 });
            const a2 = atom(atomId(1, 2), atomId(1, 2), { type: 0 });
            a2.checksum = a1.checksum;
            expect(atomMatchesChecksum(a2)).toBe(false);
        });

        it('should return false when match the value doesnt match', () => {
            const a1 = atom(atomId(1, 2), atomId(1, 1), { type: 0 });
            const a2 = atom(atomId(1, 2), atomId(1, 1), { type: 1 });
            a2.checksum = a1.checksum;
            expect(atomMatchesChecksum(a2)).toBe(false);
        });
    });
});
