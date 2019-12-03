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

    describe('selectBot()', () => {
        describe('single select', () => {
            let bot: PrecalculatedBot;

            beforeEach(async () => {
                helper.botsState = {
                    user: createPrecalculatedBot('user'),
                    bot1: createPrecalculatedBot('bot1'),
                };
                bot = helper.botsState['bot1'];
            });

            it('should set the user _auxSelection tag to the given bots ID', async () => {
                await manager.selectBot(bot);

                expect(vm.events).toEqual([
                    botUpdated('user', {
                        tags: {
                            _auxSelection: 'bot1',
                            'aux._editingBot': 'bot1',
                        },
                    }),
                    botUpdated('bot1', {
                        tags: {},
                    }),
                ]);
            });

            it('should not clear the user _auxSelection tag if the given bots ID matches the current selection', async () => {
                helper.botsState = Object.assign({}, helper.botsState, {
                    user: createPrecalculatedBot('user', {
                        _auxSelection: 'bot1',
                    }),
                });

                await manager.selectBot(bot);

                expect(vm.events).toEqual([]);
            });

            it('should kick the user into multi select mode if specified', async () => {
                helper.botsState = Object.assign({}, helper.botsState, {
                    user: createPrecalculatedBot('user', {
                        _auxSelection: 'bot1',
                    }),
                    bot2: createPrecalculatedBot('bot2'),
                });

                const bot = helper.botsState['bot2'];
                uuidMock.mockReturnValue('abc');

                await manager.selectBot(bot, true);

                expect(vm.events[0]).toEqual(
                    botUpdated('user', {
                        tags: {
                            'aux._selectionMode': 'multi',
                            'aux._editingBot': 'bot2',
                            _auxSelection: 'aux._selection_abc',
                        },
                    })
                );

                expect(vm.events.slice(1)).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            ['aux._selection_abc']: true,
                        },
                    }),
                    botUpdated('bot2', {
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
                    bot1: createPrecalculatedBot('bot1'),
                };
                bot = helper.botsState['bot1'];
            });

            it('should create a new selection ID if the user has none', async () => {
                await manager.selectBot(bot);

                uuidMock.mockReturnValue('abc');
                expect(vm.events[0]).toEqual(
                    botUpdated('user', {
                        tags: {
                            'aux._editingBot': 'bot1',
                            _auxSelection: 'aux._selection_abc',
                        },
                    })
                );

                expect(vm.events.slice(1)).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            ['aux._selection_abc']: true,
                        },
                    }),
                ]);
            });

            it('should add additional bots to the current selection ID', async () => {
                helper.botsState = Object.assign({}, helper.botsState, {
                    user: createPrecalculatedBot('user', {
                        _auxSelection: 'abc',
                        'aux._selectionMode': 'multi',
                    }),
                });

                await manager.selectBot(bot);

                expect(vm.events).toEqual([
                    // TODO: Make mutli selecting bots update the editing bot
                    // botUpdated('user', {
                    //     tags: {
                    //         'aux._editingBot': 'bot1',
                    //     }
                    // }),
                    botUpdated('bot1', {
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
                bot1: createPrecalculatedBot('bot1'),
            };

            let bot = helper.botsState['bot1'];
            await manager.selectBot(bot);
            expect(changes).toBe(1);
        });
    });

    describe('setSelectedBots()', () => {
        it('should make a new selection tag, set it to true, put it on the user, and set the mode to multi-select', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user', {
                    _auxSelection: 'test',
                    'aux._selectionMode': 'single',
                }),
                bot1: createPrecalculatedBot('bot1'),
                bot2: createPrecalculatedBot('bot2'),
                bot3: createPrecalculatedBot('bot3'),
            };

            let bot1 = helper.botsState['bot1'];
            let bot2 = helper.botsState['bot2'];
            let bot3 = helper.botsState['bot3'];

            uuidMock.mockReturnValue('abc');
            await manager.setSelectedBots([bot2, bot1, bot3]);

            expect(vm.events[0]).toEqual(
                botUpdated('user', {
                    tags: {
                        _auxSelection: 'aux._selection_abc',
                        'aux._selectionMode': 'multi',
                    },
                })
            );

            expect(vm.events.slice(1)).toEqual([
                botUpdated('bot2', {
                    tags: {
                        ['aux._selection_abc']: true,
                    },
                }),
                botUpdated('bot1', {
                    tags: {
                        ['aux._selection_abc']: true,
                    },
                }),
                botUpdated('bot3', {
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
                    _auxSelection: 'test',
                    'aux._selectionMode': 'single',
                }),
                bot1: createPrecalculatedBot('bot1'),
                bot2: createPrecalculatedBot('bot2'),
                bot3: createPrecalculatedBot('bot3'),
            };

            let bot1 = helper.botsState['bot1'];
            let bot2 = helper.botsState['bot2'];
            let bot3 = helper.botsState['bot3'];

            await manager.setSelectedBots([bot1, bot2, bot3]);

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
                    _auxSelection: 'abc',
                }),
            };

            await manager.clearSelection();

            expect(vm.events).toEqual([
                botUpdated('user', {
                    tags: {
                        'aux._editingBot': null,
                        _auxSelection: null,
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
                    _auxSelection: 'abc',
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
                    _auxSelection: 'abc',
                }),
                bot1: createPrecalculatedBot('bot1', {
                    abc: true,
                }),
                bot2: createPrecalculatedBot('bot2', {
                    abc: true,
                }),
            };

            const selected = manager.getSelectedBotsForUser(helper.userBot);

            expect(selected.map(s => s.id)).toEqual(['bot1', 'bot2']);
        });

        it('should return an empty list if the user is null', async () => {
            helper.botsState = {};

            const selected = manager.getSelectedBotsForUser(helper.userBot);

            expect(selected).toEqual([]);
        });
    });
});
