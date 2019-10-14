import { BotIndex } from './BotIndex';
import { createBot } from './BotCalculations';
import { merge } from '../utils';

describe('BotIndex', () => {
    let subject: BotIndex;

    beforeEach(() => {
        subject = new BotIndex();
    });

    describe('addBot()', () => {
        it('should add all the tags on the bot to the index', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBot(test);

            const results = subject.findBotsWithTag('ghi');

            expect(results).toEqual([test]);
        });

        it('should be able to handle multiple bots', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            const test2 = createBot('test2', {
                abc: 'def',
                xyz: 'jkl',
                ws: 'pqr',
            });
            subject.addBot(test);
            subject.addBot(test2);

            const results = subject.findBotsWithTag('abc');

            expect(results).toEqual([test, test2]);
        });
    });

    describe('updateBot()', () => {
        it('should track new tags', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBot(test);

            let update = {
                tags: {
                    new: 123,
                },
            };

            const final = merge(test, update);
            subject.updateBot(final, ['new']);

            const results = subject.findBotsWithTag('new');

            expect(results).toEqual([final]);
        });

        it('should track removed tags', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBot(test);

            const update = {
                tags: {
                    abc: null as string,
                },
            } as const;

            const final = merge(test, update);
            subject.updateBot(final, ['abc']);

            const results = subject.findBotsWithTag('abc');

            expect(results).toEqual([]);
        });

        it('should ignore updated tags', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBot(test);

            const update = {
                tags: {
                    abc: 'other',
                },
            } as const;

            const final = merge(test, update);
            subject.updateBot(final, ['abc']);

            const results = subject.findBotsWithTag('abc');

            expect(results).toEqual([final]);
        });
    });

    describe('removeBot()', () => {
        it('should remove the bots tags', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            const test2 = createBot('test2', {
                abc: 'def',
                xyz: 'jkl',
                ws: 'pqr',
            });
            subject.addBot(test);
            subject.addBot(test2);

            subject.removeBot(test2);

            const results = subject.findBotsWithTag('abc');

            expect(results).toEqual([test]);
        });
    });
});
