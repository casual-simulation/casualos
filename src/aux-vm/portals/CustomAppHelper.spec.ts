import {
    action,
    asyncResult,
    AuxPartitions,
    AuxRuntime,
    BotAction,
    botAdded,
    createBot,
    createMemoryPartition,
    iteratePartitions,
    MemoryPartition,
    ON_DOCUMENT_AVAILABLE_ACTION_NAME,
    registerCustomApp,
    customAppContainerAvailable,
    RegisterHtmlAppAction,
    toast,
    unregisterCustomApp,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuxHelper } from '../vm';
import { CustomAppHelper } from './CustomAppHelper';
import { HtmlAppBackend, HtmlPortalSetupResult } from './HtmlAppBackend';

describe('CustomAppHelper', () => {
    let runtime: AuxRuntime;
    let actions: BotAction[];
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
