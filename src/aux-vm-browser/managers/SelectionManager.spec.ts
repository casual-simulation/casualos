import {
    createFile,
    getSelectionMode,
    createPrecalculatedFile,
    PrecalculatedBot,
    fileUpdated,
    UpdateBotAction,
} from '@casual-simulation/aux-common';
import SelectionManager from './SelectionManager';
import { FileHelper } from '@casual-simulation/aux-vm';
import { storedTree, site } from '@casual-simulation/causal-trees';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import uuid from 'uuid/v4';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('SelectionManager', () => {
    let vm: TestAuxVM;
    let helper: FileHelper;
    let manager: SelectionManager;
    let spy: jest.SpyInstance;

    beforeEach(async () => {
        vm = new TestAuxVM();
        helper = new FileHelper(vm);
        helper.userId = 'user';
        manager = new SelectionManager(helper);
    });

    beforeAll(() => {
        spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterAll(() => {
        spy.mockRestore();
    });

    describe('selectFile()', () => {
        describe('single select', () => {
            let file: PrecalculatedBot;

            beforeEach(async () => {
                helper.filesState = {
                    user: createPrecalculatedFile('user'),
                    file1: createPrecalculatedFile('file1'),
                };
                file = helper.filesState['file1'];
            });

            it('should set the user aux._selection tag to the given files ID', async () => {
                await manager.selectFile(file);

                expect(vm.events).toEqual([
                    fileUpdated('user', {
                        tags: {
                            'aux._selection': 'file1',
                            'aux._editingBot': 'file1',
                        },
                    }),
                    fileUpdated('file1', {
                        tags: {},
                    }),
                ]);
            });

            it('should not clear the user aux._selection tag if the given files ID matches the current selection', async () => {
                helper.filesState = Object.assign({}, helper.filesState, {
                    user: createPrecalculatedFile('user', {
                        'aux._selection': 'file1',
                    }),
                });

                await manager.selectFile(file);

                expect(vm.events).toEqual([]);
            });

            it('should kick the user into multi select mode if specified', async () => {
                helper.filesState = Object.assign({}, helper.filesState, {
                    user: createPrecalculatedFile('user', {
                        'aux._selection': 'file1',
                    }),
                    file2: createPrecalculatedFile('file2'),
                });

                const file = helper.filesState['file2'];
                uuidMock.mockReturnValue('abc');

                await manager.selectFile(file, true);

                expect(vm.events[0]).toEqual(
                    fileUpdated('user', {
                        tags: {
                            'aux._selectionMode': 'multi',
                            'aux._editingBot': 'file2',
                            'aux._selection': 'aux._selection_abc',
                        },
                    })
                );

                expect(vm.events.slice(1)).toEqual([
                    fileUpdated('file1', {
                        tags: {
                            ['aux._selection_abc']: true,
                        },
                    }),
                    fileUpdated('file2', {
                        tags: {
                            ['aux._selection_abc']: true,
                        },
                    }),
                ]);
            });
        });

        describe('multi select', () => {
            let file: PrecalculatedBot;

            beforeEach(async () => {
                helper.filesState = {
                    user: createPrecalculatedFile('user', {
                        'aux._selectionMode': 'multi',
                    }),
                    file1: createPrecalculatedFile('file1'),
                };
                file = helper.filesState['file1'];
            });

            it('should create a new selection ID if the user has none', async () => {
                await manager.selectFile(file);

                uuidMock.mockReturnValue('abc');
                expect(vm.events[0]).toEqual(
                    fileUpdated('user', {
                        tags: {
                            'aux._editingBot': 'file1',
                            'aux._selection': 'aux._selection_abc',
                        },
                    })
                );

                expect(vm.events.slice(1)).toEqual([
                    fileUpdated('file1', {
                        tags: {
                            ['aux._selection_abc']: true,
                        },
                    }),
                ]);
            });

            it('should add additional files to the current selection ID', async () => {
                helper.filesState = Object.assign({}, helper.filesState, {
                    user: createPrecalculatedFile('user', {
                        'aux._selection': 'abc',
                        'aux._selectionMode': 'multi',
                    }),
                });

                await manager.selectFile(file);

                expect(vm.events).toEqual([
                    // TODO: Make mutli selecting files update the editing file
                    // fileUpdated('user', {
                    //     tags: {
                    //         'aux._editingBot': 'file1',
                    //     }
                    // }),
                    fileUpdated('file1', {
                        tags: {
                            ['abc']: true,
                        },
                    }),
                ]);
            });
        });

        it('should trigger a change event', async () => {
            let changes = 0;
            manager.userChangedSelection.subscribe(() => (changes += 1));

            helper.filesState = {
                user: createPrecalculatedFile('user'),
                file1: createPrecalculatedFile('file1'),
            };

            let file = helper.filesState['file1'];
            await manager.selectFile(file);
            expect(changes).toBe(1);
        });
    });

    describe('setSelectedFiles()', () => {
        it('should make a new selection tag, set it to true, put it on the user, and set the mode to multi-select', async () => {
            helper.filesState = {
                user: createPrecalculatedFile('user', {
                    'aux._selection': 'test',
                    'aux._selectionMode': 'single',
                }),
                file1: createPrecalculatedFile('file1'),
                file2: createPrecalculatedFile('file2'),
                file3: createPrecalculatedFile('file3'),
            };

            let file1 = helper.filesState['file1'];
            let file2 = helper.filesState['file2'];
            let file3 = helper.filesState['file3'];

            uuidMock.mockReturnValue('abc');
            await manager.setSelectedFiles([file2, file1, file3]);

            expect(vm.events[0]).toEqual(
                fileUpdated('user', {
                    tags: {
                        'aux._selection': 'aux._selection_abc',
                        'aux._selectionMode': 'multi',
                    },
                })
            );

            expect(vm.events.slice(1)).toEqual([
                fileUpdated('file2', {
                    tags: {
                        ['aux._selection_abc']: true,
                    },
                }),
                fileUpdated('file1', {
                    tags: {
                        ['aux._selection_abc']: true,
                    },
                }),
                fileUpdated('file3', {
                    tags: {
                        ['aux._selection_abc']: true,
                    },
                }),
            ]);
        });

        it('should trigger a change event', async () => {
            let changes = 0;
            manager.userChangedSelection.subscribe(() => (changes += 1));

            helper.filesState = {
                user: createPrecalculatedFile('user', {
                    'aux._selection': 'test',
                    'aux._selectionMode': 'single',
                }),
                file1: createPrecalculatedFile('file1'),
                file2: createPrecalculatedFile('file2'),
                file3: createPrecalculatedFile('file3'),
            };

            let file1 = helper.filesState['file1'];
            let file2 = helper.filesState['file2'];
            let file3 = helper.filesState['file3'];

            await manager.setSelectedFiles([file1, file2, file3]);

            expect(changes).toBe(1);
        });
    });

    describe('setMode()', () => {
        const cases = [['single'], ['multi']];

        it.each(cases)(
            'should set the aux._selectionMode tag on the user to %s',
            async mode => {
                helper.filesState = {
                    user: createPrecalculatedFile('user', {
                        'aux._selectionMode': 'wrong',
                    }),
                };

                await manager.setMode(mode);

                expect(vm.events).toEqual([
                    fileUpdated('user', {
                        tags: {
                            'aux._selectionMode': mode,
                        },
                    }),
                ]);
            }
        );
    });

    describe('clearSelection()', () => {
        it('should reset the users selection', async () => {
            helper.filesState = {
                user: createPrecalculatedFile('user', {
                    'aux._selection': 'abc',
                }),
            };

            await manager.clearSelection();

            expect(vm.events).toEqual([
                fileUpdated('user', {
                    tags: {
                        'aux._editingBot': null,
                        'aux._selection': null,
                        'aux._selectionMode': 'single',
                    },
                }),
            ]);
        });

        it('should trigger a change event', async () => {
            let changes = 0;
            manager.userChangedSelection.subscribe(() => (changes += 1));

            helper.filesState = {
                user: createPrecalculatedFile('user', {
                    'aux._selection': 'abc',
                }),
            };

            await manager.clearSelection();

            expect(changes).toBe(1);
        });
    });

    describe('getSelectedFilesForUser()', () => {
        it('should return the list of files that the user has selected', async () => {
            helper.filesState = {
                user: createPrecalculatedFile('user', {
                    'aux._selection': 'abc',
                }),
                file1: createPrecalculatedFile('file1', {
                    abc: true,
                }),
                file2: createPrecalculatedFile('file2', {
                    abc: true,
                }),
            };

            const selected = manager.getSelectedFilesForUser(helper.userFile);

            expect(selected.map(s => s.id)).toEqual(['file1', 'file2']);
        });

        it('should return an empty list if the user is null', async () => {
            helper.filesState = {};

            const selected = manager.getSelectedFilesForUser(helper.userFile);

            expect(selected).toEqual([]);
        });
    });
});
