import { DependencyManager } from './DependencyManager';
import { AuxCausalTree, createFile } from '@casual-simulation/aux-common';
import { storedTree, site } from '@casual-simulation/causal-trees';

describe('DependencyManager', () => {
    describe('addFile()', () => {
        it('should add all of the given files tags to the tag map', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: 123,
                    hello: 'world',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    tag: 123,
                    other: 'cool',
                })
            );

            subject.addFile(tree.value['test']);
            subject.addFile(tree.value['test2']);

            const tags = subject.getTagMap();

            expect(tags).toEqual(
                new Map([
                    ['tag', ['test', 'test2']],
                    ['hello', ['test']],
                    ['other', ['test2']],
                ])
            );
        });

        it('should add the files to the file map', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: 123,
                    hello: 'world',
                })
            );

            await tree.addFile(
                createFile('test2', {
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
                    ['test', ['hello', 'tag']],
                    ['test2', ['other', 'tag']],
                ])
            );
        });

        it('should be able to retrieve tag the dependencies the file has', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    sum: '=math.sum(#num)',
                    numObjs: '=math.sum(@num().length, @sum().length)',
                    num: 55,
                    extra: '=this.sum + this.num',
                })
            );

            subject.addFile(tree.value['test']);

            const deps = subject.getDependencies('test');

            expect(deps).toEqual({
                sum: [{ type: 'tag', name: 'num', members: [], args: [] }],
                numObjs: [
                    {
                        type: 'file',
                        name: 'num',
                        members: ['length'],
                        args: [],
                    },
                    {
                        type: 'file',
                        name: 'sum',
                        members: ['length'],
                        args: [],
                    },
                ],
                extra: [
                    { type: 'this', members: ['sum'] },
                    { type: 'this', members: ['num'] },
                ],
            });
        });

        it('should be able to retrieve the dependents for a tag update on another file', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    sum: '=math.sum(#num)',
                    numObjs: '=math.sum(@num().length, @sum().length)',
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
                createFile('test', {
                    sum: '=math.sum(#num)',
                    numObjs: '=math.sum(@num().length, @sum().length)',
                    num: 55,
                    extra: '=this.sum + this.num',
                })
            );

            subject.addFile(tree.value['test']);

            const deps = subject.getDependents('num', 'test');

            expect(deps).toEqual({
                test: new Set(['sum', 'numObjs', 'extra']),
            });
        });

        it('should handle this references by adding a reference for each group of members', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    extra: '=this.aux.label.color',
                })
            );

            subject.addFile(tree.value['test']);

            const deps = subject.getDependentMap();

            expect(deps).toEqual(
                new Map([
                    [
                        'test:aux',
                        {
                            test: new Set(['extra']),
                        },
                    ],
                    [
                        'test:aux.label',
                        {
                            test: new Set(['extra']),
                        },
                    ],
                    [
                        'test:aux.label.color',
                        {
                            test: new Set(['extra']),
                        },
                    ],
                ])
            );
        });

        it('should return a list of affected files for files with tag expressions', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    control: 'abc',
                    formula: '=#sum',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    control: 'abc2',
                    formula2: '=#sum',
                })
            );

            await tree.addFile(
                createFile('test3', {
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

        it('should return a list of affected files for files with file expressions', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    control: 'abc',
                    formula: '=@name',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    control: 'abc2',
                    formula2: '=@name().bob',
                })
            );

            await tree.addFile(
                createFile('test3', {
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

        it('should not include the new file in the updates', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    control: 'abc',
                    formula: '=@name',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    control: 'abc2',
                    formula2: '=@name().bob',
                })
            );

            await tree.addFile(
                createFile('test3', {
                    name: 'file3',
                    bob: true,
                    formula3: '=@name',
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
    });

    describe('removeFile()', () => {
        it('should remove all the tags for the given file', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: 123,
                    hello: 'world',
                    other: '=@sum',
                })
            );

            subject.addFile(tree.value['test']);

            // Should still remove the 'hello' tag.
            subject.removeFile(tree.value['test']);

            const tags = subject.getTagMap();
            const files = subject.getFileMap();
            const dependencies = subject.getDependencies('test');
            const dependents = subject.getDependents('sum', 'test');

            expect(tags).toEqual(
                new Map([['tag', []], ['hello', []], ['other', []]])
            );
            expect(files).toEqual(new Map([]));
            expect(dependencies).toBe(undefined);
            expect(dependents).toEqual({});
        });

        it('should return a list of affected files for files with tag expressions', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    control: 'abc',
                    formula: '=#sum',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    control: 'abc2',
                    formula2: '=#sum',
                })
            );

            await tree.addFile(
                createFile('test3', {
                    sum: 55,
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            updates = subject.removeFile(tree.value['test3']);

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should return a list of affected files for files with file expressions', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    control: 'abc',
                    formula: '=@name',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    control: 'abc2',
                    formula2: '=@name().bob',
                })
            );

            await tree.addFile(
                createFile('test3', {
                    name: 'file3',
                    bob: true,
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            updates = subject.removeFile(tree.value['test3']);

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });

        it('should not include the removed file in the updates', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    control: 'abc',
                    formula: '=@name',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    control: 'abc2',
                    formula2: '=@name().bob',
                })
            );

            await tree.addFile(
                createFile('test3', {
                    name: 'file3',
                    bob: true,
                    formula3: '=@name',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            updates = subject.removeFile(tree.value['test3']);

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
            });
        });
    });

    describe('updateFile()', () => {
        it('should add new tags to the tag map', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: 123,
                    hello: 'world',
                })
            );

            subject.addFile(tree.value['test']);

            await tree.updateFile(tree.value['test'], {
                tags: {
                    hello: null,
                    newTag: 123,
                },
            });

            subject.updateFile({
                file: tree.value['test'],
                tags: ['hello', 'newTag'],
            });

            const tags = subject.getTagMap();
            const files = subject.getFileMap();

            expect(tags).toEqual(
                new Map([
                    ['tag', ['test']],
                    ['hello', []],
                    ['newTag', ['test']],
                ])
            );
            expect(files).toEqual(new Map([['test', ['newTag', 'tag']]]));
        });

        it('should update the file dependencies', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    tag: '=this.sum',
                    sum: '=#abc',
                    hello: '=#world',
                })
            );

            subject.addFile(tree.value['test']);

            await tree.updateFile(tree.value['test'], {
                tags: {
                    hello: null,
                    sum: '=#other',
                    newTag: '=@num',
                },
            });

            subject.updateFile({
                file: tree.value['test'],
                tags: ['hello', 'sum', 'newTag'],
            });

            const dependencies = subject.getDependencies('test');
            const dependents = subject.getDependentMap();

            expect(dependencies).toEqual({
                sum: [{ type: 'tag', name: 'other', args: [], members: [] }],
                newTag: [{ type: 'file', name: 'num', args: [], members: [] }],
                tag: [{ type: 'this', members: ['sum'] }],
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
                        'test:sum',
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

        it('should return a list of affected files for files with tag expressions', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    control: 'abc',
                    formula: '=#sum',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    control: 'abc2',
                    formula2: '=#sum',
                })
            );

            await tree.addFile(
                createFile('test3', {
                    sum: 55,
                    formula3: '=this.sum',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            await tree.updateFile(tree.value['test3'], {
                tags: {
                    sum: 44,
                    formula4: '=this.sum + 5',
                },
            });

            updates = subject.updateFile({
                file: tree.value['test3'],
                tags: ['sum', 'formula4'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3', 'formula4']),
            });
        });

        it('should return a list of affected files for files with file expressions', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    control: 'abc',
                    formula: '=@name',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    control: 'abc2',
                    formula2: '=@name().extra',
                })
            );

            await tree.addFile(
                createFile('test3', {
                    name: 'file3',
                    abc: 5,
                    formula3: '=this.name',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            await tree.updateFile(tree.value['test3'], {
                tags: {
                    name: 'awesomeFile',
                    formula4: '=this.abc + 5',
                },
            });

            updates = subject.updateFile({
                file: tree.value['test3'],
                tags: ['name', 'formula4'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3']),
            });
        });

        it('should handle removing a files tag that has dependencies', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    control: 'abc',
                    formula: '=@name',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    control: 'abc2',
                    formula2: '=@name().extra',
                })
            );

            await tree.addFile(
                createFile('test3', {
                    name: 'file3',
                    abc: 5,
                    formula3: '=this.name',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            await tree.updateFile(tree.value['test3'], {
                tags: {
                    name: null,
                },
            });

            updates = subject.updateFile({
                file: tree.value['test3'],
                tags: ['name'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3']),
            });
        });

        it('should handle nested dependencies', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    formula: '=#formula2',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    formula2: '=@formula3()',
                })
            );

            await tree.addFile(
                createFile('test3', {
                    formula3: '=@name()',
                })
            );

            await tree.addFile(
                createFile('test4', {
                    name: 'file4',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            // expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            // expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            await tree.updateFile(tree.value['test3'], {
                tags: {
                    name: 'newName',
                },
            });

            updates = subject.updateFile({
                file: tree.value['test3'],
                tags: ['name'],
            });

            expect(updates).toEqual({
                test: new Set(['formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3']),
            });
        });

        it('should handle nested dependencies and this references', async () => {
            let subject = new DependencyManager();

            let tree = new AuxCausalTree(storedTree(site(1)));

            await tree.root();

            await tree.addFile(
                createFile('test', {
                    val: '=this.formula',
                    formula: '=#formula2',
                })
            );

            await tree.addFile(
                createFile('test2', {
                    formula2: '=@formula3()',
                })
            );

            await tree.addFile(
                createFile('test3', {
                    formula3: '=@name()',
                })
            );

            await tree.addFile(
                createFile('test4', {
                    name: 'file4',
                })
            );

            let updates = subject.addFile(tree.value['test']);
            // expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test2']);
            // expect(updates).toEqual({});

            updates = subject.addFile(tree.value['test3']);

            await tree.updateFile(tree.value['test3'], {
                tags: {
                    name: 'newName',
                },
            });

            updates = subject.updateFile({
                file: tree.value['test3'],
                tags: ['name'],
            });

            expect(updates).toEqual({
                test: new Set(['val', 'formula']),
                test2: new Set(['formula2']),
                test3: new Set(['formula3']),
            });
        });
    });
});
