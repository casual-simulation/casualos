import { DependencyManager } from './DependencyManager';
import { AuxCausalTree, createBot } from '@casual-simulation/aux-common';
import { storedTree, site } from '@casual-simulation/causal-trees';

describe('DependencyManager', () => {
    describe('addFile()', () => {
        it('should add all of the given bots tags to the tag map', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    tag: 123,
                    hello: 'world',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    tag: 123,
                    other: 'cool',
                })
            );

            subject.addFile(tree.value['test']);
            subject.addFile(tree.value['test2']);

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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    tag: 123,
                    hello: 'world',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    tag: 123,
                    other: 'cool',
                })
            );

            subject.addFile(tree.value['test']);
            subject.addFile(tree.value['test2']);

            const map = subject.getFileMap();

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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    sum: '=math.sum(getBotTagValues("num"))',
                    numObjs:
                        '=math.sum(getBots("num").length, getBots("sum").length)',
                    num: 55,
                    extra: '=this.sum + this.num',
                })
            );

            subject.addFile(tree.value['test']);

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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    sum: '=math.sum(getBotTagValues("num"))',
                    numObjs:
                        '=math.sum(getBots("num").length, getBots("sum").length)',
                    num: 55,
                    extra: '=this.sum + this.num',
                })
            );

            subject.addFile(tree.value['test']);

            const deps = subject.getDependents('num');

            expect(deps).toEqual({
                test: new Set(['sum', 'numObjs']),
            });
        });

        it('should be able to retrieve the dependents for a tag update on itself', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    sum: '=math.sum(getBotTagValues("num"))',
                    numObjs:
                        '=math.sum(getBots("num").length, getBots("sum").length)',
                    num: 55,
                    extra: '=getTag(this, "#sum") + getTag(this, "#num")',
                })
            );

            subject.addFile(tree.value['test']);

            const deps = subject.getDependents('num', 'test');

            expect(deps).toEqual({
                test: new Set(['sum', 'numObjs', 'extra']),
            });
        });

        it('should ignore this references (for now)', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    extra: '=getTag(this, "#sum") + getTag(this, "#num")',
                })
            );

            subject.addFile(tree.value['test']);

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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    extra: '=getBot("#name", "test")',
                })
            );

            const updates = subject.addFile(tree.value['test']);

            expect(updates).toEqual({});
        });

        // TODO: Re-add support for dependencies on specific bots
        // it('should handle this references by adding a reference for each accessed tag', async () => {
        //     let subject = new DependencyManager();

        //     let tree = new AuxCausalTree(storedTree(site(1)));

        //     await tree.root();

        //     await tree.addFile(
        //         createBot('test', {
        //             extra: '=getTag(this, "#aux.label.color") + getTag(this, "#aux.label")',
        //         })
        //     );

        //     subject.addFile(tree.value['test']);

        //     const deps = subject.getDependentMap();

        //     expect(deps).toEqual(
        //         new Map([
        //             [
        //                 'test:aux.label.color',
        //                 {
        //                     test: new Set(['extra']),
        //                 },
        //             ],
        //             [
        //                 'test:aux.label',
        //                 {
        //                     test: new Set(['extra']),
        //                 },
        //             ],
        //         ])
        //     );
        // });

        it('should return a list of affected bots for bots with tag expressions', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBotTagValues("sum")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    control: 'abc2',
                    formula2: '=getBotTagValues("sum")',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    sum: 55,
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should return a list of affected bots for bots with bot expressions', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots("name")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    control: 'abc2',
                    formula2: '=getBots("name").bob',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    name: 'file3',
                    bob: true,
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should not include the new bot in the updates', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots("name")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    control: 'abc2',
                    formula2: '=getBots("name").bob',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    name: 'file3',
                    bob: true,
                    formula3: '=getBots("name")',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should handle adding bots with no tags', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            await tree.addFile(createBot('test'));

            const updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});
        });

        it('should include bots that are dependent on everything in the updates list', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            await tree.addFile(createBot('test'));

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots(getTag(this, "control"))',
                })
            );

            let updates = subject.addFile(tree.value['test']);

            await tree.addFile(
                createBot('test2', {
                    abc: true,
                })
            );

            updates = subject.addFile(tree.value['test2']);

            expect(updates).toEqual({
                test: new Set(['formula']),
            });
        });
    });

    describe('addFiles()', () => {
        it('should return an empty updates object when given an empty array', () => {
            let subject = new DependencyManager();

            const updates = subject.addFiles([]);
            expect(updates).toEqual({});
        });
    });

    describe('removeFile()', () => {
        it('should remove all the tags for the given bot', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    tag: 123,
                    hello: 'world',
                    other: '=getBots("sum")',
                })
            );

            subject.addFile(tree.value['test']);

            // Should still remove the 'hello' tag.
            subject.removeFile('test');

            const tags = subject.getTagMap();
            const bots = subject.getFileMap();
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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBotTagValues("sum")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    control: 'abc2',
                    formula2: '=getBotTagValues("sum")',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    sum: 55,
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            updates = subject.removeFile('test3');

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should return a list of affected bots for bots with bot expressions', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots("name")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    control: 'abc2',
                    formula2: '=getBots("name").bob',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    name: 'file3',
                    bob: true,
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            updates = subject.removeFile('test3');

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should not include the removed bot in the updates', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots("name")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    control: 'abc2',
                    formula2: '=getBots("name").bob',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    name: 'file3',
                    bob: true,
                    formula3: '=getBots("name")',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            updates = subject.removeFile('test3');

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should include bots that are dependent on everything in the updates list', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            await tree.addFile(createBot('test'));

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots(getTag(this, "control"))',
                })
            );

            let updates = subject.addFile(tree.value['test']);

            await tree.addFile(
                createBot('test2', {
                    unrelated: true,
                })
            );

            updates = subject.addFile(tree.value['test2']);

            updates = subject.removeFile('test2');

            expect(updates).toEqual({
                test: new Set(['formula']),
            });
        });
    });

    describe('removeFiles()', () => {
        it('should return an empty updates object when given an empty array', () => {
            let subject = new DependencyManager();

            const updates = subject.removeFiles([]);
            expect(updates).toEqual({});
        });

        it('should not return updates for bots that were removed', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            await tree.addFile(createBot('test'));

            // degrades to a "all" dependency
            await tree.addFile(
                createBot('test', {
                    abc: 'def',
                    def: true,
                    formula: '=getBots(getTag(this, "abc"))',
                })
            );

            subject.addFiles([tree.value['test']]);

            // degrades to a "all" dependency
            await tree.addFile(
                createBot('test2', {
                    abc: 'def',
                    def: true,
                    formula: '=getBots(getTag(this, "abc"))',
                })
            );

            subject.addFiles([tree.value['test2']]);

            await tree.removeFile(tree.value['test']);
            await tree.removeFile(tree.value['test2']);

            let update = subject.removeFiles(['test', 'test2']);

            expect(update).toEqual({});
        });
    });

    describe('updateBot()', () => {
        it('should add new tags to the tag map', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    tag: 123,
                    hello: 'world',
                })
            );

            subject.addFile(tree.value['test']);

            await tree.updateBot(tree.value['test'], {
                tags: {
                    hello: null,
                    newTag: 123,
                },
            });

            subject.updateBot({
                bot: tree.value['test'],
                tags: ['hello', 'newTag'],
            });

            const tags = subject.getTagMap();
            const bots = subject.getFileMap();

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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    tag: '=getTag(this, "#sum")',
                    sum: '=getBotTagValues("abc")',
                    hello: '=getBotTagValues("world")',
                })
            );

            subject.addFile(tree.value['test']);

            await tree.updateBot(tree.value['test'], {
                tags: {
                    hello: null,
                    sum: '=getBotTagValues("other")',
                    newTag: '=getBots("num")',
                },
            });

            subject.updateBot({
                bot: tree.value['test'],
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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBotTagValues("sum")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    control: 'abc2',
                    formula2: '=getBotTagValues("sum")',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    sum: 55,
                    formula3: '=getTag(this, "#sum")',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            await tree.updateBot(tree.value['test3'], {
                tags: {
                    sum: 44,
                    formula4: '=getTag(this, "#sum") + 5',
                },
            });

            updates = subject.updateBot({
                bot: tree.value['test3'],
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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots("name")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    control: 'abc2',
                    formula2: '=getBots("name").extra',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    name: 'file3',
                    abc: 5,
                    formula3: '=getTag(this, "#name")',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            await tree.updateBot(tree.value['test3'], {
                tags: {
                    name: 'awesomeFile',
                    formula4: '=getTag(this, "#abc") + 5',
                },
            });

            updates = subject.updateBot({
                bot: tree.value['test3'],
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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots("name")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    control: 'abc2',
                    formula2: '=getBots("name").extra',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    name: 'file3',
                    abc: 5,
                    formula3: '=getTag(this, "#name")',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            await tree.updateBot(tree.value['test3'], {
                tags: {
                    name: null,
                },
            });

            updates = subject.updateBot({
                bot: tree.value['test3'],
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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    formula: '=getBotTagValues("formula2")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    formula2: '=getBots("formula3")',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    formula3: '=getBots("name")',
                })
            );

            await tree.addFile(
                createBot('test4', {
                    name: 'file4',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            // expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            // expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            await tree.updateBot(tree.value['test3'], {
                tags: {
                    name: 'newName',
                },
            });

            updates = subject.updateBot({
                bot: tree.value['test3'],
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

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    val: '=getTag(this, "#formula")',
                    formula: '=getBotTagValues("formula2")',
                })
            );

            await tree.addFile(
                createBot('test2', {
                    formula2: '=getBots("formula3")',
                })
            );

            await tree.addFile(
                createBot('test3', {
                    formula3: '=getBots("name")',
                })
            );

            await tree.addFile(
                createBot('test4', {
                    name: 'file4',
                })
            );

            let updates = subject.addFile(tree.value['test']);

            updates = subject.addFile(tree.value['test2']);

            updates = subject.addFile(tree.value['test3']);

            await tree.updateBot(tree.value['test3'], {
                tags: {
                    name: 'newName',
                },
            });

            updates = subject.updateBot({
                bot: tree.value['test3'],
                tags: ['name'],
            });

            expect(updates).toEqual({
                test: new Set(['val', 'formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3', 'name']),
            });
        });

        const formulas = ['=getBot("#tag")', '=player.isDesigner()'];

        const cases = [];
        for (let formula of formulas) {
            for (let i = 1; i < formula.length; i++) {
                let sub = formula.substr(0, i);
                cases.push([sub]);
            }
        }
        it.each(cases)('should support %s', async formula => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createBot('test', {
                    formula: 'abc',
                })
            );
            subject.addFile(tree.value['test']);

            await tree.updateBot(tree.value['test'], {
                tags: {
                    formula: formula,
                },
            });

            subject.updateBot({
                bot: tree.value['test'],
                tags: ['formula'],
            });
        });

        it('should include bots that are dependent on everything in the updates list', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            await tree.addFile(createBot('test'));

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots(getTag(this, "control"))',
                })
            );

            let updates = subject.addFile(tree.value['test']);

            await tree.addFile(
                createBot('test2', {
                    unrelated: true,
                })
            );

            updates = subject.addFile(tree.value['test2']);

            await tree.updateBot(tree.value['test2'], {
                tags: {
                    unrelated: false,
                },
            });

            updates = subject.updateBot({
                bot: tree.value['test2'],
                tags: ['unrelated'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['unrelated']),
            });
        });

        it('should remove all dependencies when theyre no longer needed', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            await tree.addFile(createBot('test'));

            await tree.addFile(
                createBot('test', {
                    control: 'abc',
                    formula: '=getBots(getTag(this, "control"))',
                })
            );

            let updates = subject.addFile(tree.value['test']);

            await tree.addFile(
                createBot('test2', {
                    unrelated: true,
                })
            );

            updates = subject.addFile(tree.value['test2']);

            await tree.updateBot(tree.value['test'], {
                tags: {
                    formula: '=getBots("tag")',
                },
            });

            subject.updateBot({
                bot: tree.value['test'],
                tags: ['formula'],
            });

            await tree.updateBot(tree.value['test2'], {
                tags: {
                    unrelated: false,
                },
            });

            updates = subject.updateBot({
                bot: tree.value['test2'],
                tags: ['unrelated'],
            });

            expect(updates).toEqual({
                test2: new Set(['unrelated']),
            });
        });

        it('should handle dependencies on a formula that is being changed', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();
            await tree.addFile(createBot('test'));

            await tree.addFile(
                createBot('test', {
                    label: '=getTag(this, "formula")',
                    formula: '=getBots("#formula").length',
                })
            );

            await tree.addFile(
                createBot('other', {
                    formula: 'abc',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            updates = subject.addFile(tree.value['other']);

            await tree.updateBot(tree.value['test'], {
                tags: {
                    formula: '=getBots("#tag").length',
                },
            });

            updates = subject.updateBot({
                bot: tree.value['test'],
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

    describe('updateFiles()', () => {
        it('should return an empty updates object when given an empty array', () => {
            let subject = new DependencyManager();

            const updates = subject.updateFiles([]);
            expect(updates).toEqual({});
        });
    });
});
