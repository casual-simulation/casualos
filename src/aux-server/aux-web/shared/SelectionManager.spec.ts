import { createFile, File, AuxObject, AuxCausalTree } from "@yeti-cgi/aux-common";
import { SelectionManager } from "./SelectionManager";
import { FileHelper } from "./FileHelper";
import { storedTree, site } from "@yeti-cgi/aux-common/causal-trees";

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

            it('should set the user _selection tag to the given files ID', async () => {
                
                await manager.selectFile(file);

                expect(helper.userFile.tags).toMatchObject({
                    _selection: 'file1'
                });
            });

            it('should clear the user _selection tag if the given files ID matches the current selection', async () => {
                let user = tree.value['user'];
                await tree.updateFile(user, {
                    tags: {
                        _selection: 'file1'
                    }
                });

                const file = tree.value['file1'];
                await manager.selectFile(file);

                expect(helper.userFile.tags._selection).toBeFalsy();
            });
        });

        describe('multi select', () => {

            let file: AuxObject;

            beforeEach(async () => {
                let user = tree.value['user'];
                await tree.updateFile(user, {
                    tags: {
                        'aux._selectionMode': 'multi'
                    }
                });

                await tree.addFile(createFile('file1'));
                file = tree.value['file1'];
            });

            it('should create a new selection ID if the user has none', async () => {
                
                await manager.selectFile(file);

                file = tree.value['file1'];
                const selection = helper.userFile.tags._selection;
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
                const selection = helper.userFile.tags._selection;
                expect(selection).toBeTruthy();
                expect(file.tags[selection]).toBe(true);
                expect(file2.tags[selection]).toBe(true);
            });
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
        it('should set the _selection tag to null', async () => {
            await tree.updateFile(helper.userFile, {
                tags: {
                    _selection: 'abc'
                }
            });

            await manager.clearSelection();

            expect(helper.userFile.tags._selection).toBeFalsy();
        });
    });

    describe('getSelectedFilesForUser()', () => {
        it('should return the list of files that the user has selected', async () => {
            await tree.addFile(createFile('file1', {
                abc: true
            }));
            await tree.addFile(createFile('file2', {
                abc: true
            }));
            await tree.updateFile(helper.userFile, {
                tags: {
                    _selection: 'abc'
                }
            });

            const selected = manager.getSelectedFilesForUser(helper.userFile);

            expect(selected.map(s => s.id)).toEqual([
                'file2',
                'file1'
            ]);
        });
    });
});