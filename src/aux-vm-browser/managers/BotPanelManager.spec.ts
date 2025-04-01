/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { BotPanelManager } from './BotPanelManager';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import type { PrecalculatedBot } from '@casual-simulation/aux-common';
import {
    createBot,
    createPrecalculatedBot,
    botAdded,
    BotIndex,
    botUpdated,
    botRemoved,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';

describe('BotPanelManager', () => {
    let manager: BotPanelManager;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let index: BotIndex;
    let vm: TestAuxVM;
    let userId = 'user';

    beforeEach(async () => {
        vm = new TestAuxVM('sim', userId);
        vm.processEvents = true;
        helper = new BotHelper(vm);
        helper.userId = userId;
        index = new BotIndex();

        watcher = new BotWatcher(
            helper,
            index,
            vm.stateUpdated,
            vm.versionUpdated
        );

        await vm.sendEvents([
            botAdded(
                createBot('user', {
                    sheetPortal: 'hello',
                })
            ),
        ]);

        manager = new BotPanelManager(watcher, helper, false);
    });

    describe('botsUpdated', () => {
        it('should resolve whenever a bot in the given dimension updates', async () => {
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe((e) => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: null,
                    })
                ),
            ]);

            expect(bots).toEqual([helper.botsState['test']]);

            await vm.sendEvents([
                botUpdated('test2', {
                    tags: {
                        hello: true,
                    },
                }),
            ]);

            expect(bots).toEqual([
                helper.botsState['test'],
                helper.botsState['test2'],
            ]);
        });

        it('should resolve with no bots when there is no user', async () => {
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe((e) => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botRemoved('user'),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
            ]);

            expect(bots).toEqual([]);
        });

        it('should include all bots when the dimension is set to true', async () => {
            manager = new BotPanelManager(watcher, helper, false);
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe((e) => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        sheetPortal: true,
                    },
                }),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
            ]);

            expect(bots).toEqual(helper.objects);
        });

        it('should include all bots when the dimension is set to id', async () => {
            manager = new BotPanelManager(watcher, helper, false);
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe((e) => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        sheetPortal: 'id',
                    },
                }),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
            ]);

            expect(bots).toEqual(helper.objects);
        });

        it('should update when the user bot changes the viewed dimension', async () => {
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe((e) => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        sheetPortal: 'wow',
                    },
                }),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                        wow: true,
                    })
                ),
            ]);

            expect(bots).toEqual([helper.botsState['test2']]);
        });

        it('should indicate whether the portal has a value', async () => {
            let hasPortal: boolean;
            manager.botsUpdated.subscribe((e) => {
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        sheetPortal: 'wow',
                    },
                }),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                        wow: true,
                    })
                ),
            ]);

            expect(hasPortal).toBe(true);

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        sheetPortal: null,
                    },
                }),
            ]);

            expect(hasPortal).toBe(false);
        });

        it('should indicate the dimension that the portal is using', async () => {
            let dimension: string;
            manager.botsUpdated.subscribe((e) => {
                dimension = e.dimension;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        sheetPortal: 'wow',
                    },
                }),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                        wow: true,
                    })
                ),
            ]);

            expect(dimension).toBe('wow');

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        sheetPortal: null,
                    },
                }),
            ]);

            expect(dimension).toBe(null);
        });

        it('should indicate that a single bot is selected', async () => {
            let isSingleBot = false;
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe((e) => {
                isSingleBot = e.isSingleBot;
                bots = e.bots;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        sheetPortal: 'test',
                    },
                }),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                        wow: true,
                    })
                ),
            ]);

            expect(isSingleBot).toBe(true);
            expect(bots).toEqual([
                createPrecalculatedBot('test', {
                    hello: true,
                }),
            ]);

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        sheetPortal: null,
                    },
                }),
            ]);

            expect(isSingleBot).toBe(false);
            expect(bots).toEqual([]);
        });
    });
});
