import {
    Bot,
    UpdatedBot,
    BotAction,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    botAdded,
    botRemoved,
    botUpdated,
    breakIntoIndividualEvents,
    BotsState,
    getActiveObjects,
    tagsOnBot,
    hasValue,
    LocalStoragePartition,
    LocalStoragePartitionConfig,
    AuxPartitionRealtimeStrategy,
    stateUpdatedEvent,
    StateUpdatedEvent,
    PartialBotsState,
    BotSpace,
    merge,
    BotTagMasks,
    BotTags,
} from '@casual-simulation/aux-common';
import {
    StatusUpdate,
    Action,
    CurrentVersion,
} from '@casual-simulation/causal-trees';
import { flatMap, union } from 'lodash';
import {
    Subject,
    Subscription,
    Observable,
    fromEventPattern,
    BehaviorSubject,
} from 'rxjs';
import { startWith, filter, map } from 'rxjs/operators';
import {
    applyTagEdit,
    edits,
    isTagEdit,
    TagEditOp,
} from '@casual-simulation/aux-common/aux-format-2';
import {
    ensureBotIsSerializable,
    ensureTagIsSerializable,
} from '@casual-simulation/aux-common/runtime/Utils';
import { v4 as uuid } from 'uuid';

export class LocalStoragePartitionImpl implements LocalStoragePartition {
    protected _onBotsAdded = new Subject<Bot[]>();
    protected _onBotsRemoved = new Subject<string[]>();
    protected _onBotsUpdated = new Subject<UpdatedBot[]>();
    protected _onStateUpdated = new Subject<StateUpdatedEvent>();
    protected _onVersionUpdated: BehaviorSubject<CurrentVersion>;

    protected _onError = new Subject<any>();
    protected _onEvents = new Subject<Action[]>();
    protected _onStatusUpdated = new Subject<StatusUpdate>();
    protected _hasRegisteredSubs = false;
    private _state: BotsState = {};
    private _sub = new Subscription();
    private _siteId: string = uuid();
    private _remoteSite: string = uuid();
    private _updateCounter: number = 0;
    private _botsNamespace: string;
    private _instNamespace: string;

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return 'immediate';
    }

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded.pipe(startWith(getActiveObjects(this.state)));
    }

    get onBotsRemoved(): Observable<string[]> {
        return this._onBotsRemoved;
    }

    get onBotsUpdated(): Observable<UpdatedBot[]> {
        return this._onBotsUpdated;
    }

    get onStateUpdated(): Observable<StateUpdatedEvent> {
        return this._onStateUpdated.pipe(
            startWith(
                stateUpdatedEvent(this.state, this._onVersionUpdated.value)
            )
        );
    }

    get onError(): Observable<any> {
        return this._onError;
    }

    get onEvents(): Observable<Action[]> {
        return this._onEvents;
    }

    get onStatusUpdated(): Observable<StatusUpdate> {
        return this._onStatusUpdated;
    }

    get onVersionUpdated(): Observable<CurrentVersion> {
        return this._onVersionUpdated;
    }

    unsubscribe() {
        return this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    get state() {
        return this._state;
    }

    type = 'local_storage' as const;
    private: boolean;
    namespace: string;
    space: string;

    constructor(config: LocalStoragePartitionConfig) {
        this.private = config.private || false;
        this.namespace = config.namespace;
        this._botsNamespace = `${this.namespace}/bots`;
        this._instNamespace = `${this.namespace}/inst`;
        this._onVersionUpdated = new BehaviorSubject<CurrentVersion>({
            currentSite: this._siteId,
            remoteSite: this._remoteSite,
            vector: {},
        });
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        const finalEvents = flatMap(events, (e) => {
            if (e.type === 'apply_state') {
                return breakIntoIndividualEvents(this.state, e);
            } else if (
                e.type === 'add_bot' ||
                e.type === 'remove_bot' ||
                e.type === 'update_bot'
            ) {
                return [e] as const;
            } else {
                return [];
            }
        });

        this._applyEvents(finalEvents, true);

        return [];
    }

    async init(): Promise<void> {}

    connect(): void {
        this._watchLocalStorage();
        this._loadExistingBots();

        this._onStatusUpdated.next({
            type: 'connection',
            connected: true,
        });

        this._onStatusUpdated.next({
            type: 'authentication',
            authenticated: true,
        });

        this._onStatusUpdated.next({
            type: 'authorization',
            authorized: true,
        });

        this._onStatusUpdated.next({
            type: 'sync',
            synced: true,
        });
    }

    private _watchLocalStorage() {
        this._sub.add(
            storedBotUpdated(this._botsNamespace, this.space).subscribe(
                (event) => {
                    this._applyEvents([event], false);
                }
            )
        );
    }

    private _loadExistingBots() {
        let events = [] as (AddBotAction | UpdateBotAction)[];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this._botsNamespace + '/')) {
                // it is a bot
                const stored = getStoredBot(key);
                if (stored.id) {
                    events.push(botAdded(stored));
                } else {
                    const id = key.substring(this._botsNamespace.length + 1);
                    events.push(botUpdated(id, stored));
                }
            }
        }
        this._applyEvents(events, false);
    }

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[],
        updateStorage: boolean
    ) {
        let addedBots = new Map<string, Bot>();
        let removedBots = [] as string[];
        let updated = new Map<string, UpdatedBot>();
        let updatedState = {} as PartialBotsState;
        let nextVersion: CurrentVersion;
        // Flag to record if we have already created a new state object
        // during the update.
        let createdNewState = false;
        let hasUpdate = false;
        for (let event of events) {
            if (event.type === 'add_bot') {
                let bot = {
                    ...ensureBotIsSerializable(event.bot),
                    space: this.space as BotSpace,
                };
                if (createdNewState) {
                    this._state[event.bot.id] = bot;
                } else {
                    this._state = Object.assign({}, this._state, {
                        [event.bot.id]: bot,
                    });
                    createdNewState = true;
                }
                updatedState[event.bot.id] = bot;
                addedBots.set(event.bot.id, bot);
                if (updateStorage) {
                    const key = botKey(this._botsNamespace, bot.id);
                    hasUpdate = storeBot(key, bot, this.namespace);
                }
            } else if (event.type === 'remove_bot') {
                const id = event.id;
                if (createdNewState) {
                    delete this._state[id];
                } else {
                    let { [id]: removedBot, ...state } = this._state;
                    this._state = state;
                    createdNewState = true;
                }
                if (!addedBots.delete(event.id)) {
                    removedBots.push(event.id);
                }
                if (updateStorage) {
                    const key = botKey(this._botsNamespace, id);
                    hasUpdate = storeBot(key, null, this.namespace);
                }
                updatedState[event.id] = null;
            } else if (event.type === 'update_bot') {
                if (event.update.tags && this.state[event.id]) {
                    let newBot = Object.assign({}, this.state[event.id]);
                    let changedTags: string[] = [];
                    let lastBot = updatedState[event.id];
                    const updatedBot = (updatedState[event.id] = merge(
                        updatedState[event.id] || {},
                        event.update
                    ));
                    for (let tag of Object.keys(event.update.tags)) {
                        if (!newBot.tags) {
                            newBot.tags = {};
                        }
                        const newVal = ensureTagIsSerializable(
                            event.update.tags[tag]
                        );
                        const oldVal = newBot.tags[tag];

                        if (
                            (newVal !== oldVal &&
                                (hasValue(newVal) || hasValue(oldVal))) ||
                            Array.isArray(newVal)
                        ) {
                            changedTags.push(tag);
                        }

                        if (hasValue(newVal)) {
                            if (isTagEdit(newVal)) {
                                newBot.tags[tag] = applyTagEdit(
                                    newBot.tags[tag],
                                    newVal
                                );
                                nextVersion = {
                                    currentSite:
                                        this._onVersionUpdated.value
                                            .currentSite,
                                    remoteSite:
                                        this._onVersionUpdated.value.remoteSite,
                                    vector: {
                                        ...this._onVersionUpdated.value.vector,
                                        [newVal.isRemote
                                            ? this._remoteSite
                                            : this._siteId]:
                                            (this._updateCounter += 1),
                                    },
                                };

                                let combinedEdits = [] as TagEditOp[][];
                                if (lastBot) {
                                    const lastVal = lastBot.tags[tag];
                                    if (
                                        lastVal !== oldVal &&
                                        isTagEdit(lastVal)
                                    ) {
                                        combinedEdits = lastVal.operations;
                                    }
                                }

                                updatedBot.tags[tag] = edits(
                                    nextVersion.vector,
                                    ...combinedEdits,
                                    ...newVal.operations
                                );
                            } else {
                                newBot.tags[tag] = newVal;
                                updatedBot.tags[tag] = newVal;
                            }

                            if (!hasValue(newBot.tags[tag])) {
                                delete newBot.tags[tag];
                            }
                        } else if (hasValue(oldVal)) {
                            delete newBot.tags[tag];
                            updatedBot.tags[tag] = null;
                        } else {
                            // The tag was already deleted and set to null/undefined,
                            // so no change should be recorded.
                            delete newBot.tags[tag];
                            delete updatedBot.tags[tag];
                        }
                    }

                    this.state[event.id] = newBot;

                    let update = updated.get(event.id);
                    if (update) {
                        update.bot = newBot;
                        update.tags = union(update.tags, changedTags);
                    } else if (changedTags.length > 0) {
                        updated.set(event.id, {
                            bot: newBot,
                            tags: changedTags,
                        });
                    } else {
                        // No tags were changed, so the update should not be included in the updated state
                        delete updatedState[event.id];
                    }
                }

                if (event.update.masks && event.update.masks[this.space]) {
                    const tags = event.update.masks[this.space];
                    let newBot = Object.assign({}, this.state[event.id]);
                    if (!newBot.masks) {
                        newBot.masks = {};
                    }
                    if (!newBot.masks[this.space]) {
                        newBot.masks[this.space] = {};
                    }
                    let lastMasks = updatedState[event.id]?.masks?.[this.space];
                    const masks = newBot.masks[this.space];
                    const updatedBot = (updatedState[event.id] = merge(
                        updatedState[event.id] || {},
                        event.update
                    ));
                    let changedTags: string[] = [];
                    for (let tag in tags) {
                        const newVal = ensureTagIsSerializable(tags[tag]);
                        const oldVal = masks[tag];

                        if (newVal !== oldVal) {
                            changedTags.push(tag);
                        }

                        if (hasValue(newVal)) {
                            if (isTagEdit(newVal)) {
                                masks[tag] = applyTagEdit(masks[tag], newVal);
                                nextVersion = {
                                    currentSite:
                                        this._onVersionUpdated.value
                                            .currentSite,
                                    remoteSite:
                                        this._onVersionUpdated.value.remoteSite,
                                    vector: {
                                        ...this._onVersionUpdated.value.vector,
                                        [newVal.isRemote
                                            ? this._remoteSite
                                            : this._siteId]:
                                            (this._updateCounter += 1),
                                    },
                                };

                                let combinedEdits = [] as TagEditOp[][];
                                if (lastMasks) {
                                    const lastVal = lastMasks[tag];
                                    if (
                                        lastVal !== oldVal &&
                                        isTagEdit(lastVal)
                                    ) {
                                        combinedEdits = lastVal.operations;
                                    }
                                }

                                updatedBot.masks[this.space][tag] = edits(
                                    nextVersion.vector,
                                    ...combinedEdits,
                                    ...newVal.operations
                                );
                            } else {
                                masks[tag] = newVal;

                                if (newVal !== tags[tag]) {
                                    updatedBot.masks[this.space][tag] = newVal;
                                }
                            }
                        } else {
                            delete masks[tag];
                            updatedBot.masks[this.space][tag] = null;
                        }
                    }

                    if (newBot.masks) {
                        for (let space in event.update.masks) {
                            for (let tag in event.update.masks[this.space]) {
                                if (newBot.masks[space][tag] === null) {
                                    delete newBot.masks[space][tag];
                                }
                            }
                            if (Object.keys(newBot.masks[space]).length <= 0) {
                                delete newBot.masks[space];
                            }
                        }
                        if (
                            !!newBot.masks &&
                            Object.keys(newBot.masks).length <= 0
                        ) {
                            delete newBot.masks;
                        }
                    }

                    this.state[event.id] = newBot;
                }

                const updatedBot = updatedState[event.id];
                if (
                    updatedBot?.tags &&
                    Object.keys(updatedBot.tags).length <= 0
                ) {
                    delete updatedBot.tags;
                }
            }
        }

        if (addedBots.size > 0) {
            this._onBotsAdded.next([...addedBots.values()]);
        }
        if (removedBots.length > 0) {
            this._onBotsRemoved.next(removedBots);
        }
        if (updated.size > 0) {
            let updatedBots = [...updated.values()];
            this._onBotsUpdated.next(updatedBots);
        }
        const updateEvent = stateUpdatedEvent(
            updatedState,
            nextVersion ?? this._onVersionUpdated.value
        );
        if (
            updateEvent.addedBots.length > 0 ||
            updateEvent.removedBots.length > 0 ||
            updateEvent.updatedBots.length > 0
        ) {
            if (updateStorage && updateEvent.updatedBots.length > 0) {
                for (let id of updateEvent.updatedBots) {
                    let bot = this.state[id];
                    const key = botKey(this._botsNamespace, id);
                    hasUpdate = storeBot(key, bot, this.namespace);
                }
            }

            this._onStateUpdated.next(updateEvent);
        }
        if (nextVersion) {
            this._onVersionUpdated.next(nextVersion);
        }

        if (hasUpdate) {
            try {
                localStorage.setItem(
                    this._instNamespace,
                    Date.now().toString()
                );
            } catch (err) {
                console.error(err);
            }
        }
    }
}

function storedBotUpdated(
    namespace: string,
    space: string
): Observable<AddBotAction | RemoveBotAction | UpdateBotAction> {
    return storageUpdated().pipe(
        filter((e) => e.key.startsWith(namespace + '/')),
        map((e) => {
            const newBot: Bot = JSON.parse(e.newValue) || null;
            const oldBot: Bot = JSON.parse(e.oldValue) || null;
            const id = e.key.substring(namespace.length + 1);
            if (!oldBot && newBot && newBot.id) {
                return botAdded(newBot);
            } else if (!newBot && oldBot && oldBot.id) {
                return botRemoved(id);
            } else if (newBot) {
                let differentTags = calculateDifferentTags(
                    newBot.tags,
                    oldBot?.tags
                );
                let differentMasks = null as BotTagMasks;
                if (newBot.masks) {
                    if (newBot.masks[space]) {
                        differentMasks = {
                            [space]: calculateDifferentTags(
                                newBot.masks[space],
                                oldBot?.masks?.[space]
                            ),
                        };
                    }
                }

                let update = {} as Partial<Bot>;
                if (Object.keys(differentTags).length > 0) {
                    update.tags = differentTags;
                }
                if (differentMasks !== null) {
                    update.masks = differentMasks;
                }
                return botUpdated(id, update);
            }

            return null;
        }),
        filter((event) => event !== null)
    );
}

function storageUpdated(): Observable<StorageEvent> {
    return fromEventPattern(
        (h) => globalThis.addEventListener('storage', h),
        (h) => globalThis.removeEventListener('storage', h)
    );
}

function botKey(namespace: string, id: string): string {
    return `${namespace}/${id}`;
}

function getStoredBot(key: string): Bot {
    const json = localStorage.getItem(key);
    if (json) {
        const bot: Bot = JSON.parse(json);
        return bot;
    } else {
        return null;
    }
}

const MAX_ATTEMPTS = 4;

function storeBot(key: string, bot: Bot, namespace: string) {
    let lastError: any;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        try {
            if (bot) {
                const json = JSON.stringify(bot);
                localStorage.setItem(key, json);
            } else {
                localStorage.removeItem(key);
            }
            return true;
        } catch (err) {
            lastError = err;
            if (!clearOldData(namespace)) {
                // break out of the loop if no data was deleted
                break;
            }
        }
    }

    if (lastError) {
        console.error(lastError);
    }
    console.warn('[LocalStoragePartition] Failed to store bot in local space.');
    return false;
}

/**
 * Searches local storage and deletes the oldest namespace.
 * Returns whether any data was deleted.
 * @param namespaceToIgnore The namespace that should not be deleted even if it is the oldest.
 * @returns
 */
function clearOldData(namespaceToIgnore: string): boolean {
    console.log('[LocalStoragePartition] Clearing old data');
    let validNamespaces = [] as string[];
    for (let i = 0; i < localStorage.length; i++) {
        let k = localStorage.key(i);
        if (k.endsWith('/inst') && !k.startsWith(namespaceToIgnore)) {
            validNamespaces.push(k);
        }
    }
    validNamespaces.sort();

    let oldestNamespace: string;
    let oldestTime: number = Infinity;
    for (let namespace of validNamespaces) {
        let time = JSON.parse(localStorage.getItem(namespace));
        if (time < oldestTime) {
            oldestTime = time;
            oldestNamespace = namespace;
        }
    }

    if (oldestNamespace) {
        let namespace = oldestNamespace.substring(
            0,
            oldestNamespace.length - 'inst'.length
        );
        console.log('[LocalStoragePartition] Deleting namespace', namespace);
        let keysToDelete = [] as string[];
        for (let i = 0; i < localStorage.length; i++) {
            let k = localStorage.key(i);
            if (k.startsWith(namespace)) {
                keysToDelete.push(k);
            }
        }

        for (let k of keysToDelete) {
            localStorage.removeItem(k);
        }

        return keysToDelete.length > 0;
    }

    return false;
}

function calculateDifferentTags(newTags: BotTags, oldTags: BotTags) {
    const allTags = union(
        Object.keys(newTags || {}),
        Object.keys(oldTags || {})
    );
    let differentTags = {} as BotTags;
    for (let t of allTags) {
        const newTag = newTags?.[t];
        if (newTag !== oldTags?.[t]) {
            differentTags[t] = newTag;
        }
    }
    return differentTags;
}
