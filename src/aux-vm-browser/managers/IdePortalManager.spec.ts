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
import type { IdeNode } from './IdePortalManager';
import { IdePortalManager } from './IdePortalManager';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import {
    createBot,
    botAdded,
    BotIndex,
    botUpdated,
    registerPrefix,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import { Subject } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';

describe('IdePortalManager', () => {
    let manager: IdePortalManager;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let index: BotIndex;
    let vm: TestAuxVM;
    let userId = 'user';
    let localEvents: Subject<RuntimeActions[]>;

    beforeEach(async () => {
        vm = new TestAuxVM('sim', userId);
        vm.processEvents = true;
        localEvents = vm.localEvents = new Subject();
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
                    idePortal: '🔺',
                })
            ),
        ]);

        localEvents.next([
            registerPrefix('🔺', {
                language: 'javascript',
            }),
        ]);

        manager = new IdePortalManager(watcher, helper, false);
    });

    describe('botsUpdated', () => {
        it('should resolve whenever a bot with the correct prefix is added', async () => {
            let items: IdeNode[];
            let hasPortal: boolean;
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'hello.test',
                    botId: 'test',
                    tag: 'hello',
                    name: 'hello',
                },
            ]);

            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        other: '🔺myScript',
                    })
                ),
            ]);

            await waitAsync();

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'hello.test',
                    name: 'hello',
                    botId: 'test',
                    tag: 'hello',
                },
                {
                    type: 'tag',
                    key: 'other.test2',
                    name: 'other',
                    botId: 'test2',
                    tag: 'other',
                },
            ]);
            expect(hasPortal).toBe(true);
        });

        it('should resolve whenever a bot with the correct prefix is updated', async () => {
            let items: IdeNode[];
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'hello.test',
                    botId: 'test',
                    tag: 'hello',
                    name: 'hello',
                },
            ]);

            await vm.sendEvents([
                botUpdated('test', {
                    tags: {
                        other: '🔺a',
                    },
                }),
            ]);

            await waitAsync();

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'hello.test',
                    name: 'hello',
                    botId: 'test',
                    tag: 'hello',
                },
                {
                    type: 'tag',
                    key: 'other.test',
                    name: 'other',
                    botId: 'test',
                    tag: 'other',
                },
            ]);
        });

        it('should sort items by tag and then bot ID', async () => {
            let items: IdeNode[];
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        zzz: '🔺bcd',
                        aaa: '🔺script',
                    })
                ),
                botAdded(
                    createBot('abc', {
                        zzz: '🔺bcd',
                        bbb: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'aaa.test',
                    botId: 'test',
                    tag: 'aaa',
                    name: 'aaa',
                },
                {
                    type: 'tag',
                    key: 'bbb.abc',
                    botId: 'abc',
                    tag: 'bbb',
                    name: 'bbb',
                },
                {
                    type: 'tag',
                    key: 'zzz.abc',
                    botId: 'abc',
                    tag: 'zzz',
                    name: 'zzz',
                },
                {
                    type: 'tag',
                    key: 'zzz.test',
                    botId: 'test',
                    tag: 'zzz',
                    name: 'zzz',
                },
            ]);
        });

        it('should indicate listen tags are such', async () => {
            let items: IdeNode[];
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
            });

            await vm.sendEvents([
                botUpdated(userId, {
                    tags: {
                        idePortal: '@',
                    },
                }),
                botAdded(
                    createBot('test', {
                        zzz: '@bcd',
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'zzz.test',
                    botId: 'test',
                    tag: 'zzz',
                    name: 'zzz',
                    isScript: true,
                    prefix: '@',
                },
            ]);
        });

        it('should indicate DNA tags are such', async () => {
            let items: IdeNode[];
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
            });

            await vm.sendEvents([
                botUpdated(userId, {
                    tags: {
                        idePortal: '🧬',
                    },
                }),
                botAdded(
                    createBot('test', {
                        zzz: '🧬bcd',
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'zzz.test',
                    botId: 'test',
                    tag: 'zzz',
                    name: 'zzz',
                    isFormula: true,
                    prefix: '🧬',
                },
            ]);
        });

        it('should not have a portal if there is no idePortal tag on the user bot', async () => {
            let items: IdeNode[];
            let hasPortal: boolean;
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botUpdated(userId, {
                    tags: {
                        idePortal: null,
                    },
                }),
            ]);

            expect(hasPortal).toBe(false);
            expect(items).toEqual([]);
        });

        it('should include all tags if set to true', async () => {
            let items: IdeNode[];
            let hasPortal: boolean;
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('user', {
                        idePortal: true,
                    })
                ),
            ]);

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                        other: 'abc',
                        def: false,
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'def.test',
                    botId: 'test',
                    tag: 'def',
                    name: 'def',
                },
                {
                    type: 'tag',
                    key: 'hello.test',
                    botId: 'test',
                    tag: 'hello',
                    name: 'hello',
                },
                {
                    type: 'tag',
                    key: 'other.test',
                    botId: 'test',
                    tag: 'other',
                    name: 'other',
                },
            ]);
            expect(hasPortal).toBe(true);
        });

        it('should include all tags if set to the string true', async () => {
            let items: IdeNode[];
            let hasPortal: boolean;
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('user', {
                        idePortal: 'true',
                    })
                ),
            ]);

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                        other: 'abc',
                        def: false,
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'def.test',
                    botId: 'test',
                    tag: 'def',
                    name: 'def',
                },
                {
                    type: 'tag',
                    key: 'hello.test',
                    botId: 'test',
                    tag: 'hello',
                    name: 'hello',
                },
                {
                    type: 'tag',
                    key: 'other.test',
                    botId: 'test',
                    tag: 'other',
                    name: 'other',
                },
            ]);
            expect(hasPortal).toBe(true);
        });
    });
});
