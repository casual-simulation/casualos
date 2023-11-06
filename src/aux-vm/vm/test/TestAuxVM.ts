import { AuxSubVM, AuxVM } from '../AuxVM';
import { Observable, Subject } from 'rxjs';
import { AuxChannelErrorType } from '../AuxChannelErrorTypes';
import { Remote } from 'comlink';
import {
    LocalActions,
    BotAction,
    PrecalculatedBotsState,
    BotsState,
    createPrecalculatedContext,
    merge,
    getActiveObjects,
    tagsOnBot,
    StateUpdatedEvent,
    StoredAux,
    ConnectionIndicator,
    PartitionAuthMessage,
} from '@casual-simulation/aux-common';
import {
    StatusUpdate,
    DeviceAction,
    CurrentVersion,
} from '@casual-simulation/aux-common';
import { union } from 'lodash';
import { ChannelActionResult } from '../../vm';
import {
    AuxRuntime,
    RuntimeStateVersion,
    isPromise,
} from '@casual-simulation/aux-runtime';

export class TestAuxVM implements AuxVM {
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _runtime: AuxRuntime;

    events: BotAction[];
    formulas: string[];

    id: string;
    configBotId: string;

    processEvents: boolean;
    state: BotsState;
    localEvents: Subject<LocalActions[]>;
    deviceEvents: Observable<DeviceAction[]>;
    connectionStateChanged: Subject<StatusUpdate>;
    versionUpdated: Subject<RuntimeStateVersion>;
    onError: Subject<AuxChannelErrorType>;
    subVMAdded: Subject<AuxSubVM>;
    subVMRemoved: Subject<AuxSubVM>;
    onAuthMessage: Subject<PartitionAuthMessage>;

    grant: string;

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    constructor(id: string, configBotId: string = 'user') {
        this.events = [];
        this.formulas = [];
        this.id = id;
        this.configBotId = configBotId;

        this.processEvents = false;
        this.state = {};
        this._runtime = new AuxRuntime(
            {
                hash: 'test',
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
                allowCollaborationUpgrade: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
            }
        );
        this._runtime.userId = configBotId;
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this.connectionStateChanged = new Subject<StatusUpdate>();
        this.onError = new Subject<AuxChannelErrorType>();
        this.versionUpdated = new Subject<RuntimeStateVersion>();
        this.subVMAdded = new Subject();
        this.subVMRemoved = new Subject();
        this.onAuthMessage = new Subject();
    }

    async shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult> {
        const result = this._runtime.shout(eventName, botIds, arg);

        const final = isPromise(result) ? await result : result;
        return {
            actions: final.actions,
            results: await Promise.all(final.results),
        };
    }

    async sendEvents(events: BotAction[]): Promise<void> {
        this.events.push(...events);

        if (this.processEvents) {
            let update: StateUpdatedEvent = {
                state: {},
                addedBots: [],
                removedBots: [],
                updatedBots: [],
                version: null,
            };

            for (let event of events) {
                if (event.type === 'add_bot') {
                    this.state[event.bot.id] = event.bot;
                    update.state[event.bot.id] = event.bot;
                    update.addedBots.push(event.bot.id);
                } else if (event.type === 'remove_bot') {
                    delete this.state[event.id];
                    update.state[event.id] = null;
                    update.removedBots.push(event.id);
                } else if (event.type === 'update_bot') {
                    this.state[event.id] = merge(
                        this.state[event.id],
                        event.update
                    );
                    update.state[event.id] = event.update;
                    update.updatedBots.push(event.id);
                }
            }

            if (
                update.addedBots.length > 0 ||
                update.removedBots.length > 0 ||
                update.updatedBots.length > 0
            ) {
                this._stateUpdated.next(this._runtime.stateUpdated(update));
            }
        }
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        this.formulas.push(...formulas);
    }

    async init(loadingCallback?: any): Promise<void> {}

    async forkAux(newId: string): Promise<void> {}

    async exportBots(botIds: string[]): Promise<StoredAux> {
        return {
            version: 1,
            state: {},
        };
    }

    async export(): Promise<StoredAux> {
        return {
            version: 1,
            state: {},
        };
    }

    async getTags(): Promise<string[]> {
        let objects = getActiveObjects(this.state);
        let allTags = union(...objects.map((o) => tagsOnBot(o))).sort();
        return allTags;
    }

    sendState(update: StateUpdatedEvent) {
        this._stateUpdated.next(update);
    }

    async createEndpoint() {
        return new MessagePort();
    }

    async sendAuthMessage(message: PartitionAuthMessage): Promise<void> {
        this.onAuthMessage.next(message);
    }

    unsubscribe(): void {}
    closed: boolean;
}
