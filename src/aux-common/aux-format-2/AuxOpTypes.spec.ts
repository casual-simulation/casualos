import { bot } from './AuxOpTypes';
import { atomId } from '@casual-simulation/causal-trees/core2/Atom2';

describe('AuxOpTypes', () => {
    describe('bot()', () => {
        it('should return a bot operation with the given ID', () => {
            expect(bot('test')).toMatchInlineSnapshot(`
                Object {
                  "id": "test",
                  "type": 1,
                }
            `);
        });
    });
});
