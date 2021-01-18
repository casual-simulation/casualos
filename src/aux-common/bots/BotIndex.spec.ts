import { BotIndex, BotIndexEvent } from './BotIndex';
import { createBot, createPrecalculatedBot } from './BotCalculations';
import { merge } from '../utils';
import { skip } from 'rxjs/operators';

describe('BotIndex', () => {
    let subject: BotIndex;

    beforeEach(() => {
        subject = new BotIndex();
    });

    describe('addBots()', () => {
        it('should add all the tags on the bot to the index', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

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
            subject.addBots([test]);
            subject.addBots([test2]);

            const results = subject.findBotsWithTag('abc');

            expect(results).toEqual([test, test2]);
        });
    });

    describe('updateBots()', () => {
        it('should track new tags', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            let update = {
                tags: {
                    new: 123,
                },
            };

            const final = merge(test, update);
            subject.updateBots([
                {
                    bot: final,
                    tags: new Set(['new']),
                },
            ]);

            const results = subject.findBotsWithTag('new');

            expect(results).toEqual([final]);
        });

        it('should track removed tags', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            const update = {
                tags: {
                    abc: null as string,
                },
            } as const;

            const final = merge(test, update);
            subject.updateBots([
                {
                    bot: final,
                    tags: new Set(['abc']),
                },
            ]);

            const results = subject.findBotsWithTag('abc');

            expect(results).toEqual([]);
        });

        it('should ignore updated tags', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            const update = {
                tags: {
                    abc: 'other',
                },
            } as const;

            const final = merge(test, update);
            subject.updateBots([
                {
                    bot: final,
                    tags: new Set(['abc']),
                },
            ]);

            const results = subject.findBotsWithTag('abc');

            expect(results).toEqual([final]);
        });

        it('should use the calculated tag values', () => {
            const test = createPrecalculatedBot('test', {
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            const update = {
                values: {
                    abc: 123,
                },
            } as const;

            const final = merge(test, update);
            const events = subject.updateBots([
                {
                    bot: final,
                    tags: new Set(['abc']),
                },
            ]);

            expect(events).toEqual([
                {
                    bot: final,
                    tag: 'abc',
                    type: 'bot_tag_added',
                },
            ]);
        });
    });

    describe('removeBots()', () => {
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
            subject.addBots([test]);
            subject.addBots([test2]);

            subject.removeBots(['test2']);

            const results = subject.findBotsWithTag('abc');

            expect(results).toEqual([test]);
        });
    });

    describe('watchTag()', () => {
        it('should issue bot_tag_added events when a bot is added for the tag', () => {
            let events: BotIndexEvent[] = [];

            subject.watchTag('abc').subscribe((e) => events.push(...e));

            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            expect(events).toEqual([
                {
                    type: 'bot_tag_added',
                    bot: test,
                    tag: 'abc',
                },
            ]);
        });

        it('should issue bot_tag_added events for every bot that has already been added for the tag', () => {
            let events: BotIndexEvent[] = [];

            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            subject.watchTag('abc').subscribe((e) => events.push(...e));
            expect(events).toEqual([
                {
                    type: 'bot_tag_added',
                    bot: test,
                    tag: 'abc',
                },
            ]);
        });

        it('should issue bot_tag_removed events when a bot is removed for the tag', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            let events: BotIndexEvent[] = [];

            subject
                .watchTag('abc')
                .pipe(skip(1))
                .subscribe((e) => events.push(...e));

            subject.removeBots(['test']);

            expect(events).toEqual([
                {
                    type: 'bot_tag_removed',
                    bot: test,
                    tag: 'abc',
                },
            ]);
        });

        it('should issue bot_tag_removed events when a tag is removed from a bot', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            let events: BotIndexEvent[] = [];

            subject
                .watchTag('abc')
                .pipe(skip(1))
                .subscribe((e) => events.push(...e));

            let update = {
                tags: {
                    abc: null as string,
                },
            };

            const final = merge(test, update);
            subject.updateBots([
                {
                    bot: final,
                    tags: new Set(['abc']),
                },
            ]);

            expect(events).toEqual([
                {
                    type: 'bot_tag_removed',
                    bot: final,
                    oldBot: test,
                    tag: 'abc',
                },
            ]);
        });

        it('should issue bot_tag_added events when a tag is added to a bot', () => {
            const test = createBot('test', {
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            let events: BotIndexEvent[] = [];

            subject.watchTag('abc').subscribe((e) => events.push(...e));

            let update = {
                tags: {
                    abc: 'def',
                },
            };

            const final = merge(test, update);
            subject.updateBots([
                {
                    bot: final,
                    tags: new Set(['abc']),
                },
            ]);

            expect(events).toEqual([
                {
                    type: 'bot_tag_added',
                    bot: final,
                    tag: 'abc',
                },
            ]);
        });

        it('should issue bot_tag_updated events when a tag is updated on a bot', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            let events: BotIndexEvent[] = [];

            subject
                .watchTag('abc')
                .pipe(skip(1))
                .subscribe((e) => events.push(...e));

            let update = {
                tags: {
                    abc: 'lol',
                },
            };

            const final = merge(test, update);
            subject.updateBots([
                {
                    bot: final,
                    tags: new Set(['abc']),
                },
            ]);

            expect(events).toEqual([
                {
                    type: 'bot_tag_updated',
                    bot: final,
                    oldBot: test,
                    tag: 'abc',
                },
            ]);
        });
    });

    describe('events', () => {
        it('should issue bot_tag_added events for all the existing tags', () => {
            const test = createBot('test', {
                abc: 'def',
                ghi: 'jkl',
                mno: 'pqr',
            });
            subject.addBots([test]);

            let events: BotIndexEvent[] = [];
            subject.events.subscribe((e) => events.push(...e));

            expect(events).toEqual([
                {
                    type: 'bot_tag_added',
                    bot: test,
                    tag: 'abc',
                },
                {
                    type: 'bot_tag_added',
                    bot: test,
                    tag: 'ghi',
                },
                {
                    type: 'bot_tag_added',
                    bot: test,
                    tag: 'mno',
                },
            ]);
        });
    });
});
