import {
    AuxCausalTree,
    createFile,
    createCalculationContext,
    createPrecalculatedFile,
} from '@casual-simulation/aux-common';
import { FileHelper } from './FileHelper';
import { PrecalculationManager } from './PrecalculationManager';
import { storedTree, site } from '@casual-simulation/causal-trees';
import { DependencyManager } from './DependencyManager';
import { values } from 'lodash';

describe('PrecalculationManager', () => {
    let tree: AuxCausalTree;
    let precalc: PrecalculationManager;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        precalc = new PrecalculationManager(
            () => tree.value,
            () => createCalculationContext(values(tree.value), 'user')
        );

        await tree.root();
        await tree.addFile(createFile('user'));
    });

    describe('fileAdded()', () => {
        it('should calculate all the tags for the new file', async () => {
            await tree.addFile(
                createFile('test', {
                    abc: 'def',
                    formula: '=getTag(this, "#abc")',
                })
            );

            const update = precalc.filesAdded([tree.value['test']]);

            expect(update).toEqual({
                state: {
                    test: {
                        id: 'test',
                        precalculated: true,
                        tags: {
                            abc: 'def',
                            formula: '=getTag(this, "#abc")',
                        },
                        values: {
                            abc: 'def',
                            formula: 'def',
                        },
                    },
                },
                addedFiles: ['test'],
                removedFiles: [],
                updatedFiles: [],
            });
        });

        it('should update tags affected by the new file', async () => {
            await tree.addFile(
                createFile('test', {
                    formula: '=getBots("#name", "bob").length',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.addFile(
                createFile('test2', {
                    name: 'bob',
                })
            );

            const update = precalc.filesAdded([tree.value['test2']]);

            expect(update).toEqual({
                state: {
                    test: {
                        values: {
                            formula: 1,
                        },
                    },
                    test2: {
                        id: 'test2',
                        precalculated: true,
                        tags: {
                            name: 'bob',
                        },
                        values: {
                            name: 'bob',
                        },
                    },
                },
                addedFiles: ['test2'],
                removedFiles: [],
                updatedFiles: ['test'],
            });
        });

        it('should replace non-copiable values with copiable ones', async () => {
            await tree.addFile(
                createFile('test', {
                    formula: '=getBots',
                })
            );

            const state = precalc.filesAdded([tree.value['test']]);

            expect(state).toEqual({
                state: {
                    test: createPrecalculatedFile(
                        'test',
                        {
                            formula: '[Function getBots]',
                        },
                        {
                            formula: '=getBots',
                        }
                    ),
                },
                addedFiles: ['test'],
                removedFiles: [],
                updatedFiles: [],
            });
        });

        it('should return only the state that was updated', async () => {
            await tree.addFile(
                createFile('test', {
                    formula: '=getBots("#name", "bob").length',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.addFile(
                createFile('test2', {
                    name: 'bob',
                })
            );

            const update = precalc.filesAdded([tree.value['test2']]);

            expect(update).toEqual({
                state: {
                    test: {
                        values: {
                            formula: 1,
                        },
                    },
                    test2: {
                        id: 'test2',
                        precalculated: true,
                        tags: {
                            name: 'bob',
                        },
                        values: {
                            name: 'bob',
                        },
                    },
                },
                addedFiles: ['test2'],
                removedFiles: [],
                updatedFiles: ['test'],
            });
        });

        it('should be able to get the full state', async () => {
            await tree.addFile(
                createFile('test', {
                    formula: '=getBots("#name", "bob").length',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.addFile(
                createFile('test2', {
                    name: 'bob',
                })
            );

            precalc.filesAdded([tree.value['test2']]);

            expect(precalc.filesState).toEqual({
                test: {
                    id: 'test',
                    precalculated: true,
                    tags: {
                        formula: '=getBots("#name", "bob").length',
                    },
                    values: {
                        formula: 1,
                    },
                },
                test2: {
                    id: 'test2',
                    precalculated: true,
                    tags: {
                        name: 'bob',
                    },
                    values: {
                        name: 'bob',
                    },
                },
            });
        });
    });

    describe('fileRemoved()', () => {
        it('should remove the given file from the list', async () => {
            await tree.addFile(
                createFile('test', {
                    abc: 'def',
                    formula: '=getTag(this, "#abc")',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.removeFile(tree.value['test']);

            const update = precalc.filesRemoved(['test']);

            expect(update).toEqual({
                state: {
                    test: null,
                },
                addedFiles: [],
                removedFiles: ['test'],
                updatedFiles: [],
            });
        });

        it('should update tags affected by the removed file', async () => {
            await tree.addFile(
                createFile('test', {
                    formula: '=getBots("#name", "bob").length',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.addFile(
                createFile('test2', {
                    name: 'bob',
                })
            );

            precalc.filesAdded([tree.value['test2']]);

            await tree.removeFile(tree.value['test2']);

            const update = precalc.filesRemoved(['test2']);

            expect(update).toEqual({
                state: {
                    test: {
                        values: {
                            formula: 0,
                        },
                    },
                    test2: null,
                },
                addedFiles: [],
                removedFiles: ['test2'],
                updatedFiles: ['test'],
            });
        });

        it('should update the files state', async () => {
            await tree.addFile(
                createFile('test', {
                    formula: '=getBots("#name", "bob").length',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.addFile(
                createFile('test2', {
                    name: 'bob',
                })
            );

            precalc.filesAdded([tree.value['test2']]);

            await tree.removeFile(tree.value['test2']);

            precalc.filesRemoved(['test2']);

            expect(precalc.filesState).toEqual({
                test: {
                    id: 'test',
                    precalculated: true,
                    tags: {
                        formula: '=getBots("#name", "bob").length',
                    },
                    values: {
                        formula: 0,
                    },
                },
            });
        });

        it('should handle removing two files that are dependent on each other', async () => {
            // degrades to a "all" dependency
            await tree.addFile(
                createFile('test', {
                    abc: 'def',
                    def: true,
                    formula: '=getBots(getTag(this, "abc"))',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            // degrades to a "all" dependency
            await tree.addFile(
                createFile('test2', {
                    abc: 'def',
                    def: true,
                    formula: '=getBots(getTag(this, "abc"))',
                })
            );

            precalc.filesAdded([tree.value['test2']]);

            await tree.removeFile(tree.value['test']);
            await tree.removeFile(tree.value['test2']);

            let update = precalc.filesRemoved(['test', 'test2']);

            expect(update).toEqual({
                state: {
                    test: null,
                    test2: null,
                },
                addedFiles: [],
                removedFiles: ['test', 'test2'],
                updatedFiles: [],
            });

            expect(precalc.filesState).toEqual({});
        });
    });

    describe('fileUpdated()', () => {
        it('should update the affected tags on the given file', async () => {
            await tree.addFile(
                createFile('test', {
                    abc: 'def',
                    formula: '=getTag(this, "#abc")',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.updateFile(tree.value['test'], {
                tags: {
                    abc: 'ghi',
                },
            });

            const update = precalc.filesUpdated([
                {
                    file: tree.value['test'],
                    tags: ['abc'],
                },
            ]);

            expect(update).toEqual({
                state: {
                    test: {
                        tags: {
                            abc: 'ghi',
                        },
                        values: {
                            abc: 'ghi',
                            formula: 'ghi',
                        },
                    },
                },
                addedFiles: [],
                removedFiles: [],
                updatedFiles: ['test'],
            });
        });

        it('should update tags affected by the updated file', async () => {
            await tree.addFile(
                createFile('test', {
                    formula: '=getBots("#name", "bob").length',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.addFile(
                createFile('test2', {
                    name: 'bob',
                })
            );

            precalc.filesAdded([tree.value['test2']]);

            await tree.updateFile(tree.value['test2'], {
                tags: {
                    name: 'alice',
                },
            });

            const update = precalc.filesUpdated([
                {
                    file: tree.value['test2'],
                    tags: ['name'],
                },
            ]);

            expect(update).toEqual({
                state: {
                    test: {
                        values: {
                            formula: 0,
                        },
                    },
                    test2: {
                        tags: {
                            name: 'alice',
                        },
                        values: {
                            name: 'alice',
                        },
                    },
                },
                addedFiles: [],
                removedFiles: [],
                updatedFiles: ['test2', 'test'],
            });
        });

        it('should update the files state', async () => {
            await tree.addFile(
                createFile('test', {
                    formula: '=getBots("#name", "bob").length',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.addFile(
                createFile('test2', {
                    name: 'bob',
                })
            );

            precalc.filesAdded([tree.value['test2']]);

            await tree.updateFile(tree.value['test2'], {
                tags: {
                    name: 'alice',
                },
            });

            precalc.filesUpdated([
                {
                    file: tree.value['test2'],
                    tags: ['name'],
                },
            ]);

            expect(precalc.filesState).toEqual({
                test: {
                    id: 'test',
                    precalculated: true,
                    tags: {
                        formula: '=getBots("#name", "bob").length',
                    },
                    values: {
                        formula: 0,
                    },
                },
                test2: {
                    id: 'test2',
                    precalculated: true,
                    tags: {
                        name: 'alice',
                    },
                    values: {
                        name: 'alice',
                    },
                },
            });
        });

        it('should replace non-copiable values with copiable ones', async () => {
            await tree.addFile(
                createFile('test', {
                    formula: '="test"',
                })
            );

            precalc.filesAdded([tree.value['test']]);

            await tree.updateFile(tree.value['test'], {
                tags: {
                    formula: '=getBots',
                },
            });

            const state = precalc.filesUpdated([
                {
                    file: tree.value['test'],
                    tags: ['formula'],
                },
            ]);

            expect(state).toEqual({
                state: {
                    test: {
                        tags: {
                            formula: '=getBots',
                        },
                        values: {
                            formula: '[Function getBots]',
                        },
                    },
                },
                addedFiles: [],
                removedFiles: [],
                updatedFiles: ['test'],
            });
        });

        const nullTagCases = [[''], [null], [undefined]];

        it.each(nullTagCases)(
            'should mark tags set to %s as null',
            async val => {
                await tree.addFile(
                    createFile('test', {
                        formula: '="test"',
                    })
                );

                precalc.filesAdded([tree.value['test']]);

                await tree.updateFile(tree.value['test'], {
                    tags: {
                        formula: val,
                    },
                });

                const state = precalc.filesUpdated([
                    {
                        file: tree.value['test'],
                        tags: ['formula'],
                    },
                ]);

                expect(state).toEqual({
                    state: {
                        test: {
                            tags: {
                                formula: null,
                            },
                            values: {
                                formula: null,
                            },
                        },
                    },
                    addedFiles: [],
                    removedFiles: [],
                    updatedFiles: ['test'],
                });
            }
        );
    });
});
