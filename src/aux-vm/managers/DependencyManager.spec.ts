import { DependencyManager } from './DependencyManager';
import { createBot } from '@casual-simulation/aux-common';
import { MemoryPartition, createMemoryPartition } from '../partitions';
import merge = require('lodash/merge');

describe('DependencyManager', () => {
    let partition: MemoryPartition;
    beforeEach(() => {
        partition = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
    });

    const nullOrUndefinedCases = [['null', null], ['undefined', undefined]];

    describe('addBot()', () => {
        it('should add all of the given bots tags to the tag map', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                tag: 123,
                hello: 'world',
            });

            let test2 = createBot('test2', {
                tag: 123,
                other: 'cool',
            });

            subject.addBot(test);
            subject.addBot(test2);

            const tags = subject.getTagMap();

            expect(tags).toEqual(
                new Map([
                    ['id', ['test', 'test2']],
                    ['tag', ['test', 'test2']],
                    ['hello', ['test']],
                    ['other', ['test2']],
                ])
            );
        });

        it('should add the bots to the bot map', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                hello: 'world',
                tag: 123,
            });

            let test2 = createBot('test2', {
                other: 'cool',
                tag: 123,
            });

            subject.addBot(test);
            subject.addBot(test2);

            const map = subject.getBotMap();

            // Should sort tags alphabetically
            expect(map).toEqual(
                new Map([
                    ['test', ['id', 'hello', 'tag']],
                    ['test2', ['id', 'other', 'tag']],
                ])
            );
        });

        it('should be able to retrieve tag the dependencies the bot has', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                sum: '=math.sum(getBotTagValues("num"))',
                numObjs:
                    '=math.sum(getBots("num").length, getBots("sum").length)',
                num: 55,
                extra: '=this.sum + this.num',
            });

            subject.addBot(test);

            const deps = subject.getDependencies('test');

            expect(deps).toEqual({
                sum: [{ type: 'tag', name: 'num', dependencies: [] }],
                numObjs: [
                    {
                        type: 'bot',
                        name: 'num',
                        dependencies: [],
                    },
                    {
                        type: 'bot',
                        name: 'sum',
                        dependencies: [],
                    },
                ],
                extra: [{ type: 'this' }, { type: 'this' }],
            });
        });

        it('should be able to retrieve the dependents for a tag update on another bot', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                sum: '=math.sum(getBotTagValues("num"))',
                numObjs:
                    '=math.sum(getBots("num").length, getBots("sum").length)',
                num: 55,
                extra: '=this.sum + this.num',
            });

            subject.addBot(test);

            const deps = subject.getDependents('num');

            expect(deps).toEqual({
                test: new Set(['sum', 'numObjs']),
            });
        });

        it('should be able to retrieve the dependents for a tag update on itself', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                sum: '=math.sum(getBotTagValues("num"))',
                numObjs:
                    '=math.sum(getBots("num").length, getBots("sum").length)',
                num: 55,
                extra: '=getTag(this, "#sum") + getTag(this, "#num")',
            });

            subject.addBot(test);

            const deps = subject.getDependents('num', 'test');

            expect(deps).toEqual({
                test: new Set(['sum', 'numObjs', 'extra']),
            });
        });

        it('should ignore this references (for now)', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                extra: '=getTag(this, "#sum") + getTag(this, "#num")',
            });

            subject.addBot(test);

            const deps = subject.getDependentMap();

            expect(deps).toEqual(
                new Map([
                    ['sum', { test: new Set(['extra']) }],
                    ['num', { test: new Set(['extra']) }],
                ])
            );
        });

        it('should return an empty update list when adding a bot with a dependency on nothing', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                extra: '=getBot("#name", "test")',
            });

            const updates = subject.addBot(test);

            expect(updates).toEqual({});
        });

        it.each(nullOrUndefinedCases)(
            'should ignore %s bots',
            async (desc, bot) => {
                let subject = new DependencyManager();

                const updates = subject.addBot(bot);

                expect(updates).toEqual({});
            }
        );

        it('should return a list of affected bots for bots with tag expressions', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBotTagValues("sum")',
            });

            let test2 = createBot('test2', {
                control: 'abc2',
                formula2: '=getBotTagValues("sum")',
            });

            let test3 = createBot('test3', {
                sum: 55,
            });

            let updates = subject.addBot(test);
            expect(updates).toEqual({});

            updates = subject.addBot(test2);
            expect(updates).toEqual({});

            updates = subject.addBot(test3);

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should return a list of affected bots for bots with bot expressions', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots("name")',
            });

            let test2 = createBot('test2', {
                control: 'abc2',
                formula2: '=getBots("name").bob',
            });

            let test3 = createBot('test3', {
                name: 'bot3',
                bob: true,
            });

            let updates = subject.addBot(test);
            expect(updates).toEqual({});

            updates = subject.addBot(test2);
            expect(updates).toEqual({});

            updates = subject.addBot(test3);

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should not include the new bot in the updates', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots("name")',
            });

            let test2 = createBot('test2', {
                control: 'abc2',
                formula2: '=getBots("name").bob',
            });

            let test3 = createBot('test3', {
                name: 'bot3',
                bob: true,
                formula3: '=getBots("name")',
            });

            let updates = subject.addBot(test);
            expect(updates).toEqual({});

            updates = subject.addBot(test2);
            expect(updates).toEqual({});

            updates = subject.addBot(test3);

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should handle adding bots with no tags', async () => {
            let subject = new DependencyManager();

            let test = createBot('test');

            const updates = subject.addBot(test);
            expect(updates).toEqual({});
        });

        it('should include bots that are dependent on everything in the updates list', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots(getTag(this, "control"))',
            });

            let updates = subject.addBot(test);

            let test2 = createBot('test2', {
                abc: true,
            });

            updates = subject.addBot(test2);

            expect(updates).toEqual({
                test: new Set(['formula']),
            });
        });
    });

    describe('addBots()', () => {
        it('should return an empty updates object when given an empty array', () => {
            let subject = new DependencyManager();

            const updates = subject.addBots([]);
            expect(updates).toEqual({});
        });
    });

    describe('removeBot()', () => {
        it('should remove all the tags for the given bot', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                tag: 123,
                hello: 'world',
                other: '=getBots("sum")',
            });

            subject.addBot(test);

            // Should still remove the 'hello' tag.
            subject.removeBot('test');

            const tags = subject.getTagMap();
            const bots = subject.getBotMap();
            const dependencies = subject.getDependencies('test');
            const dependents = subject.getDependents('sum', 'test');

            expect(tags).toEqual(
                new Map([['id', []], ['tag', []], ['hello', []], ['other', []]])
            );
            expect(bots).toEqual(new Map([]));
            expect(dependencies).toBe(undefined);
            expect(dependents).toEqual({});
        });

        it('should return a list of affected bots for bots with tag expressions', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBotTagValues("sum")',
            });

            let test2 = createBot('test2', {
                control: 'abc2',
                formula2: '=getBotTagValues("sum")',
            });

            let test3 = createBot('test3', {
                sum: 55,
            });

            let updates = subject.addBot(test);
            expect(updates).toEqual({});

            updates = subject.addBot(test2);
            expect(updates).toEqual({});

            updates = subject.addBot(test3);

            updates = subject.removeBot('test3');

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should return a list of affected bots for bots with bot expressions', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots("name")',
            });

            let test2 = createBot('test2', {
                control: 'abc2',
                formula2: '=getBots("name").bob',
            });

            let test3 = createBot('test3', {
                name: 'bot3',
                bob: true,
            });

            let updates = subject.addBot(test);
            expect(updates).toEqual({});

            updates = subject.addBot(test2);
            expect(updates).toEqual({});

            updates = subject.addBot(test3);

            updates = subject.removeBot('test3');

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should not include the removed bot in the updates', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots("name")',
            });

            let test2 = createBot('test2', {
                control: 'abc2',
                formula2: '=getBots("name").bob',
            });

            let test3 = createBot('test3', {
                name: 'bot3',
                bob: true,
                formula3: '=getBots("name")',
            });

            let updates = subject.addBot(test);
            expect(updates).toEqual({});

            updates = subject.addBot(test2);
            expect(updates).toEqual({});

            updates = subject.addBot(test3);

            updates = subject.removeBot('test3');

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should include bots that are dependent on everything in the updates list', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots(getTag(this, "control"))',
            });

            let updates = subject.addBot(test);

            let test2 = createBot('test2', {
                unrelated: true,
            });

            updates = subject.addBot(test2);

            updates = subject.removeBot('test2');

            expect(updates).toEqual({
                test: new Set(['formula']),
            });
        });

        it.each(nullOrUndefinedCases)(
            'should ignore %s bots',
            async (desc, bot) => {
                let subject = new DependencyManager();

                const updates = subject.removeBot(bot);

                expect(updates).toEqual({});
            }
        );
    });

    describe('removeBots()', () => {
        it('should return an empty updates object when given an empty array', () => {
            let subject = new DependencyManager();

            const updates = subject.removeBots([]);
            expect(updates).toEqual({});
        });

        it('should not return updates for bots that were removed', async () => {
            let subject = new DependencyManager();

            // degrades to a "all" dependency
            let test = createBot('test', {
                abc: 'def',
                def: true,
                formula: '=getBots(getTag(this, "abc"))',
            });

            subject.addBots([test]);

            // degrades to a "all" dependency
            let test2 = createBot('test2', {
                abc: 'def',
                def: true,
                formula: '=getBots(getTag(this, "abc"))',
            });

            subject.addBots([test2]);

            let update = subject.removeBots(['test', 'test2']);

            expect(update).toEqual({});
        });
    });

    describe('updateBot()', () => {
        it('should add new tags to the tag map', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                tag: 123,
                hello: 'world',
            });

            subject.addBot(test);

            test = createBot('test', {
                newTag: 123,
                tag: 123,
            });

            subject.updateBot({
                bot: test,
                tags: ['hello', 'newTag'],
            });

            const tags = subject.getTagMap();
            const bots = subject.getBotMap();

            expect(tags).toEqual(
                new Map([
                    ['id', ['test']],
                    ['tag', ['test']],
                    ['hello', []],
                    ['newTag', ['test']],
                ])
            );
            expect(bots).toEqual(new Map([['test', ['newTag', 'tag']]]));
        });

        it('should update the bot dependencies', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                tag: '=getTag(this, "#sum")',
                sum: '=getBotTagValues("abc")',
                hello: '=getBotTagValues("world")',
            });

            subject.addBot(test);

            test = createBot('test', {
                tag: '=getTag(this, "#sum")',
                sum: '=getBotTagValues("other")',
                newTag: '=getBots("num")',
            });

            subject.updateBot({
                bot: test,
                tags: ['hello', 'sum', 'newTag'],
            });

            const dependencies = subject.getDependencies('test');
            const dependents = subject.getDependentMap();

            expect(dependencies).toEqual({
                sum: [{ type: 'tag', name: 'other', dependencies: [] }],
                newTag: [{ type: 'bot', name: 'num', dependencies: [] }],
                tag: [
                    {
                        type: 'tag_value',
                        name: 'sum',
                        dependencies: [{ type: 'this' }],
                    },
                    { type: 'this' },
                ],
            });

            expect(dependents).toEqual(
                new Map([
                    [
                        'num',
                        {
                            test: new Set(['newTag']),
                        },
                    ],
                    [
                        'sum',
                        {
                            test: new Set(['tag']),
                        },
                    ],
                    [
                        'other',
                        {
                            test: new Set(['sum']),
                        },
                    ],
                    ['world', {}],
                    ['abc', {}],
                ])
            );
        });

        it('should return a list of affected bots for bots with tag expressions', async () => {
            let subject = new DependencyManager();
            let test = createBot('test', {
                control: 'abc',
                formula: '=getBotTagValues("sum")',
            });

            let test2 = createBot('test2', {
                control: 'abc2',
                formula2: '=getBotTagValues("sum")',
            });

            let test3 = createBot('test3', {
                sum: 55,
                formula3: '=getTag(this, "#sum")',
            });

            let updates = subject.addBot(test);
            expect(updates).toEqual({});

            updates = subject.addBot(test2);
            expect(updates).toEqual({});

            updates = subject.addBot(test3);

            test3 = createBot('test3', {
                sum: 44,
                formula3: '=getTag(this, "#sum")',
                formula4: '=getTag(this, "#sum") + 5',
            });

            updates = subject.updateBot({
                bot: test3,
                tags: ['sum', 'formula4'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3', 'formula4', 'sum']),
            });
        });

        it('should return a list of affected bots for bots with bot expressions', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots("name")',
            });

            let test2 = createBot('test2', {
                control: 'abc2',
                formula2: '=getBots("name").extra',
            });

            let test3 = createBot('test3', {
                name: 'bot3',
                abc: 5,
                formula3: '=getTag(this, "#name")',
            });

            let updates = subject.addBot(test);
            expect(updates).toEqual({});

            updates = subject.addBot(test2);
            expect(updates).toEqual({});

            updates = subject.addBot(test3);

            test3 = createBot('test3', {
                name: 'awesomeBot',
                abc: 5,
                formula3: '=getTag(this, "#name")',
                formula4: '=getTag(this, "#abc") + 5',
            });

            updates = subject.updateBot({
                bot: test3,
                tags: ['name', 'formula4'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3', 'name', 'formula4']),
            });
        });

        it('should handle removing a bots tag that has dependencies', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots("name")',
            });

            let test2 = createBot('test2', {
                control: 'abc2',
                formula2: '=getBots("name").extra',
            });

            let test3 = createBot('test3', {
                name: 'bot3',
                abc: 5,
                formula3: '=getTag(this, "#name")',
            });

            let updates = subject.addBot(test);
            expect(updates).toEqual({});

            updates = subject.addBot(test2);
            expect(updates).toEqual({});

            updates = subject.addBot(test3);

            test3 = createBot('test3', {
                abc: 5,
                formula3: '=getTag(this, "#name")',
            });

            updates = subject.updateBot({
                bot: test3,
                tags: ['name'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3', 'name']),
            });
        });

        it('should handle nested dependencies', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                formula: '=getBotTagValues("formula2")',
            });

            let test2 = createBot('test2', {
                formula2: '=getBots("formula3")',
            });

            let test3 = createBot('test3', {
                formula3: '=getBots("name")',
            });

            let test4 = createBot('test4', {
                name: 'bot4',
            });

            let updates = subject.addBot(test);
            updates = subject.addBot(test2);
            updates = subject.addBot(test3);

            test3 = createBot('test3', {
                name: 'newName',
                formula3: '=getBots("name")',
            });

            updates = subject.updateBot({
                bot: test3,
                tags: ['name'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3', 'name']),
            });
        });

        it('should handle nested dependencies and this references', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                val: '=getTag(this, "#formula")',
                formula: '=getBotTagValues("formula2")',
            });

            let test2 = createBot('test2', {
                formula2: '=getBots("formula3")',
            });

            let test3 = createBot('test3', {
                formula3: '=getBots("name")',
            });

            let test4 = createBot('test4', {
                name: 'bot4',
            });

            let updates = subject.addBot(test);
            updates = subject.addBot(test2);
            updates = subject.addBot(test3);

            test3 = createBot('test3', {
                formula3: '=getBots("name")',
                name: 'newName',
            });

            updates = subject.updateBot({
                bot: test3,
                tags: ['name'],
            });

            expect(updates).toEqual({
                test: new Set(['val', 'formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3', 'name']),
            });
        });

        it.each(nullOrUndefinedCases)(
            'should ignore %s bots',
            async (desc, bot) => {
                let subject = new DependencyManager();

                const updates = subject.updateBot(bot);

                expect(updates).toEqual({});
            }
        );

        it.each(nullOrUndefinedCases)(
            'should ignore updates with a %s bot',
            async (desc, bot) => {
                let subject = new DependencyManager();

                const updates = subject.updateBot({
                    bot: bot,
                    tags: ['abc'],
                });

                expect(updates).toEqual({});
            }
        );

        const formulas = ['=getBot("#tag")', '=player.getCurrentUniverse()'];

        const cases = [];
        for (let formula of formulas) {
            for (let i = 1; i < formula.length; i++) {
                let sub = formula.substr(0, i);
                cases.push([sub]);
            }
        }
        it.each(cases)('should support %s', async formula => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                formula: 'abc',
            });
            subject.addBot(test);

            test = createBot('test', {
                formula: formula,
            });

            subject.updateBot({
                bot: test,
                tags: ['formula'],
            });
        });

        it('should include bots that are dependent on everything in the updates list', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots(getTag(this, "control"))',
            });

            let updates = subject.addBot(test);

            let test2 = createBot('test2', {
                unrelated: true,
            });

            updates = subject.addBot(test2);

            test2 = createBot('test2', {
                unrelated: false,
            });

            updates = subject.updateBot({
                bot: test2,
                tags: ['unrelated'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['unrelated']),
            });
        });

        it('should remove all dependencies when theyre no longer needed', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                control: 'abc',
                formula: '=getBots(getTag(this, "control"))',
            });

            let updates = subject.addBot(test);

            let test2 = createBot('test2', {
                unrelated: true,
            });

            updates = subject.addBot(test2);

            test = createBot('test', {
                control: 'abc',
                formula: '=getBots("tag")',
            });

            subject.updateBot({
                bot: test,
                tags: ['formula'],
            });

            test2 = createBot('test2', {
                unrelated: false,
            });

            updates = subject.updateBot({
                bot: test2,
                tags: ['unrelated'],
            });

            expect(updates).toEqual({
                test2: new Set(['unrelated']),
            });
        });

        it('should handle dependencies on a formula that is being changed', async () => {
            let subject = new DependencyManager();

            let test = createBot('test', {
                label: '=getTag(this, "formula")',
                formula: '=getBots("#formula").length',
            });

            let other = createBot('other', {
                formula: 'abc',
            });

            let updates = subject.addBot(test);
            updates = subject.addBot(other);

            test = createBot('test', {
                label: '=getTag(this, "formula")',
                formula: '=getBots("#tag").length',
            });

            updates = subject.updateBot({
                bot: test,
                tags: ['formula'],
            });

            expect(updates).toEqual({
                test: new Set(['formula', 'label']),
            });

            const deps = subject.getDependents('formula');

            expect(deps).toEqual({
                test: new Set(['label']),
            });
        });
    });

    describe('updateBots()', () => {
        it('should return an empty updates object when given an empty array', () => {
            let subject = new DependencyManager();

            const updates = subject.updateBots([]);
            expect(updates).toEqual({});
        });
    });
});
