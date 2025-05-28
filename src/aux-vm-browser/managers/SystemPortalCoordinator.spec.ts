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
import type {
    SystemPortalDiffSelectionUpdate,
    SystemPortalDiffUpdate,
    SystemPortalHasRecentsUpdate,
    SystemPortalRecentsUpdate,
    SystemPortalSearchUpdate,
    SystemPortalSelectionUpdate,
    SystemPortalUpdate,
} from './SystemPortalCoordinator';
import {
    getBotTitle,
    getSystemArea,
    searchTag,
    searchValue,
    SystemPortalCoordinator,
} from './SystemPortalCoordinator';
import type { AuxConfigParameters } from '@casual-simulation/aux-vm';
import { SimulationManager } from '@casual-simulation/aux-vm';
import type {
    SystemPortalPane,
    ConnectionInfo,
} from '@casual-simulation/aux-common';
import {
    createBot,
    createPrecalculatedBot,
    botAdded,
    botUpdated,
    registerPrefix,
    SYSTEM_PORTAL,
    SYSTEM_PORTAL_BOT,
    TEMPORARY_BOT_PARTITION_ID,
    EDITING_TAG,
    EDITING_BOT,
    EDITING_TAG_SPACE,
    SYSTEM_PORTAL_TAG,
    SYSTEM_PORTAL_SEARCH,
    SYSTEM_TAG_NAME,
    SYSTEM_PORTAL_DIFF,
    SYSTEM_PORTAL_DIFF_BOT,
    SYSTEM_PORTAL_DIFF_TAG,
    SYSTEM_PORTAL_DIFF_TAG_SPACE,
    KNOWN_TAG_PREFIXES,
    merge,
    SHEET_PORTAL,
    SYSTEM_PORTAL_PANE,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import { Subject, Subscription } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { skip } from 'rxjs/operators';
import { BotManager } from './BotManager';

console.log = jest.fn();

describe('SystemPortalCoordinator', () => {
    let manager: SystemPortalCoordinator<BotManager>;
    let connectionId = 'connectionId';
    let updates: SystemPortalUpdate[];
    let selectionUpdates: SystemPortalSelectionUpdate[];
    let recentsUpdates: SystemPortalRecentsUpdate[];
    let searchUpdates: SystemPortalSearchUpdate[];
    let diffUpdates: SystemPortalDiffUpdate[];
    let diffSelectionUpdates: SystemPortalDiffSelectionUpdate[];
    let sim: BotManager;
    let sub: Subscription;
    let vms: Map<string, TestAuxVM>;

    let simManager: SimulationManager<BotManager>;

    async function addSimulation(id: string) {
        const sim = await simManager.addSimulation(id, {
            recordName: null,
            inst: id,
        });

        simManager.primary.helper.transaction(
            botAdded(createBot(connectionId, {}))
        );

        await waitAsync();

        return sim;
    }

    beforeEach(async () => {
        sub = new Subscription();
        vms = new Map();

        const connection: ConnectionInfo = {
            connectionId: connectionId,
            userId: 'userId',
            sessionId: 'sessionId',
        };

        const config: AuxConfigParameters = {
            version: 'v1.0.0',
            versionHash: 'hash',
        };

        simManager = new SimulationManager((id, options) => {
            const vm = new TestAuxVM(id, connection.connectionId);
            vm.processEvents = true;
            vm.localEvents = new Subject();
            vms.set(id, vm);
            return new BotManager(options, config, vm);
        });

        await simManager.setPrimary('sim-1', {
            recordName: null,
            inst: 'sim-1',
        });
        sim = await addSimulation('sim-1');

        updates = [];
        selectionUpdates = [];
        recentsUpdates = [];
        searchUpdates = [];
        diffUpdates = [];
        diffSelectionUpdates = [];

        manager = new SystemPortalCoordinator(simManager, false);
        sub.add(
            manager.onItemsUpdated
                .pipe(skip(1))
                .subscribe((u) => updates.push(u))
        );
        sub.add(
            manager.onSelectionUpdated
                .pipe(skip(1))
                .subscribe((u) => selectionUpdates.push(u))
        );
        sub.add(
            manager.onRecentsUpdated
                .pipe(skip(1))
                .subscribe((u) => recentsUpdates.push(u))
        );
        sub.add(
            manager.onSearchResultsUpdated
                .pipe(skip(1))
                .subscribe((u) => searchUpdates.push(u))
        );
        sub.add(
            manager.onDiffUpdated
                .pipe(skip(1))
                .subscribe((u) => diffUpdates.push(u))
        );
        sub.add(
            manager.onDiffSelectionUpdated
                .pipe(skip(1))
                .subscribe((u) => diffSelectionUpdates.push(u))
        );
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('onItemsUpdated', () => {
        it('should resolve when the user bot is updated with the portal tag', async () => {
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: null,
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: null,
                    selectedBotSimulationId: null,
                    items: [],
                },
                {
                    hasPortal: false,
                },
            ]);
        });

        it('should include bots where the portal is contained in the bot system tag', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        system: 'wrong.other.test4',
                    })
                ),
                botAdded(
                    createBot('test5', {
                        system: 'wrong.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        system: 'different.core.test6',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: null,
                    selectedBotSimulationId: null,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'core.game',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    system: 'core.game.test1',
                                                }
                                            ),
                                            system: 'core.game.test1',
                                            title: 'test1',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: 'core.game.test2',
                                                }
                                            ),
                                            system: 'core.game.test2',
                                            title: 'test2',
                                        },
                                    ],
                                },
                                {
                                    area: 'core.other',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test3',
                                                {
                                                    system: 'core.other.test3',
                                                }
                                            ),
                                            system: 'core.other.test3',
                                            title: 'test3',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test4',
                                                {
                                                    system: 'core.other.test4',
                                                }
                                            ),
                                            system: 'core.other.test4',
                                            title: 'test4',
                                        },
                                    ],
                                },
                                {
                                    area: 'different.core',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test6',
                                                {
                                                    system: 'different.core.test6',
                                                }
                                            ),
                                            system: 'different.core.test6',
                                            title: 'test6',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support bots with the system tag set to a boolean value', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test1', {
                        system: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        system: false,
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: true,
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: null,
                    selectedBotSimulationId: null,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'false',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: false,
                                                }
                                            ),
                                            system: 'false',
                                            title: '',
                                        },
                                    ],
                                },
                                {
                                    area: 'true',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    system: true,
                                                }
                                            ),
                                            system: 'true',
                                            title: '',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support bots with the system tag set to a number value', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test1', {
                        system: 123,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        system: 456,
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: true,
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: null,
                    selectedBotSimulationId: null,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: '123',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    system: 123,
                                                }
                                            ),
                                            system: '123',
                                            title: '',
                                        },
                                    ],
                                },
                                {
                                    area: '456',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: 456,
                                                }
                                            ),
                                            system: '456',
                                            title: '',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should update the selected bot from the user bot', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: 'test2',
                    selectedBotSimulationId: sim.id,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'core.game',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    system: 'core.game.test1',
                                                }
                                            ),
                                            system: 'core.game.test1',
                                            title: 'test1',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: 'core.game.test2',
                                                }
                                            ),
                                            system: 'core.game.test2',
                                            title: 'test2',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support bot links in the systemPortalBot tag', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: '🔗test2',
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: 'test2',
                    selectedBotSimulationId: sim.id,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'core.game',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    system: 'core.game.test1',
                                                }
                                            ),
                                            system: 'core.game.test1',
                                            title: 'test1',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: 'core.game.test2',
                                                }
                                            ),
                                            system: 'core.game.test2',
                                            title: 'test2',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should keep the currently selected bot in this list if the system portal tag has changed', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.other',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: 'test2',
                    selectedBotSimulationId: sim.id,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'core.game',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: 'core.game.test2',
                                                }
                                            ),
                                            system: 'core.game.test2',
                                            title: 'test2',
                                        },
                                    ],
                                },
                                {
                                    area: 'core.other',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test3',
                                                {
                                                    system: 'core.other.test3',
                                                }
                                            ),
                                            system: 'core.other.test3',
                                            title: 'test3',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test4',
                                                {
                                                    system: 'core.other.test4',
                                                }
                                            ),
                                            system: 'core.other.test4',
                                            title: 'test4',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should include all bots when the portal is set to true', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        system: 'wrong.other.test6',
                    })
                ),
                botAdded(
                    createBot('test5', {
                        system: 'wrong.other.test5',
                    })
                ),
                botAdded(
                    createBot('test7', {
                        notSystem: 'value',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: true,
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: null,
                    selectedBotSimulationId: null,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'core.game',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    system: 'core.game.test1',
                                                }
                                            ),
                                            system: 'core.game.test1',
                                            title: 'test1',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: 'core.game.test2',
                                                }
                                            ),
                                            system: 'core.game.test2',
                                            title: 'test2',
                                        },
                                    ],
                                },
                                {
                                    area: 'core.other',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test3',
                                                {
                                                    system: 'core.other.test3',
                                                }
                                            ),
                                            system: 'core.other.test3',
                                            title: 'test3',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test4',
                                                {
                                                    system: 'core.other.test4',
                                                }
                                            ),
                                            system: 'core.other.test4',
                                            title: 'test4',
                                        },
                                    ],
                                },
                                {
                                    area: 'wrong.other',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test5',
                                                {
                                                    system: 'wrong.other.test5',
                                                }
                                            ),
                                            system: 'wrong.other.test5',
                                            title: 'test5',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test6',
                                                {
                                                    system: 'wrong.other.test6',
                                                }
                                            ),
                                            system: 'wrong.other.test6',
                                            title: 'test6',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should use the systemTagName if specified', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        test: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        test: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        test: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        test: 'core.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        test: 'wrong.other.test4',
                    })
                ),
                botAdded(
                    createBot('test5', {
                        test: 'wrong.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        test: 'different.core.test6',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                        [SYSTEM_TAG_NAME]: 'test',
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: null,
                    selectedBotSimulationId: null,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'core.game',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    test: 'core.game.test1',
                                                }
                                            ),
                                            system: 'core.game.test1',
                                            title: 'test1',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    test: 'core.game.test2',
                                                }
                                            ),
                                            system: 'core.game.test2',
                                            title: 'test2',
                                        },
                                    ],
                                },
                                {
                                    area: 'core.other',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test3',
                                                {
                                                    test: 'core.other.test3',
                                                }
                                            ),
                                            system: 'core.other.test3',
                                            title: 'test3',
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test4',
                                                {
                                                    test: 'core.other.test4',
                                                }
                                            ),
                                            system: 'core.other.test4',
                                            title: 'test4',
                                        },
                                    ],
                                },
                                {
                                    area: 'different.core',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test6',
                                                {
                                                    test: 'different.core.test6',
                                                }
                                            ),
                                            system: 'different.core.test6',
                                            title: 'test6',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });
    });

    describe('onSelectionUpdated', () => {
        it('should resolve when a bot is selected via the user bot', async () => {
            const vm = vms.get(sim.id);
            vm.localEvents.next([
                registerPrefix('🚀', {
                    name: 'test',
                }),
            ]);

            await waitAsync();

            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                        mod: '🧬{}',
                        link: '🔗abc',
                        rocket: '🚀myRocket',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot(
                        'test2',
                        {
                            system: 'core.game.test2',
                            color: 'red',
                            onClick: '@os.toast("Cool!");',
                            mod: {},
                            link: '🔗abc',
                            rocket: '🚀myRocket',
                        },
                        {
                            system: 'core.game.test2',
                            color: 'red',
                            onClick: '@os.toast("Cool!");',
                            mod: '🧬{}',
                            link: '🔗abc',
                            rocket: '🚀myRocket',
                        }
                    ),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'link', isLink: true, prefix: '🔗' },
                        { name: 'mod', isFormula: true, prefix: '🧬' },
                        { name: 'rocket', prefix: '🚀' },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should include tag masks', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                )
            );
            await sim.helper.transaction(
                botUpdated('test2', {
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            color: 'blue',
                        },
                    },
                }),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: {
                        id: 'test2',
                        precalculated: true,
                        values: {
                            system: 'core.game.test2',
                            color: 'blue',
                            onClick: '@os.toast("Cool!");',
                        },
                        tags: {
                            system: 'core.game.test2',
                            color: 'red',
                            onClick: '@os.toast("Cool!");',
                        },
                        masks: {
                            [TEMPORARY_BOT_PARTITION_ID]: {
                                color: 'blue',
                            },
                        },
                    },
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'color', space: TEMPORARY_BOT_PARTITION_ID },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should sort alphabetically if specified', async () => {
            manager.tagSortMode = 'alphabetical';
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'alphabetical',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'color' },
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should resolve when a tag is selected via the user bot', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_TAG]: 'onClick',
                    },
                })
            );

            await waitAsync();

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tag: 'onClick',
                    space: null,
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should include the selected tag in the tags list even if the bot doesnt have the tag', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                        [SYSTEM_PORTAL_TAG]: 'onClick',
                    },
                })
            );

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                    }),
                    tag: 'onClick',
                    space: null,
                    tags: [{ name: 'onClick' }, { name: 'system' }],
                },
            ]);
        });

        it('should use the systemTagName if specified', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        test: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                        mod: '🧬{}',
                        link: '🔗abc',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        test: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        test: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        test: 'core.other.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                        [SYSTEM_TAG_NAME]: 'test',
                    },
                })
            );

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot(
                        'test2',
                        {
                            test: 'core.game.test2',
                            color: 'red',
                            onClick: '@os.toast("Cool!");',
                            mod: {},
                            link: '🔗abc',
                        },
                        {
                            test: 'core.game.test2',
                            color: 'red',
                            onClick: '@os.toast("Cool!");',
                            mod: '🧬{}',
                            link: '🔗abc',
                        }
                    ),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'link', isLink: true, prefix: '🔗' },
                        { name: 'mod', isFormula: true, prefix: '🧬' },
                        { name: 'test' },
                    ],
                },
            ]);
        });
    });

    describe('addTag()', () => {
        it('should add the new tag to the tags list', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addTag('test');

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                        { name: 'test', focusValue: true },
                    ],
                },
            ]);
        });

        it('should be able to add tags that already exist on bot', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addTag('onClick');

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should focus the new tag and unfocus the other pinned tags', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addTag('onClick');

            await waitAsync();

            manager.addTag('other');

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'other', focusValue: true },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should create an empty script if the tag is prefixed with @', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            await manager.addTag('@onClick');

            await waitAsync();

            expect(sim.helper.botsState['test2']).toEqual(
                createPrecalculatedBot('test2', {
                    system: 'core.game.test2',
                    onClick: '@',
                })
            );

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@',
                    }),
                    tags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should create an empty mod if the tag is prefixed with the DNA emoji', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            await manager.addTag('🧬mod');

            await waitAsync();

            expect(sim.helper.botsState['test2']).toEqual(
                createPrecalculatedBot(
                    'test2',
                    {
                        system: 'core.game.test2',
                        mod: expect.any(String),
                    },
                    {
                        system: 'core.game.test2',
                        mod: '🧬',
                    }
                )
            );

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot(
                        'test2',
                        {
                            system: 'core.game.test2',
                            mod: expect.any(String),
                        },
                        {
                            system: 'core.game.test2',
                            mod: '🧬',
                        }
                    ),
                    tags: [
                        { name: 'mod', isFormula: true, prefix: '🧬' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot(
                        'test2',
                        {
                            system: 'core.game.test2',
                            mod: expect.any(String),
                        },
                        {
                            system: 'core.game.test2',
                            mod: '🧬',
                        }
                    ),
                    tags: [
                        {
                            name: 'mod',
                            isFormula: true,
                            prefix: '🧬',
                            focusValue: true,
                        },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should focus the new tag if it is already on the bot', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addTag('onClick');
            manager.addTag('onClick');

            await waitAsync();

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                        { name: 'system' },
                    ],
                },
            ]);
        });
    });

    describe('addPinnedTag()', () => {
        it('should add the new tag to a pinned tags list', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addPinnedTag('test');

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [{ name: 'test', focusValue: true }],
                },
            ]);
        });

        it('should be able to add tags that already exist on bot', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addPinnedTag('onClick');

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                    ],
                },
            ]);
        });

        it('should focus the new tag and unfocus the other pinned tags', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addPinnedTag('onClick');

            await waitAsync();

            manager.addPinnedTag('other');

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'other', focusValue: true },
                    ],
                },
            ]);
        });

        it('should preserve pinned tags across bots', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.game.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addPinnedTag('onClick');

            await waitAsync();

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test3',
                    },
                })
            );

            await waitAsync();

            expect(selectionUpdates.slice(2)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test3', {
                        system: 'core.game.test3',
                    }),
                    tags: [{ name: 'system' }],
                    pinnedTags: [{ name: 'onClick' }],
                },
            ]);
        });

        it('should do nothing if the new tag is already pinned', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addPinnedTag('onClick');
            manager.addPinnedTag('onClick');

            await waitAsync();

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                    ],
                },
            ]);
        });

        it('should create an empty script if the tag is prefixed with @', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            await manager.addPinnedTag('@onClick');

            await waitAsync();

            expect(sim.helper.botsState['test2']).toEqual(
                createPrecalculatedBot('test2', {
                    system: 'core.game.test2',
                    onClick: '@',
                })
            );

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                    ],
                },
            ]);
        });

        it('should create an empty mod if the tag is prefixed with the DNA emoji', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            await manager.addPinnedTag('🧬mod');

            await waitAsync();

            expect(sim.helper.botsState['test2']).toEqual(
                createPrecalculatedBot(
                    'test2',
                    {
                        system: 'core.game.test2',
                        mod: expect.any(String),
                    },
                    {
                        system: 'core.game.test2',
                        mod: '🧬',
                    }
                )
            );

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot(
                        'test2',
                        {
                            system: 'core.game.test2',
                            mod: expect.any(String),
                        },
                        {
                            system: 'core.game.test2',
                            mod: '🧬',
                        }
                    ),
                    tags: [
                        { name: 'mod', isFormula: true, prefix: '🧬' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot(
                        'test2',
                        {
                            system: 'core.game.test2',
                            mod: expect.any(String),
                        },
                        {
                            system: 'core.game.test2',
                            mod: '🧬',
                        }
                    ),
                    tags: [
                        { name: 'mod', isFormula: true, prefix: '🧬' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'mod',
                            focusValue: true,
                            isFormula: true,
                            prefix: '🧬',
                        },
                    ],
                },
            ]);
        });
    });

    describe('removePinnedTag()', () => {
        it('should remove the given tag from the pinned tags list', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.addPinnedTag('test');

            await waitAsync();

            manager.removePinnedTag({ name: 'test' });

            await waitAsync();

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [{ name: 'test', focusValue: true }],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    simulationId: sim.id,
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should do nothing if given a tag that is not pinned', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                })
            );

            await waitAsync();

            manager.removePinnedTag({ name: 'test' });

            await waitAsync();

            expect(selectionUpdates.slice(1)).toEqual([]);
        });
    });

    describe('onRecentsUpdate', () => {
        it('should resolve when the editingTag tag changes', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                })
            );

            await waitAsync();

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'color',
                    },
                })
            );

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'color',
                            space: null,
                        },
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should support bots with the system tag set to a boolean value', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test1', {
                        system: true,
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        system: false,
                        color: 'blue',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test1',
                        [EDITING_TAG]: 'onClick',
                    },
                })
            );

            await waitAsync();

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'color',
                    },
                })
            );

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'true',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test1',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'false',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'color',
                            space: null,
                        },
                        {
                            hint: '',
                            system: 'true',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test1',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should bot links for editingBot', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: '🔗test2',
                        [EDITING_TAG]: 'onClick',
                    },
                })
            );

            await waitAsync();

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: '🔗test2',
                        [EDITING_TAG]: 'color',
                    },
                })
            );

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'color',
                            space: null,
                        },
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should support formulas', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '🧬{}',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                })
            );

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: true,
                            isLink: false,
                            prefix: '🧬',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should support links', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        link: '🔗abc',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'link',
                    },
                })
            );

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: true,
                            prefix: '🔗',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'link',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should support tag masks', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                        [EDITING_TAG_SPACE]: 'tempLocal',
                    },
                })
            );

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: 'tempLocal',
                        },
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should update the name on other tags if there are two of the same tag name', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                        onClick: '@os.toast("Test!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test1',
                        [EDITING_TAG]: 'onClick',
                    },
                })
            );

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test1',
                            system: 'core.game.test1',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test1',
                            tag: 'onClick',
                            space: null,
                        },
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should not add a hint if just moving a tag to the front', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'color',
                    },
                })
            );

            await waitAsync();

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                })
            );

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'color',
                            space: null,
                        },
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            simulationId: sim.id,
                            botId: 'test2',
                            tag: 'color',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should limit recent items to 10 items', async () => {
            let tags = {} as any;
            for (let i = 0; i < 20; i++) {
                tags['tag' + i] = 'abc';
            }

            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        ...tags,
                    })
                )
            );

            for (let tag in tags) {
                await sim.helper.transaction(
                    botUpdated(connectionId, {
                        tags: {
                            [EDITING_BOT]: 'test2',
                            [EDITING_TAG]: tag,
                        },
                    })
                );
                await waitAsync();
            }

            const lastUpdate = recentsUpdates[recentsUpdates.length - 1];

            expect(lastUpdate.hasRecents).toBe(true);
            expect(
                (lastUpdate as SystemPortalHasRecentsUpdate).recentTags
            ).toHaveLength(10);
        });

        it('should support systemTagName if specified', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        test: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        test: 'core.game.test1',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                        [SYSTEM_TAG_NAME]: 'test',
                    },
                })
            );

            await waitAsync();

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'color',
                    },
                })
            );

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            simulationId: sim.id,
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            botId: 'test2',
                            simulationId: sim.id,
                            tag: 'color',
                            space: null,
                        },
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            simulationId: sim.id,
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });
    });

    describe('onSearchResultsUpdated', () => {
        it('should resolve when the user bot is updated with the portal tag', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        script1: '@abcdefghi',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                        script2: '@abcdefghiabcdef',
                        script3: '@abcdefghi\nabcdefghi',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                        link1: '🔗abcdef',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                        normal1: 'abcdef',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'abcdef',
                    },
                })
            );

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 7,
                    numBots: 4,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'core.game',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    system: 'core.game.test1',
                                                    script2: '@abcdefghiabcdef',
                                                    script3:
                                                        '@abcdefghi\nabcdefghi',
                                                }
                                            ),
                                            title: 'test1',
                                            tags: [
                                                {
                                                    tag: 'script2',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghiabcdef',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                        {
                                                            text: 'abcdefghiabcdef',
                                                            index: 10,
                                                            endIndex: 16,
                                                            highlightStartIndex: 9,
                                                            highlightEndIndex: 15,
                                                        },
                                                    ],
                                                },
                                                {
                                                    tag: 'script3',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 11,
                                                            endIndex: 17,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: 'core.game.test2',
                                                    script1: '@abcdefghi',
                                                }
                                            ),
                                            title: 'test2',
                                            tags: [
                                                {
                                                    tag: 'script1',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    area: 'core.other',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test3',
                                                {
                                                    system: 'core.other.test3',
                                                    normal1: 'abcdef',
                                                }
                                            ),
                                            title: 'test3',
                                            tags: [
                                                {
                                                    tag: 'normal1',
                                                    matches: [
                                                        {
                                                            text: 'abcdef',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test4',
                                                {
                                                    system: 'core.other.test4',
                                                    link1: '🔗abcdef',
                                                }
                                            ),
                                            title: 'test4',
                                            tags: [
                                                {
                                                    tag: 'link1',
                                                    isLink: true,
                                                    prefix: '🔗',
                                                    matches: [
                                                        {
                                                            text: 'abcdef',
                                                            index: 2,
                                                            endIndex: 8,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should resolve with an empty array of items if the search query transitioned from returning results to returning no results', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        script1: '@abcdefghi',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                        script2: '@abcdefghiabcdef',
                        script3: '@abcdefghi\nabcdefghi',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                        link1: '🔗abcdef',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                        normal1: 'abcdef',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'abcdef',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'nothing',
                    },
                })
            );

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 7,
                    numBots: 4,
                    items: expect.any(Array),
                },
                {
                    numMatches: 0,
                    numBots: 0,
                    items: [],
                },
            ]);
        });

        it('should support matches for tag masks', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated('test2', {
                    masks: {
                        space2: {
                            script1: '@abcdefghi',
                        },
                    },
                }),
                botUpdated('test1', {
                    masks: {
                        space1: {
                            script2: '@abcdefghiabcdef',
                            script3: '@abcdefghi\nabcdefghi',
                        },
                    },
                }),
                botUpdated('test4', {
                    masks: {
                        space4: {
                            link1: '🔗abcdef',
                        },
                    },
                }),
                botUpdated('test3', {
                    masks: {
                        space3: {
                            normal1: 'abcdef',
                        },
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'abcdef',
                    },
                })
            );

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 7,
                    numBots: 4,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'core.game',
                                    bots: [
                                        {
                                            bot: merge(
                                                createPrecalculatedBot(
                                                    'test1',
                                                    {
                                                        system: 'core.game.test1',
                                                    }
                                                ),
                                                {
                                                    values: {
                                                        script2: null,
                                                        script3: null,
                                                    },
                                                    masks: {
                                                        space1: {
                                                            script2:
                                                                '@abcdefghiabcdef',
                                                            script3:
                                                                '@abcdefghi\nabcdefghi',
                                                        },
                                                    },
                                                }
                                            ),
                                            title: 'test1',
                                            tags: [
                                                {
                                                    tag: 'script2',
                                                    space: 'space1',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghiabcdef',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                        {
                                                            text: 'abcdefghiabcdef',
                                                            index: 10,
                                                            endIndex: 16,
                                                            highlightStartIndex: 9,
                                                            highlightEndIndex: 15,
                                                        },
                                                    ],
                                                },
                                                {
                                                    tag: 'script3',
                                                    space: 'space1',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 11,
                                                            endIndex: 17,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            bot: merge(
                                                createPrecalculatedBot(
                                                    'test2',
                                                    {
                                                        system: 'core.game.test2',
                                                    }
                                                ),
                                                {
                                                    values: {
                                                        script1: null,
                                                    },
                                                    masks: {
                                                        space2: {
                                                            script1:
                                                                '@abcdefghi',
                                                        },
                                                    },
                                                }
                                            ),
                                            title: 'test2',
                                            tags: [
                                                {
                                                    tag: 'script1',
                                                    space: 'space2',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    area: 'core.other',
                                    bots: [
                                        {
                                            bot: merge(
                                                createPrecalculatedBot(
                                                    'test3',
                                                    {
                                                        system: 'core.other.test3',
                                                    }
                                                ),
                                                {
                                                    values: {
                                                        normal1: null,
                                                    },
                                                    masks: {
                                                        space3: {
                                                            normal1: 'abcdef',
                                                        },
                                                    },
                                                }
                                            ),
                                            title: 'test3',
                                            tags: [
                                                {
                                                    tag: 'normal1',
                                                    space: 'space3',
                                                    matches: [
                                                        {
                                                            text: 'abcdef',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            bot: merge(
                                                createPrecalculatedBot(
                                                    'test4',
                                                    {
                                                        system: 'core.other.test4',
                                                    }
                                                ),
                                                {
                                                    values: {
                                                        link1: null,
                                                    },
                                                    masks: {
                                                        space4: {
                                                            link1: '🔗abcdef',
                                                        },
                                                    },
                                                }
                                            ),
                                            title: 'test4',
                                            tags: [
                                                {
                                                    tag: 'link1',
                                                    space: 'space4',
                                                    isLink: true,
                                                    prefix: '🔗',
                                                    matches: [
                                                        {
                                                            text: 'abcdef',
                                                            index: 2,
                                                            endIndex: 8,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support bots that have the system tag set to a boolean value', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: true,
                        script1: '@abcdefghi',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: false,
                        script2: '@abcdefghiabcdef',
                        script3: '@abcdefghi\nabcdefghi',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'abcdef',
                    },
                })
            );

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 5,
                    numBots: 2,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'false',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    system: false,
                                                    script2: '@abcdefghiabcdef',
                                                    script3:
                                                        '@abcdefghi\nabcdefghi',
                                                }
                                            ),
                                            title: '',
                                            tags: [
                                                {
                                                    tag: 'script2',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghiabcdef',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                        {
                                                            text: 'abcdefghiabcdef',
                                                            index: 10,
                                                            endIndex: 16,
                                                            highlightStartIndex: 9,
                                                            highlightEndIndex: 15,
                                                        },
                                                    ],
                                                },
                                                {
                                                    tag: 'script3',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 11,
                                                            endIndex: 17,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    area: 'true',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: true,
                                                    script1: '@abcdefghi',
                                                }
                                            ),
                                            title: '',
                                            tags: [
                                                {
                                                    tag: 'script1',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support exact matches for ID', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: true,
                        script1: '@abcdefghi',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: false,
                        script2: '@abcdefghiabcdef',
                        script3: '@abcdefghi\nabcdefghi',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'test2',
                    },
                })
            );

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 1,
                    numBots: 1,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'true',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: true,
                                                    script1: '@abcdefghi',
                                                }
                                            ),
                                            title: '',
                                            tags: [
                                                {
                                                    tag: 'id',
                                                    matches: [
                                                        {
                                                            text: 'test2',
                                                            index: 0,
                                                            endIndex: 5,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 5,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support exact matches for space', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot(
                        'test2',
                        {
                            system: true,
                            script1: '@abcdefghi',
                        },
                        'shared'
                    )
                ),
                botAdded(
                    createBot('test1', {
                        system: false,
                        script2: '@abcdefghiabcdef',
                        script3: '@abcdefghi\nabcdefghi',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'shared',
                    },
                })
            );

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 1,
                    numBots: 1,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'true',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: true,
                                                    script1: '@abcdefghi',
                                                },
                                                undefined,
                                                'shared'
                                            ),
                                            title: '',
                                            tags: [
                                                {
                                                    tag: 'space',
                                                    matches: [
                                                        {
                                                            text: 'shared',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support matches for tag name', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: true,
                        script1: '@abcdefghi',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: false,
                        script2: '@abcdefghiabcdef',
                        script3: '@abcdefghi\nabcdefghi',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'script',
                    },
                })
            );

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 3,
                    numBots: 2,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'false',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    system: false,
                                                    script2: '@abcdefghiabcdef',
                                                    script3:
                                                        '@abcdefghi\nabcdefghi',
                                                }
                                            ),
                                            title: '',
                                            tags: [
                                                {
                                                    tag: 'script2',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'script2',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                            isTagName: true,
                                                        },
                                                    ],
                                                },
                                                {
                                                    tag: 'script3',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'script3',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                            isTagName: true,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    area: 'true',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    system: true,
                                                    script1: '@abcdefghi',
                                                }
                                            ),
                                            title: '',
                                            tags: [
                                                {
                                                    tag: 'script1',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'script1',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                            isTagName: true,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support matches for tag mask names', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: true,
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: false,
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );
            await sim.helper.transaction(
                botUpdated('test2', {
                    masks: {
                        space2: {
                            script1: '@abcdefghi',
                        },
                    },
                }),
                botUpdated('test1', {
                    masks: {
                        space1: {
                            script2: '@abcdefghiabcdef',
                            script3: '@abcdefghi\nabcdefghi',
                        },
                    },
                })
            );
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'script',
                    },
                })
            );

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 3,
                    numBots: 2,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'false',
                                    bots: [
                                        {
                                            bot: merge(
                                                createPrecalculatedBot(
                                                    'test1',
                                                    {
                                                        system: false,
                                                    }
                                                ),
                                                {
                                                    values: {
                                                        script2: null,
                                                        script3: null,
                                                    },
                                                    masks: {
                                                        space1: {
                                                            script2:
                                                                '@abcdefghiabcdef',
                                                            script3:
                                                                '@abcdefghi\nabcdefghi',
                                                        },
                                                    },
                                                }
                                            ),
                                            title: '',
                                            tags: [
                                                {
                                                    tag: 'script2',
                                                    space: 'space1',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'script2',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                            isTagName: true,
                                                        },
                                                    ],
                                                },
                                                {
                                                    tag: 'script3',
                                                    space: 'space1',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'script3',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                            isTagName: true,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    area: 'true',
                                    bots: [
                                        {
                                            bot: merge(
                                                createPrecalculatedBot(
                                                    'test2',
                                                    {
                                                        system: true,
                                                    }
                                                ),
                                                {
                                                    values: {
                                                        script1: null,
                                                    },
                                                    masks: {
                                                        space2: {
                                                            script1:
                                                                '@abcdefghi',
                                                        },
                                                    },
                                                }
                                            ),
                                            title: '',
                                            tags: [
                                                {
                                                    tag: 'script1',
                                                    space: 'space2',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'script1',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                            isTagName: true,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support systemTagName if specified', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        test: 'core.game.test2',
                        script1: '@abcdefghi',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        test: 'core.game.test1',
                        script2: '@abcdefghiabcdef',
                        script3: '@abcdefghi\nabcdefghi',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        test: 'core.other.test4',
                        link1: '🔗abcdef',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        test: 'core.other.test3',
                        normal1: 'abcdef',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                        [SYSTEM_TAG_NAME]: 'test',
                    },
                })
            );
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'abcdef',
                    },
                })
            );

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 0,
                    numBots: 0,
                    items: [],
                },
                {
                    numMatches: 7,
                    numBots: 4,
                    items: [
                        {
                            simulationId: sim.id,
                            areas: [
                                {
                                    area: 'core.game',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test1',
                                                {
                                                    test: 'core.game.test1',
                                                    script2: '@abcdefghiabcdef',
                                                    script3:
                                                        '@abcdefghi\nabcdefghi',
                                                }
                                            ),
                                            title: 'test1',
                                            tags: [
                                                {
                                                    tag: 'script2',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghiabcdef',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                        {
                                                            text: 'abcdefghiabcdef',
                                                            index: 10,
                                                            endIndex: 16,
                                                            highlightStartIndex: 9,
                                                            highlightEndIndex: 15,
                                                        },
                                                    ],
                                                },
                                                {
                                                    tag: 'script3',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 11,
                                                            endIndex: 17,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test2',
                                                {
                                                    test: 'core.game.test2',
                                                    script1: '@abcdefghi',
                                                }
                                            ),
                                            title: 'test2',
                                            tags: [
                                                {
                                                    tag: 'script1',
                                                    isScript: true,
                                                    prefix: '@',
                                                    matches: [
                                                        {
                                                            text: 'abcdefghi',
                                                            index: 1,
                                                            endIndex: 7,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    area: 'core.other',
                                    bots: [
                                        {
                                            bot: createPrecalculatedBot(
                                                'test3',
                                                {
                                                    test: 'core.other.test3',
                                                    normal1: 'abcdef',
                                                }
                                            ),
                                            title: 'test3',
                                            tags: [
                                                {
                                                    tag: 'normal1',
                                                    matches: [
                                                        {
                                                            text: 'abcdef',
                                                            index: 0,
                                                            endIndex: 6,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            bot: createPrecalculatedBot(
                                                'test4',
                                                {
                                                    test: 'core.other.test4',
                                                    link1: '🔗abcdef',
                                                }
                                            ),
                                            title: 'test4',
                                            tags: [
                                                {
                                                    tag: 'link1',
                                                    isLink: true,
                                                    prefix: '🔗',
                                                    matches: [
                                                        {
                                                            text: 'abcdef',
                                                            index: 2,
                                                            endIndex: 8,
                                                            highlightStartIndex: 0,
                                                            highlightEndIndex: 6,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });
    });

    describe('onDiffUpdated', () => {
        it('should resolve when the user bot is updated with the portal tag', async () => {
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: true,
                        [SYSTEM_PORTAL_DIFF]: 'core',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: true,
                        [SYSTEM_PORTAL_DIFF]: null,
                    },
                })
            );

            await waitAsync();

            expect(diffUpdates).toEqual([
                {
                    hasPortal: true,
                    selectedKey: null,
                    items: [],
                },
                {
                    hasPortal: false,
                },
            ]);
        });

        it('should include bots where the portal is contained in the bot system tag', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        removedTag: 123,
                        modifiedTag: 'abc',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        test: 'core.game.test2',
                        newTag: true,
                        modifiedTag: 'def',
                    })
                ),
                botAdded(
                    createBot('test7', {
                        test: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test8', {
                        test: 'different.core.test1',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: true,
                        [SYSTEM_PORTAL_DIFF]: 'test',
                    },
                })
            );

            await waitAsync();

            expect(diffUpdates).toEqual([
                {
                    hasPortal: true,
                    selectedKey: null,
                    items: [
                        {
                            area: 'core.game',
                            bots: [
                                {
                                    key: 'test1',
                                    originalBot: createPrecalculatedBot(
                                        'test1',
                                        {
                                            system: 'core.game.test1',
                                        }
                                    ),
                                    originalBotSimulationId: sim.id,
                                    newBot: createPrecalculatedBot('test7', {
                                        test: 'core.game.test1',
                                    }),
                                    newBotSimulationId: sim.id,
                                    title: 'test1',
                                    changedTags: [],
                                },
                                {
                                    key: 'test2',
                                    originalBot: createPrecalculatedBot(
                                        'test2',
                                        {
                                            system: 'core.game.test2',
                                            removedTag: 123,
                                            modifiedTag: 'abc',
                                        }
                                    ),
                                    originalBotSimulationId: sim.id,
                                    newBot: createPrecalculatedBot('test6', {
                                        test: 'core.game.test2',
                                        newTag: true,
                                        modifiedTag: 'def',
                                    }),
                                    newBotSimulationId: sim.id,
                                    title: 'test2',
                                    changedTags: [
                                        {
                                            tag: 'modifiedTag',
                                        },
                                        {
                                            tag: 'newTag',
                                        },
                                        {
                                            tag: 'removedTag',
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            area: 'core.other',
                            bots: [
                                {
                                    key: 'test3',
                                    removedBot: createPrecalculatedBot(
                                        'test3',
                                        {
                                            system: 'core.other.test3',
                                        }
                                    ),
                                    removedBotSimulationId: sim.id,
                                    title: 'test3',
                                },
                                {
                                    key: 'test4',
                                    removedBot: createPrecalculatedBot(
                                        'test4',
                                        {
                                            system: 'core.other.test4',
                                        }
                                    ),
                                    removedBotSimulationId: sim.id,
                                    title: 'test4',
                                },
                            ],
                        },
                        {
                            area: 'different.core',
                            bots: [
                                {
                                    key: 'test8',
                                    addedBot: createPrecalculatedBot('test8', {
                                        test: 'different.core.test1',
                                    }),
                                    addedBotSimulationId: sim.id,
                                    title: 'test1',
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should only include diff bots that match the system portal', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        removedTag: 123,
                        modifiedTag: 'abc',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        test: 'core.game.test2',
                        newTag: true,
                        modifiedTag: 'def',
                    })
                ),
                botAdded(
                    createBot('test7', {
                        test: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test8', {
                        test: 'different.core.test1',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_DIFF]: 'test',
                    },
                })
            );

            await waitAsync();

            expect(diffUpdates).toEqual([
                {
                    hasPortal: true,
                    selectedKey: null,
                    items: [
                        {
                            area: 'core.game',
                            bots: [
                                {
                                    key: 'test1',
                                    originalBot: createPrecalculatedBot(
                                        'test1',
                                        {
                                            system: 'core.game.test1',
                                        }
                                    ),
                                    originalBotSimulationId: sim.id,
                                    newBot: createPrecalculatedBot('test7', {
                                        test: 'core.game.test1',
                                    }),
                                    newBotSimulationId: sim.id,
                                    title: 'test1',
                                    changedTags: [],
                                },
                                {
                                    key: 'test2',
                                    originalBot: createPrecalculatedBot(
                                        'test2',
                                        {
                                            system: 'core.game.test2',
                                            removedTag: 123,
                                            modifiedTag: 'abc',
                                        }
                                    ),
                                    originalBotSimulationId: sim.id,
                                    newBot: createPrecalculatedBot('test6', {
                                        test: 'core.game.test2',
                                        newTag: true,
                                        modifiedTag: 'def',
                                    }),
                                    newBotSimulationId: sim.id,
                                    title: 'test2',
                                    changedTags: [
                                        {
                                            tag: 'modifiedTag',
                                        },
                                        {
                                            tag: 'newTag',
                                        },
                                        {
                                            tag: 'removedTag',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should update the selected bot from the user bot', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        test: 'core.game.test1',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_DIFF]: 'test',
                        [SYSTEM_PORTAL_DIFF_BOT]: 'test1',
                    },
                })
            );

            await waitAsync();

            expect(diffUpdates).toEqual([
                {
                    hasPortal: true,
                    selectedKey: 'test1',
                    items: [
                        {
                            area: 'core.game',
                            bots: [
                                {
                                    originalBot: createPrecalculatedBot(
                                        'test1',
                                        {
                                            system: 'core.game.test1',
                                        }
                                    ),
                                    originalBotSimulationId: sim.id,
                                    newBot: createPrecalculatedBot('test3', {
                                        test: 'core.game.test1',
                                    }),
                                    newBotSimulationId: sim.id,
                                    key: 'test1',
                                    title: 'test1',
                                    changedTags: [],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should resolve when a bot in the diff portal is updated', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test1', {
                        system: 'core.test',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        test: 'core.test',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: true,
                        [SYSTEM_PORTAL_DIFF]: 'test',
                    },
                })
            );

            await sim.helper.transaction(
                botAdded(
                    createBot('test2', {
                        newTag: 'abc',
                    })
                )
            );

            await waitAsync();

            expect(diffUpdates).toEqual([
                {
                    hasPortal: true,
                    selectedKey: null,
                    items: [
                        {
                            area: 'core',
                            bots: [
                                {
                                    key: 'test1',
                                    originalBot: createPrecalculatedBot(
                                        'test1',
                                        {
                                            system: 'core.test',
                                        }
                                    ),
                                    originalBotSimulationId: sim.id,
                                    newBot: createPrecalculatedBot('test2', {
                                        test: 'core.test',
                                    }),
                                    newBotSimulationId: sim.id,
                                    title: 'test',
                                    changedTags: [],
                                },
                            ],
                        },
                    ],
                },
                {
                    hasPortal: true,
                    selectedKey: null,
                    items: [
                        {
                            area: 'core',
                            bots: [
                                {
                                    key: 'test1',
                                    originalBot: createPrecalculatedBot(
                                        'test1',
                                        {
                                            system: 'core.test',
                                        }
                                    ),
                                    originalBotSimulationId: sim.id,
                                    newBot: createPrecalculatedBot('test2', {
                                        test: 'core.test',
                                        newTag: 'abc',
                                    }),
                                    newBotSimulationId: sim.id,
                                    title: 'test',
                                    changedTags: [
                                        {
                                            tag: 'newTag',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });
    });

    describe('onDiffSelectionUpdated', () => {
        it('should update the selected bot from the user bot', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                        removedTag: 'abc',
                        changedTag: 123,
                        sameTag: 'hello',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        test: 'core.game.test1',
                        changedTag: 456,
                        newTag: true,
                        sameTag: 'hello',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_DIFF]: 'test',
                        [SYSTEM_PORTAL_DIFF_BOT]: 'test1',
                    },
                })
            );

            await waitAsync();

            expect(diffSelectionUpdates).toEqual([
                {
                    hasSelection: true,
                    originalBot: createPrecalculatedBot('test1', {
                        system: 'core.game.test1',
                        removedTag: 'abc',
                        changedTag: 123,
                        sameTag: 'hello',
                    }),
                    originalBotSimulationId: sim.id,
                    newBot: createPrecalculatedBot('test3', {
                        test: 'core.game.test1',
                        changedTag: 456,
                        newTag: true,
                        sameTag: 'hello',
                    }),
                    newBotSimulationId: sim.id,
                    tag: null,
                    space: null,
                    tags: [
                        {
                            name: 'changedTag',
                            status: 'changed',
                        },
                        {
                            name: 'newTag',
                            status: 'added',
                        },
                        {
                            name: 'removedTag',
                            status: 'removed',
                        },
                        {
                            name: 'sameTag',
                            status: 'none',
                        },
                    ],
                },
            ]);
        });

        it('should not include the new bot for deleted bots', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                        removedTag: 'abc',
                        changedTag: 123,
                        sameTag: 'hello',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_DIFF]: 'test',
                        [SYSTEM_PORTAL_DIFF_BOT]: 'test1',
                    },
                })
            );

            await waitAsync();

            expect(diffSelectionUpdates).toEqual([
                {
                    hasSelection: true,
                    originalBot: createPrecalculatedBot('test1', {
                        system: 'core.game.test1',
                        removedTag: 'abc',
                        changedTag: 123,
                        sameTag: 'hello',
                    }),
                    originalBotSimulationId: sim.id,
                    newBot: null,
                    newBotSimulationId: null,
                    tag: null,
                    space: null,
                    tags: [
                        {
                            name: 'changedTag',
                            status: 'removed',
                        },
                        {
                            name: 'removedTag',
                            status: 'removed',
                        },
                        {
                            name: 'sameTag',
                            status: 'removed',
                        },
                    ],
                },
            ]);
        });

        it('should not include the old bot for added bots', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test3', {
                        test: 'core.game.test1',
                        removedTag: 'abc',
                        changedTag: 123,
                        sameTag: 'hello',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_DIFF]: 'test',
                        [SYSTEM_PORTAL_DIFF_BOT]: 'test3',
                    },
                })
            );

            await waitAsync();

            expect(diffSelectionUpdates).toEqual([
                {
                    hasSelection: true,
                    originalBot: null,
                    originalBotSimulationId: null,
                    newBot: createPrecalculatedBot('test3', {
                        test: 'core.game.test1',
                        removedTag: 'abc',
                        changedTag: 123,
                        sameTag: 'hello',
                    }),
                    newBotSimulationId: sim.id,
                    tag: null,
                    space: null,
                    tags: [
                        {
                            name: 'changedTag',
                            status: 'added',
                        },
                        {
                            name: 'removedTag',
                            status: 'added',
                        },
                        {
                            name: 'sameTag',
                            status: 'added',
                        },
                    ],
                },
            ]);
        });

        it('should include the selected tag and space', async () => {
            await sim.helper.transaction(
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                        removedTag: 'abc',
                        changedTag: 123,
                        sameTag: 'hello',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        test: 'core.game.test1',
                        changedTag: 456,
                        newTag: true,
                        sameTag: 'hello',
                    })
                ),
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_DIFF]: 'test',
                        [SYSTEM_PORTAL_DIFF_BOT]: 'test1',
                        [SYSTEM_PORTAL_DIFF_TAG]: 'newTag',
                        [SYSTEM_PORTAL_DIFF_TAG_SPACE]: 'space',
                    },
                })
            );

            await waitAsync();

            expect(diffSelectionUpdates).toEqual([
                {
                    hasSelection: true,
                    originalBot: createPrecalculatedBot('test1', {
                        system: 'core.game.test1',
                        removedTag: 'abc',
                        changedTag: 123,
                        sameTag: 'hello',
                    }),
                    originalBotSimulationId: sim.id,
                    newBot: createPrecalculatedBot('test3', {
                        test: 'core.game.test1',
                        changedTag: 456,
                        newTag: true,
                        sameTag: 'hello',
                    }),
                    newBotSimulationId: sim.id,
                    tag: 'newTag',
                    space: 'space',
                    tags: [
                        {
                            name: 'changedTag',
                            status: 'changed',
                        },
                        {
                            name: 'newTag',
                            status: 'added',
                        },
                        {
                            name: 'removedTag',
                            status: 'removed',
                        },
                        {
                            name: 'sameTag',
                            status: 'none',
                        },
                    ],
                },
            ]);
        });
    });

    describe('onSystemPortalPaneUpdated', () => {
        let panes = [] as SystemPortalPane[];

        beforeEach(() => {
            panes = [];
            sub.add(
                manager.onSystemPortalPaneUpdated
                    .pipe(skip(1))
                    .subscribe((pane) => {
                        panes.push(pane);
                    })
            );
        });

        it('should resolve with bots when the system portal is opened', async () => {
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: null,
                    },
                })
            );

            await waitAsync();

            expect(panes).toEqual(['bots', null]);
        });

        it('should resolve with sheet when bot the system portal and sheet portal are opened', async () => {
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                        [SHEET_PORTAL]: 'home',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: null,
                    },
                })
            );

            await waitAsync();

            expect(panes).toEqual(['sheet', null]);
        });

        it('should resolve with search when bot the system portal has a search', async () => {
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                        [SYSTEM_PORTAL_SEARCH]: 'home',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: null,
                    },
                })
            );

            await waitAsync();

            expect(panes).toEqual(['search', null]);
        });

        it('should resolve with diff when bot the system portal has a diff', async () => {
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                        [SYSTEM_PORTAL_DIFF]: 'home',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: null,
                    },
                })
            );

            await waitAsync();

            expect(panes).toEqual(['diff', null]);
        });

        it('should resolve with the selected pane', async () => {
            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                        [SYSTEM_PORTAL_PANE]: 'search',
                    },
                })
            );

            await sim.helper.transaction(
                botUpdated(connectionId, {
                    tags: {
                        [SYSTEM_PORTAL]: null,
                    },
                })
            );

            await waitAsync();

            expect(panes).toEqual(['search', null]);
        });
    });
});

describe('getSystemArea()', () => {
    const cases = [
        ['core', 'core'],
        ['core.ui', 'core'],
        ['core.ui.menu', 'core.ui'],
        ['core.ui.menu.button', 'core.ui'],
        ['.core.ui.menu.button', '.core'],
        ['..core.ui.menu.button', '.'],
        [null, ''],
    ];

    it.each(cases)('should map %s to %s', (given, expected) => {
        expect(getSystemArea(given)).toBe(expected);
    });
});

describe('getBotTitle()', () => {
    const cases = [
        ['core', '', 'core'],
        ['core.ui', 'core', 'ui'],
        ['core.ui.menu', 'core', 'ui.menu'],
        ['core.ui.menu.button', 'core.ui', 'menu.button'],
        ['.core.ui.menu.button', '', 'core.ui.menu.button'],
        ['..core.ui.menu.button', '', '.core.ui.menu.button'],
        ['', '', ''],
        [null, '', ''],
    ];

    it.each(cases)('should map %s to %s', (given, area, expected) => {
        expect(getBotTitle(given, area)).toBe(expected);
    });
});

describe('searchValue()', () => {
    it('should return a list of matches for the given value', () => {
        expect(searchValue('abcdefghi\nghiabcdef', 0, 'abcdef')).toEqual([
            {
                text: 'abcdefghi',
                index: 0,
                endIndex: 6,
                highlightStartIndex: 0,
                highlightEndIndex: 6,
            },
            {
                text: 'ghiabcdef',
                index: 13,
                endIndex: 19,
                highlightStartIndex: 3,
                highlightEndIndex: 9,
            },
        ]);
    });

    it('should add the given index offset value to the absolute indexes', () => {
        expect(searchValue('abcdefghi\nghiabcdef', 5, 'abcdef')).toEqual([
            {
                text: 'abcdefghi',
                index: 5,
                endIndex: 11,
                highlightStartIndex: 0,
                highlightEndIndex: 6,
            },
            {
                text: 'ghiabcdef',
                index: 18,
                endIndex: 24,
                highlightStartIndex: 3,
                highlightEndIndex: 9,
            },
        ]);
    });
});

describe('searchTag()', () => {
    it('should return an object if there are any matches', () => {
        expect(
            searchTag('test', null, '@abcdefghi', 'abcdef', KNOWN_TAG_PREFIXES)
        ).toEqual({
            tag: 'test',
            isScript: true,
            prefix: '@',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 1,
                    endIndex: 7,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should support library tags', () => {
        expect(
            searchTag('test', null, '📄abcdefghi', 'abcdef', KNOWN_TAG_PREFIXES)
        ).toEqual({
            tag: 'test',
            prefix: '📄',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 2,
                    endIndex: 8,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should support tag links', () => {
        expect(
            searchTag('test', null, '🔗abcdefghi', 'abcdef', KNOWN_TAG_PREFIXES)
        ).toEqual({
            tag: 'test',
            isLink: true,
            prefix: '🔗',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 2,
                    endIndex: 8,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should support formulas', () => {
        expect(
            searchTag('test', null, '🧬abcdefghi', 'abcdef', KNOWN_TAG_PREFIXES)
        ).toEqual({
            tag: 'test',
            isFormula: true,
            prefix: '🧬',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 2,
                    endIndex: 8,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should support normal tags', () => {
        expect(
            searchTag('test', null, 'abcdefghi', 'abcdef', KNOWN_TAG_PREFIXES)
        ).toEqual({
            tag: 'test',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 0,
                    endIndex: 6,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should support spaces', () => {
        expect(
            searchTag(
                'test',
                'mySpace',
                'abcdefghi',
                'abcdef',
                KNOWN_TAG_PREFIXES
            )
        ).toEqual({
            tag: 'test',
            space: 'mySpace',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 0,
                    endIndex: 6,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should return null if there are no matches', () => {
        expect(
            searchTag('test', null, '@abcdefghi', 'missing', KNOWN_TAG_PREFIXES)
        ).toEqual(null);
    });

    it('should convert objects to JSON', () => {
        expect(
            searchTag(
                'test',
                null,
                { test: 'abcdef' },
                'abcdef',
                KNOWN_TAG_PREFIXES
            )
        ).toEqual({
            tag: 'test',
            matches: [
                {
                    text: '{"test":"abcdef"}',
                    index: 9,
                    endIndex: 15,
                    highlightStartIndex: 9,
                    highlightEndIndex: 15,
                },
            ],
        });
    });

    it('should search the tag name', () => {
        expect(
            searchTag('test', null, '@abcdefghi', 'test', KNOWN_TAG_PREFIXES)
        ).toEqual({
            tag: 'test',
            isScript: true,
            prefix: '@',
            matches: [
                {
                    text: 'test',
                    index: 0,
                    endIndex: 4,
                    highlightStartIndex: 0,
                    highlightEndIndex: 4,
                    isTagName: true,
                },
            ],
        });
    });
});
