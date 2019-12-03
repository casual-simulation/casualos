import { atom, atomId } from './Atom2';
import {
    repoAtom,
    getObjectHash,
    repoIndex,
    repoCommit,
} from './CausalRepoObject';
import { createIndex } from './AtomIndex';
import { getHash } from '@casual-simulation/crypto';

describe('CausalRepoObject', () => {
    describe('repoCommit()', () => {
        it('should calculate the hash of the commit', () => {
            const commit = repoCommit(
                'message',
                new Date(2019, 9, 4, 9, 0, 0),
                'hash',
                'previousCommitHash'
            );

            expect(commit.hash).toEqual(
                getHash([
                    'message',
                    new Date(2019, 9, 4, 9, 0, 0),
                    'hash',
                    'previousCommitHash',
                ])
            );
        });

        it('should support null for the previous commit', () => {
            const commit = repoCommit(
                'message',
                new Date(2019, 9, 4, 9, 0, 0),
                'hash',
                null
            );

            expect(commit.hash).toEqual(
                getHash([
                    'message',
                    new Date(2019, 9, 4, 9, 0, 0),
                    'hash',
                    null,
                ])
            );
        });
    });

    describe('getObjectHash()', () => {
        it('should return the atom hash', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const obj = repoAtom(a1);
            const hash = getObjectHash(obj);

            expect(hash).toBe(a1.hash);
        });

        it('should return the atom index hash', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a1, {});

            const index = createIndex([a1, a2, a3]);
            const obj = repoIndex(index);
            const hash = getObjectHash(obj);

            expect(hash).toBe(index.hash);
        });

        it('should return the atom commit hash', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a1, {});

            const index = createIndex([a1, a2, a3]);

            const obj = repoCommit(
                'message',
                new Date(2019, 9, 4, 9, 0, 0),
                index.hash,
                null
            );
            const hash = getObjectHash(obj);

            expect(hash).toBe(obj.hash);
        });

        it('should return null if given null', () => {
            expect(getObjectHash(null)).toBe(null);
        });
    });
});
