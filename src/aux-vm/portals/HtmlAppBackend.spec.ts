import {
    asyncResult,
    AuxPartitions,
    AuxRuntime,
    BotAction,
    botAdded,
    createBot,
    createMemoryPartition,
    htmlAppEvent,
    iteratePartitions,
    MemoryPartition,
    ON_APP_SETUP_ACTION_NAME,
    registerHtmlApp,
    setAppOutput,
    stateUpdatedEvent,
    toast,
    unregisterHtmlApp,
    updateHtmlApp,
    UpdateHtmlAppAction,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import { HtmlAppBackend } from './HtmlAppBackend';
import { v4 as uuid } from 'uuid';
import { AuxHelper } from '../vm';
import { skip, tap } from 'rxjs/operators';
import { h } from 'preact';
import htm from 'htm';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

describe('HtmlAppBackend', () => {
    let runtime: AuxRuntime;
    let actions: BotAction[];
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
                isCollaborative: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
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
                isCollaborative: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
            }
        );
        const helper = new AuxHelper(partitions, runtime);

        for (let [, partition] of iteratePartitions(partitions)) {
            sub.add(
                partition.onStateUpdated
                    .pipe(
                        tap((e) => {
                            runtime.stateUpdated(e);
                        })
                    )
                    .subscribe(null, (e: any) => console.error(e))
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

            expect(actions.slice(1)).toEqual([
                registerHtmlApp('testPortal', 'appId', 'uuid'),
                updateHtmlApp('testPortal', [
                    {
                        type: 'childList',
                        target: expect.objectContaining({
                            __id: '0',
                        }),
                        addedNodes: [
                            expect.objectContaining({
                                __id: '1',
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

            expect(actions.slice(2)).toEqual([
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
            expect(h1Node.childNodes[0].nodeName).toBe('#text');
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
            expect(h1Node.childNodes[0].nodeName).toBe('#text');
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
            expect(updateAction.updates[0].listenerName).toBe('Input');
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
                { name: 'value', value: 'my value', ns: null },
            ]);
        });
    });

    describe('dispose()', () => {
        it('should send a unregister_html_app event', async () => {
            const helper = createHelper({
                shared: memory,
            });
            await helper.transaction(botAdded(createBot('myBot', {})));

            uuidMock.mockReturnValueOnce('uuid').mockReturnValueOnce;

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

            expect(actions.slice(2)).toEqual([
                unregisterHtmlApp('testPortal', 'appId'),
            ]);
        });
    });
});
