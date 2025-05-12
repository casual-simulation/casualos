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
    AuxPartitions,
    MemoryPartition,
    RegisterHtmlAppAction,
} from '@casual-simulation/aux-common';
import {
    asyncResult,
    botAdded,
    createBot,
    createMemoryPartition,
    iteratePartitions,
    ON_DOCUMENT_AVAILABLE_ACTION_NAME,
    registerCustomApp,
    customAppContainerAvailable,
    toast,
    unregisterCustomApp,
} from '@casual-simulation/aux-common';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';
import { AuxRuntime } from '@casual-simulation/aux-runtime';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuxHelper } from '../vm';
import { CustomAppHelper } from './CustomAppHelper';
import type { HtmlPortalSetupResult } from './HtmlAppBackend';
import { HtmlAppBackend } from './HtmlAppBackend';

describe('CustomAppHelper', () => {
    let runtime: AuxRuntime;
    let actions: RuntimeActions[];
    let memory: MemoryPartition;
    let userId: string = 'user';
    let helper: AuxHelper;
    let portals: CustomAppHelper;
    let sub: Subscription;

    beforeEach(async () => {
        actions = [];
        sub = new Subscription();
        runtime = new AuxRuntime(
            {
                hash: 'hash',
                major: 1,
                minor: 0,
                patch: 0,
                version: 'v1.0.0',
                alpha: true,
                playerMode: 'builder',
            },
            {
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                isCollaborative: true,
                allowCollaborationUpgrade: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
            }
        );
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        memory.space = 'shared';

        await memory.applyEvents([botAdded(createBot('user'))]);

        helper = createHelper({
            shared: memory,
        });

        portals = new CustomAppHelper(helper);
    });

    function createHelper(partitions: AuxPartitions) {
        runtime = new AuxRuntime(
            {
                hash: 'hash',
                major: 1,
                minor: 0,
                patch: 0,
                version: 'v1.0.0',
                alpha: true,
                playerMode: 'builder',
            },
            {
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                isCollaborative: true,
                allowCollaborationUpgrade: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
            }
        );
        const helper = new AuxHelper('user', partitions, runtime);

        for (let [, partition] of iteratePartitions(partitions)) {
            sub.add(
                partition.onStateUpdated
                    .pipe(
                        tap((e) => {
                            runtime.stateUpdated(e);
                        })
                    )
                    .subscribe({ error: (e: any) => console.error(e) })
            );
        }

        runtime.userId = userId;
        sub.add(helper.localEvents.subscribe((a) => actions.push(...a)));

        return helper;
    }

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('handleEvents()', () => {
        describe('register_custom_app', () => {
            it('should create a portal for the given event', () => {
                portals.handleEvents([registerCustomApp('htmlPortal', null)]);

                expect([...portals.portals.keys()]).toEqual(['htmlPortal']);
                const values = [...portals.portals.values()];

                expect(values[0]).toBeInstanceOf(HtmlAppBackend);
                expect(values[0].botId).toBe(null);
            });

            it('should not create a new app instance if the same ID is used', () => {
                portals.handleEvents([registerCustomApp('htmlPortal', null)]);

                expect([...portals.portals.keys()]).toEqual(['htmlPortal']);
                const values = [...portals.portals.values()];
                expect(values.length).toBe(1);
                const currentBackend = values[0];

                portals.handleEvents([registerCustomApp('htmlPortal', null)]);

                const newValues = [...portals.portals.values()];
                expect(newValues.length).toBe(1);

                expect(newValues[0] === currentBackend).toBe(true);
            });
        });

        describe('unregister_custom_app', () => {
            it('should delete the portal for the given event', () => {
                portals.handleEvents([registerCustomApp('htmlPortal', null)]);

                expect([...portals.portals.keys()]).toEqual(['htmlPortal']);

                portals.handleEvents([unregisterCustomApp('htmlPortal')]);

                expect(portals.portals.size).toBe(0);
            });
        });

        describe('root app', () => {
            it('should create a HtmlAppBackend named _root', async () => {
                await setup();

                expect([...portals.portals.keys()]).toEqual(['_root']);
                const values = [...portals.portals.values()];

                expect(values[0]).toBeInstanceOf(HtmlAppBackend);
                expect(values[0].botId).toBe(helper.userId);
            });

            it('should set globalThis.document to the root app document', async () => {
                await setup();

                expect([...portals.portals.keys()]).toEqual(['_root']);
                const values = [...portals.portals.values()];

                expect(values[0]).toBeInstanceOf(HtmlAppBackend);
                expect(values[0].botId).toBe(helper.userId);
                expect(
                    globalThis.document ===
                        (values[0] as HtmlAppBackend).document
                ).toBe(true);
            });

            it('should emit a onDocumentAvailable shout', async () => {
                await helper.createBot('test1', {
                    [ON_DOCUMENT_AVAILABLE_ACTION_NAME]: '@os.toast("Setup!")',
                });

                await setup();

                await waitAsync();

                expect(actions.filter((a) => a.type === 'show_toast')).toEqual([
                    toast('Setup!'),
                ]);
            });

            it('should do nothing if a custom_app_container_available event has not been emitted', async () => {
                await waitAsync();
                expect(actions).toEqual([]);
            });

            async function setup() {
                portals.handleEvents([customAppContainerAvailable()]);

                await waitAsync();
                const action = actions.find(
                    (a) => a.type === 'register_html_app' && a.appId === '_root'
                ) as RegisterHtmlAppAction;
                expect(action).toBeTruthy();

                const result: HtmlPortalSetupResult = {
                    builtinEvents: [],
                };
                portals.handleEvents([asyncResult(action.taskId, result)]);
                await waitAsync();
            }
        });
    });
});
