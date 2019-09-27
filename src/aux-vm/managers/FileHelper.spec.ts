import {
    fileAdded,
    createBot,
    fileUpdated,
    GLOBALS_FILE_ID,
    PrecalculatedBotsState,
    createPrecalculatedBot,
    fileRemoved,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { FileHelper } from './FileHelper';

describe('FileHelper', () => {
    let userId = 'user';
    let helper: FileHelper;
    let vm: TestAuxVM;

    beforeEach(() => {
        vm = new TestAuxVM();
        helper = new FileHelper(vm);
        helper.userId = userId;
    });

    describe('userFile', () => {
        it('should return the file that has the same ID as the user ID', () => {
            const state: PrecalculatedBotsState = {
                user: createPrecalculatedBot('user', {}),
            };
            helper.filesState = state;

            const user = helper.userFile;

            expect(user).toBe(state.user);
        });
    });

    describe('globalsFile', () => {
        it('should return the file with the globals ID', () => {
            const state: PrecalculatedBotsState = {
                [GLOBALS_FILE_ID]: createPrecalculatedBot(GLOBALS_FILE_ID, {}),
            };
            helper.filesState = state;
            const file = state[GLOBALS_FILE_ID];
            const globals = helper.globalsFile;

            expect(globals).toBe(file);
        });
    });

    describe('createContext()', () => {
        it('should include the files in the state', () => {
            helper.filesState = {
                abc: createPrecalculatedBot('abc', {}),
                def: createPrecalculatedBot('def', {}),
            };

            const context = helper.createContext();

            expect(context.objects).toEqual([
                helper.filesState['abc'],
                helper.filesState['def'],
            ]);
        });
    });

    describe('setEditingFile()', () => {
        it('should set the aux._editingBot tag on the user file', async () => {
            helper.filesState = {
                user: createPrecalculatedBot('user'),
                test: createPrecalculatedBot('test'),
            };
            await helper.setEditingFile(helper.filesState['test']);

            expect(vm.events).toEqual([
                fileUpdated('user', {
                    tags: {
                        'aux._editingBot': 'test',
                    },
                }),
            ]);
        });
    });

    describe('createSimulation()', () => {
        it('should create a new simulation file', async () => {
            helper.filesState = {
                user: createPrecalculatedBot('user', {
                    'aux._userSimulationsContext': 'abc',
                }),
            };

            await helper.createSimulation('test', 'fileId');
            await helper.createSimulation('test2', 'fileId2');

            expect(vm.events).toEqual([
                fileAdded(
                    createBot('fileId', {
                        abc: true,
                        'aux.channel': 'test',
                    })
                ),
                fileAdded(
                    createBot('fileId2', {
                        abc: true,
                        'aux.channel': 'test2',
                    })
                ),
            ]);
        });

        it('should not create a new simulation when one already exists for the given channel ID', async () => {
            helper.filesState = {
                user: createPrecalculatedBot('user', {
                    'aux._userSimulationsContext': 'abc',
                }),
                file1: createPrecalculatedBot('file1', {
                    abc: true,
                    'aux.channel': 'test',
                }),
            };

            await helper.createSimulation('test', 'file2');

            expect(vm.events).toEqual([]);
        });
    });

    describe('destroySimulations()', () => {
        it('should destroy the simulations that load the given ID', async () => {
            helper.filesState = {
                user: createPrecalculatedBot('user', {
                    'aux._userSimulationsContext': 'abc',
                }),
                file1: createPrecalculatedBot('file1', {
                    abc: true,
                    'aux.channel': 'test',
                }),
                file2: createPrecalculatedBot('file2', {
                    abc: true,
                    'aux.channel': 'test',
                }),
            };

            await helper.destroySimulations('test');

            expect(vm.events).toEqual([
                fileRemoved('file1'),
                fileRemoved('file2'),
            ]);
        });
    });

    describe('destroyFile()', () => {
        it('should destroy the given file', async () => {
            helper.filesState = {
                user: createPrecalculatedBot('user'),
                file1: createPrecalculatedBot('file1'),
            };

            const result = await helper.destroyFile(helper.filesState['file1']);

            expect(vm.events).toEqual([fileRemoved('file1')]);
            expect(result).toBe(true);
        });

        it('should destroy all children of the file', async () => {
            helper.filesState = {
                user: createPrecalculatedBot('user'),
                file1: createPrecalculatedBot('file1'),
                file2: createPrecalculatedBot('file2', {
                    'aux.creator': 'file1',
                }),
            };

            const result = await helper.destroyFile(helper.filesState['file1']);

            expect(vm.events).toEqual([
                fileRemoved('file1'),
                fileRemoved('file2'),
            ]);
            expect(result).toBe(true);
        });

        it('should return false if the file was not destroyed', async () => {
            helper.filesState = {
                user: createPrecalculatedBot('user'),
                file1: createPrecalculatedBot('file1', {
                    'aux.destroyable': false,
                }),
            };

            const result = await helper.destroyFile(helper.filesState['file1']);

            expect(vm.events).toEqual([]);
            expect(result).toBe(false);
        });
    });

    describe('formulaBatch()', () => {
        it('should send the formulas to the vm', async () => {
            await helper.formulaBatch([
                'setTag(@abc(true).first(), "#test", 123)',
            ]);

            expect(vm.formulas).toEqual([
                'setTag(@abc(true).first(), "#test", 123)',
            ]);
        });
    });
});
