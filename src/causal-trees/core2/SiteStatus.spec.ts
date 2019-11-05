import { Weave } from './Weave2';
import { atom, atomId } from './Atom2';
import {
    updateSite,
    createAtom,
    newSite,
    SiteStatus,
    addAtom,
} from './SiteStatus';

describe('SiteStatus', () => {
    let weave: Weave<any>;
    beforeEach(() => {
        weave = new Weave();
    });

    describe('updateSite()', () => {
        describe('atoms from self', () => {
            it('should update the time on the site', () => {
                const current = {
                    id: 'test',
                    time: 0,
                };

                const a1 = atom(atomId('test', 1), null, {});

                const result = weave.insert(a1);

                const next = updateSite(current, result);

                expect(next).toEqual({
                    id: 'test',
                    time: 1,
                });
            });

            it('should choose the correct time from conflicts', () => {
                const cause1 = atom(atomId('1', 0), null, {});
                const cause2 = atom(atomId('2', 0), null, {});
                const atom1 = atom(atomId('test', 6), cause1, {});
                const atom2 = atom(atomId('test', 6), cause2, {});
                weave.insert(cause1);
                weave.insert(cause2);
                weave.insert(atom1);
                const result = weave.insert(atom2);

                // atom1 is the winner
                const current = {
                    id: 'test',
                    time: 0,
                };

                const next = updateSite(current, result);

                expect(next).toEqual({
                    id: 'test',
                    time: 6,
                });
            });
        });

        describe('atoms from others', () => {
            it('should increment the time by one for atoms from other sites', () => {
                const current = {
                    id: 'test',
                    time: 0,
                };

                const a1 = atom(atomId('a', 1), null, {});

                const result = weave.insert(a1);

                const next = updateSite(current, result);

                expect(next).toEqual({
                    id: 'test',
                    time: 2,
                });
            });

            it('should choose the correct time from conflicts', () => {
                const cause1 = atom(atomId('1', 0), null, {});
                const cause2 = atom(atomId('2', 0), null, {});
                const atom1 = atom(atomId('a', 6), cause1, {});
                const atom2 = atom(atomId('a', 6), cause2, {});
                weave.insert(cause1);
                weave.insert(cause2);
                weave.insert(atom1);
                const result = weave.insert(atom2);

                // atom1 is the winner
                const current = {
                    id: 'test',
                    time: 0,
                };

                const next = updateSite(current, result);

                expect(next).toEqual({
                    id: 'test',
                    time: 7,
                });
            });
        });
    });

    describe('createAtom()', () => {
        it('should return an atom with the site info', () => {
            const site = {
                id: 'test',
                time: 10,
            };
            const a1 = createAtom(site, null, {});

            expect(a1).toEqual(atom(atomId('test', 11), null, {}));
        });
    });

    describe('addAtom()', () => {
        let weave: Weave<any>;
        let site: SiteStatus;

        beforeEach(() => {
            weave = new Weave();
            site = {
                id: 'site-id',
                time: 0,
            };
        });

        it('should add the given atom to the weave', () => {
            const a1 = createAtom(site, null, {});

            const result = addAtom(weave, site, a1);

            expect(result).toEqual({
                site: {
                    id: site.id,
                    time: site.time + 1,
                },
                result: {
                    type: 'atom_added',
                    atom: a1,
                },
                atom: a1,
            });
        });

        it('should return a null atom when the atom is invalid for some reason', () => {
            const a1 = createAtom(site, null, {});
            const a2 = createAtom(site, a1, {});

            const result = addAtom(weave, site, a2);

            expect(result).toEqual({
                site: site,
                result: {
                    type: 'cause_not_found',
                    atom: a2,
                },
                atom: null,
            });
        });

        it('should return the winning atom in a conflict', () => {
            const a1 = createAtom(site, null, {
                abc: 'def',
            });
            const a2 = createAtom(site, null, {
                ghi: 123,
            });

            const hashes = [a1.hash, a2.hash].sort();
            expect(hashes).toEqual([a1.hash, a2.hash]);

            weave.insert(a2);
            const result = addAtom(weave, site, a1);

            expect(result).toEqual({
                site: {
                    id: site.id,
                    time: site.time + 1,
                },
                result: {
                    type: 'conflict',
                    winner: a1,
                    loser: a2,
                    loserRef: expect.anything(),
                },
                atom: a1,
            });
        });
    });
});
