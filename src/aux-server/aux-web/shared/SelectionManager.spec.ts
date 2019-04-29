import {
    createFile,
    File,
    AuxObject,
    AuxCausalTree,
    getSelectionMode,
} from '@casual-simulation/aux-common';
import SelectionManager from './SelectionManager';
import { FileHelper } from './FileHelper';
import { storedTree, site } from '@casual-simulation/causal-trees';

describe('SelectionManager', () => {
    let tree: AuxCausalTree;
    let helper: FileHelper;
    let manager: SelectionManager;
    let spy: jest.SpyInstance;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new FileHelper(tree, 'user');
        manager = new SelectionManager(helper);

        await tree.root();
        await tree.file('user');
    });

    beforeAll(() => {
        spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterAll(() => {
        spy.mockRestore();
    });

    describe('selectFile()', () => {
        describe('single select', () => {
            let file: AuxObject;

            beforeEach(async () => {
                await tree.addFile(createFile('file1'));
                file = tree.value['file1'];
            });

            it('should set the user aux._selection tag to the given files ID', async () => {
                await manager.selectFile(file);

                file = tree.value['file1'];

                expect(helper.userFile.tags).toMatchObject({
                    ['aux._selection']: 'file1',
                    'aux._editingFile': 'file1',
                });
                expect(file.tags['aux._lastEditedBy']).toBe(helper.userFile.id);
            });

            it('should clear the user aux._selection tag if the given files ID matches the current selection', async () => {
                let user = tree.value['user'];
                await tree.updateFile(user, {
                    tags: {
                        'aux._selection': 'file1',
                    },
                });

                const file = tree.value['file1'];
                await manager.selectFile(file);

                expect(helper.userFile.tags['aux._selection']).toBeFalsy();
            });

            it('should kick the user into multi select mode if specified', async () => {
                let user = tree.value['user'];
                await tree.updateFile(user, {
                    tags: {
                        'aux._selection': 'file1',
                    },
                });
                await tree.addFile(createFile('file2'));

                const file = tree.value['file2'];
                await manager.selectFile(file, true);

                const file1 = tree.value['file1'];
                const file2 = tree.value['file2'];
                const selection = helper.userFile.tags['aux._selection'];
                expect(selection).toBeTruthy();
                expect(selection).not.toBe('file1');
                expect(helper.userFile.tags['aux._selectionMode']).toBe(
                    'multi'
                );
                expect(file1.tags[selection]).toBe(true);
                expect(file2.tags[selection]).toBe(true);
            });
        });

        describe('multi select', () => {
            let file: AuxObject;

            beforeEach(async () => {
                let user = tree.value['user'];
                await tree.updateFile(user, {
                    tags: {
                        'aux._selectionMode': 'multi',
                    },
                });

                await tree.addFile(createFile('file1'));
                file = tree.value['file1'];
            });

            it('should create a new selection ID if the user has none', async () => {
                await manager.selectFile(file);

                file = tree.value['file1'];
                const selection = helper.userFile.tags['aux._selection'];
                expect(selection).toBeTruthy();
                expect(file.tags[selection]).toBe(true);
            });

            it('should add additional files to the current selection ID', async () => {
                await manager.selectFile(file);
                await tree.addFile(createFile('file2'));
                let file2 = tree.value['file2'];

                await manager.selectFile(file2);

                file = tree.value['file1'];
                file2 = tree.value['file2'];
                const selection = helper.userFile.tags['aux._selection'];
                expect(selection).toBeTruthy();
                expect(file.tags[selection]).toBe(true);
                expect(file2.tags[selection]).toBe(true);
            });
        });

        it('should trigger a change event', async () => {
            let changes = 0;
            manager.userChangedSelection.subscribe(() => (changes += 1));
            await tree.addFile(createFile('file1'));
            let file = tree.value['file1'];
            await manager.selectFile(file);
            expect(changes).toBe(1);
        });
    });

    describe('setSelectedFiles()', () => {
        it('should make a new selection tag, set it to true, put it on the user, and set the mode to multi-select', async () => {
            await tree.addFile(createFile('file0'));

            let file0 = tree.value['file0'];
            await manager.selectFile(file0);

            let oldSelection = helper.userFile.tags['aux._selection'];

            await tree.addFile(createFile('file1'));
            await tree.addFile(createFile('file2'));

            let file1 = tree.value['file1'];
            let file2 = tree.value['file2'];

            await manager.setSelectedFiles([file1, file2, file0]);

            file0 = tree.value['file0'];
            file1 = tree.value['file1'];
            file2 = tree.value['file2'];

            let newSelection = helper.userFile.tags['aux._selection'];
            expect(newSelection).not.toEqual(oldSelection);
            expect(newSelection).toBeTruthy();
            expect(getSelectionMode(helper.userFile)).toBe('multi');
            expect(file0.tags[newSelection]).toBe(true);
            expect(file1.tags[newSelection]).toBe(true);
            expect(file2.tags[newSelection]).toBe(true);
        });

        it('should trigger a change event', async () => {
            let changes = 0;
            manager.userChangedSelection.subscribe(() => (changes += 1));
            await tree.addFile(createFile('file0'));
            await tree.addFile(createFile('file1'));
            await tree.addFile(createFile('file2'));

            let file0 = tree.value['file0'];
            let file1 = tree.value['file1'];
            let file2 = tree.value['file2'];

            await manager.setSelectedFiles([file1, file2, file0]);

            expect(changes).toBe(1);
        });
    });

    describe('setMode()', () => {
        it('should set the aux._selectionMode tag on the user', async () => {
            await manager.setMode('multi');
            expect(helper.userFile.tags['aux._selectionMode']).toBe('multi');

            await manager.setMode('single');
            expect(helper.userFile.tags['aux._selectionMode']).toBe('single');
        });
    });

    describe('clearSelection()', () => {
        it('should set the aux._selection tag to null', async () => {
            await tree.updateFile(helper.userFile, {
                tags: {
                    ['aux._selection']: 'abc',
                },
            });

            await manager.clearSelection();

            expect(helper.userFile.tags['aux._selection']).toBeFalsy();
        });

        it('should set the aux._selectionMode tag to single', async () => {
            await tree.updateFile(helper.userFile, {
                tags: {
                    'aux._selection': 'abc',
                    'aux._selectionMode': 'multi',
                },
            });

            await manager.clearSelection();

            expect(helper.userFile.tags['aux._selection']).toBeFalsy();
            expect(helper.userFile.tags['aux._selectionMode']).toBe('single');
        });

        it('should trigger a change event', async () => {
            let changes = 0;
            manager.userChangedSelection.subscribe(() => (changes += 1));

            await tree.updateFile(helper.userFile, {
                tags: {
                    'aux._selection': 'abc',
                    'aux._selectionMode': 'multi',
                },
            });

            await manager.clearSelection();

            expect(changes).toBe(1);
        });
    });

    describe('getSelectedFilesForUser()', () => {
        it('should return the list of files that the user has selected', async () => {
            await tree.addFile(
                createFile('file1', {
                    abc: true,
                })
            );
            await tree.addFile(
                createFile('file2', {
                    abc: true,
                })
            );
            await tree.updateFile(helper.userFile, {
                tags: {
                    'aux._selection': 'abc',
                },
            });

            const selected = manager.getSelectedFilesForUser(helper.userFile);

            expect(selected.map(s => s.id)).toEqual(['file2', 'file1']);
        });
    });
});
