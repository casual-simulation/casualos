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
    UpdateHtmlAppAction,
} from '@casual-simulation/aux-common';
import {
    asyncResult,
    botAdded,
    createBot,
    createMemoryPartition,
    htmlAppEvent,
    iteratePartitions,
    ON_APP_SETUP_ACTION_NAME,
    registerHtmlApp,
    setAppOutput,
    toast,
    unregisterHtmlApp,
    updateHtmlApp,
} from '@casual-simulation/aux-common';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';
import { AuxRuntime } from '@casual-simulation/aux-runtime';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import { HtmlAppBackend } from './HtmlAppBackend';
import { v4 as uuid } from 'uuid';
import { AuxHelper } from '../vm';
import { tap } from 'rxjs/operators';
import { h } from 'preact';
import htm from 'htm';
import { htmlAppMethod } from '@casual-simulation/aux-common/bots/BotEvents';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

describe('HtmlAppBackend', () => {
    let runtime: AuxRuntime;
    let actions: RuntimeActions[];
    let memory: MemoryPartition;
    let userId: string = 'user';
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
                comID: null,
            }
        );
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        memory.space = 'shared';

        await memory.applyEvents([botAdded(createBot('user'))]);
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
                comID: null,
            }
        );
        const helper = new AuxHelper(userId, partitions, runtime);

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

    it('should send a register_html_app event when created', async () => {
        const helper = createHelper({
            shared: memory,
        });
        uuidMock.mockReturnValueOnce('uuid');

        let portal = new HtmlAppBackend(
            'testPortal',
            'myBot',
            helper,
            undefined,
            'appId'
        );

        await waitAsync();

        expect(actions).toEqual([
            registerHtmlApp('testPortal', 'appId', 'uuid'),
        ]);
    });

    describe('onAppSetup', () => {
        it('should send a onRender action when the register_html_app result is returned', async () => {
            const helper = createHelper({
                shared: memory,
            });
            await helper.transaction(
                botAdded(
                    createBot('myBot', {
                        [ON_APP_SETUP_ACTION_NAME]: `@tags.rendered = true`,
                        rendered: false,
                    })
                )
            );

            uuidMock.mockReturnValueOnce('uuid');

            let portal = new HtmlAppBackend('testPortal', 'myBot', helper);

            await waitAsync();

            expect(helper.botsState['myBot'].tags.rendered).toBe(false);

            portal.handleEvents([asyncResult('uuid', null)]);

            await waitAsync();

            expect(runtime.currentState['myBot'].values.rendered).toBe(true);
        });

        it('should include the HTML document in the onAppSetup action', async () => {
            const helper = createHelper({
                shared: memory,
            });
            await helper.transaction(
                botAdded(
                    createBot('myBot', {
                        [ON_APP_SETUP_ACTION_NAME]: `@that.document.body.appendChild(that.document.createElement('h1'))`,
                    })
                )
            );

            uuidMock.mockReturnValueOnce('uuid');

            let portal = new HtmlAppBackend(
                'testPortal',
                'myBot',
                helper,
                undefined,
                'appId'
            );

            await waitAsync();

            portal.handleEvents([asyncResult('uuid', null)]);

            await waitAsync();

            expect(actions).toEqual([
                registerHtmlApp('testPortal', 'appId', 'uuid'),
                updateHtmlApp('testPortal', [
                    {
                        type: 'childList',
                        target: expect.objectContaining({
                            __id: 'testPortal',
                        }),
                        addedNodes: [
                            expect.objectContaining({
                                __id: '0',
                                nodeName: 'H1',
                            }),
                        ],
                        removedNodes: [],
                        attributeName: undefined,
                        attributeNamespace: undefined,
                        nextSibling: undefined,
                        previousSibling: undefined,
                        oldValue: undefined,
                    },
                ]),
            ]);
        });

        it('should call event listeners for the html_app_event events', async () => {
            const helper = createHelper({
                shared: memory,
            });
            await helper.transaction(
                botAdded(
                    createBot('myBot', {
                        [ON_APP_SETUP_ACTION_NAME]: `@let h1 = that.document.createElement('h1'); h1.addEventListener('click', () => tags.clicked = true); that.document.body.appendChild(h1);`,
                        clicked: false,
                    })
                )
            );

            uuidMock.mockReturnValueOnce('uuid');

            let portal = new HtmlAppBackend('testPortal', 'myBot', helper);

            await waitAsync();

            portal.handleEvents([asyncResult('uuid', null)]);

            await waitAsync();

            portal.handleEvents([
                htmlAppEvent('testPortal', {
                    type: 'click',
                    target: '1',
                }),
            ]);

            await waitAsync();

            expect(runtime.currentState['myBot'].values.clicked).toBe(true);
        });

        it('should emit an async result for the given register task ID', async () => {
            const helper = createHelper({
                shared: memory,
            });
            await helper.transaction(
                botAdded(
                    createBot('myBot', {
                        [ON_APP_SETUP_ACTION_NAME]: `@os.toast("Hit")`,
                    })
                )
            );

            uuidMock.mockReturnValueOnce('uuid');

            let portal = new HtmlAppBackend(
                'testPortal',
                'myBot',
                helper,
                'taskId'
            );

            await waitAsync();

            portal.handleEvents([asyncResult('uuid', null)]);

            await waitAsync();

            expect(actions.slice(1)).toEqual([
                toast('Hit'),
                asyncResult('taskId', null),
            ]);
        });

        it('should trigger the onSetup observable', async () => {
            const helper = createHelper({
                shared: memory,
            });
            await helper.transaction(botAdded(createBot('myBot', {})));

            uuidMock.mockReturnValueOnce('uuid');

            let portal = new HtmlAppBackend('testPortal', 'myBot', helper);
            let setup = false;
            portal.onSetup.subscribe(() => (setup = true));

            await waitAsync();

            expect(setup).toBe(false);

            portal.handleEvents([asyncResult('uuid', null)]);

            await waitAsync();

            expect(setup).toBe(true);
        });

        it('should issue a html_app_method_call when .focus() is called', async () => {
            const helper = createHelper({
                shared: memory,
            });
            await helper.transaction(
                botAdded(
                    createBot('myBot', {
                        [ON_APP_SETUP_ACTION_NAME]: `@os.toast(that.document.body.focus())`,
                    })
                )
            );

            uuidMock.mockReturnValueOnce('uuid1').mockReturnValueOnce('uuid2');

            let portal = new HtmlAppBackend(
                'testPortal',
                'myBot',
                helper,
                undefined,
                'appId'
            );

            await waitAsync();

            portal.handleEvents([asyncResult('uuid1', null)]);

            await waitAsync();

            expect(actions.slice(0, 3)).toEqual([
                registerHtmlApp('testPortal', 'appId', 'uuid1'),
                htmlAppMethod('testPortal', 'testPortal', 'focus', [], 'uuid2'),
                toast(undefined),
            ]);
        });
    });

    describe('set_app_output', () => {
        it('should render the output as a preact component', async () => {
            const helper = createHelper({
                shared: memory,
            });

            uuidMock.mockReturnValueOnce('uuid');

            let portal = new HtmlAppBackend(
                'testPortal',
                'myBot',
                helper,
                undefined,
                'appId'
            );

            await waitAsync();

            const html = htm.bind(h);

            portal.handleEvents([asyncResult('uuid', null)]);
            portal.handleEvents([
                setAppOutput('testPortal', html`<h1>Hello</h1>`),
            ]);

            await waitAsync();

            expect(actions.length).toBe(2);
            expect(actions[0]).toEqual(
                registerHtmlApp('testPortal', 'appId', 'uuid')
            );

            const updateAction = actions[1] as UpdateHtmlAppAction;

            expect(updateAction).toMatchSnapshot();

            expect(updateAction.type).toBe('update_html_app');
            expect(updateAction.appId).toBe('testPortal');
            expect(updateAction.updates.length).toBe(1);
            expect(updateAction.updates[0].type).toBe('childList');
            expect(updateAction.updates[0].addedNodes.length).toBe(1);
            const h1Node = updateAction.updates[0].addedNodes[0] as any;
            expect(h1Node.nodeName).toBe('H1');
            expect(h1Node.childNodes.length).toBe(1);
            expect(h1Node.childNodes[0].nodeType).toBe(3);
        });

        it('should render the most recent output when the app is setup', async () => {
            const helper = createHelper({
                shared: memory,
            });

            uuidMock.mockReturnValueOnce('uuid');

            let portal = new HtmlAppBackend(
                'testPortal',
                'myBot',
                helper,
                undefined,
                'appId'
            );

            await waitAsync();

            const html = htm.bind(h);

            portal.handleEvents([
                setAppOutput('testPortal', html`<h1>Hello</h1>`),
                asyncResult('uuid', null),
            ]);

            await waitAsync();

            expect(actions.length).toBe(2);
            expect(actions[0]).toEqual(
                registerHtmlApp('testPortal', 'appId', 'uuid')
            );

            const updateAction = actions[1] as UpdateHtmlAppAction;

            expect(updateAction).toMatchSnapshot();

            expect(updateAction.type).toBe('update_html_app');
            expect(updateAction.appId).toBe('testPortal');
            expect(updateAction.updates.length).toBe(1);
            expect(updateAction.updates[0].type).toBe('childList');
            expect(updateAction.updates[0].addedNodes.length).toBe(1);
            const h1Node = updateAction.updates[0].addedNodes[0] as any;
            expect(h1Node.nodeName).toBe('H1');
            expect(h1Node.childNodes.length).toBe(1);
            expect(h1Node.childNodes[0].nodeType).toBe(3);
        });

        it('should not replace input elements when setting the value attribute', async () => {
            const helper = createHelper({
                shared: memory,
            });

            uuidMock.mockReturnValueOnce('uuid1').mockReturnValueOnce('uuid2');

            let portal = new HtmlAppBackend(
                'testPortal',
                'myBot',
                helper,
                undefined,
                'appId'
            );

            await waitAsync();

            const html = htm.bind(h);

            const listener1 = jest.fn();
            const listener2 = jest.fn();

            portal.handleEvents([
                setAppOutput(
                    'testPortal',
                    h('div', {}, h('input', { value: '', onInput: listener1 }))
                ),
                asyncResult('uuid1', null),
            ]);

            await waitAsync();

            expect(actions.length).toBe(2);
            expect(actions[0]).toEqual(
                registerHtmlApp('testPortal', 'appId', 'uuid1')
            );

            const updateAction = actions[1] as UpdateHtmlAppAction;

            expect(updateAction).toMatchSnapshot();

            expect(updateAction.type).toBe('update_html_app');
            expect(updateAction.appId).toBe('testPortal');
            expect(updateAction.updates.length).toBe(2);
            expect(updateAction.updates[0].type).toBe('event_listener');
            expect(updateAction.updates[0].listenerName).toBe('input');
            expect(updateAction.updates[1].type).toBe('childList');
            expect(updateAction.updates[1].addedNodes.length).toBe(1);
            const inputNode1 = updateAction.updates[1].addedNodes[0] as any;
            expect(inputNode1.nodeName).toBe('DIV');

            portal.handleEvents([
                setAppOutput(
                    'testPortal',
                    h(
                        'div',
                        {},
                        h('input', { value: 'my value', onInput: listener1 })
                    )
                ),
                asyncResult('uuid2', null),
            ]);

            await waitAsync();

            const updateAction2 = actions[2] as UpdateHtmlAppAction;

            expect(updateAction2).toMatchSnapshot();

            expect(updateAction2.type).toBe('update_html_app');
            expect(updateAction2.appId).toBe('testPortal');
            expect(updateAction2.updates.length).toBe(1);
            expect(updateAction2.updates[0].type).toBe('attributes');
            expect(updateAction2.updates[0].attributeName).toBe('value');
            expect((<any>updateAction2.updates[0].target).attributes).toEqual([
                { name: 'value', value: 'my value' },
            ]);
        });
    });

    describe('dispose()', () => {
        it('should send a unregister_html_app event', async () => {
            const helper = createHelper({
                shared: memory,
            });
            await helper.transaction(botAdded(createBot('myBot', {})));

            uuidMock.mockReturnValueOnce('uuid');

            let portal = new HtmlAppBackend(
                'testPortal',
                'myBot',
                helper,
                undefined,
                'appId'
            );

            await waitAsync();

            portal.dispose();

            await waitAsync();

            expect(actions.slice(1)).toEqual([
                unregisterHtmlApp('testPortal', 'appId'),
            ]);
        });
    });
});
