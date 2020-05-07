import { AuxVM } from '../AuxVM';
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
    BotDependentInfo,
    AuxRuntime,
} from '@casual-simulation/aux-common';
import { StatusUpdate, DeviceAction } from '@casual-simulation/causal-trees';
import values from 'lodash/values';
import union from 'lodash/union';
import { AuxUser } from '../../AuxUser';
import { StoredAux } from '../../StoredAux';

export class TestAuxVM implements AuxVM {
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _runtime: AuxRuntime;

    events: BotAction[];
    formulas: string[];

    id: string;

    processEvents: boolean;
    state: BotsState;
    localEvents: Observable<LocalActions[]>;
    deviceEvents: Observable<DeviceAction[]>;
    connectionStateChanged: Subject<StatusUpdate>;
    onError: Subject<AuxChannelErrorType>;
    grant: string;
    user: AuxUser;

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    constructor(userId: string = 'user') {
        this.events = [];
        this.formulas = [];

        this.processEvents = false;
        this.state = {};
        this._runtime = new AuxRuntime(
            {
                hash: 'test',
                major: 1,
                minor: 0,
                patch: 0,
                version: 'v1.0.0',
            },
            {
                supportsAR: false,
                supportsVR: false,
            }
        );
        this._runtime.userId = userId;
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this.connectionStateChanged = new Subject<StatusUpdate>();
        this.onError = new Subject<AuxChannelErrorType>();
    }

    async setUser(user: AuxUser): Promise<void> {
        this.user = user;
    }
    async setGrant(grant: string): Promise<void> {
        this.grant = grant;
    }

    async sendEvents(events: BotAction[]): Promise<void> {
        this.events.push(...events);

        if (this.processEvents) {
            let added = [];
            let removed = [];
            let updated = [];

            for (let event of events) {
                if (event.type === 'add_bot') {
                    this.state[event.bot.id] = event.bot;
                    added.push(event.bot);
                } else if (event.type === 'remove_bot') {
                    delete this.state[event.id];
                    removed.push(event.id);
                } else if (event.type === 'update_bot') {
                    this.state[event.id] = merge(
                        this.state[event.id],
                        event.update
                    );
                    updated.push({
                        bot: this.state[event.id],
                        tags: Object.keys(event.update.tags),
                    });
                }
            }

            if (added.length > 0) {
                this._stateUpdated.next(this._runtime.botsAdded(added));
            }
            if (removed.length > 0) {
                this._stateUpdated.next(this._runtime.botsRemoved(removed));
            }
            if (updated.length > 0) {
                this._stateUpdated.next(this._runtime.botsUpdated(updated));
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

    async getReferences(tag: string): Promise<BotDependentInfo> {
        return this._runtime.dependencies.getDependents(tag);
    }

    async getTags(): Promise<string[]> {
        let objects = getActiveObjects(this.state);
        let allTags = union(...objects.map(o => tagsOnBot(o))).sort();
        return allTags;
    }

    sendState(update: StateUpdatedEvent) {
        this._stateUpdated.next(update);
    }

    unsubscribe(): void {}
    closed: boolean;
}
