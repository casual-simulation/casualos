import {
    tree,
    addAtom,
    applyResult,
    TreeResult,
    mergeResults,
    addedAtoms,
    insertAtom,
    addResults,
    insertAtoms,
} from './CausalTree2';
import { createAtom, updateSite, newSite, mergeSites } from './SiteStatus';
import { atom, atomId } from './Atom2';
import { WeaveResult } from './Weave2';

describe('CausalTree2', () => {
    describe('addAtom()', () => {
        it('should create an atom for the given operation', () => {
            const subject = tree('id');
            const result = addAtom(subject, null, {});

            expect(result).toEqual({
                results: [
                    {
                        type: 'atom_added',
                        atom: subject.weave.roots[0].atom,
                    },
                ],
                newSite: {
                    id: 'id',
                    time: 1,
                },
            });
        });

        it('should create an atom for the remote site if specified', () => {
            const subject = tree('id', undefined, 'id2');
            const result = addAtom(
                subject,
                null,
                {},
                undefined,
                undefined,
                true
            );

            expect(result).toEqual({
                results: [
                    {
                        type: 'atom_added',
                        atom: subject.weave.roots[0].atom,
                    },
                ],
                newSite: {
                    id: 'id',
                    time: 2,
                },
                newRemoteSite: {
                    id: 'id2',
                    time: 1,
                },
            });
        });
    });

    describe('insertAtoms()', () => {
        it('should update the time in the tree', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const subject = tree('id');

            const results = insertAtoms(subject, [a1, a2]);

            expect(subject.site).toEqual({
                id: 'id',
                time: 3,
            });
        });

        it('should return the results', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const subject = tree('id');

            const results = insertAtoms(subject, [a1, a2]);

            expect(results).toEqual([
                {
                    type: 'atom_added',
                    atom: a1,
                },
                {
                    type: 'atom_added',
                    atom: a2,
                },
            ]);
        });
    });

    describe('applyResult()', () => {
        it('should return a new causal tree', () => {
            const subject = tree('id');
            const atom = createAtom(subject.site, null, {});
            const result = subject.weave.insert(atom);
            const newSite = updateSite(subject.site, result);

            const newTree = applyResult(subject, {
                results: [result],
                newSite,
            });

            expect(newTree.weave).toBe(subject.weave);
            expect(newTree.site).toBe(newSite);
        });
    });

    describe('mergeResults()', () => {
        it('should concatenate the result arrays', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const r1: WeaveResult = {
                type: 'atom_added',
                atom: a1,
            };
            const r2: WeaveResult = {
                type: 'atom_added',
                atom: a2,
            };
            const result1: TreeResult = {
                results: [r1],
                newSite: newSite('a', 1),
            };

            const result2: TreeResult = {
                results: [r2],
                newSite: newSite('a', 3),
            };

            const final = mergeResults(result1, result2);
            expect(final).toEqual({
                results: [r1, r2],
                newSite: mergeSites(result1.newSite, result2.newSite),
            });
        });

        it('should merge remote sites', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const r1: WeaveResult = {
                type: 'atom_added',
                atom: a1,
            };
            const r2: WeaveResult = {
                type: 'atom_added',
                atom: a2,
            };
            const result1: TreeResult = {
                results: [r1],
                newSite: newSite('a', 1),
                newRemoteSite: newSite('b', 2),
            };

            const result2: TreeResult = {
                results: [r2],
                newSite: newSite('a', 3),
                newRemoteSite: newSite('b', 3),
            };

            const final = mergeResults(result1, result2);
            expect(final).toEqual({
                results: [r1, r2],
                newSite: mergeSites(result1.newSite, result2.newSite),
                newRemoteSite: mergeSites(
                    result1.newRemoteSite,
                    result2.newRemoteSite
                ),
            });
        });
    });

    describe('addResults()', () => {
        it('should add the new results to the existing result', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), null, {});
            const r1: WeaveResult = {
                type: 'atom_added',
                atom: a1,
            };
            const r2: WeaveResult = {
                type: 'atom_added',
                atom: a2,
            };
            const result1: TreeResult = {
                results: [r1],
                newSite: newSite('a', 1),
            };

            const result2: TreeResult = {
                results: [r2],
                newSite: newSite('a', 3),
            };

            addResults(result1, result2);
            expect(result1).toEqual({
                results: [r1, r2],
                newSite: mergeSites(result1.newSite, result2.newSite),
            });
        });
    });

    describe('addedAtoms()', () => {
        it('should return all the atoms that were added', () => {
            let subject = tree('id');

            const atom1 = createAtom(subject.site, null, {});
            const result1 = insertAtom(subject, atom1);
            subject = applyResult(subject, result1);
            const atom2 = createAtom(subject.site, null, {});
            const result2 = insertAtom(subject, atom2);
            subject = applyResult(subject, result2);
            const atom3 = createAtom(subject.site, null, {});
            const result3 = insertAtom(subject, atom3);
            subject = applyResult(subject, result3);

            const finalResult = mergeResults(
                mergeResults(result1, result2),
                result3
            );

            const added = addedAtoms(finalResult.results);
            expect(added).toEqual([atom1, atom2, atom3]);
        });
    });
});
