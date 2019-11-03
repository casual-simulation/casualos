import { bot } from './AuxOpTypes';

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
