import {
    asyncResult,
    BotIndex,
    BotsState,
    createPrecalculatedBot,
    DEFAULT_CUSTOM_PORTAL_SCRIPT_PREFIXES,
    LocalActions,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subject, Subscription } from 'rxjs';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { BotHelper } from './BotHelper';
import { BotWatcher } from './BotWatcher';
import {
    CodeBundle,
    ExternalModule,
    LibraryModule,
    PortalBundler,
    ScriptPrefix,
} from './PortalBundler';
import {
    DEFAULT_SCRIPT_PREFIXES,
    PortalBotData,
    PortalData,
    PortalManager,
    PortalUpdate,
} from './PortalManager';

describe('PortalManager', () => {
    let manager: PortalManager;
    let vm: TestAuxVM;
    let sub: Subscription;
    let localEvents: Subject<LocalActions[]>;

    beforeEach(() => {
        sub = new Subscription();
        vm = new TestAuxVM();
        localEvents = vm.localEvents = new Subject();
        manager = new PortalManager(vm);
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('prefixes', () => {
        let prefixes = [] as ScriptPrefix[];
        let removedPrefixes = [] as string[];

        beforeEach(() => {
            prefixes = [];
            sub.add(
                manager.prefixesDiscovered.subscribe((p) => prefixes.push(...p))
            );
            sub.add(
                manager.prefixesRemoved.subscribe((p) =>
                    removedPrefixes.push(...p)
                )
            );
        });

        it('should resolve with the default prefixes', async () => {
            await waitAsync();
            expect(prefixes).toEqual(DEFAULT_SCRIPT_PREFIXES);
        });

        it('should resolve when a new prefix is added', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'javascript',
                },
            ]);
        });

        it('should use the language specified on the event', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {
                        language: 'json',
                    },
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'json',
                },
            ]);
        });

        it('should finish the register_prefix task', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(vm.events).toEqual([asyncResult('task1', undefined)]);
        });

        it('should do nothing when a prefix is registered twice', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'javascript',
                },
            ]);
        });
    });

    describe('portalBotIdUpdated', () => {
        let portals = [] as PortalBotData[];

        beforeEach(() => {
            portals = [];
            sub.add(
                manager.portalBotIdUpdated.subscribe((p) => portals.push(...p))
            );
        });

        it('should resolve when a new global bot is defined', async () => {
            expect(portals).toEqual([]);

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'define_global_bot',
                    botId: 'test',
                    name: 'my',
                    taskId: 'task1',
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    portalId: 'my',
                    botId: 'test',
                },
            ]);
            expect(manager.portalBots).toEqual(
                new Map([
                    [
                        'my',
                        {
                            type: 'define_global_bot',
                            botId: 'test',
                            name: 'my',
                            taskId: 'task1',
                        },
                    ],
                ])
            );
        });
    });
});
