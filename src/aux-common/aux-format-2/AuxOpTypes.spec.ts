import { fileId } from './AuxOpTypes';
import { atomId } from '@casual-simulation/causal-trees/core2/Atom2';

describe('AuxOpTypes', () => {
    describe('fileId()', () => {
        it('should return the File ID for the Atom ID', () => {
            expect(fileId(atomId('a', 123))).toMatchInlineSnapshot(
                `"49cb1ce6-3829-57c8-847f-bbcb1b14849e"`
            );
        });
    });
});
