import type { RuntimeBot } from '@casual-simulation/aux-common';
import { CLEAR_CHANGES_SYMBOL, COOKIE_BOT_PARTITION_ID, SET_TAG_MASK_SYMBOL, TEMPORARY_BOT_PARTITION_ID } from '@casual-simulation/aux-common';
import { createDummyRuntimeBot } from '@casual-simulation/aux-runtime/runtime/test/TestScriptBotFactory';
import expect from './expect';

describe('expect()', () => {
    describe('toBe()', () => {
        it('should throw an error if the values are not the same', () => {
            expect(() => {
                expect(true).toBe(false);
            }).toThrow();
        });

        it('should throw an error if the bots are not the same', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const alsoBot1 = createDummyRuntimeBot('test1');
            bot1[SET_TAG_MASK_SYMBOL]('abc', 'def', TEMPORARY_BOT_PARTITION_ID);
            alsoBot1[SET_TAG_MASK_SYMBOL]('abc', 'def', TEMPORARY_BOT_PARTITION_ID);

            // TODO: Make this print a more accurate error message for bots.
            expect(() => {
                expect(bot1).toBe(alsoBot1);
            }).toThrowErrorMatchingSnapshot();
        });
    });

    describe('toEqual()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let alsoBot1: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            alsoBot1 = createDummyRuntimeBot('test1');
        });

        it('should throw when bots have different tags', () => {
            bot1.tags.abc = 'def';
            expect(() => {
                expect(bot1).toEqual(alsoBot1);
            }).toThrowErrorMatchingSnapshot();
        });

        it('should throw when bots have different IDs', () => {
            expect(() => {
                expect(bot1).toEqual(bot2);
            }).toThrowErrorMatchingSnapshot();
        });

        it('should not throw when the bots are the same', () => {
            bot1.tags.abc = 'def';
            alsoBot1.tags.abc = 'def';
            expect(() => {
                expect(bot1).toEqual(alsoBot1);
            }).not.toThrow();
        });

        it('should not throw when bots are in an equal object', () => {
            bot1.tags.abc = 'def';
            alsoBot1.tags.abc = 'def';
            expect(() => {
                expect({
                    bot: bot1,
                })
                    .toEqual({
                        bot: alsoBot1,
                    });
            }).not.toThrow();
        });

        it('should throw when bots have the same tag mask but in a different space', () => {
            bot1[SET_TAG_MASK_SYMBOL]('abc', 'def', TEMPORARY_BOT_PARTITION_ID);
            alsoBot1[SET_TAG_MASK_SYMBOL]('abc', 'def', COOKIE_BOT_PARTITION_ID);
            expect(() => {
                expect({
                    bot: bot1,
                })
                    .toEqual({
                        bot: alsoBot1,
                    });
            }).toThrowErrorMatchingSnapshot();
        });

        it('should not throw when bots have the same tag masks but one has changes and the other does not', () => {
            bot1[SET_TAG_MASK_SYMBOL]('abc', 'def', TEMPORARY_BOT_PARTITION_ID);
            alsoBot1[SET_TAG_MASK_SYMBOL]('abc', 'def', TEMPORARY_BOT_PARTITION_ID);

            bot1[CLEAR_CHANGES_SYMBOL]();
            expect(() => {
                expect({
                    bot: bot1,
                })
                    .toEqual({
                        bot: alsoBot1,
                    });
            }).not.toThrow();
        });
    });
});