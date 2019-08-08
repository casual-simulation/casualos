import {
    AuxCausalTree,
    AuxObject,
    FileEvent,
    LocalEvent,
    fileAdded,
    createFile,
    fileUpdated,
    GLOBALS_FILE_ID,
    LocalEvents,
    action,
    toast,
    DEFAULT_USER_MODE,
    Sandbox,
    addState,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from './test/TestAuxVM';
import { AuxHelper } from './AuxHelper';
import {
    storedTree,
    site,
    USERNAME_CLAIM,
    DeviceEvent,
    RemoteEvent,
    remote,
} from '@casual-simulation/causal-trees';
import uuid from 'uuid/v4';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('AuxHelper', () => {
    let userId: string = 'user';
    let tree: AuxCausalTree;
    let vm: TestAuxVM;
    let helper: AuxHelper;

    beforeEach(async () => {
        uuidMock.mockReset();
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new AuxHelper(tree);
        helper.userId = userId;

        await tree.root();
        await tree.file('user');
    });

    it('should use the given sandbox factory', () => {
        const sandbox: Sandbox = {
            library: null,
            interface: null,
            run: null,
        };
        helper = new AuxHelper(tree, undefined, lib => sandbox);
        helper.userId = userId;

        const context = helper.createContext();
        expect(context.sandbox).toBe(sandbox);
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
            await tree.file(GLOBALS_FILE_ID);

            const file = tree.value[GLOBALS_FILE_ID];
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
            helper = new AuxHelper(tree, {
                isBuilder: true,
                isPlayer: false,
            });
            helper.userId = userId;

            const context = helper.createContext();

            expect(context.sandbox.library.isDesigner).toBe(true);
            expect(context.sandbox.library.isPlayer).toBe(false);
        });

        it('should define a library variable when in aux player', () => {
            helper = new AuxHelper(tree, {
                isBuilder: false,
                isPlayer: true,
            });
            helper.userId = userId;

            const context = helper.createContext();

            expect(context.sandbox.library.isDesigner).toBe(false);
            expect(context.sandbox.library.isPlayer).toBe(true);
        });

        it('should default to not in aux builder or player', () => {
            helper = new AuxHelper(tree, {
                isBuilder: false,
                isPlayer: false,
            });
            helper.userId = userId;

            const context = helper.createContext();

            expect(context.sandbox.library.isDesigner).toBe(false);
            expect(context.sandbox.library.isPlayer).toBe(false);
        });
    });

    describe('transaction()', () => {
        it('should emit local events that are sent via transaction()', async () => {
            let events: LocalEvents[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.transaction(toast('test'));

            expect(events).toEqual([toast('test')]);
        });

        it('should run action events', async () => {
            await helper.createFile('test', {
                'action()': 'setTag(this, "#hit", true)',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(helper.filesState['test'].tags.hit).toBe(true);
        });

        it('should emit local events from actions', async () => {
            let events: LocalEvents[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.createFile('test', {
                'action()': 'player.toast("test")',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(events).toEqual([toast('test')]);
        });

        it('should calculate assignment formulas', async () => {
            let events: LocalEvents[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

            await helper.createFile('test', {});

            await helper.transaction(
                fileUpdated('test', {
                    tags: {
                        test: ':="abc"',
                    },
                })
            );

            expect(helper.filesState['test']).toMatchObject({
                id: 'test',
                tags: {
                    test: {
                        _assignment: true,
                        editing: true,
                        formula: ':="abc"',
                        value: 'abc',
                    },
                },
            });
        });

        it('should emit remote events that are sent via transaction()', async () => {
            let events: RemoteEvent[] = [];
            helper.remoteEvents.subscribe(e => events.push(...e));

            await helper.transaction(remote(toast('test')));

            expect(events).toEqual([remote(toast('test'))]);
        });

        it('should emit device events that are sent via transaction()', async () => {
            let events: DeviceEvent[] = [];
            helper.deviceEvents.subscribe(e => events.push(...e));

            await helper.transaction({
                type: 'device',
                device: null,
                event: toast('test'),
            });

            expect(events).toEqual([
                {
                    type: 'device',
                    device: null,
                    event: toast('test'),
                },
            ]);
        });

        describe('paste_state', () => {
            it('should add the given files to a new context', async () => {
                uuidMock
                    .mockReturnValueOnce('context')
                    .mockReturnValueOnce('file1')
                    .mockReturnValueOnce('file2');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        fileId: createFile('fileId', {
                            test: 'abc',
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.filesState).toMatchObject({
                    file1: createFile('file1', {
                        'aux.context': 'context',
                        'aux.context.visualize': 'surface',
                        'aux.context.x': 0,
                        'aux.context.y': 1,
                        'aux.context.z': 2,
                    }),
                    file2: createFile('file2', {
                        context: true,
                        'context.x': 0,
                        'context.y': 0,
                        test: 'abc',
                    }),
                });
            });

            it('should preserve X and Y positions if a context file is included', async () => {
                uuidMock
                    .mockReturnValueOnce('context')
                    .mockReturnValueOnce('file1')
                    .mockReturnValueOnce('file2')
                    .mockReturnValueOnce('file3');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        fileId: createFile('fileId', {
                            test: 'abc',
                            old: true,
                            'old.x': 3,
                            'old.y': 2,
                            'old.z': 1,
                        }),
                        contextFile: createFile('contextFile', {
                            'aux.context': 'old',
                            'aux.context.visualize': true,
                            other: 'def',
                        }),
                    },
                    options: {
                        x: -1,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.filesState).toMatchObject({
                    file1: createFile('file1', {
                        'aux.context': 'context',
                        'aux.context.visualize': true,
                        'aux.context.x': -1,
                        'aux.context.y': 1,
                        'aux.context.z': 2,
                        other: 'def',
                    }),
                    file2: createFile('file2', {
                        context: true,
                        'context.x': 3,
                        'context.y': 2,
                        'context.z': 1,
                        test: 'abc',
                    }),
                });
            });

            it('should check the current state for contexts if they are not included in the copied state', async () => {
                uuidMock
                    .mockReturnValueOnce('context')
                    .mockReturnValueOnce('file1')
                    .mockReturnValueOnce('file2')
                    .mockReturnValueOnce('file3');

                await helper.transaction(
                    addState({
                        contextFile: createFile('contextFile', {
                            'aux.context': 'old',
                            'aux.context.visualize': true,
                            other: 'def',
                        }),
                    })
                );
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        fileId: createFile('fileId', {
                            test: 'abc',
                            'old.x': 3,
                            'old.y': 2,
                            'old.z': 1,
                        }),
                    },
                    options: {
                        x: -1,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.filesState).toEqual({
                    contextFile: expect.any(Object),
                    user: expect.any(Object),
                    file1: expect.objectContaining(
                        createFile('file1', {
                            'aux.context': 'context',
                            'aux.context.visualize': 'surface',
                            'aux.context.x': -1,
                            'aux.context.y': 1,
                            'aux.context.z': 2,
                        })
                    ),
                    file2: expect.objectContaining(
                        createFile('file2', {
                            context: true,
                            'context.x': 0,
                            'context.y': 0,
                            'context.sortOrder': 0,
                            test: 'abc',
                        })
                    ),
                });
            });

            it('should add the given files the given context at the given grid position', async () => {
                uuidMock.mockReturnValueOnce('file2');

                await helper.transaction(
                    addState({
                        contextFile: createFile('contextFile', {
                            'aux.context': 'old',
                            'aux.context.visualize': true,
                            other: 'def',
                        }),
                    })
                );
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        fileId: createFile('fileId', {
                            test: 'abc',
                            old: true,
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                        context: 'fun',
                    },
                });

                expect(helper.filesState).toMatchObject({
                    file2: {
                        tags: expect.not.objectContaining({
                            old: true,
                        }),
                    },
                });

                expect(helper.filesState).toMatchObject({
                    file2: createFile('file2', {
                        fun: true,
                        'fun.x': 0,
                        'fun.y': 1,
                        'fun.z': 2,
                        test: 'abc',
                    }),
                });
            });

            it('should add the given files the given context at the given grid position', async () => {
                uuidMock.mockReturnValueOnce('file2');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        fileId: createFile('fileId', {
                            test: 'abc',
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                        context: 'fun',
                    },
                });

                expect(helper.filesState).toMatchObject({
                    file2: createFile('file2', {
                        fun: true,
                        'fun.x': 0,
                        'fun.y': 1,
                        'fun.z': 2,
                        test: 'abc',
                    }),
                });
            });
        });
    });

    describe('createOrUpdateUserFile()', () => {
        it('should create a file for the user', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            helper = new AuxHelper(tree);
            helper.userId = userId;

            await tree.root();
            await helper.createOrUpdateUserFile(
                {
                    id: 'testUser',
                    username: 'username',
                    name: 'test',
                    isGuest: false,
                    token: 'abc',
                },
                null
            );

            expect(helper.filesState['testUser']).toMatchObject({
                id: 'testUser',
                tags: {
                    ['_user_username_1']: true,
                    ['aux.context']: '_user_username_1',
                    ['aux.context.visualize']: true,
                    ['aux._user']: 'username',
                    ['aux._userInventoryContext']: '_user_username_inventory',
                    ['aux._userMenuContext']: '_user_username_menu',
                    ['aux._userSimulationsContext']:
                        '_user_username_simulations',
                    'aux._mode': DEFAULT_USER_MODE,
                },
            });
        });

        const contextCases = [
            ['menu context', 'aux._userMenuContext', '_user_username_menu'],
            [
                'inventory context',
                'aux._userInventoryContext',
                '_user_username_inventory',
            ],
            [
                'simulations context',
                'aux._userSimulationsContext',
                '_user_username_simulations',
            ],
        ];

        it.each(contextCases)(
            'should add the %s to a user that doesnt have it',
            async (desc, tag, value) => {
                await helper.createOrUpdateUserFile(
                    {
                        id: 'user',
                        username: 'username',
                        name: 'test',
                        isGuest: false,
                        token: 'abc',
                    },
                    null
                );

                expect(helper.userFile).toMatchObject({
                    id: 'user',
                    tags: {
                        [tag]: value,
                    },
                });
            }
        );
    });
});
