import {
    createBot,
    getSelectionMode,
    createPrecalculatedBot,
    PrecalculatedBot,
    botUpdated,
    UpdateBotAction,
} from '@casual-simulation/aux-common';
import SelectionManager from './SelectionManager';
import { BotHelper } from '@casual-simulation/aux-vm';
import { storedTree, site } from '@casual-simulation/causal-trees';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import uuid from 'uuid/v4';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('SelectionManager', () => {
    let vm: TestAuxVM;
    let helper: BotHelper;
    let manager: SelectionManager;
    let spy: jest.SpyInstance;

    beforeEach(async () => {
        vm = new TestAuxVM();
        helper = new BotHelper(vm);
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
            let bot: PrecalculatedBot;

            beforeEach(async () => {
                helper.botsState = {
                    user: createPrecalculatedBot('user'),
                    file1: createPrecalculatedBot('file1'),
                };
                bot = helper.botsState['file1'];
            });

            it('should set the user aux._selection tag to the given bots ID', async () => {
                await manager.selectFile(bot);

                expect(vm.events).toEqual([
                    botUpdated('user', {
                        tags: {
                            'aux._selection': 'file1',
                            'aux._editingBot': 'file1',
                        },
                    }),
                    botUpdated('file1', {
                        tags: {},
                    }),
                ]);
            });

            it('should not clear the user aux._selection tag if the given bots ID matches the current selection', async () => {
                helper.botsState = Object.assign({}, helper.botsState, {
                    user: createPrecalculatedBot('user', {
                        'aux._selection': 'file1',
                    }),
                });

                await manager.selectFile(bot);

                expect(vm.events).toEqual([]);
            });

            it('should kick the user into multi select mode if specified', async () => {
                helper.botsState = Object.assign({}, helper.botsState, {
                    user: createPrecalculatedBot('user', {
                        'aux._selection': 'file1',
                    }),
                    file2: createPrecalculatedBot('file2'),
                });

                const bot = helper.botsState['file2'];
                uuidMock.mockReturnValue('abc');

                await manager.selectFile(bot, true);

                expect(vm.events[0]).toEqual(
                    botUpdated('user', {
                        tags: {
                            'aux._selectionMode': 'multi',
                            'aux._editingBot': 'file2',
                            'aux._selection': 'aux._selection_abc',
                        },
                    })
                );

                expect(vm.events.slice(1)).toEqual([
                    botUpdated('file1', {
                        tags: {
                            ['aux._selection_abc']: true,
                        },
                    }),
                    botUpdated('file2', {
                        tags: {
                            ['aux._selection_abc']: true,
                        },
                    }),
                ]);
            });
        });

        describe('multi select', () => {
            let bot: PrecalculatedBot;

            beforeEach(async () => {
                helper.botsState = {
                    user: createPrecalculatedBot('user', {
                        'aux._selectionMode': 'multi',
                    }),
                    file1: createPrecalculatedBot('file1'),
                };
                bot = helper.botsState['file1'];
            });

            it('should create a new selection ID if the user has none', async () => {
                await manager.selectFile(bot);

                uuidMock.mockReturnValue('abc');
                expect(vm.events[0]).toEqual(
                    botUpdated('user', {
                        tags: {
                            'aux._editingBot': 'file1',
                            'aux._selection': 'aux._selection_abc',
                        },
                    })
                );

                expect(vm.events.slice(1)).toEqual([
                    botUpdated('file1', {
                        tags: {
                            ['aux._selection_abc']: true,
                        },
                    }),
                ]);
            });

            it('should add additional bots to the current selection ID', async () => {
                helper.botsState = Object.assign({}, helper.botsState, {
                    user: createPrecalculatedBot('user', {
                        'aux._selection': 'abc',
                        'aux._selectionMode': 'multi',
                    }),
                });

                await manager.selectFile(bot);

                expect(vm.events).toEqual([
                    // TODO: Make mutli selecting bots update the editing bot
                    // botUpdated('user', {
                    //     tags: {
                    //         'aux._editingBot': 'file1',
                    //     }
                    // }),
                    botUpdated('file1', {
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

            helper.botsState = {
                user: createPrecalculatedBot('user'),
                file1: createPrecalculatedBot('file1'),
            };

            let bot = helper.botsState['file1'];
            await manager.selectFile(bot);
            expect(changes).toBe(1);
        });
    });

    describe('setSelectedFiles()', () => {
        it('should make a new selection tag, set it to true, put it on the user, and set the mode to multi-select', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user', {
                    'aux._selection': 'test',
                    'aux._selectionMode': 'single',
                }),
                file1: createPrecalculatedBot('file1'),
                file2: createPrecalculatedBot('file2'),
                file3: createPrecalculatedBot('file3'),
            };

            let file1 = helper.botsState['file1'];
            let file2 = helper.botsState['file2'];
            let file3 = helper.botsState['file3'];

            uuidMock.mockReturnValue('abc');
            await manager.setSelectedFiles([file2, file1, file3]);

            expect(vm.events[0]).toEqual(
                botUpdated('user', {
                    tags: {
                        'aux._selection': 'aux._selection_abc',
                        'aux._selectionMode': 'multi',
                    },
                })
            );

            expect(vm.events.slice(1)).toEqual([
                botUpdated('file2', {
                    tags: {
                        ['aux._selection_abc']: true,
                    },
                }),
                botUpdated('file1', {
                    tags: {
                        ['aux._selection_abc']: true,
                    },
                }),
                botUpdated('file3', {
                    tags: {
                        ['aux._selection_abc']: true,
                    },
                }),
            ]);
        });

        it('should trigger a change event', async () => {
            let changes = 0;
            manager.userChangedSelection.subscribe(() => (changes += 1));

            helper.botsState = {
                user: createPrecalculatedBot('user', {
                    'aux._selection': 'test',
                    'aux._selectionMode': 'single',
                }),
                file1: createPrecalculatedBot('file1'),
                file2: createPrecalculatedBot('file2'),
                file3: createPrecalculatedBot('file3'),
            };

            let file1 = helper.botsState['file1'];
            let file2 = helper.botsState['file2'];
            let file3 = helper.botsState['file3'];

            await manager.setSelectedFiles([file1, file2, file3]);

            expect(changes).toBe(1);
        });
    });

    describe('setMode()', () => {
        const cases = [['single'], ['multi']];

        it.each(cases)(
            'should set the aux._selectionMode tag on the user to %s',
            async mode => {
                helper.botsState = {
                    user: createPrecalculatedBot('user', {
                        'aux._selectionMode': 'wrong',
                    }),
                };

                await manager.setMode(mode);

                expect(vm.events).toEqual([
                    botUpdated('user', {
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
            helper.botsState = {
                user: createPrecalculatedBot('user', {
                    'aux._selection': 'abc',
                }),
            };

            await manager.clearSelection();

            expect(vm.events).toEqual([
                botUpdated('user', {
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

            helper.botsState = {
                user: createPrecalculatedBot('user', {
                    'aux._selection': 'abc',
                }),
            };

            await manager.clearSelection();

            expect(changes).toBe(1);
        });
    });

    describe('getSelectedBotsForUser()', () => {
        it('should return the list of bots that the user has selected', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user', {
                    'aux._selection': 'abc',
                }),
                file1: createPrecalculatedBot('file1', {
                    abc: true,
                }),
                file2: createPrecalculatedBot('file2', {
                    abc: true,
                }),
            };

            const selected = manager.getSelectedBotsForUser(helper.userFile);

            expect(selected.map(s => s.id)).toEqual(['file1', 'file2']);
        });

        it('should return an empty list if the user is null', async () => {
            helper.botsState = {};

            const selected = manager.getSelectedBotsForUser(helper.userFile);

            expect(selected).toEqual([]);
        });
    });
});
