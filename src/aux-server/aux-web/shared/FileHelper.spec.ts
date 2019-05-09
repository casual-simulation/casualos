import {
    AuxCausalTree,
    AuxObject,
    FileEvent,
    LocalEvent,
    fileAdded,
    createFile,
} from '@casual-simulation/aux-common';
import { FileHelper } from './FileHelper';
import { storedTree, site } from '@casual-simulation/causal-trees';

describe('FileHelper', () => {
    let userId: string = 'user';
    let tree: AuxCausalTree;
    let helper: FileHelper;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new FileHelper(tree, userId);

        await tree.root();
        await tree.file('user');
    });

    describe('userFile', () => {
        it('should return the file that has the same ID as the user ID', async () => {
            const file = tree.value['user'];
            const user = helper.userFile;

            expect(user).toBe(file);
        });
    });

    describe('globalsFile', () => {
        it('should return the file with the globals ID', async () => {
            await tree.file('globals');

            const file = tree.value['globals'];
            const globals = helper.globalsFile;

            expect(globals).toBe(file);
        });
    });

    describe('objects', () => {
        it('should return active objects', async () => {
            const { added: file1 } = await tree.file('test1');

            const { added: file2 } = await tree.file('test2');
            const { added: tag } = await tree.tag('aux._destroyed', file2);
            const { added: val } = await tree.val(true, tag);

            const objs = helper.objects;

            expect(objs).toEqual([
                tree.value['test2'],
                tree.value['test1'],
                helper.userFile,
            ]);
        });
    });

    describe('createContext()', () => {
        it('should define a library variable when in aux builder', () => {
            helper = new FileHelper(tree, userId, {
                isBuilder: true,
                isPlayer: false,
            });

            const context = helper.createContext();

            expect(context.sandbox.library.isBuilder).toBe(true);
            expect(context.sandbox.library.isPlayer).toBe(false);
        });

        it('should define a library variable when in aux player', () => {
            helper = new FileHelper(tree, userId, {
                isBuilder: false,
                isPlayer: true,
            });

            const context = helper.createContext();

            expect(context.sandbox.library.isBuilder).toBe(false);
            expect(context.sandbox.library.isPlayer).toBe(true);
        });

        it('should default to not in aux builder or player', () => {
            helper = new FileHelper(tree, userId, {
                isBuilder: false,
                isPlayer: false,
            });

            const context = helper.createContext();

            expect(context.sandbox.library.isBuilder).toBe(false);
            expect(context.sandbox.library.isPlayer).toBe(false);
        });
    });

    describe('localEvents', () => {
        it('should emit local events that are sent via transaction()', () => {
            let events: LocalEvent[] = [];
            helper.localEvents.subscribe(e => events.push(e));
        });
    });

    describe('setEditingFile()', () => {
        it('should set the aux._editingFile tag on the user file', async () => {
            await tree.file('test');

            const file = tree.value['test'];
            await helper.setEditingFile(file);

            const user = tree.value['user'];

            expect(user.tags['aux._editingFile']).toBe('test');
        });
    });

    describe('createSimulation()', () => {
        it('should create a new simulation file', async () => {
            await tree.updateFile(tree.value['user'], {
                tags: {
                    'aux._userSimulationsContext': 'abc',
                },
            });

            await helper.createSimulation('test', 'fileId');
            await helper.createSimulation('test2', 'fileId2');

            expect(tree.value['fileId']).toMatchObject({
                id: 'fileId',
                tags: {
                    abc: true,
                    'aux.channel': 'test',
                },
            });
            expect(tree.value['fileId2']).toMatchObject({
                id: 'fileId2',
                tags: {
                    abc: true,
                    'aux.channel': 'test2',
                },
            });
        });

        it('should not create a new simulation when one already exists for the given channel ID', async () => {
            await tree.updateFile(tree.value['user'], {
                tags: {
                    'aux._userSimulationsContext': 'abc',
                },
            });

            await tree.addEvents([
                fileAdded(
                    createFile('file1', {
                        abc: true,
                        'aux.channel': 'test',
                    })
                ),
            ]);

            await helper.createSimulation('test', 'file2');

            expect(tree.value['file2']).toBeUndefined();
        });
    });

    describe('destroySimulations()', () => {
        it('should destroy the simulations that load the given ID', async () => {
            await tree.updateFile(tree.value['user'], {
                tags: {
                    'aux._userSimulationsContext': 'abc',
                },
            });

            await tree.addEvents([
                fileAdded(
                    createFile('file1', {
                        abc: true,
                        'aux.channel': 'test',
                    })
                ),
            ]);

            await tree.addEvents([
                fileAdded(
                    createFile('file2', {
                        abc: true,
                        'aux.channel': 'test',
                    })
                ),
            ]);

            await helper.destroySimulations('test');

            expect(tree.value['file1']).toBeUndefined();
            expect(tree.value['file2']).toBeUndefined();
        });
    });

    describe('destroyFile()', () => {
        it('should destroy the given file', async () => {
            await tree.addFile(
                createFile('file1', {
                    abc: true,
                    'aux.channel': 'test',
                })
            );

            expect(tree.value['file1']).toBeTruthy();

            await helper.destroyFile(tree.value['file1']);

            expect(tree.value['file1']).toBeUndefined();
        });

        it('should destroy all children of the file', async () => {
            await tree.addFile(
                createFile('file1', {
                    abc: true,
                })
            );

            await tree.addFile(
                createFile('file2', {
                    abc: true,
                    'aux._creator': 'file1',
                })
            );

            expect(tree.value['file1']).toBeTruthy();
            expect(tree.value['file2']).toBeTruthy();

            await helper.destroyFile(tree.value['file1']);

            expect(tree.value['file1']).toBeUndefined();
            expect(tree.value['file2']).toBeUndefined();
        });
    });
});
