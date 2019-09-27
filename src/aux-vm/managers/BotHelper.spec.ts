import {
    botAdded,
    createBot,
    botUpdated,
    GLOBALS_FILE_ID,
    PrecalculatedBotsState,
    createPrecalculatedBot,
    botRemoved,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { BotHelper } from './BotHelper';

describe('BotHelper', () => {
    let userId = 'user';
    let helper: BotHelper;
    let vm: TestAuxVM;

    beforeEach(() => {
        vm = new TestAuxVM();
        helper = new BotHelper(vm);
        helper.userId = userId;
    });

    describe('userFile', () => {
        it('should return the bot that has the same ID as the user ID', () => {
            const state: PrecalculatedBotsState = {
                user: createPrecalculatedBot('user', {}),
            };
            helper.botsState = state;

            const user = helper.userFile;

            expect(user).toBe(state.user);
        });
    });

    describe('globalsFile', () => {
        it('should return the bot with the globals ID', () => {
            const state: PrecalculatedBotsState = {
                [GLOBALS_FILE_ID]: createPrecalculatedBot(GLOBALS_FILE_ID, {}),
            };
            helper.botsState = state;
            const bot = state[GLOBALS_FILE_ID];
            const globals = helper.globalsFile;

            expect(globals).toBe(bot);
        });
    });

    describe('createContext()', () => {
        it('should include the bots in the state', () => {
            helper.botsState = {
                abc: createPrecalculatedBot('abc', {}),
                def: createPrecalculatedBot('def', {}),
            };

            const context = helper.createContext();

            expect(context.objects).toEqual([
                helper.botsState['abc'],
                helper.botsState['def'],
            ]);
        });
    });

    describe('setEditingFile()', () => {
        it('should set the aux._editingBot tag on the user bot', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user'),
                test: createPrecalculatedBot('test'),
            };
            await helper.setEditingFile(helper.botsState['test']);

            expect(vm.events).toEqual([
                botUpdated('user', {
                    tags: {
                        'aux._editingBot': 'test',
                    },
                }),
            ]);
        });
    });

    describe('createSimulation()', () => {
        it('should create a new simulation bot', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user', {
                    'aux._userSimulationsContext': 'abc',
                }),
            };

            await helper.createSimulation('test', 'botId');
            await helper.createSimulation('test2', 'fileId2');

            expect(vm.events).toEqual([
                botAdded(
                    createBot('botId', {
                        abc: true,
                        'aux.channel': 'test',
                    })
                ),
                botAdded(
                    createBot('fileId2', {
                        abc: true,
                        'aux.channel': 'test2',
                    })
                ),
            ]);
        });

        it('should not create a new simulation when one already exists for the given channel ID', async () => {
            helper.botsState = {
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
            helper.botsState = {
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
                botRemoved('file1'),
                botRemoved('file2'),
            ]);
        });
    });

    describe('destroyFile()', () => {
        it('should destroy the given bot', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user'),
                file1: createPrecalculatedBot('file1'),
            };

            const result = await helper.destroyFile(helper.botsState['file1']);

            expect(vm.events).toEqual([botRemoved('file1')]);
            expect(result).toBe(true);
        });

        it('should destroy all children of the bot', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user'),
                file1: createPrecalculatedBot('file1'),
                file2: createPrecalculatedBot('file2', {
                    'aux.creator': 'file1',
                }),
            };

            const result = await helper.destroyFile(helper.botsState['file1']);

            expect(vm.events).toEqual([
                botRemoved('file1'),
                botRemoved('file2'),
            ]);
            expect(result).toBe(true);
        });

        it('should return false if the bot was not destroyed', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user'),
                file1: createPrecalculatedBot('file1', {
                    'aux.destroyable': false,
                }),
            };

            const result = await helper.destroyFile(helper.botsState['file1']);

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
